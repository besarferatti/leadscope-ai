-- Some existing Stripe installations predate subscription soft deletion.
ALTER TABLE public.stripe_subscriptions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE public.credit_prices (
  action text PRIMARY KEY,
  label text NOT NULL,
  credits integer NOT NULL CHECK (credits BETWEEN 0 AND 1000000)
);

INSERT INTO public.credit_prices (action, label, credits) VALUES
  ('lead_search', 'Lead search', 5),
  ('website_analysis', 'AI website analysis', 20),
  ('website_preview', 'Website preview', 30),
  ('email_generation', 'Personalized email', 5),
  ('dm_generation', 'Personalized direct message', 5),
  ('email_send', 'Email sending', 2),
  ('email_discovery', 'Email discovery', 5);

CREATE TABLE public.credit_grants (
  source_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  remaining integer NOT NULL CHECK (remaining BETWEEN 0 AND amount),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_grants_spend_idx ON public.credit_grants (user_id, expires_at, created_at)
  WHERE remaining > 0;
CREATE INDEX credit_grants_history_idx ON public.credit_grants (user_id, created_at DESC);

CREATE TABLE public.credit_spends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  action text NOT NULL REFERENCES public.credit_prices(action),
  credits integer NOT NULL CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);
CREATE INDEX credit_spends_history_idx ON public.credit_spends (user_id, created_at DESC);

CREATE TABLE public.credit_spend_allocations (
  user_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  source_key text NOT NULL REFERENCES public.credit_grants(source_key) ON DELETE CASCADE,
  credits integer NOT NULL CHECK (credits > 0),
  PRIMARY KEY (user_id, operation_id, source_key),
  FOREIGN KEY (user_id, operation_id) REFERENCES public.credit_spends(user_id, operation_id) ON DELETE CASCADE
);

ALTER TABLE public.credit_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_spends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_spend_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credit_prices, public.credit_grants, public.credit_spends,
  public.credit_spend_allocations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.credit_prices TO authenticated;
CREATE POLICY credit_prices_read ON public.credit_prices FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.has_legacy_credit_access(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT FROM public.stripe_customers c
    JOIN public.stripe_subscriptions s USING (customer_id)
    JOIN public.user_profiles p ON p.id = c.user_id
    WHERE c.user_id = p_user AND c.deleted_at IS NULL AND s.deleted_at IS NULL
      AND s.status IN ('active', 'trialing') AND s.price_id IS NOT NULL
      AND s.current_period_end > extract(epoch FROM statement_timestamp())
      AND (p.current_plan IN ('starter', 'agency', 'enterprise') OR
           (p.current_plan = 'pro' AND s.current_period_end - s.current_period_start > 40 * 86400))
  );
$$;

