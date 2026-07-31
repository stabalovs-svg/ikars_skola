# IKARS AutoSchool CRM — Vue 3

Новая модульная версия CRM на Vue 3 + Vite + Supabase.

## Подключение

1. Скопируйте `.env.example` в `.env`.
2. Укажите `VITE_SUPABASE_URL` и клиентский publishable/anon key.
3. Выполните `npm install`, затем `npm run dev`.

Для GitHub Pages задайте `VITE_SUPABASE_URL` как переменную репозитория и
`VITE_SUPABASE_ANON_KEY` как секрет репозитория. Публикация выполняется
workflow-файлом при каждом push в `main`.

Приложение использует существующие таблицы `students`, `payments`, `profiles`,
`instructors`, `app_settings` и `event_log`. Доступ к данным должен
контролироваться политиками RLS в Supabase.
