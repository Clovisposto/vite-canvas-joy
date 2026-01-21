-- Habilitar REPLICA IDENTITY FULL para capturar dados completos em tempo real
ALTER TABLE public.stone_tef_logs REPLICA IDENTITY FULL;

-- Adicionar tabela ao realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stone_tef_logs;