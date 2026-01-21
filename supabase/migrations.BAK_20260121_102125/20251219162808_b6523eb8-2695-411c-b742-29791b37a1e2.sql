-- Adicionar coluna is_demo na tabela checkins
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;

-- Criar índice para queries de demo
CREATE INDEX IF NOT EXISTS idx_checkins_is_demo_created ON public.checkins (is_demo, created_at DESC);