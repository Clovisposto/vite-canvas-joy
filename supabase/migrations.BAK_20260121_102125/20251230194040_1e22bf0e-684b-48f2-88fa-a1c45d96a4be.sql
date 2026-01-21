-- ============================================
-- SECURITY FIX: Fix remaining public access issues
-- ============================================

-- ===== FIX: ai_whatsapp_logs table - restrict to staff only =====
DROP POLICY IF EXISTS "Public can insert ai_whatsapp_logs" ON public.ai_whatsapp_logs;
DROP POLICY IF EXISTS "Authenticated users can manage ai_whatsapp_logs" ON public.ai_whatsapp_logs;
CREATE POLICY "Staff can manage ai_whatsapp_logs"
ON public.ai_whatsapp_logs FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());
-- Keep insert for anon (logging purposes from PWA)
CREATE POLICY "Anon can insert ai_whatsapp_logs"
ON public.ai_whatsapp_logs FOR INSERT TO anon
WITH CHECK (true);

-- ===== FIX: wa_audit table - restrict to admin only =====
DROP POLICY IF EXISTS "Admin access wa_audit" ON public.wa_audit;
CREATE POLICY "Admin can manage wa_audit"
ON public.wa_audit FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ===== FIX: dispatch_history table - restrict to staff only =====
DROP POLICY IF EXISTS "Authenticated users can manage dispatch_history" ON public.dispatch_history;
DROP POLICY IF EXISTS "Public can read dispatch_history" ON public.dispatch_history;
CREATE POLICY "Staff can manage dispatch_history"
ON public.dispatch_history FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());