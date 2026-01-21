-- Criar tabela para lançamentos do Livro Caixa
CREATE TABLE public.livro_caixa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  forma_pagamento VARCHAR(50),
  responsavel VARCHAR(100),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.livro_caixa ENABLE ROW LEVEL SECURITY;

-- Policies para usuários autenticados
CREATE POLICY "Authenticated users can view livro_caixa" 
ON public.livro_caixa 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert livro_caixa" 
ON public.livro_caixa 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update livro_caixa" 
ON public.livro_caixa 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete livro_caixa" 
ON public.livro_caixa 
FOR DELETE 
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_livro_caixa_updated_at
BEFORE UPDATE ON public.livro_caixa
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();