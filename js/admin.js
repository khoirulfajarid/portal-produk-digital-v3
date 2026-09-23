/**
 * ============================================================
 * admin.js — Panel Superadmin: shell, Dashboard + Kuota, Produk
 * ============================================================
 */

const ADMIN_MENU = [
  { group: 'Ringkasan', items: [{ id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' }] },
  { group: 'Katalog', items: [
    { id: 'products', icon: 'package', label: 'Produk' },
    { id: 'keys', icon: 'key-round', label: 'Kode Akses' }] },
  { group: 'Member & Transaksi', items: [
    { id: 'orders', icon: 'receipt', label: 'Verifikasi Pesanan', badge: true },
    { id: 'crm', icon: 'contact', label: 'CRM Member' },
    { id: 'access', icon: 'user-plus', label: 'Pemberian Akses' }] },
  { group: 'Konten', items: [
    { id: 'showcase', icon: 'trophy', label: 'Pameran Karya' },
    { id: 'bootcamps', icon: 'calendar-days', label: 'Bootcamp' },
    { id: 'announcements', icon: 'megaphone', label: 'Pengumuman' },
    { id: 'helpdesk', icon: 'life-buoy', label: 'Helpdesk' }] },
  { group: 'Komunikasi', items: [
    { id: 'blast', icon: 'send', label: 'Blast WA / Email' },
    { id: 'notif', icon: 'bell-ring', label: 'Notifikasi & Fonnte' }] },
  { group: 'Sistem', items: [
    { id: 'logs', icon: 'activity', label: 'Log Aktivitas' },
    { id: 'import', icon: 'database-zap', label: 'Import & Migrasi' },
    { id: 'settings', icon: 'settings', label: 'Pengaturan' }] }
];

const ACTION_LABELS = {
  LOGIN: 'Login', LOGOUT: 'Logout', LOGIN_FAILED: 'Login Gagal', REGISTER: 'Pendaftaran', PROFILE_UPDATE: 'Profil Dilengkapi',
  REDEEM_CODE: 'Redeem Kode', REDEEM_FAILED: 'Redeem Gagal', VIEW_PRODUCT: 'Membuka Produk', LEAD_CREATE: 'Lead Baru', LEAD_UPDATE: 'Lead Diubah', LEAD_DELETE: 'Lead Dihapus',
  ORDER_CREATE: 'Pesanan Dibuat', ORDER_APPROVE: 'Pesanan Disetujui', ORDER_REJECT: 'Pesanan Ditolak',
  GRANT_BULK: 'Pemberian Akses', ACCESS_REVOKE: 'Akses Dicabut', MEMBER_ADD: 'Member Ditambah', MEMBER_UPDATE: 'Member Diubah',
  USER_BLOCK: 'Member Diblokir', USER_UNBLOCK: 'Member Diaktifkan',
  PRODUCT_CREATE: 'Produk Ditambah', PRODUCT_UPDATE: 'Produk Diubah', PRODUCT_ARCHIVE: 'Produk Diarsipkan', PRODUCT_RESTORE: 'Produk Diaktifkan',
  KEY_GENERATE: 'Kode Dibuat', KEY_EDIT: 'Kode Diubah', KEY_DELETE: 'Kode Dihapus',
  HELPDESK_SAVE: 'Artikel Helpdesk', HELPDESK_DELETE: 'Artikel Dihapus', HELPCAT_SAVE: 'Kategori Helpdesk', HELPCAT_DELETE: 'Kategori Dihapus',
  ANNOUNCE_SAVE: 'Pengumuman', ANNOUNCE_DELETE: 'Pengumuman Dihapus', SHOWCASE_SAVE: 'Karya Disimpan', SHOWCASE_DELETE: 'Karya Dihapus',
  BOOTCAMP_SAVE: 'Bootcamp Disimpan', BOOTCAMP_DELETE: 'Bootcamp Dihapus', NOTIF_SAVE: 'Notifikasi Diubah',
  BLAST_CREATE: 'Blast Dibuat', BLAST_PAUSE: 'Blast Dijeda', BLAST_RESUME: 'Blast Dilanjutkan', BLAST_CANCEL: 'Blast Dibatalkan', BLAST_RETRY: 'Blast Diulang', BLAST_RUN: 'Blast Manual', BLAST_DELETE: 'Blast Dihapus',
  SETTINGS_SAVE: 'Pengaturan Disimpan', BACKUP: 'Backup', LOG_ARCHIVE: 'Log Diarsipkan', IMPORT_RUN: 'Import Data', IMPORT_CSV: 'Import CSV', TRIGGER_INSTALL: 'Trigger Dipasang'
};

const Admin = {
  booted: false,

  /** Dipanggil saat panel dibuka: validasi sesi + prefetch data inti di latar. */
  async boot() {
    if (this.booted) return;
    this.booted = true;
    const s = await api('session');
    if (!s.success) return;
    Public.prefetch();
    // Prefetch berurutan (tidak membanjiri server) → menu lain terbuka instan
    ['dashboard', 'ordersAdmin', 'productsAdmin', 'crm'].reduce((p, act) => p.then(() => this.fetch(act)), Promise.resolve());
    clearInterval(AppState.timers.kpi);
    AppState.timers.kpi = setInterval(() => { if (document.visibilityState === 'visible') this.fetch('dashboard'); }, 60000);
  },

  key(action) { return userKey('a:' + action); },
  cached(action) { const c = Store.get(this.key(action), null); return c ? c.data : null; },

  /** Ambil data admin → simpan cache → render ulang halaman terkait bila sedang terbuka. */
  async fetch(action, payload) {
    const res = await api(action, payload || {});
    if (res.success) {
      AppState.a[action] = res.data;
      Store.set(this.key(action), { t: Date.now(), data: res.data });
      if (action === 'dashboard') setNavBadge('orders', res.data.kpi.pending);
      if (action === 'ordersAdmin') setNavBadge('orders', res.data.kpi.pending);
      const r = ADMIN_RENDER[action];
      if (r) r(res.data);
    }
    return res;
  },

  /** SWR untuk halaman admin: render dari cache, lalu segarkan. */
  load(action, payload) {
    const c = AppState.a[action] || this.cached(action);
    if (c) { AppState.a[action] = c; const r = ADMIN_RENDER[action]; if (r) r(c); }
    return this.fetch(action, payload);
  }
};

/** Peta aksi → fungsi render (diisi oleh tiap modul halaman). */
const ADMIN_RENDER = {};

function renderSidebar() {
  const menu = document.getElementById('sidebarMenu');
  if (!menu) return;
  renderSidebarBrand();
  if (menu.dataset.ready) { refreshIcons(); return; }
  menu.dataset.ready = '1';
  menu.innerHTML = ADMIN_MENU.map(g => '<li class="nav-group">' + esc(g.group) + '</li>' + g.items.map(m =>
    '<li><button type="button" class="sidebar-link w-full" data-nav="admin-' + m.id + '" onclick="go(\'admin/' + m.id + '\')">' +
    '<i data-lucide="' + m.icon + '" class="w-[18px] h-[18px]"></i><span class="flex-1 text-left">' + m.label + '</span>' +
    (m.badge ? '<span class="nav-badge" data-badge="' + m.id + '" hidden>0</span>' : '') + '</button></li>').join('')).join('');
  const d = Admin.cached('dashboard');
  if (d) setNavBadge('orders', d.kpi.pending);
  refreshIcons();
}

function renderSidebarBrand() {
  const s = (AppState.pub && AppState.pub.settings) || {};
  const b = document.getElementById('brandBadge');
  if (b) b.outerHTML = '<div id="brandBadge">' + brandLogoHtml(44) + '</div>';
  document.getElementById('brandName').textContent = s.appName || Store.get('brandName', '') || 'Admin Central';
  document.getElementById('adminWho').textContent = AppState.email || '';
}

function adminHead(title, sub, actions) {
  return '<div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">' +
    '<div><h1 class="page-title">' + esc(title) + '</h1>' + (sub ? '<p class="page-sub">' + esc(sub) + '</p>' : '') + '</div>' +
    (actions ? '<div class="flex flex-wrap gap-2">' + actions + '</div>' : '') + '</div>';
}
function kpi(label, value, icon, tone, sub) {
  return '<div class="stat-card"><div class="min-w-0"><p class="stat-label">' + esc(label) + '</p><p class="stat-value">' + esc(value) + '</p>' +
    (sub ? '<p class="text-xs text-muted mt-2">' + esc(sub) + '</p>' : '') + '</div>' +
    '<div class="stat-icon"' + (tone ? ' style="background:' + tone + '1f;color:' + tone + '"' : '') + '><i data-lucide="' + icon + '" class="w-5 h-5"></i></div></div>';
}
function statusBadge(s) {
  const m = { Active: 'badge-success', Published: 'badge-success', Approved: 'badge-success', Done: 'badge-success', Sent: 'badge-success', Member: 'badge-success',
    Draft: 'badge-document', Inactive: 'badge-document', Paused: 'badge-document', Cancelled: 'badge-document',
    Pending: 'badge-warning', Running: 'badge-ai', Waiting: 'badge-warning', Baru: 'badge-warning', Dihubungi: 'badge-video', Tertarik: 'badge-ai',
    Blocked: 'badge-error', Rejected: 'badge-error', Failed: 'badge-error', 'Tidak Tertarik': 'badge-error' };
  return '<span class="badge ' + (m[s] || 'badge-document') + '"><span class="dot"></span>' + esc(s) + '</span>';
}
function bar(pct, tone) {
  pct = Math.max(0, Math.min(100, pct || 0));
  const c = tone || (pct > 85 ? 'var(--error)' : pct > 65 ? 'var(--warning)' : 'var(--accent)');
  return '<div class="meter"><span style="width:' + pct.toFixed(1) + '%;background:' + c + '"></span></div>';
}
function adminRoute(id, def) { registerPage('admin-' + id, Object.assign({ layout: 'admin', auth: 'admin' }, def)); }


// ════════════════════════════════════════════════════════════
// DASHBOARD + KUOTA & SISTEM (Point 12)
// ════════════════════════════════════════════════════════════
adminRoute('dashboard', {
  title: 'Dashboard',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Dashboard Analisis', 'Performa platform, kuota harian, dan aktivitas terbaru.',
      '<button class="btn-ghost !w-auto" onclick="Admin.fetch(\'dashboard\');loadSystemStatus(true)"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Segarkan</button>') +
    '<div id="dashKpi" class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">' + '<div class="skeleton h-28"></div>'.repeat(8) + '</div>' +
    '<div id="sysBox" class="mb-6"></div>' +
    '<div class="grid xl:grid-cols-3 gap-6 mb-6">' +
      '<div class="app-card rounded-2xl p-6 xl:col-span-2"><h3 class="font-semibold text-main mb-4">Tren 14 Hari</h3><div class="h-[280px]"><canvas id="chTrend"></canvas></div></div>' +
      '<div class="insight-card rounded-2xl p-6"><div class="flex items-center gap-2 mb-4"><i data-lucide="sparkles" class="w-5 h-5" style="color:var(--mint)"></i><h3 class="font-semibold">Analisis Otomatis</h3></div><ul id="dashInsights" class="space-y-3 text-sm"></ul></div>' +
    '</div>' +
    '<div class="grid xl:grid-cols-3 gap-6 mb-6">' +
      '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-4">Kategori Produk</h3><div class="h-[240px]"><canvas id="chCat"></canvas></div></div>' +
      '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-4">Produk Terpopuler</h3><div class="h-[240px]"><canvas id="chTop"></canvas></div></div>' +
      '<div class="app-card rounded-2xl p-6"><div class="flex items-center justify-between mb-3"><h3 class="font-semibold text-main">Perlu Verifikasi</h3><button class="text-sm text-accent" onclick="go(\'admin/orders\')">Semua →</button></div><div id="dashPending"></div></div>' +
    '</div>' +
    '<div class="grid xl:grid-cols-2 gap-6">' +
      '<div class="app-card rounded-2xl p-6"><div class="flex items-center justify-between mb-3"><h3 class="font-semibold text-main">Aktivitas Realtime</h3><span class="live-dot">LIVE</span></div><div id="dashActivity" class="max-h-[420px] overflow-y-auto"></div></div>' +
      '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-3">Pemberian Akses Terbaru</h3><div id="dashRecent" class="max-h-[420px] overflow-y-auto"></div></div>' +
    '</div></div>',
  show: () => {
    Admin.load('dashboard');
    loadSystemStatus(false);
    Live.start('dashActivity', 15000);
    Object.keys(AppState.charts).forEach(k => { try { AppState.charts[k].resize(); } catch (e) { /* */ } });
  },
  leave: () => Live.stop()
});

ADMIN_RENDER.dashboard = function (d) {
  const box = document.getElementById('dashKpi');
  if (!box) return;
  const k = d.kpi;
  box.innerHTML =
    kpi('Total Redeem', k.redeems.toLocaleString('id-ID'), 'ticket', cssVar('--accent')) +
    kpi('Member Aktif', k.members.toLocaleString('id-ID'), 'users', cssVar('--indigo')) +
    kpi('Data Lengkap', k.members ? Math.round(k.complete / k.members * 100) + '%' : '—', 'user-check', cssVar('--success'), k.complete + ' dari ' + k.members + ' member') +
    kpi('Non-Member (Lead)', k.leads.toLocaleString('id-ID'), 'user-search', cssVar('--warning'), k.newLeads + ' baru belum dihubungi') +
    kpi('Produk Aktif', k.products, 'package', cssVar('--accent')) +
    kpi('Perlu Verifikasi', k.pending, 'clock', cssVar('--warning')) +
    kpi('Pendapatan', fmtMoney(k.revenue).replace('Gratis', 'Rp 0'), 'wallet', cssVar('--success')) +
    kpi('Akses 14 Hari', d.trend.access.reduce((a, b) => a + b, 0), 'trending-up', cssVar('--indigo'));
  document.getElementById('dashInsights').innerHTML = d.insights.map(t => '<li>' + esc(t) + '</li>').join('');
  document.getElementById('dashPending').innerHTML = d.pendingList.length ? d.pendingList.map(o =>
    '<div class="log-row"><div class="log-dot" style="background:var(--warning)"></div><div class="min-w-0 flex-1"><p class="text-sm font-medium text-main truncate">' + esc(o.product) + '</p>' +
    '<p class="text-xs text-muted truncate">' + esc(o.email) + ' · ' + esc(fmtMoney(o.amount)) + ' · ' + timeAgo(o.createdAt) + '</p></div></div>').join('')
    : '<p class="text-sm text-muted py-6 text-center">Tidak ada pesanan tertunda 🎉</p>';
  document.getElementById('dashRecent').innerHTML = d.recent.length ? d.recent.map(r =>
    '<div class="log-row"><div class="cell-avatar">' + esc(initial(r.email)) + '</div><div class="min-w-0 flex-1"><p class="text-sm font-medium text-main truncate">' + esc(r.product) + '</p>' +
    '<p class="text-xs text-muted truncate">' + esc(r.email) + ' · ' + esc(r.source) + ' · ' + timeAgo(r.date) + '</p></div></div>').join('') : '<p class="text-sm text-muted">Belum ada data.</p>';

  const accent = cssVar('--accent'), indigo = cssVar('--indigo');
  makeChart('chTrend', { type: 'line', data: { labels: d.trend.labels, datasets: [
    { label: 'Akses Diberikan', data: d.trend.access, borderColor: accent, backgroundColor: accent + '22', fill: true, tension: .35, pointRadius: 2 },
    { label: 'Pesanan Masuk', data: d.trend.orders, borderColor: indigo, backgroundColor: indigo + '18', fill: true, tension: .35, pointRadius: 2 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  const catK = Object.keys(d.categories);
  makeChart('chCat', { type: 'doughnut', data: { labels: catK.map(catLabel), datasets: [{ data: catK.map(c => d.categories[c]), backgroundColor: [accent, indigo, cssVar('--warning'), cssVar('--success'), '#94A3B8'], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom' } } } });
  makeChart('chTop', { type: 'bar', data: { labels: d.top.map(t => t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title), datasets: [{ label: 'Akses', data: d.top.map(t => t.count), backgroundColor: accent, borderRadius: 6 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
  refreshIcons();
};

async function loadSystemStatus(force) {
  const box = document.getElementById('sysBox');
  if (!box) return;
  const c = Admin.cached('systemStatus');
  if (c && !force) renderSystemStatus(c);
  else if (!c) box.innerHTML = '<div class="skeleton h-40"></div>';
  const res = await api('systemStatus', { refresh: !!force });
  if (res.success) { Store.set(Admin.key('systemStatus'), { t: Date.now(), data: res.data }); renderSystemStatus(res.data); }
}

function renderSystemStatus(s) {
  const box = document.getElementById('sysBox');
  if (!box) return;
  const dbPct = s.database.cells / s.database.limit * 100;
  const drPct = s.drive.limit ? s.drive.used / s.drive.limit * 100 : 0;
  const wa = s.wa || {};
  const waHtml = !wa.configured ? '<p class="text-sm text-muted">Token Fonnte belum diisi.</p><button class="text-sm text-accent mt-2" onclick="go(\'admin/notif\')">Konfigurasi →</button>'
    : wa.ok ? '<p class="text-2xl font-bold text-main">' + esc(wa.quota || '—') + '</p><p class="text-xs text-muted">sisa kuota pesan · ' + esc(wa.package || '') + '</p>' +
      '<p class="text-xs mt-2">' + statusBadge(wa.deviceStatus === 'connect' ? 'Active' : (wa.deviceStatus || 'unknown')) + ' <span class="text-muted ml-1">' + esc(wa.device) + (wa.expired ? ' · aktif s/d ' + esc(wa.expired) : '') + '</span></p>'
    : '<p class="text-sm" style="color:var(--error)">' + esc(wa.reason || 'Gagal membaca device') + '</p>';
  const trig = s.triggers;
  box.innerHTML = '<div class="app-card rounded-2xl p-6"><div class="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 class="font-semibold text-main inline-flex items-center gap-2"><i data-lucide="gauge" class="w-5 h-5 text-accent"></i> Kuota Harian & Status Sistem</h3>' +
    '<span class="text-xs text-muted">Dicek ' + timeAgo(s.checkedAt) + '</span></div>' +
    '<div class="grid sm:grid-cols-2 xl:grid-cols-5 gap-5">' +
      '<div class="quota"><p class="stat-label">Email (Gmail)</p><p class="text-2xl font-bold text-main">' + s.email.remaining + '</p><p class="text-xs text-muted">sisa penerima hari ini</p>' + bar(100 - Math.min(s.email.remaining, 100)) + '<p class="text-[11px] text-muted mt-1">' + esc(s.email.note) + '</p></div>' +
      '<div class="quota"><p class="stat-label">WhatsApp (Fonnte)</p>' + waHtml + '</div>' +
      '<div class="quota"><p class="stat-label">Penyimpanan Drive</p><p class="text-2xl font-bold text-main">' + fmtBytes(s.drive.used) + '</p><p class="text-xs text-muted">dari ' + (s.drive.limit ? fmtBytes(s.drive.limit) : 'tak terbatas') + '</p>' + bar(drPct) + '</div>' +
      '<div class="quota"><p class="stat-label">Database Sheets</p><p class="text-2xl font-bold text-main">' + dbPct.toFixed(2) + '%</p><p class="text-xs text-muted">' + s.database.cells.toLocaleString('id-ID') + ' / 10 juta sel</p>' + bar(dbPct) +
        '<button class="text-xs text-accent mt-1" onclick="showDbDetail()">Detail per sheet</button></div>' +
      '<div class="quota"><p class="stat-label">Otomasi</p>' +
        '<p class="text-sm mt-1">' + (trig.blastWorker ? '✅' : '⚠️') + ' Pekerja blast (5 mnt)</p><p class="text-sm">' + (trig.maintenance ? '✅' : '⚠️') + ' Perawatan harian</p>' +
        '<p class="text-xs text-muted mt-1">' + s.properties.sessions + ' sesi aktif · ' + s.blast.running + ' blast berjalan</p>' +
        (!trig.blastWorker || !trig.maintenance ? '<button class="btn-ghost !w-auto !py-1 !px-2 !text-xs mt-2" onclick="installTriggers(this)">Pasang Trigger</button>' : '') + '</div>' +
    '</div></div>';
  AppState.sys = s;
  refreshIcons();
}

function showDbDetail() {
  const s = AppState.sys; if (!s) return;
  Swal.fire({ title: 'Ukuran Database', width: 640, html: '<table class="w-full text-sm text-left"><thead><tr><th class="py-1">Sheet</th><th>Baris data</th><th>Sel</th></tr></thead><tbody>' +
    s.database.sheets.map(x => '<tr class="border-t border-app"><td class="py-1.5">' + esc(x.name) + '</td><td>' + x.rows.toLocaleString('id-ID') + '</td><td>' + x.cells.toLocaleString('id-ID') + '</td></tr>').join('') +
    '</tbody></table><p class="text-xs text-muted mt-3">Batas Google Sheets: 10.000.000 sel per spreadsheet.</p>' +
    '<button class="btn-ghost !w-auto mt-3" onclick="openLink(' + jsArg(s.database.url) + ')"><i data-lucide="external-link" class="w-4 h-4"></i> Buka Spreadsheet</button>', didOpen: refreshIcons });
}

async function installTriggers(btn) {
  const res = await withBusy(btn, 'Memasang…', () => api('installTriggers'));
  if (toastRes(res)) loadSystemStatus(true);
}

/** Pembaruan realtime aktivitas (polling ringan: hanya baris baru). */
const Live = {
  since: null, boxId: null, rows: [],
  start(boxId, ms) {
    this.boxId = boxId;
    this.tick();
    clearInterval(AppState.timers.live);
    AppState.timers.live = setInterval(() => { if (document.visibilityState === 'visible') this.tick(); }, ms || 10000);
  },
  stop() { clearInterval(AppState.timers.live); },
  async tick() {
    const res = await api('logsSince', { since: this.since || new Date(Date.now() - 7 * 86400000).toISOString() });
    if (!res.success) return;
    this.since = res.data.serverTime;
    if (res.data.logs.length) { this.rows = res.data.logs.concat(this.rows).slice(0, 60); }
    const box = document.getElementById(this.boxId);
    if (box && this.boxId === 'dashActivity') {
      box.innerHTML = this.rows.length ? this.rows.slice(0, 30).map((l, i) => logRow(l, i < res.data.logs.length)).join('') : '<p class="text-sm text-muted">Belum ada aktivitas.</p>';
      refreshIcons();
    }
    if (typeof Logs !== 'undefined') Logs.onLive(res.data.logs, res.data.activeTotal);
  }
};
function logRow(l, fresh) {
  return '<div class="log-row' + (fresh ? ' is-new' : '') + '"><div class="log-dot" style="background:' + (/FAILED|REJECT|BLOCK|DELETE/.test(l.action) ? 'var(--error)' : /ORDER|LEAD/.test(l.action) ? 'var(--warning)' : 'var(--accent)') + '"></div>' +
    '<div class="min-w-0 flex-1"><p class="text-sm text-main"><b>' + esc(ACTION_LABELS[l.action] || l.action) + '</b> <span class="text-muted">· ' + esc(l.email) + '</span></p>' +
    '<p class="text-xs text-muted truncate">' + esc(l.detail) + ' · ' + timeAgo(l.time) + '</p></div></div>';
}


// ════════════════════════════════════════════════════════════
// PRODUK — Kelas · Aplikasi · Dokumen · AI Link
// ════════════════════════════════════════════════════════════
const PF = { cat: 'all', status: 'all' };

adminRoute('products', {
  title: 'Produk',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Manajemen Produk', 'Kelas, Aplikasi, Dokumen, dan AI Link.',
      '<button class="btn-primary !w-auto" onclick="openProductForm()"><i data-lucide="plus" class="w-4 h-4"></i> Produk Baru</button>') +
    '<div class="app-card rounded-2xl p-5 mb-5 flex flex-wrap gap-4 items-end">' +
      '<div class="min-w-[180px]"><label class="form-label">Kategori</label><select id="pfCatF" class="form-input" onchange="PF.cat=this.value;ADMIN_RENDER.productsAdmin(AppState.a.productsAdmin)"><option value="all">Semua</option><option>Kelas</option><option>Aplikasi</option><option value="Document">Dokumen</option><option>AI Link</option></select></div>' +
      '<div class="min-w-[160px]"><label class="form-label">Status</label><select id="pfStF" class="form-input" onchange="PF.status=this.value;ADMIN_RENDER.productsAdmin(AppState.a.productsAdmin)"><option value="all">Semua</option><option>Active</option><option>Draft</option></select></div>' +
      '<p id="pfCount" class="text-sm text-muted ml-auto"></p></div>' +
    '<div class="app-card rounded-2xl p-5 overflow-x-auto"><table id="tblProducts" class="display w-full"><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Isi</th><th>Pemilik</th><th>Publik</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table></div></div>',
  show: () => Admin.load('productsAdmin')
});

ADMIN_RENDER.productsAdmin = function (list) {
  if (!document.getElementById('tblProducts') || !list) return;
  const rows = list.filter(p => (PF.cat === 'all' || p.Category === PF.cat) && (PF.status === 'all' || p.Status === PF.status));
  document.getElementById('pfCount').textContent = rows.length + ' dari ' + list.length + ' produk';
  buildTable('tblProducts', {
    data: rows, columns: [
      { data: null, render: p => '<div class="flex items-center gap-3 min-w-[240px]"><div class="w-16 h-10 rounded-lg overflow-hidden flex-none bg-surface-2">' + img(p.thumbnail, '', 'style="width:100%;height:100%;object-fit:cover"', 'IMG') + '</div>' +
        '<div class="min-w-0"><p class="font-semibold text-main truncate">' + esc(p.Title) + '</p><p class="text-xs text-muted truncate">' + esc(p.Tagline || p.Description) + '</p></div></div>' },
      { data: 'Category', render: c => '<span class="badge ' + badgeClassFor(c) + '">' + esc(catLabel(c)) + '</span>' },
      { data: 'Price', render: (v, t) => t === 'display' ? esc(fmtMoney(v)) : v },
      { data: null, render: p => p.Category === 'Kelas' ? p.episodeCount + ' ep · ' + p.resourceCount + ' materi' : p.Category === 'Aplikasi' ? (p.slides.length + p.previewVideos.length) + ' preview · ' + p.resourceCount + ' materi' : '—' },
      { data: 'owners' },
      { data: 'isPublic', render: v => v ? '<i data-lucide="globe" class="w-4 h-4 text-accent"></i>' : '<span class="text-muted">—</span>' },
      { data: 'Status', render: s => statusBadge(s) },
      { data: null, orderable: false, render: p => '<div class="flex gap-1.5"><button class="btn-icon" title="Ubah" onclick="openProductForm(' + jsArg(p.Product_ID) + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>' +
        (p.Status === 'Active' ? '<button class="btn-icon" title="Arsipkan" onclick="setProductStatus(' + jsArg(p.Product_ID) + ',\'Draft\')"><i data-lucide="archive" class="w-4 h-4"></i></button>'
                               : '<button class="btn-icon" title="Aktifkan" onclick="setProductStatus(' + jsArg(p.Product_ID) + ',\'Active\')"><i data-lucide="archive-restore" class="w-4 h-4"></i></button>') + '</div>' }
    ]
  });
};

async function setProductStatus(id, status) {
  if (status === 'Draft') {
    const r = await Swal.fire({ title: 'Arsipkan produk?', text: 'Produk disembunyikan dari katalog. Akses member yang sudah ada tetap aman.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Arsipkan', cancelButtonText: 'Batal' });
    if (!r.isConfirmed) return;
  }
  // Optimistic UI: ubah status di tabel dulu
  const list = AppState.a.productsAdmin || [];
  const p = list.filter(x => x.Product_ID === id)[0];
  const prev = p && p.Status;
  if (p) { p.Status = status; ADMIN_RENDER.productsAdmin(list); }
  const res = await api('setProductStatus', { productId: id, status: status });
  if (!toastRes(res) && p) { p.Status = prev; ADMIN_RENDER.productsAdmin(list); }
  else Admin.fetch('productsAdmin');
}

// ── Form produk (SweetAlert2 besar) ──
const F = { thumb: {}, episodes: [], resources: [], slides: [], pvideos: [], doc: null, cat: 'Kelas' };

function openProductForm(id) {
  const p = id ? (AppState.a.productsAdmin || []).filter(x => x.Product_ID === id)[0] : null;
  F.cat = p ? p.Category : 'Kelas';
  F.thumb = { mode: p ? p.Thumbnail_Mode : 'youtube', fileId: p ? p.Thumbnail_File_ID : '', url: p ? p.Thumbnail_URL : '' };
  F.episodes = p ? JSON.parse(JSON.stringify(p.episodes || [])) : [];
  F.resources = p ? JSON.parse(JSON.stringify(p.resources || [])) : [];
  F.slides = p ? JSON.parse(JSON.stringify(p.slidesRaw || [])) : [];
  F.pvideos = p ? JSON.parse(JSON.stringify(p.previewVideosRaw || [])) : [];
  F.doc = p && p.Drive_File_ID ? { fileId: p.Drive_File_ID, name: 'Berkas tersimpan di Drive' } : null;
  if (!F.episodes.length) F.episodes.push({ id: '', title: '', url: '', duration: '' });

  const cats = [['Kelas', 'Kelas (video series)'], ['Aplikasi', 'Aplikasi'], ['Document', 'Dokumen'], ['AI Link', 'AI Link']];
  const field = (id2, label, val, ph, type) => '<div><label class="form-label" for="' + id2 + '">' + label + '</label><input id="' + id2 + '" type="' + (type || 'text') + '" class="form-input" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"></div>';

  Swal.fire({
    title: p ? 'Ubah Produk' : 'Produk Baru', width: 860, showCancelButton: true, focusConfirm: false,
    confirmButtonText: p ? 'Simpan Perubahan' : 'Tambah Produk', cancelButtonText: 'Batal',
    html: '<div class="pform">' +
      '<div class="grid2">' + field('fTitle', 'Judul *', p && p.Title, 'Nama produk') +
        '<div><label class="form-label" for="fCat">Kategori *</label><select id="fCat" class="form-input">' + cats.map(c => '<option value="' + c[0] + '"' + (F.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>').join('') + '</select></div></div>' +
      field('fTag', 'Tagline singkat', p && p.Tagline, 'Satu kalimat yang menjual') +
      '<div><label class="form-label" for="fDesc">Deskripsi</label><textarea id="fDesc" class="form-input" rows="3">' + esc(p ? p.Description : '') + '</textarea></div>' +
      '<div class="grid3">' + field('fPrice', 'Harga (Rp)', p ? p.Price : 0, '0 = gratis', 'number') +
        '<div><label class="form-label" for="fStatus">Status</label><select id="fStatus" class="form-input"><option value="Active"' + (!p || p.Status === 'Active' ? ' selected' : '') + '>Active</option><option value="Draft"' + (p && p.Status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div>' +
        field('fSort', 'Urutan tampil', p && p.Sort_Order ? p.Sort_Order : '', '1, 2, 3…', 'number') + '</div>' +
      '<div class="grid2">' + field('fLynk', 'Link checkout Lynk.id', p && p.Lynk_URL, 'https://lynk.id/…') +
        '<div><label class="form-label">Tampil di halaman Open Access</label><label class="switch mt-2"><input type="checkbox" id="fPublic"' + (p ? (p.isPublic ? ' checked' : '') : ' checked') + '><span></span> Publik</label></div></div>' +
      '<div id="boxWa">' + field('fWa', 'Link WhatsApp Group (khusus pemilik produk ini)', p && p.WA_Group_URL, 'https://chat.whatsapp.com/…') + '</div>' +

      // Thumbnail 3 mode (perilaku v2.0 dipertahankan)
      '<div><label class="form-label">Thumbnail Cover</label><div class="mode-tabs" id="fThumbTabs">' +
        '<button type="button" class="mode-tab" data-mode="youtube" onclick="setThumbMode(\'youtube\')">Dari YouTube</button>' +
        '<button type="button" class="mode-tab" data-mode="upload" onclick="setThumbMode(\'upload\')">Upload Gambar</button>' +
        '<button type="button" class="mode-tab" data-mode="url" onclick="setThumbMode(\'url\')">URL Manual</button></div>' +
        '<div class="thumb-grid"><div class="thumb-preview" id="fThumbPrev">Belum ada gambar</div><div>' +
          '<div id="fThumbUp" hidden><div class="dropzone" id="fThumbDrop"><i data-lucide="image-plus" class="w-6 h-6 mx-auto mb-1"></i><p class="text-[13px] font-semibold">Klik atau seret gambar</p><p class="text-[11px]">JPG/PNG/WEBP · maks 5 MB</p></div><input type="file" id="fThumbFile" class="hidden" accept="image/*"><p id="fThumbInfo" class="text-xs text-muted mt-2"></p></div>' +
          '<div id="fThumbUrlBox" hidden><input id="fThumbUrl" class="form-input" placeholder="https://… (link berbagi Google Drive otomatis dikonversi)" value="' + esc(F.thumb.url) + '" oninput="refreshThumb()"></div>' +
          '<p id="fThumbYt" class="text-[13px] text-muted" hidden>Diambil otomatis dari video pertama (episode pertama untuk Kelas, video preview pertama untuk Aplikasi).</p>' +
        '</div></div></div>' +

      // Aplikasi: preview publik
      '<div id="boxApp" class="pf-section"><p class="pf-title"><i data-lucide="images" class="w-4 h-4"></i> Preview Aplikasi (terlihat publik)</p>' +
        '<div class="flex items-center justify-between"><label class="form-label !m-0">Slide Gambar</label><div class="flex gap-1.5"><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="addSlide(\'upload\')">+ Upload</button><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="addSlide(\'url\')">+ URL</button></div></div>' +
        '<div id="fSlides" class="grid gap-2 mt-2"></div>' +
        '<div class="flex items-center justify-between mt-4"><label class="form-label !m-0">Video Preview (YouTube)</label><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="addVideo(\'pvideos\')">+ Video</button></div>' +
        '<div id="fPvideos" class="grid gap-2 mt-2"></div>' +
        '<p class="pf-title mt-5"><i data-lucide="lock" class="w-4 h-4"></i> Isi Terkunci (hanya pembeli)</p>' +
        '<label class="form-label">File Source Code (.zip, maks 25 MB)</label><div class="dropzone" id="fSrcDrop"><i data-lucide="file-archive" class="w-6 h-6 mx-auto mb-1"></i><p class="text-[13px] font-semibold">Klik atau seret file source code</p></div><input type="file" id="fSrcFile" class="hidden"><p id="fSrcInfo" class="text-xs mt-2 text-accent"></p>' +
      '</div>' +

      // Kelas & Aplikasi: video + materi
      '<div id="boxVideo" class="pf-section"><div class="flex items-center justify-between"><label class="form-label !m-0" id="lblEp">Daftar Episode *</label><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="addVideo(\'episodes\')">+ Tambah</button></div>' +
        '<div id="fEpisodes" class="grid gap-2 mt-2"></div>' +
        '<div class="flex items-center justify-between mt-4"><label class="form-label !m-0">Materi Penunjang</label><div class="flex gap-1.5"><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="addRes(\'link\')">+ Link</button><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="addRes(\'file\')">+ Dokumen</button></div></div>' +
        '<p class="text-[11px] text-muted mt-1">Link materi hanya tampil sebagai tombol "Buka Materi" bagi member — URL tidak pernah terlihat.</p>' +
        '<div id="fResources" class="grid gap-2 mt-2"></div></div>' +

      '<div id="boxDoc" class="pf-section"><label class="form-label">Berkas Dokumen (maks 25 MB)</label><div class="dropzone" id="fDocDrop"><i data-lucide="upload-cloud" class="w-6 h-6 mx-auto mb-1"></i><p class="text-[13px] font-semibold">Klik atau seret berkas</p><p class="text-[11px]">PDF, DOC, PPT, XLSX, ZIP</p></div><input type="file" id="fDocFile" class="hidden"><p id="fDocInfo" class="text-xs mt-2 text-accent"></p></div>' +
      '<div id="boxLink" class="pf-section">' + field('fLink', 'Link AI (GEMS / GPTs / Claude) *', p && p.External_Link, 'https://…') + '</div>' +
    '</div>',
    didOpen: () => {
      document.getElementById('fCat').addEventListener('change', syncProductForm);
      bindDropzone(document.getElementById('fThumbDrop'), document.getElementById('fThumbFile'), uploadThumbFile);
      bindDropzone(document.getElementById('fDocDrop'), document.getElementById('fDocFile'), f => uploadDocInto(f, 'fDocInfo', p && p.Product_ID));
      bindDropzone(document.getElementById('fSrcDrop'), document.getElementById('fSrcFile'), f => uploadDocInto(f, 'fSrcInfo', p && p.Product_ID));
      syncProductForm(); renderVideoRows('episodes'); renderVideoRows('pvideos'); renderResRows(); renderSlides();
      setThumbMode(F.thumb.mode || 'url');
      if (F.doc) { document.getElementById('fDocInfo').textContent = '✓ ' + F.doc.name; document.getElementById('fSrcInfo').textContent = '✓ ' + F.doc.name; }
      refreshIcons();
    },
    preConfirm: () => {
      collectRows();
      const cat = document.getElementById('fCat').value;
      const title = document.getElementById('fTitle').value.trim();
      if (title.length < 3) return Swal.showValidationMessage('Judul minimal 3 karakter.');
      const price = Number(document.getElementById('fPrice').value);
      if (isNaN(price) || price < 0) return Swal.showValidationMessage('Harga tidak valid.');
      const eps = F.episodes.filter(e => e.url && e.url.trim());
      if (cat === 'Kelas' && !eps.length) return Swal.showValidationMessage('Kelas butuh minimal satu episode YouTube.');
      const badRes = F.resources.filter(r => r.title && (r.type === 'link' ? !/^https?:\/\//i.test(r.url || '') : !r.fileId))[0];
      if ((cat === 'Kelas' || cat === 'Aplikasi') && badRes) return Swal.showValidationMessage('Materi "' + badRes.title + '" belum lengkap.');
      const link = document.getElementById('fLink').value.trim();
      if (cat === 'AI Link' && !/^https?:\/\//i.test(link)) return Swal.showValidationMessage('Link AI harus diawali https://');
      for (const k of ['fLynk', 'fWa']) { const v = document.getElementById(k).value.trim(); if (v && !/^https?:\/\//i.test(v)) return Swal.showValidationMessage('Link harus diawali https://'); }
      return {
        Product_ID: p ? p.Product_ID : '', Title: title, Category: cat, Tagline: document.getElementById('fTag').value.trim(),
        Description: document.getElementById('fDesc').value.trim(), Price: price, Status: document.getElementById('fStatus').value,
        Sort_Order: Number(document.getElementById('fSort').value) || 0, Lynk_URL: document.getElementById('fLynk').value.trim(),
        Is_Public: document.getElementById('fPublic').checked, WA_Group_URL: document.getElementById('fWa').value.trim(),
        Thumbnail_Mode: F.thumb.mode, Thumbnail_File_ID: F.thumb.fileId,
        Thumbnail_URL: F.thumb.mode === 'url' ? document.getElementById('fThumbUrl').value.trim() : F.thumb.url,
        episodes: eps, resources: F.resources.filter(r => r.title), slides: F.slides.filter(s => s.fileId || s.url),
        previewVideos: F.pvideos.filter(v => v.url && v.url.trim()), External_Link: link, Drive_File_ID: F.doc ? F.doc.fileId : ''
      };
    }
  }).then(async r => {
    if (!r.isConfirmed) return;
    Swal.fire({ title: 'Menyimpan…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await api('saveProduct', r.value);
    Swal.close();
    if (toastRes(res)) Admin.fetch('productsAdmin');
    else openProductFormRetry(r.value, res.message);
  });
}
function openProductFormRetry(v, msg) { Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: msg }); }

function syncProductForm() {
  const v = document.getElementById('fCat').value;
  F.cat = v;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('boxVideo', v === 'Kelas' || v === 'Aplikasi'); show('boxApp', v === 'Aplikasi');
  show('boxDoc', v === 'Document'); show('boxLink', v === 'AI Link'); show('boxWa', v === 'Kelas' || v === 'Aplikasi');
  document.getElementById('lblEp').textContent = v === 'Aplikasi' ? 'Video Panduan Instalasi (terkunci)' : 'Daftar Episode *';
  const yt = document.querySelector('#fThumbTabs [data-mode="youtube"]');
  yt.style.display = (v === 'Kelas' || v === 'Aplikasi') ? '' : 'none';
  if (yt.style.display === 'none' && F.thumb.mode === 'youtube') setThumbMode('url');
  refreshThumb();
}
function setThumbMode(mode) {
  F.thumb.mode = mode;
  document.querySelectorAll('#fThumbTabs .mode-tab').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  document.getElementById('fThumbUp').hidden = mode !== 'upload';
  document.getElementById('fThumbUrlBox').hidden = mode !== 'url';
  document.getElementById('fThumbYt').hidden = mode !== 'youtube';
  refreshThumb();
}
function ytId(url) {
  const s = String(url || '').trim();
  const pats = [/youtu\.be\/([A-Za-z0-9_-]{11})/, /[?&]v=([A-Za-z0-9_-]{11})/, /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/, /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/, /youtube\.com\/live\/([A-Za-z0-9_-]{11})/];
  for (const re of pats) { const m = s.match(re); if (m) return m[1]; }
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
}
function driveToThumb(url) {
  const m = String(url || '').match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/) || String(url || '').match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([A-Za-z0-9_-]{10,})/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000' : url;
}
function refreshThumb() {
  const box = document.getElementById('fThumbPrev');
  if (!box) return;
  collectRows();
  let src = '';
  if (F.thumb.mode === 'upload' && F.thumb.fileId) src = 'https://drive.google.com/thumbnail?id=' + F.thumb.fileId + '&sz=w800';
  else if (F.thumb.mode === 'url') { const el = document.getElementById('fThumbUrl'); src = driveToThumb(el ? el.value.trim() : F.thumb.url); }
  else if (F.thumb.mode === 'youtube') {
    const first = (F.cat === 'Aplikasi' ? F.pvideos.concat(F.episodes) : F.episodes).filter(e => e.url)[0];
    const id = first ? ytId(first.url) : '';
    src = id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '';
  }
  box.innerHTML = src ? img(src, 'Pratinjau') : 'Belum ada gambar';
}
async function uploadThumbFile(file) {
  const info = document.getElementById('fThumbInfo');
  info.innerHTML = '<span class="spinner-inline"></span> Mengunggah…';
  try {
    const res = await uploadFile('thumb', file);
    if (!res.success) throw new Error(res.message);
    F.thumb.fileId = res.data.fileId; F.thumb.mode = 'upload';
    info.style.color = 'var(--success)'; info.textContent = '✓ ' + res.data.fileName;
    refreshThumb();
  } catch (e) { info.style.color = 'var(--error)'; info.textContent = e.message; }
}
async function uploadDocInto(file, infoId, pid) {
  const info = document.getElementById(infoId);
  info.style.color = 'var(--text-muted)'; info.innerHTML = '<span class="spinner-inline"></span> Mengunggah ' + esc(file.name) + '…';
  try {
    const res = await uploadFile('doc', file, { productId: pid || '' });
    if (!res.success) throw new Error(res.message);
    F.doc = { fileId: res.data.fileId, name: res.data.fileName + ' (' + res.data.fileSize + ')' };
    info.style.color = 'var(--success)'; info.textContent = '✓ ' + F.doc.name;
  } catch (e) { info.style.color = 'var(--error)'; info.textContent = e.message; }
}

// Editor daftar video (episodes / pvideos)
function renderVideoRows(key) {
  const box = document.getElementById(key === 'episodes' ? 'fEpisodes' : 'fPvideos');
  if (!box) return;
  const list = F[key];
  if (!list.length) { box.innerHTML = '<p class="text-[13px] text-muted">Belum ada video.</p>'; return; }
  box.innerHTML = list.map((ep, i) => '<div class="builder-row"><span class="builder-handle">' + (i + 1) + '</span>' +
    '<div class="grid gap-1.5 flex-1 min-w-0"><input class="form-input" data-list="' + key + '" data-i="' + i + '" data-f="title" placeholder="Judul" value="' + esc(ep.title || '') + '">' +
    '<div class="grid grid-cols-[1fr_96px] gap-1.5"><input class="form-input" data-list="' + key + '" data-i="' + i + '" data-f="url" placeholder="https://youtu.be/…" value="' + esc(ep.url || '') + '" oninput="refreshThumb()">' +
    (key === 'episodes' ? '<input class="form-input" data-list="' + key + '" data-i="' + i + '" data-f="duration" placeholder="12:30" value="' + esc(ep.duration || '') + '">' : '<span></span>') + '</div></div>' +
    '<div class="grid gap-1"><button type="button" class="btn-icon" onclick="moveRow(\'' + key + '\',' + i + ',-1)"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>' +
    '<button type="button" class="btn-icon" onclick="moveRow(\'' + key + '\',' + i + ',1)"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>' +
    '<button type="button" class="btn-icon" onclick="removeRow(\'' + key + '\',' + i + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>').join('');
  refreshIcons();
}
function renderResRows() {
  const box = document.getElementById('fResources');
  if (!box) return;
  if (!F.resources.length) { box.innerHTML = '<p class="text-[13px] text-muted">Belum ada materi.</p>'; return; }
  box.innerHTML = F.resources.map((r, i) => {
    const isFile = r.type === 'file';
    return '<div class="builder-row"><span class="builder-handle"><i data-lucide="' + (isFile ? 'file-text' : 'link') + '" class="w-3 h-3"></i></span>' +
      '<div class="grid gap-1.5 flex-1 min-w-0"><input class="form-input" data-list="resources" data-i="' + i + '" data-f="title" placeholder="Judul materi" value="' + esc(r.title || '') + '">' +
      (isFile ? '<div class="flex gap-2 items-center"><button type="button" class="btn-ghost !w-auto !py-1 !px-2 !text-xs" onclick="pickResFile(' + i + ')"><i data-lucide="upload" class="w-3.5 h-3.5"></i> Pilih Berkas</button>' +
        '<span id="resInfo' + i + '" class="text-xs" style="color:' + (r.fileId ? 'var(--success)' : 'var(--text-muted)') + '">' + (r.fileId ? '✓ Berkas tersimpan' : 'Belum ada berkas') + '</span></div>'
              : '<input class="form-input" data-list="resources" data-i="' + i + '" data-f="url" placeholder="https://…" value="' + esc(r.url || '') + '">') + '</div>' +
      '<div class="grid gap-1"><button type="button" class="btn-icon" onclick="moveRow(\'resources\',' + i + ',-1)"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>' +
      '<button type="button" class="btn-icon" onclick="removeRow(\'resources\',' + i + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>';
  }).join('');
  refreshIcons();
}
function renderSlides() {
  const box = document.getElementById('fSlides');
  if (!box) return;
  if (!F.slides.length) { box.innerHTML = '<p class="text-[13px] text-muted">Belum ada slide.</p>'; return; }
  box.innerHTML = F.slides.map((s, i) => {
    const src = s.fileId ? 'https://drive.google.com/thumbnail?id=' + s.fileId + '&sz=w400' : driveToThumb(s.url);
    return '<div class="builder-row"><div class="w-20 h-14 rounded-lg overflow-hidden flex-none bg-surface-2">' + (src ? img(src, '', 'style="width:100%;height:100%;object-fit:cover"') : '') + '</div>' +
      '<div class="grid gap-1.5 flex-1 min-w-0">' + (s.fileId ? '<p class="text-xs" style="color:var(--success)">✓ Gambar terunggah</p>'
        : '<input class="form-input" data-list="slides" data-i="' + i + '" data-f="url" placeholder="https://… URL gambar" value="' + esc(s.url || '') + '" onchange="collectRows();renderSlides()">') +
      '<input class="form-input" data-list="slides" data-i="' + i + '" data-f="caption" placeholder="Keterangan (opsional)" value="' + esc(s.caption || '') + '"></div>' +
      '<div class="grid gap-1"><button type="button" class="btn-icon" onclick="moveRow(\'slides\',' + i + ',-1)"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>' +
      '<button type="button" class="btn-icon" onclick="removeRow(\'slides\',' + i + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>';
  }).join('');
  refreshIcons();
}
function collectRows() {
  document.querySelectorAll('.swal2-popup [data-list]').forEach(el => {
    const list = F[el.dataset.list], i = +el.dataset.i;
    if (list && list[i]) list[i][el.dataset.f] = el.value;
  });
}
function rerender(key) { if (key === 'resources') renderResRows(); else if (key === 'slides') renderSlides(); else renderVideoRows(key); refreshThumb(); }
function addVideo(key) { collectRows(); F[key].push({ id: '', title: '', url: '', duration: '' }); rerender(key); }
function addRes(type) { collectRows(); F.resources.push({ id: '', type: type, title: '', url: '', fileId: '' }); rerender('resources'); }
function removeRow(key, i) { collectRows(); F[key].splice(i, 1); rerender(key); }
function moveRow(key, i, dir) { collectRows(); const j = i + dir; if (j < 0 || j >= F[key].length) return; const t = F[key][i]; F[key][i] = F[key][j]; F[key][j] = t; rerender(key); }
async function addSlide(mode) {
  collectRows();
  if (mode === 'url') { F.slides.push({ id: '', url: '', fileId: '', caption: '' }); return renderSlides(); }
  const file = await pickFile('image/*');
  if (!file) return;
  showToast('Mengunggah', file.name, 'info');
  const res = await uploadFile('thumb', file).catch(e => ({ success: false, message: e.message }));
  if (!res.success) return showToast('Gagal', res.message, 'error');
  collectRows();
  F.slides.push({ id: '', fileId: res.data.fileId, url: '', caption: '' });
  renderSlides();
}
async function pickResFile(i) {
  collectRows();
  const file = await pickFile('.pdf,.doc,.docx,.ppt,.pptx,.md,.txt,.xlsx,.xls,.csv,.zip,.rar');
  if (!file) return;
  const info = document.getElementById('resInfo' + i);
  if (info) info.innerHTML = '<span class="spinner-inline"></span> Mengunggah…';
  const res = await uploadFile('doc', file).catch(e => ({ success: false, message: e.message }));
  if (!res.success) { if (info) { info.style.color = 'var(--error)'; info.textContent = res.message; } return; }
  collectRows();
  F.resources[i].fileId = res.data.fileId;
  if (!F.resources[i].title) F.resources[i].title = file.name;
  renderResRows();
}
