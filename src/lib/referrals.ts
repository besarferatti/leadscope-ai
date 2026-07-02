import { supabase } from './supabase';

const REFERRAL_CODE_KEY = 'leadscope_referral_code';
const REFERRAL_SEEN_AT_KEY = 'leadscope_referral_seen_at';
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeReferralCode(code: string | null | undefined) {
  const normalized = (code ?? '').trim().toLowerCase();
  if (!normalized || !/^[a-z0-9_-]+$/.test(normalized)) return '';
  return normalized;
}

export function getStoredReferralCode() {
  try {
    const code = normalizeReferralCode(localStorage.getItem(REFERRAL_CODE_KEY));
    const seenAt = Number(localStorage.getItem(REFERRAL_SEEN_AT_KEY) ?? '0');

    if (!code || !seenAt || Date.now() - seenAt > REFERRAL_TTL_MS) {
      clearStoredReferralCode();
      return '';
    }

    return code;
  } catch (_) {
    return '';
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_CODE_KEY);
    localStorage.removeItem(REFERRAL_SEEN_AT_KEY);
  } catch (_) {
    // Ignore storage failures.
  }
}

export async function captureReferralFromUrl() {
  try {
    const code = normalizeReferralCode(new URLSearchParams(window.location.search).get('ref'));
    if (!code) {
      getStoredReferralCode();
      return;
    }

    localStorage.setItem(REFERRAL_CODE_KEY, code);
    localStorage.setItem(REFERRAL_SEEN_AT_KEY, String(Date.now()));

    await supabase.rpc('track_affiliate_click', { p_referral_code: code });
  } catch (_) {
    // Referral tracking should never break the app.
  }
}
