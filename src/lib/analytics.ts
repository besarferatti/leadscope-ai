const GA_MEASUREMENT_ID = 'G-C9K9QRW2PG';

type GtagCommand = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: GtagCommand[];
    gtag?: (...args: GtagCommand) => void;
  }
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export function initAnalytics() {
  try {
    if (!isBrowser()) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: GtagCommand) {
      window.dataLayer?.push(args);
    };
  } catch (_) {
    // Analytics must never break the app.
  }
}

export function trackPageView(path: string) {
  try {
    if (!isBrowser() || !window.gtag) return;
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: path,
      debug_mode: true,
    });
  } catch (_) {
    // Analytics must never break the app.
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    if (!isBrowser() || !window.gtag) return;
    window.gtag('event', eventName, {
      ...(params ?? {}),
      debug_mode: true,
    });
  } catch (_) {
    // Analytics must never break the app.
  }
}
