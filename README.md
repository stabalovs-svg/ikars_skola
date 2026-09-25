# IKARS AutoSchool CRM — Vue 3

Новая модульная версия CRM на Vue 3 + Vite + Supabase.

## Подключение

1. Скопируйте `.env.example` в `.env`.
2. Укажите `VITE_SUPABASE_URL` и клиентский publishable/anon key.
3. Выполните `npm install`, затем `npm run dev`.

Для GitHub Pages задайте `VITE_SUPABASE_URL` как переменную репозитория и
`VITE_SUPABASE_ANON_KEY` как секрет репозитория. Публикация выполняется
workflow-файлом при каждом push в `main`.

## Режимы работы

- **Демо-режим (без бэкенда)** — `VITE_DEMO_MODE=true`: данные хранятся в браузере
  посетителя, вход по ролям без пароля. Используется для публичных демонстраций.
- **Режим Supabase** — задайте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.

Обе переменные читаются на этапе сборки, поэтому их нужно задавать в настройках
**той системы, которая собирает сайт**: для Vercel — в Environment Variables проекта,
для GitHub Pages — в Variables/Secrets репозитория. Настройки из локального `.env`
работают только при локальной сборке и не попадают в автоматические сборки.

Приложение использует существующие таблицы `students`, `payments`, `profiles`,
`instructors`, `app_settings` и `event_log`. Доступ к данным должен
контролироваться политиками RLS в Supabase.
