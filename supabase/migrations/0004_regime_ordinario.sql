-- Regime ordinario / semplificato: IVA sui movimenti, regime fiscale e addizionali IRPEF.
alter table public.transactions
  add column if not exists iva numeric(4, 2) not null default 0
    check (iva in (0, 4, 5, 10, 22));

alter table public.settings
  add column if not exists regime text not null default 'forfettario'
    check (regime in ('forfettario', 'ordinario')),
  add column if not exists addizionale_regionale numeric(5, 4) not null default 0.0123
    check (addizionale_regionale >= 0 and addizionale_regionale <= 0.05),
  add column if not exists addizionale_comunale numeric(5, 4) not null default 0.008
    check (addizionale_comunale >= 0 and addizionale_comunale <= 0.02);
