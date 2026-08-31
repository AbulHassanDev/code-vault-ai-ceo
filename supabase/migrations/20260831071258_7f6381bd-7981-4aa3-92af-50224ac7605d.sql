ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE public.ai_settings ADD CONSTRAINT ai_settings_payment_mode_check CHECK (payment_mode IN ('manual','merchant_api'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verification_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id);