alter table public.leads
add column if not exists saved_at timestamptz null;

create index if not exists idx_leads_saved_at
on public.leads(user_id, saved_at)
where saved_at is not null;
