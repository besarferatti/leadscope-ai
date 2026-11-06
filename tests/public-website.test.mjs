import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { fetchPublicHtml } from '../supabase/functions/_shared/public-website.ts';

const publicIp = '93.184.216.34';
const signal = () => new AbortController().signal;
const publicDns = async () => [{ address: publicIp, family: 4 }];
const denyOpen = async () => assert.fail('A rejected destination must never be opened');

function reply(statusCode, headers, body = '') {
  return Object.assign(Readable.from([Buffer.from(body)]), { statusCode, headers });
}

test('blocks private and special-use IPs, encoded loopback and unsupported URLs before connecting', async () => {
  for (const value of [
    'http://127.0.0.1', 'http://0x7f000001', 'http://169.254.169.254', 'http://10.0.0.1',
    'http://100.100.100.200', 'http://192.168.1.1', 'http://168.63.129.16',
    'http://[::1]', 'http://[::ffff:7f00:1]', 'http://[fc00::1]', 'http://[fe90::1]',
    'http://[2002:7f00:1::]', 'http://[64:ff9b::7f00:1]',
    'http://localhost', 'https://site.internal', 'https://example.com:8080',
    'https://user@example.com', 'file:///tmp/fixture',
  ]) {
    await assert.rejects(fetchPublicHtml(new URL(value), signal(), { open: denyOpen }), /not public|Unsupported/);
  }
});

test('rejects DNS results that mix public and private addresses', async () => {
  await assert.rejects(fetchPublicHtml(new URL('https://example.com'), signal(), {
    resolve: async () => [{ address: publicIp, family: 4 }, { address: '::1', family: 6 }],
    open: denyOpen,
  }), /not public/);
});

test('validates redirect targets before opening another connection', async () => {
  for (const location of ['http://127.0.0.1/private', 'https://redirect.example.com/private']) {
    let calls = 0;
    await assert.rejects(fetchPublicHtml(new URL('https://example.com'), signal(), {
      resolve: async host => host === 'example.com' ? publicDns() : [{ address: '192.168.0.2', family: 4 }],
      open: async (_, address) => {
        assert.equal(address, publicIp);
        assert.equal(++calls, 1);
        return reply(302, { location });
      },
    }), /not public/);
    assert.equal(calls, 1);
  }
});

test('passes the validated IP to the transport and caps public HTML after redirects', async () => {
  const connections = [];
  const result = await fetchPublicHtml(new URL('https://example.com/start'), signal(), {
    resolve: publicDns,
    open: async (url, address) => {
      connections.push([url.hostname, address]);
      return url.pathname === '/start'
        ? reply(301, { location: 'https://www.example.com/page' })
        : reply(200, { 'content-type': 'text/html' }, 'a'.repeat(60_010));
    },
  });
  assert.deepEqual(connections, [['example.com', publicIp], ['www.example.com', publicIp]]);
  assert.equal(result.url, 'https://www.example.com/page');
  assert.equal(result.html.length, 60_000);
});

test('stops waiting for DNS on abort and never opens a connection', async () => {
  const controller = new AbortController();
  const pending = fetchPublicHtml(new URL('https://example.com'), controller.signal, {
    resolve: () => new Promise(() => {}),
    open: denyOpen,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
