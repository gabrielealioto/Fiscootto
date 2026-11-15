-- Controller Forfettario: schema iniziale con Row Level Security.
-- Eseguire in Supabase → SQL Editor.

-- ─────────────────────────────────────────────────────────────
-- Movimenti
-- ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('entrata', 'uscita')),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null default 'Altro' check (char_length(category) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Parametri del regime forfettario (una riga per utente)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.settings (
  user_id              uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  coefficiente         numeric(5, 4) not null default 0.78   check (coefficiente > 0 and coefficiente <= 1),
  aliquota_contributi  numeric(5, 4) not null default 0.2607 check (aliquota_contributi >= 0 and aliquota_contributi < 1),
  aliquota_imposta     numeric(5, 4) not null default 0.15   check (aliquota_imposta >= 0 and aliquota_imposta < 1),
  updated_at           timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_select_own" on public.settings;
drop policy if exists "settings_insert_own" on public.settings;
drop policy if exists "settings_update_own" on public.settings;

create policy "settings_select_own" on public.settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert_own" on public.settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Report generati dall'AI
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period        text not null check (period in ('giorno', 'settimana', 'mese')),
  period_start  date not null,
  period_end    date not null,
  content       text not null,
  model         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "reports_insert_own" on public.reports;
drop policy if exists "reports_delete_own" on public.reports;

create policy "reports_select_own" on public.reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reports_delete_own" on public.reports
  for delete to authenticated using ((select auth.uid()) = user_id);
