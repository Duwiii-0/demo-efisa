import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, downloadFile, getToken } from '../lib/api.js'
import { Alert, Button, SectionCard, Spinner, Toast } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { FSA_DOCUMENT_FIELDS, assignedActionableKeys } from '../lib/fsaForm.js'
import { badgeClass, findName, formatBytes } from '../lib/format.js'

async function openPreview(file) {
  const response = await fetch(api.downloadUrl(file.storedName), { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!response.ok) throw new Error('Gagal memuat file')
  const blob = await response.blob()
  const extMime = (() => {
    const ext = (file.fileName ?? '').split('.').pop()?.toLowerCase()
    return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' }[ext]
  })()
  const typed = new Blob([blob], { type: file.mime || extMime || blob.type || 'application/octet-stream' })
  const url = URL.createObjectURL(typed)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function ProductPhotoPreview({ file, onDownload }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl
    fetch(api.downloadUrl(file.storedName), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((response) => {
        if (!response.ok) throw new Error('fail')
        return response.blob()
      })
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => active && setPreviewError(true))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.storedName])

  return (
    <div className="space-y-2">
      {previewUrl && !previewError ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => openPreview(file)} className="block overflow-hidden rounded-lg border border-slate-200 transition hover:ring-2 hover:ring-sky-300">
            <img src={previewUrl} alt={file.fileName} className="max-h-56 w-auto object-cover" />
          </button>
        </div>
      ) : previewError ? (
        <p className="text-xs text-slate-400">Preview tidak tersedia.</p>
      ) : (
        <p className="text-xs text-slate-400">Memuat preview...</p>
      )}
      <FileLink
        file={file}
        onPreview={() => openPreview(file).catch(() => onDownload(file))}
        onDownload={() => onDownload(file)}
      />
    </div>
  )
}

function FileLink({ file, onPreview, onDownload, previewable = true }) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left">
      <button type="button" onClick={previewable ? onPreview : onDownload} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-slate-800">{file.fileName}</span>
        <span className="text-xs text-slate-500">
          {formatBytes(file.size)} {file.mime ? `- ${file.mime}` : ''}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        {previewable ? (
          <button type="button" onClick={onPreview} className="px-2 py-2 text-xs font-semibold text-sky-700 hover:underline">
            Preview
          </button>
        ) : null}
        <Button variant="secondary" onClick={onDownload}>Download</Button>
      </div>
    </div>
  )
}

export default function FsaDetailPage({ reference, onBack, onEdit }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const editable = searchParams.get('mode') === 'edit'
  const [fsa, setFsa] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)

  const DETAIL_STEPS = ['FSA General Information', 'FSA Documents', 'Cross Functional Requirement']

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let active = true
    setFsa(null)
    api
      .getFsa(id)
      .then((data) => {
        if (!active) return
        setFsa(data.fsa)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [id])

  const myActionable = useMemo(
    () => (fsa ? assignedActionableKeys(fsa, reference.me?.id) : []),
    [fsa, reference],
  )

  async function handleDownload(file) {
    try {
      await downloadFile(file)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDecide(key, decision, remark, canceled = false) {
    setBusyKey(key)
    setToast(null)
    try {
      const decideResult = await api.updateDecision(id, key, { decision, remark, ...(canceled ? { canceled: true } : {}) })
      setFsa(decideResult.fsa)
      setToast({
        tone: 'success',
        message: canceled
          ? 'FSA dibatalkan (rejected).'
          : decision === 'approved'
            ? 'Keputusan approved berhasil disimpan.'
            : 'FSA dikembalikan untuk rework.',
      })
    } catch (err) {
      setToast({ tone: 'error', message: err.message })
    } finally {
      setBusyKey(null)
    }
  }

  if (error && !fsa) {
    return <Alert>{error}</Alert>
  }
  if (!fsa) {
    return <Spinner />
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onBack}>
            ← Kembali
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{fsa.fsaNumber}</h1>
            <p className="text-sm text-slate-500">
              {fsa.partNumber} - {fsa.materialDescription}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onEdit && fsa.approvalStatus === 'rework_required' && (fsa.approvals?.procurement?.approverId ? fsa.approvals?.procurement?.approverId === reference.me?.id : reference.me?.role === 'procurement') ? (
            <Button variant="warning" onClick={() => onEdit(fsa)}>
              Edit untuk Rework
            </Button>
          ) : null}
          <span className={badgeClass(fsa.approvalStatus, 'lg')}>{findName(reference.fsaStatuses, fsa.approvalStatus)}</span>
        </div>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {DETAIL_STEPS.map((label, index) => {
            const activeStep = index === stepIndex
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`flex w-full flex-row items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition ${
                    activeStep ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      activeStep ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`text-xs font-medium ${activeStep ? 'text-sky-700' : 'text-slate-500'}`}>{label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {stepIndex === 0 ? (
      <GeneralInformationSection
        form={{
          general: {
            fsaNumber: fsa.fsaNumber,
            ppapLevel: fsa.ppapLevel,
            partNumber: fsa.partNumber,
            materialDescription: fsa.materialDescription,
            drawingRevision: fsa.drawingRevision,
            sourcingVolume: fsa.sourcingVolume ?? '',
            supplierId: fsa.supplierId,
            supplierOther: fsa.supplierOther ?? '',
            categoryId: fsa.categoryId,
            categoryOther: fsa.categoryOther ?? '',
            reasonId: fsa.reasonId,
            reasonOther: fsa.reasonOther ?? '',
            dateOfSampleSubmission: fsa.dateOfSampleSubmission,
            sampleQuantity: fsa.sampleQuantity,
            createdAt: fsa.createdAt,
            completedAt: fsa.completedAt,
            verifierDmId: fsa.verifierDmId,
            verifierFtId: fsa.verifierFtId,
          },
        }}
        errors={{}}
        reference={reference}
        onChange={() => {}}
        readOnly
      />
      ) : null}

      {stepIndex === 1 ? (
      <SectionCard step="2" title="FSA Documents">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Product Photo ({fsa.documents.productPhoto ? 1 : 0} file)</p>
            {fsa.documents.productPhoto ? (
              <ProductPhotoPreview file={fsa.documents.productPhoto} onDownload={handleDownload} />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Tidak ada foto product photo.
              </p>
            )}
          </div>

          {FSA_DOCUMENT_FIELDS.map((field) => {
            const files = fsa.documents[field.key] ?? []
            return (
              <div key={field.key}>
                <p className="mb-2 text-sm font-medium text-slate-700">{field.label} ({files.length} file)</p>
                {files.length ? (
                  <div className="space-y-2">
                    {files.map((file, index) => {
                      const previewable = /pdf|image/.test(file.mime ?? '') || /\.(pdf|jpe?g|png|gif|webp)$/i.test(file.fileName ?? '')
                      return (
                        <FileLink
                          key={`${file.storedName}-${index}`}
                          file={file}
                          previewable={previewable}
                          onPreview={() => openPreview(file).catch(() => {})}
                          onDownload={() => handleDownload(file)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Tidak ada file {field.label}.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>
      ) : null}

      {stepIndex === 2 ? (
      <CrossFunctionalApprovalSection
        form={{ approvals: fsa.approvals, createdAt: fsa.createdAt }}
        errors={{}}
        reference={reference}
        onChange={() => {}}
        readOnly
        actionableKeys={editable ? myActionable : []}
        busyKey={busyKey}
        onDecide={editable ? handleDecide : undefined}
      />
      ) : null}

      {toast ? (
        <Toast tone={toast.tone} onClose={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}
    </div>
  )
}

