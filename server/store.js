// Unified store: JSON lokal (dev) atau Supabase Postgres (prod/Vercel).
// Aktif Supabase otomatis jika SUPABASE_URL + SERVICE_ROLE_KEY terisi.
import { getDb as getLocalDb, saveDb as saveLocalDb } from './db.js'
import { getSupabaseAdmin, isSupabaseEnabled } from './supabase.js'

export { isSupabaseEnabled }

function rowToFsa(row) {
  if (!row) return null
  return {
    id: row.id,
    fsaNumber: row.fsa_number,
    ppapLevel: row.ppap_level,
    partNumber: row.part_number,
    materialDescription: row.material_description,
    drawingRevision: row.drawing_revision,
    sourcingVolume: row.sourcing_volume,
    supplierId: row.supplier_id,
    categoryId: row.category_id,
    categoryOther: row.category_other ?? '',
    reasonId: row.reason_id,
    reasonOther: row.reason_other ?? '',
    dateOfSampleSubmission: row.date_of_sample_submission,
    sampleQuantity: row.sample_quantity,
    createdAt: row.created_at,
    approvalStatus: row.approval_status,
    completedAt: row.completed_at,
    verifierDmId: row.verifier_dm_id,
    verifierFtId: row.verifier_ft_id,
    documents: row.documents ?? { productPhoto: null, ppap: [] },
    checklist: row.checklist ?? {},
    approvals: row.approvals ?? {},
    createdById: row.created_by_id,
    history: row.history ?? [],
  }
}

function fsaToRow(fsa) {
  return {
    id: fsa.id,
    fsa_number: fsa.fsaNumber,
    ppap_level: fsa.ppapLevel,
    part_number: fsa.partNumber,
    material_description: fsa.materialDescription,
    drawing_revision: fsa.drawingRevision,
    sourcing_volume: fsa.sourcingVolume,
    supplier_id: fsa.supplierId,
    category_id: fsa.categoryId,
    category_other: fsa.categoryOther ?? '',
    reason_id: fsa.reasonId,
    reason_other: fsa.reasonOther ?? '',
    date_of_sample_submission: fsa.dateOfSampleSubmission,
    sample_quantity: fsa.sampleQuantity,
    created_at: fsa.createdAt,
    approval_status: fsa.approvalStatus,
    completed_at: fsa.completedAt,
    verifier_dm_id: fsa.verifierDmId,
    verifier_ft_id: fsa.verifierFtId,
    documents: fsa.documents ?? { productPhoto: null, ppap: [] },
    checklist: fsa.checklist ?? {},
    approvals: fsa.approvals ?? {},
    created_by_id: fsa.createdById,
    history: fsa.history ?? [],
  }
}

function rowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    jobTitle: row.job_title ?? null,
    division: row.division ?? null,
    passwordHash: row.password_hash,
    isDemoLogin: row.is_demo_login ?? false,
  }
}

export async function getAllUsers() {
  if (!isSupabaseEnabled) return getLocalDb().users
  const { data, error } = await getSupabaseAdmin().from('users').select('*').order('email')
  if (error) throw error
  return data.map(rowToUser)
}

export async function findUserById(userId) {
  if (!isSupabaseEnabled) return getLocalDb().users.find((u) => u.id === userId) ?? null
  const { data, error } = await getSupabaseAdmin().from('users').select('*').eq('id', userId).single()
  if (error) return null
  return rowToUser(data)
}

export async function findUserByEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!isSupabaseEnabled) return getLocalDb().users.find((u) => u.email.toLowerCase() === normalized) ?? null
  const { data, error } = await getSupabaseAdmin().from('users').select('*').eq('email', normalized).single()
  if (error) return null
  return rowToUser(data)
}

export async function userExistsById(userId) {
  if (!userId) return false
  return (await findUserById(userId)) !== null
}

