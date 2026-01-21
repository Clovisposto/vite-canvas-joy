-- ============================================
-- SECURITY FIX: Multiple RLS and Function Issues
-- ============================================

-- 1. FIX: Remove public SELECT access to customers (keeps authenticated access)
DROP POLICY IF EXISTS "Public select customers" ON public.customers;

-- 2. FIX: Restrict whatsapp_settings to authenticated users only
DROP POLICY IF EXISTS "whatsapp_settings_select" ON public.whatsapp_settings;
DROP POLICY IF EXISTS "whatsapp_settings_insert" ON public.whatsapp_settings;
DROP POLICY IF EXISTS "whatsapp_settings_update" ON public.whatsapp_settings;

CREATE POLICY "Authenticated users can manage whatsapp_settings"
ON public.whatsapp_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. FIX: Update handle_new_user to NOT accept user-controlled role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'viewer'  -- Always default to viewer, admin must promote manually
  );
  RETURN NEW;
END;
$$;