// Seed Supabase dari data demo lokal (server/seed.js).
// Jalankan: npm run db:seed:supabase
// Butuh env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { SAMPLE_FSAS, USERS } from '../server/seed.js'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const MASTER_MATERIALS = JSON.parse(readFileSync(join(rootDir, 'server', 'masterMaterials.json'), 'utf8'))

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env')
  process.exit(1)
}

const supa = createClient(url, serviceKey, { auth: { persistSession: false } })

function toUserRow(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    job_title: u.jobTitle ?? null,
    division: u.division ?? null,
    password_hash: u.passwordHash,
    is_demo_login: u.isDemoLogin ?? false,
  }
}

function toFsaRow(fsa, createdById) {
  return {
    id: randomUUID(),
    fsa_number: fsa.fsaNumber,
    ppap_level: fsa.ppapLevel,
    part_number: fsa.partNumber,
    material_description: fsa.materialDescription,
    drawing_revision: fsa.drawingRevision,
    sourcing_volume: null,
    supplier_id: fsa.supplierId,
    category_id: fsa.categoryId,
    category_other: fsa.categoryOther ?? '',
    reason_id: fsa.reasonId,
    reason_other: fsa.reasonOther ?? '',
    date_of_sample_submission: fsa.dateOfSampleSubmission,
    sample_quantity: fsa.sampleQuantity ?? 0,
    created_at: fsa.createdAt ?? new Date().toISOString(),
    approval_status: fsa.approvalStatus,
    completed_at: fsa.completedAt ?? null,
    verifier_dm_id: fsa.verifierDmId,
    verifier_ft_id: fsa.verifierFtId,
    documents: fsa.documents ?? { appearance: null, ppap: [] },
    checklist: fsa.checklist ?? {},
    approvals: fsa.approvals ?? {},
    created_by_id: createdById ?? fsa.createdById ?? null,
    history: [
      { at: fsa.createdAt, byId: createdById ?? fsa.createdById ?? null, action: 'created', note: 'FSA dibuat (seed)' },
    ],
  }
}

const { error: userErr } = await supa.from('users').upsert(USERS.map(toUserRow), { onConflict: 'id' })
if (userErr) {
  console.error('Gagal seed users:', userErr.message)
  process.exit(1)
}
console.log(`Users tersed: ${USERS.length}`)

// Hapus FSA lama biar seed idempotent (berdasarkan fsa_number sample)
for (const fsa of SAMPLE_FSAS) {
  await supa.from('fsas').delete().eq('fsa_number', fsa.fsaNumber)
}

const rows = SAMPLE_FSAS.map((fsa) => toFsaRow(fsa, fsa.createdById))
const { error: fsaErr } = await supa.from('fsas').insert(rows)
if (fsaErr) {
  console.error('Gagal seed fsas:', fsaErr.message)
  process.exit(1)
}
console.log(`FSA tersed: ${rows.length}`)

// Seed master materials (hijau) beserta material description hasil import.
// upsert: desc baru menimpa desc lama per part_number.
const masterRows = []
{
  const seen = new Set()
  for (const row of MASTER_MATERIALS) {
    const part_number = String(row.partNumber ?? '').trim().toUpperCase()
    if (!part_number || seen.has(part_number)) continue
    seen.add(part_number)
    masterRows.push({ part_number, material_description: String(row.materialDescription ?? '').trim() })
  }
}
const { error: masterErr } = await supa.from('master_materials').upsert(masterRows, { onConflict: 'part_number' })
if (masterErr) {
  console.error('Gagal seed master_materials:', masterErr.message)
  process.exit(1)
}
console.log(`Master materials tersed: ${masterRows.length}`)
