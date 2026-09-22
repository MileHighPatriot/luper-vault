# The Luper Ledger

A family shared-reward app. Kids and parents earn approved points that pour into three **family** vault meters; nobody has a personal score to compete over. (Constellation Crew skin comes later.)

> **Phase 3 of 6 — Parent Add earn (Path B + demerits). Do not expect the full app.**
>
> Phase 1 shipped the runnable skeleton, seed data, auth, and meter math. Phase 2 added the parent Inbox for Path A claims. Phase 3 adds **Add earn**: a parent can stamp Path B earns and demerits (for a kid or for themselves) straight into the family ledger, no claim involved. There is still no kid Earn button (Path A claims are queued from an admin Dev tools page), no rewards, no calendar gate. Kids still see a stub home with "Phase 4" / "Phase 5" placeholders; that is intentional.

## Phase map

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation: shell, auth, data model, seed catalog, meter engine, admin verify screen | done |
| 2 | Parent inbox + ledger writes (approve / deny / edit, ledger list, dev claim queue) | done |
| 3 | Parent Add earn (Path B earns, conduct + parent demerits, direct ledger write) | **this repo** |
| 4 | Kid Home + Earn | not started |
| 5 | Kid Rewards + basic Wins | not started |
| 6 | Calendar gate (Mon–Sat ~8pm Denver, Sunday celebrate) | not started |

## Run it

Requires Node 20.11+ (tested on Node 22).

```bash
npm install
npm run dev        # http://127.0.0.1:4177
npm test           # vitest: meter math, seed counts, Denver time helpers
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```

### Logins

Pick a name on the login screen. Session is remembered in `localStorage`.

| User | Role | Band |
|------|------|------|
| Kameron | little | little |
| Alea | little | little |
| Christopher | teen | teen |
| Admin (shared parent login) | admin | — |

Admin PIN defaults to `1234`. Override by copying `.env.example` to `.env.local` and setting `VITE_ADMIN_PIN`. This is a **Phase 1 placeholder** (`TODO(prod-auth)` in `src/auth/session.ts`), not real security.

### Parent screens (admin role)

After logging in as Admin, the parent console links to five tabs under `/admin`:

- **Inbox** (`/admin/inbox`) — pending Path A claims, newest first, with kid, act, points, and Denver time. Per row: **Approve**, **Deny**, **Edit** (change points and/or add a note, then Approve or Deny). **Approve all today** approves every pending claim created on the current Denver calendar day. Empty state reads "All clear".
- **Add earn** (`/admin/add-earn`) — pick an earner (Kameron, Alea, Christopher, or Parent = the admin logging their own act), then a **Path B only** act. Kids see their band's Path B stamps (Honest, School growth, Bible verse, ...) plus the conduct acts for their audience (Caught good, Outstanding day, Day demerit, Serious); Parent sees the parent list including the parent day demerit. Path A acts are not offered and are rejected by the repository if forced. Optional note. Submit writes the ledger and moves the meters immediately, then shows a "Vault updated" banner with the 50/30/20 split and a link to the Ledger.
- **Ledger** (`/admin/ledger`) — the last 50 approved events (who, act, points, path, source, note). Sources are `Inbox` (approved claim), `Add earn` (parent stamp), or `Simulated` (verify screen). Pending and denied claims never appear here.
- **Verify** (`/admin/verify`) — meter engine and seed checks (see below).
- **Dev tools** (`/admin/dev`) — stand-in for the kid Earn button until Phase 4: queue a Path A claim for a chosen kid, or **Seed demo claims** (two per kid). Path B acts cannot be queued. Also lists recent claims of every status and offers a full reset of claims, ledger, and meters.

What happens on **Approve**: a `LedgerEntry` is written (`userId`, `actId`, final `points`, `path: 'A'`, `source: 'inbox'`, `claimId`, note, timestamp), the meter engine is called with the final points (edited value if present, otherwise the catalog value), and the claim is marked `approved`, all in one commit. **Deny** marks the claim `denied` with an optional note and touches neither the ledger nor the meters.

**Add earn** uses the same write path (`recordApprovedPoints`) with `path: 'B'` and `source: 'add-earn'`; demerits are just negative catalog points, so they drain the meters through the same engine. Demerits and every other Add-earn act are Path B, so a future kid Earn list (Phase 4) filtering on `path === 'A'` will never show them.

