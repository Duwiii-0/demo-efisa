import { hashPassword } from './security.js'

export const DEMO_PASSWORD = 'efisa123'

export const ROLES = [
  { id: 'procurement', name: 'Procurement', shortName: 'SPR' },
  { id: 'electrical_engineer', name: 'Electrical Engineer', shortName: 'EEE' },
  { id: 'mechanical_engineer', name: 'Mechanical Engineer', shortName: 'MEE' },
  { id: 'quality_management', name: 'Quality Management', shortName: 'QM' },
  { id: 'production', name: 'Production', shortName: 'PRD' },
]

// Akun login per role (email persis role@siemens.com) + akun personal (email berbasis nama)
const users = [
  { id: 'usr-role-spr', name: 'Procurement', role: 'procurement', jobTitle: 'SPR Direct Material', isDemoLogin: true, email: 'procurement@siemens.com' },
  { id: 'usr-role-eee', name: 'Electrical Engineer', role: 'electrical_engineer', jobTitle: 'Electrical Engineer', email: 'electrical_engineer@siemens.com' },
  { id: 'usr-role-mee', name: 'Mechanical Engineer', role: 'mechanical_engineer', jobTitle: 'Mechanical Engineer', email: 'mechanical_engineer@siemens.com' },
  { id: 'usr-role-qm', name: 'Quality Management', role: 'quality_management', jobTitle: 'Quality Management', email: 'quality_management@siemens.com' },
  { id: 'usr-role-prd', name: 'Production', role: 'production', jobTitle: 'Production Supervisor', email: 'production@siemens.com' },
]

function personalEmail(name) {
  return `${name.toLowerCase().split(' ').reverse().join('.')}@siemens.com`
}

export const USERS = users.map(({ division, email, ...user }) => {
  const finalEmail = email ?? personalEmail(user.name)
  return {
    ...user,
    division: division ?? null,
    email: finalEmail,
    passwordHash: hashPassword(finalEmail, DEMO_PASSWORD),
  }
})

export const FSA_STATUSES = [
  { id: 'waiting_approval_spr', name: 'Waiting Approval SPR' },
  { id: 'waiting_approval_engineering', name: 'Waiting Approval Engineering' },
  { id: 'waiting_approval_quality', name: 'Waiting Approval Quality' },
  { id: 'waiting_approval_production', name: 'Waiting Approval Production' },
  { id: 'accepted', name: 'Approved' },
  { id: 'canceled', name: 'Rejected' },
  { id: 'rework_required', name: 'Rework Required' },
]

export const PART_CATEGORIES = [
  { id: 'machined_parts', name: 'Machined Parts' },
  { id: 'sheet_metal_part', name: 'Sheet Metal Part' },
  { id: 'steel_sheet', name: 'Steel Sheet' },
  { id: 'copper_aluminium_product', name: 'Copper & Aluminium Product' },
  { id: 'fastener_springs', name: 'Fastener & Springs' },
  { id: 'mechanical_assemblies', name: 'Mechanical Assemblies' },
  { id: 'electrical_components', name: 'Electrical Components' },
  { id: 'connectors_cable_assemblies', name: 'Connectors & Cable Assemblies' },
  { id: 'transformers', name: 'Transformers' },
  { id: 'plastic_parts', name: 'Plastic Parts' },
  { id: 'surface_treatment', name: 'Surface Treatment' },
  { id: 'measuring_instrumentation_testing', name: 'Measuring, Instrumentation & Testing' },
  { id: 'others', name: 'Others' },
]

export const FSA_REASONS = [
  { id: 'new_material', name: 'New Material' },
  { id: 'change_of_supplier', name: 'Change of Supplier' },
  { id: 'drawing_revision', name: 'Drawing Revision' },
  { id: 'tool_renewal', name: 'Tool Renewal' },
  { id: 'other', name: 'Other' },
  { id: 'change_of_production_process', name: 'Change of Production Process' },
  { id: 'change_of_brand', name: 'Change of Brand' },
  { id: 'change_of_raw_material', name: 'Change of Raw Material' },
]

export const FSA_LEVELS = [1, 2, 3, 4, 5]

export const CHECKLIST_STATUSES = [
  { id: 'not_available', name: 'Not Available' },
  { id: 'under_review', name: 'Under Review' },
  { id: 'approved', name: 'Approved' },
  { id: 'rejected', name: 'Rejected' },
]

export const APPROVAL_DECISIONS = [
  { id: 'pending', name: 'Pending' },
  { id: 'approved', name: 'Approved' },
  { id: 'rejected', name: 'Rejected' },
]

// Urutan baku (tidak boleh dilompat): SPR -> Engineering -> Quality -> Production
export const APPROVAL_FUNCTIONS = [
  { key: 'procurement', label: 'Procurement Decision (SPR)', role: 'procurement' },
  { key: 'electrical', label: 'Electrical Engineering Decision', role: 'electrical_engineer' },
  { key: 'mechanical', label: 'Mechanical Engineering Decision', role: 'mechanical_engineer' },
  { key: 'quality', label: 'Quality Decision (QM)', role: 'quality_management' },
  { key: 'production', label: 'Production Decision', role: 'production' },
]

