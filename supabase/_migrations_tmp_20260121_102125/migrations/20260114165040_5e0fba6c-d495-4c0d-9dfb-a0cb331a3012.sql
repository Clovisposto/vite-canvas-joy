-- Tabela de campanhas WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de destinatários de campanha
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  customer_name text NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text NULL,
  error text NULL,
  sent_at timestamptz NULL
);

-- Índice para busca eficiente por campanha e status
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status 
ON public.whatsapp_campaign_recipients(campaign_id, status);

-- Tabela de opt-out (números que pediram para sair)
CREATE TABLE IF NOT EXISTS public.whatsapp_optout (
  phone_e164 text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NULL
);

-- Enable RLS
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_optout ENABLE ROW LEVEL SECURITY;

-- Policies para staff
CREATE POLICY "Staff can view campaigns" ON public.whatsapp_campaigns
  FOR SELECT USING (public.is_staff());

CREATE POLICY "Staff can insert campaigns" ON public.whatsapp_campaigns
  FOR INSERT WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update campaigns" ON public.whatsapp_campaigns
  FOR UPDATE USING (public.is_staff());

CREATE POLICY "Staff can view recipients" ON public.whatsapp_campaign_recipients
  FOR SELECT USING (public.is_staff());

CREATE POLICY "Staff can insert recipients" ON public.whatsapp_campaign_recipients
  FOR INSERT WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update recipients" ON public.whatsapp_campaign_recipients
  FOR UPDATE USING (public.is_staff());

CREATE POLICY "Staff can view optout" ON public.whatsapp_optout
  FOR SELECT USING (public.is_staff());

CREATE POLICY "Staff can insert optout" ON public.whatsapp_optout
  FOR INSERT WITH CHECK (public.is_staff());

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();