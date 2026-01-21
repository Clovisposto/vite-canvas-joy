-- Drop existing insert policy for anon role and create a more permissive one
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;
DROP POLICY IF EXISTS "Public update customers" ON public.customers;

-- Create policy that allows inserts from both anon and public roles
CREATE POLICY "Anyone can insert customers"
ON public.customers
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy that allows updates from both anon and public roles
CREATE POLICY "Anyone can update customers"
ON public.customers
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Do the same for checkins
DROP POLICY IF EXISTS "Public insert checkins" ON public.checkins;

CREATE POLICY "Anyone can insert checkins"
ON public.checkins
FOR INSERT
TO public
WITH CHECK (true);