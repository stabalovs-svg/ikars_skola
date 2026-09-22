-- Reset old data
delete from public.event_log;
delete from public.payments;
delete from public.students;
delete from public.instructors;
alter sequence public.instructors_id_seq restart with 1;
alter sequence public.students_id_seq restart with 1;
alter sequence public.payments_id_seq restart with 1;

-- Instructors
insert into public.instructors (auth_user_id, full_name) select id, 'David Chen' from auth.users where email = 'instructor@demo.lv';
insert into public.instructors (auth_user_id, full_name) select id, 'Anna White' from auth.users where email = 'instructor@demo.lv';
insert into public.instructors (auth_user_id, full_name) select id, 'Peter Brown' from auth.users where email = 'instructor@demo.lv';

-- Students and payments
DO $$ DECLARE v_i1 int; v_i2 int; v_i3 int; BEGIN
select id into v_i1 from public.instructors order by id limit 1 offset 0;
select id into v_i2 from public.instructors order by id limit 1 offset 1;
select id into v_i3 from public.instructors order by id limit 1 offset 2;

insert into public.students (full_name,phone,email,contract_number,category,instructor_id,birth_date,status,contract_date,course_price) values
('Emma Wilson','+37120000101','emma@mail.com','CT-001','B', v_i1, '2001-03-15','вождение','2026-05-10',600),
('James Taylor','+37120000102','james@mail.com','CT-002','B', v_i1, '1999-07-22','теория','2026-07-01',500),
('Sophia Martinez','+37120000103','sophia@mail.com','CT-003','A', v_i2, '2000-11-08','вождение','2026-06-01',450),
('Oliver Brown','+37120000104','oliver@mail.com','CT-004','B', v_i2, '2002-05-30','вождение','2026-04-20',600),
('William Miller','+37120000106','william@mail.com','CT-006','C', v_i1, '1998-12-18','вождение','2026-05-05',800),
('Ava Johnson','+37120000107','ava@mail.com','CT-007','B', v_i3, '2003-02-28','вождение сдано','2026-03-01',600),
('Liam Wilson','+37120000108','liam@mail.com','CT-008','B', v_i2, '2000-06-14','теория','2026-07-01',500),
('Charlotte Moore','+37120000109','charlotte@mail.com','CT-009','A', v_i1, '2001-08-05','вождение','2026-06-10',450),
('Ethan Garcia','+37120000110','ethan@mail.com','CT-010','B', v_i2, '2002-04-20','теория сдана','2026-06-01',600),
('Mia Robinson','+37120000111','mia@mail.com','CT-011','B', v_i3, '2001-11-30','оформление','2026-07-20',550);

insert into public.payments (student_id, payment_date, purpose, amount, payment_method) values
(1, '2026-05-10','Теория',200,'Карта'), (1, '2026-06-15','Вождение',300,'Перевод'),
(2, '2026-07-01','Полный курс',500,'Наличные'),
(3, '2026-06-05','Теория',200,'Карта'), (3, '2026-07-10','Вождение',250,'Карта'),
(4, '2026-04-20','Теория',200,'Перевод'), (4, '2026-06-15','Вождение',300,'Карта'),
(5, '2026-05-05','Теория',300,'Карта'), (5, '2026-07-01','Вождение',400,'Перевод'),
(6, '2026-03-01','Полный курс',600,'Карта'), (6, '2026-07-10','Экзамен',100,'Карта'),
(8, '2026-07-01','Полный курс',500,'Наличные'),
(9, '2026-06-12','Теория',200,'Перевод'),
(10, '2026-06-03','Теория',200,'Наличные'), (10, '2026-07-15','Вождение',300,'Карта');
END; $$;
