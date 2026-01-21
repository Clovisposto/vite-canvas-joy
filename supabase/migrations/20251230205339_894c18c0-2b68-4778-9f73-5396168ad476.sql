-- ============================================
-- SECURITY FIX: Ensure RLS policies are correctly restrictive
-- Goal: Block public SELECT on sensitive tables, keep INSERT public
-- ============================================

-- STEP 1: Drop any potentially overly permissive policies on customers
DROP POLICY IF EXISTS "Public read customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can read customers" ON public.customers;
DROP POLICY IF EXISTS "Public select customers" ON public.customers;

-- STEP 2: Drop any potentially overly permissive policies on checkins  
DROP POLICY IF EXISTS "Public read checkins" ON public.checkins;
DROP POLICY IF EXISTS "Anon can read checkins" ON public.checkins;
DROP POLICY IF EXISTS "Public select checkins" ON public.checkins;

-- STEP 3: Ensure staff-only SELECT policies exist (recreate to be safe)
DROP POLICY IF EXISTS "Staff can read all customers" ON public.customers;
CREATE POLICY "Staff can read all customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (is_staff());

DROP POLICY IF EXISTS "Staff can read all checkins" ON public.checkins;
CREATE POLICY "Staff can read all checkins" 
ON public.checkins 
FOR SELECT 
TO authenticated
USING (is_staff());

-- STEP 4: Make dispatch_history immutable (audit trail protection)
-- Remove any UPDATE/DELETE permissions for everyone
DROP POLICY IF EXISTS "Staff can update dispatch_history" ON public.dispatch_history;
DROP POLICY IF EXISTS "Staff can delete dispatch_history" ON public.dispatch_history;
DROP POLICY IF EXISTS "Admin can delete dispatch_history" ON public.dispatch_history;

-- Recreate staff policy for SELECT and INSERT only (no UPDATE/DELETE)
DROP POLICY IF EXISTS "Staff can manage dispatch_history" ON public.dispatch_history;
CREATE POLICY "Staff can read dispatch_history" 
ON public.dispatch_history 
FOR SELECT 
TO authenticated
USING (is_staff());

CREATE POLICY "Staff can insert dispatch_history" 
ON public.dispatch_history 
FOR INSERT 
TO authenticated
WITH CHECK (is_staff());

-- Admin-only can UPDATE (for status corrections only)
CREATE POLICY "Admin can update dispatch_history" 
ON public.dispatch_history 
FOR UPDATE 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- STEP 5: Ensure complaints SELECT is staff-only
DROP POLICY IF EXISTS "Public can read complaints" ON public.complaints;
DROP POLICY IF EXISTS "Anon can read complaints" ON public.complaints;