-- Add terminal_id column to qr_capture_points for Stone terminal mapping
ALTER TABLE public.qr_capture_points 
ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(100) DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.qr_capture_points.terminal_id IS 'Número de série do terminal Stone associado a este ponto de captura';