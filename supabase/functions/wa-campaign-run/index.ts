import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  campaign_id: string;
  batch_size?: number;
  delay_min_ms?: number;
  delay_max_ms?: number;
  test_only?: boolean;
  recipient_ids?: string[]; // IDs específicos de recipients para enviar
}

// Parse JSON de forma segura, detectando respostas HTML (Forbidden, etc)
function safeJsonParse(text: string): { ok: boolean; data?: any; error?: string } {
  if (!text || text.trim() === '') {
    return { ok: false, error: 'Resposta vazia da API' };
  }
  
  // Detectar resposta HTML (ex: Cloudflare Forbidden page)
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.trim().startsWith('<')) {
    console.error('HTML response detected (likely tunnel/proxy error):', text.substring(0, 500));
    return { 
      ok: false, 
      error: 'Evolution API retornou HTML ao invés de JSON. Possível problema no Cloudflare Tunnel ou proxy.' 
    };
  }
  
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (e) {
    console.error('JSON parse error:', e, 'Text:', text.substring(0, 500));
    return { ok: false, error: `Resposta inválida da API: ${text.substring(0, 100)}` };
  }
}

// Resolver Spintax: {Olá|Oi|Ei} -> Olá
function resolveSpintax(text: string): string {
  if (!text) return "";
  return text.replace(/\{([^{}]+)\}/g, (match, content) => {
    const choices = content.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

// Gera delay aleatório entre min e max
function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Aguardar com log
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Verifica conectividade com Evolution API
async function checkEvolutionConnectivity(baseUrl: string, apiKey: string, instance: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${baseUrl}/instance/connectionState/${instance}`;
    console.log(`[Connectivity] Checking: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });
    
    const text = await response.text();
    console.log(`[Connectivity] Status: ${response.status}, Response length: ${text.length}`);
    
    const parsed = safeJsonParse(text);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: 'API Key inválida ou sem permissão' };
      }
      if (response.status === 404) {
        return { ok: false, error: `Instância "${instance}" não encontrada` };
      }
      return { ok: false, error: `Erro HTTP ${response.status}: ${parsed.data?.message || 'Unknown'}` };
    }
    
    const data = parsed.data;
    if (data?.instance?.state !== 'open') {
      return { ok: false, error: `WhatsApp não está conectado. Estado atual: ${data?.instance?.state || 'unknown'}. Escaneie o QR Code na Evolution API.` };
    }
    
    return { ok: true };
  } catch (error: any) {
    console.error('[Connectivity] Exception:', error);
    if (error.message?.includes('DNS') || error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
      return { ok: false, error: 'Evolution API não está acessível. Verifique se a URL está correta e o servidor está online.' };
    }
    return { ok: false, error: error.message || 'Erro de conexão desconhecido' };
  }
}

