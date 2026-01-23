-- Add missing columns to whatsapp_campaign_recipients for tracking dispatch details
ALTER TABLE public.whatsapp_campaign_recipients 
ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
ADD COLUMN IF NOT EXISTS dispatch_latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS sent_content TEXT;