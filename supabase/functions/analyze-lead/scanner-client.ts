import type { WebsiteEvidence } from "./website-evidence.ts";

const productionScanner = "https://www.leadscope.pro/api/scan-lead-website";

type ScanResponse =
  | { evidence: WebsiteEvidence; browserUrl?: string }
  | { reason: string; browserUrl?: string };

export async function requestWebsiteScan(url: string, key: string, endpoint = productionScanner): Promise<ScanResponse> {
  const timestamp = Date.now();
  const encoder = new TextEncoder();
  const signingKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC", signingKey, encoder.encode(JSON.stringify(["lead-website-scan-v1", timestamp, url])),
  );
  const digest = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
    headers: { "Content-Type": "application/json", "X-Scan-Signature": digest },
    body: JSON.stringify({ url, timestamp }),
  });
  if (!response.ok) throw new Error("Website scanner service unavailable.");
  return await response.json() as ScanResponse;
}
