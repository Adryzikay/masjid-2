// Struktur Carta Organisasi dibaca secara awam dari Supabase.
// Carta statik dalam HTML kekal sebagai sandaran jika tetapan belum tersedia.
(() => {
  'use strict';

  const cfg = window.MASJID_CONFIG || {};
  const asas = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  const kunci = String(cfg.supabaseKey || '').trim();
  const urlSah = /^https:\/\/[a-z0-9.-]+$/i.test(asas) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(asas);
  if (!urlSah || !kunci) return;

  const sahkanStruktur = (struktur) => struktur && typeof struktur === 'object'
    && Array.isArray(struktur.ajk) && Array.isArray(struktur.kakitangan)
    && [...struktur.ajk, ...struktur.kakitangan].every((kumpulan) =>
      kumpulan && typeof kumpulan.tajuk === 'string' && Array.isArray(kumpulan.ahli)
      && kumpulan.ahli.every((ahli) => ahli && typeof ahli.jawatan === 'string' && typeof ahli.nama === 'string'));

  const el = (tag, kelas, teks) => {
    const node = document.createElement(tag);
    if (kelas) node.className = kelas;
    if (teks !== undefined) node.textContent = teks;
    return node;
  };

  const lukisKumpulan = (kumpulan) => {
    const kad = el('section', 'bureau-group');
    kad.append(el('h4', null, kumpulan.tajuk));
    const senarai = el('ul');
    kumpulan.ahli.forEach((ahli) => {
      const baris = el('li');
      baris.append(el('div', 'flow-role', ahli.jawatan), el('div', 'flow-name', ahli.nama));
      senarai.append(baris);
    });
    kad.append(senarai);
    return kad;
  };

  const lukisCarta = (sasaran, kumpulan) => {
    if (!sasaran) return;
    if (!kumpulan.length) {
      sasaran.replaceChildren(el('p', 'kandungan-kosong', 'Maklumat carta belum dikemas kini.'));
      return;
    }
    sasaran.replaceChildren(el('div', 'bureau-grid'));
    sasaran.firstElementChild.replaceChildren(...kumpulan.map(lukisKumpulan));
  };

  fetch(`${asas}/rest/v1/carta_struktur?id=eq.utama&select=struktur`, {
    headers: { apikey: kunci, Accept: 'application/json' },
    credentials: 'omit'
  }).then((res) => {
    if (!res.ok) throw new Error('Tidak dapat memuatkan carta');
    return res.json();
  }).then((rows) => {
    if (!Array.isArray(rows) || !rows[0] || !sahkanStruktur(rows[0].struktur)) return;
    const { ajk, kakitangan } = rows[0].struktur;
    lukisCarta(document.querySelector('.committee-chart'), ajk);
    lukisCarta(document.querySelector('.staff-chart'), kakitangan);
  }).catch(() => {});
})();