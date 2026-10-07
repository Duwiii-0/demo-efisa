export const STATUS_STYLES = {
  waiting_approval_production: 'bg-[#AA32BE]/25 text-[#7D1B87]',
  waiting_approval_engineering: 'bg-[#EC6602]/25 text-[#A84600]',
  waiting_approval_quality: 'bg-[#0087BE]/25 text-[#005E85]',
  waiting_approval_spr: 'bg-[#00E6E6]/25 text-[#006B6B]',
  accepted: 'bg-[#009999]/25 text-[#006B6B]',
  approved: 'bg-[#009999]/25 text-[#006B6B]',
  rejected: 'bg-[#EF0137]/25 text-[#B80028]',
  rework: 'bg-orange-400/25 text-orange-800',
  rework_required: 'bg-[#FFD200]/30 text-[#7A6100]',
  canceled: 'bg-slate-400/25 text-slate-600',
  not_available: 'bg-slate-400/20 text-slate-600',
  under_review: 'bg-amber-400/25 text-amber-800',
  pending: 'bg-slate-400/20 text-slate-600',
}

export const badgeClass = (id, size = 'sm') =>
  `inline-flex items-center whitespace-nowrap rounded-md border border-white/60 shadow-sm backdrop-blur-md ${
    size === 'lg' ? 'px-3 py-1 text-sm font-semibold' : 'px-2 py-0.5 text-xs font-medium'
  } ${STATUS_STYLES[id] ?? STATUS_STYLES.pending}`

export const findName = (list, id, key = 'name') => list.find((item) => item.id === id)?.[key] ?? '-'

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return (
    date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  )
}

export function formatBytes(size) {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

export function toLocalInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function todayInputValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
