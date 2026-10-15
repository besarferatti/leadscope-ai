# Engineering decisions

## 2026-10-16

1. Preserve React/Vite + Supabase + Vercel architecture. A rewrite would risk working behavior without addressing the immediate security boundaries.
2. Use `codex/production-readiness-foundation`; no changes to `main`, no deployment. Vercel `git.deploymentEnabled` excludes this branch (documented at https://vercel.com/docs/project-configuration/git-configuration).
3. Protect profile authorization columns with a SECURITY INVOKER trigger alongside RLS. Database `current_user` service role/postgres and existing active administrators can manage entitlements; ordinary owners cannot. Do not trust user metadata for authorization.
4. Remove direct client profile INSERT; recover missing profiles with a parameter-free SECURITY DEFINER RPC sourcing identity/email/signup time from `auth.users`. Original signup time prevents recovery from extending an expired trial. Existing profiles are never overwritten.
5. Temporarily preserve legacy usage writes/password completion so this patch does not silently break existing flows. This is explicitly incomplete security work. Atomic accounting and server-controlled password completion remain prioritized tasks.
6. Use Node 24 test runner + PGlite for real SQL regression tests in memory. Do not supply production credentials or connect tests to external services. Minimal auth fixtures are not a substitute for full Supabase staging validation.
7. Fix existing lint failures with catch narrowing/unused binding removal, not rule suppression. Leave unrelated hook dependency warnings for lifecycle-aware tests.
8. Apply compatible dependency patches, remove unreferenced Satori/Sharp after import scan, upgrade Nodemailer to 10.1.1 with offline message construction tests. Do not blindly force Tailwind/Vite major changes: CSS/build compatibility needs a separate verified batch. The full audit remains a blocking CI gate; no waivers or suppressed failures.
9. Keep legacy migration files unchanged pending reconciliation of already-applied history. The new migration must be tested on staging before any rollout. Apply it before the corresponding frontend release so the recovery RPC exists.
10. Preserve checkpoint files in git. No autonomous continuation after a stopped session is promised; the next execution reads GitHub and checkpoints before resuming. Do not dispatch the existing production queue workflow.
