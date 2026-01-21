-- ============================================
-- FIX: Allow anonymous users to register via PWA
-- The customer app is public-facing and must allow unauthenticated users
-- ============================================

-- ===== FIX: customers table - allow anon INSERT for PWA registration =====
DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
CREATE POLICY "Anon can insert customers"
ON public.customers FOR INSERT TO anon
WITH CHECK (true);

-- ===== FIX: checkins table - allow anon INSERT for PWA registration =====
DROP POLICY IF EXISTS "Anon can insert checkins" ON public.checkins;
CREATE POLICY "Anon can insert checkins"
ON public.checkins FOR INSERT TO anon
WITH CHECK (true);