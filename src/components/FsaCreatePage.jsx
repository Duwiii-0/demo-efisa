import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { Alert, Button } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import PpapDocumentsSection from './sections/PpapDocumentsSection.jsx'
import DocumentReviewChecklistSection from './sections/DocumentReviewChecklistSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { emptyFsaForm } from '../lib/fsaForm.js'
import { validateForm } from '../lib/validation.js'
import { toLocalInputValue, todayInputValue } from '../lib/format.js'

export default function FsaCreatePage({ reference, user, onCancel, onCreated }) {
  const [form, setForm] = useState(() => emptyFsaForm())
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fsaId] = useState(() => crypto.randomUUID())

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
    const total = 16
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
    if (documents.appearance) filled += 1
    if (documents.ppap.length) filled += 1
    if (Object.values(form.approvals).some((item) => item.approverId)) filled += 1
    if (form.checklist.checkSheet !== 'not_available') filled += 1
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
      documents: {
        appearance: form.documents.appearance
          ? { fileName: form.documents.appearance.fileName, storedName: form.documents.appearance.storedName, mime: form.documents.appearance.mime, size: form.documents.appearance.size, uploadedAt: form.documents.appearance.uploadedAt }
          : null,
        ppap: form.documents.ppap.map((f) => ({ fileName: f.fileName, storedName: f.storedName, mime: f.mime, size: f.size, uploadedAt: f.uploadedAt })),
      },
      checklist: form.checklist,
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

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Create New FSA</h1>
          <p className="text-sm text-slate-500">Lengkapi 4 section berikut untuk membuat First Sample Inspection.</p>
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
      </header>

      {submitError ? <Alert>{submitError}</Alert> : null}

      <GeneralInformationSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={setGeneral}
      />

      <PpapDocumentsSection
        form={form}
        errors={errors}
        fsaId={fsaId}
        onChange={(documents) => setForm((current) => ({ ...current, documents }))}
      />

      <DocumentReviewChecklistSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={(checklist) => setForm((current) => ({ ...current, checklist }))}
      />

      <CrossFunctionalApprovalSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={(approvals) => setForm((current) => ({ ...current, approvals }))}
      />

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Dibuat oleh <span className="font-semibold text-slate-700">{user.name}</span> - {formatCreated(form.general.createdAt)}
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Submit FSA'}
          </Button>
        </div>
      </footer>
    </form>
  )
}

function formatCreated(value) {
  if (!value) return '-'
  return toLocalInputValue(new Date(value)).replace('T', ' ')
}
