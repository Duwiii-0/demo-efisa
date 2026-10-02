import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getUploadsDir } from './db.js'
import { UPLOADS_BUCKET, getSupabaseAdmin, isSupabaseEnabled } from './supabase.js'

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

export async function storeUpload({ fsaId, fileName, mime, dataUrl }) {
  const { mime: parsedMime, buffer } = decodeDataUrl(dataUrl)
  const storedName = `${randomUUID()}${safeExtension(fileName, parsedMime)}`
  const meta = {
    fileName: (fileName || storedName).slice(0, 180),
    storedName,
    mime: parsedMime,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  }

  if (!isSupabaseEnabled) {
    const dir = path.join(getUploadsDir(), fsaId)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, storedName), buffer)
    return meta
  }

  const objectPath = `${fsaId}/${storedName}`
  const { error } = await getSupabaseAdmin()
    .storage.from(UPLOADS_BUCKET)
    .upload(objectPath, buffer, { contentType: parsedMime, upsert: false })
  if (error) throw new Error(`Gagal upload ke Supabase Storage: ${error.message}`)
  return meta
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
  if (isSupabaseEnabled) return null // file diambil via downloadUpload() dari Storage
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
  if (isSupabaseEnabled) return null // gunakan findUploadSupabase() yang async
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

// Cari file di Supabase Storage (scan prefix per FSA via list).
// Dipakai oleh GET /api/files/:storedName saat Supabase aktif.
export async function findUploadSupabase(storedName) {
  const supa = getSupabaseAdmin()
  const safe = path.basename(storedName)

  // List folder root untuk dapat daftar fsaId (maks 1000, cukup untuk demo)
  const { data: folders, error: listErr } = await supa.storage.from(UPLOADS_BUCKET).list('', { limit: 1000 })
  if (listErr) return null

  for (const folder of folders ?? []) {
    if (!folder.name) continue
    const { data: files } = await supa.storage.from(UPLOADS_BUCKET).list(folder.name, { limit: 1000 })
    if ((files ?? []).some((f) => f.name === safe)) {
      return { fsaId: folder.name, objectPath: `${folder.name}/${safe}` }
    }
  }
  return null
}

export async function downloadUpload(objectPath) {
  const { data, error } = await getSupabaseAdmin().storage.from(UPLOADS_BUCKET).download(objectPath)
  if (error) return null
  return Buffer.from(await data.arrayBuffer())
}
