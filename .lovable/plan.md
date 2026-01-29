

# Plano: Corrigir Assistente IA e Adicionar Comando de Voz

## Problema Identificado

O erro 404 ocorre porque:
- **URL:** `undefined/functions/v1/ai-assistant` (variavel `VITE_SUPABASE_URL` nao existe)
- **Token:** `Bearer undefined` (variavel `VITE_SUPABASE_PUBLISHABLE_KEY` nao existe)

A edge function funciona perfeitamente (testei e retornou resposta com dados do sistema), o problema esta apenas no frontend.

## Solucao

### 1. Corrigir URL e Token no AIAssistant.tsx

Trocar as variaveis de ambiente por constantes diretas ou importar do client.ts:

```typescript
// ANTES (quebrado):
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`

// DEPOIS (funcionando):
const SUPABASE_URL = "https://womgorjjweikolfhrhgp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiI..."; // anon key
const CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-assistant`;
```

### 2. Adicionar Comando de Voz com Web Speech API

Implementar reconhecimento de voz nativo do browser:

```typescript
// Hook de reconhecimento de voz
const [isListening, setIsListening] = useState(false);
const recognitionRef = useRef<SpeechRecognition | null>(null);

useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'pt-BR';
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };
  }
}, []);

const toggleVoice = () => {
  if (isListening) {
    recognitionRef.current?.stop();
  } else {
    recognitionRef.current?.start();
  }
  setIsListening(!isListening);
};
```

### 3. Interface Atualizada

Adicionar botao de microfone ao lado do input:

```
+------------------------------------------+
|  [Digite sua mensagem...        ] [🎤][➤] |
+------------------------------------------+
```

- Botao de microfone com animacao quando ativo
- Indicador visual "Ouvindo..." durante gravacao
- Cancelar com clique duplo

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/admin/AIAssistant.tsx` | Corrigir URL/token + adicionar voz |

## Recursos de Voz

- **Web Speech API**: Nativa do browser, sem custos
- **Idioma**: Portugues brasileiro (pt-BR)
- **Compatibilidade**: Chrome, Edge, Safari (maior parte dos navegadores modernos)

## Melhorias no Prompt da IA

A edge function ja esta bem configurada com:
- Contexto completo do sistema Posto 7
- Dados em tempo real (contatos, check-ins, campanhas)
- Logs recentes de WhatsApp
- Estrutura do banco de dados

## Fluxo Final

```
Usuario clica 🎤 → Navegador escuta voz → Transcreve para texto
                                              ↓
Usuario digita texto → Envia para Edge Function → IA responde com streaming
                                              ↓
                              Resposta exibida em Markdown com dados atualizados
```

## Resultado Esperado

1. **Assistente IA funcionando 100%** - sem erro 404
2. **Comando de voz** - falar e a IA entende e responde
3. **Respostas inteligentes** - com dados reais do sistema
4. **Interface profissional** - chat moderno com streaming