export const SUPPLIERS = [
  { id: 'sup-01', name: 'PT Sinar Baja Nusantara' },
  { id: 'sup-02', name: 'PT Mitra Elektro Teknik' },
  { id: 'sup-03', name: 'PT Kimia Presisi Indonesia' },
  { id: 'sup-04', name: 'PT Logam Dunia Sentosa' },
  { id: 'sup-05', name: 'PT Tekno Komponen Nusantara' },
]

export const DIVISIONS = [
  { id: 'DM', name: 'DM' },
  { id: 'FT', name: 'FT' },
]

function pendingApproval(approverId = null) {
  return { decision: 'pending', approverId, decidedAt: null, remark: '' }
}

function approvedApproval(approverId, decidedAt, remark) {
  return { decision: 'approved', approverId, decidedAt, remark: remark ?? '' }
}

function rejectedApproval(approverId, decidedAt, remark) {
  return { decision: 'rejected', approverId, decidedAt, remark: remark ?? '' }
}

function sampleFsa(overrides) {
  return {
    fsaNumber: 'FSA-20260115-01',
    ppapLevel: 3,
    partNumber: 'PART01950185',
    materialDescription: 'Bracket holder, aluminium ALSI12MG, anodized',
    drawingRevision: 0,
    supplierId: 'sup-01',
    supplierOther: '',
    categoryId: 'machined_parts',
    categoryOther: '',
    reasonId: 'new_material',
    reasonOther: '',
    dateOfSampleSubmission: '2026-01-15',
    sampleQuantity: 3,
    approvalStatus: 'waiting_approval_spr',
    completedAt: null,
    verifierDmId: 'usr-role-spr',
    verifierFtId: 'usr-role-spr',
    documents: { productPhoto: null, ppap: [] },
    checklist: {
      appearanceApprovalReport: 'not_available',
      checkSheet: 'not_available',
      millCertificate: 'not_available',
    },
    approvals: {
      procurement: pendingApproval('usr-role-spr'),
      electrical: pendingApproval('usr-role-eee'),
      mechanical: pendingApproval('usr-role-mee'),
      quality: pendingApproval('usr-role-qm'),
      production: pendingApproval('usr-role-prd'),
    },
    ...overrides,
  }
}

