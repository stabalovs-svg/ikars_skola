<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { configured, supabase } from './lib/supabase'
import {
  PAYMENT_METHODS, PAYMENT_PURPOSES, ROLES, STATUSES, automaticArchiveReason,
  canAddPayment, canEditSettings, canManage, canSeeEvents, daysUntil, deadline,
  formatDate, formatMoney, normalizeStatus, paymentSummary,
} from './lib/crm'

const session = ref(null)
const profile = ref(null)
const currentInstructor = ref(null)
const students = ref([])
const instructors = ref([])
const payments = ref([])
const events = ref([])
const profiles = ref([])
const settings = reactive({ id: 1, school_name: 'GoDrive', product_name: 'AutoSchool CRM', language: 'ru', tagline: 'Управление автошколой' })
const login = reactive({ email: '', password: '' })
const search = ref('')
const archived = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const modal = ref('')
const selected = reactive({})
const paymentForm = reactive({ payment_date: new Date().toISOString().slice(0, 10), purpose: 'Теория', amount: '', payment_method: 'Наличные' })
const eventFilters = reactive({ period: 'all', user: '', type: '', search: '' })
const sort = reactive({ field: 'full_name', direction: 1 })

const role = computed(() => profile.value?.role || '')
const mayManage = computed(() => canManage(role.value))
const mayPay = computed(() => canAddPayment(role.value))
const instructorName = (id) => instructors.value.find((item) => item.id === id)?.full_name || 'Не назначен'
const studentPayments = computed(() => payments.value.filter((p) => p.student_id === selected.id))
const selectedSummary = computed(() => paymentSummary(selected, payments.value))

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

const dashboard = computed(() => {
  const active = students.value.filter((s) => !s.archived)
  return {
    total: active.length,
    theory: active.filter((s) => normalizeStatus(s.status).includes('теория')).length,
    practice: active.filter((s) => normalizeStatus(s.status).includes('вождение')).length,
    attention: active.filter((s) => {
      const days = daysUntil(deadline(s))
      return automaticArchiveReason(s) || (days !== null && days <= 30)
    }).length,
    birthdays: active.filter((s) => {
      if (!s.birth_date) return false
      const birthday = new Date(s.birth_date)
      const now = new Date()
      const next = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate())
      if (next < now) next.setFullYear(next.getFullYear() + 1)
      return daysUntil(next) <= 14
    }).length,
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
  if (!configured) return flash('Добавьте Supabase URL и ключ в файл .env', true)
  loading.value = true
  const { error: authError } = await supabase.auth.signInWithPassword(login)
  loading.value = false
  if (authError) flash(authError.message, true)
}

async function signOut() {
  await supabase.auth.signOut()
  session.value = null
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
    let studentQuery = supabase.from('students').select('*')
    if (role.value === ROLES.INSTRUCTOR && currentInstructor.value) {
      studentQuery = studentQuery.or(`instructor_id.is.null,instructor_id.eq.${currentInstructor.value.id}`)
    }
    const [studentResult, instructorResult, paymentResult, eventResult, profileResult, settingsResult] = await Promise.all([
      studentQuery,
      supabase.from('instructors').select('*').order('full_name'),
      supabase.from('payments').select('*').order('payment_date'),
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
  if (!payload.full_name) return flash('Укажите имя ученика', true)
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
        flash('Данные сохранены, но часть записей журнала создать не удалось', true)
      }
    } else {
      const { data, error: insertError } = await supabase.from('students').insert(payload).select().single()
      if (insertError) throw insertError
      await addEvent('student_created', data.id, '', data.full_name, 'Создан ученик')
    }
    modal.value = ''
    await refresh()
    flash('Данные сохранены')
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
    await addEvent(value ? 'student_archived' : 'student_restored', student.id, value ? 'active' : 'archived', value ? 'archived' : 'active', value ? `Причина: ${reason}` : 'Восстановлен')
  } catch (eventError) {
    console.error('Не удалось записать событие архива:', eventError)
  }
  modal.value = ''
  if (refreshAfter) await refresh()
  return true
}

