ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS proof_path TEXT,
  ADD COLUMN IF NOT EXISTS ai_verification JSONB,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

CREATE POLICY "Buyers upload own payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Buyers read own payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Buyers delete own payment proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);