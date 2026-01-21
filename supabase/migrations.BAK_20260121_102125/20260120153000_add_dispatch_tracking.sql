DO $$ 
BEGIN 
    -- 1. Tenta adicionar na tabela whatsapp_campaign_recipients (Padrão do Supabase Types)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_campaign_recipients') THEN
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_campaign_recipients' AND column_name = 'dispatch_latency_ms') THEN
            ALTER TABLE public.whatsapp_campaign_recipients ADD COLUMN dispatch_latency_ms INTEGER NULL;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_campaign_recipients' AND column_name = 'sent_content') THEN
            ALTER TABLE public.whatsapp_campaign_recipients ADD COLUMN sent_content TEXT NULL;
        END IF;

    -- 2. Fallback: Tenta adicionar na tabela campaign_recipients (Caso esteja usando schema legado/Neon)
    ELSIF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_recipients') THEN
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaign_recipients' AND column_name = 'dispatch_latency_ms') THEN
            ALTER TABLE public.campaign_recipients ADD COLUMN dispatch_latency_ms INTEGER NULL;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaign_recipients' AND column_name = 'sent_content') THEN
            ALTER TABLE public.campaign_recipients ADD COLUMN sent_content TEXT NULL;
        END IF;
        
    ELSE
        -- 3. Se nenhuma existir, cria a whatsapp_campaign_recipients (Padrão)
        CREATE TABLE public.whatsapp_campaign_recipients (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at timestamptz NOT NULL DEFAULT now(),
            campaign_id uuid NOT NULL, -- FK seria ideal, mas vamos simplificar para evitar erro se a tabela pai nao existir
            phone_e164 text NOT NULL,
            customer_name text NULL,
            status text NOT NULL DEFAULT 'pending',
            provider_message_id text NULL,
            error text NULL,
            sent_at timestamptz NULL,
            dispatch_latency_ms INTEGER NULL,
            sent_content TEXT NULL
        );
        
        -- Tenta adicionar FK se whatsapp_campaigns existir
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_campaigns') THEN
            ALTER TABLE public.whatsapp_campaign_recipients 
            ADD CONSTRAINT whatsapp_campaign_recipients_campaign_id_fkey 
            FOREIGN KEY (campaign_id) REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE;
        END IF;

        -- Enable RLS
        ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
        
        -- Policy simples para permitir tudo (dev) ou ajuste conforme necessidade
        CREATE POLICY "Enable all for authenticated" ON public.whatsapp_campaign_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);

    END IF;
END $$;
