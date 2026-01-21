-- =============================================
-- CORREÇÃO: Remover acesso público à tabela settings
-- =============================================

-- Remover policy que permite leitura pública
DROP POLICY IF EXISTS "Public can read settings" ON public.settings;

-- Criar policy que permite leitura apenas para staff/admin autenticados
CREATE POLICY "Staff can read settings" 
ON public.settings 
FOR SELECT 
USING (is_staff());