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

export default function FsaListPage({ reference, onOpenDetail, onCreate, canCreate }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', supplierId: '', reasonId: '' })
  const me = reference.me
  const hasActiveFilter = Boolean(filters.search.trim() || filters.status || filters.supplierId || filters.reasonId)

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

  const filtered = useMemo(() => {
    if (!items) return null
    const keyword = filters.search.trim().toLowerCase()
    return items
      .filter((fsa) => {
        if (filters.status && fsa.approvalStatus !== filters.status) return false
        if (filters.supplierId && fsa.supplierId !== filters.supplierId) return false
        if (filters.reasonId && fsa.reasonId !== filters.reasonId) return false
        if (keyword) {
          const haystack = `${fsa.fsaNumber} ${fsa.partNumber} ${fsa.materialDescription}`.toLowerCase()
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items, filters])

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">FSA List</h1>
          <p className="text-sm text-slate-500">Daftar First Sample Inspection yang tercatat.</p>
        </div>
        {canCreate ? (
          <Button onClick={onCreate}>+ Create FSA</Button>
        ) : null}
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {assigned !== null ? `${assigned.length} PPAP Assigned to You` : 'PPAP Assigned to You'}
          </h2>
          <p className="text-sm text-slate-500">PPAP yang membutuhkan tindakan Anda.</p>
        </div>
        {!assigned ? (
          <Spinner />
        ) : (
          <FsaTable
            items={assigned}
            reference={reference}
            onOpenDetail={onOpenDetail}
            emptyText="Tidak ada PPAP yang ditugaskan ke Anda."
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">All PPAP</h2>
          <p className="text-sm text-slate-500">Seluruh PPAP yang tercatat di sistem.</p>
        </div>

        <Card className="p-2">
          <div className="flex flex-col gap-2.5 p-3 lg:flex-row lg:items-center">
            <input
              className="flex-[2] min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              placeholder="Cari FSA number / part number..."
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
            <select
              className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Semua status</option>
              {reference.fsaStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
            <select
              className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              value={filters.supplierId}
              onChange={(event) => setFilters({ ...filters, supplierId: event.target.value })}
            >
              <option value="">Semua supplier</option>
              {reference.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              value={filters.reasonId}
              onChange={(event) => setFilters({ ...filters, reasonId: event.target.value })}
            >
              <option value="">Semua reason</option>
              {reference.reasons.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </select>
            {hasActiveFilter ? (
              <Button
                variant="secondary"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setFilters({ search: '', status: '', supplierId: '', reasonId: '' })}
              >
                Reset
              </Button>
            ) : null}
          </div>
        </Card>

        {!filtered ? (
          <Spinner />
        ) : (
          <FsaTable
            items={filtered}
            reference={reference}
            onOpenDetail={onOpenDetail}
            emptyText="Belum ada data FSA."
          />
        )}
      </section>
    </div>
  )
}
