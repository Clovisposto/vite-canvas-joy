import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HealthResponse = {
  ok: boolean;
  step: string;
  error: string | null;
  details: Record<string, unknown>;
  whatsapp_status?: "CONFIG_PENDING" | "READY" | "ACTIVE" | "ERROR";
  whatsapp_provider?: "EVOLUTION";
};

type BulkResponse = {
  total: number;
  sent: number;
  failed: number;
  errors: { phone: string; error: string }[];
};

type SingleResponse = {
  success: boolean;
  provider: "evolution";
  error?: string;
  phone?: string;
  step?: string;
  details?: Record<string, unknown>;
};

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

function sanitizeInstance(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^EVOLUTION_INSTANCE_NAME\s*=\s*/i, "")
    .replace(/^instance\s*[:=]\s*/i, "")
    .replace(/^name\s*[:=]\s*/i, "")
    .replace(/^['\"]+|['\"]+$/g, "")
    .trim();
}

function sanitizeApiKey(raw: string | undefined | null): string {
  if (!raw) return "";
  const val = raw
    .trim()
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

// deno-lint-ignore no-explicit-any
async function insertWhatsAppLog(args: {
  supabase: any;
  phone: string;
  message: string;
  status: "SENT" | "FAILED" | "QUEUED";
  error?: string | null;
  message_id?: string | null;
}) {
  try {
    await args.supabase.from("whatsapp_logs").insert({
      phone: args.phone,
      message: args.message,
      provider: "EVOLUTION",
      status: args.status,
      error: args.error ?? null,
      message_id: args.message_id ?? null,
    });
  } catch (e) {
    console.error("[wa-send] failed to write whatsapp_logs:", e);
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = supabaseUrl && serviceRole ? createClient(supabaseUrl, serviceRole) : null;

  try {
    // Authenticate user - require staff access
    const auth = await authenticateStaff(req);
    if (!auth.authenticated) {
      console.log('[wa-send] Authentication failed:', auth.error);
      return respond({ success: false, provider: "evolution", error: auth.error, step: "authentication" }, 401);
    }

    console.log('[wa-send] Authenticated user:', auth.userId);

    const body = await req.json().catch(() => ({}));

    const baseUrl = sanitizeUrl(Deno.env.get("EVOLUTION_API_URL"));
    const apiKey = sanitizeApiKey(Deno.env.get("EVOLUTION_API_KEY"));
    const instance = sanitizeInstance(Deno.env.get("EVOLUTION_INSTANCE_NAME"));

    const checklist = {
      EVOLUTION_API_URL: baseUrl ? `✅ ${baseUrl}` : "❌ inválido (precisa ser https e público)",
      EVOLUTION_API_KEY: apiKey ? `✅ (${apiKey.length} chars)` : "❌ inválido/vazio",
      EVOLUTION_INSTANCE_NAME: instance ? `✅ ${instance}` : "❌ inválido/vazio",
    };

    // Health (used by admin pages) - uses connectionState endpoint for compatibility
    if (body?.action === "health") {
      if (!baseUrl || !apiKey || !instance) {
        const r: HealthResponse = {
          ok: false,
          step: "config_validation",
          error: "Configuração incompleta: confira os 3 secrets",
          whatsapp_status: "CONFIG_PENDING",
          whatsapp_provider: "EVOLUTION",
          details: { checklist },
        };
        return respond(r);
      }

      // Use connectionState endpoint (compatible with Evolution API v2.x)
      const url = `${baseUrl}/instance/connectionState/${instance}`;
      console.log("[wa-send][health] GET", url);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: apiKey,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }

        if (res.ok) {
          const j = json as Record<string, unknown>;
          const state =
            (j?.instance as Record<string, unknown>)?.state ??
            j?.state ??
            (j?.connectionStatus as Record<string, unknown>)?.state ??
            j?.status ??
            "unknown";

          const connected =
            String(state).toLowerCase() === "open" ||
            String(state).toLowerCase() === "connected";

          const r: HealthResponse = {
            ok: true,
            step: "connection_test",
            error: null,
            whatsapp_status: connected ? "ACTIVE" : "READY",
            whatsapp_provider: "EVOLUTION",
            details: { checklist, url, connected, state, evolution: json },
          };
          return respond(r);
        }

        // Fallback: try fetchInstances if connectionState returns 404
        if (res.status === 404) {
          console.log("[wa-send][health] connectionState 404, trying fetchInstances");
          const altUrl = `${baseUrl}/instance/fetchInstances`;
          
          try {
            const altRes = await fetch(altUrl, {
              method: "GET",
              headers: { apikey: apiKey },
              signal: AbortSignal.timeout(10000),
            });

            if (altRes.ok) {
              const instances = await altRes.json();
              const found = Array.isArray(instances) && instances.some((i: Record<string, unknown>) => 
                i.name === instance || (i.instance as Record<string, unknown>)?.instanceName === instance
              );

              if (found) {
                const r: HealthResponse = {
                  ok: true,
                  step: "connection_test",
                  error: null,
                  whatsapp_status: "READY",
                  whatsapp_provider: "EVOLUTION",
                  details: { checklist, url: altUrl, method: "fetchInstances", instanceFound: true },
                };
                return respond(r);
              }
            }
          } catch (altErr) {
            console.error("[wa-send][health] fetchInstances fallback failed:", altErr);
          }
        }

        const r: HealthResponse = {
          ok: false,
          step: "api_call",
          error:
            res.status === 401 || res.status === 403
              ? "API Key inválida/sem permissão"
              : res.status === 404
                ? `Instância '${instance}' não encontrada`
                : res.status >= 500
                  ? "Servidor Evolution indisponível"
                  : "Falha ao consultar Evolution API",
          whatsapp_status: "ERROR",
          whatsapp_provider: "EVOLUTION",
          details: { checklist, url, httpStatus: res.status, responseBody: text.slice(0, 1000), evolution: json },
        };
        return respond(r);
      } catch (e) {
        const raw = String(e);
        const friendly = raw.toLowerCase().includes("dns") || raw.includes("Name or service not known")
          ? "DNS: URL não encontrada (tunnel fora do ar ou URL errada)"
          : raw.toLowerCase().includes("abort")
            ? "Timeout: servidor não respondeu em 15s"
            : "Não foi possível conectar ao servidor Evolution";

        console.error("[wa-send][health] network error:", raw);

        const r: HealthResponse = {
          ok: false,
          step: "network",
          error: friendly,
          whatsapp_status: "ERROR",
          whatsapp_provider: "EVOLUTION",
          details: { checklist, baseUrl, instance, rawError: raw.slice(0, 600) },
        };
        return respond(r);
      }
    }

    // Config validation for sends
    if (!baseUrl || !apiKey || !instance) {
      const r: SingleResponse = {
        success: false,
        provider: "evolution",
        error: "Configuração incompleta: confira os 3 secrets",
        step: "config_validation",
        details: { checklist },
      };
      return respond(r);
    }

    // Bulk send: { customers: [{phone,name?}], message }
    if (Array.isArray(body?.customers)) {
      const customers = body.customers as { phone: string; name?: string }[];
      const messageTemplate = String(body?.message ?? "");

      const results: BulkResponse = { total: customers.length, sent: 0, failed: 0, errors: [] };
      console.log(`[wa-send][bulk] customers=${customers.length}`);

      for (const c of customers) {
        const phone = normalizePhoneBR(c.phone);
        const text = messageTemplate.replace("{nome}", c.name || "Cliente");

        if (!phone || !text.trim()) {
          results.failed++;
          results.errors.push({ phone: c.phone, error: "Telefone ou mensagem inválidos" });
          continue;
        }

        const url = `${baseUrl}/message/sendText/${instance}`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: phone, text: text.trim() }),
          });

          const bodyText = await res.text();
          let json: unknown = null;
          try {
            json = JSON.parse(bodyText);
          } catch {
            json = { raw: bodyText };
          }

          if (res.ok) {
            results.sent++;
            if (supabase) {
              await insertWhatsAppLog({ supabase, phone, message: text, status: "SENT" });
            }
          } else {
            results.failed++;
            const errMsg =
              (json as Record<string, unknown>)?.message || (json as Record<string, unknown>)?.error || `HTTP ${res.status}`;
            results.errors.push({ phone, error: String(errMsg) });
            if (supabase) {
              await insertWhatsAppLog({ supabase, phone, message: text, status: "FAILED", error: String(errMsg).slice(0, 500) });
            }
          }
        } catch (e) {
          results.failed++;
          const raw = String(e);
          const friendly = raw.toLowerCase().includes("dns") || raw.includes("Name or service not known")
            ? "DNS: URL não encontrada (tunnel fora do ar ou URL errada)"
            : raw.toLowerCase().includes("abort")
              ? "Timeout: servidor não respondeu"
              : "Não foi possível conectar ao servidor Evolution";

          results.errors.push({ phone, error: friendly });
          if (supabase) {
            await insertWhatsAppLog({ supabase, phone, message: text, status: "FAILED", error: friendly });
          }
        }

        await new Promise((r) => setTimeout(r, 250));
      }

      return respond(results);
    }

    // Single send: { phone, message }
    const phone = normalizePhoneBR(String(body?.phone ?? body?.to ?? ""));
    const message = String(body?.message ?? body?.text ?? "").trim();

    if (!phone || !message) {
      const r: SingleResponse = {
        success: false,
        provider: "evolution",
        error: "Phone e message são obrigatórios",
        step: "validation",
      };
      return respond(r);
    }

    const url = `${baseUrl}/message/sendText/${instance}`;
    console.log("[wa-send][single] POST", url, "to", phone);

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
        if (supabase) {
          await insertWhatsAppLog({ supabase, phone, message, status: "SENT", message_id: messageId as string | null });
        }

        const r: SingleResponse = {
          success: true,
          provider: "evolution",
          phone,
          step: "send_success",
          details: { checklist, url, evolution: json, messageId },
        };
        return respond(r);
      }

      const errMsg =
        (json as Record<string, unknown>)?.message || (json as Record<string, unknown>)?.error || `Falha no envio (HTTP ${res.status})`;

      if (supabase) {
        await insertWhatsAppLog({ supabase, phone, message, status: "FAILED", error: String(errMsg).slice(0, 500) });
      }

      const r: SingleResponse = {
        success: false,
        provider: "evolution",
        phone,
        error: String(errMsg),
        step: "api_error",
        details: { checklist, url, httpStatus: res.status, evolution: json },
      };
      return respond(r);
    } catch (e) {
      const raw = String(e);
      const friendly = raw.toLowerCase().includes("dns") || raw.includes("Name or service not known")
        ? "DNS: URL não encontrada (tunnel fora do ar ou URL errada)"
        : raw.toLowerCase().includes("abort")
          ? "Timeout: servidor não respondeu em 30s"
          : "Não foi possível conectar ao servidor Evolution";

      console.error("[wa-send][single] network error:", raw);
      if (supabase) {
        await insertWhatsAppLog({ supabase, phone, message, status: "FAILED", error: friendly });
      }

      const r: SingleResponse = {
        success: false,
        provider: "evolution",
        phone,
        error: friendly,
        step: "network",
        details: { checklist, baseUrl, instance, rawError: raw.slice(0, 600) },
      };
      return respond(r);
    }
  } catch (e) {
    console.error("[wa-send] global error:", e);
    return respond({ success: false, provider: "evolution", error: String(e), step: "global_catch" } satisfies SingleResponse);
  }
});
