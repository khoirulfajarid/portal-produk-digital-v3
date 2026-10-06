/**
 * ============================================================
 * v34.js — Fitur v3.4 untuk halaman Open Access & portal member
 *  • Pameran Karya berjalan otomatis (kecepatan diatur Admin), berhenti & bisa digeser saat disorot
 *  • Section Panduan (dokumen PDF/PPT atau video YouTube)
 *  • Pendaftaran Bootcamp: data diri → bukti syarat → token akses (dari Lynk.id)
 *  • Menu member "Bootcamp" (jadwal, link pertemuan, absensi) & "Pameran Karya" (ajukan testimoni karya)
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// 1. UTILITAS
// ════════════════════════════════════════════════════════════
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** Waktu bootcamp selalu ditampilkan dalam WIB (UTC+7), di perangkat mana pun. */
function wib(iso) { const t = Date.parse(iso); if (!t) return null; const d = new Date(t + 7 * 3600000); return { d: d, day: HARI[d.getUTCDay()], date: d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(), time: String(d.getUTCHours()).padStart(2, '0') + '.' + String(d.getUTCMinutes()).padStart(2, '0') }; }
function fmtWib(iso, withDay) { const w = wib(iso); return w ? (withDay ? w.day + ', ' : '') + w.date + ' · ' + w.time + ' WIB' : '—'; }
function fmtWibTime(iso) { const w = wib(iso); return w ? w.time : '—'; }

/** Foto profil member (atau inisial bila belum ada). */
function memberAvatar(s, size) {
  const st = 'width:' + size + 'px;height:' + size + 'px';
  return s && s.avatar ? '<span class="v4-avatar" style="' + st + '">' + img(s.avatar, s.memberName || '', '', initial(s.memberName)) + '</span>'
    : '<span class="v4-avatar v4-avatar-ph" style="' + st + ';font-size:' + Math.round(size / 2.4) + 'px">' + esc(initial((s && s.memberName) || '?')) + '</span>';
}

/** Perkecil foto sebelum diunggah (hemat kuota & cepat di HP). PNG/JPG besar → JPG maks 1600px. */
function compressImage(file, maxDim, quality) {
  return new Promise(resolve => {
    if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type) || file.size < 600 * 1024) return resolve(file);
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const sc = Math.min(1, (maxDim || 1600) / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(url); resolve(b && b.size < file.size ? new File([b], file.name.replace(/\.(png|jpe?g|webp)$/i, '') + '.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', quality || 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    im.src = url;
  });
}
function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Gagal membaca berkas.')); r.readAsDataURL(file); });
}
/** Pilih beberapa berkas sekaligus. */
function pickFiles(accept, multiple) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept || '*/*'; input.multiple = !!multiple; input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => { resolve(Array.from(input.files || [])); input.remove(); });
    input.click();
  });
}


// ════════════════════════════════════════════════════════════
// 2. PAMERAN KARYA BERJALAN (marquee)
// ════════════════════════════════════════════════════════════
function showcaseMarquee(list, speed) {
  return '<div class="v4-mq" data-speed="' + (Number(speed) || 40) + '">' +
    '<button type="button" class="v4-mq-btn prev" aria-label="Geser ke kiri"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>' +
    '<div class="v4-mq-view"><div class="v4-mq-track">' + list.map(showcaseCard).join('') + '</div></div>' +
    '<button type="button" class="v4-mq-btn next" aria-label="Geser ke kanan"><i data-lucide="chevron-right" class="w-5 h-5"></i></button></div>';
}

/**
 * Berjalan otomatis ke kanan dengan kecepatan Admin (px/detik). Kursor di atasnya / disentuh → berhenti,
 * lalu bisa digeser manual (roda mouse, trackpad, seret di HP, tombol panah). Konten digandakan agar berputar tanpa ujung.
 */
