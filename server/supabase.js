import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anonKey = process.env.SUPABASE_ANON_KEY ?? serviceKey

export const isSupabaseEnabled = Boolean(url && (serviceKey || anonKey))

// Client dengan hak penuh ( Dipakai backend saja. JANGAN expose ke frontend).
// Prioritas: SERVICE_ROLE_KEY (bisa bypass RLS storage + insert sessions).
let adminClient = null
export function getSupabaseAdmin() {
  if (!isSupabaseEnabled) return null
  if (!adminClient) {
    adminClient = createClient(url, serviceKey || anonKey, {
      auth: { persistSession: false },
    })
  }
  return adminClient
}

export const UPLOADS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET ?? 'efisa-uploads'
