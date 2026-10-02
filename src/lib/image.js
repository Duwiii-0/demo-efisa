// Kompresi gambar sebelum dikirim ke API.
// Vercel serverless punya batas body 4.5MB, jadi gambar besar harus diperkecil.
const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.6
const SKIP_THRESHOLD = 200 * 1024

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    return file
  }

  if (file.size < SKIP_THRESHOLD) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengompres gambar'))
            return
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        JPEG_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal memuat gambar'))
    }

    img.src = url
  })
}
