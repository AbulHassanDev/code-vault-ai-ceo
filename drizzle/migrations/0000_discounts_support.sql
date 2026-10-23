ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code text, ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_key ON public.discount_codes (upper(code));

CREATE OR REPLACE FUNCTION public.lookup_discount(_code text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT percent_off FROM public.discount_codes
  WHERE upper(code) = upper(trim(_code)) AND active AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.lookup_discount(text) TO authenticated;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "create own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();