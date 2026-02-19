# 📊 Dashboard de Saúde — Posto 7

> Dados reais de produção · Período: 21/Jan – 19/Fev/2026 (30 dias)

---

## 🏥 Saúde Geral

```mermaid
pie title Módulos por Status
    "Funcionando (4)" : 4
    "Com Problemas (5)" : 5
    "Nunca Usado (6)" : 6
    "Legado (3)" : 3
```

| Indicador | Valor | Tendência |
|---|---|---|
| Check-ins / dia | **25** | 📈 Crescendo |
| Base de contatos | **926** | 📈 +12/semana |
| Taxa envio WhatsApp | **47%** | 🔻 Crítico |
| Sorteios realizados | **7** | ✅ Estável |
| Features em uso | **4 de 15** | ⚠️ 27% |

---

## 📈 Check-ins — Evolução Semanal

```mermaid
xychart-beta
    title "Check-ins por Semana"
    x-axis ["19/Jan", "26/Jan", "02/Fev", "09/Fev", "16/Fev"]
    y-axis "Quantidade" 0 --> 500
    bar [48, 197, 435, 202, 48]
    line [33, 127, 277, 110, 37]
```

| Semana | Check-ins | Telefones Únicos | Taxa Retorno |
|---|---|---|---|
| 19/Jan | 48 | 33 | 31% |
| 26/Jan | 197 | 127 | 36% |
| 02/Fev | **435** | **277** | 36% |
| 09/Fev | 202 | 110 | 46% |
| 16/Fev | 48 | 37 | 23% |
| **Total** | **930** | **—** | **—** |

> 📌 Pico na semana de 02/Fev. Semana atual (16/Fev) ainda parcial.

---

## 📱 WhatsApp — Taxa de Sucesso vs Falha

```mermaid
xychart-beta
    title "Envios WhatsApp: Sucesso vs Falha"
    x-axis ["19/Jan", "26/Jan", "02/Fev", "09/Fev", "16/Fev"]
    y-axis "Mensagens" 0 --> 700
    bar [43, 231, 217, 227, 83]
    line [1, 53, 659, 176, 16]
```

| Semana | ✅ Enviados | ❌ Falhas | Taxa Sucesso |
|---|---|---|---|
| 19/Jan | 43 | 1 | **98%** ✅ |
| 26/Jan | 231 | 53 | **81%** ✅ |
| 02/Fev | 217 | **659** | **25%** 🔴 |
| 09/Fev | 227 | 176 | **56%** 🟡 |
| 16/Fev | 83 | 16 | **84%** ✅ |
| **Total** | **801** | **905** | **47%** |

> 🔴 **Colapso na semana 02/Fev** — 659 falhas (75%). Recuperou parcialmente depois.

---

## 🎯 Campanhas WhatsApp — Funil

```mermaid
flowchart LR
    A["22 campanhas\ncriadas"] --> B["7.792 recipients\ncarregados"]
    B --> C["497 enviados\n6.4%"]
    B --> D["39 falharam\n0.5%"]
    B --> E["7.256 pending\n93.1%"]
    
    style A fill:#3b82f6,color:#fff
    style C fill:#22c55e,color:#fff
    style D fill:#ef4444,color:#fff
    style E fill:#6b7280,color:#fff
```

| Etapa | Número | % do Total |
|---|---|---|
| Campanhas criadas | 22 | — |
| Recipients carregados | 7.792 | 100% |
| ✅ Enviados | 497 | 6.4% |
| ❌ Falharam | 39 | 0.5% |
| ⏳ Nunca processados | **7.256** | **93.1%** |
| Campanhas completadas | **0** | **0%** |

> 🔴 **93% dos recipients nunca foram processados.** Nenhuma campanha chegou ao fim.

---

## 👥 Base de Contatos — Qualidade

