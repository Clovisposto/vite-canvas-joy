-- Posto 7 Digital (Neon/Postgres) - Schema minimo

create table if not exists qr_leads (
  id bigserial primary key,
  phone text not null,
  name text,
  accepts_promo boolean not null default true,
  accepts_raffle boolean not null default true,
  lgpd_consent boolean not null default true,
  tag text,
  attendant_code text,
  source text not null default 'pwa',
  ip text,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_leads_phone on qr_leads(phone);
create index if not exists idx_qr_leads_created_at on qr_leads(created_at);

create table if not exists campaigns (
  id bigserial primary key,
  title text not null,
  template text not null,
  params jsonb not null,
  status text not null default 'QUEUED',
  created_at timestamptz not null default now()
);

create table if not exists campaign_recipients (
  id bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  phone text not null,
  status text not null default 'PENDING',
  wa_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, phone)
);

create index if not exists idx_campaign_recipients_status on campaign_recipients(status);
create index if not exists idx_campaign_recipients_campaign on campaign_recipients(campaign_id);
