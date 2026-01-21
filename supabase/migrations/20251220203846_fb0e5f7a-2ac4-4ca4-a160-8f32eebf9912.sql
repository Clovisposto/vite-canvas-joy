-- Create frentistas table for employee tracking
CREATE TABLE public.frentistas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.frentistas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can read active frentistas"
ON public.frentistas
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can manage frentistas"
ON public.frentistas
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_frentistas_updated_at
BEFORE UPDATE ON public.frentistas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample frentistas
INSERT INTO public.frentistas (codigo, nome) VALUES
('001', 'Frentista 1'),
('002', 'Frentista 2'),
('003', 'Frentista 3')
ON CONFLICT (codigo) DO NOTHING;