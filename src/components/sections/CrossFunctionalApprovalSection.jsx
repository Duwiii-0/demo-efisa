import { useState } from 'react'
import { Button, Field, Input, SectionCard, Select, Textarea } from '../ui.jsx'
import { formatDateTime } from '../../lib/format.js'
import { APPROVAL_META, APPROVAL_ORDER, DECISION_OPTIONS } from '../../lib/fsaForm.js'

const STEP_LABELS = {
  procurement: 'SPR Approval',
  electrical: 'Electrical Engineering Approval',
  mechanical: 'Mechanical Engineering Approval',
  quality: 'QM Approval',
  production: 'Production Approval',
}

function ApprovalStepper({ approvals, createdAt, actionableKeys, busyKey, remarks, setRemarks, onDecide, userName, canAct }) {
  const steps = APPROVAL_ORDER.map((key) => ({ key, approval: approvals[key] })).filter((step) => step.approval?.approverId)
  const firstPending = steps.findIndex((step) => (step.approval.decision ?? 'pending') === 'pending')
  const [selectedKey, setSelectedKey] = useState(null)
  const selected = steps.find((step) => step.key === selectedKey) ?? steps[firstPending >= 0 ? firstPending : 0]

  return (
    <div>
      <div className="flex items-start">
        {steps.map((step, index) => {
          const decided = step.approval.decision && step.approval.decision !== 'pending'
          const isSelected = selected?.key === step.key
          const isActive = !decided && index === firstPending
          const circleClass = !decided
            ? isActive
              ? 'border-[3px] border-indigo-500 bg-white text-indigo-500 group-hover:shadow-[0_0_12px_rgba(99,102,241,0.6)]'
              : 'border-[3px] border-slate-300 bg-white text-slate-400'
            : step.approval.decision === 'rework'
              ? 'bg-orange-400 text-white group-hover:shadow-[0_0_12px_rgba(251,146,60,0.7)]'
              : step.approval.decision === 'rejected'
                ? 'bg-rose-500 text-white group-hover:shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                : 'bg-emerald-500 text-white group-hover:shadow-[0_0_12px_rgba(16,185,129,0.7)]'
          const selectRing = isSelected
            ? ` ring-2 ring-offset-2 ${
              !decided ? 'ring-indigo-400' : step.approval.decision === 'rework' ? 'ring-orange-400' : step.approval.decision === 'rejected' ? 'ring-rose-400' : 'ring-emerald-400'
            }`
            : ''
          return (
            <div key={step.key} className="relative flex-1">
              {index < steps.length - 1 ? (
                <div
                  className={`absolute top-4 z-0 ${decided ? 'border-emerald-400' : 'border-slate-300'}`}
                  style={{ left: 'calc(50% + 18px)', right: 'calc(-50% + 18px)', borderTopWidth: 3 }}
                />
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedKey(step.key)}
                className="group flex w-full cursor-pointer flex-col items-center gap-1.5 text-center"
              >
                <span
className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${circleClass}${selectRing}`}
                >
                  {index + 1}
                </span>
                <span className="text-sm font-bold text-slate-900">{STEP_LABELS[step.key]}</span>
                <span className="text-xs text-slate-400">
                  {step.approval.decidedAt ? formatDateTime(step.approval.decidedAt) : '-'}
                </span>
                <span className="text-[10px] text-slate-300 transition group-hover:text-slate-900">Click to see details</span>
              </button>
            </div>
          )
        })}
      </div>

      {selected ? (
        <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Approver">
              <Input value={userName(selected.approval.approverId)} readOnly disabled />
            </Field>
            <Field label="Date Time Approval">
              <Input value={selected.approval.decidedAt ? formatDateTime(selected.approval.decidedAt) : '-'} readOnly disabled />
            </Field>
            <Field label="Approval Aging">
              <Input
                value={(() => {
                  const start = createdAt ? new Date(createdAt) : null
                  if (!start || Number.isNaN(start.getTime())) return '-'
                  const end = selected.approval.decidedAt ? new Date(selected.approval.decidedAt) : new Date()
                  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
                  return `${days} Days`
                })()}
                readOnly
                disabled
              />
            </Field>
            <Field label="Comment">
              <Input value={selected.approval.remark ? `"${selected.approval.remark}"` : '-'} readOnly disabled />
            </Field>
          </div>
          {canAct(selected.key) ? (
            <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 px-4 py-3">
              <Field label="Catatan Anda">
                <Textarea
                  rows={2}
                  value={remarks[selected.key] ?? ''}
                  onChange={(event) => setRemarks((current) => ({ ...current, [selected.key]: event.target.value }))}
                  placeholder="Tulis catatan approval (opsional)"
                  disabled={busyKey === selected.key}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={busyKey === selected.key} onClick={() => onDecide(selected.key, 'approved', remarks[selected.key] ?? '', false)}>
                  {busyKey === selected.key ? 'Menyimpan...' : 'Approve'}
                </Button>
                <Button variant="secondary" disabled={busyKey === selected.key} onClick={() => onDecide(selected.key, 'rework', remarks[selected.key] ?? '', false)}>
                  {busyKey === selected.key ? 'Menyimpan...' : 'Rework'}
                </Button>
                <Button
                  variant="danger"
                  disabled={busyKey === selected.key}
                  onClick={() => {
                    if (window.confirm('Reject akan langsung membatalkan (canceled) FSA ini. Lanjutkan?')) {
                      onDecide(selected.key, 'rejected', remarks[selected.key] ?? '', true)
                    }
                  }}
                >
                  {busyKey === selected.key ? 'Menyimpan...' : 'Reject'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

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
        {readOnly ? (
          <ApprovalStepper
            approvals={approvals}
            createdAt={form.createdAt}
            reference={reference}
            actionableKeys={actionableKeys}
            busyKey={busyKey}
            remarks={remarks}
            setRemarks={setRemarks}
            onDecide={onDecide}
            userName={userName}
            canAct={canAct}
          />
        ) : (
        <div className="space-y-4">
        {APPROVAL_ORDER.map((key) => {
          const meta = APPROVAL_META[key]
          const approval = approvals[key]
          const approvers = reference.users.filter((user) => user.role === meta.role)
          const error = errors[`approvals.${key}.approverId`]

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
        )}
    </SectionCard>
  )
}
