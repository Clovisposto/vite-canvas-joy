-- Atualizar role para admin quando o usuário for criado
-- Esta query será executada após o usuário ser criado no dashboard

UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'clovisteodoro349@gmail.com';

-- Se o usuário ainda não existir, criar um trigger para configurar como admin automaticamente
CREATE OR REPLACE FUNCTION public.set_admin_for_specific_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'clovisteodoro349@gmail.com' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS set_admin_email_trigger ON public.profiles;

-- Criar trigger para novos usuários
CREATE TRIGGER set_admin_email_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_admin_for_specific_email();