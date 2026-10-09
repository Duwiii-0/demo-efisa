import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import express from 'express'
import { buildNextNumber, createFsa, updateDecision, updateFsa, ValidationError } from './server/fsa.js'
import {
  APPROVAL_DECISIONS,
  APPROVAL_FUNCTIONS,
  DEMO_PASSWORD,
  FSA_REASONS,
  FSA_STATUSES,
  PART_CATEGORIES,
  FSA_LEVELS,
  ROLES,
  SUPPLIERS,
} from './server/seed.js'
import {
  createSessionAsync,
  destroySessionAsync,
  publicUser,
  resolveSessionUserAsync,
  verifyPassword,
} from './server/security.js'
import {
  downloadUpload,
  findUploadByStoredName,
  findUploadSupabase,
} from './server/uploads.js'
import { getSupabaseAdmin, UPLOADS_BUCKET } from './server/supabase.js'
import {
  findUserByEmail,
  findUserById,
  getAllUsers,
  getFsaById,
  isSupabaseEnabled,
  listFsas,
} from './server/store.js'

export const app = express()
const port = process.env.PORT || 4000
const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(rootDir, 'dist')

app.use(express.json({ limit: '40mb' }))

async function requireAuth(req, res, next) {
  try {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const userId = await resolveSessionUserAsync(token)
    const user = userId ? await findUserById(userId) : null

    if (!user) {
      res.status(401).json({ error: 'Sesi tidak valid, silakan login kembali' })
      return
    }

    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Anda tidak berwenang melakukan aksi ini' })
      return
    }
    next()
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'efisa',
    timestamp: new Date().toISOString(),
    storage: isSupabaseEnabled ? 'supabase' : 'local',
  })
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')

    const user = await findUserByEmail(email)

    if (!user || !verifyPassword(user, password)) {
      res.status(401).json({ error: 'Email atau password salah' })
      return
    }

    res.json({ token: await createSessionAsync(user.id), user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    await destroySessionAsync(token)
    res.json({ status: 'ok' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/demo-accounts', async (req, res, next) => {
  try {
    const users = await getAllUsers()
    res.json({
      password: DEMO_PASSWORD,
      users: users.map((user) => publicUser(user)),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/reference', requireAuth, async (req, res, next) => {
  try {
    const users = await getAllUsers()

    res.json({
      me: publicUser(req.user),
      roles: ROLES,
      users: users.map(publicUser),
      fsaStatuses: FSA_STATUSES,
      partCategories: PART_CATEGORIES,
      reasons: FSA_REASONS,
      ppapLevels: FSA_LEVELS,
      approvalDecisions: APPROVAL_DECISIONS,
      approvalFunctions: APPROVAL_FUNCTIONS,
      suppliers: SUPPLIERS,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/fsa/next-number', requireAuth, async (req, res, next) => {
  try {
    res.json({ fsaNumber: await buildNextNumber(), createdAt: new Date().toISOString() })
  } catch (error) {
    next(error)
  }
})

app.get('/api/fsa', requireAuth, async (req, res, next) => {
  try {
    const { status, supplierId, search } = req.query
    const items = await listFsas({
      status: status ? String(status) : undefined,
      supplierId: supplierId ? String(supplierId) : undefined,
      search: search ? String(search) : undefined,
    })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

app.post('/api/fsa', requireAuth, requireRole('procurement'), async (req, res, next) => {
  try {
    const fsa = await createFsa(req.body, req.user)
    res.status(201).json({ fsa })
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(422).json({ error: error.message, errors: error.errors })
      return
    }
    next(error)
  }
})

app.get('/api/fsa/:id', requireAuth, async (req, res, next) => {
  try {
    const fsa = await getFsaById(req.params.id)
    if (!fsa) {
      res.status(404).json({ error: 'FSA tidak ditemukan' })
      return
    }
    res.json({ fsa })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/fsa/:id', requireAuth, requireRole('procurement'), async (req, res, next) => {
  try {
    const fsa = await updateFsa(req.params.id, req.body, req.user)
    if (!fsa) {
      res.status(404).json({ error: 'FSA tidak ditemukan' })
      return
    }
    res.json({ fsa })
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(422).json({ error: error.message, errors: error.errors })
      return
    }
    if (error.status) {
      res.status(error.status).json({ error: error.message })
      return
    }
    next(error)
  }
})

app.patch('/api/fsa/:id/decision/:key', requireAuth, async (req, res, next) => {
  try {
    const fsa = await updateDecision(req.params.id, req.params.key, req.body, req.user)
    if (!fsa) {
      res.status(404).json({ error: 'FSA atau approval function tidak ditemukan' })
      return
    }
    res.json({ fsa })
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message, errors: error.errors ?? null })
      return
    }
    next(error)
  }
})

app.post('/api/uploads/sign', requireAuth, async (req, res, next) => {
  try {
    if (!isSupabaseEnabled) {
      res.status(400).json({ error: 'Direct upload hanya didukung saat Supabase aktif' })
      return
    }

    const fileName = String(req.body?.fileName ?? '').slice(0, 180)
    const mime = String(req.body?.mime ?? 'application/octet-stream')
    const fsaId = String(req.body?.fsaId ?? '')

    if (!fileName || !fsaId) {
      res.status(400).json({ error: 'fileName dan fsaId wajib diisi' })
      return
    }

    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
    const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'
    const storedName = `${crypto.randomUUID()}.${safeExt}`
    const path = `${fsaId}/${storedName}`

    const { data, error } = await getSupabaseAdmin()
      .storage.from(UPLOADS_BUCKET)
      .createSignedUploadUrl(path)

    if (error) {
      res.status(500).json({ error: `Gagal membuat upload URL: ${error.message}` })
      return
    }

    res.json({
      uploadUrl: data.signedUrl,
      storedName,
      path,
      fileName,
      mime,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/files/:storedName', requireAuth, async (req, res, next) => {
  try {
    if (isSupabaseEnabled) {
      const found = await findUploadSupabase(req.params.storedName)
      if (!found) {
        res.status(404).json({ error: 'File tidak ditemukan' })
        return
      }
      const buffer = await downloadUpload(found.objectPath)
      if (!buffer) {
        res.status(404).json({ error: 'File tidak ditemukan' })
        return
      }
      const ext = path.extname(found.objectPath).toLowerCase()
      const mimeByExt = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
      }
      res.setHeader('Content-Type', mimeByExt[ext] || 'application/octet-stream')
      res.setHeader('Content-Disposition', 'inline')
      res.send(buffer)
      return
    }

    const found = findUploadByStoredName(req.params.storedName)
    if (!found) {
      res.status(404).json({ error: 'File tidak ditemukan' })
      return
    }
    const ext = path.extname(found.filePath).toLowerCase()
    const mimeByExt = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
    }
    res.setHeader('Content-Type', mimeByExt[ext] || 'application/octet-stream')
    res.setHeader('Content-Disposition', 'inline')
    res.sendFile(found.filePath)
  } catch (error) {
    next(error)
  }
})

app.use(express.static(distDir))

app.get('/{*path}', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    next()
    return
  }

  res.sendFile(path.join(distDir, 'index.html'))
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Terjadi kesalahan server' })
})

// Jangan auto-listen di Vercel serverless (pakai export app).
// Jalankan manual hanya saat `node server.js` / `npm start` / `npm run dev`.
const isDirectRun =
  process.argv[1] && path.basename(process.argv[1]) === 'server.js' && !process.env.VERCEL

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port} [storage=${isSupabaseEnabled ? 'supabase' : 'local'}]`)
  })
}

export default app
