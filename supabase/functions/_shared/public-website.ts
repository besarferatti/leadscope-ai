import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 5;

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) || address === "168.63.129.16");
  }
  if (isIP(address) !== 6) return false;
  // Restrict IPv6 to global unicast and exclude special, transition and documentation prefixes.
  const normalized = new URL("http://[" + address + "]").hostname.slice(1, -1);
  const [first, second] = normalized.split(":");
  return /^[23][0-9a-f]{3}$/.test(first) &&
    first !== "2002" && first !== "3fff" &&
    !(first === "2001" && (second === "" || parseInt(second, 16) <= 0x1ff || second === "db8"));
}

function hostnameOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "");
}

async function resolvePublicAddress(url: URL, signal: AbortSignal, resolve: typeof lookup): Promise<string> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new Error("Unsupported website URL.");
  }
  const hostname = hostnameOf(url);
  const domain = hostname.replace(/\.$/, "");
  if (!isIP(hostname) && (!domain.includes(".") || /\.(localhost|local|internal|test|invalid|onion|home\.arpa)$/.test(domain))) {
    throw new Error("Website destination is not public.");
  }
  signal.throwIfAborted();
  const addresses = isIP(hostname) ? [{ address: hostname }] : await new Promise<{ address: string }[]>((done, fail) => {
    const abort = () => fail(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void resolve(hostname, { all: true }).then(done, fail).finally(() => signal.removeEventListener("abort", abort));
  });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Website destination is not public.");
  }
  return addresses.find(({ address }) => isIP(address) === 4)?.address ?? addresses[0].address;
}

function requestPage(url: URL, address: string, signal: AbortSignal): Promise<IncomingMessage> {
  const tls = url.protocol === "https:";
  const originalHost = hostnameOf(url).replace(/\.$/, "");
  const request = tls ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request({
      // Connect to the checked address directly. The URL hostname is used only for HTTP and TLS identity.
      hostname: address,
      path: url.pathname + url.search,
      agent: false,
      signal,
      headers: { Host: url.host, Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
      ...(tls ? {
        servername: isIP(originalHost) ? "" : originalHost,
        checkServerIdentity: (_: string, cert: Parameters<typeof checkServerIdentity>[1]) =>
          checkServerIdentity(originalHost, cert),
      } : {}),
    }, resolve);
    req.on("error", reject);
    req.end();
  });
}

export async function validatePublicWebsite(url: URL, signal: AbortSignal): Promise<void> {
  await resolvePublicAddress(url, signal, lookup);
}

export async function fetchPublicHtml(
  initialUrl: URL,
  signal: AbortSignal,
  { resolve = lookup, open = requestPage, maxBytes = 60_000 } = {},
): Promise<{ html: string; url: string; truncated: boolean }> {
  let url = initialUrl;
  for (let redirects = 0; ; redirects++) {
    const address = await resolvePublicAddress(url, signal, resolve);
    const response = await open(url, address, signal);
    try {
      const status = response.statusCode ?? 0;
      if (redirectStatuses.has(status)) {
        if (redirects >= maxRedirects || !response.headers.location) throw new Error("Invalid website redirect.");
        url = new URL(response.headers.location, url);
        continue;
      }
      if (status < 200 || status >= 300) throw new Error("Website returned HTTP " + status + ".");
      const type = response.headers["content-type"]?.toLowerCase() ?? "";
      if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
        throw new Error("Website response was not HTML.");
      }
      const encoding = response.headers["content-encoding"];
      if (encoding && encoding.toLowerCase() !== "identity") throw new Error("Unsupported website encoding.");
      const decoder = new TextDecoder();
      let html = "";
      let size = 0;
      for await (const chunk of response) {
        const bytes = chunk.subarray(0, maxBytes - size);
        html += decoder.decode(bytes, { stream: true });
        size += bytes.length;
        if (size >= maxBytes) break;
      }
      return { html: html + decoder.decode(), url: url.toString(), truncated: size >= maxBytes };
    } finally {
      response.destroy();
    }
  }
}
