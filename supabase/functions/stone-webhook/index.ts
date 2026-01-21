import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stone-signature, x-webhook-secret',
};

// Simple rate limiter (max 100 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Clean old entries periodically
let requestCount = 0;
function cleanupRateLimitMap() {
  requestCount++;
  if (requestCount % 50 === 0) {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }
}

// Validate webhook secret (if configured)
function validateWebhookSecret(req: Request): boolean {
  const configuredSecret = Deno.env.get('STONE_WEBHOOK_SECRET');
  
  // If no secret configured, log warning but allow (for backwards compatibility)
  if (!configuredSecret) {
    console.warn('[Stone Webhook] No STONE_WEBHOOK_SECRET configured - webhook authentication disabled');
    return true;
  }
  
  // Check x-webhook-secret header
  const providedSecret = req.headers.get('x-webhook-secret') || req.headers.get('x-stone-signature');
  
  if (!providedSecret) {
    console.error('[Stone Webhook] Missing webhook secret header');
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (configuredSecret.length !== providedSecret.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < configuredSecret.length; i++) {
    result |= configuredSecret.charCodeAt(i) ^ providedSecret.charCodeAt(i);
  }
  
  return result === 0;
}

// Validate transaction data structure
function isValidTransaction(tx: unknown): tx is Record<string, unknown> {
  if (!tx || typeof tx !== 'object') return false;
  const t = tx as Record<string, unknown>;
  
  // Must have some form of amount
  const amount = t.amount || t.valor || t.value;
  if (amount === undefined || amount === null) return false;
  
  // Amount must be a valid number
  const numAmount = parseFloat(String(amount));
  if (isNaN(numAmount) || numAmount < 0) return false;
  
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting
  cleanupRateLimitMap();
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';
  
  if (isRateLimited(clientIP)) {
    console.error('[Stone Webhook] Rate limited:', clientIP);
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate webhook authentication
  if (!validateWebhookSecret(req)) {
    console.error('[Stone Webhook] Authentication failed from:', clientIP);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('[Stone Webhook] Received from', clientIP, ':', JSON.stringify(body).slice(0, 500));

    // Stone pode enviar um único objeto ou array de transações
    const transactions = Array.isArray(body) ? body : (body.transactions || body.data || [body]);

    if (!transactions || transactions.length === 0) {
      console.log('[Stone Webhook] No transactions in payload');
      return new Response(JSON.stringify({ success: true, message: 'No transactions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit batch size to prevent abuse
    const MAX_TRANSACTIONS = 50;
    if (transactions.length > MAX_TRANSACTIONS) {
      console.error('[Stone Webhook] Too many transactions:', transactions.length);
      return new Response(JSON.stringify({ 
        error: `Batch too large. Maximum ${MAX_TRANSACTIONS} transactions per request.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = { received: 0, inserted: 0, linked: 0, errors: [] as string[] };

    for (const tx of transactions) {
      results.received++;
      
      // Validate transaction structure
      if (!isValidTransaction(tx)) {
        console.log('[Stone Webhook] Invalid transaction structure, skipping');
        results.errors.push('Invalid transaction structure');
        continue;
      }
      
      try {
        // Mapear campos da Stone para nossa estrutura
        const terminalId = tx.terminal_id || tx.pos_id || tx.stone_code || null;
        
        // Tentar identificar frentista pelo terminal_id cadastrado
        let frentistaId = tx.operator_id || tx.frentista_id || tx.attendant_id || null;
        let frentistaNome = tx.operator_name || tx.frentista_nome || tx.attendant_name || null;
        
        if (terminalId && (!frentistaId || !frentistaNome)) {
          console.log('[Stone Webhook] Buscando frentista pelo terminal:', terminalId);
          const { data: frentista } = await supabase
            .from('frentistas')
            .select('id, codigo, nome')
            .eq('terminal_id', String(terminalId).slice(0, 50))
            .eq('is_active', true)
            .single();
          
          if (frentista) {
            frentistaId = frentista.codigo;
            frentistaNome = frentista.nome;
            console.log('[Stone Webhook] Frentista identificado pelo terminal:', frentistaNome);
          }
        }
        
        // Parse and validate amount (Stone sends in centavos)
        const rawAmount = parseFloat(String(tx.amount || tx.valor || tx.value || 0));
        const valor = rawAmount / 100;
        
        // Validate amount range (reasonable limits)
        if (valor <= 0 || valor > 100000) {
          console.log('[Stone Webhook] Invalid amount, skipping:', valor);
          continue;
        }
        
        const tefData = {
          horario: tx.transaction_date || tx.horario || tx.date || tx.created_at || new Date().toISOString(),
          valor: valor,
          forma_pagamento: mapPaymentMethod(String(tx.payment_method || tx.forma_pagamento || tx.type || 'debito')),
          nsu: tx.nsu ? String(tx.nsu).slice(0, 50) : null,
          autorizacao: tx.authorization_code || tx.autorizacao || tx.auth_code ? String(tx.authorization_code || tx.autorizacao || tx.auth_code).slice(0, 50) : null,
          bandeira: tx.card_brand || tx.bandeira || tx.brand ? String(tx.card_brand || tx.bandeira || tx.brand).toLowerCase().slice(0, 50) : null,
          parcelas: Math.min(Math.max(parseInt(String(tx.installments || tx.parcelas || 1)) || 1, 1), 48),
          terminal_id: terminalId ? String(terminalId).slice(0, 50) : null,
          frentista_id: frentistaId ? String(frentistaId).slice(0, 50) : null,
          frentista_nome: frentistaNome ? String(frentistaNome).slice(0, 100) : null,
          status: mapStatus(String(tx.status || 'approved')),
          raw_data: tx,
        };

        console.log('[Stone Webhook] Processing transaction:', tefData.valor, tefData.forma_pagamento, 'Frentista:', frentistaNome);

        // Inserir na tabela stone_tef_logs
        const { data: insertedTef, error: insertError } = await supabase
          .from('stone_tef_logs')
          .insert(tefData)
          .select('id')
          .single();

        if (insertError) {
          console.error('[Stone Webhook] Insert error:', insertError.message);
          results.errors.push(`Insert failed: ${insertError.message}`);
          continue;
        }

        results.inserted++;
        console.log('[Stone Webhook] Inserted TEF log:', insertedTef.id);

        // Tentar vincular automaticamente com check-in
        // Critério: mesmo valor, horário dentro de 30 minutos
        const tefTime = new Date(String(tefData.horario));
        const minTime = new Date(tefTime.getTime() - 30 * 60 * 1000).toISOString();
        const maxTime = new Date(tefTime.getTime() + 30 * 60 * 1000).toISOString();

        const { data: matchingCheckin } = await supabase
          .from('checkins')
          .select('id')
          .is('stone_tef_id', null)
          .eq('amount', tefData.valor)
          .gte('created_at', minTime)
          .lte('created_at', maxTime)
          .limit(1)
          .single();

        if (matchingCheckin) {
          // Vincular bidirecional
          await supabase.from('stone_tef_logs').update({ checkin_id: matchingCheckin.id }).eq('id', insertedTef.id);
          await supabase.from('checkins').update({ 
            stone_tef_id: insertedTef.id,
            attendant_code: tefData.frentista_id || undefined,
          }).eq('id', matchingCheckin.id);
          
          results.linked++;
          console.log('[Stone Webhook] Linked to checkin:', matchingCheckin.id);
        }

      } catch (txError: unknown) {
        const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
        console.error('[Stone Webhook] Transaction error:', errorMessage);
        results.errors.push(errorMessage);
      }
    }

    console.log('[Stone Webhook] Results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      ...results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Stone Webhook] Error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Mapear métodos de pagamento Stone para nosso formato
function mapPaymentMethod(method: string): string {
  const m = method.toLowerCase();
  if (m.includes('credit') || m.includes('credito')) return 'credito';
  if (m.includes('debit') || m.includes('debito')) return 'debito';
  if (m.includes('pix')) return 'pix';
  if (m.includes('voucher') || m.includes('vale')) return 'voucher';
  return 'debito';
}

// Mapear status Stone para nosso formato
function mapStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('approved') || s.includes('aprovad')) return 'aprovado';
  if (s.includes('declined') || s.includes('negad') || s.includes('recusad')) return 'negado';
  if (s.includes('pending') || s.includes('pendente')) return 'pendente';
  if (s.includes('cancelled') || s.includes('cancelad')) return 'cancelado';
  return 'aprovado';
}
