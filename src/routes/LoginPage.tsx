import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, Satellite } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import type { User } from '@/data/types'
import { crewStyle } from '@/lib/crew'
import { burstFrom } from '@/lib/fx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PhaseBadge } from '@/components/AppShell'
import { PlanetAvatar } from '@/components/PlanetAvatar'

const ROLE_LABEL: Record<User['role'], string> = {
  little: 'Little',
  teen: 'Teen',
  admin: 'Shared parent login',
}

export function LoginPage() {
  const { user, login } = useAuth()
  const users = useRepositoryValue((repo) => repo.listUsers())
  const familyName = useRepositoryValue((repo) => repo.getFamilySettings().familyName)
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingAdmin, setPendingAdmin] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  const kids = users.filter((u) => u.role !== 'admin')
  const admin = users.find((u) => u.role === 'admin')

  function pick(target: User) {
    setError(null)
    if (target.role === 'admin') {
      setPendingAdmin(target)
      setPin('')
      return
    }
    const result = login(target.id)
    if (result.ok) navigate('/', { replace: true })
    else setError('That login is not available right now.')
  }

  function submitPin(event: FormEvent) {
    event.preventDefault()
    if (!pendingAdmin) return
    const result = login(pendingAdmin.id, pin)
    if (result.ok) {
      navigate('/', { replace: true })
      return
    }
    setError(result.reason === 'bad-pin' ? 'Wrong PIN. Try again.' : 'That login is not available right now.')
    setPin('')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <PhaseBadge />
        </div>
        <h1 className="text-starlight text-4xl font-extrabold tracking-tight sm:text-5xl">Who’s flying today?</h1>
        <p className="text-sm text-muted-foreground">
          {familyName} crew check-in. Tap your planet. Kids go straight in; parents enter the admin PIN.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kids.map((kid, i) => (
          <button
            key={kid.id}
            type="button"
            onClick={(e) => {
              burstFrom(e.currentTarget.querySelector('[data-planet]'), { count: 18, distance: 110 })
              pick(kid)
            }}
            className="glass group flex animate-rise-in flex-col items-center gap-3 rounded-3xl border p-6 text-center transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span data-planet className="py-2">
              <PlanetAvatar userId={kid.id} name={kid.name} size={76} spinRing className="transition-transform duration-500 group-hover:scale-110" />
            </span>
            <span>
              <span className="block text-2xl font-extrabold">{kid.name}</span>
              <span className="block text-xs font-bold" style={{ color: crewStyle(kid.id).color }}>
                {crewStyle(kid.id).callsign}
              </span>
              <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[kid.role]}</span>
            </span>
          </button>
        ))}
      </div>

      {admin && (
        <Card className="mx-auto w-full max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Satellite className="size-5 text-star" aria-hidden />
              Ground Control
            </CardTitle>
            <CardDescription>{ROLE_LABEL.admin}. Enter the admin PIN to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingAdmin ? (
              <form onSubmit={submitPin} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="admin-pin" className="sr-only">
                  Admin PIN
                </label>
                <Input
                  id="admin-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="sm:max-w-40"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={pin.length === 0}>
                    <KeyRound className="size-4" aria-hidden />
                    Unlock
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingAdmin(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" onClick={() => pick(admin)}>
                <KeyRound className="size-4" aria-hidden />
                Log in as {admin.name}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
