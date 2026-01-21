-- ============================================
-- SECURITY FIX: Remove overly permissive anonymous UPDATE on customers
-- Anonymous users should only INSERT new customers, not update existing ones
-- ============================================

-- Remove all anonymous UPDATE policies
DROP POLICY IF EXISTS "Anon update by phone" ON public.customers;
DROP POLICY IF EXISTS "Anon can update customers" ON public.customers;

-- Keep only the INSERT policy for anonymous (needed for PWA registration)
-- The "Anon can insert customers" policy already exists and is correct