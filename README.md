# Выезд на природу — выбор дат

Одна ссылка на поездку: все открывают, вводят имя и отмечают удобные выходные (середина апреля — конец мая). Приложение само считает **2 лучших варианта** по числу совпадений и показывает **среднюю температуру и погоду в Волгограде** по данным за прошлый год.

## Как пользоваться

1. Открой приложение (файл `index.html` или через локальный сервер).
2. Нажми **«Создать поездку»** — появится ссылка. Скопируй и отправь в чат.
3. Кто открывает ссылку — видит список уже добавившихся, вводит своё имя, отмечает выходные и жмёт **«Добавить меня»**. Данные сохраняются автоматически.
4. Внизу сразу видны **2 лучших варианта** выходных: сколько человек может, список имён и погода в Волгограде (средняя температура и описание по данным за 2024 г.).

Регистрация не нужна. Если не настраивать облако — можно работать в **режиме без облака** (ссылка `?trip=local`): данные только в твоём браузере, для себя.

## Сохранение данных (облако)

Чтобы ссылка была общей для всех и данные хранились в одном месте, настрой **Supabase** (бесплатно, без своего сервера):

1. Зайди на [supabase.com](https://supabase.com), создай проект.
2. В разделе **SQL Editor** выполни:

```sql
-- Таблица поездок (одна строка = одна ссылка)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- Участники поездки
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  weekends text not null,
  created_at timestamptz default now()
);

-- Доступ без регистрации: все могут читать и добавлять участников по trip_id
alter table public.trips enable row level security;
alter table public.participants enable row level security;

create policy "trips read" on public.trips for select to anon using (true);
create policy "trips insert" on public.trips for insert to anon with check (true);

create policy "participants read" on public.participants for select to anon using (true);
create policy "participants insert" on public.participants for insert to anon with check (true);
create policy "participants delete" on public.participants for delete to anon using (true);
```

3. В разделе **Settings → API** скопируй **Project URL** и **anon public** key.
4. В `app.js` в начале файла подставь **Project URL** и **anon** key в константы `SUPABASE_URL` и `SUPABASE_ANON_KEY`.

После этого «Создать поездку» будет сохранять поездку в Supabase, ссылка станет общей, а участники — общими для всех, кто её откроет.

## Погода

Для двух лучших выходных показывается погода в **Волгограде**: средняя температура и описание (ясно, облачно, дождь и т.д.) по данным **Open-Meteo** за 2024 год (archive API). Без API-ключей.

## Запуск

```bash
npx serve .
# или
python3 -m http.server 8000
```

Открой в браузере указанный адрес.
