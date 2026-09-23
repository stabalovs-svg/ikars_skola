<script setup>
import { computed, reactive } from 'vue'
import { formatMoney as money, normalizeStatus, paymentSummary } from '../lib/crm'
import { paymentLabels, translate } from '../lib/i18n'

const props = defineProps({ students: Array, payments: Array, instructors: Array, locale: String })
const filters = reactive({ period: 'year', instructor: '', category: '' })
const intl = computed(() => ({ ru: 'ru-RU', lv: 'lv-LV', en: 'en-GB' })[props.locale] || 'ru-RU')
const t = (key) => translate(props.locale, key)
const formatMoney = (value) => money(value, intl.value)
const paymentText = (value) => paymentLabels[props.locale]?.[value] || value
const instructorName = (id) => props.instructors.find((item) => item.id === id)?.full_name || t('notAssigned')
const categories = computed(() => [...new Set(props.students.map((student) => student.category).filter(Boolean))].sort())

const dateFrom = computed(() => {
  if (filters.period === 'all') return null
  const date = new Date(); date.setHours(0, 0, 0, 0)
  if (filters.period === 'today') return date
  // Rolling 12 months: a calendar-year window would leave the demo almost
  // empty in January, so the year filter always looks back a full year.
  if (filters.period === 'year') { date.setFullYear(date.getFullYear() - 1); return date }
  date.setDate(date.getDate() - Number(filters.period)); return date
})
const filteredStudents = computed(() => props.students
  .filter((student) => !filters.instructor || student.instructor_id === filters.instructor)
  .filter((student) => !filters.category || student.category === filters.category))
const studentIds = computed(() => new Set(filteredStudents.value.map((student) => student.id)))
const filteredPayments = computed(() => props.payments.filter((payment) => studentIds.value.has(payment.student_id))
  .filter((payment) => !dateFrom.value || new Date(`${payment.payment_date}T12:00:00`) >= dateFrom.value))
const total = computed(() => filteredPayments.value.reduce((sum, item) => sum + Number(item.amount || 0), 0))
const extras = computed(() => filteredPayments.value.filter((item) => !['Теория', 'Вождение'].includes(item.purpose)).reduce((sum, item) => sum + Number(item.amount || 0), 0))
const outstanding = computed(() => filteredStudents.value.filter((student) => !student.archived).reduce((sum, student) => sum + paymentSummary(student, props.payments).left, 0))
const average = computed(() => filteredPayments.value.length ? total.value / filteredPayments.value.length : 0)
const completed = computed(() => filteredStudents.value.filter((student) => normalizeStatus(student.status) === 'вождение сдано').length)

