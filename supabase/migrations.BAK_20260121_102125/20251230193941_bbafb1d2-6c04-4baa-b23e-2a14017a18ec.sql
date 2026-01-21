-- ============================================
-- SECURITY FIX: Create role-checking function and restrict sensitive tables to admin only
-- ============================================

-- 1. Create helper function to check if user is admin (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
$$;

-- 2. Create helper function to check if user is admin or operador
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'operador')
  )
$$;

-- ===== FIX: customers table - restrict to staff only =====
DROP POLICY IF EXISTS "Authenticated users can read all customers" ON public.customers;
CREATE POLICY "Staff can read all customers"
ON public.customers FOR SELECT TO authenticated
USING (public.is_staff());

-- ===== FIX: checkins table - restrict to staff only =====
DROP POLICY IF EXISTS "Authenticated users can read all checkins" ON public.checkins;
CREATE POLICY "Staff can read all checkins"
ON public.checkins FOR SELECT TO authenticated
USING (public.is_staff());

-- ===== FIX: complaints table - restrict to staff only =====
DROP POLICY IF EXISTS "Authenticated users can manage complaints" ON public.complaints;
CREATE POLICY "Staff can manage complaints"
ON public.complaints FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ===== FIX: profiles table - users can read own, admin can read all =====
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;
CREATE POLICY "Users can read own or admin can read all"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

-- ===== FIX: livro_caixa table - restrict to admin only =====
DROP POLICY IF EXISTS "Authenticated users can view livro_caixa" ON public.livro_caixa;
DROP POLICY IF EXISTS "Authenticated users can insert livro_caixa" ON public.livro_caixa;
DROP POLICY IF EXISTS "Authenticated users can update livro_caixa" ON public.livro_caixa;
DROP POLICY IF EXISTS "Authenticated users can delete livro_caixa" ON public.livro_caixa;
CREATE POLICY "Admin can manage livro_caixa"
ON public.livro_caixa FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ===== FIX: stone_tef_logs table - restrict to admin only =====
DROP POLICY IF EXISTS "Admin access stone_tef_logs" ON public.stone_tef_logs;
CREATE POLICY "Admin only access stone_tef_logs"
ON public.stone_tef_logs FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ===== FIX: whatsapp_settings table - restrict to admin only =====
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Admin can manage whatsapp_settings"
ON public.whatsapp_settings FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ===== FIX: wa_contacts table - restrict to staff only =====
DROP POLICY IF EXISTS "Admin access wa_contacts" ON public.wa_contacts;
CREATE POLICY "Staff can manage wa_contacts"
ON public.wa_contacts FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ===== FIX: wa_messages table - restrict to staff only =====
DROP POLICY IF EXISTS "Admin access wa_messages" ON public.wa_messages;
CREATE POLICY "Staff can manage wa_messages"
ON public.wa_messages FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ===== FIX: audit_logs table - restrict to admin only =====
DROP POLICY IF EXISTS "Authenticated users can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Admin can read audit_logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_admin());
CREATE POLICY "System can insert audit_logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);