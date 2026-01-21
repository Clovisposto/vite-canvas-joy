-- Criar tabela para jobs de envio em massa via WhatsApp
CREATE TABLE public.bulk_send_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'cancelled', 'error')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settings JSONB NOT NULL DEFAULT '{"mode": "seguro", "delay_min": 40, "delay_max": 90, "max_per_hour": 30}'::jsonb,
  contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT
);

-- Índices para performance
CREATE INDEX idx_bulk_send_jobs_status ON public.bulk_send_jobs(status);
CREATE INDEX idx_bulk_send_jobs_created_at ON public.bulk_send_jobs(created_at DESC);
CREATE INDEX idx_bulk_send_jobs_created_by ON public.bulk_send_jobs(created_by);

-- Habilitar RLS
ALTER TABLE public.bulk_send_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas staff pode ver e gerenciar jobs
CREATE POLICY "Staff pode ver todos os jobs" 
  ON public.bulk_send_jobs FOR SELECT 
  USING (public.is_staff());

CREATE POLICY "Staff pode criar jobs" 
  ON public.bulk_send_jobs FOR INSERT 
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff pode atualizar jobs" 
  ON public.bulk_send_jobs FOR UPDATE 
  USING (public.is_staff());

CREATE POLICY "Admin pode deletar jobs" 
  ON public.bulk_send_jobs FOR DELETE 
  USING (public.is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_bulk_send_jobs_updated_at
  BEFORE UPDATE ON public.bulk_send_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_send_jobs;