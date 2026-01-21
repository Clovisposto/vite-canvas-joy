-- Criar tabela para registrar intenções de envio WhatsApp (modo simulado)
CREATE TABLE public.ai_whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  whatsapp_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by TEXT DEFAULT 'ai_agent',
  status TEXT DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE public.ai_whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage ai_whatsapp_logs" 
ON public.ai_whatsapp_logs 
FOR ALL 
USING (true);

CREATE POLICY "Public can insert ai_whatsapp_logs" 
ON public.ai_whatsapp_logs 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_whatsapp_logs;