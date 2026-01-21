-- wa_contacts table
CREATE TABLE IF NOT EXISTS public.wa_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  wa_id VARCHAR(50),
  opt_in BOOLEAN DEFAULT true,
  opt_in_timestamp TIMESTAMPTZ,
  opt_out_timestamp TIMESTAMPTZ,
  opt_out_reason VARCHAR(255),
  flow_state TEXT DEFAULT 'new',
  customer_id UUID REFERENCES public.customers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage wa_contacts" ON public.wa_contacts FOR ALL TO authenticated USING (is_staff());
CREATE TRIGGER update_wa_contacts_updated_at BEFORE UPDATE ON public.wa_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- wa_messages table
CREATE TABLE IF NOT EXISTS public.wa_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wa_message_id VARCHAR(100),
  contact_id UUID REFERENCES public.wa_contacts(id),
  phone VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  content TEXT,
  template_name VARCHAR(100),
  template_params JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  status_timestamp TIMESTAMPTZ,
  error_message TEXT,
  provider VARCHAR(20) DEFAULT 'cloud_api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage wa_messages" ON public.wa_messages FOR ALL TO authenticated USING (is_staff());

-- ai_whatsapp_logs table
CREATE TABLE IF NOT EXISTS public.ai_whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  whatsapp_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by TEXT DEFAULT 'ai_agent',
  status TEXT DEFAULT 'pending'
);
ALTER TABLE public.ai_whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage ai_whatsapp_logs" ON public.ai_whatsapp_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Public can insert ai_whatsapp_logs" ON public.ai_whatsapp_logs FOR INSERT WITH CHECK (true);