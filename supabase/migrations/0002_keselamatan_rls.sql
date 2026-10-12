-- =====================================================================
-- 0002 — Row Level Security
-- Peraturan: orang awam BACA sahaja. Hanya akaun dalam public.admins
-- boleh tambah / kemas kini / padam. Jalankan selepas 0001.
-- =====================================================================

-- Fungsi semakan admin: hanya untuk pengguna yang sudah log masuk.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- Jadual kandungan ----------
do $$
declare
  t text;
begin
  foreach t in array array['pengumuman', 'aktiviti', 'kuliah', 'program', 'program_gambar', 'tetapan']
  loop
    execute format('alter table public.%I enable row level security', t);

    -- Kebenaran peringkat jadual (disemak SEBELUM RLS): awam = select sahaja.
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on table public.%I to authenticated', t);

    execute format('drop policy if exists "awam boleh baca" on public.%I', t);
    execute format('drop policy if exists "admin boleh tambah" on public.%I', t);
    execute format('drop policy if exists "admin boleh kemas kini" on public.%I', t);
    execute format('drop policy if exists "admin boleh padam" on public.%I', t);

    execute format(
      'create policy "awam boleh baca" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "admin boleh tambah" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format(
      'create policy "admin boleh kemas kini" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format(
      'create policy "admin boleh padam" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- ---------- Senarai admin ----------
-- Tiada polisi insert/update/delete: senarai ini hanya boleh diubah
-- melalui SQL Editor oleh pemilik projek. Setiap pengguna hanya boleh
-- melihat barisnya sendiri (untuk panel admin menyemak "adakah saya admin?").
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

drop policy if exists "pengguna lihat baris sendiri" on public.admins;
create policy "pengguna lihat baris sendiri" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));
