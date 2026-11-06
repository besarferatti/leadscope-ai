ALTER TABLE public.credit_grants
  ADD COLUMN granted_by uuid,
  ADD COLUMN grant_reason text,
  ADD CONSTRAINT credit_grants_admin_details CHECK (
    (granted_by IS NULL AND grant_reason IS NULL) OR
    (granted_by IS NOT NULL AND grant_reason IS NOT NULL
      AND char_length(grant_reason) BETWEEN 1 AND 500 AND expires_at IS NULL)
  );

CREATE FUNCTION public.grant_admin_credits(
  p_user uuid, p_amount integer, p_reason text, p_operation uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  reason text := btrim(p_reason, E' \t\n\r');
  grant_key text := 'admin:' || p_operation;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;
  IF p_operation IS NULL OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000
      OR reason IS NULL OR char_length(reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Enter 1 to 1,000,000 credits and a reason of 1 to 500 characters.'
      USING ERRCODE = '22023';
  END IF;

  -- Use the same account lock as spending and Stripe grants.
  PERFORM 1 FROM public.user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.credit_grants (source_key, user_id, amount, remaining, granted_by, grant_reason)
    VALUES (grant_key, p_user, p_amount, p_amount, actor, reason)
    ON CONFLICT (source_key) DO NOTHING;
  IF FOUND THEN RETURN true; END IF;

  IF EXISTS (SELECT FROM public.credit_grants
      WHERE source_key = grant_key AND user_id = p_user AND amount = p_amount
        AND granted_by = actor AND grant_reason = reason) THEN
    RETURN false;
  END IF;
  RAISE EXCEPTION 'This grant reference was already used for different details' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_history()
RETURNS TABLE (label text, credits integer, occurred_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT * FROM (
    (SELECT CASE WHEN granted_by IS NOT NULL THEN 'Admin credit'
                 WHEN expires_at IS NULL THEN 'Top-up' ELSE 'Monthly credits' END,
            amount, created_at
      FROM public.credit_grants WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 25)
    UNION ALL
    (SELECT p.label, -s.credits, s.created_at FROM public.credit_spends s
      JOIN public.credit_prices p USING (action) WHERE s.user_id = auth.uid() AND s.credits > 0
      ORDER BY s.created_at DESC LIMIT 25)
  ) AS entries
  ORDER BY 3 DESC LIMIT 25;
$$;

REVOKE ALL ON FUNCTION public.grant_admin_credits(uuid, integer, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_admin_credits(uuid, integer, text, uuid) TO authenticated;
