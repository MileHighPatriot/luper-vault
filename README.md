# The Luper Ledger

A family shared-reward app. Kids and parents earn approved points that pour into three **family** vault meters; nobody has a personal score to compete over. (Constellation Crew skin comes later.)

> **Phase 6 of 6 — Calendar gate. The Monday-ready core is complete.**
>
> Phases 1–5 shipped the skeleton, seed data, auth, meter math, the parent Inbox, parent Add earn, kid Home + Earn, Rewards, and Wins. Phase 6 adds the **household calendar**: go-live on **Monday 2026-09-28**, an earn window of **Monday–Saturday until 8:00 PM America/Denver**, **Sunday as reward day** (no Path A claims), and the **month / quarter tiers opening Oct 1, 2026**. Kids' "I did it" is blocked outside the window with a clear message, Home and Rewards switch to celebrate copy on Sundays, countdown chips run on the real Denver calendar, and admins get a Clock panel with FORCE_LIVE and a dev clock preview. Later polish (constellation skin, sounds, crowns, real auth) is tracked separately.

## Phase map

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation: shell, auth, data model, seed catalog, meter engine, admin verify screen | done |
| 2 | Parent inbox + ledger writes (approve / deny / edit, ledger list, dev claim queue) | done |
| 3 | Parent Add earn (Path B earns, conduct + parent demerits, direct ledger write) | done |
| 4 | Kid Home + Earn (family meters, verse card, "I did it" claims, Path B read-only) | done |
| 5 | Rewards builder, kid Rewards (locked / unlocked per tier), Wins reel, one-time announce banner | done |
| 6 | Calendar gate: go-live, Mon–Sat 8 PM Denver cutoff, Sunday reward day, Oct 1 tier opening, Clock panel | **this repo** |

## Calendar rules (locked)

