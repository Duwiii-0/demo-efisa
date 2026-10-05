import { useState } from 'react'
import { Button, Field, Input, SectionCard, Select, Textarea } from '../ui.jsx'
import { badgeClass, findName, formatDateTime } from '../../lib/format.js'
import { APPROVAL_META, APPROVAL_ORDER, DECISION_OPTIONS } from '../../lib/fsaForm.js'

export default function CrossFunctionalApprovalSection({
  form,
  errors,
  reference,
  onChange,
  readOnly = false,
  actionableKeys = [],
  busyKey = null,
  onDecide,
}) {
  const { approvals } = form
  const [remarks, setRemarks] = useState({})

  const setApproval = (key, patch) => onChange({ ...approvals, [key]: { ...approvals[key], ...patch } })
  const userName = (userId) => reference.users.find((item) => item.id === userId)?.name ?? '-'
  const canAct = (key) => readOnly && typeof onDecide === 'function' && actionableKeys.includes(key)

  return (
    <SectionCard
      step="4"
      title="Cross Functional Approval"
      description={readOnly ? 'Hasil approval dari setiap fungsi terkait.' : 'Approver dari setiap fungsi terkait.'}
    >
      <div className="space-y-4">
        {APPROVAL_ORDER.map((key) => {
          const meta = APPROVAL_META[key]
          const approval = approvals[key]
          const approvers = reference.users.filter((user) => user.role === meta.role)
          const error = errors[`approvals.${key}.approverId`]

          if (readOnly) {
            if (!approval?.approverId) return null
            const actionable = canAct(key)
            const busy = busyKey === key
            return (
              <div
                key={key}
                className={`rounded-xl border bg-white px-4 py-4 ${
                  actionable
                    ? 'border-sky-300 ring-1 ring-sky-100'
                    : approval.decision === 'approved'
                      ? 'border-emerald-300 ring-1 ring-emerald-100'
                      : approval.decision === 'rework'
                        ? 'border-amber-300 ring-1 ring-amber-100'
                        : approval.decision === 'rejected'
                          ? 'border-rose-300 ring-1 ring-rose-100'
                          : 'border-slate-200'
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                  <span className={badgeClass(approval.decision, 'lg')}>{findName(DECISION_OPTIONS, approval.decision)}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Field label="Nama">
                    <Input value={approval.approverId ? userName(approval.approverId) : '-'} readOnly disabled />
                  </Field>
                  <Field
                    label="Date Time Approval"
                    hint={
                      actionable && !approval.decidedAt
                        ? 'Sementara — tercatat saat Anda Approve/Reject'
                        : undefined
                    }
                  >
                    <Input
                      value={
                        approval.decidedAt
                          ? formatDateTime(approval.decidedAt)
                          : actionable
                            ? formatDateTime(new Date())
                            : '-'
                      }
                      readOnly
                      disabled
                    />
                  </Field>
                  {actionable ? null : (
                    <div className="lg:col-span-2">
                      <Field label="Comment">
                        <Textarea rows={2} value={approval.remark || '-'} readOnly disabled />
                      </Field>
                    </div>
                  )}
                </div>
                {actionable ? (
                  <div className="mt-4 space-y-3 border-t border-sky-100 pt-4">
                    <Field label="Catatan Anda">
                      <Textarea
                        rows={2}
                        value={remarks[key] ?? ''}
                        onChange={(event) => setRemarks((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="Tulis catatan approval (opsional)"
                        disabled={busy}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() => onDecide(key, 'approved', remarks[key] ?? '', false)}
                      >
                        {busy ? 'Menyimpan...' : 'Approve'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onDecide(key, 'rework', remarks[key] ?? '', false)}
                      >
                        {busy ? 'Menyimpan...' : 'Rework'}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('Reject akan langsung membatalkan (canceled) FSA ini. Lanjutkan?')) {
                            onDecide(key, 'rejected', remarks[key] ?? '', true)
                          }
                        }}
                      >
                        {busy ? 'Menyimpan...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          }

          return (
            <div
              key={key}
              className={`rounded-xl border bg-white px-4 py-4 ${
                error ? 'border-rose-300' : 'border-slate-200'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                <span className="text-xs text-slate-500">{approvers.length} kandidat approver</span>
              </div>

              <Field
                label="Approver"
                error={error}
                hint={
                  key === 'electrical' || key === 'mechanical'
                    ? 'Wajib diisi minimal salah satu antara Electrical atau Mechanical'
                    : undefined
                }
              >
                <Select
                  value={approval.approverId ?? ''}
                  onChange={(event) => setApproval(key, { approverId: event.target.value || null })}
                  invalid={Boolean(error)}
                >
                  <option value="">-- Pilih approver --</option>
                  {approvers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
