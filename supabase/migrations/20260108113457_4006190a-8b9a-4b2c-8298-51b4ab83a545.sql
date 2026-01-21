-- Create premios_qr table with CPF field
CREATE TABLE public.premios_qr (
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

-- Create premios_qr_consumos table for consumption history
CREATE TABLE public.premios_qr_consumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  premio_id UUID NOT NULL REFERENCES public.premios_qr(id) ON DELETE CASCADE,
  valor_abatido NUMERIC NOT NULL,
  valor_anterior NUMERIC NOT NULL,
  valor_apos NUMERIC NOT NULL,
  consumido_por UUID NULL,
  consumido_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observacao TEXT NULL
);

-- Enable RLS on both tables
ALTER TABLE public.premios_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios_qr_consumos ENABLE ROW LEVEL SECURITY;

-- RLS policies for premios_qr
CREATE POLICY "Staff can manage premios_qr" 
ON public.premios_qr 
FOR ALL 
USING (is_staff())
WITH CHECK (is_staff());

CREATE POLICY "Public can read premios_qr by codigo" 
ON public.premios_qr 
FOR SELECT 
USING (true);

-- RLS policies for premios_qr_consumos
CREATE POLICY "Staff can manage consumos" 
ON public.premios_qr_consumos 
FOR ALL 
USING (is_staff())
WITH CHECK (is_staff());

CREATE POLICY "Public can read consumos" 
ON public.premios_qr_consumos 
FOR SELECT 
USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_premios_qr_updated_at
BEFORE UPDATE ON public.premios_qr
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_premios_qr_codigo ON public.premios_qr(codigo);
CREATE INDEX idx_premios_qr_status ON public.premios_qr(status);
CREATE INDEX idx_premios_qr_telefone ON public.premios_qr(telefone);
CREATE INDEX idx_premios_qr_cpf ON public.premios_qr(cpf);
CREATE INDEX idx_premios_qr_consumos_premio ON public.premios_qr_consumos(premio_id);