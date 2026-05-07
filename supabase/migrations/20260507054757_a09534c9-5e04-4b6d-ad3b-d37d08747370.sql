
CREATE POLICY "Users upload own ad files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own ad files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
