import { Field, Input, SectionCard, Select, Textarea } from '../ui.jsx'
import { badgeClass, findName, formatDateTime } from '../../lib/format.js'
import { APPROVAL_META, APPROVAL_ORDER, DECISION_OPTIONS } from '../../lib/fsaForm.js'

export default function CrossFunctionalApprovalSection({ form, errors, reference, onChange, readOnly = false }) {
  const { approvals } = form

  const setApproval = (key, patch) => onChange({ ...approvals, [key]: { ...approvals[key], ...patch } })
  const userName = (userId) => reference.users.find((item) => item.id === userId)?.name ?? '-'

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
            return (
              <div key={key} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                  <span className={badgeClass(approval.decision)}>{findName(DECISION_OPTIONS, approval.decision)}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Field label="Nama">
                    <Input value={approval.approverId ? userName(approval.approverId) : '-'} readOnly disabled />
                  </Field>
                  <Field label="Date Time Approval">
                    <Input value={approval.decidedAt ? formatDateTime(approval.decidedAt) : '-'} readOnly disabled />
                  </Field>
                  <div className="lg:col-span-2">
                    <Field label="Comment">
                      <Textarea rows={2} value={approval.remark || '-'} readOnly disabled />
                    </Field>
                  </div>
                </div>
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

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field label="Approver" error={error}>
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

                <div className="lg:col-span-2">
                  <Field label="Remark">
                    <Textarea
                      rows={2}
                      value={approval.remark}
                      onChange={(event) => setApproval(key, { remark: event.target.value })}
                      placeholder="Catatan approval (opsional)"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
