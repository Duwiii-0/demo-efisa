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
      sourcingVolume: fsa.sourcingVolume ?? 0,
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
      appearance: fsa.documents?.appearance
        ? { ...fsa.documents.appearance, _existing: true }
        : null,
      ppap: (fsa.documents?.ppap ?? []).map((f) => ({ ...f, _existing: true })),
    },
    checklist: {
      appearanceApprovalReport: fsa.checklist?.appearanceApprovalReport ?? 'not_available',
      checkSheet: fsa.checklist?.checkSheet ?? 'not_available',
      millCertificate: fsa.checklist?.millCertificate ?? 'not_available',
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

  if (!form) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

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

    // Untuk validasi: dokumen existing tetap dianggap ada
    const formForValidation = {
      ...form,
      documents: {
        appearance: form.documents.appearance,
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

    // Pisahkan dokumen baru (ada dataUrl) vs dokumen existing (hanya metadata server)
    const newAppearance = form.documents.appearance?._existing
      ? null // tidak kirim, server akan pertahankan yang lama
      : form.documents.appearance

    // Kirim list ppap lengkap: existing (storedName) + baru (dataUrl)
    // Server akan membedakan keduanya dan mengelola dengan benar
    const fullPpap = form.documents.ppap.map((f) => {
      if (f._existing) {
        // Hanya kirim identifier server
        return { storedName: f.storedName, fileName: f.fileName }
      }
      return f // file baru: ada dataUrl
    })

    setBusy(true)
    try {
      const result = await api.updateFsa(id, {
        general: form.general,
        documents: {
          appearance: newAppearance,
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

      <GeneralInformationSection
        form={form}
        errors={errors}
        reference={reference}
        onChange={setGeneral}
      />

      <PpapDocumentsSection
        form={form}
        errors={errors}
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
          Dibuat oleh <span className="font-semibold text-slate-700">{user.name}</span> –{' '}
          {formatCreated(form.general.createdAt)}
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan & Resubmit FSA'}
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
