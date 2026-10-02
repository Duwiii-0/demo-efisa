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
import {
  buildNextNumber as buildNextNumberStore,
  getFsaById,
  insertFsa as insertFsaRow,
  saveFsa as saveFsaRow,
  userExistsById,
} from './store.js'
import { MAX_FILES, storeUpload } from './uploads.js'

const PART_NUMBER_PATTERN = /^PART\d{8}$/

const DECISION_IDS = new Set(['pending', 'approved', 'rejected', 'rework'])
const CHECKLIST_IDS = new Set(CHECKLIST_STATUSES.map((item) => item.id))
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

async function normalizeDocuments(raw, fsaId, errors) {
  const rawPpap = Array.isArray(raw?.ppap) ? raw.ppap : []
  if (rawPpap.length > MAX_FILES) {
    errors['ppapDocuments'] = `Maksimal ${MAX_FILES} file PPAP`
  }

  const appearance = raw?.appearance
    ? await storeUpload({ fsaId, ...raw.appearance })
    : null

  if (appearance && !appearance.mime.startsWith('image/')) {
    errors['appearance'] = 'File appearance harus berupa gambar'
  }

  const ppap = []
  for (const file of rawPpap.slice(0, MAX_FILES)) {
    ppap.push(await storeUpload({ fsaId, ...file }))
  }

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

async function normalizeApprovals(raw, errors) {
  const source = raw ?? {}
  const approvals = {}

  for (const fn of APPROVAL_FUNCTIONS) {
    const input = source[fn.key] ?? {}
    const decision = DECISION_IDS.has(input.decision) ? input.decision : 'pending'
    const approverId = (await userExists(input.approverId)) ? input.approverId : null

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
  if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0) {
    errors.sampleQuantity = 'Sample quantity harus bilangan bulat mulai dari 0'
  }

  if (!(await userExists(body.verifierDmId))) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!(await userExists(body.verifierFtId))) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }

  // Documents: appearance dan ppap diproses secara independen.
  // null appearance = pertahankan yang lama; ppap baru ditambahkan ke yang lama.
  let documents = { ...fsa.documents }
  if (payload?.documents) {
    const { appearance: rawAppearance, ppap: rawPpap } = payload.documents ?? {}

    // Appearance: hanya replace jika ada file baru (bukan null)
    if (rawAppearance !== null && rawAppearance !== undefined) {
      try {
        const newAppearance = await storeUpload({ fsaId, ...rawAppearance })
        if (!newAppearance.mime.startsWith('image/')) {
          errors['appearance'] = 'File appearance harus berupa gambar'
        } else {
          documents.appearance = newAppearance
        }
      } catch (err) {
        errors.appearance = err.message
      }
    }

    // PPAP: payload berisi daftar lengkap yang diinginkan.
    // - File dengan storedName = sudah tersimpan di server, pertahankan
    // - File dengan dataUrl = file baru, simpan
    // Jika payload.ppap hadir (walau empty array), replace seluruh ppap list.
    if (Array.isArray(rawPpap)) {
      const resolved = []
      for (const f of rawPpap) {
        if (f.storedName) {
          // Existing file – cari di dokumen lama dan pertahankan
          const existing = fsa.documents.ppap.find((p) => p.storedName === f.storedName)
          if (existing) resolved.push(existing)
        } else if (f.dataUrl) {
          // File baru – simpan
          resolved.push(await storeUpload({ fsaId, ...f }))
        }
      }
      if (resolved.length > MAX_FILES) {
        errors['ppapDocuments'] = `Maksimal ${MAX_FILES} file PPAP`
      } else {
        documents.ppap = resolved
      }
    }
  }

  const checklist = normalizeChecklist(payload?.checklist, errors)

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
  fsa.categoryId = categoryId
  fsa.categoryOther = categoryId === 'others' ? categoryOther : ''
  fsa.reasonId = reasonId
  fsa.reasonOther = reasonId === 'other' ? reasonOther : ''
  fsa.dateOfSampleSubmission = dateOfSampleSubmission
  fsa.sampleQuantity = sampleQuantity
  fsa.verifierDmId = body.verifierDmId
  fsa.verifierFtId = body.verifierFtId
  fsa.documents = documents
  fsa.checklist = checklist
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

  // Jika pilih Others/Other, user wajib ketik sendiri
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
  if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0) {
    errors.sampleQuantity = 'Sample quantity harus bilangan bulat mulai dari 0'
  }

  if (!(await userExists(body.verifierDmId))) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!(await userExists(body.verifierFtId))) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }

  const fsaId = randomUUID()
  const checklist = normalizeChecklist(payload?.checklist, errors)
  const approvals = await normalizeApprovals(payload?.approvals, errors)

  let documents = { appearance: null, ppap: [] }
  try {
    documents = await normalizeDocuments(payload?.documents, fsaId, errors)
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
    checklist,
    approvals,
    createdById: actor.id,
    history: [{ at: now, byId: actor.id, action: 'created', note: `FSA ${fsaNumber} dibuat` }],
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
    note: forceCancel ? `${fn.label}: rejected (FSA canceled)` : `${fn.label}: ${decision}`,
  })

  return saveFsaRow(fsa)
}
