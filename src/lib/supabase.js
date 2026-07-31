import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

function isValidSupabaseUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

export const configurationError = !url || !key
  ? 'Не заданы параметры подключения Supabase'
  : !isValidSupabaseUrl(url)
    ? 'VITE_SUPABASE_URL содержит некорректный адрес'
    : ''

export const configured = !configurationError
export const supabase = configured
  ? createClient(url.trim(), key.trim(), { auth: { persistSession: true, autoRefreshToken: true } })
  : null