async function autoArchive() {
  const candidates = students.value.filter((s) => !s.archived).map((s) => ({ student: s, reason: automaticArchiveReason(s) })).filter((x) => x.reason)
  if (!candidates.length) return flash('Кандидатов для автоархива нет')
  const results = await Promise.allSettled(candidates.map((item) => setArchive(item.student, true, item.reason, false)))
  await refresh()
  const completed = results.filter((result) => result.status === 'fulfilled' && result.value).length
  const failed = candidates.length - completed
  flash(failed ? `Архивировано: ${completed}. Ошибок: ${failed}` : `Перенесено в архив: ${completed}`, failed > 0)
}

async function addPayment() {
  if (!selected.id || !paymentForm.amount || !paymentForm.payment_date) return flash('Заполните дату и сумму платежа', true)
  const payload = { student_id: selected.id, payment_date: paymentForm.payment_date, purpose: paymentForm.purpose, amount: Number(paymentForm.amount), payment_method: paymentForm.payment_method }
  const { error: paymentError } = await supabase.from('payments').insert(payload)
  if (paymentError) return flash(paymentError.message, true)
  await addEvent('payment_added', selected.id, '', `${payload.amount} €`, `${payload.purpose} — ${payload.amount} € (${payload.payment_method})`, payload)
  paymentForm.amount = ''
  await refresh()
  flash('Платёж добавлен')
}

async function saveSettings() {
  const payload = { school_name: settings.school_name, product_name: settings.product_name, language: settings.language, tagline: settings.tagline, updated_at: new Date().toISOString() }
  const { error: settingsError } = await supabase.from('app_settings').update(payload).eq('id', settings.id || 1)
  if (settingsError) return flash(settingsError.message, true)
  modal.value = ''
  flash('Настройки сохранены')
}

function setSort(field) {
  if (sort.field === field) sort.direction *= -1
  else { sort.field = field; sort.direction = 1 }
}

