-- Fix function search path for security
CREATE OR REPLACE FUNCTION public.set_whatsapp_updated_at()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;