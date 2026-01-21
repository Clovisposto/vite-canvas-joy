-- ============================================
-- FIX: customers table - Remove public read access
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with proper restrictions
DROP POLICY IF EXISTS "Anon insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can read all customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can delete customers" ON public.customers;

-- Create proper policies: Staff-only read access
CREATE POLICY "Staff can read customers"
ON public.customers
FOR SELECT
TO authenticated
USING (is_staff());

-- Allow anonymous INSERT for PWA registration (required for customer flow)
CREATE POLICY "Anon can insert customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (true);

-- Staff can update customers
CREATE POLICY "Staff can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (is_staff())
WITH CHECK (is_staff());

-- Staff can delete customers
CREATE POLICY "Staff can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (is_staff());

-- ============================================
-- FIX: checkins table - Remove public read access
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too
ALTER TABLE public.checkins FORCE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with proper restrictions
DROP POLICY IF EXISTS "Anyone can insert checkins" ON public.checkins;
DROP POLICY IF EXISTS "Anon can insert checkins" ON public.checkins;
DROP POLICY IF EXISTS "Staff can read all checkins" ON public.checkins;
DROP POLICY IF EXISTS "Staff can update checkins" ON public.checkins;
DROP POLICY IF EXISTS "Staff can delete checkins" ON public.checkins;

-- Create proper policies: Staff-only read access
CREATE POLICY "Staff can read checkins"
ON public.checkins
FOR SELECT
TO authenticated
USING (is_staff());

-- Allow anonymous INSERT for PWA checkin flow
CREATE POLICY "Anon can insert checkins"
ON public.checkins
FOR INSERT
TO anon
WITH CHECK (true);

-- Staff can update checkins
CREATE POLICY "Staff can update checkins"
ON public.checkins
FOR UPDATE
TO authenticated
USING (is_staff())
WITH CHECK (is_staff());

-- Staff can delete checkins
CREATE POLICY "Staff can delete checkins"
ON public.checkins
FOR DELETE
TO authenticated
USING (is_staff());