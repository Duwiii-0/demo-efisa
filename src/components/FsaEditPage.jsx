import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Alert, Button, Spinner } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import PpapDocumentsSection from './sections/PpapDocumentsSection.jsx'
import DocumentReviewChecklistSection from './sections/DocumentReviewChecklistSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { APPROVAL_ORDER } from '../lib/fsaForm.js'
import { validateForm } from '../lib/validation.js'
import { STEPS, isStepError } from './FsaCreatePage.jsx'
import { toLocalInputValue } from '../lib/format.js'

/**
 * Bangun initial form dari data FSA yang sudah ada (untuk mode edit/rework).
 * Document yang sudah tersimpan di server tidak bisa di-preview ulang (tidak ada dataUrl),
 * sehingga kita pertahankan metadata aslinya dan izinkan pengguna menggantinya.
 */
function buildFormFromFsa(fsa) {
  return {
    general: {
      fsaNumber: fsa.fsaNumber,
      ppapLevel: fsa.ppapLevel,
      partNumber: fsa.partNumber,
      materialDescription: fsa.materialDescription,
      drawingRevision: fsa.drawingRevision ?? 0,
      sourcingVolume: fsa.sourcingVolume ?? '',
      supplierId: fsa.supplierId,
      categoryId: fsa.categoryId,
      categoryOther: fsa.categoryOther ?? '',
      reasonId: fsa.reasonId,
      reasonOther: fsa.reasonOther ?? '',
      dateOfSampleSubmission: fsa.dateOfSampleSubmission,
      sampleQuantity: fsa.sampleQuantity ?? 0,
      createdAt: fsa.createdAt,
      verifierDmId: fsa.verifierDmId,
      verifierFtId: fsa.verifierFtId,
    },
    // Dokumen yang sudah ada di server tidak bisa di-read ulang sebagai dataUrl.
    // Kita mulai dengan slot kosong; user bisa upload ulang jika perlu.
    documents: {
      // Simpan referensi server agar bisa ditampilkan sebagai "existing"
      productPhoto: (fsa.documents?.productPhoto ?? fsa.documents?.appearance)
        ? { ...(fsa.documents?.productPhoto ?? fsa.documents?.appearance), _existing: true }
        : null,
      ppap: (fsa.documents?.ppap ?? []).map((f) => ({ ...f, _existing: true })),
    },
    checklist: {
      checkSheet: fsa.checklist?.checkSheet ?? '',
      millCertificate: fsa.checklist?.millCertificate ?? '',
      drawing: fsa.checklist?.drawing ?? '',
      engineeringChangeDocument: fsa.checklist?.engineeringChangeDocument ?? '',
      customerEngineeringApproval: fsa.checklist?.customerEngineeringApproval ?? '',
      designFmea: fsa.checklist?.designFmea ?? '',
      processFmea: fsa.checklist?.processFmea ?? '',
      controlPlan: fsa.checklist?.controlPlan ?? '',
      measurementSystemAnalysis: fsa.checklist?.measurementSystemAnalysis ?? '',
      dimensionalMeasurement: fsa.checklist?.dimensionalMeasurement ?? '',
      functionalTest: fsa.checklist?.functionalTest ?? '',
      initialProcessStudies: fsa.checklist?.initialProcessStudies ?? '',
      qualifiedLaboratoryDocumentation: fsa.checklist?.qualifiedLaboratoryDocumentation ?? '',
      appearanceApprovalReport: fsa.checklist?.appearanceApprovalReport ?? '',
    },
    approvals: Object.fromEntries(
      APPROVAL_ORDER.map((key) => [
        key,
        {
          decision: 'pending',
          approverId: fsa.approvals?.[key]?.approverId ?? null,
          decidedAt: null,
          remark: '',
        },
      ]),
    ),
  }
}

