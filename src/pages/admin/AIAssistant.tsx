import { useState, useRef, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Send, 
  Sparkles, 
  User, 
  Bot, 
  Loader2, 
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  History,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ActionRequest {
  type: 'create_promotion' | 'create_campaign' | 'send_campaign' | 'create_raffle' | 'resolve_complaint';
  params: Record<string, unknown>;
  description: string;
}

interface PendingAction {
  action: ActionRequest;
  messageId: string;
}

// Correct Supabase URL and key
const SUPABASE_URL = "https://womgorjjweikolfhrhgp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvbWdvcmpqd2Vpa29sZmhyaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzE2MTMsImV4cCI6MjA4NDUwNzYxM30.Y9Dl1upWiVcPX0HvigrHdQ3mk0j_VKOma0nJJY0R2ls";
const CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-assistant`;

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const quickCommands = [
  { label: 'Resumo do dia', message: 'Me dê um resumo completo do dia de hoje: check-ins, campanhas, reclamações e qualquer ponto de atenção.' },
  { label: 'Status do sistema', message: 'Qual o status atual do sistema? Tudo funcionando corretamente?' },
  { label: 'Criar promoção', message: 'Crie uma promoção de 10% de desconto para pagamentos no Pix, válida por 7 dias.' },
  { label: 'Criar campanha', message: 'Crie uma campanha de WhatsApp para avisar os clientes sobre uma nova promoção.' },
];

// Action type labels in Portuguese
const actionTypeLabels: Record<string, string> = {
  create_promotion: '🎯 Criar Promoção',
  create_campaign: '📢 Criar Campanha',
  send_campaign: '🚀 Disparar Campanha',
  create_raffle: '🎰 Criar Sorteio',
  resolve_complaint: '✅ Resolver Reclamação',
};

// Helper function to clean markdown for speech
const cleanTextForSpeech = (text: string): string => {
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\s]*[-*+]\s*/gm, '')
    .replace(/^[\s]*\d+\.\s*/gm, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Parse action blocks from AI response
const parseActionBlocks = (content: string): ActionRequest[] => {
  const actions: ActionRequest[] = [];
  const actionRegex = /```action\s*([\s\S]*?)```/g;
  let match;
  
  while ((match = actionRegex.exec(content)) !== null) {
    try {
      const actionJson = match[1].trim();
      const action = JSON.parse(actionJson) as ActionRequest;
      if (action.type && action.params && action.description) {
        actions.push(action);
      }
    } catch (e) {
      console.error('Failed to parse action block:', e);
    }
  }
  
  return actions;
};

// Remove action blocks from content for display
const removeActionBlocks = (content: string): string => {
  return content.replace(/```action\s*[\s\S]*?```/g, '').trim();
};

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [actionResults, setActionResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { toast } = useToast();

  // Load user and chat history from Supabase
  useEffect(() => {
    const loadUserAndHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadChatHistory(user.id);
      }
    };
    loadUserAndHistory();
  }, []);

  // Load chat history from Supabase
  const loadChatHistory = async (uid: string) => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedMessages: Message[] = data.map((row) => ({
          id: row.id,
          role: row.role as 'user' | 'assistant',
          content: row.content,
          timestamp: new Date(row.created_at),
        }));
        setMessages(loadedMessages);
        toast({
          title: "Histórico carregado",
          description: `${data.length} mensagens recuperadas`,
        });
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save message to Supabase
  const saveMessageToHistory = async (role: 'user' | 'assistant', content: string) => {
    if (!userId) return;
    
    try {
      await supabase.from('ai_chat_history').insert({
        user_id: userId,
        role,
        content,
      });
    } catch (error) {
      console.error('Error saving message to history:', error);
    }
  };

  // Clear chat history from Supabase
  const clearChatHistory = async () => {
    if (!userId) {
      setMessages([]);
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_chat_history')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setMessages([]);
      setActionResults(new Map());
      toast({
        title: "Histórico limpo",
        description: "Todas as conversas foram removidas",
      });
    } catch (error) {
      console.error('Error clearing chat history:', error);
      setMessages([]);
    }
  };

  // Execute action via edge function
  const executeAction = async (action: ActionRequest) => {
    setIsExecutingAction(true);
    
    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ executeAction: action }),
      });

      const data = await response.json();
      
      if (data.actionResult) {
        const result = data.actionResult as { success: boolean; message: string };
        
        // Store the result
        if (pendingAction) {
          setActionResults(prev => new Map(prev).set(pendingAction.messageId, result));
        }
        
        // Add result message to chat
        const resultMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.success 
            ? `✅ **Ação executada com sucesso!**\n\n${result.message}`
            : `❌ **Falha na execução**\n\n${result.message}`,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, resultMessage]);
        await saveMessageToHistory('assistant', resultMessage.content);
        
        toast({
          title: result.success ? "Ação executada!" : "Falha na ação",
          description: result.message,
          variant: result.success ? "default" : "destructive",
        });
        
        if (result.success && voiceEnabled) {
          speakText(result.message);
        }
      }
    } catch (error) {
      console.error('Error executing action:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar ação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExecutingAction(false);
      setPendingAction(null);
    }
  };

  // Speak text using Web Speech API TTS
  const speakText = useCallback((text: string) => {
    if (!synthRef.current || !voiceEnabled || !ttsSupported) return;
    
    synthRef.current.cancel();
    
    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;
    
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = synthRef.current.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt')) || voices[0];
    if (ptVoice) {
      utterance.voice = ptVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [voiceEnabled, ttsSupported]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionAPI) {
      setVoiceSupported(true);
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice transcript:', transcript);
        if (transcript.trim()) {
          sendMessage(transcript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      setTtsSupported(true);
      
      const loadVoices = () => {
        synthRef.current?.getVoices();
      };
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      stopSpeaking();
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  };

  const toggleTTS = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setVoiceEnabled(!voiceEnabled);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    stopSpeaking();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message to history
    await saveMessageToHistory('user', text.trim());

    let assistantContent = '';
    let fullResponse = '';
    let currentMessageId = '';

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      fullResponse = assistantContent;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === currentMessageId) {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        currentMessageId = crypto.randomUUID();
        return [...prev, {
          id: currentMessageId,
          role: 'assistant' as const,
          content: assistantContent,
          timestamp: new Date(),
        }];
      });
    };

    try {
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Resposta sem corpo');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        for (const raw of buffer.split('\n')) {
          if (!raw || raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Parse actions from response
      const actions = parseActionBlocks(fullResponse);
      if (actions.length > 0) {
        console.log('Detected actions:', actions);
        // Set the first action as pending
        setPendingAction({ action: actions[0], messageId: currentMessageId });
      }

      // Save assistant response to history (without action blocks for cleaner history)
      if (fullResponse) {
        await saveMessageToHistory('assistant', removeActionBlocks(fullResponse));
      }

      // Speak the complete response after streaming is done (without action blocks)
      if (fullResponse && voiceEnabled) {
        setTimeout(() => {
          speakText(removeActionBlocks(fullResponse));
        }, 100);
      }

    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorContent = `❌ **Erro:** ${errorMessage}\n\nTente novamente em alguns segundos.`;
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    stopSpeaking();
    clearChatHistory();
  };

  const refreshHistory = async () => {
    if (userId) {
      await loadChatHistory(userId);
    }
  };

  // Render message with action button if applicable
  const renderMessageContent = (message: Message) => {
    const actions = parseActionBlocks(message.content);
    const cleanContent = removeActionBlocks(message.content);
    const result = actionResults.get(message.id);
    
    return (
      <>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
        </div>
        
        {actions.length > 0 && (
          <div className="mt-4 space-y-2">
            {actions.map((action, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">
                    {actionTypeLabels[action.type] || action.type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{action.description}</p>
                
                {result ? (
                  <div className={cn(
                    "flex items-center gap-2 text-sm p-2 rounded",
                    result.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"
                  )}>
                    {result.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{result.message}</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-fit"
                    onClick={() => setPendingAction({ action, messageId: message.id })}
                    disabled={isExecutingAction}
                  >
                    {isExecutingAction ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Executar Ação
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <AdminLayout title="Assistente IA">
      <div className="flex flex-col h-[calc(100vh-180px)] max-w-5xl mx-auto">
        {/* Header with quick stats */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Assistente Inteligente</h2>
              <p className="text-xs text-muted-foreground">
                Pergunte ou peça ações
                {voiceSupported && ' • 🎤 Voz'}
                {ttsSupported && ' • 🔊 Leitura'}
                {userId && ' • 💾 Salvo'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* History refresh button */}
            {userId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshHistory}
                disabled={isLoadingHistory}
              >
                {isLoadingHistory ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <History className="w-4 h-4" />
                )}
              </Button>
            )}
            
            {/* TTS Toggle */}
            {ttsSupported && (
              <Button 
                variant={voiceEnabled ? "default" : "outline"} 
                size="sm" 
                onClick={toggleTTS}
                className="gap-1"
              >
                {voiceEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Voz</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span className="hidden sm:inline">Mudo</span>
                  </>
                )}
              </Button>
            )}
            
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <span className="text-muted-foreground">Carregando histórico...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Olá! Sou o Assistente do Posto 7</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Posso te ajudar com informações, análises e agora também
                  <span className="text-primary font-medium"> executar ações</span> como criar promoções e campanhas!
                </p>
                
                <div className="flex flex-wrap justify-center gap-2 mb-6 text-sm">
                  {voiceSupported && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full">
                      🎤 Comando de voz
                    </span>
                  )}
                  {ttsSupported && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full">
                      🔊 Respostas por voz
                    </span>
                  )}
                  <span className="px-3 py-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded-full">
                    ⚡ Ações executáveis
                  </span>
                </div>
                
                {/* Quick commands */}
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  {quickCommands.map((cmd, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="justify-start h-auto py-2 px-3 text-left"
                      onClick={() => sendMessage(cmd.message)}
                    >
                      <span className="text-xs">{cmd.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {message.role === 'assistant' ? (
                        renderMessageContent(message)
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                    
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          
          {/* Input area */}
          <CardContent className="border-t p-4">
            {/* Voice indicators */}
            {(isListening || isSpeaking) && (
              <div className="mb-3 flex items-center justify-center gap-2 text-primary animate-pulse">
                {isListening && (
                  <>
                    <Mic className="w-5 h-5" />
                    <span className="text-sm font-medium">Ouvindo... Fale agora!</span>
                  </>
                )}
                {isSpeaking && (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Falando...</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={stopSpeaking}
                      className="h-6 px-2"
                    >
                      Parar
                    </Button>
                  </>
                )}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite ou peça: 'Crie uma promoção de 10% no Pix'"
                className="min-h-[44px] max-h-[150px] resize-none"
                disabled={isLoading || isListening}
              />
              
              {/* Voice button */}
              {voiceSupported && (
                <Button 
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="icon" 
                  className={cn(
                    "h-11 w-11 flex-shrink-0 transition-all",
                    isListening && "animate-pulse"
                  )}
                  onClick={toggleVoice}
                  disabled={isLoading}
                  title={isListening ? "Parar de ouvir" : "Falar comando"}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              )}
              
              <Button 
                type="submit" 
                size="icon" 
                className="h-11 w-11 flex-shrink-0"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            
            <p className="text-xs text-muted-foreground mt-2 text-center">
              ⚡ Ações com confirmação • 
              {voiceSupported && ' 🎤 Voz • '}
              {ttsSupported && ' 🔊 Leitura • '}
              💾 Histórico salvo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Ação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você está prestes a executar a seguinte ação:</p>
                
                {pendingAction && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="font-medium text-foreground">
                      {actionTypeLabels[pendingAction.action.type] || pendingAction.action.type}
                    </div>
                    <p className="text-sm">{pendingAction.action.description}</p>
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      <strong>Parâmetros:</strong>
                      <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto">
                        {JSON.stringify(pendingAction.action.params, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Esta ação modificará dados no sistema. Deseja continuar?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecutingAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && executeAction(pendingAction.action)}
              disabled={isExecutingAction}
              className="bg-primary"
            >
              {isExecutingAction ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Confirmar e Executar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
