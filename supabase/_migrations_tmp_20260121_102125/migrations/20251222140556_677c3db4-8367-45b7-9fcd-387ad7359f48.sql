-- Tabela para configurar pontos de captura via QR Code
CREATE TABLE public.qr_capture_points (
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

-- Enable RLS
ALTER TABLE public.qr_capture_points ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage qr_capture_points"
ON public.qr_capture_points
FOR ALL
USING (true);

CREATE POLICY "Public can read active qr_capture_points"
ON public.qr_capture_points
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_qr_capture_points_updated_at
BEFORE UPDATE ON public.qr_capture_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default capture points
INSERT INTO public.qr_capture_points (name, tag, description, location) VALUES
  ('Bomba 1', 'bomba1', 'Ilha principal - Bomba 1', 'Ilha 1'),
  ('Bomba 2', 'bomba2', 'Ilha principal - Bomba 2', 'Ilha 1'),
  ('Bomba 3', 'bomba3', 'Ilha secundária - Bomba 3', 'Ilha 2'),
  ('Bomba 4', 'bomba4', 'Ilha secundária - Bomba 4', 'Ilha 2'),
  ('Caixa', 'caixa', 'Caixa da conveniência', 'Loja'),
  ('Conveniência', 'loja', 'Balcão da loja', 'Loja');