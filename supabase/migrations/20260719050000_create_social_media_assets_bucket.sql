-- Public, immutable-by-convention assets for Buffer drafts. Writes are performed
-- exclusively by server routes using the service-role key (no client policy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media-assets', 'social-media-assets', true, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png'];
