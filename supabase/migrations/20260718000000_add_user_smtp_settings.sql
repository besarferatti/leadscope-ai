CREATE TABLE IF NOT EXISTS public.user_smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  from_name text,
  from_email text,
  reply_to_email text,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password_encrypted text,
  smtp_secure boolean DEFAULT true,
  is_configured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_smtp_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_smtp_settings FROM anon, authenticated;
GRANT SELECT (id, user_id, from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_secure, is_configured, created_at, updated_at)
  ON TABLE public.user_smtp_settings TO authenticated;
GRANT INSERT (user_id, from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_secure, is_configured)
  ON TABLE public.user_smtp_settings TO authenticated;
GRANT UPDATE (from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_secure, is_configured, updated_at)
  ON TABLE public.user_smtp_settings TO authenticated;
GRANT DELETE ON TABLE public.user_smtp_settings TO authenticated;

CREATE POLICY "select_own_smtp_settings"
  ON public.user_smtp_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_smtp_settings"
  ON public.user_smtp_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_smtp_settings"
  ON public.user_smtp_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_smtp_settings"
  ON public.user_smtp_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
