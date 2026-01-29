-- Tabela para histórico de conversas do assistente IA
CREATE TABLE public.ai_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para buscar conversas por usuário
CREATE INDEX idx_ai_chat_history_user_id ON public.ai_chat_history(user_id);
CREATE INDEX idx_ai_chat_history_created_at ON public.ai_chat_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver e gerenciar apenas suas próprias conversas
CREATE POLICY "Users can manage own chat history"
ON public.ai_chat_history FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff pode ver todas as conversas (para auditoria)
CREATE POLICY "Staff can read all chat history"
ON public.ai_chat_history FOR SELECT TO authenticated
USING (public.is_staff());