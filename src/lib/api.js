const TOKEN_KEY = 'efisa.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message)
    this.status = status
    this.errors = errors ?? null
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  const token = getToken()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(payload?.error ?? 'Permintaan gagal', response.status, payload?.errors)
  }

  return payload
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  demoAccounts: () => request('/api/auth/demo-accounts'),
  reference: () => request('/api/reference'),
  nextNumber: () => request('/api/fsa/next-number'),
  listFsas: (params) => request(`/api/fsa?${new URLSearchParams(params)}`),
  getFsa: (id) => request(`/api/fsa/${id}`),
  createFsa: (payload) => request('/api/fsa', { method: 'POST', body: payload }),
  updateFsa: (id, payload) => request(`/api/fsa/${id}`, { method: 'PATCH', body: payload }),
  updateDecision: (id, key, payload) => request(`/api/fsa/${id}/decision/${key}`, { method: 'PATCH', body: payload }),
  downloadUrl: (storedName) => `/api/files/${storedName}`,
  signUpload: (fileName, mime, fsaId) =>
    request('/api/uploads/sign', { method: 'POST', body: { fileName, mime, fsaId } }),
}

export async function uploadToStorage(file, fsaId) {
  const { uploadUrl, storedName, fileName, mime } = await api.signUpload(file.name, file.type, fsaId)

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Gagal mengunggah file ke storage')
  }

  return {
    fileName,
    storedName,
    mime,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

export async function downloadFile(file) {
  const response = await fetch(api.downloadUrl(file.storedName), {
    headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!response.ok) {
    throw new ApiError('Gagal mengunduh file', response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.fileName || 'file'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
