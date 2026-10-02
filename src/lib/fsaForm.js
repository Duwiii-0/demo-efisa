export const APPROVAL_ORDER = ['procurement', 'electrical', 'mechanical', 'quality', 'production']

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
  if (!isOk('production')) return 'production'
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
  if (active === 'production') return 'waiting_approval_production'

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
    production: ['production'],
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
    for (const key of ['electrical', 'mechanical', 'quality', 'production']) {
      if (isActive(key)) skipped.push(key)
    }
  } else if (!isOk('electrical') || !isOk('mechanical')) {
    for (const key of ['quality', 'production']) {
      if (isActive(key)) skipped.push(key)
    }
  } else if (!isOk('quality')) {
    if (isActive('production')) skipped.push('production')
  }

  return skipped
}

export const emptyFsaForm = () => ({
  general: {
    fsaNumber: '',
    ppapLevel: '',
    partNumber: '',
    materialDescription: '',
    drawingRevision: 0,
    sourcingVolume: 0,
    supplierId: '',
    categoryId: '',
    categoryOther: '',
    reasonId: '',
    reasonOther: '',
    dateOfSampleSubmission: '',
    sampleQuantity: 0,
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
