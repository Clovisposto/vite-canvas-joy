# 🔴 Débitos Técnicos — Posto 7

> Documento vivo que lista pendências técnicas, melhorias de infraestrutura e decisões arquiteturais que precisam ser endereçadas para escalar o projeto com segurança.

**Última atualização:** Fevereiro 2026

---

## Índice

1. [Ambientes: Dev, Homologação e Produção](#1-ambientes-dev-homologação-e-produção)
2. [Domínio e DNS](#2-domínio-e-dns)
3. [Hospedagem: Lovable vs Infraestrutura Própria](#3-hospedagem-lovable-vs-infraestrutura-própria)
4. [Segurança](#4-segurança)
5. [Performance e Escalabilidade](#5-performance-e-escalabilidade)
6. [Código e Arquitetura](#6-código-e-arquitetura)
7. [Monitoramento e Observabilidade](#7-monitoramento-e-observabilidade)
8. [Backups e Recuperação](#8-backups-e-recuperação)

---

## 1. Ambientes: Dev, Homologação e Produção

### Situação Atual

O Lovable oferece apenas **2 ambientes automáticos**:

| Ambiente | URL | Banco de Dados | Frontend | Backend (Edge Functions) |
|----------|-----|----------------|----------|--------------------------|
| **Test** (Dev) | `id-preview--*.lovable.app` | Separado | Atualiza em tempo real | ⚠️ Compartilhado |
| **Live** (Prod) | `vite-canvas-joy.lovable.app` / `posto7.app` | Separado | Atualiza ao publicar | ⚠️ Compartilhado |

### ⚠️ Problemas Atuais

1. **Não existe ambiente de homologação** — mudanças vão direto de dev para produção
2. **Edge Functions são compartilhadas** — alterar uma function no dev afeta produção imediatamente
3. **Migrations são compartilhadas** — alterações no schema do banco atingem ambos os ambientes
4. **Secrets são compartilhados** — mesmas chaves API para dev e prod
5. **Sem processo de code review** — não há aprovação antes de publicar

### 🎯 Soluções Possíveis

#### Opção A: Remix como Homologação (Simples, Grátis)

```
[Dev/Test]          [Homologação]           [Produção]
Preview do          Remix do projeto        App publicado
Lovable             (projeto separado)      posto7.app
     │                    │                      │
     └── Testar ──▶ Validar ──▶ Replicar mudanças manualmente
```

**Como fazer:**
1. Crie um Remix do projeto (Settings → Remix this project)
2. Use o remix como ambiente de homologação
3. Valide tudo no remix antes de replicar as mudanças no projeto principal
4. Publique o projeto principal

**Prós:** Gratuito, fácil de configurar, bancos separados
**Contras:** Manter dois projetos sincronizados manualmente, Edge Functions não são isoladas

#### Opção B: GitHub + Branches (Profissional)

```
[branch: dev]       [branch: staging]       [branch: main]
Desenvolvimento     Homologação             Produção
     │                    │                      │
     └── PR ──────▶ Review ──────▶ Merge ──▶ Auto-deploy
```

**Como fazer:**
1. Conectar projeto ao GitHub (Settings → GitHub → Connect)
2. Habilitar branch switching (Account Settings → Labs)
3. Criar branches: `dev`, `staging`, `main`
4. Fluxo: desenvolver em `dev` → PR para `staging` → testar → PR para `main` → publicar

**Prós:** Controle de versão profissional, code review, histórico completo
**Contras:** Requer conhecimento de Git, Edge Functions ainda são compartilhadas

#### Opção C: Projetos Supabase Separados (Máximo Isolamento)

```
[Supabase Dev]      [Supabase Staging]      [Supabase Prod]
Projeto separado    Projeto separado        Projeto atual
     │                    │                      │
     └── Testar ──▶ Validar ──▶ Migrar schema + publicar
```

**Como fazer:**
1. Criar 2 projetos adicionais no Supabase Dashboard
2. Usar projetos diferentes para dev/staging
3. Migrar schema via SQL entre projetos
4. Cada projeto tem suas próprias Edge Functions, Secrets e banco

**Prós:** Isolamento total (banco, functions, secrets)
**Contras:** Custo adicional, complexidade de manter schemas sincronizados

### 📋 Recomendação

Para o momento atual do Posto 7 (< 1.000 usuários):

> **Usar Opção A (Remix)** para validação rápida + **Opção B (GitHub)** para controle de versão. Migrar para Opção C apenas se o projeto crescer significativamente.

---

## 2. Domínio e DNS

### Situação Atual

| Item | Status | Detalhes |
|------|--------|----------|
| Domínio `posto7.app` | ✅ Configurado | Via Cloudflare |
| Registro A (@) | ✅ Ativo | Aponta para `185.158.133.1` |
| Registro A (www) | ✅ Ativo | Aponta para `185.158.133.1` |
| TXT `_lovable` | ✅ Ativo | Verificação de propriedade |
| SSL/HTTPS | ✅ Automático | Provisionado pelo Lovable |
| URL do QR Code | ✅ Definida | `https://posto7.app/aplicativo` |

### Como Comprar um Domínio (Guia Geral)

Se precisar de outro domínio ou subdomínio:

1. **Escolher registrador:**
   - Brasil: [Registro.br](https://registro.br) (domínios .com.br — ~R$40/ano)
   - Internacional: [Namecheap](https://namecheap.com), [Cloudflare Registrar](https://dash.cloudflare.com), [Google Domains](https://domains.google)

2. **Pesquisar disponibilidade** do domínio desejado

3. **Comprar e configurar DNS:**
   ```
   Tipo: A    | Nome: @    | Valor: 185.158.133.1
   Tipo: A    | Nome: www  | Valor: 185.158.133.1
   Tipo: TXT  | Nome: _lovable | Valor: (fornecido pelo Lovable)
   ```

4. **Conectar no Lovable:**
   - Project Settings → Domains → Connect Domain
   - Inserir o domínio e seguir o fluxo

5. **Aguardar propagação DNS** (até 72h, geralmente minutos)

### 🔴 Débitos

| Débito | Prioridade | Ação |
|--------|-----------|------|
| Verificar se `www.posto7.app` redireciona para `posto7.app` | Média | Configurar redirecionamento no Lovable |
| Configurar domínio primário vs secundário | Média | Settings → Domains → definir Primary |

---

## 3. Hospedagem: Lovable vs Infraestrutura Própria

### A Estrutura Atual é Suficiente para Produção?

**Resposta curta: SIM, para o porte atual do Posto 7.**

### Avaliação Detalhada

| Critério | Lovable + Supabase | Veredicto |
|----------|-------------------|-----------|
| **Capacidade de usuários** | Supabase Free: até ~500 conexões simultâneas | ✅ Suficiente (< 1.000 clientes) |
| **Banco de dados** | PostgreSQL gerenciado, 500MB (Free) / 8GB (Pro) | ✅ Suficiente |
| **Edge Functions** | 500K invocações/mês (Free) / 2M (Pro) | ✅ Suficiente |
| **SSL/HTTPS** | Automático | ✅ OK |
| **Domínio customizado** | Suportado | ✅ Já configurado |
| **CDN/Performance** | Servido via Lovable CDN | ✅ OK |
| **Uptime/SLA** | Sem SLA formal no Lovable | ⚠️ Risco |
| **Backups automáticos** | Supabase Pro: backups diários | ⚠️ Verificar plano |
| **Compliance (LGPD)** | Dados em servidores fora do Brasil | ⚠️ Avaliar |
| **Escalabilidade** | Limitado pelo plano Supabase | ⚠️ Planejar |

### Quando Migrar para Infraestrutura Própria?

Considere migrar se:

| Sinal | Ação |
|-------|------|
| Mais de 5.000 usuários ativos | Avaliar Supabase Pro ou VPS próprio |
| Requisitos de compliance (LGPD estrita) | Hospedar em datacenter brasileiro |
| Necessidade de SLA (uptime garantido) | Migrar para cloud (AWS/GCP/Azure) |
| Processamento pesado (relatórios grandes) | Adicionar servidor dedicado |
| Custo do Supabase ultrapassando VPS | Migrar banco para PostgreSQL próprio |

### Opções de Migração Futura

#### Opção 1: Manter Lovable + Upgrade Supabase (Recomendado Agora)

```
Lovable (Frontend) → Supabase Pro (Backend)
                          └─ PostgreSQL gerenciado
                          └─ Edge Functions
                          └─ Auth
```

**Custo:** ~$25/mês (Supabase Pro)
**Esforço:** Zero — apenas upgrade de plano

#### Opção 2: GitHub Export + Vercel/Netlify

```
GitHub (Código) → Vercel (Frontend) → Supabase (Backend)
```

**Como migrar:**
1. Conectar projeto ao GitHub
2. Importar repo no Vercel/Netlify
3. Configurar variáveis de ambiente
4. Apontar domínio para Vercel

**Custo:** ~$20/mês (Vercel Pro) + $25/mês (Supabase Pro)
**Esforço:** Médio — reconfigurar deploy pipeline

#### Opção 3: VPS Própria (Máximo Controle)

```
VPS (DigitalOcean/Hetzner) → PostgreSQL próprio + Node.js
```

**Custo:** ~$10-50/mês
**Esforço:** Alto — migrar banco, reescrever Edge Functions para Node.js, configurar SSL, backups, etc.

### 📋 Recomendação

> **Ficar no Lovable + Supabase** pelo próximo ano. O sistema atende bem o volume atual. Quando ultrapassar 5.000 clientes ativos, avaliar upgrade para Supabase Pro e/ou migração do frontend para Vercel.

---

## 4. Segurança

### 🔴 Débitos de Segurança

| # | Débito | Risco | Prioridade | Status |
|---|--------|-------|-----------|--------|
| 1 | `whatsapp_logs` tem policies `USING (true)` — qualquer um pode ler | Alto | 🔴 Crítico | Pendente |
| 2 | `wa_templates` tem policy `USING (true)` para ALL — deveria ser admin | Médio | 🟡 Alto | Pendente |
| 3 | `checkin_public_links` não tem policies RLS definidas | Médio | 🟡 Alto | Pendente |
| 4 | `profiles.role` ainda existe mas não deveria ser usado (RBAC via `user_roles`) | Baixo | 🟢 Médio | Documentado |
| 5 | Edge Functions com `verify_jwt = false` em todas | Médio | 🟡 Alto | Por design (validação no código) |
| 6 | `ai_whatsapp_logs` permite INSERT público sem validação | Baixo | 🟢 Médio | Pendente |
| 7 | `whatsapp_settings` armazena tokens em texto plano na tabela | Alto | 🔴 Crítico | Pendente |

### Ações Recomendadas

1. **Restringir `whatsapp_logs`** — mudar SELECT para `is_staff()`
2. **Restringir `wa_templates`** — mudar ALL para usar `is_admin()`
3. **Adicionar RLS em `checkin_public_links`** — permitir apenas leitura por token válido
4. **Remover coluna `role` de `profiles`** — usar apenas `user_roles` (breaking change)
5. **Avaliar mover tokens para Vault** — Supabase Vault para dados sensíveis

---

## 5. Performance e Escalabilidade

### 🔴 Débitos

| # | Débito | Impacto | Prioridade |
|---|--------|---------|-----------|
| 1 | Sem paginação nas listagens do admin (carrega tudo) | Lentidão com muitos registros | 🟡 Alto |
| 2 | Sem cache de queries frequentes (React Query sem staleTime) | Requisições desnecessárias | 🟢 Médio |
| 3 | Limite de 1.000 linhas por query do Supabase | Dados truncados silenciosamente | 🟡 Alto |
| 4 | Sem índices otimizados para queries complexas | Queries lentas no futuro | 🟢 Médio |
| 5 | Sem CDN para assets estáticos (imagens, logos) | Carregamento mais lento | 🟢 Baixo |

---

## 6. Código e Arquitetura

### 🔴 Débitos

| # | Débito | Impacto | Prioridade |
|---|--------|---------|-----------|
| 1 | Arquivos de página muito grandes (ex: `Configuracoes.tsx`, `Dashboard.tsx`) | Difícil manutenção | 🟢 Médio |
| 2 | Lógica de negócio misturada com UI nos componentes | Difícil testar | 🟢 Médio |
| 3 | Sem testes automatizados (unitários ou e2e) | Risco de regressão | 🟡 Alto |
| 4 | Pastas de migrations com backups antigos (`migrations.BAK_*`, `_migrations_tmp_*`) | Poluição do repositório | 🟢 Baixo |
| 5 | Arquivo `.env` no repositório | Não deveria existir (Lovable injeta automaticamente) | 🟢 Baixo |
| 6 | Algumas Edge Functions duplicadas (`send-whatsapp` vs `whatsapp-send` vs `wa-send`) | Confusão sobre qual usar | 🟡 Alto |
| 7 | Tipos do Supabase gerados automaticamente — não refletem todas as constraints | Tipos incompletos | 🟢 Baixo |

---

## 7. Monitoramento e Observabilidade

### Situação Atual

| Item | Status |
|------|--------|
| Logs de Edge Functions | ✅ Disponível no Supabase Dashboard |
| Logs do banco (PostgreSQL) | ✅ Disponível via analytics |
| Monitoramento de uptime | ❌ Não configurado |
| Alertas de erro | ❌ Não configurado |
| Analytics de uso | ⚠️ Básico (Lovable analytics) |
| APM (Application Performance Monitoring) | ❌ Não configurado |

### 🔴 Débitos

| # | Débito | Prioridade |
|---|--------|-----------|
| 1 | Sem monitoramento de uptime (saber se o app caiu) | 🟡 Alto |
| 2 | Sem alertas automáticos por email/WhatsApp | 🟡 Alto |
| 3 | Sem tracking de erros no frontend (Sentry ou similar) | 🟢 Médio |
| 4 | Sem métricas de performance (Core Web Vitals) | 🟢 Baixo |

### Soluções Sugeridas

- **Uptime:** [UptimeRobot](https://uptimerobot.com) (grátis para 50 monitores)
- **Erros:** [Sentry](https://sentry.io) (grátis para 5K eventos/mês)
- **Performance:** [Google PageSpeed Insights](https://pagespeed.web.dev)

---

## 8. Backups e Recuperação

### Situação Atual

| Item | Status | Detalhes |
|------|--------|----------|
| Backup do código | ✅ OK | Histórico do Lovable + GitHub (se conectado) |
| Backup do banco (Test) | ⚠️ Depende do plano | Supabase Free: sem backup automático |
| Backup do banco (Live) | ⚠️ Depende do plano | Supabase Pro: backup diário |
| Backup manual | ❌ Não configurado | Sem exportação periódica |
| Plano de recuperação | ❌ Não existe | Sem runbook documentado |

### 🔴 Débitos

| # | Débito | Prioridade |
|---|--------|-----------|
| 1 | Sem backup automático do banco de produção (se Free) | 🔴 Crítico |
| 2 | Sem exportação periódica de dados críticos | 🟡 Alto |
| 3 | Sem plano de recuperação de desastres documentado | 🟡 Alto |
| 4 | GitHub não conectado (sem backup externo do código) | 🟡 Alto |

### Ação Imediata Recomendada

1. **Conectar projeto ao GitHub** — backup automático do código
2. **Verificar plano Supabase** — se Free, upgrade para Pro ($25/mês) para backups diários
3. **Criar rotina de exportação** — exportar tabelas críticas semanalmente via CSV (Cloud → Database → Export)
4. **Documentar runbook** — passos para recuperar o sistema em caso de falha

---

## Resumo de Prioridades

### 🔴 Crítico (Fazer Agora)

1. Corrigir policies RLS de `whatsapp_logs` e `checkin_public_links`
2. Conectar projeto ao GitHub (backup do código)
3. Verificar/ativar backups do banco de produção

### 🟡 Alto (Fazer Este Mês)

4. Consolidar Edge Functions duplicadas (wa-send vs whatsapp-send vs send-whatsapp)
5. Configurar monitoramento de uptime
6. Implementar paginação nas listagens do admin
7. Criar testes automatizados para fluxos críticos (check-in, sorteio, prêmio QR)

### 🟢 Médio (Próximo Trimestre)

8. Configurar ambiente de homologação (Remix ou GitHub branches)
9. Refatorar componentes grandes em arquivos menores
10. Separar lógica de negócio da UI
11. Avaliar migração de tokens sensíveis para Supabase Vault

### 🔵 Baixo (Backlog)

12. Limpar pastas de migrations antigas
13. Remover arquivo `.env` do repositório
14. Configurar CDN para assets
15. Implementar Core Web Vitals monitoring

---

> 📝 Este documento deve ser revisado mensalmente e atualizado conforme os débitos forem resolvidos.
