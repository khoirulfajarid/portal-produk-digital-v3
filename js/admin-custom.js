/**
 * ============================================================
 * admin-custom.js — Panel Superadmin: Aplikasi Custom
 * Tab: Pengajuan (daftar + detail + aksi) · Kalender Tenggat · Pengaturan
 * Alur: Baru → Penawaran → Disepakati → Dikerjakan → Selesai → Diterima
 * ============================================================
 */

const CA = { tab: 'list', filter: 'todo', month: null, dirty: false, cfg: null, q: null };
const CA_TODO = ['Baru', 'Disepakati'];
const CA_CLOSED = ['Diterima', 'Ditolak', 'Dibatalkan'];

adminRoute('custom', {
  title: 'Aplikasi Custom',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Aplikasi Custom', 'Pengajuan pembuatan aplikasi Apps Script dari member — penawaran, jadwal, serah terima, hingga pameran.',
      '<button class="btn-ghost !w-auto" onclick="CA.dirty=false;Admin.fetch(\'customAdmin\')"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Segarkan</button>') +
    '<div id="caKpi" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">' + '<div class="skeleton h-28"></div>'.repeat(4) + '</div>' +
    '<div class="flex flex-wrap items-center gap-2 mb-4"><div class="seg" id="caTabs">' +
      '<button class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap" data-ctab="list" onclick="caTab(\'list\')"><i data-lucide="inbox" class="w-4 h-4"></i> Pengajuan</button>' +
      '<button class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap" data-ctab="calendar" onclick="caTab(\'calendar\')"><i data-lucide="calendar-days" class="w-4 h-4"></i> Kalender</button>' +
      '<button class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap" data-ctab="settings" onclick="caTab(\'settings\')"><i data-lucide="settings-2" class="w-4 h-4"></i> Pengaturan</button></div></div>' +
    '<div id="caBox">' + skeletonRows(6) + '</div></div>',
  mount: el => el.addEventListener('input', e => { if (e.target.closest('#caBox form, #caBox .ca-form')) CA.dirty = true; }),
  show: (el, id) => {
    CA.detail = id || null; CA.dirty = false; CA.cfg = null;
    if (id) CA.tab = 'list';
    Admin.load('customAdmin');
  }
});

function caTab(t) {
  if (CA.dirty && !confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) return;
  CA.tab = t; CA.dirty = false; CA.cfg = null;
  if (CA.detail) { CA.detail = null; history.replaceState(null, '', '#/admin/custom'); }
  ADMIN_RENDER.customAdmin(AppState.a.customAdmin);
}

ADMIN_RENDER.customAdmin = function (d) {
  const box = document.getElementById('caBox');
  if (!box || !d) return;
  const c = d.counts || {};
  const overdue = d.requests.filter(r => r.status === 'Dikerjakan' && r.estimateDate && new Date(r.estimateDate) < startOfToday()).length;
  const revenue = d.requests.filter(r => ['Disepakati', 'Dikerjakan', 'Selesai', 'Diterima'].indexOf(r.status) > -1).reduce((a, r) => a + (Number(r.finalPrice) || 0), 0);
  document.getElementById('caKpi').innerHTML =
    kpi('Perlu Tindakan', (c.Baru || 0) + (c.Disepakati || 0), 'bell-dot', cssVar('--warning'), (c.Baru || 0) + ' baru · ' + (c.Disepakati || 0) + ' belum dijadwalkan') +
    kpi('Menunggu Customer', (c.Penawaran || 0) + (c.Selesai || 0), 'hourglass', cssVar('--indigo'), (c.Penawaran || 0) + ' penawaran · ' + (c.Selesai || 0) + ' serah terima') +
    kpi('Sedang Dikerjakan', c.Dikerjakan || 0, 'hammer', cssVar('--accent'), overdue ? overdue + ' lewat tenggat!' : 'semua sesuai jadwal') +
    kpi('Nilai Disepakati', fmtMoney(revenue).replace('Gratis', 'Rp 0'), 'wallet', cssVar('--success'), (c.Diterima || 0) + ' aplikasi diterima');
  setNavBadge('custom', (c.Baru || 0) + (c.Disepakati || 0));
  document.querySelectorAll('#caTabs [data-ctab]').forEach(b => b.classList.toggle('is-active', b.dataset.ctab === CA.tab));
  if (CA.dirty) return;                         // jangan timpa isian admin yang sedang diketik
  if (CA.tab === 'calendar') renderCaCalendar(d);
  else if (CA.tab === 'settings') renderCaSettings(d);
  else if (CA.detail) renderCaDetail(d);
  else renderCaList(d);
  refreshIcons();
};

/** Tanggal lokal yyyy-mm-dd (toISOString bergeser 1 hari di zona WIB). */
function ymd(v) { if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function startOfToday() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }
function caChoiceLabel(cfg, k) {
  const p = (cfg && cfg.pricing) || {};
  return { exclusive: p.exclusiveLabel || 'Harga Eksklusif', resale: p.resaleLabel || 'Harga Hemat', propose: p.proposeLabel || 'Ajukan Harga Sendiri', special: 'Harga Khusus', manual: 'Kesepakatan langsung' }[k] || k || '—';
}
function caDeadlineHtml(r) {
  if (!r.estimateDate) return '<span class="text-muted">—</span>';
  const days = Math.round((new Date(r.estimateDate) - startOfToday()) / 86400000);
  const tone = r.status !== 'Dikerjakan' ? 'text-muted' : days < 0 ? 'text-danger' : days <= 2 ? 'text-warn' : 'text-main';
  const hint = r.status !== 'Dikerjakan' ? '' : days < 0 ? 'lewat ' + (-days) + ' hari' : days === 0 ? 'hari ini' : days + ' hari lagi';
  return '<span class="' + tone + '"><b>' + esc(fmtDate(r.estimateDate)) + '</b>' + (hint ? '<br><small>' + hint + '</small>' : '') + '</span>';
}


