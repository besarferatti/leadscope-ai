GRANT INSERT ON public.user_email_preferences TO authenticated;

CREATE POLICY "insert_own_email_preferences"
  ON public.user_email_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
