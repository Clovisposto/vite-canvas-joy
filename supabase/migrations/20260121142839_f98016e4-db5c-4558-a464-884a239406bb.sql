-- ============================================
-- COMPLETE SCHEMA FOR POSTO 7 DIGITAL
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage settings" ON public.settings FOR ALL TO authenticated USING (true);

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('posto_name', '"Posto 7"', 'Nome do posto'),
  ('whatsapp_number', '"5511999999999"', 'Número WhatsApp do posto'),
  ('raffle_rules', '"Sorteio válido para clientes cadastrados."', 'Regras do sorteio'),
  ('lgpd_text', '"Ao prosseguir, você concorda com o tratamento dos seus dados conforme a LGPD."', 'Texto LGPD'),
  ('shift_change_hour', '18', 'Hora de troca de turno')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- PROFILES TABLE (for admin users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'operador', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Authenticated can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'viewer'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper functions for role checking
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'operador')
  )
$$;

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  accepts_raffle BOOLEAN DEFAULT FALSE,
  accepts_promo BOOLEAN DEFAULT FALSE,
  lgpd_consent BOOLEAN DEFAULT FALSE,
  lgpd_consent_timestamp TIMESTAMPTZ,
  lgpd_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read customers" ON public.customers FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Anon can insert customers" ON public.customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Staff can update customers" ON public.customers FOR UPDATE TO authenticated USING (is_staff());
CREATE POLICY "Staff can delete customers" ON public.customers FOR DELETE TO authenticated USING (is_staff());

CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FRENTISTAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.frentistas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  terminal_id VARCHAR(100) DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.frentistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active frentistas" ON public.frentistas FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage frentistas" ON public.frentistas FOR ALL TO authenticated USING (true);
CREATE TRIGGER update_frentistas_updated_at BEFORE UPDATE ON public.frentistas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample frentistas
INSERT INTO public.frentistas (codigo, nome) VALUES
('001', 'Frentista 1'), ('002', 'Frentista 2'), ('003', 'Frentista 3')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- FRENTISTAS PINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.frentistas_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frentista_id UUID NOT NULL REFERENCES public.frentistas(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(frentista_id)
);

ALTER TABLE public.frentistas_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage frentistas_pins" ON public.frentistas_pins FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE TRIGGER update_frentistas_pins_updated_at BEFORE UPDATE ON public.frentistas_pins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CHECKINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  attendant_code TEXT,
  payment_method TEXT,
  amount DECIMAL(10,2),
  liters DECIMAL(10,2),
  tag TEXT,
  origin TEXT DEFAULT 'pwa',
  stone_tef_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read checkins" ON public.checkins FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Anon can insert checkins" ON public.checkins FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Staff can update checkins" ON public.checkins FOR UPDATE TO authenticated USING (is_staff());
CREATE POLICY "Staff can delete checkins" ON public.checkins FOR DELETE TO authenticated USING (is_staff());

CREATE INDEX idx_checkins_phone ON public.checkins(phone);
CREATE INDEX idx_checkins_created_at ON public.checkins(created_at);
CREATE INDEX idx_checkins_customer_id ON public.checkins(customer_id);

-- ============================================
-- PROMOTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('desconto', 'brinde', 'informativa', 'relampago')) DEFAULT 'informativa',
  discount_value DECIMAL(10,2),
  eligible_payments TEXT[] DEFAULT ARRAY['pix', 'dinheiro', 'debito'],
  is_active BOOLEAN DEFAULT FALSE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active promotions" ON public.promotions FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage promotions" ON public.promotions FOR ALL TO authenticated USING (true);
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RAFFLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  winners_count INTEGER DEFAULT 3,
  prize_value DECIMAL(10,2) DEFAULT 100.00,
  schedule_days INTEGER[] DEFAULT ARRAY[6],
  schedule_times TIME[] DEFAULT ARRAY['08:00'::TIME, '15:00'::TIME],
  rules TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active raffles" ON public.raffles FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage raffles" ON public.raffles FOR ALL TO authenticated USING (true);