// ── TAB PENGAJUAN ───────────────────────────────────────────
function renderCaList(d) {
  const box = document.getElementById('caBox');
  const c = d.counts || {};
  const chips = [['todo', 'Perlu tindakan', (c.Baru || 0) + (c.Disepakati || 0)], ['active', 'Berjalan', d.requests.filter(r => CA_CLOSED.indexOf(r.status) === -1).length], ['all', 'Semua', d.requests.length]]
    .concat(CUSTOM_FLOW.concat(['Ditolak', 'Dibatalkan']).map(s => [s, CUSTOM_STATUS_LABEL[s], c[s] || 0]));
  const rows = d.requests.filter(r => CA.filter === 'all' || (CA.filter === 'todo' ? CA_TODO.indexOf(r.status) > -1 : CA.filter === 'active' ? CA_CLOSED.indexOf(r.status) === -1 : r.status === CA.filter));
  box.innerHTML = '<div class="app-card rounded-2xl p-5"><div class="flex flex-wrap gap-2 mb-4">' +
    chips.map(ch => '<button class="chip' + (CA.filter === ch[0] ? ' chip-active' : '') + '" onclick="CA.filter=' + jsArg(ch[0]) + ';renderCaList(AppState.a.customAdmin);refreshIcons()">' + esc(ch[1]) + ' <span class="opacity-70">' + ch[2] + '</span></button>').join('') + '</div>' +
    '<div class="overflow-x-auto"><table id="tblCustom" class="display w-full"><thead><tr><th>Pengajuan</th><th>Customer</th><th>Harga</th><th>Estimasi</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div></div>';
  buildTable('tblCustom', {
    data: rows, pageLength: 25, columns: [
      { data: null, render: (r, t) => t !== 'display' ? r.id + ' ' + r.title : '<div class="min-w-0 max-w-[340px]"><p class="font-semibold text-main line-clamp-2">' + esc(r.title) + '</p><p class="mono text-xs text-muted">' + esc(r.id) + ' · ' + timeAgo(r.createdAt) + '</p></div>' },
      { data: null, render: (r, t) => t !== 'display' ? r.fullName + ' ' + r.email + ' ' + r.whatsapp : '<p class="font-medium text-main">' + esc(r.fullName) + '</p><p class="text-xs text-muted">' + esc(r.profession) + ' · ' + esc(r.whatsapp) + '</p>' },
      { data: null, render: (r, t) => t !== 'display' ? (r.finalPrice || r.proposedPrice || 0) : r.finalPrice ? '<b class="text-main">' + esc(fmtMoney(r.finalPrice)) + '</b><br><small class="text-muted">' + esc(caChoiceLabel(d.config, r.finalChoice)) + '</small>'
        : '<span class="text-sm">' + esc(caChoiceLabel(d.config, r.pricingChoice)) + '</span>' + (r.pricingChoice === 'propose' ? '<br><small class="text-muted">ajuan ' + esc(fmtMoney(r.proposedPrice)) + '</small>' : '') },
      { data: null, render: (r, t) => t !== 'display' ? (r.estimateDate || '') : caDeadlineHtml(r) },
      { data: 'status', render: s => customBadge(s) },
      { data: null, orderable: false, render: r => '<div class="flex gap-1.5"><button class="btn-primary !w-auto !py-1.5 !px-3 !text-xs" onclick="go(\'admin/custom\',' + jsArg(r.id) + ')">Kelola</button>' +
        '<button class="btn-icon" title="Chat WA" onclick="openLink(waLink(' + jsArg(r.whatsapp) + ',' + jsArg('Halo ' + r.fullName + ', terkait pengajuan aplikasi "' + r.title + '" (' + r.id + '): ') + '))"><i data-lucide="message-circle" class="w-4 h-4"></i></button></div>' }
    ]
  });
}


