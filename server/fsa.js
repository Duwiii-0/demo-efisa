import { randomUUID } from 'node:crypto'
import {
  APPROVAL_FUNCTIONS,
  CHECKLIST_STATUSES,
  FSA_REASONS,
  PART_CATEGORIES,
  PPAP_LEVELS,
  SUPPLIERS,
} from './seed.js'
import { getDb, saveDb } from './db.js'
import { MAX_FILES, storeUpload } from './uploads.js'

const PART_NUMBER_PATTERN = /^PART\d{8}$/

const DECISION_IDS = new Set(['pending', 'approved', 'rejected'])
const CHECKLIST_IDS = new Set(CHECKLIST_STATUSES.map((item) => item.id))
const CATEGORY_IDS = new Set(PART_CATEGORIES.map((item) => item.id))
const REASON_IDS = new Set(FSA_REASONS.map((item) => item.id))
const SUPPLIER_IDS = new Set(SUPPLIERS.map((item) => item.id))

export class ValidationError extends Error {
  constructor(errors) {
    super('Data FSA tidak valid')
    this.errors = errors
  }
}

function pickId(value, allowed, field, errors) {
  if (!value || !allowed.has(value)) {
    errors[field] = `Nilai tidak valid untuk ${field}`
    return null
  }
  return value
}

function userExists(userId) {
  if (!userId) {
    return false
  }
  return getDb().users.some((user) => user.id === userId)
}

function normalizeDocuments(raw, fsaId, errors) {
  const rawPpap = Array.isArray(raw?.ppap) ? raw.ppap : []
  if (rawPpap.length > MAX_FILES) {
    errors['ppapDocuments'] = `Maksimal ${MAX_FILES} file PPAP`
  }

  const appearance = raw?.appearance
    ? storeUpload({ fsaId, ...raw.appearance })
    : null

  if (appearance && !appearance.mime.startsWith('image/')) {
    errors['appearance'] = 'File appearance harus berupa gambar'
  }

  const ppap = rawPpap.slice(0, MAX_FILES).map((file) => storeUpload({ fsaId, ...file }))

  return { appearance, ppap }
}

function normalizeChecklist(raw, errors) {
  const source = raw ?? {}
  const read = (key) => {
    const value = CHECKLIST_IDS.has(source[key]) ? source[key] : 'not_available'
    if (source[key] && !CHECKLIST_IDS.has(source[key])) {
      errors[`checklist.${key}`] = `Nilai checklist ${key} tidak valid`
    }
    return value
  }

  return {
    appearanceApprovalReport: read('appearanceApprovalReport'),
    checkSheet: read('checkSheet'),
    millCertificate: read('millCertificate'),
  }
}

function normalizeApprovals(raw, errors) {
  const source = raw ?? {}
  const approvals = {}

  for (const fn of APPROVAL_FUNCTIONS) {
    const input = source[fn.key] ?? {}
    const decision = DECISION_IDS.has(input.decision) ? input.decision : 'pending'
    const approverId = userExists(input.approverId) ? input.approverId : null

    if (input.approverId && !approverId) {
      errors[`approvals.${fn.key}.approverId`] = `Approver ${fn.key} tidak ditemukan`
    }

    approvals[fn.key] = {
      decision,
      approverId,
      decidedAt: decision === 'pending' ? null : input.decidedAt ?? new Date().toISOString(),
      remark: typeof input.remark === 'string' ? input.remark.slice(0, 1000) : '',
    }
  }

  return approvals
}

export function deriveStatus(approvals) {
  const decision = (key) => approvals[key]?.decision ?? 'pending'
  const all = APPROVAL_FUNCTIONS.map((fn) => decision(fn.key))

  if (all.every((value) => value === 'approved')) {
    return 'accepted'
  }

  if (all.some((value) => value === 'rejected')) {
    return 'rework_required'
  }

  if (decision('procurement') === 'pending') {
    return 'waiting_approval_spr'
  }

  if (decision('electrical') === 'pending' || decision('mechanical') === 'pending') {
    return 'waiting_approval_engineering'
  }

  if (decision('quality') === 'pending') {
    return 'waiting_approval_quality'
  }

  if (decision('production') === 'pending') {
    return 'waiting_approval_production'
  }

  return 'waiting_approval_spr'
}

export function buildNextNumber(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `FSA-${stamp}`

  const used = getDb()
    .fsas.filter((fsa) => fsa.fsaNumber?.startsWith(prefix))
    .map((fsa) => Number.parseInt(fsa.fsaNumber.split('-')[2], 10))
    .filter((value) => Number.isFinite(value))

  const next = (used.length ? Math.max(...used) : 0) + 1

  return `${prefix}-${String(next).padStart(2, '0')}`
}

