-- Gestione previdenziale INPS e riduzione contributiva del 35% per forfettari artigiani e commercianti.
alter table public.settings
  add column if not exists gestione text not null default 'separata'
    check (gestione in ('separata', 'separata_ridotta', 'artigiani', 'commercianti', 'cassa')),
  add column if not exists riduzione_35 boolean not null default false;
