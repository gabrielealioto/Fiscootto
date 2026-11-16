-- Ambito Work / Life: separa movimenti, categorie, regole, budget e ricorrenze
-- dell'attività (work) da quelli personali (life). Le tasse si calcolano solo su "work".

alter table public.transactions
  add column if not exists scope text not null default 'work' check (scope in ('work', 'life'));
create index if not exists transactions_user_scope_date_idx on public.transactions (user_id, scope, date desc);

alter table public.categories
  add column if not exists scope text not null default 'work' check (scope in ('work', 'life'));
alter table public.categories drop constraint if exists categories_user_id_kind_name_key;
alter table public.categories drop constraint if exists categories_user_scope_kind_name_key;
alter table public.categories add constraint categories_user_scope_kind_name_key unique (user_id, scope, kind, name);

alter table public.category_rules
  add column if not exists scope text not null default 'work' check (scope in ('work', 'life'));

alter table public.budgets
  add column if not exists scope text not null default 'work' check (scope in ('work', 'life'));
alter table public.budgets drop constraint if exists budgets_user_id_category_key;
alter table public.budgets drop constraint if exists budgets_user_scope_category_key;
alter table public.budgets add constraint budgets_user_scope_category_key unique (user_id, scope, category);

alter table public.recurring
  add column if not exists scope text not null default 'work' check (scope in ('work', 'life'));
