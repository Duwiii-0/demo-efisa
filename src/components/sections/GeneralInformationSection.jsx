import { Field, Input, SectionCard, Select, Textarea } from '../ui.jsx'
import { formatDateTime } from '../../lib/format.js'
import { SAMPLE_QUANTITY_OPTIONS } from '../../lib/fsaForm.js'

export default function GeneralInformationSection({ form, errors, reference, onChange, readOnly = false, hideCreatedAt = false }) {
  const { general } = form
  const disabled = readOnly
  const set = (field) => (event) => onChange({ ...general, [field]: event.target.value })
  const setNumber = (field) => (event) => onChange({ ...general, [field]: event.target.value === '' ? '' : Number(event.target.value) })

  const allUsers = reference.users

  return (
    <SectionCard step="1" title="FSA General Information">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="FSA Number">
          <Input value={general.fsaNumber || 'Akan di-generate otomatis...'} readOnly disabled />
        </Field>

        <Field label="FSA Level" required error={errors.ppapLevel}>
          <Select value={general.ppapLevel} onChange={set('ppapLevel')} invalid={Boolean(errors.ppapLevel)} disabled={disabled}>
            <option value="">-- Pilih FSA Level --</option>
            {reference.ppapLevels.map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Category" required error={errors.category}>
          <Select value={general.categoryId} onChange={set('categoryId')} invalid={Boolean(errors.category)} disabled={disabled}>
            <option value="">-- Pilih Category --</option>
            {reference.partCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        {general.categoryId === 'others' ? (
          <Field label="Kategori Lainnya" required error={errors.categoryOther}>
            <Input
              value={general.categoryOther ?? ''}
              onChange={set('categoryOther')}
              placeholder="Contoh: Rubber Gasket Custom"
              invalid={Boolean(errors.categoryOther)}
              disabled={disabled}
            />
          </Field>
        ) : null}

        <Field label="Reason of FSA" required error={errors.reasonOfFsa}>
          <Select value={general.reasonId} onChange={set('reasonId')} invalid={Boolean(errors.reasonOfFsa)} disabled={disabled}>
            <option value="">-- Pilih Reason --</option>
            {reference.reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.name}
              </option>
            ))}
          </Select>
        </Field>

        {general.reasonId === 'other' ? (
          <Field label="Reason Lainnya" required error={errors.reasonOther}>
            <Input
              value={general.reasonOther ?? ''}
              onChange={set('reasonOther')}
              placeholder="Contoh: Emergency replacement line stop"
              invalid={Boolean(errors.reasonOther)}
              disabled={disabled}
            />
          </Field>
        ) : null}

        <Field label="Part Number" required error={errors.partNumber} hint="* multi part separated by comma (,). Contoh: PART01950185,PART02774310">
          <Textarea
            rows={3}
            value={general.partNumber}
            onChange={(event) => onChange({ ...general, partNumber: event.target.value.toUpperCase() })}
            placeholder="PART01950185,PART02774310"
            invalid={Boolean(errors.partNumber)}
            disabled={disabled}
          />
        </Field>

        <Field label="Material Description" required error={errors.materialDescription} hint="* multi part separated by comma (,). Contoh: Bracket holder, Cable shield">
          <Textarea
            rows={3}
            value={general.materialDescription}
            onChange={set('materialDescription')}
            placeholder="Bracket holder, Cable shield"
            invalid={Boolean(errors.materialDescription)}
            disabled={disabled}
          />
        </Field>

        <Field label="Supplier Name" required error={errors.supplierName}>
          <Select value={general.supplierId} onChange={set('supplierId')} invalid={Boolean(errors.supplierName)} disabled={disabled}>
            <option value="">-- Pilih Supplier --</option>
            {reference.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
            <option value="other">Other</option>
          </Select>
        </Field>

        {general.supplierId === 'other' ? (
          <Field label="Supplier Lainnya" required error={errors.supplierOther}>
            <Input
              value={general.supplierOther ?? ''}
              onChange={set('supplierOther')}
              placeholder="Contoh: PT Supplier Baru Indonesia"
              invalid={Boolean(errors.supplierOther)}
              disabled={disabled}
            />
          </Field>
        ) : null}

        {general.createdAt && !hideCreatedAt ? (
          <Field label="FSA Date of Creation">
            <Input value={formatDateTime(general.createdAt)} readOnly disabled />
          </Field>
        ) : null}

        {general.completedAt || readOnly ? (
          <Field label="Date of Completion" hint="Tercatat otomatis saat semua fungsi selesai approved">
            <Input value={general.completedAt ? formatDateTime(general.completedAt) : '-'} readOnly disabled />
          </Field>
        ) : null}

        <Field label="Drawing Revision" required error={errors.drawingRevision}>
          <Input type="number" min="0" step="1" value={general.drawingRevision} onChange={setNumber('drawingRevision')} placeholder="0" invalid={Boolean(errors.drawingRevision)} disabled={disabled} />
        </Field>

        <Field label="Sourcing Volume (Rp)" error={errors.sourcingVolume}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Rp</span>
            <Input type="number" min="0" step="1" value={general.sourcingVolume ?? ''} onChange={setNumber('sourcingVolume')} placeholder="Contoh: 1500000" invalid={Boolean(errors.sourcingVolume)} disabled={disabled} style={{ paddingLeft: '2.5rem' }} />
          </div>
        </Field>

        <Field label="Date of Sample Submission" required error={errors.dateOfSampleSubmission}>
          <Input type="date" value={general.dateOfSampleSubmission} onChange={set('dateOfSampleSubmission')} invalid={Boolean(errors.dateOfSampleSubmission)} disabled={disabled} />
        </Field>

        <Field label="Sample Quantity" required error={errors.sampleQuantity}>
          {disabled && general.sampleQuantity !== '' && !SAMPLE_QUANTITY_OPTIONS.some((opt) => Number(opt.value) === Number(general.sampleQuantity)) ? (
            <Input value={general.sampleQuantity} readOnly disabled />
          ) : (
            <Select value={general.sampleQuantity ?? ''} onChange={setNumber('sampleQuantity')} invalid={Boolean(errors.sampleQuantity)} disabled={disabled}>
              <option value="">-- Pilih Sample Quantity --</option>
              {SAMPLE_QUANTITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Approval DM" required error={errors.verifierDm}>
          <Select value={general.verifierDmId} onChange={set('verifierDmId')} invalid={Boolean(errors.verifierDm)} disabled={disabled}>
            <option value="">-- Pilih Approval DM --</option>
            {allUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Approval FT" required error={errors.verifierFt}>
          <Select value={general.verifierFtId} onChange={set('verifierFtId')} invalid={Boolean(errors.verifierFt)} disabled={disabled}>
            <option value="">-- Pilih Approval FT --</option>
            {allUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </SectionCard>
  )
}
