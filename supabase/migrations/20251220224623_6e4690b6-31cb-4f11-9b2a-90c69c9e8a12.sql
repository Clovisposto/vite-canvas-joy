-- Create table for mass dispatch history
CREATE TABLE public.dispatch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  promotion_title TEXT NOT NULL,
  message TEXT NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  dispatched_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can manage dispatch_history" 
ON public.dispatch_history 
FOR ALL 
USING (true);

CREATE POLICY "Public can read dispatch_history" 
ON public.dispatch_history 
FOR SELECT 
USING (true);