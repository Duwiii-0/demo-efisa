import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { api, setToken, getToken } from './lib/api.js'
import LoginPage from './components/LoginPage.jsx'
import AppLayout from './components/AppLayout.jsx'
import FsaListPage from './components/FsaListPage.jsx'
import FsaCreatePage from './components/FsaCreatePage.jsx'
import FsaDetailPage from './components/FsaDetailPage.jsx'
import FsaEditPage from './components/FsaEditPage.jsx'
import { Alert, Spinner } from './components/ui.jsx'

function AppRoutes() {
  const [session, setSession] = useState(null)
  const [reference, setReference] = useState(null)
  const [flash, setFlash] = useState('')
  const [bootstrapped, setBootstrapped] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

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
      navigate('/')
    } catch (err) {
      setToken(null)
      setError(err.message)
    }
  }, [navigate])

  const handleLogout = useCallback(() => {
    setToken(null)
    setSession(null)
    setReference(null)
    navigate('/login')
  }, [navigate])

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
        <div className="mx-auto mb-5 max-w-[1600px]">
          <Alert tone="success">{flash}</Alert>
        </div>
      ) : null}

      <Routes>
        <Route
          path="/"
          element={
            <FsaListPage
              reference={reference}
              canCreate={session.user.role === 'procurement'}
              onCreate={() => navigate('/create')}
              onOpenDetail={(id) => {
                setFlash('')
                navigate(`/fsa/${id}`)
              }}
            />
          }
        />
        <Route
          path="/create"
          element={
            <FsaCreatePage
              reference={reference}
              user={session.user}
              onCancel={() => navigate('/')}
              onCreated={(fsa) => {
                setFlash(`FSA ${fsa.fsaNumber} berhasil dibuat dan menunggu approval.`)
                navigate(`/fsa/${fsa.id}`)
              }}
            />
          }
        />
        <Route
          path="/fsa/:id"
          element={
            <FsaDetailPage
              reference={reference}
              onBack={() => navigate('/')}
              onEdit={
                session.user.role === 'procurement'
                  ? (fsa) => navigate(`/fsa/${fsa.id}/edit`)
                  : undefined
              }
            />
          }
        />
        <Route
          path="/fsa/:id/edit"
          element={
            <FsaEditPage
              reference={reference}
              user={session.user}
              onCancel={(id) => navigate(`/fsa/${id}`)}
              onSaved={(fsa) => {
                setFlash(`FSA ${fsa.fsaNumber} berhasil diperbarui dan dikembalikan ke Waiting Approval SPR.`)
                navigate(`/fsa/${fsa.id}`)
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
