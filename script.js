const SITE_CONTACTS = {
  whatsapp: '60132922612',
  whatsappDisplay: '+60 13-2922 612'
};

const burger = document.getElementById('burgerBtn');
const navLinks = document.getElementById('navLinks');

const syncWhatsAppLinks = () => {
  document.querySelectorAll('[data-wa-link]').forEach((link) => {
    const num = link.getAttribute('data-wa-link') || SITE_CONTACTS.whatsapp;
    link.href = `https://wa.me/${num}`;
  });
};

syncWhatsAppLinks();

if (burger && navLinks) {
  burger.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

// Bayang lembut pada header sticky bila page di-scroll
const siteHeader = document.querySelector('header.site');
if (siteHeader) {
  const toggleHeaderShadow = () => {
    siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  toggleHeaderShadow();
  window.addEventListener('scroll', toggleHeaderShadow, { passive: true });
}

// Animasi fade-in lembut untuk section bila ia masuk viewport semasa scroll
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('in-view'));
}

// Butang salin nombor akaun bank
document.querySelectorAll('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const value = btn.getAttribute('data-copy') || '';
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      const temp = document.createElement('textarea');
      temp.value = value;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    const originalText = btn.textContent;
    btn.textContent = 'Disalin!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 1800);
  });
});

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- Waktu solat ----------
// Sumber utama: e-Solat JAKIM (rasmi), mengikut kod zon dalam config.js.
// Jika JAKIM tidak dapat dihubungi: kiraan Aladhan (anggaran), kemudian
// waktu terakhir yang disimpan dalam pelayar. Tiada waktu "tetap" dalam kod
// kerana waktu solat berubah sepanjang tahun.
const KL_LAT = 3.1660;
const KL_LNG = 101.6975;
// Anggaran sandaran sahaja. Sudut Subuh/Isyak 18° + pelarasan minit supaya
// hasil Aladhan hampir dengan jadual rasmi JAKIM (beza ≤ 1 minit pada tarikh
// yang diuji). Kaedah lalai Aladhan "17" memberi Subuh ~10 minit terlalu awal.
const ALADHAN_KAEDAH = 'method=99&methodSettings=18,null,18&tune=0,2,-1,2,2,2,0,2,0';
const KL_TIMEZONE = 'Asia/Kuala_Lumpur';
const ZON_SOLAT = (window.MASJID_CONFIG && window.MASJID_CONFIG.zonSolat) || 'WLY01';
const SOLAT_CACHE_KEY = 'mjkb:solat:v1';
const SOLAT_CUBA_SEMULA_MS = 5 * 60 * 1000;
const SOLAT_CACHE_MAKS_HARI = 7;

// Nama paparan → medan dalam respons JAKIM / Aladhan
const SOLAT_MEDAN = [
  { name: 'Subuh', jakim: 'fajr', aladhan: 'Fajr' },
  { name: 'Syuruk', jakim: 'syuruk', aladhan: 'Sunrise' },
  { name: 'Zohor', jakim: 'dhuhr', aladhan: 'Dhuhr' },
  { name: 'Asar', jakim: 'asr', aladhan: 'Asr' },
  { name: 'Maghrib', jakim: 'maghrib', aladhan: 'Maghrib' },
  { name: 'Isyak', jakim: 'isha', aladhan: 'Isha' }
];

// null = waktu belum diketahui (paparan menunjukkan "–:–")
let prayers = null;
let solatTarikh = null;
let solatSumber = null;
let solatCubaanAkhir = 0;

// Sentiasa ambil waktu SEBENAR di Kuala Lumpur (bukan jam peranti pengguna),
// supaya waktu solat & baki masa tepat tak kira di mana pengguna berada.
const klFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: KL_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false
});

function getKLNow() {
  const parts = {};
  klFormatter.formatToParts(new Date()).forEach((p) => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10) % 24,
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10)
  };
}

function fmt(h, m) {
  const period = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

function parseHM(raw) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(raw || '').trim());
  if (!match) throw new Error('Format waktu tidak dikenali');
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error('Waktu di luar julat');
  return { h, m };
}

function dateKeyOf(kl) {
  return `${kl.year}-${String(kl.month).padStart(2, '0')}-${String(kl.day).padStart(2, '0')}`;
}

