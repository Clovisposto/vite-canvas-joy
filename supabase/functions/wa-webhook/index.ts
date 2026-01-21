import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) return cleaned;
  return `55${cleaned}`;
}

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const appSecret = Deno.env.get('META_APP_SECRET');
  if (!appSecret) {
    console.error('[Webhook] META_APP_SECRET not configured');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  } catch (error) {
    console.error('[Webhook] Signature verification error:', error);
    return false;
  }
}

// End conversation without blocking future messages
async function processEndConversation(supabase: any, phone: string) {
  const formattedPhone = formatPhone(phone);
  
  // Only reset flow_state to allow new conversation
  // Does NOT change opt_in - customer continues receiving campaigns
  await supabase.from('wa_contacts').update({
    flow_state: 'new'
  }).eq('phone', formattedPhone);

  console.log(`[Webhook] Conversation ended for ${formattedPhone} (opt_in preserved - will continue receiving campaigns)`);
}

async function processOptIn(supabase: any, phone: string) {
  const formattedPhone = formatPhone(phone);
  
  await supabase.from('wa_contacts').upsert({
    phone: formattedPhone,
    opt_in: true,
    opt_in_timestamp: new Date().toISOString(),
    opt_out_timestamp: null,
    opt_out_reason: null
  }, { onConflict: 'phone' });

  console.log(`[Webhook] Opt-in processed for ${formattedPhone}`);
}

async function saveInboundMessage(supabase: any, waMessageId: string, phone: string, content: string, type: string) {
  await supabase.from('wa_messages').insert({
    wa_message_id: waMessageId,
    phone: formatPhone(phone),
    direction: 'inbound',
    message_type: type,
    content,
    status: 'received',
    status_timestamp: new Date().toISOString(),
    provider: 'cloud_api'
  });
}

// Call the AI chatbot function for regular messages
async function triggerAIChatbot(supabaseUrl: string, phone: string, message: string): Promise<void> {
  try {
    const formattedPhone = formatPhone(phone);
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    console.log(`[Webhook] Triggering AI chatbot for ${formattedPhone}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/wa-ai-chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
        first_contact: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Webhook] AI chatbot error: ${response.status} - ${errorText}`);
    } else {
      const result = await response.json();
      console.log(`[Webhook] AI chatbot response:`, result);
    }
  } catch (e) {
    console.error('[Webhook] Error calling AI chatbot:', e);
  }
}

// Trigger farewell message via AI chatbot
async function triggerFarewellMessage(supabaseUrl: string, phone: string): Promise<void> {
  try {
    const formattedPhone = formatPhone(phone);
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    console.log(`[Webhook] Sending farewell message to ${formattedPhone}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/wa-ai-chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        action: 'end_conversation'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Webhook] Farewell message error: ${response.status} - ${errorText}`);
    } else {
      const result = await response.json();
      console.log(`[Webhook] Farewell message sent:`, result);
    }
  } catch (e) {
    console.error('[Webhook] Error sending farewell message:', e);
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[Webhook] Verification request:', { mode, token: token?.substring(0, 5) + '...', challenge });

    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Verification successful');
      return new Response(challenge, { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    console.error('[Webhook] Verification failed');
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // Webhook events (POST)
  if (req.method === 'POST') {
    const bodyText = await req.text();
    
    // Verify signature
    const isValid = await verifySignature(req, bodyText);
    if (!isValid) {
      console.error('[Webhook] Invalid signature');
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const body = JSON.parse(bodyText);
      console.log('[Webhook] Received:', JSON.stringify(body).substring(0, 500));

      // Log audit
      await supabase.from('wa_audit').insert({
        action: 'webhook_received',
        entity_type: 'webhook',
        request_data: body,
        status: 'received',
        provider: 'cloud_api'
      });

      // Process messages
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          
          // Process status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              console.log(`[Webhook] Status update: ${status.id} -> ${status.status}`);
              await supabase.from('wa_messages')
                .update({ 
                  status: status.status, 
                  status_timestamp: new Date().toISOString() 
                })
                .eq('wa_message_id', status.id);
            }
          }

          // Process incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const phone = msg.from;
              const text = msg.text?.body || msg.button?.text || '';
              const type = msg.type || 'text';

              console.log(`[Webhook] Inbound message from ${phone}: ${text.substring(0, 50)}`);

              // Save message
              await saveInboundMessage(supabase, msg.id, phone, text, type);

              // Keywords that END CONVERSATION (but do NOT block future campaigns)
              // All these keywords just close the current chat with a farewell message
              const upperText = text.toUpperCase().trim();
              const endConversationKeywords = [
                'SAIR', 'STOP', 'PARAR', 'FIM', 'TCHAU', 
                'OBRIGADO', 'CANCELAR', 'ENCERRAR', 'FINALIZAR',
                'UNSUBSCRIBE', 'REMOVER'
              ];
              const optInKeywords = ['ENTRAR', 'START', 'INICIAR', 'VOLTAR', 'SUBSCRIBE', 'ACEITAR'];

              if (endConversationKeywords.some(kw => upperText === kw || upperText.startsWith(kw + ' '))) {
                // End conversation: reset flow_state and send farewell
                // Customer will CONTINUE receiving future campaign messages
                console.log(`[Webhook] End conversation keyword detected: ${text}`);
                await processEndConversation(supabase, phone);
                await triggerFarewellMessage(supabaseUrl, phone);
              } else if (optInKeywords.some(kw => upperText === kw || upperText.startsWith(kw + ' '))) {
                await processOptIn(supabase, phone);
              } else {
                // Regular message - trigger AI chatbot
                await triggerAIChatbot(supabaseUrl, phone, text);
              }
            }
          }
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Webhook] Error:', error);
      await supabase.from('wa_audit').insert({
        action: 'webhook_error',
        entity_type: 'webhook',
        request_data: { error: errorMsg },
        status: 'error',
        error_message: errorMsg,
        provider: 'cloud_api'
      });
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
