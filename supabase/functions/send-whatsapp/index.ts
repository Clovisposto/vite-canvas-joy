import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  phone: string;
  message: string;
}

interface BulkSendRequest {
  customers: { phone: string; name?: string }[];
  message: string;
}

function formatPhoneForEvolution(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) {
    return cleaned;
  }
  return `55${cleaned}`;
}

async function sendSingleMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneForEvolution(phone);
    
    console.log(`Sending message to ${formattedPhone}`);
    
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send to ${formattedPhone}: ${errorText}`);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`Message sent successfully to ${formattedPhone}`, result);
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error sending to ${phone}:`, error);
    return { success: false, error: errorMessage };
  }
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const auth = await authenticateStaff(req);
    if (!auth.authenticated) {
      console.log('[send-whatsapp] Authentication failed:', auth.error);
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-whatsapp] Authenticated user:', auth.userId);

    const apiUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!apiUrl || !apiKey || !instanceName) {
      console.error('Missing Evolution API configuration');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    
    // Check if it's a bulk send or single message
    if (body.customers && Array.isArray(body.customers)) {
      // Bulk send
      const { customers, message } = body as BulkSendRequest;
      
      console.log(`Starting bulk send to ${customers.length} customers`);
      
      const results = {
        total: customers.length,
        sent: 0,
        failed: 0,
        errors: [] as { phone: string; error: string }[],
      };

      // Send messages with a small delay to avoid rate limiting
      for (const customer of customers) {
        const personalizedMessage = message.replace('{nome}', customer.name || 'Cliente');
        const result = await sendSingleMessage(apiUrl, apiKey, instanceName, customer.phone, personalizedMessage);
        
        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({ phone: customer.phone, error: result.error || 'Unknown error' });
        }
        
        // Small delay between messages (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`Bulk send completed: ${results.sent} sent, ${results.failed} failed`);
      
      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Single message
      const { phone, message } = body as SendMessageRequest;
      
      if (!phone || !message) {
        return new Response(
          JSON.stringify({ error: 'Phone and message are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendSingleMessage(apiUrl, apiKey, instanceName, phone, message);
      
      if (result.success) {
        return new Response(
          JSON.stringify({ success: true, message: 'Message sent successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-whatsapp function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
