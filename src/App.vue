<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { configured, configurationError, demoMode, supabase } from './lib/supabase'
import { resetDemoDb } from './lib/demoDb'
import logoUrl from './assets/ikars-logo.svg'
import { paymentLabels, statusLabels, translate } from './lib/i18n'
import DirectorDashboard from './components/DirectorDashboard.vue'
import {
  PAYMENT_METHODS, PAYMENT_PURPOSES, ROLES, STATUSES, automaticArchiveReason,
  canAddPayment, canDeletePayment, canEditSettings, canManage, canSeeEvents, daysUntil, deadline, trainingDeadline,
  formatDate as formatDateValue, formatMoney as formatMoneyValue, normalizeStatus, paymentSummary,
} from './lib/crm'

const session = ref(null)
const profile = ref(null)
const currentInstructor = ref(null)
const students = ref([])
const instructors = ref([])
const payments = ref([])
const events = ref([])
const profiles = ref([])
const settings = reactive({ id: 1, school_name: 'GoDrive', product_name: 'AutoSchool CRM', language: 'en', tagline: 'Driving school management' })
const login = reactive({ email: '', password: '' })
const search = ref('')
const archived = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const modal = ref('')
const insightType = ref('')
const selected = reactive({})
const paymentForm = reactive({ payment_date: new Date().toISOString().slice(0, 10), purpose: 'Теория', amount: '', payment_method: 'Наличные' })
const eventFilters = reactive({ period: 'all', user: '', type: '', search: '' })
const sort = reactive({ field: 'full_name', direction: 1 })

const role = computed(() => profile.value?.role || '')
const locale = computed(() => ['ru', 'lv', 'en'].includes(settings.language) ? settings.language : 'ru')
const intlLocale = computed(() => ({ ru: 'ru-RU', lv: 'lv-LV', en: 'en-GB' })[locale.value])
const t = (key) => translate(locale.value, key)
const statusText = (value) => statusLabels[locale.value]?.[normalizeStatus(value)] || value || '—'
const paymentText = (value) => paymentLabels[locale.value]?.[value] || value
const formatDate = (value, withTime = false) => formatDateValue(value, withTime, intlLocale.value)
const formatMoney = (value) => formatMoneyValue(value, intlLocale.value)
const mayManage = computed(() => canManage(role.value))
const mayPay = computed(() => canAddPayment(role.value))
const mayDeletePayment = computed(() => canDeletePayment(role.value))
const instructorName = (id) => instructors.value.find((item) => item.id === id)?.full_name || t('notAssigned')
const studentPayments = computed(() => payments.value.filter((p) => p.student_id === selected.id))
const selectedSummary = computed(() => paymentSummary(selected, payments.value))
const isAccountant = computed(() => role.value === ROLES.ACCOUNTANT)
const isDirector = computed(() => role.value === ROLES.DIRECTOR)
const isInstructorRole = computed(() => role.value === ROLES.INSTRUCTOR)
const selectedIsMine = computed(() => Boolean(selected.id && currentInstructor.value && selected.instructor_id === currentInstructor.value.id))
const selectedIsUnassigned = computed(() => Boolean(selected.id && !selected.instructor_id))
const selectedCanSendToExam = computed(() => selectedIsMine.value && normalizeStatus(selected.status) === 'вождение')
const financeDashboard = computed(() => {
  const summaries = students.value.filter((student) => !student.archived).map((student) => paymentSummary(student, payments.value))
  return {
    received: payments.value.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    outstanding: summaries.reduce((sum, item) => sum + item.left, 0),
    extras: summaries.reduce((sum, item) => sum + item.extra, 0),
    count: payments.value.length,
  }
})

const visibleStudents = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('ru')
  return students.value
    .filter((student) => Boolean(student.archived) === archived.value)
    .filter((student) => !needle || [student.full_name, student.phone, student.email, student.contract_number]
      .some((value) => String(value || '').toLocaleLowerCase('ru').includes(needle)))
    .sort((a, b) => {
      const av = a[sort.field] || ''
      const bv = b[sort.field] || ''
      return String(av).localeCompare(String(bv), 'ru', { numeric: true }) * sort.direction
    })
})

function nextBirthday(student) {
  if (!student.birth_date) return null
  const birth = new Date(`${student.birth_date}T12:00:00`)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const date = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
  if (date < today) date.setFullYear(date.getFullYear() + 1)
  return { date, days: Math.round((date - today) / 86400000) }
}

const activeStudents = computed(() => students.value.filter((s) => !s.archived))
const upcomingBirthdays = computed(() => activeStudents.value
  .map((student) => ({ student, ...nextBirthday(student) }))
  .filter((item) => item.date && item.days <= 14)
  .sort((a, b) => a.date - b.date))
const attentionStudents = computed(() => activeStudents.value
  .map((student) => {
    const studyDate = trainingDeadline(student)
    const contractDate = deadline(student)
    const studyDays = daysUntil(studyDate)
    const contractDays = daysUntil(contractDate)
    const alerts = []
    if (studyDays !== null && studyDays <= 30) alerts.push({ type: 'training', date: studyDate, days: studyDays })
    if (contractDays !== null && contractDays <= 5) alerts.push({ type: 'contract', date: contractDate, days: contractDays })
    if (automaticArchiveReason(student) === 'completed') alerts.push({ type: 'completed', date: null, days: 0 })
    return { student, alerts }
  })
  .filter((item) => item.alerts.length)
  .sort((a, b) => Math.min(...a.alerts.map((alert) => alert.days)) - Math.min(...b.alerts.map((alert) => alert.days))))

