-- =====================================================================
-- Data permulaan (PILIHAN). Jalankan selepas 0001–0003.
--
-- BAHAGIAN A — kandungan sebenar yang sudah ada di laman web (4 program
--   tahunan). Gambarnya menunjuk ke fail sedia ada dalam repo ("tapak:").
-- BAHAGIAN B — CONTOH REKAAN supaya laman tidak kosong semasa ujian.
--   Padam melalui panel admin (atau jangan jalankan bahagian B) sebelum
--   laman diumumkan kepada jemaah.
-- =====================================================================

-- ---------- BAHAGIAN A: program tahunan sebenar ----------
with p as (
  insert into public.program (tajuk, keterangan, susunan) values
    ('Memasak & Agihan Bubur Lambuk Ramadan',
     'Tradisi Ramadan sejak 1960. Masjid memasak dan mengagihkan kira-kira 3,500 bungkus bubur lambuk sehari secara percuma.', 1),
    ('Ibadah Qurban & Akikah Aidiladha',
     'Diadakan pada setiap 10 hingga 13 Zulhijjah. Pengurusan qurban di MJKB dilaksanakan secara sistematik setiap tahun melibatkan penyembelihan haiwan ternakan, pemotongan, dan pengagihan daging kepada golongan asnaf dan penduduk kariah.', 2),
    ('Majlis Haflah Al-Quran & Sambutan Maulidur Rasul',
     'Diadakan secara tahunan untuk memperingati keputeraan Nabi Muhammad SAW dan menyemarakkan budaya membaca Al-Quran dengan menjemput Qari-Qari terkemuka dari dalam dan luar negara.', 3),
    ('Gotong-Royong Bubur Asyura',
     'Anjuran tahunan setiap kali menjelangnya bulan Muharram (Awal Muharram). Pihak masjid bersama ahli kariah akan menyediakan bubur Asyura secara beramai-ramai mengikut resipi tradisi.', 4)
  returning id, susunan
)
insert into public.program_gambar (program_id, laluan, susunan)
select p.id, g.laluan, g.susunan
from p
join (values
  (1, 'tapak:Agihan bubur/WhatsApp Image 2026-09-29 at 9.04.08 AM.jpeg', 1),
  (1, 'tapak:Agihan bubur/bubur.jpeg', 2),
  (2, 'tapak:korban/2.jpeg', 1),
  (2, 'tapak:korban/1.jpeg', 2),
  (3, 'tapak:Malidur rasul/WhatsApp Image 2026-09-29 at 2.30.37 PM.jpeg', 1),
  (3, 'tapak:Malidur rasul/2.jpeg', 2),
  (3, 'tapak:Malidur rasul/3.jpeg', 3),
  (4, 'tapak:gotong royong/gotong-royong-1-enhanced.png', 1),
  (4, 'tapak:gotong royong/gotong-royong-2-enhanced.png', 2)
) as g (program, laluan, susunan) on g.program = p.susunan;

-- ---------- BAHAGIAN B: CONTOH REKAAN (bukan maklumat sebenar) ----------
insert into public.pengumuman (kategori, tajuk, isi, papar_ticker) values
  ('Contoh', 'Ini contoh pengumuman',
   'Teks ini hanya contoh untuk ujian. Padam di panel admin dan gantikan dengan pengumuman sebenar.', true),
  ('Contoh', 'Pendaftaran kelas fardu ain dewasa (contoh)',
   'Contoh sahaja: kelas dua kali seminggu selepas solat Maghrib. Hubungi pejabat masjid untuk mendaftar.', false);

insert into public.aktiviti (tajuk, keterangan, tarikh, masa) values
  ('Gotong-royong membersih masjid (contoh)', 'Contoh sahaja. Semua ahli kariah dijemput hadir.', current_date + 7, '8:00 pagi'),
  ('Ceramah umum (contoh)', 'Contoh sahaja. Terbuka kepada semua.', current_date + 14, 'Selepas Isyak'),
  ('Kelas tajwid kanak-kanak (contoh)', 'Contoh sahaja. Untuk kanak-kanak 7–12 tahun.', current_date + 21, '9:00 pagi');

insert into public.kuliah (hari, waktu, tajuk, penceramah, tempat) values
  (2, 'maghrib', 'Tafsir Al-Quran (contoh)', 'Ustaz Contoh bin Contoh', 'Ruang solat utama'),
  (4, 'maghrib', 'Fiqh Ibadah (contoh)', 'Ustaz Contoh bin Contoh', 'Ruang solat utama'),
  (6, 'subuh', 'Kuliah Subuh (contoh)', 'Ustaz Contoh bin Contoh', 'Ruang solat utama');

insert into public.tetapan (kunci, nilai) values
  ('jumaat_masa', '1:15 PM'),
  ('jumaat_khatib', 'Ustaz Contoh bin Contoh'),
  ('jumaat_tajuk', '')
on conflict (kunci) do update set nilai = excluded.nilai;
