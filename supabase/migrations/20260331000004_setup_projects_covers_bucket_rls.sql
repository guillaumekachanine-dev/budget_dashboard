-- Setup RLS policies for projects_covers bucket

-- Allow public (anyone) to read/select
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'projects_covers');
-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'projects_covers'
  AND auth.role() = 'authenticated'
);
-- Allow users to update their own uploads
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
WITH CHECK (
  bucket_id = 'projects_covers'
  AND auth.role() = 'authenticated'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
-- Allow users to delete their own uploads
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'projects_covers'
  AND auth.role() = 'authenticated'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
