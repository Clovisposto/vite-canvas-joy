# 🔧 Documentação do Backend Supabase — Posto 7

## Índice

0. [Glossário de Conceitos](#0-glossário-de-conceitos)
1. [Conexão e Configuração](#1-conexão-e-configuração)
2. [Autenticação e Autorização](#2-autenticação-e-autorização)
3. [Tabelas e CRUD](#3-tabelas-e-crud)
4. [Row-Level Security (RLS)](#4-row-level-security-rls)
5. [Database Functions](#5-database-functions)
6. [Edge Functions](#6-edge-functions)
7. [Secrets e Variáveis de Ambiente](#7-secrets-e-variáveis-de-ambiente)

---

## 0. Glossário de Conceitos

Antes de mergulhar na documentação técnica, é importante entender os conceitos fundamentais usados no backend deste projeto.

### 🗄️ Supabase

**O que é:** Uma plataforma de backend completa construída sobre o PostgreSQL. Funciona como uma alternativa ao Firebase, mas usando um banco de dados relacional de verdade.

**O que ele fornece para nós:**
- Banco de dados PostgreSQL hospedado na nuvem
- Autenticação de usuários (login, registro, sessões)
- APIs REST automáticas para acessar o banco
- Edge Functions (funções serverless)
- Armazenamento de arquivos (Storage)

**Analogia simples:** É como ter um servidor completo (banco de dados + API + autenticação) sem precisar configurar ou manter servidores próprios.

---

### 🔒 RLS (Row-Level Security)

**O que é:** "Segurança em Nível de Linha" — é um recurso do PostgreSQL que controla **quem pode ver ou modificar cada linha** de uma tabela.

**Por que é importante:** Sem RLS, qualquer pessoa com a chave pública (anon key) poderia ler TODOS os dados do banco. Com RLS, definimos regras como:
- "Clientes anônimos só podem ver promoções **ativas**"
- "Apenas **admin** pode ver o livro caixa"
- "Apenas **staff** pode ver os check-ins"

**Como funciona na prática:**

```sql
-- Exemplo: Apenas staff pode ler check-ins
CREATE POLICY "Staff can read checkins"
ON public.checkins
FOR SELECT                    -- Aplica-se a leituras
TO authenticated              -- Só para usuários logados
USING (public.is_staff());    -- Condição: precisa ser staff
```

**Operações controladas:**
| Operação | Significado |
|----------|-------------|
| `SELECT` | Ler/consultar dados |
| `INSERT` | Inserir novos registros |
| `UPDATE` | Atualizar registros existentes |
| `DELETE` | Excluir registros |
| `ALL` | Todas as operações acima |

**Termos importantes nas policies:**
- `USING (condição)` → Filtra quais linhas existentes o usuário pode acessar (SELECT, UPDATE, DELETE)
- `WITH CHECK (condição)` → Valida se o usuário pode inserir/modificar essa linha (INSERT, UPDATE)
- `TO authenticated` → Aplica-se apenas a usuários logados
- `TO anon` → Aplica-se a usuários não logados (visitantes do PWA)

---

### ⚡ Edge Functions

**O que é:** São funções que rodam em servidores do Supabase (não no navegador do usuário). São escritas em TypeScript/Deno e executam tarefas que não podem ser feitas no frontend.

**Por que usar Edge Functions em vez de fazer tudo no frontend?**
1. **Segurança:** Guardam chaves secretas (API keys) que não podem ser expostas no navegador
2. **Integrações externas:** Comunicam com APIs de terceiros (Evolution API, OpenAI, Stone)
3. **Lógica complexa:** Processam dados pesados sem travar o navegador
4. **Bypass de RLS:** Usam `service_role_key` para acessar qualquer dado sem restrições de RLS

**Como funciona:**

```
Navegador do usuário → chama Edge Function → Edge Function acessa banco/APIs → retorna resultado
```

**Exemplo real no projeto:**
- O usuário clica "Enviar campanha WhatsApp"
- O frontend chama a Edge Function `wa-campaign-run`
- A função lê os contatos do banco, envia mensagens via Evolution API, e atualiza os status

**Como chamar no código:**

```typescript
const { data, error } = await supabase.functions.invoke('wa-send', {
  body: { phone: '5511999999999', message: 'Olá!' }
});
```

---

### 📞 RPC (Remote Procedure Call)

**O que é:** "Chamada de Procedimento Remoto" — é uma forma de executar **funções SQL** no banco de dados diretamente do frontend.

**Diferença entre RPC e query normal:**

| Aspecto | Query normal | RPC |
|---------|-------------|-----|
| Exemplo | `supabase.from('checkins').select('*')` | `supabase.rpc('public_create_checkin_and_token', {...})` |
| O que faz | Lê/escreve em UMA tabela | Executa lógica complexa em VÁRIAS tabelas |
| Segurança | Respeita RLS | Pode usar SECURITY DEFINER (bypass RLS) |
| Uso | CRUD simples | Operações que envolvem múltiplas etapas |

**Exemplo real no projeto:**

A função `public_create_checkin_and_token` faz **4 coisas em uma única chamada**:
1. Garante que o contato existe em `wa_contacts` (upsert)
2. Gera um token único
3. Cria o check-in em `checkins`
4. Cria o link público em `checkin_public_links`

Se fizéssemos isso com queries normais, seriam 4 chamadas separadas, mais lentas e com risco de falha parcial.

---

### 🛡️ SECURITY DEFINER

**O que é:** Um modificador em funções SQL que faz a função rodar com as permissões do **dono da função** (geralmente o administrador do banco), **não** do usuário que está chamando.

**Por que é útil:** Permite que um visitante anônimo execute uma ação que normalmente ele não teria permissão. A função valida internamente se a ação é permitida.

**Exemplo:** Um visitante anônimo do PWA não pode escrever diretamente na tabela `checkins` (protegida por RLS). Mas pode chamar `public_create_checkin_and_token()` que é SECURITY DEFINER e faz o insert internamente.

---

### 🔑 RBAC (Role-Based Access Control)

**O que é:** "Controle de Acesso Baseado em Papéis" — cada usuário tem um **papel** (role) que define o que ele pode fazer.

**Papéis no Posto 7:**

| Role | Pode fazer | Quem é |
|------|-----------|--------|
| `admin` | Tudo: configurações, financeiro, usuários, WhatsApp | Dono/gerente do posto |
| `operador` | Operacional: check-ins, contatos, campanhas | Funcionário de confiança |
| `viewer` | Apenas visualizar dados básicos | Usuário padrão ao criar conta |

**Hierarquia:**
```
admin > operador > viewer > anon (visitante sem login)
```

---

### 📊 CRUD

**O que é:** Acrônimo para as 4 operações básicas em qualquer banco de dados:

| Letra | Operação | SQL | Supabase |
|-------|----------|-----|----------|
| **C** | Create (Criar) | `INSERT` | `.insert()` |
| **R** | Read (Ler) | `SELECT` | `.select()` |
| **U** | Update (Atualizar) | `UPDATE` | `.update()` |
| **D** | Delete (Excluir) | `DELETE` | `.delete()` |

---

### 🔄 Triggers

**O que é:** "Gatilhos" — são ações automáticas que o banco de dados executa quando algo acontece em uma tabela.

**Exemplo no projeto:**
- Quando um novo usuário se registra (`INSERT` em `auth.users`), o trigger `on_auth_user_created` automaticamente cria um perfil na tabela `profiles`
- Quando qualquer tabela é atualizada, o trigger `update_updated_at` automaticamente atualiza o campo `updated_at` com a data/hora atual

---

### 🏗️ Migrations

**O que é:** São scripts SQL que definem ou alteram a estrutura do banco de dados (criar tabelas, adicionar colunas, criar policies, etc.). São executados em ordem cronológica.

**No projeto:** Estão em `supabase/migrations/` e cada arquivo tem um timestamp no nome (ex: `20251219160006_...sql`). Isso garante que as alterações sejam aplicadas na ordem correta.

---

### 🌐 Anon Key vs Service Role Key

| Chave | Quem usa | Respeita RLS? | Onde fica |
|-------|----------|---------------|-----------|
| **Anon Key** (publishable) | Frontend/navegador | ✅ Sim | Código fonte (pública) |
| **Service Role Key** (secret) | Edge Functions/backend | ❌ Não (bypass) | Secrets do Supabase (privada) |

> ⚠️ A **Service Role Key** NUNCA deve ser exposta no frontend. Ela dá acesso total ao banco sem restrições.

---

## 1. Conexão e Configuração

### Client SDK

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://womgorjjweikolfhrhgp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIs...";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### Uso no Frontend

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Projeto

| Dado | Valor |
|------|-------|
| Project ID | `womgorjjweikolfhrhgp` |
| Region | Supabase Cloud |
| Dashboard | https://supabase.com/dashboard/project/womgorjjweikolfhrhgp |

---

## 2. Autenticação e Autorização

### Login/Logout

```typescript
// Login com email/senha
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'senha123'
});

// Logout
await supabase.auth.signOut();

// Listener de sessão
supabase.auth.onAuthStateChange((event, session) => {
  // 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'
});

// Obter sessão atual
const { data: { session } } = await supabase.auth.getSession();
```

### Sistema de Roles (RBAC)

O sistema usa **duas camadas** de controle de acesso:

#### Tabela `user_roles` (Primária — usada pelo RBAC)

```sql
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operador', 'viewer');

-- Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
```

#### Tabela `profiles` (Secundária — dados do usuário)

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'viewer',  -- NÃO usado para autorização
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

> ⚠️ **Importante:** A autorização é feita via `user_roles`, NÃO via `profiles.role`.

#### Funções de Verificação

```sql
-- Verifica se o usuário tem um role específico (usa user_roles)
CREATE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Atalho: é admin?
CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Atalho: é staff (admin OU operador)?
CREATE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'operador')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

#### Verificação no Frontend

```typescript
// src/contexts/AuthContext.tsx
const { data } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', session.user.id)
  .single();
```

### Criação Automática de Perfil

Trigger que cria perfil ao registrar novo usuário:

```sql
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'viewer'  -- Sempre viewer, admin promove manualmente
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Admins Ativos

| Email | Role |
|-------|------|
| clovisteodoro349@gmail.com | admin |
| eduardolima384@gmail.com | admin |

---

## 3. Tabelas e CRUD

### 3.1 `wa_contacts` — Contatos WhatsApp (tabela central)

**CRUD:**

```typescript
// CREATE
const { data, error } = await supabase.from('wa_contacts').insert({
  phone: '5511999999999',
  name: 'João Silva',
  opt_in: true,
  opt_in_timestamp: new Date().toISOString()
});

// READ (todos)
const { data } = await supabase.from('wa_contacts')
  .select('*')
  .order('created_at', { ascending: false });

// READ (por telefone)
const { data } = await supabase.from('wa_contacts')
  .select('*')
  .eq('phone', '5511999999999')
  .single();

// UPDATE
const { error } = await supabase.from('wa_contacts')
  .update({ name: 'João S.', opt_in: false, opt_out_timestamp: new Date().toISOString() })
  .eq('phone', '5511999999999');

// UPSERT (usado no check-in)
const { error } = await supabase.from('wa_contacts')
  .upsert({ phone: '5511999999999', opt_in: true }, { onConflict: 'phone' });
```

**Acesso:** Anon pode INSERT/SELECT/UPDATE | Staff tem acesso total (ALL)

---

### 3.2 `checkins` — Registros de Abastecimento

**CRUD:**

```typescript
// CREATE (via function RPC — método preferido)
const { data } = await supabase.rpc('public_create_checkin_and_token', {
  p_phone: '5511999999999',
  p_attendant_code: 'F01',
  p_tag: 'bomba1'
});

// CREATE (direto)
const { error } = await supabase.from('checkins').insert({
  phone: '5511999999999',
  attendant_code: 'F01',
  payment_method: 'pix',
  amount: 150.00,
  liters: 25.5,
  tag: 'bomba1',
  origin: 'pwa'
});

// READ (com filtros)
const { data } = await supabase.from('checkins')
  .select('*, wa_contacts(name)')
  .gte('created_at', '2025-01-01')
  .order('created_at', { ascending: false })
  .limit(100);

// UPDATE
const { error } = await supabase.from('checkins')
  .update({ amount: 200.00, payment_method: 'debito' })
  .eq('id', checkinId);

// DELETE
const { error } = await supabase.from('checkins')
  .delete()
  .eq('id', checkinId);
```

**Acesso:** Anon pode INSERT | Staff pode SELECT/UPDATE/DELETE

---

### 3.3 `frentistas` — Cadastro de Frentistas

```typescript
// CREATE
await supabase.from('frentistas').insert({
  nome: 'Carlos Silva',
  codigo: 'F01',
  is_active: true
});

// READ
const { data } = await supabase.from('frentistas')
  .select('*')
  .eq('is_active', true);

// UPDATE
await supabase.from('frentistas')
  .update({ nome: 'Carlos S.', is_active: false })
  .eq('id', frentistaId);
```

**Acesso:** Público pode ler frentistas ativos | Autenticado tem acesso total

---

### 3.4 `promotions` — Promoções

```typescript
// CREATE
await supabase.from('promotions').insert({
  title: 'Desconto PIX',
  description: 'R$0,10 de desconto por litro no PIX',
  type: 'desconto',
  discount_value: 0.10,
  eligible_payments: ['pix'],
  is_active: true,
  start_date: new Date().toISOString()
});

// READ (ativas — acessível publicamente)
const { data } = await supabase.from('promotions')
  .select('*')
  .eq('is_active', true);

// UPDATE
await supabase.from('promotions')
  .update({ is_active: false, end_date: new Date().toISOString() })
  .eq('id', promoId);
```

**Acesso:** Público lê promoções ativas | Autenticado gerencia

---

### 3.5 `raffles` / `raffle_runs` — Sorteios

```typescript
// Configuração do sorteio
const { data } = await supabase.from('raffles')
  .select('*')
  .eq('is_active', true);

// Registrar execução de sorteio
await supabase.from('raffle_runs').insert({
  raffle_id: raffleId,
  eligible_count: 150,
  seed: 'abc123',
  winners: [
    { phone: '5511...', name: 'João' },
    { phone: '5511...', name: 'Maria' }
  ],
  executed_by: userId,
  is_test: false
});

// Histórico
const { data } = await supabase.from('raffle_runs')
  .select('*, raffles(name)')
  .order('executed_at', { ascending: false });
```

**Acesso:** Público lê sorteios ativos | Autenticado lê/insere runs

---

### 3.6 `premios_qr` / `premios_qr_consumos` — Prêmios QR

```typescript
// Criar prêmio
await supabase.from('premios_qr').insert({
  codigo: 'PREMIO-2025-001',
  nome_ganhador: 'Maria Silva',
  valor_original: 100,
  valor_restante: 100,
  data_expiracao: '2025-06-30T23:59:59Z',
  telefone: '5511999999999'
});

// Consultar prêmio público (via RPC — sem autenticação)
const { data } = await supabase.rpc('get_premio_publico', {
  p_codigo: 'PREMIO-2025-001'
});

// Abater valor (via RPC — sem autenticação)
const { data } = await supabase.rpc('abater_com_frentista', {
  p_premio_id: premioId,
  p_valor: 30.00,
  p_frentista_nome: 'Carlos',
  p_observacao: 'Abatimento combustível'
});
```

**Acesso:** Público pode ler | Staff gerencia

---

### 3.7 `whatsapp_campaigns` / `whatsapp_campaign_recipients` — Campanhas

```typescript
// Criar campanha
await supabase.from('whatsapp_campaigns').insert({
  name: 'Promoção Fim de Semana',
  message: 'Olá {{name}}, aproveite nosso desconto!',
  status: 'draft',
  target_filter: { opt_in: true },
  created_by: userId
});

// Listar campanhas
const { data } = await supabase.from('whatsapp_campaigns')
  .select('*')
  .order('created_at', { ascending: false });

// Atualizar status
await supabase.from('whatsapp_campaigns')
  .update({ status: 'sending', started_at: new Date().toISOString() })
  .eq('id', campaignId);

// Ver destinatários
const { data } = await supabase.from('whatsapp_campaign_recipients')
  .select('*')
  .eq('campaign_id', campaignId);
```

**Acesso:** Staff somente

---

### 3.8 `wa_messages` — Mensagens WhatsApp

```typescript
// Inserir mensagem enviada
await supabase.from('wa_messages').insert({
  phone: '5511999999999',
  direction: 'outbound',
  message_type: 'text',
  content: 'Olá! Sua promoção está ativa.',
  status: 'sent',
  provider: 'evolution'
});

// Listar conversa
const { data } = await supabase.from('wa_messages')
  .select('*')
  .eq('phone', '5511999999999')
  .order('created_at', { ascending: true });
```

**Acesso:** Staff somente

---

### 3.9 `whatsapp_settings` — Configuração WhatsApp

```typescript
// Ler configuração
const { data } = await supabase.from('whatsapp_settings')
  .select('*')
  .single();

// Atualizar provider
await supabase.from('whatsapp_settings')
  .update({
    provider: 'EVOLUTION',
    evolution_base_url: 'https://api.evolution.local',
    evolution_instance: 'posto7',
    evolution_api_key: 'key...',
    enabled: true
  })
  .eq('id', settingsId);
```

**Acesso:** Admin somente

---

### 3.10 `livro_caixa` — Controle Financeiro

```typescript
// Inserir lançamento
await supabase.from('livro_caixa').insert({
  tipo: 'receita',
  categoria: 'combustivel',
  valor: 5000.00,
  descricao: 'Vendas do dia',
  data: '2025-01-15',
  forma_pagamento: 'pix',
  responsavel: 'Carlos',
  created_by: userId
});

// Relatório por período
const { data } = await supabase.from('livro_caixa')
  .select('*')
  .gte('data', '2025-01-01')
  .lte('data', '2025-01-31')
  .order('data', { ascending: false });
```

**Acesso:** Admin somente

---

### 3.11 `settings` — Configurações Globais

```typescript
// Ler configuração
const { data } = await supabase.from('settings')
  .select('value')
  .eq('key', 'posto_name')
  .single();

// Atualizar
await supabase.from('settings')
  .update({ value: '"Posto 7 Premium"' })
  .eq('key', 'posto_name');
```

**Configurações padrão:**

| Key | Descrição |
|-----|-----------|
| `posto_name` | Nome do posto |
| `whatsapp_number` | Número WhatsApp |
| `raffle_rules` | Regras do sorteio |
| `lgpd_text` | Texto LGPD |
| `shift_change_hour` | Hora troca de turno |
| `csv_time_window_minutes` | Janela de match CSV |

**Acesso:** Público lê | Autenticado gerencia

---

### 3.12 Outras Tabelas

| Tabela | Descrição | CRUD | Acesso |
|--------|-----------|------|--------|
| `stone_tef_logs` | Logs de transações Stone TEF | R/W | Admin (público pode inserir) |
| `audit_logs` | Auditoria do sistema | R | Admin lê, qualquer um insere |
| `complaints` | Reclamações/sugestões | CRUD | Público insere, Staff gerencia |
| `imports_logs` | Logs de importação CSV | CRUD | Autenticado |
| `bulk_send_jobs` | Jobs de envio em massa | CRUD | Staff |
| `whatsapp_optout` | Opt-out de WhatsApp | CRUD | Staff |
| `whatsapp_logs` | Logs legados de WhatsApp | R/W | Público (insert/select/update) |
| `wa_templates` | Templates de mensagem | CRUD | Autenticado |
| `qr_capture_points` | Pontos de captura QR | CRUD | Público lê ativos, autenticado gerencia |
| `frentista_metas` | Metas de frentistas | CRUD | Público lê ativos, autenticado gerencia |
| `frentistas_pins` | PINs de frentistas | CRUD | Admin somente |
| `checkin_public_links` | Links públicos de check-in | R/W | Sem RLS explícito |
| `ai_chat_history` | Histórico de chat IA | CRUD | Próprio usuário, Staff lê tudo |
| `ai_commands` | Comandos IA | CRUD | Admin gerencia, público lê ativos |
| `ai_command_logs` | Logs de comandos IA | R/W | Próprio usuário, Admin lê tudo |
| `ai_settings` | Config IA | CRUD | Admin gerencia, público lê |
| `ai_whatsapp_logs` | Logs WhatsApp IA | CRUD | Autenticado + público insere |
| `system_documentation` | Documentação interna | CRUD | Admin gerencia, público lê ativos |

---

## 4. Row-Level Security (RLS)

### Níveis de Acesso

```
┌─────────────────────────────────────────────────┐
│                  PÚBLICO (anon)                  │
│  • Ler promoções/sorteios/settings ativos        │
│  • Inserir checkins, complaints, wa_contacts     │
│  • Consultar prêmios QR (via RPC)               │
├─────────────────────────────────────────────────┤
│              AUTENTICADO (authenticated)          │
│  • Gerenciar promoções, sorteios, frentistas     │
│  • Ler/inserir raffle_runs                       │
│  • Gerenciar imports_logs, templates             │
├─────────────────────────────────────────────────┤
│                STAFF (operador + admin)           │
│  • Ler checkins, wa_contacts, wa_messages        │
│  • Gerenciar campanhas, prêmios QR              │
│  • Gerenciar bulk_send_jobs, dispatch_history    │
├─────────────────────────────────────────────────┤
│                   ADMIN                          │
│  • Livro caixa, stone_tef_logs                   │
│  • whatsapp_settings, audit_logs                 │
│  • user_roles, frentistas_pins                   │
│  • messages_queue                                │
└─────────────────────────────────────────────────┘
```

### Padrão das Policies

```sql
-- Padrão para tabelas públicas (leitura)
CREATE POLICY "Public can read active X"
ON public.tabela FOR SELECT USING (is_active = true);

-- Padrão para staff
CREATE POLICY "Staff can manage X"
ON public.tabela FOR ALL TO authenticated
USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Padrão para admin
CREATE POLICY "Admin can manage X"
ON public.tabela FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());
```

---

## 5. Database Functions (RPC)

### `public_create_checkin_and_token(p_phone, p_attendant_code?, p_tag?)`

Cria check-in + link público + garante wa_contact existe. **SECURITY DEFINER** (bypass RLS).

```typescript
const { data } = await supabase.rpc('public_create_checkin_and_token', {
  p_phone: '5511999999999',
  p_attendant_code: 'F01',
  p_tag: 'bomba1'
});
// Retorna: { success: true, checkin_id: 'uuid', token: 'abc123...' }
```

### `get_premio_publico(p_codigo)`

Consulta prêmio QR sem autenticação. **SECURITY DEFINER**.

```typescript
const { data } = await supabase.rpc('get_premio_publico', {
  p_codigo: 'PREMIO-001'
});
// Retorna: { success: true, id, codigo, nome_ganhador, valor_original, valor_restante, status, data_expiracao }
```

### `abater_com_frentista(p_frentista_nome, p_premio_id, p_valor, p_observacao?)`

Abate valor de prêmio QR identificando o frentista. **SECURITY DEFINER**.

```typescript
const { data } = await supabase.rpc('abater_com_frentista', {
  p_frentista_nome: 'Carlos',
  p_premio_id: 'uuid...',
  p_valor: 30.00,
  p_observacao: 'Combustível'
});
// Retorna: { success: true, frentista, valor_abatido, novo_saldo, novo_status }
```

### `has_role(_user_id, _role)`

Verifica se usuário tem role específico. Usada internamente pelas policies RLS.

### `is_admin()` / `is_staff()`

Atalhos para verificar permissões do usuário autenticado atual.

### `get_public_checkin_status(p_token)`

Consulta status de check-in por token público. (Implementação simplificada atualmente.)

---

## 6. Edge Functions

### Configuração Geral

Todas as Edge Functions estão em `supabase/functions/` e configuradas em `supabase/config.toml` com `verify_jwt = false` (validação feita no código quando necessário).

### Lista de Funções

| Função | Endpoint | Descrição |
|--------|----------|-----------|
| `wa-send` | POST | Envio de mensagem WhatsApp via Evolution API |
| `wa-webhook` | POST | Recebe webhooks da Evolution API |
| `wa-campaign-run` | POST | Executa campanha de envio em massa |
| `wa-instance-manage` | POST | Gerencia instância Evolution (criar, conectar, QR) |
| `wa-ai-chatbot` | POST | Chatbot IA para WhatsApp |
| `send-whatsapp` | POST | Envio genérico de WhatsApp |
| `whatsapp-send` | POST | Envio de WhatsApp (alternativo) |
| `whatsapp-test` | POST | Teste de conexão WhatsApp |
| `raffle-confirmation` | POST | Confirma ganhadores de sorteio via WhatsApp |
| `rating-response` | POST | Processa respostas de avaliação |
| `stone-webhook` | POST | Recebe webhooks da Stone (TEF) |
| `ai-assistant` | POST | Assistente IA do painel admin |
| `ai-generate-variations` | POST | Gera variações de texto com IA |
| `log-cleanup` | POST | Limpeza periódica de logs antigos |

### Padrão de Implementação

```typescript
// supabase/functions/nome-da-funcao/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    // ... lógica
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

### Chamada no Frontend

```typescript
const { data, error } = await supabase.functions.invoke('wa-send', {
  body: { phone: '5511999999999', message: 'Olá!' }
});
```

---

## 7. Secrets e Variáveis de Ambiente

### Secrets Configurados

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL` | URL do projeto (auto) |
| `SUPABASE_ANON_KEY` | Chave pública (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin (auto) |
| `SUPABASE_DB_URL` | String de conexão DB |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável |
| `EVOLUTION_API_URL` | URL da Evolution API |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância Evolution |
| `OPENAI_API_KEY` | Chave da OpenAI (IA) |
| `LOVABLE_API_KEY` | Chave do Lovable AI Gateway |

### Acesso nas Edge Functions

```typescript
const apiKey = Deno.env.get('EVOLUTION_API_KEY');
const apiUrl = Deno.env.get('EVOLUTION_API_URL');
```

### Variáveis do Frontend (.env automático)

```
VITE_SUPABASE_URL=https://womgorjjweikolfhrhgp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=womgorjjweikolfhrhgp
```

> ⚠️ Não existe arquivo `.env` físico. Variáveis `VITE_*` são injetadas automaticamente pelo Lovable.

---

## Diagrama de Arquitetura

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   PWA/App    │────▶│  Supabase Client  │────▶│  PostgreSQL │
│  (Frontend)  │     │   (anon key)      │     │  (com RLS)  │
└──────────────┘     └──────────────────┘     └─────────────┘
       │                                             ▲
       │              ┌──────────────────┐           │
       └─────────────▶│  Edge Functions   │───────────┘
                      │ (service_role)    │     (bypass RLS)
                      └──────────────────┘
                             │
                      ┌──────▼──────────┐
                      │  Evolution API   │
                      │  (WhatsApp)      │
                      └─────────────────┘
                      ┌──────▼──────────┐
                      │  OpenAI API      │
                      │  (IA/Chatbot)    │
                      └─────────────────┘
```

---

## 8. Ambientes: Test vs Live (Dev / Produção)

O Lovable possui **dois ambientes** automáticos. Não existe um terceiro ambiente de "homologação" nativo.

### Visão Geral

| Ambiente | URL | Quando atualiza | Uso |
|----------|-----|-----------------|-----|
| **Test** (Preview) | `id-preview--*.lovable.app` | A cada edição de código | Desenvolvimento e testes |
| **Live** (Publicado) | `vite-canvas-joy.lovable.app` | Somente ao clicar **Publish → Update** | Produção (usuários reais) |

### O que é compartilhado e o que é separado

| Recurso | Test e Live separados? | Detalhes |
|---------|----------------------|----------|
| **Frontend** (HTML/CSS/JS) | ✅ Separados | Live só atualiza ao publicar |
| **Banco de dados** | ✅ Separados | Dados do Test NÃO aparecem no Live e vice-versa |
| **Edge Functions** | ❌ Compartilhados | Deploy é imediato nos dois ambientes |
| **Migrations (schema)** | ❌ Compartilhados | Alterações de schema afetam ambos |
| **Secrets** | ❌ Compartilhados | Mesmas chaves para Test e Live |

### Fluxo de Trabalho Recomendado

```
1. DESENVOLVER (Test)
   └─ Editar código no Lovable
   └─ Testar no preview (iframe da direita)
   └─ Verificar dados no banco Test (Cloud → Database → Tables)

2. VALIDAR (Test)
   └─ Testar fluxos completos no preview
   └─ Conferir logs de Edge Functions
   └─ Validar RLS e permissões

3. PUBLICAR (Live)
   └─ Clicar em Publish → Update
   └─ Verificar o app publicado em vite-canvas-joy.lovable.app
   └─ Conferir dados no banco Live (Cloud → Database → alternar para Live)
```

### ⚠️ Cuidados Importantes

1. **Edge Functions deployam imediatamente** — se você alterar uma Edge Function, ela já estará ativa em produção antes de publicar o frontend
2. **Migrations são irreversíveis** — alterações no schema (criar/remover tabelas/colunas) afetam ambos os ambientes instantaneamente
3. **Dados são independentes** — se você inserir dados de teste no preview, eles NÃO vão para produção
4. **Dados de produção existem apenas no Live** — os 912 contatos, 875 check-ins e demais registros reais estão no ambiente Live

### Como Consultar Dados de Cada Ambiente

No Lovable Cloud:
1. Abra a aba **Cloud** (ícone de nuvem)
2. Vá em **Database → Tables** ou **Run SQL**
3. Use o seletor **Test / Live** para alternar entre ambientes

### Alternativas para Homologação

Se precisar de um ambiente intermediário de homologação:

| Opção | Como fazer | Prós | Contras |
|-------|-----------|------|---------|
| **Remix** | Settings → Remix this project | Cópia completa, ambiente isolado | Banco separado, precisa manter sincronizado |
| **GitHub + Branches** | Conectar ao GitHub, usar branches | Controle de versão profissional | Requer conhecimento de Git |
| **Testar no Preview** | Usar o ambiente Test como homologação | Já funciona, sem config extra | Não é 100% isolado do dev |

---

> 📝 **Última atualização:** Fevereiro 2026