CREATE TRIGGER update_raffles_updated_at BEFORE UPDATE ON public.raffles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default raffle
INSERT INTO public.raffles (name, winners_count, prize_value, schedule_days, schedule_times, rules, is_active)
VALUES ('Sorteio Semanal', 3, 100.00, ARRAY[6], ARRAY['08:00'::TIME, '15:00'::TIME], 'Sorteio realizado todo sábado às 08:00 e 15:00.', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- RAFFLE RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.raffle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID REFERENCES public.raffles(id) ON DELETE SET NULL,
  eligible_count INTEGER DEFAULT 0,
  seed TEXT,
  winners JSONB DEFAULT '[]',
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id),
  is_test BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.raffle_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read raffle_runs" ON public.raffle_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert raffle_runs" ON public.raffle_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_raffle_runs_executed_at ON public.raffle_runs(executed_at);

-- ============================================
-- MESSAGES QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage messages_queue" ON public.messages_queue FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE INDEX idx_messages_queue_status ON public.messages_queue(status);

-- ============================================
-- COMPLAINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'em_tratamento', 'resolvido')),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can create complaints" ON public.complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can manage complaints" ON public.complaints FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE INDEX idx_complaints_status ON public.complaints(status);

-- ============================================
-- IMPORTS LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.imports_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  records_total INTEGER DEFAULT 0,
  records_matched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.imports_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage imports_logs" ON public.imports_logs FOR ALL TO authenticated USING (true);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- LIVRO CAIXA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.livro_caixa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  forma_pagamento VARCHAR(50),
  responsavel VARCHAR(100),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.livro_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage livro_caixa" ON public.livro_caixa FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE TRIGGER update_livro_caixa_updated_at BEFORE UPDATE ON public.livro_caixa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- WHATSAPP SETTINGS TABLE
-- ============================================
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

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage whatsapp_settings" ON public.whatsapp_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Insert default
INSERT INTO public.whatsapp_settings (provider, enabled)
SELECT 'EVOLUTION', false WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_settings);

-- ============================================
-- WHATSAPP LOGS TABLE
-- ============================================
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

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_logs_select" ON public.whatsapp_logs FOR SELECT USING (true);
CREATE POLICY "whatsapp_logs_insert" ON public.whatsapp_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "whatsapp_logs_update" ON public.whatsapp_logs FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- PREMIOS QR TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.premios_qr (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome_ganhador TEXT NOT NULL,
  cpf VARCHAR(14) NULL,
  telefone TEXT NULL,
  valor_original NUMERIC NOT NULL DEFAULT 100,
  valor_restante NUMERIC NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'expirado', 'zerado')),
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_expiracao TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NULL,
  observacoes TEXT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.premios_qr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage premios_qr" ON public.premios_qr FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "Public can read premios_qr by codigo" ON public.premios_qr FOR SELECT USING (true);
CREATE TRIGGER update_premios_qr_updated_at BEFORE UPDATE ON public.premios_qr FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_premios_qr_codigo ON public.premios_qr(codigo);
CREATE INDEX idx_premios_qr_status ON public.premios_qr(status);

-- ============================================
-- PREMIOS QR CONSUMOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.premios_qr_consumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  premio_id UUID NOT NULL REFERENCES public.premios_qr(id) ON DELETE CASCADE,
  valor_abatido NUMERIC NOT NULL,
  valor_anterior NUMERIC NOT NULL,
  valor_apos NUMERIC NOT NULL,
  consumido_por UUID NULL,
  consumido_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observacao TEXT NULL
);

ALTER TABLE public.premios_qr_consumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage consumos" ON public.premios_qr_consumos FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "Public can read consumos" ON public.premios_qr_consumos FOR SELECT USING (true);
CREATE INDEX idx_premios_qr_consumos_premio ON public.premios_qr_consumos(premio_id);

