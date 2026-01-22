-- Permitir que staff/admin também possa inserir clientes
CREATE POLICY "Staff can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (is_staff());