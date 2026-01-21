-- ============================================
-- SECURITY FIX: Restrict messages_queue to admin only
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage messages_queue" ON public.messages_queue;

-- Create admin-only policies
CREATE POLICY "Admin can read messages_queue" 
ON public.messages_queue 
FOR SELECT 
TO authenticated
USING (is_admin());

CREATE POLICY "Admin can insert messages_queue" 
ON public.messages_queue 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admin can update messages_queue" 
ON public.messages_queue 
FOR UPDATE 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admin can delete messages_queue" 
ON public.messages_queue 
FOR DELETE 
TO authenticated
USING (is_admin());