-- Pianificazione: categorie personalizzate, regole di categorizzazione, budget,
-- spese ricorrenti e obiettivi di risparmio. Ogni tabella è visibile solo al proprietario.

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('entrata', 'uscita')),
  name        text not null check (char_length(name) between 1 and 60),
  deducibile  numeric(4, 3) not null default 1 check (deducibile >= 0 and deducibile <= 1),
  created_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern     text not null check (char_length(pattern) between 2 and 80),
  kind        text not null check (kind in ('entrata', 'uscita')),
  category    text not null check (char_length(category) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table if not exists public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category       text not null check (char_length(category) between 1 and 60),
  monthly_limit  numeric(12, 2) not null check (monthly_limit > 0),
  created_at     timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists public.recurring (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  kind        text not null default 'uscita' check (kind in ('entrata', 'uscita')),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null check (char_length(category) between 1 and 60),
  iva         numeric(4, 2) not null default 0 check (iva in (0, 4, 5, 10, 22)),
  frequency   text not null check (frequency in ('settimanale', 'mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale')),
  next_date   date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  target      numeric(12, 2) not null check (target > 0),
  saved       numeric(12, 2) not null default 0 check (saved >= 0),
  deadline    date,
  created_at  timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories (user_id);
create index if not exists category_rules_user_idx on public.category_rules (user_id);
create index if not exists budgets_user_idx on public.budgets (user_id);
create index if not exists recurring_user_next_idx on public.recurring (user_id, next_date);
create index if not exists goals_user_idx on public.goals (user_id);

do $$
declare t text;
begin
  foreach t in array array['categories', 'category_rules', 'budgets', 'recurring', 'goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_owner', t);
  end loop;
end $$;
