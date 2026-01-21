-- Criar função RPC pública para consulta de prêmio
CREATE OR REPLACE FUNCTION public.get_premio_publico(p_codigo text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_premio RECORD;
  v_nome_mascarado TEXT;
BEGIN
  -- Buscar prêmio pelo código
  SELECT * INTO v_premio
  FROM premios_qr
  WHERE codigo = p_codigo;
  
  IF v_premio IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio não encontrado');
  END IF;
  
  -- Mascarar nome (mostrar só primeira e última palavra parcialmente)
  v_nome_mascarado := CONCAT(
    LEFT(SPLIT_PART(v_premio.nome_ganhador, ' ', 1), 2),
    '***',
    CASE 
      WHEN ARRAY_LENGTH(STRING_TO_ARRAY(v_premio.nome_ganhador, ' '), 1) > 1 
      THEN ' ' || LEFT(SPLIT_PART(v_premio.nome_ganhador, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(v_premio.nome_ganhador, ' '), 1)), 1) || '***'
      ELSE ''
    END
  );
  
  RETURN json_build_object(
    'success', true,
    'nome_mascarado', v_nome_mascarado,
    'valor_original', v_premio.valor_original,
    'valor_restante', v_premio.valor_restante,
    'status', v_premio.status,
    'data_expiracao', v_premio.data_expiracao,
    'expirado', v_premio.data_expiracao < now()
  );
END;
$$;

-- Permitir execução pública (anon)
GRANT EXECUTE ON FUNCTION public.get_premio_publico(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_premio_publico(text) TO authenticated;