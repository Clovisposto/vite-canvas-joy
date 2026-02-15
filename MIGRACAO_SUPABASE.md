# 🔄 Análise de Migração — Supabase → Backend Próprio

> O que o Supabase faz hoje, o que seria necessário substituir, e os desafios envolvidos.

**Última atualização:** Fevereiro 2026

---

## 1. O que o Supabase faz neste projeto

### 1.1 Banco de Dados (PostgreSQL)

O Supabase hospeda um PostgreSQL com **30 tabelas**, incluindo:

| Grupo | Tabelas | Função |
|-------|---------|--------|
| **Clientes** | `wa_contacts`, `checkins`, `complaints` | Cadastro, check-ins, reclamações |
| **WhatsApp** | `whatsapp_settings`, `whatsapp_logs`, `wa_messages`, `wa_templates`, `whatsapp_campaigns`, `whatsapp_campaign_recipients`, `whatsapp_optout`, `ai_whatsapp_logs` | Configuração, logs, mensagens, campanhas, opt-out |
| **Financeiro** | `livro_caixa`, `stone_tef_logs` | Livro caixa, logs TEF Stone |
| **Promoções/Sorteios** | `promotions`, `raffles`, `raffle_runs`, `premios_qr`, `premios_qr_consumos` | Promoções, sorteios, prêmios QR |
| **Frentistas** | `frentistas`, `frentistas_pins`, `frentista_metas`, `qr_capture_points` | Gestão de frentistas e pontos de captura |
| **Admin** | `profiles`, `user_roles`, `audit_logs`, `settings`, `system_documentation` | Usuários, permissões, auditoria |
| **IA** | `ai_chat_history`, `ai_commands`, `ai_command_logs`, `ai_settings` | Assistente IA |
| **Outros** | `dispatch_history`, `messages_queue`, `bulk_send_jobs`, `imports_logs`, `checkin_public_links` | Filas, importações, links públicos |

**Migração:** Exportar schema + dados para um PostgreSQL próprio (Railway, Neon, ou self-hosted). O schema SQL já existe em `db/001_neon_schema.sql`.

---

### 1.2 Autenticação (Supabase Auth)

O Supabase fornece **autenticação completa**:

- Login por email/senha
- Sessões JWT automáticas
- Refresh token automático
- Trigger `handle_new_user()` para criar perfil automaticamente
- Tabela `profiles` com roles (`admin`, `operador`, `viewer`)
- Tabela `user_roles` com enum `app_role`

