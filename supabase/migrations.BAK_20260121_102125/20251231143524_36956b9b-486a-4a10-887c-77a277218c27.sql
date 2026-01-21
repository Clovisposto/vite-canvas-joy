-- Adicionar campos de rastreabilidade LGPD na tabela customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS consent_text_version VARCHAR(50) DEFAULT 'lgpd-v1-2025-12-31',
ADD COLUMN IF NOT EXISTS consent_source VARCHAR(50) DEFAULT 'checkbox',
ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMP WITH TIME ZONE;

-- Atualizar registros antigos com valores padrão
UPDATE public.customers 
SET 
  consent_text_version = COALESCE(consent_text_version, 'legacy'),
  consent_source = COALESCE(consent_source, 'unknown')
WHERE consent_text_version IS NULL OR consent_source IS NULL;

-- Adicionar constraint para garantir que novos registros tenham lgpd_consent = true
-- Usando trigger para validação (mais flexível que CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_lgpd_consent()
RETURNS TRIGGER AS $$
BEGIN
  -- Para novos registros, LGPD consent deve ser true
  IF TG_OP = 'INSERT' AND (NEW.lgpd_consent IS NULL OR NEW.lgpd_consent = false) THEN
    RAISE EXCEPTION 'O consentimento LGPD é obrigatório para cadastro';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para validar LGPD em novos cadastros
DROP TRIGGER IF EXISTS validate_customer_lgpd ON public.customers;
CREATE TRIGGER validate_customer_lgpd
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.validate_lgpd_consent();