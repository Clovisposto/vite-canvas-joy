-- Drop the existing check constraint and add the new one with 'relampago' type
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_type_check;

ALTER TABLE public.promotions ADD CONSTRAINT promotions_type_check 
CHECK (type IN ('informativa', 'desconto', 'relampago'));