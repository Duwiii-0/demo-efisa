import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin, isSupabaseEnabled } from './supabase.js'

const SESSIONS = new Map()

export function hashPassword(email, password) {
  return createHash('sha256').update(`${email.toLowerCase()}|${password}`).digest('hex')
}

export function verifyPassword(user, password) {
  const expected = Buffer.from(user.passwordHash, 'hex')
  const actual = Buffer.from(hashPassword(user.email, password), 'hex')
  if (expected.length !== actual.length) {
    return false
  }
  return timingSafeEqual(expected, actual)
}

export function publicUser(user) {
  if (!user) {
    return null
  }
  const { passwordHash, ...rest } = user
  return rest
}

export function createSession(userId) {
  const token = randomUUID()
  SESSIONS.set(token, { userId, createdAt: new Date().toISOString() })
  return token
}

export function resolveSessionUser(token) {
  if (!token) {
    return null
  }
  return SESSIONS.get(token)?.userId ?? null
}

export function destroySession(token) {
  SESSIONS.delete(token)
}

// Versi async: pakai tabel public.sessions saat Supabase aktif
// (wajib untuk Vercel serverless karena Map in-memory hilang antar request).
const SESSION_TTL_DAYS = 7

export async function createSessionAsync(userId) {
  if (!isSupabaseEnabled) return createSession(userId)
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await getSupabaseAdmin()
    .from('sessions')
    .insert({ token, user_id: userId, expires_at: expiresAt })
  if (error) throw error
  return token
}

export async function resolveSessionUserAsync(token) {
  if (!token) return null
  if (!isSupabaseEnabled) return resolveSessionUser(token)
  const { data } = await getSupabaseAdmin()
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await destroySessionAsync(token)
    return null
  }
  return data.user_id
}

export async function destroySessionAsync(token) {
  if (!isSupabaseEnabled) return destroySession(token)
  await getSupabaseAdmin().from('sessions').delete().eq('token', token)
}
