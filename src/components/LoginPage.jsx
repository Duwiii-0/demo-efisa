import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Alert, Button, Field, Input, Spinner } from './ui.jsx'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accounts, setAccounts] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api
      .demoAccounts()
      .then((data) => active && setAccounts(data))
      .catch(() => active && setAccounts({ users: [] }))
    return () => {
      active = false
    }
  }, [])

  async function submit(nextEmail, nextPassword) {
    setBusy(true)
    setError('')
    try {
      const result = await api.login(nextEmail, nextPassword)
      onLogin(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const quickLogin = (user) => {
    setEmail(user.email)
    setPassword(accounts.password)
    submit(user.email, accounts.password)
  }

  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-6">
      <div className="grid max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl md:grid-cols-2 md:overflow-hidden">
        <section className="bg-sky-900 px-8 py-10 text-sky-50 md:overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Siemens</p>
          <h1 className="mt-3 text-3xl font-bold">EFISA</h1>
          <p className="mt-2 text-sm text-sky-100">First Sample Inspection</p>
        </section>

        <section className="px-8 py-10 md:overflow-y-auto">
          <h2 className="text-lg font-semibold text-slate-900">Login</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun Siemens Anda untuk masuk.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              submit(email, password)
            }}
          >
            {error ? <Alert>{error}</Alert> : null}

            <Field label="Email" required htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="role@siemens.com (mis. procurement@siemens.com)"
                autoComplete="username"
              />
            </Field>

            <Field label="Password" required htmlFor="password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Memproses...' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5">
            {!accounts ? (
              <Spinner label="Mengambil akun demo..." />
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Akun demo — password: <span className="font-mono font-semibold">{accounts.password}</span>
                </p>
                <ul className="max-h-48 space-y-2 overflow-auto">
                  {accounts.users.map((user) => (
                    <li
                      key={user.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{user.name}</p>
                        <p className="truncate font-mono text-xs text-slate-500">{user.email}</p>
                      </div>
                      <Button
                        variant="secondary"
                        className="shrink-0 px-3 py-1 text-xs"
                        disabled={busy}
                        onClick={() => quickLogin(user)}
                      >
                        Login
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
