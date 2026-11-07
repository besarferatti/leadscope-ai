import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { browserEvidenceForPrompt, runBrowserChecks } from '../supabase/functions/analyze-lead/browser-checks.ts';

const page = 'https://example.com/index.html';

test('the two device checks preserve independent results and omit screenshots from AI input', async () => {
  const devices = [];
  const results = await runBrowserChecks(page, 'test-key', async (url) => {
    const device = url.searchParams.get('strategy');
    devices.push(device);
    assert.equal(url.origin, 'https://pagespeedonline.googleapis.com');
    assert.equal(url.searchParams.get('url'), page);
    if (device === 'desktop') return new Response(null, { status: 429 });
    return Response.json({
      id: page,
      lighthouseResult: {
        categories: { performance: { score: 0.69 } },
        audits: {
          'largest-contentful-paint': { numericValue: 3800 },
          'cumulative-layout-shift': { numericValue: 0 },
          'final-screenshot': { details: { data: 'data:image/jpeg;base64,YQ==' } },
          'button-name': { score: 0, scoreDisplayMode: 'binary' },
          'image-alt': { score: null, scoreDisplayMode: 'notApplicable' },
        },
      },
    });
  });
  assert.deepEqual(devices, ['mobile', 'desktop']);
  assert.equal(results[0].screenshot, 'data:image/jpeg;base64,YQ==');
  assert.deepEqual(browserEvidenceForPrompt(results), [
    { device: 'mobile', status: 'measured', performance: 69, lcpMs: 3800, cls: 0, diagnostics: [{ label: 'Accessible button labels', detail: undefined }] },
    { device: 'desktop', status: 'unavailable' },
  ]);
  assert.equal(results[1].reason, 'PageSpeed quota exceeded.');
});

test('checks skip the external call without configuration and reject an unrelated result', async () => {
  const unconfigured = await runBrowserChecks(page, '', () => assert.fail('Unexpected network call'));
  assert.ok(unconfigured.every(check => check.status === 'unavailable'));
  const redirected = await runBrowserChecks(page, 'test-key', () => Promise.resolve(Response.json({
    id: 'https://example.com/login',
    lighthouseResult: { audits: {} },
  })));
  assert.ok(redirected.every(check => check.status === 'unavailable'));
});

test('shared audit token keeps browser evidence and prices private', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create table leads (id int, business_name text, website text, location text, lead_score int);
      create table lead_audits (
        lead_id int, website_score int, seo_score int, conversion_score int, main_issues text[],
        recommended_offer text, personalization_angle text, summary text,
        seo_content_pack jsonb, shared_at timestamptz, share_token text
      );
      insert into leads (id, business_name) values (1, 'Example');
      insert into lead_audits (lead_id, share_token, seo_content_pack) values
        (1, 'report-token', '{"website_evidence":{"https":true},"browser_checks":[{"screenshot":"private"}],"suggested_pricing":{"one_time_setup":"private"}}');
    `);
    const sql = await readFile(new URL('../supabase/migrations/20261107000000_hide_browser_checks_from_shared_audits.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec('set role anon');
    const result = await db.query("select seo_content_pack from public.get_shared_audit_report('report-token')");
    assert.deepEqual(result.rows, [{ seo_content_pack: { website_evidence: { https: true } } }]);
  } finally {
    await db.close();
  }
});
