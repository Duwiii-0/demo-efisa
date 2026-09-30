import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getUploadsDir } from './db.js'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_FILES = 10

export function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Format file tidak valid')
  }

  const [header, base64] = dataUrl.split(',')
  if (!base64) {
    throw new Error('Isi file tidak valid')
  }

  const mime = header.slice(5, header.indexOf(';'))
  const buffer = Buffer.from(base64, 'base64')

  if (buffer.length === 0) {
    throw new Error('File kosong')
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('Ukuran file melebihi 10 MB')
  }

  return { mime, buffer }
}

function safeExtension(fileName, mime) {
  const fromName = path.extname(fileName || '')
  if (fromName && /^\.[a-z0-9]{1,8}$/i.test(fromName)) {
    return fromName.toLowerCase()
  }
  const fallback = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }
  return fallback[mime] || '.bin'
}

export function storeUpload({ fsaId, fileName, mime, dataUrl }) {
  const { mime: parsedMime, buffer } = decodeDataUrl(dataUrl)
  const dir = path.join(getUploadsDir(), fsaId)
  fs.mkdirSync(dir, { recursive: true })

  const storedName = `${randomUUID()}${safeExtension(fileName, parsedMime)}`
  fs.writeFileSync(path.join(dir, storedName), buffer)

  return {
    fileName: (fileName || storedName).slice(0, 180),
    storedName,
    mime: parsedMime,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  }
}

export function removeFsaUploads(fsaId) {
  const dir = path.join(getUploadsDir(), fsaId)
  if (!fs.existsSync(dir)) {
    return
  }
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
  }
  fs.rmSync(dir, { recursive: true, force: true })
}

export function resolveUploadPath(fsaId, storedName) {
  const dir = path.join(getUploadsDir(), fsaId, path.basename(storedName))
  const resolved = path.resolve(dir)
  if (!resolved.startsWith(path.resolve(getUploadsDir()))) {
    return null
  }
  if (!fs.existsSync(resolved)) {
    return null
  }
  return resolved
}

export function findUploadByStoredName(storedName) {
  const root = getUploadsDir()
  if (!fs.existsSync(root)) {
    return null
  }

  for (const fsaId of fs.readdirSync(root)) {
    const candidate = path.join(root, fsaId, path.basename(storedName))
    if (fs.existsSync(candidate)) {
      return { fsaId, filePath: candidate }
    }
  }
  return null
}
