-- =====================================================
-- SISTEMA DE IA SUPERINTELIGENTE 24H
-- Banco de dados completo para comandos e ações da IA
-- =====================================================

-- Tabela de comandos de voz/texto reconhecidos pela IA
CREATE TABLE IF NOT EXISTS public.ai_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  command_pattern TEXT NOT NULL,
  command_type TEXT NOT NULL DEFAULT 'action', -- action, query, navigation, settings
  action_type TEXT, -- create_promotion, create_campaign, etc.
  description TEXT NOT NULL,
  example_phrases TEXT[] NOT NULL DEFAULT '{}',
  params_schema JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_confirmation BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs de execução de comandos da IA
CREATE TABLE IF NOT EXISTS public.ai_command_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  command_id UUID REFERENCES public.ai_commands(id),
  raw_input TEXT NOT NULL,
  recognized_action TEXT,
  params_extracted JSONB DEFAULT '{}',
  execution_result JSONB DEFAULT '{}',
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  voice_input BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de documentação do sistema (Manual)
CREATE TABLE IF NOT EXISTS public.system_documentation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_name TEXT NOT NULL,
  section_title TEXT NOT NULL,
  content TEXT NOT NULL,
  code_examples TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de configurações da IA
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_command_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Policies para ai_commands
CREATE POLICY "Public can read ai_commands" ON public.ai_commands FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage ai_commands" ON public.ai_commands FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Policies para ai_command_logs
CREATE POLICY "Users can read own command logs" ON public.ai_command_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert command logs" ON public.ai_command_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can read all command logs" ON public.ai_command_logs FOR SELECT TO authenticated USING (is_admin());

-- Policies para system_documentation
CREATE POLICY "Public can read documentation" ON public.system_documentation FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage documentation" ON public.system_documentation FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Policies para ai_settings
CREATE POLICY "Public can read ai_settings" ON public.ai_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage ai_settings" ON public.ai_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Inserir comandos padrão da IA
INSERT INTO public.ai_commands (command_pattern, command_type, action_type, description, example_phrases, params_schema, requires_confirmation) VALUES
('criar promocao', 'action', 'create_promotion', 'Criar uma nova promoção no sistema', ARRAY['crie uma promoção de 10% no pix', 'fazer promoção de desconto', 'nova promoção'], '{"title": "string", "discount_value": "number", "type": "string"}', true),
('criar campanha', 'action', 'create_campaign', 'Criar uma campanha de WhatsApp', ARRAY['criar campanha whatsapp', 'nova campanha de mensagens', 'fazer disparo em massa'], '{"name": "string", "message": "string"}', true),
('disparar campanha', 'action', 'send_campaign', 'Disparar uma campanha existente', ARRAY['enviar campanha', 'disparar mensagens', 'iniciar envio'], '{"campaign_id": "uuid"}', true),
('criar sorteio', 'action', 'create_raffle', 'Criar um novo sorteio', ARRAY['novo sorteio', 'criar sorteio de 200 reais', 'fazer sorteio'], '{"name": "string", "prize_value": "number", "winners_count": "number"}', true),
('resolver reclamacao', 'action', 'resolve_complaint', 'Resolver uma reclamação de cliente', ARRAY['resolver reclamação', 'marcar como resolvido', 'finalizar atendimento'], '{"complaint_id": "uuid", "resolution_notes": "string"}', true),
('resumo do dia', 'query', NULL, 'Obter resumo das atividades do dia', ARRAY['resumo de hoje', 'como foi o dia', 'relatório diário'], '{}', false),
('status sistema', 'query', NULL, 'Verificar status do sistema', ARRAY['como está o sistema', 'tudo funcionando', 'status geral'], '{}', false),
('listar clientes', 'query', NULL, 'Listar clientes cadastrados', ARRAY['quantos clientes temos', 'listar contatos', 'ver clientes'], '{}', false),
('navegar captura', 'navigation', NULL, 'Ir para tela de captura', ARRAY['abrir captura', 'ir para captura', 'mostrar cadastros'], '{}', false),
('navegar producao', 'navigation', NULL, 'Ir para tela de produção', ARRAY['abrir produção', 'ir para check-ins', 'mostrar produção'], '{}', false),
('navegar sorteios', 'navigation', NULL, 'Ir para tela de sorteios', ARRAY['abrir sorteios', 'ir para sorteios', 'mostrar sorteios'], '{}', false),
('navegar promocoes', 'navigation', NULL, 'Ir para tela de promoções', ARRAY['abrir promoções', 'ir para promoções', 'mostrar ofertas'], '{}', false),
('navegar whatsapp', 'navigation', NULL, 'Ir para robô WhatsApp', ARRAY['abrir whatsapp', 'ir para robo', 'mostrar whatsapp'], '{}', false),
('alterar configuracao', 'settings', NULL, 'Alterar configurações do sistema', ARRAY['mudar configuração', 'alterar setting', 'configurar sistema'], '{"key": "string", "value": "any"}', true)
ON CONFLICT DO NOTHING;

