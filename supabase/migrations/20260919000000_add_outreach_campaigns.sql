CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  mode text NOT NULL DEFAULT 'review' CHECK (mode IN ('review', 'autopilot')),
  language text NOT NULL DEFAULT 'English',
  tone text NOT NULL DEFAULT 'Professional',
  daily_limit integer NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 100),
  timezone text NOT NULL DEFAULT 'UTC',
  send_window_start time NOT NULL DEFAULT '09:00',
  send_window_end time NOT NULL DEFAULT '17:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL CHECK (step_order BETWEEN 1 AND 10),
  delay_days integer NOT NULL DEFAULT 0 CHECK (delay_days BETWEEN 0 AND 90),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_order)
);

CREATE TABLE IF NOT EXISTS public.outreach_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready_for_review', 'approved', 'scheduled', 'sent', 'replied', 'bounced', 'unsubscribed', 'failed', 'stopped')),
  current_step integer NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 10),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  outreach_message_id uuid REFERENCES public.outreach_messages(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);

CREATE TABLE IF NOT EXISTS public.outreach_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'manual' CHECK (reason IN ('manual', 'unsubscribed', 'bounced', 'replied', 'complaint')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_suppression_user_email
  ON public.outreach_suppression_list (user_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_user_status
  ON public.outreach_campaigns (user_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign_leads_due
  ON public.outreach_campaign_leads (campaign_id, status, next_send_at);

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage_own_outreach_campaigns"
  ON public.outreach_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manage_own_outreach_campaign_steps"
  ON public.outreach_campaign_steps FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outreach_campaigns c
    WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outreach_campaigns c
    WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "manage_own_outreach_campaign_leads"
  ON public.outreach_campaign_leads FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outreach_campaigns c
    WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outreach_campaigns c
    WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "manage_own_outreach_suppression_list"
  ON public.outreach_suppression_list FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaign_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaign_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_suppression_list TO authenticated;

NOTIFY pgrst, 'reload schema';
