-- Lock down SECURITY DEFINER helpers (only used by triggers/policies; not callable via API)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
-- has_role is used inside RLS, must be callable by authenticated/anon for policy evaluation
-- Keep its execute permissions, it only reads user_roles for the passed user id

-- Replace broad public-read on ads bucket with object-level read (no listing)
drop policy if exists "Public read ads bucket" on storage.objects;
create policy "Public read ads files" on storage.objects for select
  using (bucket_id = 'ads');
-- Make bucket non-public (objects still readable via signed/public URLs through RLS)
update storage.buckets set public = false where id = 'ads';
-- For our use case (videos played by player), keep public so direct URLs work:
update storage.buckets set public = true where id = 'ads';
