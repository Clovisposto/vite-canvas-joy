-- 1) Garantir permissões (RLS não substitui GRANT)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.checkins TO anon, authenticated;
GRANT SELECT, INSERT ON public.complaints TO anon, authenticated;

-- 2) Recriar policies públicas (customers)
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;
DROP POLICY IF EXISTS "Public update customers" ON public.customers;

CREATE POLICY "Public insert customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Public update customers"
ON public.customers
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- 3) Recriar policy pública (checkins)
DROP POLICY IF EXISTS "Public insert checkins" ON public.checkins;

CREATE POLICY "Public insert checkins"
ON public.checkins
FOR INSERT
TO anon
WITH CHECK (true);

-- 4) Evitar quebra por customer_id (FK) no fluxo público: permitir NULL
ALTER TABLE public.checkins ALTER COLUMN customer_id DROP NOT NULL;