# 📋 Documentação Técnica Completa — Posto 7 App

> Sistema de gestão para postos de combustível com PWA para clientes, painel administrativo, integração WhatsApp, sorteios, prêmios QR e controle financeiro.

**Versão:** 1.0  
**Última atualização:** Fevereiro 2026  
**Stack:** React 18 + Vite + TypeScript + Tailwind CSS + Supabase + Edge Functions (Deno)

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Aplicativo do Cliente (PWA)](#2-aplicativo-do-cliente-pwa)
3. [Painel Administrativo](#3-painel-administrativo)
4. [Sistema de Autenticação e RBAC](#4-sistema-de-autenticação-e-rbac)
5. [Dashboard](#5-dashboard)
6. [Captura de Check-ins e Clientes](#6-captura-de-check-ins-e-clientes)
7. [Gestão de Frentistas](#7-gestão-de-frentistas)
8. [Sorteios](#8-sorteios)
9. [Promoções](#9-promoções)
10. [QR Premiação](#10-qr-premiação)
11. [Robô WhatsApp](#11-robô-whatsapp)
12. [Atendimento (Reclamações)](#12-atendimento-reclamações)
13. [Livro Caixa (Financeiro)](#13-livro-caixa-financeiro)
14. [Pontos de Captura](#14-pontos-de-captura)
15. [Assistente IA](#15-assistente-ia)
16. [Integrações Externas](#16-integrações-externas)
17. [Edge Functions](#17-edge-functions)
18. [Banco de Dados](#18-banco-de-dados)
19. [Segurança (RLS)](#19-segurança-rls)
20. [Rotas da Aplicação](#20-rotas-da-aplicação)

---

## 1. Visão Geral da Arquitetura

```
┌────────────────────────────────────────────────┐
│              Frontend (React + Vite)            │
│                                                 │
│  ├── PWA Cliente (/aplicativo)                  │
│  │     └── Check-in, cadastro, confirmação      │
│  │                                              │
│  ├── Validação Pública (/premio/:codigo)        │
│  │     └── Consulta e abatimento de prêmios     │
│  │                                              │
│  └── Painel Admin (/admin/*)                    │
│        └── Dashboard, captura, sorteios, etc.   │
└───────────────────┬────────────────────────────┘
                    │ Supabase SDK (supabase-js)
                    ▼
┌────────────────────────────────────────────────┐
│            Supabase Backend                     │
│                                                 │
│  ├── PostgreSQL (32 tabelas + RLS)              │
│  ├── Auth (email/senha + JWT + refresh)         │
│  ├── Edge Functions (14 funções Deno)           │
│  ├── RPC Functions (6 funções SQL)              │
│  └── Secrets (10 variáveis)                     │
└───────────────────┬────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│           Serviços Externos                     │
│                                                 │
│  ├── Evolution API (WhatsApp Business)          │
│  ├── OpenAI / Lovable AI Gateway               │
│  └── Stone TEF (pagamentos)                     │
└────────────────────────────────────────────────┘
```

### Tecnologias Principais

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + TypeScript | 18.3 |
| Build | Vite | — |
| Estilização | Tailwind CSS + shadcn/ui | — |
| Estado/Cache | TanStack React Query | 5.x |
| Animações | Framer Motion | 12.x |
| Roteamento | React Router DOM | 6.x |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) | — |
| Edge Runtime | Deno (Supabase Edge Functions) | — |
| WhatsApp | Evolution API | — |
| IA | OpenAI GPT + Lovable AI Gateway | — |
| Pagamentos TEF | Stone | — |
| Gráficos | Recharts | 2.x |
| Excel | SheetJS (xlsx) | 0.18 |
| QR Code | qrcode.react | 4.x |

---

## 2. Aplicativo do Cliente (PWA)

**Rota:** `/aplicativo`  
**Arquivo:** `src/pages/CustomerApp.tsx`  
**Acesso:** Público (sem autenticação)

### Descrição
Progressive Web App (PWA) acessível via QR Code nos pontos de abastecimento. Permite que clientes façam check-in no posto, se cadastrem no programa de fidelidade e participem de sorteios.

### Fluxo de Uso

```
┌──────────┐    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
│ QR Code  │ →  │ Tela Unificada│ →  │ Confirmação  │ →  │ Agradecimento│
│ (Bomba)  │    │ Phone + Nome  │    │ (Contador)   │    │ (Auto-reset) │
└──────────┘    └───────────────┘    └──────────────┘    └──────────────┘
```

### Funcionalidades Detalhadas

1. **Captura de dados (StepUnified)**
   - Campo de telefone com máscara `(XX) XXXXX-XXXX`
   - Campo de nome (opcional)
   - Validação de celular brasileiro (11 dígitos)
   - Conversão automática para formato E.164 (`55XXXXXXXXXXX`)

2. **Parâmetros via URL (QR Code)**
   - `?phone=` ou `?tel=` ou `?telefone=` — Pré-preenche telefone
   - `?attendant=` ou `?attendant_code=` — Identifica frentista
   - `?tag=` — Identifica ponto de captura (bomba/ilha)

3. **Processamento do Check-in**
   - Upsert no `wa_contacts` (cria ou atualiza contato)
   - Chamada RPC `public_create_checkin_and_token` (SECURITY DEFINER):
     - Cria registro em `checkins`
     - Gera token público em `checkin_public_links`
     - Garante contato existe em `wa_contacts`
   - Identificação automática do frentista via:
     - Parâmetro `attendant_code` na URL
     - Lookup na tabela `qr_capture_points` pela tag
     - Correlação com últimas transações TEF Stone (30 min)

4. **Confirmação WhatsApp (fire-and-forget)**
   - Após check-in, invoca Edge Function `raffle-confirmation`
   - Envia mensagem de confirmação via WhatsApp (não-bloqueante)

5. **Auto-reset**
   - Após tela de agradecimento, volta automaticamente à tela inicial
   - Permite uso contínuo em totem/tablet fixo na bomba

6. **Configurações dinâmicas**
   - Nome do posto carregado da tabela `settings` (chave `posto_name`)
   - Suporte a AbortController para cancelar requests em remontagem

### Componentes

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `StepUnified` | `src/components/customer/StepUnified.tsx` | Formulário de captura (phone + nome) |
| `StepConfirmation` | `src/components/customer/StepConfirmation.tsx` | Tela de confirmação com contador |
| `StepThankYou` | `src/components/customer/StepThankYou.tsx` | Agradecimento + auto-reset |

---

## 3. Painel Administrativo

**Rota base:** `/admin/*`  
**Layout:** `src/components/admin/AdminLayout.tsx`  
**Acesso:** Autenticado (roles: admin, operador, viewer)

### Estrutura de Navegação

O painel usa um layout consistente com sidebar (ou header responsivo) e controle de acesso por role:

| Nível de Acesso | Rotas |
|----------------|-------|
| **Todos autenticados** | `/admin` (Dashboard), `/admin/manual`, `/admin/duvidas` |
| **Staff** (admin + operador) | `/admin/captura`, `/admin/producao`, `/admin/sorteios`, `/admin/historico-sorteios`, `/admin/promocoes`, `/admin/atendimento`, `/admin/qrcode`, `/admin/frentista`, `/admin/relatorio-frentistas`, `/admin/relatorio-producao`, `/admin/qr-premiacao` |
| **Admin only** | `/admin/integracoes`, `/admin/pontos-captura`, `/admin/whatsapp`, `/admin/robo-whatsapp`, `/admin/configuracoes`, `/admin/livro-caixa`, `/admin/ai-assistant`, `/admin/documentacao` |

---

## 4. Sistema de Autenticação e RBAC

**Arquivo:** `src/contexts/AuthContext.tsx`  
**Guard:** `src/components/RoleGuard.tsx`

### Autenticação

- **Provider:** Supabase Auth (email/senha)
- **Sessão:** JWT automático com refresh token
- **Persistência:** `localStorage` via Supabase SDK
- **Trigger:** `handle_new_user()` — cria perfil automaticamente na tabela `profiles` com role `viewer`

### Controle de Acesso (RBAC)

O sistema usa **duas camadas** de verificação:

#### Camada 1: Frontend (RoleGuard)
```tsx
<RoleGuard requiredRole="admin">
  <AdminConfiguracoes />
</RoleGuard>
```

O `RoleGuard` verifica:
- Se o usuário está autenticado (redireciona para `/admin/login` se não)
- Se possui a role necessária (exibe mensagem de acesso negado se não)

#### Camada 2: Backend (RLS + SQL Functions)

| Função SQL | Descrição | Tipo |
|-----------|-----------|------|
| `is_admin()` | Verifica se usuário tem role `admin` na tabela `user_roles` | SECURITY DEFINER |
| `is_staff()` | Verifica se usuário tem role `admin` ou `operador` | SECURITY DEFINER |
| `has_role(user_id, role)` | Verifica role específica para um usuário | SECURITY DEFINER |

#### Roles

| Role | Descrição | Enum |
|------|-----------|------|
| `admin` | Acesso total ao sistema | `app_role` |
| `operador` | Acesso operacional (captura, sorteios, promoções) | `app_role` |
| `viewer` | Apenas visualização (dashboard, manual) | `app_role` |

#### Tabelas de Auth

| Tabela | Função |
|--------|--------|
| `profiles` | Nome, email, role (legado) |
| `user_roles` | Roles efetivas (fonte de verdade) |

### Usuários Admin Conhecidos
- `clovisteodoro349@gmail.com`
- `clovis349@gmail.com`
- `eduardolima384@gmail.com`

O trigger `set_admin_for_specific_email()` atribui role `admin` automaticamente para `clovisteodoro349@gmail.com`.

---

## 5. Dashboard

**Rota:** `/admin`  
**Arquivo:** `src/pages/admin/Dashboard.tsx`

### Funcionalidades

1. **KPIs em tempo real** (4 cards)
   - Total de clientes (`wa_contacts`)
   - Check-ins de hoje (`checkins` com `is_demo = false`)
   - Promoções ativas (`promotions` com `is_active = true`)
   - Reclamações pendentes (`complaints` com status `novo`)

2. **Estatísticas por ponto de captura**
   - Gráfico de barras horizontal com progresso
   - Agrupamento por `tag` dos check-ins de hoje
   - Correlação com tabela `qr_capture_points`
   - Percentual de participação por ponto
   - Auto-refresh a cada 30 segundos

3. **QR Code do aplicativo**
   - Gera QR Code SVG com URL do `/aplicativo`
   - Botão para personalizar (redireciona para `/admin/qrcode`)
   - Botão para abrir app em nova aba

4. **Status do sistema**
   - Status do sorteio automático
   - Status da integração WhatsApp
   - Telefone configurado
   - Status da importação CSV

5. **Ações rápidas**
   - Links diretos para: Sorteios, Promoções, Captura, Atendimento

6. **Modo demonstração**
   - Detecta automaticamente se só existem dados demo
   - Exibe banner amarelo avisando que dados são fictícios

---

## 6. Captura de Check-ins e Clientes

**Rota:** `/admin/captura`  
**Arquivo:** `src/pages/admin/Captura.tsx` (~1030 linhas)

### Funcionalidades

1. **Aba "Check-ins"**
   - Listagem de todos os check-ins com filtros:
     - Período: Hoje, Semana, Mês, Todos
     - Forma de pagamento
     - Frentista
   - Busca por telefone
   - Cálculo de datas em fuso horário de Brasília (UTC-3)
   - Exportação CSV

2. **Aba "Clientes" (wa_contacts)**
   - Listagem de todos os contatos cadastrados
   - Filtro por período de cadastro
   - Busca por nome ou telefone

3. **Seleção em massa**
   - Checkbox para selecionar múltiplos contatos
   - Envio de mensagem WhatsApp em massa para selecionados

4. **Sistema de Bulk Jobs (fila controlada)**
   - Dialog para criar job de envio em massa (`BulkJobCreateDialog`)
   - Monitoramento de progresso (`BulkJobProgress`)
   - Gerenciado via hook `useBulkJobs`

5. **Importação de dados**
   - **CSV Import** (`CSVImportDialog`): Importa contatos de arquivo CSV
   - **Inserção manual** (`BulkPhoneInsertDialog`): Cola lista de telefones

---

## 7. Gestão de Frentistas

**Rota:** `/admin/frentista`  
**Arquivo:** `src/pages/admin/Frentista.tsx` (~1741 linhas)

### Funcionalidades

1. **CRUD de frentistas**
   - Cadastro com código, nome e terminal TEF
   - Ativação/desativação
   - Edição e exclusão

2. **Gestão de PINs** (`FrentistaPinDialog`)
   - Cada frentista pode ter um PIN para autenticação
   - PIN armazenado como hash na tabela `frentistas_pins`
   - Usado para validação de abatimento de prêmios

3. **Metas de produção**
   - Configuração de metas por período (diário, semanal, mensal)
   - Meta de check-ins e/ou valor (R$)
   - Barra de progresso visual
   - Acompanhamento de % de cumprimento

4. **Logs TEF Stone**
   - Importação de logs de transações TEF
   - Vinculação automática frentista ↔ transação via `terminal_id`
   - Exibição de valor, forma de pagamento, bandeira, NSU

5. **Gráficos e relatórios**
   - Gráficos de área, barras e pizza (Recharts)
   - Ranking de frentistas por atendimento
   - Comparativo por período

6. **Som de sucesso**
   - Feedback sonoro em ações bem-sucedidas (`useSuccessSound`)

### Relatórios
- `/admin/relatorio-frentistas` — Relatório detalhado por frentista
- `/admin/relatorio-producao` — Relatório de produção geral

---

## 8. Sorteios

**Rota:** `/admin/sorteios`  
**Arquivo:** `src/pages/admin/Sorteios.tsx` (~610 linhas)

### Funcionalidades

1. **CRUD de sorteios**
   - Nome, quantidade de ganhadores, valor do prêmio, regras
   - Ativação/desativação com Switch
   - Exclusão com confirmação

2. **Execução do sorteio**
   - Busca todos os contatos com `opt_in = true` da tabela `wa_contacts`
   - Seleção aleatória com seed baseado em timestamp
   - Registro em `raffle_runs` com:
     - Quantidade de elegíveis
     - Lista de ganhadores (JSON)
     - ID do executor
     - Flag de teste

3. **Notificação automática dos ganhadores**
   - Após sorteio, envia mensagem via Edge Function `wa-send`
   - Mensagem configurável via `MessageEditorButton` (settings)
   - Variáveis suportadas: `{{nome}}`, `{{sorteio}}`, `{{premio}}`
   - Delay de 2s entre mensagens para evitar bloqueio

4. **Histórico de execuções**
   - Tabela com data, elegíveis, ganhadores, tipo (teste/real)
   - Detalhes dos ganhadores (nome, telefone formatado)

5. **Rota de histórico completo:** `/admin/historico-sorteios`

---

## 9. Promoções

**Rota:** `/admin/promocoes`  
**Arquivo:** `src/pages/admin/Promocoes.tsx` (~1191 linhas)

### Funcionalidades

1. **CRUD de promoções**
   - Tipos: `informativa`, `desconto`, `relampago`
   - Campos: título, descrição, valor desconto, formas de pagamento elegíveis
   - Ativação/desativação, datas de início/fim

2. **Promoções relâmpago**
   - Criação rápida com envio imediato
   - Formulário simplificado (título + mensagem + desconto)

3. **Disparo WhatsApp integrado**
   - Seleção de contatos para envio
   - Filtros por data de cadastro e busca por nome/telefone
   - Sistema anti-bloqueio WhatsApp:
     - Delay aleatório entre mensagens (25-70s)
     - Simulação de abertura de chat (6-12s)
     - Simulação de digitação (2-4s)
     - Limite de 40 mensagens/hora
     - Pause/resume do envio
   - Envio via Evolution API (Edge Function `wa-send`)

4. **Histórico de disparos**
   - Registrado na tabela `dispatch_history`
   - Total de destinatários, enviados, falhas

---

## 10. QR Premiação

**Rota:** `/admin/qr-premiacao`  
**Arquivo:** `src/pages/admin/QRPremiacao.tsx`

### Funcionalidades

1. **Criação de prêmios** (`PremioForm`)
   - Código único do prêmio
   - Nome do ganhador, CPF, telefone
   - Valor original e data de expiração
   - Observações

2. **Lista de prêmios** (`PremiosList`)
   - Status: `ativo`, `zerado`, `expirado`
   - Valor original vs. valor restante
   - Histórico de consumos/abatimentos

3. **Validação pública** (`/premio/:codigo`)
   - Página pública (sem autenticação)
   - Consulta via RPC `get_premio_publico` (SECURITY DEFINER)
   - Exibe: nome mascarado, valor restante, status, expiração
   - Modal de abatimento (`AbaterValorModal`):
     - Validação por PIN do frentista
     - Chamada RPC `abater_com_frentista`:
       - Verifica status ativo e data de validade
       - Verifica se valor não excede saldo
       - Registra consumo em `premios_qr_consumos`
       - Atualiza `valor_restante` e `status` do prêmio

---

## 11. Robô WhatsApp

**Rota:** `/admin/robo-whatsapp`  
**Arquivo:** `src/pages/admin/RoboWhatsapp.tsx` (~4023 linhas)

### Acesso
- Requer role `admin`
- Autenticação adicional por PIN fixo (`1234`)

### Funcionalidades

#### 11.1 Gestão de Conexão WhatsApp
- **Status da conexão:** Verificação via `wa-instance-manage` (action: `status`)
- **Criar instância:** Cria nova instância na Evolution API
- **Gerar QR Code:** Conecta dispositivo WhatsApp via QR
- **Pairing Code:** Alternativa ao QR por código numérico
- **Ferramentas de recuperação:**
  - Reiniciar instância
  - Resetar sessão (logout + restart)
  - Recriar instância (delete + create)
  - Diagnóstico completo

#### 11.2 Campanhas de Envio em Massa
- **Criação de campanhas:**
  - Nome, mensagem, agendamento opcional
  - Suporte a Spintax: `{Olá|Oi|Ei}` → variações automáticas
  - Preview de variações em tempo real
  - Geração de variações via IA (Edge Function `ai-generate-variations`)
- **Modos de envio anti-bloqueio:**
  | Modo | Delay | Velocidade |
  |------|-------|-----------|
  | Humanizado (IA) | 15-90s aleatório | ~20-40/hora |
  | Seguro (Recomendado) | 40-90s | ~30-40/hora |
  | Moderado | 20-50s | ~50-60/hora |
  | Rápido (Arriscado) | 10-30s | ~80-100/hora |
- **Geração de fila de destinatários:**
  - Seleção individual de contatos
  - Filtro por consentimento/LGPD
  - Modal "Adicionar e Disparar"
- **Monitoramento de disparo:**
  - Stats em tempo real: total, pendentes, enviados, falhas
  - Auto-continuação com polling
  - Cancelamento de disparo
- **Gerenciamento de campanhas:**
  - Visualizar, editar, excluir campanhas
  - Busca e filtro por nome
  - Duplicar campanha

#### 11.3 Templates de Mensagem
- CRUD completo de templates (`wa_templates`)
- Categorias: MARKETING, UTILITY
- Variáveis: `{{1}}`, `{{nome}}`, etc.
- Status: `pending`, `approved`

#### 11.4 Teste de Envio
- Envio de mensagem teste para número específico
- Usa mensagem da campanha ou mensagem personalizada
- Feedback de sucesso/erro

#### 11.5 Normalização de Telefones
- Função `normalizePhoneE164()`: Converte qualquer formato para E.164
- Função `isValidBrazilianPhone()`: Valida celular/fixo brasileiro
- Suporte: 10 dígitos (fixo), 11 dígitos (celular), 12-13 com prefixo 55

---

## 12. Atendimento (Reclamações)

**Rota:** `/admin/atendimento`  
**Arquivo:** `src/pages/admin/Atendimento.tsx` (~68 linhas)

### Funcionalidades

1. **Listagem de reclamações/sugestões**
   - Ordenadas por data (mais recentes primeiro)
   - Campos: data, telefone, mensagem, status

2. **Gestão de status**
   - `novo` → `em_tratamento` → `resolvido`
   - Atualização via Select inline
   - Registra `resolved_at` automaticamente

3. **Exportação CSV**
   - Exporta todas as reclamações em formato CSV (`;` como separador)

---

## 13. Livro Caixa (Financeiro)

**Rota:** `/admin/livro-caixa`  
**Arquivo:** `src/pages/admin/LivroCaixa.tsx` (~1531 linhas)

### Funcionalidades

#### 13.1 Demonstrativo Diário (TEF Stone)
- Cruzamento de dados com logs TEF Stone (`stone_tef_logs`)
- Tabela por frentista × forma de pagamento (PIX, Dinheiro, Crédito, Débito)
- Totais automáticos por frentista e geral
- Filtro por frentista específico
- Seleção de data
- Exportação para Excel

#### 13.2 Lançamentos Manuais (Livro Caixa)
- CRUD de lançamentos financeiros
- Tipos: `entrada` e `saida`
- Categorias pré-definidas:
  - **Entradas:** Venda de Combustível, Produtos, Serviços, Receita Financeira, Outros
  - **Saídas:** Compra de Combustível, Produtos, Salários, Energia, Água, Aluguel, etc.
- Formas de pagamento: Dinheiro, PIX, Débito, Crédito, Boleto, Transferência
- Campos opcionais: descrição, responsável, observações
- Filtro por mês

#### 13.3 Gráficos Financeiros
- Gráfico de barras com 6 meses (Recharts)
- Comparativo: entradas vs. saídas vs. saldo
- Atualização automática ao navegar entre meses

#### 13.4 DRE (Demonstrativo de Resultado)
- Componente `RelatorioDRE`
- Consolidação de receitas e despesas por categoria

#### 13.5 Importação/Exportação Excel
- Exportação mensal completa via SheetJS (xlsx)
- Importação de planilha com validação de dados
- Parsing de datas em múltiplos formatos (DD/MM/YYYY, YYYY-MM-DD, serial Excel)

---

## 14. Pontos de Captura

**Rota:** `/admin/pontos-captura`  
**Arquivo:** `src/pages/admin/PontosCaptura.tsx` (~557 linhas)

### Funcionalidades

1. **CRUD de pontos de captura**
   - Campos: nome, tag (identificador único), descrição, localização
   - Vinculação opcional com frentista e terminal TEF
   - Ativação/desativação

2. **Tag como identificador**
   - A tag é passada como parâmetro `?tag=X` no QR Code do ponto
   - Permite identificar de qual bomba/ilha veio o check-in
   - Exemplo: `?tag=bomba1`, `?tag=ilha3`

3. **Geração de QR Code**
   - QR Code automático para cada ponto com a URL do `/aplicativo?tag=X`
   - Pronto para imprimir e colar na bomba

4. **Correlação com frentista**
   - Se o ponto tem frentista vinculado, o check-in herda o `attendant_code`
   - Se o ponto tem `terminal_id`, busca último frentista nas transações Stone

---

## 15. Assistente IA

**Rota:** `/admin/ai-assistant`  
**Arquivo:** `src/pages/admin/AIAssistant.tsx` (~1079 linhas)

### Funcionalidades

1. **Chat com IA (LLM)**
   - Interface de chat com mensagens user/assistant
   - Chamada à Edge Function `ai-assistant`
   - Suporte a Markdown na renderização (`react-markdown`)
   - Histórico persistido na tabela `ai_chat_history`

2. **Entrada por voz**
   - Integração com Web Speech API (`SpeechRecognition`)
   - Toggle microfone on/off
   - Transcrição automática para texto

3. **Ações executáveis**
   - A IA pode sugerir ações que o usuário confirma:
     - `create_promotion` — Criar promoção
     - `create_campaign` — Criar campanha WhatsApp
     - `send_campaign` — Disparar campanha
     - `create_raffle` — Criar sorteio
     - `resolve_complaint` — Resolver reclamação
     - `navigate` — Navegar para página do admin
     - `update_settings` — Atualizar configurações
   - Dialog de confirmação antes da execução

4. **Histórico de comandos**
   - Registrado em `ai_command_logs`
   - Sucesso/falha, tempo de execução, parâmetros

5. **Configurações IA**
   - Tabelas: `ai_commands`, `ai_settings`
   - Patterns de comandos configuráveis
   - Schema de parâmetros por comando

---

## 16. Integrações Externas

### 16.1 Evolution API (WhatsApp)

| Secret | Uso |
|--------|-----|
| `EVOLUTION_API_URL` | URL base da API |
| `EVOLUTION_API_KEY` | Chave de autenticação |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância (ex: `Hiper`) |

**Funcionalidades:**
- Envio de mensagens de texto
- Gestão de instância (criar, status, QR, restart, delete)
- Webhook para receber mensagens e status
- Retry com backoff exponencial (3 tentativas: 2s, 4s, 8s)

### 16.2 OpenAI / Lovable AI Gateway

| Secret | Uso |
|--------|-----|
| `OPENAI_API_KEY` | Chave OpenAI direta |
| `LOVABLE_API_KEY` | Gateway IA do Lovable |

**Funcionalidades:**
- Assistente IA do admin (chat + ações)
- Geração de variações de mensagens (Spintax)
- Chatbot WhatsApp automatizado

### 16.3 Stone TEF

**Funcionalidades:**
- Webhook para receber transações TEF (`stone-webhook`)
- Log de transações na tabela `stone_tef_logs`
- Correlação frentista ↔ terminal ↔ transação
- Demonstrativo diário no Livro Caixa

### 16.4 Cloudflare Tunnel
- Wizard de configuração (`CloudflareTunnelWizard`)
- Para expor servidor local (Evolution API) à internet
- Status de saúde do tunnel

---

## 17. Edge Functions

Todas as Edge Functions rodam no Supabase (Deno runtime) com `verify_jwt = false` (configurado em `supabase/config.toml`).

| Função | Arquivo | Descrição | Integração |
|--------|---------|-----------|-----------|
| `wa-send` | `supabase/functions/wa-send/index.ts` | Envia mensagem WhatsApp individual | Evolution API |
| `wa-webhook` | `supabase/functions/wa-webhook/index.ts` | Recebe webhooks do WhatsApp (mensagens, status) | Evolution API |
| `wa-campaign-run` | `supabase/functions/wa-campaign-run/index.ts` | Executa disparo de campanha em massa com delays | Evolution API |
| `wa-instance-manage` | `supabase/functions/wa-instance-manage/index.ts` | Gerencia instância WhatsApp (create, status, QR, restart, delete, diagnose) | Evolution API |
| `wa-ai-chatbot` | `supabase/functions/wa-ai-chatbot/index.ts` | Chatbot IA para atendimento automático via WhatsApp | Evolution API + OpenAI |
| `ai-assistant` | `supabase/functions/ai-assistant/index.ts` | Assistente IA do painel admin (chat + ações) | OpenAI / Lovable Gateway |
| `ai-generate-variations` | `supabase/functions/ai-generate-variations/index.ts` | Gera variações de texto (Spintax) | OpenAI / Lovable Gateway |
| `raffle-confirmation` | `supabase/functions/raffle-confirmation/index.ts` | Envia confirmação de check-in via WhatsApp | Evolution API |
| `rating-response` | `supabase/functions/rating-response/index.ts` | Responde a avaliações de clientes | Evolution API |
| `stone-webhook` | `supabase/functions/stone-webhook/index.ts` | Recebe e processa transações TEF Stone | Stone |
| `send-whatsapp` | `supabase/functions/send-whatsapp/index.ts` | Envio WhatsApp (legado) | Evolution API |
| `whatsapp-send` | `supabase/functions/whatsapp-send/index.ts` | Envio WhatsApp (legado) | Evolution API |
| `whatsapp-test` | `supabase/functions/whatsapp-test/index.ts` | Teste de envio WhatsApp | Evolution API |
| `log-cleanup` | `supabase/functions/log-cleanup/index.ts` | Limpeza de logs antigos | Interno |

---

## 18. Banco de Dados

### Tabelas por Módulo

#### Clientes e Check-ins
| Tabela | Colunas-chave | Função |
|--------|-------------|--------|
| `wa_contacts` | phone (UNIQUE), name, opt_in, opt_in_timestamp, flow_state | Cadastro central de contatos |
| `checkins` | phone (FK→wa_contacts), amount, liters, attendant_code, tag, origin, is_demo | Registro de abastecimentos |
| `checkin_public_links` | checkin_id, token, expires_at | Links públicos para check-in |
| `complaints` | phone, message, status, resolved_at, resolved_by | Reclamações/sugestões |

#### WhatsApp
| Tabela | Função |
|--------|--------|
| `whatsapp_settings` | Configurações do provider (Evolution/Cloud API) |
| `whatsapp_logs` | Logs de envio de mensagens |
| `wa_messages` | Mensagens enviadas/recebidas |
| `wa_templates` | Templates de mensagem |
| `whatsapp_campaigns` | Campanhas de envio em massa |
| `whatsapp_campaign_recipients` | Destinatários por campanha |
| `whatsapp_optout` | Lista de opt-out |
| `ai_whatsapp_logs` | Logs de envio via IA |

#### Financeiro
| Tabela | Função |
|--------|--------|
| `livro_caixa` | Lançamentos financeiros manuais |
| `stone_tef_logs` | Transações TEF Stone |

#### Promoções e Sorteios
| Tabela | Função |
|--------|--------|
| `promotions` | Promoções (informativa, desconto, relâmpago) |
| `raffles` | Configuração de sorteios |
| `raffle_runs` | Execuções de sorteios com ganhadores |
| `premios_qr` | Prêmios com QR Code |
| `premios_qr_consumos` | Consumos/abatimentos de prêmios |

#### Frentistas
| Tabela | Função |
|--------|--------|
| `frentistas` | Cadastro de frentistas (código, nome, terminal) |
| `frentistas_pins` | PINs para autenticação |
| `frentista_metas` | Metas de produção |
| `qr_capture_points` | Pontos de captura (bombas/ilhas) |

#### Admin e Sistema
| Tabela | Função |
|--------|--------|
| `profiles` | Perfis de usuários |
| `user_roles` | Roles (RBAC) |
| `audit_logs` | Logs de auditoria |
| `settings` | Configurações do sistema (key/value JSON) |
| `system_documentation` | Documentação técnica |

#### IA
| Tabela | Função |
|--------|--------|
| `ai_chat_history` | Histórico de chat com IA |
| `ai_commands` | Comandos configuráveis da IA |
| `ai_command_logs` | Logs de execução de comandos |
| `ai_settings` | Configurações do módulo IA |

#### Filas e Importações
| Tabela | Função |
|--------|--------|
| `messages_queue` | Fila de mensagens pendentes |
| `bulk_send_jobs` | Jobs de envio em massa |
| `dispatch_history` | Histórico de disparos |
| `imports_logs` | Logs de importação CSV |

### Funções RPC

| Função | Parâmetros | Retorno | Acesso |
|--------|-----------|---------|--------|
| `public_create_checkin_and_token` | `p_phone`, `p_attendant_code?`, `p_tag?` | `{success, checkin_id, token}` | SECURITY DEFINER (público) |
| `get_premio_publico` | `p_codigo` | `{success, id, codigo, nome_ganhador, valor_original, valor_restante, status, data_expiracao}` | SECURITY DEFINER (público) |
| `get_public_checkin_status` | `p_token` | `{success, status}` | SECURITY DEFINER (público) |
| `abater_com_frentista` | `p_frentista_nome`, `p_premio_id`, `p_valor`, `p_observacao?` | `{success, frentista, valor_abatido, novo_saldo, novo_status}` | SECURITY DEFINER |
| `is_admin()` | — | `boolean` | SECURITY DEFINER |
| `is_staff()` | — | `boolean` | SECURITY DEFINER |
| `has_role(user_id, role)` | `uuid`, `app_role` | `boolean` | SECURITY DEFINER |

---

## 19. Segurança (RLS)

O projeto utiliza **Row-Level Security (RLS)** em todas as tabelas. Padrões de acesso:

| Padrão | Tabelas | Regra |
|--------|---------|-------|
| **Admin only** | `livro_caixa`, `stone_tef_logs`, `whatsapp_settings`, `messages_queue`, `frentistas_pins` | `is_admin()` |
| **Staff** (admin + operador) | `checkins` (SELECT/UPDATE/DELETE), `wa_contacts` (ALL), `wa_messages`, `whatsapp_campaigns`, `whatsapp_campaign_recipients`, `complaints` (ALL), `bulk_send_jobs`, `dispatch_history`, `premios_qr`, `premios_qr_consumos`, `whatsapp_optout` | `is_staff()` |
| **Authenticated** | `promotions`, `raffles`, `frentistas`, `frentista_metas`, `qr_capture_points`, `settings`, `imports_logs` | `true` (qualquer autenticado) |
| **Público (anon)** | `checkins` (INSERT), `wa_contacts` (INSERT/SELECT/UPDATE), `complaints` (INSERT), `premios_qr` (SELECT), `premios_qr_consumos` (SELECT), `stone_tef_logs` (INSERT) | `true` |
| **Próprio usuário** | `profiles` (SELECT/UPDATE own), `user_roles` (SELECT own), `ai_chat_history` (ALL own), `ai_command_logs` (INSERT/SELECT own) | `auth.uid() = user_id` |

### Funções SECURITY DEFINER
Todas as funções RPC públicas usam `SECURITY DEFINER` para bypassar RLS e executar com permissões do owner. Isso é necessário para operações que o usuário anônimo precisa realizar (check-in, validação de prêmio).

---

## 20. Rotas da Aplicação

### Rotas Públicas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/` | Redirect → `/aplicativo` | Redireciona para o app |
| `/aplicativo` | `CustomerApp` | PWA do cliente |
| `/app` | Redirect → `/aplicativo` | Alias |
| `/abastecimento/:token` | `AbastecimentoStatus` | Status do check-in por token |
| `/premio/:codigo` | `PremioValidacao` | Validação pública de prêmio QR |
| `/admin/login` | `AdminLogin` | Login administrativo |
| `/admin/reset` | `AdminResetPassword` | Reset de senha |

### Rotas Autenticadas (viewer+)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/admin` | `AdminDashboard` | Dashboard principal |
| `/admin/manual` | `AdminManual` | Manual do sistema |
| `/admin/duvidas` | `AdminDuvidas` | FAQ |

### Rotas Staff (admin + operador)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/admin/captura` | `AdminCaptura` | Check-ins e clientes |
| `/admin/producao` | `AdminProducao` | Produção |
| `/admin/sorteios` | `AdminSorteios` | Gestão de sorteios |
| `/admin/historico-sorteios` | `AdminHistoricoSorteios` | Histórico de sorteios |
| `/admin/promocoes` | `AdminPromocoes` | Promoções |
| `/admin/atendimento` | `AdminAtendimento` | Reclamações |
| `/admin/qrcode` | `AdminQRCode` | Gerador de QR Code |
| `/admin/frentista` | `AdminFrentista` | Gestão de frentistas |
| `/admin/relatorio-frentistas` | `RelatorioFrentistas` | Relatório de frentistas |
| `/admin/relatorio-producao` | `RelatorioProducao` | Relatório de produção |
| `/admin/qr-premiacao` | `QRPremiacao` | Prêmios QR |

### Rotas Admin Only

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/admin/integracoes` | `AdminIntegracoes` | Importação e Cloudflare |
| `/admin/pontos-captura` | `PontosCaptura` | Pontos de captura (bombas) |
| `/admin/whatsapp` | `AdminWhatsApp` | Config WhatsApp |
| `/admin/robo-whatsapp` | `RoboWhatsapp` | Robô WhatsApp (campanhas) |
| `/admin/configuracoes` | `AdminConfiguracoes` | Configurações gerais |
| `/admin/livro-caixa` | `LivroCaixa` | Financeiro |
| `/admin/ai-assistant` | `AIAssistant` | Assistente IA |
| `/admin/documentacao` | `Documentacao` | Documentação técnica |

---

## Apêndice: Secrets Configurados

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública (anon) |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin (service role) |
| `SUPABASE_DB_URL` | URL de conexão direta ao PostgreSQL |
| `EVOLUTION_API_URL` | URL da Evolution API |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância WhatsApp |
| `OPENAI_API_KEY` | Chave OpenAI |
| `LOVABLE_API_KEY` | Chave do Lovable AI Gateway |

---

> 📝 Documento gerado em Fevereiro 2026. Manter atualizado conforme novas features forem adicionadas.
