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

const KL_LAT = 3.1660;
const KL_LNG = 101.6975;
const JAKIM_METHOD = 17;
const KL_TIMEZONE = 'Asia/Kuala_Lumpur';

let prayers = [
  { name: 'Subuh', h: 5, m: 58 },
  { name: 'Syuruk', h: 7, m: 18 },
  { name: 'Zohor', h: 13, m: 23 },
  { name: 'Asar', h: 16, m: 44 },
  { name: 'Maghrib', h: 19, m: 23 },
  { name: 'Isyak', h: 20, m: 33 }
];
let lastFetchedDateKey = null;

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
  const clean = raw.split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  return { h, m };
}

function todayDateKeyAndUrl() {
  const kl = getKLNow();
  const dd = String(kl.day).padStart(2, '0');
  const mm = String(kl.month).padStart(2, '0');
  const yyyy = kl.year;
  const dateKey = `${yyyy}-${mm}-${dd}`;
  const dateParam = `${dd}-${mm}-${yyyy}`;
  return {
    dateKey,
    url: `https://api.aladhan.com/v1/timings/${dateParam}?latitude=${KL_LAT}&longitude=${KL_LNG}&method=${JAKIM_METHOD}&timezonestring=${KL_TIMEZONE}`
  };
}

function setSourceNote(text) {
  document.querySelectorAll('.solat-note').forEach((el) => {
    el.textContent = text;
  });
}

async function fetchTodayPrayerTimes() {
  const { dateKey, url } = todayDateKeyAndUrl();
  if (dateKey === lastFetchedDateKey) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Respons tidak OK');
    const data = await res.json();
    const t = data.data.timings;

    prayers = [
      { name: 'Subuh', ...parseHM(t.Fajr) },
      { name: 'Syuruk', ...parseHM(t.Sunrise) },
      { name: 'Zohor', ...parseHM(t.Dhuhr) },
      { name: 'Asar', ...parseHM(t.Asr) },
      { name: 'Maghrib', ...parseHM(t.Maghrib) },
      { name: 'Isyak', ...parseHM(t.Isha) }
    ];
    lastFetchedDateKey = dateKey;

    const kl = getKLNow();
    const tarikh = new Date(Date.UTC(kl.year, kl.month - 1, kl.day))
      .toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    setSourceNote(
      `Waktu solat dikemas kini automatik setiap hari mengikut kaedah JAKIM bagi kawasan Kuala Lumpur (${tarikh}). Solat Jumaat bermula jam 1:15 petang setiap minggu.`
    );
  } catch (err) {
    setSourceNote(
      'Tidak dapat menyambung ke sumber waktu solat sekarang — waktu di atas adalah anggaran sementara. Sila pastikan sambungan internet aktif, atau semak jadual rasmi JAKIM/JAWI.'
    );
  }

  renderSolatGrid();
  updatePrayerState();
}

function renderSolatGrid() {
  document.querySelectorAll('.solat-cell').forEach((cell) => {
    const name = cell.getAttribute('data-name');
    const p = prayers.find((pr) => pr.name === name);
    if (p) {
      const timeEl = cell.querySelector('.time');
      if (timeEl) timeEl.textContent = fmt(p.h, p.m);
    }
  });
}

function updatePrayerState() {
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

  const nameEl = document.getElementById('nextPrayerName');
  const timeEl = document.getElementById('nextPrayerTime');
  const countEl = document.getElementById('countdownText');
  const progressEl = document.getElementById('prayerProgressFill');

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

const programPhotos = document.querySelectorAll('#program .cat-grid > .cat-cell > .cat-photo, #program .cat-grid .cat-photo-pair > .cat-photo:first-child');
if (programPhotos.length && typeof HTMLDialogElement !== 'undefined') {
  const allProgramPhotos = Array.from(document.querySelectorAll('#program .cat-grid .cat-photo'));
  const programGallery = allProgramPhotos.map((photo) => ({
    src: photo.currentSrc || photo.src,
    alt: photo.alt
  }));
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
      activeGallery = programGallery;
      showPhoto(allProgramPhotos.indexOf(photo));
      previousPhoto.hidden = programGallery.length < 2;
      nextPhoto.hidden = programGallery.length < 2;
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