// ── DETAIL + AKSI ───────────────────────────────────────────
function renderCaDetail(d) {
  const box = document.getElementById('caBox');
  const r = d.requests.filter(x => x.id === CA.detail)[0];
  if (!r) { box.innerHTML = '<div class="app-card rounded-2xl p-6">' + emptyState('search-x', 'Pengajuan tidak ditemukan', CA.detail) + '</div>'; return; }
  const cfg = d.config, pr = cfg.pricing || {}, q = r.quote || {}, st = r.status, step = CUSTOM_FLOW.indexOf(st);
  const answers = answersHtml(r.answers);          // reset buffer salin → panggil lebih dulu
  const card = (title, icon, body, extra) => '<div class="app-card rounded-2xl p-6 ca-form' + (extra || '') + '"><h3 class="font-semibold text-main mb-4 inline-flex items-center gap-2"><i data-lucide="' + icon + '" class="w-5 h-5 text-accent"></i> ' + title + '</h3>' + body + '</div>';
  const acts = [];

  if (st === 'Baru' || st === 'Penawaran') {
    acts.push(card(st === 'Penawaran' ? 'Perbarui Penawaran Harga' : 'Kirim Penawaran Harga', 'badge-dollar-sign',
      (st === 'Penawaran' ? '<div class="notice mb-4"><i data-lucide="send" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Penawaran terkirim ' + esc(timeAgo(q.sentAt)) + ' — menunggu customer memilih & menyetujui.</p></div>' : '') +
      (r.pricingChoice === 'propose' ? '<div class="notice notice-warning mb-4"><i data-lucide="hand-coins" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Customer mengajukan harga <b>' + esc(fmtMoney(r.proposedPrice)) + '</b>' + (r.customerNote ? ' · "' + esc(r.customerNote) + '"' : '') + '</p></div>' : '') +
      '<div class="grid sm:grid-cols-3 gap-3">' +
        '<div><label class="form-label">' + esc(pr.exclusiveLabel) + ' (Rp)</label><input id="cqEx" type="number" min="0" step="10000" class="form-input" value="' + esc(q.exclusivePrice || '') + '" placeholder="mis. 1500000"><p class="text-[11px] text-muted mt-1">Tidak dijual kembali</p></div>' +
        '<div><label class="form-label">' + esc(pr.resaleLabel) + ' (Rp)</label><input id="cqRe" type="number" min="0" step="10000" class="form-input" value="' + esc(q.resalePrice || '') + '" placeholder="mis. 900000"><p class="text-[11px] text-muted mt-1">Boleh dijual ke publik</p></div>' +
        '<div><label class="form-label">Harga Khusus (Rp)</label><input id="cqSp" type="number" min="0" step="10000" class="form-input" value="' + esc(q.specialPrice || (r.pricingChoice === 'propose' ? r.proposedPrice : '') || '') + '"><p class="text-[11px] text-muted mt-1">Tanggapan harga ajuan (opsional)</p></div></div>' +
      '<div class="mt-3"><label class="form-label">Catatan untuk customer</label><textarea id="cqNote" rows="3" class="form-input" placeholder="Rincian fitur yang termasuk, lama pengerjaan, cara pembayaran, dll.">' + esc(q.note || '') + '</textarea></div>' +
      '<p class="text-xs text-muted mt-2">Kosongkan harga yang tidak ditawarkan. Customer memilih salah satu lalu mencentang persetujuan.</p>' +
      '<div class="flex flex-wrap gap-2 mt-4"><button id="caQuoteBtn" class="btn-primary !w-auto" onclick="caQuote(' + jsArg(r.id) + ')"><i data-lucide="send" class="w-4 h-4"></i> Kirim Penawaran</button>' +
      '<button class="btn-ghost !w-auto" onclick="caAgreeManual(' + jsArg(r.id) + ')"><i data-lucide="handshake" class="w-4 h-4"></i> Tandai Disepakati (via WA)</button></div>'));
  }
  if (st === 'Disepakati' || st === 'Dikerjakan') {
    acts.push(card(st === 'Disepakati' ? 'Tetapkan Estimasi Selesai' : 'Ubah Jadwal', 'calendar-clock',
      (st === 'Disepakati' ? '<div class="notice notice-success mb-4"><i data-lucide="handshake" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Harga disepakati <b>' + esc(fmtMoney(r.finalPrice)) + '</b> (' + esc(caChoiceLabel(cfg, r.finalChoice)) + ') ' + esc(timeAgo(r.agreedAt)) + '. Tetapkan tanggal estimasi selesai untuk mulai mengerjakan.</p></div>' : '') +
      '<div class="grid sm:grid-cols-[200px_1fr] gap-3"><div><label class="form-label">Estimasi selesai *</label><input id="csDate" type="date" class="form-input" min="' + ymd(new Date()) + '" value="' + esc(ymd(r.estimateDate)) + '"></div>' +
      '<div><label class="form-label">Catatan (opsional)</label><input id="csNote" class="form-input" placeholder="mis. Tahap 1: desain database"></div></div>' +
      '<div class="flex flex-wrap gap-2 mt-3">' + [3, 7, 14, 30].map(n => '<button type="button" class="chip" onclick="caSetDays(' + n + ')">+' + n + ' hari</button>').join('') + '</div>' +
      '<p class="text-xs text-muted mt-2">' + (cfg.calendarSync ? '📅 Otomatis masuk Google Calendar Anda + pengingat H-' + cfg.reminderDays + '.' : '📧 Pengingat tenggat H-' + cfg.reminderDays + ' dikirim ke email/WA Admin. Aktifkan sinkron Google Calendar di tab Pengaturan.') + '</p>' +
      '<button id="caSchedBtn" class="btn-primary !w-auto mt-4" onclick="caSchedule(' + jsArg(r.id) + ')"><i data-lucide="calendar-check" class="w-4 h-4"></i> ' + (st === 'Disepakati' ? 'Simpan & Mulai Kerjakan' : 'Simpan Jadwal Baru') + '</button>'));
  }
  if (st === 'Dikerjakan') {
    acts.push(card('Update Progres', 'activity',
      '<textarea id="cpNote" rows="2" class="form-input" placeholder="mis. Halaman login & dashboard sudah jadi, lanjut modul laporan.">' + esc(r.progressNote) + '</textarea>' +
      '<button id="caProgBtn" class="btn-ghost !w-auto mt-3" onclick="caProgress(' + jsArg(r.id) + ')"><i data-lucide="send" class="w-4 h-4"></i> Kirim Progres ke Customer</button>'));
  }
  if (st === 'Dikerjakan' || st === 'Selesai') {
    const dv = r.delivery || {};
    CA.fileId = dv.fileId || '';
    acts.push(card(st === 'Selesai' ? 'Perbarui Berkas Serah Terima' : 'Serahkan Aplikasi', 'package-check',
      '<label class="form-label">Berkas aplikasi (.zip) *</label>' +
      '<div class="flex flex-wrap gap-2 items-center"><button type="button" id="caZipBtn" class="btn-ghost !w-auto" onclick="caPickZip(' + jsArg(r.id) + ')"><i data-lucide="upload-cloud" class="w-4 h-4"></i> Unggah ZIP (maks. 25 MB)</button>' +
        '<span class="text-xs text-muted">atau tempel link Google Drive:</span></div>' +
      '<input id="cdDrive" class="form-input mt-2" placeholder="https://drive.google.com/file/d/…" value="' + esc(dv.fileId ? 'https://drive.google.com/file/d/' + dv.fileId + '/view' : '') + '">' +
      '<p id="cdFileInfo" class="text-xs text-muted mt-1">' + (dv.fileId ? '✅ Berkas tersimpan · <button class="text-accent" onclick="openLink(' + jsArg(dv.fileUrl) + ')">unduh</button>' : 'Berkas >25 MB: unggah manual ke Drive (akses "Siapa saja yang memiliki link"), lalu tempel link-nya.') + '</p>' +
      '<div class="mt-4"><label class="form-label">Video tutorial (YouTube)</label><input id="cdVideo" class="form-input" value="' + esc(dv.videoUrl || '') + '" placeholder="https://youtu.be/…" oninput="caVideoPreview()"><div id="cdVideoPrev" class="mt-2"></div></div>' +
      '<div class="mt-3"><label class="form-label">Catatan serah terima</label><textarea id="cdNote" rows="3" class="form-input" placeholder="Langkah instalasi singkat, akun demo, masa garansi revisi, dll.">' + esc(dv.note || '') + '</textarea></div>' +
      '<button id="caDelivBtn" class="btn-primary !w-auto mt-4" onclick="caDeliver(' + jsArg(r.id) + ')"><i data-lucide="package-check" class="w-4 h-4"></i> ' + (st === 'Selesai' ? 'Perbarui & Kirim Ulang' : 'Kirim ke Customer') + '</button>'));
  }
  if (st === 'Selesai') {
    acts.unshift('<div class="notice"><i data-lucide="hourglass" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Aplikasi terkirim ' + esc(timeAgo((r.delivery || {}).at)) + '. Menunggu customer menekan <b>"Oke, Aplikasi Diterima"</b>.</p></div>');
  }
  if (st === 'Diterima') {
    const consent = r.demoConsent === 'yes' ? '<b>BOLEH</b> dibuatkan demo untuk etalase' : r.demoConsent === 'no' ? '<b>TIDAK</b> — tampilkan preview video sekilas saja' : 'belum dijawab customer';
    acts.push(card('Pameran Produk', 'trophy',
      '<div class="notice ' + (r.demoConsent === 'yes' ? 'notice-success' : r.demoConsent === 'no' ? 'notice-warning' : '') + '"><i data-lucide="presentation" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Izin etalase: ' + consent + '.</p></div>' +
      (r.showcaseId ? '<p class="text-sm text-muted mt-3">✅ Sudah ada di Pameran Karya.</p><button class="btn-ghost !w-auto mt-3" onclick="caOpenShowcase(' + jsArg(r.showcaseId) + ')"><i data-lucide="external-link" class="w-4 h-4"></i> Buka di Pameran Karya</button>'
        : '<p class="text-sm text-muted mt-3">Buat draf di Pameran Karya dengan video ' + (r.demoConsent === 'yes' ? 'tutorial + link demo' : 'preview sekilas') + ', lalu lengkapi & tampilkan.</p>' +
          '<button id="caShowBtn" class="btn-primary !w-auto mt-3" onclick="caToShowcase(' + jsArg(r.id) + ')"><i data-lucide="plus" class="w-4 h-4"></i> Tambahkan ke Pameran Karya</button>')));
  }

  const open = CA_CLOSED.indexOf(st) === -1;
  box.innerHTML =
    '<button class="text-sm text-muted hover:text-main inline-flex items-center gap-1 mb-4" onclick="caBack()"><i data-lucide="arrow-left" class="w-4 h-4"></i> Semua pengajuan</button>' +
    '<div class="app-card rounded-2xl p-6 mb-6"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><p class="mono text-xs text-muted">' + esc(r.id) + ' · diajukan ' + esc(fmtDateTime(r.createdAt)) + '</p>' +
      '<h2 class="text-xl font-bold text-main mt-1">' + esc(r.title) + '</h2></div>' + customBadge(st) + '</div>' +
      (step > -1 ? '<div class="flow-bar mt-5">' + CUSTOM_FLOW.map((s, i) => '<div class="flow-step' + (i < step ? ' is-done' : i === step ? ' is-active' : '') + '"><span>' + (i < step ? '✓' : i + 1) + '</span><small>' + esc(s) + '</small></div>').join('') + '</div>' : '') + '</div>' +
    '<div class="grid xl:grid-cols-[1.5fr_1fr] gap-6">' +
      '<div class="space-y-6">' + acts.join('') + '<div class="app-card rounded-2xl p-6">' + answers + '</div></div>' +
      '<div class="space-y-6">' +
        '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-2">Customer</h3>' +
          detailRow('user', 'Nama', r.fullName) + detailRow('briefcase', 'Profesi', r.profession) + detailRow('mail', 'Email', r.email) + detailRow('phone', 'WhatsApp', r.whatsapp) +
          detailRow('tag', 'Pilihan harga awal', caChoiceLabel(cfg, r.pricingChoice) + (r.pricingChoice === 'propose' ? ' · ' + fmtMoney(r.proposedPrice) : '')) +
          (r.customerNote ? detailRow('sticky-note', 'Catatan customer', r.customerNote) : '') +
          (r.finalPrice ? detailRow('badge-check', 'Harga final', fmtMoney(r.finalPrice) + ' · ' + caChoiceLabel(cfg, r.finalChoice)) : '') +
          (r.estimateDate ? detailRow('calendar-clock', 'Estimasi selesai', fmtDate(r.estimateDate)) : '') +
          '<div class="flex flex-wrap gap-2 mt-4"><button class="btn-primary !w-auto" onclick="openLink(waLink(' + jsArg(r.whatsapp) + ',' + jsArg('Halo ' + r.fullName + ', terkait pengajuan aplikasi "' + r.title + '" (' + r.id + '): ') + '))"><i data-lucide="message-circle" class="w-4 h-4"></i> Chat WA</button>' +
          '<button class="btn-ghost !w-auto" onclick="openLink(' + jsArg('mailto:' + r.email + '?subject=' + encodeURIComponent('Pengajuan ' + r.id)) + ')"><i data-lucide="mail" class="w-4 h-4"></i> Email</button>' +
          (r.estimateDate ? '<button class="btn-ghost !w-auto" onclick="openLink(' + jsArg(gcalLink(r)) + ')"><i data-lucide="calendar-plus" class="w-4 h-4"></i> Google Calendar</button>' : '') + '</div></div>' +
        '<div class="app-card rounded-2xl p-6 ca-form"><h3 class="font-semibold text-main mb-2 inline-flex items-center gap-2"><i data-lucide="lock" class="w-4 h-4 text-muted"></i> Catatan Internal</h3>' +
          '<p class="text-xs text-muted mb-2">Hanya terlihat oleh Admin.</p><textarea id="caNote" rows="3" class="form-input">' + esc(r.adminNote || '') + '</textarea>' +
          '<button class="btn-ghost !w-auto mt-2" onclick="caSaveNote(' + jsArg(r.id) + ',this)"><i data-lucide="save" class="w-4 h-4"></i> Simpan Catatan</button></div>' +
        '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-3">Riwayat</h3>' +
          r.history.slice().reverse().map(h => '<div class="log-row"><div class="log-dot"></div><div class="min-w-0 flex-1"><p class="text-sm text-main"><b>' + esc(h.status) + '</b> <span class="text-muted">· ' + esc(h.by === r.email ? 'customer' : 'admin') + '</span></p>' +
            '<p class="text-xs text-muted">' + esc(h.note || '') + ' · ' + esc(fmtDateTime(h.at)) + '</p></div></div>').join('') + '</div>' +
        (open ? '<button class="btn-ghost !w-auto text-danger" onclick="caReject(' + jsArg(r.id) + ')"><i data-lucide="x-circle" class="w-4 h-4"></i> Tolak Pengajuan</button>' : '') +
      '</div></div>';
  caVideoPreview();
}

