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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSystemStats(supabase: any): Promise<SystemStats> {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  // Run all queries in parallel
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

## Capacidades
Você pode:
- ✅ Responder perguntas sobre o funcionamento do sistema
- ✅ Explicar como usar cada módulo
- ✅ Analisar dados e fornecer insights
- ✅ Sugerir correções de problemas
- ✅ Ajudar a criar consultas SQL para análises
- ✅ Orientar sobre boas práticas

## Limitações
Você NÃO pode:
- ❌ Executar alterações diretamente no banco de dados
- ❌ Acessar dados confidenciais de clientes individuais
- ❌ Modificar configurações do sistema automaticamente

Quando o usuário pedir uma ação que requer modificação, sugira os passos ou SQL necessário.`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurado");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
