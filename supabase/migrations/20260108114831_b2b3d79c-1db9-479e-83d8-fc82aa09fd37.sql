-- Tabela de PINs de frentistas
CREATE TABLE public.frentistas_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frentista_id UUID NOT NULL REFERENCES public.frentistas(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(frentista_id)
);

-- Enable RLS
ALTER TABLE public.frentistas_pins ENABLE ROW LEVEL SECURITY;

-- Admin pode gerenciar PINs
CREATE POLICY "Admin can manage frentistas_pins"
ON public.frentistas_pins
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_frentistas_pins_updated_at
BEFORE UPDATE ON public.frentistas_pins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para validar PIN e registrar abatimento (executa como definer para bypass RLS)
CREATE OR REPLACE FUNCTION public.validar_pin_e_abater(
  p_pin TEXT,
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
  v_frentista_id UUID;
  v_frentista_nome TEXT;
  v_premio RECORD;
  v_valor_anterior NUMERIC;
  v_valor_apos NUMERIC;
  v_novo_status TEXT;
BEGIN
  -- Validar PIN (comparação simples - em produção usar hash)
  SELECT fp.frentista_id, f.nome INTO v_frentista_id, v_frentista_nome
  FROM frentistas_pins fp
  JOIN frentistas f ON f.id = fp.frentista_id
  WHERE fp.pin_hash = p_pin AND fp.is_active = true AND f.is_active = true;

  IF v_frentista_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PIN inválido ou frentista inativo');
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

  -- Registrar consumo
  INSERT INTO premios_qr_consumos (
    premio_id, valor_abatido, valor_anterior, valor_apos, 
    consumido_por, observacao
  ) VALUES (
    p_premio_id, p_valor, v_valor_anterior, v_valor_apos,
    NULL, COALESCE(p_observacao, '') || ' [Frentista: ' || v_frentista_nome || ']'
  );

  -- Atualizar prêmio
  UPDATE premios_qr 
  SET valor_restante = v_valor_apos, status = v_novo_status, updated_at = now()
  WHERE id = p_premio_id;

  RETURN json_build_object(
    'success', true, 
    'frentista', v_frentista_nome,
    'valor_abatido', p_valor,
    'novo_saldo', v_valor_apos,
    'novo_status', v_novo_status
  );
END;
$$;

-- Permitir execução pública da função de validação
GRANT EXECUTE ON FUNCTION public.validar_pin_e_abater TO anon, authenticated;