function caBack() {
  if (CA.dirty && !confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) return;
  CA.dirty = false; go('admin/custom');
}

function gcalLink(r) {
  const d = ymd(r.estimateDate).replace(/-/g, ''), n = new Date(r.estimateDate); n.setDate(n.getDate() + 1);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('🛠️ Tenggat: ' + r.title + ' (' + r.fullName + ')') +
    '&dates=' + d + '/' + ymd(n).replace(/-/g, '') + '&details=' + encodeURIComponent(r.id + '\n' + r.fullName + ' · ' + r.whatsapp + ' · ' + r.email + '\nHarga: ' + fmtMoney(r.finalPrice));
}

/** Kirim aksi → segarkan data → tetap di detail. */
async function caAct(payload, btn, label) {
  const res = btn ? await withBusy(btn, label || 'Menyimpan…', () => api('customUpdate', payload)) : await api('customUpdate', payload);
  if (!res.success) { Swal.fire({ icon: 'error', title: 'Gagal', text: res.message }); return null; }
  showToast('Berhasil', res.message, 'success');
  CA.dirty = false;
  await Admin.fetch('customAdmin');
  Admin.fetch('dashboard');
  return res;
}
const num$ = id => Number((document.getElementById(id) || {}).value || 0);
const val$ = id => ((document.getElementById(id) || {}).value || '').trim();

