# Prioritized development roadmap

Status: foundation branch in progress; not production-ready. See `PROGRESS.md` before resuming.

## Completed in first implementation batch
- [x] Inventory repository, branches and open PRs; establish baseline checks.
- [x] Profile role/plan/trial/account field guard and trusted missing-profile recovery.
- [x] Database regression tests and offline API/mail tests.
- [x] Fix baseline lint errors without disabling rules.
- [x] Extend typechecking to Node API handlers.
- [x] Compatible dependency fixes; remove unused Satori/Sharp; upgrade Nodemailer with offline compatibility tests.
- [x] Add secret-free validation workflow and branch-specific Vercel auto-deploy exclusion.

## P0: release blockers (next batches, in order)
- [ ] Resolve development-tool dependency advisories in an isolated compatibility batch. Tailwind 3 transitive `braces` has no patched version in current audit; evaluate Tailwind 4 migration with visual regression coverage. Upgrade Vite/plugin and ESLint safely. Full audit must pass before release.
- [ ] Repair reproducible database bootstrap: overlapping Stripe migrations and absent tracked columns. Preserve applied history; design a reviewed baseline/staging reconciliation path rather than blindly replaying migrations on production.
- [ ] Move usage resets/increments to trusted atomic database accounting. Include manual/CSV lead insertion, discovery, AI audit/outreach, concurrency, rollback, duplicate requests and monthly boundaries. Then deny all client counter writes.
- [ ] Replace website fetches and SMTP/IMAP resolution with safe, bounded outbound networking; test private IPv4/IPv6, mapped IPs, DNS rebinding, redirect chains, response limits and timeouts.
- [ ] Repair Stripe webhook acknowledgement, idempotency and empty-subscription behavior; reconcile status/plan/billing cycles; check every persistence error. Use mocked Stripe or test-mode fixtures only.

## P1: product correctness and authorization
- [ ] Tenant relation validation for campaign members, lead search associations and message links.
- [ ] Enforce inactive-account restrictions on every API, Edge function and policy; fix auth load races.
- [ ] Universal suppression and consent states, atomic send reservations, bounded retries, delivery ambiguity, follow-up stop-on-reply. Keep real sending disabled in tests.
- [ ] Queue leases/stale-job recovery, retries/backoff, server-owned state and request deadlines.
- [ ] Database-backed lead deduplication and cache ownership/expiry; bounded enrichment.
- [ ] Credit ledger, subscription entitlements, checkout price/URL allowlists and replay tests.
- [ ] AI response schema validation, public-report translation caching/rate limiting, cost limits.
- [ ] Deno typechecking; integration tests across fresh schema; browser signup/login/profile/campaign flows.

## P2: complete SaaS capability
- [ ] CRM pipeline transitions, notification delivery and campaign/credit analytics.
- [ ] WhatsApp adapter and consent/webhook architecture with mock provider.
- [ ] AI calling adapter, number ownership, budgets, call states and mock events; no paid number purchase.
- [ ] Structured redacted logs, error monitoring, health checks and incident playbooks.
- [ ] Code splitting, list pagination/query plans, accessibility and responsive QA.
- [ ] Staging acceptance, backup/restore rehearsal, explicit production deployment authorization.

Do not add new integrations ahead of unresolved P0 boundaries. Routine local engineering is authorized; production deploys, paid calls and real outreach are not.