function eventTitle(type) {
  return ({
    student_created: 'Создан ученик', payment_added: 'Добавлен платёж', status_changed: 'Изменён статус',
    instructor_changed: 'Изменён инструктор', contract_changed: 'Изменён договор',
    student_updated: 'Обновлены данные', student_archived: 'Ученик архивирован', student_restored: 'Ученик восстановлен',
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
      <p class="login-copy">Единое рабочее пространство автошколы: ученики, сроки, оплаты и история изменений.</p>
      <form class="login-form" @submit.prevent="signIn">
        <label>Email<input v-model="login.email" type="email" autocomplete="email" required placeholder="name@school.lv"></label>
        <label>Пароль<input v-model="login.password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
        <button class="primary wide" :disabled="loading">{{ loading ? 'Подключение…' : 'Войти в CRM' }}</button>
      </form>
      <p v-if="!configured" class="config-note">Для подключения создайте `.env` по примеру `.env.example`.</p>
      <p v-if="error" class="message error">{{ error }}</p>
    </section>
    <aside class="login-art"><span>01</span><strong>Держите обучение<br>в ясном фокусе.</strong></aside>
  </main>

  <div v-else class="shell">
    <aside class="sidebar">
      <div><div class="logo"><span>IK</span>ARS</div><p>{{ settings.school_name }}</p></div>
      <nav>
        <button class="active">Обзор</button>
        <button @click="archived = false">Ученики <span>{{ dashboard.total }}</span></button>
        <button @click="archived = true">Архив</button>
        <button v-if="canSeeEvents(role)" @click="modal = 'events'">Журнал</button>
      </nav>
      <div class="user-card">
        <div class="avatar">{{ (profile?.full_name || session.user.email).slice(0, 1).toUpperCase() }}</div>
        <div><strong>{{ profile?.full_name || session.user.email }}</strong><small>{{ role }}</small></div>
        <button title="Выйти" @click="signOut">↗</button>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div><p class="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</p><h1>{{ archived ? 'Архив учеников' : 'Панель автошколы' }}</h1></div>
        <div class="header-actions">
          <button v-if="canSeeEvents(role)" class="ghost" @click="modal = 'events'">Журнал событий</button>
          <button v-if="canEditSettings(role)" class="icon-button" title="Настройки" @click="modal = 'settings'">⚙</button>
          <button v-if="mayManage" class="primary" @click="openStudent()">+ Новый ученик</button>
        </div>
      </header>

      <p v-if="error" class="message error">{{ error }}</p>
      <p v-if="notice" class="message success">{{ notice }}</p>

      <section class="metrics">
        <article><span>Всего активных</span><strong>{{ dashboard.total }}</strong><i>↗</i></article>
        <article><span>Теория</span><strong>{{ dashboard.theory }}</strong><small>учеников</small></article>
        <article><span>Практика</span><strong>{{ dashboard.practice }}</strong><small>учеников</small></article>
        <article class="accent"><span>Требуют внимания</span><strong>{{ dashboard.attention }}</strong><small>сроки и статусы</small></article>
        <article><span>Дни рождения</span><strong>{{ dashboard.birthdays }}</strong><small>в ближайшие 14 дней</small></article>
      </section>

      <section class="data-card">
        <div class="section-head">
          <div><h2>{{ archived ? 'Архив' : 'Текущие ученики' }}</h2><p>{{ visibleStudents.length }} записей</p></div>
          <div class="filters">
            <label class="search">⌕<input v-model="search" placeholder="Имя, телефон, email, договор"></label>
            <button class="ghost" @click="archived = !archived">{{ archived ? 'Активные' : 'Архив' }}</button>
            <button v-if="mayManage && !archived" class="ghost" @click="autoArchive">Проверить сроки</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th @click="setSort('full_name')">Ученик ↕</th><th>Контакты</th><th>Оплата</th>
              <th @click="setSort('category')">Категория ↕</th><th>Инструктор</th>
              <th @click="setSort('status')">Этап ↕</th><th>Срок</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-for="student in visibleStudents" :key="student.id">
                <td><button class="student-link" @click="openStudent(student)">{{ student.full_name }}</button><small>{{ student.contract_number || 'Без договора' }}</small></td>
                <td>{{ student.phone || '—' }}<small>{{ student.email || 'Нет email' }}</small></td>
                <td><strong>{{ formatMoney(paymentSummary(student, payments).paid) }}</strong><small>из {{ formatMoney(student.course_price) }}</small></td>
                <td><span class="category">{{ student.category || '—' }}</span></td>
                <td>{{ instructorName(student.instructor_id) }}</td>
                <td><span class="status" :data-status="normalizeStatus(student.status)">{{ student.status || '—' }}</span></td>
                <td><span :class="{ urgent: daysUntil(deadline(student)) !== null && daysUntil(deadline(student)) <= 30 }">{{ deadline(student) ? formatDate(deadline(student)) : '—' }}</span></td>
                <td><button class="more" @click="openStudent(student)">•••</button></td>
              </tr>
              <tr v-if="!visibleStudents.length"><td colspan="8" class="empty">Подходящих учеников не найдено</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <div v-if="modal" class="modal-backdrop" @mousedown.self="modal = ''">
    <section v-if="modal === 'student'" class="modal student-modal">
      <header><div><p class="eyebrow">{{ selected.id ? 'КАРТОЧКА УЧЕНИКА' : 'НОВАЯ ЗАПИСЬ' }}</p><h2>{{ selected.full_name || 'Новый ученик' }}</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div v-if="selected.archived" class="archive-banner">Запись находится в архиве · {{ selected.archive_reason }}</div>
      <div class="modal-scroll">
        <div class="form-grid">
          <label class="span-2">ФИО<input v-model="selected.full_name" :disabled="!mayManage" required></label>
          <label>Телефон<input v-model="selected.phone" :disabled="!mayManage"></label>
          <label>Email<input v-model="selected.email" type="email" :disabled="!mayManage"></label>
          <label>№ договора<input v-model="selected.contract_number" :disabled="!mayManage"></label>
          <label>Категория<input v-model="selected.category" :disabled="!mayManage"></label>
          <label>Дата рождения<input v-model="selected.birth_date" type="date" :disabled="!mayManage"></label>
          <label>Инструктор<select v-model="selected.instructor_id" :disabled="!mayManage"><option :value="null">Не назначен</option><option v-for="item in instructors" :key="item.id" :value="item.id">{{ item.full_name }}</option></select></label>
          <label>Статус<select v-model="selected.status" :disabled="!mayManage"><option v-for="item in STATUSES" :key="item">{{ item }}</option></select></label>
          <label>Дата договора<input v-model="selected.contract_date" type="date" :disabled="!mayManage"></label>
          <label>Срок, месяцев<input v-model.number="selected.contract_duration_months" type="number" min="1" :disabled="!mayManage"></label>
          <label>Стоимость курса, €<input v-model.number="selected.course_price" type="number" min="0" step="0.01" :disabled="!mayManage"></label>
          <label class="span-2">Заметки<textarea v-model="selected.notes" rows="3" :disabled="!mayManage"></textarea></label>
        </div>

        <section v-if="selected.id" class="payments">
          <div class="subhead"><div><p class="eyebrow">ФИНАНСЫ</p><h3>Оплаты</h3></div><strong>{{ formatMoney(selectedSummary.paid) }} <small>/ {{ formatMoney(selectedSummary.price) }}</small></strong></div>
          <div class="payment-metrics"><span>Осталось <b>{{ formatMoney(selectedSummary.left) }}</b></span><span>Доп. услуги <b>{{ formatMoney(selectedSummary.extra) }}</b></span><span>Платежей <b>{{ selectedSummary.count }}</b></span></div>
          <form v-if="mayPay" class="payment-form" @submit.prevent="addPayment">
            <input v-model="paymentForm.payment_date" type="date" required>
            <select v-model="paymentForm.purpose"><option v-for="item in PAYMENT_PURPOSES" :key="item">{{ item }}</option></select>
            <input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" placeholder="Сумма" required>
            <select v-model="paymentForm.payment_method"><option v-for="item in PAYMENT_METHODS" :key="item">{{ item }}</option></select>
            <button class="dark">Добавить</button>
          </form>
          <div class="payment-list"><div v-for="item in studentPayments" :key="item.id"><span>{{ formatDate(item.payment_date) }}</span><strong>{{ item.purpose }}</strong><b>{{ formatMoney(item.amount) }}</b><small>{{ item.payment_method }}</small></div><p v-if="!studentPayments.length" class="empty">Платежей пока нет</p></div>
        </section>
      </div>
      <footer>
        <button v-if="selected.id && mayManage" class="ghost danger" @click="setArchive(selected, !selected.archived)">{{ selected.archived ? 'Восстановить' : 'В архив' }}</button>
        <span class="spacer"></span><button class="ghost" @click="modal = ''">Закрыть</button><button v-if="mayManage" class="primary" @click="saveStudent">Сохранить</button>
      </footer>
    </section>

    <section v-else-if="modal === 'events'" class="modal events-modal">
      <header><div><p class="eyebrow">АУДИТ CRM</p><h2>Журнал событий</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div class="event-filters">
        <select v-model="eventFilters.period"><option value="all">Всё время</option><option value="today">Сегодня</option><option value="7days">7 дней</option><option value="30days">30 дней</option></select>
        <select v-model="eventFilters.user"><option value="">Все сотрудники</option><option v-for="item in profiles" :key="item.id" :value="item.id">{{ item.full_name }}</option></select>
        <select v-model="eventFilters.type"><option value="">Все события</option><option v-for="type in [...new Set(events.map(e => e.event_type))]" :key="type" :value="type">{{ eventTitle(type) }}</option></select>
        <input v-model="eventFilters.search" placeholder="Поиск по журналу">
      </div>
      <div class="timeline">
        <article v-for="event in filteredEvents" :key="event.id"><i></i><div><strong>{{ eventTitle(event.event_type) }}</strong><p>{{ event.description || `${event.old_value || ''} → ${event.new_value || ''}` }}</p><small>{{ students.find(s => s.id === event.student_id)?.full_name || 'Ученик' }} · {{ profiles.find(p => p.id === event.user_id)?.full_name || 'Сотрудник' }} · {{ formatDate(event.created_at, true) }}</small></div></article>
        <p v-if="!filteredEvents.length" class="empty">Событий не найдено</p>
      </div>
    </section>

    <section v-else class="modal settings-modal">
      <header><div><p class="eyebrow">СИСТЕМА</p><h2>Настройки CRM</h2></div><button class="close" @click="modal = ''">×</button></header>
      <div class="form-grid modal-scroll">
        <label>Название школы<input v-model="settings.school_name"></label>
        <label>Название продукта<input v-model="settings.product_name"></label>
        <label>Язык<select v-model="settings.language"><option value="ru">Русский</option><option value="lv">Latviešu</option><option value="en">English</option></select></label>
        <label>Подзаголовок<input v-model="settings.tagline"></label>
      </div>
      <footer><span class="spacer"></span><button class="ghost" @click="modal = ''">Отмена</button><button class="primary" @click="saveSettings">Сохранить</button></footer>
    </section>
  </div>
</template>
