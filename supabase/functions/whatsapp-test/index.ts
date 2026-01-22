import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TestResponse = {
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
    /:\d{4,5}(?:\/|$)/.test(lower) // block explicit ports like :8080
  );
}

function sanitizeUrl(raw: string | undefined | null): string {
  if (!raw) return "";

  let val = raw
    .trim()
    .split(/[\r\n]/)[0] // take only first line
    .replace(/^=+/, "") // remove leading '='
    .replace(/^['\"]+|['\"]+$/g, "") // remove quotes
    .replace(/\/+$/, "") // remove trailing '/'
    .trim();

  // Ensure https://
  if (val && !val.startsWith("http://") && !val.startsWith("https://")) {
    val = `https://${val}`;
  }

  // If user pasted extra punctuation (common when copying logs), strip trailing invalid hostname chars.
  // Example seen in logs: https://xxxx.trycloudflare.com)
  val = val.replace(/[^a-zA-Z0-9.\-/:]+$/g, "");

  try {
    const url = new URL(val);
    if (url.protocol !== "https:") return "";

    // Use URL fields to normalize and avoid leaking path/query
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

  // Fetch header values must be a valid ByteString; keep printable ASCII only.
  return val
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join("");
}

// Optional authentication - logs user if present but doesn't block
async function tryAuthenticate(req: Request): Promise<{ userId?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return {};

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return {};

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await supabase.auth.getUser();
    return { userId: user?.id };
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (r: TestResponse, status = 200) =>
    new Response(JSON.stringify(r), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Optional auth - just log if present
    const auth = await tryAuthenticate(req);
    if (auth.userId) {
      console.log('[whatsapp-test] Authenticated user:', auth.userId);
    } else {
      console.log('[whatsapp-test] No auth - running as anonymous test');
    }
    console.log("whatsapp-test: EVOLUTION-ONLY (SECRETS)");

    // ONLY use environment secrets - no DB fallback
    const baseUrl = sanitizeUrl(Deno.env.get("EVOLUTION_API_URL"));
    const apiKey = sanitizeApiKey(Deno.env.get("EVOLUTION_API_KEY"));
    const instance = sanitizeInstance(Deno.env.get("EVOLUTION_INSTANCE_NAME"));

    const rawUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    const wasBlocked = rawUrl && isBlockedUrl(rawUrl);

    const checklist = {
      EVOLUTION_API_URL: baseUrl
        ? `✅ ${baseUrl}`
        : wasBlocked
          ? `❌ URL local bloqueada (use tunnel público)`
          : `❌ inválido (precisa ser https público)`,
      EVOLUTION_API_KEY: apiKey ? `✅ (${apiKey.length} chars)` : "❌ inválido/vazio",
      EVOLUTION_INSTANCE_NAME: instance ? `✅ ${instance}` : "❌ inválido/vazio",
    };

    if (!baseUrl || !apiKey || !instance) {
      return respond({
        ok: false,
        step: "config_validation",
        error: wasBlocked
          ? "URL local bloqueada. Use um tunnel público (ex: cloudflared tunnel --url http://localhost:8080)"
          : "Configuração incompleta: confira os 3 secrets",
        status: null,
        url: baseUrl || null,
        instance: instance || null,
        details: {
          checklist,
          wasBlocked,
          help: {
            EVOLUTION_API_URL: "https://xxxx.trycloudflare.com (sem barra final)",
            EVOLUTION_API_KEY: "Sua API Key do Evolution (sem quebras de linha)",
            EVOLUTION_INSTANCE_NAME: "Apenas o nome da instância (ex: posto7)",
          },
        },
      });
    }

    // Use connectionState endpoint (compatible with Evolution API v2.x)
    const testUrl = `${baseUrl}/instance/connectionState/${instance}`;
    console.log("whatsapp-test: GET", testUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(testUrl, {
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
        // deno-lint-ignore no-explicit-any
        const j: any = json;
        const state =
          j?.instance?.state ??
          j?.state ??
          j?.connectionStatus?.state ??
          j?.status ??
          "unknown";

        const connected =
          String(state).toLowerCase() === "open" ||
          String(state).toLowerCase() === "connected";

        return respond({
          ok: true,
          step: "connection_test",
          error: null,
          status: res.status,
          url: baseUrl,
          instance,
          details: {
            checklist,
            connected,
            state,
            testUrl,
            evolution: json,
          },
        });
      }

      // Fallback: try fetchInstances if connectionState returns 404
      if (res.status === 404) {
        console.log("whatsapp-test: connectionState 404, trying fetchInstances");
        const altUrl = `${baseUrl}/instance/fetchInstances`;
        
        try {
          const altRes = await fetch(altUrl, {
            method: "GET",
            headers: { apikey: apiKey },
            signal: AbortSignal.timeout(10000),
          });

          if (altRes.ok) {
            const instances = await altRes.json();
            // deno-lint-ignore no-explicit-any
            const found = Array.isArray(instances) && instances.some((i: any) => 
              i.name === instance || i.instance?.instanceName === instance
            );

            if (found) {
              return respond({
                ok: true,
                step: "connection_test",
                error: null,
                status: altRes.status,
                url: baseUrl,
                instance,
                details: {
                  checklist,
                  connected: true,
                  state: "found_via_fetchInstances",
                  testUrl: altUrl,
                  method: "fetchInstances",
                },
              });
            }
          }
        } catch (altErr) {
          console.error("whatsapp-test: fetchInstances fallback failed:", altErr);
        }
      }

      // Classify error types
      let errorMsg: string;
      let offlineReason: string;

      if (res.status === 401 || res.status === 403) {
        errorMsg = "API Key inválida ou sem permissão";
        offlineReason = "AUTH_ERROR";
      } else if (res.status === 404) {
        errorMsg = `Instância '${instance}' não encontrada`;
        offlineReason = "INSTANCE_NOT_FOUND";
      } else if (res.status >= 500) {
        errorMsg = "Servidor Evolution indisponível (5xx)";
        offlineReason = "SERVER_ERROR";
      } else {
        errorMsg = `Falha ao consultar Evolution API (HTTP ${res.status})`;
        offlineReason = "API_ERROR";
      }

      return respond({
        ok: false,
        step: "api_call",
        error: errorMsg,
        status: res.status,
        url: baseUrl,
        instance,
        details: {
          checklist,
          testUrl,
          offlineReason,
          responseBody: text.slice(0, 1000),
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
        friendly = "Timeout: servidor não respondeu em 15s";
        offlineReason = "TIMEOUT";
      } else if (
        rawLower.includes("dns") ||
        rawLower.includes("resolve") ||
        raw.includes("Name or service not known")
      ) {
        friendly = "DNS: URL não encontrada. Verifique se o tunnel está ativo.";
        offlineReason = "DNS_ERROR";
      } else if (rawLower.includes("refused")) {
        friendly = "Conexão recusada pelo servidor";
        offlineReason = "CONNECTION_REFUSED";
      } else if (rawLower.includes("tunnel") || rawLower.includes("cloudflare")) {
        friendly = "Tunnel parece estar offline. Execute: cloudflared tunnel --url http://localhost:8080";
        offlineReason = "TUNNEL_OFF";
      }

      console.error("whatsapp-test network error:", raw);

      return respond({
        ok: false,
        step: "network",
        error: friendly,
        status: null,
        url: baseUrl,
        instance,
        details: {
          checklist,
          testUrl,
          offlineReason,
          rawError: raw.slice(0, 600),
        },
      });
    }
  } catch (e) {
    console.error("whatsapp-test global error:", e);
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
