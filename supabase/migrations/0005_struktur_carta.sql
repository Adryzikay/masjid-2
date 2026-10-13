-- =====================================================================
-- 0005 — Carta Organisasi dinamik
-- Jalankan selepas 0004. Migrasi ini mengekalkan nama terkini dalam carta.
-- =====================================================================

create table public.carta_struktur (
  id               text primary key check (id = 'utama'),
  struktur         jsonb not null check (
    jsonb_typeof(struktur) = 'object'
    and coalesce(jsonb_typeof(struktur -> 'ajk') = 'array', false)
    and coalesce(jsonb_typeof(struktur -> 'kakitangan') = 'array', false)
  ),
  dikemaskini_pada timestamptz not null default now()
);

create trigger carta_struktur_dikemaskini before update on public.carta_struktur
  for each row execute function public.set_dikemaskini_pada();

alter table public.carta_struktur enable row level security;
revoke all on table public.carta_struktur from anon, authenticated;
grant select on table public.carta_struktur to anon, authenticated;
grant insert, update, delete on table public.carta_struktur to authenticated;

create policy "awam boleh baca struktur carta" on public.carta_struktur
  for select to anon, authenticated using (true);
create policy "admin boleh tambah struktur carta" on public.carta_struktur
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin boleh kemas kini struktur carta" on public.carta_struktur
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin boleh padam struktur carta" on public.carta_struktur
  for delete to authenticated using ((select public.is_admin()));

