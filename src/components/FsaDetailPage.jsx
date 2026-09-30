import { useEffect, useState } from 'react'
import { api, downloadFile, getToken } from '../lib/api.js'
import { Alert, Button, Card, DetailRow, SectionCard, Spinner } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { badgeClass, findName, formatBytes } from '../lib/format.js'

const CHECKLIST_LABELS = {
  checkSheet: 'Check Sheet',
  millCertificate: 'Mill Certificate',
}

function FileLink({ file, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(file)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-sky-300 hover:bg-sky-50"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">{file.fileName}</span>
        <span className="text-xs text-slate-500">
          {formatBytes(file.size)} {file.mime ? `- ${file.mime}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-sky-700">Download</span>
    </button>
  )
}

function AuthImage({ file, alt }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let active = true
    let objectUrl = null

    fetch(api.downloadUrl(file.storedName), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('Gagal memuat gambar'))))
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => active && setSrc(null))

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.storedName])

  if (!src) {
    return <div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />
  }

  return <img src={src} alt={alt} className="h-48 w-full object-cover" />
}

export default function FsaDetailPage({ id, reference, onBack }) {
  const [fsa, setFsa] = useState(null)
  const [error, setError] = useState('')

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

  async function handleDownload(file) {
    try {
      await downloadFile(file)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !fsa) {
    return <Alert>{error}</Alert>
  }
  if (!fsa) {
    return <Spinner />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
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
        <span className={badgeClass(fsa.approvalStatus)}>{findName(reference.fsaStatuses, fsa.approvalStatus)}</span>
      </header>

      {error ? <Alert>{error}</Alert> : null}

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
            categoryId: fsa.categoryId,
            reasonId: fsa.reasonId,
            dateOfSampleSubmission: fsa.dateOfSampleSubmission,
            sampleQuantity: fsa.sampleQuantity,
            createdAt: fsa.createdAt,
            verifierDmId: fsa.verifierDmId,
            verifierFtId: fsa.verifierFtId,
          },
        }}
        errors={{}}
        reference={reference}
        onChange={() => {}}
        readOnly
      />

      <SectionCard step="2" title="PPAP Documents">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Appearance</p>
            {fsa.documents.appearance ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <AuthImage file={fsa.documents.appearance} alt="Appearance" />
                </div>
                <FileLink file={fsa.documents.appearance} onClick={handleDownload} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Tidak ada foto appearance.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">PPAP Document ({fsa.documents.ppap.length} file)</p>
            {fsa.documents.ppap.length ? (
              <div className="space-y-2">
                {fsa.documents.ppap.map((file) => (
                  <FileLink key={file.storedName} file={file} onClick={handleDownload} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Tidak ada file PPAP.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard step="3" title="Document Review Checklist">
        <Card>
          {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
            <DetailRow key={key} label={label}>
              <span className={badgeClass(fsa.checklist[key])}>{findName(reference.checklistStatuses, fsa.checklist[key])}</span>
            </DetailRow>
          ))}
        </Card>
      </SectionCard>

      <CrossFunctionalApprovalSection
        form={{ approvals: fsa.approvals }}
        errors={{}}
        reference={reference}
        onChange={() => {}}
        readOnly
      />
    </div>
  )
}

