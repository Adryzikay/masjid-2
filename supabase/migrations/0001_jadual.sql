-- =====================================================================
-- 0001 — Jadual kandungan laman web Masjid Jamek Kampong Bharu
-- Jalankan sekali dalam Supabase > SQL Editor, SEBELUM 0002 dan 0003.
-- =====================================================================

-- Senarai akaun yang dibenarkan mengurus kandungan.
-- Log masuk sahaja TIDAK mencukupi: akaun mesti ada dalam jadual ini.
-- Baris hanya boleh ditambah/dibuang melalui SQL Editor (lihat tambah-admin.sql).
create table public.admins (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nama         text not null check (char_length(btrim(nama)) between 1 and 80),
  dicipta_pada timestamptz not null default now()
);

-- Semakan "adakah pengguna semasa seorang admin?" untuk kegunaan polisi RLS.
-- security definer supaya polisi jadual lain boleh membaca public.admins.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

-- Laluan gambar: sama ada fail dalam bucket Storage "gambar"
-- (aktiviti/<uuid>.jpg, program/<uuid>.jpg) atau fail sedia ada dalam repo
-- laman web (awalan "tapak:"). Tiada URL penuh dibenarkan.
create domain public.laluan_gambar as text
  check (
    value !~ '\.\.'
    and (
      value ~ '^(aktiviti|program)/[a-z0-9-]{8,64}\.(jpg|webp|png)$'
      or value ~ '^tapak:[A-Za-z0-9][A-Za-z0-9 _./()-]{0,198}$'
    )
  );

create function public.set_dikemaskini_pada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.dikemaskini_pada = now();
  return new;
end;
$$;

-- Pengumuman (senarai di laman utama + jalur bergerak)
create table public.pengumuman (
  id               uuid primary key default gen_random_uuid(),
  kategori         text not null default '' check (char_length(kategori) <= 40),
  tajuk            text not null check (char_length(btrim(tajuk)) between 1 and 120),
  isi              text not null default '' check (char_length(isi) <= 600),
  papar_ticker     boolean not null default true,
  tarikh_tamat     date,
  dicipta_pada     timestamptz not null default now(),
  dikemaskini_pada timestamptz not null default now()
);

-- Aktiviti / kalendar (yang sudah lepas disorok secara automatik di laman awam)
create table public.aktiviti (
  id               uuid primary key default gen_random_uuid(),
  tajuk            text not null check (char_length(btrim(tajuk)) between 1 and 120),
  keterangan       text not null default '' check (char_length(keterangan) <= 400),
  tarikh           date not null,
  masa             text not null default '' check (char_length(masa) <= 40),
  gambar           public.laluan_gambar,
  dicipta_pada     timestamptz not null default now(),
  dikemaskini_pada timestamptz not null default now()
);
create index aktiviti_tarikh_idx on public.aktiviti (tarikh);

-- Jadual kuliah mingguan. hari: 1 = Isnin … 7 = Ahad
create table public.kuliah (
  id               uuid primary key default gen_random_uuid(),
  hari             smallint not null check (hari between 1 and 7),
  waktu            text not null check (waktu in ('subuh', 'dhuha', 'zohor', 'asar', 'maghrib', 'isyak')),
  tajuk            text not null check (char_length(btrim(tajuk)) between 1 and 120),
  penceramah       text not null default '' check (char_length(penceramah) <= 120),
  tempat           text not null default '' check (char_length(tempat) <= 120),
  dicipta_pada     timestamptz not null default now(),
  dikemaskini_pada timestamptz not null default now()
);

-- Program tahunan (kad bergambar di halaman Program)
create table public.program (
  id               uuid primary key default gen_random_uuid(),
  tajuk            text not null check (char_length(btrim(tajuk)) between 1 and 120),
  keterangan       text not null default '' check (char_length(keterangan) <= 600),
  susunan          integer not null default 0,
  dicipta_pada     timestamptz not null default now(),
  dikemaskini_pada timestamptz not null default now()
);

create table public.program_gambar (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.program (id) on delete cascade,
  laluan       public.laluan_gambar not null,
  susunan      integer not null default 0,
  dicipta_pada timestamptz not null default now()
);
create index program_gambar_program_idx on public.program_gambar (program_id);

-- Tetapan ringkas (kunci → nilai). Hanya kunci yang disenaraikan dibenarkan.
create table public.tetapan (
  kunci            text primary key check (kunci in ('jumaat_masa', 'jumaat_khatib', 'jumaat_tajuk')),
  nilai            text not null default '' check (char_length(nilai) <= 160),
  dikemaskini_pada timestamptz not null default now()
);

create trigger pengumuman_dikemaskini before update on public.pengumuman
  for each row execute function public.set_dikemaskini_pada();
create trigger aktiviti_dikemaskini before update on public.aktiviti
  for each row execute function public.set_dikemaskini_pada();
create trigger kuliah_dikemaskini before update on public.kuliah
  for each row execute function public.set_dikemaskini_pada();
create trigger program_dikemaskini before update on public.program
  for each row execute function public.set_dikemaskini_pada();
create trigger tetapan_dikemaskini before update on public.tetapan
  for each row execute function public.set_dikemaskini_pada();
