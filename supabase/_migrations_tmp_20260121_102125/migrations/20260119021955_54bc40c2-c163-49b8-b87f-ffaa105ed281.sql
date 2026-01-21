-- Habilitar realtime para tabela wa_messages (conversas do chatbot)
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;

-- Habilitar realtime para tabela wa_contacts (contatos do chatbot)
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_contacts;