import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../lib/api.js'

const NAV_GROUPS = [
  {
    title: 'General',
    items: [
      { to: '/data-fsa', label: 'Data FSA', icon: 'list' },
      { to: '/', label: 'FSA Assigned to You', end: true, icon: 'inbox' },
    ],
  },
]


function Icon({ name }) {
  const paths = {
    inbox: 'M3 13l2-8h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5zm0 0h5l1 2h2l1-2h5',
    list: 'M4 6h16M4 12h16M4 18h16',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    archive: 'M4 4h16v4H4zM5 8h14v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8zm5 4h4',
    plus: 'M12 5v14M5 12h14',
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

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
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white">S</span>
          <div>
            <p className="text-sm font-bold tracking-[0.2em] text-slate-900">SIEMENS</p>
            <p className="text-[11px] text-slate-500">FSA First Sample</p>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Search...</span>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-xs font-medium text-slate-400">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

        </nav>

        <div ref={menuRef} className="relative border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
              {initials(user.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
              <span className="block truncate text-xs text-slate-500">{role?.name ?? user.role}</span>
            </span>
          </button>

          {open ? (
            <div className="absolute bottom-16 left-4 right-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <p className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{user.email}</p>
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
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
    </div>
  )
}
