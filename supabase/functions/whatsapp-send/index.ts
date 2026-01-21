import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendResponse = {
  ok: boolean;
  step: string;
  error: string | null;
  status: number | null;
  url: string | null;
  instance: string | null;
  details: Record<string, unknown>;
};

// Block localhost/local URLs
function isBlockedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("0.0.0.0") ||
    lower.includes("192.168.") ||
    lower.includes("10.0.") ||
    lower.includes("172.16.") ||
    /:\d{4,5}(?:\/|$)/.test(lower)
  );
}

function sanitizeUrl(raw: string | undefined | null): string {
  if (!raw) return "";

  let val = raw
    .trim()
    .split(/[\r\n]/)[0]
    .replace(/^=+/, "")
    .replace(/^['\"]+|['\"]+$/g, "")
    .replace(/\/+$/, "")
    .trim();

  if (val && !val.startsWith("http://") && !val.startsWith("https://")) {
    val = `https://${val}`;
  }

  val = val.replace(/[^a-zA-Z0-9.\-/:]+$/g, "");

  try {
    const url = new URL(val);
    if (url.protocol !== "https:") return "";

    const normalized = `${url.protocol}//${url.host}`;
    if (isBlockedUrl(normalized)) return "";

    return normalized;
  } catch {
    return "";
  }
}

function sanitizeInstance(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/[\r\n]/)[0]
    .replace(/^EVOLUTION_INSTANCE_NAME\s*=\s*/i, "")
    .replace(/^instance\s*[:=]\s*/i, "")
    .replace(/^name\s*[:=]\s*/i, "")
    .replace(/^['\"]+|['\"]+$/g, "")
    .trim();
}

function sanitizeApiKey(raw: string | undefined | null): string {
  if (!raw) return "";

  let val = raw
    .trim()
    .split(/[\r\n]/)[0]
    .replace(/^EVOLUTION_API_KEY\s*=\s*/i, "")
    .replace(/^['\"]+|['\"]+$/g, "")
    .replace(/[\r\n\t]/g, "")
    .trim();

  return val
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join("");
}

// Normalize phone to Brazilian format: 55 + DDD + number
function normalizePhoneBR(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const withoutPrefix = digits.startsWith("55") ? digits.slice(2) : digits;
  const local = withoutPrefix.length > 11 ? withoutPrefix.slice(-11) : withoutPrefix;

  return `55${local}`;
}

// Authentication helper - verifies JWT and checks if user is staff
async function authenticateStaff(req: Request): Promise<{ authenticated: boolean; error?: string; userId?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration');
    return { authenticated: false, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error('Auth error:', error?.message);
    return { authenticated: false, error: 'Invalid or expired token' };
  }

  // Check if user is staff (admin or operador)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile error:', profileError?.message);
    return { authenticated: false, error: 'User profile not found' };
  }

  if (!['admin', 'operador'].includes(profile.role || '')) {
    return { authenticated: false, error: 'Insufficient permissions - staff access required' };
  }

  return { authenticated: true, userId: user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (r: SendResponse, status = 200) =>
    new Response(JSON.stringify(r), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let logEntryId: string | null = null;

  // Supabase client (for logging only)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = supabaseUrl && serviceRole ? createClient(supabaseUrl, serviceRole) : null;

  const updateLog = async (patch: Record<string, unknown>) => {
    if (!supabase || !logEntryId) return;
    try {
      await supabase.from("whatsapp_logs").update(patch).eq("id", logEntryId);
    } catch {
      // ignore
    }
  };

  try {
    // Authenticate user - require staff access
    const auth = await authenticateStaff(req);
    if (!auth.authenticated) {
      console.log('[whatsapp-send] Authentication failed:', auth.error);
      return respond({
        ok: false,
        step: "authentication",
        error: auth.error || "Unauthorized",
        status: 401,
        url: null,
        instance: null,
        details: {},
      }, 401);
    }

    console.log('[whatsapp-send] Authenticated user:', auth.userId);

    // Parse body
    let to = "";
    let text = "";
    let customerId: string | null = null;

    try {
      const body = await req.json();
      to = body?.to || body?.phone || "";
      text = body?.text || body?.message || "";
      customerId = body?.customerId || body?.customer_id || null;
    } catch {
      return respond({
        ok: false,
        step: "parse_body",
        error: "Body JSON inválido ou vazio",
        status: null,
        url: null,
        instance: null,
        details: {},
      });
    }

    const normalizedPhone = normalizePhoneBR(to);

    if (!normalizedPhone || !text) {
      return respond({
        ok: false,
        step: "validation",
        error: "Campos obrigatórios: 'to' (telefone) e 'text' (mensagem)",
        status: null,
        url: null,
        instance: null,
        details: {
          toProvided: Boolean(to),
          normalizedPhone,
          textProvided: Boolean(text),
        },
      });
    }

    // Create initial log entry
    if (supabase) {
      try {
        const { data } = await supabase
          .from("whatsapp_logs")
          .insert({
            phone: normalizedPhone,
            customer_id: customerId || null,
            provider: "EVOLUTION",
            message: text,
            status: "QUEUED",
          })
          .select("id")
          .single();

        logEntryId = data?.id ?? null;
      } catch {
        // ignore
      }
    }

    // ONLY use environment secrets - no DB fallback
    const baseUrl = sanitizeUrl(Deno.env.get("EVOLUTION_API_URL"));
    const apiKey = sanitizeApiKey(Deno.env.get("EVOLUTION_API_KEY"));
    const instance = sanitizeInstance(Deno.env.get("EVOLUTION_INSTANCE_NAME"));

    const rawUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    const wasBlocked = rawUrl && isBlockedUrl(rawUrl);

    const checklist = {
      EVOLUTION_API_URL: baseUrl ? `✅ ${baseUrl}` : wasBlocked ? "❌ URL local bloqueada" : "❌ inválido",
      EVOLUTION_API_KEY: apiKey ? `✅ (${apiKey.length} chars)` : "❌ inválido/vazio",
      EVOLUTION_INSTANCE_NAME: instance ? `✅ ${instance}` : "❌ inválido/vazio",
    };

    if (!baseUrl || !apiKey || !instance) {
      await updateLog({ status: "FAILED", error: wasBlocked ? "URL local bloqueada" : "Configuração incompleta" });
      return respond({
        ok: false,
        step: "config_validation",
        error: wasBlocked
          ? "URL local bloqueada. Use um tunnel público."
          : "Configuração incompleta: confira os 3 secrets",
        status: null,
        url: baseUrl || null,
        instance: instance || null,
        details: { checklist, wasBlocked },
      });
    }

    const sendUrl = `${baseUrl}/message/sendText/${instance}`;
    console.log("whatsapp-send: POST", sendUrl, "to:", normalizedPhone);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(sendUrl, {
        method: "POST",
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number: normalizedPhone, text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const bodyText = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(bodyText);
      } catch {
        json = { raw: bodyText };
      }

      if (res.ok) {
        const j = json as Record<string, unknown>;
        const messageId = (j?.key as Record<string, unknown>)?.id ?? j?.messageId ?? j?.id ?? null;

        await updateLog({ status: "SENT", message_id: messageId ?? null, error: null });

        return respond({
          ok: true,
          step: "send_success",
          error: null,
          status: res.status,
          url: baseUrl,
          instance,
          details: {
            checklist,
            sendUrl,
            to: normalizedPhone,
            messageId,
            evolution: json,
          },
        });
      }

      const errMsg =
        (json as Record<string, unknown>)?.message ||
        (json as Record<string, unknown>)?.error ||
        `Falha no envio (HTTP ${res.status})`;

      await updateLog({ status: "FAILED", error: String(errMsg).slice(0, 500) });

      return respond({
        ok: false,
        step: "api_error",
        error: String(errMsg),
        status: res.status,
        url: baseUrl,
        instance,
        details: {
          checklist,
          sendUrl,
          to: normalizedPhone,
          responseBody: bodyText.slice(0, 1000),
          evolution: json,
        },
      });
    } catch (e) {
      const raw = String(e);
      let friendly = "Não foi possível conectar ao servidor Evolution";
      let offlineReason = "NETWORK_ERROR";

      const rawLower = raw.toLowerCase();
      if (rawLower.includes("bytestring")) {
        friendly = "API Key inválida (caracteres não suportados). Reconfigure o secret.";
        offlineReason = "BYTESTRING_ERROR";
      } else if (rawLower.includes("abort")) {
        friendly = "Timeout: servidor não respondeu em 30s";
        offlineReason = "TIMEOUT";
      } else if (rawLower.includes("refused")) {
        friendly = "Conexão recusada pelo servidor";
        offlineReason = "CONNECTION_REFUSED";
      } else if (
        rawLower.includes("dns") ||
        rawLower.includes("resolve") ||
        raw.includes("Name or service not known")
      ) {
        friendly = "DNS: URL não encontrada. Tunnel offline?";
        offlineReason = "DNS_ERROR";
      }

      await updateLog({ status: "FAILED", error: friendly });

      return respond({
        ok: false,
        step: "network",
        error: friendly,
        status: null,
        url: baseUrl,
        instance,
        details: {
          checklist,
          sendUrl: `${baseUrl}/message/sendText/${instance}`,
          to: normalizedPhone,
          offlineReason,
          rawError: raw.slice(0, 600),
        },
      });
    }
  } catch (e) {
    console.error("whatsapp-send global error:", e);
    await updateLog({ status: "FAILED", error: String(e).slice(0, 500) });

    return respond({
      ok: false,
      step: "global_catch",
      error: String(e),
      status: null,
      url: null,
      instance: null,
      details: {},
    });
  }
});
