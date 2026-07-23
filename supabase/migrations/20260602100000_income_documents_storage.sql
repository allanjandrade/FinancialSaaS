-- Bucket para holerites, informes de rendimentos e comprovantes de entrada

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'income-documents',
  'income-documents',
  false,
  12582912,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "income_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "income_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "income_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "income_docs_delete_own" ON storage.objects;

CREATE POLICY "income_docs_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'income-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "income_docs_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'income-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "income_docs_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'income-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "income_docs_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'income-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