// 1 case untuk setiap status, semuanya berurut (tidak meloncat):
// SPR -> Engineering (electrical+mechanical) -> Quality -> Production -> Accepted
export const SAMPLE_FSAS = [
  {
    // 1. Waiting Approval SPR: semua masih pending
    createdAt: '2026-01-15T02:10:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260115-01',
      approvalStatus: 'waiting_approval_spr',
    }),
  },
  {
    // 2. Waiting Approval Engineering: SPR approved, sisanya pending
    createdAt: '2026-02-03T06:45:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260203-01',
      ppapLevel: 3,
      partNumber: 'PART01950186',
      materialDescription: 'Bracket holder batch 2, menunggu review engineering',
      supplierId: 'sup-01',
      categoryId: 'machined_parts',
      reasonId: 'new_material',
      dateOfSampleSubmission: '2026-02-03',
      approvalStatus: 'waiting_approval_engineering',
      approvals: {
        procurement: approvedApproval('usr-role-spr', '2026-02-04T01:20:00.000Z', 'SPR oke, lanjut engineering.'),
        electrical: pendingApproval('usr-role-eee'),
        mechanical: pendingApproval('usr-role-mee'),
        quality: pendingApproval('usr-role-qm'),
        production: pendingApproval('usr-role-prd'),
      },
    }),
  },
  {
    // 3. Waiting Approval Quality: SPR + Engineering (electrical+mechanical) approved
    createdAt: '2026-03-10T06:45:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260310-01',
      ppapLevel: 5,
      partNumber: 'PART02774310',
      materialDescription: 'Cable harness shield, tinned copper braid',
      drawingRevision: 2,
      supplierId: 'sup-02',
      categoryId: 'connectors_cable_assemblies',
      reasonId: 'change_of_supplier',
      dateOfSampleSubmission: '2026-03-10',
      sampleQuantity: 10,
      approvalStatus: 'waiting_approval_quality',
      checklist: { appearanceApprovalReport: 'approved', checkSheet: 'under_review', millCertificate: 'not_available' },
      approvals: {
        procurement: approvedApproval('usr-role-spr', '2026-03-11T01:20:00.000Z', 'Supplier baru sudah onboarding.'),
        electrical: approvedApproval('usr-role-eee', '2026-03-12T02:30:00.000Z', 'Spesifikasi kelistrikan oke.'),
        mechanical: approvedApproval('usr-role-mee', '2026-03-12T03:10:00.000Z', 'Dimensi sesuai drawing.'),
        quality: pendingApproval('usr-role-qm'),
        production: pendingApproval('usr-role-prd'),
      },
    }),
  },
  {
    // 4. Waiting Approval Production: SPR + Engineering + Quality approved
    createdAt: '2026-03-20T06:45:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260320-01',
      ppapLevel: 4,
      partNumber: 'PART02774311',
      materialDescription: 'Cable harness shield rev B, menunggu trial production',
      drawingRevision: 3,
      supplierId: 'sup-02',
      categoryId: 'connectors_cable_assemblies',
      reasonId: 'drawing_revision',
      dateOfSampleSubmission: '2026-03-20',
      sampleQuantity: 3,
      approvalStatus: 'waiting_approval_production',
      checklist: { appearanceApprovalReport: 'approved', checkSheet: 'approved', millCertificate: 'under_review' },
      approvals: {
        procurement: approvedApproval('usr-role-spr', '2026-03-21T01:20:00.000Z', 'PO revisi sudah terbit.'),
        electrical: approvedApproval('usr-role-eee', '2026-03-22T02:30:00.000Z', 'Kelistrikan oke.'),
        mechanical: approvedApproval('usr-role-mee', '2026-03-22T03:10:00.000Z', 'Mekanik oke.'),
        quality: approvedApproval('usr-role-qm', '2026-03-23T04:00:00.000Z', 'Dokumen mutu lengkap.'),
        production: pendingApproval('usr-role-prd'),
      },
    }),
  },
  {
    // 5. Accepted: semua approved berurut
    createdAt: '2026-04-01T06:45:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260401-01',
      ppapLevel: 3,
      partNumber: 'PART01950187',
      materialDescription: 'Bracket holder final, lolos semua tahap',
      supplierId: 'sup-01',
      categoryId: 'machined_parts',
      reasonId: 'new_material',
      dateOfSampleSubmission: '2026-04-01',
      approvalStatus: 'accepted',
      completedAt: '2026-04-05T05:00:00.000Z',
      checklist: { appearanceApprovalReport: 'approved', checkSheet: 'approved', millCertificate: 'approved' },
      approvals: {
        procurement: approvedApproval('usr-role-spr', '2026-04-02T01:20:00.000Z', 'SPR oke.'),
        electrical: approvedApproval('usr-role-eee', '2026-04-03T02:30:00.000Z', 'Elektrik oke.'),
        mechanical: approvedApproval('usr-role-mee', '2026-04-03T03:10:00.000Z', 'Mekanik oke.'),
        quality: approvedApproval('usr-role-qm', '2026-04-04T04:00:00.000Z', 'Mutu oke.'),
        production: approvedApproval('usr-role-prd', '2026-04-05T05:00:00.000Z', 'Trial production oke.'),
      },
    }),
  },
  {
    // 6. Rework Required: berhenti di Engineering (electrical rejected)
    createdAt: '2026-04-10T06:45:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260410-01',
      ppapLevel: 2,
      partNumber: 'PART03112233',
      materialDescription: 'Kontaktor mini, isolasi tidak memenuhi syarat',
      supplierId: 'sup-05',
      categoryId: 'electrical_components',
      reasonId: 'new_material',
      dateOfSampleSubmission: '2026-04-10',
      approvalStatus: 'rework_required',
      approvals: {
        procurement: approvedApproval('usr-role-spr', '2026-04-11T01:20:00.000Z', 'Lanjut engineering.'),
        electrical: rejectedApproval('usr-role-eee', '2026-04-12T02:30:00.000Z', 'Tegangan tembus di bawah spek, rework.'),
        mechanical: pendingApproval('usr-role-mee'),
        quality: pendingApproval('usr-role-qm'),
        production: pendingApproval('usr-role-prd'),
      },
    }),
  },
  {
    // 7. Canceled: dibatalkan setelah SPR (tahap berikutnya tetap pending)
    createdAt: '2026-04-15T06:45:00.000Z',
    createdById: 'usr-role-spr',
    ...sampleFsa({
      fsaNumber: 'FSA-20260415-01',
      ppapLevel: 1,
      partNumber: 'PART04445555',
      materialDescription: 'Seal karet EPDM custom, dibatalkan karena ganti supplier',
      supplierId: 'sup-03',
      categoryId: 'others',
      categoryOther: 'Rubber Seal Custom',
      reasonId: 'other',
      reasonOther: 'Emergency ganti supplier line stop',
      dateOfSampleSubmission: '2026-04-15',
      approvalStatus: 'canceled',
      approvals: {
        procurement: approvedApproval('usr-role-spr', '2026-04-16T01:20:00.000Z', 'Awalnya oke, lalu dibatalkan.'),
        electrical: pendingApproval('usr-role-eee'),
        mechanical: pendingApproval('usr-role-mee'),
        quality: pendingApproval('usr-role-qm'),
        production: pendingApproval('usr-role-prd'),
      },
    }),
  },
]
