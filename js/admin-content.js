/**
 * ============================================================
 * admin-content.js — Pameran Karya, Bootcamp, Pengumuman Popup,
 * Helpdesk (Master Kategori + Artikel)
 * ============================================================
 */

/** Field gambar: upload ke Drive atau URL manual, dengan pratinjau. */
const IMG = {};
function imageField(key, label, fileId, url) {
  IMG[key] = { fileId: fileId || '', url: url || '' };
  return '<div><label class="form-label">' + esc(label) + '</label><div class="thumb-grid"><div class="thumb-preview" id="' + key + 'Prev"></div><div class="grid gap-2">' +
    '<button type="button" class="btn-ghost !w-auto" onclick="uploadImageField(\'' + key + '\')"><i data-lucide="image-plus" class="w-4 h-4"></i> Upload Gambar</button>' +
    '<input id="' + key + 'Url" class="form-input" placeholder="…atau tempel URL gambar / link Google Drive" value="' + esc(fileId ? '' : url || '') + '" oninput="IMG[\'' + key + '\'].fileId=\'\';IMG[\'' + key + '\'].url=this.value;refreshImageField(\'' + key + '\')">' +
    '<p id="' + key + 'Info" class="text-xs text-muted">' + (fileId ? '✓ Gambar tersimpan di Drive' : '') + '</p></div></div></div>';
}
function refreshImageField(key) {
  const f = IMG[key], box = document.getElementById(key + 'Prev');
  if (!box) return;
  const src = f.fileId ? 'https://drive.google.com/thumbnail?id=' + f.fileId + '&sz=w800' : driveToThumb(f.url);
  box.innerHTML = src ? img(src, 'Pratinjau') : 'Belum ada gambar';
}
async function uploadImageField(key) {
  const file = await pickFile('image/*');
  if (!file) return;
  const info = document.getElementById(key + 'Info');
  info.innerHTML = '<span class="spinner-inline"></span> Mengunggah…';
  const res = await uploadFile('thumb', file).catch(e => ({ success: false, message: e.message }));
  if (!res.success) { info.style.color = 'var(--error)'; info.textContent = res.message; return; }
  IMG[key] = { fileId: res.data.fileId, url: '' };
  document.getElementById(key + 'Url').value = '';
  info.style.color = 'var(--success)'; info.textContent = '✓ ' + res.data.fileName;
  refreshImageField(key);
}
function productOptions(selected) {
  const list = AppState.a.productsAdmin || Admin.cached('productsAdmin') || [];
  return '<option value="">— Tidak terkait produk —</option>' + list.map(p => '<option value="' + esc(p.Product_ID) + '"' + (selected === p.Product_ID ? ' selected' : '') + '>' + esc(p.Title) + '</option>').join('');
}
async function confirmDelete(what, action, id, reload) {
  const r = await Swal.fire({ title: 'Hapus ' + what + '?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  if (toastRes(await api(action, { id: id }))) Admin.fetch(reload);
}


// ════════════════════════════════════════════════════════════
// PAMERAN KARYA MEMBER (Point 3)
// ════════════════════════════════════════════════════════════
adminRoute('showcase', {
  title: 'Pameran Karya',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Pameran Karya Member', 'Karya terbaik member — tampil di Beranda member & halaman Open Access.',
    '<button class="btn-primary !w-auto" onclick="openShowcaseForm()"><i data-lucide="plus" class="w-4 h-4"></i> Tambah Karya</button>') +
    '<div id="scGrid" class="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">' + skeletonCards(4) + '</div></div>',
  show: () => { Admin.load('showcaseAdmin'); if (!AppState.a.productsAdmin) Admin.load('productsAdmin'); }
});

ADMIN_RENDER.showcaseAdmin = function (list) {
  const box = document.getElementById('scGrid');
  if (!box) return;
  box.innerHTML = list.length ? list.map(s => '<article class="product-card"><div class="product-thumb">' + img(s.image, s.title, '', 'Karya') +
    '<span class="owned-badge" style="background:' + (s.status === 'Published' ? 'var(--success)' : '#64748B') + '">' + esc(s.status) + '</span></div>' +
    '<div class="p-4 flex flex-col flex-1"><p class="font-semibold text-main line-clamp-2">' + (s.featured ? '⭐ ' : '') + esc(s.title) + '</p>' +
    '<p class="text-xs text-muted mt-1">' + esc(s.memberName || '—') + ' · urutan ' + (s.sort || '-') + '</p>' +
    '<div class="flex gap-2 mt-auto pt-4"><button class="btn-ghost flex-1 !py-2" onclick="openShowcaseForm(' + jsArg(s.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i> Ubah</button>' +
    '<button class="btn-icon !w-10 !h-10" onclick="confirmDelete(\'karya\',\'deleteShowcase\',' + jsArg(s.id) + ',\'showcaseAdmin\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>').join('')
    : '<div class="sm:col-span-2 xl:col-span-4">' + emptyState('trophy', 'Belum ada karya', 'Tambahkan karya terbaik member untuk dipamerkan.') + '</div>';
  refreshIcons();
};

async function openShowcaseForm(id) {
  const s = id ? (AppState.a.showcaseAdmin || []).filter(x => x.id === id)[0] : null;
  const r = await Swal.fire({
    title: s ? 'Ubah Karya' : 'Tambah Karya', width: 760, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform">' +
      '<div class="grid2"><div><label class="form-label">Judul Karya *</label><input id="scTitle" class="form-input" value="' + esc(s ? s.title : '') + '"></div>' +
      '<div><label class="form-label">Nama Member</label><input id="scMember" class="form-input" value="' + esc(s ? s.memberName : '') + '"></div></div>' +
      '<div><label class="form-label">Deskripsi</label><textarea id="scDesc" class="form-input" rows="3">' + esc(s ? s.description : '') + '</textarea></div>' +
      imageField('scImg', 'Gambar Karya', s && s.imageFileId, s && s.imageUrl) +
      '<div class="grid2"><div><label class="form-label">Video YouTube (opsional)</label><input id="scVideo" class="form-input" value="' + esc(s ? s.videoUrl : '') + '" placeholder="https://youtu.be/…"></div>' +
      '<div><label class="form-label">Link Demo (opsional)</label><input id="scDemo" class="form-input" value="' + esc(s ? s.demoUrl : '') + '" placeholder="https://…"></div></div>' +
      '<div class="grid3"><div><label class="form-label">Hasil dari Kelas</label><select id="scProd" class="form-input">' + productOptions(s && s.productId) + '</select></div>' +
      '<div><label class="form-label">Urutan</label><input id="scSort" type="number" class="form-input" value="' + (s && s.sort ? s.sort : '') + '"></div>' +
      '<div><label class="form-label">Status</label><select id="scStatus" class="form-input"><option value="Published"' + (!s || s.status === 'Published' ? ' selected' : '') + '>Tampilkan</option><option value="Draft"' + (s && s.status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div></div>' +
      '<label class="switch"><input type="checkbox" id="scFeat"' + (s && s.featured ? ' checked' : '') + '><span></span> Karya unggulan (tampil paling depan)</label></div>',
    didOpen: () => { refreshImageField('scImg'); refreshIcons(); },
    preConfirm: () => {
      const v = { id: s ? s.id : '', title: document.getElementById('scTitle').value.trim(), memberName: document.getElementById('scMember').value.trim(),
        description: document.getElementById('scDesc').value.trim(), imageFileId: IMG.scImg.fileId, imageUrl: IMG.scImg.fileId ? '' : IMG.scImg.url,
        videoUrl: document.getElementById('scVideo').value.trim(), demoUrl: document.getElementById('scDemo').value.trim(), productId: document.getElementById('scProd').value,
        sort: Number(document.getElementById('scSort').value) || 0, status: document.getElementById('scStatus').value, featured: document.getElementById('scFeat').checked };
      if (v.title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.');
      if (!v.imageFileId && !v.imageUrl && !v.videoUrl) return Swal.showValidationMessage('Isi gambar atau video karya.');
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveShowcase', r.value))) Admin.fetch('showcaseAdmin');
}


// ════════════════════════════════════════════════════════════
// BOOTCAMP (CTA Lynk.id di halaman Open Access)
// ════════════════════════════════════════════════════════════
adminRoute('bootcamps', {
  title: 'Bootcamp',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Kelas / Bootcamp', 'Acara yang dipamerkan di halaman Open Access lengkap dengan tombol CTA ke Lynk.id.',
    '<button class="btn-ghost !w-auto" onclick="openLink(location.pathname + \'#/explore\')"><i data-lucide="globe" class="w-4 h-4"></i> Lihat Halaman Publik</button>' +
    '<button class="btn-primary !w-auto" onclick="openBootcampForm()"><i data-lucide="plus" class="w-4 h-4"></i> Tambah Bootcamp</button>') +
    '<div id="bcGrid" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">' + skeletonCards(3) + '</div></div>',
  show: () => { Admin.load('bootcampsAdmin'); if (!AppState.a.productsAdmin) Admin.load('productsAdmin'); }
});

ADMIN_RENDER.bootcampsAdmin = function (list) {
  const box = document.getElementById('bcGrid');
  if (!box) return;
  box.innerHTML = list.length ? list.map(b => '<article class="product-card"><div class="product-thumb">' + img(b.poster, b.title, '', 'Bootcamp') +
    '<span class="owned-badge" style="background:' + (b.status === 'Published' ? 'var(--success)' : '#64748B') + '">' + esc(b.status) + '</span></div>' +
    '<div class="p-4 flex flex-col flex-1"><p class="font-semibold text-main">' + esc(b.title) + '</p><p class="text-xs text-muted mt-1">' + esc(b.schedule || '—') + '</p>' +
    '<p class="text-xs mt-2">' + (b.ctaUrl ? '<span class="badge badge-success">CTA: ' + esc(b.ctaLabel) + '</span>' : '<span class="badge badge-warning">CTA belum diisi</span>') + '</p>' +
    '<div class="flex gap-2 mt-auto pt-4"><button class="btn-ghost flex-1 !py-2" onclick="openBootcampForm(' + jsArg(b.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i> Ubah</button>' +
    '<button class="btn-icon !w-10 !h-10" onclick="confirmDelete(\'bootcamp\',\'deleteBootcamp\',' + jsArg(b.id) + ',\'bootcampsAdmin\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>').join('')
    : '<div class="sm:col-span-2 xl:col-span-3">' + emptyState('calendar-days', 'Belum ada bootcamp', 'Tambahkan kelas/bootcamp yang akan diadakan.') + '</div>';
  refreshIcons();
};

async function openBootcampForm(id) {
  const b = id ? (AppState.a.bootcampsAdmin || []).filter(x => x.id === id)[0] : null;
  const r = await Swal.fire({
    title: b ? 'Ubah Bootcamp' : 'Tambah Bootcamp', width: 760, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform">' +
      '<div><label class="form-label">Judul *</label><input id="bcTitle" class="form-input" value="' + esc(b ? b.title : '') + '"></div>' +
      '<div class="grid2"><div><label class="form-label">Jadwal</label><input id="bcSched" class="form-input" value="' + esc(b ? b.schedule : '') + '" placeholder="Sabtu, 12 Okt 2026 · 19.00 WIB (Zoom)"></div>' +
      '<div><label class="form-label">Kelas terkait (opsional)</label><select id="bcProd" class="form-input">' + productOptions(b && b.productId) + '</select></div></div>' +
      '<div><label class="form-label">Deskripsi</label><textarea id="bcDesc" class="form-input" rows="4">' + esc(b ? b.description : '') + '</textarea></div>' +
      imageField('bcImg', 'Poster', b && b.posterFileId, b && b.posterUrl) +
      '<div class="grid2"><div><label class="form-label">Label Harga</label><input id="bcPrice" class="form-input" value="' + esc(b ? b.priceLabel : '') + '" placeholder="Rp 99.000 · Early bird"></div>' +
      '<div><label class="form-label">Label Kuota</label><input id="bcQuota" class="form-input" value="' + esc(b ? b.quotaLabel : '') + '" placeholder="Sisa 20 kursi"></div></div>' +
      '<div class="grid2"><div><label class="form-label">Teks Tombol CTA</label><input id="bcCta" class="form-input" value="' + esc(b ? b.ctaLabel : 'Daftar Sekarang') + '"></div>' +
      '<div><label class="form-label">Link CTA (Lynk.id)</label><input id="bcUrl" class="form-input" value="' + esc(b ? b.ctaUrl : '') + '" placeholder="https://lynk.id/…"></div></div>' +
      '<div class="grid2"><div><label class="form-label">Urutan</label><input id="bcSort" type="number" class="form-input" value="' + (b && b.sort ? b.sort : '') + '"></div>' +
      '<div><label class="form-label">Status</label><select id="bcStatus" class="form-input"><option value="Published"' + (!b || b.status === 'Published' ? ' selected' : '') + '>Tampilkan</option><option value="Draft"' + (b && b.status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div></div></div>',
    didOpen: () => { refreshImageField('bcImg'); refreshIcons(); },
    preConfirm: () => {
      const v = { id: b ? b.id : '', title: document.getElementById('bcTitle').value.trim(), schedule: document.getElementById('bcSched').value.trim(), productId: document.getElementById('bcProd').value,
        description: document.getElementById('bcDesc').value.trim(), posterFileId: IMG.bcImg.fileId, posterUrl: IMG.bcImg.fileId ? '' : IMG.bcImg.url,
        priceLabel: document.getElementById('bcPrice').value.trim(), quotaLabel: document.getElementById('bcQuota').value.trim(), ctaLabel: document.getElementById('bcCta').value.trim(),
        ctaUrl: document.getElementById('bcUrl').value.trim(), sort: Number(document.getElementById('bcSort').value) || 0, status: document.getElementById('bcStatus').value };
      if (v.title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.');
      if (v.ctaUrl && !/^https?:\/\//i.test(v.ctaUrl)) return Swal.showValidationMessage('Link CTA harus diawali https://');
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveBootcamp', r.value))) Admin.fetch('bootcampsAdmin');
}


// ════════════════════════════════════════════════════════════
// PENGUMUMAN POPUP (Point 13)
// ════════════════════════════════════════════════════════════
adminRoute('announcements', {
  title: 'Pengumuman',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Pengumuman Popup', 'Popup yang muncul saat member membuka portal (bila Aktif).',
    '<button class="btn-primary !w-auto" onclick="openAnnForm()"><i data-lucide="plus" class="w-4 h-4"></i> Buat Pengumuman</button>') +
    '<div id="annList" class="space-y-4">' + skeletonRows(3) + '</div></div>',
  show: () => { Admin.load('announcementsAdmin'); if (!AppState.a.productsAdmin) Admin.load('productsAdmin'); }
});

const AUD_LABEL = { all: 'Semua member', product: 'Pemilik produk tertentu', incomplete: 'Member yang datanya belum lengkap' };
ADMIN_RENDER.announcementsAdmin = function (list) {
  const box = document.getElementById('annList');
  if (!box) return;
  box.innerHTML = list.length ? list.map(a => '<div class="app-card rounded-2xl p-5 flex flex-wrap gap-4 items-center">' +
    (a.image ? '<div class="w-24 h-16 rounded-lg overflow-hidden flex-none">' + img(a.image, '', 'style="width:100%;height:100%;object-fit:cover"') + '</div>' : '<div class="stat-icon"><i data-lucide="megaphone" class="w-5 h-5"></i></div>') +
    '<div class="flex-1 min-w-[220px]"><p class="font-semibold text-main">' + esc(a.title) + '</p><p class="text-sm text-muted line-clamp-2">' + esc(a.body) + '</p>' +
    '<p class="text-xs text-muted mt-1">' + esc(AUD_LABEL[a.audience]) + ' · ' + (a.showMode === 'every' ? 'setiap buka portal' : 'tampil sekali') +
    (a.startAt || a.endAt ? ' · ' + (a.startAt ? fmtDate(a.startAt) : '…') + ' – ' + (a.endAt ? fmtDate(a.endAt) : '…') : '') + '</p></div>' +
    '<label class="switch"><input type="checkbox"' + (a.status === 'Active' ? ' checked' : '') + ' onchange="toggleAnn(' + jsArg(a.id) + ',this.checked)"><span></span> Aktif</label>' +
    '<div class="flex gap-1.5"><button class="btn-icon" title="Pratinjau" onclick="previewAnn(' + jsArg(a.id) + ')"><i data-lucide="eye" class="w-4 h-4"></i></button>' +
    '<button class="btn-icon" onclick="openAnnForm(' + jsArg(a.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>' +
    '<button class="btn-icon" onclick="confirmDelete(\'pengumuman\',\'deleteAnnouncement\',' + jsArg(a.id) + ',\'announcementsAdmin\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>').join('')
    : emptyState('megaphone', 'Belum ada pengumuman', 'Buat popup untuk menginformasikan kabar terbaru ke member.');
  refreshIcons();
};

function annPayload(a) {
  return { id: a.id, title: a.title, body: a.body, image: a.imageRaw, ctaLabel: a.ctaLabel, ctaUrl: a.ctaUrl, audience: a.audience, productIds: a.productIds,
    startAt: toInputDate(a.startAt), endAt: toInputDate(a.endAt), showMode: a.showMode, status: a.status };
}
async function toggleAnn(id, on) {
  const a = (AppState.a.announcementsAdmin || []).filter(x => x.id === id)[0]; if (!a) return;
  a.status = on ? 'Active' : 'Inactive';
  const res = await api('saveAnnouncement', annPayload(a));
  if (!res.success) { showToast('Gagal', res.message, 'error'); Admin.fetch('announcementsAdmin'); }
  else showToast(on ? 'Pengumuman aktif' : 'Pengumuman nonaktif', a.title, 'success');
}
function previewAnn(id) {
  const a = (AppState.a.announcementsAdmin || []).filter(x => x.id === id)[0]; if (!a) return;
  Swal.fire({ width: 560, showConfirmButton: !!a.ctaUrl, confirmButtonText: a.ctaLabel || 'OK', showCloseButton: true,
    html: '<div style="text-align:left">' + (a.image ? '<div class="rounded-xl overflow-hidden mb-4">' + img(a.image, '', 'style="width:100%"') + '</div>' : '') +
      '<h3 class="text-xl font-bold text-main">' + esc(a.title) + '</h3><p class="mt-2 text-muted whitespace-pre-line">' + esc(a.body) + '</p></div>' });
}
async function openAnnForm(id) {
  const a = id ? (AppState.a.announcementsAdmin || []).filter(x => x.id === id)[0] : null;
  const prods = AppState.a.productsAdmin || [];
  const r = await Swal.fire({
    title: a ? 'Ubah Pengumuman' : 'Buat Pengumuman', width: 720, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform">' +
      '<div><label class="form-label">Judul *</label><input id="anTitle" class="form-input" value="' + esc(a ? a.title : '') + '"></div>' +
      '<div><label class="form-label">Isi</label><textarea id="anBody" class="form-input" rows="4">' + esc(a ? a.body : '') + '</textarea></div>' +
      imageField('anImg', 'Gambar (opsional)', '', a ? a.imageRaw : '') +
      '<div class="grid2"><div><label class="form-label">Teks Tombol</label><input id="anCta" class="form-input" value="' + esc(a ? a.ctaLabel : '') + '" placeholder="Daftar Sekarang"></div>' +
      '<div><label class="form-label">Link Tombol</label><input id="anUrl" class="form-input" value="' + esc(a ? a.ctaUrl : '') + '" placeholder="https://…"></div></div>' +
      '<div class="grid2"><div><label class="form-label">Sasaran</label><select id="anAud" class="form-input" onchange="document.getElementById(\'anProdBox\').style.display=this.value===\'product\'?\'\':\'none\'">' +
        Object.keys(AUD_LABEL).map(k => '<option value="' + k + '"' + (a && a.audience === k ? ' selected' : '') + '>' + AUD_LABEL[k] + '</option>').join('') + '</select></div>' +
      '<div><label class="form-label">Frekuensi</label><select id="anMode" class="form-input"><option value="once"' + (!a || a.showMode === 'once' ? ' selected' : '') + '>Tampil sekali per member</option><option value="every"' + (a && a.showMode === 'every' ? ' selected' : '') + '>Setiap buka portal</option></select></div></div>' +
      '<div id="anProdBox" style="display:' + (a && a.audience === 'product' ? '' : 'none') + '"><label class="form-label">Produk</label><div class="product-picker">' + prods.map(p =>
        '<label class="picker-row"><input type="checkbox" class="anProd" value="' + esc(p.Product_ID) + '"' + (a && a.productIds.indexOf(p.Product_ID) > -1 ? ' checked' : '') + '><span class="text-sm">' + esc(p.Title) + '</span></label>').join('') + '</div></div>' +
      '<div class="grid3"><div><label class="form-label">Mulai</label><input id="anStart" type="date" class="form-input" value="' + toInputDate(a && a.startAt) + '"></div>' +
      '<div><label class="form-label">Selesai</label><input id="anEnd" type="date" class="form-input" value="' + toInputDate(a && a.endAt) + '"></div>' +
      '<div><label class="form-label">Status</label><select id="anStatus" class="form-input"><option value="Active"' + (!a || a.status === 'Active' ? ' selected' : '') + '>Aktif</option><option value="Inactive"' + (a && a.status === 'Inactive' ? ' selected' : '') + '>Nonaktif</option></select></div></div></div>',
    didOpen: () => { refreshImageField('anImg'); refreshIcons(); },
    preConfirm: () => {
      const img2 = IMG.anImg.fileId ? 'https://drive.google.com/thumbnail?id=' + IMG.anImg.fileId + '&sz=w1000' : IMG.anImg.url;
      const v = { id: a ? a.id : '', title: document.getElementById('anTitle').value.trim(), body: document.getElementById('anBody').value.trim(), image: img2,
        ctaLabel: document.getElementById('anCta').value.trim(), ctaUrl: document.getElementById('anUrl').value.trim(), audience: document.getElementById('anAud').value,
        productIds: Array.from(document.querySelectorAll('.anProd:checked')).map(c => c.value), showMode: document.getElementById('anMode').value,
        startAt: document.getElementById('anStart').value, endAt: document.getElementById('anEnd').value, status: document.getElementById('anStatus').value };
      if (v.title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.');
      if (v.audience === 'product' && !v.productIds.length) return Swal.showValidationMessage('Pilih minimal satu produk.');
      if (v.ctaUrl && !/^https?:\/\//i.test(v.ctaUrl)) return Swal.showValidationMessage('Link tombol harus diawali https://');
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveAnnouncement', r.value))) Admin.fetch('announcementsAdmin');
}


// ════════════════════════════════════════════════════════════
// HELPDESK — MASTER KATEGORI + ARTIKEL (Point 4)
// ════════════════════════════════════════════════════════════
const HD = { cat: 'all' };
const HELP_ICONS = ['help-circle', 'log-in', 'key-round', 'play-circle', 'app-window', 'credit-card', 'download', 'smartphone', 'message-circle', 'settings', 'bug', 'book-open', 'wifi', 'shield'];

adminRoute('helpdesk', {
  title: 'Helpdesk',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Helpdesk', 'Kelola kategori kendala dan artikel solusi untuk member.',
    '<button class="btn-ghost !w-auto" onclick="openHelpCatForm()"><i data-lucide="folder-plus" class="w-4 h-4"></i> Kategori Baru</button>' +
    '<button class="btn-primary !w-auto" onclick="openHelpForm()"><i data-lucide="plus" class="w-4 h-4"></i> Artikel Baru</button>') +
    '<div class="grid xl:grid-cols-[340px_1fr] gap-6"><div class="app-card rounded-2xl p-5 h-fit"><h3 class="font-semibold text-main mb-3">Master Kategori</h3><div id="hdCats" class="space-y-2"></div></div>' +
    '<div class="app-card rounded-2xl p-5 overflow-x-auto"><table id="tblHelp" class="display w-full"><thead><tr><th>Pertanyaan / Kendala</th><th>Kategori</th><th>Media</th><th>Urutan</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table></div></div></div>',
  show: () => Admin.load('helpdeskAdmin')
});

ADMIN_RENDER.helpdeskAdmin = function (d) {
  const box = document.getElementById('hdCats');
  if (!box || !d) return;
  box.innerHTML = '<button class="help-cat w-full' + (HD.cat === 'all' ? ' is-active' : '') + '" onclick="HD.cat=\'all\';ADMIN_RENDER.helpdeskAdmin(AppState.a.helpdeskAdmin)"><i data-lucide="layers" class="w-5 h-5"></i><span><b>Semua</b><small>' + d.articles.length + ' artikel</small></span></button>' +
    d.categories.map(c => '<div class="help-cat w-full' + (HD.cat === c.name ? ' is-active' : '') + '" style="cursor:pointer" onclick="HD.cat=' + jsArg(c.name) + ';ADMIN_RENDER.helpdeskAdmin(AppState.a.helpdeskAdmin)">' +
      '<i data-lucide="' + esc(c.icon) + '" class="w-5 h-5"></i><span class="flex-1 min-w-0"><b class="truncate">' + esc(c.name) + (c.status !== 'Active' ? ' <em class="text-xs font-normal">(nonaktif)</em>' : '') + '</b><small>' + c.count + ' artikel · urutan ' + c.sort + '</small></span>' +
      '<button class="btn-icon !w-7 !h-7" onclick="event.stopPropagation();openHelpCatForm(' + jsArg(c.id) + ')"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>' +
      '<button class="btn-icon !w-7 !h-7" onclick="event.stopPropagation();deleteHelpCat(' + jsArg(c.id) + ')"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div>').join('');
  buildTable('tblHelp', { data: d.articles.filter(a => HD.cat === 'all' || a.Category === HD.cat), columns: [
    { data: 'Question', render: v => '<p class="font-medium text-main max-w-[420px]">' + esc(v) + '</p>' },
    { data: 'Category', render: v => '<span class="badge badge-document">' + esc(v) + '</span>' },
    { data: null, render: a => (a.Image_URL ? '🖼️ ' : '') + (a.Video_URL ? '🎬' : '') || '—' },
    { data: 'Sort_Order' },
    { data: 'Status', render: s => statusBadge(s) },
    { data: null, orderable: false, render: a => '<div class="flex gap-1.5"><button class="btn-icon" onclick="openHelpForm(' + jsArg(a.Help_ID) + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>' +
      '<button class="btn-icon" onclick="deleteHelp(' + jsArg(a.Help_ID) + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>' }
  ] });
  refreshIcons();
};

async function openHelpCatForm(id) {
  const c = id ? AppState.a.helpdeskAdmin.categories.filter(x => x.id === id)[0] : null;
  const r = await Swal.fire({
    title: c ? 'Ubah Kategori' : 'Kategori Baru', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false, width: 600,
    html: '<div class="pform"><div><label class="form-label">Nama Kategori *</label><input id="hcName" class="form-input" value="' + esc(c ? c.name : '') + '" placeholder="mis. Login & Akun"></div>' +
      (c ? '<p class="text-xs text-muted -mt-2">Mengganti nama akan ikut memperbarui ' + c.count + ' artikel di kategori ini.</p>' : '') +
      '<div><label class="form-label">Deskripsi</label><input id="hcDesc" class="form-input" value="' + esc(c ? c.description : '') + '"></div>' +
      '<div><label class="form-label">Ikon</label><div class="icon-pick">' + HELP_ICONS.map(i => '<label><input type="radio" name="hcIcon" value="' + i + '"' + ((c ? c.icon : 'help-circle') === i ? ' checked' : '') + '><span><i data-lucide="' + i + '" class="w-5 h-5"></i></span></label>').join('') + '</div></div>' +
      '<div class="grid2"><div><label class="form-label">Urutan</label><input id="hcSort" type="number" class="form-input" value="' + (c ? c.sort : '') + '"></div>' +
      '<div><label class="form-label">Status</label><select id="hcStatus" class="form-input"><option value="Active">Aktif</option><option value="Inactive"' + (c && c.status === 'Inactive' ? ' selected' : '') + '>Nonaktif</option></select></div></div></div>',
    didOpen: refreshIcons,
    preConfirm: () => {
      const v = { id: c ? c.id : '', name: document.getElementById('hcName').value.trim(), description: document.getElementById('hcDesc').value.trim(),
        icon: (document.querySelector('input[name=hcIcon]:checked') || {}).value || 'help-circle', sort: Number(document.getElementById('hcSort').value) || 0, status: document.getElementById('hcStatus').value };
      if (v.name.length < 2) return Swal.showValidationMessage('Nama minimal 2 karakter.');
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveHelpCategory', r.value))) Admin.fetch('helpdeskAdmin');
}
async function deleteHelpCat(id) {
  const d = AppState.a.helpdeskAdmin, c = d.categories.filter(x => x.id === id)[0];
  const others = d.categories.filter(x => x.id !== id);
  const r = await Swal.fire({ title: 'Hapus kategori "' + esc(c.name) + '"?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal',
    html: c.count ? '<p class="text-sm mb-2">' + c.count + ' artikel akan dipindah ke:</p><select id="hcMove" class="swal2-select" style="display:flex;width:100%;margin:0">' +
      (others.length ? others.map(o => '<option>' + esc(o.name) + '</option>').join('') : '<option>Umum</option>') + '</select>' : '',
    preConfirm: () => ({ id: id, moveTo: document.getElementById('hcMove') ? document.getElementById('hcMove').value : 'Umum' }) });
  if (!r.isConfirmed) return;
  if (toastRes(await api('deleteHelpCategory', r.value))) Admin.fetch('helpdeskAdmin');
}

async function openHelpForm(id) {
  const d = AppState.a.helpdeskAdmin || { articles: [], categories: [] };
  const a = id ? d.articles.filter(x => x.Help_ID === id)[0] : null;
  const cats = d.categories.length ? d.categories : [{ name: 'Umum' }];
  const r = await Swal.fire({
    title: a ? 'Ubah Artikel' : 'Artikel Baru', width: 760, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform"><div><label class="form-label">Pertanyaan / Kendala *</label><input id="haQ" class="form-input" value="' + esc(a ? a.Question : '') + '"></div>' +
      '<div class="grid3"><div><label class="form-label">Kategori *</label><select id="haCat" class="form-input">' + cats.map(c => '<option' + ((a ? a.Category : HD.cat) === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div><label class="form-label">Urutan</label><input id="haSort" type="number" class="form-input" value="' + (a ? a.Sort_Order : '') + '"></div>' +
      '<div><label class="form-label">Status</label><select id="haSt" class="form-input"><option value="Published">Published</option><option value="Draft"' + (a && a.Status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div></div>' +
      '<div><label class="form-label">Solusi *</label><textarea id="haSol" class="form-input" rows="6">' + esc(a ? a.Solution : '') + '</textarea></div>' +
      imageField('haImg', 'Gambar pendukung (opsional)', a && a.Image_File_ID, a && a.Image_URL_Raw) +
      '<div><label class="form-label">Video YouTube (opsional)</label><input id="haVid" class="form-input" value="' + esc(a ? a.Video_URL : '') + '" placeholder="https://youtu.be/…"></div></div>',
    didOpen: () => { refreshImageField('haImg'); refreshIcons(); },
    preConfirm: () => {
      const v = { helpId: a ? a.Help_ID : '', question: document.getElementById('haQ').value.trim(), category: document.getElementById('haCat').value,
        solution: document.getElementById('haSol').value.trim(), sortOrder: Number(document.getElementById('haSort').value) || 0, status: document.getElementById('haSt').value,
        imageFileId: IMG.haImg.fileId, imageUrl: IMG.haImg.fileId ? '' : IMG.haImg.url, videoUrl: document.getElementById('haVid').value.trim() };
      if (!v.question) return Swal.showValidationMessage('Pertanyaan wajib diisi.');
      if (!v.solution) return Swal.showValidationMessage('Solusi wajib diisi.');
      return v;
    }
  });
  if (!r.isConfirmed) return;
  if (toastRes(await api('saveHelpArticle', r.value))) Admin.fetch('helpdeskAdmin');
}
async function deleteHelp(id) {
  const r = await Swal.fire({ title: 'Hapus artikel?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  if (toastRes(await api('deleteHelpArticle', { helpId: id }))) Admin.fetch('helpdeskAdmin');
}
