/*
# Public audit share links (repo tracking only)

Apply manually in the Supabase SQL Editor. Do not run `npx supabase db push` for this change.
Adds optional share metadata to existing audits and exposes a limited public-report RPC by token.
*/

alter table public.lead_audits
add column if not exists share_token text unique;

alter table public.lead_audits
add column if not exists shared_at timestamptz;

create index if not exists idx_lead_audits_share_token
on public.lead_audits (share_token)
where share_token is not null;

create or replace function public.get_shared_audit_report(token text)
returns table (
  business_name text,
  website text,
  location text,
  lead_score int,
  website_score int,
  seo_score int,
  conversion_score int,
  main_issues text[],
  recommended_offer text,
  personalization_angle text,
  summary text,
  seo_content_pack jsonb,
  shared_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.business_name,
    l.website,
    l.location,
    l.lead_score,
    a.website_score,
    a.seo_score,
    a.conversion_score,
    a.main_issues,
    a.recommended_offer,
    a.personalization_angle,
    a.summary,
    case
      when a.seo_content_pack is null then null
      else a.seo_content_pack - 'suggested_pricing'
    end as seo_content_pack,
    a.shared_at
  from public.lead_audits a
  join public.leads l on l.id = a.lead_id
  where a.share_token = token
  limit 1;
$$;

revoke all on function public.get_shared_audit_report(text) from public;
grant execute on function public.get_shared_audit_report(text) to anon, authenticated;

notify pgrst, 'reload schema';
