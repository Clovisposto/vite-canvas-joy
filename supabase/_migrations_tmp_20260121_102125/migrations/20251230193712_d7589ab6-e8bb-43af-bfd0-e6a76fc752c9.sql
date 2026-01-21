-- ============================================
-- SECURITY FIX: Remove public SELECT from checkins and whatsapp_logs
-- ============================================

-- 1. Remove public SELECT from checkins table (contains phone numbers)
DROP POLICY IF EXISTS "Public select checkins" ON public.checkins;

-- 2. Remove public SELECT from whatsapp_logs table (contains phone numbers and messages)
DROP POLICY IF EXISTS "whatsapp_logs_select" ON public.whatsapp_logs;

-- 3. Create authenticated-only SELECT policy for whatsapp_logs
CREATE POLICY "Authenticated users can read whatsapp_logs"
ON public.whatsapp_logs
FOR SELECT
TO authenticated
USING (true);