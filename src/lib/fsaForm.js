export const APPROVAL_ORDER = ['procurement', 'electrical', 'mechanical', 'quality']

export const APPROVAL_META = {
  procurement: { label: 'Procurement Decision (SPR)', role: 'procurement' },
  quality: { label: 'Quality Decision (QM)', role: 'quality_management' },
  electrical: { label: 'Electrical Engineering Decision', role: 'electrical_engineer' },
  mechanical: { label: 'Mechanical Engineering Decision', role: 'mechanical_engineer' },
}

export const DECISION_OPTIONS = [
  { id: 'pending', name: 'Pending' },
  { id: 'approved', name: 'Approved' },
  { id: 'rejected', name: 'Rejected' },
  { id: 'rework', name: 'Rework' },
]

export function emptyApprovals() {
  return Object.fromEntries(
    APPROVAL_ORDER.map((key) => [key, { decision: 'pending', approverId: null, decidedAt: null, remark: '' }]),
  )
}

export function getActiveStage(approvals) {
  const d = (key) => approvals?.[key]?.decision ?? 'pending'
  const isOk = (key) => {
    if (!approvals?.[key]?.approverId) return true
    return d(key) === 'approved'
  }
  if (!isOk('procurement')) return 'procurement'
  if (!isOk('electrical') || !isOk('mechanical')) return 'engineering'
  if (!isOk('quality')) return 'quality'
  return 'done'
}

export function deriveStatus(approvals) {
  const decision = (key) => approvals?.[key]?.decision ?? 'pending'
  const assigned = APPROVAL_ORDER.filter((key) => approvals?.[key]?.approverId)

  if (assigned.length > 0 && assigned.every((key) => decision(key) === 'approved')) return 'accepted'
  if (assigned.some((key) => decision(key) === 'rejected' || decision(key) === 'rework')) return 'rework_required'

  const active = getActiveStage(approvals)
  if (active === 'procurement') return 'waiting_approval_spr'
  if (active === 'engineering') return 'waiting_approval_engineering'
  if (active === 'quality') return 'waiting_approval_quality'

  return 'waiting_approval_spr'
}

// Key approval yang sedang giliran (tahap aktif) dan masih pending.
// Kalau ada yang rejected (rework), tidak ada yang actionable sampai rework selesai.
export function actionableKeys(approvals) {
  const assigned = APPROVAL_ORDER.filter((key) => approvals?.[key]?.approverId)
  if (assigned.some((key) => {
    const d = approvals?.[key]?.decision ?? 'pending'
    return d === 'rejected' || d === 'rework'
  })) {
    return []
  }
  const stage = getActiveStage(approvals ?? {})
  const map = {
    procurement: ['procurement'],
    engineering: ['electrical', 'mechanical'],
    quality: ['quality'],
    done: [],
  }
  return (map[stage] ?? [])
    .filter((key) => Boolean(approvals?.[key]?.approverId))
    .filter((key) => (approvals?.[key]?.decision ?? 'pending') === 'pending')
}

const TERMINAL_STATUSES = new Set(['accepted', 'canceled'])

// Key approval yang harus di-approve user tersebut sekarang:
// di-assign ke user, masih pending, sedang giliran, dan FSA belum terminal.
export function assignedActionableKeys(fsa, userId) {
  if (!userId || !fsa || TERMINAL_STATUSES.has(fsa.approvalStatus)) return []
  return actionableKeys(fsa.approvals).filter((key) => fsa.approvals?.[key]?.approverId === userId)
}

// Return key tahap yang meloncat (sudah diisi padahal tahap sebelumnya belum approved).
export function findSkippedApprovals(approvals) {
  const d = (key) => approvals?.[key]?.decision ?? 'pending'
  const isOk = (key) => {
    if (!approvals?.[key]?.approverId) return true
    return d(key) === 'approved'
  }
  const skipped = []
  const isActive = (key) => approvals?.[key]?.approverId && d(key) !== 'pending'

  if (!isOk('procurement')) {
    for (const key of ['electrical', 'mechanical', 'quality']) {
      if (isActive(key)) skipped.push(key)
    }
  } else if (!isOk('electrical') || !isOk('mechanical')) {
    for (const key of ['quality']) {
      if (isActive(key)) skipped.push(key)
    }
  }

  return skipped
}

