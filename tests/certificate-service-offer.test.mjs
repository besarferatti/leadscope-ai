import assert from 'node:assert/strict';
import test from 'node:test';
import { certificateServiceOffer } from '../supabase/functions/analyze-lead/certificate-service-offer.ts';

test('only a confirmed expired certificate produces a renewal pitch', () => {
  const offer = certificateServiceOffer('The website HTTPS certificate has expired.');
  assert.equal(offer.service_name, 'HTTPS certificate renewal and configuration');
  assert.match(offer.pitch, /expired HTTPS certificate/);
  assert.ok(offer.deliverables.some(item => item.includes('automatic renewal')));
  const unverified = certificateServiceOffer('The website HTTPS certificate could not be verified.');
  assert.equal(unverified.service_name, 'HTTPS certificate troubleshooting');
  assert.doesNotMatch(unverified.pitch, /expired/);
});

test('transient and unrelated scan failures never manufacture a service opportunity', () => {
  for (const reason of [
    'The website took too long to respond.',
    'The website HTML could not be read.',
    'The website returned HTTP 403.',
    'Scanner authorization was rejected.',
    'The website address could not be verified as public.',
    'expired HTTPS certificate',
  ]) assert.equal(certificateServiceOffer(reason), null);
});
