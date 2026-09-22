ALTER TABLE public.outreach_email_sends
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_email_sends_provider_message
  ON public.outreach_email_sends (user_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.outreach_email_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_lead_id uuid REFERENCES public.outreach_campaign_leads(id) ON DELETE SET NULL,
  email_send_id uuid NOT NULL REFERENCES public.outreach_email_sends(id) ON DELETE CASCADE,
  internet_message_id text NOT NULL,
  in_reply_to text NOT NULL,
  from_email text NOT NULL,
  subject text,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, internet_message_id)
);

ALTER TABLE public.outreach_email_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_outreach_email_replies"
  ON public.outreach_email_replies FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.outreach_email_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_email_replies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_email_sends TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaign_leads TO service_role;
GRANT SELECT ON public.outreach_campaigns TO service_role;
GRANT SELECT ON public.user_smtp_settings TO service_role;

CREATE INDEX IF NOT EXISTS idx_outreach_email_replies_user_received
  ON public.outreach_email_replies (user_id, received_at DESC);

NOTIFY pgrst, 'reload schema';
