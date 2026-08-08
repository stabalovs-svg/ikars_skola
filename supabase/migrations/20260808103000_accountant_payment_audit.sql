-- Payment mutations and their audit records must succeed or fail together.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.add_payment_with_audit(
  p_student_id text,
  p_payment_date date,
  p_purpose text,
  p_amount numeric,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_payment public.payments%rowtype;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is null or v_role not in ('admin', 'manager', 'accountant') then
    raise exception 'Not allowed to add payments';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  insert into public.payments (student_id, payment_date, purpose, amount, payment_method)
  select student.id, p_payment_date, p_purpose, p_amount, p_payment_method
  from public.students as student
  where student.id::text = p_student_id
  returning * into v_payment;

  if not found then
    raise exception 'Student not found';
  end if;

  insert into public.event_log (
    user_id, student_id, event_type, old_value, new_value, description, metadata
  ) values (
    auth.uid(),
    v_payment.student_id,
    'payment_added',
    '',
    v_payment.amount::text,
    'Payment added',
    to_jsonb(v_payment) || jsonb_build_object('payment_id', v_payment.id::text)
  );

  return to_jsonb(v_payment);
end;
$$;

create or replace function public.delete_payment_with_audit(
  p_payment_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_payment public.payments%rowtype;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is null or v_role not in ('admin', 'manager', 'accountant') then
    raise exception 'Not allowed to delete payments';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Deletion reason is required';
  end if;

  select * into v_payment
  from public.payments
  where id::text = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  delete from public.payments
  where id = v_payment.id;

  insert into public.event_log (
    user_id, student_id, event_type, old_value, new_value, description, metadata
  ) values (
    auth.uid(),
    v_payment.student_id,
    'payment_deleted',
    v_payment.amount::text,
    '',
    'Incorrect payment deleted',
    to_jsonb(v_payment) || jsonb_build_object(
      'payment_id', v_payment.id::text,
      'deleted_at', now(),
      'reason', btrim(p_reason)
    )
  );

  return to_jsonb(v_payment);
end;
$$;

revoke all on function public.add_payment_with_audit(text, date, text, numeric, text) from public;
revoke all on function public.delete_payment_with_audit(text, text) from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.add_payment_with_audit(text, date, text, numeric, text) to authenticated;
grant execute on function public.delete_payment_with_audit(text, text) to authenticated;
grant execute on function public.current_user_role() to authenticated;

drop policy if exists accountant_read_payment_events on public.event_log;
create policy accountant_read_payment_events
on public.event_log
for select
to authenticated
using (
  event_type in ('payment_added', 'payment_deleted')
  and public.current_user_role() = 'accountant'
);

drop policy if exists accountant_read_employee_names on public.profiles;
create policy accountant_read_employee_names
on public.profiles
for select
to authenticated
using (
  public.current_user_role() = 'accountant'
);
