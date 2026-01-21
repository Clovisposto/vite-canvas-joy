CREATE OR REPLACE FUNCTION public.public_create_checkin_and_token(
  p_phone text, 
  p_attendant_code text DEFAULT NULL::text, 
  p_tag text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_checkin_id UUID;
  v_token TEXT;
BEGIN
  -- Gerar token usando gen_random_uuid() (nativo do PostgreSQL)
  v_token := replace(gen_random_uuid()::text, '-', '');
  
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