CREATE FUNCTION public.get_credit_balance()
RETURNS TABLE (monthly bigint, top_up bigint, next_expiry timestamptz, legacy_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce(sum(remaining) FILTER (WHERE expires_at IS NOT NULL), 0),
         coalesce(sum(remaining) FILTER (WHERE expires_at IS NULL), 0),
         min(expires_at), public.has_legacy_credit_access(auth.uid())
  FROM public.credit_grants
  WHERE user_id = auth.uid() AND remaining > 0
    AND (expires_at IS NULL OR expires_at > statement_timestamp());
$$;

CREATE FUNCTION public.get_credit_history()
RETURNS TABLE (label text, credits integer, occurred_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT * FROM (
    (SELECT CASE WHEN expires_at IS NULL THEN 'Top-up' ELSE 'Monthly credits' END, amount, created_at
      FROM public.credit_grants WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 25)
    UNION ALL
    (SELECT p.label, -s.credits, s.created_at FROM public.credit_spends s
      JOIN public.credit_prices p USING (action) WHERE s.user_id = auth.uid() AND s.credits > 0
      ORDER BY s.created_at DESC LIMIT 25)
  ) AS entries
  ORDER BY 3 DESC LIMIT 25;
$$;

CREATE FUNCTION public.set_credit_price(p_action text, p_credits integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin' AND is_active) THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.credit_prices SET credits = p_credits WHERE action = p_action;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown credit action'; END IF;
END;
$$;

-- Return a distinct result on a retry so the caller cannot run the provider twice.
CREATE FUNCTION public.spend_credits(p_user uuid, p_action text, p_operation uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  profile record;
  lot record;
  cost integer;
  outstanding integer;
  used integer;
  at_time timestamptz;
BEGIN
  SELECT role, is_active INTO profile FROM public.user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND OR NOT profile.is_active THEN RETURN 'inactive'; END IF;
  IF EXISTS (SELECT FROM public.credit_spends WHERE user_id = p_user AND operation_id = p_operation) THEN
    RETURN 'duplicate';
  END IF;
  SELECT credits INTO STRICT cost FROM public.credit_prices WHERE action = p_action;
  IF profile.role = 'admin' OR public.has_legacy_credit_access(p_user) THEN cost := 0; END IF;
  at_time := clock_timestamp();
  IF cost > (SELECT coalesce(sum(remaining), 0) FROM public.credit_grants
      WHERE user_id = p_user AND (expires_at IS NULL OR expires_at > at_time)) THEN
    RETURN 'insufficient';
  END IF;

  INSERT INTO public.credit_spends VALUES (p_user, p_operation, p_action, cost);
  outstanding := cost;
  FOR lot IN SELECT source_key, remaining FROM public.credit_grants
      WHERE user_id = p_user AND remaining > 0 AND (expires_at IS NULL OR expires_at > at_time)
      ORDER BY expires_at NULLS LAST, created_at, source_key
  LOOP
    EXIT WHEN outstanding = 0;
    used := least(outstanding, lot.remaining);
    UPDATE public.credit_grants SET remaining = remaining - used WHERE source_key = lot.source_key;
    INSERT INTO public.credit_spend_allocations VALUES (p_user, p_operation, lot.source_key, used);
    outstanding := outstanding - used;
  END LOOP;
  RETURN 'charged';
END;
$$;

CREATE FUNCTION public.grant_monthly_credits(p_customer text, p_subscription text, p_start bigint, p_end bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE owner_id uuid;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end OR nullif(p_subscription, '') IS NULL THEN
    RAISE EXCEPTION 'Invalid monthly credit period';
  END IF;
  SELECT user_id INTO STRICT owner_id FROM public.stripe_customers
    WHERE customer_id = p_customer AND deleted_at IS NULL;
  PERFORM 1 FROM public.user_profiles WHERE id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing billing profile'; END IF;
  INSERT INTO public.credit_grants (source_key, user_id, amount, remaining, expires_at)
    VALUES ('monthly:' || p_subscription || ':' || p_start, owner_id, 7400, 7400, to_timestamp(p_end))
    ON CONFLICT (source_key) DO NOTHING;
END;
$$;

CREATE FUNCTION public.record_paid_checkout(
  p_customer text, p_session text, p_intent text, p_subtotal integer,
  p_total integer, p_currency text, p_wallet boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  amount integer;
BEGIN
  SELECT user_id INTO STRICT owner_id FROM public.stripe_customers
    WHERE customer_id = p_customer AND deleted_at IS NULL;
  PERFORM 1 FROM public.user_profiles WHERE id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing billing profile'; END IF;

  IF EXISTS (SELECT FROM public.stripe_orders WHERE checkout_session_id = p_session) THEN RETURN; END IF;
  IF p_wallet THEN
    amount := CASE p_total WHEN 1000 THEN 1000 WHEN 2500 THEN 2625
      WHEN 5000 THEN 5500 WHEN 10000 THEN 11500 END;
    IF amount IS NULL OR p_currency IS DISTINCT FROM 'usd' OR p_subtotal IS DISTINCT FROM p_total
       OR nullif(p_intent, '') IS NULL THEN
      RAISE EXCEPTION 'Invalid wallet payment';
    END IF;
    INSERT INTO public.credit_grants (source_key, user_id, amount, remaining)
      VALUES ('topup:' || p_intent, owner_id, amount, amount)
      ON CONFLICT (source_key) DO NOTHING;
    IF NOT FOUND THEN RETURN; END IF;
  END IF;

  -- Historical Stripe orders can include duplicates. Preserve them and serialize new writes.
  INSERT INTO public.stripe_orders (checkout_session_id, payment_intent_id, customer_id,
      amount_subtotal, amount_total, currency, payment_status, status)
    VALUES (p_session, p_intent, p_customer, p_subtotal, p_total, p_currency, 'paid', 'completed');
END;
$$;

REVOKE ALL ON FUNCTION public.has_legacy_credit_access(uuid), public.get_credit_balance(),
  public.get_credit_history(), public.set_credit_price(text, integer),
  public.spend_credits(uuid, text, uuid), public.grant_monthly_credits(text, text, bigint, bigint),
  public.record_paid_checkout(text, text, text, integer, integer, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(), public.get_credit_history(),
  public.set_credit_price(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, text, uuid),
  public.grant_monthly_credits(text, text, bigint, bigint),
  public.record_paid_checkout(text, text, text, integer, integer, text, boolean) TO service_role;
