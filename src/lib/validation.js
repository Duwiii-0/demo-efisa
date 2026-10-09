import { FSA_DOCUMENT_FIELDS, MAX_FILES_PER_FIELD } from './fsaForm.js'

export function splitParts(value) {
  return String(value ?? '')
    .toUpperCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function validateForm(form, users) {
  const errors = {}
  const { general, documents } = form

  if (!general.ppapLevel) {
    errors.ppapLevel = 'FSA level wajib dipilih'
  }
  if (splitParts(general.partNumber).length === 0) {
    errors.partNumber = 'Part number wajib diisi'
  }
  if (general.materialDescription.trim().length < 3) {
    errors.materialDescription = 'Material description minimal 3 karakter'
  }
  if (general.drawingRevision === '' || Number(general.drawingRevision) < 0) {
    errors.drawingRevision = 'Drawing revision wajib diisi, mulai dari 0'
  }
  if (general.sourcingVolume !== '' && general.sourcingVolume !== null && general.sourcingVolume !== undefined) {
    if (!Number.isInteger(Number(general.sourcingVolume)) || Number(general.sourcingVolume) < 0) {
      errors.sourcingVolume = 'Sourcing volume harus bilangan bulat mulai dari 0'
    }
  }
  if (!general.supplierId) {
    errors.supplierName = 'Supplier wajib dipilih'
  } else if (general.supplierId === 'other' && String(general.supplierOther ?? '').trim().length < 3) {
    errors.supplierOther = 'Nama supplier lainnya wajib diisi minimal 3 karakter'
  }
  if (!general.categoryId) {
    errors.category = 'Part category wajib dipilih'
  } else if (general.categoryId === 'others' && String(general.categoryOther ?? '').trim().length < 3) {
    errors.categoryOther = 'Kategori lainnya wajib diisi minimal 3 karakter'
  }
  if (!general.reasonId) {
    errors.reasonOfFsa = 'Reason of FSA wajib dipilih'
  } else if (general.reasonId === 'other' && String(general.reasonOther ?? '').trim().length < 3) {
    errors.reasonOther = 'Reason lainnya wajib diisi minimal 3 karakter'
  }
  if (!general.dateOfSampleSubmission) {
    errors.dateOfSampleSubmission = 'Date of sample submission wajib diisi'
  }
  if (general.sampleQuantity === '' || general.sampleQuantity === null || general.sampleQuantity === undefined || ![0, 3, 10].includes(Number(general.sampleQuantity))) {
    errors.sampleQuantity = 'Sample quantity wajib dipilih (No Sample / 3 UoM / 10 UoM)'
  }
  if (!general.verifierDmId) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!general.verifierFtId) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }
  if (!documents.productPhoto) {
    errors.productPhoto = 'Foto product photo wajib diunggah'
  }
  for (const field of FSA_DOCUMENT_FIELDS) {
    const files = documents[field.key] ?? []
    if (field.required && files.length === 0) {
      errors[`documents.${field.key}`] = `${field.label} wajib diunggah`
    } else if (files.length > MAX_FILES_PER_FIELD) {
      errors[`documents.${field.key}`] = `${field.label} maksimal ${MAX_FILES_PER_FIELD} file`
    } else {
      const invalid = files.find((file) => !isAllowedDocument(file))
      if (invalid) {
        errors[`documents.${field.key}`] = `File ${invalid.fileName ?? 'tersebut'} harus PDF, Excel, Word, atau gambar`
      }
    }
  }

  const electricalId = form.approvals?.electrical?.approverId
  const mechanicalId = form.approvals?.mechanical?.approverId

  if (!electricalId && !mechanicalId) {
    errors['approvals.electrical.approverId'] = 'Minimal salah satu (Electrical atau Mechanical) wajib dipilih'
    errors['approvals.mechanical.approverId'] = 'Minimal salah satu (Electrical atau Mechanical) wajib dipilih'
  }

  for (const [key, role] of Object.entries(APPROVAL_ROLE)) {
    const approval = form.approvals[key]
    if (key === 'electrical' || key === 'mechanical') {
      if (approval?.approverId && !users.some((user) => user.id === approval.approverId && user.role === role)) {
        errors[`approvals.${key}.approverId`] = 'Approver tidak sesuai dengan role'
      }
    } else {
      if (!approval?.approverId) {
        errors[`approvals.${key}.approverId`] = 'Approver wajib dipilih sejak awal'
      } else if (!users.some((user) => user.id === approval.approverId && user.role === role)) {
        errors[`approvals.${key}.approverId`] = 'Approver tidak sesuai dengan role'
      }
    }
  }

  // Validasi berurut: tidak boleh meloncat tahap
  const d = (key) => form.approvals?.[key]?.decision ?? 'pending'
  const isActive = (key) => form.approvals?.[key]?.approverId && d(key) !== 'pending'
  const isApprovedOrSkipped = (key) => {
    if (!form.approvals?.[key]?.approverId) return true
    return d(key) === 'approved'
  }

  const markSkipped = (keys, need) => {
    for (const key of keys) {
      if (isActive(key)) errors[`approvals.${key}`] = `Tidak bisa meloncat: ${need} harus approved dulu`
    }
  }

  if (!isApprovedOrSkipped('procurement')) {
    markSkipped(['electrical', 'mechanical', 'quality', 'production'], 'SPR')
  } else if (!isApprovedOrSkipped('electrical') || !isApprovedOrSkipped('mechanical')) {
    markSkipped(['quality', 'production'], 'Engineering (yang dipilih)')
  } else if (!isApprovedOrSkipped('quality')) {
    markSkipped(['production'], 'Quality')
  }

  return errors
}

const APPROVAL_ROLE = {
  procurement: 'procurement',
  quality: 'quality_management',
  electrical: 'electrical_engineer',
  mechanical: 'mechanical_engineer',
  production: 'production',
}

export function isImage(file) {
  return Boolean(file?.type?.startsWith('image/'))
}

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'gif'])

// Menerima File (saat pilih) maupun meta {fileName, mime} (saat validasi form).
export function isAllowedDocument(file) {
  const mime = String(file?.mime ?? file?.type ?? '')
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
  const name = String(file?.fileName ?? file?.name ?? '')
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return ALLOWED_DOCUMENT_EXTENSIONS.has(ext)
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => resolve({ fileName: file.name, mime: file.type, dataUrl: reader.result })
    reader.readAsDataURL(file)
  })
}
