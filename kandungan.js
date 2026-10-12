// Kandungan dinamik laman awam: pengumuman, aktiviti, jadual kuliah, program
// dan maklumat Solat Jumaat, dibaca dari Supabase (baca sahaja).
//
// KESELAMATAN: semua teks dari pangkalan data dimasukkan melalui textContent /
// createElement sahaja. JANGAN guna innerHTML untuk data dari Supabase.
//
// Jika Supabase tidak dapat dihubungi, salinan terakhir dalam pelayar
// digunakan; jika tiada, kandungan asas dalam HTML dikekalkan.
(() => {
  'use strict';

  const cfg = window.MASJID_CONFIG || {};
  const BASE = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  const KEY = String(cfg.supabaseKey || '').trim();
  const URL_SAH = /^https:\/\/[a-z0-9.-]+$/i.test(BASE) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);
  if (!URL_SAH || !KEY) return; // belum ditetapkan — kekalkan kandungan asas

  const CACHE_PREFIX = 'mjkb:kandungan:v1:';
  const CACHE_MAKS_MS = 14 * 24 * 60 * 60 * 1000;
  const HAD_MASA_MS = 8000;

  const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
  const HARI = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad']; // indeks 0 = hari 1
  const WAKTU = ['subuh', 'dhuha', 'zohor', 'asar', 'maghrib', 'isyak'];
  const WAKTU_LABEL = {
    subuh: 'Selepas Subuh', dhuha: 'Pagi (Dhuha)', zohor: 'Selepas Zohor',
    asar: 'Selepas Asar', maghrib: 'Selepas Maghrib', isyak: 'Selepas Isyak'
  };

  // ---------- Alat bantu ----------
  const teks = (v) => (typeof v === 'string' ? v.trim() : '');
  const sasaran = (nama) => Array.from(document.querySelectorAll(`[data-kandungan="${nama}"]`));

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  // Tarikh hari ini di Kuala Lumpur, bentuk YYYY-MM-DD
  const hariIniKL = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  const pecahTarikh = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks(s));
    if (!m) return null;
    const tarikh = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return { hari: Number(m[3]), bulan: Number(m[2]), hariMinggu: ((tarikh.getUTCDay() + 6) % 7) + 1 };
  };

  // Simpan kandungan asas (fallback) setiap bekas supaya boleh dipulihkan
  const asal = new WeakMap();
  const ingatAsal = (bekas) => {
    if (!asal.has(bekas)) asal.set(bekas, Array.from(bekas.childNodes).map((n) => n.cloneNode(true)));
  };
  const pulihAsal = (bekas) => {
    if (asal.has(bekas)) bekas.replaceChildren(...asal.get(bekas).map((n) => n.cloneNode(true)));
  };
  const ganti = (bekas, nodes) => {
    ingatAsal(bekas);
    bekas.replaceChildren(...nodes);
  };

  // Hanya dua bentuk laluan dibenarkan; apa-apa yang lain diabaikan.
  const urlGambar = (laluan) => {
    const l = teks(laluan);
    if (!l || l.includes('..')) return null;
    if (/^tapak:[A-Za-z0-9][A-Za-z0-9 _./()-]*$/.test(l)) {
      return l.slice(6).split('/').map(encodeURIComponent).join('/');
    }
    if (/^(aktiviti|program)\/[a-z0-9-]+\.(jpg|webp|png)$/.test(l)) {
      return `${BASE}/storage/v1/object/public/gambar/${l}`;
    }
    return null;
  };

  // Masukkan teks; alamat http(s) dijadikan pautan boleh klik.
  const isiBerpautan = (node, text) => {
    const corak = /https?:\/\/[^\s<>"']+/g;
    let akhir = 0;
    let padan;
    while ((padan = corak.exec(text)) !== null) {
      const mentah = padan[0].replace(/[.,;:!?)\]]+$/, '');
      corak.lastIndex = padan.index + mentah.length;
      let url;
      try { url = new URL(mentah); } catch (err) { continue; }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      node.append(text.slice(akhir, padan.index));
      const a = el('a', null, mentah);
      a.href = url.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      node.append(a);
      akhir = padan.index + mentah.length;
    }
    node.append(text.slice(akhir));
  };

  const mesejKosong = (text) => el('p', 'kandungan-kosong', text);

  // ---------- Rangkaian + cache ----------
  const bacaCache = (nama) => {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_PREFIX + nama) || 'null');
      if (!c || c.asal !== BASE || !Array.isArray(c.d) || Date.now() - c.t > CACHE_MAKS_MS) return null;
      return c.d;
    } catch (err) {
      return null;
    }
  };

  const simpanCache = (nama, rows) => {
    try {
      localStorage.setItem(CACHE_PREFIX + nama, JSON.stringify({ t: Date.now(), asal: BASE, d: rows }));
    } catch (err) { /* storan pelayar penuh/disekat — abaikan */ }
  };

  const ambil = async (laluan) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HAD_MASA_MS);
    try {
      const res = await fetch(`${BASE}/rest/v1/${laluan}`, {
        headers: { apikey: KEY, Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('Respons bukan senarai');
      return rows.filter((r) => r && typeof r === 'object');
    } finally {
      clearTimeout(timer);
    }
  };

  const cubaPapar = (papar, rows) => {
    try { papar(rows); } catch (err) { /* jangan biar satu bahagian merosakkan halaman */ }
  };

  // Papar salinan tersimpan dahulu (pantas), kemudian segarkan dari Supabase.
  const muat = async (nama, laluan, papar) => {
    const cache = bacaCache(nama);
    if (cache) cubaPapar(papar, cache);
    try {
      const rows = await ambil(laluan);
      simpanCache(nama, rows);
      if (!cache || JSON.stringify(cache) !== JSON.stringify(rows)) cubaPapar(papar, rows);
    } catch (err) {
      // Tidak dapat dihubungi: kekalkan salinan tersimpan atau kandungan asas.
    }
  };

  // ---------- Pengumuman + jalur bergerak ----------
  const paparPengumuman = (rows) => {
    const hariIni = hariIniKL();
    const aktif = rows.filter((r) => teks(r.tajuk) && (!teks(r.tarikh_tamat) || teks(r.tarikh_tamat) >= hariIni));

    sasaran('pengumuman').forEach((bekas) => {
      const had = Number(bekas.dataset.had) || 6;
      if (!aktif.length) {
        ganti(bekas, [mesejKosong('Tiada pengumuman baharu buat masa ini.')]);
        return;
      }
      ganti(bekas, aktif.slice(0, had).map((r) => {
        const item = el('div', 'list-item');
        if (teks(r.kategori)) item.append(el('span', 'tag', teks(r.kategori)));
        item.append(el('h3', null, teks(r.tajuk)));
        if (teks(r.isi)) {
          const p = el('p');
          isiBerpautan(p, teks(r.isi));
          item.append(p);
        }
        return item;
      }));
    });

    sasaran('ticker').forEach((trek) => {
      const tajuk = aktif.filter((r) => r.papar_ticker === true).map((r) => teks(r.tajuk)).slice(0, 8);
      ingatAsal(trek);
      if (!tajuk.length) {
        pulihAsal(trek);
        trek.style.animationDuration = '';
        return;
      }
      // Ulang supaya jalur sentiasa penuh, kemudian gandakan untuk gelung lancar
      let separuh = tajuk.slice();
      while (separuh.join('').length < 220 && separuh.length < 40) separuh = separuh.concat(tajuk);
      trek.replaceChildren(...separuh.concat(separuh).map((t) => el('span', null, t)));
      trek.style.animationDuration = `${Math.max(24, Math.round(separuh.join('').length / 7))}s`;
    });
  };

  // ---------- Aktiviti / kalendar ----------
  const paparAktiviti = (rows) => {
    const hariIni = hariIniKL();
    const akanDatang = rows
      .filter((r) => teks(r.tajuk) && pecahTarikh(r.tarikh) && teks(r.tarikh) >= hariIni)
      .sort((a, b) => teks(a.tarikh).localeCompare(teks(b.tarikh)));

    sasaran('aktiviti').forEach((bekas) => {
      const had = Number(bekas.dataset.had) || 12;
      if (!akanDatang.length) {
        ganti(bekas, [mesejKosong('Tiada aktiviti akan datang buat masa ini. Ikuti laman Facebook masjid untuk makluman terkini.')]);
        return;
      }
      ganti(bekas, akanDatang.slice(0, had).map((r) => {
        const t = pecahTarikh(r.tarikh);
        const item = el('div', 'program-item');

        const tarikh = el('div', 'program-date');
        tarikh.append(el('div', 'd', String(t.hari).padStart(2, '0')), el('div', 'm', BULAN[t.bulan - 1]));
        item.append(tarikh);

        const src = urlGambar(r.gambar);
        if (src) {
          const img = el('img', 'program-photo');
          img.src = src;
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('error', () => img.remove()); // fail sudah dipadam — sorok sahaja
          item.append(img);
        }

        const badan = el('div');
        badan.append(el('h3', null, teks(r.tajuk)));
        const p = el('p');
        const bila = teks(r.tarikh) === hariIni ? 'Hari ini' : HARI[t.hariMinggu - 1];
        p.append(el('strong', null, teks(r.masa) ? `${bila}, ${teks(r.masa)}` : bila));
        if (teks(r.keterangan)) {
          p.append(' · ');
          isiBerpautan(p, teks(r.keterangan));
        }
        badan.append(p);
        item.append(badan);
        return item;
      }));
    });
  };

  // ---------- Jadual kuliah mingguan ----------
  const paparKuliah = (rows) => {
    const sah = rows.filter((r) => teks(r.tajuk) && Number.isInteger(r.hari) && r.hari >= 1 && r.hari <= 7 && WAKTU.includes(r.waktu));
    const hariIni = pecahTarikh(hariIniKL()).hariMinggu;

    sasaran('kuliah').forEach((bekas) => {
      if (!sah.length) {
        ganti(bekas, [mesejKosong('Jadual kuliah mingguan belum dikemas kini. Sila rujuk papan kenyataan masjid.')]);
        return;
      }
      const grid = el('div', 'kuliah-grid');
      for (let hari = 1; hari <= 7; hari++) {
        const senarai = sah
          .filter((r) => r.hari === hari)
          .sort((a, b) => WAKTU.indexOf(a.waktu) - WAKTU.indexOf(b.waktu));
        if (!senarai.length) continue;

        const kad = el('div', hari === hariIni ? 'kuliah-hari hari-ini' : 'kuliah-hari');
        const tajukHari = el('h3', null, HARI[hari - 1]);
        if (hari === hariIni) tajukHari.append(el('small', null, 'Hari ini'));
        kad.append(tajukHari);

        senarai.forEach((r) => {
          const item = el('div', 'kuliah-item');
          item.append(el('div', 'waktu', WAKTU_LABEL[r.waktu]), el('div', 'tajuk', teks(r.tajuk)));
          const butiran = [teks(r.penceramah), teks(r.tempat)].filter(Boolean).join(' · ');
          if (butiran) item.append(el('div', 'butiran', butiran));
          kad.append(item);
        });
        grid.append(kad);
      }
      ganti(bekas, [grid]);
    });
  };

  // ---------- Program tahunan (kad bergambar) ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ikonProgram = () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M12 2.5l2.3 5.6 6-1.3-3.9 4.7 3.9 4.7-6-1.3-2.3 5.6-2.3-5.6-6 1.3 3.9-4.7-3.9-4.7 6 1.3z');
    svg.append(path);
    return svg;
  };

  const paparProgram = (rows) => {
    const sah = rows.filter((r) => teks(r.tajuk));
    const sambungGambar = () => {
      if (window.MJKB && typeof window.MJKB.wireProgramPhotos === 'function') window.MJKB.wireProgramPhotos();
    };

    // Jadual kosong = belum diisi: kekalkan (atau pulihkan) kad asas dalam HTML.
    if (!sah.length) {
      sasaran('program').forEach((bekas) => {
        if (!asal.has(bekas)) return;
        pulihAsal(bekas);
        bekas.classList.remove('cat-grid-dinamik');
        // Salinan asas tidak membawa pengendali klik — buka balutan dan sambung semula
        bekas.querySelectorAll('.cat-photo-trigger').forEach((butang) => butang.replaceWith(...butang.childNodes));
        bekas.querySelectorAll('.cat-photo[hidden]').forEach((img) => { img.hidden = false; });
      });
      sambungGambar();
      return;
    }

    sasaran('program').forEach((bekas) => {
      bekas.classList.add('cat-grid-dinamik');
      ganti(bekas, sah.map((r) => {
        const sel = el('div', 'cat-cell');
        const gambar = (Array.isArray(r.program_gambar) ? r.program_gambar : [])
          .slice()
          .sort((a, b) => (Number(a.susunan) || 0) - (Number(b.susunan) || 0))
          .map((g) => urlGambar(g && g.laluan))
          .filter(Boolean);

        if (gambar.length) {
          const pasangan = el('div', 'cat-photo-pair');
          gambar.forEach((src, i) => {
            const img = el('img', 'cat-photo');
            img.src = src;
            img.alt = gambar.length > 1 ? `${teks(r.tajuk)} — gambar ${i + 1}` : teks(r.tajuk);
            img.loading = 'lazy';
            pasangan.append(img);
          });
          sel.append(pasangan);
        }

        const badan = el('div', 'cat-cell-body');
        const teksBadan = el('div');
        teksBadan.append(el('h3', null, teks(r.tajuk)));
        if (teks(r.keterangan)) teksBadan.append(el('p', null, teks(r.keterangan)));
        badan.append(ikonProgram(), teksBadan);
        sel.append(badan);
        return sel;
      }));
    });

    sambungGambar();
  };

  // ---------- Maklumat Solat Jumaat ----------
  const paparJumaat = (rows) => {
    const nilai = {};
    rows.forEach((r) => { if (typeof r.kunci === 'string') nilai[r.kunci] = teks(r.nilai); });
    const bahagian = [
      ['Solat Jumaat', nilai.jumaat_masa],
      ['Khatib', nilai.jumaat_khatib],
      ['Tajuk khutbah', nilai.jumaat_tajuk]
    ].filter(([, v]) => v);

    sasaran('jumaat').forEach((bekas) => {
      bekas.replaceChildren();
      bahagian.forEach(([label, v], i) => {
        if (i > 0) bekas.append(' · ');
        bekas.append(el('strong', null, `${label}: `), v);
      });
      bekas.hidden = bahagian.length === 0;
    });
  };

  // ---------- Mula ----------
  const hariIni = hariIniKL();
  const perlu = (...nama) => nama.some((n) => sasaran(n).length > 0);

  if (perlu('pengumuman', 'ticker')) {
    muat('pengumuman',
      `pengumuman?select=id,kategori,tajuk,isi,papar_ticker,tarikh_tamat&or=(tarikh_tamat.is.null,tarikh_tamat.gte.${hariIni})&order=dicipta_pada.desc&limit=30`,
      paparPengumuman);
  }
  if (perlu('aktiviti')) {
    muat('aktiviti',
      `aktiviti?select=id,tajuk,keterangan,tarikh,masa,gambar&tarikh=gte.${hariIni}&order=tarikh.asc,dicipta_pada.asc&limit=30`,
      paparAktiviti);
  }
  if (perlu('kuliah')) {
    muat('kuliah', 'kuliah?select=id,hari,waktu,tajuk,penceramah,tempat&order=hari.asc&limit=100', paparKuliah);
  }
  if (perlu('program')) {
    muat('program',
      'program?select=id,tajuk,keterangan,susunan,program_gambar(laluan,susunan)&order=susunan.asc,dicipta_pada.asc&limit=40',
      paparProgram);
  }
  if (perlu('jumaat')) {
    muat('tetapan', 'tetapan?select=kunci,nilai', paparJumaat);
  }
})();
