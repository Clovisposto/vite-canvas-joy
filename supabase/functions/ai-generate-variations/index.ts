import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, apiKey } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tenta pegar do body primeiro (frontend), depois do env (backend)
    const openAiKey = apiKey || Deno.env.get('OPENAI_API_KEY');
    
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Please configure it in Settings.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um assistente especializado em criar variações de mensagens para WhatsApp (Marketing).
Seu objetivo é reescrever a mensagem do usuário utilizando o formato "Spintax" para criar variações de sinônimos.
O formato Spintax funciona assim: {Olá|Oi|Ei} tudo {bem|joia}?
Isso gera: "Olá tudo bem?", "Oi tudo joia?", etc.

Regras:
1. Mantenha o tom e a intenção original da mensagem.
2. Crie variações para saudações, verbos, adjetivos e chamadas para ação.
3. NÃO altere variáveis como {{nome}}, URLs ou números importantes.
4. O resultado deve ser APENAS a string em formato Spintax, nada mais.
5. Tente criar pelo menos 3 variações para cada parte chave da frase.
6. A mensagem deve parecer natural e humana.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Reescreva em Spintax: ${message}` }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const spintax = data.choices[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ spintax }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
