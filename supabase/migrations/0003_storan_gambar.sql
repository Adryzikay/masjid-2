-- =====================================================================
-- 0003 — Storage: bucket "gambar"
-- Bucket awam = sesiapa boleh MELIHAT gambar melalui URL awam.
-- Muat naik / ganti / padam: admin sahaja. Jalankan selepas 0002.
-- =====================================================================

-- Had 1 MB setiap fail dan jenis imej sahaja. Panel admin memampatkan
-- gambar ke ~300 KB sebelum muat naik; had ini ialah jaring keselamatan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gambar', 'gambar', true, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Tiada polisi untuk "anon": orang awam tidak boleh menyenarai, memuat
-- naik atau memadam. (URL awam bucket tidak melalui polisi ini.)
drop policy if exists "gambar: admin lihat" on storage.objects;
drop policy if exists "gambar: admin muat naik" on storage.objects;
drop policy if exists "gambar: admin kemas kini" on storage.objects;
drop policy if exists "gambar: admin padam" on storage.objects;

create policy "gambar: admin lihat" on storage.objects
  for select to authenticated
  using (bucket_id = 'gambar' and (select public.is_admin()));

create policy "gambar: admin muat naik" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gambar'
    and (select public.is_admin())
    and (storage.foldername(name))[1] in ('aktiviti', 'program')
  );

create policy "gambar: admin kemas kini" on storage.objects
  for update to authenticated
  using (bucket_id = 'gambar' and (select public.is_admin()))
  with check (
    bucket_id = 'gambar'
    and (select public.is_admin())
    and (storage.foldername(name))[1] in ('aktiviti', 'program')
  );

create policy "gambar: admin padam" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gambar' and (select public.is_admin()));
