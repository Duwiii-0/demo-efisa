import { randomUUID } from 'node:crypto'
import {
  APPROVAL_FUNCTIONS,
  FSA_REASONS,
  PART_CATEGORIES,
  FSA_LEVELS,
  SUPPLIERS,
} from './seed.js'
import { getDb, saveDb } from './db.js'
import {
  buildNextNumber as buildNextNumberStore,
  getFsaById,
  insertFsa as insertFsaRow,
  saveFsa as saveFsaRow,
  userExistsById,
} from './store.js'
import { MAX_FILES } from './uploads.js'


const DECISION_IDS = new Set(['pending', 'approved', 'rejected', 'rework'])
const SAMPLE_QUANTITY_IDS = new Set([0, 3, 10])
const CATEGORY_IDS = new Set(PART_CATEGORIES.map((item) => item.id))
const REASON_IDS = new Set(FSA_REASONS.map((item) => item.id))
const SUPPLIER_IDS = new Set(SUPPLIERS.map((item) => item.id))

export class ValidationError extends Error {
  constructor(errors, message = 'Data FSA tidak valid') {
    super(message)
    this.status = 422
    this.errors = errors
  }
}

// Urutan baku approval (tidak boleh dilompat):
// 0. procurement (SPR) -> waiting_approval_spr
// 1. engineering (electrical + mechanical, keduanya harus approved) -> waiting_approval_engineering
// 2. quality -> waiting_approval_quality
// 3. production -> waiting_approval_production
// 4. semua approved -> accepted
export const APPROVAL_SEQUENCE = ['procurement', 'electrical', 'mechanical', 'quality', 'production']

