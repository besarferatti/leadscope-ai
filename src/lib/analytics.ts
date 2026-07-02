const GA_MEASUREMENT_ID = 'G-C9K9QRW2PG';
const GA_SCRIPT_ID = 'google-analytics-gtag';

type GtagCommand = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: GtagCommand[];
    gtag?: (...args: GtagCommand) => void;
  }
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function initAnalytics() {
  try {
    if (!isBrowser()) return;

    if (!document.getElementById(GA_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = GA_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: GtagCommand) {
      window.dataLayer?.push(args);
    };

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
  } catch (_) {
    // Analytics must never break the app.
  }
}

export function trackPageView(path: string) {
  try {
    if (!isBrowser() || !window.gtag) return;
    window.gtag('config', GA_MEASUREMENT_ID, { page_path: path });
  } catch (_) {
    // Analytics must never break the app.
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    if (!isBrowser() || !window.gtag) return;
    window.gtag('event', eventName, params ?? {});
  } catch (_) {
    // Analytics must never break the app.
  }
}
