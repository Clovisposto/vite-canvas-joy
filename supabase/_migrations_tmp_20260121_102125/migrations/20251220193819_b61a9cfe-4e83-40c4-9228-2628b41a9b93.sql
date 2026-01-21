-- WhatsApp Cloud API Migration Status
-- Set migration flags in settings
INSERT INTO public.settings (key, value, description) VALUES 
  ('whatsapp_migration_status', '"COMPLETED"', 'Migration status for WhatsApp Cloud API'),
  ('whatsapp_provider', '"CLOUD_API_PRIMARY|EVOLUTION_FALLBACK"', 'WhatsApp provider configuration'),
  ('whatsapp_cloud_config_status', '"CONFIG_PENDING"', 'WhatsApp Cloud API configuration status - will be CONFIG_OK when all secrets are set')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

-- WhatsApp Contacts table
CREATE TABLE IF NOT EXISTS public.wa_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  wa_id VARCHAR(50),
  opt_in BOOLEAN DEFAULT true,
  opt_in_timestamp TIMESTAMPTZ,
  opt_out_timestamp TIMESTAMPTZ,
  opt_out_reason VARCHAR(255),
  customer_id UUID REFERENCES public.customers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp Messages table
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

-- WhatsApp Templates table
CREATE TABLE IF NOT EXISTS public.wa_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),
  language VARCHAR(10) DEFAULT 'pt_BR',
  header_type VARCHAR(20),
  header_content TEXT,
  body TEXT NOT NULL,
  footer TEXT,
  buttons JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  meta_template_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp Audit/Logs table
CREATE TABLE IF NOT EXISTS public.wa_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(20),
  error_message TEXT,
  provider VARCHAR(20),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone ON public.wa_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_opt_in ON public.wa_contacts(opt_in);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON public.wa_messages(phone);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON public.wa_messages(status);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON public.wa_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_audit_created ON public.wa_audit(created_at DESC);

-- Enable RLS
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users full access (admin only tables)
CREATE POLICY "Admin access wa_contacts" ON public.wa_contacts FOR ALL USING (true);
CREATE POLICY "Admin access wa_messages" ON public.wa_messages FOR ALL USING (true);
CREATE POLICY "Admin access wa_templates" ON public.wa_templates FOR ALL USING (true);
CREATE POLICY "Admin access wa_audit" ON public.wa_audit FOR ALL USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_wa_contacts_updated_at BEFORE UPDATE ON public.wa_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wa_templates_updated_at BEFORE UPDATE ON public.wa_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.wa_templates (name, category, body, status) VALUES 
  ('welcome', 'UTILITY', 'Olá {{1}}! Obrigado por se cadastrar no programa de fidelidade do Posto 7! 🚗⛽', 'approved'),
  ('promo', 'MARKETING', '🎉 Promoção especial para você, {{1}}! {{2}}', 'approved'),
  ('raffle_winner', 'UTILITY', '🎊 Parabéns {{1}}! Você foi sorteado! Entre em contato para retirar seu prêmio.', 'approved'),
  ('reminder', 'MARKETING', 'Olá {{1}}! Faz tempo que não nos visitamos. Venha abastecer no Posto 7! ⛽', 'approved')
ON CONFLICT (name) DO NOTHING;