export default function FsaEditPage({ reference, user, onCancel, onSaved }) {
  const { id } = useParams()
  const [fsa, setFsa] = useState(null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    let active = true
    api
      .getFsa(id)
      .then((data) => {
        if (!active) return
        setFsa(data.fsa)
        setForm(buildFormFromFsa(data.fsa))
      })
      .catch((err) => active && setSubmitError(err.message))
    return () => {
      active = false
    }
  }, [id])

  const completion = useMemo(() => {
    if (!form) return 0
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
    if (documents.productPhoto) filled += 1
    if (documents.ppap.length) filled += 1
    if (Object.values(form.approvals).some((item) => item.approverId)) filled += 1
    if (form.checklist.checkSheet !== '') filled += 1
    return Math.round((filled / total) * 100)
  }, [form])

  if (!form) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const setGeneral = (general) => setForm((current) => ({ ...current, general }))

  function validateCurrentForm() {
    return validateForm(
      {
        ...form,
        documents: {
          productPhoto: form.documents.productPhoto,
          ppap: form.documents.ppap,
        },
      },
      reference.users,
    )
  }

  function stepErrors(stepId) {
    const all = validateCurrentForm()
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

  async function handleSubmit(event) {
    event.preventDefault()

    // Untuk validasi: dokumen existing tetap dianggap ada
    const formForValidation = {
      ...form,
      documents: {
        productPhoto: form.documents.productPhoto,
        ppap: form.documents.ppap,
      },
    }

    const validationErrors = validateForm(formForValidation, reference.users)
    setErrors(validationErrors)
    setSubmitError('')

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Periksa kembali data yang ditandai merah.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // File sudah diupload langsung ke Storage saat dipilih,
    // jadi kirim metadata saja (tanpa dataUrl) ke server
    const newProductPhoto = form.documents.productPhoto?._existing
      ? null
      : {
          fileName: form.documents.productPhoto.fileName,
          storedName: form.documents.productPhoto.storedName,
          mime: form.documents.productPhoto.mime,
          size: form.documents.productPhoto.size,
          uploadedAt: form.documents.productPhoto.uploadedAt,
        }

    const fullPpap = form.documents.ppap.map((f) => {
      if (f._existing) {
        return { storedName: f.storedName, fileName: f.fileName }
      }
      return {
        fileName: f.fileName,
        storedName: f.storedName,
        mime: f.mime,
        size: f.size,
        uploadedAt: f.uploadedAt,
      }
    })

    setBusy(true)
    try {
      const result = await api.updateFsa(id, {
        general: form.general,
        documents: {
          productPhoto: newProductPhoto,
          ppap: fullPpap,
        },
        checklist: form.checklist,
        approvals: form.approvals,
      })
      onSaved(result.fsa)
    } catch (error) {
      setSubmitError(error.message)
      if (error.errors) setErrors(error.errors)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Rework Required
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Edit FSA – {form.general.fsaNumber}</h1>
          <p className="text-sm text-slate-500">
            Perbarui data FSA. Setelah disimpan, semua approval akan di-reset ke Waiting Approval SPR.
          </p>
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

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
                      done ? 'bg-slate-200 text-slate-500' : activeStep ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
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
      </div>

      {stepIndex === 0 ? (
      <GeneralInformationSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={setGeneral}
      />
      ) : null}

      {stepIndex === 1 ? (
      <PpapDocumentsSection
        form={form}
        errors={errors}
        fsaId={id}
        onChange={(documents) => setForm((current) => ({ ...current, documents }))}
      />
      ) : null}

      {stepIndex === 2 ? (
      <DocumentReviewChecklistSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={(checklist) => setForm((current) => ({ ...current, checklist }))}
        lockLevel3
      />
      ) : null}

      {stepIndex === 3 ? (
      <CrossFunctionalApprovalSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={(approvals) => setForm((current) => ({ ...current, approvals }))}
      />
      ) : null}

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Dibuat oleh <span className="font-semibold text-slate-700">{user.name}</span> –{' '}
          {formatCreated(form.general.createdAt)}
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
              {busy ? 'Menyimpan...' : 'Simpan & Resubmit FSA'}
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

function formatCreated(value) {
  if (!value) return '-'
  return `${toLocalInputValue(new Date(value)).replace('T', ' ')} WIB`
}
