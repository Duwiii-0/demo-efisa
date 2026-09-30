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

  const demoUser = accounts?.users?.find((user) => user.isDemoLogin) ?? accounts?.users?.[0]

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <section className="bg-sky-900 px-8 py-10 text-sky-50">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Siemens</p>
          <h1 className="mt-3 text-3xl font-bold">EFISA</h1>
          <p className="mt-2 text-sm text-sky-100">First Sample Inspection</p>
          <ul className="mt-8 space-y-3 text-sm text-sky-100">
            <li>Register sample part lengkap dengan dokumen PPAP</li>
            <li>Cross functional approval dari 5 fungsi</li>
            <li>Tracking status approval secara real time</li>
          </ul>
        </section>

        <section className="px-8 py-10">
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
                placeholder="namabelakang.namadepan@siemens.com"
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Akun demo</p>
                {demoUser ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm">
                    <p className="font-semibold text-sky-900">{demoUser.name}</p>
                    <p className="text-sky-800">{demoUser.email}</p>
                    <p className="mt-1 text-sky-700">
                      Password: <span className="font-mono font-semibold">{accounts.password}</span>
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      disabled={busy}
                      onClick={() => {
                        setEmail(demoUser.email)
                        setPassword(accounts.password)
                        submit(demoUser.email, accounts.password)
                      }}
                    >
                      Login sebagai {demoUser.name}
                    </Button>
                  </div>
                ) : null}
                <details className="text-sm">
                  <summary className="cursor-pointer text-slate-500">
                    Lihat semua {accounts.users.length} user
                  </summary>
                  <ul className="mt-2 max-h-52 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2 text-xs text-slate-600">
                    {accounts.users.map((user) => (
                      <li key={user.id} className="flex justify-between gap-2">
                        <span>{user.name}</span>
                        <span className="text-slate-400">{user.email}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
