// Tetapan sambungan laman web.
//
// supabaseUrl  — Supabase > Project Settings > Data API > Project URL
// supabaseKey  — Supabase > Project Settings > API Keys > "Publishable key"
//                (sb_publishable_…; dahulu dipanggil "anon key")
//
// Dua nilai ini memang untuk umum dan SELAMAT berada dalam repo — keselamatan
// data dijaga oleh Row Level Security dalam pangkalan data.
// JANGAN SEKALI-KALI letak "secret key" / "service_role key" di sini.
//
// Selagi dua nilai di bawah kosong, laman awam memaparkan kandungan asas
// (fallback) dan panel admin tidak boleh digunakan.
window.MASJID_CONFIG = {
  supabaseUrl: 'https://ywdqcuxgwjfaozsiyjnw.supabase.co',
  supabaseKey: 'sb_publishable_ISrVCEx7ujMpSX8ZOZqBEg_EhlrgsTN',
  // Kod zon e-Solat JAKIM. WLY01 = Kuala Lumpur & Putrajaya.
  zonSolat: 'WLY01'
};
