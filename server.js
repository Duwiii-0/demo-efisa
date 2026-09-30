import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { getDb } from './server/db.js'
import { buildNextNumber, createFsa, updateDecision, ValidationError } from './server/fsa.js'
import {
  APPROVAL_DECISIONS,
  APPROVAL_FUNCTIONS,
  CHECKLIST_STATUSES,
  DEMO_PASSWORD,
  FSA_REASONS,
  FSA_STATUSES,
  PART_CATEGORIES,
  PPAP_LEVELS,
  ROLES,
  SUPPLIERS,
} from './server/seed.js'
import { createSession, destroySession, publicUser, resolveSessionUser, verifyPassword } from './server/security.js'
import { findUploadByStoredName } from './server/uploads.js'

const app = express()
const port = process.env.PORT || 4000
const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(rootDir, 'dist')

app.use(express.json({ limit: '40mb' }))

function findUser(userId) {
  return getDb().users.find((user) => user.id === userId) ?? null
}

function requireAuth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const userId = resolveSessionUser(token)
  const user = findUser(userId)

  if (!user) {
    res.status(401).json({ error: 'Sesi tidak valid, silakan login kembali' })
    return
  }

  req.user = user
  next()
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
  res.json({ status: 'ok', name: 'efisa', timestamp: new Date().toISOString() })
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  const user = getDb().users.find((item) => item.email.toLowerCase() === email)

  if (!user || !verifyPassword(user, password)) {
    res.status(401).json({ error: 'Email atau password salah' })
    return
  }

  res.json({ token: createSession(user.id), user: publicUser(user) })
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  destroySession(token)
  res.json({ status: 'ok' })
})

app.get('/api/auth/demo-accounts', (req, res) => {
  res.json({
    password: DEMO_PASSWORD,
    users: getDb().users.map((user) => publicUser(user)),
  })
})

app.get('/api/reference', requireAuth, (req, res) => {
  const users = getDb().users.map(publicUser)

  res.json({
    me: publicUser(req.user),
    roles: ROLES,
    users,
    fsaStatuses: FSA_STATUSES,
    partCategories: PART_CATEGORIES,
    reasons: FSA_REASONS,
    ppapLevels: PPAP_LEVELS,
    checklistStatuses: CHECKLIST_STATUSES,
    approvalDecisions: APPROVAL_DECISIONS,
    approvalFunctions: APPROVAL_FUNCTIONS,
    suppliers: SUPPLIERS,
  })
})

app.get('/api/fsa/next-number', requireAuth, (req, res) => {
  res.json({ fsaNumber: buildNextNumber(), createdAt: new Date().toISOString() })
})

app.get('/api/fsa', requireAuth, (req, res) => {
  const { status, supplierId, search } = req.query
  const keyword = String(search ?? '').trim().toLowerCase()

  const items = getDb()
    .fsas.filter((fsa) => {
      if (status && fsa.approvalStatus !== status) {
        return false
      }
      if (supplierId && fsa.supplierId !== supplierId) {
        return false
      }
      if (keyword) {
        const haystack = `${fsa.fsaNumber} ${fsa.partNumber} ${fsa.materialDescription}`.toLowerCase()
        if (!haystack.includes(keyword)) {
          return false
        }
      }
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  res.json({ items, total: items.length })
})

app.post('/api/fsa', requireAuth, requireRole('procurement'), (req, res) => {
  try {
    const fsa = createFsa(req.body, req.user)
    res.status(201).json({ fsa })
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(422).json({ error: error.message, errors: error.errors })
      return
    }
    throw error
  }
})

app.get('/api/fsa/:id', requireAuth, (req, res) => {
  const fsa = getDb().fsas.find((item) => item.id === req.params.id)
  if (!fsa) {
    res.status(404).json({ error: 'FSA tidak ditemukan' })
    return
  }
  res.json({ fsa })
})

app.patch('/api/fsa/:id/decision/:key', requireAuth, (req, res) => {
  try {
    const fsa = updateDecision(req.params.id, req.params.key, req.body, req.user)
    if (!fsa) {
      res.status(404).json({ error: 'FSA atau approval function tidak ditemukan' })
      return
    }
    res.json({ fsa })
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message })
      return
    }
    throw error
  }
})

app.get('/api/files/:storedName', requireAuth, (req, res) => {
  const found = findUploadByStoredName(req.params.storedName)
  if (!found) {
    res.status(404).json({ error: 'File tidak ditemukan' })
    return
  }
  res.download(found.filePath)
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

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`)
})