export async function listFsas({ status, supplierId, search } = {}) {
  if (!isSupabaseEnabled) {
    const keyword = String(search ?? '').trim().toLowerCase()
    return getLocalDb()
      .fsas.filter((fsa) => {
        if (status && fsa.approvalStatus !== status) return false
        if (supplierId && fsa.supplierId !== supplierId) return false
        if (keyword) {
          const haystack = `${fsa.fsaNumber} ${fsa.partNumber} ${fsa.materialDescription}`.toLowerCase()
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  let query = getSupabaseAdmin().from('fsas').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('approval_status', status)
  if (supplierId) query = query.eq('supplier_id', supplierId)
  if (search?.trim()) {
    const kw = `%${search.trim()}%`
    query = query.or(`fsa_number.ilike.${kw},part_number.ilike.${kw},material_description.ilike.${kw}`)
  }
  const { data, error } = await query
  if (error) throw error
  return data.map(rowToFsa)
}

export async function getFsaById(id) {
  if (!isSupabaseEnabled) return getLocalDb().fsas.find((f) => f.id === id) ?? null
  const { data, error } = await getSupabaseAdmin().from('fsas').select('*').eq('id', id).single()
  if (error) return null
  return rowToFsa(data)
}

export async function insertFsa(fsa) {
  if (!isSupabaseEnabled) {
    getLocalDb().fsas.push(fsa)
    saveLocalDb()
    return fsa
  }
  const { data, error } = await getSupabaseAdmin().from('fsas').insert(fsaToRow(fsa)).select('*').single()
  if (error) throw error
  return rowToFsa(data)
}

export async function saveFsa(fsa) {
  if (!isSupabaseEnabled) {
    saveLocalDb() // fsa sudah dimutasi by-reference di array local
    return fsa
  }
  const { data, error } = await getSupabaseAdmin()
    .from('fsas')
    .update(fsaToRow(fsa))
    .eq('id', fsa.id)
    .select('*')
    .single()
  if (error) throw error
  return rowToFsa(data)
}

export function normalizePartNumber(value) {
  return String(value ?? '').trim().toUpperCase()
}

function rowToMasterMaterial(row) {
  if (!row) return null
  return {
    partNumber: row.part_number,
    materialDescription: row.material_description ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToCustomMaterial(row) {
  if (!row) return null
  return {
    partNumber: row.part_number,
    materialDescription: row.material_description ?? '',
    firstFsaId: row.first_fsa_id,
    createdById: row.created_by_id,
    createdAt: row.created_at,
  }
}

// Hijau HANYA jika ada di master. Custom/unknown => kuning (found=false).
export async function lookupMaterial(rawPartNumber) {
  const partNumber = normalizePartNumber(rawPartNumber)
  if (!partNumber) return null
  if (!isSupabaseEnabled) {
    const db = getLocalDb()
    const master = (db.masterMaterials ?? []).find((m) => normalizePartNumber(m.partNumber) === partNumber)
    if (master) {
      return { partNumber, status: 'master', found: true, materialDescription: master.materialDescription ?? '' }
    }
    const custom = (db.customMaterials ?? []).find((m) => normalizePartNumber(m.partNumber) === partNumber)
    if (custom) {
      return { partNumber, status: 'custom', found: false, materialDescription: custom.materialDescription ?? '' }
    }
    return { partNumber, status: 'not_found', found: false, materialDescription: '' }
  }
  const admin = getSupabaseAdmin()
  const { data: master, error: masterErr } = await admin.from('master_materials').select('*').eq('part_number', partNumber).maybeSingle()
  if (masterErr) throw masterErr
  if (master) {
    const m = rowToMasterMaterial(master)
    return { partNumber, status: 'master', found: true, materialDescription: m.materialDescription }
  }
  const { data: custom, error: customErr } = await admin.from('custom_materials').select('*').eq('part_number', partNumber).maybeSingle()
  if (customErr) throw customErr
  if (custom) {
    const c = rowToCustomMaterial(custom)
    return { partNumber, status: 'custom', found: false, materialDescription: c.materialDescription }
  }
  return { partNumber, status: 'not_found', found: false, materialDescription: '' }
}

export async function batchLookupMaterials(rawParts = []) {
  const parts = [...new Set((rawParts ?? []).map(normalizePartNumber).filter(Boolean))].slice(0, 100)
  const results = {}
  for (const part of parts) {
    results[part] = await lookupMaterial(part)
  }
  return results
}

// Part non-master otomatis tercatat sebagai custom (tetap kuning).
export async function upsertCustomMaterial({ partNumber, materialDescription = '', fsaId = null, userId = null }) {
  const normalized = normalizePartNumber(partNumber)
  if (!normalized) return null
  const existing = await lookupMaterial(normalized)
  if (existing && existing.status === 'master') return existing
  if (existing && existing.status === 'custom') return existing
  if (!isSupabaseEnabled) {
    const db = getLocalDb()
    db.customMaterials = db.customMaterials ?? []
    const row = {
      partNumber: normalized,
      materialDescription: String(materialDescription ?? '').slice(0, 500),
      firstFsaId: fsaId,
      createdById: userId,
      createdAt: new Date().toISOString(),
    }
    db.customMaterials.push(row)
    saveLocalDb()
    return { partNumber: normalized, status: 'custom', found: false, materialDescription: row.materialDescription }
  }
  const { data, error } = await getSupabaseAdmin()
    .from('custom_materials')
    .upsert(
      {
        part_number: normalized,
        material_description: String(materialDescription ?? '').slice(0, 500),
        first_fsa_id: fsaId,
        created_by_id: userId,
      },
      { onConflict: 'part_number', ignoreDuplicates: true },
    )
    .select('*')
    .maybeSingle()
  if (error) throw error
  const c = rowToCustomMaterial(data)
  return { partNumber: normalized, status: 'custom', found: false, materialDescription: c?.materialDescription ?? '' }
}

export async function buildNextNumber(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `FSA-${stamp}`

  let numbers = []
  if (!isSupabaseEnabled) {
    numbers = getLocalDb()
      .fsas.filter((fsa) => fsa.fsaNumber?.startsWith(prefix))
      .map((fsa) => Number.parseInt(fsa.fsaNumber.split('-')[2], 10))
      .filter((v) => Number.isFinite(v))
  } else {
    const { data, error } = await getSupabaseAdmin().from('fsas').select('fsa_number').like('fsa_number', `${prefix}%`)
    if (error) throw error
    numbers = (data ?? [])
      .map((r) => Number.parseInt(String(r.fsa_number).split('-')[2], 10))
      .filter((v) => Number.isFinite(v))
  }

  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  return `${prefix}-${String(next).padStart(2, '0')}`
}
