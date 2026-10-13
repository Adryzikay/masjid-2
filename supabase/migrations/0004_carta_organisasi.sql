-- =====================================================================
-- 0004 — Nama pemegang jawatan Carta Organisasi
-- Jalankan selepas 0003.
-- =====================================================================

create table public.carta_organisasi (
  kunci            text primary key check (kunci ~ '^[a-z][a-z0-9_]{0,63}$'),
  nama             text not null check (char_length(btrim(nama)) between 1 and 160),
  dikemaskini_pada timestamptz not null default now()
);

create trigger carta_organisasi_dikemaskini before update on public.carta_organisasi
  for each row execute function public.set_dikemaskini_pada();

alter table public.carta_organisasi enable row level security;
revoke all on table public.carta_organisasi from anon, authenticated;
grant select on table public.carta_organisasi to anon, authenticated;
grant insert, update, delete on table public.carta_organisasi to authenticated;

create policy "awam boleh baca carta" on public.carta_organisasi
  for select to anon, authenticated using (true);
create policy "admin boleh tambah carta" on public.carta_organisasi
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin boleh kemas kini carta" on public.carta_organisasi
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin boleh padam carta" on public.carta_organisasi
  for delete to authenticated using ((select public.is_admin()));

insert into public.carta_organisasi (kunci, nama) values
  ('ajk_penaung', 'YAM Tengku Datuk Seri Ahmad Shah Alhaj ibni Almarhum Sultan Salahuddin Abdul Aziz Shah Alhaj'),
  ('ajk_penasihat', 'Datuk Shamsul Bahari bin Abdul Aziz'),
  ('ajk_pengerusi', 'Dato'' Mohd Khay bin Ibrahim'),
  ('ajk_bendahari', 'Haji Hairmanshah bin Idris Shaari'),
  ('ajk_setiausaha', 'Mohamad Syamim bin Mohd Hussin'),
  ('ajk_timbalan_pengerusi', 'Haji Abdul Ahad bin Abu Bakar'),
  ('biro_pembangunan_1', 'Haji Ramli bin Md Yasin'),
  ('biro_pembangunan_2', 'Ahmad Fikri bin Mohd Ismail'),
  ('biro_dakwah_1', 'Haji Anas bin Sahat'),
  ('biro_dakwah_2', 'Abdul Manap bin Mohamed Rose'),
  ('biro_pendidikan_1', 'Haji Azizi bin Ab Hamid'),
  ('biro_pendidikan_2', 'Amir Khairul Taufiq bin Mohd Khay'),
  ('biro_media_1', 'Azizulmalik bin Mohd Hussain Malim'),
  ('biro_media_2', 'Muhd Izwan bin Muhammad'),
  ('biro_kebajikan_1', 'Haji Samsuri bin Suradi'),
  ('biro_kebajikan_2', 'Nizam bin Abdul Karim'),
  ('biro_kebajikan_3', 'Haji Junaidi bin Hassan'),
  ('biro_muslimat_1', 'Sarifah binti Mohd Diah'),
  ('biro_muslimat_2', 'Noor Kaidah binti Azman'),
  ('biro_belia_1', 'Haji Muhammad Asim bin Salleh Sani'),
  ('biro_belia_2', 'Ad Adib bin Shaharuddin'),
  ('biro_beliawanis_1', 'Nur Najiha binti Yuhenri'),
  ('biro_beliawanis_2', 'Rani Febrianti binti Samsuri'),
  ('jawi_pengarah', 'Haji Hanifuddin bin Roslan'),
  ('imam_1', 'Haji Abdul Ahad bin Abu Bakar'),
  ('imam_2', 'Haji Azizi bin Ab Hamid'),
  ('imam_3', 'Haji Mohamad Zamri bin Ab Manaf'),
  ('imam_4', 'Haji Muhammad Asim bin Salleh Sani'),
  ('pegawai_islam', 'Mohamad Syamim bin Mohd Hussin'),
  ('penolong_islam', 'Muhammad Ainul Hariz bin Abu Hassan'),
  ('setiausaha_kerja', 'Noor Kaidah binti Azman'),
  ('kerani_akaun', 'Sabri bin Mohd Sharif'),
  ('phem', 'Rahmad bin Kasim'),
  ('phem_pembantu_1', 'Alias bin Dollah'),
  ('phem_pembantu_2', 'Mohammad Nor bin Dolmat'),
  ('phem_pembantu_3', 'Mohd Azlan bin Zainal Abidin'),
  ('phem_pembantu_4', 'Zaimi Aktar bin Zakaria'),
  ('phem_pembantu_5', 'Kamal Arifin bin Mohamed Sukarno'),
  ('phem_pembantu_6', 'Kamaruzaman bin Musa'),
  ('phem_pembantu_7', 'Mohd Razimin bin Roslan'),
  ('phem_pembantu_8', 'Jamalludin bin Moho Fadzil'),
  ('phem_pembantu_9', 'Syed Zainizal Shan bin Syed Mohd Amin Shan'),
  ('bilal_1', 'Muhammad Kadafi bin Abdul Rahman'),
  ('bilal_2', 'Muhd Izwan bin Muhammad'),
  ('bilal_3', 'Muhammad Akmal bin Hamsani'),
  ('bilal_4', 'Muhammad Amiruddin bin Ishak');