export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  INSTRUCTOR: 'instructor',
  ACCOUNTANT: 'accountant',
  DIRECTOR: 'director',
}

export const STATUSES = [
  'оформление',
  'теория',
  'теория сдана',
  'вождение',
  'вождение экзамен',
  'вождение сдано',
]

export const PAYMENT_PURPOSES = ['Теория', 'Вождение', 'Экзамен', 'Медицинская справка', 'Другое']
export const PAYMENT_METHODS = ['Наличные', 'Карта', 'Перевод']

export const normalizeStatus = (value = '') => value.toLocaleLowerCase('ru')
export const canManage = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role)
export const canSeeEvents = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.DIRECTOR].includes(role)
export const canEditSettings = (role) => role === ROLES.ADMIN
export const canAddPayment = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT].includes(role)

export function addMonths(date, months) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + Number(months || 0))
  return result
}

export function deadline(student) {
  if (!student.contract_date || !student.contract_duration_months) return null
  return addMonths(`${student.contract_date}T00:00:00`, student.contract_duration_months)
}

export function daysUntil(date) {
  if (!date) return null
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

export function automaticArchiveReason(student) {
  if (normalizeStatus(student.status) === 'вождение сдано') return 'completed'
  const days = daysUntil(deadline(student))
  return days !== null && days < 0 ? 'expired' : null
}

export function paymentSummary(student, payments) {
  const own = payments.filter((p) => p.student_id === student.id)
  const course = own.filter((p) => ['Теория', 'Вождение'].includes(p.purpose))
  const extras = own.filter((p) => !['Теория', 'Вождение'].includes(p.purpose))
  const paid = course.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const extra = extras.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const price = Number(student.course_price || 0)
  return { paid, extra, price, left: Math.max(price - paid, 0), count: own.length }
}

export function formatMoney(value, locale = 'ru-RU') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(value || 0))
}

export function formatDate(value, withTime = false, locale = 'ru-RU') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(new Date(value))
}
