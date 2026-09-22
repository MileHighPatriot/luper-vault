import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useRepositoryValue } from '@/data/RepositoryContext'
import type { User } from '@/data/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PhaseBadge } from '@/components/AppShell'

const ROLE_LABEL: Record<User['role'], string> = {
  little: 'Little',
  teen: 'Teen',
  admin: 'Shared parent login',
}

export function LoginPage() {
  const { user, login } = useAuth()
  const users = useRepositoryValue((repo) => repo.listUsers())
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who is this?</h1>
        <p className="text-sm text-muted-foreground">
          Pick your name. Parents share one login and enter the admin PIN.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {kids.map((kid) => (
          <button
            key={kid.id}
            type="button"
            onClick={() => pick(kid)}
            className="group rounded-xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary group-hover:bg-card">
                {kid.role === 'teen' ? <Sparkles className="size-5" aria-hidden /> : <UserRound className="size-5" aria-hidden />}
              </span>
              <div>
                <div className="font-semibold">{kid.name}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABEL[kid.role]}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {admin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              {admin.name}
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