function tarikhPanjang(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Tolak senarai yang tidak lengkap atau tidak menaik (Subuh < Syuruk < … < Isyak)
function sahkanWaktu(list) {
  if (!Array.isArray(list) || list.length !== SOLAT_MEDAN.length) throw new Error('Senarai waktu tidak lengkap');
  let prev = -1;
  list.forEach((p, i) => {
    const mins = p.h * 60 + p.m;
    if (p.name !== SOLAT_MEDAN[i].name || !Number.isInteger(mins) || mins <= prev) throw new Error('Waktu tidak sah');
    prev = mins;
  });
  return list;
}

async function ambilJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error('Respons tidak OK');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waktuDariJakim(kl) {
  const data = await ambilJson(
    `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=${encodeURIComponent(ZON_SOLAT)}`
  );
  const row = data && Array.isArray(data.prayerTime) ? data.prayerTime[0] : null;
  if (!row) throw new Error('Tiada data JAKIM');
  // Medan "date" berbentuk 12-Okt-2026 — pastikan ia memang hari ini di KL.
  const bahagian = String(row.date || '').split('-');
  if (Number(bahagian[0]) !== kl.day || Number(bahagian[2]) !== kl.year) throw new Error('Tarikh JAKIM tidak sepadan');
  return sahkanWaktu(SOLAT_MEDAN.map((f) => ({ name: f.name, ...parseHM(row[f.jakim]) })));
}

async function waktuDariAladhan(kl) {
  const dateParam = `${String(kl.day).padStart(2, '0')}-${String(kl.month).padStart(2, '0')}-${kl.year}`;
  const data = await ambilJson(
    `https://api.aladhan.com/v1/timings/${dateParam}?latitude=${KL_LAT}&longitude=${KL_LNG}&${ALADHAN_KAEDAH}&timezonestring=${KL_TIMEZONE}`
  );
  const t = data && data.data ? data.data.timings : null;
  if (!t) throw new Error('Tiada data Aladhan');
  return sahkanWaktu(SOLAT_MEDAN.map((f) => ({ name: f.name, ...parseHM(t[f.aladhan]) })));
}

function bacaCacheSolat() {
  try {
    const c = JSON.parse(localStorage.getItem(SOLAT_CACHE_KEY) || 'null');
    if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(c.tarikh)) return null;
    sahkanWaktu(c.waktu);
    return c;
  } catch (err) {
    return null;
  }
}

function simpanCacheSolat(tarikh, sumber, waktu) {
  try {
    localStorage.setItem(SOLAT_CACHE_KEY, JSON.stringify({ tarikh, sumber, waktu }));
  } catch (err) { /* storan pelayar penuh/disekat — abaikan */ }
}

function setSourceNote(text) {
  document.querySelectorAll('.solat-note').forEach((el) => {
    el.textContent = text;
  });
}

function gunaWaktu(waktu, tarikh, sumber, hariIni) {
  prayers = waktu;
  solatTarikh = tarikh;
  solatSumber = sumber;
  if (tarikh !== hariIni) {
    setSourceNote(`Tidak dapat menyambung ke sumber waktu solat sekarang. Waktu di atas ialah waktu bagi ${tarikhPanjang(tarikh)} dan mungkin berbeza beberapa minit hari ini. Sila semak e-solat.gov.my untuk kepastian.`);
  } else if (sumber === 'jakim') {
    setSourceNote(`Waktu solat rasmi JAKIM (e-Solat) bagi zon ${ZON_SOLAT}, ${tarikhPanjang(tarikh)}. Dikemas kini automatik setiap hari.`);
  } else {
    setSourceNote(`Sumber rasmi JAKIM tidak dapat dihubungi buat masa ini. Waktu di atas ialah kiraan anggaran bagi ${tarikhPanjang(tarikh)} dan mungkin berbeza seminit dua. Sila semak e-solat.gov.my untuk kepastian.`);
  }
  renderSolatGrid();
  updatePrayerState();
}

async function fetchTodayPrayerTimes() {
  const kl = getKLNow();
  const hariIni = dateKeyOf(kl);
  if (solatTarikh === hariIni && solatSumber === 'jakim') return;

  const cache = bacaCacheSolat();
  if (cache && cache.tarikh === hariIni && cache.sumber === 'jakim') {
    gunaWaktu(cache.waktu, cache.tarikh, cache.sumber, hariIni);
    return;
  }
  // Papar sesuatu dengan segera sementara menunggu rangkaian
  if (cache && solatTarikh !== hariIni) {
    const umurHari = (Date.parse(hariIni) - Date.parse(cache.tarikh)) / 86400000;
    if (umurHari >= 0 && umurHari <= SOLAT_CACHE_MAKS_HARI && cache.tarikh !== solatTarikh) {
      gunaWaktu(cache.waktu, cache.tarikh, cache.sumber, hariIni);
    }
  }

  // Jangan ketuk pelayan setiap minit jika ia sedang bermasalah
  if (Date.now() - solatCubaanAkhir < SOLAT_CUBA_SEMULA_MS) return;
  solatCubaanAkhir = Date.now();

  try {
    const waktu = await waktuDariJakim(kl);
    simpanCacheSolat(hariIni, 'jakim', waktu);
    gunaWaktu(waktu, hariIni, 'jakim', hariIni);
    return;
  } catch (err) { /* cuba sumber kedua */ }

  if (solatTarikh === hariIni) return; // sudah ada anggaran hari ini
  try {
    const waktu = await waktuDariAladhan(kl);
    simpanCacheSolat(hariIni, 'aladhan', waktu);
    gunaWaktu(waktu, hariIni, 'aladhan', hariIni);
  } catch (err) {
    if (!prayers) {
      setSourceNote('Tidak dapat memuatkan waktu solat sekarang. Sila pastikan sambungan internet aktif, atau semak e-solat.gov.my / papan kenyataan masjid.');
    } else if (solatTarikh !== hariIni) {
      gunaWaktu(prayers, solatTarikh, solatSumber, hariIni); // tanda sebagai waktu hari sebelumnya
    }
  }
}

