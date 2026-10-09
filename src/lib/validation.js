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
  if (general.sampleQuantity === '' || general.sampleQuantity === null || general.sampleQuantity === undefined || Number(general.sampleQuantity) < 0) {
    errors.sampleQuantity = 'Sample quantity wajib diisi, mulai dari 0'
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

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_FSA_FILES = 10

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => resolve({ fileName: file.name, mime: file.type, dataUrl: reader.result })
    reader.readAsDataURL(file)
  })
}
