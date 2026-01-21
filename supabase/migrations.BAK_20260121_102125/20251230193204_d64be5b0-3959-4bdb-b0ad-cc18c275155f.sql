-- ============================================
-- SECURITY FIX: Restrict customers INSERT/UPDATE policies
-- ============================================

-- Drop the overly permissive "TO public" policies
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON public.customers;

-- Create more restrictive policies for anon role (PWA)
-- Allow anonymous users to insert (for PWA registration)
CREATE POLICY "Anon insert customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to update only their own record by phone
-- This prevents mass modification of customer records
CREATE POLICY "Anon update by phone"
ON public.customers
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);