const STAGE_LABEL = {
  procurement: 'SPR',
  engineering: 'Engineering',
  quality: 'Quality',
  production: 'Production',
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

function requiredStageForKey(fnKey) {
  if (fnKey === 'procurement') return 'procurement'
  if (fnKey === 'electrical' || fnKey === 'mechanical') return 'engineering'
  if (fnKey === 'quality') return 'quality'
  if (fnKey === 'production') return 'production'
  return null
}

function stageRank(stage) {
  return ['procurement', 'engineering', 'quality', 'production', 'done'].indexOf(stage)
}

export function assertSequentialGate(approvals, fnKey, decision) {
  if (decision === 'pending') return
  const active = getActiveStage(approvals)
  const required = requiredStageForKey(fnKey)
  if (!required) {
    throw new ValidationError({ [fnKey]: `Fungsi approval ${fnKey} tidak dikenal` })
  }
  // Hanya tahap aktif yang boleh diisi. Tahap sebelumnya harus approved dulu.
  if (active === 'done') {
    throw new ValidationError({ [fnKey]: 'FSA sudah accepted, tidak ada tahap tersisa' })
  }
  if (stageRank(required) > stageRank(active)) {
    const need =
      active === 'procurement'
        ? 'SPR harus approved dulu'
        : active === 'engineering'
          ? 'Engineering harus approved dulu'
          : active === 'quality'
            ? 'Quality harus approved dulu'
            : 'tahap sebelumnya harus approved dulu'
    throw new ValidationError(
      { [fnKey]: `Tidak bisa meloncat urutan: ${STAGE_LABEL[required] ?? fnKey} belum giliran. ${need}.` },
      `Tidak bisa meloncat urutan: ${STAGE_LABEL[required] ?? fnKey} belum giliran. ${need}.`,
    )
  }
  if (stageRank(required) < stageRank(active)) {
    throw new ValidationError(
      { [fnKey]: `Tahap ${STAGE_LABEL[required] ?? fnKey} sudah lewat, tidak bisa diisi ulang mendahului tahap aktif (${STAGE_LABEL[active] ?? active}).` },
      `Tahap ${STAGE_LABEL[required] ?? fnKey} sudah lewat.`,
    )
  }
}

// Perbaiki approvals yang meloncat (mis. production approved padahal engineering belum).
// Tahap yang meloncat di-reset ke pending. Return { fixed, fixedKeys }.
export function repairSequentialApprovals(approvals) {
  const fixed = {
    procurement: { ...approvals.procurement },
    electrical: { ...approvals.electrical },
    mechanical: { ...approvals.mechanical },
    quality: { ...approvals.quality },
    production: { ...approvals.production },
  }
  const fixedKeys = []

  const reset = (key) => {
    if (fixed[key]?.decision !== 'pending') {
      // Assignment nama dipertahankan, hanya decision yang dikembalikan ke pending
      fixed[key] = { decision: 'pending', approverId: fixed[key]?.approverId ?? null, decidedAt: null, remark: '' }
      fixedKeys.push(key)
    }
  }

  const isOk = (key) => {
    if (!fixed[key]?.approverId) return true
    return fixed[key]?.decision === 'approved'
  }

  if (!isOk('procurement')) {
    // SPR belum approved -> semua tahap sesudahnya harus pending
    for (const key of ['electrical', 'mechanical', 'quality', 'production']) reset(key)
  } else if (!isOk('electrical') || !isOk('mechanical')) {
    // Engineering belum lengkap -> quality & production harus pending
    for (const key of ['quality', 'production']) reset(key)
  } else if (!isOk('quality')) {
    // Quality belum approved -> production harus pending
    reset('production')
  }

  return { fixed, fixedKeys }
}

export function isSequentialApprovals(approvals) {
  return repairSequentialApprovals(approvals).fixedKeys.length === 0
}

function pickId(value, allowed, field, errors) {
  if (!value || !allowed.has(value)) {
    errors[field] = `Nilai tidak valid untuk ${field}`
    return null
  }
  return value
}

async function userExists(userId) {
  if (!userId) {
    return false
  }
  return userExistsById(userId)
}

// Slot dokumen FSA: productPhoto (single, khusus gambar) + 20 slot multiple
// (PDF, Excel, Word, gambar). Wajib: millCertificate, checkSheet,
// sampleInstructionPlan, productTrialDocument.
export const DOCUMENT_KEYS = [
  'productCatalog',
  'millCertificate',
  'sampleInstructionPlan',
  'productTrialDocument',
  'checkSheet',
  'drawing',
  'engineeringChangeDocument',
  'dimensionalMeasurement',
  'functionalTest',
  'qualifiedLaboratoryDocumentation',
  'appearanceApprovalReport',
  'customerEngineeringApproval',
  'designFmea',
  'controlPlan',
  'measurementSystemAnalysis',
  'initialProcessStudies',
  'processFlowDiagram',
  'sampleProduct',
  'masterSample',
  'checkingAids',
]

const DOCUMENT_LABELS = {
  productCatalog: 'Product Catalog',
  millCertificate: 'Mill Sheet / Mill Certificate',
  sampleInstructionPlan: 'Sample Instruction Plan',
  productTrialDocument: 'Product Trial Document',
  checkSheet: 'Check Sheet',
  drawing: 'Drawing',
  engineeringChangeDocument: 'Engineering Change Document',
  dimensionalMeasurement: 'Dimensional Measurement',
  functionalTest: 'Functional Test',
  qualifiedLaboratoryDocumentation: 'Qualified Laboratory Documentation',
  appearanceApprovalReport: 'Appearance Approval Report',
  customerEngineeringApproval: 'Customer Engineering Approval',
  designFmea: 'Design FMEA',
  controlPlan: 'Control Plan',
  measurementSystemAnalysis: 'Measurement System Analysis',
  initialProcessStudies: 'Initial Process Studies',
  processFlowDiagram: 'Proses Flow Diagram',
  sampleProduct: 'Sample Product',
  masterSample: 'Master Sample',
  checkingAids: 'Checking Aids',
}

export const REQUIRED_DOCUMENT_KEYS = ['millCertificate', 'checkSheet', 'sampleInstructionPlan', 'productTrialDocument']

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'gif'])

function isAllowedDocumentFile(file) {
  const mime = String(file?.mime ?? '')
  if (mime.startsWith('image/')) return true
  if (
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return true
  }
  const name = String(file?.fileName ?? '')
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return ALLOWED_DOCUMENT_EXTENSIONS.has(ext)
}

function toFileMeta(file) {
  return {
    fileName: file.fileName,
    storedName: file.storedName,
    mime: file.mime,
    size: file.size,
    uploadedAt: file.uploadedAt ?? new Date().toISOString(),
  }
}

