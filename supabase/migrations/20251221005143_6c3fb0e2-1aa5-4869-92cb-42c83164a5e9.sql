-- Enable realtime for whatsapp_logs table
ALTER TABLE public.whatsapp_logs REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_logs;