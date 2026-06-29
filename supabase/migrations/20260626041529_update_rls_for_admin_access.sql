
-- Update RLS on leads, lead_searches, lead_audits, outreach_messages to allow admin full access

-- LEADS: admins can see all
DROP POLICY IF EXISTS "admin_select_all_leads" ON leads;
CREATE POLICY "admin_select_all_leads" ON leads FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_all_leads" ON leads;
CREATE POLICY "admin_delete_all_leads" ON leads FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- LEAD_SEARCHES: admins can see all
DROP POLICY IF EXISTS "admin_select_all_searches" ON lead_searches;
CREATE POLICY "admin_select_all_searches" ON lead_searches FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- LEAD_AUDITS: need to add admin policy
DROP POLICY IF EXISTS "admin_select_all_audits" ON lead_audits;
CREATE POLICY "admin_select_all_audits" ON lead_audits FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM leads l WHERE l.id = lead_id AND l.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- OUTREACH_MESSAGES: need to add admin policy
DROP POLICY IF EXISTS "admin_select_all_messages" ON outreach_messages;
CREATE POLICY "admin_select_all_messages" ON outreach_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM leads l WHERE l.id = lead_id AND l.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );
