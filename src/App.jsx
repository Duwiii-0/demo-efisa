import { useCallback, useEffect, useState } from 'react'
import { api, setToken, getToken } from './lib/api.js'
import LoginPage from './components/LoginPage.jsx'
import AppLayout from './components/AppLayout.jsx'
import FsaListPage from './components/FsaListPage.jsx'
import FsaCreatePage from './components/FsaCreatePage.jsx'
import FsaDetailPage from './components/FsaDetailPage.jsx'
import { Alert, Button, Spinner } from './components/ui.jsx'
import FsaEditPage from './components/FsaEditPage.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [reference, setReference] = useState(null)
  const [route, setRoute] = useState({ view: 'list', id: null })
  const [flash, setFlash] = useState('')
  const [bootstrapped, setBootstrapped] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) {
      setBootstrapped(true)
      return
    }

    let active = true
    api
      .reference()
      .then((data) => {
        if (!active) return
        setReference(data)
        setSession({ user: data.me })
      })
      .catch(() => {
        setToken(null)
      })
      .finally(() => active && setBootstrapped(true))
    return () => {
      active = false
    }
  }, [])

  const handleLogin = useCallback(async ({ token, user }) => {
    setToken(token)
    try {
      const data = await api.reference()
      setReference(data)
      setSession({ user })
      setRoute({ view: 'list', id: null })
    } catch (err) {
      setToken(null)
      setError(err.message)
    }
  }, [])

  const handleLogout = useCallback(() => {
    setToken(null)
    setSession(null)
    setReference(null)
    setRoute({ view: 'list', id: null })
  }, [])

  if (!bootstrapped) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <Spinner label="Menyiapkan aplikasi..." />
      </main>
    )
  }

  if (!session?.user) {
    return (
      <>
        {error ? (
          <div className="mx-auto max-w-md p-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  if (!reference) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <Spinner />
      </main>
    )
  }

  return (
    <AppLayout
      user={session.user}
      reference={reference}
      onLogout={handleLogout}
    >
      {flash ? (
        <div className="mx-auto mb-5 max-w-6xl">
          <Alert tone="success">{flash}</Alert>
        </div>
      ) : null}

      {route.view === 'list' ? (
        <FsaListPage
          reference={reference}
          canCreate={session.user.role === 'procurement'}
          onCreate={() => setRoute({ view: 'create', id: null })}
          onOpenDetail={(id) => {
            setFlash('')
            setRoute({ view: 'detail', id })
          }}
        />
      ) : null}

      {route.view === 'create' ? (
        <FsaCreatePage
          reference={reference}
          user={session.user}
          onCancel={() => setRoute({ view: 'list', id: null })}
          onCreated={(fsa) => {
            setFlash(`FSA ${fsa.fsaNumber} berhasil dibuat dan menunggu approval.`)
            setRoute({ view: 'detail', id: fsa.id })
          }}
        />
      ) : null}

      {route.view === 'detail' ? (
        <FsaDetailPage
          key={route.id}
          id={route.id}
          reference={reference}
          onBack={() => setRoute({ view: 'list', id: null })}
          onEdit={
            session.user.role === 'procurement'
              ? (fsa) => setRoute({ view: 'edit', id: fsa.id, fsa })
              : undefined
          }
        />
      ) : null}

      {route.view === 'edit' ? (
        <FsaEditPage
          key={route.id}
          fsa={route.fsa}
          reference={reference}
          user={session.user}
          onCancel={() => setRoute({ view: 'detail', id: route.id })}
          onSaved={(fsa) => {
            setFlash(`FSA ${fsa.fsaNumber} berhasil diperbarui dan dikembalikan ke Waiting Approval SPR.`)
            setRoute({ view: 'detail', id: fsa.id })
          }}
        />
      ) : null}
    </AppLayout>
  )
}
