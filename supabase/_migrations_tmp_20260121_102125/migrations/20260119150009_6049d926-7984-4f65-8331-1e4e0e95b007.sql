-- Insert default farewell message
INSERT INTO settings (key, value, description, created_at, updated_at)
VALUES (
  'whatsapp_farewell_message',
  '"Obrigado pelo contato! 😊\n\nFoi um prazer falar com você. Estamos sempre à disposição para ajudar.\n\nAté a próxima! 🙋\nAuto Posto Pará – Economia de verdade!"',
  'Mensagem de despedida enviada quando o cliente encerra a conversa (SAIR, FIM, etc.)',
  NOW(),
  NOW()
) ON CONFLICT (key) DO NOTHING;