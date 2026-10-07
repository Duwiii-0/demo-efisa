import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { Alert, Button, Card, Spinner } from './ui.jsx'
import { badgeClass, findName, formatDate, formatTime } from '../lib/format.js'
import { assignedActionableKeys } from '../lib/fsaForm.js'

function FsaTable({ items, reference, onOpenDetail, emptyText, onAct, busyId, sort, onToggleSort }) {
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
              <th
                className="cursor-pointer select-none whitespace-nowrap px-5 py-3 font-semibold hover:text-slate-700"
                onClick={() => onToggleSort('fsaNumber')}
              >
                FSA Number <span className={`inline-flex items-center align-middle text-[9px] leading-none ${sort.field === 'fsaNumber' ? '' : 'opacity-40'}`}>{sort.field === 'fsaNumber' ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}</span>
              </th>
              <th className="whitespace-nowrap px-5 py-3 font-semibold">Part Number</th>
              <th className="px-5 py-3 font-semibold">Material</th>
              <th className="px-5 py-3 font-semibold">Supplier</th>
              <th className="px-5 py-3 text-center font-semibold">Status</th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-5 py-3 text-center font-semibold hover:text-slate-700"
                onClick={() => onToggleSort('createdAt')}
              >
                Created <span className={`inline-flex items-center align-middle text-[9px] leading-none ${sort.field === 'createdAt' ? '' : 'opacity-40'}`}>{sort.field === 'createdAt' ? (sort.dir === 'desc' ? '▼' : '▲') : '▲▼'}</span>
              </th>
              <th className="px-5 py-3 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((fsa) => (
              <tr
                key={fsa.id}
                onClick={() => onOpenDetail(fsa.id, { editable: true })}
                className="cursor-pointer transition hover:bg-sky-50/60"
              >
                <td className="px-5 py-3 text-xs font-semibold text-sky-700">{fsa.fsaNumber}</td>
                <td className="px-5 py-3 font-mono text-xs">{fsa.partNumber}</td>
                <td className="max-w-xs truncate px-5 py-3 text-slate-600">{fsa.materialDescription}</td>
                <td className="px-5 py-3 text-slate-600">{findName(reference.suppliers, fsa.supplierId)}</td>
                <td className="px-5 py-3 text-center [&>span]:max-w-32 [&>span]:text-center [&>span]:whitespace-normal [&>span]:leading-tight">
                  <span className={badgeClass(fsa.approvalStatus)}>
                    {findName(reference.fsaStatuses, fsa.approvalStatus)}
                  </span>
                </td>
                <td className="px-5 py-3 text-center text-slate-500">
                  <div>{formatDate(fsa.createdAt)}</div>
                  <div>{formatTime(fsa.createdAt)} WIB</div>
                </td>
                <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}>
                  {busyId === fsa.id ? (
                    <span className="text-xs font-medium text-slate-500">Menyimpan...</span>
                  ) : (
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    defaultValue=""
                    disabled={busyId === fsa.id}
                    onChange={(event) => {
                      const action = event.target.value
                      event.target.value = ''
                      if (action) onAct(fsa, action)
                    }}
                  >
                    <option value="" disabled>
                      Pilih aksi
                    </option>
                    <option value="show">Show</option>
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                    <option value="rework">Rework</option>
                  </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{items.length} data ditemukan</p>
    </Card>
  )
}

