-- ============================================
-- FIX: Allow anonymous UPSERT (INSERT + UPDATE) for PWA
-- The upsert operation requires both INSERT and UPDATE permissions
-- ============================================

-- ===== customers: allow anon UPDATE for upsert to work =====
DROP POLICY IF EXISTS "Anon can update customers" ON public.customers;
CREATE POLICY "Anon can update customers"
ON public.customers FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- ===== checkins: ensure anon INSERT policy exists =====
DROP POLICY IF EXISTS "Anon can insert checkins" ON public.checkins;
CREATE POLICY "Anon can insert checkins"
ON public.checkins FOR INSERT TO anon
WITH CHECK (true);