### Admin verify screen

Open **Verify** (`/admin/verify`). It shows:

- T1 / T2 / T3 fill, percentage, and any tracked overflow
- **Simulate +10 approved points** (expect T1 +5, T2 +3, T3 +2), **Simulate −5 demerit**, **Reset meters**
- Seeded act counts by band against the locked expectations (little 18, teen 23, conduct 8, parent 13)

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 with shadcn/ui-style primitives (`src/components/ui`)
- react-router-dom 7
- Vitest

## Persistence: repository layer over localStorage

Phase 1 uses a **repository layer over `localStorage`** rather than a server + SQLite. The whole database is one JSON snapshot under the key `luper-ledger:db`.

- `src/data/types.ts` — tables: `users`, `earnActs`, `ledger` (approved points only), `pendingClaims` (status `pending | approved | denied`, `requestedPoints`, optional `editedPoints` / `parentNote`), `vaultMeters` (T1/T2/T3), `settings` (verse placeholder, schema version).
- `src/data/repository.ts` — `StorageAdapter` interface (`load` / `save` / `clear`) and the typed `Repository` on top of it. Claim lifecycle lives here: `queueClaim` (Path A, kids only), `approveClaim`, `denyClaim`, `approveAllPendingOn(dateKey)`; Path B stamping is `adminAddEarn` with `adminListPathBActsFor(earnerId)` for the eligible list; plus other `admin*` helpers.
- Schema version is `2`. A stored snapshot with a different version is reseeded (Phase 1 data was simulation-only, so nothing is migrated).
- `src/data/localStorageRepository.ts` — the adapter the app uses.
- `src/data/memoryRepository.ts` — in-memory adapter for tests and storage-less environments.

Swapping to SQLite later means writing one more `StorageAdapter`; UI and engine do not change. Seeding runs automatically the first time the store is empty (or when `schemaVersion` changes).

### Kid safety rule

The repository exposes **no per-user or per-sibling totals**. The only aggregate is `getMeters()` (family-wide). Ledger reads and claim resolution are prefixed `admin*` or documented ADMIN ONLY, and are only reached from admin routes behind `RequireAdmin`. Please keep it that way in later phases.

## Meter engine

`src/engine/meters.ts` is pure and fully unit-tested.

- Every approved entry (positive or negative) is split **50% T1 / 30% T2 / 20% T3**.
- Meters fill at **T1 = 120, T2 = 280, T3 = 560** points.
- No personal caps: a single large entry is applied in full.
- Values are stored as integer tenths so the split is exact for any integer point amount.
- Points above a meter's fill are **tracked as overflow**, not discarded, and never shorten a period. Period timelines are calendar-based and arrive in Phase 6.
- Negative points drain overflow first, then the visible meter, never below zero.

Key exports: `splitPoints(points)`, `applyLedgerEntry(meters, points)`, `initialMeters()`, `meterPercent(meter)`.

## Denver time

`src/lib/time/denver.ts` provides `toDenverParts`, `nowInDenver`, `denverDateKey`, `isDenverSunday`, and `formatDenver`, all pinned to `America/Denver` via `Intl`. No cutoff logic yet; Phase 6 builds on these.

## Seed catalog

`src/data/seed/acts.ts` holds the locked lists. Each act carries `band`, `points`, `path` (`A` kid-claimable / `B` parent-stamped), and `pathBStamp`. Conduct acts exist twice (little / teen values) via `audience`.

| Band | Acts | All Path B? |
|------|------|-------------|
| little | 18 | no (4 Path B) |
| teen | 23 | no (10 Path B) |
| conduct | 8 | yes |
| parent | 13 | yes |

## Project layout

```
src/
  auth/          session + AuthProvider (login/logout, PIN check)
  components/    AppShell (title + phase badge), AdminLayout tabs, MeterStrip, route guards, ui/ primitives
  data/          types, repository (claims + ledger), adapters, seed/, tests
  engine/        meter math + tests
  lib/time/      America/Denver helpers + tests
  routes/        LoginPage, HomeStub, InboxPage, AddEarnPage, LedgerPage, DevToolsPage, AdminVerifyPage
```
