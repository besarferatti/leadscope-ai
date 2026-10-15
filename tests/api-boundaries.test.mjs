import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

function response() {
  return {
    code: 200, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}
const endpoints = [
  'find-lead-email', 'send-outreach-email', 'send-product-update-campaign',
  'send-product-update-test-email', 'sync-outreach-replies', 'test-smtp-connection',
];
for (const endpoint of endpoints) {
  test(`${endpoint}: method and anonymous requests rejected before external work`, async () => {
    const { default: handler } = await import(`../api/${endpoint}.ts`);
    const wrongMethod = response();
    await handler({ method: 'DELETE', headers: {}, body: {} }, wrongMethod);
    assert.equal(wrongMethod.code, 405);
    const anonymous = response();
    await handler({ method: 'POST', headers: {}, body: {} }, anonymous);
    assert.equal(anonymous.code, 401);
  });
}
test('queue rejects missing authorization; never invokes discovery', async () => {
  const { default: handler } = await import('../api/process-email-discovery-queue.ts');
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 401);
});
test('unsubscribe rejects absent and oversized tokens before database work', async () => {
  const { default: handler } = await import('../api/unsubscribe-product-updates.ts');
  for (const token of ['', 'a'.repeat(257)]) {
    const res = response();
    await handler({ method: 'POST', body: { token } }, res);
    assert.equal(res.code, 404);
  }
});
test('upgraded mailer composes existing outreach fields completely offline', async () => {
  // Stream transport composes bytes in memory; it cannot contact SMTP.
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const result = await transport.sendMail({
    from: '"Test Agency" <sender@example.invalid>',
    to: 'lead@example.invalid', replyTo: 'reply@example.invalid',
    subject: 'Website review', text: 'Hello,\nA useful observation.\nRegards, Test',
  });
  assert.deepEqual(result.envelope.to, ['lead@example.invalid']);
  assert.equal(result.envelope.from, 'sender@example.invalid');
  const source = result.message.toString();
  assert.match(source, /Subject: Website review/);
  assert.match(source, /Reply-To: reply@example.invalid/);
  assert.match(source, /A useful observation/);
  assert.ok(result.messageId);
});
test('upgraded mailer preserves newsletter HTML and unsubscribe headers offline', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: 'sender@example.invalid', to: 'reader@example.invalid', subject: 'Product update',
    text: 'A product update', html: '<p>A product update</p>',
    headers: { 'List-Unsubscribe': '<https://example.invalid/unsubscribe/test>' },
  });
  const source = result.message.toString();
  assert.match(source, /multipart\/alternative/);
  assert.match(source, /List-Unsubscribe: <https:\/\/example.invalid\/unsubscribe\/test>/);
  assert.match(source, /<p>A product update<\/p>/);
});
