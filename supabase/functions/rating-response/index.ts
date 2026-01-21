import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-signature",
};

// Simple in-memory rate limiter (per phone, max 3 requests per 5 minutes)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 3;

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Clean up old entries periodically (every 100 requests)
let requestCount = 0;
function cleanupRateLimitMap() {
  requestCount++;
  if (requestCount % 100 === 0) {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }
}

// Validate phone format (must be Brazilian phone)
function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // Must be 10-11 digits (DDD + number) or 12-13 with country code
  return digits.length >= 10 && digits.length <= 13;
}

// Validate rating (must be 1-5)
function isValidRating(rating: unknown): rating is number {
  return typeof rating === "number" && rating >= 1 && rating <= 5;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, rating, postoName } = await req.json();

    // Input validation
    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "Telefone não informado ou inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidBrazilianPhone(phone)) {
      console.log("[rating-response] Invalid phone format:", phone);
      return new Response(
        JSON.stringify({ error: "Formato de telefone inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidRating(rating)) {
      console.log("[rating-response] Invalid rating:", rating);
      return new Response(
        JSON.stringify({ error: "Avaliação inválida (deve ser de 1 a 5)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting by phone number
    cleanupRateLimitMap();
    const normalizedPhone = phone.replace(/\D/g, "");
    if (isRateLimited(normalizedPhone)) {
      console.log("[rating-response] Rate limited:", normalizedPhone);
      return new Response(
        JSON.stringify({ error: "Muitas solicitações. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the phone exists in our customers table (prevent abuse)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .single();

    if (customerError || !customer) {
      // Try with 55 prefix
      const { data: customerWithPrefix } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", `55${normalizedPhone}`)
        .single();

      if (!customerWithPrefix) {
        console.log("[rating-response] Customer not found:", normalizedPhone);
        return new Response(
          JSON.stringify({ success: false, reason: "Customer not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get WhatsApp settings
    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .single();

    if (!settings?.enabled) {
      console.log("WhatsApp not enabled, skipping auto-response");
      return new Response(
        JSON.stringify({ success: false, reason: "WhatsApp not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get custom messages from settings
    const { data: customMessages } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["rating_msg_satisfied", "rating_msg_neutral", "rating_msg_dissatisfied"]);

    const messageSettings: Record<string, string> = {};
    customMessages?.forEach((s: { key: string; value: string }) => {
      try {
        messageSettings[s.key] = typeof s.value === "string" ? JSON.parse(s.value) : s.value;
      } catch {
        messageSettings[s.key] = s.value;
      }
    });

    // Determine message based on rating
    const isSatisfied = rating >= 4;
    const isNeutral = rating === 3;
    const isDissatisfied = rating <= 2;

    // Sanitize postoName to prevent injection
    const sanitizedPostoName = String(postoName || "nosso posto")
      .slice(0, 100)
      .replace(/[<>\"']/g, "");

    let message = "";

    // Default messages
    const defaultSatisfied = `🌟 *Obrigado pela sua avaliação!*

Ficamos muito felizes em saber que você teve uma ótima experiência no *{{posto}}*! 🎉

Sua satisfação é nossa maior recompensa. Esperamos vê-lo novamente em breve!

💚 Equipe {{posto}}`;

    const defaultNeutral = `Olá! 👋

Obrigado por avaliar nosso atendimento no *{{posto}}*.

Estamos sempre buscando melhorar! Se tiver alguma sugestão de como podemos tornar sua experiência ainda melhor, ficaremos felizes em ouvir.

Atenciosamente,
💚 Equipe {{posto}}`;

    const defaultDissatisfied = `Olá! 😔

Lamentamos saber que sua experiência no *{{posto}}* não foi satisfatória.

🔧 *Queremos resolver isso!*

Sua opinião é muito importante para nós. Por favor, nos conte o que aconteceu para que possamos melhorar e garantir que isso não se repita.

Estamos à disposição para ouvir você e encontrar uma solução.

Atenciosamente,
💚 Equipe {{posto}}`;

    if (isSatisfied) {
      message = messageSettings.rating_msg_satisfied || defaultSatisfied;
    } else if (isNeutral) {
      message = messageSettings.rating_msg_neutral || defaultNeutral;
    } else if (isDissatisfied) {
      message = messageSettings.rating_msg_dissatisfied || defaultDissatisfied;
    }

    // Replace placeholder with posto name
    message = message.replace(/\{\{posto\}\}/g, sanitizedPostoName);

    // Format phone number
    const digits = phone.replace(/\D/g, "");
    const formattedPhone = digits.startsWith("55") ? digits : `55${digits}`;

    console.log(`[rating-response] Sending to ${formattedPhone}, rating: ${rating}, provider: ${settings.provider}`);

    // Send via Evolution API
    if (settings.provider === "EVOLUTION" && settings.evolution_base_url) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || settings.evolution_base_url;
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || settings.evolution_api_key;
      const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || settings.evolution_instance;

      const response = await fetch(
        `${evolutionUrl}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey || "",
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        }
      );

      const result = await response.json();

      // Log the message
      await supabase.from("wa_messages").insert({
        phone: formattedPhone,
        direction: "outbound",
        message_type: "text",
        content: message,
        status: response.ok ? "sent" : "failed",
        provider: "evolution",
        error_message: response.ok ? null : JSON.stringify(result),
      });

      if (!response.ok) {
        console.error("[rating-response] Evolution API error:", result);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to send message" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[rating-response] Message sent successfully via Evolution:", result.key?.id);
      return new Response(
        JSON.stringify({ success: true, messageId: result.key?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Cloud API (Meta)
    if (settings.provider === "CLOUD_API" && settings.cloud_access_token) {
      const graphVersion = settings.cloud_graph_version || "v20.0";
      const phoneNumberId = settings.cloud_phone_number_id;

      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.cloud_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      const result = await response.json();

      // Log the message
      await supabase.from("wa_messages").insert({
        phone: formattedPhone,
        direction: "outbound",
        message_type: "text",
        content: message,
        status: response.ok ? "sent" : "failed",
        provider: "cloud_api",
        wa_message_id: result.messages?.[0]?.id || null,
        error_message: response.ok ? null : JSON.stringify(result),
      });

      if (!response.ok) {
        console.error("[rating-response] Cloud API error:", result);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to send message" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[rating-response] Message sent successfully via Cloud API:", result.messages?.[0]?.id);
      return new Response(
        JSON.stringify({ success: true, messageId: result.messages?.[0]?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, reason: "No valid provider configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[rating-response] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
