-- Adicionar políticas de DELETE para campanhas e recipients

-- Policy para staff excluir campanhas (draft, paused, done)
CREATE POLICY "Staff can delete campaigns" 
ON whatsapp_campaigns FOR DELETE 
USING (is_staff());

-- Policy para staff excluir recipients
CREATE POLICY "Staff can delete recipients" 
ON whatsapp_campaign_recipients FOR DELETE 
USING (is_staff());