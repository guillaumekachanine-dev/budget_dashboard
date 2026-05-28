-- RLS Policies for projects_covers bucket

-- Allow public (unauthenticated) to read
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT
USING (bucket_id = 'projects_covers');
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated upload" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'projects_covers'
  AND auth.role() = 'authenticated'
);
-- Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated update" ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'projects_covers'
  AND auth.role() = 'authenticated'
);
-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'projects_covers'
  AND auth.role() = 'authenticated'
);
