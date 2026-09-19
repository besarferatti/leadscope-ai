CREATE TABLE IF NOT EXISTS public.email_discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'paused')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_email_discovery_jobs_ready ON public.email_discovery_jobs (status, next_attempt_at, created_at);
ALTER TABLE public.email_discovery_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage_own_email_discovery_jobs" ON public.email_discovery_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_discovery_jobs TO authenticated;
NOTIFY pgrst, 'reload schema';
