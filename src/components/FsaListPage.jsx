import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Alert, Button, Card, Spinner } from './ui.jsx'
import { badgeClass, findName, formatDateTime } from '../lib/format.js'

export default function FsaListPage({ reference, onOpenDetail, onCreate, canCreate }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', supplierId: '' })

  useEffect(() => {
    let active = true
    api
      .listFsas({ search: filters.search, status: filters.status, supplierId: filters.supplierId })
      .then((data) => active && setItems(data.items))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [filters])

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">FSA List</h1>
          <p className="text-sm text-slate-500">Daftar First Sample Inspection yang tercatat.</p>
        </div>
        {canCreate ? (
          <Button onClick={onCreate}>+ Create FSA</Button>
        ) : null}
      </header>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-4">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Cari FSA number / part number..."
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
          <Button variant="secondary" onClick={() => setFilters({ search: '', status: '', supplierId: '' })}>
            Reset filter
          </Button>
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada data FSA.</p>
        </Card>
      ) : (
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
      )}
    </div>
  )
}
