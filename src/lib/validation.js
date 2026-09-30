export const PART_NUMBER_PATTERN = /^PART\d{8}$/

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
    errors.ppapLevel = 'PPAP level wajib dipilih'
  }
  const partNumbers = splitParts(general.partNumber)
  if (partNumbers.length === 0 || partNumbers.some((part) => !PART_NUMBER_PATTERN.test(part))) {
    errors.partNumber = 'Setiap part number harus format PART + 8 digit, dipisahkan koma (,). Contoh: PART01950185,PART02774310'
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
  }
  if (!general.categoryId) {
    errors.category = 'Part category wajib dipilih'
  }
  if (!general.reasonId) {
    errors.reasonOfFsa = 'Reason of FSA wajib dipilih'
  }
  if (!general.dateOfSampleSubmission) {
    errors.dateOfSampleSubmission = 'Date of sample submission wajib diisi'
  }
  if (!general.sampleQuantity || Number(general.sampleQuantity) < 1) {
    errors.sampleQuantity = 'Sample quantity minimal 1'
  }
  if (!general.verifierDmId) {
    errors.verifierDm = 'Verifikator DM wajib dipilih'
  }
  if (!general.verifierFtId) {
    errors.verifierFt = 'Verifikator FT wajib dipilih'
  }
  if (!documents.appearance) {
    errors.appearance = 'Foto appearance wajib diunggah'
  }

  for (const [key, role] of Object.entries(APPROVAL_ROLE)) {
    const approval = form.approvals[key]
    if (approval.decision !== 'pending' && !approval.approverId) {
      errors[`approvals.${key}.approverId`] = 'Pilih approver saat keputusan sudah diisi'
    } else if (approval.approverId && !users.some((user) => user.id === approval.approverId && user.role === role)) {
      errors[`approvals.${key}.approverId`] = 'Approver tidak sesuai dengan role'
    }
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

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_PPAP_FILES = 10

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => resolve({ fileName: file.name, mime: file.type, dataUrl: reader.result })
    reader.readAsDataURL(file)
  })
}
