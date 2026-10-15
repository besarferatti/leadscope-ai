# LeadScope AI

React/Vite SaaS frontend, Supabase Auth/Postgres/Edge Functions, and Vercel Node API handlers.

Development is on `codex/production-readiness-foundation`. **Not ready for production:** read [PROGRESS.md](PROGRESS.md), [TASKS.md](TASKS.md), [TEST_RESULTS.md](TEST_RESULTS.md), and [the architecture audit](docs/ARCHITECTURE_AUDIT.md).

## Local verification

Use Node 24 and npm with the committed lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run build
npm run check:secrets
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

Tests use only synthetic data and an in-memory PostgreSQL database. Mail composition uses an offline stream transport. Do not configure production keys for tests. Typecheck covers browser and Node APIs; Deno Edge checks are separate. The full dependency audit intentionally remains a blocking gate while development-tool advisories are unresolved.

To run the UI against an isolated development project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in an ignored `.env.local`, then run `npm run dev`. Only public configuration may have a `VITE_` prefix. Never put a service-role key or provider secret in browser environment variables. The production build alone does not verify login or server integrations.

## Database rollout boundary

The migration history currently does not replay cleanly on an empty database. Do not run a blind `supabase db push` against any existing project. New profile hardening is in `supabase/migrations/20261016000000_harden_profile_authorization.sql`, tested against local auth/profile fixtures. Reconcile staging migration history and test there first. The new migration must precede deployment of the updated profile recovery client.

## External side effects

No tests require Stripe, OpenAI, Google Places, SMTP or IMAP credentials. Do not run production endpoints or the existing `Process email discovery queue` workflow as verification. This branch disables its Vercel Git auto-deployment. Production changes, real outreach, and paid API use require explicit user authorization.
