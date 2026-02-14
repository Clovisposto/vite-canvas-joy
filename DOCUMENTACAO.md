# 📋 Documentação Completa — Posto 7 Sistema de Fidelidade

> Última atualização: 2026-02-14

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitetura](#arquitetura)
4. [Schema do Banco de Dados](#schema-do-banco-de-dados)
5. [Telas & Rotas](#telas--rotas)
6. [Fluxos do Sistema](#fluxos-do-sistema)
7. [Edge Functions](#edge-functions)
8. [Database Functions (RPC)](#database-functions-rpc)
9. [Autenticação & RBAC](#autenticação--rbac)
10. [Row-Level Security (RLS)](#row-level-security-rls)
11. [Integrações Externas](#integrações-externas)
12. [Secrets & Variáveis de Ambiente](#secrets--variáveis-de-ambiente)
13. [Componentes Principais](#componentes-principais)
14. [Deploy & Infraestrutura](#deploy--infraestrutura)

---

## Visão Geral

**Posto 7** é uma plataforma completa de fidelidade e gestão para postos de combustível, composta por:

- **PWA do Cliente** — Cadastro via QR Code, participação em sorteios e promoções
- **Painel Administrativo** — Dashboard, gestão de frentistas, promoções, sorteios, campanhas WhatsApp
- **Assistente IA** — Comandos de voz e texto para executar ações no sistema
- **Integração WhatsApp** — Envio automatizado via Evolution API / Cloud API
- **Integração Stone TEF** — Recepção de transações de pagamento via webhook
- **Livro Caixa** — Controle financeiro básico
- **QR Premiação** — Sistema de prêmios com saldo consumível via QR Code

---

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilização | Tailwind CSS + shadcn/ui |
| Animações | Framer Motion |
| Gráficos | Recharts |
| State Management | TanStack React Query + Context API |
| QR Code | qrcode.react |
| Backend | Supabase (PostgreSQL + Edge Functions + Auth) |
| Edge Functions | Deno (Supabase Edge) |
| IA | Lovable AI Gateway (Gemini) |
| WhatsApp | Evolution API / Meta Cloud API |
| Pagamentos | Stone TEF (webhook) |
| Deploy Frontend | Vercel |
| Deploy Backend | Supabase Cloud |

---

## Arquitetura

```
┌──────────────────────┐     ┌──────────────────────────────┐
│   PWA do Cliente     │────▶│       Supabase Backend       │
│   /aplicativo        │     │                              │
└──────────────────────┘     │  ┌────────────────────────┐  │
                             │  │  PostgreSQL             │  │
┌──────────────────────┐     │  │  30+ tabelas com RLS   │  │
│   Painel Admin       │────▶│  └────────────────────────┘  │
│   /admin/*           │     │                              │
└──────────────────────┘     │  ┌────────────────────────┐  │
                             │  │  Edge Functions         │  │
┌──────────────────────┐     │  │  14 funções Deno       │  │
│   Stone TEF          │────▶│  └────────────────────────┘  │
│   Webhook            │     │                              │
└──────────────────────┘     │  ┌────────────────────────┐  │
                             │  │  Auth (Supabase)        │  │
┌──────────────────────┐     │  │  RBAC via user_roles   │  │
│   Evolution API      │◀───│  └────────────────────────┘  │
│   WhatsApp           │     │                              │
└──────────────────────┘     └──────────────────────────────┘
```

---

## Schema do Banco de Dados

### Contatos & Clientes

#### `wa_contacts` — Tabela principal de contatos/clientes
> Substituiu a antiga tabela `customers`. Centraliza dados de contato e consentimento LGPD.

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK, gen_random_uuid() |
| `phone` | varchar | **UNIQUE**, formato E.164 (ex: 5594991234567) |
| `name` | varchar | Nome do cliente |
| `opt_in` | boolean | Consentimento de marketing (LGPD) |
| `opt_in_timestamp` | timestamptz | Data do consentimento |
| `opt_out_timestamp` | timestamptz | Data do opt-out |
| `opt_out_reason` | varchar | Motivo do cancelamento |
| `flow_state` | text | Estado no fluxo: `new`, `active`, etc |
| `wa_id` | varchar | ID do WhatsApp |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |

#### `whatsapp_optout` — Registro de opt-out

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `phone_e164` | text | Telefone E.164 |
| `reason` | text | Motivo |
| `created_at` | timestamptz | |

---

### Check-ins & Operações

#### `checkins` — Registros de abastecimento/check-in

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `phone` | text | NOT NULL, FK → wa_contacts.phone |
| `customer_id` | uuid | Legacy FK (customers) |
| `attendant_code` | text | Código do frentista |
| `payment_method` | text | pix, dinheiro, debito, credito |
| `amount` | numeric(10,2) | Valor em R$ |
| `liters` | numeric(10,2) | Litros abastecidos |
| `tag` | text | Tag do ponto de captura QR |
| `origin` | text | `pwa`, `stone`, `api` |
| `is_demo` | boolean | Flag de dado demo |
| `stone_tef_id` | uuid | FK → stone_tef_logs |
| `created_at` | timestamptz | |

#### `checkin_public_links` — Links públicos temporários

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `checkin_id` | uuid | FK → checkins |
| `token` | text | Token público único |
| `expires_at` | timestamptz | Expira em 24h |

---

### Frentistas & Stone TEF

#### `frentistas` — Cadastro de atendentes

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `nome` | text | NOT NULL |
| `codigo` | text | NOT NULL, código único |
| `terminal_id` | varchar | Terminal Stone vinculado |
| `is_active` | boolean | Default: true |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `frentistas_pins` — PINs de autenticação (hash)

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `frentista_id` | uuid | FK → frentistas, UNIQUE |
| `pin_hash` | text | Hash do PIN |
| `is_active` | boolean | |

#### `frentista_metas` — Metas de desempenho

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `frentista_id` | uuid | FK → frentistas |
| `target_checkins` | integer | Meta de check-ins (default 50) |
| `target_amount` | numeric | Meta de valor R$ |
| `period_type` | text | monthly, weekly |
| `start_date` | date | Início do período |
| `end_date` | date | Fim do período |
| `is_active` | boolean | |

#### `stone_tef_logs` — Transações Stone TEF

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `valor` | numeric | Valor da transação |
| `forma_pagamento` | varchar | credito, debito, pix |
| `terminal_id` | varchar | ID do terminal |
| `frentista_id` | varchar | Frentista associado |
| `frentista_nome` | varchar | Nome do frentista |
| `nsu` | varchar | NSU da transação |
| `autorizacao` | varchar | Código de autorização |
| `bandeira` | varchar | Visa, Mastercard, etc |
| `checkin_id` | uuid | FK → checkins |
| `raw_data` | jsonb | Payload completo |
| `status` | varchar | aprovado, negado |
| `horario` | timestamptz | |

---

### Promoções, Sorteios & Prêmios

#### `promotions` — Promoções do posto

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `title` | text | NOT NULL |
| `description` | text | |
| `type` | text | `desconto`, `brinde`, `informativa` |
| `discount_value` | numeric | Valor do desconto |
| `eligible_payments` | text[] | `['pix', 'dinheiro', 'debito']` |
| `is_active` | boolean | |
| `start_date` | timestamptz | Início da vigência |
| `end_date` | timestamptz | Fim da vigência |

#### `raffles` — Configuração de sorteios

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `name` | text | Nome do sorteio |
| `winners_count` | integer | Default: 3 |
| `prize_value` | numeric | Default: 100.00 |
| `schedule_days` | integer[] | `[6]` = sábado |
| `schedule_times` | time[] | `['08:00', '15:00']` |
| `rules` | text | Regras |
| `is_active` | boolean | |

#### `raffle_runs` — Histórico de sorteios

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `raffle_id` | uuid | FK → raffles |
| `eligible_count` | integer | Total de elegíveis |
| `winners` | jsonb | Array de ganhadores |
| `seed` | text | Seed de aleatoriedade |
| `executed_by` | uuid | Quem executou |
| `is_test` | boolean | Sorteio de teste |
| `executed_at` | timestamptz | |

#### `premios_qr` — Prêmios QR com saldo

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `codigo` | text | Código único do prêmio |
| `nome_ganhador` | text | |
| `valor_original` | numeric | Valor inicial |
| `valor_restante` | numeric | Saldo atual |
| `status` | text | `ativo`, `zerado`, `expirado` |
| `data_expiracao` | timestamptz | |
| `cpf` | varchar | CPF do ganhador |
| `telefone` | text | Telefone |
| `observacoes` | text | |

#### `premios_qr_consumos` — Abatimentos de prêmios

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `premio_id` | uuid | FK → premios_qr |
| `valor_abatido` | numeric | |
| `valor_anterior` | numeric | Saldo antes |
| `valor_apos` | numeric | Saldo depois |
| `consumido_por` | uuid | Frentista/Admin |
| `observacao` | text | |
| `consumido_em` | timestamptz | |

---

### WhatsApp & Campanhas

#### `whatsapp_settings` — Configuração do provedor

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `provider` | text | `EVOLUTION` ou `CLOUD_API` |
| `enabled` | boolean | |
| `evolution_base_url` | text | URL da API Evolution |
| `evolution_api_key` | text | Chave da API |
| `evolution_instance` | text | Nome da instância |
| `cloud_access_token` | text | Token Meta |
| `cloud_phone_number_id` | text | ID do número |
| `cloud_waba_id` | text | ID da conta WABA |
| `cloud_graph_version` | text | Default: v20.0 |

#### `wa_messages` — Histórico de mensagens

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `phone` | varchar | E.164 |
| `direction` | varchar | `inbound`, `outbound` |
| `content` | text | Texto da mensagem |
| `message_type` | varchar | `text`, `template`, `image` |
| `status` | varchar | `pending`, `sent`, `delivered`, `read`, `failed` |
| `template_name` | varchar | Nome do template |
| `template_params` | jsonb | Parâmetros do template |
| `provider` | varchar | `cloud_api`, `evolution` |
| `wa_message_id` | varchar | ID externo do WhatsApp |
| `contact_id` | uuid | FK → wa_contacts |
| `error_message` | text | |

#### `wa_templates` — Templates de mensagem

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `name` | varchar | Nome único |
| `body` | text | Corpo da mensagem |
| `header_type` | varchar | text, image, video |
| `header_content` | text | |
| `footer` | text | |
| `buttons` | jsonb | Array de botões |
| `category` | varchar | marketing, utility |
| `status` | varchar | pending, approved, rejected |
| `language` | varchar | Default: pt_BR |
| `meta_template_id` | varchar | ID no Meta |

#### `whatsapp_campaigns` — Campanhas de disparo

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `name` | text | Nome da campanha |
| `message` | text | Conteúdo |
| `status` | text | `draft`, `scheduled`, `sending`, `completed`, `failed` |
| `template_name` | text | Template a usar |
| `target_filter` | jsonb | Filtros de público |
| `total_recipients` | integer | |
| `sent_count` | integer | |
| `failed_count` | integer | |
| `scheduled_for` | timestamptz | Agendamento |
| `created_by` | uuid | |

#### `whatsapp_campaign_recipients` — Destinatários

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `campaign_id` | uuid | FK → whatsapp_campaigns |
| `phone_e164` | text | |
| `customer_name` | text | |
| `status` | text | `pending`, `sent`, `delivered`, `failed` |
| `sent_content` | text | Conteúdo enviado |
| `error` | text | Erro |
| `dispatch_latency_ms` | integer | Latência |
| `sent_at` | timestamptz | |
| `provider_message_id` | text | |

#### `whatsapp_logs` — Logs de envio (legacy)

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `phone` | text | |
| `message` | text | |
| `provider` | text | |
| `status` | text | QUEUED, SENT, FAILED |
| `message_id` | text | |
| `error` | text | |
| `customer_id` | uuid | |

---

### IA & Sistema

#### `ai_commands` — Comandos do Assistente IA

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `command_pattern` | text | Padrão regex/texto |
| `command_type` | text | `action`, `navigation`, `query` |
| `action_type` | text | `navigate`, `create_promotion`, etc |
| `description` | text | |
| `example_phrases` | text[] | Frases de exemplo |
| `requires_confirmation` | boolean | Default: true |
| `params_schema` | jsonb | Schema dos parâmetros |
| `is_active` | boolean | |

#### `ai_command_logs` — Logs de execução IA

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `raw_input` | text | Entrada do usuário |
| `recognized_action` | text | Ação reconhecida |
| `params_extracted` | jsonb | Parâmetros extraídos |
| `success` | boolean | |
| `execution_time_ms` | integer | |
| `voice_input` | boolean | Se veio por voz |
| `user_id` | uuid | |
| `command_id` | uuid | FK → ai_commands |

#### `ai_settings` — Configurações do módulo IA

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `key` | text | UNIQUE |
| `value` | jsonb | |
| `description` | text | |

#### `ai_chat_history` — Histórico de conversas IA

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `user_id` | uuid | |
| `role` | text | `user`, `assistant` |
| `content` | text | Conteúdo da mensagem |

#### `ai_whatsapp_logs` — Logs de WhatsApp enviados pela IA

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `phone` | text | |
| `message` | text | |
| `whatsapp_link` | text | |
| `status` | text | pending, sent |
| `sent_by` | text | Default: ai_agent |

#### `settings` — Configurações globais (key-value)

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `key` | text | UNIQUE (`posto_name`, `whatsapp_number`, `shift_change_hour`, etc) |
| `value` | jsonb | |
| `description` | text | |

#### `profiles` — Perfis de usuários admin

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK, FK → auth.users |
| `email` | text | |
| `full_name` | text | |
| `role` | text | Legacy: admin, operador, viewer |

#### `user_roles` — RBAC (tabela principal de permissões)

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `role` | app_role (enum) | `admin`, `operador`, `viewer` |

#### `audit_logs` — Auditoria

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `user_id` | uuid | |
| `action` | text | Ação realizada |
| `table_name` | text | Tabela afetada |
| `record_id` | uuid | |
| `old_data` | jsonb | Snapshot antes |
| `new_data` | jsonb | Snapshot depois |

#### `imports_logs` — Logs de importação CSV

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `filename` | text | |
| `records_total` | integer | |
| `records_matched` | integer | |
| `records_created` | integer | |
| `records_updated` | integer | |
| `records_failed` | integer | |
| `errors` | jsonb | |
| `imported_by` | uuid | |

#### `livro_caixa` — Controle financeiro

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `tipo` | varchar | `entrada`, `saida` |
| `categoria` | varchar | combustivel, servicos, etc |
| `valor` | numeric | |
| `data` | date | |
| `descricao` | text | |
| `forma_pagamento` | varchar | |
| `responsavel` | varchar | |
| `observacoes` | text | |

#### `qr_capture_points` — Pontos de captura QR

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `name` | varchar | Nome do ponto |
| `tag` | varchar | Tag única (usada na URL) |
| `location` | varchar | Localização física |
| `terminal_id` | varchar | Terminal Stone vinculado |
| `frentista_id` | uuid | FK → frentistas |
| `is_active` | boolean | |
| `description` | text | |

#### `complaints` — Reclamações e sugestões

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `phone` | text | |
| `message` | text | NOT NULL |
| `status` | text | `novo`, `em_tratamento`, `resolvido` |
| `resolution_notes` | text | |
| `resolved_by` | uuid | |
| `resolved_at` | timestamptz | |
| `customer_id` | uuid | |

#### `dispatch_history` — Histórico de disparos

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `promotion_id` | uuid | FK → promotions |
| `total_recipients` | integer | |
| `sent_count` | integer | |
| `failed_count` | integer | |
| `status` | text | completed, failed |
| `created_by` | uuid | |

#### `bulk_send_jobs` — Jobs de envio em massa

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `title` | text | |
| `message` | text | |
| `status` | text | pending, running, completed, failed |
| `total_contacts` | integer | |
| `sent_count` | integer | |
| `failed_count` | integer | |
| `contacts` | jsonb | Lista de contatos |
| `settings` | jsonb | Config do job |
| `created_by` | uuid | |

#### `system_documentation` — Documentação interna

| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | uuid | PK |
| `module_name` | text | |
| `section_title` | text | |
| `content` | text | |
| `code_examples` | text | |
| `order_index` | integer | |
| `is_active` | boolean | |

---

## Telas & Rotas

### Rotas Públicas (sem autenticação)

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona para `/aplicativo` |
| `/aplicativo` | **PWA do Cliente** — Cadastro com nome e telefone. Parâmetros: `?phone=`, `?tag=`, `?attendant=` |
| `/app` | Alias → `/aplicativo` |
| `/abastecimento/:token` | Status público de check-in (token temporário 24h) |
| `/premio/:codigo` | Validação pública de prêmio QR — consulta saldo |
| `/admin/login` | Login do painel |
| `/admin/reset` | Redefinição de senha |

### Rotas Admin — Qualquer Autenticado

| Rota | Descrição |
|------|-----------|
| `/admin` | Dashboard — KPIs, QR Code, status, capturas por ponto |
| `/admin/manual` | Manual interativo do sistema com modo demo |
| `/admin/duvidas` | FAQ e dúvidas |

### Rotas Admin — Staff (admin + operador)

| Rota | Descrição |
|------|-----------|
| `/admin/captura` | Captura manual de clientes |
| `/admin/frentista` | Gestão de frentistas e Stone |
| `/admin/relatorio-frentistas` | Relatório por frentista |
| `/admin/relatorio-producao` | Relatório de produção |
| `/admin/producao` | Produção diária/mensal |
| `/admin/sorteios` | Executar sorteios |
| `/admin/historico-sorteios` | Histórico de sorteios |
| `/admin/promocoes` | CRUD de promoções |
| `/admin/atendimento` | Reclamações e sugestões |
| `/admin/qrcode` | Gerador de QR Codes |
| `/admin/qr-premiacao` | Gestão de prêmios QR |

### Rotas Admin — Somente Admin

| Rota | Descrição |
|------|-----------|
| `/admin/integracoes` | Importação CSV, integrações |
| `/admin/pontos-captura` | CRUD de pontos de captura QR |
| `/admin/whatsapp` | Config WhatsApp (Evolution/Cloud API) |
| `/admin/robo-whatsapp` | Robô de campanhas WhatsApp |
| `/admin/configuracoes` | Configurações gerais |
| `/admin/livro-caixa` | Livro Caixa financeiro |
| `/admin/ai-assistant` | Assistente IA com voz |
| `/admin/documentacao` | Documentação do sistema (esta página) |

---

## Fluxos do Sistema

### 1. Cadastro do Cliente via QR Code

```
QR Code (bomba/terminal)
  │
  ▼
/aplicativo?tag=bomba1&phone=5594...
  │
  ├─ Pré-preenche nome + telefone (se ?phone na URL)
  │
  ├─ Validação: 11 dígitos, DDD válido (11-99), começa com 9
  │
  ├─ Upsert em wa_contacts (opt_in = true, LGPD)
  │
  ├─ RPC: public_create_checkin_and_token()
  │   ├─ Cria registro em checkins
  │   ├─ Gera token público (checkin_public_links, 24h)
  │   └─ Auto-identifica frentista:
  │       tag → qr_capture_points → frentista_id → frentistas.codigo
  │       OU tag → terminal_id → stone_tef_logs (últimos 30min)
  │
  ├─ Edge Function: raffle-confirmation (fire & forget)
  │   └─ Envia WhatsApp de confirmação de participação
  │
  ├─ Tela de Confirmação (3s countdown)
  │
  └─ Tela de Agradecimento (auto-reset em 10s para próximo cliente)
```

### 2. Validação de Prêmio QR

```
/premio/:codigo
  │
  ├─ RPC: get_premio_publico(codigo)
  │   └─ Retorna: nome, valor_original, valor_restante, status, data_expiracao
  │
  ├─ Se ativo: exibe card com saldo e opção de abatimento
  │
  └─ Abatimento (frentista autenticado via PIN):
      └─ RPC: abater_com_frentista(frentista_nome, premio_id, valor)
          ├─ Valida: status ativo, não expirado, saldo suficiente
          ├─ Registra em premios_qr_consumos
          └─ Atualiza valor_restante (se zerou → status = 'zerado')
```

### 3. Sorteio

```
Admin: /admin/sorteios
  │
  ├─ Busca contatos elegíveis:
  │   wa_contacts WHERE opt_in = true
  │   + checkins no período configurado
  │
  ├─ Gera seed aleatória (transparência)
  │
  ├─ Seleciona N ganhadores (Fisher-Yates shuffle)
  │
  ├─ Insere em raffle_runs:
  │   { winners: [...], eligible_count, seed, executed_by }
  │
  └─ Opcionalmente cria premios_qr para cada ganhador
      └─ Cada prêmio tem código único + QR Code (/premio/:codigo)
```

### 4. Campanha WhatsApp

```
Admin: /admin/robo-whatsapp
  │
  ├─ Cria campanha (whatsapp_campaigns):
  │   ├─ Define nome, mensagem/template
  │   ├─ Seleciona público (opt_in = true, filtros por tag, período)
  │   └─ Opcionalmente agenda (scheduled_for)
  │
  ├─ Gera recipients (whatsapp_campaign_recipients):
  │   Um registro por destinatário, status = 'pending'
  │
  ├─ Inicia execução → Edge Function: wa-campaign-run
  │   ├─ Processa em batches (rate limiting)
  │   ├─ Para cada recipient:
  │   │   ├─ Verifica opt-out (whatsapp_optout)
  │   │   ├─ Chama wa-send
  │   │   ├─ Atualiza recipient.status (sent/failed)
  │   │   └─ Incrementa campaign.sent_count/failed_count
  │   └─ Ao final: campaign.status = 'completed'
  │
  └─ Dashboard de acompanhamento em tempo real (realtime subscription)
```

### 5. Stone TEF (Webhook)

```
Terminal Stone (pagamento aprovado)
  │
  ├─ HTTP POST → Edge Function: stone-webhook
  │   ├─ Valida payload
  │   ├─ Insere em stone_tef_logs:
  │   │   { valor, forma_pagamento, terminal_id, nsu, autorizacao, bandeira }
  │   ├─ Busca frentista: terminal_id → frentistas.terminal_id
  │   └─ Tenta vincular a checkin recente (mesmo terminal, últimos 30min)
  │
  └─ Admin visualiza em /admin/frentista
      └─ Relatórios consolidados em /admin/relatorio-frentistas
```

### 6. Assistente IA

```
Admin: /admin/ai-assistant
  │
  ├─ Input: texto digitado OU voz (Web Speech API)
  │
  ├─ POST → Edge Function: ai-assistant
  │   ├─ Carrega ai_commands (padrões de comando)
  │   ├─ Carrega contexto do banco:
  │   │   contatos, checkins do dia, promoções ativas, sorteios
  │   ├─ Monta prompt com system instructions
  │   ├─ Chama Lovable AI Gateway (google/gemini-3-flash-preview)
  │   ├─ Extrai action blocks do response:
  │   │   { type: 'navigate'|'create_promotion'|'run_raffle'|'send_whatsapp', params: {} }
  │   └─ Retorna: { message: string, action?: ActionBlock }
  │
  ├─ Frontend processa action:
  │   ├─ navigate → router.push(params.route)
  │   ├─ create_promotion → supabase.from('promotions').insert(...)
  │   ├─ run_raffle → executa fluxo de sorteio
  │   └─ send_whatsapp → supabase.functions.invoke('wa-send', ...)
  │
  ├─ Loga em ai_command_logs:
  │   { raw_input, recognized_action, params_extracted, success, execution_time_ms }
  │
  └─ Modo 24h (ai_settings.auto_execute_mode):
      └─ Executa ações sem pedir confirmação do usuário
```

---

## Edge Functions

14 edge functions em Deno, deployadas automaticamente via Supabase.

| Função | Método | Descrição |
|--------|--------|-----------|
| `ai-assistant` | POST | Processa comandos IA. Chama Lovable AI Gateway, extrai ações contextualizadas. |
| `ai-generate-variations` | POST | Gera variações de mensagens para campanhas usando IA. |
| `log-cleanup` | POST | Limpeza periódica de logs antigos. |
| `raffle-confirmation` | POST | Envia WhatsApp de confirmação após check-in do cliente. |
| `rating-response` | POST | Processa e responde avaliações. |
| `send-whatsapp` | POST | Envio genérico de WhatsApp (wrapper). |
| `stone-webhook` | POST | Recebe webhooks Stone TEF, insere em stone_tef_logs. |
| `wa-ai-chatbot` | POST | Chatbot IA para WhatsApp — responde mensagens automaticamente. |
| `wa-campaign-run` | POST | Executa campanha de disparo em massa com rate limiting. |
| `wa-instance-manage` | POST | Gerencia instância Evolution API (criar, conectar, QR). |
| `wa-send` | POST | Envio unificado WhatsApp (Evolution + Cloud API). |
| `wa-webhook` | POST | Recebe webhooks WhatsApp (Evolution/Cloud), encaminha ao chatbot. |
| `whatsapp-send` | POST | Legacy: envio WhatsApp (compatibilidade). |
| `whatsapp-test` | POST | Teste de conectividade WhatsApp. |

---

## Database Functions (RPC)

| Função | Descrição |
|--------|-----------|
| `public_create_checkin_and_token(p_phone, p_attendant_code?, p_tag?)` | Cria check-in + token público. Upsert em wa_contacts. **SECURITY DEFINER**. |
| `get_premio_publico(p_codigo)` | Retorna dados públicos de prêmio QR pelo código. |
| `abater_com_frentista(p_frentista_nome, p_premio_id, p_valor, p_observacao?)` | Abate valor de prêmio, registra consumo, atualiza saldo. **SECURITY DEFINER**. |
| `get_public_checkin_status(p_token)` | Retorna status de check-in pelo token. |
| `is_admin()` | Verifica se usuário atual é admin. |
| `is_staff()` | Verifica se usuário atual é admin ou operador. |
| `has_role(_user_id, _role)` | Verifica se um usuário tem determinada role. |
| `handle_new_user()` | **Trigger** — Cria profile ao registrar novo usuário. |
| `set_admin_for_specific_email()` | **Trigger** — Auto-admin para email configurado. |
| `update_updated_at_column()` | **Trigger** — Atualiza updated_at automaticamente. |

---

## Autenticação & RBAC

### Autenticação

- **Provider:** Supabase Auth (email + password)
- **Login:** `/admin/login`
- **Reset senha:** `/admin/reset` (via email)
- **Trigger automático:** `on_auth_user_created` → cria registro em `profiles`

### RBAC (Role-Based Access Control)

**Enum `app_role`:** `admin` | `operador` | `viewer`

| Role | Acesso |
|------|--------|
| **admin** | Acesso total. Configurações, WhatsApp, IA, Livro Caixa, Integrações, Pontos de Captura. |
| **operador** | Operações diárias. Captura, sorteios, promoções, atendimento, relatórios, QR Premiação. |
| **viewer** | Somente leitura. Dashboard, manual, dúvidas. |

### Implementação

```
┌─────────────────────────────────────────────────┐
│  Frontend                                        │
│  ├─ AuthContext.tsx → fetchProfileAndRoles()     │
│  │   └─ Busca user_roles → define roles[]       │
│  ├─ RoleGuard.tsx → protege rotas por role      │
│  └─ AdminLayout.tsx → filtra menu por role      │
├─────────────────────────────────────────────────┤
│  Backend (RLS)                                   │
│  ├─ is_admin() → has_role(auth.uid(), 'admin')  │
│  ├─ is_staff() → role IN ('admin', 'operador')  │
│  └─ Cada tabela usa essas funções nas policies  │
└─────────────────────────────────────────────────┘
```

### Fluxo de Verificação

```
Requisição HTTP
  │
  ├─ JWT Token → Supabase Auth
  │
  ├─ anon (sem token):
  │   └─ SELECT público + INSERT em wa_contacts/checkins/complaints
  │
  ├─ authenticated + viewer:
  │   └─ SELECT em tabelas não-restritas (settings, promotions ativas, etc)
  │
  ├─ authenticated + operador (is_staff = true):
  │   └─ CRUD operacional (checkins, sorteios, promoções, atendimento)
  │
  └─ authenticated + admin (is_admin = true):
      └─ Acesso total (configurações, WhatsApp, IA, financeiro)
```

---

## Row-Level Security (RLS)

Todas as tabelas possuem RLS habilitado. Resumo das políticas:

### Acesso Público (anon)

| Tabela | Operação | Condição |
|--------|----------|----------|
| `wa_contacts` | INSERT | Sempre permitido |
| `wa_contacts` | SELECT/UPDATE | Sempre permitido |
| `checkins` | INSERT | Sempre permitido |
| `complaints` | INSERT | Sempre permitido |
| `settings` | SELECT | Sempre permitido |
| `promotions` | SELECT | `is_active = true` |
| `raffles` | SELECT | `is_active = true` |
| `frentistas` | SELECT | `is_active = true` |
| `premios_qr` | SELECT | Sempre permitido |
| `ai_commands` | SELECT | `is_active = true` |
| `ai_settings` | SELECT | Sempre permitido |

### Acesso Staff (`is_staff()`)

| Tabela | Operação |
|--------|----------|
| `checkins` | SELECT, UPDATE, DELETE |
| `complaints` | ALL |
| `wa_messages` | ALL |
| `whatsapp_campaigns` | ALL |
| `whatsapp_campaign_recipients` | ALL |
| `whatsapp_optout` | ALL |
| `dispatch_history` | ALL |
| `premios_qr` | ALL |
| `premios_qr_consumos` | ALL |
| `bulk_send_jobs` | ALL |

### Acesso Admin (`is_admin()`)

| Tabela | Operação |
|--------|----------|
| `whatsapp_settings` | ALL |
| `wa_templates` | ALL |
| `stone_tef_logs` | ALL |
| `livro_caixa` | ALL |
| `frentistas_pins` | ALL |
| `messages_queue` | ALL |
| `audit_logs` | SELECT |
| `ai_commands` | ALL |
| `ai_settings` | ALL |
| `system_documentation` | ALL |

---

## Integrações Externas

### WhatsApp — Evolution API

- **Tipo:** API self-hosted para envio via WhatsApp Web
- **Secrets:** `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
- **Funcionalidades:** Envio de texto, templates, mídia
- **Webhook:** `wa-webhook` recebe mensagens e status updates
- **Chatbot:** `wa-ai-chatbot` responde automaticamente usando IA
- **Campanhas:** `wa-campaign-run` para disparo em massa

### WhatsApp — Cloud API (Meta)

- **Tipo:** API oficial do Meta/Facebook
- **Configuração:** Armazenada em `whatsapp_settings`
- **Campos:** `cloud_access_token`, `cloud_phone_number_id`, `cloud_waba_id`

### Stone TEF

- **Tipo:** Webhook passivo (recebe dados de pagamento)
- **Edge Function:** `stone-webhook`
- **Dados:** Valor, forma de pagamento, terminal, NSU, autorização, bandeira
- **Vinculação:** Terminal → Frentista (`frentistas.terminal_id`)

### Lovable AI Gateway

- **URL:** `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Modelo:** `google/gemini-3-flash-preview`
- **Secret:** `LOVABLE_API_KEY`
- **Uso:** Assistente IA, chatbot WhatsApp, geração de variações de mensagem

---

## Secrets & Variáveis de Ambiente

### Secrets (Edge Functions)

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (bypass RLS) |
| `SUPABASE_DB_URL` | URL de conexão direta ao PostgreSQL |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável |
| `LOVABLE_API_KEY` | Gateway de IA Lovable |
| `OPENAI_API_KEY` | API OpenAI (backup) |
| `EVOLUTION_API_URL` | URL da Evolution API |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância Evolution |

### Variáveis Frontend (.env)

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL do Supabase (auto-preenchido) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (auto-preenchido) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto |

---

## Componentes Principais

### Estrutura de Diretórios

```
src/
├── App.tsx                     # Rotas principais
├── main.tsx                    # Entrypoint
├── index.css                   # Design tokens + Tailwind
├── assets/                     # Imagens (logo-gp.png)
├── components/
│   ├── ui/                     # shadcn/ui (40+ componentes)
│   ├── admin/                  # Componentes do painel
│   │   ├── AdminLayout.tsx     # Layout com sidebar + menu
│   │   ├── CSVImportDialog.tsx # Importação de CSV
│   │   ├── PremioForm.tsx      # Formulário de prêmios
│   │   ├── PremiosList.tsx     # Lista de prêmios
│   │   ├── RelatorioDRE.tsx    # Relatório DRE
│   │   ├── WhatsAppStatusDashboard.tsx
│   │   ├── BulkJobCreateDialog.tsx
│   │   └── ...
│   ├── customer/               # Componentes do PWA
│   │   ├── StepUnified.tsx     # Tela principal (nome + telefone)
│   │   ├── StepConfirmation.tsx # Confirmação com countdown
│   │   ├── StepThankYou.tsx    # Agradecimento + auto-reset
│   │   └── ...
│   ├── ErrorBoundary.tsx       # Error boundary global
│   ├── NavLink.tsx             # Link de navegação
│   └── RoleGuard.tsx           # Guard de autorização por role
├── contexts/
│   └── AuthContext.tsx          # Auth + RBAC state
├── hooks/
│   ├── use-mobile.tsx          # Detecção de mobile
│   ├── use-toast.ts            # Toast notifications
│   ├── useBulkJobs.ts          # Hook de jobs em massa
│   └── useSuccessSound.ts     # Som de sucesso
├── integrations/
│   └── supabase/
│       ├── client.ts           # Cliente Supabase
│       └── types.ts            # Tipos gerados (read-only)
├── lib/
│   ├── utils.ts                # cn() + utilitários
│   ├── password-security.ts    # Validação de senhas
│   └── public-url.ts           # URL pública do app
├── pages/
│   ├── CustomerApp.tsx         # PWA do cliente
│   ├── AbastecimentoStatus.tsx # Status de check-in
│   ├── PremioValidacao.tsx     # Validação de prêmio
│   ├── Index.tsx               # Redirect
│   ├── NotFound.tsx            # 404
│   └── admin/
│       ├── Dashboard.tsx       # Dashboard principal
│       ├── Login.tsx           # Login
│       ├── AIAssistant.tsx     # Assistente IA
│       ├── Captura.tsx         # Captura de clientes
│       ├── Frentista.tsx       # Gestão de frentistas
│       ├── Sorteios.tsx        # Sorteios
│       ├── Promocoes.tsx       # Promoções
│       ├── WhatsApp.tsx        # Config WhatsApp
│       ├── RoboWhatsapp.tsx    # Campanhas
│       ├── LivroCaixa.tsx      # Financeiro
│       ├── Configuracoes.tsx   # Settings
│       ├── Documentacao.tsx    # Esta documentação
│       └── ...
└── types/
    └── bulk-jobs.ts            # Tipos de jobs em massa

supabase/
├── config.toml                 # Configuração Supabase
├── functions/                  # 14 Edge Functions
│   ├── ai-assistant/
│   ├── wa-send/
│   ├── wa-webhook/
│   ├── wa-campaign-run/
│   ├── stone-webhook/
│   └── ...
└── migrations/                 # Migrações SQL (read-only)
```

---

## Deploy & Infraestrutura

| Componente | Plataforma | URL |
|-----------|-----------|-----|
| Frontend | Vercel | https://vite-canvas-joy.lovable.app |
| Backend | Supabase Cloud | womgorjjweikolfhrhgp |
| Edge Functions | Supabase Edge | Auto-deploy |
| WhatsApp | Evolution API | Self-hosted |
| Banco de Dados | Supabase PostgreSQL | Managed |

### PWA (Progressive Web App)

- `public/manifest.json` — Manifest do PWA
- `public/sw.js` — Service Worker
- `public/icons/icon-512.png` — Ícone do app
- Suporta instalação em Android/iOS

### SEO & Acessibilidade

- `public/robots.txt` — Configuração de crawlers
- `public/.well-known/apple-app-site-association` — Deep links iOS
- `public/.well-known/assetlinks.json` — Deep links Android

---

## 🗄️ Como Acessar a Base de Dados

### Acesso pelo Painel Lovable (Cloud View)

1. Abra o projeto no Lovable
2. Clique no ícone **Cloud** (nuvem) na barra de navegação superior
3. Navegue até **Database → Tables**
4. Você verá todas as tabelas listadas à esquerda
5. Clique em qualquer tabela para ver seus registros
6. Use o botão **Export** para exportar dados em CSV

### Acesso pelo Supabase Dashboard

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Faça login com a conta vinculada ao projeto
3. Selecione o projeto **Posto-7-app**
4. Use as seguintes seções:

| Seção | O que faz |
|-------|-----------|
| **Table Editor** | Visualizar, editar, inserir e deletar registros de qualquer tabela |
| **SQL Editor** | Executar queries SQL diretamente no banco |
| **Authentication → Users** | Ver e gerenciar usuários cadastrados |
| **Edge Functions** | Ver logs e status das funções serverless |
| **Database → Roles** | Ver roles e permissões |

### Queries SQL Úteis

#### Ver todos os contatos opt-in (clientes ativos)
```sql
SELECT phone, name, opt_in, opt_in_timestamp, created_at
FROM wa_contacts
WHERE opt_in = true
ORDER BY created_at DESC;
```

#### Ver check-ins de hoje
```sql
SELECT c.phone, wc.name, c.amount, c.liters, c.payment_method, c.attendant_code, c.created_at
FROM checkins c
LEFT JOIN wa_contacts wc ON wc.phone = c.phone
WHERE c.created_at >= CURRENT_DATE
ORDER BY c.created_at DESC;
```

#### Ver administradores do sistema
```sql
SELECT ur.role, p.email, p.full_name, ur.created_at
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
ORDER BY ur.role, p.email;
```

#### Contar registros por tabela
```sql
SELECT 'wa_contacts' AS tabela, COUNT(*) FROM wa_contacts
UNION ALL SELECT 'checkins', COUNT(*) FROM checkins
UNION ALL SELECT 'promotions', COUNT(*) FROM promotions
UNION ALL SELECT 'raffles', COUNT(*) FROM raffles
UNION ALL SELECT 'premios_qr', COUNT(*) FROM premios_qr
UNION ALL SELECT 'frentistas', COUNT(*) FROM frentistas
UNION ALL SELECT 'whatsapp_campaigns', COUNT(*) FROM whatsapp_campaigns;
```

#### Ver prêmios QR ativos com saldo
```sql
SELECT codigo, nome_ganhador, valor_original, valor_restante, status, data_expiracao
FROM premios_qr
WHERE status = 'ativo' AND valor_restante > 0
ORDER BY data_expiracao;
```

#### Ver últimas mensagens WhatsApp
```sql
SELECT phone, direction, content, status, template_name, created_at
FROM wa_messages
ORDER BY created_at DESC
LIMIT 50;
```

### Acesso pelo Lovable Cloud → Run SQL

1. No Lovable, abra a aba **Cloud**
2. Vá em **Database**
3. Clique em **Run SQL** (ícone de terminal)
4. Cole qualquer query acima e execute
5. Você pode alternar entre **Test** e **Live** para consultar ambientes diferentes

### Segurança (RLS)

Todas as tabelas possuem **Row-Level Security (RLS)** ativado. As permissões são controladas por duas funções:

| Função | Quem pode |
|--------|-----------|
| `is_admin()` | Apenas usuários com role `admin` na tabela `profiles` |
| `is_staff()` | Usuários com role `admin` ou `operador` |

> ⚠️ **Atenção:** Queries executadas pelo SQL Editor do Supabase Dashboard usam o role `postgres` (bypass de RLS). Queries pelo cliente frontend respeitam as policies.

### Tabelas Principais (Resumo Rápido)

| Tabela | Descrição | Acesso |
|--------|-----------|--------|
| `wa_contacts` | Clientes/contatos WhatsApp | Staff |
| `checkins` | Registros de abastecimento | Staff |
| `frentistas` | Cadastro de frentistas | Autenticado |
| `promotions` | Promoções ativas | Público (leitura) |
| `raffles` | Configuração de sorteios | Público (leitura) |
| `raffle_runs` | Histórico de sorteios | Autenticado |
| `premios_qr` | Prêmios com saldo QR | Público (leitura) / Staff (gestão) |
| `whatsapp_campaigns` | Campanhas de envio | Staff |
| `livro_caixa` | Controle financeiro | Admin |
| `stone_tef_logs` | Transações Stone TEF | Admin |
| `whatsapp_settings` | Config do WhatsApp | Admin |
| `user_roles` | Permissões RBAC | Admin |
| `profiles` | Perfis de usuários | Próprio / Admin |
| `audit_logs` | Auditoria do sistema | Admin (leitura) |
| `settings` | Configurações globais | Público (leitura) |
| `system_documentation` | Documentação interna | Público (leitura) |

---

> 📝 **Nota:** Esta documentação é gerada a partir do código-fonte e da estrutura do banco de dados. Mantenha-a atualizada ao fazer alterações significativas no sistema.
