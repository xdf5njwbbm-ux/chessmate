-- Chessmate — profile photo storage
-- Private bucket. Signed-in members can view photos (via short-lived signed
-- URLs); each member can only write inside their own folder: <user_id>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "photos: members can view"
on storage.objects for select to authenticated
using (bucket_id = 'photos' and (select public.app_uid()) is not null);

create policy "photos: upload to own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.app_uid())::text);

create policy "photos: update own"
on storage.objects for update to authenticated
using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.app_uid())::text)
with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.app_uid())::text);

create policy "photos: delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.app_uid())::text);