function renderSolatGrid() {
  document.querySelectorAll('.solat-cell').forEach((cell) => {
    const name = cell.getAttribute('data-name');
    const p = prayers ? prayers.find((pr) => pr.name === name) : null;
    const timeEl = cell.querySelector('.time');
    if (timeEl) timeEl.textContent = p ? fmt(p.h, p.m) : '–:–';
  });
}

function updatePrayerState() {
  const nameEl = document.getElementById('nextPrayerName');
  const timeEl = document.getElementById('nextPrayerTime');
  const countEl = document.getElementById('countdownText');
  const progressEl = document.getElementById('prayerProgressFill');

  if (!prayers) {
    document.querySelectorAll('.solat-cell').forEach((cell) => cell.classList.remove('active'));
    if (nameEl) nameEl.textContent = '…';
    if (timeEl) timeEl.textContent = 'Sedang memuatkan';
    if (countEl) countEl.textContent = '…';
    if (progressEl) progressEl.style.width = '0%';
    return;
  }

  const kl = getKLNow();
  const nowMins = kl.hour * 60 + kl.minute;

  let activeName = null;
  let next = null;

  for (let i = 0; i < prayers.length; i++) {
    const mins = prayers[i].h * 60 + prayers[i].m;

    if (nowMins < mins) {
      next = prayers[i];
      activeName = i === 0 ? prayers[prayers.length - 1].name : prayers[i - 1].name;
      break;
    }

    activeName = prayers[i].name;

    if (i === prayers.length - 1) {
      next = prayers[0];
    }
  }

  if (!next) next = prayers[0];

  document.querySelectorAll('.solat-cell').forEach((cell) => {
    cell.classList.toggle('active', cell.getAttribute('data-name') === activeName);
  });

  if (nameEl) nameEl.textContent = next.name;
  if (timeEl) timeEl.textContent = fmt(next.h, next.m);

  const nowTotalSecs = kl.hour * 3600 + kl.minute * 60 + kl.second;
  const targetTotalSecs = next.h * 3600 + next.m * 60;

  if (countEl) {
    let diffSecs = targetTotalSecs - nowTotalSecs;
    if (diffSecs <= 0) diffSecs += 24 * 3600;
    const hrs = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    countEl.textContent = `${hrs} jam ${mins} minit lagi`;
  }

  if (progressEl) {
    const nextIndex = prayers.findIndex((p) => p.name === next.name);
    const prevIndex = (nextIndex - 1 + prayers.length) % prayers.length;
    const prev = prayers[prevIndex];
    const startSecs = prev.h * 3600 + prev.m * 60;
    let endSecs = targetTotalSecs;
    if (endSecs <= startSecs) endSecs += 24 * 3600;
    let nowAdj = nowTotalSecs;
    if (nowAdj < startSecs) nowAdj += 24 * 3600;
    const percent = Math.min(100, Math.max(0, ((nowAdj - startSecs) / (endSecs - startSecs)) * 100));
    progressEl.style.width = `${percent}%`;
  }
}

if (document.querySelector('.solat-cell') || document.getElementById('nextPrayerName')) {
  renderSolatGrid();
  updatePrayerState();
  fetchTodayPrayerTimes();
  setInterval(updatePrayerState, 1000);
  setInterval(fetchTodayPrayerTimes, 60000);
}

const isQurbanPlaceholder = (photo) => {
  const cell = photo.closest('.cat-cell');
  return Boolean(cell?.querySelector('.cat-photo-pair-main') && photo.getAttribute('src')?.startsWith('data:image/svg+xml'));
};
const programPhotos = Array.from(document.querySelectorAll('#program .cat-grid > .cat-cell > .cat-photo, #program .cat-grid .cat-photo-pair > .cat-photo:first-child'))
  .filter((photo) => !isQurbanPlaceholder(photo));
