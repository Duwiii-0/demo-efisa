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
  const [fsaId] = useState(() => crypto.randomUUID())
  const [stepIndex, setStepIndex] = useState(0)

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
    const validationErrors = validateForm(form, reference.users)
    setErrors(validationErrors)
    setSubmitError('')

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Periksa kembali data yang ditandai merah.')
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

  function stepErrors(stepId) {
    const all = validateForm(form, reference.users)
    return Object.fromEntries(Object.entries(all).filter(([key]) => isStepError(key, stepId)))
  }

  function goNext() {
    const current = STEPS[stepIndex]
    const stepErrorMap = stepErrors(current.id)
    if (Object.keys(stepErrorMap).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrorMap }))
      setSubmitError(`Periksa kembali data pada ${current.label} yang ditandai merah.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSubmitError('')
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setSubmitError('')
    setStepIndex((index) => Math.max(index - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToStep(index) {
    if (index === stepIndex) return
    if (index < stepIndex) {
      setSubmitError('')
      setStepIndex(index)
      return
    }
    for (let i = 0; i < index; i += 1) {
      const stepErrorMap = stepErrors(STEPS[i].id)
      if (Object.keys(stepErrorMap).length > 0) {
        setErrors((prev) => ({ ...prev, ...stepErrorMap }))
        setSubmitError(`Periksa kembali data pada ${STEPS[i].label} yang ditandai merah.`)
        setStepIndex(i)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    setSubmitError('')
    setStepIndex(index)
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
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          {stepIndex > 0 ? (
            <Button type="button" variant="secondary" onClick={goBack}>
              Kembali
            </Button>
          ) : null}
          {isLastStep ? (
            <Button type="submit" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Submit FSA'}
            </Button>
          ) : (
            <Button type="button" onClick={goNext}>
              Lanjut
            </Button>
          )}
        </div>
      </footer>
    </form>
  )
}
