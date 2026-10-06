/**
 * ============================================================
 * admin-karya.js — Panel Superadmin (v3.4)
 *  • Pameran Karya: karya tampil · pengajuan testimoni member (popup tinjau + Setujui/Tolak
 *    + hadiah akses produk) · pengaturan (buka/tutup pengajuan, hadiah, kecepatan berjalan, judul)
 *  • Panduan: dokumen PDF/PPT (unggah) atau video YouTube (tempel URL) untuk halaman utama
 * ============================================================
 */

const driveThumb = (id, w) => (id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (w || 400) : '');
function rewardProducts() { return (AppState.a.productsAdmin || Admin.cached('productsAdmin') || []).filter(p => !p.customReqId); }
function showcaseCfg() {
  const s = AppState.a.settingsAdmin || Admin.cached('settingsAdmin') || {};
  return Object.assign({ enabled: true, rewardProductIds: [], speed: 40, title: 'Pameran Karya Member', subtitle: '', intro: '' }, s.showcaseConfig || {});
}
function productPicker(cls, picked, maxH) {
  const list = rewardProducts();
  return '<div class="product-picker" style="max-height:' + (maxH || 200) + 'px">' + (list.length ? list.map(p => {
    const on = picked.indexOf(p.Product_ID) > -1;
    return '<label class="picker-row' + (on ? ' is-checked' : '') + '"><input type="checkbox" class="' + cls + '" value="' + esc(p.Product_ID) + '"' + (on ? ' checked' : '') +
      ' onchange="this.closest(\'.picker-row\').classList.toggle(\'is-checked\',this.checked)"><span class="text-sm flex-1">' + esc(p.Title) + '</span>' +
      (p.Status !== 'Active' ? '<span class="badge badge-document">' + esc(p.Status) + '</span>' : '') + '<span class="badge ' + badgeClassFor(p.Category) + '">' + esc(catLabel(p.Category)) + '</span></label>';
  }).join('') : '<p class="text-sm text-muted p-3">Belum ada produk.</p>') + '</div>';
}
const checkedVals = cls => Array.from(document.querySelectorAll('.' + cls + ':checked')).map(c => c.value);


// ════════════════════════════════════════════════════════════
// PAMERAN KARYA
// ════════════════════════════════════════════════════════════
const SC = { tab: null, filter: 'all' };
const SC_STATUS = { Published: ['var(--success)', 'Tampil'], Draft: ['#64748B', 'Draft'], Pending: ['var(--warning)', 'Menunggu'], Rejected: ['var(--error)', 'Ditolak'] };

adminRoute('showcase', {
  title: 'Pameran Karya',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Pameran Karya Member', 'Testimoni & karya member — berjalan otomatis di halaman utama Open Access dan Beranda member.',
    '<button class="btn-ghost !w-auto" onclick="openLink(location.pathname + \'#/explore\')"><i data-lucide="globe" class="w-4 h-4"></i> Lihat Halaman Publik</button>' +
    '<button class="btn-primary !w-auto" onclick="openShowcaseForm()"><i data-lucide="plus" class="w-4 h-4"></i> Tambah Karya</button>') +
    '<div id="scTabs"></div><div id="scBody"><div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">' + skeletonCards(4) + '</div></div></div>',
  show: () => {
    Admin.load('showcaseAdmin');
    if (!AppState.a.productsAdmin) Admin.load('productsAdmin');
    Admin.load('settingsAdmin').then(() => { if (SC.tab === 'cfg') scRender(); });
  }
});

ADMIN_RENDER.showcaseAdmin = function () { scRender(); };

function scRender() {
  const tabs = document.getElementById('scTabs'), body = document.getElementById('scBody');
  if (!tabs || !body) return;
  const list = AppState.a.showcaseAdmin || [];
  const pending = list.filter(s => s.status === 'Pending');
  if (!SC.tab) SC.tab = pending.length ? 'pending' : 'show';         // ada pengajuan baru → langsung tampilkan
  tabs.innerHTML = '<div class="seg mb-5">' + [['show', 'Semua Karya'], ['pending', 'Pengajuan Member'], ['cfg', 'Pengaturan']].map(t =>
    '<button class="' + (SC.tab === t[0] ? 'is-active' : '') + '" onclick="SC.tab=\'' + t[0] + '\';scRender()">' + t[1] + (t[0] === 'pending' && pending.length ? ' <span class="nav-badge">' + pending.length + '</span>' : '') + '</button>').join('') + '</div>';
  if (SC.tab === 'pending') scPending(body, pending);
  else if (SC.tab === 'cfg') scConfig(body);
  else scAll(body, list);
  refreshIcons();
}

