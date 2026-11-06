# Test results

Session: 2026-10-16 (Europe/Skopje). No production credentials or services used.

## Baseline (`9a9da14`)

| Check | Actual result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Passed |
| `npm run lint` | Failed: 13 errors, 9 warnings |
| `npm run typecheck` | Passed; baseline covered only `src` |
| `npm run build` | Passed; >500 kB chunk warning |
| Automated tests | No test script/suite present |
| `npm audit --json` | Failed security audit: 35 advisories, 27 high / 6 moderate / 2 low |

## Branch verification after implementation

| Check | Actual result and scope |
| --- | --- |
| Clean lockfile install, `npm ci --ignore-scripts --no-audit --no-fund` | Passed: 318 packages installed |
| `npm run lint` | Passed exit 0: 0 errors, 9 existing hook/refresh warnings |
| `npm run typecheck` | Passed: strict frontend and all eight Node API handlers |
| `npm test` | Passed: 34 tests, 0 failed/skipped |
| `npm run build` | Passed: Vite 5.4.21; main JS ~642.76 kB (gzip ~163.69 kB); chunk-size warning remains |
| `npm audit --omit=dev --audit-level=high` | Passed: 0 runtime vulnerabilities reported |
| Full `npm audit --json` | Failed security gate: 13 advisories, 7 high / 4 moderate / 2 low; dev tooling |
| Fresh migration replay in PGlite | Failed after 6 migrations on `20260626051418_polished_feather.sql`: duplicate Stripe customer policy (`42710`) |
| High-confidence credential scan | Passed: 139 tracked files, 0 findings; heuristic scan, not comprehensive secret detection |
| `git diff --cached --check` | Passed |
| Deno check of four modified Stripe Edge functions | Not completed: first attempt failed on local package-version resolution; retry with `--node-modules-dir=none --no-lock` stalled fetching remote imports and was terminated. No Deno typecheck pass claimed. |
| Production/staging migration application | Not run |
| Browser end-to-end tests / real Stripe, Places, AI, SMTP, IMAP integration | Not run; require isolated integration setup; production access not used |

The SQL suite uses actual in-memory PostgreSQL via PGlite with synthetic `auth.users`, `auth.uid()` and roles. It applies the existing profile migrations plus the new hardening migration; it is not a full Supabase integration test.

## Regression coverage

- Owner denial for ten protected profile fields; client INSERT and upsert denial.
- Cross-account SELECT/UPDATE restrictions.
- Legitimate name/password-completion edits and current legacy usage-write compatibility.
- Trusted recovery rejects metadata-based role/plan escalation; uses original signup date; repeated calls preserve paid profiles.
- Anonymous/missing-identity recovery rejection.
- Active admin management, inactive-admin self-reactivation denial, service-role billing update compatibility.
- Signup trigger compatibility and migration reapplication.
- Six Node APIs reject unsupported methods and anonymous requests before external work.
- Queue authorization and unsubscribe input boundaries.
- Offline Nodemailer text/HTML/reply-to/envelope/unsubscribe-header composition. No SMTP connection or delivery attempted.

## Remaining dependency findings

`@eslint/plugin-kit`, `eslint`, `@vitejs/plugin-react`, `brace-expansion`, `braces`, `chokidar`, `fast-glob`, `micromatch`, `esbuild`, `vite`, `postcss-nested`, `postcss-selector-parser`, `tailwindcss`.

Compatible fixes reduced findings; unused native rendering dependencies were removed. Remaining build/CSS major upgrades need a compatibility batch. Full audit remains enforced in CI and is expected to fail until resolved. Passing tests do not waive this gate.
