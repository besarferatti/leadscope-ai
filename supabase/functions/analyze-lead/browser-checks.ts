const checks = {
  viewport: "Mobile viewport configuration",
  "color-contrast": "Text contrast",
  "link-name": "Accessible link labels",
  "button-name": "Accessible button labels",
  "target-size": "Tap target size or spacing",
  "image-alt": "Image text alternatives",
} as const;

type Device = "mobile" | "desktop";
type Diagnostic = { label: string; detail?: string };

export type BrowserCheck =
  | { device: Device; status: "unavailable"; reason: string }
  | {
    device: Device;
    status: "measured";
    performance: number | null;
    lcpMs: number | null;
    cls: number | null;
    screenshot?: string;
    diagnostics: Diagnostic[];
  };

type LighthouseAudit = {
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: { data?: string };
};

type LighthouseResponse = {
  id?: string;
  lighthouseResult?: {
    runtimeError?: unknown;
    categories?: { performance?: { score?: number } };
    audits?: Record<string, LighthouseAudit>;
  };
};

const metric = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

async function measure(
  page: string,
  device: Device,
  key: string,
  request: typeof fetch,
): Promise<BrowserCheck> {
  const unavailable = (reason: string): BrowserCheck => ({ device, status: "unavailable", reason });
  const endpoint = new URL("https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", page);
  endpoint.searchParams.set("strategy", device);
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "accessibility");
  endpoint.searchParams.set("fields", "id,lighthouseResult(runtimeError,categories/performance/score,audits)");
  endpoint.searchParams.set("key", key);

  try {
    const response = await request(endpoint, { signal: AbortSignal.timeout(22_000), redirect: "error" });
    if (response.status === 429) return unavailable("PageSpeed quota exceeded.");
    if (!response.ok) return unavailable("PageSpeed could not measure this page.");
    const { id, lighthouseResult: result } = await response.json() as LighthouseResponse;
    if (!result?.audits || result.runtimeError || !id) {
      return unavailable("PageSpeed returned no usable browser results.");
    }
    const final = new URL(id);
    if (final.origin + final.pathname !== page || final.search) {
      return unavailable("PageSpeed was redirected to a different page.");
    }
    const { audits } = result;
    const screenshot = audits["final-screenshot"]?.details?.data;
    const score = metric(result.categories?.performance?.score);

    return {
      device,
      status: "measured",
      performance: score !== null && score <= 1 ? Math.round(score * 100) : null,
      lcpMs: metric(audits["largest-contentful-paint"]?.numericValue),
      cls: metric(audits["cumulative-layout-shift"]?.numericValue),
      screenshot: typeof screenshot === "string" && screenshot.length <= 160_000 &&
          /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(screenshot) ? screenshot : undefined,
      diagnostics: Object.entries(checks).flatMap(([id, label]) => {
        const audit = audits[id];
        if (!audit || typeof audit.score !== "number" || audit.score >= 1 ||
            (audit.scoreDisplayMode !== "binary" && audit.scoreDisplayMode !== "numeric")) return [];
        return [{ label, detail: typeof audit.displayValue === "string" ? audit.displayValue.slice(0, 160) : undefined }];
      }),
    };
  } catch {
    return unavailable("The PageSpeed browser check did not complete.");
  }
}

export function runBrowserChecks(page: string, key: string, request = fetch): Promise<BrowserCheck[]> {
  if (!key) {
    return Promise.resolve([
      { device: "mobile", status: "unavailable", reason: "PageSpeed is not configured." },
      { device: "desktop", status: "unavailable", reason: "PageSpeed is not configured." },
    ]);
  }
  return Promise.all([measure(page, "mobile", key, request), measure(page, "desktop", key, request)]);
}

export function browserEvidenceForPrompt(results: BrowserCheck[]) {
  return results.map((result) => {
    if (result.status === "unavailable") return { device: result.device, status: result.status };
    const { device, status, performance, lcpMs, cls, diagnostics } = result;
    return { device, status, performance, lcpMs, cls, diagnostics };
  });
}
