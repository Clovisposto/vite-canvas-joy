-- ============================================
-- BULK SEND JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.bulk_send_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'cancelled', 'error')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settings JSONB NOT NULL DEFAULT '{}',
  contacts JSONB NOT NULL DEFAULT '[]',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.bulk_send_jobs ENABLE ROW LEVEL SECURITY;

-- Admin/Staff only policies
CREATE POLICY "Staff can manage bulk_send_jobs" 
ON public.bulk_send_jobs 
FOR ALL 
TO authenticated
USING (is_staff())
WITH CHECK (is_staff());

-- Trigger for updated_at
CREATE TRIGGER update_bulk_send_jobs_updated_at
BEFORE UPDATE ON public.bulk_send_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_bulk_send_jobs_status ON public.bulk_send_jobs(status);
CREATE INDEX idx_bulk_send_jobs_created_at ON public.bulk_send_jobs(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_send_jobs;