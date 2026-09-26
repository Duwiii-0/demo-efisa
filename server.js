import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const app = express()
const port = process.env.PORT || 4000
const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(rootDir, 'dist')

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'demo-efisa', timestamp: new Date().toISOString() })
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
