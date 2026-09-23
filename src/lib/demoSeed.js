// Demo seed data for the public CRM demo.
// Everything here is fictional and lives only in the visitor's browser.
// Dates are generated relative to "today", so the demo always looks current.

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// YYYY-MM-DD for the day `days` days before today.
function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return isoDate(date)
}

// Local timestamp for the day `days` days before today.
function stampDaysAgo(days, hour, minute) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() - days)
  return `${isoDate(date)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

// Birth date whose next birthday is `days` days away, for someone aged `years`.
function birthdayIn(years, days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  date.setFullYear(date.getFullYear() - years)
  return isoDate(date)
}

export const demoSettings = {
  id: 1,
  school_name: 'GoDrive Driving School',
  product_name: 'AutoSchool CRM',
  language: 'en',
  tagline: 'Driving school management',
}

export const demoProfiles = [
  { id: 'demo-director', full_name: 'Sarah Johnson', role: 'director' },
  { id: 'demo-admin', full_name: 'Anna Roberts', role: 'admin' },
  { id: 'demo-accountant', full_name: 'Maria Garcia', role: 'accountant' },
  { id: 'demo-instructor', full_name: 'David Chen', role: 'instructor' },
  { id: 'demo-manager', full_name: 'John Smith', role: 'manager' },
]

export const demoInstructors = [
  { id: 1, auth_user_id: 'demo-instructor', full_name: 'David Chen' },
  { id: 2, auth_user_id: null, full_name: 'Anna White' },
  { id: 3, auth_user_id: null, full_name: 'Peter Brown' },
]

// Contracts, theory starts and completions are spread over the last ~6 months.
export const demoStudents = [
  { id: 1, full_name: 'Emma Wilson', phone: '+371 2000 0101', email: 'emma.w@example.com', contract_number: 'CT-001', category: 'B', instructor_id: 1, birth_date: '2001-03-15', status: 'вождение', notes: 'Progressing well', contract_date: dateDaysAgo(145), contract_duration_months: 12, course_price: 600, theory_start_date: dateDaysAgo(142), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 2, full_name: 'James Taylor', phone: '+371 2000 0102', email: 'james.t@example.com', contract_number: 'CT-002', category: 'B', instructor_id: 1, birth_date: birthdayIn(27, 4), status: 'теория', notes: 'Evening classes', contract_date: dateDaysAgo(110), contract_duration_months: 10, course_price: 500, theory_start_date: dateDaysAgo(107), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 3, full_name: 'Sophia Martinez', phone: '+371 2000 0103', email: 'sophia.m@example.com', contract_number: 'CT-003', category: 'A', instructor_id: 2, birth_date: '2000-11-08', status: 'вождение', notes: 'Motorcycle licence', contract_date: dateDaysAgo(117), contract_duration_months: 8, course_price: 450, theory_start_date: dateDaysAgo(114), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 4, full_name: 'Oliver Brown', phone: '+371 2000 0104', email: 'oliver.b@example.com', contract_number: 'CT-004', category: 'B', instructor_id: 2, birth_date: '2002-05-30', status: 'вождение', notes: 'Theory completed', contract_date: dateDaysAgo(138), contract_duration_months: 12, course_price: 600, theory_start_date: dateDaysAgo(134), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 5, full_name: 'Isabella Davis', phone: '+371 2000 0105', email: 'isabella.d@example.com', contract_number: 'CT-005', category: 'B', instructor_id: 3, birth_date: birthdayIn(25, 9), status: 'теория', notes: 'Enrolled recently', contract_date: dateDaysAgo(58), contract_duration_months: 12, course_price: 550, theory_start_date: dateDaysAgo(55), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 6, full_name: 'William Miller', phone: '+371 2000 0106', email: 'william.m@example.com', contract_number: 'CT-006', category: 'C', instructor_id: 1, birth_date: '1998-12-18', status: 'вождение', notes: 'Truck licence', contract_date: dateDaysAgo(124), contract_duration_months: 14, course_price: 800, theory_start_date: dateDaysAgo(121), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 7, full_name: 'Ava Johnson', phone: '+371 2000 0107', email: 'ava.j@example.com', contract_number: 'CT-007', category: 'B', instructor_id: 3, birth_date: '2003-02-28', status: 'вождение сдано', notes: 'Exam passed', contract_date: dateDaysAgo(180), contract_duration_months: 12, course_price: 600, theory_start_date: dateDaysAgo(175), archived: false, archive_reason: null, completed_at: dateDaysAgo(3), archived_at: null },
  { id: 8, full_name: 'Liam Wilson', phone: '+371 2000 0108', email: 'liam.w@example.com', contract_number: 'CT-008', category: 'B', instructor_id: 2, birth_date: '2000-06-14', status: 'теория', notes: 'Weekend group', contract_date: dateDaysAgo(103), contract_duration_months: 10, course_price: 500, theory_start_date: dateDaysAgo(100), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 9, full_name: 'Charlotte Moore', phone: '+371 2000 0109', email: 'charlotte.m@example.com', contract_number: 'CT-009', category: 'A', instructor_id: 1, birth_date: birthdayIn(25, 13), status: 'вождение', notes: 'Motorcycle training', contract_date: dateDaysAgo(131), contract_duration_months: 8, course_price: 450, theory_start_date: dateDaysAgo(128), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 10, full_name: 'Ethan Garcia', phone: '+371 2000 0110', email: 'ethan.g@example.com', contract_number: 'CT-010', category: 'B', instructor_id: 2, birth_date: '2002-04-20', status: 'теория сдана', notes: 'Waiting for driving', contract_date: dateDaysAgo(96), contract_duration_months: 12, course_price: 600, theory_start_date: dateDaysAgo(93), archived: false, archive_reason: null, completed_at: null, archived_at: null },
  { id: 11, full_name: 'Mia Robinson', phone: '+371 2000 0111', email: 'mia.r@example.com', contract_number: 'CT-011', category: 'B', instructor_id: 3, birth_date: '2001-11-30', status: 'оформление', notes: 'Just enrolled', contract_date: dateDaysAgo(0), contract_duration_months: 12, course_price: 550, theory_start_date: null, archived: false, archive_reason: null, completed_at: null, archived_at: null },
]


// Payments are dated so every one of the last six months carries revenue.
export const demoPayments = [
  { id: 1, student_id: 1, payment_date: dateDaysAgo(145), purpose: 'Теория', amount: 200, payment_method: 'Карта' },
  { id: 2, student_id: 1, payment_date: dateDaysAgo(82), purpose: 'Вождение', amount: 300, payment_method: 'Перевод' },
  { id: 3, student_id: 2, payment_date: dateDaysAgo(110), purpose: 'Теория', amount: 200, payment_method: 'Наличные' },
  { id: 4, student_id: 3, payment_date: dateDaysAgo(117), purpose: 'Теория', amount: 200, payment_method: 'Карта' },
  { id: 5, student_id: 3, payment_date: dateDaysAgo(36), purpose: 'Вождение', amount: 250, payment_method: 'Карта' },
  { id: 6, student_id: 4, payment_date: dateDaysAgo(138), purpose: 'Теория', amount: 200, payment_method: 'Перевод' },
  { id: 7, student_id: 4, payment_date: dateDaysAgo(68), purpose: 'Вождение', amount: 300, payment_method: 'Карта' },
  { id: 8, student_id: 5, payment_date: dateDaysAgo(58), purpose: 'Теория', amount: 250, payment_method: 'Наличные' },
  { id: 9, student_id: 6, payment_date: dateDaysAgo(124), purpose: 'Теория', amount: 300, payment_method: 'Карта' },
  { id: 10, student_id: 6, payment_date: dateDaysAgo(47), purpose: 'Вождение', amount: 400, payment_method: 'Перевод' },
  { id: 11, student_id: 7, payment_date: dateDaysAgo(160), purpose: 'Теория', amount: 300, payment_method: 'Карта' },
  { id: 12, student_id: 7, payment_date: dateDaysAgo(3), purpose: 'Экзамен', amount: 100, payment_method: 'Карта' },
  { id: 13, student_id: 8, payment_date: dateDaysAgo(103), purpose: 'Теория', amount: 200, payment_method: 'Наличные' },
  { id: 14, student_id: 9, payment_date: dateDaysAgo(131), purpose: 'Теория', amount: 200, payment_method: 'Перевод' },
  { id: 15, student_id: 10, payment_date: dateDaysAgo(96), purpose: 'Теория', amount: 200, payment_method: 'Наличные' },
  { id: 16, student_id: 10, payment_date: dateDaysAgo(22), purpose: 'Вождение', amount: 300, payment_method: 'Карта' },
  { id: 17, student_id: 11, payment_date: dateDaysAgo(0), purpose: 'Медицинская справка', amount: 30, payment_method: 'Наличные' },
]

export const demoEvents = [
  { id: 1, user_id: 'demo-admin', student_id: 1, event_type: 'student_created', old_value: '', new_value: 'Emma Wilson', description: 'Student created', metadata: null, created_at: stampDaysAgo(145, 9, 12) },
  { id: 2, user_id: 'demo-accountant', student_id: 1, event_type: 'payment_added', old_value: '', new_value: '200', description: 'Payment added', metadata: null, created_at: stampDaysAgo(145, 9, 20) },
  { id: 3, user_id: 'demo-admin', student_id: 1, event_type: 'status_changed', old_value: 'теория', new_value: 'вождение', description: 'Status changed', metadata: null, created_at: stampDaysAgo(82, 10, 5) },
  { id: 4, user_id: 'demo-accountant', student_id: 1, event_type: 'payment_added', old_value: '', new_value: '300', description: 'Payment added', metadata: null, created_at: stampDaysAgo(82, 14, 40) },
  { id: 5, user_id: 'demo-admin', student_id: 4, event_type: 'instructor_changed', old_value: '', new_value: '2', description: 'Student assigned', metadata: null, created_at: stampDaysAgo(136, 8, 30) },
  { id: 6, user_id: 'demo-instructor', student_id: 9, event_type: 'student_updated', old_value: '', new_value: 'Motorcycle training', description: 'Notes updated', metadata: { field: 'notes' }, created_at: stampDaysAgo(131, 16, 10) },
  { id: 7, user_id: 'demo-admin', student_id: 7, event_type: 'status_changed', old_value: 'вождение экзамен', new_value: 'вождение сдано', description: 'Exam passed', metadata: null, created_at: stampDaysAgo(3, 11, 55) },
  { id: 8, user_id: 'demo-accountant', student_id: 7, event_type: 'payment_added', old_value: '', new_value: '100', description: 'Payment added', metadata: null, created_at: stampDaysAgo(3, 12, 5) },
]