function caQuote(id) {
  const p = { id: id, action: 'quote', exclusivePrice: num$('cqEx'), resalePrice: num$('cqRe'), specialPrice: num$('cqSp'), note: val$('cqNote') };
  if (!p.exclusivePrice && !p.resalePrice && !p.specialPrice) return showToast('Isi harga', 'Minimal satu opsi harga.', 'warning');
  caAct(p, document.getElementById('caQuoteBtn'), 'Mengirim…');
}
async function caAgreeManual(id) {
  const cfg = AppState.a.customAdmin.config;
  const r = await Swal.fire({
    title: 'Tandai disepakati', text: 'Gunakan bila kesepakatan harga terjadi lewat WhatsApp/telepon.', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
    html: '<div style="text-align:left;display:grid;gap:10px"><div><label class="form-label">Jenis harga</label><select id="amC" class="form-input">' +
      ['exclusive', 'resale', 'special', 'manual'].map(k => '<option value="' + k + '">' + esc(caChoiceLabel(cfg, k)) + '</option>').join('') + '</select></div>' +
      '<div><label class="form-label">Harga final (Rp)</label><input id="amP" type="number" min="0" step="10000" class="form-input"></div></div>',
    preConfirm: () => { const v = { finalChoice: document.getElementById('amC').value, finalPrice: Number(document.getElementById('amP').value) }; if (!(v.finalPrice > 0)) return Swal.showValidationMessage('Isi harga final.'); return v; }
  });
  if (r.isConfirmed) caAct(Object.assign({ id: id, action: 'agree_manual' }, r.value));
}
function caSetDays(n) { const d = new Date(); d.setDate(d.getDate() + n); document.getElementById('csDate').value = ymd(d); CA.dirty = true; }
function caSchedule(id) {
  const ds = val$('csDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return showToast('Pilih tanggal', 'Tentukan estimasi selesai.', 'warning');
  caAct({ id: id, action: 'schedule', estimateDate: ds, note: val$('csNote') }, document.getElementById('caSchedBtn'));
}
function caProgress(id) {
  if (!val$('cpNote')) return showToast('Tulis progres', '', 'warning');
  caAct({ id: id, action: 'progress', note: val$('cpNote') }, document.getElementById('caProgBtn'), 'Mengirim…');
}
async function caPickZip(id) {
  const f = await pickFile('.zip,application/zip,application/x-zip-compressed');
  if (!f) return;
  if (!/\.zip$/i.test(f.name)) return showToast('Harus berkas .zip', f.name, 'warning');
  const btn = document.getElementById('caZipBtn'), info = document.getElementById('cdFileInfo');
  info.textContent = 'Mengunggah ' + f.name + ' (' + fmtBytes(f.size) + ')…';
  try {
    const res = await withBusy(btn, 'Mengunggah…', () => uploadFile('doc', f, { productId: id }));
    if (!res.success) { info.textContent = '❌ ' + res.message; return; }
    CA.fileId = res.data.fileId; CA.dirty = true;
    document.getElementById('cdDrive').value = 'https://drive.google.com/file/d/' + res.data.fileId + '/view';
    info.textContent = '✅ ' + res.data.fileName + ' · ' + res.data.fileSize + ' terunggah. Klik "Kirim ke Customer".';
  } catch (e) { info.textContent = '❌ ' + e.message; }
}
function driveIdOf(v) {
  v = String(v || '').trim();
  const m = v.match(/\/d\/([\w-]{20,})/) || v.match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : /^[\w-]{20,}$/.test(v) ? v : '';
}
function caVideoPreview() {
  const el = document.getElementById('cdVideoPrev'); if (!el) return;
  const id = ytId(val$('cdVideo'));
  el.innerHTML = id ? '<div class="video-frame max-w-md"><iframe src="https://www.youtube.com/embed/' + esc(id) + '" allowfullscreen></iframe></div>' : '';
}
function caDeliver(id) {
  const fileId = driveIdOf(val$('cdDrive')) || CA.fileId;
  if (!fileId) return showToast('Berkas ZIP belum ada', 'Unggah ZIP atau tempel link Google Drive.', 'warning');
  const v = val$('cdVideo');
  if (v && !ytId(v)) return showToast('Link YouTube tidak valid', '', 'warning');
  caAct({ id: id, action: 'deliver', fileId: fileId, videoUrl: v, note: val$('cdNote') }, document.getElementById('caDelivBtn'), 'Mengirim…');
}
async function caSaveNote(id, btn) {
  const res = await withBusy(btn, 'Menyimpan…', () => api('customUpdate', { id: id, action: 'note', note: val$('caNote') }));
  if (toastRes(res)) { CA.dirty = false; const r = AppState.a.customAdmin.requests.filter(x => x.id === id)[0]; if (r) r.adminNote = val$('caNote'); }
}
async function caReject(id) {
  const r = await Swal.fire({ title: 'Tolak pengajuan?', icon: 'warning', input: 'textarea', inputPlaceholder: 'Alasan (dikirim ke customer)', showCancelButton: true, confirmButtonText: 'Tolak', cancelButtonText: 'Batal', confirmButtonColor: '#E11D48' });
  if (r.isConfirmed) caAct({ id: id, action: 'reject', reason: r.value || '' });
}
async function caToShowcase(id) {
  const res = await caAct({ id: id, action: 'to_showcase' }, document.getElementById('caShowBtn'), 'Membuat draf…');
  if (res && res.data && res.data.showcaseId) caOpenShowcase(res.data.showcaseId);
}
async function caOpenShowcase(sid) {
  go('admin/showcase');
  await Admin.fetch('showcaseAdmin');
  if (typeof openShowcaseForm === 'function' && (AppState.a.showcaseAdmin || []).some(s => s.id === sid)) openShowcaseForm(sid);
}


// ── TAB KALENDER TENGGAT ────────────────────────────────────
function renderCaCalendar(d) {
  const box = document.getElementById('caBox');
  if (!CA.month) { const t = new Date(); CA.month = new Date(t.getFullYear(), t.getMonth(), 1); }
  const m = CA.month, y = m.getFullYear(), mo = m.getMonth();
  const items = d.requests.filter(r => r.estimateDate && ['Dikerjakan', 'Selesai', 'Diterima'].indexOf(r.status) > -1);
  const byDay = {};
  items.forEach(r => { const k = ymd(r.estimateDate); (byDay[k] = byDay[k] || []).push(r); });
  const first = (new Date(y, mo, 1).getDay() + 6) % 7;     // Senin = kolom pertama
  const days = new Date(y, mo + 1, 0).getDate(), today = ymd(new Date());
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="cal-cell is-empty"></div>';
  for (let dd = 1; dd <= days; dd++) {
    const k = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0'), list = byDay[k] || [];
    cells += '<div class="cal-cell' + (k === today ? ' is-today' : '') + (list.length ? ' has-items' : '') + '"><span class="cal-day">' + dd + '</span>' +
      list.map(r => '<button class="cal-item cal-' + r.status.toLowerCase() + '" title="' + esc(r.title + ' — ' + r.fullName) + '" onclick="go(\'admin/custom\',' + jsArg(r.id) + ')">' + esc(r.title) + '</button>').join('') +
      (list.length ? '<span class="cal-count">' + list.length + '</span>' : '') + '</div>';
  }
  const upcoming = items.filter(r => r.status === 'Dikerjakan').sort((a, b) => new Date(a.estimateDate) - new Date(b.estimateDate));
  box.innerHTML = '<div class="grid xl:grid-cols-[1.6fr_1fr] gap-6">' +
    '<div class="app-card rounded-2xl p-5"><div class="flex items-center justify-between mb-4">' +
      '<button class="btn-icon" onclick="caMonth(-1)" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>' +
      '<h3 class="font-semibold text-main">' + m.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) + '</h3>' +
      '<button class="btn-icon" onclick="caMonth(1)" aria-label="Bulan berikutnya"><i data-lucide="chevron-right" class="w-4 h-4"></i></button></div>' +
      '<div class="cal-grid">' + ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => '<div class="cal-head">' + x + '</div>').join('') + cells + '</div>' +
      '<div class="flex flex-wrap gap-3 mt-4 text-xs text-muted"><span><i class="cal-dot cal-dikerjakan"></i> Dikerjakan</span><span><i class="cal-dot cal-selesai"></i> Terkirim</span><span><i class="cal-dot cal-diterima"></i> Diterima</span>' +
      '<button class="text-accent ml-auto" onclick="CA.month=null;renderCaCalendar(AppState.a.customAdmin);refreshIcons()">Hari ini</button></div></div>' +
    '<div class="app-card rounded-2xl p-5"><h3 class="font-semibold text-main mb-1">Tenggat Terdekat</h3><p class="text-xs text-muted mb-4">' +
      (d.config.calendarSync ? '📅 Tersinkron ke Google Calendar · pengingat H-' + d.config.reminderDays : '📧 Pengingat H-' + d.config.reminderDays + ' via email/WA Admin (perawatan harian)') + '</p>' +
      (upcoming.length ? upcoming.map(r => '<button class="cal-up" onclick="go(\'admin/custom\',' + jsArg(r.id) + ')"><div class="min-w-0 text-left"><p class="text-sm font-semibold text-main truncate">' + esc(r.title) + '</p>' +
        '<p class="text-xs text-muted truncate">' + esc(r.fullName) + ' · ' + esc(fmtMoney(r.finalPrice)) + '</p></div><div class="text-right text-xs flex-none">' + caDeadlineHtml(r) + '</div></button>').join('')
        : '<p class="text-sm text-muted text-center py-8">Tidak ada pekerjaan berjalan.</p>') +
      (d.requests.filter(r => r.status === 'Disepakati').length ? '<div class="notice notice-warning mt-4"><i data-lucide="calendar-x" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">' + d.requests.filter(r => r.status === 'Disepakati').length + ' pengajuan sudah disepakati tapi belum dijadwalkan.</p><button class="text-accent text-sm" onclick="CA.filter=\'Disepakati\';caTab(\'list\')">Lihat</button></div>' : '') +
    '</div></div>';
}
function caMonth(n) { CA.month = new Date(CA.month.getFullYear(), CA.month.getMonth() + n, 1); renderCaCalendar(AppState.a.customAdmin); refreshIcons(); }


