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
}

interface ActionRequest {
  type: 'create_promotion' | 'create_campaign' | 'send_campaign' | 'create_raffle' | 'resolve_complaint';
  params: Record<string, unknown>;
  description: string;
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
  ]);

  const recentLogs = (logsResult.data || []).map((log: { created_at: string; phone: string; status: string; error?: string }) => 
    `${log.created_at}: ${log.phone} - ${log.status}${log.error ? ` (${log.error})` : ''}`
  );

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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAction(supabase: any, action: ActionRequest): Promise<{ success: boolean; message: string; data?: unknown }> {
  console.log("[ai-assistant] Executing action:", action.type, action.params);
  
  try {
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
          return { success: false, message: "Título da promoção é obrigatório" };
        }
        
        const { data, error } = await supabase.from('promotions').insert({
          title,
          description: description || '',
          discount_value: discount_value || null,
          start_date: start_date || new Date().toISOString(),
          end_date: end_date || null,
          type: type || 'informativa',
          is_active: true,
        }).select().single();
        
        if (error) throw error;
        return { success: true, message: `Promoção "${title}" criada com sucesso!`, data };
      }
      
      case 'create_campaign': {
        const { name, message, template_name } = action.params as {
          name: string;
          message: string;
          template_name?: string;
        };
        
        if (!name || !message) {
          return { success: false, message: "Nome e mensagem da campanha são obrigatórios" };
        }
        
        // Get count of eligible contacts
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
        return { success: true, message: `Campanha "${name}" criada com ${count || 0} destinatários potenciais! Status: rascunho (aguardando disparo)`, data };
      }
      
      case 'send_campaign': {
        const { campaign_id } = action.params as { campaign_id: string };
        
        if (!campaign_id) {
          return { success: false, message: "ID da campanha é obrigatório" };
        }
        
        // Update campaign status to 'scheduled'
        const { data, error } = await supabase
          .from('whatsapp_campaigns')
          .update({ status: 'scheduled', scheduled_at: new Date().toISOString() })
          .eq('id', campaign_id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, message: `Campanha agendada para disparo! O worker processará em breve.`, data };
      }
      
      case 'create_raffle': {
        const { name, prize_value, winners_count, rules } = action.params as {
          name: string;
          prize_value?: number;
          winners_count?: number;
          rules?: string;
        };
        
        if (!name) {
          return { success: false, message: "Nome do sorteio é obrigatório" };
        }
        
        const { data, error } = await supabase.from('raffles').insert({
          name,
          prize_value: prize_value || 100,
          winners_count: winners_count || 3,
          rules: rules || null,
          is_active: true,
        }).select().single();
        
        if (error) throw error;
        return { success: true, message: `Sorteio "${name}" criado com prêmio de R$${prize_value || 100} para ${winners_count || 3} ganhadores!`, data };
      }
      
      case 'resolve_complaint': {
        const { complaint_id, resolution_notes } = action.params as {
          complaint_id: string;
          resolution_notes: string;
        };
        
        if (!complaint_id) {
          return { success: false, message: "ID da reclamação é obrigatório" };
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
        return { success: true, message: `Reclamação marcada como resolvida!`, data };
      }
      
      default:
        return { success: false, message: `Ação desconhecida: ${action.type}` };
    }
  } catch (error) {
    console.error("[ai-assistant] Action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro ao executar ação: ${errorMessage}` };
  }
}

