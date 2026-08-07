const isoDate = (daysFromToday = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

export const demoRoles = [
  { value: 'director', label: 'Direktors' },
  { value: 'admin', label: 'Administrators' },
  { value: 'accountant', label: 'Grāmatvedis' },
  { value: 'instructor', label: 'Instruktors' },
]

export function createDemoData() {
  const instructors = [
    { id: 'instructor-1', full_name: 'Mārtiņš Ozols', phone: '+371 20000011', car: 'Toyota Corolla', category: 'B', auth_user_id: 'demo-instructor' },
    { id: 'instructor-2', full_name: 'Elīna Bērziņa', phone: '+371 20000022', car: 'Volkswagen Golf', category: 'B', auth_user_id: null },
    { id: 'instructor-3', full_name: 'Jānis Kalniņš', phone: '+371 20000033', car: 'MAN TGL', category: 'C', auth_user_id: null },
  ]

  const students = [
    { id: 'student-1', full_name: 'Anna Kowalska', phone: '+371 21110001', email: 'anna@example.com', contract_number: 'IK-26041', category: 'B', instructor_id: 'instructor-1', birth_date: isoDate(-365 * 24 + 4), status: 'вождение', notes: 'Praktiskās nodarbības vakaros.', contract_date: isoDate(-210), contract_duration_months: 12, theory_start_date: isoDate(-180), course_price: 980, archived: false },
    { id: 'student-2', full_name: 'Thomas Müller', phone: '+371 21110002', email: 'thomas@example.com', contract_number: 'IK-26052', category: 'B', instructor_id: 'instructor-2', birth_date: isoDate(-365 * 31 + 9), status: 'теория', notes: 'Vēlas materiālus angļu valodā.', contract_date: isoDate(-80), contract_duration_months: 12, theory_start_date: isoDate(-45), course_price: 920, archived: false },
    { id: 'student-3', full_name: 'Emily Wilson', phone: '+371 21110003', email: 'emily@example.com', contract_number: 'IK-26058', category: 'B', instructor_id: null, birth_date: isoDate(-365 * 27 + 12), status: 'оформление', notes: 'Gaida instruktora piešķiršanu.', contract_date: isoDate(-18), contract_duration_months: 12, theory_start_date: null, course_price: 920, archived: false },
    { id: 'student-4', full_name: 'Piotr Nowak', phone: '+371 21110004', email: 'piotr@example.com', contract_number: 'IK-26036', category: 'C', instructor_id: 'instructor-3', birth_date: isoDate(-365 * 39 - 20), status: 'теория сдана', notes: '', contract_date: isoDate(-260), contract_duration_months: 18, theory_start_date: isoDate(-230), course_price: 1480, archived: false },
    { id: 'student-5', full_name: 'Sophie Martin', phone: '+371 21110005', email: 'sophie@example.com', contract_number: 'IK-26029', category: 'B', instructor_id: 'instructor-1', birth_date: isoDate(-365 * 22 + 2), status: 'вождение экзамен', notes: 'Skolas eksāmens nākamajā nedēļā.', contract_date: isoDate(-330), contract_duration_months: 12, theory_start_date: isoDate(-300), course_price: 980, archived: false },
    { id: 'student-6', full_name: 'Lukas Schmidt', phone: '+371 21110006', email: 'lukas@example.com', contract_number: 'IK-25087', category: 'B', instructor_id: 'instructor-2', birth_date: isoDate(-365 * 34 - 40), status: 'вождение сдано', notes: 'Apmācība pabeigta.', contract_date: isoDate(-500), contract_duration_months: 18, theory_start_date: isoDate(-470), course_price: 900, archived: true, archive_reason: 'completed', archived_at: isoDate(-12) },
  ]

  const payments = [
    { id: 'payment-1', student_id: 'student-1', payment_date: isoDate(-24), purpose: 'Теория', payment_method: 'Перевод', amount: 320 },
    { id: 'payment-2', student_id: 'student-1', payment_date: isoDate(-8), purpose: 'Вождение', payment_method: 'Карта', amount: 380 },
    { id: 'payment-3', student_id: 'student-2', payment_date: isoDate(-19), purpose: 'Теория', payment_method: 'Перевод', amount: 300 },
    { id: 'payment-4', student_id: 'student-3', payment_date: isoDate(-5), purpose: 'Теория', payment_method: 'Карта', amount: 220 },
    { id: 'payment-5', student_id: 'student-4', payment_date: isoDate(-27), purpose: 'Теория', payment_method: 'Перевод', amount: 480 },
    { id: 'payment-6', student_id: 'student-4', payment_date: isoDate(-3), purpose: 'Вождение', payment_method: 'Перевод', amount: 400 },
    { id: 'payment-7', student_id: 'student-5', payment_date: isoDate(-14), purpose: 'Вождение', payment_method: 'Карта', amount: 650 },
    { id: 'payment-8', student_id: 'student-5', payment_date: isoDate(-2), purpose: 'Экзамен', payment_method: 'Наличные', amount: 70 },
  ]

  const profiles = [
    { id: 'demo-director', full_name: 'Laura Liepa', role: 'director' },
    { id: 'demo-admin', full_name: 'Ilze Krūmiņa', role: 'admin' },
    { id: 'demo-accountant', full_name: 'Andris Siliņš', role: 'accountant' },
    { id: 'demo-instructor', full_name: 'Mārtiņš Ozols', role: 'instructor' },
  ]

  const events = [
    { id: 'event-1', user_id: 'demo-admin', student_id: 'student-3', event_type: 'student_created', description: 'Izveidota audzēkņa kartīte', created_at: `${isoDate(-5)}T09:10:00Z` },
    { id: 'event-2', user_id: 'demo-accountant', student_id: 'student-5', event_type: 'payment_added', description: 'Pievienots eksāmena maksājums', created_at: `${isoDate(-2)}T12:30:00Z` },
    { id: 'event-3', user_id: 'demo-instructor', student_id: 'student-1', event_type: 'status_changed', old_value: 'теория сдана', new_value: 'вождение', created_at: `${isoDate(-8)}T15:45:00Z` },
  ]

  return { students, instructors, payments, profiles, events }
}