function groupPayments(field) {
  const grouped = new Map()
  filteredPayments.value.forEach((item) => grouped.set(item[field] || '—', (grouped.get(item[field] || '—') || 0) + Number(item.amount || 0)))
  return [...grouped].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
const purposes = computed(() => groupPayments('purpose'))
const methods = computed(() => groupPayments('payment_method'))
const maxPurpose = computed(() => Math.max(...purposes.value.map((item) => item.value), 1))
const maxMethod = computed(() => Math.max(...methods.value.map((item) => item.value), 1))
const months = computed(() => {
  const result = []
  const now = new Date()
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const value = filteredPayments.value.filter((payment) => {
      const itemDate = new Date(`${payment.payment_date}T12:00:00`)
      return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth()
    }).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    result.push({ label: new Intl.DateTimeFormat(intl.value, { month: 'short' }).format(date), value })
  }
  return result
})
const maxMonth = computed(() => Math.max(...months.value.map((item) => item.value), 1))
const instructorStats = computed(() => props.instructors.map((instructor) => {
  const own = filteredStudents.value.filter((student) => student.instructor_id === instructor.id)
  const ids = new Set(own.map((student) => student.id))
  const received = filteredPayments.value.filter((payment) => ids.has(payment.student_id)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  return { ...instructor, count: own.length, received }
}).filter((item) => item.count || item.received).sort((a, b) => b.received - a.received))
const debts = computed(() => filteredStudents.value.filter((student) => !student.archived).map((student) => ({ student, ...paymentSummary(student, props.payments) }))
  .filter((item) => item.left > 0).sort((a, b) => b.left - a.left).slice(0, 10))

function exportCsv() {
  const rows = [[t('paymentDate'), t('student'), t('contractNumber'), t('paymentPurpose'), t('paymentMethod'), t('amount')]]
  filteredPayments.value.forEach((payment) => {
    const student = props.students.find((item) => item.id === payment.student_id)
    rows.push([payment.payment_date, student?.full_name || '', student?.contract_number || '', paymentText(payment.purpose), paymentText(payment.payment_method), Number(payment.amount || 0).toFixed(2)])
  })
  const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n')
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `ikars-finance-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
}
</script>

<template>
  <section class="director-filters">
    <label>{{ t('period') }}<select v-model="filters.period"><option value="today">{{ t('today') }}</option><option value="7">{{ t('days7') }}</option><option value="30">{{ t('days30') }}</option><option value="year">{{ t('last12Months') }}</option><option value="all">{{ t('allTime') }}</option></select></label>
    <label>{{ t('instructor') }}<select v-model="filters.instructor"><option value="">{{ t('allInstructors') }}</option><option v-for="item in instructors" :key="item.id" :value="item.id">{{ item.full_name }}</option></select></label>
    <label>{{ t('category') }}<select v-model="filters.category"><option value="">{{ t('allCategories') }}</option><option v-for="item in categories" :key="item">{{ item }}</option></select></label>
    <button class="export-btn" @click="exportCsv">↓ CSV</button>
  </section>

  <section class="director-kpis">
    <article class="primary-kpi"><span>{{ t('revenuePeriod') }}</span><strong>{{ formatMoney(total) }}</strong><small>{{ filteredPayments.length }} {{ t('paymentsMade').toLowerCase() }}</small></article>
    <article><span>{{ t('totalOutstanding') }}</span><strong>{{ formatMoney(outstanding) }}</strong><small>{{ debts.length }} {{ t('studentsCount') }}</small></article>
    <article><span>{{ t('averagePayment') }}</span><strong>{{ formatMoney(average) }}</strong><small>{{ t('selectedPeriod') }}</small></article>
    <article><span>{{ t('extraRevenue') }}</span><strong>{{ formatMoney(extras) }}</strong><small>{{ t('selectedPeriod') }}</small></article>
    <article><span>{{ t('completedStudents') }}</span><strong>{{ completed }}</strong><small>{{ filteredStudents.length }} {{ t('totalActive').toLowerCase() }}</small></article>
  </section>

  <section class="director-grid">
    <article class="analytics-card revenue-chart">
      <header><div><p>{{ t('revenueDynamics') }}</p><h3>{{ t('lastSixMonths') }}</h3></div></header>
      <div class="bar-chart"><div v-for="month in months" :key="month.label"><b>{{ formatMoney(month.value) }}</b><span><i :style="{ height: `${Math.max(month.value / maxMonth * 100, 3)}%` }"></i></span><small>{{ month.label }}</small></div></div>
    </article>
    <article class="analytics-card breakdown"><header><div><p>{{ t('paymentPurpose') }}</p><h3>{{ t('revenueStructure') }}</h3></div></header><div v-for="item in purposes" :key="item.label" class="progress-row"><span>{{ paymentText(item.label) }}</span><b>{{ formatMoney(item.value) }}</b><i><em :style="{ width: `${item.value / maxPurpose * 100}%` }"></em></i></div><p v-if="!purposes.length" class="empty">{{ t('noPayments') }}</p></article>
    <article class="analytics-card breakdown"><header><div><p>{{ t('paymentMethod') }}</p><h3>{{ t('paymentChannels') }}</h3></div></header><div v-for="item in methods" :key="item.label" class="progress-row"><span>{{ paymentText(item.label) }}</span><b>{{ formatMoney(item.value) }}</b><i><em :style="{ width: `${item.value / maxMethod * 100}%` }"></em></i></div><p v-if="!methods.length" class="empty">{{ t('noPayments') }}</p></article>
    <article class="analytics-card"><header><div><p>{{ t('instructors') }}</p><h3>{{ t('instructorPerformance') }}</h3></div></header><div class="rank-list"><div v-for="(item, index) in instructorStats" :key="item.id"><span>{{ index + 1 }}</span><p><b>{{ item.full_name }}</b><small>{{ item.count }} {{ t('studentsCount') }}</small></p><strong>{{ formatMoney(item.received) }}</strong></div><p v-if="!instructorStats.length" class="empty">—</p></div></article>
    <article class="analytics-card debt-card"><header><div><p>{{ t('riskControl') }}</p><h3>{{ t('largestDebts') }}</h3></div></header><div class="debt-list"><div v-for="item in debts" :key="item.student.id"><p><b>{{ item.student.full_name }}</b><small>{{ item.student.contract_number || t('noContract') }} · {{ instructorName(item.student.instructor_id) }}</small></p><strong>{{ formatMoney(item.left) }}</strong></div><p v-if="!debts.length" class="empty">{{ t('noDebts') }}</p></div></article>
  </section>
</template>

<style scoped>
.director-filters{display:flex;gap:10px;align-items:end;margin:28px 0 14px;padding:14px;background:#fff;border:1px solid var(--line);border-radius:13px}.director-filters label{display:grid;gap:5px;min-width:160px;font-size:10px;font-weight:700;color:#69746e}.director-filters select{padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:#fafbf7}.export-btn{margin-left:auto;padding:10px 15px;border:0;border-radius:8px;background:var(--ink);color:#fff;font-weight:700}.director-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.director-kpis article{min-height:118px;padding:17px;background:#fff;border:1px solid var(--line);border-radius:13px}.director-kpis .primary-kpi{background:var(--lime);border-color:var(--lime)}.director-kpis span,.director-kpis small{display:block;color:#6d7872;font-size:10px}.director-kpis strong{display:block;margin:23px 0 5px;font:700 22px Unbounded}.director-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:12px;margin-top:14px}.analytics-card{background:#fff;border:1px solid var(--line);border-radius:13px;padding:18px;min-height:250px}.analytics-card header p{margin:0;color:#7d8781;font-size:9px;text-transform:uppercase;letter-spacing:1px}.analytics-card h3{margin:5px 0 0;font-size:15px}.bar-chart{height:180px;display:flex;align-items:end;gap:10px;padding-top:22px}.bar-chart>div{height:100%;flex:1;display:grid;grid-template-rows:18px 1fr 18px;text-align:center}.bar-chart b{font-size:8px;color:#6d7771}.bar-chart span{display:flex;align-items:end;justify-content:center;border-bottom:1px solid var(--line)}.bar-chart i{display:block;width:min(32px,70%);min-height:4px;background:var(--lime);border-radius:5px 5px 0 0}.bar-chart small{text-transform:uppercase;font-size:8px;padding-top:5px}.progress-row{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:17px;font-size:10px}.progress-row i{grid-column:1/-1;height:5px;background:#edf0e9;border-radius:9px;overflow:hidden}.progress-row em{display:block;height:100%;background:#189b92;border-radius:9px}.rank-list>div,.debt-list>div{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #eceee8}.rank-list>div>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#edf0e9;font-size:9px}.rank-list p,.debt-list p{flex:1;margin:0}.rank-list b,.debt-list b,.rank-list small,.debt-list small{display:block}.rank-list small,.debt-list small{color:#818a85;font-size:9px;margin-top:3px}.rank-list strong,.debt-list strong{font-size:11px}.debt-card{grid-column:1/-1}.debt-list{display:grid;grid-template-columns:1fr 1fr;column-gap:25px}.empty{text-align:center;color:#89928d;padding:25px}
@media(max-width:1100px){.director-kpis{grid-template-columns:repeat(3,1fr)}.director-grid{grid-template-columns:1fr}}
@media(max-width:760px){.director-filters{align-items:stretch;flex-direction:column}.director-filters label{min-width:0}.export-btn{margin-left:0}.director-kpis{grid-template-columns:1fr 1fr}.debt-list{grid-template-columns:1fr}}
</style>
