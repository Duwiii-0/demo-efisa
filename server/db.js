import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { SAMPLE_FSAS, USERS } from './seed.js'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dataDir = path.join(rootDir, 'server', 'data')
// Varian ganda: main (tanpa production) vs v2 (dengan production).
// EFISA_VARIANT=main -> db.main.json + uploads-main
// EFISA_VARIANT=v2   -> db.v2.json + uploads-v2
// Kosong             -> db.json + uploads (kompatibel lama)
// DB_FILE / UPLOADS_DIR meng-override penuh bila diisi.
export const variant = (process.env.EFISA_VARIANT ?? '').trim().toLowerCase()
const defaultDbName = variant === 'v2' ? 'db.v2.json' : variant === 'main' ? 'db.main.json' : 'db.json'
const defaultUploadsName = variant === 'v2' ? 'uploads-v2' : variant === 'main' ? 'uploads-main' : 'uploads'
const dbFile = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(dataDir, defaultDbName)
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(rootDir, 'server', defaultUploadsName)
export const dbFilePath = dbFile
const masterFile = path.join(rootDir, 'server', 'masterMaterials.json')

let state = null

// Master part + desc (sumber: server/masterMaterials.json hasil import data).
function loadMasterSeed() {
  try {
    const arr = JSON.parse(fs.readFileSync(masterFile, 'utf8'))
    if (!Array.isArray(arr)) return []
    const now = new Date().toISOString()
    return arr
      .map((row) => ({
        partNumber: String(row.partNumber ?? '').trim().toUpperCase(),
        materialDescription: String(row.materialDescription ?? '').trim(),
      }))
      .filter((row) => row.partNumber)
      .map((row) => ({ ...row, createdAt: now, updatedAt: now }))
  } catch {
    return []
  }
}

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(uploadsDir, { recursive: true })
}

function initialState() {
  return {
    version: 3,
    users: USERS,
    masterMaterials: loadMasterSeed(),
    customMaterials: [],
    fsas: SAMPLE_FSAS.map((fsa) => ({
      id: randomUUID(),
      ...fsa,
      // FSA non-draft dianggap sudah ter-submit saat dibuat.
      submittedAt: fsa.approvalStatus === 'draft' ? null : (fsa.submittedAt ?? fsa.createdAt),
      createdById: fsa.createdById,
      history: [
        { at: fsa.createdAt, byId: fsa.createdById, action: 'created', note: 'FSA dibuat' },
      ],
    })),
  }
}

// Perbaikan berurut: reset tahap yang meloncat ke pending + sinkronkan approvalStatus.
// Contoh yang diperbaiki: quality approved padahal engineering belum -> quality di-reset.
function deriveSequentialStatus(approvals) {
  const d = (key) => approvals?.[key]?.decision ?? 'pending'
  const keys = ['procurement', 'electrical', 'mechanical', 'quality']
  if (keys.every((key) => d(key) === 'approved')) return 'accepted'
  if (keys.some((key) => d(key) === 'rejected' || d(key) === 'rework')) return 'rework_required'
  if (d('procurement') !== 'approved') return 'waiting_approval_spr'
  if (d('electrical') !== 'approved' || d('mechanical') !== 'approved') return 'waiting_approval_engineering'
  if (d('quality') !== 'approved') return 'waiting_approval_quality'
  return 'waiting_approval_engineering'
}

function repairFsaInPlace(fsa) {
  const changes = []
  if (!fsa.approvals) return changes
  // Migrasi: hapus sisa approval production dari data lama.
  if (fsa.approvals.production !== undefined) {
    delete fsa.approvals.production
    changes.push('production: dihapus (tahap dihilangkan)')
  }
  // Migrasi: status lama waiting_approval_production -> accepted (Quality sudah approved).
  if (fsa.approvalStatus === 'waiting_approval_production') {
    changes.push('status: waiting_approval_production -> accepted')
    fsa.approvalStatus = 'accepted'
  }
  // Draft belum masuk alur approval: jangan di-repair / sinkronkan statusnya.
  if (fsa.approvalStatus === 'draft') return changes

  const reset = (key, reason) => {
    if (fsa.approvals[key]?.decision !== 'pending') {
      // Assignment nama dipertahankan, hanya decision yang dikembalikan ke pending
      fsa.approvals[key] = { decision: 'pending', approverId: fsa.approvals[key]?.approverId ?? null, decidedAt: null, remark: '' }
      changes.push(`${key}: reset (${reason})`)
    }
  }

  const d = (key) => fsa.approvals?.[key]?.decision ?? 'pending'
  if (d('procurement') !== 'approved') {
    for (const key of ['electrical', 'mechanical', 'quality']) {
      reset(key, 'SPR belum approved')
    }
  } else if (d('electrical') !== 'approved' || d('mechanical') !== 'approved') {
    reset('quality', 'Engineering belum lengkap')
  }

  if (fsa.approvalStatus !== 'canceled') {
    const expected = deriveSequentialStatus(fsa.approvals)
    if (fsa.approvalStatus !== expected) {
      changes.push(`status: ${fsa.approvalStatus} -> ${expected}`)
      fsa.approvalStatus = expected
    }
  }

  if (changes.length > 0) {
    fsa.history = Array.isArray(fsa.history) ? fsa.history : []
    fsa.history.push({
      at: new Date().toISOString(),
      byId: fsa.createdById ?? null,
      action: 'auto_repair',
      note: `Perbaikan urutan otomatis: ${changes.join('; ')}`,
    })
  }

  return changes
}