function buildSystemPrompt(stats: SystemStats): string {
  return `Você é o **Assistente IA do Sistema Posto 7**, um sistema completo de gestão para postos de combustível.

## Sua Personalidade
- Seja profissional, direto e prestativo
- Responda sempre em português brasileiro
- Use formatação Markdown para melhor legibilidade
- Quando não souber algo específico, seja honesto

## Conhecimento do Sistema

### Módulos Disponíveis:
1. **Captura de Clientes**: Cadastro via QR Code, check-ins de abastecimento
2. **Frentistas/Stone**: Integração TEF, controle de metas
3. **Sorteios**: Sistema de sorteios automáticos para clientes
4. **Promoções**: Gerenciamento de promoções e descontos
5. **WhatsApp**: Campanhas em massa, chatbot, envio automático
6. **Livro Caixa**: Controle financeiro de entradas/saídas
7. **QR Premiação**: Prêmios com QR Code para clientes
8. **Relatórios**: Produção, frentistas, vendas

### Estrutura do Banco de Dados:
- **wa_contacts**: Contatos WhatsApp (phone, name, opt_in, flow_state)
- **checkins**: Registros de abastecimento (phone, amount, liters, attendant_code, tag)
- **frentistas**: Funcionários do posto (nome, codigo, terminal_id)
- **whatsapp_campaigns**: Campanhas de disparo em massa
- **whatsapp_campaign_recipients**: Destinatários das campanhas
- **raffles**: Configuração de sorteios
- **raffle_runs**: Execuções de sorteios
- **promotions**: Promoções ativas
- **premios_qr**: Prêmios QR com saldo
- **complaints**: Reclamações de clientes
- **livro_caixa**: Registros financeiros
- **stone_tef_logs**: Logs de transações TEF

### Dados Atuais do Sistema:
- 📱 Contatos cadastrados: **${stats.totalContacts}**
- ⛽ Check-ins hoje: **${stats.todayCheckins}**
- 📊 Check-ins no mês: **${stats.monthCheckins}**
- 📢 Campanhas ativas: **${stats.activeCampaigns}**
- ⚠️ Reclamações pendentes: **${stats.pendingComplaints}**
- 🎰 Sorteios ativos: **${stats.activeRaffles}**
- 👷 Frentistas ativos: **${stats.activeFrentistas}**
- 🎁 Prêmios QR ativos: **${stats.totalPremios}**

### Logs Recentes de WhatsApp:
${stats.recentLogs.length > 0 ? stats.recentLogs.join('\n') : 'Nenhum log recente disponível.'}

## 🚀 AÇÕES EXECUTÁVEIS (NOVO!)

Você PODE executar ações no sistema! Quando o usuário pedir para criar/disparar algo, você deve responder com um bloco de ação especial.

### Ações Disponíveis:

1. **Criar Promoção** - \`create_promotion\`
   Parâmetros: title (obrigatório), description, discount_value, start_date, end_date, type

2. **Criar Campanha WhatsApp** - \`create_campaign\`
   Parâmetros: name (obrigatório), message (obrigatório), template_name

3. **Disparar Campanha** - \`send_campaign\`
   Parâmetros: campaign_id (obrigatório)

4. **Criar Sorteio** - \`create_raffle\`
   Parâmetros: name (obrigatório), prize_value, winners_count, rules

5. **Resolver Reclamação** - \`resolve_complaint\`
   Parâmetros: complaint_id (obrigatório), resolution_notes

### Como Propor Ações:

Quando o usuário pedir uma ação, responda incluindo um bloco JSON especial no formato:

\`\`\`action
{
  "type": "create_promotion",
  "params": {
    "title": "Promoção de Verão",
    "description": "10% de desconto no Pix",
    "discount_value": 10,
    "type": "desconto"
  },
  "description": "Criar promoção de verão com 10% de desconto"
}
\`\`\`

O sistema irá detectar esse bloco e mostrar um botão de confirmação para o usuário antes de executar.

### Exemplos de Pedidos:

- "Crie uma promoção de 5% de desconto no Pix" → Proponha create_promotion
- "Faça uma campanha de WhatsApp avisando sobre a nova promoção" → Proponha create_campaign
- "Crie um sorteio de R$200 para 5 ganhadores" → Proponha create_raffle

## Capacidades Atualizadas:
- ✅ Responder perguntas sobre o funcionamento do sistema
- ✅ Explicar como usar cada módulo
- ✅ Analisar dados e fornecer insights
- ✅ **EXECUTAR AÇÕES** com confirmação do usuário
- ✅ Criar promoções, campanhas, sorteios
- ✅ Resolver reclamações
- ✅ Ajudar a criar consultas SQL para análises

Sempre explique o que a ação vai fazer antes de propor, e inclua o bloco \`\`\`action para que o sistema mostre a confirmação.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, executeAction: actionToExecute } = await req.json();
    
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
      const result = await executeAction(supabase, actionToExecute as ActionRequest);
      
      return new Response(
        JSON.stringify({ actionResult: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
