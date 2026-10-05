import { Field, SectionCard, Select } from '../ui.jsx'

const ITEMS = [
  { key: 'checkSheet', label: 'Check Sheet' },
  { key: 'millCertificate', label: 'Mill Certificate' },
]

export default function DocumentReviewChecklistSection({ form, errors, reference, onChange }) {
  const { checklist } = form

  return (
    <SectionCard step="3" title="Document Review Checklist" description="Status review dokumen FSA.">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {ITEMS.map((item) => (
          <Field key={item.key} label={item.label} error={errors[`checklist.${item.key}`]}>
            <Select
              value={checklist[item.key]}
              onChange={(event) => onChange({ ...checklist, [item.key]: event.target.value })}
              invalid={Boolean(errors[`checklist.${item.key}`])}
            >
              {reference.checklistStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
    </SectionCard>
  )
}
