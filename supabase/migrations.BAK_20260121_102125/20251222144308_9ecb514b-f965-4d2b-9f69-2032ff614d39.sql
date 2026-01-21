-- Adicionar campo terminal_id na tabela frentistas para vincular máquina Stone
ALTER TABLE public.frentistas 
ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(100) DEFAULT NULL;

-- Criar índice para busca rápida por terminal
CREATE INDEX IF NOT EXISTS idx_frentistas_terminal_id ON public.frentistas(terminal_id) WHERE terminal_id IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.frentistas.terminal_id IS 'Número de série/ID do terminal Stone vinculado ao frentista';