export function emptyDocuments() {
  return {
    productPhoto: null,
    ...Object.fromEntries(DOCUMENT_KEYS.map((key) => [key, []])),
  }
}

function checkSlotFiles(key, files, errors) {
  const label = DOCUMENT_LABELS[key] ?? key
  const list = Array.isArray(files) ? files : []
  if (REQUIRED_DOCUMENT_KEYS.includes(key) && list.length === 0) {
    errors[`documents.${key}`] = `${label} wajib diunggah`
  } else if (list.length > MAX_FILES) {
    errors[`documents.${key}`] = `${label} maksimal ${MAX_FILES} file`
  } else {
    const invalid = list.find((file) => !file?.storedName || !isAllowedDocumentFile(file))
    if (invalid) {
      errors[`documents.${key}`] = `File ${invalid.fileName ?? 'tersebut'} harus PDF, Excel, Word, atau gambar`
    }
  }
  return list.filter((file) => file?.storedName).map(toFileMeta)
}

function normalizeDocuments(raw, errors) {
  const source = raw ?? {}

  const productPhoto = source.productPhoto ?? null
  if (productPhoto && !productPhoto.mime?.startsWith('image/')) {
    errors['productPhoto'] = 'File product photo harus berupa gambar'
  }

  const documents = { productPhoto: productPhoto ? toFileMeta(productPhoto) : null }

  for (const key of DOCUMENT_KEYS) {
    documents[key] = checkSlotFiles(key, source[key], errors)
  }

  return documents
}

async function normalizeApprovals(raw, errors) {
  const source = raw ?? {}
  const approvals = {}

  const existenceChecks = await Promise.all(
    APPROVAL_FUNCTIONS.map((fn) => userExists(source[fn.key]?.approverId)),
  )

  for (let i = 0; i < APPROVAL_FUNCTIONS.length; i++) {
    const fn = APPROVAL_FUNCTIONS[i]
    const input = source[fn.key] ?? {}
    const decision = DECISION_IDS.has(input.decision) ? input.decision : 'pending'
    const approverId = existenceChecks[i] ? input.approverId : null

    if (input.approverId && !approverId) {
      errors[`approvals.${fn.key}.approverId`] = `Approver ${fn.key} tidak ditemukan`
    } else if (!approverId && fn.key !== 'electrical' && fn.key !== 'mechanical') {
      errors[`approvals.${fn.key}.approverId`] = `Approver ${fn.key} wajib dipilih sejak awal`
    }

    approvals[fn.key] = {
      decision,
      approverId,
      decidedAt: decision === 'pending' ? null : input.decidedAt ?? new Date().toISOString(),
      remark: typeof input.remark === 'string' ? input.remark.slice(0, 1000) : '',
    }
  }

  if (!approvals.electrical.approverId && !approvals.mechanical.approverId) {
    errors['approvals.electrical.approverId'] = 'Minimal salah satu (Electrical atau Mechanical) wajib dipilih'
    errors['approvals.mechanical.approverId'] = 'Minimal salah satu (Electrical atau Mechanical) wajib dipilih'
  }

  // FSA baru idealnya semua pending; tapi kalau ada decision langsung diisi,
  // wajib berurut (tidak boleh meloncat).
  const { fixedKeys } = repairSequentialApprovals(approvals)
  for (const key of fixedKeys) {
    errors[`approvals.${key}`] = `Tidak bisa meloncat urutan: ${key} belum giliran, selesaikan tahap sebelumnya dulu`
  }

  return approvals
}

export function deriveStatus(approvals) {
  const decision = (key) => approvals[key]?.decision ?? 'pending'
  const assigned = APPROVAL_SEQUENCE.filter((key) => approvals[key]?.approverId)

  if (assigned.length > 0 && assigned.every((key) => decision(key) === 'approved')) {
    return 'accepted'
  }

  if (assigned.some((key) => decision(key) === 'rejected' || decision(key) === 'rework')) {
    return 'rework_required'
  }

  const active = getActiveStage(approvals)
  if (active === 'procurement') return 'waiting_approval_spr'
  if (active === 'engineering') return 'waiting_approval_engineering'
  if (active === 'quality') return 'waiting_approval_quality'
  if (active === 'production') return 'waiting_approval_production'

  return 'waiting_approval_spr'
}

