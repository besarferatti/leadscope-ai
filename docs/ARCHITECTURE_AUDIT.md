# LeadScope AI: repository audit

Inspected baseline: `9a9da14` on `main`. Audit date: 2026-10-16 (Europe/Skopje).
Scope: tracked file inventory, source/import/dependency scan, application pages and entry points, all API/Edge endpoint boundaries, migration/policy definitions, build configuration and workflow. Deep review focused on authorization, billing, discovery and outbound email. This is not a claim that every UI state or hosted integration has been exercised. No deployed database, account, secrets or customer data were accessed.

## Architecture and existing capabilities

| Layer | Actual implementation |
| --- | --- |
| Browser | React 18, Vite, TypeScript, Tailwind 3; custom routing in `src/App.tsx`; Supabase session context |
| Database | Supabase Postgres; user profiles/settings, leads/searches/audits/messages, Stripe records, campaigns/members/steps, SMTP settings, discovery jobs, caches, referrals |
| Edge functions | Lead discovery, AI audits/outreach/previews, public report translation, Stripe checkout/portal/webhook/sync, SMTP settings/test |
| Node APIs | Eight Vercel handlers: discovery/queue, outreach sending, reply sync, SMTP testing, product-update send/test/unsubscribe |
| Existing product | Signup/login/password change, plan display, manual/CSV leads, Places search/cache, filtering/saved leads/notes, AI audit/SEO pack, generated editable outreach, previews, shared reports, campaigns, suppression, reply tracking, affiliates and admin screens |
| Automation | GitHub scheduled queue calls the literal `https://leadscope.pro/api/process-email-discovery-queue`; do not dispatch this workflow during development |
| Billing | Stripe customer/subscription tables and plan mapping; monthly counters; no transactional credit ledger located |
| Missing integrations | No implemented WhatsApp/AI calling provider workflow or general notification model located; CRM currently relies on lead statuses rather than a complete pipeline subsystem |

The repository contains live-domain references and a scheduled workflow despite the request describing a non-live project. Treat all external integrations as production until independently established otherwise.

## Findings and disposition

| Priority | Finding / evidence | Disposition |
| --- | --- | --- |
| P0 | Profile owner UPDATE/INSERT policies permit client-assigned role/plan/trial/account fields (`user_profiles` migrations, `AuthContext`) | Branch adds field guard, removes direct INSERT, and adds trusted profile recovery; 24 database tests. Not deployed. |
| P0 | Usage counters and resets writable by clients; non-atomic read/update (`src/lib/plans.ts`); server quota check/increment races | Open. Must replace with database transactions/reservations and remove browser accounting before protecting those fields. |
| P0 | `analyze-lead` fetches user-supplied websites with automatic redirects and buffers full response before truncating | Open SSRF/resource exhaustion hardening. |
| P0 | Email discovery validates DNS separately from fetch; IPv6 mapped addresses and DNS rebinding require stronger protections | Open; use bounded, pinned outbound fetches with redirect validation and adversarial tests. |
| P0 | SMTP/IMAP hosts are user-configurable; no comprehensive private-network boundary | Open; establish safe host/port resolution and transport pinning. |
| P0 | Stripe webhook acknowledges before background processing; missing-subscription branch writes `subscription_status` instead of `status`, then dereferences absent subscription; profile write errors swallowed | Open; acknowledged-event loss and state inconsistency risk. Add durable idempotency and await persistence. |
| P0 | Dependency baseline: 35 advisories, including mailer/native renderer; after compatible fixes, mailer upgrade/removing unused renderer: 13 remain in dev tools | Runtime audit clean; full audit remains a failing release gate. Do not use force upgrades without compatibility checks. |
| P1 | Campaign-member policy checks campaign owner, not linked lead/message ownership | Open; enforce relational ownership on writes and tests for foreign IDs. |
| P1 | Inactive-account enforcement inconsistent across Node handlers and role-based policies; `is_admin_user` hardened only where used | Open system-wide account suspension tests. |
| P1 | Send handler checks suppression only for campaign sends; read-then-send race and no idempotency key | Open; universal suppression, transactional reservation, safe ambiguous-delivery handling. |
| P1 | Discovery queue has no stale-running lease recovery or explicit fetch deadline; accepts user-writable attempts/state | Open queue lifecycle and ownership hardening. |
| P1 | Public translation incurs AI work per request without evident persistent cache/rate limiter | Open cost-abuse guard. No AI calls were made. |
| P1 | Checkout accepts client-selected price/mode/return URLs; portal accepts client return URL | Open allowlists, subscription lifecycle tests. |
| P1 | Five overlapping Stripe schema migrations create the same policies/types/views; `seo_content_pack` referenced without an ADD COLUMN in tracked migrations | Fresh bootstrap blocker; reconcile migration history and inventory staging schema before rollout. |
| P1 | Auth asynchronous loads may race sign-out/user switching; forced-password completion flag client writable | Open auth lifecycle regression tests and server-enforced password state. |
| P2 | No baseline tests/validation CI; baseline typecheck excludes APIs/Edge functions; nine hook/refresh lint warnings | Tests, API typecheck and safe CI added; Edge checks and UI lifecycle coverage remain. |
| P2 | Tracked stale `dist` assets; ~643 kB main JS bundle; README only Bolt link | Keep generated output out of this change; plan artifact cleanup/code splitting and deployment documentation. |

## Verification limits

PGlite runs actual PostgreSQL SQL/roles/policies using a minimal local auth fixture, not the Supabase gateway or a real hosted auth stack. Full migration replay was separately attempted and failed on legacy duplicate Stripe policy definitions. API tests cover method/auth rejection and offline mail composition, not authenticated successful delivery. No Stripe, OpenAI, Places, SMTP, IMAP, customer outreach or deployed infrastructure calls were exercised. Local dependency auditing contacts the package registry only.
