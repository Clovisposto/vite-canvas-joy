-- Add alert phone settings to the settings table
INSERT INTO public.settings (key, value, description)
VALUES 
  ('alert_phone', '""', 'Número de telefone para receber alertas do sistema'),
  ('alert_threshold', '20', 'Taxa de falha (%) que dispara alertas'),
  ('alert_cooldown', '5', 'Tempo mínimo (minutos) entre alertas')
ON CONFLICT (key) DO NOTHING;