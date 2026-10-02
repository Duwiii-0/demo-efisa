import { useEffect, useMemo, useState } from 'react'
import { api, downloadFile } from '../lib/api.js'
import { Alert, Button, Card, DetailRow, SectionCard, Spinner, Toast } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { assignedActionableKeys } from '../lib/fsaForm.js'
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

export default function FsaDetailPage({ id, reference, onBack, onEdit }) {
  const [fsa, setFsa] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [busyKey, setBusyKey] = useState(null)

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
      const result = await api.updateDecision(id, key, { decision, remark, ...(canceled ? { canceled: true } : {}) })
      setFsa(result.fsa)
      setToast({
        tone: 'success',
        message: canceled
          ? 'FSA dibatalkan (canceled).'
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
              ✏️ Edit untuk Rework
            </Button>
          ) : null}
          <span className={badgeClass(fsa.approvalStatus)}>{findName(reference.fsaStatuses, fsa.approvalStatus)}</span>
        </div>
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

      <SectionCard step="2" title="PPAP Documents">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Appearance ({fsa.documents.appearance ? 1 : 0} file)</p>
            {fsa.documents.appearance ? (
              <div className="space-y-2">
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
        actionableKeys={myActionable}
        busyKey={busyKey}
        onDecide={handleDecide}
      />
      {toast ? (
        <Toast tone={toast.tone} onClose={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}
    </div>
  )
}

