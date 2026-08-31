ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_txid TEXT;
DROP POLICY IF EXISTS "Buyers can attach txid to own pending orders" ON public.orders;
CREATE POLICY "Buyers can attach txid to own pending orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');