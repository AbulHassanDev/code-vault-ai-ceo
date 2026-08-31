
CREATE TABLE public.ai_job_locks (
  key text PRIMARY KEY,
  leased_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_job_locks TO authenticated;
GRANT ALL ON public.ai_job_locks TO service_role;
ALTER TABLE public.ai_job_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.ai_job_locks FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