export default function FsaListPage({ reference, onOpenDetail, onCreate, onFlash, canCreate, view = 'assigned' }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [decideRemark, setDecideRemark] = useState('')
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState({ field: 'createdAt', dir: 'desc' })
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

  const all = useMemo(() => {
    if (!items) return null
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items])

  const titles = {
    assigned: ['FSA Assigned to You', ''],
    all: ['Data FSA', ''],
  }
  const [title, subtitle] = titles[view] ?? titles.assigned

  const baseList = view === 'assigned' ? assigned : view === 'all' ? all : assigned

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
      .sort((a, b) => {
        if (sort.field === 'fsaNumber') {
          const keyOf = (value) => {
            const parts = String(value ?? '').match(/\d+/g)
            return parts ? parts.map((part) => part.padStart(12, '0')).join('-') : String(value ?? '')
          }
          const result = keyOf(a.fsaNumber).localeCompare(keyOf(b.fsaNumber))
          return sort.dir === 'asc' ? result : -result
        }
        return sort.dir === 'desc' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
      })
  }, [baseList, search, statusFilter, sort, reference.suppliers])

  async function handleAction(fsa, action) {
    if (action === 'show') {
      onOpenDetail(fsa.id)
      return
    }

    let key = null
    if (fsa.approvalStatus === 'rework_required') {
      const sprApproverId = fsa.approvals?.procurement?.approverId
      if (sprApproverId ? sprApproverId === me?.id : me?.role === 'procurement') {
        key = 'procurement'
      }
    } else {
      key = assignedActionableKeys(fsa, me?.id)[0] ?? null
    }

    if (!key) {
      setActionError(`Tidak ada tahapan yang bisa diputuskan untuk FSA ${fsa.fsaNumber}.`)
      return
    }

    setPendingAction({ fsa, key, action })
    setDecideRemark('')
    return
  }

  async function confirmDecision() {
    if (!pendingAction) return
    const { fsa, key, action } = pendingAction
    const decisionMap = { approve: 'approved', reject: 'rejected', rework: 'rework' }
    setBusyId(fsa.id)
    setActionError('')
    try {
      await api.updateDecision(fsa.id, key, {
        decision: decisionMap[action],
        remark: decideRemark,
        ...(action === 'reject' ? { canceled: true } : {}),
      })
      const data = await api.listFsas({})
      setItems(data.items)
      setPendingAction(null)
      setDecideRemark('')
      if (onFlash) {
        const verb = action === 'approve' ? 'di-approved' : action === 'reject' ? 'di-rejected' : 'di-rework'
        onFlash(`FSA dengan id ${fsa.fsaNumber} berhasil ${verb}.`)
      }
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {canCreate ? (
          <Button onClick={onCreate}>+ Create FSA</Button>
        ) : null}
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {actionError ? <Alert>{actionError}</Alert> : null}

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
          onAct={handleAction}
          busyId={busyId}
          sort={sort}
          onToggleSort={(field) =>
            setSort((current) =>
              current.field === field
                ? { field, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: field === 'createdAt' ? 'desc' : 'asc' },
            )
          }
          emptyText={
            baseList && baseList.length > 0
              ? 'Tidak ada data yang cocok dengan filter.'
              : view === 'assigned'
                ? 'Tidak ada FSA yang ditugaskan ke Anda.'
                : view === 'all'
                ? 'Belum ada data FSA.'
                : 'Tidak ada FSA yang ditugaskan ke Anda.'
          }
        />
      )}

      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setPendingAction(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900">
              {pendingAction.action === 'approve' ? 'Approve' : pendingAction.action === 'reject' ? 'Reject' : 'Rework'} FSA {pendingAction.fsa.fsaNumber}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Tambahkan catatan (opsional).</p>
            <textarea
              className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              rows={3}
              value={decideRemark}
              onChange={(event) => setDecideRemark(event.target.value)}
              placeholder="Tulis catatan..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingAction(null)} disabled={busyId === pendingAction.fsa.id}>Batal</Button>
              <Button
                variant={pendingAction.action === 'reject' ? 'danger' : 'primary'}
                disabled={busyId === pendingAction.fsa.id}
                onClick={() => {
                  if (pendingAction.action === 'reject' && !window.confirm('Reject akan langsung membatalkan (rejected) FSA ini. Lanjutkan?')) {
                    return
                  }
                  confirmDecision()
                }}
              >
                {busyId === pendingAction.fsa.id
                  ? 'Menyimpan...'
                  : pendingAction.action === 'approve' ? 'Approve' : pendingAction.action === 'reject' ? 'Reject' : 'Rework'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
