/**
 * ============================================================
 * admin-bootcamp.js — Panel Superadmin: Bootcamp (v3.4)
 *  • Daftar bootcamp + form: info, token akses, kelas yang dibuka, mode akses,
 *    syarat bukti (gambar/PDF/link, wajib/opsional), jadwal pertemuan & jam absensi, pengingat H-1
 *  • Halaman peserta: verifikasi bukti (popup + Setujui/Tolak), rekap absensi, tindak lanjut
 *    (beri akses kelas/aplikasi & blast WA/email ke peserta)
 * ============================================================
 */

const toLocalWib = iso => { const w = wib(iso); if (!w) return { date: '', time: '' }; const d = w.d; return { date: d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'), time: String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') }; };
const wibIso = (date, time) => (date && time ? new Date(date + 'T' + time + ':00+07:00').toISOString() : '');
function bootLink(id) { return location.origin + location.pathname + '#/daftar/' + id; }
function randomToken() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = 'BOOT-'; for (let i = 0; i < 6; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }


// ════════════════════════════════════════════════════════════
// DAFTAR BOOTCAMP
// ════════════════════════════════════════════════════════════
adminRoute('bootcamps', {
  title: 'Bootcamp',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Bootcamp', 'Pendaftaran dengan token akses Lynk.id, bukti syarat, jadwal & absensi peserta, pengingat H-1, dan tindak lanjut.',
    '<button class="btn-ghost !w-auto" onclick="openLink(location.pathname + \'#/explore\')"><i data-lucide="globe" class="w-4 h-4"></i> Lihat Halaman Publik</button>' +
    '<button class="btn-primary !w-auto" onclick="openBootcampForm()"><i data-lucide="plus" class="w-4 h-4"></i> Tambah Bootcamp</button>') +
    '<div id="bcGrid" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">' + skeletonCards(3) + '</div></div>',
  show: () => { Admin.load('bootcampsAdmin'); if (!AppState.a.productsAdmin) Admin.load('productsAdmin'); }
});

