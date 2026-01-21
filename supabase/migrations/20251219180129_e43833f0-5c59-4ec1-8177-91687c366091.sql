-- 1. Make name nullable
ALTER TABLE public.customers ALTER COLUMN name DROP NOT NULL;

-- 2. Drop existing policies on customers
DROP POLICY IF EXISTS "Public can create customers" ON public.customers;
DROP POLICY IF EXISTS "Public can update own customer by phone" ON public.customers;
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;
DROP POLICY IF EXISTS "Public update customers" ON public.customers;

-- 3. Create new open policies for customers
CREATE POLICY "Public insert customers"
ON public.customers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public update customers"
ON public.customers FOR UPDATE
USING (true) WITH CHECK (true);

-- 4. Drop existing policies on checkins
DROP POLICY IF EXISTS "Public can create checkins" ON public.checkins;
DROP POLICY IF EXISTS "Public insert checkins" ON public.checkins;

-- 5. Create new open policy for checkins
CREATE POLICY "Public insert checkins"
ON public.checkins FOR INSERT
WITH CHECK (true);