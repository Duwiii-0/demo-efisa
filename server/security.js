import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

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
