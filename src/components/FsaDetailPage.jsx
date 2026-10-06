import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, downloadFile } from '../lib/api.js'
import { Alert, Button, Card, DetailRow, SectionCard, Select, Field, Spinner, Toast } from './ui.jsx'
import GeneralInformationSection from './sections/GeneralInformationSection.jsx'
import CrossFunctionalApprovalSection from './sections/CrossFunctionalApprovalSection.jsx'
import { assignedActionableKeys } from '../lib/fsaForm.js'
import { badgeClass, findName, formatBytes } from '../lib/format.js'

import { CHECKLIST_BASE_ITEMS, CHECKLIST_LEVEL3_ITEMS } from '../lib/fsaForm.js'

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

export default function FsaDetailPage({ reference, onBack, onEdit }) {
  const { id } = useParams()
  const [fsa, setFsa] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)

  const DETAIL_STEPS = ['FSA General Information', 'FSA Documents', 'Document Review Checklist', 'Cross Functional Requirement']

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

  const canEditChecklist = useMemo(() => {
    if (!fsa || !reference.me) return false
    if (reference.me.role === 'procurement') return false
    if (fsa.approvalStatus === 'accepted' || fsa.approvalStatus === 'canceled') return false
    return Object.values(fsa.approvals ?? {}).some((approval) => approval?.approverId === reference.me.id)
  }, [fsa, reference])

  async function handleChecklistChange(key, value) {
    setBusyKey('checklist')
    setToast(null)
    try {
      const result = await api.updateChecklist(id, { [key]: value })
      setFsa(result.fsa)
      setToast({ tone: 'success', message: 'Checklist berhasil diperbarui.' })
    } catch (err) {
      setToast({ tone: 'error', message: err.message })
    } finally {
      setBusyKey(null)
    }
  }

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
            <p className="mb-2 text-sm font-medium text-slate-700">FSA Document ({fsa.documents.ppap.length} file)</p>
            {fsa.documents.ppap.length ? (
              <div className="space-y-2">
                {fsa.documents.ppap.map((file) => (
                  <FileLink key={file.storedName} file={file} onClick={handleDownload} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Tidak ada file FSA.
              </p>
            )}
          </div>
        </div>
      </SectionCard>
      ) : null}

      {stepIndex === 2 ? (
      <SectionCard step="3" title="Document Review Checklist">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {(Number(fsa.ppapLevel) === 3 ? [...CHECKLIST_BASE_ITEMS, ...CHECKLIST_LEVEL3_ITEMS] : CHECKLIST_BASE_ITEMS).map(({ key, label }) => {
            const editable = canEditChecklist
            return (
              <Field key={key} label={label}>
                <Select
                  value={fsa.checklist[key] ?? 'not_available'}
                  disabled={!editable || busyKey === 'checklist'}
                  onChange={(event) => handleChecklistChange(key, event.target.value)}
                >
                  {reference.checklistStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )
          })}
        </div>
      </SectionCard>
      ) : null}

      {stepIndex === 3 ? (
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
      ) : null}

      {toast ? (
        <Toast tone={toast.tone} onClose={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}
    </div>
  )
}

