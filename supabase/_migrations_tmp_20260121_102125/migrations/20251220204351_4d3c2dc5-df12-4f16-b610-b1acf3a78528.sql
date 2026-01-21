-- Create table for frentista goals
CREATE TABLE public.frentista_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frentista_id UUID NOT NULL REFERENCES public.frentistas(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly'
  target_checkins INTEGER NOT NULL DEFAULT 50,
  target_amount NUMERIC DEFAULT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.frentista_metas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can manage frentista_metas"
ON public.frentista_metas
FOR ALL
USING (true);

CREATE POLICY "Public can read active metas"
ON public.frentista_metas
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_frentista_metas_updated_at
BEFORE UPDATE ON public.frentista_metas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();