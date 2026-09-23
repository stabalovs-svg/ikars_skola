// In-browser stand-in for the Supabase client, used by the public demo.
// It implements the small subset of the Supabase API the CRM relies on,
// backed by localStorage. Nothing leaves the visitor's browser.

import {
  demoSettings, demoProfiles, demoInstructors,
  demoStudents, demoPayments, demoEvents,
} from './demoSeed.js'

const DB_KEY = 'ikars-demo-db-v1'
const SESSION_KEY = 'ikars-demo-session-v1'

function seedDb() {
  return {
    app_settings: [{ ...demoSettings }],
    profiles: demoProfiles.map((row) => ({ ...row })),
    instructors: demoInstructors.map((row) => ({ ...row })),
    students: demoStudents.map((row) => ({ ...row })),
    payments: demoPayments.map((row) => ({ ...row })),
    event_log: demoEvents.map((row) => ({ ...row })),
    sequences: { students: 11, payments: 17, event_log: 8, instructors: 3, app_settings: 1 },
  }
}

function saveDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ }
}

let db = null

function getDb() {
  if (db) return db
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) { db = JSON.parse(raw); return db }
  } catch { /* ignore corrupt payload */ }
  db = seedDb()
  saveDb(db)
  return db
}

export function resetDemoDb() {
  db = seedDb()
  saveDb(db)
  return db
}

function project(row, cols) {
  if (!cols || cols === '*') return { ...row }
  const out = {}
  for (const field of String(cols).split(',').map((s) => s.trim()).filter(Boolean)) {
    if (field in row) out[field] = row[field]
  }
  return out
}

class DemoQuery {
  constructor(table) {
    this.table = table
    this.op = 'select'
    this.filters = []
    this.payload = null
    this.projection = null
    this.ordering = null
    this.limitN = null
    this.singleMode = null
    this.wantSelect = false
  }

  select(cols) {
    this.wantSelect = true
    if (this.op === 'select') this.projection = cols
    else this.projection = cols || null
    return this
  }
  insert(payload) { this.op = 'insert'; this.payload = payload; return this }
  update(patch) { this.op = 'update'; this.payload = patch; return this }
  delete() { this.op = 'delete'; return this }
  eq(col, val) { this.filters.push({ type: 'eq', col, val }); return this }
  is(col, val) { this.filters.push({ type: 'is', col, val }); return this }
  in(col, vals) { this.filters.push({ type: 'in', col, vals }); return this }
  order(col, options = {}) { this.ordering = { col, ascending: options.ascending !== false }; return this }
  limit(n) { this.limitN = n; return this }
  single() { this.singleMode = 'single'; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }

  matches(row) {
    return this.filters.every((filter) => {
      if (filter.type === 'eq') return row[filter.col] === filter.val
      if (filter.type === 'in') return (filter.vals || []).includes(row[filter.col])
      if (filter.type === 'is') {
        const value = row[filter.col]
        return filter.val === null ? value === null || value === undefined : value === filter.val
      }
      return true
    })
  }

  finish(data) {
    if (this.singleMode === 'single') {
      if (!data || data.length !== 1) return { data: null, error: new Error('Row not found') }
      return { data: data[0], error: null }
    }
    if (this.singleMode === 'maybe') return { data: data && data.length ? data[0] : null, error: null }
    return { data, error: null }
  }

  nextId(key) {
    const store = getDb().sequences
    store[key] = (store[key] || 0) + 1
    return store[key]
  }

  async run() {
    const store = getDb()
    const list = store[this.table] || (store[this.table] = [])

    if (this.op === 'select') {
      let rows = list.filter((row) => this.matches(row))
      if (this.ordering) {
        const { col, ascending } = this.ordering
        rows = [...rows].sort((a, b) => {
          const av = a[col]; const bv = b[col]
          if (av === bv) return 0
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1)
        })
      }
      if (this.limitN != null) rows = rows.slice(0, this.limitN)
      return this.finish(rows.map((row) => project(row, this.projection)))
    }

    if (this.op === 'insert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = incoming.map((row) => {
        const record = { created_at: new Date().toISOString(), ...row }
        if (record.id === undefined || record.id === null) record.id = this.nextId(this.table)
        list.push(record)
        return record
      })
      saveDb(store)
      return this.finish(this.wantSelect ? inserted.map((r) => project(r, this.projection)) : null)
    }

    if (this.op === 'update') {
      const updated = []
      for (const row of list) if (this.matches(row)) { Object.assign(row, this.payload); updated.push(row) }
      saveDb(store)
      return this.finish(this.wantSelect ? updated.map((r) => project(r, this.projection)) : null)
    }

    if (this.op === 'delete') {
      const removed = []
      store[this.table] = list.filter((row) => {
        if (this.matches(row)) { removed.push(row); return false }
        return true
      })
      saveDb(store)
      return this.finish(this.wantSelect ? removed.map((r) => project(r, this.projection)) : null)
    }

    return { data: null, error: null }
  }

  then(resolve, reject) {
    return this.run().then(resolve, reject)
  }
}

