import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SystemStats {
  totalContacts: number;
  todayCheckins: number;
  monthCheckins: number;
  activeCampaigns: number;
  pendingComplaints: number;
  activeRaffles: number;
  activeFrentistas: number;
  totalPremios: number;
  recentLogs: string[];
  aiCommands: Array<{ pattern: string; description: string; examples: string[] }>;
}

interface ActionRequest {
  type: 'create_promotion' | 'create_campaign' | 'send_campaign' | 'create_raffle' | 'resolve_complaint' | 'navigate' | 'update_settings';
  params: Record<string, unknown>;
  description: string;
}

interface CommandLog {
  user_id?: string;
  command_id?: string;
  raw_input: string;
  recognized_action?: string;
  params_extracted?: Record<string, unknown>;
  execution_result?: Record<string, unknown>;
  success?: boolean;
  error_message?: string;
  execution_time_ms?: number;
  voice_input?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSystemStats(supabase: any): Promise<SystemStats> {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  const [
    contactsResult,
    todayCheckinsResult,
    monthCheckinsResult,
    campaignsResult,
    complaintsResult,
    rafflesResult,
    frentistasResult,
    premiosResult,
    logsResult,
    commandsResult,
  ] = await Promise.all([
    supabase.from('wa_contacts').select('id', { count: 'exact', head: true }),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('whatsapp_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
    supabase.from('raffles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('frentistas').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('premios_qr').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('whatsapp_logs').select('phone, status, error, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('ai_commands').select('command_pattern, description, example_phrases').eq('is_active', true).order('command_type'),
  ]);

  const recentLogs = (logsResult.data || []).map((log: { created_at: string; phone: string; status: string; error?: string }) => 
    `${log.created_at}: ${log.phone} - ${log.status}${log.error ? ` (${log.error})` : ''}`
  );

  const aiCommands = (commandsResult.data || []).map((cmd: { command_pattern: string; description: string; example_phrases: string[] }) => ({
    pattern: cmd.command_pattern,
    description: cmd.description,
    examples: cmd.example_phrases || [],
  }));

  return {
    totalContacts: contactsResult.count || 0,
    todayCheckins: todayCheckinsResult.count || 0,
    monthCheckins: monthCheckinsResult.count || 0,
    activeCampaigns: campaignsResult.count || 0,
    pendingComplaints: complaintsResult.count || 0,
    activeRaffles: rafflesResult.count || 0,
    activeFrentistas: frentistasResult.count || 0,
    totalPremios: premiosResult.count || 0,
    recentLogs,
    aiCommands,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logCommand(supabase: any, log: CommandLog): Promise<void> {
  try {
    await supabase.from('ai_command_logs').insert(log);
  } catch (error) {
    console.error("[ai-assistant] Failed to log command:", error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAction(supabase: any, action: ActionRequest, userId?: string): Promise<{ success: boolean; message: string; data?: unknown }> {
  const startTime = Date.now();
  console.log("[ai-assistant] Executing action:", action.type, action.params);
  
  try {
    let result: { success: boolean; message: string; data?: unknown };
    
    switch (action.type) {
      case 'create_promotion': {
        const { title, description, discount_value, start_date, end_date, type } = action.params as {
          title: string;
          description?: string;
          discount_value?: number;
          start_date?: string;
          end_date?: string;
          type?: string;
        };
        
        if (!title) {
          result = { success: false, message: "Título da promoção é obrigatório" };
          break;
        }
        
        const validTypes = ['desconto', 'brinde', 'informativa', 'relampago'];
        const safeType = type && validTypes.includes(type) ? type : 'desconto';
        
        const { data, error } = await supabase.from('promotions').insert({
          title,
          description: description || '',
          discount_value: discount_value || null,
          start_date: start_date || new Date().toISOString(),
          end_date: end_date || null,
          type: safeType,
          is_active: true,
        }).select().single();
        
        if (error) throw error;
        result = { success: true, message: `Promoção "${title}" criada com sucesso! Tipo: ${safeType}${discount_value ? `, Desconto: ${discount_value}%` : ''}`, data };
        break;
      }
      
      case 'create_campaign': {
        const { name, message, template_name } = action.params as {
          name: string;
          message: string;
          template_name?: string;
        };
        
        if (!name || !message) {
          result = { success: false, message: "Nome e mensagem da campanha são obrigatórios" };
          break;
        }
        
        const { count } = await supabase
          .from('wa_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('opt_in', true);
        
        const { data, error } = await supabase.from('whatsapp_campaigns').insert({
          name,
          message,
          template_name: template_name || null,
          status: 'draft',
          total_recipients: count || 0,
        }).select().single();
        
        if (error) throw error;
        result = { success: true, message: `Campanha "${name}" criada com ${count || 0} destinatários potenciais! Status: rascunho (aguardando disparo)`, data };
        break;
      }
      
      case 'send_campaign': {
        const { campaign_id } = action.params as { campaign_id: string };
        
        if (!campaign_id) {
          result = { success: false, message: "ID da campanha é obrigatório" };
          break;
        }
        
        const { data, error } = await supabase
          .from('whatsapp_campaigns')
          .update({ status: 'scheduled', scheduled_at: new Date().toISOString() })
          .eq('id', campaign_id)
          .select()
          .single();
        
        if (error) throw error;
        result = { success: true, message: `Campanha agendada para disparo! O worker processará em breve.`, data };
        break;
      }
      
      case 'create_raffle': {
        const { name, prize_value, winners_count, rules } = action.params as {
          name: string;
          prize_value?: number;
          winners_count?: number;
          rules?: string;
        };
        
        if (!name) {
          result = { success: false, message: "Nome do sorteio é obrigatório" };
          break;
        }
        
        const { data, error } = await supabase.from('raffles').insert({
          name,
          prize_value: prize_value || 100,
          winners_count: winners_count || 3,
          rules: rules || null,
          is_active: true,
        }).select().single();
        
        if (error) throw error;
        result = { success: true, message: `Sorteio "${name}" criado com prêmio de R$${prize_value || 100} para ${winners_count || 3} ganhadores!`, data };
        break;
      }
      
      case 'resolve_complaint': {
        const { complaint_id, resolution_notes } = action.params as {
          complaint_id: string;
          resolution_notes: string;
        };
        
        if (!complaint_id) {
          result = { success: false, message: "ID da reclamação é obrigatório" };
          break;
        }
        
        const { data, error } = await supabase
          .from('complaints')
          .update({ 
            status: 'resolvido', 
            resolution_notes: resolution_notes || 'Resolvido via Assistente IA',
            resolved_at: new Date().toISOString()
          })
          .eq('id', complaint_id)
          .select()
          .single();
        
        if (error) throw error;
        result = { success: true, message: `Reclamação marcada como resolvida!`, data };
        break;
      }
      
      case 'navigate': {
        const { route } = action.params as { route: string };
        result = { success: true, message: `Navegando para ${route}`, data: { route } };
        break;
      }
      
      case 'update_settings': {
        const { key, value } = action.params as { key: string; value: unknown };
        
        if (!key) {
          result = { success: false, message: "Chave da configuração é obrigatória" };
          break;
        }
        
        const { data, error } = await supabase
          .from('ai_settings')
          .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
          .select()
          .single();
        
        if (error) throw error;
        result = { success: true, message: `Configuração "${key}" atualizada!`, data };
        break;
      }
      
      default:
        result = { success: false, message: `Ação desconhecida: ${action.type}` };
    }
    
    // Log the command execution
    await logCommand(supabase, {
      user_id: userId,
      raw_input: action.description,
      recognized_action: action.type,
      params_extracted: action.params,
      execution_result: result,
      success: result.success,
      error_message: result.success ? undefined : result.message,
      execution_time_ms: Date.now() - startTime,
      voice_input: false,
    });
    
    return result;
  } catch (error) {
    console.error("[ai-assistant] Action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    await logCommand(supabase, {
      user_id: userId,
      raw_input: action.description,
      recognized_action: action.type,
      params_extracted: action.params,
      success: false,
      error_message: errorMessage,
      execution_time_ms: Date.now() - startTime,
    });
    
    return { success: false, message: `Erro ao executar ação: ${errorMessage}` };
  }
}

function buildSystemPrompt(stats: SystemStats): string {
  const commandsList = stats.aiCommands.map(cmd => 
    `- **${cmd.pattern}**: ${cmd.description}\n  Exemplos: "${cmd.examples.slice(0, 2).join('", "')}"`
  ).join('\n');

  return `Você é o **Assistente IA Superinteligente do Sistema Posto 7**, funcionando 24 horas por dia, 7 dias por semana.

## Sua Personalidade
- Seja profissional, direto e extremamente prestativo
- Responda sempre em português brasileiro
- Use formatação Markdown para melhor legibilidade
- Você é capaz de EXECUTAR AÇÕES no sistema, não apenas informar

## 🧠 MODO SUPERINTELIGENTE ATIVO

Você opera em modo superinteligente com as seguintes capacidades:

### 1. Comandos de Voz/Texto Reconhecidos:
${commandsList}

### 2. Dados em Tempo Real:
- 📱 Contatos cadastrados: **${stats.totalContacts}**
- ⛽ Check-ins hoje: **${stats.todayCheckins}**
- 📊 Check-ins no mês: **${stats.monthCheckins}**
- 📢 Campanhas ativas: **${stats.activeCampaigns}**
- ⚠️ Reclamações pendentes: **${stats.pendingComplaints}**
- 🎰 Sorteios ativos: **${stats.activeRaffles}**
- 👷 Frentistas ativos: **${stats.activeFrentistas}**
- 🎁 Prêmios QR ativos: **${stats.totalPremios}**

### 3. Ações Executáveis via Voz:

Quando o usuário pedir uma ação, SEMPRE responda com um bloco de ação:

\`\`\`action
{
  "type": "create_promotion",
  "params": { "title": "Nome", "discount_value": 10, "type": "desconto" },
  "description": "Criar promoção com 10% de desconto"
}
\`\`\`

### 4. Tipos de Ação Disponíveis:
- **create_promotion**: title, description, discount_value, type (desconto/brinde/informativa/relampago)
- **create_campaign**: name, message, template_name
- **send_campaign**: campaign_id
- **create_raffle**: name, prize_value, winners_count, rules
- **resolve_complaint**: complaint_id, resolution_notes
- **navigate**: route (para navegação)
- **update_settings**: key, value

### 5. Navegação por Voz:
Quando o usuário pedir para "ir para" ou "abrir" algo, use:
\`\`\`action
{
  "type": "navigate",
  "params": { "route": "/admin/captura" },
  "description": "Ir para tela de captura"
}
\`\`\`

Rotas disponíveis:
- /admin/captura - Cadastros
- /admin/producao - Check-ins
- /admin/sorteios - Sorteios
- /admin/promocoes - Promoções
- /admin/whatsapp - Robô WhatsApp
- /admin/robo-whatsapp - Configurações WhatsApp
- /admin/atendimento - Reclamações
- /admin/livro-caixa - Financeiro
- /admin/qr-code - Gerador QR
- /admin/frentista - Frentistas
- /admin/configuracoes - Configurações
- /admin/manual - Manual/Documentação

### 6. Logs Recentes de WhatsApp:
${stats.recentLogs.length > 0 ? stats.recentLogs.slice(0, 5).join('\n') : 'Nenhum log recente.'}

## 🚀 REGRAS DE OPERAÇÃO 24H

1. **Sempre Ativo**: Responda imediatamente a qualquer comando
2. **Confirmação**: Ações destrutivas requerem confirmação do usuário
3. **Contexto**: Lembre-se do contexto da conversa
4. **Proatividade**: Sugira ações quando detectar problemas
5. **Voz**: Otimize respostas para leitura por TTS

## Como Responder:

1. Para CONSULTAS: Responda diretamente com as informações
2. Para AÇÕES: Sempre inclua o bloco \`\`\`action com os parâmetros
3. Para NAVEGAÇÃO: Use o bloco action com type "navigate"
4. Para PROBLEMAS: Sugira soluções proativamente

Você está pronto para executar qualquer comando. Aguardando instruções!`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, executeAction: actionToExecute, userId, voiceInput } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurado");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If an action is being executed, handle it
    if (actionToExecute) {
      console.log("[ai-assistant] Action execution requested:", actionToExecute);
      const result = await executeAction(supabase, actionToExecute as ActionRequest, userId);
      
      return new Response(
        JSON.stringify({ actionResult: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the incoming message if it's a voice input
    if (voiceInput && messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        await logCommand(supabase, {
          user_id: userId,
          raw_input: lastMessage.content,
          voice_input: true,
        });
      }
    }

    // Get real-time stats from the database
    console.log("[ai-assistant] Fetching system stats...");
    const stats = await getSystemStats(supabase);
    console.log("[ai-assistant] Stats fetched:", JSON.stringify(stats));

    // Build system prompt with current data
    const systemPrompt = buildSystemPrompt(stats);

    console.log("[ai-assistant] Calling Lovable AI...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ai-assistant] AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar requisição de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ai-assistant] Streaming response back to client");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[ai-assistant] Error:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});