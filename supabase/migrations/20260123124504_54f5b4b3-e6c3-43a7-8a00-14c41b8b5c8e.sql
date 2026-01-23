-- Update CHECK constraint to include 'sending' and 'paused' status values
ALTER TABLE public.whatsapp_campaigns 
DROP CONSTRAINT IF EXISTS whatsapp_campaigns_status_check;

ALTER TABLE public.whatsapp_campaigns 
ADD CONSTRAINT whatsapp_campaigns_status_check 
CHECK (status = ANY (ARRAY['draft', 'scheduled', 'running', 'sending', 'completed', 'cancelled', 'paused']));