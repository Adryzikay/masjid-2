// Panel admin Masjid Jamek Kampong Bharu.
//
// KESELAMATAN:
// - Kebenaran sebenar dikuatkuasakan oleh Row Level Security dalam Supabase,
//   bukan oleh kod ini. Kod ini hanya antara muka.
// - Semua teks dimasukkan ke halaman melalui textContent (fungsi el()).
//   JANGAN guna innerHTML.
(() => {
  'use strict';

  const cfg = window.MASJID_CONFIG || {};
  const app = document.getElementById('app');
  const butangLogKeluar = document.getElementById('logKeluar');

  const BUCKET = 'gambar';
  const SISI_MAKS = 1600;           // piksel, sisi terpanjang selepas dikecilkan
  const SAIZ_SASARAN = 350 * 1024;  // cuba mampat ke bawah ~350 KB
  const SAIZ_MAKS = 1000 * 1024;    // had bucket ialah 1 MB
  const KATA_LALUAN_MIN = 10;

  const HARI = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];
  const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
  const WAKTU = [
    ['subuh', 'Selepas Subuh'], ['dhuha', 'Pagi (Dhuha)'], ['zohor', 'Selepas Zohor'],
    ['asar', 'Selepas Asar'], ['maghrib', 'Selepas Maghrib'], ['isyak', 'Selepas Isyak']
  ];

  // ---------- Alat bantu DOM ----------
  // el('div', { class: 'x', text: 'y', onclick: fn }, anak…). Rentetan menjadi nod teks.
  const el = (tag, attrs, ...anak) => {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    });
    node.append(...anak.flat().filter((a) => a !== null && a !== undefined && a !== false));
    return node;
  };
  const tunjuk = (...nodes) => { app.replaceChildren(...nodes); window.scrollTo(0, 0); };

  const hariIniKL = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  const tarikhBM = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return '';
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return `${HARI[(d.getUTCDay() + 6) % 7]}, ${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
  };

  // ---------- Makluman & pengesahan ----------
  const kotakMakluman = document.getElementById('makluman');
  let pemasaMakluman = null;
  const maklum = (teks, ralat = false) => {
    kotakMakluman.textContent = teks;
    kotakMakluman.classList.toggle('ralat', ralat);
    kotakMakluman.hidden = false;
    clearTimeout(pemasaMakluman);
    pemasaMakluman = setTimeout(() => { kotakMakluman.hidden = true; }, ralat ? 7000 : 3500);
  };

  const dialogSahkan = document.getElementById('sahkan');
  const sahkan = (tajuk, mesej, labelYa = 'Ya, padam') => new Promise((selesai) => {
    if (typeof dialogSahkan.showModal !== 'function') {
      selesai(window.confirm(`${tajuk}\n\n${mesej}`));
      return;
    }
    document.getElementById('sahkanTajuk').textContent = tajuk;
    document.getElementById('sahkanMesej').textContent = mesej;
    const ya = document.getElementById('sahkanYa');
    const batal = document.getElementById('sahkanBatal');
    ya.textContent = labelYa;
    const tutup = (jawapan) => {
      ya.removeEventListener('click', padaYa);
      batal.removeEventListener('click', padaBatal);
      dialogSahkan.removeEventListener('cancel', padaBatal);
      dialogSahkan.close();
      selesai(jawapan);
    };
    const padaYa = () => tutup(true);
    const padaBatal = () => tutup(false);
    ya.addEventListener('click', padaYa);
    batal.addEventListener('click', padaBatal);
    dialogSahkan.addEventListener('cancel', padaBatal);
    dialogSahkan.showModal();
    batal.focus();
  });

  const terjemahRalat = (err) => {
    const mesej = String((err && (err.message || err.msg)) || err || '');
    const kod = String((err && (err.code || err.error_code || err.statusCode)) || '');
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(mesej)) return 'Tiada sambungan internet. Sila cuba lagi.';
    if (kod === 'invalid_credentials' || /Invalid login credentials/i.test(mesej)) return 'Emel atau kata laluan tidak betul.';
    if (kod === '42501' || kod === '403' || /row-level security|permission denied|Unauthorized/i.test(mesej)) return 'Akaun anda tiada kebenaran untuk tindakan ini.';
    if (kod === 'same_password') return 'Kata laluan baharu mesti berbeza daripada yang lama.';
    if (kod === 'weak_password' || /password/i.test(mesej)) return 'Kata laluan terlalu lemah. Guna kata laluan yang lebih panjang.';
    if (/JWT|session|token/i.test(mesej)) return 'Sesi anda telah tamat. Sila log masuk semula.';
    if (/exceeded the maximum allowed size|too large/i.test(mesej)) return 'Gambar terlalu besar. Sila cuba gambar lain.';
    if (/mime type|not supported/i.test(mesej)) return 'Jenis fail tidak disokong. Sila pilih gambar (JPG/PNG).';
    return `Tidak berjaya. Sila cuba lagi. (${mesej.slice(0, 120) || 'ralat tidak diketahui'})`;
  };

  // Jalankan tugasan dengan butang dinyahaktifkan supaya tidak ditekan dua kali
  const sibuk = async (butang, labelSibuk, tugas) => {
    const asal = butang.textContent;
    butang.disabled = true;
    butang.textContent = labelSibuk;
    try {
      return await tugas();
    } finally {
      butang.disabled = false;
      butang.textContent = asal;
    }
  };

  // ---------- Sambungan Supabase ----------
  const urlSah = /^https:\/\/[a-z0-9.-]+$/i.test(cfg.supabaseUrl || '') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cfg.supabaseUrl || '');
  if (!urlSah || !cfg.supabaseKey || !window.supabase) {
    tunjuk(
      el('h1', { text: 'Panel belum disediakan' }),
      el('p', { class: 'amaran', text: 'Sambungan ke Supabase belum ditetapkan dalam config.js. Sila hubungi penyelenggara laman web.' })
    );
    return;
  }
  const AUTH_STORAGE_KEY = 'mjkb-admin-auth-v1';
  const AUTH_INGAT_KEY = 'mjkb:admin:ingat-saya';
  let ingatSaya = localStorage.getItem(AUTH_INGAT_KEY) === 'ya';
  const authStorage = {
    getItem: async (kunci) => (ingatSaya ? localStorage.getItem(kunci) : null),
    setItem: async (kunci, nilai) => {
      if (ingatSaya) localStorage.setItem(kunci, nilai);
      else localStorage.removeItem(kunci);
    },
    removeItem: async (kunci) => localStorage.removeItem(kunci)
  };
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      storage: authStorage, storageKey: AUTH_STORAGE_KEY
    }
  });

  const urlGambar = (laluan) => {
    if (typeof laluan !== 'string' || laluan.includes('..')) return null;
    if (/^tapak:[A-Za-z0-9][A-Za-z0-9 _./()-]*$/.test(laluan)) return '../' + laluan.slice(6).split('/').map(encodeURIComponent).join('/');
    if (/^(aktiviti|program)\/[a-z0-9-]+\.(jpg|webp|png)$/.test(laluan)) return sb.storage.from(BUCKET).getPublicUrl(laluan).data.publicUrl;
    return null;
  };
  const dalamStoran = (laluan) => typeof laluan === 'string' && /^(aktiviti|program)\//.test(laluan);

  // Pastikan tindakan benar-benar mengubah baris (RLS menolak secara senyap dengan 0 baris)
  const semak = ({ data, error }) => {
    if (error) throw error;
    if (Array.isArray(data) && data.length === 0) throw new Error('row-level security: tiada baris diubah');
    return data;
  };

  // ---------- Gambar: kecilkan & mampat dalam pelayar ----------
  const muatImej = async (fail) => {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(fail, { imageOrientation: 'from-image' }); } catch (err) { /* cuba cara kedua */ }
    }
    return new Promise((selesai, gagal) => {
      const url = URL.createObjectURL(fail);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); selesai(img); };
      img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('not supported: gambar tidak dapat dibaca')); };
      img.src = url;
    });
  };

  const keBlob = (kanvas, kualiti) => new Promise((selesai) => kanvas.toBlob(selesai, 'image/jpeg', kualiti));

  const mampatGambar = async (fail) => {
    if (!fail || !/^image\//.test(fail.type)) throw new Error('not supported: bukan fail gambar');
    const imej = await muatImej(fail);
    const lebarAsal = imej.width || imej.naturalWidth;
    const tinggiAsal = imej.height || imej.naturalHeight;
    if (!lebarAsal || !tinggiAsal) throw new Error('not supported: gambar tidak dapat dibaca');

    let sisi = SISI_MAKS;
    for (let cubaan = 0; cubaan < 4; cubaan++) {
      const skala = Math.min(1, sisi / Math.max(lebarAsal, tinggiAsal));
      const kanvas = document.createElement('canvas');
      kanvas.width = Math.max(1, Math.round(lebarAsal * skala));
      kanvas.height = Math.max(1, Math.round(tinggiAsal * skala));
      const ctx = kanvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // PNG lut sinar → latar putih
      ctx.fillRect(0, 0, kanvas.width, kanvas.height);
      ctx.drawImage(imej, 0, 0, kanvas.width, kanvas.height);

      let blob = null;
      for (const kualiti of [0.82, 0.72, 0.6, 0.5]) {
        blob = await keBlob(kanvas, kualiti);
        if (blob && blob.size <= SAIZ_SASARAN) break;
      }
      if (blob && blob.size <= SAIZ_MAKS) {
        if (typeof imej.close === 'function') imej.close();
        return blob;
      }
      sisi = Math.round(sisi * 0.7); // masih terlalu besar — kecilkan lagi
    }
    throw new Error('too large: gambar tidak dapat dikecilkan');
  };

  const idRawak = () => (crypto.randomUUID ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''));

  const muatNaik = async (folder, blob) => {
    const laluan = `${folder}/${idRawak()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(laluan, blob, {
      contentType: 'image/jpeg', cacheControl: '31536000', upsert: false
    });
    if (error) throw error;
    return laluan;
  };

  // Padam fail storan; kegagalan di sini tidak menghalang kerja utama
  const padamFail = async (senaraiLaluan) => {
    const sasaran = senaraiLaluan.filter(dalamStoran);
    if (!sasaran.length) return;
    try { await sb.storage.from(BUCKET).remove(sasaran); } catch (err) { /* fail yatim tidak memudaratkan */ }
  };

  // ---------- Takrif modul ----------
  // Setiap modul: jadual, label, medan borang, dan cara meringkaskan satu baris.
  const MODUL = {
    pengumuman: {
      ikon: '📢', tajuk: 'Pengumuman', satu: 'pengumuman',
      perihal: 'Berita & makluman di laman utama',
      susun: (q) => q.order('dicipta_pada', { ascending: false }),
      medan: [
        { nama: 'tajuk', label: 'Tajuk', jenis: 'teks', wajib: true, maks: 120, contoh: 'cth. Kelas tafsir malam Selasa ditangguhkan' },
        { nama: 'isi', label: 'Butiran', jenis: 'perenggan', maks: 600, contoh: 'Tulis butiran pengumuman di sini…', bantuan: 'Pautan yang bermula dengan https:// akan boleh diklik.' },
        { nama: 'kategori', label: 'Kategori (jika ada)', jenis: 'teks', maks: 40, contoh: 'cth. Kuliah, Kutipan Derma, Ramadan' },
        { nama: 'tarikh_tamat', label: 'Papar sehingga tarikh (jika ada)', jenis: 'tarikh', bantuan: 'Selepas tarikh ini, pengumuman hilang sendiri dari laman web. Biarkan kosong jika tiada tarikh akhir.' },
        { nama: 'papar_ticker', label: 'Papar tajuk ini di jalur bergerak di bahagian atas laman utama', jenis: 'semak', lalai: true }
      ],
      ringkas: (r) => {
        const lencana = [];
        if (r.kategori) lencana.push([r.kategori]);
        if (r.papar_ticker) lencana.push(['Di jalur bergerak']);
        if (r.tarikh_tamat) lencana.push(r.tarikh_tamat < hariIniKL() ? ['Sudah tamat — tidak dipaparkan', true] : [`Sehingga ${tarikhBM(r.tarikh_tamat)}`]);
        return { tajuk: r.tajuk, kecil: r.isi, lencana };
      }
    },
    aktiviti: {
      ikon: '📅', tajuk: 'Aktiviti', satu: 'aktiviti',
      perihal: 'Kalendar aktiviti akan datang',
      folder: 'aktiviti', maksGambar: 1,
      susun: (q) => q.order('tarikh', { ascending: false }),
      medan: [
        { nama: 'tajuk', label: 'Nama aktiviti', jenis: 'teks', wajib: true, maks: 120, contoh: 'cth. Gotong-royong membersih masjid' },
        { nama: 'tarikh', label: 'Tarikh', jenis: 'tarikh', wajib: true },
        { nama: 'masa', label: 'Masa (jika ada)', jenis: 'teks', maks: 40, contoh: 'cth. 9:00 pagi / Selepas Isyak' },
        { nama: 'keterangan', label: 'Keterangan ringkas', jenis: 'perenggan', maks: 400, contoh: 'cth. Terbuka kepada semua ahli kariah.' },
        { nama: 'gambar', label: 'Gambar (jika ada)', jenis: 'gambar' }
      ],
      ringkas: (r) => ({
        tajuk: r.tajuk,
        kecil: [tarikhBM(r.tarikh), r.masa].filter(Boolean).join(' · '),
        gambar: r.gambar,
        lencana: r.tarikh < hariIniKL() ? [['Sudah lepas — tidak dipaparkan', true]] : []
      })
    },
    kuliah: {
      ikon: '📖', tajuk: 'Jadual Kuliah', satu: 'kuliah',
      perihal: 'Kuliah mingguan yang berulang',
      susun: (q) => q.order('hari', { ascending: true }),
      susunTempatan: (a, b) => a.hari - b.hari || WAKTU.findIndex((w) => w[0] === a.waktu) - WAKTU.findIndex((w) => w[0] === b.waktu),
      medan: [
        { nama: 'hari', label: 'Hari', jenis: 'pilihan', wajib: true, nombor: true, pilihan: HARI.map((h, i) => [String(i + 1), h]) },
        { nama: 'waktu', label: 'Waktu', jenis: 'pilihan', wajib: true, pilihan: WAKTU },
        { nama: 'tajuk', label: 'Tajuk / kitab', jenis: 'teks', wajib: true, maks: 120, contoh: 'cth. Tafsir Al-Quran' },
        { nama: 'penceramah', label: 'Penceramah', jenis: 'teks', maks: 120, contoh: 'cth. Ustaz Ahmad bin Ali' },
        { nama: 'tempat', label: 'Tempat (jika ada)', jenis: 'teks', maks: 120, contoh: 'cth. Ruang solat utama' }
      ],
      ringkas: (r) => ({
        tajuk: r.tajuk,
        kecil: [`${HARI[r.hari - 1] || ''}, ${(WAKTU.find((w) => w[0] === r.waktu) || [])[1] || ''}`, r.penceramah].filter(Boolean).join(' · '),
        lencana: []
      })
    },
    program: {
      ikon: '🖼️', tajuk: 'Program & Gambar', satu: 'program',
      perihal: 'Kad program bergambar di halaman Program',
      folder: 'program', maksGambar: 6,
      pilih: 'id,tajuk,keterangan,susunan,dicipta_pada,program_gambar(id,laluan,susunan)',
      susun: (q) => q.order('susunan', { ascending: true }).order('dicipta_pada', { ascending: true }),
      medan: [
        { nama: 'tajuk', label: 'Nama program', jenis: 'teks', wajib: true, maks: 120, contoh: 'cth. Agihan Bubur Lambuk Ramadan' },
        { nama: 'keterangan', label: 'Keterangan', jenis: 'perenggan', maks: 600, contoh: 'Ceritakan secara ringkas tentang program ini…' },
        { nama: 'gambar', label: 'Gambar (sehingga 6)', jenis: 'gambar' }
      ],
      ringkas: (r) => {
        const g = (r.program_gambar || []).slice().sort((a, b) => a.susunan - b.susunan);
        return { tajuk: r.tajuk, kecil: r.keterangan, gambar: g[0] && g[0].laluan, lencana: [[`${g.length} gambar`]] };
      }
    }
  };

  // ---------- Keadaan sesi ----------
  let pengguna = null;
  let namaAdmin = null;

  const tetapkanSesi = async (session) => {
    pengguna = session ? session.user : null;
    namaAdmin = null;
    if (pengguna) {
      const { data, error } = await sb.from('admins').select('nama').eq('user_id', pengguna.id).maybeSingle();
      if (error && !/permission|security/i.test(error.message || '')) throw error;
      namaAdmin = data ? data.nama : null;
    }
    butangLogKeluar.hidden = !pengguna;
  };

  butangLogKeluar.addEventListener('click', async () => {
    await sb.auth.signOut().catch(() => {});
    await tetapkanSesi(null);
    location.hash = '';
    papar();
  });

  // ---------- Paparan: log masuk ----------
  const paparLogMasuk = () => {
    const emel = el('input', { type: 'email', id: 'emel', autocomplete: 'username', required: true, inputmode: 'email', autocapitalize: 'none' });
    const kata = el('input', { type: 'password', id: 'kata', autocomplete: 'current-password', required: true });
    const ingat = el('input', { type: 'checkbox', id: 'ingatSaya' });
    ingat.checked = ingatSaya;
    const butang = el('button', { type: 'submit', class: 'butang butang-utama butang-penuh', text: 'Log Masuk' });
    const borang = el('form', { class: 'borang', novalidate: true },
      el('div', { class: 'medan' }, el('label', { for: 'emel', text: 'Emel' }), emel),
      el('div', { class: 'medan' }, el('label', { for: 'kata', text: 'Kata laluan' }), kata),
      el('label', { class: 'semak', for: 'ingatSaya' }, ingat, el('span', { text: 'Ingat saya pada peranti ini' })),
      butang
    );
    borang.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!emel.value.trim() || !kata.value) { maklum('Sila isi emel dan kata laluan.', true); return; }
      try {
        await sibuk(butang, 'Sedang log masuk…', async () => {
          ingatSaya = ingat.checked;
          if (ingatSaya) localStorage.setItem(AUTH_INGAT_KEY, 'ya');
          else {
            localStorage.removeItem(AUTH_INGAT_KEY);
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
          const { data, error } = await sb.auth.signInWithPassword({ email: emel.value.trim(), password: kata.value });
          if (error) throw error;
          await tetapkanSesi(data.session);
        });
        papar();
      } catch (err) {
        maklum(terjemahRalat(err), true);
      }
    });
    tunjuk(
      el('h1', { text: 'Log Masuk' }),
      el('p', { class: 'pengenalan', text: 'Untuk pengurus laman web masjid sahaja.' }),
      borang,
      el('p', { class: 'nota', text: 'Lupa kata laluan? Hubungi penyelenggara laman web untuk menetapkannya semula.' })
    );
    emel.focus();
  };

  const paparTiadaKebenaran = () => {
    tunjuk(
      el('h1', { text: 'Tiada kebenaran' }),
      el('p', { class: 'amaran', text: `Akaun ${pengguna.email || ''} belum diberi kebenaran mengurus laman web. Sila hubungi penyelenggara laman web.` })
    );
  };

  // ---------- Paparan: tukar kata laluan ----------
  const paparKataLaluan = (wajib) => {
    const baru = el('input', { type: 'password', id: 'baru', autocomplete: 'new-password', required: true, minlength: KATA_LALUAN_MIN });
    const ulang = el('input', { type: 'password', id: 'ulang', autocomplete: 'new-password', required: true });
    const butang = el('button', { type: 'submit', class: 'butang butang-utama butang-penuh', text: 'Simpan Kata Laluan' });
    const borang = el('form', { class: 'borang', novalidate: true },
      el('div', { class: 'medan' }, el('label', { for: 'baru', text: 'Kata laluan baharu' }), baru,
        el('span', { class: 'bantuan', text: `Sekurang-kurangnya ${KATA_LALUAN_MIN} aksara. Jangan guna kata laluan yang sama dengan Facebook atau emel anda.` })),
      el('div', { class: 'medan' }, el('label', { for: 'ulang', text: 'Taip sekali lagi' }), ulang),
      el('div', { class: 'borang-butang' }, butang,
        !wajib && el('a', { class: 'butang butang-biasa butang-penuh', href: '#', text: 'Batal' }))
    );
    borang.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (baru.value.length < KATA_LALUAN_MIN) { maklum(`Kata laluan mesti sekurang-kurangnya ${KATA_LALUAN_MIN} aksara.`, true); return; }
      if (baru.value !== ulang.value) { maklum('Dua kata laluan yang ditaip tidak sama.', true); return; }
      try {
        await sibuk(butang, 'Sedang menyimpan…', async () => {
          const { data, error } = await sb.auth.updateUser({ password: baru.value, data: { kata_laluan_ditukar: true } });
          if (error) throw error;
          pengguna = data.user;
        });
        maklum('Kata laluan berjaya ditukar.');
        location.hash = '';
        papar();
      } catch (err) {
        maklum(terjemahRalat(err), true);
      }
    });
    tunjuk(
      !wajib && el('a', { class: 'kembali', href: '#', text: '← Kembali' }),
      el('h1', { text: 'Tukar Kata Laluan' }),
      wajib && el('p', { class: 'nota', text: 'Ini kali pertama anda log masuk. Sila tukar kata laluan sementara kepada kata laluan anda sendiri sebelum meneruskan.' }),
      borang
    );
    baru.focus();
  };

  // ---------- Paparan: laman utama panel ----------
  const jubin = (href, ikon, tajuk, kecil, luar) => el('a', { class: 'jubin', href, target: luar ? '_blank' : null, rel: luar ? 'noopener' : null },
    el('span', { class: 'jubin-ikon', 'aria-hidden': 'true', text: ikon }),
    el('span', null, el('span', { class: 'jubin-tajuk', text: tajuk }), el('span', { class: 'jubin-kecil', text: kecil }))
  );

  const paparUtama = () => {
    tunjuk(
      el('h1', { text: `Assalamualaikum, ${namaAdmin}` }),
      el('p', { class: 'pengenalan', text: 'Pilih apa yang ingin dikemas kini.' }),
      el('div', { class: 'jubin-grid' },
        Object.entries(MODUL).map(([kunci, m]) => jubin(`#${kunci}`, m.ikon, m.tajuk, m.perihal)),
        jubin('#carta', '🧑‍🤝‍🧑', 'Carta Organisasi', 'Ubah kumpulan, jawatan & nama'),
        jubin('#jumaat', '🕌', 'Solat Jumaat', 'Waktu, khatib & tajuk khutbah'),
        jubin('../index.html', '🌐', 'Lihat Laman Web', 'Buka laman awam di tab baharu', true),
        jubin('#kata-laluan', '🔑', 'Tukar Kata Laluan', 'Tukar kata laluan akaun anda')
      )
    );
  };

  // ---------- Paparan: senarai ----------
  const paparSenarai = async (kunci) => {
    const m = MODUL[kunci];
    const bekasSenarai = el('div', { class: 'senarai' }, el('p', { class: 'memuat', text: 'Sedang memuatkan…' }));
    tunjuk(
      el('a', { class: 'kembali', href: '#', text: '← Menu utama' }),
      el('h1', { text: m.tajuk }),
      el('p', { class: 'pengenalan', text: m.perihal }),
      el('a', { class: 'butang butang-utama butang-penuh', href: `#${kunci}/baru`, text: `＋ Tambah ${m.satu}` }),
      bekasSenarai
    );

    const { data, error } = await m.susun(sb.from(kunci).select(m.pilih || '*'));
    if (location.hash !== `#${kunci}`) return; // pengguna sudah beralih halaman
    if (error) {
      bekasSenarai.replaceChildren(el('p', { class: 'amaran', text: terjemahRalat(error) }));
      return;
    }
    const rows = m.susunTempatan ? data.slice().sort(m.susunTempatan) : data;
    if (!rows.length) {
      bekasSenarai.replaceChildren(el('p', { class: 'kosong', text: `Belum ada ${m.satu}. Tekan butang "Tambah" di atas.` }));
      return;
    }

    bekasSenarai.replaceChildren(...rows.map((r) => {
      const s = m.ringkas(r);
      const src = urlGambar(s.gambar);
      const butangPadam = el('button', { type: 'button', class: 'butang butang-bahaya-lembut', text: 'Padam' });
      const kad = el('div', { class: 'kad' },
        el('div', { class: 'kad-atas' },
          src && el('img', { class: 'kad-gambar', src, alt: '', loading: 'lazy' }),
          el('div', { class: 'kad-teks' },
            el('div', { class: 'kad-tajuk', text: s.tajuk }),
            s.kecil && el('div', { class: 'kad-kecil', text: s.kecil.length > 140 ? `${s.kecil.slice(0, 140)}…` : s.kecil }),
            el('div', null, s.lencana.map(([teks, kelabu]) => el('span', { class: kelabu ? 'lencana lencana-kelabu' : 'lencana', text: teks })))
          )
        ),
        el('div', { class: 'kad-butang' },
          el('a', { class: 'butang butang-biasa', href: `#${kunci}/${r.id}`, text: 'Edit' }),
          butangPadam
        )
      );
      butangPadam.addEventListener('click', async () => {
        const setuju = await sahkan(`Padam ${m.satu} ini?`, `"${s.tajuk}" akan dibuang dari laman web. Tindakan ini tidak boleh dibatalkan.`);
        if (!setuju) return;
        try {
          await sibuk(butangPadam, 'Memadam…', async () => {
            const gambar = kunci === 'program' ? (r.program_gambar || []).map((g) => g.laluan) : [r.gambar];
            semak(await sb.from(kunci).delete().eq('id', r.id).select('id'));
            await padamFail(gambar);
          });
          kad.remove();
          if (!bekasSenarai.children.length) paparSenarai(kunci);
          maklum('Berjaya dipadam.');
        } catch (err) {
          maklum(terjemahRalat(err), true);
        }
      });
      return kad;
    }));
  };

  // ---------- Paparan: borang tambah / edit ----------
  const binaMedan = (m, medan, nilai, keadaanGambar) => {
    const id = `m-${medan.nama}`;
    const label = el('label', { for: id }, medan.label, medan.wajib && el('span', { class: 'wajib', text: ' *' }));
    const bantuan = medan.bantuan && el('span', { class: 'bantuan', text: medan.bantuan });

    if (medan.jenis === 'semak') {
      const input = el('input', { type: 'checkbox', id });
      input.checked = nilai === undefined || nilai === null ? !!medan.lalai : !!nilai;
      return { node: el('div', { class: 'medan' }, el('label', { class: 'semak', for: id }, input, el('span', { text: medan.label }))), baca: () => input.checked };
    }

    if (medan.jenis === 'pilihan') {
      const input = el('select', { id, required: medan.wajib },
        el('option', { value: '', text: '— Pilih —' }),
        medan.pilihan.map(([v, t]) => el('option', { value: v, text: t }))
      );
      input.value = nilai === undefined || nilai === null ? '' : String(nilai);
      return { node: el('div', { class: 'medan' }, label, input, bantuan), baca: () => (medan.nombor && input.value ? Number(input.value) : input.value), input };
    }

    if (medan.jenis === 'gambar') {
      const grid = el('div', { class: 'gambar-grid' });
      const pilih = el('input', { type: 'file', accept: 'image/*', id, multiple: m.maksGambar > 1 });
      const butangPilih = el('span', { class: 'butang butang-biasa butang-penuh pilih-gambar' }, el('span', { text: '📷 Pilih gambar' }), pilih);
      const lukis = () => {
        grid.replaceChildren(...keadaanGambar.senarai.map((g, i) => el('div', { class: 'gambar-item' },
          el('img', { src: g.url, alt: `Gambar ${i + 1}` }),
          el('button', { type: 'button', text: 'Buang', onclick: () => {
            if (g.laluan) keadaanGambar.dibuang.push(g);
            if (g.blob) URL.revokeObjectURL(g.url);
            keadaanGambar.senarai.splice(i, 1);
            lukis();
          } })
        )));
        butangPilih.hidden = keadaanGambar.senarai.length >= m.maksGambar;
      };
      pilih.addEventListener('change', async () => {
        const fail = Array.from(pilih.files || []);
        pilih.value = '';
        for (const f of fail) {
          if (keadaanGambar.senarai.length >= m.maksGambar) { maklum(`Had ${m.maksGambar} gambar sahaja.`, true); break; }
          try {
            maklum('Sedang mengecilkan gambar…');
            const blob = await mampatGambar(f);
            keadaanGambar.senarai.push({ blob, url: URL.createObjectURL(blob) });
            lukis();
            maklum(`Gambar sedia (${Math.round(blob.size / 1024)} KB).`);
          } catch (err) {
            maklum(terjemahRalat(err), true);
          }
        }
      });
      lukis();
      return {
        node: el('div', { class: 'medan' }, el('span', { class: 'label', text: medan.label }), grid, butangPilih,
          el('span', { class: 'bantuan', text: 'Gambar dikecilkan secara automatik sebelum dimuat naik.' })),
        baca: () => undefined
      };
    }

    const input = medan.jenis === 'perenggan'
      ? el('textarea', { id, maxlength: medan.maks, placeholder: medan.contoh, rows: 5 })
      : el('input', { type: medan.jenis === 'tarikh' ? 'date' : 'text', id, maxlength: medan.maks, placeholder: medan.contoh, required: medan.wajib });
    input.value = nilai === undefined || nilai === null ? '' : String(nilai);
    return {
      node: el('div', { class: 'medan' }, label, input, bantuan),
      baca: () => (medan.jenis === 'tarikh' ? (input.value || null) : input.value.trim()),
      input
    };
  };

  const paparBorang = async (kunci, id) => {
    const m = MODUL[kunci];
    const baharu = id === 'baru';
    let baris = {};
    if (!baharu) {
      tunjuk(el('p', { class: 'memuat', text: 'Sedang memuatkan…' }));
      const { data, error } = await sb.from(kunci).select(m.pilih || '*').eq('id', id).maybeSingle();
      if (location.hash !== `#${kunci}/${id}`) return;
      if (error || !data) {
        tunjuk(el('a', { class: 'kembali', href: `#${kunci}`, text: '← Kembali' }),
          el('p', { class: 'amaran', text: error ? terjemahRalat(error) : 'Rekod tidak ditemui. Mungkin ia sudah dipadam.' }));
        return;
      }
      baris = data;
    }

    // Gambar sedia ada → senarai boleh ubah
    const sediaAda = kunci === 'program'
      ? (baris.program_gambar || []).slice().sort((a, b) => a.susunan - b.susunan).map((g) => ({ id: g.id, laluan: g.laluan, susunan: g.susunan }))
      : (baris.gambar ? [{ laluan: baris.gambar }] : []);
    const keadaanGambar = {
      senarai: sediaAda.map((g) => ({ ...g, url: urlGambar(g.laluan) })).filter((g) => g.url),
      dibuang: []
    };

    const medan = m.medan.map((takrif) => ({ takrif, ...binaMedan(m, takrif, baris[takrif.nama], keadaanGambar) }));
    const butang = el('button', { type: 'submit', class: 'butang butang-utama butang-penuh', text: 'Simpan' });
    const borang = el('form', { class: 'borang', novalidate: true },
      medan.map((f) => f.node),
      el('div', { class: 'borang-butang' }, butang, el('a', { class: 'butang butang-biasa butang-penuh', href: `#${kunci}`, text: 'Batal' }))
    );

    borang.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nilai = {};
      for (const f of medan) {
        if (f.takrif.jenis === 'gambar') continue;
        const v = f.baca();
        if (f.takrif.wajib && (v === '' || v === null)) {
          maklum(`Sila isi "${f.takrif.label}".`, true);
          if (f.input) f.input.focus();
          return;
        }
        nilai[f.takrif.nama] = v;
      }

      const dimuatNaik = [];
      try {
        await sibuk(butang, 'Sedang menyimpan…', async () => {
          const baruGambar = keadaanGambar.senarai.filter((g) => g.blob);
          for (const g of baruGambar) {
            g.laluanBaru = await muatNaik(m.folder, g.blob);
            dimuatNaik.push(g.laluanBaru);
          }

          if (kunci === 'program') {
            let programId = id;
            if (baharu) {
              const { data: akhir } = await sb.from('program').select('susunan').order('susunan', { ascending: false }).limit(1);
              nilai.susunan = ((akhir && akhir[0] && akhir[0].susunan) || 0) + 1;
              programId = semak(await sb.from('program').insert(nilai).select('id'))[0].id;
            } else {
              semak(await sb.from('program').update(nilai).eq('id', id).select('id'));
            }
            if (baruGambar.length) {
              const mula = Math.max(0, ...keadaanGambar.senarai.map((g) => g.susunan || 0));
              semak(await sb.from('program_gambar').insert(
                baruGambar.map((g, i) => ({ program_id: programId, laluan: g.laluanBaru, susunan: mula + i + 1 }))
              ).select('id'));
            }
            const idBuang = keadaanGambar.dibuang.map((g) => g.id).filter(Boolean);
            if (idBuang.length) semak(await sb.from('program_gambar').delete().in('id', idBuang).select('id'));
          } else {
            if (m.folder) {
              const g = keadaanGambar.senarai[0];
              nilai.gambar = g ? (g.laluanBaru || g.laluan) : null;
            }
            if (baharu) semak(await sb.from(kunci).insert(nilai).select('id'));
            else semak(await sb.from(kunci).update(nilai).eq('id', id).select('id'));
          }
          await padamFail(keadaanGambar.dibuang.map((g) => g.laluan));
        });
        maklum('Berjaya disimpan.');
        location.hash = `#${kunci}`;
      } catch (err) {
        await padamFail(dimuatNaik); // jangan tinggalkan fail tanpa rekod
        keadaanGambar.senarai.forEach((g) => { delete g.laluanBaru; });
        maklum(terjemahRalat(err), true);
      }
    });

    tunjuk(
      el('a', { class: 'kembali', href: `#${kunci}`, text: `← ${m.tajuk}` }),
      el('h1', { text: baharu ? `Tambah ${m.satu}` : `Edit ${m.satu}` }),
      borang
    );
  };

  // ---------- Paparan: Solat Jumaat ----------
  const paparJumaat = async () => {
    tunjuk(el('p', { class: 'memuat', text: 'Sedang memuatkan…' }));
    const { data, error } = await sb.from('tetapan').select('kunci,nilai');
    if (location.hash !== '#jumaat') return;
    if (error) {
      tunjuk(el('a', { class: 'kembali', href: '#', text: '← Menu utama' }), el('p', { class: 'amaran', text: terjemahRalat(error) }));
      return;
    }
    const nilai = Object.fromEntries(data.map((r) => [r.kunci, r.nilai]));
    const takrif = [
      ['jumaat_masa', 'Waktu Solat Jumaat', 'cth. 1:15 PM', 40],
      ['jumaat_khatib', 'Khatib minggu ini', 'cth. Ustaz Ahmad bin Ali', 120],
      ['jumaat_tajuk', 'Tajuk khutbah (jika ada)', 'cth. Menjaga amanah', 160]
    ];
    const input = takrif.map(([kunci, , contoh, maks]) => {
      const i = el('input', { type: 'text', id: kunci, maxlength: maks, placeholder: contoh });
      i.value = nilai[kunci] || '';
      return i;
    });
    const butang = el('button', { type: 'submit', class: 'butang butang-utama butang-penuh', text: 'Simpan' });
    const borang = el('form', { class: 'borang', novalidate: true },
      takrif.map(([kunci, label], n) => el('div', { class: 'medan' }, el('label', { for: kunci, text: label }), input[n])),
      el('div', { class: 'borang-butang' }, butang, el('a', { class: 'butang butang-biasa butang-penuh', href: '#', text: 'Batal' }))
    );
    borang.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await sibuk(butang, 'Sedang menyimpan…', async () => {
          semak(await sb.from('tetapan').upsert(
            takrif.map(([kunci], n) => ({ kunci, nilai: input[n].value.trim() })), { onConflict: 'kunci' }
          ).select('kunci'));
        });
        maklum('Berjaya disimpan.');
        location.hash = '';
      } catch (err) {
        maklum(terjemahRalat(err), true);
      }
    });
    tunjuk(
      el('a', { class: 'kembali', href: '#', text: '← Menu utama' }),
      el('h1', { text: 'Solat Jumaat' }),
      el('p', { class: 'pengenalan', text: 'Dipaparkan di bawah jadual waktu solat. Kosongkan semua untuk menyorokkannya.' }),
      borang
    );
  };

  // ---------- Paparan: struktur Carta Organisasi ----------
  const SEKSYEN_CARTA = [['ajk', 'Ahli Jawatankuasa'], ['kakitangan', 'Kakitangan']];

  const cartaObjekSah = (struktur) => struktur && typeof struktur === 'object'
    && Array.isArray(struktur.ajk) && Array.isArray(struktur.kakitangan)
    && [...struktur.ajk, ...struktur.kakitangan].every((kumpulan) =>
      kumpulan && typeof kumpulan.tajuk === 'string' && Array.isArray(kumpulan.ahli)
      && kumpulan.ahli.every((ahli) => ahli && typeof ahli.jawatan === 'string' && typeof ahli.nama === 'string'));

  const paparCarta = async () => {
    tunjuk(el('p', { class: 'memuat', text: 'Sedang memuatkan…' }));
    const { data, error } = await sb.from('carta_struktur').select('struktur').eq('id', 'utama').maybeSingle();
    if (location.hash !== '#carta') return;
    if (error || !data || !cartaObjekSah(data.struktur)) {
      tunjuk(el('a', { class: 'kembali', href: '#', text: '← Menu utama' }),
        el('p', { class: 'amaran', text: error ? terjemahRalat(error) : 'Struktur carta tidak dapat dimuatkan.' }));
      return;
    }

    const struktur = data.struktur;
    const editor = el('div');
    const butangSimpan = el('button', { type: 'submit', class: 'butang butang-utama butang-penuh', text: 'Simpan perubahan' });
    const borang = el('form', { class: 'borang', novalidate: true });

    const lukisEditor = () => {
      editor.replaceChildren(...SEKSYEN_CARTA.map(([bahagian, tajuk]) => {
        const kumpulan = struktur[bahagian];
        const tambahKumpulan = el('button', {
          type: 'button', class: 'butang butang-biasa', text: '+ Tambah kumpulan',
          onclick: () => { kumpulan.push({ tajuk: '', ahli: [{ jawatan: '', nama: '' }] }); lukisEditor(); }
        });
        return el('section', { class: 'bahagian-carta' },
          el('h2', { text: tajuk }),
          kumpulan.map((item, indeksKumpulan) => {
            const medanTajuk = el('input', {
              type: 'text', maxlength: 120, required: true, value: item.tajuk,
              'aria-label': `Nama kumpulan ${indeksKumpulan + 1} (${tajuk})`,
              oninput: (e) => { item.tajuk = e.target.value; }
            });
            return el('section', { class: 'carta-editor-kumpulan' },
              el('div', { class: 'carta-editor-atas' },
                el('div', { class: 'medan' }, el('label', { text: 'Nama kumpulan / lajur' }), medanTajuk),
                el('button', {
                  type: 'button', class: 'butang butang-bahaya-lembut', text: 'Buang kumpulan',
                  onclick: () => { kumpulan.splice(indeksKumpulan, 1); lukisEditor(); }
                })
              ),
              item.ahli.map((ahli, indeksAhli) => {
                const jawatan = el('input', {
                  type: 'text', maxlength: 120, required: true, value: ahli.jawatan,
                  'aria-label': `Jawatan ahli ${indeksAhli + 1} dalam ${item.tajuk || tajuk}`,
                  oninput: (e) => { ahli.jawatan = e.target.value; }
                });
                const nama = el('input', {
                  type: 'text', maxlength: 160, required: true, value: ahli.nama,
                  'aria-label': `Nama ahli ${indeksAhli + 1} dalam ${item.tajuk || tajuk}`,
                  oninput: (e) => { ahli.nama = e.target.value; }
                });
                return el('div', { class: 'carta-editor-ahli' },
                  el('div', { class: 'medan' }, el('label', { text: 'Jawatan' }), jawatan),
                  el('div', { class: 'medan' }, el('label', { text: 'Nama' }), nama),
                  el('button', {
                    type: 'button', class: 'butang butang-bahaya-lembut', text: 'Buang ahli',
                    onclick: () => { item.ahli.splice(indeksAhli, 1); lukisEditor(); }
                  })
                );
              }),
              el('button', {
                type: 'button', class: 'butang butang-biasa', text: '+ Tambah jawatan / ahli',
                onclick: () => { item.ahli.push({ jawatan: '', nama: '' }); lukisEditor(); }
              })
            );
          }),
          tambahKumpulan
        );
      }));
    };

    lukisEditor();
    borang.append(editor, el('div', { class: 'borang-butang' }, butangSimpan,
      el('a', { class: 'butang butang-biasa butang-penuh', href: '#', text: 'Batal' })));
    borang.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tidakSah = SEKSYEN_CARTA.some(([bahagian]) => struktur[bahagian].some((kumpulan) =>
        !kumpulan.tajuk.trim() || !kumpulan.ahli.length || kumpulan.ahli.some((ahli) => !ahli.jawatan.trim() || !ahli.nama.trim())));
      if (tidakSah) {
        maklum('Lengkapkan tajuk kumpulan, jawatan dan nama. Buang kumpulan atau ahli yang tidak diperlukan.', true);
        return;
      }
      SEKSYEN_CARTA.forEach(([bahagian]) => struktur[bahagian].forEach((kumpulan) => {
        kumpulan.tajuk = kumpulan.tajuk.trim();
        kumpulan.ahli.forEach((ahli) => {
          ahli.jawatan = ahli.jawatan.trim();
          ahli.nama = ahli.nama.trim();
        });
      }));
      try {
        await sibuk(butangSimpan, 'Sedang menyimpan…', async () => {
          semak(await sb.from('carta_struktur').upsert({ id: 'utama', struktur }, { onConflict: 'id' }).select('id'));
        });
        maklum('Carta berjaya disimpan.');
        location.hash = '';
      } catch (err) {
        maklum(terjemahRalat(err), true);
      }
    });
    tunjuk(
      el('a', { class: 'kembali', href: '#', text: '← Menu utama' }),
      el('h1', { text: 'Carta Organisasi' }),
      el('p', { class: 'pengenalan', text: 'Ubah nama kumpulan, jawatan dan ahli. Tambah atau buang kumpulan dan ahli, kemudian simpan.' }),
      borang
    );
  };

  // ---------- Penghala ----------
  const papar = () => {
    if (!pengguna) return paparLogMasuk();
    if (!namaAdmin) return paparTiadaKebenaran();
    if (!(pengguna.user_metadata && pengguna.user_metadata.kata_laluan_ditukar)) return paparKataLaluan(true);

    const [bahagian, id] = location.hash.replace(/^#\/?/, '').split('/');
    if (!bahagian) return paparUtama();
    if (bahagian === 'carta') return paparCarta();
    if (bahagian === 'jumaat') return paparJumaat();
    if (bahagian === 'kata-laluan') return paparKataLaluan(false);
    if (Object.prototype.hasOwnProperty.call(MODUL, bahagian)) {
      if (!id) return paparSenarai(bahagian);
      if (id === 'baru' || /^[0-9a-f-]{36}$/i.test(id)) return paparBorang(bahagian, id);
    }
    location.hash = '';
    return undefined;
  };

  window.addEventListener('hashchange', papar);
  sb.auth.onAuthStateChange((peristiwa) => {
    // Sesi tamat / log keluar di tab lain. setTimeout: jangan panggil Supabase dari dalam panggil balik ini.
    if (peristiwa === 'SIGNED_OUT' && pengguna) setTimeout(async () => { await tetapkanSesi(null); papar(); }, 0);
  });

  (async () => {
    try {
      const { data } = await sb.auth.getSession();
      await tetapkanSesi(data.session);
      papar();
    } catch (err) {
      tunjuk(el('h1', { text: 'Tidak dapat memuatkan panel' }), el('p', { class: 'amaran', text: terjemahRalat(err) }));
    }
  })();
})();
