CREATE FUNCTION public.get_admin_user_credit_balances(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, monthly bigint, non_expiring bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;
  IF cardinality(p_user_ids) > 100 THEN
    RAISE EXCEPTION 'Request at most 100 users at a time' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT p.id,
           coalesce(sum(g.remaining) FILTER (WHERE g.expires_at IS NOT NULL), 0),
           coalesce(sum(g.remaining) FILTER (WHERE g.expires_at IS NULL), 0)
    FROM (SELECT DISTINCT unnest(p_user_ids) AS id) requested
    JOIN public.user_profiles p ON p.id = requested.id
    LEFT JOIN public.credit_grants g ON g.user_id = p.id AND g.remaining > 0
      AND (g.expires_at IS NULL OR g.expires_at > statement_timestamp())
    GROUP BY p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_credit_balances(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_user_credit_balances(uuid[]) TO authenticated;
