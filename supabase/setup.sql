-- IKARS School CRM - Database Setup
-- Run this in Supabase SQL Editor

-- 1. TABLES
create table if not exists public.profiles ( id uuid references auth.users primary key, full_name text, role text );
alter table public.profiles enable row level security;
create table if not exists public.instructors ( id serial primary key, auth_user_id uuid references auth.users, full_name text );
alter table public.instructors enable row level security;
create table if not exists public.students ( id serial primary key, full_name text, phone text, email text, contract_number text, category text, instructor_id integer references public.instructors(id), birth_date date, status text, notes text, contract_date date, contract_duration_months integer, course_price numeric, theory_start_date date, archived boolean default false, archive_reason text );
alter table public.students enable row level security;
create table if not exists public.payments ( id serial primary key, student_id integer references public.students(id), payment_date date, purpose text, amount numeric, payment_method text );
alter table public.payments enable row level security;
create table if not exists public.event_log ( id serial primary key, user_id uuid references auth.users, student_id integer references public.students(id), event_type text, old_value text, new_value text, description text, metadata jsonb, created_at timestamptz default now() );
alter table public.event_log enable row level security;
create table if not exists public.app_settings ( id serial primary key, school_name text, product_name text, language text default 'en', tagline text, updated_at timestamptz default now() );
alter table public.app_settings enable row level security;
-- 2. RLS POLICIES
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
drop policy if exists "instructors_select" on public.instructors;
create policy "instructors_select" on public.instructors for select to authenticated using (true);
drop policy if exists "students_select" on public.students;
create policy "students_select" on public.students for select to authenticated using (true);
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments for select to authenticated using (true);
drop policy if exists "event_log_select" on public.event_log;
create policy "event_log_select" on public.event_log for select to authenticated using (true);
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings for select to authenticated using (true);
-- 3. DEMO SETTINGS
insert into public.app_settings (school_name, product_name, language, tagline)
values ('GoDrive Driving School', 'AutoSchool CRM', 'en', 'Driving school management');
