-- Fix wa_templates policy to restrict to admin only
DROP POLICY IF EXISTS "Admin access wa_templates" ON public.wa_templates;

CREATE POLICY "Admin can manage wa_templates" 
ON public.wa_templates 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());