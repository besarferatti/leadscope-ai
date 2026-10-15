import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// High-confidence local scan only. Never print matched credential values.
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk_live_|sk_test_|sk-proj-|ghp_)[A-Za-z0-9_-]{24,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let findings = 0;
for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  if (content.includes('\0')) continue;
  let dangerousJwt = false;
  for (const jwt of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { dangerousJwt ||= JSON.parse(Buffer.from(jwt[1], 'base64url').toString()).role === 'service_role'; } catch { /* not a JWT */ }
  }
  if (dangerousJwt || patterns.some(pattern => pattern.test(content))) {
    console.error(`Potential credential in ${file}; value redacted`);
    findings++;
  }
}
console.log(`High-confidence credential scan: ${files.length} tracked files, ${findings} findings`);
process.exitCode = findings ? 1 : 0;
