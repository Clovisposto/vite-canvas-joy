
# Plano: Assistente IA Integrado ao Sistema Posto 7

## Visao Geral

Criar uma nova aba no menu administrativo chamada **"Assistente IA"** com um chatbot inteligente que:
- Responde perguntas sobre o sistema como ChatGPT/Grok
- Tem acesso a informacoes do banco de dados (clientes, check-ins, campanhas, sorteios, etc.)
- Pode sugerir correcoes e melhorias
- Aceita comandos por texto (voz pode ser implementado futuramente)
- E restrito apenas a usuarios admin

## Arquitetura

```text
+---------------------+         +------------------------+
|   Frontend React    |         |   Edge Function        |
|   (AIAssistant.tsx) | ------> |   (ai-assistant)       |
+---------------------+         +------------------------+
         |                                  |
         | Chat UI                          | Chama Lovable AI
         | Streaming                        | com contexto do DB
         |                                  |
         v                                  v
+---------------------+         +------------------------+
|  Interface visual   |         |  Supabase Database     |
|  com historico      |         |  (consultas read-only) |
+---------------------+         +------------------------+
```

## Componentes a Criar

### 1. Nova Pagina: `src/pages/admin/AIAssistant.tsx`

Interface de chat moderna com:
- Area de mensagens com scroll
- Input de texto para comandos
- Indicador de "digitando..." durante streaming
- Historico de conversas (sessao atual)
- Cards de contexto mostrando dados relevantes do sistema
- Sugestoes rapidas de comandos

### 2. Nova Edge Function: `supabase/functions/ai-assistant/index.ts`

Funcao backend que:
- Recebe mensagens do admin
- Busca dados relevantes do banco (customers, checkins, campaigns, raffles, etc.)
- Monta contexto completo do sistema
- Chama Lovable AI (google/gemini-3-flash-preview) com streaming
- Retorna resposta inteligente

### 3. Atualizacoes Necessarias

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/admin/AdminLayout.tsx` | Adicionar item "Assistente IA" no menu (admin only) |
| `src/App.tsx` | Adicionar rota `/admin/ai-assistant` |
| `supabase/config.toml` | Registrar nova edge function |

## Prompt do Sistema (IA)

A IA sera configurada com contexto completo do Posto 7:
- Estrutura do banco de dados
- Funcionalidades disponiveis (sorteios, campanhas, frentistas, etc.)
- Metricas atuais (total clientes, check-ins, etc.)
- Capacidade de consultar dados em tempo real

## Funcionalidades da IA

| Comando Exemplo | Resposta |
|-----------------|----------|
| "Quantos clientes temos?" | Consulta DB e responde com numero atualizado |
| "Como funciona o sorteio?" | Explica o fluxo de sorteios do sistema |
| "Por que o disparo nao funcionou?" | Analisa logs e sugere correcoes |
| "Quais frentistas mais venderam?" | Gera relatorio com ranking |
| "Crie uma promocao de 10 centavos no PIX" | Sugere SQL/passos para criar |

## Limitacoes e Seguranca

- **Somente leitura**: A IA pode consultar dados mas NAO executa alteracoes automaticamente
- **Admin only**: Acesso restrito a usuarios com role admin
- **Rate limiting**: Usa LOVABLE_API_KEY ja configurado
- **Sem execucao de codigo**: A IA sugere mas nao aplica mudancas diretamente (seguranca)

## Detalhes Tecnicos

### Frontend (AIAssistant.tsx)

```typescript
// Estrutura basica
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Estados
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);

// Streaming via fetch + SSE
const sendMessage = async (text: string) => {
  // Envia para edge function
  // Processa stream token-by-token
  // Atualiza UI em tempo real
};
```

### Edge Function (ai-assistant/index.ts)

```typescript
// Contexto do sistema injetado
const systemContext = `
Voce e o assistente inteligente do sistema Posto 7.
Dados atuais:
- Clientes cadastrados: ${stats.customers}
- Check-ins hoje: ${stats.todayCheckins}
- Campanhas ativas: ${stats.activeCampaigns}
...
`;

// Chama Lovable AI com streaming
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [{ role: "system", content: systemContext }, ...history],
    stream: true
  })
});
```

### Menu (AdminLayout.tsx)

```typescript
// Novo item no array menuItems
{ 
  href: '/admin/ai-assistant', 
  icon: Sparkles, // ou Brain
  label: 'Assistente IA', 
  requiredRole: 'admin' 
}
```

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/AIAssistant.tsx` | Criar (novo) |
| `supabase/functions/ai-assistant/index.ts` | Criar (novo) |
| `src/components/admin/AdminLayout.tsx` | Modificar (add menu item) |
| `src/App.tsx` | Modificar (add route) |
| `supabase/config.toml` | Modificar (register function) |

## Interface Visual

- Header com titulo "Assistente IA" e icone de cerebro/sparkles
- Area de chat estilo ChatGPT (fundo escuro, mensagens em bolhas)
- Input na parte inferior com botao de enviar
- Sidebar opcional com sugestoes rapidas:
  - "Resumo do dia"
  - "Clientes novos hoje"
  - "Status das campanhas"
  - "Relatorio de vendas"
- Indicador visual quando a IA esta "pensando"

## Proximos Passos (Fora do Escopo Inicial)

1. **Comando de voz**: Integrar Web Speech API para reconhecimento
2. **Historico persistente**: Salvar conversas no banco
3. **Acoes diretas**: Permitir que IA execute acoes com confirmacao
4. **Dashboards dinamicos**: IA gera graficos baseados em perguntas
