import { createClient } from '@supabase/supabase-js'
import { demoClient } from './demoDb'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Public demo mode: every record lives in the visitor's own browser (localStorage).
// Enabled at build time with VITE_DEMO_MODE=true.
export const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').trim() === 'true'

function isValidSupabaseUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

export const configurationError = demoMode
  ? ''
  : !url || !key
    ? 'Не заданы параметры подключения Supabase'
    : !isValidSupabaseUrl(url)
      ? 'VITE_SUPABASE_URL содержит некорректный адрес'
      : ''

export const configured = demoMode || !configurationError
export const supabase = demoMode
  ? demoClient
  : configured
    ? createClient(url.trim(), key.trim(), { auth: { persistSession: true, autoRefreshToken: true } })
    : null
