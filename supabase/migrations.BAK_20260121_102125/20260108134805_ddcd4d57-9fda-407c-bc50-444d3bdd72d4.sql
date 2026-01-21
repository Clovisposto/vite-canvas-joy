CREATE OR REPLACE FUNCTION public.abater_com_frentista(
  p_frentista_nome TEXT,
  p_premio_id UUID,
  p_valor NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_premio RECORD;
  v_valor_anterior NUMERIC;
  v_valor_apos NUMERIC;
  v_novo_status TEXT;
BEGIN
  -- Validar nome do frentista
  IF p_frentista_nome IS NULL OR TRIM(p_frentista_nome) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Nome do frentista é obrigatório');
  END IF;

  -- Buscar prêmio
  SELECT * INTO v_premio FROM premios_qr WHERE id = p_premio_id;

  IF v_premio IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio não encontrado');
  END IF;

  IF v_premio.status != 'ativo' THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio não está ativo');
  END IF;

  IF v_premio.data_expiracao < now() THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio expirado');
  END IF;

  IF p_valor <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;

  IF p_valor > v_premio.valor_restante THEN
    RETURN json_build_object('success', false, 'error', 'Valor excede o saldo disponível');
  END IF;

  -- Calcular novos valores
  v_valor_anterior := v_premio.valor_restante;
  v_valor_apos := v_premio.valor_restante - p_valor;
  v_novo_status := CASE WHEN v_valor_apos <= 0 THEN 'zerado' ELSE 'ativo' END;

  -- Registrar consumo com nome do frentista na observação
  INSERT INTO premios_qr_consumos (
    premio_id, valor_abatido, valor_anterior, valor_apos, 
    consumido_por, observacao
  ) VALUES (
    p_premio_id, p_valor, v_valor_anterior, v_valor_apos,
    NULL, CONCAT('Frentista: ', TRIM(p_frentista_nome), CASE WHEN p_observacao IS NOT NULL AND p_observacao != '' THEN ' | ' || p_observacao ELSE '' END)
  );

  -- Atualizar prêmio
  UPDATE premios_qr 
  SET valor_restante = v_valor_apos, status = v_novo_status, updated_at = now()
  WHERE id = p_premio_id;

  RETURN json_build_object(
    'success', true, 
    'frentista', TRIM(p_frentista_nome),
    'valor_abatido', p_valor,
    'novo_saldo', v_valor_apos,
    'novo_status', v_novo_status
  );
END;
$$;