**O que substituir:**
- Implementar auth próprio (ex: [Lucia Auth](https://lucia-auth.com/), [Auth.js](https://authjs.dev/), ou JWT manual)
- Criar endpoints: `/api/login`, `/api/register`, `/api/refresh-token`, `/api/logout`
- Gerenciar sessões e tokens manualmente
- Recriar o sistema RBAC (`is_admin()`, `is_staff()`, `has_role()`)

**Complexidade: 🔴 Alta** — Auth é o componente mais crítico e propenso a falhas de segurança.

---

### 1.3 Row-Level Security (RLS)

O projeto usa **RLS extensivamente** para controle de acesso:

```sql
-- Exemplo: só staff pode ver checkins
CREATE POLICY "Staff can read checkins"
ON public.checkins FOR SELECT
USING (is_staff());
```

**30+ políticas RLS** protegem dados por role. Sem RLS, toda essa lógica precisa ser replicada em **middleware do backend**.

**O que substituir:**
- Middleware de autorização em cada endpoint da API
- Decorators/guards por role em cada rota
- Testes de segurança para cada endpoint

**Complexidade: 🔴 Alta** — Fácil esquecer um endpoint e expor dados.

---

### 1.4 Edge Functions (Serverless)

O projeto tem **14 Edge Functions** (Deno/TypeScript):

| Function | O que faz | Integração externa? |
|----------|-----------|-------------------|
| `wa-send` | Envia mensagens WhatsApp | ✅ Evolution API |
| `wa-webhook` | Recebe webhooks do WhatsApp | ✅ Evolution API |
| `wa-campaign-run` | Executa campanhas em massa | ✅ Evolution API |
| `wa-instance-manage` | Gerencia instância WhatsApp | ✅ Evolution API |
| `wa-ai-chatbot` | Chatbot IA via WhatsApp | ✅ Evolution API + OpenAI |
| `ai-assistant` | Assistente IA do admin | ✅ OpenAI (via Lovable Gateway) |
| `ai-generate-variations` | Gera variações de texto | ✅ OpenAI (via Lovable Gateway) |
| `raffle-confirmation` | Confirma sorteios via WhatsApp | ✅ Evolution API |
| `rating-response` | Responde avaliações | ✅ Evolution API |
| `stone-webhook` | Recebe webhooks TEF Stone | ✅ Stone |
| `send-whatsapp` | (Duplicada) Envia WhatsApp | ✅ Evolution API |
| `whatsapp-send` | (Duplicada) Envia WhatsApp | ✅ Evolution API |
| `whatsapp-test` | Testa envio WhatsApp | ✅ Evolution API |
| `log-cleanup` | Limpa logs antigos | ❌ Interno |

**O que substituir:**
- Cada Edge Function vira um endpoint em Node.js/Express, Fastify, ou similar
- Manter a mesma lógica de integração com Evolution API e OpenAI
- Configurar webhooks para apontar para o novo backend
- Gerenciar deploy e hosting das APIs

**Complexidade: 🟡 Média** — O código já existe, é questão de adaptar de Deno para Node.js.

---

### 1.5 Secrets (Variáveis de Ambiente)

Secrets gerenciados pelo Supabase:

| Secret | Uso |
|--------|-----|
| `EVOLUTION_API_URL` | URL da Evolution API |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância WhatsApp |
| `OPENAI_API_KEY` | Chave OpenAI para IA |
| `LOVABLE_API_KEY` | Gateway IA do Lovable |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso admin ao banco |

**O que substituir:**
- `.env` file ou serviço de secrets (Railway, Doppler, AWS Secrets Manager)
- Configurar em cada ambiente (dev, staging, prod)

**Complexidade: 🟢 Baixa**

---

### 1.6 Funções do Banco (RPC)

Funções PostgreSQL chamadas diretamente do frontend via `supabase.rpc()`:

| Função | O que faz |
|--------|-----------|
| `public_create_checkin_and_token` | Cria check-in + token público (SECURITY DEFINER) |
| `get_premio_publico` | Busca prêmio por código |
| `get_public_checkin_status` | Status do check-in por token |
| `abater_com_frentista` | Abate valor de prêmio |
| `is_admin()` / `is_staff()` / `has_role()` | Verificação de roles |

**O que substituir:**
- Cada RPC vira um endpoint REST
- As funções SQL podem permanecer no PostgreSQL, mas o frontend chamaria via API em vez de `supabase.rpc()`

**Complexidade: 🟡 Média**

---

### 1.7 Cliente Frontend (SDK)

O frontend usa `@supabase/supabase-js` em **todos os componentes** para:

```typescript
import { supabase } from "@/integrations/supabase/client";

// Queries diretas
const { data } = await supabase.from('checkins').select('*');

// Auth
const { data: session } = await supabase.auth.getSession();

// RPC
const { data } = await supabase.rpc('public_create_checkin_and_token', { p_phone: '...' });

// Realtime (se usado)
supabase.channel('...').on('postgres_changes', ...);
```

**O que substituir:**
- Criar um cliente HTTP (axios/fetch) para chamar a API própria
- Substituir **todas** as chamadas `supabase.from()`, `supabase.rpc()`, `supabase.auth.*` no frontend
- Estimar **50-100+ pontos de mudança** no código frontend

**Complexidade: 🔴 Alta** — É a mudança com maior volume de trabalho.

---

## 2. Resumo de Esforço

| Componente | Esforço | Tempo estimado |
|-----------|---------|---------------|
| PostgreSQL (migrar dados) | 🟢 Baixo | 1 dia |
| Autenticação | 🔴 Alto | 3-5 dias |
| RLS → Middleware | 🔴 Alto | 3-5 dias |
| Edge Functions → API REST | 🟡 Médio | 3-5 dias |
| Secrets | 🟢 Baixo | 1 hora |
| RPCs → Endpoints | 🟡 Médio | 1-2 dias |
| Frontend (trocar SDK) | 🔴 Alto | 5-7 dias |
| Testes e validação | 🟡 Médio | 3-5 dias |
| **Total estimado** | | **~3-4 semanas** |

---

## 3. Arquitetura Proposta (Pós-Migração)

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│           (React + Vite + Tailwind)          │
│                                              │
│  supabase.from() → fetch('/api/...')         │
│  supabase.auth   → fetch('/api/auth/...')    │
│  supabase.rpc()  → fetch('/api/rpc/...')     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              Backend API                     │
│     (Node.js + Express/Fastify)              │
│                                              │
│  ├── /api/auth/*     (login, register, etc)  │
│  ├── /api/checkins   (CRUD)                  │
│  ├── /api/whatsapp/* (send, campaigns)       │
│  ├── /api/rpc/*      (funções especiais)     │
│  └── /webhooks/*     (Stone, Evolution)      │
│                                              │
│  Middleware: auth → role check → handler     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           PostgreSQL (Railway/Neon)           │
│                                              │
│  Mesmo schema, sem RLS                       │
│  Funções SQL mantidas                        │
│  Autorização via middleware do backend        │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│          Serviços Externos                   │
│                                              │
│  ├── Evolution API (WhatsApp)                │
│  ├── OpenAI (IA)                             │
│  └── Stone (TEF)                             │
└─────────────────────────────────────────────┘
```

---

## 4. Vantagens da Migração

| Vantagem | Detalhes |
|----------|---------|
| ✅ Ambientes isolados | Dev, staging, prod totalmente separados |
| ✅ Controle total | Deploy, escalabilidade, custos previsíveis |
| ✅ Sem vendor lock-in | Não depende do Supabase/Lovable |
| ✅ Edge Functions separadas | Cada deploy é independente |
| ✅ Flexibilidade | Escolher qualquer stack/hosting |

---

## 5. Riscos da Migração

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| 🔴 Bugs de auth | Usuários sem acesso ou com acesso indevido | Testes extensivos de auth + pentest |
| 🔴 Downtime | Sistema fora do ar durante migração | Migração gradual com feature flags |
| 🟡 Regressões | Funcionalidades quebradas | Testes E2E antes de desligar Supabase |
| 🟡 Custo inicial | Tempo de desenvolvimento | Fazer em fases |
| 🟢 Dados | Perda de dados na migração | Backup completo antes de migrar |

---

## 6. Estratégia de Migração Recomendada

### Fase 1 — Backend API (sem mudar frontend)
1. Criar API Node.js com os mesmos endpoints
2. Implementar auth (JWT próprio)
3. Migrar Edge Functions para rotas Express
4. Apontar webhooks (Stone, Evolution) para o novo backend

### Fase 2 — Criar camada de compatibilidade
1. Criar um "supabase-like client" que redireciona para a API própria
2. Minimizar mudanças no frontend: `supabase.from('x')` → `api.from('x')`

### Fase 3 — Migrar frontend gradualmente
1. Trocar chamadas Supabase por chamadas à API, módulo por módulo
2. Começar pelos módulos menos críticos (IA, documentação)
3. Terminar com os críticos (auth, check-ins, WhatsApp)

### Fase 4 — Desligar Supabase
1. Migrar dados finais
2. Atualizar DNS/URLs
3. Desligar projeto Supabase

---

## 7. Alternativa: Manter Supabase + Melhorar

Se a migração parecer muito custosa, considerar:

1. **Manter Supabase** como banco + auth
2. **Migrar Edge Functions** para um servidor Node.js próprio (Railway)
3. Isso resolve o problema principal (Edge Functions compartilhadas) sem reescrever o frontend
4. Custo: ~1 semana vs ~4 semanas da migração completa

---

> 📝 Este documento deve ser revisado antes de iniciar qualquer migração.
