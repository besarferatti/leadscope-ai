import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { certificateServiceOffer } from '../supabase/functions/analyze-lead/certificate-service-offer.ts';

test('Analyze Lead saves a certificate opportunity without AI, credits, or overwriting a full audit', async () => {
  const source = await readFile(new URL('../supabase/functions/analyze-lead/index.ts', import.meta.url), 'utf8');
  const script = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const writes = [];
  const existing = { id: 'full-audit', seo_content_pack: { meta_title: 'Existing complete audit' } };
  const client = {
    auth: { async getUser() { return { data: { user: { id: 'owner' } } }; } },
    from(table) {
      let values;
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
        contains() { return query; },
        update() { assert.fail('The previous full audit and lead status must be preserved'); },
        insert(value) { values = value; writes.push({ table, value }); return query; },
        async single() { return { data: { id: 'certificate-audit', ...values } }; },
        async maybeSingle() {
          if (table === 'user_profiles') return { data: { id: 'owner', role: 'user', is_active: true } };
          if (table === 'leads') return { data: { id: 'lead', user_id: 'owner', website: 'https://example.com/' } };
          return { data: existing };
        },
      };
      return query;
    },
  };
  let handler;
  new Function('Deno', 'createClient', 'requestWebsiteScan', 'unavailableEvidence', 'verifiedIssues',
    'browserEvidenceForPrompt', 'runBrowserChecks', 'chargeCredits', 'certificateServiceOffer', script)(
    { env: { get: name => name === 'OPENAI_API_KEY' ? undefined : 'fixture' }, serve: fn => { handler = fn; } },
    () => client,
    async () => ({ reason: 'The website HTTPS certificate has expired.' }),
    reason => ({ status: 'unavailable', reason }),
    () => assert.fail('Unexpected complete-audit work'),
    () => assert.fail('Unexpected AI work'),
    () => assert.fail('Unexpected browser request'),
    () => assert.fail('No credits may be charged'),
    certificateServiceOffer,
  );
  const response = await handler(new Request('https://example.invalid/analyze-lead', {
    method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: 'lead' }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.credits_used, 0);
  assert.equal(result.audit.website_score, null);
  assert.equal(result.audit.seo_score, null);
  assert.equal(result.audit.conversion_score, null);
  assert.match(result.audit.recommended_offer, /certificate renewal/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'lead_audits');
  assert.equal(existing.seo_content_pack.meta_title, 'Existing complete audit');
});