const dashboard = computed(() => {
  const active = activeStudents.value
  return {
    total: active.length,
    theory: active.filter((s) => normalizeStatus(s.status).includes('теория')).length,
    practice: active.filter((s) => normalizeStatus(s.status).includes('вождение')).length,
    attention: attentionStudents.value.length,
    birthdays: upcomingBirthdays.value.length,
  }
})

const filteredEvents = computed(() => events.value.filter((event) => {
  const created = new Date(event.created_at)
  const age = (Date.now() - created.getTime()) / 86400000
  if (eventFilters.period === 'today' && (age >= 1 || created.getDate() !== new Date().getDate())) return false
  if (eventFilters.period === '7days' && age > 7) return false
  if (eventFilters.period === '30days' && age > 30) return false
  if (eventFilters.user && event.user_id !== eventFilters.user) return false
  if (eventFilters.type && event.event_type !== eventFilters.type) return false
  const needle = eventFilters.search.toLocaleLowerCase('ru')
  const student = students.value.find((s) => s.id === event.student_id)?.full_name || ''
  const author = profiles.value.find((p) => p.id === event.user_id)?.full_name || ''
  return !needle || `${student} ${author} ${event.description || ''} ${event.event_type}`.toLocaleLowerCase('ru').includes(needle)
}))

function flash(message, isError = false) {
  if (isError) error.value = message
  else notice.value = message
  window.setTimeout(() => { error.value = ''; notice.value = '' }, 4500)
}

async function signIn() {
  if (!configured) return flash(configurationError, true)
  loading.value = true
  const { error: authError } = await supabase.auth.signInWithPassword(login)
  loading.value = false
  if (authError) flash(authError.message, true)
}

async function signOut() {
  await supabase.auth.signOut()
  session.value = null
}

const demoRoles = demoMode
  ? [
      { role: ROLES.DIRECTOR, label: 'Director' },
      { role: ROLES.ADMIN, label: 'Administrator' },
      { role: ROLES.ACCOUNTANT, label: 'Accountant' },
      { role: ROLES.INSTRUCTOR, label: 'Instructor' },
    ]
  : []

async function signInAs(role) {
  loading.value = true
  const { error: authError } = await supabase.auth.signInAs(role)
  loading.value = false
  if (authError) flash(authError.message, true)
}

function resetDemo() {
  resetDemoDb()
  window.location.reload()
}

async function loadProfile(userId) {
  const { data, error: loadError } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (loadError) throw loadError
  profile.value = data
  if (data.role === ROLES.INSTRUCTOR) {
    const { data: instructor } = await supabase.from('instructors').select('*').eq('auth_user_id', userId).maybeSingle()
    currentInstructor.value = instructor
  }
}

async function refresh() {
  if (!session.value) return
  loading.value = true
  try {
    let studentQuery = role.value === ROLES.ACCOUNTANT
      ? supabase.from('students').select('id, full_name, contract_number, course_price, archived')
      : role.value === ROLES.DIRECTOR
        ? supabase.from('students').select('id, full_name, contract_number, category, instructor_id, status, course_price, archived')
      : role.value === ROLES.INSTRUCTOR
        ? supabase.from('students').select('id, full_name, phone, email, contract_number, category, instructor_id, birth_date, status, notes, contract_date, contract_duration_months, theory_start_date, archived, archive_reason')
        : supabase.from('students').select('*')
    if (role.value === ROLES.INSTRUCTOR) {
      if (!currentInstructor.value) {
        studentQuery = Promise.resolve({ data: [], error: null })
        flash(t('instructorMissing'), true)
      } else {
        studentQuery = studentQuery.or(`instructor_id.is.null,instructor_id.eq.${currentInstructor.value.id}`)
      }
    }
    const [studentResult, instructorResult, paymentResult, eventResult, profileResult, settingsResult] = await Promise.all([
      studentQuery,
      supabase.from('instructors').select('*').order('full_name'),
      role.value === ROLES.INSTRUCTOR ? Promise.resolve({ data: [], error: null }) : supabase.from('payments').select('*').order('payment_date'),
      canSeeEvents(role.value) ? supabase.from('event_log').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      canSeeEvents(role.value) ? supabase.from('profiles').select('id, full_name') : Promise.resolve({ data: [] }),
      supabase.from('app_settings').select('*').order('id').limit(1).maybeSingle(),
    ])
    const failed = [studentResult, instructorResult, paymentResult].find((result) => result.error)
    if (failed) throw failed.error
    students.value = studentResult.data || []
    instructors.value = instructorResult.data || []
    payments.value = paymentResult.data || []
    events.value = eventResult.data || []
    profiles.value = profileResult.data || []
    if (settingsResult.data) Object.assign(settings, settingsResult.data)
  } catch (e) {
    flash(e.message, true)
  } finally {
    loading.value = false
  }
}

function blankStudent() {
  Object.keys(selected).forEach((key) => delete selected[key])
  Object.assign(selected, {
    full_name: '', phone: '', email: '', contract_number: '', category: 'B',
    instructor_id: null, birth_date: null, status: 'оформление', notes: '',
    contract_date: null, contract_duration_months: 18, course_price: null, archived: false,
  })
}

async function openStudent(student = null) {
  if (student) Object.assign(selected, JSON.parse(JSON.stringify(student)))
  else blankStudent()
  modal.value = 'student'
}

async function addEvent(eventType, studentId, oldValue = '', newValue = '', description = '', metadata = null) {
  if (!session.value) return
  const payload = { user_id: session.value.user.id, student_id: studentId, event_type: eventType, old_value: oldValue || '', new_value: newValue || '', description, metadata }
  const { error: eventError } = await supabase.from('event_log').insert(payload)
  if (eventError) throw eventError
}

async function saveStudent() {
  const payload = {
    full_name: selected.full_name?.trim(), phone: selected.phone || null, email: selected.email || null,
    contract_number: selected.contract_number || null, category: selected.category || null,
    instructor_id: selected.instructor_id || null, birth_date: selected.birth_date || null,
    status: normalizeStatus(selected.status), notes: selected.notes || null, contract_date: selected.contract_date || null,
    contract_duration_months: selected.contract_duration_months || null, course_price: selected.course_price || null,
  }
  if (!payload.full_name) return flash(t('requiredName'), true)
  loading.value = true
  try {
    if (selected.id) {
      const old = students.value.find((s) => s.id === selected.id)
      const pendingEvents = []
      if (normalizeStatus(old?.status) !== payload.status) {
        pendingEvents.push(['status_changed', old?.status, payload.status, 'Изменён статус'])
        if (normalizeStatus(old?.status) === 'оформление' && payload.status === 'теория' && !old.theory_start_date) payload.theory_start_date = new Date().toISOString().slice(0, 10)
        if (payload.status === 'вождение сдано' && !old.completed_at) payload.completed_at = new Date().toISOString().slice(0, 10)
      }
      if (old?.instructor_id !== payload.instructor_id) pendingEvents.push(['instructor_changed', old?.instructor_id, payload.instructor_id, 'Изменён инструктор'])
      if (old?.contract_number !== payload.contract_number) pendingEvents.push(['contract_changed', old?.contract_number, payload.contract_number, 'Изменён договор'])
      for (const field of ['phone', 'email', 'notes']) {
        if ((old?.[field] || '') !== (payload[field] || '')) pendingEvents.push(['student_updated', old?.[field], payload[field], `Изменено поле ${field}`, { field }])
      }
      const { error: updateError } = await supabase.from('students').update(payload).eq('id', selected.id)
      if (updateError) throw updateError
      const eventResults = await Promise.allSettled(pendingEvents.map(([type, oldValue, newValue, description, metadata]) =>
        addEvent(type, selected.id, oldValue, newValue, description, metadata)))
      if (eventResults.some((result) => result.status === 'rejected')) {
        flash(t('auditPartial'), true)
      }
    } else {
      const { data, error: insertError } = await supabase.from('students').insert(payload).select().single()
      if (insertError) throw insertError
      await addEvent('student_created', data.id, '', data.full_name, 'Создан ученик')
    }
    modal.value = ''
    await refresh()
    flash(t('saved'))
  } catch (e) {
    flash(e.message, true)
  } finally {
    loading.value = false
  }
}

async function setArchive(student, value, reason = 'manual', refreshAfter = true) {
  if (!mayManage.value) return
  const update = value
    ? { archived: true, archived_at: new Date().toISOString(), archive_reason: reason }
    : { archived: false, archived_at: null, archive_reason: null }
  const { error: updateError } = await supabase.from('students').update(update).eq('id', student.id)
  if (updateError) return flash(updateError.message, true)
  try {
    await addEvent(value ? 'student_archived' : 'student_restored', student.id, value ? 'active' : 'archived', value ? 'archived' : 'active', value ? `Причина: ${reason}` : 'Восстановлен', value ? { reason } : null)
  } catch (eventError) {
    console.error('Не удалось записать событие архива:', eventError)
  }
  modal.value = ''
  if (refreshAfter) await refresh()
  return true
}

async function autoArchive() {
  const candidates = students.value.filter((s) => !s.archived).map((s) => ({ student: s, reason: automaticArchiveReason(s) })).filter((x) => x.reason)
  if (!candidates.length) return flash(t('noArchiveCandidates'))
  const results = await Promise.allSettled(candidates.map((item) => setArchive(item.student, true, item.reason, false)))
  await refresh()
  const completed = results.filter((result) => result.status === 'fulfilled' && result.value).length
  const failed = candidates.length - completed
  flash(failed ? `${t('archived')}: ${completed}. ${t('errors')}: ${failed}` : `${t('movedArchive')}: ${completed}`, failed > 0)
}

async function addPayment() {
  if (!selected.id || !paymentForm.amount || !paymentForm.payment_date) return flash(t('paymentFields'), true)
  const payload = { student_id: selected.id, payment_date: paymentForm.payment_date, purpose: paymentForm.purpose, amount: Number(paymentForm.amount), payment_method: paymentForm.payment_method }
  const { error: paymentError } = await supabase.rpc('add_payment_with_audit', {
    p_student_id: String(payload.student_id),
    p_payment_date: payload.payment_date,
    p_purpose: payload.purpose,
    p_amount: payload.amount,
    p_payment_method: payload.payment_method,
  })
  if (paymentError) return flash(paymentError.message, true)
  paymentForm.amount = ''
  await refresh()
  flash(t('paymentAdded'))
}

async function deletePayment(payment) {
  if (!mayDeletePayment.value || !payment?.id) return
  const reason = window.prompt(t('deletePaymentReason'))
  if (reason === null) return
  if (!reason.trim()) return flash(t('deletePaymentReasonRequired'), true)
  if (!window.confirm(t('confirmDeletePayment'))) return
  loading.value = true
  try {
    const { error: paymentError } = await supabase.rpc('delete_payment_with_audit', {
      p_payment_id: String(payment.id),
      p_reason: reason.trim(),
    })
    if (paymentError) throw paymentError
    await refresh()
    flash(t('paymentDeleted'))
  } catch (paymentError) {
    flash(paymentError.message, true)
  } finally {
    loading.value = false
  }
}

async function instructorAction(action) {
  if (!isInstructorRole.value || !selected.id || !currentInstructor.value) return
  loading.value = true
  try {
    if (action === 'claim') {
      const { data, error: updateError } = await supabase.from('students')
        .update({ instructor_id: currentInstructor.value.id }).eq('id', selected.id).is('instructor_id', null).select('id')
      if (updateError) throw updateError
      if (!data?.length) throw new Error(t('assignmentChanged'))
      try { await addEvent('instructor_changed', selected.id, '', currentInstructor.value.id, t('studentClaimed')) } catch (eventError) { console.error(eventError) }
      flash(t('studentClaimed'))
    } else if (action === 'release') {
      const { data, error: updateError } = await supabase.from('students')
        .update({ instructor_id: null }).eq('id', selected.id).eq('instructor_id', currentInstructor.value.id).select('id')
      if (updateError) throw updateError
      if (!data?.length) throw new Error(t('assignmentChanged'))
      try { await addEvent('instructor_changed', selected.id, currentInstructor.value.id, '', t('studentReleased')) } catch (eventError) { console.error(eventError) }
      flash(t('studentReleased'))
    } else if (action === 'exam') {
      if (!selectedCanSendToExam.value) throw new Error(t('examOnlyFromDriving'))
      const examStatus = 'вождение экзамен'
      const { data, error: updateError } = await supabase.from('students')
        .update({ status: examStatus }).eq('id', selected.id).eq('instructor_id', currentInstructor.value.id).eq('status', 'вождение').select('id')
      if (updateError) throw updateError
      if (!data?.length) throw new Error(t('assignmentChanged'))
      try { await addEvent('status_changed', selected.id, selected.status, examStatus, t('sentToExam')) } catch (eventError) { console.error(eventError) }
      flash(t('sentToExam'))
    }
    modal.value = ''
    await refresh()
  } catch (actionError) {
    flash(actionError.message, true)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  const payload = { school_name: settings.school_name, product_name: settings.product_name, language: settings.language, tagline: settings.tagline, updated_at: new Date().toISOString() }
  const { error: settingsError } = await supabase.from('app_settings').update(payload).eq('id', settings.id || 1)
  if (settingsError) return flash(settingsError.message, true)
  modal.value = ''
  flash(t('settingsSaved'))
}

function setSort(field) {
  if (sort.field === field) sort.direction *= -1
  else { sort.field = field; sort.direction = 1 }
}

function openInsight(type) {
  insightType.value = type
  modal.value = 'insight'
}

function showOverview() {
  archived.value = false
  search.value = ''
  eventFilters.period = 'all'
  eventFilters.user = ''
  eventFilters.type = ''
  eventFilters.search = ''
  modal.value = ''
}

function interpolate(key, values) {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), t(key))
}

function archiveReasonText(reason) {
  return ({ completed: t('completedReason'), expired: t('expiredReason'), theory_expired: t('theoryExpiredReason'), training_expired: t('trainingExpiredReason'), manual: t('manualReason') })[reason] || reason || ''
}

function eventValue(event, value) {
  if (!value) return t('notAssigned')
  if (event.event_type === 'status_changed') return statusText(value)
  if (event.event_type === 'instructor_changed') return instructorName(value)
  if (event.event_type === 'student_archived') return archiveReasonText(event.metadata?.reason || event.description?.replace(/^.*:\s*/, ''))
  return value
}

function eventDescription(event) {
  if (event.event_type === 'student_created') return students.value.find((s) => s.id === event.student_id)?.full_name || t('eventStudentCreated')
  if (['payment_added', 'payment_deleted'].includes(event.event_type)) {
    const data = event.metadata || {}
    if (!data.amount) return `${event.new_value || event.old_value || ''}`
    const details = `${formatDate(data.payment_date)} · ${paymentText(data.purpose)} · ${formatMoney(data.amount)} · ${paymentText(data.payment_method)}`
    return event.event_type === 'payment_deleted' && data.reason ? `${details} · ${t('reason')}: ${data.reason}` : details
  }
  if (['status_changed', 'instructor_changed', 'contract_changed'].includes(event.event_type)) {
    return `${t('changedFrom')}: ${eventValue(event, event.old_value)} ${t('to')} ${eventValue(event, event.new_value)}`
  }
  if (event.event_type === 'student_updated') {
    const field = ({ phone: t('phone'), email: 'Email', notes: t('notes') })[event.metadata?.field] || event.metadata?.field || ''
    return `${field}: ${event.old_value || '—'} → ${event.new_value || '—'}`
  }
  if (event.event_type === 'student_archived') return archiveReasonText(event.metadata?.reason || event.description?.replace(/^.*:\s*/, ''))
  if (event.event_type === 'student_restored') return t('eventStudentRestored')
  return `${event.old_value || ''}${event.old_value || event.new_value ? ' → ' : ''}${event.new_value || ''}` || event.description || eventTitle(event.event_type)
}