All clock math runs on `America/Denver`, DST-safe via [`@date-fns/tz`](https://github.com/date-fns/tz). The rules live in `src/lib/time/calendar.ts` and are unit-tested, including across the Nov 1, 2026 DST change.

| Rule | Value |
|------|-------|
| Family go-live / first counted earn week | **Monday 2026-09-28**, 00:00 Denver. Chosen as the first Monday that keeps a full October for the month tier. |
| Earn window | **Monday–Saturday**, until **8:00 PM Denver** (inclusive: 8:00:00 PM is closed). |
| After cutoff | New Path A claims are rejected with "Claims closed for tonight at 8:00 PM. Back tomorrow morning." (Saturday: "...the vault reopens Monday."). |
| Sunday | Reward / celebrate day. No Path A claims. Kid Home and Rewards show "Reward day — no claims today" and point to Rewards / Wins. |
| Month tier (T2) | Calendar months. **October 1–31, 2026 is the first full month.** Sep 28–30 earns still flow into every vault through the 50/30/20 split, but the month tier officially **opens Oct 1**. |
| Quarter tier (T3) | Starts **Oct 1, 2026** as **"Fall 2026"** (Oct–Dec = Fall, Jan–Mar = Winter, Apr–Jun = Spring, Jul–Sep = Summer). |
| Before go-live | Everyone sees the banner "Family go-live Mon Sep 28 — October month starts Oct 1". Admin screens work for testing; kid claims are blocked unless FORCE_LIVE. |
| FORCE_LIVE | Parent testing switch. Lets kids claim before Sep 28. **Never** bypasses Sunday or the cutoff. Set at runtime on Admin → Clock, or at build time with `VITE_FORCE_LIVE=true` in `.env.local`. |

Meters do **not** reset in this phase; the fills (120 / 280 / 560) and the 50/30/20 split are unchanged. Period rollover behaviour beyond the countdowns is a later ticket.

### Enforcement

- `Repository.claimForKid()` is the kid's "I did it". It calls `getEarnWindow()` and throws `ClaimError('window-closed', message)` when closed. The UI also hides the buttons, but the repository is the gate.
- `Repository.queueClaim()` (used only by Admin → Dev tools) bypasses the gate so parents can test the Inbox on any day.
- `Repository.now()` honors an admin-set **clock override** so every gate, countdown, and "Approve all today" can be previewed at a chosen Denver instant.

### Countdown chips (kid Home)

Real remaining time to: the **week cutoff** (Saturday 8:00 PM Denver), the **month end** (midnight starting next month), and the **quarter end** (midnight starting next quarter, labelled with the season). Before Oct 1 the month and quarter chips count down to their **opening** on Oct 1 instead.

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

Admin PIN defaults to `1234`. Override by copying `.env.example` to `.env.local` and setting `VITE_ADMIN_PIN` (the same file holds `VITE_FORCE_LIVE`). This is a **Phase 1 placeholder** (`TODO(prod-auth)` in `src/auth/session.ts`), not real security.

### Kid screens (little / teen roles)

Logging in as Kameron, Alea, or Christopher lands on `/home` with tabs Home · Earn · Rewards · Wins.

- **Home** (`/home`) — the three family vault meters as progress bars with fill and percent (family-wide only), real countdown chips to the week cutoff / month end / quarter end (see Calendar rules), a Sunday "Reward day — no claims today" banner, a "Vault moved" chip if the ledger changed in the last 24 hours, the **Sky log** verse card read from `settings.verse`, and a one-time **announcement banner** when a parent has announced a reward this kid has not yet been shown (marked seen on first view; in-app only, no push).
- **Rewards** (`/rewards`) — Week · Month · Quarter tabs (Sunday adds a reward-day banner). Each active reward for that tier shows as **Unlocked** when the family meter has reached its fill (T1 120, T2 280, T3 560) and **Locked** otherwise, with the meter's fill bar and percent. No prices, no personal costs, no point math.
- **Wins** (`/wins`) — unlock and announce events, newest first (title, period, Denver time). Empty state: "No wins yet — fill the vault on Home". A dashed "Top earner crowns — Phase later" strip is a placeholder only; no crown scoring exists.
- **Earn** (`/earn`) — the kid's band catalog **by name only**, no point values. Little kids see the little list; Christopher sees the teen list. Positive conduct stamps (Caught being good, Outstanding day) appear as read-only Path B rows. Demerits never appear.
  - Path A rows have an **"I did it"** button that creates a pending claim (the same `PendingClaim` the parent Inbox consumes). The row then shows **"Waiting for Ground Control"** until a parent approves or denies it. A kid cannot queue the same act twice while one is pending. Outside the earn window (before go-live, Sunday, or after 8 PM Denver) the buttons are replaced by "Closed" and a notice explains why and when claims reopen.
  - Path B rows show **"Parent adds this"** with no button.

Kid-facing data comes only from `listEarnActsForKid`, `listKidPendingClaims`, `getMeters`, `getVaultLastMovedAt`, `getEarnWindow`, `listRewardsForKids`, `listWins`, and `getSettings`, none of which carry point values or per-person totals. Kids hitting any `/admin/*` URL are redirected home.

### Parent screens (admin role)

After logging in as Admin, the parent console links to the tabs under `/admin`:

- **Inbox** (`/admin/inbox`) — pending Path A claims, newest first, with kid, act, points, and Denver time. Per row: **Approve**, **Deny**, **Edit** (change points and/or add a note, then Approve or Deny). **Approve all today** approves every pending claim created on the current Denver calendar day. Empty state reads "All clear".
- **Add earn** (`/admin/add-earn`) — pick an earner (Kameron, Alea, Christopher, or Parent = the admin logging their own act), then a **Path B only** act. Kids see their band's Path B stamps (Honest, School growth, Bible verse, ...) plus the conduct acts for their audience (Caught good, Outstanding day, Day demerit, Serious); Parent sees the parent list including the parent day demerit. Path A acts are not offered and are rejected by the repository if forced. Optional note. Submit writes the ledger and moves the meters immediately, then shows a "Vault updated" banner with the 50/30/20 split and a link to the Ledger.
- **Rewards** (`/admin/rewards`) — one list per vault tier. Add a reward (title + blurb), edit inline, deactivate / reactivate (inactive rewards are hidden from kids but kept), and **Announce** (stamps the reward, records an "Announced" Win, and queues the one-time banner for every kid; announcing twice is a no-op). Each tier header shows whether its meter is currently unlocked.
- **Clock** (`/admin/clock`) — Denver now, go-live status, earn window open / closed with reason, day / cutoff flags, month and quarter tier status with season label, the **FORCE_LIVE** toggle, a **clock preview** (presets for before go-live, go-live Monday, Mon 8:01 PM, Tue 3 PM, Sat 8:30 PM, Sunday, or any custom instant) that freezes the household clock for every gate until cleared, and the same countdown chips the kids see.
- **Ledger** (`/admin/ledger`) — the last 50 approved events (who, act, points, path, source, note). Sources are `Inbox` (approved claim), `Add earn` (parent stamp), or `Simulated` (verify screen). Pending and denied claims never appear here.
- **Verify** (`/admin/verify`) — meter engine and seed checks (see below).
- **Dev tools** (`/admin/dev`) — queue a Path A claim on a kid's behalf (kids normally claim from their own Earn screen), or **Seed demo claims** (two per kid, skipping acts already pending). Path B acts cannot be queued. Also lists recent claims of every status and offers a full reset of claims, ledger, and meters.

What happens on **Approve**: a `LedgerEntry` is written (`userId`, `actId`, final `points`, `path: 'A'`, `source: 'inbox'`, `claimId`, note, timestamp), the meter engine is called with the final points (edited value if present, otherwise the catalog value), and the claim is marked `approved`, all in one commit. **Deny** marks the claim `denied` with an optional note and touches neither the ledger nor the meters.

**Add earn** uses the same write path (`recordApprovedPoints`) with `path: 'B'` and `source: 'add-earn'`; demerits are just negative catalog points, so they drain the meters through the same engine. Demerits are never projected into the kid Earn list.

**Unlocks**: every ledger write (inbox approval, Add earn, or verify-screen simulate) runs the meters through the engine and compares before / after. The first time a meter reaches its fill, an `unlock` Win is recorded naming that tier's first active reward (or "Week vault filled" etc. if none). Overflow past the fill does not create further unlocks. Wins are cleared by the Dev tools reset; rewards are kept.

### Admin verify screen

Open **Verify** (`/admin/verify`). It shows:

- T1 / T2 / T3 fill, percentage, and any tracked overflow
- **Simulate +10 approved points** (expect T1 +5, T2 +3, T3 +2), **Simulate −5 demerit**, **Reset meters**
- Seeded act counts by band against the locked expectations (little 18, teen 23, conduct 8, parent 13)

## Live URL (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds and deploys `main` to GitHub Pages on every push. The site is served at `https://<owner>.github.io/<repo>/`; the workflow sets `VITE_BASE_PATH=/<repo>/` so assets and the router (`BrowserRouter basename`) resolve under that prefix, and copies `index.html` to `404.html` so deep links like `/home` work on Pages.

One-time setup after the repository exists: **Settings → Pages → Source: GitHub Actions** (the workflow also attempts to enable this itself). Then the deploy URL appears on the workflow run and under Settings → Pages. Data stays in each browser's `localStorage`; the Pages site holds no family data.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 with shadcn/ui-style primitives (`src/components/ui`)
- react-router-dom 7
- `@date-fns/tz` for DST-safe America/Denver wall-clock math
- Vitest

## Persistence: repository layer over localStorage

Phase 1 uses a **repository layer over `localStorage`** rather than a server + SQLite. The whole database is one JSON snapshot under the key `luper-ledger:db`.

- `src/data/types.ts` — tables: `users`, `earnActs`, `ledger` (approved points only), `pendingClaims` (status `pending | approved | denied`, `requestedPoints`, optional `editedPoints` / `parentNote`), `vaultMeters` (T1/T2/T3), `rewards` (tier, title, blurb, active, optional announcement with per-kid seen list), `wins` (unlock / announce events), `settings` (verse placeholder, schema version, `forceLive`, dev `clockOverride`).
- `src/data/repository.ts` — `StorageAdapter` interface (`load` / `save` / `clear`) and the typed `Repository` on top of it. Claim lifecycle lives here: `queueClaim` (Path A, kids only), `approveClaim`, `denyClaim`, `approveAllPendingOn(dateKey)`; Path B stamping is `adminAddEarn` with `adminListPathBActsFor(earnerId)` for the eligible list; plus other `admin*` helpers.
- Schema version is `4`. `migrateDatabase` upgrades older snapshots in place (v2 → adds seeded `rewards` and an empty `wins` table; v3 → adds `settings.forceLive` and `settings.clockOverride`), keeping ledger and claims; anything older than v2 is reseeded.
- `src/data/localStorageRepository.ts` — the adapter the app uses.
- `src/data/memoryRepository.ts` — in-memory adapter for tests and storage-less environments.

Swapping to SQLite later means writing one more `StorageAdapter`; UI and engine do not change. Seeding runs automatically the first time the store is empty (or when `schemaVersion` changes).

### Kid safety rule

The repository exposes **no per-user or per-sibling totals**. The only aggregate is `getMeters()` (family-wide). Kid-facing projections (`KidEarnAct`, `KidPendingClaim`, `KidReward`, `Win`) strip point values and per-kid fields; tests assert their JSON never contains `points`, `cost`, `seenBy`, or `userId`. Ledger reads and claim resolution are prefixed `admin*` or documented ADMIN ONLY, and are only reached from admin routes behind `RequireAdmin`. Please keep it that way in later phases.

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

`src/lib/time/denver.ts` provides `toDenverParts`, `nowInDenver`, `denverDateKey`, `isDenverSunday`, and `formatDenver`, all pinned to `America/Denver` via `Intl`. `src/lib/time/calendar.ts` builds the household rules on top of it with `@date-fns/tz`: `isBeforeGoLive`, `isEarnDay`, `isPastCutoff`, `isCelebrateSunday`, `isMonthTierOpen`, `earnWindow`, `seasonLabel`, `weekCutoffAt`, `monthEndAt`, `quarterEndAt`, `countdowns`, `denverInstant`.

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
  components/    AppShell (title + phase badge), AdminLayout + KidLayout tabs, MeterStrip, AnnouncementBanner, route guards, ui/ primitives
  data/          types, repository (claims, ledger, rewards, calendar gate), adapters, seed/, useHouseholdClock, tests
  engine/        meter math + tests
  lib/time/      America/Denver helpers, household calendar rules + countdowns, tests
  routes/        LoginPage, ParentConsole, InboxPage, AddEarnPage, RewardsBuilderPage, LedgerPage, ClockPage, DevToolsPage, AdminVerifyPage, kid/ (Home, Earn, Rewards, Wins)
```