with sumber (bahagian, kumpulan_id, kumpulan, susunan_kumpulan, susunan_ahli, jawatan, kunci_lama, nama_asal) as (
  values
    ('ajk', 'kepimpinan', 'Kepimpinan', 1, 1, 'Penaung', 'ajk_penaung', null),
    ('ajk', 'kepimpinan', 'Kepimpinan', 1, 2, 'Penasihat', 'ajk_penasihat', null),
    ('ajk', 'kepimpinan', 'Kepimpinan', 1, 3, 'Pengerusi', 'ajk_pengerusi', null),
    ('ajk', 'kepimpinan', 'Kepimpinan', 1, 4, 'Bendahari', 'ajk_bendahari', null),
    ('ajk', 'kepimpinan', 'Kepimpinan', 1, 5, 'Setiausaha', 'ajk_setiausaha', null),
    ('ajk', 'kepimpinan', 'Kepimpinan', 1, 6, 'Timbalan Pengerusi', 'ajk_timbalan_pengerusi', null),
    ('ajk', 'biro_pembangunan', 'Biro Pembangunan & Keselamatan', 2, 1, 'Ahli Biro', 'biro_pembangunan_1', null),
    ('ajk', 'biro_pembangunan', 'Biro Pembangunan & Keselamatan', 2, 2, 'Ahli Biro', 'biro_pembangunan_2', null),
    ('ajk', 'biro_dakwah', 'Biro Dakwah & Perayaan', 3, 1, 'Ahli Biro', 'biro_dakwah_1', null),
    ('ajk', 'biro_dakwah', 'Biro Dakwah & Perayaan', 3, 2, 'Ahli Biro', 'biro_dakwah_2', null),
    ('ajk', 'biro_pendidikan', 'Biro Pendidikan', 4, 1, 'Ahli Biro', 'biro_pendidikan_1', null),
    ('ajk', 'biro_pendidikan', 'Biro Pendidikan', 4, 2, 'Ahli Biro', 'biro_pendidikan_2', null),
    ('ajk', 'biro_media', 'Biro Media & Komunikasi', 5, 1, 'Ahli Biro', 'biro_media_1', null),
    ('ajk', 'biro_media', 'Biro Media & Komunikasi', 5, 2, 'Ahli Biro', 'biro_media_2', null),
    ('ajk', 'biro_kebajikan', 'Biro Kebajikan & Kemasyarakatan', 6, 1, 'Ahli Biro', 'biro_kebajikan_1', null),
    ('ajk', 'biro_kebajikan', 'Biro Kebajikan & Kemasyarakatan', 6, 2, 'Ahli Biro', 'biro_kebajikan_2', null),
    ('ajk', 'biro_kebajikan', 'Biro Kebajikan & Kemasyarakatan', 6, 3, 'Ahli Biro', 'biro_kebajikan_3', null),
    ('ajk', 'biro_muslimat', 'Biro Muslimat', 7, 1, 'Ahli Biro', 'biro_muslimat_1', null),
    ('ajk', 'biro_muslimat', 'Biro Muslimat', 7, 2, 'Ahli Biro', 'biro_muslimat_2', null),
    ('ajk', 'biro_belia', 'Biro Belia', 8, 1, 'Ahli Biro', 'biro_belia_1', null),
    ('ajk', 'biro_belia', 'Biro Belia', 8, 2, 'Ahli Biro', 'biro_belia_2', null),
    ('ajk', 'biro_beliawanis', 'Biro Beliawanis', 9, 1, 'Ahli Biro', 'biro_beliawanis_1', null),
    ('ajk', 'biro_beliawanis', 'Biro Beliawanis', 9, 2, 'Ahli Biro', 'biro_beliawanis_2', null),
    ('kakitangan', 'pihak_berkuasa', 'Pihak Berkuasa', 1, 1, 'Majlis Agama Islam Wilayah Persekutuan', null, 'MAIWP'),
    ('kakitangan', 'pihak_berkuasa', 'Pihak Berkuasa', 1, 2, 'Pengarah JAWI', 'jawi_pengarah', null),
    ('kakitangan', 'imam', 'Imam', 2, 1, 'Imam I', 'imam_1', null),
    ('kakitangan', 'imam', 'Imam', 2, 2, 'Imam II', 'imam_2', null),
    ('kakitangan', 'imam', 'Imam', 2, 3, 'Imam III', 'imam_3', null),
    ('kakitangan', 'imam', 'Imam', 2, 4, 'Imam IV', 'imam_4', null),
    ('kakitangan', 'pengurusan', 'Pengurusan Masjid', 3, 1, 'Pegawai Hal Ehwal Islam S41', 'pegawai_islam', null),
    ('kakitangan', 'pengurusan', 'Pengurusan Masjid', 3, 2, 'Penolong Pegawai Hal Ehwal Islam S29', 'penolong_islam', null),
    ('kakitangan', 'pengurusan', 'Pengurusan Masjid', 3, 3, 'Setiausaha Kerja', 'setiausaha_kerja', null),
    ('kakitangan', 'pengurusan', 'Pengurusan Masjid', 3, 4, 'Kerani Akaun', 'kerani_akaun', null),
    ('kakitangan', 'pengurusan', 'Pengurusan Masjid', 3, 5, 'PHEM (Penyelaras Teknikal)', 'phem', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 1, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_1', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 2, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_2', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 3, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_3', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 4, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_4', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 5, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_5', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 6, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_6', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 7, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_7', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 8, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_8', null),
    ('kakitangan', 'pembantu_phem', 'Pembantu Hal Ehwal Masjid', 4, 9, 'Pembantu Hal Ehwal Masjid', 'phem_pembantu_9', null),
    ('kakitangan', 'bilal', 'Bilal', 5, 1, 'Bilal I', 'bilal_1', null),
    ('kakitangan', 'bilal', 'Bilal', 5, 2, 'Bilal II', 'bilal_2', null),
    ('kakitangan', 'bilal', 'Bilal', 5, 3, 'Bilal III', 'bilal_3', null),
    ('kakitangan', 'bilal', 'Bilal', 5, 4, 'Bilal IV', 'bilal_4', null)
), ahli AS (
  select s.bahagian, s.kumpulan_id, s.kumpulan, s.susunan_kumpulan, s.susunan_ahli,
         s.jawatan, coalesce(lama.nama, s.nama_asal) as nama
  from sumber s
  left join public.carta_organisasi lama on lama.kunci = s.kunci_lama
), kumpulan AS (
  select bahagian, kumpulan_id, kumpulan, susunan_kumpulan,
         jsonb_agg(jsonb_build_object('jawatan', jawatan, 'nama', nama) order by susunan_ahli) as ahli
  from ahli
  group by bahagian, kumpulan_id, kumpulan, susunan_kumpulan
), struktur_awal AS (
  select jsonb_build_object(
    'ajk', coalesce((
      select jsonb_agg(jsonb_build_object('tajuk', kumpulan, 'ahli', ahli) order by susunan_kumpulan)
      from kumpulan where bahagian = 'ajk'
    ), '[]'::jsonb),
    'kakitangan', coalesce((
      select jsonb_agg(jsonb_build_object('tajuk', kumpulan, 'ahli', ahli) order by susunan_kumpulan)
      from kumpulan where bahagian = 'kakitangan'
    ), '[]'::jsonb)
  ) as struktur
)
insert into public.carta_struktur (id, struktur)
select 'utama', struktur from struktur_awal;

drop table public.carta_organisasi;