// ── TAB PENGATURAN ──────────────────────────────────────────
function renderCaSettings(d) {
  const box = document.getElementById('caBox');
  if (!CA.cfg) { CA.cfg = JSON.parse(JSON.stringify(d.config)); CA.q = CA.cfg.questions.slice(); }
  const c = CA.cfg, p = c.pricing || {};
  const field = (id, label, value, rows, ph) => '<div><label class="form-label" for="' + id + '">' + label + '</label>' + (rows ? '<textarea id="' + id + '" rows="' + rows + '" class="form-input" placeholder="' + esc(ph || '') + '">' + esc(value || '') + '</textarea>' : '<input id="' + id + '" class="form-input" value="' + esc(value || '') + '" placeholder="' + esc(ph || '') + '">') + '</div>';
  box.innerHTML = '<form class="ca-form grid 2xl:grid-cols-2 gap-6" onsubmit="event.preventDefault();caSaveConfig()">' +
    '<div class="space-y-6">' +
      '<div class="app-card rounded-2xl p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-main">Layanan</h3>' +
        '<label class="switch"><input type="checkbox" id="ccEnabled"' + (c.enabled ? ' checked' : '') + '><span></span> <b>Terima pengajuan baru</b></label></div>' +
        '<div class="grid gap-4">' + field('ccIntro', 'Teks pengantar (tampil di halaman publik & member)', c.intro, 3) +
        field('ccDisc', 'Ketentuan / Disclaimer * <span class="text-muted font-normal">— wajib dibaca & disetujui customer</span>', c.disclaimer, 9) +
        field('ccAgree', 'Kalimat kesepakatan (dicentang sebelum kirim)', c.agreement, 3) + '</div></div>' +
      '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-4">Opsi Kesepakatan Harga</h3><div class="grid gap-4">' +
        '<div class="grid sm:grid-cols-[1fr_2fr] gap-3">' + field('ccExL', 'Harga 1 — label', p.exclusiveLabel) + field('ccExD', 'Keterangan', p.exclusiveDesc) + '</div>' +
        '<div class="grid sm:grid-cols-[1fr_2fr] gap-3">' + field('ccReL', 'Harga 2 — label', p.resaleLabel) + field('ccReD', 'Keterangan', p.resaleDesc) + '</div>' +
        '<div class="grid sm:grid-cols-[1fr_2fr] gap-3">' + field('ccPrL', 'Harga 3 — label', p.proposeLabel) + field('ccPrD', 'Keterangan', p.proposeDesc) + '</div></div></div>' +
      '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-4">Kalender & Pengingat</h3>' +
        '<label class="switch"><input type="checkbox" id="ccCal"' + (c.calendarSync ? ' checked' : '') + '><span></span> Sinkron estimasi ke Google Calendar Superadmin</label>' +
        '<div class="grid sm:grid-cols-[180px_1fr] gap-3 mt-4 items-end"><div><label class="form-label" for="ccRem">Ingatkan H-</label><input id="ccRem" type="number" min="0" max="14" class="form-input" value="' + esc(c.reminderDays) + '"></div>' +
        '<p class="text-xs text-muted pb-2">Pengingat email/WA Admin dikirim otomatis oleh perawatan harian (event <span class="mono">customDeadline</span>).</p></div>' +
        '<div class="notice mt-4"><i data-lucide="info" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Sebelum menyalakan sinkron kalender, jalankan fungsi <b class="mono">otorisasiKalender()</b> sekali dari editor Apps Script untuk memberi izin akses Google Calendar.</p></div></div>' +
    '</div>' +
    '<div class="app-card rounded-2xl p-6 self-start"><div class="flex items-center justify-between mb-1"><h3 class="font-semibold text-main">Pertanyaan Dasar</h3><span class="text-xs text-muted" id="ccQCount"></span></div>' +
      '<p class="text-xs text-muted mb-4">Semua pertanyaan wajib dijawab customer. Pertanyaan pertama dipakai sebagai judul pengajuan.</p>' +
      '<div id="ccQs" class="space-y-3"></div>' +
      '<button type="button" class="btn-ghost w-full mt-3" onclick="caQAdd()"><i data-lucide="plus" class="w-4 h-4"></i> Tambah Pertanyaan</button></div>' +
    '<div class="sticky-save 2xl:col-span-2"><button type="button" class="btn-ghost !w-auto" onclick="CA.cfg=null;CA.dirty=false;renderCaSettings(AppState.a.customAdmin);refreshIcons()">Batalkan perubahan</button>' +
      '<button id="ccSave" type="submit" class="btn-primary !w-auto"><i data-lucide="save" class="w-4 h-4"></i> Simpan Pengaturan</button></div></form>';
  renderCaQuestions();
}

