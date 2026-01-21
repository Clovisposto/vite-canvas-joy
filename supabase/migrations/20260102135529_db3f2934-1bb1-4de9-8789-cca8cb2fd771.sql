-- Drop old INSERT policies
DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can insert checkins" ON public.checkins;

-- Create new INSERT policies allowing both anon and authenticated
CREATE POLICY "Anyone can register as customer"
ON public.customers
FOR INSERT
TO anon, authenticated
WITH CHECK (lgpd_consent = true);

CREATE POLICY "Anyone can create checkin"
ON public.checkins
FOR INSERT
TO anon, authenticated
WITH CHECK (true);