export function repairDb() {
  const db = getDb()
  const report = []
  for (const fsa of db.fsas) {
    const changes = repairFsaInPlace(fsa)
    if (changes.length > 0) {
      report.push({ fsaNumber: fsa.fsaNumber, id: fsa.id, changes })
    }
  }
  if (report.length > 0) saveDb()
  return report
}

function load() {
  ensureDirs()

  if (!fs.existsSync(dbFile)) {
    const seeded = initialState()
    fs.writeFileSync(dbFile, `${JSON.stringify(seeded, null, 2)}\n`)
    return seeded
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8'))
    // Migrasi: (re)seed master dari masterMaterials.json agar desc ikut masuk.
    // Baris custom lokal yang sudah ada dipertahankan.
    const seedRows = loadMasterSeed()
    let masterDirty = true
    if (!Array.isArray(parsed.masterMaterials) || (parsed.version ?? 0) < 3) {
      parsed.masterMaterials = seedRows
    } else {
      // v3+: tambahkan part baru & backfill desc yang masih kosong
      masterDirty = false
      const byPart = new Map(parsed.masterMaterials.map((m) => [m.partNumber, m]))
      const now = new Date().toISOString()
      for (const row of seedRows) {
        const existing = byPart.get(row.partNumber)
        if (!existing) {
          parsed.masterMaterials.push(row)
          masterDirty = true
        } else if (!existing.materialDescription && row.materialDescription) {
          existing.materialDescription = row.materialDescription
          existing.updatedAt = now
          masterDirty = true
        }
      }
    }
    if (!Array.isArray(parsed.customMaterials)) {
      parsed.customMaterials = []
    }
    parsed.version = 3
    // Auto-repair saat load agar data lama yang meloncat langsung berurut
    let dirty = masterDirty
    // Migrasi: documents.appearance -> documents.productPhoto (hanya rename).
    for (const fsa of parsed.fsas ?? []) {
      if (fsa.documents && fsa.documents.appearance !== undefined && fsa.documents.productPhoto === undefined) {
        fsa.documents.productPhoto = fsa.documents.appearance
        delete fsa.documents.appearance
        dirty = true
      }
    }
    // Migrasi: submitted_at untuk FSA non-draft yang belum punya (dianggap ter-submit saat dibuat).
    for (const fsa of parsed.fsas ?? []) {
      if (fsa.approvalStatus !== 'draft' && !fsa.submittedAt) {
        fsa.submittedAt = fsa.createdAt
        dirty = true
      }
    }
    // Migrasi: hapus user role production yang tersisa dari data lama.
    if (Array.isArray(parsed.users)) {
      const before = parsed.users.length
      parsed.users = parsed.users.filter((u) => u.role !== 'production' && u.id !== 'usr-role-prd')
      if (parsed.users.length !== before) dirty = true
    }
    for (const fsa of parsed.fsas ?? []) {
      if (repairFsaInPlace(fsa).length > 0) dirty = true
    }
    if (dirty) {
      fs.writeFileSync(dbFile, `${JSON.stringify(parsed, null, 2)}\n`)
    }
    return parsed
  } catch {
    const seeded = initialState()
    fs.writeFileSync(dbFile, `${JSON.stringify(seeded, null, 2)}\n`)
    return seeded
  }
}

export function getDb() {
  if (!state) {
    state = load()
  }
  return state
}

export function saveDb() {
  ensureDirs()
  fs.writeFileSync(dbFile, `${JSON.stringify(getDb(), null, 2)}\n`)
}

export function resetDb() {
  const uploads = getUploadsDir()
  if (fs.existsSync(uploads)) {
    fs.rmSync(uploads, { recursive: true, force: true })
  }
  state = initialState()
  saveDb()
  return state
}

export function getUploadsDir() {
  ensureDirs()
  return uploadsDir
}
