-- ============================================
-- FINAL MISSING TABLES
-- ============================================

-- wa_templates table
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

ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access wa_templates" ON public.wa_templates FOR ALL TO authenticated USING (true);
CREATE TRIGGER update_wa_templates_updated_at BEFORE UPDATE ON public.wa_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- whatsapp_campaign_recipients table
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients FOR ALL TO authenticated USING (is_staff());

-- whatsapp_optout table
CREATE TABLE IF NOT EXISTS public.whatsapp_optout (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_optout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage whatsapp_optout" ON public.whatsapp_optout FOR ALL TO authenticated USING (is_staff());

-- Add scheduled_for column to whatsapp_campaigns
ALTER TABLE public.whatsapp_campaigns ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;