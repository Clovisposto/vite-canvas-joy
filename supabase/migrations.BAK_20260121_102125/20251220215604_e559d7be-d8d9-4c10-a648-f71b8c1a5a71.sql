-- Create storage bucket for posto assets (logo, background images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posto-assets', 'posto-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view posto assets (public bucket)
CREATE POLICY "Public can view posto assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'posto-assets');

-- Allow authenticated users to upload posto assets
CREATE POLICY "Authenticated can upload posto assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'posto-assets' AND auth.role() = 'authenticated');

-- Allow authenticated users to update posto assets
CREATE POLICY "Authenticated can update posto assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'posto-assets' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete posto assets
CREATE POLICY "Authenticated can delete posto assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'posto-assets' AND auth.role() = 'authenticated');