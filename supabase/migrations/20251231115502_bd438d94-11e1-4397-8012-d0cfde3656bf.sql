-- =============================================
-- CORREÇÃO CIRÚRGICA: Restringir acesso a dados sensíveis
-- Tabelas: customers e checkins
-- Objetivo: Bloquear leitura ampla, permitir apenas admin
-- =============================================

-- TABELA: customers (clientes)
-- Problema: Staff pode ler todos os dados sensíveis (telefone, LGPD)
-- Solução: Restringir SELECT/UPDATE/DELETE apenas para admin

DROP POLICY IF EXISTS "Staff can read customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can delete customers" ON public.customers;

-- Apenas admin pode ler dados de clientes (dados sensíveis)
CREATE POLICY "Admin can read customers" 
ON public.customers 
FOR SELECT 
USING (is_admin());

-- Apenas admin pode atualizar dados de clientes
CREATE POLICY "Admin can update customers" 
ON public.customers 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

-- Apenas admin pode deletar clientes
CREATE POLICY "Admin can delete customers" 
ON public.customers 
FOR DELETE 
USING (is_admin());

-- TABELA: checkins
-- Problema: Staff pode ler todos os check-ins (telefone, valores, métodos)
-- Solução: Restringir SELECT/UPDATE/DELETE apenas para admin

DROP POLICY IF EXISTS "Staff can read checkins" ON public.checkins;
DROP POLICY IF EXISTS "Staff can update checkins" ON public.checkins;
DROP POLICY IF EXISTS "Staff can delete checkins" ON public.checkins;

-- Apenas admin pode ler check-ins (dados sensíveis)
CREATE POLICY "Admin can read checkins" 
ON public.checkins 
FOR SELECT 
USING (is_admin());

-- Apenas admin pode atualizar check-ins
CREATE POLICY "Admin can update checkins" 
ON public.checkins 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

-- Apenas admin pode deletar check-ins
CREATE POLICY "Admin can delete checkins" 
ON public.checkins 
FOR DELETE 
USING (is_admin());

-- Manter INSERT para anon (captura via QR) - JÁ EXISTE, NÃO ALTERAR:
-- "Anon can insert customers" e "Anon can insert checkins"