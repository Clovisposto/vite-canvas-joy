# Contrato GOLD — API Posto 7 Digital

Objetivo: padronizar o backend (Vercel Functions + Neon) para operar com seguranca, previsibilidade e escalabilidade.

## Regras de comportamento

1) Token obrigatorio
- Header: x-app-token: <...>
- Variavel: APP_TOKEN (Vercel Env)

2) CORS restrito
- Variavel: ALLOWED_ORIGINS (lista separada por virgula)
- Exemplo: https://posto-7-digital.vercel.app

3) Upsert por phone
- Constraint/Index: qr_leads(phone) unique

4) Rate limit por IP/minuto (DB-backed)
- Tabela: public.api_rate_limits
- Variavel: RATE_LIMIT_PER_MIN (default 60)
- Variavel: RATE_LIMIT_DISABLED=1 desliga (somente debug)

5) Fail-open do limiter
- Se DB falhar, a API responde normalmente e loga RATE_LIMIT_DB_ERROR

## Checklist de deploy

A) Neon (SQL Editor)
- Execute: db/002_gold_contract.sql

B) Vercel (Environment Variables)
- APP_TOKEN = (seu token)
- ALLOWED_ORIGINS = https://posto-7-digital.vercel.app
- RATE_LIMIT_PER_MIN = 60 (ou 3 pra testar)
- RATE_LIMIT_DISABLED = 0

C) Redeploy
- Qualquer push no main dispara deploy, ou redeploy manual.

## Teste rapido (PowerShell)

POST lead:
Invoke-RestMethod -Method Post `
  -Uri https://posto-7-digital.vercel.app/api/leads `
  -Headers @{ "x-app-token"="<APP_TOKEN>" } `
  -ContentType "application/json" `
  -Body (@{ phone="5591999999999"; source="test"; lgpd_consent=$true; acceptsPromo=$true; acceptsRaffle=$true } | ConvertTo-Json)

GET leads:
Invoke-RestMethod -Method Get `
  -Uri "https://posto-7-digital.vercel.app/api/leads?limit=10&offset=0" `
  -Headers @{ "x-app-token"="<APP_TOKEN>" }