-- Inserir configurações padrão da IA
INSERT INTO public.ai_settings (key, value, description) VALUES
('ai_mode', '"always_on"', 'Modo de operação da IA: always_on, on_demand, scheduled'),
('auto_response', 'true', 'IA responde automaticamente a mensagens de clientes'),
('voice_enabled', 'true', 'Comandos de voz habilitados'),
('tts_enabled', 'true', 'Leitura de respostas habilitada'),
('confirmation_required', 'true', 'Exigir confirmação antes de executar ações'),
('max_actions_per_minute', '10', 'Limite de ações por minuto'),
('welcome_message', '"Olá! Como posso ajudar?"', 'Mensagem de boas-vindas do assistente'),
('farewell_message', '"Até logo! Estou sempre aqui 24h."', 'Mensagem de despedida')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Inserir documentação do sistema
INSERT INTO public.system_documentation (module_name, section_title, content, code_examples, order_index) VALUES
('QR Code', 'Geração de QR Codes', 'O módulo de QR Code permite gerar códigos personalizados para cada ponto de captura. Os parâmetros são: attendant_code (código do frentista), tag (identificador da bomba), phone (pré-preenchimento do telefone).', 'URL: https://posto7.app/aplicativo?attendant_code=FR01&tag=bomba1&phone=5594991234567', 1),
('Captura', 'Cadastro de Clientes', 'A tela de captura exibe todos os contatos cadastrados via QR Code. Cada registro mostra: telefone, nome, data de cadastro, origem (tag) e frentista responsável.', 'Campos: phone, name, opt_in, flow_state, attendant_code, tag', 2),
('Produção', 'Check-ins de Abastecimento', 'Registra cada abastecimento com: telefone, valor, litros, forma de pagamento, frentista. Usado para calcular métricas e elegibilidade para sorteios.', 'Campos: phone, amount, liters, payment_method, attendant_code', 3),
('Sorteios', 'Sistema de Sorteios', 'Sorteios automáticos baseados em check-ins. Configurações: nome, valor do prêmio, quantidade de ganhadores, dias da semana, horários.', 'Execução: raffle_runs armazena ganhadores e seed', 4),
('Promoções', 'Gerenciamento de Ofertas', 'Tipos: desconto, brinde, informativa, relampago. Campos: título, descrição, valor do desconto, formas de pagamento elegíveis, período de validade.', 'Tipos válidos: desconto, brinde, informativa, relampago', 5),
('WhatsApp', 'Robô de Mensagens', 'Integração com Evolution API para envio automatizado. Suporta: mensagens individuais, campanhas em massa, chatbot automático, confirmação de sorteios.', 'Provider: EVOLUTION, Instance: configurada via secrets', 6),
('Campanhas', 'Disparos em Massa', 'Criação e envio de campanhas para contatos opt-in. Campos: nome, mensagem, template, destinatários. Status: draft, scheduled, running, completed.', 'Limite: rate limiting automático para evitar bloqueios', 7),
('Frentistas', 'Gestão de Equipe', 'Cadastro de frentistas com código único. Cada frentista pode ter: metas mensais, terminais TEF vinculados, QR codes personalizados, PIN de acesso.', 'Código único: FR01, FR02, etc.', 8),
('Livro Caixa', 'Controle Financeiro', 'Registro de entradas e saídas. Categorias: combustível, loja, serviços, despesas. Gera DRE automático com lucro/prejuízo.', 'Tipos: entrada, saida', 9),
('Premiação QR', 'Prêmios com Saldo', 'Prêmios com QR Code para clientes ganhadores. Saldo pode ser abatido parcialmente. Expiração configurável.', 'Consumo registrado em premios_qr_consumos', 10),
('IA Assistente', 'Comandos de Voz', 'Comandos disponíveis: criar promoção, criar campanha, criar sorteio, resumo do dia, status sistema. Confirmação obrigatória para ações destrutivas.', 'Voice: Web Speech API, TTS: SpeechSynthesis', 11),
('Integração Stone', 'TEF e Pagamentos', 'Webhook recebe transações TEF da Stone. Campos: valor, forma de pagamento, bandeira, NSU, autorização, terminal, frentista.', 'Webhook: POST /stone-webhook', 12)
ON CONFLICT DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ai_tables_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ai_commands_updated_at ON public.ai_commands;
CREATE TRIGGER update_ai_commands_updated_at
  BEFORE UPDATE ON public.ai_commands
  FOR EACH ROW EXECUTE FUNCTION update_ai_tables_updated_at();

DROP TRIGGER IF EXISTS update_system_documentation_updated_at ON public.system_documentation;
CREATE TRIGGER update_system_documentation_updated_at
  BEFORE UPDATE ON public.system_documentation
  FOR EACH ROW EXECUTE FUNCTION update_ai_tables_updated_at();

DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_ai_tables_updated_at();