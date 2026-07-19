ALTER TABLE public.product_update_email_campaigns
  DROP CONSTRAINT IF EXISTS product_update_email_campaigns_status_check;

ALTER TABLE public.product_update_email_campaigns
  ADD CONSTRAINT product_update_email_campaigns_status_check
  CHECK (status IN ('draft', 'test_sent', 'ready', 'sending', 'sent', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS product_update_email_recipients_campaign_email_key
  ON public.product_update_email_recipients (campaign_id, email);
