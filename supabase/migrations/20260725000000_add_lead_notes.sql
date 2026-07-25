alter table public.leads
add column if not exists notes text null,
add column if not exists notes_updated_at timestamptz null;