function eventTitle(type) {
  return ({
    student_created: t('eventStudentCreated'), payment_added: t('eventPaymentAdded'), payment_deleted: t('eventPaymentDeleted'), status_changed: t('eventStatusChanged'),
    instructor_changed: t('eventInstructorChanged'), contract_changed: t('eventContractChanged'),
    student_updated: t('eventStudentUpdated'), student_archived: t('eventStudentArchived'), student_restored: t('eventStudentRestored'),
  })[type] || type
}

onMounted(async () => {
  if (!configured) return
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  if (session.value) {
    try { await loadProfile(session.value.user.id); await refresh() } catch (e) { flash(e.message, true) }
  }
  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    session.value = nextSession
    if (nextSession) {
      try { await loadProfile(nextSession.user.id); await refresh() } catch (e) { flash(e.message, true) }
    }
  })
})
</script>

<template>
  <main v-if="!session" class="login-page">
    <section class="login-panel">
      <div class="brand-mark">I</div>
      <p class="eyebrow">IKARS / OPERATIONS</p>
      <h1>{{ settings.product_name }}</h1>
      <p class="login-copy">{{ t('loginCopy') }}</p>
      <form class="login-form" @submit.prevent="signIn">
        <label>Email<input v-model="login.email" type="email" autocomplete="email" required placeholder="name@school.lv"></label>
        <label>{{ t('password') }}<input v-model="login.password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
        <button class="primary wide" :disabled="loading">{{ loading ? t('connecting') : t('login') }}</button>
      </form>
      <div v-if="demoMode" class="demo-panel">
        <p class="demo-panel__title">Demo mode — fictional data. Anything you change stays in your browser.</p>
        <div class="demo-panel__roles">
          <button v-for="item in demoRoles" :key="item.role" type="button" class="ghost" :disabled="loading" @click="signInAs(item.role)">{{ item.label }}</button>
        </div>
      </div>
      <p v-if="!configured" class="config-note">{{ configurationError }}. {{ t('configHint') }}</p>
      <p v-if="error" class="message error">{{ error }}</p>
    </section>
    <aside class="login-art"><span>01</span><strong>{{ t('focusA') }}<br>{{ t('focusB') }}</strong></aside>
  </main>

  <div v-else class="shell">
    <aside class="sidebar">
      <div><img class="brand-logo" :src="logoUrl" alt="IKARS"><p>{{ settings.school_name }}</p></div>
      <nav>
        <button class="active" @click="showOverview">{{ isDirector ? t('directorDashboard') : (isAccountant ? t('financeOverview') : t('overview')) }}</button>
        <button v-if="!isAccountant && !isDirector" @click="archived = false">{{ t('students') }} <span>{{ dashboard.total }}</span></button>
        <button v-if="!isAccountant && !isDirector" @click="archived = true">{{ t('archive') }}</button>
        <button v-if="canSeeEvents(role)" @click="modal = 'events'">{{ t('journal') }}</button>
      </nav>
      <div class="user-card">
        <div class="avatar">{{ (profile?.full_name || session.user.email).slice(0, 1).toUpperCase() }}</div>
        <div><strong>{{ profile?.full_name || session.user.email }}</strong><small>{{ role }}</small></div>
        <button :title="t('logout')" @click="signOut">↗</button>
      </div>
      <button v-if="demoMode" class="demo-reset" type="button" @click="resetDemo">↺ Reset demo data</button>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div><p class="eyebrow">{{ t('workspace').toUpperCase() }}</p><h1>{{ isDirector ? t('directorDashboard') : (isAccountant ? t('financeOverview') : (archived ? t('archiveStudents') : t('dashboard'))) }}</h1></div>
        <div class="header-actions">
          <button v-if="canSeeEvents(role)" class="ghost" @click="modal = 'events'">{{ t('eventLog') }}</button>
          <button v-if="canEditSettings(role)" class="icon-button" :title="t('settings')" @click="modal = 'settings'">⚙</button>
          <button v-if="mayManage" class="primary" @click="openStudent()">+ {{ t('newStudent') }}</button>
        </div>
      </header>

      <p v-if="error" class="message error">{{ error }}</p>
      <p v-if="notice" class="message success">{{ notice }}</p>

      <DirectorDashboard v-if="isDirector" :students="students" :payments="payments" :instructors="instructors" :locale="locale" />

      <template v-else>
      <section v-if="isAccountant" class="metrics finance-metrics">
        <article><span>{{ t('totalReceived') }}</span><strong>{{ formatMoney(financeDashboard.received) }}</strong></article>
        <article><span>{{ t('totalOutstanding') }}</span><strong>{{ formatMoney(financeDashboard.outstanding) }}</strong></article>
        <article><span>{{ t('extraRevenue') }}</span><strong>{{ formatMoney(financeDashboard.extras) }}</strong></article>
        <article><span>{{ t('paymentsMade') }}</span><strong>{{ financeDashboard.count }}</strong></article>
      </section>
      <section v-else class="metrics">
        <article><span>{{ t('totalActive') }}</span><strong>{{ dashboard.total }}</strong></article>
        <article><span>{{ t('theory') }}</span><strong>{{ dashboard.theory }}</strong><small>{{ t('studentsCount') }}</small></article>
        <article><span>{{ t('practice') }}</span><strong>{{ dashboard.practice }}</strong><small>{{ t('studentsCount') }}</small></article>
        <article class="accent clickable" role="button" tabindex="0" @click="openInsight('attention')" @keydown.enter="openInsight('attention')"><span>{{ t('attention') }}</span><strong>{{ dashboard.attention }}</strong><small>{{ t('deadlinesStatuses') }}</small></article>
        <article class="clickable" role="button" tabindex="0" @click="openInsight('birthdays')" @keydown.enter="openInsight('birthdays')"><span>{{ t('birthdays') }}</span><strong>{{ dashboard.birthdays }}</strong><small>{{ t('next14Days') }}</small></article>
      </section>

      <section class="data-card">
        <div class="section-head">
          <div><h2>{{ isAccountant ? t('financialRecords') : (archived ? t('archive') : t('currentStudents')) }}</h2><p>{{ visibleStudents.length }} {{ t('records') }}</p></div>
          <div class="filters">
            <label class="search">⌕<input v-model="search" :placeholder="t('searchStudents')"></label>
            <button v-if="!isAccountant" class="ghost" @click="archived = !archived">{{ archived ? t('active') : t('archive') }}</button>
            <button v-if="mayManage && !archived" class="ghost" @click="autoArchive">{{ t('checkDeadlines') }}</button>
          </div>
        </div>
        <div class="table-wrap">
          <table v-if="isAccountant" class="finance-table">
            <thead><tr><th>{{ t('student') }}</th><th>{{ t('contractNumber') }}</th><th>{{ t('coursePrice') }}</th><th>{{ t('totalReceived') }}</th><th>{{ t('left') }}</th><th>{{ t('paymentCount') }}</th><th></th></tr></thead>
            <tbody>
              <tr v-for="student in visibleStudents" :key="student.id">
                <td><strong>{{ student.full_name }}</strong></td><td>{{ student.contract_number || t('noContract') }}</td><td>{{ formatMoney(student.course_price) }}</td>
                <td><strong>{{ formatMoney(paymentSummary(student, payments).paid) }}</strong></td><td :class="{ urgent: paymentSummary(student, payments).left > 0 }">{{ formatMoney(paymentSummary(student, payments).left) }}</td><td>{{ paymentSummary(student, payments).count }}</td>
                <td><button class="ghost compact" @click="openStudent(student)">{{ t('openFinance') }}</button></td>
              </tr>
              <tr v-if="!visibleStudents.length"><td colspan="7" class="empty">{{ t('noStudents') }}</td></tr>
            </tbody>
          </table>
          <table v-else>
            <thead><tr>
              <th @click="setSort('full_name')">{{ t('student') }} ↕</th><th>{{ t('contacts') }}</th><th>{{ t('payment') }}</th>
              <th @click="setSort('category')">{{ t('category') }} ↕</th><th>{{ t('instructor') }}</th>
              <th @click="setSort('status')">{{ t('stage') }} ↕</th><th>{{ t('deadline') }}</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-for="student in visibleStudents" :key="student.id">
                <td><button class="student-link" @click="openStudent(student)">{{ student.full_name }}</button><small>{{ student.contract_number || t('noContract') }}</small></td>
                <td>{{ student.phone || '—' }}<small>{{ student.email || t('noEmail') }}</small></td>
                <td><strong>{{ formatMoney(paymentSummary(student, payments).paid) }}</strong><small>{{ t('from') }} {{ formatMoney(student.course_price) }}</small></td>
                <td><span class="category">{{ student.category || '—' }}</span></td>
                <td>{{ instructorName(student.instructor_id) }}</td>
                <td><span class="status" :data-status="normalizeStatus(student.status)">{{ statusText(student.status) }}</span></td>
                <td>
                  <div class="table-deadlines">
                    <span v-if="trainingDeadline(student)" :class="{ urgent: daysUntil(trainingDeadline(student)) <= 30 }"><small>{{ t('trainingTerm') }}</small>{{ formatDate(trainingDeadline(student)) }}</span>
                    <span v-if="deadline(student)" :class="{ urgent: daysUntil(deadline(student)) <= 5 }"><small>{{ t('contractTerm') }}</small>{{ formatDate(deadline(student)) }}</span>
                    <span v-if="!trainingDeadline(student) && !deadline(student)">—</span>
                  </div>
                </td>
                <td><button class="more" @click="openStudent(student)">•••</button></td>
              </tr>
              <tr v-if="!visibleStudents.length"><td colspan="8" class="empty">{{ t('noStudents') }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      </template>
    </main>
  </div>

  <div v-if="modal" class="modal-backdrop" @mousedown.self="modal = ''">
    <section v-if="modal === 'student'" class="modal student-modal">
      <header><div><p class="eyebrow">{{ (selected.id ? t('studentCard') : t('newRecord')).toUpperCase() }}</p><h2>{{ selected.full_name || t('newStudent') }}</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div v-if="selected.archived" class="archive-banner">{{ t('archivedRecord') }} · {{ archiveReasonText(selected.archive_reason) }}</div>
      <div class="modal-scroll">
        <div v-if="!isAccountant" class="form-grid">
          <label class="span-2">{{ t('fullName') }}<input v-model="selected.full_name" :disabled="!mayManage" required></label>
          <label>{{ t('phone') }}<input v-model="selected.phone" :disabled="!mayManage"></label>
          <label>Email<input v-model="selected.email" type="email" :disabled="!mayManage"></label>
          <label>{{ t('contractNumber') }}<input v-model="selected.contract_number" :disabled="!mayManage"></label>
          <label>{{ t('category') }}<input v-model="selected.category" :disabled="!mayManage"></label>
          <label>{{ t('birthDate') }}<input v-model="selected.birth_date" type="date" :disabled="!mayManage"></label>
          <label>{{ t('instructor') }}<select v-model="selected.instructor_id" :disabled="!mayManage"><option :value="null">{{ t('notAssigned') }}</option><option v-for="item in instructors" :key="item.id" :value="item.id">{{ item.full_name }}</option></select></label>
          <label>{{ t('status') }}<select v-model="selected.status" :disabled="!mayManage"><option v-for="item in STATUSES" :key="item" :value="item">{{ statusText(item) }}</option></select></label>
          <label>{{ t('contractDate') }}<input v-model="selected.contract_date" type="date" :disabled="!mayManage"></label>
          <label>{{ t('durationMonths') }}<input v-model.number="selected.contract_duration_months" type="number" min="1" :disabled="!mayManage"></label>
          <label v-if="role !== ROLES.INSTRUCTOR">{{ t('coursePrice') }}<input v-model.number="selected.course_price" type="number" min="0" step="0.01" :disabled="!mayManage"></label>
          <label class="span-2">{{ t('notes') }}<textarea v-model="selected.notes" rows="3" :disabled="!mayManage"></textarea></label>
        </div>

        <section v-if="selected.id && !isAccountant" class="deadline-summary">
          <article :class="{ overdue: trainingDeadline(selected) && daysUntil(trainingDeadline(selected)) < 0, warning: trainingDeadline(selected) && daysUntil(trainingDeadline(selected)) <= 30 }">
            <p class="eyebrow">{{ t('trainingTerm').toUpperCase() }}</p>
            <template v-if="trainingDeadline(selected)"><strong>{{ daysUntil(trainingDeadline(selected)) >= 0 ? interpolate('daysRemaining', { days: daysUntil(trainingDeadline(selected)) }) : interpolate('daysOverdue', { days: Math.abs(daysUntil(trainingDeadline(selected))) }) }}</strong><small>{{ t('theoryStarted') }}: {{ formatDate(selected.theory_start_date) }}<br>{{ normalizeStatus(selected.status) === 'теория' ? t('theoryDeadline') : t('drivingDeadline') }}: {{ formatDate(trainingDeadline(selected)) }}</small></template>
            <template v-else><strong>—</strong><small>{{ t('theoryNotStarted') }}</small></template>
          </article>
          <article :class="{ overdue: deadline(selected) && daysUntil(deadline(selected)) < 0, warning: deadline(selected) && daysUntil(deadline(selected)) <= 5 }">
            <p class="eyebrow">{{ t('contractTerm').toUpperCase() }}</p>
            <template v-if="deadline(selected)"><strong>{{ daysUntil(deadline(selected)) >= 0 ? interpolate('daysRemaining', { days: daysUntil(deadline(selected)) }) : interpolate('daysOverdue', { days: Math.abs(daysUntil(deadline(selected))) }) }}</strong><small>{{ t('contractUntil') }}: {{ formatDate(deadline(selected)) }}</small></template>
            <template v-else><strong>—</strong><small>{{ t('noDeadline') }}</small></template>
          </article>
        </section>

        <section v-if="isInstructorRole && selected.id" class="instructor-actions">
          <div><p class="eyebrow">{{ t('instructorActions').toUpperCase() }}</p><strong>{{ selectedIsMine ? instructorName(selected.instructor_id) : t('notAssigned') }}</strong></div>
          <div>
            <button v-if="selectedIsUnassigned" class="primary" :disabled="loading" @click="instructorAction('claim')">+ {{ t('claimStudent') }}</button>
            <button v-if="selectedIsMine" class="ghost danger" :disabled="loading" @click="instructorAction('release')">{{ t('releaseStudent') }}</button>
            <button v-if="selectedCanSendToExam" class="dark" :disabled="loading" @click="instructorAction('exam')">{{ t('sendToSchoolExam') }} →</button>
          </div>
        </section>

        <section v-if="selected.id && role !== ROLES.INSTRUCTOR" class="payments">
          <div class="subhead"><div><p class="eyebrow">{{ t('finance').toUpperCase() }}</p><h3>{{ t('payments') }}</h3></div><strong>{{ formatMoney(selectedSummary.paid) }} <small>/ {{ formatMoney(selectedSummary.price) }}</small></strong></div>
          <div class="payment-metrics"><span>{{ t('left') }} <b>{{ formatMoney(selectedSummary.left) }}</b></span><span>{{ t('extras') }} <b>{{ formatMoney(selectedSummary.extra) }}</b></span><span>{{ t('paymentCount') }} <b>{{ selectedSummary.count }}</b></span></div>
          <form v-if="mayPay" class="payment-form" @submit.prevent="addPayment">
            <input v-model="paymentForm.payment_date" type="date" required>
            <select v-model="paymentForm.purpose"><option v-for="item in PAYMENT_PURPOSES" :key="item" :value="item">{{ paymentText(item) }}</option></select>
            <input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" :placeholder="t('amount')" required>
            <select v-model="paymentForm.payment_method"><option v-for="item in PAYMENT_METHODS" :key="item" :value="item">{{ paymentText(item) }}</option></select>
            <button class="dark">{{ t('add') }}</button>
          </form>
          <div class="payment-list"><div v-for="item in studentPayments" :key="item.id"><span>{{ formatDate(item.payment_date) }}</span><strong>{{ paymentText(item.purpose) }}</strong><b>{{ formatMoney(item.amount) }}</b><small>{{ paymentText(item.payment_method) }}</small><button v-if="mayDeletePayment" class="ghost danger compact" :disabled="loading" @click="deletePayment(item)">{{ t('deletePayment') }}</button></div><p v-if="!studentPayments.length" class="empty">{{ t('noPayments') }}</p></div>
        </section>
      </div>
      <footer>
        <button v-if="selected.id && mayManage" class="ghost danger" @click="setArchive(selected, !selected.archived)">{{ selected.archived ? t('restore') : t('toArchive') }}</button>
        <span class="spacer"></span><button class="ghost" @click="modal = ''">{{ t('close') }}</button><button v-if="mayManage" class="primary" @click="saveStudent">{{ t('save') }}</button>
      </footer>
    </section>

    <section v-else-if="modal === 'events'" class="modal events-modal">
      <header><div><p class="eyebrow">{{ t('audit').toUpperCase() }}</p><h2>{{ t('eventLog') }}</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div class="event-filters">
        <select v-model="eventFilters.period"><option value="all">{{ t('allTime') }}</option><option value="today">{{ t('today') }}</option><option value="7days">{{ t('days7') }}</option><option value="30days">{{ t('days30') }}</option></select>
        <select v-model="eventFilters.user"><option value="">{{ t('allEmployees') }}</option><option v-for="item in profiles" :key="item.id" :value="item.id">{{ item.full_name }}</option></select>
        <select v-model="eventFilters.type"><option value="">{{ t('allEvents') }}</option><option v-for="type in [...new Set(events.map(e => e.event_type))]" :key="type" :value="type">{{ eventTitle(type) }}</option></select>
        <input v-model="eventFilters.search" :placeholder="t('searchLog')">
      </div>
      <div class="timeline">
        <article v-for="event in filteredEvents" :key="event.id"><i></i><div><strong>{{ eventTitle(event.event_type) }}</strong><p>{{ eventDescription(event) }}</p><small>{{ students.find(s => s.id === event.student_id)?.full_name || t('student') }} · {{ profiles.find(p => p.id === event.user_id)?.full_name || t('employee') }} · {{ formatDate(event.created_at, true) }}</small></div></article>
        <p v-if="!filteredEvents.length" class="empty">{{ t('noEvents') }}</p>
      </div>
    </section>

    <section v-else-if="modal === 'insight'" class="modal insights-modal">
      <header><div><p class="eyebrow">{{ t('dashboard').toUpperCase() }}</p><h2>{{ insightType === 'birthdays' ? t('birthdayDetails') : t('attentionDetails') }}</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div class="insight-list modal-scroll">
        <template v-if="insightType === 'birthdays'">
          <button v-for="item in upcomingBirthdays" :key="item.student.id" @click="openStudent(item.student)">
            <span class="insight-date"><b>{{ new Intl.DateTimeFormat(intlLocale, { day: '2-digit' }).format(item.date) }}</b>{{ new Intl.DateTimeFormat(intlLocale, { month: 'short' }).format(item.date) }}</span>
            <span><strong>{{ item.student.full_name }}</strong><small>{{ t('birthdayOn') }}: {{ formatDate(item.date) }} · {{ item.days === 0 ? t('todayLabel') : interpolate('inDays', { days: item.days }) }}</small></span><i>→</i>
          </button>
          <p v-if="!upcomingBirthdays.length" class="empty">{{ t('noStudents') }}</p>
        </template>
        <template v-else>
          <button v-for="item in attentionStudents" :key="item.student.id" @click="openStudent(item.student)">
            <span class="insight-status">!</span><span><strong>{{ item.student.full_name }}</strong><small>{{ statusText(item.student.status) }}</small><small v-for="alert in item.alerts" :key="alert.type" class="alert-line"><b>{{ alert.type === 'training' ? t('trainingTerm') : alert.type === 'contract' ? t('contractTerm') : t('completedReason') }}</b><template v-if="alert.date"> · {{ formatDate(alert.date) }} · {{ alert.days >= 0 ? interpolate('daysRemaining', { days: alert.days }) : interpolate('daysOverdue', { days: Math.abs(alert.days) }) }}</template></small></span><i>→</i>
          </button>
          <p v-if="!attentionStudents.length" class="empty">{{ t('noStudents') }}</p>
        </template>
      </div>
      <footer><span class="spacer"></span><button class="ghost" @click="modal = ''">{{ t('close') }}</button></footer>
    </section>

    <section v-else class="modal settings-modal">
      <header><div><p class="eyebrow">{{ t('system').toUpperCase() }}</p><h2>{{ t('crmSettings') }}</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div class="form-grid modal-scroll">
        <label>{{ t('schoolName') }}<input v-model="settings.school_name"></label>
        <label>{{ t('productName') }}<input v-model="settings.product_name"></label>
        <label>{{ t('language') }}<select v-model="settings.language"><option value="ru">Русский</option><option value="lv">Latviešu</option><option value="en">English</option></select></label>
        <label>{{ t('tagline') }}<input v-model="settings.tagline"></label>
      </div>
      <footer><span class="spacer"></span><button class="ghost" @click="modal = ''">{{ t('cancel') }}</button><button class="primary" @click="saveSettings">{{ t('save') }}</button></footer>
    </section>
  </div>
</template>
