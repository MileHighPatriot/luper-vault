import { useState, type FormEvent } from 'react'
import { BookOpenText, CalendarClock, KeyRound, Users, Volume2, VolumeX } from 'lucide-react'
import { useRepository, useRepositoryValue } from '@/data/RepositoryContext'
import { PinError, SettingsError } from '@/data/repository'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/pin'
import { CUTOFF_LABEL, GO_LIVE_DATE_KEY, MONTH_TIER_OPENS_DATE_KEY } from '@/lib/time/calendar'
import { HOUSEHOLD_TIME_ZONE } from '@/lib/time/denver'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Notice = { tone: 'ok' | 'error'; text: string } | null

function NoticeLine({ notice, testId }: { notice: Notice; testId: string }) {
  if (!notice) return null
  return (
    <p
      role={notice.tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={notice.tone === 'error' ? 'text-sm font-medium text-destructive' : 'text-sm font-medium text-primary'}
    >
      {notice.text}
    </p>
  )
}

/** ADMIN ONLY. Family name, Sky log verse, kid-sound mute, and the parent PIN. */
export function SettingsPage() {
  const repo = useRepository()
  const family = useRepositoryValue((r) => r.getFamilySettings())

  const [familyName, setFamilyName] = useState(family.familyName)
  const [verse, setVerse] = useState(family.verse)
  const [familyNotice, setFamilyNotice] = useState<Notice>(null)

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinNotice, setPinNotice] = useState<Notice>(null)

  function saveFamily(event: FormEvent) {
    event.preventDefault()
    try {
      const saved = repo.adminUpdateFamilySettings({ familyName, verse })
      setFamilyName(saved.familyName)
      setVerse(saved.verse)
      setFamilyNotice({ tone: 'ok', text: 'Saved. Kids see the new verse on Home the next time it loads.' })
    } catch (err) {
      setFamilyNotice({ tone: 'error', text: err instanceof SettingsError ? err.message : 'Could not save settings.' })
    }
  }

  function toggleMute() {
    repo.adminUpdateFamilySettings({ muteKidSounds: !family.muteKidSounds })
  }

  function changePin(event: FormEvent) {
    event.preventDefault()
    try {
      repo.adminChangePin({ currentPin, newPin, confirmPin })
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setPinNotice({ tone: 'ok', text: 'PIN changed. Use the new PIN the next time a parent logs in.' })
    } catch (err) {
      setPinNotice({ tone: 'error', text: err instanceof PinError ? err.message : 'Could not change the PIN.' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Light family settings. Kids never see this page and never enter a PIN.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-5 text-primary" aria-hidden />
              Family
            </CardTitle>
            <CardDescription>Display name in the header and the Sky log verse on kid Home.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={saveFamily}>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Family display name
                <Input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  maxLength={40}
                  required
                  data-testid="settings-family-name"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <BookOpenText className="size-4 text-primary" aria-hidden />
                  Sky log verse for the week
                </span>
                <textarea
                  value={verse}
                  onChange={(e) => setVerse(e.target.value)}
                  rows={4}
                  maxLength={400}
                  required
                  data-testid="settings-verse"
                  className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <NoticeLine notice={familyNotice} testId="settings-family-notice" />
              <Button type="submit" data-testid="settings-family-save">
                Save family settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {family.muteKidSounds ? (
                  <VolumeX className="size-5 text-primary" aria-hidden />
                ) : (
                  <Volume2 className="size-5 text-primary" aria-hidden />
                )}
                Kid sounds
              </CardTitle>
              <CardDescription>
                Sounds ship with the Constellation skin later. This switch is saved now so tablets start quiet if you want.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" data-testid="settings-mute-state">
                {family.muteKidSounds ? 'Muted' : 'Sounds on'}
              </span>
              <Button
                type="button"
                variant="outline"
                role="switch"
                aria-checked={family.muteKidSounds}
                onClick={toggleMute}
                data-testid="settings-mute-toggle"
              >
                {family.muteKidSounds ? 'Turn sounds on' : 'Mute kid sounds'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-5 text-primary" aria-hidden />
                Household clock
              </CardTitle>
              <CardDescription>Read-only. Change previews on the Clock tab.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Time zone</dt>
                <dd className="font-medium">{HOUSEHOLD_TIME_ZONE}</dd>
                <dt className="text-muted-foreground">Go-live</dt>
                <dd className="font-medium">Monday {GO_LIVE_DATE_KEY}</dd>
                <dt className="text-muted-foreground">Earn window</dt>
                <dd className="font-medium">Mon–Sat until {CUTOFF_LABEL}</dd>
                <dt className="text-muted-foreground">Month / quarter tiers</dt>
                <dd className="font-medium">Open {MONTH_TIER_OPENS_DATE_KEY}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-5 text-primary" aria-hidden />
            Admin PIN
          </CardTitle>
          <CardDescription>
            Shared parent login. {PIN_MIN_LENGTH}–{PIN_MAX_LENGTH} digits. Kameron, Alea, and Christopher never need it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={changePin}>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Current PIN
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                required
                data-testid="settings-pin-current"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              New PIN
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                minLength={PIN_MIN_LENGTH}
                maxLength={PIN_MAX_LENGTH}
                required
                data-testid="settings-pin-new"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Confirm new PIN
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                minLength={PIN_MIN_LENGTH}
                maxLength={PIN_MAX_LENGTH}
                required
                data-testid="settings-pin-confirm"
              />
            </label>
            <div className="flex flex-col gap-3 sm:col-span-3">
              <NoticeLine notice={pinNotice} testId="settings-pin-notice" />
              <div>
                <Button type="submit" data-testid="settings-pin-save">
                  Change PIN
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Forgot the PIN? Clearing this browser's site data resets it to the build default (VITE_ADMIN_PIN, or
                2580) but also clears the ledger. Keep the PIN somewhere safe.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