export async function updateFsa(fsaId, payload, actor) {
  const fsa = await getFsaById(fsaId)
  if (!fsa) return null

  if (actor.role !== 'procurement') {
    const error = new Error('Hanya Procurement yang boleh mengedit FSA')
    error.status = 403
    throw error
  }

  if (fsa.approvalStatus !== 'rework_required') {
    const error = new Error(`FSA tidak bisa diedit karena statusnya bukan Rework Required (status saat ini: ${fsa.approvalStatus})`)
    error.status = 422
    throw error
  }

  const errors = {}
  const body = payload?.general ?? {}

  if (!FSA_LEVELS.includes(Number(body.ppapLevel))) {
    errors.ppapLevel = 'FSA level harus 1 sampai 5'
  }

  const partNumbers = String(body.partNumber ?? '')
    .toUpperCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (partNumbers.length === 0) {
    errors.partNumber = 'Part number wajib diisi'
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

  let supplierId = null
  if (body.supplierId === 'other') {
    supplierId = 'other'
  } else {
    supplierId = pickId(body.supplierId, SUPPLIER_IDS, 'supplierName', errors)
  }
  const categoryId = pickId(body.categoryId, CATEGORY_IDS, 'category', errors)
  const reasonId = pickId(body.reasonId, REASON_IDS, 'reasonOfFsa', errors)

  // Jika pilih Others/Other, user wajib ketik sendiri
  const supplierOther = String(body.supplierOther ?? '').trim().slice(0, 200)
  if (supplierId === 'other' && supplierOther.length < 3) {
    errors.supplierOther = 'Nama supplier lainnya wajib diisi minimal 3 karakter'
  }
  const categoryOther = String(body.categoryOther ?? '').trim().slice(0, 200)
  if (categoryId === 'others' && categoryOther.length < 3) {
    errors.categoryOther = 'Kategori lainnya wajib diisi minimal 3 karakter'
  }
  const reasonOther = String(body.reasonOther ?? '').trim().slice(0, 200)
  if (reasonId === 'other' && reasonOther.length < 3) {
    errors.reasonOther = 'Reason lainnya wajib diisi minimal 3 karakter'
  }

  const dateOfSampleSubmission = String(body.dateOfSampleSubmission ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfSampleSubmission)) {
    errors.dateOfSampleSubmission = 'Tanggal submission tidak valid'
  }

  const sampleQuantity = Number(body.sampleQuantity)
  if (!SAMPLE_QUANTITY_IDS.has(sampleQuantity)) {
    errors.sampleQuantity = 'Sample quantity harus No Sample (0), 3 UoM, atau 10 UoM'
  }

  if (!(await userExists(body.verifierDmId))) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!(await userExists(body.verifierFtId))) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }

  // Documents: productPhoto + 20 slot diproses per key.
  // productPhoto null = pertahankan yang lama;
  // tiap slot yang hadir sebagai array = daftar lengkap yang diinginkan.
  let documents = { ...emptyDocuments(), ...(fsa.documents ?? {}) }
  if (payload?.documents) {
    const rawPhoto = payload.documents.productPhoto

    // Product Photo: hanya replace jika ada file baru (bukan null)
    if (rawPhoto !== null && rawPhoto !== undefined) {
      if (!rawPhoto.mime?.startsWith('image/')) {
        errors['productPhoto'] = 'File product photo harus berupa gambar'
      } else {
        documents.productPhoto = toFileMeta(rawPhoto)
      }
    }

    for (const key of DOCUMENT_KEYS) {
      if (payload.documents[key] === undefined) continue
      documents[key] = checkSlotFiles(key, payload.documents[key], errors)
    }
  }

  // Approvals: update assignee tapi reset semua decision ke pending (rework dimulai ulang)
  const approvalInput = payload?.approvals ?? {}
  const resetApprovals = {}
  for (const fn of APPROVAL_FUNCTIONS) {
    const input = approvalInput[fn.key] ?? {}
    const approverId = (await userExists(input.approverId))
      ? input.approverId
      : (fsa.approvals[fn.key]?.approverId ?? null)
    resetApprovals[fn.key] = {
      decision: 'pending',
      approverId: approverId ?? null,
      decidedAt: null,
      remark: '',
    }
  }

  if (!resetApprovals.electrical.approverId && !resetApprovals.mechanical.approverId) {
    errors['approvals.electrical.approverId'] = 'Minimal salah satu (Electrical atau Mechanical) wajib dipilih'
    errors['approvals.mechanical.approverId'] = 'Minimal salah satu (Electrical atau Mechanical) wajib dipilih'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors)
  }

  const now = new Date().toISOString()

  // Update field-field yang boleh diubah
  fsa.ppapLevel = Number(body.ppapLevel)
  fsa.partNumber = partNumber
  fsa.materialDescription = materialDescription
  fsa.drawingRevision = drawingRevision
  fsa.sourcingVolume = sourcingVolume
  fsa.supplierId = supplierId
  fsa.supplierOther = supplierId === 'other' ? supplierOther : ''
  fsa.categoryId = categoryId
  fsa.categoryOther = categoryId === 'others' ? categoryOther : ''
  fsa.reasonId = reasonId
  fsa.reasonOther = reasonId === 'other' ? reasonOther : ''
  fsa.dateOfSampleSubmission = dateOfSampleSubmission
  fsa.sampleQuantity = sampleQuantity
  fsa.verifierDmId = body.verifierDmId
  fsa.verifierFtId = body.verifierFtId
  fsa.documents = documents
  fsa.approvals = resetApprovals
  fsa.approvalStatus = 'waiting_approval_spr'
  fsa.completedAt = null

  fsa.history.push({
    at: now,
    byId: actor.id,
    action: 'rework_resubmit',
    note: `FSA diperbarui setelah rework dan dikembalikan ke Waiting Approval SPR`,
  })

  return saveFsaRow(fsa)
}

