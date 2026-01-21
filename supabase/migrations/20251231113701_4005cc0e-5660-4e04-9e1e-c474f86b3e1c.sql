-- ============================================
-- HARDENING: Adicionar índices e políticas faltantes
-- ============================================

-- 1. Índice em whatsapp_logs para queries por data (muito usado em dashboards)
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at 
ON public.whatsapp_logs USING btree (created_at DESC);

-- 2. Índice em whatsapp_logs por status para filtros comuns
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status 
ON public.whatsapp_logs USING btree (status);

-- 3. Remover política duplicada da profiles (conflito de nomes)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- 4. Adicionar política DELETE para dispatch_history (apenas admin)
CREATE POLICY "Admin can delete dispatch_history"
ON public.dispatch_history
FOR DELETE
TO authenticated
USING (is_admin());

-- 5. Garantir que audit_logs não pode ser atualizado ou deletado
CREATE POLICY "No one can update audit_logs"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No one can delete audit_logs"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (false);

-- 6. Adicionar constraint UNIQUE para evitar duplicatas de telefone normalizado
-- (já existe customers_phone_key, verificar)

-- 7. Garantir NOT NULL em campos críticos onde faz sentido
ALTER TABLE public.checkins 
ALTER COLUMN phone SET NOT NULL;

ALTER TABLE public.customers 
ALTER COLUMN phone SET NOT NULL;