CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  company_name text,
  website_or_social text,
  audience_type text,
  audience_size text,
  promotion_plan text,
  preferred_payout_method text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  commission_type text NOT NULL DEFAULT 'recurring',
  commission_rate numeric NOT NULL DEFAULT 20,
  commission_duration_months integer NOT NULL DEFAULT 6,
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_applications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT affiliate_applications_commission_type_check
    CHECK (commission_type IN ('recurring', 'first_payment_only'))
);

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_affiliate_applications" ON public.affiliate_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "admin_select_affiliate_applications" ON public.affiliate_applications
  FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_update_affiliate_applications" ON public.affiliate_applications
  FOR UPDATE TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_delete_affiliate_applications" ON public.affiliate_applications
  FOR DELETE TO authenticated
  USING (is_admin_user());
