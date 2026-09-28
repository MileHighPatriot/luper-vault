import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { KeyRound, Loader2, Satellite, WifiOff } from 'lucide-react'
import { STORAGE_KEY } from '@/data/localStorageRepository'
import type { RepositoryOptions } from '@/data/repository'
import { createSupabaseRemote, FamilyCodeError, type SupabaseConfig } from '@/data/remoteLedger'
import { SyncedLedger } from '@/data/syncedLedger'
import type { Database } from '@/data/types'
import { SkyBackdrop } from '@/components/SkyBackdrop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export const FAMILY_CODE_KEY = 'luper-ledger:family-code'

type State =
  | { kind: 'need-code'; error: string | null }
  | { kind: 'connecting'; code: string }
  | { kind: 'offline'; code: string }
  | { kind: 'ready'; ledger: SyncedLedger }

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the code just has to be typed again next visit.
  }
}

/** This browser's pre-sync data, uploaded only if the family server is empty. */
function readLocalSnapshot(): Database | null {
  const raw = readStored(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Database
  } catch {
    return null
  }
}

/**
 * Connects this device to the shared family ledger. Asks for the family code
 * once per device, then renders the app with the synced repository.
 */
export function FamilyConnect({
  config,
  options,
  children,
}: {
  config: SupabaseConfig
  options: RepositoryOptions
  children: (ledger: SyncedLedger) => ReactNode
}) {
  const [state, setState] = useState<State>(() => {
    const code = readStored(FAMILY_CODE_KEY)
    return code ? { kind: 'connecting', code } : { kind: 'need-code', error: null }
  })

  const connectingCode = state.kind === 'connecting' ? state.code : null
  useEffect(() => {
    if (!connectingCode) return
    let cancelled = false
    SyncedLedger.connect(createSupabaseRemote(config, connectingCode), {
      ...options,
      localSnapshot: readLocalSnapshot(),
    }).then(
      (ledger) => {
        if (cancelled) return
        writeStored(FAMILY_CODE_KEY, connectingCode)
        setState({ kind: 'ready', ledger })
      },
      (error: unknown) => {
        if (cancelled) return
        if (error instanceof FamilyCodeError) {
          writeStored(FAMILY_CODE_KEY, null)
          setState({ kind: 'need-code', error: 'That family code did not work. Check it with a parent and try again.' })
        } else {
          setState({ kind: 'offline', code: connectingCode })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [config, options, connectingCode])

  const readyLedger = state.kind === 'ready' ? state.ledger : null
  useEffect(() => readyLedger?.start(), [readyLedger])

  if (state.kind === 'ready') return <>{children(state.ledger)}</>

  return (
    <div className="sky sky-kid flex min-h-screen items-center justify-center px-4 py-10">
      <SkyBackdrop />
      <div className="relative w-full max-w-md">
        {state.kind === 'need-code' && (
          <CodeForm error={state.error} onSubmit={(code) => setState({ kind: 'connecting', code })} />
        )}
        {state.kind === 'connecting' && (
          <Card>
            <CardHeader className="items-center text-center">
              <Loader2 className="size-8 animate-spin text-star" aria-hidden />
              <CardTitle>Contacting Ground Control…</CardTitle>
              <CardDescription>Loading the family ledger.</CardDescription>
            </CardHeader>
          </Card>
        )}
        {state.kind === 'offline' && (
          <Card>
            <CardHeader className="items-center text-center">
              <WifiOff className="size-8 text-deny" aria-hidden />
              <CardTitle>Can’t reach the family ledger</CardTitle>
              <CardDescription>Check the Wi-Fi, then try again.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => setState({ kind: 'connecting', code: state.code })}>Try again</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function CodeForm({ error, onSubmit }: { error: string | null; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Satellite className="size-6 text-star" aria-hidden />
          Join the family crew
        </CardTitle>
        <CardDescription>
          Enter the family code once on this device. A parent has it. After that, everyone’s stars show up here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="family-code" className="sr-only">
            Family code
          </label>
          <Input
            id="family-code"
            autoFocus
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Family code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={code.trim().length === 0}>
            <KeyRound className="size-4" aria-hidden />
            Connect
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