export function createFsa(payload, actor) {
  const errors = {}
  const body = payload?.general ?? {}

  // FSA number selalu di-generate server: FSA-yyyymmdd-xx,
  // xx increment mulai 01 dalam 1 hari yang sama.
  const fsaNumber = buildNextNumber()

  if (!PPAP_LEVELS.includes(Number(body.ppapLevel))) {
    errors.ppapLevel = 'PPAP level harus 1 sampai 5'
  }

  const partNumbers = String(body.partNumber ?? '')
    .toUpperCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (partNumbers.length === 0 || partNumbers.some((part) => !PART_NUMBER_PATTERN.test(part))) {
    errors.partNumber = 'Setiap part number harus format PART + 8 digit, dipisahkan koma (,)'
  }
  const partNumber = partNumbers.join(',')

  const materialDescription = String(body.materialDescription ?? '').trim()
  if (materialDescription.length < 3) {
    errors.materialDescription = 'Material description minimal 3 karakter'
  }

  const drawingRevision = Number(body.drawingRevision)
  if (!Number.isInteger(drawingRevision) || drawingRevision < 0) {
    errors.drawingRevision = 'Drawing revision harus bilangan bulat mulai dari 0'
  }

  let sourcingVolume = null
  const sourcingRaw = body.sourcingVolume
  if (sourcingRaw !== '' && sourcingRaw !== null && sourcingRaw !== undefined) {
    const parsed = Number(sourcingRaw)
    if (!Number.isInteger(parsed) || parsed < 0) {
      errors.sourcingVolume = 'Sourcing volume harus bilangan bulat mulai dari 0'
    } else {
      sourcingVolume = parsed
    }
  }

  const supplierId = pickId(body.supplierId, SUPPLIER_IDS, 'supplierName', errors)
  const categoryId = pickId(body.categoryId, CATEGORY_IDS, 'category', errors)
  const reasonId = pickId(body.reasonId, REASON_IDS, 'reasonOfFsa', errors)

  const dateOfSampleSubmission = String(body.dateOfSampleSubmission ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfSampleSubmission)) {
    errors.dateOfSampleSubmission = 'Tanggal submission tidak valid'
  }

  const sampleQuantity = Number(body.sampleQuantity)
  if (!Number.isInteger(sampleQuantity) || sampleQuantity < 1) {
    errors.sampleQuantity = 'Sample quantity minimal 1'
  }

  if (!userExists(body.verifierDmId)) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!userExists(body.verifierFtId)) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }

  const fsaId = randomUUID()
  const checklist = normalizeChecklist(payload?.checklist, errors)
  const approvals = normalizeApprovals(payload?.approvals, errors)

  let documents = { appearance: null, ppap: [] }
  try {
    documents = normalizeDocuments(payload?.documents, fsaId, errors)
  } catch (error) {
    errors.documents = error.message
  }

  if (!payload?.documents?.appearance) {
    errors.appearance = 'Foto appearance wajib diunggah'
  }

  // Approval status selalu auto: FSA baru mulai dari Waiting Approval SPR.
  const approvalStatus = deriveStatus(approvals)

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors)
  }

  const now = new Date().toISOString()
  const fsa = {
    id: fsaId,
    fsaNumber,
    ppapLevel: Number(body.ppapLevel),
    partNumber,
    materialDescription,
    drawingRevision,
    sourcingVolume,
    supplierId,
    categoryId,
    reasonId,
    dateOfSampleSubmission,
    sampleQuantity,
    createdAt: now,
    approvalStatus,
    verifierDmId: body.verifierDmId,
    verifierFtId: body.verifierFtId,
    documents,
    checklist,
    approvals,
    createdById: actor.id,
    history: [{ at: now, byId: actor.id, action: 'created', note: `FSA ${fsaNumber} dibuat` }],
  }

  getDb().fsas.push(fsa)
  saveDb()
  return fsa
}

export function updateDecision(fsaId, fnKey, payload, actor) {
  const fsa = getDb().fsas.find((item) => item.id === fsaId)
  if (!fsa) {
    return null
  }

  const fn = APPROVAL_FUNCTIONS.find((item) => item.key === fnKey)
  if (!fn) {
    return null
  }

  const isOwnerRole = actor.role === fn.role
  if (!isOwnerRole && actor.role !== 'procurement') {
    const error = new Error('Anda tidak berwenang untuk mengisi keputusan ini')
    error.status = 403
    throw error
  }

  const decision = DECISION_IDS.has(payload?.decision) ? payload.decision : 'pending'
  const approverId = userExists(payload?.approverId) ? payload.approverId : fn.approverId ?? actor.id

  fsa.approvals[fnKey] = {
    decision,
    approverId: decision === 'pending' ? null : approverId,
    decidedAt: decision === 'pending' ? null : new Date().toISOString(),
    remark: typeof payload?.remark === 'string' ? payload.remark.slice(0, 1000) : '',
  }

  const derived = deriveStatus(fsa.approvals)
  if (derived === 'accepted' || fsa.approvalStatus !== 'canceled') {
    fsa.approvalStatus = derived
  }

  fsa.history.push({
    at: new Date().toISOString(),
    byId: actor.id,
    action: 'decision',
    note: `${fn.label}: ${decision}`,
  })

  saveDb()
  return fsa
}