ADMIN_RENDER.bootcampsAdmin = function (list) {
  const box = document.getElementById('bcGrid');
  if (!box) return;
  box.innerHTML = list.length ? list.map(b => {
    const c = b.counts || {}, ses = b.sessionsFull || [];
    return '<article class="product-card"><div class="product-thumb cursor-pointer" onclick="go(\'admin/bootcamp/' + esc(b.id) + '\')">' + img(b.poster, b.title, '', 'Bootcamp') +
      '<span class="owned-badge" style="background:' + (b.status === 'Published' ? 'var(--success)' : '#64748B') + '">' + esc(b.status) + '</span></div>' +
      '<div class="p-4 flex flex-col flex-1"><p class="font-semibold text-main">' + esc(b.title) + '</p>' +
      '<p class="text-xs text-muted mt-1">' + (ses.length ? ses.length + '× pertemuan · mulai ' + esc(fmtWib(ses[0].startAt, true)) : esc(b.schedule || 'Jadwal belum diatur')) + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-3">' + (b.accessToken ? '<span class="v4-token-badge"><i data-lucide="key-round" class="w-3.5 h-3.5"></i>' + esc(b.accessToken) + '</span>' : '<span class="badge badge-warning">Token belum diatur</span>') +
        '<span class="badge badge-document">' + (c.total || 0) + ' peserta</span>' + (c.waiting ? '<span class="badge badge-warning">' + c.waiting + ' menunggu</span>' : '') + '</div>' +
      '<div class="flex gap-2 mt-auto pt-4"><button class="btn-primary flex-1 !py-2" onclick="go(\'admin/bootcamp/' + esc(b.id) + '\')"><i data-lucide="users" class="w-4 h-4"></i> Peserta & Absensi</button>' +
      '<button class="btn-icon !w-10 !h-10" title="Ubah" onclick="openBootcampForm(' + jsArg(b.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>' +
      '<button class="btn-icon !w-10 !h-10" title="Hapus" onclick="confirmDelete(\'bootcamp\',\'deleteBootcamp\',' + jsArg(b.id) + ',\'bootcampsAdmin\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>';
  }).join('') : '<div class="sm:col-span-2 xl:col-span-3">' + emptyState('calendar-days', 'Belum ada bootcamp', 'Tambahkan bootcamp, atur token akses dari Lynk.id, jadwal, dan syarat pendaftaran.') + '</div>';
  refreshIcons();
};


// ════════════════════════════════════════════════════════════
// FORM BOOTCAMP (info · pendaftaran & token · syarat · jadwal & absensi)
// ════════════════════════════════════════════════════════════
const BF = { reqs: [], ses: [] };

async function openBootcampForm(id) {
  const b = id ? (AppState.a.bootcampsAdmin || []).filter(x => x.id === id)[0] : null;
  const prods = (AppState.a.productsAdmin || Admin.cached('productsAdmin') || []).filter(p => !p.customReqId);
  const picked = b ? b.accessProductIds || [] : [];
  BF.reqs = b ? JSON.parse(JSON.stringify(b.requirements || [])) : [];
  BF.ses = (b ? b.sessionsFull || [] : []).map(s => { const st = toLocalWib(s.startAt), en = toLocalWib(s.endAt), af = toLocalWib(s.attendFrom), au = toLocalWib(s.attendUntil);
    return { id: s.id, title: s.title, date: st.date, start: st.time, end: en.time, from: af.time, until: au.time, zoom: s.zoomUrl || '' }; });
  const r = await Swal.fire({
    title: b ? 'Ubah Bootcamp' : 'Tambah Bootcamp', width: 980, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div class="pform">' +
      // A. Info
      '<div class="v4-sec"><p class="v4-sec-title"><i data-lucide="info" class="w-4 h-4"></i> Info Bootcamp</p>' +
        '<div><label class="form-label">Judul *</label><input id="bcTitle" class="form-input" value="' + esc(b ? b.title : '') + '"></div>' +
        '<div class="grid2"><div><label class="form-label">Keterangan jadwal (teks bebas, opsional)</label><input id="bcSched" class="form-input" value="' + esc(b ? b.schedule : '') + '" placeholder="4× pertemuan · tiap Sabtu 20.00 WIB (Zoom)"></div>' +
        '<div><label class="form-label">Kelas terkait (tampilan)</label><select id="bcProd" class="form-input">' + productOptions(b && b.productId) + '</select></div></div>' +
        '<div><label class="form-label">Deskripsi</label><textarea id="bcDesc" class="form-input" rows="3">' + esc(b ? b.description : '') + '</textarea></div>' +
        imageField('bcImg', 'Poster', b && b.posterFileId, b && b.posterUrl) +
        '<div class="grid2"><div><label class="form-label">Label Harga</label><input id="bcPrice" class="form-input" value="' + esc(b ? b.priceLabel : '') + '" placeholder="Rp 99.000 · Early bird"></div>' +
        '<div><label class="form-label">Label Kuota</label><input id="bcQuota" class="form-input" value="' + esc(b ? b.quotaLabel : '') + '" placeholder="Sisa 20 kursi"></div></div>' +
        '<div class="grid2"><div><label class="form-label">Teks Tombol Beli (CTA)</label><input id="bcCta" class="form-input" value="' + esc(b ? b.ctaLabel : 'Beli Token di Lynk.id') + '"></div>' +
        '<div><label class="form-label">Link Pembelian (Lynk.id)</label><input id="bcUrl" class="form-input" value="' + esc(b ? b.ctaUrl : '') + '" placeholder="https://lynk.id/…"></div></div>' +
        '<div class="grid2"><div><label class="form-label">Urutan</label><input id="bcSort" type="number" class="form-input" value="' + (b && b.sort ? b.sort : '') + '"></div>' +
        '<div><label class="form-label">Status</label><select id="bcStatus" class="form-input"><option value="Published"' + (!b || b.status === 'Published' ? ' selected' : '') + '>Tampilkan</option><option value="Draft"' + (b && b.status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div></div></div>' +
      // B. Pendaftaran & token
      '<div class="v4-sec"><p class="v4-sec-title"><i data-lucide="key-round" class="w-4 h-4"></i> Pendaftaran & Token Akses</p>' +
        '<p class="text-xs text-muted">1 bootcamp = 1 token. Taruh token ini di pesan otomatis produk Lynk.id → pembeli memasukkannya saat mendaftar. Kosongkan token = pendaftaran ditutup.</p>' +
        '<div class="grid2"><div><label class="form-label">Token Akses</label><div class="flex gap-2"><input id="bcToken" class="form-input mono" style="text-transform:uppercase" value="' + esc(b ? b.accessToken || '' : '') + '" placeholder="mis. BOOT-OKT26">' +
          '<button type="button" class="btn-ghost !w-auto" onclick="document.getElementById(\'bcToken\').value=randomToken()" title="Buat token acak"><i data-lucide="shuffle" class="w-4 h-4"></i></button></div></div>' +
        '<div><label class="form-label">Token berlaku sampai (opsional)</label><input id="bcExp" type="date" class="form-input" value="' + esc(b && b.tokenExpiry ? toLocalWib(b.tokenExpiry).date : '') + '"></div></div>' +
        '<div><label class="form-label">Kelas / produk yang dibuka oleh token</label><div class="product-picker" style="max-height:180px">' + (prods.length ? prods.map(p =>
          '<label class="picker-row' + (picked.indexOf(p.Product_ID) > -1 ? ' is-checked' : '') + '"><input type="checkbox" class="bcAcc" value="' + esc(p.Product_ID) + '"' + (picked.indexOf(p.Product_ID) > -1 ? ' checked' : '') +
          ' onchange="this.closest(\'.picker-row\').classList.toggle(\'is-checked\',this.checked)"><span class="text-sm flex-1">' + esc(p.Title) + '</span><span class="badge ' + badgeClassFor(p.Category) + '">' + esc(catLabel(p.Category)) + '</span></label>').join('') : '<p class="text-sm text-muted p-3">Belum ada produk.</p>') + '</div></div>' +
        '<div><label class="form-label">Kapan kelas dibuka?</label><select id="bcMode" class="form-input">' +
          '<option value="instant"' + (!b || b.accessMode !== 'approval' ? ' selected' : '') + '>Langsung setelah token valid (bukti diverifikasi menyusul)</option>' +
          '<option value="approval"' + (b && b.accessMode === 'approval' ? ' selected' : '') + '>Setelah bukti syarat disetujui Admin</option></select></div>' +
        (b ? '<div class="notice"><i data-lucide="link" class="w-5 h-5 flex-none"></i><div class="flex-1 text-sm text-left min-w-0">Link daftar langsung (boleh ditaruh di pesan Lynk.id):<br><span class="mono text-xs break-all">' + esc(bootLink(b.id)) + '</span></div>' +
          '<button type="button" class="btn-ghost !w-auto" onclick="copyText(' + jsArg(bootLink(b.id)) + ')"><i data-lucide="copy" class="w-4 h-4"></i> Salin</button></div>' : '') +
      '</div>' +
      // C. Syarat bukti
      '<div class="v4-sec"><div class="flex items-center justify-between gap-2"><p class="v4-sec-title"><i data-lucide="paperclip" class="w-4 h-4"></i> Syarat Bukti Pendaftaran (opsional)</p>' +
        '<button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="bfAddReq()">+ Syarat</button></div>' +
        '<p class="text-xs text-muted">Contoh: "Screenshot follow Instagram" (gambar, wajib, maks 3). Tanpa syarat = peserta langsung terverifikasi.</p><div id="bfReqs" class="grid gap-2"></div></div>' +
      // D. Jadwal & absensi
      '<div class="v4-sec"><div class="flex items-center justify-between gap-2"><p class="v4-sec-title"><i data-lucide="calendar-clock" class="w-4 h-4"></i> Jadwal Pertemuan & Jam Absensi (WIB)</p>' +
        '<button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="bfAddSes()">+ Pertemuan</button></div>' +
        '<div class="v4-gen"><div><label>Jumlah</label><input id="genN" type="number" min="1" max="40" class="form-input" value="4"></div>' +
          '<div><label>Pertemuan pertama</label><input id="genDate" type="date" class="form-input"></div><div><label>Jam mulai</label><input id="genTime" type="time" class="form-input" value="20:00"></div>' +
          '<div><label>Durasi (menit)</label><input id="genDur" type="number" class="form-input" value="120"></div><div><label>Ulang tiap (hari)</label><input id="genEvery" type="number" class="form-input" value="7"></div>' +
          '<button type="button" class="btn-ghost !w-auto" onclick="bfGenerate()"><i data-lucide="wand-sparkles" class="w-4 h-4"></i> Buat Jadwal</button></div>' +
        '<p class="text-xs text-muted">Absensi hanya bisa dilakukan peserta dari akun masing-masing di antara jam buka & tutup absen.</p><div id="bfSes" class="grid gap-2"></div>' +
        '<div><label class="form-label">Pengingat otomatis H-1 (WA / Email)</label><select id="bcRem" class="form-input">' +
          [['first', 'Sebelum pertemuan pertama saja'], ['all', 'Sebelum setiap pertemuan'], ['off', 'Tidak dikirim']].map(o => '<option value="' + o[0] + '"' + ((b ? b.reminderMode : 'first') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
          '<p class="text-xs text-muted mt-1">Dikirim ±24 jam sebelum jam mulai sebagai blast bertahap (pantau di menu Blast). Kanal mengikuti menu Notifikasi → "Bootcamp — pengingat H-1".</p></div></div>' +
      '</div>',
    didOpen: () => { refreshImageField('bcImg'); bfRenderReqs(); bfRenderSes(); refreshIcons(); },
    preConfirm: () => {
      bfCollect();
      const v = { id: b ? b.id : '', title: val('bcTitle'), schedule: val('bcSched'), productId: document.getElementById('bcProd').value, description: val('bcDesc'),
        posterFileId: IMG.bcImg.fileId, posterUrl: IMG.bcImg.fileId ? '' : IMG.bcImg.url, priceLabel: val('bcPrice'), quotaLabel: val('bcQuota'),
        ctaLabel: val('bcCta'), ctaUrl: val('bcUrl'), sort: Number(val('bcSort')) || 0, status: document.getElementById('bcStatus').value,
        accessToken: val('bcToken').toUpperCase().replace(/\s+/g, ''), tokenExpiry: val('bcExp'),
        accessProductIds: Array.from(document.querySelectorAll('.bcAcc:checked')).map(c => c.value), accessMode: document.getElementById('bcMode').value,
        requirements: BF.reqs.filter(q => q.label), reminderMode: document.getElementById('bcRem').value };
      if (v.title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.');
      if (v.ctaUrl && !/^https?:\/\//i.test(v.ctaUrl)) return Swal.showValidationMessage('Link pembelian harus diawali https://');
      if (v.accessToken && !/^[A-Z0-9_-]{6,40}$/.test(v.accessToken)) return Swal.showValidationMessage('Token minimal 6 karakter: huruf, angka, "-" atau "_" (maks 40). Disarankan pakai token acak 🔀.');
      if (v.accessToken && !v.accessProductIds.length) return Swal.showValidationMessage('Pilih minimal satu kelas yang dibuka oleh token.');
      const sessions = [];
      for (let i = 0; i < BF.ses.length; i++) {
        const s = BF.ses[i], nm = s.title || ('Pertemuan ' + (i + 1));
        if (!s.date && !s.start) continue;
        if (!s.date || !s.start || !s.end) return Swal.showValidationMessage(nm + ': isi tanggal, jam mulai & jam selesai.');
        const startAt = wibIso(s.date, s.start); let endAt = wibIso(s.date, s.end);
        if (Date.parse(endAt) <= Date.parse(startAt)) endAt = new Date(Date.parse(endAt) + 86400000).toISOString();
        const from = wibIso(s.date, s.from || s.start); let until = wibIso(s.date, s.until || s.end);
        if (Date.parse(until) <= Date.parse(from)) until = new Date(Date.parse(until) + 86400000).toISOString();
        if (s.zoom && !/^https?:\/\//i.test(s.zoom)) return Swal.showValidationMessage(nm + ': link Zoom harus diawali https://');
        sessions.push({ id: s.id || ('s' + Date.now().toString(36) + i), title: s.title, startAt: startAt, endAt: endAt, attendFrom: from, attendUntil: until, zoomUrl: s.zoom });
      }
      v.sessions = sessions;
      return v;
    }
  });
  if (!r.isConfirmed) return;
  const res = await api('saveBootcamp', r.value);
  if (toastRes(res)) { Admin.fetch('bootcampsAdmin'); if (BD.id) bdLoad(true); }
}
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function bfAddReq() { bfCollect(); BF.reqs.push({ id: '', label: '', help: '', type: 'image', required: true, max: 1 }); bfRenderReqs(); }
function bfAddSes() { bfCollect(); const last = BF.ses[BF.ses.length - 1]; BF.ses.push({ id: '', title: '', date: '', start: last ? last.start : '20:00', end: last ? last.end : '22:00', from: last ? last.from : '20:00', until: last ? last.until : '22:00', zoom: last ? last.zoom : '' }); bfRenderSes(); }
function bfDel(kind, i) { bfCollect(); BF[kind].splice(i, 1); kind === 'reqs' ? bfRenderReqs() : bfRenderSes(); }
function bfRenderReqs() {
  const box = document.getElementById('bfReqs'); if (!box) return;
  box.innerHTML = BF.reqs.length ? BF.reqs.map((q, i) => '<div class="v4-row"><button type="button" class="btn-icon v4-row-del" onclick="bfDel(\'reqs\',' + i + ')"><i data-lucide="x" class="w-4 h-4"></i></button>' +
    '<div class="v4-req-grid"><div><label class="form-label">Nama syarat</label><input class="form-input" data-rq="' + i + '" data-f="label" value="' + esc(q.label) + '" placeholder="mis. Screenshot follow IG"></div>' +
    '<div><label class="form-label">Jenis lampiran</label><select class="form-input" data-rq="' + i + '" data-f="type">' + [['image', 'Gambar PNG/JPG'], ['pdf', 'Dokumen PDF'], ['link', 'Link (URL)']].map(o => '<option value="' + o[0] + '"' + (q.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
    '<div><label class="form-label">Sifat</label><select class="form-input" data-rq="' + i + '" data-f="required"><option value="1"' + (q.required ? ' selected' : '') + '>Wajib</option><option value="0"' + (!q.required ? ' selected' : '') + '>Opsional</option></select></div>' +
    '<div><label class="form-label">Maks file</label><select class="form-input" data-rq="' + i + '" data-f="max">' + [1, 2, 3].map(n => '<option' + (Number(q.max) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div></div>' +
    '<input class="form-input" data-rq="' + i + '" data-f="help" value="' + esc(q.help || '') + '" placeholder="Keterangan untuk pendaftar (opsional), mis. unggah 1–3 screenshot"></div>').join('')
    : '<p class="text-sm text-muted">Belum ada syarat — pendaftar cukup mengisi data & token.</p>';
  refreshIcons();
}
function bfRenderSes() {
  const box = document.getElementById('bfSes'); if (!box) return;
  box.innerHTML = BF.ses.length ? BF.ses.map((s, i) => '<div class="v4-row"><button type="button" class="btn-icon v4-row-del" onclick="bfDel(\'ses\',' + i + ')"><i data-lucide="x" class="w-4 h-4"></i></button>' +
    '<div class="v4-ses-grid"><div><label>Judul</label><input class="form-input" data-ss="' + i + '" data-f="title" value="' + esc(s.title) + '" placeholder="Pertemuan ' + (i + 1) + '"></div>' +
    '<div><label>Tanggal</label><input type="date" class="form-input" data-ss="' + i + '" data-f="date" value="' + esc(s.date) + '"></div>' +
    '<div><label>Mulai</label><input type="time" class="form-input" data-ss="' + i + '" data-f="start" value="' + esc(s.start) + '"></div>' +
    '<div><label>Selesai</label><input type="time" class="form-input" data-ss="' + i + '" data-f="end" value="' + esc(s.end) + '"></div>' +
    '<div><label>Absen buka</label><input type="time" class="form-input" data-ss="' + i + '" data-f="from" value="' + esc(s.from) + '"></div>' +
    '<div><label>Absen tutup</label><input type="time" class="form-input" data-ss="' + i + '" data-f="until" value="' + esc(s.until) + '"></div></div>' +
    '<input class="form-input" data-ss="' + i + '" data-f="zoom" value="' + esc(s.zoom) + '" placeholder="Link Zoom / Google Meet (hanya terlihat peserta)"></div>').join('')
    : '<p class="text-sm text-muted">Belum ada jadwal. Pakai "Buat Jadwal" di atas untuk membuat beberapa pertemuan sekaligus.</p>';
  refreshIcons();
}
function bfCollect() {
  document.querySelectorAll('.swal2-popup [data-rq]').forEach(el => { const q = BF.reqs[+el.dataset.rq]; if (!q) return; const f = el.dataset.f; q[f] = f === 'required' ? el.value === '1' : f === 'max' ? Number(el.value) : el.value.trim(); });
  document.querySelectorAll('.swal2-popup [data-ss]').forEach(el => { const s = BF.ses[+el.dataset.ss]; if (s) s[el.dataset.f] = el.value.trim(); });
}
function bfGenerate() {
  bfCollect();
  const n = Math.min(Math.max(Number(val('genN')) || 0, 1), 40), date = val('genDate'), time = val('genTime') || '20:00', dur = Number(val('genDur')) || 120, every = Number(val('genEvery')) || 7;
  if (!date) return showToast('Isi tanggal pertemuan pertama', '', 'warning');
  const start0 = Date.parse(wibIso(date, time)), keepZoom = BF.ses[0] ? BF.ses[0].zoom : '';
  BF.ses = [];
  for (let i = 0; i < n; i++) {
    const st = new Date(start0 + i * every * 86400000).toISOString(), en = new Date(start0 + i * every * 86400000 + dur * 60000).toISOString();
    const a = toLocalWib(st), z = toLocalWib(en);
    BF.ses.push({ id: '', title: 'Pertemuan ' + (i + 1), date: a.date, start: a.time, end: z.time, from: a.time, until: z.time, zoom: keepZoom });
  }
  bfRenderSes();
}


// ════════════════════════════════════════════════════════════
// HALAMAN PESERTA (#/admin/bootcamp/<id>)
// ════════════════════════════════════════════════════════════
const BD = { id: null, data: null, tab: 'peserta', filter: 'all', minAtt: 0, sel: {} };

adminRoute('bootcamp', {
  title: 'Peserta Bootcamp',
  template: () => '<div class="page-wrap-fluid" id="bdRoot">' + skeletonRows(6) + '</div>',
  show: (el, id) => {
    if (BD.id !== id) { BD.id = id; BD.data = null; BD.tab = 'peserta'; BD.filter = 'all'; BD.minAtt = 0; BD.sel = {}; }
    updateActiveNav('admin-bootcamps');
    const c = Store.get(Admin.key('bp:' + id), null);
    if (c && c.data) { BD.data = c.data; bdRender(); } else document.getElementById('bdRoot').innerHTML = skeletonRows(6);
    bdLoad();
  }
});

async function bdLoad(force) {
  const id = BD.id; if (!id) return;
  const res = await api('bootcampParticipants', { bootId: id });
  if (BD.id !== id) return;
  if (!res.success) { if (!BD.data) document.getElementById('bdRoot').innerHTML = emptyState('alert-circle', 'Tidak dapat memuat', res.message); refreshIcons(); return; }
  Store.set(Admin.key('bp:' + id), { t: Date.now(), data: res.data });
  BD.data = res.data;
  bdRender();
}

function bdRender() {
  const root = document.getElementById('bdRoot');
  if (!root || !BD.data) return;
  const d = BD.data, b = d.bootcamp, P = d.participants, ses = b.sessionsFull || [];
  const waiting = P.filter(p => p.status === 'Menunggu').length, ok = P.filter(p => p.status === 'Disetujui').length;
  const avg = P.length && ses.length ? Math.round(P.reduce((s, p) => s + p.attendCount, 0) / (P.length * ses.length) * 100) : 0;
  root.innerHTML =
    '<button class="text-sm text-muted inline-flex items-center gap-1 mb-3" onclick="go(\'admin/bootcamps\')"><i data-lucide="arrow-left" class="w-4 h-4"></i> Semua bootcamp</button>' +
    adminHead(b.title, (ses.length ? ses.length + '× pertemuan · mulai ' + fmtWib(ses[0].startAt, true) : 'Jadwal belum diatur') + ' · ' + (b.accessMode === 'approval' ? 'kelas dibuka setelah disetujui' : 'kelas dibuka langsung'),
      (b.accessToken ? '<button class="btn-ghost !w-auto" onclick="copyText(' + jsArg(b.accessToken) + ')" title="Salin token"><span class="v4-token-badge">' + esc(b.accessToken) + '</span></button>' : '<span class="badge badge-warning">Token belum diatur</span>') +
      '<button class="btn-ghost !w-auto" onclick="copyText(' + jsArg(bootLink(b.id)) + ')"><i data-lucide="link" class="w-4 h-4"></i> Link Daftar</button>' +
      '<button class="btn-ghost !w-auto" onclick="bdExport()"><i data-lucide="download" class="w-4 h-4"></i> CSV</button>' +
      '<button class="btn-ghost !w-auto" onclick="withBusy(this,\'Memuat…\',()=>bdLoad(true))"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Segarkan</button>' +
      '<button class="btn-primary !w-auto" onclick="openBootcampForm(' + jsArg(b.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i> Ubah</button>') +
    '<div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">' + kpi('Peserta', P.length, 'users', cssVar('--accent')) + kpi('Menunggu Verifikasi', waiting, 'clock', cssVar('--warning')) +
      kpi('Disetujui', ok, 'badge-check', cssVar('--success')) + kpi('Rata-rata Kehadiran', avg + '%', 'calendar-check', cssVar('--indigo')) + '</div>' +
    '<div class="seg mb-5">' + [['peserta', 'Peserta & Bukti'], ['absen', 'Absensi'], ['lanjut', 'Tindak Lanjut']].map(t =>
      '<button class="' + (BD.tab === t[0] ? 'is-active' : '') + '" onclick="BD.tab=\'' + t[0] + '\';bdRender()">' + t[1] + (t[0] === 'peserta' && waiting ? ' <span class="nav-badge">' + waiting + '</span>' : '') + '</button>').join('') + '</div>' +
    '<div id="bdBody"></div>';
  if (BD.tab === 'peserta') bdPeserta(); else if (BD.tab === 'absen') bdAbsen(); else bdLanjut();
  refreshIcons();
}

const BP_STATUS = { Menunggu: ['badge-warning', 'Menunggu'], Disetujui: ['badge-success', 'Disetujui'], Ditolak: ['badge-error', 'Ditolak'] };
function bdPeserta() {
  const d = BD.data, P = d.participants, n = (d.bootcamp.sessionsFull || []).length;
  const rows = P.filter(p => BD.filter === 'all' || p.status === BD.filter);
  document.getElementById('bdBody').innerHTML = '<div class="app-card rounded-2xl p-5"><div class="flex flex-wrap gap-2 mb-4">' +
    [['all', 'Semua'], ['Menunggu', 'Menunggu'], ['Disetujui', 'Disetujui'], ['Ditolak', 'Ditolak']].map(f => '<button class="chip' + (BD.filter === f[0] ? ' chip-active' : '') + '" onclick="BD.filter=\'' + f[0] + '\';bdRender()">' + f[1] + ' (' + (f[0] === 'all' ? P.length : P.filter(p => p.status === f[0]).length) + ')</button>').join('') +
    '</div><div class="overflow-x-auto"><table id="tblBootPart" class="display w-full"><thead><tr><th>Peserta</th><th>Profesi</th><th>WhatsApp</th><th>Bukti</th><th>Status</th><th>Hadir</th><th>Terdaftar</th><th>Aksi</th></tr></thead><tbody></tbody></table></div></div>';
  buildTable('tblBootPart', { rebuild: true, data: rows, columns: [
    { data: null, render: (p, t) => t !== 'display' ? p.fullName + ' ' + p.email : '<div class="cell-user"><div class="cell-avatar">' + esc(initial(p.fullName || p.email)) + '</div><div class="min-w-0"><p class="font-medium text-main">' + esc(p.fullName) + '</p><p class="text-xs text-muted">' + esc(p.email) + '</p></div></div>' },
    { data: 'profession', render: v => esc(v || '—') },
    { data: 'whatsapp', render: w => w ? '<button class="mono text-sm text-accent" onclick="openLink(waLink(' + jsArg(w) + '))">' + esc(w) + '</button>' : '—' },
    { data: null, orderable: false, render: p => { const nf = p.proofs.reduce((s, x) => s + x.files.length + (x.url ? 1 : 0), 0);
      return nf ? '<button class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="openProofs(' + jsArg(p.partId) + ')"><i data-lucide="paperclip" class="w-3.5 h-3.5"></i> Lihat (' + nf + ')</button>' : '<span class="text-xs text-muted">—</span>'; } },
    { data: 'status', render: (s, t, p) => t !== 'display' ? s : '<span class="badge ' + (BP_STATUS[s] || BP_STATUS.Menunggu)[0] + '">' + esc(s) + '</span>' + (p.accessGranted ? '' : ' <i data-lucide="lock" class="w-3.5 h-3.5 inline text-muted" title="Akses kelas belum dibuka"></i>') },
    { data: 'attendCount', render: (v, t) => t !== 'display' ? v : '<b>' + v + '</b>/' + n },
    { data: 'registeredAt', render: (v, t) => t === 'display' ? fmtDateTime(v) : v },
    { data: null, orderable: false, render: p => '<div class="flex gap-1.5">' +
      (p.status !== 'Disetujui' ? '<button class="btn-icon" title="Setujui" style="color:var(--success)" onclick="reviewPart(' + jsArg(p.partId) + ',true)"><i data-lucide="check" class="w-4 h-4"></i></button>' : '') +
      (p.status !== 'Ditolak' ? '<button class="btn-icon" title="Tolak" style="color:var(--error)" onclick="reviewPart(' + jsArg(p.partId) + ',false)"><i data-lucide="x" class="w-4 h-4"></i></button>' : '') + '</div>' }
  ], order: [[6, 'desc']] });
}

/** Popup bukti syarat peserta + tombol Setujui / Tolak. */
function openProofs(partId) {
  const p = BD.data.participants.filter(x => x.partId === partId)[0]; if (!p) return;
  window._proofImgs = [];
  const html = '<div style="text-align:left"><div class="v4-member mb-4"><span class="v4-avatar v4-avatar-ph" style="width:46px;height:46px;font-size:18px">' + esc(initial(p.fullName)) + '</span><div class="min-w-0">' +
    '<p class="font-semibold text-main">' + esc(p.fullName) + ' <span class="badge ' + (BP_STATUS[p.status] || BP_STATUS.Menunggu)[0] + '">' + esc(p.status) + '</span></p><p class="text-sm text-muted">' + esc(p.profession) + ' · ' + esc(p.email) + ' · ' + esc(p.whatsapp) + '</p></div></div>' +
    (p.proofs.length ? p.proofs.map(x => '<div class="mb-4"><p class="font-semibold text-sm text-main mb-2">' + esc(x.label) + '</p>' +
      (x.url ? '<button class="btn-ghost !w-auto !py-1.5" onclick="openLink(' + jsArg(x.url) + ')"><i data-lucide="external-link" class="w-4 h-4"></i> ' + esc(x.url.length > 60 ? x.url.slice(0, 60) + '…' : x.url) + '</button>' : '') +
      (x.files.length ? '<div class="v4-proof-grid">' + x.files.map(f => { if (f.isImage) window._proofImgs.push(f.image);
        return '<div class="v4-proof" onclick="' + (f.isImage ? 'previewImage(' + jsArg(f.image) + ',' + jsArg(f.name) + ')' : 'previewDocument(' + jsArg(f.preview) + ',' + jsArg(f.download) + ',' + jsArg(f.name) + ')') + '">' +
          (f.isImage ? img(f.image, f.name) : '<div class="v4-guide-icon" style="aspect-ratio:auto;height:120px"><i data-lucide="file-text" class="w-8 h-8"></i><span>PDF</span></div>') + '<p>' + esc(f.name) + '</p></div>'; }).join('') + '</div>' : (x.url ? '' : '<p class="text-xs text-muted">Tidak dilampirkan.</p>')) + '</div>').join('')
      : '<p class="text-sm text-muted">Tidak ada lampiran.</p>') +
    (p.note ? '<p class="text-sm mt-2"><b>Catatan:</b> ' + esc(p.note) + '</p>' : '') + (p.verifiedBy ? '<p class="text-xs text-muted mt-1">Diverifikasi ' + esc(fmtDateTime(p.verifiedAt)) + ' oleh ' + esc(p.verifiedBy) + '</p>' : '') + '</div>';
  Swal.fire({ width: 820, html: html, showCloseButton: true, showConfirmButton: p.status !== 'Disetujui', confirmButtonText: '✓ Setujui', showDenyButton: p.status !== 'Ditolak', denyButtonText: 'Tolak',
    showCancelButton: true, cancelButtonText: 'Tutup', didOpen: refreshIcons })
    .then(r => { if (r.isConfirmed) reviewPart(partId, true); else if (r.isDenied) reviewPart(partId, false); });
}

async function reviewPart(partId, approve) {
  const p = BD.data.participants.filter(x => x.partId === partId)[0]; if (!p) return;
  const b = BD.data.bootcamp;
  let reason = '', revoke = false;
  if (approve) {
    const r = await Swal.fire({ title: 'Setujui ' + p.fullName + '?', icon: 'question', showCancelButton: true, confirmButtonText: 'Setujui', cancelButtonText: 'Batal',
      text: !p.accessGranted && (b.accessProductIds || []).length ? 'Kelas bootcamp akan dibuka untuk peserta ini.' : 'Status peserta menjadi Disetujui.' });
    if (!r.isConfirmed) return;
  } else {
    const r = await Swal.fire({ title: 'Tolak ' + p.fullName + '?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Tolak', cancelButtonText: 'Batal',
      html: '<div style="text-align:left;display:grid;gap:10px"><textarea id="rvReason" class="form-input" rows="3" placeholder="Alasan (dikirim ke peserta)"></textarea>' +
        (p.accessGranted ? '<label class="switch"><input type="checkbox" id="rvRevoke"><span></span> Cabut juga akses kelas dari bootcamp ini</label>' : '') + '</div>',
      preConfirm: () => ({ reason: document.getElementById('rvReason').value.trim(), revoke: !!(document.getElementById('rvRevoke') || {}).checked }) });
    if (!r.isConfirmed) return;
    reason = r.value.reason; revoke = r.value.revoke;
  }
  p.status = approve ? 'Disetujui' : 'Ditolak'; bdRender();          // optimistic
  const res = await api('bootcampReview', { partId: partId, approve: approve, reason: reason, revoke: revoke });
  toastRes(res);
  bdLoad(true);
  Admin.fetchMany(['bootcampsAdmin', 'dashboard']);
}

function bdAbsen() {
  const d = BD.data, ses = d.bootcamp.sessionsFull || [], P = d.participants.filter(p => p.status !== 'Ditolak');
  const now = Date.now();
  document.getElementById('bdBody').innerHTML = '<div class="app-card rounded-2xl p-5"><p class="text-sm text-muted mb-4">Klik kotak untuk menandai / membatalkan kehadiran secara manual (mis. peserta lupa absen). Kotak bergaris ungu = ditandai Admin.</p>' +
    (ses.length ? '<div class="overflow-x-auto"><table class="v4-matrix"><thead><tr><th>Peserta (' + P.length + ')</th>' + ses.map(s => '<th title="' + esc(fmtWib(s.startAt, true)) + '">P' + s.no + '<br><span style="font-weight:500;text-transform:none">' + esc(wib(s.startAt) ? wib(s.startAt).date.replace(/ \d{4}$/, '') : '') + '</span></th>').join('') + '<th>Total</th></tr></thead><tbody>' +
      P.map(p => '<tr><td><p class="font-medium text-main">' + esc(p.fullName) + '</p><p class="text-xs text-muted">' + esc(p.email) + '</p></td>' + ses.map(s => { const a = p.attended[s.id];
        return '<td><button class="v4-cell' + (a ? ' is-on' : '') + (a && a.method === 'Admin' ? ' is-admin' : '') + '" title="' + (a ? 'Hadir ' + esc(fmtDateTime(a.at)) + ' (' + esc(a.method) + ')' : (Date.parse(s.startAt) > now ? 'Belum dimulai' : 'Tidak hadir')) + '" onclick="toggleAttend(' + jsArg(p.email) + ',' + jsArg(s.id) + ',' + (a ? 'false' : 'true') + ')">' + (a ? '✓' : '') + '</button></td>'; }).join('') +
        '<td><b>' + p.attendCount + '</b>/' + ses.length + '</td></tr>').join('') +
      '<tr><td><b>Hadir per pertemuan</b></td>' + ses.map(s => '<td><b>' + P.filter(p => p.attended[s.id]).length + '</b></td>').join('') + '<td></td></tr></tbody></table></div>'
      : emptyState('calendar-x', 'Belum ada jadwal', 'Atur jadwal pertemuan di form bootcamp.')) + '</div>';
}
async function toggleAttend(email, sessionId, present) {
  const p = BD.data.participants.filter(x => x.email === email)[0];
  if (p) { if (present) p.attended[sessionId] = { at: new Date().toISOString(), method: 'Admin' }; else delete p.attended[sessionId]; p.attendCount = Object.keys(p.attended).length; bdRender(); }
  const res = await api('bootcampAttendAdmin', { bootId: BD.id, sessionId: sessionId, email: email, present: present });
  if (!res.success) { showToast('Gagal', res.message, 'error'); bdLoad(true); }
}

function bdTargets() {
  return BD.data.participants.filter(p => p.status !== 'Ditolak' && (BD.filter2 === 'ok' ? p.status === 'Disetujui' : true) && p.attendCount >= BD.minAtt);
}
function bdLanjut() {
  const d = BD.data, ses = d.bootcamp.sessionsFull || [], T = bdTargets();
  T.forEach(p => { if (BD.sel[p.email] === undefined) BD.sel[p.email] = true; });
  const chosen = T.filter(p => BD.sel[p.email]);
  document.getElementById('bdBody').innerHTML = '<div class="grid xl:grid-cols-[1.5fr_1fr] gap-6">' +
    '<div class="app-card rounded-2xl p-5"><h3 class="font-semibold text-main mb-3">1. Pilih peserta</h3><div class="flex flex-wrap items-end gap-3 mb-4">' +
      '<div><label class="form-label">Status</label><select class="form-input !py-2 !w-auto" onchange="BD.filter2=this.value;BD.sel={};bdRender()"><option value="all"' + (BD.filter2 !== 'ok' ? ' selected' : '') + '>Menunggu + Disetujui</option><option value="ok"' + (BD.filter2 === 'ok' ? ' selected' : '') + '>Hanya Disetujui</option></select></div>' +
      '<div><label class="form-label">Hadir minimal</label><select class="form-input !py-2 !w-auto" onchange="BD.minAtt=Number(this.value);BD.sel={};bdRender()">' + [0].concat(ses.map(s => s.no)).map(n => '<option value="' + n + '"' + (BD.minAtt === n ? ' selected' : '') + '>' + (n ? n + '× pertemuan' : 'Semua') + '</option>').join('') + '</select></div>' +
      '<button class="text-sm text-accent" onclick="bdTargets().forEach(p=>BD.sel[p.email]=true);bdRender()">Pilih semua</button><button class="text-sm text-muted" onclick="bdTargets().forEach(p=>BD.sel[p.email]=false);bdRender()">Kosongkan</button></div>' +
      '<div class="product-picker" style="max-height:420px">' + (T.length ? T.map(p => '<label class="picker-row' + (BD.sel[p.email] ? ' is-checked' : '') + '"><input type="checkbox"' + (BD.sel[p.email] ? ' checked' : '') + ' onchange="BD.sel[' + esc(JSON.stringify(p.email)) + ']=this.checked;bdRender()">' +
        '<span class="text-sm flex-1">' + esc(p.fullName) + ' <span class="text-muted">· ' + esc(p.email) + '</span></span><span class="badge badge-document">hadir ' + p.attendCount + '/' + ses.length + '</span></label>').join('') : '<p class="text-sm text-muted p-3">Tidak ada peserta yang cocok.</p>') + '</div></div>' +
    '<div class="space-y-6"><div class="app-card rounded-2xl p-5"><h3 class="font-semibold text-main mb-1">2a. Beri akses kelas / aplikasi</h3><p class="text-xs text-muted mb-3">Peserta mendapat notifikasi WA/Email "akses aktif".</p>' +
      '<div class="product-picker" style="max-height:220px">' + d.products.map(p => '<label class="picker-row"><input type="checkbox" class="bdProd" value="' + esc(p.id) + '"><span class="text-sm flex-1">' + esc(p.title) + '</span><span class="badge ' + badgeClassFor(p.category) + '">' + esc(catLabel(p.category)) + '</span></label>').join('') + '</div>' +
      '<button class="btn-primary w-full mt-3" onclick="bdGrant(this)"' + (chosen.length ? '' : ' disabled') + '><i data-lucide="gift" class="w-4 h-4"></i> Beri Akses ke ' + chosen.length + ' Peserta</button></div>' +
    '<div class="app-card rounded-2xl p-5"><h3 class="font-semibold text-main mb-1">2b. Kirim pesan (blast)</h3><p class="text-xs text-muted mb-3">Dikirim bertahap lewat menu Blast. Variabel: {nama} {email} {wa} {app}.</p>' +
      '<button class="btn-ghost w-full" onclick="bdBlast()"' + (chosen.length ? '' : ' disabled') + '><i data-lucide="send" class="w-4 h-4"></i> Tulis Pesan ke ' + chosen.length + ' Peserta</button></div></div></div>';
  refreshIcons();
}
async function bdGrant(btn) {
  const ids = Array.from(document.querySelectorAll('.bdProd:checked')).map(c => c.value);
  if (!ids.length) return showToast('Pilih produk', 'Centang minimal satu kelas/aplikasi.', 'warning');
  const emails = bdTargets().filter(p => BD.sel[p.email]).map(p => p.email);
  const r = await Swal.fire({ title: 'Beri akses ke ' + emails.length + ' peserta?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, berikan', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  const res = await withBusy(btn, 'Memberikan…', () => api('bootcampGrant', { bootId: BD.id, emails: emails, productIds: ids }));
  if (toastRes(res)) Admin.fetchMany(['crm', 'dashboard']);
}
async function bdBlast() {
  const emails = bdTargets().filter(p => BD.sel[p.email]).map(p => p.email);
  const b = BD.data.bootcamp;
  const r = await Swal.fire({ title: 'Pesan ke ' + emails.length + ' peserta', width: 640, showCancelButton: true, confirmButtonText: 'Mulai Blast', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div style="text-align:left;display:grid;gap:12px"><div class="grid2"><div><label class="form-label">Kanal</label><select id="bbCh" class="form-input"><option value="wa">WhatsApp</option><option value="email">Email</option><option value="both">WhatsApp + Email</option></select></div>' +
      '<div><label class="form-label">Per putaran</label><select id="bbBatch" class="form-input"><option>20</option><option selected>50</option></select></div></div>' +
      '<div><label class="form-label">Subjek email</label><input id="bbSubj" class="form-input" value="' + esc('Info lanjutan ' + b.title) + '"></div>' +
      '<div><label class="form-label">Pesan</label><textarea id="bbMsg" class="form-input" rows="6">Halo {nama} 👋\n\nTerima kasih sudah mengikuti *' + esc(b.title) + '*.\n</textarea></div></div>',
    preConfirm: () => { const v = { channel: document.getElementById('bbCh').value, batchSize: Number(document.getElementById('bbBatch').value), subject: document.getElementById('bbSubj').value.trim(), message: document.getElementById('bbMsg').value.trim() };
      if (v.message.length < 5) return Swal.showValidationMessage('Pesan terlalu pendek.'); if (v.channel !== 'wa' && !v.subject) return Swal.showValidationMessage('Subjek email wajib.'); return v; } });
  if (!r.isConfirmed) return;
  const res = await api('bootcampBlast', Object.assign({ bootId: BD.id, emails: emails, title: 'Peserta ' + b.title, intervalMin: 5 }, r.value));
  if (toastRes(res)) Admin.fetch('blastAdmin');
}
function bdExport() {
  const d = BD.data, ses = d.bootcamp.sessionsFull || [];
  downloadCsv('peserta_' + d.bootcamp.title.replace(/[^\w]+/g, '_') + '.csv', [['Nama', 'Email', 'WhatsApp', 'Profesi', 'Status', 'Akses Dibuka', 'Terdaftar'].concat(ses.map(s => s.title), ['Total Hadir'])].concat(
    d.participants.map(p => [p.fullName, p.email, p.whatsapp, p.profession, p.status, p.accessGranted ? 'Ya' : 'Belum', fmtDateTime(p.registeredAt)].concat(ses.map(s => p.attended[s.id] ? 'Hadir' : ''), [p.attendCount]))));
}