export async function buildNextNumber(date = new Date()) {
  return buildNextNumberStore(date)
}

export async function createFsa(payload, actor) {
  const errors = {}
  const body = payload?.general ?? {}

  // FSA number selalu di-generate server: FSA-yyyymmdd-xx,
  // xx increment mulai 01 dalam 1 hari yang sama.
  const fsaNumber = await buildNextNumberStore()

  if (!FSA_LEVELS.includes(Number(body.ppapLevel))) {
    errors.ppapLevel = 'FSA level harus 1 sampai 5'
  }

  const partNumbers = String(body.partNumber ?? '')
    .toUpperCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (partNumbers.length === 0) {
    errors.partNumber = 'Part number wajib diisi'
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

  let supplierId = null
  if (body.supplierId === 'other') {
    supplierId = 'other'
  } else {
    supplierId = pickId(body.supplierId, SUPPLIER_IDS, 'supplierName', errors)
  }
  const categoryId = pickId(body.categoryId, CATEGORY_IDS, 'category', errors)
  const reasonId = pickId(body.reasonId, REASON_IDS, 'reasonOfFsa', errors)

  // Jika pilih Others/Other, user wajib ketik sendiri
  const supplierOther = String(body.supplierOther ?? '').trim().slice(0, 200)
  if (supplierId === 'other' && supplierOther.length < 3) {
    errors.supplierOther = 'Nama supplier lainnya wajib diisi minimal 3 karakter'
  }
  const categoryOther = String(body.categoryOther ?? '').trim().slice(0, 200)
  if (categoryId === 'others' && categoryOther.length < 3) {
    errors.categoryOther = 'Kategori lainnya wajib diisi minimal 3 karakter'
  }
  const reasonOther = String(body.reasonOther ?? '').trim().slice(0, 200)
  if (reasonId === 'other' && reasonOther.length < 3) {
    errors.reasonOther = 'Reason lainnya wajib diisi minimal 3 karakter'
  }

  const dateOfSampleSubmission = String(body.dateOfSampleSubmission ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfSampleSubmission)) {
    errors.dateOfSampleSubmission = 'Tanggal submission tidak valid'
  }

  const sampleQuantity = Number(body.sampleQuantity)
  if (!SAMPLE_QUANTITY_IDS.has(sampleQuantity)) {
    errors.sampleQuantity = 'Sample quantity harus No Sample (0), 3 UoM, atau 10 UoM'
  }

  if (!(await userExists(body.verifierDmId))) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!(await userExists(body.verifierFtId))) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }

  const fsaId = randomUUID()
  const approvals = await normalizeApprovals(payload?.approvals, errors)

  let documents = emptyDocuments()
  try {
    documents = normalizeDocuments(payload?.documents, errors)
  } catch (error) {
    errors.documents = error.message
  }

  if (!payload?.documents?.productPhoto) {
    errors.productPhoto = 'Foto product photo wajib diunggah'
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
    supplierOther: supplierId === 'other' ? supplierOther : '',
    categoryId,
    categoryOther: categoryId === 'others' ? categoryOther : '',
    reasonId,
    reasonOther: reasonId === 'other' ? reasonOther : '',
    dateOfSampleSubmission,
    sampleQuantity,
    createdAt: now,
    approvalStatus,
    completedAt: null,
    verifierDmId: body.verifierDmId,
    verifierFtId: body.verifierFtId,
    documents,
    approvals,
    createdById: actor.id,
    history: [
      { at: now, byId: actor.id, action: 'created', note: `FSA ${fsaNumber} dibuat` },
    ],
  }

  return insertFsaRow(fsa)
}

