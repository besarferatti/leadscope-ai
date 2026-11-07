export function certificateServiceOffer(reason: string) {
  if (reason !== "The website HTTPS certificate has expired." &&
      reason !== "The website HTTPS certificate could not be verified.") return null;
  const expired = reason === "The website HTTPS certificate has expired.";
  return {
    service_name: expired ? "HTTPS certificate renewal and configuration" : "HTTPS certificate troubleshooting",
    finding: reason,
    pitch: expired
      ? "During a website check, we found an expired HTTPS certificate. We can help renew or configure it, check HTTP-to-HTTPS redirects, and verify automatic renewal."
      : "During a website check, we could not verify your HTTPS certificate. We can investigate the certificate configuration and help restore a trusted connection.",
    deliverables: [
      expired ? "Renew or replace the expired certificate" : "Check the certificate hostname, issuer and certificate chain",
      "Verify HTTPS and HTTP-to-HTTPS redirects",
      "Configure and test automatic renewal where supported",
    ],
    summary: "A certificate issue was detected during the connection attempt. The full website audit could not be completed. Website, SEO and conversion scores are unverified.",
  };
}
