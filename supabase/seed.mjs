// Seed Supabase dari data demo lokal (server/seed.js, mengikuti branch aktif).
// Jalankan: npm run db:seed:supabase:main  (branch main + .env.main, tanpa production)
//           npm run db:seed:supabase:v2    (branch v2 + .env.v2, dengan production)
// Butuh env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { APPROVAL_FUNCTIONS, SAMPLE_FSAS, USERS } from '../server/seed.js'

// Pengaman varian: cegah seed data yang salah ke proyek Supabase yang salah.
// EFISA_VARIANT wajib diisi (gunakan npm run db:seed:supabase:main / :v2).
const seedVariant = (process.env.EFISA_VARIANT ?? '').trim().toLowerCase()
if (seedVariant !== 'main' && seedVariant !== 'v2') {
  console.error('BATAL: EFISA_VARIANT harus "main" atau "v2". Gunakan npm run db:seed:supabase:main / :v2.')
  process.exit(1)
}
const seedFnKeys = APPROVAL_FUNCTIONS.map((f) => f.key)
if (seedVariant === 'main' && seedFnKeys.includes('production')) {
  console.error('BATAL: EFISA_VARIANT=main tapi seed mengandung production. Jalankan dari branch main.')
  process.exit(1)
}
if (seedVariant === 'v2' && !seedFnKeys.includes('production')) {
  console.error('BATAL: EFISA_VARIANT=v2 tapi seed tanpa production. Jalankan dari branch v2.')
  process.exit(1)
}
console.log(`Seed varian: ${seedVariant} [approval: ${seedFnKeys.join(',')}]`)

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
    supplier_other: fsa.supplierOther ?? '',
    category_id: fsa.categoryId,
    category_other: fsa.categoryOther ?? '',
    reason_id: fsa.reasonId,
    reason_other: fsa.reasonOther ?? '',
    date_of_sample_submission: fsa.dateOfSampleSubmission,
    sample_quantity: fsa.sampleQuantity ?? 0,
    created_at: fsa.createdAt ?? new Date().toISOString(),
    submitted_at: fsa.approvalStatus === 'draft' ? null : (fsa.submittedAt ?? fsa.createdAt ?? new Date().toISOString()),
    approval_status: fsa.approvalStatus,
    completed_at: fsa.completedAt ?? null,
    verifier_dm_id: fsa.verifierDmId,
    verifier_ft_id: fsa.verifierFtId,
    documents: fsa.documents ?? { productPhoto: null },
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
