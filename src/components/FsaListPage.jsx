import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { Alert, Button, Card, Spinner } from './ui.jsx'
import { badgeClass, findName, formatDateTime } from '../lib/format.js'
import { assignedActionableKeys } from '../lib/fsaForm.js'

function FsaTable({ items, reference, onOpenDetail, emptyText }) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="px-5 py-10 text-center text-sm text-slate-500">{emptyText}</p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-3xl text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">FSA Number</th>
              <th className="px-5 py-3 font-semibold">Part Number</th>
              <th className="px-5 py-3 font-semibold">Material</th>
              <th className="px-5 py-3 font-semibold">Supplier</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((fsa) => (
              <tr
                key={fsa.id}
                onClick={() => onOpenDetail(fsa.id)}
                className="cursor-pointer transition hover:bg-sky-50/60"
              >
                <td className="px-5 py-3 font-semibold text-sky-700">{fsa.fsaNumber}</td>
                <td className="px-5 py-3 font-mono text-xs">{fsa.partNumber}</td>
                <td className="max-w-xs truncate px-5 py-3 text-slate-600">{fsa.materialDescription}</td>
                <td className="px-5 py-3 text-slate-600">{findName(reference.suppliers, fsa.supplierId)}</td>
                <td className="px-5 py-3">
                  <span className={badgeClass(fsa.approvalStatus)}>{findName(reference.fsaStatuses, fsa.approvalStatus)}</span>
                </td>
                <td className="px-5 py-3 text-slate-500">{formatDateTime(fsa.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{items.length} data ditemukan</p>
    </Card>
  )
}

export default function FsaListPage({ reference, onOpenDetail, onCreate, canCreate, view = 'assigned' }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('latest')
  const me = reference.me

  useEffect(() => {
    let active = true
    api
      .listFsas({})
      .then((data) => active && setItems(data.items))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [])

  const assigned = useMemo(() => {
    if (!items) return null
    return items
      .filter((fsa) => {
        if (fsa.approvalStatus === 'rework_required') {
          const sprApproverId = fsa.approvals?.procurement?.approverId
          return sprApproverId ? sprApproverId === me?.id : me?.role === 'procurement'
        }
        return assignedActionableKeys(fsa, me?.id).length > 0
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items, me])

  const inProgress = useMemo(() => {
    if (!items) return null
    return items
      .filter((fsa) => !['accepted', 'canceled'].includes(fsa.approvalStatus))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items])

  const history = useMemo(() => {
    if (!items) return null
    return items
      .filter((fsa) => ['accepted', 'canceled'].includes(fsa.approvalStatus))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items])

  const titles = {
    assigned: ['PPAP Assigned to You', 'PPAP yang membutuhkan tindakan Anda.'],
    'in-progress': ['PPAP In Progress', 'PPAP yang sedang dalam proses approval.'],
    history: ['PPAP History', 'PPAP yang sudah selesai atau dibatalkan.'],
  }
  const [title, subtitle] = titles[view] ?? titles.assigned

  const baseList = view === 'assigned' ? assigned : view === 'in-progress' ? inProgress : history

  const viewStatusOptions = useMemo(() => {
    if (!baseList) return []
    const ids = [...new Set(baseList.map((fsa) => fsa.approvalStatus))]
    return reference.fsaStatuses.filter((status) => ids.includes(status.id))
  }, [baseList, reference.fsaStatuses])

  const visible = useMemo(() => {
    if (!baseList) return null
    const keyword = search.trim().toLowerCase()
    return baseList
      .filter((fsa) => {
        if (statusFilter && fsa.approvalStatus !== statusFilter) return false
        if (keyword) {
          const haystack = `${fsa.fsaNumber} ${fsa.partNumber} ${fsa.materialDescription} ${findName(reference.suppliers, fsa.supplierId)}`.toLowerCase()
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => (sortOrder === 'latest' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))
  }, [baseList, search, statusFilter, sortOrder, reference.suppliers])

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {canCreate ? (
          <Button onClick={onCreate}>+ Create FSA</Button>
        ) : null}
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <Card className="p-2">
        <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center">
          <input
            className="min-w-0 flex-[2] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Cari FSA number / part number / material / supplier..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Semua status</option>
            {viewStatusOptions.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
          <select
            className="min-w-0 w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="latest">Terbaru</option>
            <option value="earliest">Terlama</option>
          </select>
          {(search || statusFilter) ? (
            <Button
              variant="secondary"
              className="shrink-0 whitespace-nowrap"
              onClick={() => { setSearch(''); setStatusFilter('') }}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </Card>

      {!visible ? (
        <Spinner />
      ) : (
        <FsaTable
          items={visible}
          reference={reference}
          onOpenDetail={onOpenDetail}
          emptyText={
            baseList && baseList.length > 0
              ? 'Tidak ada data yang cocok dengan filter.'
              : view === 'assigned'
                ? 'Tidak ada PPAP yang ditugaskan ke Anda.'
                : view === 'in-progress'
                  ? 'Tidak ada PPAP yang sedang berjalan.'
                  : 'Belum ada riwayat PPAP.'
          }
        />
      )}
    </div>
  )
}
