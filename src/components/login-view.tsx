import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import * as AUTH from '@/lib/auth'
import { navigate } from '@/lib/format'

export function LoginView({ signup, onLogin }: { signup: boolean; onLogin: (name: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const name = signup ? await AUTH.register(username, password) : await AUTH.login(username, password)
      navigate('#/')
      onLogin(name)
      toast.success('Welcome!')
    } catch (ex) {
      setError((ex as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto mt-8 w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        </CardTitle>
        <CardDescription>{signup ? 'Pick a username and password to get started.' : 'Log in to continue learning.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} key={signup ? 'signup' : 'login'}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input id="username" autoComplete="username" required autoFocus value={username} onChange={e => setUsername(e.target.value)} />
            </Field>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                minLength={signup ? 6 : 1}
                value={password}
                onChange={e => setPassword(e.target.value)}
                aria-invalid={!!error || undefined}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <Button type="submit" size="lg" disabled={busy}>
              {signup ? 'Sign up' : 'Log in'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-1 text-center text-sm text-muted-foreground">
        {signup ? (
          AUTH.hasUsers() && (
            <p>
              Already have an account?{' '}
              <a href="#/" className="text-foreground underline underline-offset-4">
                Log in
              </a>
            </p>
          )
        ) : (
          <p>
            New here?{' '}
            <a href="#/signup" className="text-foreground underline underline-offset-4">
              Create an account
            </a>
          </p>
        )}
        <p className="text-xs">Accounts are stored in this browser only.</p>
      </CardFooter>
    </Card>
  )
}
