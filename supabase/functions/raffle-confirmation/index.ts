import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone to E.164 Brazilian format
function normalizePhoneBR(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const withoutPrefix = digits.startsWith("55") ? digits.slice(2) : digits;
  const local = withoutPrefix.length > 11 ? withoutPrefix.slice(-11) : withoutPrefix;
  return `55${local}`;
}

serve(async (req) => {
  // Handle CORS preflight
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
    const phone = normalizePhoneBR(String(body?.phone ?? ""));

    if (!phone) {
      console.log("[raffle-confirmation] Missing or invalid phone");
      return respond({ success: false, error: "Telefone obrigatório" }, 400);
    }

    console.log(`[raffle-confirmation] Processing confirmation for ${phone}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !serviceRole) {
      console.error("[raffle-confirmation] Supabase not configured");
      return respond({ success: false, error: "Database not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRole);

    // Check if we already sent a confirmation today (duplicate prevention)
    const today = new Date().toISOString().split("T")[0];
    const { data: existingLog } = await supabase
      .from("whatsapp_logs")
      .select("id")
      .eq("phone", phone)
      .ilike("message", "%Participação confirmada%")
      .gte("created_at", `${today}T00:00:00`)
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      console.log(`[raffle-confirmation] Already sent today to ${phone}`);
      return respond({ success: true, skipped: true, reason: "already_sent_today" });
    }

    // Call the AI chatbot to handle first contact
    console.log(`[raffle-confirmation] Triggering AI chatbot for first contact: ${phone}`);

    try {
      const chatbotResponse = await fetch(`${supabaseUrl}/functions/v1/wa-ai-chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({
          phone: phone,
          message: "",
          first_contact: true
        }),
      });

      if (!chatbotResponse.ok) {
        const errorText = await chatbotResponse.text();
        console.error(`[raffle-confirmation] Chatbot error: ${chatbotResponse.status} - ${errorText}`);
        
        // Log the failure
        await supabase.from("whatsapp_logs").insert({
          phone,
          message: "Tentativa de envio de mensagem de boas-vindas",
          provider: "AI_CHATBOT",
          status: "FAILED",
          error: `Chatbot error: ${chatbotResponse.status}`,
        });

        return respond({ success: false, error: "Failed to send welcome message" }, 500);
      }

      const result = await chatbotResponse.json();
      console.log(`[raffle-confirmation] Chatbot result:`, result);

      // Log success
      await supabase.from("whatsapp_logs").insert({
        phone,
        message: "Mensagem de boas-vindas enviada via AI Chatbot",
        provider: "AI_CHATBOT",
        status: "SENT",
      });

      return respond({ success: true, phone, action: result.action });

    } catch (e) {
      const errorMsg = String(e);
      console.error(`[raffle-confirmation] Network error calling chatbot:`, errorMsg);
      
      await supabase.from("whatsapp_logs").insert({
        phone,
        message: "Tentativa de envio de mensagem de boas-vindas",
        provider: "AI_CHATBOT",
        status: "FAILED",
        error: errorMsg.slice(0, 500),
      });

      return respond({ success: false, error: "Connection error" }, 500);
    }

  } catch (e) {
    console.error("[raffle-confirmation] Global error:", e);
    return respond({ success: false, error: String(e) }, 500);
  }
});