// Slot dokumen FSA: productPhoto (single, khusus gambar, wajib) + 20 slot multiple.
export const FSA_DOCUMENT_FIELDS = [
  { key: 'millCertificate', label: 'Mill Sheet / Mill Certificate', required: true },
  { key: 'checkSheet', label: 'Check Sheet', required: true },
  { key: 'sampleInstructionPlan', label: 'Sample Instruction Plan', required: true },
  { key: 'productTrialDocument', label: 'Product Trial Document', required: true },
  { key: 'productCatalog', label: 'Product Catalog' },
  { key: 'drawing', label: 'Drawing' },
  { key: 'engineeringChangeDocument', label: 'Engineering Change Document' },
  { key: 'dimensionalMeasurement', label: 'Dimensional Measurement' },
  { key: 'functionalTest', label: 'Functional Test' },
  { key: 'qualifiedLaboratoryDocumentation', label: 'Qualified Laboratory Documentation' },
  { key: 'appearanceApprovalReport', label: 'Appearance Approval Report' },
  { key: 'customerEngineeringApproval', label: 'Customer Engineering Approval' },
  { key: 'designFmea', label: 'Design FMEA' },
  { key: 'controlPlan', label: 'Control Plan' },
  { key: 'measurementSystemAnalysis', label: 'Measurement System Analysis' },
  { key: 'initialProcessStudies', label: 'Initial Process Studies' },
  { key: 'processFlowDiagram', label: 'Proses Flow Diagram' },
  { key: 'sampleProduct', label: 'Sample Product' },
  { key: 'masterSample', label: 'Master Sample' },
  { key: 'checkingAids', label: 'Checking Aids' },
]

export const REQUIRED_DOCUMENT_FIELDS = FSA_DOCUMENT_FIELDS.filter((field) => field.required)

// Tipe file yang boleh diunggah ke 20 slot dokumen: PDF, Excel, Word, gambar.
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif'

export const MAX_FILES_PER_FIELD = 10

export function emptyDocuments() {
  return {
    productPhoto: null,
    ...Object.fromEntries(FSA_DOCUMENT_FIELDS.map((field) => [field.key, []])),
  }
}

// Buang key transien (_existing, localPreview) sebelum dikirim ke server.
export function serializeDocuments(documents) {
  const strip = (file) => ({
    fileName: file.fileName,
    storedName: file.storedName,
    mime: file.mime,
    size: file.size,
    uploadedAt: file.uploadedAt,
  })
  return {
    productPhoto: documents?.productPhoto ? strip(documents.productPhoto) : null,
    ...Object.fromEntries(FSA_DOCUMENT_FIELDS.map((field) => [field.key, (documents?.[field.key] ?? []).map(strip)])),
  }
}

export const SAMPLE_QUANTITY_OPTIONS = [
  { value: 0, label: 'No Sample' },
  { value: 3, label: '3 UoM' },
  { value: 10, label: '10 UoM' },
]

export const SAMPLE_QUANTITY_VALUES = SAMPLE_QUANTITY_OPTIONS.map((opt) => opt.value)

export function sampleQuantityLabel(value) {
  const found = SAMPLE_QUANTITY_OPTIONS.find((opt) => Number(opt.value) === Number(value))
  return found ? found.label : String(value ?? '')
}

export const emptyFsaForm = () => ({
  general: {
    fsaNumber: '',
    ppapLevel: '',
    partNumber: '',
    materialDescription: '',
    drawingRevision: 0,
    sourcingVolume: '',
    supplierId: '',
    supplierOther: '',
    categoryId: '',
    categoryOther: '',
    reasonId: '',
    reasonOther: '',
    dateOfSampleSubmission: '',
    sampleQuantity: '',
    createdAt: '',
    verifierDmId: '',
    verifierFtId: '',
  },
  documents: emptyDocuments(),
  approvals: emptyApprovals(),
})