function initMarquees(root) {
  (root || document).querySelectorAll('.v4-mq').forEach(mq => {
    if (mq.dataset.ready) return;
    mq.dataset.ready = '1';
    const view = mq.querySelector('.v4-mq-view'), track = mq.querySelector('.v4-mq-track');
    const speed = Number(mq.dataset.speed) || 40;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const card = () => (track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width + 24 : 300);
    mq.querySelector('.prev').onclick = () => view.scrollBy({ left: -card(), behavior: 'smooth' });
    mq.querySelector('.next').onclick = () => view.scrollBy({ left: card(), behavior: 'smooth' });
    requestAnimationFrame(() => {
      if (track.scrollWidth <= view.clientWidth + 8) { mq.classList.add('is-static'); return; }   // muat semua → tidak perlu berjalan
      Array.from(track.children).forEach(c => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
      if (window.renderIcons) renderIcons(track);
      let paused = false, last = 0, acc = 0, resume = 0;
      const half = () => track.scrollWidth / 2;
      mq.addEventListener('mouseenter', () => { paused = true; });
      mq.addEventListener('mouseleave', () => { paused = false; });
      mq.addEventListener('focusin', () => { paused = true; });
      mq.addEventListener('focusout', () => { paused = false; });
      view.addEventListener('touchstart', () => { paused = true; clearTimeout(resume); }, { passive: true });
      view.addEventListener('touchend', () => { clearTimeout(resume); resume = setTimeout(() => { paused = false; }, 2500); }, { passive: true });
      view.addEventListener('scroll', () => {
        const h = half();
        if (view.scrollLeft >= h) view.scrollLeft -= h;
        else if (view.scrollLeft <= 0 && paused) view.scrollLeft += h;
      }, { passive: true });
      const step = t => {
        if (!mq.isConnected) return;                       // halaman dirender ulang → loop lama berhenti sendiri
        if (!paused && !reduce && document.visibilityState === 'visible') {
          acc += last ? speed * Math.min(t - last, 100) / 1000 : 0;
          if (acc >= 1) { const px = Math.floor(acc); acc -= px; view.scrollLeft += px; }
        }
        last = t;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
}


// ════════════════════════════════════════════════════════════
// 3. PANDUAN (dokumen / video)
// ════════════════════════════════════════════════════════════
function guideCard(g) {
  const isVid = g.type === 'video';
  const icon = isVid ? 'play-circle' : (/^ppt/.test(g.ext) ? 'presentation' : 'file-text');
  return '<article class="product-card v4-guide">' +
    (isVid && g.thumb ? '<div class="product-thumb cursor-pointer" onclick="openGuide(' + jsArg(g.id) + ')">' + img(g.thumb, g.title, '', 'Video') + '<span class="play-dot"><i data-lucide="play" class="w-5 h-5"></i></span></div>'
      : '<div class="v4-guide-icon" onclick="openGuide(' + jsArg(g.id) + ')"><i data-lucide="' + icon + '" class="w-9 h-9"></i><span>' + esc((g.ext || 'dok').toUpperCase()) + '</span></div>') +
    '<div class="p-5 flex flex-col flex-1">' +
      '<span class="badge ' + (isVid ? 'badge-video' : 'badge-document') + ' self-start">' + (isVid ? 'Video' : 'Dokumen') + '</span>' +
      '<h3 class="mt-3 text-[16px] font-semibold leading-snug text-main line-clamp-2">' + esc(g.title) + '</h3>' +
      (g.description ? '<p class="mt-2 text-sm text-muted line-clamp-3 flex-1">' + esc(g.description) + '</p>' : '<div class="flex-1"></div>') +
      '<button class="btn-ghost w-full mt-4" onclick="openGuide(' + jsArg(g.id) + ')"><i data-lucide="' + (isVid ? 'play' : 'book-open') + '" class="w-4 h-4"></i> ' + (isVid ? 'Tonton Video' : 'Buka Panduan') + '</button>' +
    '</div></article>';
}
function openGuide(id) {
  const g = (((AppState.pub && AppState.pub.guides) || {}).list || []).filter(x => x.id === id)[0];
  if (!g) return;
  if (g.type === 'video') {
    Swal.fire({ width: 900, showConfirmButton: false, showCloseButton: true,
      html: '<div style="text-align:left"><div class="video-frame"><iframe src="' + esc(g.videoEmbed) + '" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div>' +
        '<h3 class="mt-4 text-xl font-bold text-main">' + esc(g.title) + '</h3>' + (g.description ? '<p class="mt-2 text-sm text-muted whitespace-pre-line">' + esc(g.description) + '</p>' : '') + '</div>' });
    return;
  }
  previewDocument(g.previewUrl, g.downloadUrl, g.title);
}


// ════════════════════════════════════════════════════════════
// 4. PENDAFTARAN BOOTCAMP (data diri → bukti syarat → token akses)
// ════════════════════════════════════════════════════════════
const BW = { b: null, step: 0, steps: [], d: {}, files: {}, links: {}, busy: false, tokenInfo: null };

function findBootPublic(id) {
  const pool = [].concat((AppState.pub && AppState.pub.bootcamps) || [], (AppState.m && AppState.m.bootcamp && AppState.m.bootcamp.open) || []);
  return pool.filter(b => b.id === id)[0] || null;
}

async function openBootcampRegister(bootId, opts) {
  opts = opts || {};
  if (AppState.role === ROLE_ADMIN) return showToast('Mode Superadmin', 'Pendaftaran bootcamp dilakukan dari akun member / halaman publik.', 'warning');
  let b = findBootPublic(bootId);
  if (!b) { await Public.prefetch(true); b = findBootPublic(bootId); }
  if (!b) return showToast('Bootcamp tidak ditemukan', 'Mungkin sudah ditutup.', 'error');
  if (!b.regOpen) return showToast('Pendaftaran belum dibuka', 'Hubungi Admin untuk info lebih lanjut.', 'warning');
  if (AppState.role === ROLE_MEMBER && AppState.m && AppState.m.bootcamp && AppState.m.bootcamp.mine.some(x => x.id === b.id)) { go('bootcamp'); return; }
  const prof = AppState.role === ROLE_MEMBER && AppState.m ? (AppState.m.profile || {}) : {};
  const saved = Store.get('bootForm', {}), lead = Store.get('lead', {});
  BW.b = b; BW.step = 0; BW.files = {}; BW.links = {}; BW.busy = false; BW.tokenInfo = null;
  BW.steps = ['data'].concat((b.requirements || []).length ? ['bukti'] : []).concat(['token']);
  BW.d = {
    fullName: prof.fullName || prof.nickname || saved.fullName || lead.name || '',
    profession: prof.profession || saved.profession || '',
    email: AppState.role === ROLE_MEMBER ? AppState.email : (opts.email || saved.email || lead.email || ''),
    whatsapp: prof.whatsapp || saved.whatsapp || lead.whatsapp || '', token: opts.token || ''
  };
  Swal.fire({ width: 660, showConfirmButton: false, showCloseButton: true, allowOutsideClick: () => !BW.busy,
    html: '<div id="bwBox" class="v4-wiz"></div>', didOpen: () => bwRender() });
}

function bwCollect() {
  const v = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  if (v('bwName') !== undefined) BW.d.fullName = v('bwName').trim();
  if (v('bwProf') !== undefined) BW.d.profession = v('bwProf').trim();
  if (v('bwEmail') !== undefined) BW.d.email = v('bwEmail').trim().toLowerCase();
  if (v('bwWa') !== undefined) BW.d.whatsapp = normWa(v('bwWa'));
  if (v('bwToken') !== undefined) BW.d.token = v('bwToken').trim().toUpperCase().replace(/\s+/g, '');
  document.querySelectorAll('#bwBox [data-link]').forEach(i => { BW.links[i.dataset.link] = i.value.trim(); });
}

function bwRender(errMsg) {
  const box = document.getElementById('bwBox'); if (!box) return;
  const b = BW.b, step = BW.steps[BW.step], labels = { data: 'Data Diri', bukti: 'Bukti Syarat', token: 'Token Akses' };
  const head = '<div class="text-left"><p class="text-xs font-semibold text-accent">DAFTAR BOOTCAMP</p><h3 class="text-xl font-bold text-main mt-1">' + esc(b.title) + '</h3>' +
    '<div class="v4-steps">' + BW.steps.map((s, i) => '<span class="' + (i < BW.step ? 'is-done' : i === BW.step ? 'is-active' : '') + '"><b>' + (i < BW.step ? '✓' : i + 1) + '</b> ' + labels[s] + '</span>').join('') + '</div></div>';
  let body = '';
  if (step === 'data') {
    const locked = AppState.role === ROLE_MEMBER;
    body = '<div class="v4-form">' +
      '<div><label class="form-label" for="bwName">Nama Lengkap *</label><input id="bwName" class="form-input" value="' + esc(BW.d.fullName) + '" placeholder="Nama sesuai sertifikat"></div>' +
      '<div><label class="form-label" for="bwProf">Profesi *</label><input id="bwProf" class="form-input" value="' + esc(BW.d.profession) + '" placeholder="mis. Guru, Mahasiswa, Admin Kantor"></div>' +
      '<div><label class="form-label" for="bwEmail">Email *</label><input id="bwEmail" type="email" class="form-input" value="' + esc(BW.d.email) + '"' + (locked ? ' readonly' : '') + ' placeholder="nama@email.com">' +
        '<p class="text-xs text-muted mt-1">' + (locked ? 'Memakai email akun Anda.' : 'Email ini menjadi akun login portal member Anda.') + '</p></div>' +
      '<div><label class="form-label" for="bwWa">No. WhatsApp *</label><input id="bwWa" class="form-input" inputmode="tel" autocomplete="tel" value="' + esc(BW.d.whatsapp) + '" placeholder="0878… atau +60…">' +
        '<p class="text-xs text-muted mt-1">' + esc(WA_HINT) + ' Pengingat jadwal dikirim ke nomor ini.</p></div></div>';
  } else if (step === 'bukti') {
    body = '<div class="v4-form"><p class="text-sm text-muted">Lampirkan bukti sesuai syarat dari Admin. Bertanda <b>Wajib</b> harus diisi.</p>' +
      b.requirements.map(r => {
        const list = BW.files[r.id] || [];
        let inner = '';
        if (r.type === 'link') inner = '<input class="form-input" type="url" data-link="' + esc(r.id) + '" value="' + esc(BW.links[r.id] || '') + '" placeholder="https://…">';
        else inner = '<div class="v4-files">' + list.map((f, i) => '<div class="v4-file">' + (f.url ? '<img src="' + f.url + '" alt="">' : '<i data-lucide="file-text" class="w-6 h-6"></i>') +
            '<span class="truncate">' + esc(f.file.name) + '</span><button type="button" onclick="bwRemoveFile(' + jsArg(r.id) + ',' + i + ')" aria-label="Hapus">×</button></div>').join('') +
          (list.length < r.max ? '<button type="button" class="v4-add" onclick="bwAddFiles(' + jsArg(r.id) + ')"><i data-lucide="' + (r.type === 'pdf' ? 'file-plus' : 'image-plus') + '" class="w-5 h-5"></i>' +
            (r.type === 'pdf' ? 'Pilih PDF' : 'Pilih gambar') + '<small>' + (r.type === 'pdf' ? 'PDF · maks 10 MB' : 'PNG / JPG') + ' · ' + (list.length) + '/' + r.max + '</small></button>' : '') + '</div>';
        return '<div class="v4-req"><div class="flex items-start justify-between gap-2"><p class="font-semibold text-main text-sm">' + esc(r.label) + '</p>' +
          '<span class="badge ' + (r.required ? 'badge-warning' : 'badge-document') + '">' + (r.required ? 'Wajib' : 'Opsional') + '</span></div>' +
          (r.help ? '<p class="text-xs text-muted mt-1 whitespace-pre-line">' + esc(r.help) + '</p>' : '') + '<div class="mt-2">' + inner + '</div></div>';
      }).join('') + '</div>';
  } else {
    const ses = b.sessions || [];
    body = '<div class="v4-form">' +
      '<div class="notice"><i data-lucide="key-round" class="w-5 h-5 flex-none"></i><div class="flex-1 text-sm text-left">Token akses dikirim otomatis oleh <b>Lynk.id</b> setelah pembayaran Anda terverifikasi.' +
        (b.ctaUrl ? ' Belum punya? <button type="button" class="text-accent font-semibold" onclick="openLink(' + jsArg(b.ctaUrl) + ')">Dapatkan token di sini →</button>' : '') + '</div></div>' +
      '<div><label class="form-label" for="bwToken">Token Akses Bootcamp *</label><input id="bwToken" class="form-input mono v4-token" value="' + esc(BW.d.token) + '" placeholder="Masukkan token dari Lynk.id" autocomplete="off" autocapitalize="characters"></div>' +
      ((b.accessTitles || []).length ? '<div class="v4-get"><p class="text-xs font-semibold text-muted">YANG ANDA DAPATKAN</p><ul>' + b.accessTitles.map(t => '<li>✅ Akses kelas <b>' + esc(t) + '</b></li>').join('') +
        (b.accessMode === 'approval' ? '<li class="text-muted">Kelas dibuka setelah bukti Anda diverifikasi Admin.</li>' : '') + '</ul></div>' : '') +
      (ses.length ? '<div class="v4-get"><p class="text-xs font-semibold text-muted">JADWAL (' + ses.length + '× PERTEMUAN)</p><ul>' + ses.map(s => '<li>📅 <b>' + esc(s.title) + '</b> — ' + esc(fmtWib(s.startAt, true)) + '</li>').join('') + '</ul></div>' : '') +
      '</div>';
  }
  const last = BW.step === BW.steps.length - 1;
  const foot = '<p id="bwErr" class="v4-err"' + (errMsg ? '' : ' hidden') + '>' + esc(errMsg || '') + '</p><div class="v4-foot">' +
    (BW.step ? '<button type="button" class="btn-ghost !w-auto" onclick="bwBack()"' + (BW.busy ? ' disabled' : '') + '><i data-lucide="arrow-left" class="w-4 h-4"></i> Kembali</button>' : '<span></span>') +
    '<button type="button" id="bwNext" class="btn-primary !w-auto" onclick="' + (last ? 'bwSubmit()' : 'bwNext()') + '"' + (BW.busy ? ' disabled' : '') + '>' +
      (BW.busy ? '<span class="spinner-inline"></span> ' + esc(BW.busy) : last ? '<i data-lucide="check" class="w-4 h-4"></i> Daftar Sekarang' : 'Lanjut <i data-lucide="arrow-right" class="w-4 h-4"></i>') + '</button></div>';
  box.innerHTML = head + body + foot;
  refreshIcons();
}
function bwErr(m) { const e = document.getElementById('bwErr'); if (e) { e.textContent = m; e.hidden = false; } }
function bwBack() { bwCollect(); if (BW.step) { BW.step--; bwRender(); } }
function bwNext() {
  bwCollect();
  const err = bwValidate(BW.steps[BW.step]);
  if (err) return bwErr(err);
  Store.set('bootForm', { fullName: BW.d.fullName, profession: BW.d.profession, email: BW.d.email, whatsapp: BW.d.whatsapp });
  BW.step++; bwRender();
}
function bwValidate(step) {
  const d = BW.d;
  if (step === 'data') {
    if (d.fullName.length < 3) return 'Nama lengkap minimal 3 karakter.';
    if (d.profession.length < 2) return 'Profesi wajib diisi.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return 'Email tidak valid.';
    if (!isValidWa(d.whatsapp)) return WA_INVALID;
  }
  if (step === 'bukti') {
    for (const r of BW.b.requirements) {
      if (r.type === 'link') { const u = BW.links[r.id] || ''; if (r.required && !u) return '"' + r.label + '" wajib diisi.'; if (u && !/^https?:\/\//i.test(u)) return 'Link "' + r.label + '" harus diawali https://'; }
      else if (r.required && !(BW.files[r.id] || []).length) return '"' + r.label + '" wajib dilampirkan.';
    }
  }
  if (step === 'token' && d.token.length < 4) return 'Masukkan token akses bootcamp.';
  return '';
}
async function bwAddFiles(reqId) {
  bwCollect();
  const r = BW.b.requirements.filter(x => x.id === reqId)[0];
  const isPdf = r.type === 'pdf';
  const picked = await pickFiles(isPdf ? '.pdf,application/pdf' : '.png,.jpg,.jpeg,image/png,image/jpeg', r.max > 1);
  const list = BW.files[reqId] = BW.files[reqId] || [];
  for (const f of picked) {
    if (list.length >= r.max) { showToast('Maksimal ' + r.max + ' berkas', r.label, 'warning'); break; }
    if (isPdf ? f.type !== 'application/pdf' : !/^image\/(png|jpe?g)$/i.test(f.type)) { showToast('Format tidak sesuai', f.name + (isPdf ? ' — harus PDF' : ' — harus PNG/JPG'), 'warning'); continue; }
    if (isPdf && f.size > 10 * 1048576) { showToast('Berkas terlalu besar', f.name + ' (maks 10 MB)', 'warning'); continue; }
    if (!isPdf && f.size > 15 * 1048576) { showToast('Gambar terlalu besar', f.name, 'warning'); continue; }
    list.push({ file: f, url: isPdf ? '' : URL.createObjectURL(f) });
  }
  bwRender();
}
function bwRemoveFile(reqId, i) { bwCollect(); (BW.files[reqId] || []).splice(i, 1); bwRender(); }

async function bwSubmit() {
  bwCollect();
  const err = bwValidate('token');
  if (err) return bwErr(err);
  const b = BW.b, setBusy = l => { BW.busy = l; bwRender(); };
  setBusy('Memeriksa token…');
  const chk = await api('bootcampCheckToken', { bootId: b.id, token: BW.d.token, email: BW.d.email });
  if (!chk.success) { BW.busy = false; return bwRender(chk.message); }
  const proofs = [];
  try {
    const all = [];
    (b.requirements || []).forEach(r => (BW.files[r.id] || []).forEach(f => all.push({ r: r, f: f })));
    let n = 0;
    for (const r of b.requirements || []) {
      if (r.type === 'link') { if (BW.links[r.id]) proofs.push({ reqId: r.id, url: BW.links[r.id] }); continue; }
      const files = [];
      for (const it of BW.files[r.id] || []) {
        n++; setBusy('Menyiapkan lampiran ' + n + '/' + all.length + '…');
        const f = r.type === 'image' ? await compressImage(it.file, 1600, 0.85) : it.file;
        files.push({ name: f.name, mimeType: f.type || (r.type === 'pdf' ? 'application/pdf' : 'image/jpeg'), base64: await fileToBase64(f) });
      }
      if (files.length) proofs.push({ reqId: r.id, files: files });
    }
  } catch (e) { BW.busy = false; return bwRender(e.message); }
  setBusy('Mengirim pendaftaran…');
  const res = await api('bootcampRegister', { bootId: b.id, fullName: BW.d.fullName, profession: BW.d.profession, email: BW.d.email, whatsapp: BW.d.whatsapp, token: BW.d.token, proofs: proofs }, { timeout: 180000 });
  BW.busy = false;
  if (!res.success) return bwRender(res.message);
  const d = res.data, wasMember = AppState.role === ROLE_MEMBER;
  Store.set('bootForm', { fullName: BW.d.fullName, profession: BW.d.profession, email: d.email, whatsapp: BW.d.whatsapp });
  if (d.token) { saveSession(d); if (typeof Login !== 'undefined') Login.pushHistory(d.email); }
  const box = document.getElementById('bwBox');
  if (box) {
    box.innerHTML = '<div class="v4-done"><div class="v4-done-icon">🎉</div><h3 class="text-xl font-bold text-main">' + (d.already ? 'Anda sudah terdaftar' : 'Pendaftaran berhasil!') + '</h3>' +
      '<p class="text-sm text-muted mt-2">' + esc(res.message) + '</p>' +
      (d.accessGranted && d.accessTitles.length ? '<p class="text-sm mt-3">✅ Akses kelas aktif: <b>' + esc(d.accessTitles.join(', ')) + '</b></p>' : '') +
      (d.status === 'Menunggu' ? '<p class="text-sm mt-2 text-muted">Bukti Anda sedang diverifikasi Admin' + (d.accessMode === 'approval' ? ' — akses kelas dibuka setelah disetujui.' : '.') + '</p>' : '') +
      '<p class="text-sm mt-2 text-muted">Jadwal, link pertemuan & absensi ada di menu <b>Bootcamp</b> portal member. Pengingat H-1 dikirim lewat WhatsApp/email.</p>' +
      '<button type="button" class="btn-primary !w-auto mt-5" onclick="Swal.close();openMyBootcamp()"><i data-lucide="calendar-days" class="w-4 h-4"></i> Buka Bootcamp Saya</button></div>';
    refreshIcons();
  }
  if (wasMember) Member.refresh();      // tamu yang baru login: data member dimuat saat membuka "Bootcamp Saya" (popup sukses tidak tertutup pengumuman)
}
async function openMyBootcamp() {
  if (AppState.role !== ROLE_MEMBER) return go('login');
  go('bootcamp');
  await Member.refresh();
}

/** Tautan langsung #/daftar/<id> (bisa ditaruh Admin di pesan Lynk.id) → buka halaman utama + form pendaftaran. */
registerPage('daftar', {
  layout: 'public', auth: 'public', title: 'Daftar Bootcamp',
  template: () => '<div class="page-wrap">' + skeletonRows(3) + '</div>',
  show: (el, id) => {
    history.replaceState(null, '', '#/explore');
    route();
    const open = () => openBootcampRegister(id);
    if (AppState.pub) setTimeout(open, 200); else Public.prefetch().then(open);
  }
});


// ════════════════════════════════════════════════════════════
// 5. PORTAL MEMBER — BOOTCAMP SAYA (jadwal, link pertemuan, absensi)
// ════════════════════════════════════════════════════════════
registerPage('bootcamp', {
  title: 'Bootcamp',
  template: () => '<div class="page-wrap" id="bootRoot">' + skeletonRows(5) + '</div>',
  show: () => {
    if (AppState.m) renderMyBootcamp();
    Member.softRefresh();
    clearInterval(AppState.timers.boot);
    AppState.timers.boot = setInterval(() => { if (document.visibilityState === 'visible' && AppState.currentPage === 'bootcamp') renderMyBootcamp(); }, 30000);
  },
  leave: () => clearInterval(AppState.timers.boot)
});

function renderMyBootcamp() {
  const root = document.getElementById('bootRoot');
  if (!root || !AppState.m) return;
  const d = AppState.m.bootcamp || { mine: [], open: [] };
  root.innerHTML = '<div class="mb-6"><h1 class="page-title">Bootcamp Saya</h1><p class="page-sub">Jadwal pertemuan, link Zoom, dan absensi. Absen dibuka sesuai jam yang ditentukan Admin.</p></div>' +
    (d.mine.length ? '<div class="space-y-6">' + d.mine.map(bootMineCard).join('') + '</div>'
      : emptyState('calendar-days', 'Belum mengikuti bootcamp', 'Daftar bootcamp di bawah ini memakai token akses yang Anda terima dari Lynk.id.')) +
    (d.open.length ? '<div class="mt-14">' + sectionHead('sparkles', 'Bootcamp yang Bisa Anda Ikuti', 'Sudah punya token dari Lynk.id? Klik "Daftar Bootcamp".') +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">' + d.open.map(bootcampCard).join('') + '</div></div>' : '');
  refreshIcons();
}

function bootMineCard(b) {
  const now = Date.now(), ses = b.sessions || [];
  const hadir = ses.filter(s => s.attendedAt).length;
  const st = { Menunggu: ['badge-warning', 'Menunggu verifikasi bukti'], Disetujui: ['badge-success', 'Terverifikasi'], Ditolak: ['badge-error', 'Tidak disetujui'] }[b.status] || ['badge-document', b.status];
  const rows = ses.map(s => {
    const from = Date.parse(s.attendFrom), until = Date.parse(s.attendUntil), end = Date.parse(s.endAt) || until, start = Date.parse(s.startAt);
    let state;
    if (s.attendedAt) state = '<span class="v4-att is-ok"><i data-lucide="check-circle-2" class="w-4 h-4"></i> Hadir · ' + esc(fmtWibTime(s.attendedAt)) + '</span>';
    else if (b.status === 'Ditolak') state = '<span class="v4-att">—</span>';
    else if (b.accessMode === 'approval' && b.status !== 'Disetujui') state = '<span class="v4-att">Absen & link dibuka setelah bukti disetujui</span>';
    else if (now >= from && now <= until) state = '<button class="btn-primary !w-auto !py-1.5 v4-pulse" onclick="attendSession(' + jsArg(b.id) + ',' + jsArg(s.id) + ',this)"><i data-lucide="hand" class="w-4 h-4"></i> Absen Sekarang</button>';
    else if (now < from) state = '<span class="v4-att">Absen dibuka ' + esc(fmtWibTime(s.attendFrom)) + ' WIB</span>';
    else state = '<span class="v4-att is-miss">Tidak hadir</span>';
    const live = now >= start - 30 * 60000 && now <= end;
    const zoom = s.zoomUrl && now <= end + 3600000 && b.status !== 'Ditolak'
      ? '<button class="' + (live ? 'btn-primary' : 'btn-ghost') + ' !w-auto !py-1.5" onclick="openLink(' + jsArg(s.zoomUrl) + ')"><i data-lucide="video" class="w-4 h-4"></i> ' + (live ? 'Masuk Sekarang' : 'Link Zoom') + '</button>' : '';
    return '<div class="v4-ses' + (live ? ' is-live' : '') + (now > end ? ' is-past' : '') + '"><span class="v4-ses-no">' + s.no + '</span>' +
      '<div class="min-w-0 flex-1"><p class="font-semibold text-main text-sm">' + esc(s.title) + (live ? ' <span class="live-dot">LIVE</span>' : '') + '</p>' +
      '<p class="text-xs text-muted">' + esc(fmtWib(s.startAt, true)) + (s.endAt ? '–' + esc(fmtWibTime(s.endAt)) + ' WIB' : '') + ' · absen ' + esc(fmtWibTime(s.attendFrom)) + '–' + esc(fmtWibTime(s.attendUntil)) + '</p></div>' +
      '<div class="v4-ses-act">' + zoom + state + '</div></div>';
  }).join('');
  return '<article class="app-card rounded-2xl p-5">' +
    '<div class="v4-boot-head"><div class="v4-boot-poster">' + img(b.poster, b.title, '', 'Bootcamp') + '</div>' +
      '<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="text-lg font-bold text-main">' + esc(b.title) + '</h3><span class="badge ' + st[0] + '">' + esc(st[1]) + '</span></div>' +
        (b.note && b.status !== 'Disetujui' ? '<p class="text-sm mt-1" style="color:var(--error)">Catatan Admin: ' + esc(b.note) + '</p>' : '') +
        (ses.length ? '<p class="text-sm text-muted mt-1">Kehadiran ' + hadir + ' dari ' + ses.length + ' pertemuan</p><div class="meter mt-2"><span style="width:' + (hadir / ses.length * 100).toFixed(0) + '%;background:var(--accent)"></span></div>' : '') +
        ((b.access || []).length ? '<div class="flex flex-wrap gap-2 mt-3">' + b.access.map(a => a.owned
          ? '<button class="chip chip-active" onclick="go(\'product\',' + jsArg(a.id) + ')"><i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i> ' + esc(a.title) + '</button>'
          : '<span class="chip" title="Dibuka setelah bukti disetujui"><i data-lucide="lock" class="w-3.5 h-3.5"></i> ' + esc(a.title) + '</span>').join('') + '</div>' : '') +
      '</div></div>' +
    (ses.length ? '<div class="mt-5 space-y-2">' + rows + '</div>' : '<p class="text-sm text-muted mt-4">Jadwal pertemuan akan diumumkan Admin.</p>') +
    '</article>';
}

async function attendSession(bootId, sessionId, btn) {
  const res = await withBusy(btn, 'Mencatat…', () => api('bootcampAttend', { bootId: bootId, sessionId: sessionId }));
  if (!res.success) { showToast('Belum bisa absen', res.message, 'warning'); return; }
  showToast('Absensi tercatat ✅', res.message, 'success');
  const b = ((AppState.m.bootcamp || {}).mine || []).filter(x => x.id === bootId)[0];
  const s = b && b.sessions.filter(x => x.id === sessionId)[0];
  if (s) { s.attendedAt = res.data.attendedAt; Store.set(userKey('boot'), { t: Date.now(), data: AppState.m }); }
  renderMyBootcamp();
}


// ════════════════════════════════════════════════════════════
// 6. PORTAL MEMBER — PAMERAN KARYA (ajukan testimoni karya)
// ════════════════════════════════════════════════════════════
registerPage('karya', {
  title: 'Pameran Karya',
  template: () => '<div class="page-wrap" id="karyaRoot">' + skeletonRows(4) + '</div>',
  show: () => { if (AppState.m) renderKarya(); Member.softRefresh(); }
});

function renderKarya() {
  const root = document.getElementById('karyaRoot');
  if (!root || !AppState.m) return;
  const k = AppState.m.karya || { config: { enabled: false }, mine: [] }, c = k.config || {};
  const pending = k.mine.some(x => x.status === 'Pending');
  const st = { Pending: ['badge-warning', 'Menunggu persetujuan'], Published: ['badge-success', 'Tampil di Pameran'], Rejected: ['badge-error', 'Belum disetujui'], Draft: ['badge-document', 'Draft'] };
  const show = AppState.m.showcase || [];
  root.innerHTML =
    '<div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6"><div><h1 class="page-title">Pameran Karya</h1><p class="page-sub">' + esc(c.intro || '') + '</p></div>' +
      (c.enabled ? '<button class="btn-primary !w-auto" onclick="openKaryaForm()"' + (pending ? ' disabled title="Masih ada pengajuan yang menunggu"' : '') + '><i data-lucide="upload" class="w-4 h-4"></i> Ajukan Karya Saya</button>' : '') + '</div>' +
    (!c.enabled ? '<div class="notice mb-6"><i data-lucide="info" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Pengajuan karya sedang ditutup sementara.</p></div>' : '') +
    ((c.rewardTitles || []).length && c.enabled ? '<div class="notice notice-success mb-6"><i data-lucide="gift" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1"><b>Hadiah!</b> Karya yang disetujui mendapat akses <b>' + esc(c.rewardTitles.join(', ')) + '</b>.</p></div>' : '') +
    (k.mine.length ? '<div class="app-card rounded-2xl p-5 mb-10"><h3 class="font-semibold text-main mb-3">Pengajuan Saya</h3><div class="space-y-3">' + k.mine.map(x => {
      const s2 = st[x.status] || ['badge-document', x.status];
      return '<div class="v4-ses"><div class="v4-thumb-sm">' + img(x.image, x.title, '', 'Karya') + '</div><div class="min-w-0 flex-1"><p class="font-semibold text-main text-sm truncate">' + esc(x.title) + '</p>' +
        '<p class="text-xs text-muted">Diajukan ' + esc(fmtDateTime(x.createdAt)) + (x.reviewNote ? ' · Catatan Admin: ' + esc(x.reviewNote) : '') + '</p></div><span class="badge ' + s2[0] + '">' + esc(s2[1]) + '</span></div>';
    }).join('') + '</div></div>' : '') +
    (show.length ? sectionHead('trophy', c.title || 'Pameran Karya Member', 'Inspirasi dari karya member lain.') + '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">' + show.map(showcaseCard).join('') + '</div>' : '');
  refreshIcons();
}

const KF = { avatar: null, gallery: [] };
function openKaryaForm() {
  const prof = Member.profile();
  const owned = (AppState.m.catalog || []).filter(p => p.owned);
  KF.avatar = null; KF.gallery = [];
  Swal.fire({
    title: 'Ajukan Karya ke Pameran', width: 780, showCancelButton: true, confirmButtonText: 'Kirim Pengajuan', cancelButtonText: 'Batal', focusConfirm: false,
    allowOutsideClick: () => !Swal.isLoading(),
    html: '<div class="pform">' +
      '<div class="grid2"><div><label class="form-label">Judul Karya / Aplikasi *</label><input id="kfTitle" class="form-input" placeholder="mis. Aplikasi Absensi Guru"></div>' +
      '<div><label class="form-label">Profesi *</label><input id="kfProf" class="form-input" value="' + esc(prof.profession || '') + '" placeholder="mis. Guru SD"></div></div>' +
      '<div><label class="form-label">Kelas yang Anda ikuti</label><select id="kfProd" class="form-input"><option value="">— Pilih kelas —</option>' + owned.map(p => '<option value="' + esc(p.Product_ID) + '">' + esc(p.Title) + '</option>').join('') + '</select></div>' +
      '<div><label class="form-label">Foto Profil *</label><div class="v4-avatar-pick"><div id="kfAvatarPrev" class="v4-avatar v4-avatar-ph" style="width:72px;height:72px">' + esc(initial(prof.nickname || AppState.email)) + '</div>' +
        '<button type="button" class="btn-ghost !w-auto" onclick="kfPickAvatar()"><i data-lucide="camera" class="w-4 h-4"></i> Pilih Foto</button><span class="text-xs text-muted">Tampil di kartu pameran.</span></div></div>' +
      '<div><label class="form-label">Cerita Member (Testimoni) *</label><textarea id="kfStory" class="form-input" rows="5" placeholder="Ceritakan:\n• Kenapa memilih kelas ini?\n• Apa yang Anda buat & manfaatnya?\n• Kesan Anda setelah ikut kelas"></textarea><p class="text-xs text-muted mt-1"><span id="kfCount">0</span> karakter (min. 30)</p></div>' +
      '<div><label class="form-label">5 Gambar Karya Terbaik * <span class="text-muted font-normal">(PNG/JPG/JPEG — gambar pertama jadi sampul)</span></label><div id="kfGal" class="v4-gal"></div></div>' +
      '<div class="grid2"><div><label class="form-label">Link Demo (opsional)</label><input id="kfDemo" class="form-input" placeholder="https://…"></div>' +
      '<div><label class="form-label">Video YouTube (opsional)</label><input id="kfVideo" class="form-input" placeholder="https://youtu.be/…"></div></div>' +
      '<p id="kfStatus" class="text-sm text-accent" hidden></p></div>',
    didOpen: () => {
      kfRenderGal();
      const t = document.getElementById('kfStory');
      t.addEventListener('input', () => { document.getElementById('kfCount').textContent = t.value.trim().length; });
      refreshIcons();
    },
    preConfirm: async () => {
      const v = { title: document.getElementById('kfTitle').value.trim(), profession: document.getElementById('kfProf').value.trim(),
        productId: document.getElementById('kfProd').value, story: document.getElementById('kfStory').value.trim(),
        demoUrl: document.getElementById('kfDemo').value.trim(), videoUrl: document.getElementById('kfVideo').value.trim() };
      if (v.title.length < 3) return Swal.showValidationMessage('Judul karya minimal 3 karakter.');
      if (v.profession.length < 2) return Swal.showValidationMessage('Profesi wajib diisi.');
      if (!KF.avatar) return Swal.showValidationMessage('Pilih foto profil Anda.');
      if (v.story.length < 30) return Swal.showValidationMessage('Ceritakan pengalaman Anda minimal 30 karakter.');
      if (KF.gallery.length !== 5) return Swal.showValidationMessage('Lampirkan tepat 5 gambar karya (sekarang ' + KF.gallery.length + ').');
      if (v.demoUrl && !/^https?:\/\//i.test(v.demoUrl)) return Swal.showValidationMessage('Link demo harus diawali https://');
      const status = document.getElementById('kfStatus'); status.hidden = false;
      const files = [KF.avatar].concat(KF.gallery), ids = [];
      for (let i = 0; i < files.length; i++) {
        status.innerHTML = '<span class="spinner-inline"></span> Mengunggah gambar ' + (i + 1) + ' dari ' + files.length + '…';
        const f = await compressImage(files[i].file, i === 0 ? 600 : 1600, 0.85);
        const up = await uploadFile('karya', f).catch(e => ({ success: false, message: e.message }));
        if (!up.success) { status.hidden = true; return Swal.showValidationMessage('Gagal mengunggah ' + files[i].file.name + ': ' + up.message); }
        ids.push(up.data.fileId);
      }
      status.innerHTML = '<span class="spinner-inline"></span> Mengirim pengajuan…';
      const res = await api('showcaseSubmit', Object.assign(v, { profilePhotoFileId: ids[0], galleryFileIds: ids.slice(1) }));
      if (!res.success) { status.hidden = true; return Swal.showValidationMessage(res.message); }
      return res;
    }
  }).then(r => {
    if (!r.isConfirmed || !r.value) return;
    AppState.m.karya = r.value.data.karya;
    Store.set(userKey('boot'), { t: Date.now(), data: AppState.m });
    renderKarya();
    Swal.fire({ icon: 'success', title: 'Pengajuan terkirim!', text: r.value.message });
  });
}
async function kfPickAvatar() {
  const f = (await pickFiles('.png,.jpg,.jpeg,image/png,image/jpeg', false))[0];
  if (!f) return;
  if (!/^image\/(png|jpe?g)$/i.test(f.type)) return showToast('Format tidak sesuai', 'Foto profil harus PNG/JPG.', 'warning');
  KF.avatar = { file: f, url: URL.createObjectURL(f) };
  const box = document.getElementById('kfAvatarPrev');
  if (box) { box.classList.remove('v4-avatar-ph'); box.innerHTML = '<img src="' + KF.avatar.url + '" alt="">'; }
}
async function kfAddGallery() {
  const picked = await pickFiles('.png,.jpg,.jpeg,image/png,image/jpeg', true);
  for (const f of picked) {
    if (KF.gallery.length >= 5) { showToast('Maksimal 5 gambar', '', 'warning'); break; }
    if (!/^image\/(png|jpe?g)$/i.test(f.type)) { showToast('Format tidak sesuai', f.name + ' — harus PNG/JPG/JPEG', 'warning'); continue; }
    KF.gallery.push({ file: f, url: URL.createObjectURL(f) });
  }
  kfRenderGal();
}
function kfRemove(i) { KF.gallery.splice(i, 1); kfRenderGal(); }
function kfRenderGal() {
  const box = document.getElementById('kfGal'); if (!box) return;
  let html = KF.gallery.map((g, i) => '<div class="v4-gal-item"><img src="' + g.url + '" alt=""><button type="button" onclick="kfRemove(' + i + ')" aria-label="Hapus">×</button>' + (i === 0 ? '<em>Sampul</em>' : '') + '</div>').join('');
  for (let i = KF.gallery.length; i < 5; i++) html += '<button type="button" class="v4-gal-add" onclick="kfAddGallery()"><i data-lucide="image-plus" class="w-5 h-5"></i><span>' + (i + 1) + '</span></button>';
  box.innerHTML = html;
  refreshIcons();
}
