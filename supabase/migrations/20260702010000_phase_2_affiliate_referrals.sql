ALTER TABLE public.affiliate_applications
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_clicks integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_applications_referral_code_key'
  ) THEN
    ALTER TABLE public.affiliate_applications
      ADD CONSTRAINT affiliate_applications_referral_code_key UNIQUE (referral_code);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_application_id uuid REFERENCES public.affiliate_applications(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  referred_email text NOT NULL,
  referred_full_name text,
  referred_user_id uuid,
  status text NOT NULL DEFAULT 'signup',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_referrals_status_check
    CHECK (status IN ('signup', 'paid', 'cancelled'))
);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_affiliate_referrals" ON public.affiliate_referrals
  FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_update_affiliate_referrals" ON public.affiliate_referrals
  FOR UPDATE TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_delete_affiliate_referrals" ON public.affiliate_referrals
  FOR DELETE TO authenticated
  USING (is_admin_user());

CREATE OR REPLACE FUNCTION public.track_affiliate_click(p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_updated integer;
BEGIN
  v_code := lower(trim(coalesce(p_referral_code, '')));

  IF v_code = '' THEN
    RETURN false;
  END IF;

  UPDATE public.affiliate_applications
  SET referral_clicks = referral_clicks + 1,
      updated_at = now()
  WHERE status = 'approved'
    AND referral_code = v_code;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_affiliate_signup(
  p_referral_code text,
  p_referred_email text,
  p_referred_full_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_email text;
  v_affiliate_id uuid;
BEGIN
  v_code := lower(trim(coalesce(p_referral_code, '')));
  v_email := lower(trim(coalesce(p_referred_email, '')));

  IF v_code = '' OR v_email = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_affiliate_id
  FROM public.affiliate_applications
  WHERE status = 'approved'
    AND referral_code = v_code
  LIMIT 1;

  IF v_affiliate_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.affiliate_referrals (
    affiliate_application_id,
    referral_code,
    referred_email,
    referred_full_name,
    status
  ) VALUES (
    v_affiliate_id,
    v_code,
    v_email,
    nullif(trim(coalesce(p_referred_full_name, '')), ''),
    'signup'
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_affiliate_click(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_affiliate_signup(text, text, text) TO anon, authenticated;
