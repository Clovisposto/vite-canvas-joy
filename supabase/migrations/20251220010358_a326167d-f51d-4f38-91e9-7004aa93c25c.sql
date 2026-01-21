-- Adicionar SELECT para anon (necessário para UPSERT verificar se registro existe)
DROP POLICY IF EXISTS "Public select customers" ON public.customers;
CREATE POLICY "Public select customers"
ON public.customers
FOR SELECT
TO anon
USING (true);

-- Adicionar SELECT para anon em checkins também
DROP POLICY IF EXISTS "Public select checkins" ON public.checkins;
CREATE POLICY "Public select checkins"
ON public.checkins
FOR SELECT
TO anon
USING (true);

-- Garantir grants novamente
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.checkins TO anon, authenticated;