import { useRef, useState } from 'react'
import { Field, Input, SectionCard, Select, Textarea } from '../ui.jsx'
import { formatDateTime } from '../../lib/format.js'
import { splitParts } from '../../lib/validation.js'
import { api } from '../../lib/api.js'

function splitDescList(value) {
  const raw = String(value ?? '')
  if (!raw.trim()) return []
  return raw.split(',').map((s) => s.trim())
}
import { SAMPLE_QUANTITY_OPTIONS } from '../../lib/fsaForm.js'

export default function GeneralInformationSection({ form, errors, reference, onChange, readOnly = false, hideCreatedAt = false }) {
  const { general } = form
  const disabled = readOnly
  const set = (field) => (event) => onChange({ ...general, [field]: event.target.value })
  const setNumber = (field) => (event) => onChange({ ...general, [field]: event.target.value === '' ? '' : Number(event.target.value) })

  const allUsers = reference.users

  const parts = splitParts(general.partNumber)
  const [statusMap, setStatusMap] = useState({})
  const [lookupError, setLookupError] = useState('')
  // Draft ketikan bebas + chips yang sudah dicek (tampil di dalam field)
  const [draft, setDraft] = useState(() => general.partNumber ?? '')
  const [chipParts, setChipParts] = useState([])
  const generalRef = useRef(general)
  generalRef.current = general
  const partInputRef = useRef(null)
  const descInputRef = useRef(null)
  // Part yang sedang di-lookup (ref agar tidak trigger render)
  const checkingRef = useRef(new Set())

  async function runLookup(part) {
    const key = String(part ?? '').trim().toUpperCase()
    if (!key || checkingRef.current.has(key)) return
    checkingRef.current.add(key)
    setLookupError('')
    try {
      const result = await api.lookupMaterial(key)
      setStatusMap((prev) => ({ ...prev, [key]: result }))
      // Part kuning (tidak di master) + slot desc masih kosong -> minta isi desc dulu
      if (result && !result.found) {
        const current = generalRef.current
        const idx = splitParts(current.partNumber).indexOf(key)
        const slot = splitDescList(current.materialDescription)[idx] ?? ''
        if (!slot.trim() && !disabled) {
          setTimeout(() => descInputRef.current?.focus?.(), 50)
        }
      }
      // Auto-fetch desc hanya jika master punya desc non-kosong dan slot masih kosong
      if (result?.materialDescription) {
        const current = generalRef.current
        const currentParts = splitParts(current.partNumber)
        const idx = currentParts.indexOf(key)
        if (idx >= 0) {
          const descs = splitDescList(current.materialDescription)
          while (descs.length < currentParts.length) descs.push('')
          if (!descs[idx]) {
            descs[idx] = result.materialDescription
            onChange({ ...current, materialDescription: descs.join(', ') })
          }
        }
      }
    } catch (err) {
      setLookupError(err.message)
    } finally {
      checkingRef.current.delete(key)
    }
  }

  function alignDescs(nextParts, currentDesc) {
    const descs = splitDescList(currentDesc)
    while (descs.length < nextParts.length) descs.push('')
    return descs
  }

  // Commit teks draft menjadi chips (sekaligus dicek).
  // Mode 'all' (Enter/paste): seluruh draft jadi chips.
  // Mode 'completed' (koma): hanya token yang sudah diakhiri delimiter.
  function commitDraftText(text, mode, chips = chipParts) {
    const segments = String(text ?? '').split(/[,\n;]/)
    let move
    let remain
    if (mode === 'completed') {
      move = [...new Set(segments.slice(0, -1).map((s) => s.trim().toUpperCase()).filter(Boolean))]
      remain = segments[segments.length - 1] ?? ''
    } else {
      move = splitParts(text)
      remain = ''
    }
    const fresh = move.filter((p) => !chips.includes(p))
    const nextChips = [...chips, ...fresh]
    setChipParts(nextChips)
    setDraft(remain)
    const base = generalRef.current
    const fullParts = [...nextChips, ...splitParts(remain)]
    const descs = alignDescs(fullParts, base.materialDescription)
    onChange({ ...base, partNumber: fullParts.join(','), materialDescription: descs.join(', ') })
    fresh.forEach(runLookup)
  }

  function handleDraftChange(event) {
    const next = event.target.value.toUpperCase()
    setDraft(next)
    const base = generalRef.current
    onChange({ ...base, partNumber: [...chipParts, ...splitParts(next)].join(',') })
    // Trigger koma: commit token yang sudah selesai saja
    if (/[,\n;]/.test(next)) commitDraftText(next, 'completed')
  }

  function handleDraftKeyDown(event) {
    // Trigger Enter: cek semua part (Shift+Enter tetap baris baru)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      commitDraftText(event.target.value, 'all')
    } else if (event.key === 'Backspace' && event.target.value === '' && chipParts.length > 0) {
      // Hapus chip terakhir (part yang sudah dicek) via Backspace
      event.preventDefault()
      removeChip(chipParts[chipParts.length - 1])
    }
  }

  function handleDraftPaste(event) {
    if (disabled) return
    event.preventDefault()
    const text = (event.clipboardData?.getData('text') ?? '').toUpperCase()
    const start = event.target.selectionStart ?? draft.length
    const end = event.target.selectionEnd ?? start
    commitDraftText(draft.slice(0, start) + text + draft.slice(end), 'all')
  }

  function removeChip(part) {
    const idx = chipParts.indexOf(part)
    if (idx < 0) return
    const nextChips = chipParts.filter((p) => p !== part)
    setChipParts(nextChips)
    setStatusMap((prev) => {
      const next = { ...prev }
      delete next[part]
      return next
    })
    const base = generalRef.current
    const fullParts = splitParts(base.partNumber)
    const descs = splitDescList(base.materialDescription)
    const nextParts = fullParts.filter((_, i) => i !== idx)
    const nextDescs = descs.length === fullParts.length ? descs.filter((_, i) => i !== idx) : descs
    onChange({ ...base, partNumber: nextParts.join(','), materialDescription: nextDescs.join(', ') })
  }

  const unknownParts = parts.filter((p) => statusMap[p] && !statusMap[p].found)

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

        <Field label="Part Number" required error={errors.partNumber}>
          <div
            className={`flex min-h-[100px] flex-wrap items-start gap-1.5 rounded-lg border bg-white px-3 py-2 outline-none transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 ${
              errors.partNumber ? 'border-rose-400' : 'border-slate-300'
            } ${disabled ? 'bg-slate-200' : ''}`}
            onClick={() => partInputRef.current?.focus()}
          >
            {chipParts.map((part) => {
              const isMaster = statusMap[part]?.status === 'master'
              return (
                <span
                  key={part}
                  title={statusMap[part] ? (isMaster ? 'Terdaftar di master (hijau)' : 'Material baru / tidak di master (kuning)') : 'Mengecek...'}
                  className={`inline-flex items-center gap-1 rounded-md border px-1 py-1 font-mono text-xs font-semibold ${
                    isMaster ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-amber-300 bg-amber-100 text-amber-800'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {part}
                  {!disabled ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeChip(part)
                      }}
                      className="ml-0.5 font-bold opacity-60 transition hover:opacity-100"
                      aria-label={`Hapus ${part}`}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              )
            })}
            {!disabled ? (
              <input
                ref={partInputRef}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleDraftKeyDown}
                onPaste={handleDraftPaste}
                placeholder={chipParts.length > 0 || draft ? '' : 'PART01950185,PART02774310'}
                className="min-w-32 flex-1 bg-transparent px-1 py-1 font-mono text-sm text-slate-900 outline-none placeholder:font-sans placeholder:text-slate-400"
              />
            ) : (
              <p className="px-1 py-1 font-mono text-sm break-all text-slate-900">{draft || '-'}</p>
            )}
          </div>
          {lookupError ? <p className="mt-1 text-xs font-medium text-rose-600">{lookupError}</p> : null}
          {unknownParts.length > 0 ? (
            <p className="mt-1 text-xs font-medium text-yellow-600">
              Part number {unknownParts.join(', ')} tidak ada di database.
            </p>
          ) : null}
        </Field>

        <Field label="Material Description" required error={errors.materialDescription} hint="* multi part separated by comma (,). Contoh: Bracket holder, Cable shield">
          <Textarea
            ref={descInputRef}
            rows={2}
            style={{ minHeight: '100px' }}
            value={general.materialDescription}
            onChange={set('materialDescription')}
            placeholder="Bracket holder, Cable shield"
            invalid={Boolean(errors.materialDescription)}
            disabled={disabled || parts.length === 0}
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
