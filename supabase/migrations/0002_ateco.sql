-- Codice ATECO dell'attività, usato per proporre il coefficiente di redditività.
alter table public.settings
  add column if not exists ateco text not null default ''
  check (ateco ~ '^([0-9]{2}(\.[0-9]{2}(\.[0-9]{2})?)?)?$');
