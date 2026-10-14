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

  const lukisAhli = (ahli, kelas = '') => {
    const kad = el('div', `flow-card${kelas ? ` ${kelas}` : ''}`);
    kad.append(el('div', 'flow-role', ahli.jawatan), el('div', 'flow-name', ahli.nama));
    return kad;
  };

  const lukisBiro = (kumpulan) => {
    const kad = el('section', 'bureau-group');
    kad.append(el('h4', null, kumpulan.tajuk));
    const senarai = el('ul');
    kumpulan.ahli.forEach((ahli) => senarai.append(el('li', null, ahli.nama)));
    kad.append(senarai);
    return kad;
  };

  const sambung = () => el('div', 'flow-connector');

  const lukisAjk = (sasaran, kumpulan) => {
    const kepimpinan = kumpulan.find((item) => /kepimpinan/i.test(item.tajuk)) || kumpulan[0];
    const bakiAhli = [...kepimpinan.ahli];
    const ambilJawatan = (jawatan) => {
      const indeks = bakiAhli.findIndex((ahli) => ahli.jawatan.toLocaleLowerCase() === jawatan.toLocaleLowerCase());
      return indeks < 0 ? null : bakiAhli.splice(indeks, 1)[0];
    };
    const carta = el('div', 'flow-structure committee-flow');
    const turutanAtas = ['Penaung', 'Penasihat', 'Pengerusi'].map(ambilJawatan).filter(Boolean);
    turutanAtas.forEach((ahli, indeks) => {
      if (indeks) carta.append(sambung());
      carta.append(lukisAhli(ahli, 'flow-card-top'));
    });

    const bendahari = ambilJawatan('Bendahari');
    const setiausaha = ambilJawatan('Setiausaha');
    if (bendahari || setiausaha) {
      carta.append(sambung());
      const pegawai = el('div', 'committee-officers');
      if (bendahari) pegawai.append(lukisAhli(bendahari));
      if (setiausaha) pegawai.append(lukisAhli(setiausaha));
      carta.append(pegawai);
    }

    const timbalan = ambilJawatan('Timbalan Pengerusi');
    if (timbalan) {
      carta.append(sambung(), lukisAhli(timbalan, 'flow-card-top'));
    }
    bakiAhli.forEach((ahli) => carta.append(sambung(), lukisAhli(ahli, 'flow-card-top')));

    const biro = kumpulan.filter((item) => item !== kepimpinan);
    if (biro.length) {
      carta.append(sambung());
      const lajur = [el('div', 'flow-data-column'), el('div', 'flow-data-column'), el('div', 'flow-data-column')];
      biro.forEach((item, indeks) => {
        const sasaranLajur = lajur[indeks % lajur.length];
        if (sasaranLajur.childElementCount) sasaranLajur.append(sambung());
        sasaranLajur.append(lukisBiro(item));
      });
      const cabang = el('div', 'committee-bureaus');
      cabang.replaceChildren(...lajur);
      carta.append(cabang);
    }
    sasaran.replaceChildren(carta);
  };

  const kumpulanIkutTajuk = (kumpulan, perkataan, indeks, digunakan) => {
    const ditemui = kumpulan.find((item) => !digunakan.has(item) && item.tajuk.toLocaleLowerCase().includes(perkataan));
    const hasil = ditemui || (kumpulan[indeks] && !digunakan.has(kumpulan[indeks]) ? kumpulan[indeks] : null);
    if (hasil) digunakan.add(hasil);
    return hasil;
  };

  const lukisSenaraiJawatan = (sasaran, ahli, kelasPertama = '') => {
    ahli.forEach((item, indeks) => {
      if (indeks) sasaran.append(sambung());
      sasaran.append(lukisAhli(item, indeks === 0 ? kelasPertama : ''));
    });
  };

  const lukisKumpulanNama = (tajuk, ahli) => {
    const kad = el('section', 'flow-card flow-card-support');
    kad.append(el('div', 'flow-role', tajuk));
    const senarai = el('ul');
    ahli.forEach((item) => senarai.append(el('li', null, item.nama)));
    kad.append(senarai);
    return kad;
  };

  const lukisKumpulanTambahan = (kumpulan) => {
    const kad = el('section', 'bureau-group');
    kad.append(el('h4', null, kumpulan.tajuk));
    const senarai = el('ul');
    kumpulan.ahli.forEach((ahli) => senarai.append(el('li', null, `${ahli.jawatan}: ${ahli.nama}`)));
    kad.append(senarai);
    return kad;
  };

  const lukisKakitangan = (sasaran, kumpulan) => {
    const digunakan = new Set();
    const pihak = kumpulanIkutTajuk(kumpulan, 'pihak berkuasa', 0, digunakan);
    const imam = kumpulanIkutTajuk(kumpulan, 'imam', 1, digunakan);
    const pengurusan = kumpulanIkutTajuk(kumpulan, 'pengurusan', 2, digunakan);
    const pembantu = kumpulanIkutTajuk(kumpulan, 'pembantu', 3, digunakan);
    const bilal = kumpulanIkutTajuk(kumpulan, 'bilal', 4, digunakan);
    const carta = el('div', 'flow-structure staff-flow');

    if (pihak && pihak.ahli[0]) {
      const utama = pihak.ahli[0];
      const autoriti = el('div', 'flow-card flow-card-authority');
      autoriti.append(el('div', 'flow-role', utama.jawatan), el('div', 'flow-name', utama.nama));
      carta.append(autoriti);
    }
    if (pihak && pihak.ahli[1]) carta.append(sambung(), lukisAhli(pihak.ahli[1], 'flow-card-top'));
    carta.append(sambung());

    const cabang = el('div', 'staff-branches');
    const kumpulanImam = el('section', 'staff-group');
    kumpulanImam.append(el('h3', null, imam ? imam.tajuk : 'Imam'));
    if (imam) lukisSenaraiJawatan(kumpulanImam, imam.ahli);
    cabang.append(kumpulanImam);

    const tengah = el('div', 'staff-center');
    if (pengurusan) lukisSenaraiJawatan(tengah, pengurusan.ahli, 'flow-card-top');
    if (pembantu && pembantu.ahli.length) {
      tengah.append(sambung(), lukisKumpulanNama(pembantu.tajuk, pembantu.ahli.slice(0, 2)));
      const bakiPembantu = pembantu.ahli.slice(2);
      if (bakiPembantu.length) {
        tengah.append(sambung());
        const sokongan = el('div', 'support-grid');
        for (let indeks = 0; indeks < bakiPembantu.length; indeks += 4) {
          sokongan.append(lukisKumpulanNama(pembantu.tajuk, bakiPembantu.slice(indeks, indeks + 4)));
        }
        tengah.append(sokongan);
      }
    }
    kumpulan.filter((item) => !digunakan.has(item)).forEach((item) => tengah.append(sambung(), lukisKumpulanTambahan(item)));
    cabang.append(tengah);

    const kumpulanBilal = el('section', 'staff-group');
    kumpulanBilal.append(el('h3', null, bilal ? bilal.tajuk : 'Bilal'));
    if (bilal) lukisSenaraiJawatan(kumpulanBilal, bilal.ahli);
    cabang.append(kumpulanBilal);
    carta.append(cabang);
    sasaran.replaceChildren(carta);
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
    lukisAjk(document.querySelector('.committee-chart'), ajk);
    lukisKakitangan(document.querySelector('.staff-chart'), kakitangan);
  }).catch(() => {});
})();