export async function updateDecision(fsaId, fnKey, payload, actor) {
  const fsa = await getFsaById(fsaId)
  if (!fsa) {
    return null
  }

  const fn = APPROVAL_FUNCTIONS.find((item) => item.key === fnKey)
  if (!fn) {
    return null
  }

  if (fsa.approvalStatus === 'canceled') {
    const error = new Error('FSA sudah canceled, tidak bisa diubah')
    error.status = 422
    throw error
  }
  if (fsa.approvalStatus === 'accepted') {
    const error = new Error('FSA sudah accepted, tidak bisa diubah')
    error.status = 422
    throw error
  }

  const isOwnerRole = actor.role === fn.role
  if (!isOwnerRole && actor.role !== 'procurement') {
    const error = new Error('Anda tidak berwenang untuk mengisi keputusan ini')
    error.status = 403
    throw error
  }

  const decision = DECISION_IDS.has(payload?.decision) ? payload.decision : 'pending'
  // Reject berarti FSA langsung canceled; Rework = rejected biasa (rework_required).
  const forceCancel = decision === 'rejected' && payload?.canceled === true

  // Enforce berurut: tidak bisa mengisi tahap yang meloncat tahap aktif.
  if (decision !== 'pending') {
    assertSequentialGate(fsa.approvals, fnKey, decision)
  }

  // Nama assigned dipertahankan walau decision pending, agar detail selalu tampil nama.
  const approverId = (await userExists(payload?.approverId))
    ? payload.approverId
    : (fsa.approvals[fnKey]?.approverId ?? fn.approverId ?? actor.id)

  fsa.approvals[fnKey] = {
    decision,
    approverId: approverId ?? null,
    decidedAt: decision === 'pending' ? null : new Date().toISOString(),
    remark: typeof payload?.remark === 'string' ? payload.remark.slice(0, 1000) : '',
  }

  const derived = deriveStatus(fsa.approvals)
  if (forceCancel) {
    fsa.approvalStatus = 'canceled'
    fsa.completedAt = null
  } else if (fsa.approvalStatus !== 'canceled') {
    fsa.approvalStatus = derived
    if (derived === 'accepted') {
      fsa.completedAt = fsa.completedAt ?? new Date().toISOString()
    } else {
      fsa.completedAt = null
    }
  }

  fsa.history.push({
    at: new Date().toISOString(),
    byId: actor.id,
    action: 'decision',
    note: forceCancel
      ? `${fn.label}: rejected (FSA canceled)`
      : `${fn.label}: ${decision}${typeof payload?.remark === 'string' && payload.remark.trim() ? ` — "${payload.remark.trim()}"` : ''}`,
  })

  return saveFsaRow(fsa)
}
