import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'

function initials(name) {
  return (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function AppLayout({ user, reference, onLogout, children }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const role = reference?.roles.find((item) => item.id === user.role)

  async function logout() {
    try {
      await api.logout()
    } finally {
      onLogout()
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-[0.25em] text-sky-700">SIEMENS</span>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <span className="text-sm font-semibold text-slate-900">FSA First Sample Inspection</span>
          </div>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white transition ${
                open ? 'bg-sky-700' : 'bg-sky-600 hover:bg-sky-700'
              }`}
              aria-label="Menu user"
            >
              {initials(user.name)}
            </button>

            {open ? (
              <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <span className="mt-2 inline-block rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                    {role?.name ?? user.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="block w-full px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
    </div>
  )
}