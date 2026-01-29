import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone normalization to E.164 Brazilian format
function normalizePhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const withoutPrefix = digits.startsWith("55") ? digits.slice(2) : digits;
  const local = withoutPrefix.length > 11 ? withoutPrefix.slice(-11) : withoutPrefix;
  return `55${local}`;
}

// Sanitize URL for security
function sanitizeUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  const val = raw.trim().replace(/^=+/, "").replace(/\/+$/, "").trim();
  try {
    const url = new URL(val);
    if (url.protocol !== "https:") return "";
    return val;
  } catch {
    return "";
  }
}

function sanitizeApiKey(raw: string | undefined | null): string {
  if (!raw) return "";
  const val = raw.trim().replace(/^EVOLUTION_API_KEY\s*=\s*/i, "").replace(/^['\"]+|['\"]+$/g, "").replace(/[\r\n\t]/g, "").trim();
  return val.split("").filter((c) => {
    const code = c.charCodeAt(0);
    return code >= 32 && code <= 126;
  }).join("");
}

function sanitizeInstance(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^EVOLUTION_INSTANCE_NAME\s*=\s*/i, "").replace(/^instance\s*[:=]\s*/i, "").replace(/^name\s*[:=]\s*/i, "").replace(/^['\"]+|['\"]+$/g, "").trim();
}

// System prompt for the AI chatbot
const SYSTEM_PROMPT = `Você é o assistente oficial do Auto Posto Pará (Grupo Pará). Seu objetivo é oferecer um atendimento humanizado, educado e profissional.

REGRAS DE COMUNICAÇÃO:
- Linguagem humana, educada e profissional
- Comunicação clara, organizada e acolhedora
- Nunca use termos técnicos
- Nunca pareça robótico
- Sempre valorize a confiança do cliente
- Seja conciso nas respostas

CONTEXTO DO NEGÓCIO:
- Sorteio semanal: 3 prêmios de R$100,00 todos os sábados às 17h
- Promoções relâmpago com descontos de até R$0,80 por litro
- Contato por WhatsApp para prêmios e novidades

VOCÊ DEVE:
1. Quando o flow_state for "new" ou "awaiting_name": Pedir o nome e sobrenome do cliente de forma amigável
2. Quando receber um nome: Confirmar o cadastro e agradecer
3. Quando o flow_state for "completed": Responder perguntas sobre o posto, promoções e sorteios

IMPORTANTE:
- Se o cliente enviar algo que parece ser um nome (1-4 palavras, sem números ou caracteres especiais), considere como nome
- Se não parecer um nome, peça educadamente para informar o nome completo
- Sempre use o nome do cliente quando disponível
- Mantenha as respostas curtas e objetivas`;

// Default welcome message (fallback)
const DEFAULT_WELCOME_MESSAGE = `👋 Olá! Seja muito bem-vindo(a) ao Auto Posto Pará!

É um prazer ter você com a gente. Obrigado pela confiança e preferência 🤝

Por aqui você vai receber informações importantes, promoções exclusivas e novidades especiais.

🎉 Participação confirmada!
Você já está participando do sorteio do Posto 7.

🏆 Sorteio semanal
📅 Data: todos os sábados
⏰ Horário: 17h
🎁 Prêmios: 3 sorteios de R$ 100,00

📞 Caso seja contemplado, entraremos em contato por este mesmo número.

⚡ Fique atento(a): promoções relâmpago com descontos de até R$ 0,80 por litro.

Antes de continuar, queremos te chamar pelo nome 😊

👉 Por favor, informe seu *nome e sobrenome* no campo abaixo:`;

// Default farewell message (fallback)
const DEFAULT_FAREWELL_MESSAGE = `Obrigado pelo contato! 😊

Foi um prazer falar com você. Estamos sempre à disposição para ajudar.

Até a próxima! 🙋
Auto Posto Pará – Economia de verdade!`;

// Fetch welcome message from settings table
async function getWelcomeMessage(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'whatsapp_welcome_message')
      .single();
    
    if (data?.value) {
      const value = typeof data.value === 'string' 
        ? data.value.replace(/^"|"$/g, '') 
        : data.value;
      console.log("[wa-ai-chatbot] Using welcome message from settings");
      return value;
    }
  } catch (error) {
    console.log("[wa-ai-chatbot] No custom welcome message, using default");
  }
  return DEFAULT_WELCOME_MESSAGE;
}

// Fetch farewell message from settings table
async function getFarewellMessage(supabase: any, contactName: string | null): Promise<string> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'whatsapp_farewell_message')
      .single();
    
    if (data?.value) {
      let message = typeof data.value === 'string' 
        ? data.value.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
        : data.value;
      
      // Replace {{nome}} placeholder with actual name
      if (contactName) {
        message = message.replace(/\{\{nome\}\}/gi, contactName);
      } else {
        // Remove {{nome}} and clean up awkward punctuation
        message = message.replace(/,?\s*\{\{nome\}\}/gi, '').replace(/\s+!/g, '!');
      }
      
      console.log("[wa-ai-chatbot] Using farewell message from settings");
      return message;
    }
  } catch (error) {
    console.log("[wa-ai-chatbot] No custom farewell message, using default");
  }
  
  // Return default with name if available
  if (contactName) {
    return `Obrigado pelo contato, ${contactName}! 😊

Foi um prazer falar com você. Estamos sempre à disposição para ajudar.

Até a próxima! 🙋
Auto Posto Pará – Economia de verdade!`;
  }
  return DEFAULT_FAREWELL_MESSAGE;
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Safe string conversion for error messages
function safeErrorString(error: unknown, maxLength: number = 500): string | null {
  if (error === null || error === undefined) return null;
  if (typeof error === 'string') return error.substring(0, maxLength);
  if (error instanceof Error) return error.message.substring(0, maxLength);
  try {
    return JSON.stringify(error).substring(0, maxLength);
  } catch {
    return String(error).substring(0, maxLength);
  }
}

