import assert from 'node:assert/strict';
import test from 'node:test';
import { readWebsiteEvidence, unavailableEvidence, verifiedIssues } from '../supabase/functions/analyze-lead/website-evidence.ts';

test('extracts page structure without mistaking decorative images or scripts for missing content', () => {
  const evidence = readWebsiteEvidence(
    '<html lang=en><h2>Services</h2><img alt=""><img src="product.jpg">' +
    '<script>const fake = "<form></form>";</script><form><a href="tel:+12125550100">Call</a></form>' +
    '<a href="/contact">Contact</a><a href="/about">About</a></html>',
    'https://example.com', false,
  );
  assert.deepEqual(evidence.structure, { h2Count: 1, language: 'en', imagesWithoutAlt: 1, forms: 1, contactLinks: 2 });
});

test('recognizes real homepage signals and verifies HTTPS on the final URL', () => {
  const evidence = readWebsiteEvidence(
    '<title>Wedding Bands | NYC Wholesale Diamonds</title>' +
    '<meta content="NYC Wholesale Diamonds has certified diamonds" name = description>' +
    '<link rel="canonical" href="/index.html"><meta name="robots" content="All">' +
    '<h1><i>Engagement rings &amp; wedding bands</i></h1>',
    'https://www.nycwholesalediamonds.com/index.html?tracking=private', false,
  );
  assert.equal(evidence.url, 'https://www.nycwholesalediamonds.com/index.html');
  assert.equal(evidence.title, 'Wedding Bands | NYC Wholesale Diamonds');
  assert.equal(evidence.description, 'NYC Wholesale Diamonds has certified diamonds');
  assert.deepEqual(evidence.headings, ['Engagement rings & wedding bands']);
  assert.equal(evidence.canonical, true);
  assert.deepEqual(verifiedIssues(evidence), ['No viewport declaration was detected in the downloaded HTML.']);
});

test('unavailable and partial scans never report missing tags', () => {
  assert.deepEqual(verifiedIssues(unavailableEvidence('Timeout')), []);
  assert.deepEqual(verifiedIssues(readWebsiteEvidence(' ', 'https://example.com', false)), []);
  assert.deepEqual(verifiedIssues(readWebsiteEvidence('<html>', 'https://example.com', true)), []);
});

test('reports observed noindex and HTTP, and ignores fake tags in scripts and comments', () => {
  const evidence = readWebsiteEvidence(
    '<!-- <title>Fake title</title> --><script>const fake = "<h1>Fake heading</h1>";</script>' +
    '<meta name=robots content=noindex>',
    'http://example.com', false,
  );
  assert.deepEqual(verifiedIssues(evidence), [
    'The final page URL was served over HTTP.',
    'The downloaded HTML contains a robots meta tag with noindex.',
    'No non-empty title was detected in the downloaded HTML.',
    'No non-empty meta description was detected in the downloaded HTML.',
    'No non-empty H1 was detected in the downloaded HTML.',
    'No viewport declaration was detected in the downloaded HTML.',
  ]);
});
