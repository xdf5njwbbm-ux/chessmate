-- Private cache for neural text-to-speech audio. Only the `speech` edge
-- function (service role) reads and writes it; clients have no access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', false, 2097152, array['audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
