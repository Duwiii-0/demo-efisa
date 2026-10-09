import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { Alert, Button } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import PpapDocumentsSection from './sections/PpapDocumentsSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { emptyFsaForm, REQUIRED_DOCUMENT_FIELDS, serializeDocuments } from '../lib/fsaForm.js'
import { validateForm } from '../lib/validation.js'
import { todayInputValue } from '../lib/format.js'

export const STEPS = [
  { id: 'general', label: 'General Information' },
  { id: 'documents', label: 'FSA Documents' },
  { id: 'approvals', label: 'Cross Functional Requirement' },
]

export function isStepError(key, stepId) {
  if (stepId === 'general') {
    return !key.startsWith('approvals.') && key !== 'productPhoto' && !key.startsWith('documents.')
  }
  if (stepId === 'documents') return key === 'productPhoto' || key.startsWith('documents.')
  if (stepId === 'approvals') return key.startsWith('approvals.')
  return false
}

export default function FsaCreatePage({ reference, user, onCancel, onCreated }) {
  const [form, setForm] = useState(() => emptyFsaForm())
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [fsaId] = useState(() => crypto.randomUUID())
  const [stepIndex, setStepIndex] = useState(0)

  // Draft = ada isian user selain nilai bawaan (nomor, tanggal hari ini, revision 0).
  const isDirty = useMemo(() => {
    const { general, documents, approvals } = form
    if ((general.partNumber ?? '').trim()) return true
    if ((general.materialDescription ?? '').trim()) return true
    if (general.ppapLevel !== '' && general.ppapLevel !== null && general.ppapLevel !== undefined) return true
    if (general.supplierId) return true
    if ((general.supplierOther ?? '').trim()) return true
    if (general.categoryId) return true
    if ((general.categoryOther ?? '').trim()) return true
    if (general.reasonId) return true
    if ((general.reasonOther ?? '').trim()) return true
    if (general.sampleQuantity !== '' && general.sampleQuantity !== null && general.sampleQuantity !== undefined) return true
    if (general.sourcingVolume !== '' && general.sourcingVolume !== null && general.sourcingVolume !== undefined) return true
    if (general.verifierDmId) return true
    if (general.verifierFtId) return true
    if (documents.productPhoto) return true
    if (Object.values(documents).some((value) => Array.isArray(value) && value.length > 0)) return true
    if (Object.values(approvals ?? {}).some((item) => item?.approverId)) return true
    return false
  }, [form])

  useEffect(() => {
    let active = true
    api
      .nextNumber()
      .then((data) => {
        if (!active) return
        setForm((current) => ({
          ...current,
          general: {
            ...current.general,
            fsaNumber: data.fsaNumber,
            createdAt: data.createdAt,
            dateOfSampleSubmission: todayInputValue(),
          },
        }))
      })
      .catch((error) => active && setSubmitError(error.message))
    return () => {
      active = false
    }
  }, [user])

  const setGeneral = (general) => setForm((current) => ({ ...current, general }))

  const completion = useMemo(() => {
    const total = 18
    let filled = 0
    const { general, documents } = form
    if (general.fsaNumber) filled += 1
    if (general.ppapLevel) filled += 1
    if (general.partNumber) filled += 1
    if (general.materialDescription) filled += 1
    if (general.drawingRevision !== '') filled += 1
    if (general.supplierId) filled += 1
    if (general.categoryId) filled += 1
    if (general.reasonId) filled += 1
    if (general.dateOfSampleSubmission) filled += 1
    if (general.sampleQuantity !== '') filled += 1
    if (general.verifierDmId) filled += 1
    if (general.verifierFtId) filled += 1
    if (documents.productPhoto) filled += 1
    for (const field of REQUIRED_DOCUMENT_FIELDS) {
      if ((documents[field.key] ?? []).length) filled += 1
    }
    if (Object.values(form.approvals).some((item) => item.approverId)) filled += 1
    return Math.round((filled / total) * 100)
  }, [form])

  async function handleSubmit(event) {
    event.preventDefault()
    await submitForApproval()
  }

  function buildPayload() {
    return {
      general: form.general,
      documents: serializeDocuments(form.documents),
      approvals: form.approvals,
    }
  }

  async function handleSaveDraft() {
    setSubmitError('')
    setDraftBusy(true)
    try {
      const result = await api.saveDraft(buildPayload())
      onCreated(result.fsa)
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setDraftBusy(false)
    }
  }

  async function submitForApproval() {
    const validationErrors = validateForm(form, reference.users)
    setErrors(validationErrors)
    setSubmitError('')

    if (Object.keys(validationErrors).length > 0) {
      const stepIdx = firstErrorStep(validationErrors)
      setStepIndex(stepIdx)
      setSubmitError(`Periksa kembali data pada ${STEPS[stepIdx].label} yang ditandai merah.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const payload = {
      general: form.general,
      documents: serializeDocuments(form.documents),
      approvals: form.approvals,
    }

    setBusy(true)
    try {
      const result = await api.createFsa(payload)
      onCreated(result.fsa)
    } catch (error) {
      setSubmitError(error.message)
      if (error.errors) setErrors(error.errors)
    } finally {
      setBusy(false)
    }
  }

  // Navigasi antar section bebas tanpa restrict; validasi hanya saat Submit for Approval.
  function firstErrorStep(validationErrors) {
    for (let i = 0; i < STEPS.length; i += 1) {
      if (Object.keys(validationErrors).some((key) => isStepError(key, STEPS[i].id))) return i
    }
    return 0
  }

  function goNext() {
    setSubmitError('')
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToStep(index) {
    if (index === stepIndex) return
    setSubmitError('')
    setStepIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isLastStep = stepIndex === STEPS.length - 1

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1600px] space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Create New FSA</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Kelengkapan data</p>
              <p className="text-lg font-semibold text-sky-700">{completion}%</p>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>

        <ol className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-3">
          {STEPS.map((step, index) => {
            const done = index < stepIndex
            const activeStep = index === stepIndex
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`flex w-full flex-row items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition ${
                    activeStep
                      ? 'border-sky-600 bg-sky-50'
                      : done
                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                      done
                        ? 'bg-slate-200 text-slate-500'
                        : activeStep
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`text-xs font-medium ${activeStep ? 'text-sky-700' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </header>

      {submitError ? <Alert>{submitError}</Alert> : null}

      {stepIndex === 0 ? (
        <GeneralInformationSection
          form={form}
          errors={errors}
          reference={reference}
          onChange={setGeneral}
          hideCreatedAt
        />
      ) : null}

      {stepIndex === 1 ? (
        <PpapDocumentsSection
          form={form}
          errors={errors}
          fsaId={fsaId}
          onChange={(documents) => setForm((current) => ({ ...current, documents }))}
        />
      ) : null}

      {stepIndex === 2 ? (
        <CrossFunctionalApprovalSection
          form={form}
          errors={errors}
          reference={reference}
          onChange={(approvals) => setForm((current) => ({ ...current, approvals }))}
        />
      ) : null}

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Dibuat oleh <span className="font-semibold text-slate-700">{user.name}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => (isDirty ? setShowExitModal(true) : onCancel())}>
            Batal
          </Button>
          <Button type="button" variant="secondary" disabled={draftBusy || busy} onClick={handleSaveDraft}>
            {draftBusy ? 'Menyimpan...' : 'Save Draft'}
          </Button>
          {isLastStep ? (
            <Button type="submit" disabled={busy || draftBusy}>
              {busy ? 'Menyimpan...' : 'Submit for Approval'}
            </Button>
          ) : (
            <Button type="button" onClick={goNext}>
              Lanjut
            </Button>
          )}
        </div>
      </footer>

      {showExitModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setShowExitModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900">Simpan sebagai draft?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Form sudah ada yang diisi. Simpan sebagai draft agar bisa dilanjutkan kapan saja dari menu FSA Draft.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setShowExitModal(false)} disabled={draftBusy}>
                Batal
              </Button>
              <Button variant="secondary" onClick={onCancel} disabled={draftBusy}>
                Buang
              </Button>
              <Button disabled={draftBusy} onClick={handleSaveDraft}>
                {draftBusy ? 'Menyimpan...' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  )
}
