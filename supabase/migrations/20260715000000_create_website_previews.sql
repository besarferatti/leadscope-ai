-- Repo tracking only. Apply manually in the Supabase SQL Editor; do not run db push.
create table if not exists public.website_previews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preview_token text unique not null,
  preview_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_website_previews_token
on public.website_previews(preview_token);

alter table public.website_previews enable row level security;

create policy "Users can manage their own website previews"
on public.website_previews
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.get_public_website_preview(token text)
returns table (
  preview_data jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wp.preview_data,
    wp.created_at
  from public.website_previews wp
  where wp.preview_token = token
  limit 1;
$$;

revoke all on function public.get_public_website_preview(text) from public;
grant execute on function public.get_public_website_preview(text) to anon, authenticated;

notify pgrst, 'reload schema';
