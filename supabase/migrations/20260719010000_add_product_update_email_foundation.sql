CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email text NOT NULL,
  product_updates_enabled boolean NOT NULL DEFAULT true,
  unsubscribe_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_update_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  update_id text NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'test_sent', 'ready', 'sent', 'failed')),
  test_sent_at timestamptz,
  sent_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_update_email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.product_update_email_campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_update_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_update_email_recipients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.user_email_preferences TO authenticated;
GRANT ALL ON public.product_update_email_campaigns TO authenticated;
GRANT ALL ON public.product_update_email_recipients TO authenticated;

CREATE POLICY "select_own_email_preferences"
  ON public.user_email_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "update_own_email_preferences"
  ON public.user_email_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_manage_email_preferences"
  ON public.user_email_preferences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY "admin_manage_product_update_email_campaigns"
  ON public.product_update_email_campaigns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'));

CREATE POLICY "admin_manage_product_update_email_recipients"
  ON public.product_update_email_recipients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'));

NOTIFY pgrst, 'reload schema';
