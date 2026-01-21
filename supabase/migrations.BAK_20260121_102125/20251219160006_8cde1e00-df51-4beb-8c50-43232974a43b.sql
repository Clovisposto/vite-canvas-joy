
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Settings table (global configurations)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table for admin users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'operador', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Checkins table
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  attendant_code TEXT,
  payment_method TEXT,
  amount DECIMAL(10,2),
  liters DECIMAL(10,2),
  tag TEXT,
  origin TEXT DEFAULT 'pwa',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotions table
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('desconto', 'brinde', 'informativa')) DEFAULT 'informativa',
  discount_value DECIMAL(10,2),
  eligible_payments TEXT[] DEFAULT ARRAY['pix', 'dinheiro', 'debito'],
  is_active BOOLEAN DEFAULT FALSE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raffles configuration table
CREATE TABLE public.raffles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Raffle runs (execution history)
CREATE TABLE public.raffle_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID REFERENCES public.raffles(id) ON DELETE SET NULL,
  eligible_count INTEGER DEFAULT 0,
  seed TEXT,
  winners JSONB DEFAULT '[]',
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id),
  is_test BOOLEAN DEFAULT FALSE
);

-- Messages queue for promotions
CREATE TABLE public.messages_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaints/suggestions table
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'em_tratamento', 'resolvido')),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Imports logs
CREATE TABLE public.imports_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_checkins_phone ON public.checkins(phone);
CREATE INDEX idx_checkins_created_at ON public.checkins(created_at);
CREATE INDEX idx_checkins_customer_id ON public.checkins(customer_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_messages_queue_status ON public.messages_queue(status);
CREATE INDEX idx_raffle_runs_executed_at ON public.raffle_runs(executed_at);

-- Enable RLS on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read policies for PWA (unauthenticated access)
CREATE POLICY "Public can read active promotions" ON public.promotions FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active raffles" ON public.raffles FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT USING (true);

-- Public insert policies for PWA
CREATE POLICY "Public can create customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update own customer by phone" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Public can create checkins" ON public.checkins FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can create complaints" ON public.complaints FOR INSERT WITH CHECK (true);

-- Authenticated user policies (admin panel)
CREATE POLICY "Authenticated users can read all customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read all checkins" ON public.checkins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage promotions" ON public.promotions FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage raffles" ON public.raffles FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can read raffle_runs" ON public.raffle_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert raffle_runs" ON public.raffle_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can manage messages_queue" ON public.messages_queue FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage complaints" ON public.complaints FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage imports_logs" ON public.imports_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can manage settings" ON public.settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Authenticated can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

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
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_raffles_updated_at BEFORE UPDATE ON public.raffles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('posto_name', '"Posto 7"', 'Nome do posto'),
  ('whatsapp_number', '"5511999999999"', 'Número WhatsApp do posto'),
  ('raffle_rules', '"Sorteio válido para clientes cadastrados. Ganhadores serão contatados via WhatsApp."', 'Regras do sorteio'),
  ('lgpd_text', '"Ao prosseguir, você concorda com o tratamento dos seus dados conforme a LGPD para fins de comunicação e participação em promoções."', 'Texto LGPD'),
  ('shift_change_hour', '18', 'Hora de troca de turno'),
  ('csv_time_window_minutes', '60', 'Janela de tempo para match de importação CSV (minutos)');

-- Insert default raffle configuration
INSERT INTO public.raffles (name, winners_count, prize_value, schedule_days, schedule_times, rules, is_active)
VALUES ('Sorteio Semanal', 3, 100.00, ARRAY[6], ARRAY['08:00'::TIME, '15:00'::TIME], 'Sorteio realizado todo sábado às 08:00 e 15:00. Participam todos os clientes cadastrados que optaram por participar.', true);