// Send message via Evolution API with robust retry logic
async function sendWhatsAppMessageWithRetry(
  phone: string, 
  message: string,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<{ success: boolean; messageId?: string; error?: string; isTransient?: boolean; attempts: number }> {
  const baseUrl = sanitizeUrl(Deno.env.get("EVOLUTION_API_URL"));
  const apiKey = sanitizeApiKey(Deno.env.get("EVOLUTION_API_KEY"));
  const instance = sanitizeInstance(Deno.env.get("EVOLUTION_INSTANCE_NAME"));

  if (!baseUrl || !apiKey || !instance) {
    console.error("[wa-ai-chatbot] Evolution API not configured");
    return { success: false, error: "Evolution API não configurada", attempts: 0 };
  }

  const url = `${baseUrl}/message/sendText/${instance}`;
  let lastError = "";
  let lastIsTransient = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[wa-ai-chatbot] Sending message to ${phone} (attempt ${attempt}/${maxRetries})`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, text: message }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const responseText = await res.text();
      let responseData: Record<string, unknown> = {};
      try { responseData = JSON.parse(responseText); } catch { /* ignore */ }
      
      if (res.ok) {
        const messageId = (responseData?.key as Record<string, unknown>)?.id as string || 
                         responseData?.messageId as string || null;
        console.log(`[wa-ai-chatbot] Message sent successfully to ${phone} on attempt ${attempt}`);
        return { success: true, messageId: messageId || undefined, attempts: attempt };
      }
      
      // Check for transient errors (Connection Closed, 500, 502, 503, 504 errors)
      const errorMsg = (responseData?.response as Record<string, unknown>)?.message as string || 
                      responseData?.error as string || 
                      `HTTP ${res.status}`;
      const isTransient = 
        errorMsg.includes("Connection Closed") || 
        errorMsg.includes("socket hang up") ||
        errorMsg.includes("ECONNRESET") ||
        errorMsg.includes("timeout") ||
        res.status === 500 || 
        res.status === 502 || 
        res.status === 503 || 
        res.status === 504;
      
      lastError = errorMsg;
      lastIsTransient = isTransient;
      
      console.warn(`[wa-ai-chatbot] Attempt ${attempt} failed: ${res.status} - ${errorMsg}`);
      
      // If transient error and not last attempt, wait and retry
      if (isTransient && attempt < maxRetries) {
        const waitTime = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
        console.log(`[wa-ai-chatbot] Transient error, waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        continue;
      }
      
      // Non-transient error or last attempt
      if (!isTransient) {
        console.error(`[wa-ai-chatbot] Non-transient error, not retrying: ${errorMsg}`);
        break;
      }
      
    } catch (e) {
      const errorMsg = String(e);
      const isTransient = 
        errorMsg.includes("abort") || 
        errorMsg.includes("timeout") ||
        errorMsg.includes("network") ||
        errorMsg.includes("fetch failed");
      
      lastError = errorMsg;
      lastIsTransient = isTransient;
      
      console.warn(`[wa-ai-chatbot] Attempt ${attempt} exception: ${errorMsg}`);
      
      if (isTransient && attempt < maxRetries) {
        const waitTime = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[wa-ai-chatbot] Network error, waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        continue;
      }
    }
  }
  
  console.error(`[wa-ai-chatbot] All ${maxRetries} attempts failed for ${phone}`);
  return { success: false, error: lastError, isTransient: lastIsTransient, attempts: maxRetries };
}