function renderCaQuestions() {
  const el = document.getElementById('ccQs'); if (!el) return;
  const n = CA.q.length;
  el.innerHTML = CA.q.map((q, i) => '<div class="q-row" data-i="' + i + '"><div class="q-num">' + (i + 1) + '</div><div class="min-w-0 flex-1 grid gap-2">' +
    '<input class="form-input" data-f="label" value="' + esc(q.label) + '" placeholder="Tulis pertanyaan">' +
    '<div class="grid sm:grid-cols-[150px_1fr] gap-2"><select class="form-input" data-f="type" onchange="caQCollect();renderCaQuestions();refreshIcons()">' +
      [['short', 'Jawaban singkat'], ['long', 'Paragraf'], ['choice', 'Pilihan ganda']].map(t => '<option value="' + t[0] + '"' + (q.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select>' +
    '<input class="form-input" data-f="help" value="' + esc(q.help || '') + '" placeholder="Petunjuk / contoh jawaban (opsional)"></div>' +
    (q.type === 'choice' ? '<textarea class="form-input" rows="3" data-f="options" placeholder="Satu opsi per baris (min. 2)">' + esc((q.options || []).join('\n')) + '</textarea>' : '') +
    '</div><div class="flex flex-col gap-1">' +
      '<button type="button" class="btn-icon !w-8 !h-8" title="Naik" onclick="caQMove(' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + '><i data-lucide="chevron-up" class="w-4 h-4"></i></button>' +
      '<button type="button" class="btn-icon !w-8 !h-8" title="Turun" onclick="caQMove(' + i + ',1)"' + (i === n - 1 ? ' disabled' : '') + '><i data-lucide="chevron-down" class="w-4 h-4"></i></button>' +
      '<button type="button" class="btn-icon !w-8 !h-8" title="Hapus" onclick="caQDel(' + i + ')"' + (n === 1 ? ' disabled' : '') + '><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>').join('');
  const cnt = document.getElementById('ccQCount'); if (cnt) cnt.textContent = n + ' pertanyaan';
}
function caQCollect() {
  document.querySelectorAll('#ccQs .q-row').forEach(row => {
    const q = CA.q[Number(row.dataset.i)];
    row.querySelectorAll('[data-f]').forEach(f => {
      if (f.dataset.f === 'options') q.options = f.value.split('\n').map(s => s.trim()).filter(Boolean);
      else q[f.dataset.f] = f.value.trim();
    });
    if (q.type !== 'choice') q.options = q.options || [];
  });
}
function caQAdd() { caQCollect(); CA.q.push({ id: '', label: '', type: 'long', help: '', options: [] }); CA.dirty = true; renderCaQuestions(); refreshIcons(); const last = document.querySelector('#ccQs .q-row:last-child input'); if (last) last.focus(); }
function caQDel(i) { caQCollect(); CA.q.splice(i, 1); CA.dirty = true; renderCaQuestions(); refreshIcons(); }
function caQMove(i, dir) { caQCollect(); const j = i + dir; if (j < 0 || j >= CA.q.length) return; const t = CA.q[i]; CA.q[i] = CA.q[j]; CA.q[j] = t; CA.dirty = true; renderCaQuestions(); refreshIcons(); }

async function caSaveConfig() {
  caQCollect();
  const qs = CA.q.filter(q => q.label);
  if (!qs.length) return showToast('Minimal 1 pertanyaan', '', 'warning');
  const bad = qs.filter(q => q.type === 'choice' && (q.options || []).length < 2)[0];
  if (bad) return showToast('Opsi kurang', 'Pertanyaan pilihan "' + bad.label + '" minimal 2 opsi.', 'warning');
  if (!val$('ccDisc')) return showToast('Ketentuan wajib diisi', '', 'warning');
  const cfg = {
    enabled: document.getElementById('ccEnabled').checked, intro: val$('ccIntro'), disclaimer: val$('ccDisc'), agreement: val$('ccAgree'),
    pricing: { exclusiveLabel: val$('ccExL'), exclusiveDesc: val$('ccExD'), resaleLabel: val$('ccReL'), resaleDesc: val$('ccReD'), proposeLabel: val$('ccPrL'), proposeDesc: val$('ccPrD') },
    calendarSync: document.getElementById('ccCal').checked, reminderDays: Number(val$('ccRem')) || 0, questions: qs
  };
  const res = await withBusy(document.getElementById('ccSave'), 'Menyimpan…', () => api('customSaveConfig', { config: cfg }));
  if (!toastRes(res)) return;
  CA.dirty = false; CA.cfg = null;
  Store.del('pub'); if (typeof Public !== 'undefined') Public.prefetch();
  Admin.fetch('customAdmin');
}
