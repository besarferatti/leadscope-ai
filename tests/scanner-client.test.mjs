import assert from 'node:assert/strict';
import test from 'node:test';
import { requestWebsiteScan } from '../supabase/functions/analyze-lead/scanner-client.ts';

test('scanner forwards the user session and lead ID only and rejects redirects', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://www.leadscope.pro');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fixture');
    assert.deepEqual(JSON.parse(options.body), { leadId: 'fixture-lead' });
    return Response.json({ reason: 'The website returned HTTP 403.', browserUrl: 'https://example.com/' });
  });
  const result = await requestWebsiteScan('fixture-lead', 'Bearer fixture');
  assert.equal(result.browserUrl, 'https://example.com/');
  await assert.rejects(requestWebsiteScan('fixture-lead', 'Bearer fixture', 'http://example.com/'), /configuration is invalid/);
  assert.equal(mock.mock.callCount(), 1);
});

test('scanner service authorization and upstream errors remain distinct', async (t) => {
  let status = 401;
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status }));
  await assert.rejects(requestWebsiteScan('fixture-lead', 'Bearer fixture'), /authorization was rejected/);
  status = 503;
  await assert.rejects(requestWebsiteScan('fixture-lead', 'Bearer fixture'), /returned HTTP 503/);
});
