# 🔴 Débitos Técnicos — Posto 7

> Documento focado em boas práticas de deploy, separação de ambientes e segurança.

**Última atualização:** Fevereiro 2026

---

## 1. Separação de Ambientes

### Situação Atual

| Recurso | Test (Preview) | Live (Produção) | Isolado? |
|---------|---------------|-----------------|----------|
| Frontend | Atualiza em tempo real | Atualiza ao publicar | ✅ Sim |
| Banco de dados | Separado | Separado | ✅ Sim |
| Edge Functions | Compartilhado | Compartilhado | ❌ Não |
| Migrations (schema) | Compartilhado | Compartilhado | ❌ Não |
| Secrets | Compartilhados | Compartilhados | ❌ Não |

### ⚠️ Riscos

- Alterar uma Edge Function no dev **afeta produção imediatamente**
- Migrations de schema atingem **ambos os ambientes** ao mesmo tempo
- Não existe ambiente de **homologação** para validação antes de publicar
- Mesmas chaves API para dev e prod (ex: Evolution API, OpenAI)

### 🎯 Plano de Ação

| # | Ação | Prioridade | Status |
|---|------|-----------|--------|
| 1 | Conectar projeto ao GitHub para versionamento | 🔴 Crítico | Pendente |
| 2 | Usar branches (`dev`, `staging`, `main`) via GitHub | 🟡 Alto | Pendente |
| 3 | Testar Edge Functions no preview antes de publicar frontend | 🟡 Alto | Em uso |
| 4 | Avaliar projetos Supabase separados para isolamento total | 🟢 Futuro | Backlog |

### Como implementar branches (Opção recomendada)

1. Settings → GitHub → Connect project
2. Account Settings → Labs → Habilitar "GitHub Branch Switching"
3. Criar branches: `dev` → `staging` → `main`
4. Fluxo: desenvolver em `dev` → PR para `staging` → validar → PR para `main` → Publish

---

## 2. Segurança (RLS e Acesso a Dados)

### Políticas RLS com Problemas

| # | Tabela | Problema | Risco | Prioridade |
|---|--------|----------|-------|-----------|
| 1 | `whatsapp_logs` | SELECT com `USING (true)` — qualquer anon pode ler | 🔴 Alto | Crítico |
| 2 | `wa_templates` | Policy ALL com `USING (true)` — deveria ser admin only | 🟡 Médio | Alto |
| 3 | `checkin_public_links` | Sem policies RLS definidas | 🟡 Médio | Alto |
| 4 | `ai_whatsapp_logs` | INSERT público sem validação | 🟢 Baixo | Médio |

### Armazenamento de Secrets Sensíveis

| # | Problema | Risco | Prioridade |
|---|----------|-------|-----------|
| 1 | `whatsapp_settings` armazena tokens (access_token, api_key) em texto plano | 🔴 Alto | Crítico |
| 2 | Tokens da Evolution API visíveis via SELECT na tabela | 🔴 Alto | Crítico |

**Solução recomendada:** Mover tokens sensíveis para Supabase Secrets (já usado para `EVOLUTION_API_KEY`) e referenciar apenas via Edge Functions. Remover colunas de token da tabela `whatsapp_settings`.

### Edge Functions sem JWT

Todas as Edge Functions estão com `verify_jwt = false` no `config.toml`. Isso significa que qualquer pessoa pode invocar as functions sem autenticação.

| Function | Justificativa | Ação |
|----------|--------------|------|
| `wa-webhook` | Recebe webhooks externos (ok) | ✅ Manter |
| `stone-webhook` | Recebe webhooks externos (ok) | ✅ Manter |
| `wa-send` | Deveria exigir auth | 🔴 Adicionar validação |
| `ai-assistant` | Deveria exigir auth | 🔴 Adicionar validação |
| `wa-campaign-run` | Deveria exigir auth | 🔴 Adicionar validação |
| `raffle-confirmation` | Deveria exigir auth | 🟡 Avaliar |

### Coluna `role` em `profiles`

A coluna `profiles.role` ainda existe mas o sistema RBAC usa `user_roles`. Manter ambos cria risco de confusão e possível escalação de privilégio se alguém usar `profiles.role` em vez de `user_roles`.

**Ação:** Remover coluna `role` de `profiles` após confirmar que nenhum código a utiliza.

---

## 3. Boas Práticas de Deploy

### Checklist Antes de Publicar

- [ ] Testar fluxo completo no preview (Test)
- [ ] Verificar se migrations não quebram dados existentes em Live
- [ ] Confirmar que Edge Functions novas já foram deployadas e testadas
- [ ] Verificar logs de Edge Functions por erros recentes
- [ ] Confirmar que secrets necessários estão configurados

### Processo de Deploy Atual

```
Editar código → Preview atualiza (Test) → Testar → Publish → Live atualiza
                                                      ↑
                                          Edge Functions já estão em prod!
```

### ⚠️ Cuidados Críticos

1. **Migrations são irreversíveis** — não há rollback automático. Sempre teste o SQL antes.
2. **Edge Functions deployam imediatamente** — qualquer alteração em `supabase/functions/` vai direto para produção.
3. **Dados de Test e Live são independentes** — dados criados no preview não existem em produção.
4. **Limite de 1.000 linhas** por query no Supabase — queries sem paginação podem truncar resultados silenciosamente.

### Edge Functions Duplicadas

Existem 3 functions que fazem coisas similares (enviar WhatsApp):

| Function | Status | Ação |
|----------|--------|------|
| `wa-send` | ✅ Principal | Manter |
| `whatsapp-send` | ⚠️ Duplicada | Avaliar remoção |
| `send-whatsapp` | ⚠️ Duplicada | Avaliar remoção |

**Ação:** Consolidar em uma única function (`wa-send`) e remover as duplicatas.

---

## 4. Backups e Recuperação

| Item | Status | Ação |
|------|--------|------|
| Backup do código (GitHub) | ❌ Não conectado | Conectar GitHub |
| Backup do banco (automático) | ⚠️ Depende do plano Supabase | Verificar se é Pro |
| Exportação manual de dados | ❌ Não configurado | Criar rotina semanal |
| Plano de recuperação (runbook) | ❌ Não existe | Documentar |

---

## 5. Monitoramento

| Item | Status | Solução Sugerida |
|------|--------|-----------------|
| Monitoramento de uptime | ❌ Não configurado | [UptimeRobot](https://uptimerobot.com) (grátis) |
| Alertas de erro | ❌ Não configurado | Sentry ou email via Edge Function |
| Tracking de erros frontend | ❌ Não configurado | [Sentry](https://sentry.io) (grátis 5K eventos/mês) |

---

## Resumo de Prioridades

### 🔴 Fazer Agora

1. Conectar projeto ao GitHub
2. Corrigir RLS de `whatsapp_logs` (remover `USING (true)`)
3. Mover tokens sensíveis de `whatsapp_settings` para Secrets
4. Adicionar validação de auth nas Edge Functions expostas

### 🟡 Fazer Este Mês

5. Implementar branches (dev/staging/main) via GitHub
6. Adicionar RLS em `checkin_public_links`
7. Consolidar Edge Functions duplicadas
8. Configurar monitoramento de uptime
9. Remover coluna `role` de `profiles`

### 🟢 Próximo Trimestre

10. Avaliar projetos Supabase separados para isolamento total
11. Configurar Sentry para tracking de erros
12. Criar rotina de backup/exportação de dados
13. Documentar runbook de recuperação

---

> 📝 Revisar mensalmente. Marcar itens resolvidos com ✅.