function scAll(body, list) {
  const rows = list.filter(s => SC.filter === 'all' || s.status === SC.filter);
  body.innerHTML = '<div class="flex flex-wrap gap-2 mb-5">' + [['all', 'Semua'], ['Published', 'Tampil'], ['Draft', 'Draft'], ['Pending', 'Menunggu'], ['Rejected', 'Ditolak']].map(f =>
    '<button class="chip' + (SC.filter === f[0] ? ' chip-active' : '') + '" onclick="SC.filter=\'' + f[0] + '\';scRender()">' + f[1] + ' (' + (f[0] === 'all' ? list.length : list.filter(s => s.status === f[0]).length) + ')</button>').join('') + '</div>' +
    '<div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">' + (rows.length ? rows.map(s => {
      const st = SC_STATUS[s.status] || SC_STATUS.Draft, n = (s.gallery || []).length;
      return '<article class="product-card"><div class="product-thumb">' + img(s.image || (s.gallery || [])[0], s.title, '', 'Karya') +
        '<span class="owned-badge" style="background:' + st[0] + '">' + st[1] + '</span>' + (n > 1 ? '<span class="owned-badge v4-count"><i data-lucide="images" class="w-3.5 h-3.5"></i> ' + n + '</span>' : '') + '</div>' +
        '<div class="p-4 flex flex-col flex-1"><div class="v4-member">' + memberAvatar(s, 34) + '<div class="min-w-0"><p class="text-sm font-semibold text-main truncate">' + esc(s.memberName || '—') + '</p>' +
          '<p class="text-xs text-muted truncate">' + esc(s.profession || (s.submittedBy ? 'Pengajuan member' : 'Ditambahkan Admin')) + '</p></div></div>' +
        '<p class="font-semibold text-main line-clamp-2 mt-3">' + (s.featured ? '⭐ ' : '') + esc(s.title) + '</p>' +
        '<p class="text-xs text-muted mt-1">' + (s.submittedBy ? 'Diajukan ' + esc(fmtDateTime(s.createdAt)) : 'urutan ' + (s.sort || '-')) + '</p>' +
        (s.status === 'Rejected' && s.reviewNote ? '<p class="text-xs mt-1" style="color:var(--error)">Alasan: ' + esc(s.reviewNote) + '</p>' : '') +
        '<div class="flex gap-2 mt-auto pt-4">' + (s.status === 'Pending' ? '<button class="btn-primary flex-1 !py-2" onclick="openShowcaseReview(' + jsArg(s.id) + ')"><i data-lucide="badge-check" class="w-4 h-4"></i> Tinjau</button>' : '') +
          '<button class="btn-ghost flex-1 !py-2" onclick="openShowcaseForm(' + jsArg(s.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i> Ubah</button>' +
          '<button class="btn-icon !w-10 !h-10" title="Hapus" onclick="confirmDelete(\'karya\',\'deleteShowcase\',' + jsArg(s.id) + ',\'showcaseAdmin\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>';
    }).join('') : '<div class="sm:col-span-2 xl:col-span-4">' + emptyState('trophy', 'Belum ada karya', 'Member dapat mengajukan karyanya dari menu "Pameran Karya" di portal, atau tambahkan sendiri di sini.') + '</div>') + '</div>';
}

function scPending(body, pending) {
  body.innerHTML = pending.length ? '<div class="grid lg:grid-cols-2 gap-6">' + pending.map(s =>
    '<article class="app-card rounded-2xl p-5 flex flex-col gap-4"><div class="flex gap-4"><div class="v4-thumb-sm" style="width:96px;height:72px">' + img(s.image || (s.gallery || [])[0], s.title, '', 'Karya') + '</div>' +
      '<div class="min-w-0 flex-1"><p class="font-semibold text-main line-clamp-2">' + esc(s.title) + '</p><p class="text-xs text-muted mt-1">Diajukan ' + esc(fmtDateTime(s.createdAt)) + '</p>' +
        '<div class="v4-member mt-2">' + memberAvatar(s, 30) + '<p class="text-sm min-w-0 truncate"><b>' + esc(s.memberName) + '</b> <span class="text-muted">· ' + esc(s.profession || '-') + '</span></p></div></div></div>' +
      '<p class="text-sm text-muted line-clamp-3">“' + esc(s.story || s.description) + '”</p>' +
      '<div class="flex gap-2 mt-auto"><button class="btn-primary flex-1" onclick="openShowcaseReview(' + jsArg(s.id) + ')"><i data-lucide="eye" class="w-4 h-4"></i> Tinjau & Setujui</button>' +
        '<button class="btn-ghost !w-auto" onclick="rejectShowcase(' + jsArg(s.id) + ')"><i data-lucide="x" class="w-4 h-4"></i> Tolak</button></div></article>').join('') + '</div>'
    : emptyState('inbox', 'Tidak ada pengajuan menunggu', 'Pengajuan testimoni karya dari member akan muncul di sini. Member mengajukan lewat menu "Pameran Karya" di portalnya.');
}

/** Popup tinjau pengajuan: profil, cerita, 5 gambar, hadiah akses → Setujui / Tolak. */
function openShowcaseReview(id) {
  const s = (AppState.a.showcaseAdmin || []).filter(x => x.id === id)[0];
  if (!s) return;
  const cfg = showcaseCfg();
  const html = '<div style="text-align:left;display:grid;gap:14px">' +
    '<div class="v4-member">' + memberAvatar(s, 64) + '<div class="min-w-0"><p class="font-bold text-main text-lg">' + esc(s.memberName) + '</p>' +
      '<p class="text-sm text-muted">' + esc(s.profession || '-') + (s.className ? ' · Alumni ' + esc(s.className) : '') + '</p>' +
      '<p class="text-xs text-muted">' + esc(s.submittedBy || '') + ' · diajukan ' + esc(fmtDateTime(s.createdAt)) + '</p></div></div>' +
    '<div><p class="form-label">Judul karya</p><p class="font-semibold text-main">' + esc(s.title) + '</p></div>' +
    '<div><p class="form-label">Cerita member (testimoni)</p><p class="text-sm text-main whitespace-pre-line" style="max-height:200px;overflow:auto">' + esc(s.story || s.description) + '</p></div>' +
    '<div><p class="form-label">Gambar karya (' + (s.gallery || []).length + ') — klik untuk memperbesar</p><div class="v4-review-gal">' +
      (s.gallery || []).map((g, i) => '<img src="' + esc(g) + '" alt="Gambar ' + (i + 1) + '" loading="lazy" onclick="previewImage(' + jsArg(g) + ',' + jsArg(s.title + ' — gambar ' + (i + 1)) + ')">').join('') + '</div></div>' +
    (s.demoUrl || s.videoUrl ? '<div class="flex flex-wrap gap-2">' + (s.demoUrl ? '<button type="button" class="btn-ghost !w-auto !py-1.5" onclick="openLink(' + jsArg(s.demoUrl) + ')"><i data-lucide="external-link" class="w-4 h-4"></i> Buka Demo</button>' : '') +
      (s.videoUrl ? '<button type="button" class="btn-ghost !w-auto !py-1.5" onclick="openLink(' + jsArg(s.videoUrl) + ')"><i data-lucide="youtube" class="w-4 h-4"></i> Tonton Video</button>' : '') + '</div>' : '') +
    '<div class="v4-sec"><p class="v4-sec-title"><i data-lucide="gift" class="w-4 h-4"></i> Hadiah akses bila disetujui</p>' +
      '<p class="text-xs text-muted">Bawaan dari menu Pengaturan. Kosongkan semua = tanpa hadiah. Member menerima notifikasi WA/Email.</p>' + productPicker('rvRw', cfg.rewardProductIds, 180) +
      '<input id="rvNote" class="form-input" placeholder="Catatan untuk member (opsional)"></div></div>';
  Swal.fire({ title: 'Tinjau Pengajuan Karya', width: 860, html: html, showCloseButton: true, focusConfirm: false,
    confirmButtonText: '✓ Setujui & Tampilkan', showDenyButton: true, denyButtonText: 'Tolak', showCancelButton: true, cancelButtonText: 'Tutup',
    didOpen: refreshIcons, preConfirm: () => ({ rewardProductIds: checkedVals('rvRw'), note: document.getElementById('rvNote').value.trim() }) })
    .then(async r => {
      if (r.isDenied) return rejectShowcase(id);
      if (!r.isConfirmed) return;
      s.status = 'Published'; scRender();                                     // optimistic
      const res = await api('showcaseReview', { id: id, approve: true, rewardProductIds: r.value.rewardProductIds, note: r.value.note });
      toastRes(res);
      Admin.fetchMany(['showcaseAdmin', 'dashboard']);
    });
}

async function rejectShowcase(id) {
  const s = (AppState.a.showcaseAdmin || []).filter(x => x.id === id)[0];
  if (!s) return;
  const r = await Swal.fire({ title: 'Tolak karya "' + s.title + '"?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Tolak', cancelButtonText: 'Batal',
    html: '<textarea id="rjReason" class="form-input" rows="3" placeholder="Alasan / saran perbaikan (dikirim ke member)"></textarea>',
    preConfirm: () => document.getElementById('rjReason').value.trim() });
  if (!r.isConfirmed) return;
  s.status = 'Rejected'; s.reviewNote = r.value; scRender();
  const res = await api('showcaseReview', { id: id, approve: false, reason: r.value });
  toastRes(res);
  Admin.fetchMany(['showcaseAdmin', 'dashboard']);
}

function scConfig(body) {
  const c = showcaseCfg();
  body.innerHTML = '<div class="grid xl:grid-cols-2 gap-6">' +
    '<div class="app-card rounded-2xl p-6 space-y-4"><h3 class="font-semibold text-main">Pengajuan dari Member</h3>' +
      '<label class="switch"><input type="checkbox" id="cfEnabled"' + (c.enabled ? ' checked' : '') + '><span></span> Buka pengajuan karya dari portal member</label>' +
      '<div><label class="form-label">Teks ajakan di portal member</label><textarea id="cfIntro" class="form-input" rows="3">' + esc(c.intro) + '</textarea></div>' +
      '<div><label class="form-label">Hadiah akses bila karya disetujui</label><p class="text-xs text-muted mb-2">Produk ini otomatis dicentang di popup tinjau (bisa diubah per pengajuan).</p>' + productPicker('cfRw', c.rewardProductIds, 260) + '</div></div>' +
    '<div class="app-card rounded-2xl p-6 space-y-4"><h3 class="font-semibold text-main">Tampilan di Halaman Utama</h3>' +
      '<div><label class="form-label">Judul section</label><input id="cfTitle" class="form-input" value="' + esc(c.title) + '"></div>' +
      '<div><label class="form-label">Subjudul</label><input id="cfSub" class="form-input" value="' + esc(c.subtitle) + '"></div>' +
      '<div><label class="form-label">Kecepatan kartu berjalan: <b id="cfSpeedLbl">' + c.speed + '</b> px/detik</label>' +
        '<input id="cfSpeed" type="range" min="5" max="200" step="5" value="' + c.speed + '" class="v4-range" oninput="scSpeedLabel(this.value)">' +
        '<div class="flex justify-between text-xs text-muted"><span>Pelan</span><span id="cfSpeedHint"></span><span>Cepat</span></div></div>' +
      '<div class="notice"><i data-lucide="mouse-pointer-2" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Kartu berjalan otomatis. Saat kursor diarahkan / layar disentuh, kartu berhenti dan bisa digeser manual ke kiri/kanan.</p></div>' +
      '<button class="btn-primary w-full" onclick="saveShowcaseCfg(this)"><i data-lucide="save" class="w-4 h-4"></i> Simpan Pengaturan</button></div></div>';
  scSpeedLabel(c.speed);
}
function scSpeedLabel(v) {
  const l = document.getElementById('cfSpeedLbl'), h = document.getElementById('cfSpeedHint');
  if (l) l.textContent = v;
  if (h) h.textContent = '±' + Math.max(1, Math.round(316 / Number(v))) + ' detik per kartu';
}
async function saveShowcaseCfg(btn) {
  const cfg = { enabled: document.getElementById('cfEnabled').checked, intro: val('cfIntro'), rewardProductIds: checkedVals('cfRw'),
    title: val('cfTitle'), subtitle: val('cfSub'), speed: Number(document.getElementById('cfSpeed').value) };
  if (cfg.title.length < 3) return showToast('Judul terlalu pendek', 'Isi judul section minimal 3 karakter.', 'warning');
  const res = await withBusy(btn, 'Menyimpan…', () => api('showcaseConfigSave', { config: cfg }));
  if (!toastRes(res)) return;
  const s = AppState.a.settingsAdmin || Admin.cached('settingsAdmin');
  if (s && res.data) { s.showcaseConfig = res.data.config; Admin.ingest('settingsAdmin', s, true); }
  Public.prefetch(true);
}


// ── Form karya (Admin) ──
const SCF = { avatar: '', gallery: [] };
async function openShowcaseForm(id) {
  const s = id ? (AppState.a.showcaseAdmin || []).filter(x => x.id === id)[0] : null;
  SCF.avatar = s ? s.avatarFileId || '' : '';
  SCF.gallery = s ? (s.galleryFileIds || []).slice(0, 5) : [];
  const stOpts = [['Published', 'Tampilkan'], ['Draft', 'Draft']].concat(s && s.status === 'Pending' ? [['Pending', 'Menunggu tinjauan']] : [], s && s.status === 'Rejected' ? [['Rejected', 'Ditolak']] : []);
  const r = await Swal.fire({
    title: s ? 'Ubah Karya' : 'Tambah Karya', width: 820, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform">' +
      '<div class="grid2"><div><label class="form-label">Judul Karya *</label><input id="scTitle" class="form-input" value="' + esc(s ? s.title : '') + '"></div>' +
      '<div><label class="form-label">Nama Member</label><input id="scMember" class="form-input" value="' + esc(s ? s.memberName : '') + '"></div></div>' +
      '<div class="grid2"><div><label class="form-label">Profesi</label><input id="scProf" class="form-input" value="' + esc(s ? s.profession || '' : '') + '" placeholder="mis. Guru SD"></div>' +
      '<div><label class="form-label">Foto Profil</label><div class="v4-avatar-pick"><div id="scfAv" class="v4-avatar v4-avatar-ph" style="width:56px;height:56px"></div>' +
        '<button type="button" class="btn-ghost !w-auto !py-1.5" onclick="scfPickAvatar()"><i data-lucide="camera" class="w-4 h-4"></i> Unggah</button>' +
        '<button type="button" class="text-xs text-muted" onclick="SCF.avatar=\'\';scfRender()">Hapus</button></div></div></div>' +
      '<div><label class="form-label">Cerita Member (Testimoni)</label><textarea id="scDesc" class="form-input" rows="4" placeholder="Kenapa memilih kelas ini, apa yang dibuat, kesan setelah ikut kelas…">' + esc(s ? s.story || s.description : '') + '</textarea></div>' +
      '<div><label class="form-label">Galeri gambar karya (maks 5 · tampil sebagai slide)</label><div id="scfGal" class="v4-gal"></div><p id="scfInfo" class="text-xs text-muted mt-1"></p></div>' +
      imageField('scImg', 'Gambar Sampul (opsional — kosong = gambar galeri pertama)', s && s.imageFileId && SCF.gallery.indexOf(s.imageFileId) < 0 ? s.imageFileId : '', s && s.imageUrl) +
      '<div class="grid2"><div><label class="form-label">Video YouTube (opsional)</label><input id="scVideo" class="form-input" value="' + esc(s ? s.videoUrl : '') + '" placeholder="https://youtu.be/…"></div>' +
      '<div><label class="form-label">Link Demo (opsional)</label><input id="scDemo" class="form-input" value="' + esc(s ? s.demoUrl : '') + '" placeholder="https://…"></div></div>' +
      '<div class="grid3"><div><label class="form-label">Hasil dari Kelas</label><select id="scProd" class="form-input">' + productOptions(s && s.productId) + '</select></div>' +
      '<div><label class="form-label">Urutan</label><input id="scSort" type="number" class="form-input" value="' + (s && s.sort ? s.sort : '') + '"></div>' +
      '<div><label class="form-label">Status</label><select id="scStatus" class="form-input">' + stOpts.map(o => '<option value="' + o[0] + '"' + ((s ? s.status : 'Published') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div></div>' +
      (s && s.status === 'Pending' ? '<p class="text-xs text-muted">Pengajuan member: gunakan tombol <b>Tinjau</b> agar hadiah akses & notifikasi WA ikut terkirim.</p>' : '') +
      '<label class="switch"><input type="checkbox" id="scFeat"' + (s && s.featured ? ' checked' : '') + '><span></span> Karya unggulan (tampil paling depan)</label></div>',
    didOpen: () => { refreshImageField('scImg'); scfRender(); refreshIcons(); },
    preConfirm: () => {
      const v = { id: s ? s.id : '', title: val('scTitle'), memberName: val('scMember'), profession: val('scProf'), description: val('scDesc'),
        profilePhotoFileId: SCF.avatar, galleryFileIds: SCF.gallery.slice(0, 5),
        imageFileId: IMG.scImg.fileId, imageUrl: IMG.scImg.fileId ? '' : IMG.scImg.url,
        videoUrl: val('scVideo'), demoUrl: val('scDemo'), productId: document.getElementById('scProd').value,
        sort: Number(val('scSort')) || 0, status: document.getElementById('scStatus').value, featured: document.getElementById('scFeat').checked };
      if (v.title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.');
      if (!v.imageFileId && !v.imageUrl && !v.videoUrl && !v.galleryFileIds.length) return Swal.showValidationMessage('Isi galeri, gambar sampul, atau video karya.');
      if (!v.imageFileId && !v.imageUrl && v.galleryFileIds.length) v.imageFileId = v.galleryFileIds[0];
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveShowcase', r.value))) Admin.fetch('showcaseAdmin');
}
function scfRender() {
  const av = document.getElementById('scfAv');
  if (av) { av.classList.toggle('v4-avatar-ph', !SCF.avatar); av.innerHTML = SCF.avatar ? '<img src="' + driveThumb(SCF.avatar, 200) + '" alt="">' : esc(initial(val('scMember') || '?')); }
  const box = document.getElementById('scfGal');
  if (!box) return;
  let html = SCF.gallery.map((id, i) => '<div class="v4-gal-item"><img src="' + driveThumb(id, 400) + '" alt=""><button type="button" onclick="SCF.gallery.splice(' + i + ',1);scfRender()" aria-label="Hapus">×</button>' + (i === 0 ? '<em>Sampul</em>' : '') + '</div>').join('');
  for (let i = SCF.gallery.length; i < 5; i++) html += '<button type="button" class="v4-gal-add" onclick="scfAddGallery()"><i data-lucide="image-plus" class="w-5 h-5"></i><span>' + (i + 1) + '</span></button>';
  box.innerHTML = html;
  refreshIcons();
}
async function scfUpload(files, maxDim) {
  const info = document.getElementById('scfInfo'), ids = [];
  for (let i = 0; i < files.length; i++) {
    if (info) { info.style.color = ''; info.innerHTML = '<span class="spinner-inline"></span> Mengunggah ' + (i + 1) + ' dari ' + files.length + '…'; }
    const f = await compressImage(files[i], maxDim, 0.85);
    const res = await uploadFile('thumb', f).catch(e => ({ success: false, message: e.message }));
    if (!res.success) { if (info) { info.style.color = 'var(--error)'; info.textContent = files[i].name + ': ' + res.message; } return ids; }
    ids.push(res.data.fileId);
  }
  if (info) info.textContent = ids.length ? '✓ ' + ids.length + ' gambar terunggah' : '';
  return ids;
}
async function scfPickAvatar() {
  const f = (await pickFiles('.png,.jpg,.jpeg,image/png,image/jpeg', false))[0];
  if (!f) return;
  const ids = await scfUpload([f], 600);
  if (ids[0]) { SCF.avatar = ids[0]; scfRender(); }
}
async function scfAddGallery() {
  const room = 5 - SCF.gallery.length;
  const picked = (await pickFiles('.png,.jpg,.jpeg,image/png,image/jpeg', true)).filter(f => /^image\/(png|jpe?g)$/i.test(f.type));
  if (!picked.length) return;
  if (picked.length > room) showToast('Maksimal 5 gambar', 'Hanya ' + room + ' gambar pertama yang dipakai.', 'warning');
  const ids = await scfUpload(picked.slice(0, room), 1600);
  SCF.gallery = SCF.gallery.concat(ids).slice(0, 5);
  scfRender();
}


// ════════════════════════════════════════════════════════════
// PANDUAN (halaman utama) — dokumen PDF/PPT atau video YouTube
// ════════════════════════════════════════════════════════════
adminRoute('guides', {
  title: 'Panduan',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Panduan', 'Dokumen (PDF / PPT) dan video YouTube yang tampil di section Panduan halaman utama.',
    '<button class="btn-ghost !w-auto" onclick="openGuideConfig()"><i data-lucide="heading" class="w-4 h-4"></i> Judul Section</button>' +
    '<button class="btn-ghost !w-auto" onclick="openLink(location.pathname + \'#/explore\')"><i data-lucide="globe" class="w-4 h-4"></i> Lihat Halaman Publik</button>' +
    '<button class="btn-primary !w-auto" onclick="openGuideForm()"><i data-lucide="plus" class="w-4 h-4"></i> Tambah Panduan</button>') +
    '<div id="gdHead"></div><div id="gdGrid" class="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">' + skeletonCards(4) + '</div></div>',
  show: () => Admin.load('guidesAdmin')
});

ADMIN_RENDER.guidesAdmin = function (d) {
  const box = document.getElementById('gdGrid'), head = document.getElementById('gdHead');
  if (!box || !d) return;
  const list = d.list || [], c = d.config || {};
  if (head) head.innerHTML = '<div class="notice mb-6"><i data-lucide="layout-template" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Section di halaman utama: <b>' + esc(c.title || 'Panduan') + '</b>' +
    (c.subtitle ? ' — ' + esc(c.subtitle) : '') + ' · ' + list.filter(g => g.status === 'Published').length + ' panduan tampil. Section disembunyikan bila belum ada panduan yang tampil.</p></div>';
  box.innerHTML = list.length ? list.map(g => {
    const isVid = g.type === 'video', icon = isVid ? 'play-circle' : (/^ppt/.test(g.ext) ? 'presentation' : 'file-text');
    return '<article class="product-card">' +
      (isVid && g.thumb ? '<div class="product-thumb cursor-pointer" onclick="previewGuideAdmin(' + jsArg(g.id) + ')">' + img(g.thumb, g.title, '', 'Video') + '<span class="play-dot"><i data-lucide="play" class="w-5 h-5"></i></span>'
        : '<div class="v4-guide-icon" style="position:relative" onclick="previewGuideAdmin(' + jsArg(g.id) + ')"><i data-lucide="' + icon + '" class="w-9 h-9"></i><span>' + esc((g.ext || 'dok').toUpperCase()) + '</span>') +
        '<span class="owned-badge" style="background:' + (g.status === 'Published' ? 'var(--success)' : '#64748B') + '">' + (g.status === 'Published' ? 'Tampil' : 'Draft') + '</span></div>' +
      '<div class="p-4 flex flex-col flex-1"><span class="badge ' + (isVid ? 'badge-video' : 'badge-document') + ' self-start">' + (isVid ? 'Video YouTube' : 'Dokumen') + '</span>' +
        '<p class="font-semibold text-main line-clamp-2 mt-2">' + esc(g.title) + '</p>' +
        '<p class="text-xs text-muted mt-1 truncate">' + esc(isVid ? g.videoUrl : g.fileName) + ' · urutan ' + (g.sort || '-') + '</p>' +
        (g.description ? '<p class="text-sm text-muted mt-2 line-clamp-2">' + esc(g.description) + '</p>' : '') +
        '<div class="flex gap-2 mt-auto pt-4"><button class="btn-ghost flex-1 !py-2" onclick="openGuideForm(' + jsArg(g.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i> Ubah</button>' +
          '<button class="btn-icon !w-10 !h-10" title="Pratinjau" onclick="previewGuideAdmin(' + jsArg(g.id) + ')"><i data-lucide="eye" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon !w-10 !h-10" title="Hapus" onclick="confirmDelete(\'panduan\',\'deleteGuide\',' + jsArg(g.id) + ',\'guidesAdmin\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>';
  }).join('') : '<div class="sm:col-span-2 xl:col-span-4">' + emptyState('book-open', 'Belum ada panduan', 'Unggah dokumen PDF/PPT atau tempel URL video YouTube sebagai panduan untuk pengunjung & member.') + '</div>';
  refreshIcons();
};

function guideOf(id) { return ((AppState.a.guidesAdmin || {}).list || []).filter(x => x.id === id)[0]; }
function previewGuideAdmin(id) {
  const g = guideOf(id);
  if (!g) return;
  if (g.type === 'video') return Swal.fire({ width: 900, showConfirmButton: false, showCloseButton: true,
    html: '<div class="video-frame"><iframe src="' + esc(g.videoEmbed) + '" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div><p class="mt-3 font-semibold text-main">' + esc(g.title) + '</p>' });
  previewDocument(g.previewUrl, g.downloadUrl, g.title);
}

const GF = { fileId: '', fileName: '' };
async function openGuideForm(id) {
  const g = id ? guideOf(id) : null;
  GF.fileId = g && g.type === 'doc' ? g.fileId || '' : '';
  GF.fileName = g && g.type === 'doc' ? g.fileName || '' : '';
  const type = g ? g.type : 'doc';
  const r = await Swal.fire({
    title: g ? 'Ubah Panduan' : 'Tambah Panduan', width: 720, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    allowOutsideClick: () => !Swal.isLoading(),
    html: '<div class="pform">' +
      '<div><label class="form-label">Nama Panduan *</label><input id="gfTitle" class="form-input" value="' + esc(g ? g.title : '') + '" placeholder="mis. Cara Login & Redeem Kode"></div>' +
      '<div><label class="form-label">Jenis</label><div class="seg w-full"><button type="button" data-gt="doc" class="' + (type === 'doc' ? 'is-active' : '') + '" onclick="gfType(\'doc\')"><i data-lucide="file-text" class="w-4 h-4 inline"></i> Dokumen PDF / PPT</button>' +
        '<button type="button" data-gt="video" class="' + (type === 'video' ? 'is-active' : '') + '" onclick="gfType(\'video\')"><i data-lucide="youtube" class="w-4 h-4 inline"></i> Video YouTube</button></div></div>' +
      '<div id="gfDoc"' + (type === 'doc' ? '' : ' hidden') + '><label class="form-label">Berkas panduan (PDF, PPT, PPTX · maks 25 MB)</label><div class="flex flex-wrap items-center gap-3">' +
        '<button type="button" class="btn-ghost !w-auto" onclick="gfUpload()"><i data-lucide="upload" class="w-4 h-4"></i> ' + (GF.fileId ? 'Ganti Berkas' : 'Unggah Berkas') + '</button>' +
        '<span id="gfInfo" class="text-sm ' + (GF.fileId ? 'text-main' : 'text-muted') + '">' + (GF.fileId ? '📄 ' + esc(GF.fileName) : 'Belum ada berkas') + '</span></div></div>' +
      '<div id="gfVid"' + (type === 'video' ? '' : ' hidden') + '><label class="form-label">URL video YouTube</label><input id="gfUrl" class="form-input" value="' + esc(g && g.type === 'video' ? g.videoUrl : '') + '" placeholder="https://youtu.be/… atau https://www.youtube.com/watch?v=…" oninput="gfVidPrev()">' +
        '<div id="gfVidPrev" class="mt-3"></div></div>' +
      '<div><label class="form-label">Keterangan singkat (opsional)</label><textarea id="gfDesc" class="form-input" rows="3">' + esc(g ? g.description : '') + '</textarea></div>' +
      '<div class="grid2"><div><label class="form-label">Urutan</label><input id="gfSort" type="number" class="form-input" value="' + (g && g.sort ? g.sort : '') + '"></div>' +
      '<div><label class="form-label">Status</label><select id="gfStatus" class="form-input"><option value="Published"' + (!g || g.status === 'Published' ? ' selected' : '') + '>Tampilkan</option><option value="Draft"' + (g && g.status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div></div></div>',
    didOpen: () => { gfVidPrev(); refreshIcons(); },
    preConfirm: () => {
      const t = (document.querySelector('[data-gt].is-active') || {}).dataset;
      const v = { id: g ? g.id : '', title: val('gfTitle'), type: t ? t.gt : 'doc', description: val('gfDesc'), sort: Number(val('gfSort')) || 0, status: document.getElementById('gfStatus').value };
      if (v.title.length < 3) return Swal.showValidationMessage('Nama panduan minimal 3 karakter.');
      if (v.type === 'doc') {
        if (!GF.fileId) return Swal.showValidationMessage('Unggah berkas panduan (PDF / PPT).');
        v.fileId = GF.fileId; v.fileName = GF.fileName;
      } else {
        v.videoUrl = val('gfUrl');
        if (!ytId(v.videoUrl)) return Swal.showValidationMessage('Tempel URL video YouTube yang valid.');
      }
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveGuide', r.value))) { Admin.fetch('guidesAdmin'); Public.prefetch(true); }
}
function gfType(t) {
  document.querySelectorAll('[data-gt]').forEach(b => b.classList.toggle('is-active', b.dataset.gt === t));
  document.getElementById('gfDoc').hidden = t !== 'doc';
  document.getElementById('gfVid').hidden = t !== 'video';
}
function gfVidPrev() {
  const box = document.getElementById('gfVidPrev'); if (!box) return;
  const id = ytId(val('gfUrl'));
  box.innerHTML = id ? '<div class="v4-thumb-sm" style="width:200px;height:112px"><img src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg" alt=""></div>' : '';
}
async function gfUpload() {
  const f = await pickFile('.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation');
  if (!f) return;
  const info = document.getElementById('gfInfo');
  if (!/\.(pdf|pptx?)$/i.test(f.name)) { info.style.color = 'var(--error)'; info.textContent = 'Berkas harus PDF, PPT, atau PPTX.'; return; }
  if (f.size > 25 * 1048576) { info.style.color = 'var(--error)'; info.textContent = 'Ukuran berkas melebihi 25 MB.'; return; }
  const btn = Swal.getConfirmButton(); if (btn) btn.disabled = true;
  info.style.color = ''; info.innerHTML = '<span class="spinner-inline"></span> Mengunggah ' + esc(f.name) + '…';
  const res = await uploadFile('doc', f).catch(e => ({ success: false, message: e.message }));
  if (btn) btn.disabled = false;
  if (!res.success) { info.style.color = 'var(--error)'; info.textContent = res.message; return; }
  GF.fileId = res.data.fileId; GF.fileName = f.name;
  info.style.color = 'var(--success)'; info.textContent = '✓ ' + f.name + ' (' + res.data.fileSize + ')';
}
async function openGuideConfig() {
  const c = ((AppState.a.guidesAdmin || {}).config) || { title: 'Panduan', subtitle: '' };
  const r = await Swal.fire({ title: 'Judul Section Panduan', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform"><div><label class="form-label">Judul</label><input id="gcTitle" class="form-input" value="' + esc(c.title) + '" placeholder="mis. Panduan Penggunaan"></div>' +
      '<div><label class="form-label">Subjudul</label><input id="gcSub" class="form-input" value="' + esc(c.subtitle || '') + '"></div></div>',
    preConfirm: () => { const v = { title: val('gcTitle'), subtitle: val('gcSub') }; if (v.title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.'); return v; } });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveGuideConfig', r.value))) { Admin.fetch('guidesAdmin'); Public.prefetch(true); }
}
