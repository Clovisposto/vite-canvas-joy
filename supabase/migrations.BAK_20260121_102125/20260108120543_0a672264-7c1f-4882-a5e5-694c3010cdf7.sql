-- Tabela de links públicos para checkins
CREATE TABLE public.checkin_public_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Índice para busca por token
CREATE INDEX idx_checkin_public_links_token ON public.checkin_public_links(token);

-- RLS: ninguém acessa diretamente, apenas via funções
ALTER TABLE public.checkin_public_links ENABLE ROW LEVEL SECURITY;

-- Função para criar checkin e retornar token (pública)
CREATE OR REPLACE FUNCTION public.public_create_checkin_and_token(
  p_phone TEXT,
  p_attendant_code TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin_id UUID;
  v_token TEXT;
BEGIN
  -- Gerar token aleatório
  v_token := encode(gen_random_bytes(16), 'hex');
  
  -- Inserir checkin
  INSERT INTO checkins (phone, attendant_code, tag, origin)
  VALUES (p_phone, p_attendant_code, p_tag, 'pwa')
  RETURNING id INTO v_checkin_id;
  
  -- Criar link público
  INSERT INTO checkin_public_links (checkin_id, token)
  VALUES (v_checkin_id, v_token);
  
  RETURN json_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'token', v_token
  );
END;
$$;

-- Permitir execução pública
GRANT EXECUTE ON FUNCTION public.public_create_checkin_and_token TO anon, authenticated;

-- Função para ler status do checkin via token (pública)
CREATE OR REPLACE FUNCTION public.get_public_checkin_status(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_checkin RECORD;
  v_tef RECORD;
  v_status TEXT;
  v_phone_masked TEXT;
BEGIN
  -- Buscar link
  SELECT * INTO v_link
  FROM checkin_public_links
  WHERE token = p_token;
  
  IF v_link IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Token inválido');
  END IF;
  
  IF v_link.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Sessão expirada');
  END IF;
  
  -- Buscar checkin
  SELECT * INTO v_checkin
  FROM checkins
  WHERE id = v_link.checkin_id;
  
  IF v_checkin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Registro não encontrado');
  END IF;
  
  -- Mascarar telefone (mostrar só últimos 4 dígitos)
  v_phone_masked := '****' || RIGHT(v_checkin.phone, 4);
  
  -- Buscar TEF vinculado (se houver)
  SELECT * INTO v_tef
  FROM stone_tef_logs
  WHERE checkin_id = v_checkin.id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Determinar status
  IF v_tef IS NOT NULL THEN
    v_status := COALESCE(v_tef.status, 'aprovado');
  ELSE
    v_status := 'aguardando';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'created_at', v_checkin.created_at,
    'phone_masked', v_phone_masked,
    'tag', v_checkin.tag,
    'attendant_code', v_checkin.attendant_code,
    'payment_status', v_status,
    'valor', COALESCE(v_tef.valor, v_checkin.amount),
    'forma_pagamento', COALESCE(v_tef.forma_pagamento, v_checkin.payment_method),
    'bandeira', v_tef.bandeira,
    'frentista_nome', v_tef.frentista_nome
  );
END;
$$;

-- Permitir execução pública
GRANT EXECUTE ON FUNCTION public.get_public_checkin_status TO anon, authenticated;