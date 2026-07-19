CREATE TABLE IF NOT EXISTS public.outreach_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  outreach_message_id uuid REFERENCES public.outreach_messages(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  provider text NOT NULL DEFAULT 'smtp',
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.outreach_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_outreach_email_sends"
  ON public.outreach_email_sends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_outreach_email_sends"
  ON public.outreach_email_sends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_outreach_email_sends"
  ON public.outreach_email_sends FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_outreach_email_sends"
  ON public.outreach_email_sends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_outreach_email_sends_user_id ON public.outreach_email_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_email_sends_lead_id ON public.outreach_email_sends(lead_id);

NOTIFY pgrst, 'reload schema';
