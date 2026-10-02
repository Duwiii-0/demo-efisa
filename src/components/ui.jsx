export function Field({ label, required, hint, error, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  )
}

const controlClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-900 disabled:opacity-100'

export function Input({ className = '', invalid, ...props }) {
  return <input className={`${controlClass} ${invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''} ${className}`} {...props} />
}

export function Select({ className = '', invalid, children, ...props }) {
  return (
    <select className={`${controlClass} ${invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', invalid, ...props }) {
  return (
    <textarea
      rows={3}
      className={`${controlClass} resize-y ${invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''} ${className}`}
      {...props}
    />
  )
}

export function SectionCard({ step, title, description, children, error }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-sm font-semibold text-white">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
        {error ? <span className="ml-auto rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600">{error}</span> : null}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'

const variants = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'border border-rose-300 bg-white text-rose-600 hover:bg-rose-50',
  warning: 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return <button className={`${buttonBase} ${variants[variant]} ${className}`} {...props} />
}

export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  }
  return <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${tones[tone]}`}>{children}</div>
}

export function Toast({ tone = 'success', onClose, children }) {
  const tones = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  }
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${tones[tone]}`}>
        <span>{children}</span>
        {onClose ? (
          <button type="button" onClick={onClose} className="shrink-0 font-bold opacity-60 transition hover:opacity-100" aria-label="Tutup notifikasi">
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title ? <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">{title}</h3> : null}
      <dl className="divide-y divide-slate-100">{children}</dl>
    </div>
  )
}

export function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 sm:col-span-2">{children}</dd>
    </div>
  )
}

export function Spinner({ label = 'Memuat data...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      {label}
    </div>
  )
}
