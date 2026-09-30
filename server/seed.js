import { hashPassword } from './security.js'

export const DEMO_PASSWORD = 'efisa123'

export const ROLES = [
  { id: 'procurement', name: 'Procurement', shortName: 'SPR' },
  { id: 'electrical_engineer', name: 'Electrical Engineer', shortName: 'EEE' },
  { id: 'mechanical_engineer', name: 'Mechanical Engineer', shortName: 'MEE' },
  { id: 'quality_management', name: 'Quality Management', shortName: 'QM' },
  { id: 'production', name: 'Production', shortName: 'PRD' },
]

const users = [
  { id: 'usr-spr-01', name: 'Adi Pratama', role: 'procurement', division: 'DM', jobTitle: 'SPR Direct Material', isDemoLogin: true },
  { id: 'usr-spr-02', name: 'Siti Nurhaliza', role: 'procurement', division: 'DM', jobTitle: 'SPR Direct Material' },
  { id: 'usr-spr-03', name: 'Budi Santoso', role: 'procurement', division: 'FT', jobTitle: 'SPR Fremdteil' },

  { id: 'usr-eee-01', name: 'Andi Wijaya', role: 'electrical_engineer', jobTitle: 'Electrical Engineer' },
  { id: 'usr-eee-02', name: 'Mira Sari', role: 'electrical_engineer', jobTitle: 'Electrical Engineer' },
  { id: 'usr-eee-03', name: 'Fajar Nugroho', role: 'electrical_engineer', jobTitle: 'Electrical Engineer' },

  { id: 'usr-mee-01', name: 'Bayu Saputra', role: 'mechanical_engineer', jobTitle: 'Mechanical Engineer' },
  { id: 'usr-mee-02', name: 'Nadia Putri', role: 'mechanical_engineer', jobTitle: 'Mechanical Engineer' },
  { id: 'usr-mee-03', name: 'Rizky Maulana', role: 'mechanical_engineer', jobTitle: 'Mechanical Engineer' },

  { id: 'usr-qm-01', name: 'Citra Ayu', role: 'quality_management', jobTitle: 'Quality Management' },
  { id: 'usr-qm-02', name: 'Hendra Gunawan', role: 'quality_management', jobTitle: 'Quality Management' },
  { id: 'usr-qm-03', name: 'Laras Wulandari', role: 'quality_management', jobTitle: 'Quality Management' },

  { id: 'usr-prd-01', name: 'Eko Prasetyo', role: 'production', jobTitle: 'Production Supervisor' },
  { id: 'usr-prd-02', name: 'Maya Anggraini', role: 'production', jobTitle: 'Production Supervisor' },
  { id: 'usr-prd-03', name: 'Surya Dharma', role: 'production', jobTitle: 'Production Supervisor' },
]

export const USERS = users.map(({ division, ...user }) => ({
  ...user,
  division: division ?? null,
  email: `${user.name.toLowerCase().split(' ').reverse().join('.')}@siemens.com`,
  passwordHash: hashPassword(`${user.name.toLowerCase().split(' ').reverse().join('.')}@siemens.com`, DEMO_PASSWORD),
}))

export const FSA_STATUSES = [
  { id: 'waiting_approval_spr', name: 'Waiting Approval SPR' },
  { id: 'waiting_approval_engineering', name: 'Waiting Approval Engineering' },
  { id: 'waiting_approval_quality', name: 'Waiting Approval Quality' },
  { id: 'waiting_approval_production', name: 'Waiting Approval Production' },
  { id: 'accepted', name: 'Accepted' },
  { id: 'canceled', name: 'Canceled' },
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

export const PPAP_LEVELS = [1, 2, 3, 4, 5]

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

export const APPROVAL_FUNCTIONS = [
  { key: 'procurement', label: 'Procurement Decision (SPR)', role: 'procurement' },
  { key: 'quality', label: 'Quality Decision (QM)', role: 'quality_management' },
  { key: 'electrical', label: 'Electrical Engineering Decision', role: 'electrical_engineer' },
  { key: 'mechanical', label: 'Mechanical Engineering Decision', role: 'mechanical_engineer' },
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

function sampleFsa(overrides) {
  return {
    fsaNumber: 'FSA-20260115-01',
    ppapLevel: 3,
    partNumber: 'PART01950185',
    materialDescription: 'Bracket holder, aluminium ALSI12MG, anodized',
    drawingRevision: 0,
    supplierId: 'sup-01',
    categoryId: 'machined_parts',
    reasonId: 'new_material',
    dateOfSampleSubmission: '2026-01-15',
    sampleQuantity: 5,
    approvalStatus: 'waiting_approval_engineering',
    verifierDmId: 'usr-spr-01',
    verifierFtId: 'usr-spr-03',
    documents: { appearance: null, ppap: [] },
    checklist: {
      appearanceApprovalReport: 'not_available',
      checkSheet: 'not_available',
      millCertificate: 'not_available',
    },
    approvals: {
      procurement: { decision: 'approved', approverId: 'usr-spr-01', decidedAt: '2026-01-16T09:15:00.000Z', remark: 'Spesifikasi material sesuai purchase order.' },
      quality: { decision: 'pending', approverId: null, decidedAt: null, remark: '' },
      electrical: { decision: 'pending', approverId: null, decidedAt: null, remark: '' },
      mechanical: { decision: 'pending', approverId: null, decidedAt: null, remark: '' },
      production: { decision: 'pending', approverId: null, decidedAt: null, remark: '' },
    },
    ...overrides,
  }
}

export const SAMPLE_FSAS = [
  {
    createdAt: '2026-01-15T02:10:00.000Z',
    createdById: 'usr-spr-01',
    ...sampleFsa({}),
  },
  {
    createdAt: '2026-02-03T06:45:00.000Z',
    createdById: 'usr-spr-02',
    ...sampleFsa({
      fsaNumber: 'FSA-20260203-01',
      ppapLevel: 5,
      partNumber: 'PART02774310',
      materialDescription: 'Cable harness shield, tinned copper braid',
      drawingRevision: 2,
      supplierId: 'sup-02',
      categoryId: 'connectors_cable_assemblies',
      reasonId: 'change_of_supplier',
      dateOfSampleSubmission: '2026-02-03',
      sampleQuantity: 10,
      approvalStatus: 'waiting_approval_quality',
      checklist: { appearanceApprovalReport: 'approved', checkSheet: 'under_review', millCertificate: 'not_available' },
      approvals: {
        procurement: { decision: 'approved', approverId: 'usr-spr-02', decidedAt: '2026-02-04T01:20:00.000Z', remark: 'Supplier baru sudah onboarding.' },
        quality: { decision: 'pending', approverId: 'usr-qm-01', decidedAt: null, remark: '' },
        electrical: { decision: 'approved', approverId: 'usr-eee-01', decidedAt: '2026-02-05T02:30:00.000Z', remark: 'Spesifikasi kelistrikan oke.' },
        mechanical: { decision: 'approved', approverId: 'usr-mee-01', decidedAt: '2026-02-05T03:10:00.000Z', remark: 'Dimensi sesuai drawing.' },
        production: { decision: 'pending', approverId: null, decidedAt: null, remark: '' },
      },
    }),
  },
]