-- ============================================
-- STONE TEF LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.stone_tef_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_id UUID REFERENCES public.checkins(id),
  frentista_id VARCHAR(50),
  frentista_nome VARCHAR(100),
  horario TIMESTAMPTZ NOT NULL DEFAULT now(),
  valor NUMERIC(10,2) NOT NULL,
  forma_pagamento VARCHAR(50) NOT NULL,
  nsu VARCHAR(50),
  autorizacao VARCHAR(50),
  bandeira VARCHAR(50),
  parcelas INTEGER DEFAULT 1,
  terminal_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'aprovado',
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stone_tef_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only access stone_tef_logs" ON public.stone_tef_logs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Public insert stone_tef_logs" ON public.stone_tef_logs FOR INSERT WITH CHECK (true);
CREATE INDEX idx_stone_tef_logs_checkin ON public.stone_tef_logs(checkin_id);
CREATE INDEX idx_stone_tef_logs_horario ON public.stone_tef_logs(horario DESC);
CREATE TRIGGER update_stone_tef_logs_updated_at BEFORE UPDATE ON public.stone_tef_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- QR CAPTURE POINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.qr_capture_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tag VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  location VARCHAR(100),
  frentista_id UUID REFERENCES public.frentistas(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_capture_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage qr_capture_points" ON public.qr_capture_points FOR ALL TO authenticated USING (true);
CREATE POLICY "Public can read active qr_capture_points" ON public.qr_capture_points FOR SELECT USING (is_active = true);
CREATE TRIGGER update_qr_capture_points_updated_at BEFORE UPDATE ON public.qr_capture_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default capture points
INSERT INTO public.qr_capture_points (name, tag, description, location) VALUES
  ('Bomba 1', 'bomba1', 'Ilha principal - Bomba 1', 'Ilha 1'),
  ('Bomba 2', 'bomba2', 'Ilha principal - Bomba 2', 'Ilha 1'),
  ('Caixa', 'caixa', 'Caixa da conveniência', 'Loja')
ON CONFLICT (tag) DO NOTHING;

-- ============================================
-- FUNCTION: abater_com_frentista
-- ============================================
CREATE OR REPLACE FUNCTION public.abater_com_frentista(
  p_frentista_nome TEXT,
  p_premio_id UUID,
  p_valor NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_premio RECORD;
  v_valor_anterior NUMERIC;
  v_valor_apos NUMERIC;
  v_novo_status TEXT;
BEGIN
  -- Buscar prêmio
  SELECT * INTO v_premio FROM premios_qr WHERE id = p_premio_id;
  
  IF v_premio IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio não encontrado');
  END IF;
  
  IF v_premio.status != 'ativo' THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio não está ativo');
  END IF;
  
  IF v_premio.data_expiracao < now() THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio expirado');
  END IF;
  
  IF p_valor <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;
  
  IF p_valor > v_premio.valor_restante THEN
    RETURN json_build_object('success', false, 'error', 'Valor excede o saldo disponível');
  END IF;
  
  -- Calcular novos valores
  v_valor_anterior := v_premio.valor_restante;
  v_valor_apos := v_premio.valor_restante - p_valor;
  v_novo_status := CASE WHEN v_valor_apos <= 0 THEN 'zerado' ELSE 'ativo' END;
  
  -- Registrar consumo
  INSERT INTO premios_qr_consumos (premio_id, valor_abatido, valor_anterior, valor_apos, consumido_por, observacao)
  VALUES (p_premio_id, p_valor, v_valor_anterior, v_valor_apos, NULL, COALESCE(p_observacao, '') || ' [Frentista: ' || p_frentista_nome || ']');
  
  -- Atualizar prêmio
  UPDATE premios_qr SET valor_restante = v_valor_apos, status = v_novo_status, updated_at = now() WHERE id = p_premio_id;
  
  RETURN json_build_object('success', true, 'frentista', p_frentista_nome, 'valor_abatido', p_valor, 'novo_saldo', v_valor_apos, 'novo_status', v_novo_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.abater_com_frentista TO anon, authenticated;