```mermaid
pie title 926 Contatos por Estado
    "Sem opt-in (461)" : 461
    "Welcome falhou (254)" : 254
    "Aguardando nome (166)" : 166
    "Opt-in OK (45)" : 45
```

| Estado | Quantidade | % | Significado |
|---|---|---|---|
| `opt_in=false` | **461** | 50% | Nunca aceitaram marketing |
| `welcome_failed` | **254** | 27% | Msg boas-vindas falhou |
| `awaiting_name` | **166** | 18% | Esperando resposta |
| `opt_in=true + new` | **45** | 5% | Prontos para campanhas |

> ⚠️ Apenas **5% da base** está 100% pronta para receber campanhas.

---

## 🎰 Sorteios — Crescimento do Pool

```mermaid
xychart-beta
    title "Elegíveis por Sorteio"
    x-axis ["26/Jan", "29/Jan*", "03/Fev", "09/Fev", "18/Fev"]
    y-axis "Elegíveis" 0 --> 1000
    bar [23, 10, 705, 871, 920]
```

| Data | Elegíveis | Ganhadores | Tipo |
|---|---|---|---|
| 26/Jan | 23 | 3 | Real |
| 29/Jan | 10 | 3 | *Teste* |
| 03/Fev | 705 | 5 (3 runs) | Real |
| 09/Fev | 871 | 3 | Real |
| 18/Fev | **920** | 3 | Real |

> ✅ Pool crescendo de 23 → 920 em 24 dias. Feature saudável.

---

## 🔴 Módulos Inativos (0 registros)

| Módulo | Tabelas | Investimento de Dev | Decisão Sugerida |
|---|---|---|---|
| Livro Caixa | `livro_caixa` | Alto (UI + DRE) | Ativar ou Remover |
| Prêmios QR | `premios_qr`, `premios_qr_consumos` | Alto (RPC + UI + QR) | Ativar ou Remover |
| Stone TEF | `stone_tef_logs` | Médio (Webhook + UI) | Ativar ou Remover |
| Importação CSV | `imports_logs` | Médio (Parser + UI) | Ativar ou Remover |
| Frentista Metas | `frentista_metas` | Médio (UI + lógica) | Ativar ou Remover |
| Frentista PINs | `frentistas_pins` | Baixo (hash + dialog) | Ativar ou Remover |

> 💡 **6 módulos construídos que nunca foram usados = código morto que aumenta complexidade sem gerar valor.**

---

## 📊 Scorecard Executivo

```mermaid
quadrantChart
    title Features: Uso vs Saúde
    x-axis "Baixo Uso" --> "Alto Uso"
    y-axis "Com Problemas" --> "Saudável"
    quadrant-1 "Manter e Otimizar"
    quadrant-2 "Investigar"
    quadrant-3 "Considerar Remover"
    quadrant-4 "Corrigir Urgente"
    Check-ins: [0.9, 0.95]
    Sorteios: [0.5, 0.9]
    Promoções: [0.4, 0.85]
    Auth: [0.3, 0.8]
    WhatsApp Campanhas: [0.7, 0.15]
    Chatbot AI: [0.5, 0.25]
    Reclamações: [0.1, 0.6]
    AI Assistant: [0.1, 0.5]
    Frentistas: [0.15, 0.4]
    Livro Caixa: [0.01, 0.5]
    Prêmios QR: [0.01, 0.5]
    Stone TEF: [0.01, 0.3]
```

---

## ⚡ Top 3 Ações para Tomada de Decisão

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 🥇 | **Corrigir WhatsApp** — Evolution API com 53% falha, 93% recipients parados | 🔴 Crítico | Médio |
| 🥈 | **Reativar base** — 254 welcome_failed + 461 sem opt-in = 77% da base inativa | 🟡 Alto | Baixo |
| 🥉 | **Decidir sobre módulos mortos** — 6 features nunca usadas consumindo manutenção | 🟡 Médio | Baixo |

---

> 📅 Gerado: 19/02/2026 · Fonte: Banco de produção Supabase