// Wrapper for backward compatibility
async function sendWhatsAppMessage(
  phone: string, 
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string; isTransient?: boolean }> {
  const result = await sendWhatsAppMessageWithRetry(phone, message, 3, 2000);
  return { 
    success: result.success, 
    messageId: result.messageId, 
    error: result.error, 
    isTransient: result.isTransient 
  };
}

// Check if text looks like a name
function looksLikeName(text: string): boolean {
  const cleaned = text.trim();
  // Should be 2-60 chars, contain only letters and spaces, 1-4 words
  if (cleaned.length < 2 || cleaned.length > 60) return false;
  if (!/^[a-záàâãéèêíïóôõöúçñA-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+$/.test(cleaned)) return false;
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  return words.length >= 1 && words.length <= 5;
}

// Call Lovable AI to generate response
async function generateAIResponse(
  contactName: string | null, 
  flowState: string, 
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("[wa-ai-chatbot] LOVABLE_API_KEY not configured");
    // Fallback responses
    if (flowState === "awaiting_name" && looksLikeName(userMessage)) {
      return `Perfeito, ${userMessage.trim()}! ✅

Seu cadastro foi concluído com sucesso.

A partir de agora, sempre falaremos com você pelo seu nome 😊

Fique atento(a) às mensagens — as melhores promoções chegam primeiro por aqui.

Boa sorte no sorteio! 🍀
Auto Posto Pará – Economia de verdade!`;
    }
    return "Desculpe, estou com dificuldades técnicas. Tente novamente em alguns minutos.";
  }

  try {
    // Build context message
    let contextInfo = `Flow state atual: ${flowState}\n`;
    if (contactName) {
      contextInfo += `Nome do cliente: ${contactName}\n`;
    }
    contextInfo += `Mensagem do cliente: ${userMessage}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contextInfo }
    ];

    // Add relevant conversation history (last 6 messages max)
    const recentHistory = conversationHistory.slice(-6);
    if (recentHistory.length > 0) {
      const historyContext = recentHistory.map(m => 
        `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`
      ).join('\n');
      messages.splice(1, 0, { role: "user", content: `Histórico recente:\n${historyContext}` });
    }

    console.log("[wa-ai-chatbot] Calling Lovable AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (response.status === 429) {
      console.error("[wa-ai-chatbot] Rate limited");
      return "Estamos com muitas solicitações no momento. Tente novamente em alguns segundos.";
    }

    if (response.status === 402) {
      console.error("[wa-ai-chatbot] Payment required");
      return "Desculpe, estamos com dificuldades técnicas. Tente novamente mais tarde.";
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[wa-ai-chatbot] AI error: ${response.status} - ${errorText}`);
      return "Desculpe, não consegui processar sua mensagem. Tente novamente.";
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "";
    
    console.log(`[wa-ai-chatbot] AI response: ${aiResponse.substring(0, 100)}...`);
    return aiResponse;

  } catch (e) {
    console.error("[wa-ai-chatbot] AI call error:", e);
    return "Desculpe, ocorreu um erro. Tente novamente em alguns minutos.";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(String(body?.phone ?? ""));
    const incomingMessage = String(body?.message ?? "").trim();
    const isFirstContact = Boolean(body?.first_contact);
    const action = String(body?.action ?? "").trim();

    if (!phone) {
      console.log("[wa-ai-chatbot] Missing phone");
      return respond({ success: false, error: "Telefone obrigatório" }, 400);
    }

    console.log(`[wa-ai-chatbot] Processing: phone=${phone}, firstContact=${isFirstContact}, action="${action}", message="${incomingMessage.substring(0, 50)}..."`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !serviceRole) {
      console.error("[wa-ai-chatbot] Supabase not configured");
      return respond({ success: false, error: "Database not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRole);

    // HANDLE END CONVERSATION ACTION
    if (action === 'end_conversation') {
      console.log(`[wa-ai-chatbot] Handling end_conversation for ${phone}`);
      
      // Get contact name for personalized farewell
      const { data: contact } = await supabase
        .from("wa_contacts")
        .select("name")
        .eq("phone", phone)
        .single();
      
      const contactName = contact?.name || null;
      const farewellMessage = await getFarewellMessage(supabase, contactName);
      
      const sendResult = await sendWhatsAppMessage(phone, farewellMessage);
      
      await supabase.from("wa_messages").insert({
        phone,
        direction: "outbound",
        message_type: "text",
        content: farewellMessage.substring(0, 500),
        status: sendResult.success ? "sent" : "failed",
        error_message: safeErrorString(sendResult.error, 500),
        provider: "evolution"
      });

      // Log to whatsapp_logs for dashboard visibility
      await supabase.from("whatsapp_logs").insert({
        phone,
        message: farewellMessage.substring(0, 500),
        provider: "AI_CHATBOT",
        status: sendResult.success ? "SENT" : "FAILED",
        error: sendResult.success ? null : `Chatbot error: ${safeErrorString(sendResult.error, 200) || 'Unknown'}`,
        message_id: sendResult.messageId
      });
      
      console.log(`[wa-ai-chatbot] Farewell message ${sendResult.success ? 'sent' : 'failed'} to ${phone}`);
      return respond({ success: sendResult.success, action: "farewell_sent", error: sendResult.error });
    }

    // Get or create contact
    let { data: contact } = await supabase
      .from("wa_contacts")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!contact) {
      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from("wa_contacts")
        .insert({ phone, flow_state: "new", opt_in: true })
        .select()
        .single();

      if (insertError) {
        console.error("[wa-ai-chatbot] Error creating contact:", insertError);
        return respond({ success: false, error: "Error creating contact" }, 500);
      }
      contact = newContact;
    }

    const flowState = contact.flow_state || "new";
    const contactName = contact.name;

    console.log(`[wa-ai-chatbot] Contact state: flow=${flowState}, name=${contactName || "null"}`);

    // FIRST CONTACT: Send welcome message
    if (isFirstContact && flowState === "new") {
      console.log(`[wa-ai-chatbot] Sending welcome message to ${phone}`);
      
      // Fetch welcome message from settings
      const welcomeMessage = await getWelcomeMessage(supabase);
      const sendResult = await sendWhatsAppMessage(phone, welcomeMessage);
      
      // Always log the message attempt (success or failure) for visibility
      await supabase.from("wa_messages").insert({
        phone,
        direction: "outbound",
        message_type: "text",
        content: welcomeMessage.substring(0, 500),
        status: sendResult.success ? "sent" : "failed",
        error_message: safeErrorString(sendResult.error, 500),
        provider: "evolution",
        wa_message_id: sendResult.messageId
      });

      // Also log to whatsapp_logs for compatibility - use SENT/FAILED uppercase
      await supabase.from("whatsapp_logs").insert({
        phone,
        message: welcomeMessage.substring(0, 500),
        provider: "AI_CHATBOT",
        status: sendResult.success ? "SENT" : "FAILED",
        error: sendResult.success ? null : `Chatbot error: ${safeErrorString(sendResult.error, 200) || 'Unknown'}`,
        message_id: sendResult.messageId
      });
      
      if (sendResult.success) {
        // Update flow state to awaiting_name
        await supabase
          .from("wa_contacts")
          .update({ flow_state: "awaiting_name" })
          .eq("phone", phone);

        return respond({ success: true, action: "welcome_sent", messageId: sendResult.messageId });
      }
      
      // Mark contact for retry visibility
      await supabase
        .from("wa_contacts")
        .update({ flow_state: "welcome_failed" })
        .eq("phone", phone);

      return respond({ 
        success: false, 
        error: sendResult.error, 
        isTransient: sendResult.isTransient,
        logged: true,
        suggestion: sendResult.isTransient 
          ? "WhatsApp com conexão instável. Verifique o Robô WhatsApp."
          : "Verifique a configuração da Evolution API."
      }, 502);
    }

    // COLLECTING NAME: Process incoming message as potential name
    if (flowState === "awaiting_name" && incomingMessage) {
      console.log(`[wa-ai-chatbot] Processing potential name: "${incomingMessage}"`);

      // Get conversation history
      const { data: history } = await supabase
        .from("wa_messages")
        .select("direction, content")
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(10);

      const conversationHistory = (history || []).map(m => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || ""
      }));

      // Check if it looks like a name
      if (looksLikeName(incomingMessage)) {
        const cleanedName = incomingMessage.trim()
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");

        console.log(`[wa-ai-chatbot] Detected name: "${cleanedName}"`);

        // Update contact with name
        await supabase
          .from("wa_contacts")
          .update({ 
            name: cleanedName, 
            flow_state: "completed" 
          })
          .eq("phone", phone);

        // Generate confirmation response with AI
        const aiResponse = await generateAIResponse(cleanedName, "awaiting_name", incomingMessage, conversationHistory);
        
        const sendResult = await sendWhatsAppMessage(phone, aiResponse);

        await supabase.from("wa_messages").insert({
          phone,
          direction: "outbound",
          message_type: "text",
          content: aiResponse.substring(0, 500),
          status: sendResult.success ? "sent" : "failed",
          error_message: safeErrorString(sendResult.error, 500),
          provider: "evolution"
        });

        // Log to whatsapp_logs for dashboard visibility
        await supabase.from("whatsapp_logs").insert({
          phone,
          message: aiResponse.substring(0, 500),
          provider: "AI_CHATBOT",
          status: sendResult.success ? "SENT" : "FAILED",
          error: sendResult.success ? null : `Chatbot error: ${safeErrorString(sendResult.error, 200) || 'Unknown'}`,
          message_id: sendResult.messageId
        });

        return respond({ success: sendResult.success, action: "name_collected", name: cleanedName, error: sendResult.error });
      } else {
        // Not a valid name, ask again politely
        const aiResponse = await generateAIResponse(null, "awaiting_name", incomingMessage, conversationHistory);
        
        const sendResult = await sendWhatsAppMessage(phone, aiResponse);
        
        await supabase.from("wa_messages").insert({
          phone,
          direction: "outbound",
          message_type: "text",
          content: aiResponse.substring(0, 500),
          status: sendResult.success ? "sent" : "failed",
          error_message: safeErrorString(sendResult.error, 500),
          provider: "evolution"
        });

        // Log to whatsapp_logs for dashboard visibility
        await supabase.from("whatsapp_logs").insert({
          phone,
          message: aiResponse.substring(0, 500),
          provider: "AI_CHATBOT",
          status: sendResult.success ? "SENT" : "FAILED",
          error: sendResult.success ? null : `Chatbot error: ${safeErrorString(sendResult.error, 200) || 'Unknown'}`,
          message_id: sendResult.messageId
        });

        return respond({ success: sendResult.success, action: "asked_name_again", error: sendResult.error });
      }
    }

    // COMPLETED FLOW: General conversation
    if (flowState === "completed" && incomingMessage) {
      console.log(`[wa-ai-chatbot] General conversation with ${contactName || phone}`);

      // Get conversation history
      const { data: history } = await supabase
        .from("wa_messages")
        .select("direction, content")
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(10);

      const conversationHistory = (history || []).map(m => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || ""
      }));

      const aiResponse = await generateAIResponse(contactName, "completed", incomingMessage, conversationHistory);
      
      // Personalize with name if available
      let finalResponse = aiResponse;
      if (contactName && !aiResponse.toLowerCase().includes(contactName.toLowerCase())) {
        finalResponse = `Olá, ${contactName}! ${aiResponse}`;
      }

      const sendResult = await sendWhatsAppMessage(phone, finalResponse);

      await supabase.from("wa_messages").insert({
        phone,
        direction: "outbound",
        message_type: "text",
        content: finalResponse.substring(0, 500),
        status: sendResult.success ? "sent" : "failed",
        error_message: safeErrorString(sendResult.error, 500),
        provider: "evolution"
      });

      // Log to whatsapp_logs for dashboard visibility
      await supabase.from("whatsapp_logs").insert({
        phone,
        message: finalResponse.substring(0, 500),
        provider: "AI_CHATBOT",
        status: sendResult.success ? "SENT" : "FAILED",
        error: sendResult.success ? null : `Chatbot error: ${safeErrorString(sendResult.error, 200) || 'Unknown'}`,
        message_id: sendResult.messageId
      });

      return respond({ success: sendResult.success, action: "conversation_reply", error: sendResult.error });
    }

    // No action needed
    return respond({ success: true, action: "no_action" });

  } catch (e) {
    console.error("[wa-ai-chatbot] Global error:", e);
    return respond({ success: false, error: String(e) }, 500);
  }
});