// ---------------------------------------------------------------- auth

const listeners = []

function readSession() {
  try {
    // The demo session lives in sessionStorage, so every new visit starts on the
    // sign-in screen while a page reload keeps the current role. Records stay in
    // localStorage so the visitor's edits survive until they reset the demo.
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
    localStorage.removeItem(SESSION_KEY)
    return null
  } catch { return null }
}

let currentSession = readSession()

function emit() {
  for (const callback of listeners) {
    try { callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession) } catch { /* ignore subscriber error */ }
  }
}

function setSession(session) {
  currentSession = session
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
  emit()
}

export function demoAccounts() {
  return demoProfiles.map((profile) => ({ ...profile, email: demoEmail(profile.id) }))
}

export function demoEmail(profileId) {
  return `${String(profileId).replace('demo-', '')}@demo.lv`
}

const auth = {
  async getSession() {
    return { data: { session: currentSession }, error: null }
  },
  async signInWithPassword({ email } = {}) {
    const key = String(email || '').trim().toLowerCase()
    const profile = demoProfiles.find((item) => demoEmail(item.id) === key)
    if (!profile) {
      return { data: { session: null }, error: new Error('Unknown demo account. Pick one of the roles below.') }
    }
    setSession({ user: { id: profile.id, email: key } })
    return { data: { session: currentSession }, error: null }
  },
  async signInAs(role) {
    const profile = demoProfiles.find((item) => item.role === role) || demoProfiles[0]
    setSession({ user: { id: profile.id, email: demoEmail(profile.id) } })
    return { data: { session: currentSession }, error: null }
  },
  async signOut() {
    setSession(null)
    return { error: null }
  },
  onAuthStateChange(callback) {
    listeners.push(callback)
    return {
      data: {
        subscription: {
          unsubscribe() {
            const index = listeners.indexOf(callback)
            if (index >= 0) listeners.splice(index, 1)
          },
        },
      },
    }
  },
}

// ---------------------------------------------------------------- rpc

function appendEvent(store, entry) {
  const id = (store.sequences.event_log = (store.sequences.event_log || 0) + 1)
  store.event_log.push({ id, user_id: currentSession?.user?.id || null, created_at: new Date().toISOString(), ...entry })
}

async function rpc(name, args = {}) {
  const store = getDb()

  if (name === 'add_payment_with_audit') {
    const student = (store.students || []).find((row) => String(row.id) === String(args.p_student_id))
    if (!student) return { data: null, error: new Error('Student not found') }
    const amount = Number(args.p_amount)
    if (!(amount > 0)) return { data: null, error: new Error('Payment amount must be greater than zero') }
    const id = (store.sequences.payments = (store.sequences.payments || 0) + 1)
    const payment = {
      id,
      student_id: student.id,
      payment_date: args.p_payment_date,
      purpose: args.p_purpose,
      amount,
      payment_method: args.p_payment_method,
    }
    store.payments.push(payment)
    appendEvent(store, {
      student_id: student.id, event_type: 'payment_added', old_value: '',
      new_value: String(amount), description: 'Payment added', metadata: { payment_id: String(id) },
    })
    saveDb(store)
    return { data: payment, error: null }
  }

  if (name === 'delete_payment_with_audit') {
    const index = (store.payments || []).findIndex((row) => String(row.id) === String(args.p_payment_id))
    if (index < 0) return { data: null, error: new Error('Payment not found') }
    const [payment] = store.payments.splice(index, 1)
    appendEvent(store, {
      student_id: payment.student_id, event_type: 'payment_deleted', old_value: String(payment.amount),
      new_value: '', description: 'Incorrect payment deleted',
      metadata: { payment_id: String(payment.id), reason: args.p_reason },
    })
    saveDb(store)
    return { data: payment, error: null }
  }

  return { data: null, error: new Error(`Unknown demo function: ${name}`) }
}

// ---------------------------------------------------------------- client

export const demoClient = {
  from(table) { return new DemoQuery(table) },
  rpc,
  auth,
}

