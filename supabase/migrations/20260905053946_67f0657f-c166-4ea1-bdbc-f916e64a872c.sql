CREATE POLICY "Admins manage product assets" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'product-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'product-assets' AND public.has_role(auth.uid(), 'admin'));