-- ============================================
-- ADDITIONAL TABLES AND COLUMNS
-- ============================================

-- Add is_demo column to checkins
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Add terminal_id to qr_capture_points
ALTER TABLE public.qr_capture_points ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(100);

-- Add consent fields to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS consent_text_version VARCHAR(50) DEFAULT 'lgpd-v1',
ADD COLUMN IF NOT EXISTS consent_source VARCHAR(50) DEFAULT 'checkbox',
ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- FRENTISTA METAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.frentista_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frentista_id UUID NOT NULL REFERENCES public.frentistas(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  target_checkins INTEGER NOT NULL DEFAULT 50,
  target_amount NUMERIC DEFAULT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.frentista_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage frentista_metas" ON public.frentista_metas FOR ALL TO authenticated USING (true);
CREATE POLICY "Public can read active metas" ON public.frentista_metas FOR SELECT USING (is_active = true);
CREATE TRIGGER update_frentista_metas_updated_at BEFORE UPDATE ON public.frentista_metas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DISPATCH HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dispatch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage dispatch_history" ON public.dispatch_history FOR ALL TO authenticated USING (is_staff());

-- ============================================
-- WHATSAPP CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  target_filter JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage whatsapp_campaigns" ON public.whatsapp_campaigns FOR ALL TO authenticated USING (is_staff());
CREATE TRIGGER update_whatsapp_campaigns_updated_at BEFORE UPDATE ON public.whatsapp_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ADDITIONAL FUNCTIONS
-- ============================================

-- Function: public_create_checkin_and_token
CREATE OR REPLACE FUNCTION public.public_create_checkin_and_token(
  p_phone TEXT,
  p_attendant_code TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_checkin_id UUID;
  v_token TEXT;
BEGIN
  v_token := replace(gen_random_uuid()::text, '-', '');
  
  INSERT INTO checkins (phone, attendant_code, tag, origin)
  VALUES (p_phone, p_attendant_code, p_tag, 'pwa')
  RETURNING id INTO v_checkin_id;
  
  RETURN json_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'token', v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_create_checkin_and_token TO anon, authenticated;

-- Function: get_public_checkin_status
CREATE OR REPLACE FUNCTION public.get_public_checkin_status(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_checkin RECORD;
  v_status TEXT;
  v_phone_masked TEXT;
BEGIN
  -- For now just return a success response
  RETURN json_build_object(
    'success', true,
    'status', 'aguardando'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_checkin_status TO anon, authenticated;

-- Function: get_premio_publico
CREATE OR REPLACE FUNCTION public.get_premio_publico(p_codigo TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_premio RECORD;
BEGIN
  SELECT * INTO v_premio FROM premios_qr WHERE codigo = p_codigo;
  
  IF v_premio IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Código não encontrado');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'id', v_premio.id,
    'codigo', v_premio.codigo,
    'nome_ganhador', v_premio.nome_ganhador,
    'valor_original', v_premio.valor_original,
    'valor_restante', v_premio.valor_restante,
    'status', v_premio.status,
    'data_expiracao', v_premio.data_expiracao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_premio_publico TO anon, authenticated;