export const APPROVAL_ORDER = ['procurement', 'quality', 'electrical', 'mechanical', 'production']

export const APPROVAL_META = {
  procurement: { label: 'Procurement Decision (SPR)', role: 'procurement' },
  quality: { label: 'Quality Decision (QM)', role: 'quality_management' },
  electrical: { label: 'Electrical Engineering Decision', role: 'electrical_engineer' },
  mechanical: { label: 'Mechanical Engineering Decision', role: 'mechanical_engineer' },
  production: { label: 'Production Decision', role: 'production' },
}

export const DECISION_OPTIONS = [
  { id: 'pending', name: 'Pending' },
  { id: 'approved', name: 'Approved' },
  { id: 'rejected', name: 'Rejected' },
]

export function emptyApprovals() {
  return Object.fromEntries(
    APPROVAL_ORDER.map((key) => [key, { decision: 'pending', approverId: null, decidedAt: null, remark: '' }]),
  )
}

export function deriveStatus(approvals) {
  const decision = (key) => approvals[key]?.decision ?? 'pending'
  const all = APPROVAL_ORDER.map(decision)

  if (all.every((value) => value === 'approved')) return 'accepted'
  if (all.some((value) => value === 'rejected')) return 'rework_required'

  if (decision('procurement') === 'pending') return 'waiting_approval_spr'
  if (decision('electrical') === 'pending' || decision('mechanical') === 'pending') return 'waiting_approval_engineering'
  if (decision('quality') === 'pending') return 'waiting_approval_quality'
  if (decision('production') === 'pending') return 'waiting_approval_production'

  return 'waiting_approval_spr'
}

export const emptyFsaForm = () => ({
  general: {
    fsaNumber: '',
    ppapLevel: '',
    partNumber: '',
    materialDescription: '',
    drawingRevision: '',
    sourcingVolume: '',
    supplierId: '',
    categoryId: '',
    reasonId: '',
    dateOfSampleSubmission: '',
    sampleQuantity: '',
    createdAt: '',
    verifierDmId: '',
    verifierFtId: '',
  },
  documents: { appearance: null, ppap: [] },
  checklist: {
    appearanceApprovalReport: 'not_available',
    checkSheet: 'not_available',
    millCertificate: 'not_available',
  },
  approvals: emptyApprovals(),
})