if (programPhotos.length && typeof HTMLDialogElement !== 'undefined') {
  const photoDialog = document.createElement('dialog');
  photoDialog.className = 'program-photo-dialog';
  photoDialog.setAttribute('aria-label', 'Paparan gambar program');

  const closePhotoDialog = document.createElement('button');
  closePhotoDialog.type = 'button';
  closePhotoDialog.className = 'program-photo-dialog-close';
  closePhotoDialog.textContent = 'Tutup';

  const photoContent = document.createElement('div');
  photoContent.className = 'program-photo-dialog-content';
  const previousPhoto = document.createElement('button');
  previousPhoto.type = 'button';
  previousPhoto.className = 'program-photo-dialog-nav';
  previousPhoto.setAttribute('aria-label', 'Gambar sebelumnya');
  previousPhoto.textContent = '\u2039';
  const nextPhoto = document.createElement('button');
  nextPhoto.type = 'button';
  nextPhoto.className = 'program-photo-dialog-nav';
  nextPhoto.setAttribute('aria-label', 'Gambar seterusnya');
  nextPhoto.textContent = '\u203a';

  const expandedPhoto = document.createElement('img');
  expandedPhoto.alt = '';
  photoContent.append(previousPhoto, expandedPhoto, nextPhoto);
  photoDialog.append(closePhotoDialog, photoContent);
  document.body.appendChild(photoDialog);

  let activeGallery = [];
  let activePhotoIndex = 0;
  const showPhoto = (index) => {
    activePhotoIndex = (index + activeGallery.length) % activeGallery.length;
    expandedPhoto.src = activeGallery[activePhotoIndex].src;
    expandedPhoto.alt = activeGallery[activePhotoIndex].alt;
  };

  programPhotos.forEach((photo) => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cat-photo-trigger';
    const programName = photo.closest('.cat-cell')?.querySelector('h3')?.textContent.trim() || photo.alt;
    trigger.setAttribute('aria-label', `Besarkan gambar: ${programName}`);
    photo.parentNode.insertBefore(trigger, photo);
    trigger.appendChild(photo);
    const pair = photo.closest('.cat-photo-pair');

    trigger.addEventListener('click', () => {
      const cardPhotos = Array.from(photo.closest('.cat-cell').querySelectorAll('.cat-photo'))
        .filter((cardPhoto) => !isQurbanPlaceholder(cardPhoto));
      activeGallery = cardPhotos.map((cardPhoto) => ({
        src: cardPhoto.currentSrc || cardPhoto.src,
        alt: cardPhoto.alt
      }));
      showPhoto(cardPhotos.indexOf(photo));
      previousPhoto.hidden = activeGallery.length < 2;
      nextPhoto.hidden = activeGallery.length < 2;
      photoDialog.showModal();
    });

    if (pair) {
      pair.querySelectorAll('.cat-photo:not(:first-child)').forEach((extraPhoto) => extraPhoto.hidden = true);
    }
  });

  closePhotoDialog.addEventListener('click', () => photoDialog.close());
  previousPhoto.addEventListener('click', () => showPhoto(activePhotoIndex - 1));
  nextPhoto.addEventListener('click', () => showPhoto(activePhotoIndex + 1));
  photoDialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' && !previousPhoto.hidden) showPhoto(activePhotoIndex - 1);
    if (event.key === 'ArrowRight' && !nextPhoto.hidden) showPhoto(activePhotoIndex + 1);
  });
  photoDialog.addEventListener('click', (event) => {
    if (event.target === photoDialog) photoDialog.close();
  });
}

const qrTrigger = document.querySelector('.qr-image-trigger');
const qrImage = qrTrigger?.querySelector('.qr-image');
if (qrTrigger && qrImage && typeof HTMLDialogElement !== 'undefined') {
  const qrDialog = document.createElement('dialog');
  qrDialog.className = 'program-photo-dialog qr-photo-dialog';
  qrDialog.setAttribute('aria-label', 'Paparan QR DuitNow');

  const closeQrDialog = document.createElement('button');
  closeQrDialog.type = 'button';
  closeQrDialog.className = 'program-photo-dialog-close';
  closeQrDialog.textContent = 'Tutup';

  const qrDialogContent = document.createElement('div');
  qrDialogContent.className = 'qr-photo-dialog-content';
  const expandedQr = document.createElement('img');
  expandedQr.className = 'qr-expanded-image';
  expandedQr.src = qrImage.currentSrc || qrImage.src;
  expandedQr.alt = qrImage.alt;
  qrDialogContent.appendChild(expandedQr);
  qrDialog.append(closeQrDialog, qrDialogContent);
  document.body.appendChild(qrDialog);

  qrTrigger.addEventListener('click', () => qrDialog.showModal());
  closeQrDialog.addEventListener('click', () => qrDialog.close());
  qrDialog.addEventListener('click', (event) => {
    if (event.target === qrDialog) qrDialog.close();
  });
}
