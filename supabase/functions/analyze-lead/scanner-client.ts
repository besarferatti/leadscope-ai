import type { WebsiteEvidence } from "./website-evidence.ts";

const productionScanner = "https://www.leadscope.pro/api/scan-lead-website";

type ScanResponse =
  | { evidence: WebsiteEvidence; browserUrl?: string }
  | { reason: string; browserUrl?: string };

export async function requestWebsiteScan(leadId: string, authorization: string, endpoint = productionScanner): Promise<ScanResponse> {
  const destination = new URL(endpoint);
  if (destination.protocol !== "https:" || destination.username || destination.password) {
    throw new Error("Scanner endpoint configuration is invalid.");
  }
  const response = await fetch(destination, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(18_000),
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ leadId }),
  });
  if (response.status === 401) throw new Error("Scanner authorization was rejected.");
  if (response.status === 403 || response.status === 404) throw new Error("Scanner could not access the lead.");
  if (!response.ok) throw new Error(`Scanner returned HTTP ${response.status}.`);
  const result = await response.json() as ScanResponse;
  if (!result || typeof result !== "object" || (!("evidence" in result) && !("reason" in result))) {
    throw new Error("Scanner returned an invalid response.");
  }
  return result;
}