// Enviar mensagem com retry
async function sendMessageWithRetry(
  evolutionBaseUrl: string, 
  evolutionApiKey: string, 
  evolutionInstance: string,
  phone: string,
  message: string,
  maxRetries: number = 2
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const sendUrl = `${evolutionBaseUrl}/message/sendText/${evolutionInstance}`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Send] Attempt ${attempt}/${maxRetries} to ${phone}`);
      
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
        }),
      });

      const text = await response.text();
      console.log(`[Send] Response status: ${response.status}, length: ${text.length}`);
      
      // Verificar se é HTML (erro de túnel)
      const parsed = safeJsonParse(text);
      if (!parsed.ok) {
        console.error(`[Send] Parse failed:`, parsed.error);
        
        // Se for erro de túnel, vale tentar novamente após espera
        if (parsed.error?.includes('HTML') && attempt < maxRetries) {
          console.log(`[Send] Tunnel error detected, waiting 5s before retry...`);
          await sleep(5000);
          continue;
        }
        
        return { ok: false, error: parsed.error };
      }

      const result = parsed.data;
      
      if (response.ok && result.key?.id) {
        console.log(`[Send] Success! Message ID: ${result.key.id}`);
        return { ok: true, messageId: result.key.id };
      }
      
      // Erro retornado pela API
      const errorMsg = result.message || result.error || `HTTP ${response.status}`;
      console.error(`[Send] API error:`, errorMsg);
      
      // Erros transientes que podem ser retentados
      if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
        console.log(`[Send] Transient error (${response.status}), waiting 5s before retry...`);
        await sleep(5000);
        continue;
      }
      
      return { ok: false, error: errorMsg };
      
    } catch (error: any) {
      console.error(`[Send] Exception on attempt ${attempt}:`, error);
      
      // Erros de rede podem ser retentados
      if (attempt < maxRetries) {
        console.log(`[Send] Network error, waiting 5s before retry...`);
        await sleep(5000);
        continue;
      }
      
      return { ok: false, error: error.message || 'Network error' };
    }
  }
  
  return { ok: false, error: 'Max retries exceeded' };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verificar secrets
    const evolutionBaseUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionBaseUrl || !evolutionApiKey || !evolutionInstance) {
      console.error('Missing secrets:', { 
        hasUrl: !!evolutionBaseUrl, 
        hasKey: !!evolutionApiKey, 
        hasInstance: !!evolutionInstance 
      });
      return new Response(JSON.stringify({ 
        error: 'missing secrets',
        message: 'Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME nos secrets do projeto.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Config] URL: ${evolutionBaseUrl}, Instance: ${evolutionInstance}`);

    // Parse body
    const body: RequestBody = await req.json();
    
    // Limitar batch_size para evitar timeout da Edge Function (~60s)
    const MAX_MESSAGES_PER_CALL = 5;
    const { 
      campaign_id, 
      batch_size: requestedBatchSize = 5,
      delay_min_ms: requestedDelayMin = 8000,   // 8 segundos mínimo (DENTRO do lote)
      delay_max_ms: requestedDelayMax = 15000,  // 15 segundos máximo (DENTRO do lote)
      test_only = false,
      recipient_ids = []
    } = body;
    
    // Garantir que batch_size não exceda o máximo seguro
    const batch_size = Math.min(requestedBatchSize, MAX_MESSAGES_PER_CALL);
    // Delays menores DENTRO do lote (frontend controla intervalo ENTRE lotes)
    const delay_min_ms = Math.min(requestedDelayMin, 15000); // Max 15s dentro do lote
    const delay_max_ms = Math.min(requestedDelayMax, 25000); // Max 25s dentro do lote

    console.log(`[Request] campaign_id: ${campaign_id}, batch: ${batch_size}, delay: ${delay_min_ms}-${delay_max_ms}ms, test_only: ${test_only}, recipient_ids: ${recipient_ids?.length || 0}`);

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar conectividade antes de processar
    console.log('[Main] Checking Evolution API connectivity...');
    const connectivityCheck = await checkEvolutionConnectivity(evolutionBaseUrl, evolutionApiKey, evolutionInstance);
    
    if (!connectivityCheck.ok) {
      console.error('[Main] Evolution API connectivity failed:', connectivityCheck.error);
      return new Response(JSON.stringify({ 
        error: 'connectivity_failed',
        message: connectivityCheck.error
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Main] Evolution API connected successfully');

    // Se for apenas teste, retornar sucesso
    if (test_only) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Conectividade verificada com sucesso!',
        test_only: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar campanha
    const { data: campaign, error: campaignError } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error('[Main] Campaign not found:', campaignError);
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Main] Campaign: ${campaign.name}, status: ${campaign.status}`);

    // Verificar se já está em execução
    if (campaign.status === 'sending') {
      console.log('[Main] Campaign already sending, continuing...');
    }

    // Buscar opt-outs
    const { data: optouts } = await supabase
      .from('whatsapp_optout')
      .select('phone_e164');
    
    const optoutSet = new Set((optouts || []).map(o => o.phone_e164));
    console.log(`[Main] Loaded ${optoutSet.size} opt-outs`);

    // Buscar clientes bloqueados (sem LGPD ou sem aceite promo) para filtro extra
    const { data: blockedCustomers } = await supabase
      .from('customers')
      .select('phone')
      .or('lgpd_consent.eq.false,lgpd_consent.is.null,accepts_promo.eq.false,accepts_promo.is.null');
    
    const blockedPhones = new Set((blockedCustomers || []).map(c => {
      const digits = c.phone.replace(/\D/g, '');
      return digits.startsWith('55') ? digits : '55' + digits;
    }));
    console.log(`[Main] Loaded ${blockedPhones.size} blocked phones (LGPD)`);

    // Buscar recipients pendentes - com ou sem filtro de IDs
    let recipients: any[] = [];
    
    if (recipient_ids && recipient_ids.length > 0) {
      // Se tem muitos IDs, buscar em chunks para evitar URL muito longa
      const CHUNK_SIZE = 30; // Máximo de IDs por query para URL segura
      console.log(`[Main] Filtering by ${recipient_ids.length} specific recipient IDs (in chunks of ${CHUNK_SIZE})`);
      
      for (let i = 0; i < recipient_ids.length && recipients.length < batch_size; i += CHUNK_SIZE) {
        const chunk = recipient_ids.slice(i, i + CHUNK_SIZE);
        const { data: chunkData, error: chunkError } = await supabase
          .from('whatsapp_campaign_recipients')
          .select('*')
          .eq('campaign_id', campaign_id)
          .eq('status', 'pending')
          .in('id', chunk)
          .limit(batch_size - recipients.length);
        
        if (chunkError) {
          console.error('[Main] Error fetching chunk:', chunkError);
          throw chunkError;
        }
        
        if (chunkData) {
          recipients = [...recipients, ...chunkData];
        }
      }
      console.log(`[Main] Fetched ${recipients.length} recipients from chunks`);
    } else {
      // Sem IDs específicos, buscar normalmente
      const { data: allRecipients, error: recipientsError } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('status', 'pending')
        .limit(batch_size);
      
      if (recipientsError) {
        console.error('[Main] Error fetching recipients:', recipientsError);
        throw recipientsError;
      }
      
      recipients = allRecipients || [];
    }

    if (!recipients || recipients.length === 0) {
      // Marcar campanha como concluída
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'done' })
        .eq('id', campaign_id);

      console.log('[Main] Campaign completed - no pending recipients');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Campaign completed - no pending recipients',
        sent: 0,
        failed: 0,
        skipped: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let tunnelErrors = 0;

    console.log(`[Main] Processing ${recipients.length} recipients with delay ${delay_min_ms}-${delay_max_ms}ms`);

    // Processar cada recipient
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      // Verificar opt-out
      if (optoutSet.has(recipient.phone_e164)) {
        await supabase
          .from('whatsapp_campaign_recipients')
          .update({ status: 'skipped', error: 'Opt-out' })
          .eq('id', recipient.id);
        skipped++;
        console.log(`[${i + 1}/${recipients.length}] Skipped (opt-out): ${recipient.phone_e164}`);
        continue;
      }

      // Verificar LGPD bloqueado
      if (blockedPhones.has(recipient.phone_e164)) {
        await supabase
          .from('whatsapp_campaign_recipients')
          .update({ status: 'skipped', error: 'Sem consentimento LGPD' })
          .eq('id', recipient.id);
        skipped++;
        console.log(`[${i + 1}/${recipients.length}] Skipped (LGPD): ${recipient.phone_e164}`);
        continue;
      }

      // Verificar status da campanha (pode ter sido pausada)
      const { data: currentCampaign } = await supabase
        .from('whatsapp_campaigns')
        .select('status')
        .eq('id', campaign_id)
        .single();

      if (currentCampaign?.status === 'paused') {
        console.log('[Main] Campaign paused, stopping...');
        break;
      }

      // Personalizar mensagem
      let message = resolveSpintax(campaign.message);
      if (recipient.customer_name) {
        message = message.replace(/\{\{nome\}\}/gi, recipient.customer_name);
      } else {
        message = message.replace(/\{\{nome\}\}/gi, 'Cliente');
      }

      // Record start time
      const startTime = Date.now();

      // Enviar via Evolution API com retry
      const sendResult = await sendMessageWithRetry(
        evolutionBaseUrl,
        evolutionApiKey,
        evolutionInstance,
        recipient.phone_e164,
        message
      );

      // Calculate latency
      const dispatchLatency = Date.now() - startTime;

      if (sendResult.ok) {
        const { error: updateError } = await supabase
          .from('whatsapp_campaign_recipients')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            provider_message_id: sendResult.messageId,
            dispatch_latency_ms: dispatchLatency,
            sent_content: message
          })
          .eq('id', recipient.id);
        
        if (updateError) {
          console.error(`[${i + 1}/${recipients.length}] UPDATE error (sent):`, updateError);
        }
        
        sent++;
        tunnelErrors = 0; // Reset após sucesso
        console.log(`[${i + 1}/${recipients.length}] ✓ Sent to ${recipient.phone_e164}`);
      } else {
        const errorMsg = sendResult.error || 'Unknown error';
        const errorLower = errorMsg.toLowerCase();
        
        // Detectar erro de túnel/conexão (problema de infraestrutura)
        const isTunnelError = 
          errorMsg.includes('HTML') || 
          errorMsg.includes('Tunnel') ||
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('Connection') ||
          errorMsg.includes('failed to lookup') ||
          errorMsg.includes('error sending request');
        
        // Detectar número inválido (problema do número, não infraestrutura)
        const isInvalidNumber = 
          errorLower.includes('not registered') ||
          errorLower.includes('invalid number') ||
          errorLower.includes('not found') ||
          errorLower.includes('does not exist') ||
          errorLower.includes('not a valid') ||
          errorLower.includes('check the phone') ||
          errorLower.includes('número inválido') ||
          errorLower.includes('whatsapp account');
        
        if (isTunnelError) {
          tunnelErrors++;
          console.log(`[${i + 1}/${recipients.length}] ⚠ Tunnel error (${tunnelErrors}/3): ${errorMsg}`);
        } else if (isInvalidNumber) {
          // Número inválido não conta como erro de túnel - apenas pula
          console.log(`[${i + 1}/${recipients.length}] ⏭ Invalid number, skipping: ${errorMsg}`);
        } else {
          // Outros erros - não conta para parar, mas loga
          console.log(`[${i + 1}/${recipients.length}] ✗ Other error: ${errorMsg}`);
        }
        
        const { error: updateError } = await supabase
          .from('whatsapp_campaign_recipients')
          .update({ 
            status: 'failed', 
            error: errorMsg.substring(0, 500)
          })
          .eq('id', recipient.id);
        
        if (updateError) {
          console.error(`[${i + 1}/${recipients.length}] UPDATE error (failed):`, updateError);
        }
        
        failed++;
        
        // Só para se forem 3 erros de TÚNEL consecutivos
        if (tunnelErrors >= 3) {
          console.error('[Main] Too many consecutive tunnel errors, stopping batch');
          break;
        }
      }

      // Delay ALEATÓRIO entre mensagens (exceto após a última)
      if (i < recipients.length - 1) {
        const delay = getRandomDelay(delay_min_ms, delay_max_ms);
        console.log(`[Main] Waiting ${Math.round(delay / 1000)}s before next message...`);
        await sleep(delay);
      }
    }

    // Verificar se ainda há pendentes
    const { count: pendingCount } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending');

    if (pendingCount === 0) {
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'done' })
        .eq('id', campaign_id);
      console.log('[Main] Campaign marked as done');
    }

    const resultMessage = tunnelErrors > 0 
      ? `Lote interrompido: ${sent} enviados, ${failed} falharam (${tunnelErrors} erros de túnel), ${skipped} ignorados`
      : `Lote processado: ${sent} enviados, ${failed} falharam, ${skipped} ignorados`;

    console.log(`[Main] Result: ${resultMessage}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: resultMessage,
      sent,
      failed,
      skipped,
      tunnel_errors: tunnelErrors,
      remaining: pendingCount || 0,
      delay_range: `${delay_min_ms}-${delay_max_ms}ms`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Main] Unhandled error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
