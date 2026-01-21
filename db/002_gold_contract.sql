-- CONTRATO GOLD (Neon/Postgres)
-- Idempotente: pode rodar varias vezes no SQL Editor sem quebrar.

-- 1) Campos novos em qr_leads
alter table public.qr_leads
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists consent boolean not null default true;

-- 2) Index/constraint para upsert por phone
create unique index if not exists qr_leads_phone_uniq on public.qr_leads (phone);

-- 3) Tabela de rate limit (por IP + endpoint + minuto)
create table if not exists public.api_rate_limits (
  ip text not null,
  endpoint text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, endpoint, window_start)
);

-- 4) Trigger para updated_at (se quiser automatizar)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_qr_leads_updated_at on public.qr_leads;
create trigger trg_qr_leads_updated_at
before update on public.qr_leads
for each row execute function public.set_updated_at();
