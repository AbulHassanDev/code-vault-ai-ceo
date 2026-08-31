ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sandbox_url text,
  ADD COLUMN IF NOT EXISTS repo_ref text,
  ADD COLUMN IF NOT EXISTS repo_visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS license_type text NOT NULL DEFAULT 'single_developer',
  ADD COLUMN IF NOT EXISTS static_analysis jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_trade_no text,
  ADD COLUMN IF NOT EXISTS provider_tx_id text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_trade_no_key ON public.orders (merchant_trade_no) WHERE merchant_trade_no IS NOT NULL;

ALTER TABLE public.ai_approvals
  ADD COLUMN IF NOT EXISTS task_id text,
  ADD COLUMN IF NOT EXISTS agent_role text,
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'PROPOSE_APPROVAL',
  ADD COLUMN IF NOT EXISTS proposal jsonb;

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  percent_off integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin only discount codes" ON public.discount_codes;
CREATE POLICY "admin only discount codes" ON public.discount_codes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL DEFAULT 'binance_pay',
  status text NOT NULL DEFAULT 'proposed',
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_payouts TO authenticated;
GRANT ALL ON public.seller_payouts TO service_role;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin only seller payouts" ON public.seller_payouts;
CREATE POLICY "admin only seller payouts" ON public.seller_payouts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'binance_pay',
  merchant_trade_no text,
  transaction_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  amount_matched boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read webhook events" ON public.payment_webhook_events;
CREATE POLICY "admin read webhook events" ON public.payment_webhook_events FOR SELECT TO authenticated USING (public.is_admin());