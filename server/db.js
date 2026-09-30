import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { SAMPLE_FSAS, USERS } from './seed.js'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dataDir = path.join(rootDir, 'server', 'data')
const dbFile = path.join(dataDir, 'db.json')
const uploadsDir = path.join(rootDir, 'server', 'uploads')

let state = null

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(uploadsDir, { recursive: true })
}

function initialState() {
  return {
    version: 1,
    users: USERS,
    fsas: SAMPLE_FSAS.map((fsa) => ({
      id: randomUUID(),
      ...fsa,
      createdById: fsa.createdById,
      history: [
        { at: fsa.createdAt, byId: fsa.createdById, action: 'created', note: 'FSA dibuat' },
      ],
    })),
  }
}

function load() {
  ensureDirs()

  if (!fs.existsSync(dbFile)) {
    const seeded = initialState()
    fs.writeFileSync(dbFile, `${JSON.stringify(seeded, null, 2)}\n`)
    return seeded
  }

  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'))
  } catch {
    const seeded = initialState()
    fs.writeFileSync(dbFile, `${JSON.stringify(seeded, null, 2)}\n`)
    return seeded
  }
}

export function getDb() {
  if (!state) {
    state = load()
  }
  return state
}

export function saveDb() {
  ensureDirs()
  fs.writeFileSync(dbFile, `${JSON.stringify(getDb(), null, 2)}\n`)
}

export function resetDb() {
  const uploads = getUploadsDir()
  if (fs.existsSync(uploads)) {
    fs.rmSync(uploads, { recursive: true, force: true })
  }
  state = initialState()
  saveDb()
  return state
}

export function getUploadsDir() {
  ensureDirs()
  return uploadsDir
}
