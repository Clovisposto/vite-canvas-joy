-- Tabela de configurações do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'EVOLUTION' CHECK (provider IN ('EVOLUTION','CLOUD')),
  enabled boolean NOT NULL DEFAULT false,
  evolution_base_url text NULL,
  evolution_api_key text NULL,
  evolution_instance text NULL,
  cloud_phone_number_id text NULL,
  cloud_access_token text NULL,
  cloud_waba_id text NULL,
  cloud_graph_version text NULL DEFAULT 'v20.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_whatsapp_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_settings_updated_at ON public.whatsapp_settings;
CREATE TRIGGER trg_whatsapp_settings_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_updated_at();

-- RLS para whatsapp_settings
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_settings_select"
ON public.whatsapp_settings
FOR SELECT
USING (true);

CREATE POLICY "whatsapp_settings_insert"
ON public.whatsapp_settings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "whatsapp_settings_update"
ON public.whatsapp_settings
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Inserir registro inicial padrão
INSERT INTO public.whatsapp_settings (provider, enabled)
SELECT 'EVOLUTION', false
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_settings);

-- Tabela de logs do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NULL REFERENCES public.customers(id),
  phone text NOT NULL,
  provider text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','FAILED')),
  error text NULL,
  message_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para whatsapp_logs
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_logs_select"
ON public.whatsapp_logs
FOR SELECT
USING (true);

CREATE POLICY "whatsapp_logs_insert"
ON public.whatsapp_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "whatsapp_logs_update"
ON public.whatsapp_logs
FOR UPDATE
USING (true)
WITH CHECK (true);