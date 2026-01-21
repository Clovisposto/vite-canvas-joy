-- Stone TEF Logs table
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

-- Add TEF reference to checkins
ALTER TABLE public.checkins 
ADD COLUMN IF NOT EXISTS stone_tef_id UUID REFERENCES public.stone_tef_logs(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stone_tef_logs_checkin ON public.stone_tef_logs(checkin_id);
CREATE INDEX IF NOT EXISTS idx_stone_tef_logs_nsu ON public.stone_tef_logs(nsu);
CREATE INDEX IF NOT EXISTS idx_stone_tef_logs_horario ON public.stone_tef_logs(horario DESC);
CREATE INDEX IF NOT EXISTS idx_stone_tef_logs_frentista ON public.stone_tef_logs(frentista_id);

-- Enable RLS
ALTER TABLE public.stone_tef_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin access stone_tef_logs" ON public.stone_tef_logs FOR ALL USING (true);
CREATE POLICY "Public insert stone_tef_logs" ON public.stone_tef_logs FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_stone_tef_logs_updated_at 
BEFORE UPDATE ON public.stone_tef_logs 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();