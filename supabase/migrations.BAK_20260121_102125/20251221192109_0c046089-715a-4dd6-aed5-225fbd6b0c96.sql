-- Enable realtime for complaints table to listen for new ratings
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;