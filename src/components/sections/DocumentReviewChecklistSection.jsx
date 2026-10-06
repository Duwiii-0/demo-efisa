import { Field, SectionCard, Select } from '../ui.jsx'
import { CHECKLIST_BASE_ITEMS, CHECKLIST_LEVEL3_ITEMS } from '../../lib/fsaForm.js'

export default function DocumentReviewChecklistSection({ form, errors, reference, onChange, lockLevel3 = false }) {
  const { checklist, general } = form
  const isLevel3 = Number(general?.ppapLevel) === 3
  const items = isLevel3 ? [...CHECKLIST_BASE_ITEMS, ...CHECKLIST_LEVEL3_ITEMS] : CHECKLIST_BASE_ITEMS

  return (
    <SectionCard step="3" title="Document Review Checklist" description="Status review dokumen FSA.">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {items.map((item) => {
          const isLevel3Item = CHECKLIST_LEVEL3_ITEMS.some((level3) => level3.key === item.key)
          const disabled = isLevel3Item && lockLevel3
          return (
            <Field key={item.key} label={item.label} error={errors[`checklist.${item.key}`]}>
              <Select
                value={checklist[item.key] ?? 'not_available'}
                onChange={(event) => onChange({ ...checklist, [item.key]: event.target.value })}
                invalid={Boolean(errors[`checklist.${item.key}`])}
                disabled={disabled}
              >
                {reference.checklistStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </Field>
          )
        })}
      </div>
    </SectionCard>
  )
}
