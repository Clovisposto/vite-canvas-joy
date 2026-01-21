-- Adicionar campo flow_state na tabela wa_contacts para gerenciar estado do chatbot
ALTER TABLE public.wa_contacts 
ADD COLUMN IF NOT EXISTS flow_state TEXT DEFAULT 'new';

-- Comentário explicativo dos estados
COMMENT ON COLUMN public.wa_contacts.flow_state IS 'Estados do chatbot: new (aguardando primeira interação), awaiting_name (coletando nome), completed (fluxo concluído)';