/**
 * ============================================================
 * member.js — Portal Member
 * Beranda (katalog + testimoni + pameran), Kelas Saya, Pesanan,
 * Helpdesk per kategori, Ruang Kelas/Aplikasi, Checkout,
 * Gerbang Kelengkapan Data, Popup Pengumuman.
 * ============================================================
 */

const MEMBER_MENU = [
  { id: 'home', icon: 'layout-grid', label: 'Beranda' },
  { id: 'library', icon: 'graduation-cap', label: 'Kelas Saya' },
  { id: 'orders', icon: 'receipt', label: 'Pesanan' },
  { id: 'helpdesk', icon: 'life-buoy', label: 'Helpdesk' }
];

const Member = {
  _loading: null,
  _lastFetch: 0,

  /** Bootstrap 1 panggilan: tampil dari cache dulu, lalu segarkan di latar. */
  refresh() {
    if (this._loading) return this._loading;
    this._loading = swr(userKey('boot'), 'memberBootstrap', {}, (d, fromCache) => {
      AppState.m = d;
      rememberBrand(d.settings);
      if (!fromCache) Member._lastFetch = Date.now();
      Member.renderMounted();
      if (!fromCache) Member.showAnnouncements();
    }).finally(() => { this._loading = null; });
    return this._loading;
  },

  /** Render ulang halaman member yang sudah pernah dibuka. */
  renderMounted() {
    renderTopnav();
    if (document.getElementById('homeRoot')) renderHome();
    if (document.getElementById('libraryRoot')) renderLibrary();
    if (document.getElementById('ordersRoot')) renderOrders();
    if (document.getElementById('helpRoot')) renderHelpdesk();
  },

  /** Segarkan diam-diam bila data sudah > 60 detik (dipanggil saat pindah halaman). */
  softRefresh() { if (Date.now() - this._lastFetch > 60000) this.refresh(); },

  profile() { return (AppState.m && AppState.m.profile) || { complete: false }; },

  showAnnouncements() {
    const list = (AppState.m && AppState.m.announcements) || [];
    const seenOnce = Store.get(userKey('annSeen'), []);
    let seenSession = [];
    try { seenSession = JSON.parse(sessionStorage.getItem('dph3:annSession') || '[]'); } catch (e) { /* */ }
    const queue = list.filter(a => a.showMode === 'every' ? seenSession.indexOf(a.id) === -1 : seenOnce.indexOf(a.id) === -1);
    const next = () => {
      const a = queue.shift();
      if (!a) return;
      if (a.showMode === 'every') { seenSession.push(a.id); try { sessionStorage.setItem('dph3:annSession', JSON.stringify(seenSession)); } catch (e) { /* */ } }
      else { seenOnce.push(a.id); Store.set(userKey('annSeen'), seenOnce); }
      Swal.fire({
        width: 560, showCloseButton: true, showConfirmButton: !!(a.ctaUrl && a.ctaLabel), confirmButtonText: a.ctaLabel || 'OK',
        showCancelButton: true, cancelButtonText: 'Tutup',
        html: '<div style="text-align:left">' +
          '<span class="badge badge-warning mb-3"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i> Pengumuman</span>' +
          (a.image ? '<div class="rounded-xl overflow-hidden mb-4">' + img(a.image, a.title, 'style="width:100%"') + '</div>' : '') +
          '<h3 class="text-xl font-bold text-main">' + esc(a.title) + '</h3>' +
          '<p class="mt-2 text-[15px] text-muted whitespace-pre-line">' + esc(a.body) + '</p></div>',
        didOpen: refreshIcons
      }).then(r => { if (r.isConfirmed && a.ctaUrl) openLink(a.ctaUrl); setTimeout(next, 250); });
    };
    next();
  }
};


// ════════════════════════════════════════════════════════════
// TOPNAV MEMBER
// ════════════════════════════════════════════════════════════
function renderTopnav() {
  const nav = document.getElementById('topnav');
  if (!nav || nav.hidden) return;
  const s = (AppState.m && AppState.m.settings) || {};
  const pending = ((AppState.m && AppState.m.orders) || []).filter(o => o.Status === 'Pending').length;
  const links = MEMBER_MENU.map(m => '<button type="button" class="topnav-link" data-nav="' + m.id + '" onclick="go(\'' + m.id + '\')">' +
    '<i data-lucide="' + m.icon + '" class="w-4 h-4 inline -mt-0.5 mr-1"></i>' + m.label +
    (m.id === 'orders' ? '<span class="nav-badge" data-badge="orders"' + (pending ? '' : ' hidden') + '>' + pending + '</span>' : '') + '</button>').join('');
  document.getElementById('topnavBrand').innerHTML = brandLogoHtml(30) + '<span class="truncate">' + esc(s.appName || Store.get('brandName', '') || 'Digital Product Hub') + '</span>';
  document.getElementById('topnavMenu').innerHTML = links;
  document.getElementById('topnavMobile').innerHTML = links;
  const p = Member.profile();
  document.getElementById('avatar').textContent = initial(p.nickname || AppState.email);
  document.getElementById('avatar').title = (p.nickname || '') + ' · ' + (AppState.email || '');
  updateActiveNav(AppState.currentPage);
  refreshIcons();
}


// ════════════════════════════════════════════════════════════
// BERANDA (Katalog + Testimoni + Pameran Karya)
// ════════════════════════════════════════════════════════════
registerPage('home', {
  title: 'Beranda',
  template: () => '<div class="page-wrap" id="homeRoot"><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">' + skeletonCards(8) + '</div></div>',
  show: () => { if (AppState.m) renderHome(); Member.softRefresh(); }
});

function renderHome() {
  const root = document.getElementById('homeRoot');
  if (!root || !AppState.m) return;
  const d = AppState.m, s = d.settings || {}, prof = d.profile || {};
  const cats = ['Kelas', 'Aplikasi', 'Document', 'AI Link'].filter(c => d.catalog.some(p => p.Category === c));
  const f = AppState.catalogFilter;

  const banners =
    (!prof.complete ? '<div class="notice notice-warning mb-6"><i data-lucide="user-round-pen" class="w-5 h-5 flex-none"></i>' +
      '<div class="flex-1 min-w-0"><p class="font-semibold">Lengkapi data Anda</p><p class="text-sm opacity-90">Nama panggilan & No. WhatsApp wajib diisi sebelum membuka materi kelas.</p></div>' +
      '<button class="btn-primary !w-auto" onclick="openProfileDialog()">Lengkapi</button></div>' : '') +
    (s.testimoniUrl ? '<div class="testi-band mb-8"><div class="flex items-center gap-3 min-w-0"><div class="testi-icon"><i data-lucide="star" class="w-5 h-5"></i></div>' +
      '<div class="min-w-0"><p class="font-semibold text-main">Testimoni Member</p><p class="text-sm text-muted">Lihat pengalaman & hasil para member kami.</p></div></div>' +
      '<button class="btn-primary !w-auto" onclick="openLink(' + jsArg(s.testimoniUrl) + ')"><i data-lucide="external-link" class="w-4 h-4"></i> ' + esc(s.testimoniLabel || 'Lihat Testimoni') + '</button></div>' : '');

  const list = d.catalog.filter(p => f === 'all' || p.Category === f);
  const chips = '<div class="flex gap-2 overflow-x-auto pb-1">' +
    [['all', 'Semua']].concat(cats.map(c => [c, catLabel(c)])).map(c =>
      '<button class="chip' + (f === c[0] ? ' chip-active' : '') + '" onclick="AppState.catalogFilter=' + jsArg(c[0]) + ';renderHome()">' + esc(c[1]) + '</button>').join('') + '</div>';

  const show = (d.showcase || []);
  root.innerHTML = banners +
    '<div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">' +
      '<div><h1 class="page-title">Katalog</h1><p class="page-sub">Halo ' + esc(prof.nickname || AppState.email) + ' 👋 — pilih kelas & aplikasi Anda.</p></div>' + chips + '</div>' +
    (list.length ? '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">' + list.map(productCardHtml).join('') + '</div>'
                 : emptyState('package-open', 'Belum ada produk', 'Produk untuk kategori ini belum tersedia.')) +
    (show.length ? '<div class="mt-14">' + sectionHead('trophy', 'Pameran Karya Member', 'Karya terbaik para member — jadikan inspirasi!') +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">' + show.map(showcaseCard).join('') + '</div></div>' : '');
  refreshIcons();
}

function productCardHtml(p) {
  const locked = !p.owned;
  let meta = '';
  if (p.Category === 'Kelas' && p.episodeCount) meta = '<span class="inline-flex items-center gap-1"><i data-lucide="list-video" class="w-3.5 h-3.5"></i> ' + p.episodeCount + ' episode</span>';
  if (p.Category === 'Aplikasi') { const n = (p.slides || []).length + (p.previewVideos || []).length; if (n) meta = '<span class="inline-flex items-center gap-1"><i data-lucide="images" class="w-3.5 h-3.5"></i> ' + n + ' preview</span>'; }
  if (p.resourceCount) meta += '<span class="inline-flex items-center gap-1 ml-3"><i data-lucide="paperclip" class="w-3.5 h-3.5"></i> ' + p.resourceCount + ' materi</span>';

  let cta;
  if (!locked) cta = '<button class="btn-primary w-full mt-4" onclick="go(\'product\',' + jsArg(p.Product_ID) + ')"><i data-lucide="' + iconFor(p.Category) + '" class="w-4 h-4"></i> ' + (p.Category === 'Kelas' ? 'Masuk Kelas' : 'Akses Produk') + '</button>';
  else if (p.pending) cta = '<button class="btn-ghost w-full mt-4" onclick="go(\'orders\')"><i data-lucide="clock" class="w-4 h-4"></i> Menunggu Verifikasi</button>';
  else if (p.Category === 'Aplikasi') cta = '<div class="grid grid-cols-2 gap-2 mt-4"><button class="btn-ghost" onclick="openAppPreview(' + jsArg(p.Product_ID) + ')"><i data-lucide="eye" class="w-4 h-4"></i> Preview</button>' +
    '<button class="btn-primary" onclick="openBuyDialog(' + jsArg(p.Product_ID) + ')"><i data-lucide="shopping-cart" class="w-4 h-4"></i> Beli</button></div>';
  else cta = '<button class="btn-ghost w-full mt-4" onclick="openBuyDialog(' + jsArg(p.Product_ID) + ')"><i data-lucide="shopping-cart" class="w-4 h-4"></i> Beli / Redeem Kode</button>';

  const clickThumb = !locked ? 'go(\'product\',' + jsArg(p.Product_ID) + ')' : (p.Category === 'Aplikasi' ? 'openAppPreview(' + jsArg(p.Product_ID) + ')' : '');
  return '<article class="product-card' + (locked ? ' is-locked' : '') + '">' +
    '<div class="product-thumb' + (clickThumb ? ' cursor-pointer' : '') + '"' + (clickThumb ? ' onclick="' + clickThumb + '"' : '') + '>' + img(p.thumbnail, p.Title, '', catLabel(p.Category)) +
      (locked ? '<div class="lock-overlay"><div class="lock-badge"><i data-lucide="' + (p.pending ? 'clock' : 'lock') + '" class="w-6 h-6"></i></div></div>'
              : '<span class="owned-badge"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Dimiliki</span>') +
    '</div>' +
    '<div class="p-5 flex flex-col flex-1">' +
      '<div class="flex items-center justify-between gap-2"><span class="badge ' + badgeClassFor(p.Category) + '">' + esc(catLabel(p.Category)) + '</span>' +
      (locked ? '<span class="text-sm font-bold text-accent">' + esc(fmtMoney(p.Price)) + '</span>' : '') + '</div>' +
      '<h3 class="mt-3 text-[17px] font-semibold leading-snug text-main line-clamp-2">' + esc(p.Title) + '</h3>' +
      '<p class="mt-2 text-sm text-muted line-clamp-2 flex-1">' + esc(p.Tagline || p.Description) + '</p>' +
      (meta ? '<p class="mt-3 text-xs text-muted flex items-center flex-wrap">' + meta + '</p>' : '') + cta +
    '</div></article>';
}


// ════════════════════════════════════════════════════════════
// KELAS SAYA (pustaka) & PESANAN
// ════════════════════════════════════════════════════════════
registerPage('library', {
  title: 'Kelas Saya',
  template: () => '<div class="page-wrap" id="libraryRoot"><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">' + skeletonCards(4) + '</div></div>',
  show: () => { if (AppState.m) renderLibrary(); Member.softRefresh(); }
});

function renderLibrary() {
  const root = document.getElementById('libraryRoot');
  if (!root || !AppState.m) return;
  const owned = AppState.m.catalog.filter(p => p.owned);
  root.innerHTML = '<div class="mb-6"><h1 class="page-title">Kelas Saya</h1><p class="page-sub">Semua kelas & aplikasi yang sudah Anda miliki.</p></div>' +
    (owned.length ? '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">' + owned.map(productCardHtml).join('') + '</div>'
      : emptyState('library', 'Belum ada kelas', 'Beli produk atau redeem kode akses dari Lynk.id untuk mulai belajar.') +
        '<div class="flex justify-center gap-3 mt-4"><button class="btn-primary !w-auto" onclick="openRedeemDialog()"><i data-lucide="key-round" class="w-4 h-4"></i> Redeem Kode</button>' +
        '<button class="btn-ghost !w-auto" onclick="go(\'home\')">Lihat Katalog</button></div>');
  refreshIcons();
}

registerPage('orders', {
  title: 'Pesanan Saya',
  template: () => '<div class="page-wrap" id="ordersRoot">' + skeletonRows(4) + '</div>',
  show: () => { if (AppState.m) renderOrders(); Member.softRefresh(); }
});

function renderOrders() {
  const root = document.getElementById('ordersRoot');
  if (!root || !AppState.m) return;
  const orders = AppState.m.orders || [], s = AppState.m.settings || {};
  const st = { Pending: ['is-pending', 'badge-warning', 'Menunggu Verifikasi', 'clock'], Approved: ['is-approved', 'badge-success', 'Disetujui', 'check-circle-2'], Rejected: ['is-rejected', 'badge-error', 'Ditolak', 'x-circle'] };
  root.innerHTML = '<div class="flex flex-wrap items-end justify-between gap-3 mb-6"><div><h1 class="page-title">Pesanan Saya</h1><p class="page-sub">Riwayat pembelian & status verifikasi.</p></div>' +
    (s.adminWhatsApp || s.adminEmail ? '<button class="btn-ghost !w-auto" onclick="contactAdmin(\'Pertanyaan pesanan\')"><i data-lucide="life-buoy" class="w-4 h-4"></i> Hubungi Admin</button>' : '') + '</div>' +
    (orders.length ? '<div class="space-y-4">' + orders.map(o => {
      const x = st[o.Status] || st.Pending;
      return '<div class="order-card ' + x[0] + '">' +
        '<div class="flex-1 min-w-[200px]"><p class="mono text-xs text-muted">' + esc(o.Order_ID) + '</p>' +
        '<p class="mt-1 font-semibold text-main">' + esc(o.Product) + '</p>' +
        '<p class="text-sm text-muted mt-1">' + esc(fmtMoney(o.Amount)) + ' · ' + esc(o.Channel) + ' · ' + esc(fmtDateTime(o.Created_At)) + '</p>' +
        (o.Status === 'Rejected' && o.Note ? '<p class="text-sm mt-2" style="color:var(--error)">Alasan: ' + esc(o.Note) + '</p>' : '') + '</div>' +
        '<span class="badge ' + x[1] + '"><i data-lucide="' + x[3] + '" class="w-3.5 h-3.5"></i> ' + x[2] + '</span>' +
        '<div class="flex gap-2">' +
          (o.proofUrl ? '<button class="btn-icon" title="Bukti transfer" onclick="previewDocument(' + jsArg(o.proofUrl) + ',\'\',\'Bukti Transfer\')"><i data-lucide="image" class="w-4 h-4"></i></button>' : '') +
          (o.Status === 'Approved' ? '<button class="btn-primary !w-auto !py-2" onclick="go(\'product\',' + jsArg(o.Product_ID) + ')">Buka</button>' : '') +
          (o.Status === 'Rejected' ? '<button class="btn-primary !w-auto !py-2" onclick="startCheckout(' + jsArg(o.Product_ID) + ')">Ajukan Ulang</button>' : '') +
        '</div></div>';
    }).join('') + '</div>'
      : emptyState('receipt', 'Belum ada pesanan', 'Pesanan pembelian Anda akan tampil di sini.'));
  refreshIcons();
}

function contactAdmin(topic) {
  const s = (AppState.m && AppState.m.settings) || {};
  const p = Member.profile();
  const text = 'Halo Admin, saya ' + (p.nickname || '') + ' (' + AppState.email + '). ' + (topic || '');
  if (s.adminWhatsApp) openLink(waLink(s.adminWhatsApp, text));
  else if (s.adminEmail) location.href = 'mailto:' + s.adminEmail + '?subject=' + encodeURIComponent(topic || 'Bantuan') + '&body=' + encodeURIComponent(text);
}


// ════════════════════════════════════════════════════════════
// HELPDESK (dikelompokkan per kategori master)
// ════════════════════════════════════════════════════════════
const Help = { cat: 'all', q: '' };

registerPage('helpdesk', {
  title: 'Helpdesk',
  template: () => '<div class="page-wrap" id="helpRoot">' + skeletonRows(6) + '</div>',
  show: () => { if (AppState.m) renderHelpdesk(); Member.softRefresh(); }
});

function renderHelpdesk() {
  const root = document.getElementById('helpRoot');
  if (!root || !AppState.m) return;
  const h = AppState.m.helpdesk || { articles: [], categories: [] };
  const count = c => h.articles.filter(a => a.Category === c).length;
  const cats = h.categories.filter(c => count(c.name));
  root.innerHTML =
    '<div class="mb-6"><h1 class="page-title">Helpdesk</h1><p class="page-sub">Temukan solusi berdasarkan kategori kendala.</p></div>' +
    '<div class="relative mb-6"><i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted"></i>' +
      '<input id="helpSearch" class="form-input !pl-9" placeholder="Cari kendala, mis. &quot;video tidak muncul&quot;" value="' + esc(Help.q) + '"></div>' +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">' +
      '<button class="help-cat' + (Help.cat === 'all' ? ' is-active' : '') + '" onclick="Help.cat=\'all\';renderHelpList()"><i data-lucide="layers" class="w-5 h-5"></i><span><b>Semua</b><small>' + h.articles.length + ' artikel</small></span></button>' +
      cats.map(c => '<button class="help-cat' + (Help.cat === c.name ? ' is-active' : '') + '" data-cat="' + esc(c.name) + '" onclick="Help.cat=' + jsArg(c.name) + ';renderHelpList()">' +
        '<i data-lucide="' + esc(c.icon) + '" class="w-5 h-5"></i><span><b>' + esc(c.name) + '</b><small>' + count(c.name) + ' artikel</small></span></button>').join('') +
    '</div><div id="helpList"></div>' +
    '<div class="notice mt-8"><i data-lucide="message-circle" class="w-5 h-5 flex-none"></i><div class="flex-1"><p class="font-semibold">Belum menemukan solusi?</p><p class="text-sm opacity-90">Hubungi Admin, sebutkan kategori kendala Anda.</p></div>' +
      '<button class="btn-primary !w-auto" onclick="contactAdmin(\'Kendala: \' + (Help.cat===\'all\'?\'Umum\':Help.cat))">Hubungi Admin</button></div>';
  document.getElementById('helpSearch').addEventListener('input', debounce(e => { Help.q = e.target.value; renderHelpList(); }, 200));
  renderHelpList();
}

function renderHelpList() {
  const box = document.getElementById('helpList');
  if (!box) return;
  document.querySelectorAll('.help-cat').forEach(b => b.classList.toggle('is-active', (b.dataset.cat || 'all') === Help.cat));
  const q = Help.q.trim().toLowerCase();
  const list = ((AppState.m.helpdesk || {}).articles || []).filter(a =>
    (Help.cat === 'all' || a.Category === Help.cat) && (!q || (a.Question + ' ' + a.Solution).toLowerCase().indexOf(q) > -1));
  box.innerHTML = list.length ? '<div class="space-y-3">' + list.map(a =>
    '<details class="help-item app-card rounded-2xl"><summary><span class="badge badge-document">' + esc(a.Category) + '</span><span class="flex-1 font-semibold text-main">' + esc(a.Question) + '</span><i data-lucide="chevron-down" class="w-4 h-4 chev"></i></summary>' +
    '<div class="help-body"><p class="whitespace-pre-line text-[15px] leading-relaxed text-muted">' + esc(a.Solution) + '</p>' +
      (a.Image_URL ? '<div class="mt-4 rounded-xl overflow-hidden cursor-zoom-in max-w-xl" onclick="previewImage(' + jsArg(a.Image_URL) + ',' + jsArg(a.Question) + ')">' + img(a.Image_URL, a.Question, 'style="width:100%"') + '</div>' : '') +
      (a.Video_Embed ? '<div class="video-frame mt-4 max-w-2xl"><iframe src="' + esc(a.Video_Embed) + '" loading="lazy" allowfullscreen></iframe></div>' : '') +
    '</div></details>').join('') + '</div>'
    : emptyState('search-x', 'Tidak ada artikel', 'Coba kata kunci atau kategori lain.');
  refreshIcons();
}


// ════════════════════════════════════════════════════════════
// RUANG PRODUK (#/product/ID) — Kelas · Aplikasi · Dokumen · AI Link
// ════════════════════════════════════════════════════════════
registerPage('product', {
  title: 'Ruang Belajar',
  template: () => '<div class="page-wrap"><button class="text-sm text-muted hover:text-main inline-flex items-center gap-1 mb-4" onclick="history.length>1?history.back():go(\'library\')"><i data-lucide="arrow-left" class="w-4 h-4"></i> Kembali</button>' +
    '<div id="detailRoot" class="grid lg:grid-cols-3 gap-6"></div></div>',
  show: (el, id) => openDetail(id)
});

async function openDetail(id) {
  const box = document.getElementById('detailRoot');
  if (!id) return go('library');
  AppState.detailId = id;
  AppState.episode = 0;
  const cached = AppState.detail[id];
  if (cached) renderDetail(cached);
  else {
    const sum = AppState.m && AppState.m.catalog.filter(p => p.Product_ID === id)[0];
    box.innerHTML = '<div class="lg:col-span-2 space-y-6"><div class="skeleton" style="aspect-ratio:16/9"></div><div class="skeleton h-28"></div></div><div class="skeleton h-80"></div>';
    if (sum) document.title = sum.Title + ' · ' + appTitle();
  }
  const res = await api('productDetail', { productId: id });
  if (AppState.detailId !== id) return;                       // pengguna sudah pindah halaman
  if (!res.success) { if (!cached) box.innerHTML = '<div class="lg:col-span-3">' + emptyState('alert-circle', 'Tidak dapat dibuka', res.message) + '</div>'; refreshIcons(); return; }
  AppState.detail[id] = res.data;
  renderDetail(res.data);
}

function renderDetail(p) {
  const box = document.getElementById('detailRoot');
  if (!box) return;
  document.title = p.Title + ' · ' + appTitle();

  if (!p.owned) {
    box.innerHTML = '<div class="lg:col-span-3 space-y-6">' +
      (p.Category === 'Aplikasi' ? '<div class="app-card rounded-2xl p-5">' + appPreviewHtml(p) + '</div>' : '') +
      '<div class="app-card rounded-2xl p-8 text-center"><div class="lock-badge mx-auto"><i data-lucide="lock" class="w-6 h-6"></i></div>' +
      '<h1 class="mt-4 text-2xl font-bold text-main">' + esc(p.Title) + '</h1><p class="mt-2 text-muted max-w-xl mx-auto whitespace-pre-line">' + esc(p.Description) + '</p>' +
      '<p class="mt-3 text-lg font-bold text-accent">' + esc(fmtMoney(p.Price)) + '</p>' +
      '<div class="flex flex-wrap justify-center gap-3 mt-5"><button class="btn-primary !w-auto" onclick="openBuyDialog(' + jsArg(p.Product_ID) + ')"><i data-lucide="shopping-cart" class="w-4 h-4"></i> Beli / Redeem Kode</button></div></div></div>';
    initCarousel(box.querySelector('.carousel'));
    refreshIcons(); return;
  }

  if (p.needProfile) {
    box.innerHTML = '<div class="lg:col-span-3"><div class="app-card rounded-2xl p-8 text-center max-w-xl mx-auto">' +
      '<div class="w-16 h-16 mx-auto rounded-2xl grid place-items-center" style="background:rgba(245,158,11,.14);color:var(--warning)"><i data-lucide="user-round-pen" class="w-8 h-8"></i></div>' +
      '<h1 class="mt-4 text-xl font-bold text-main">Lengkapi data dulu, ya</h1>' +
      '<p class="mt-2 text-sm text-muted">Untuk membuka <b>' + esc(p.Title) + '</b>, isi <b>Nama Panggilan</b> dan <b>No. WhatsApp</b> Anda. Data ini dipakai Admin untuk info kelas & grup diskusi.</p>' +
      '<button class="btn-primary !w-auto mt-6" onclick="openProfileDialog(' + jsArg(p.Product_ID) + ')"><i data-lucide="user-check" class="w-4 h-4"></i> Lengkapi Sekarang</button></div></div>';
    refreshIcons();
    openProfileDialog(p.Product_ID);
    return;
  }

  if (p.Category === 'Kelas') return renderClassRoom(p);
  if (p.Category === 'Aplikasi') return renderAppRoom(p);
  renderDocOrLink(p);
}

/** Tombol materi: link TIDAK pernah ditampilkan — hanya tombol "Buka Materi". */
function resourcesHtml(res) {
  if (!res.length) return '<p class="text-sm text-muted">Belum ada materi penunjang.</p>';
  window._res = res;
  return res.map((r, i) => {
    const isFile = r.type === 'file';
    return '<div class="resource-row"><div class="resource-icon"><i data-lucide="' + (isFile ? 'file-text' : 'link-2') + '" class="w-4 h-4"></i></div>' +
      '<div class="min-w-0 flex-1"><p class="text-sm font-medium text-main truncate">' + esc(r.title) + '</p>' +
      '<p class="text-xs text-muted truncate">' + (isFile ? esc((r.fileName || 'Dokumen') + (r.fileSize ? ' · ' + r.fileSize : '')) : 'Tautan materi') + '</p></div>' +
      (isFile
        ? '<div class="flex gap-1.5"><button class="btn-icon" title="Pratinjau" onclick="previewDocument(_res[' + i + '].previewUrl,_res[' + i + '].url,_res[' + i + '].title)"><i data-lucide="eye" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon" title="Unduh" onclick="openLink(_res[' + i + '].url)"><i data-lucide="download" class="w-4 h-4"></i></button></div>'
        : '<button class="btn-primary !w-auto !py-1.5 !px-3 !text-xs" onclick="openLink(_res[' + i + '].url)"><i data-lucide="external-link" class="w-3.5 h-3.5"></i> Buka Materi</button>') +
      '</div>';
  }).join('');
}

function waGroupCard(p) {
  if (!p.waGroupUrl) return '';
  return '<div class="wa-banner"><div class="wa-icon"><i data-lucide="message-circle" class="w-5 h-5"></i></div>' +
    '<div class="flex-1 min-w-0"><p class="font-semibold text-main">Grup Diskusi Kelas</p><p class="text-sm text-muted">Khusus peserta ' + esc(p.Title) + '.</p></div>' +
    '<button class="btn-wa" onclick="openLink(AppState.detail[' + jsArg(p.Product_ID) + '].waGroupUrl)"><i data-lucide="users" class="w-4 h-4"></i> Gabung WhatsApp Group</button></div>';
}

function playlistHtml(eps, idx) {
  return eps.map((ep, i) => '<button type="button" class="episode-row' + (i === idx ? ' is-playing' : '') + '" onclick="playEpisode(' + i + ')">' +
    '<span class="episode-num">' + (i === idx ? '<i data-lucide="play" class="w-3 h-3"></i>' : (i + 1)) + '</span>' +
    '<span class="min-w-0 flex-1"><span class="episode-title block truncate">' + esc(ep.title) + '</span>' +
    '<span class="episode-meta block">' + (ep.duration ? esc(ep.duration) : 'Episode ' + (i + 1)) + (i === idx ? ' • Sedang diputar' : '') + '</span></span></button>').join('');
}

function renderClassRoom(p) {
  const box = document.getElementById('detailRoot');
  const eps = p.episodes || [];
  const idx = Math.min(AppState.episode || 0, Math.max(eps.length - 1, 0));
  const cur = eps[idx];
  box.innerHTML =
    '<div class="lg:col-span-2 space-y-6">' +
      (cur ? '<div class="app-card rounded-2xl overflow-hidden"><div class="video-frame !rounded-none"><iframe id="epFrame" src="' + esc(cur.url) + '" title="' + esc(cur.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe></div></div>'
           : emptyState('video-off', 'Belum ada episode', 'Admin belum menambahkan episode.')) +
      '<div class="app-card rounded-2xl p-6"><div class="flex flex-wrap items-center justify-between gap-3"><div class="min-w-0">' +
        (cur ? '<span class="badge badge-video">Episode ' + (idx + 1) + ' dari ' + eps.length + '</span><h1 class="mt-2 text-xl font-bold tracking-tight text-main">' + esc(cur.title) + '</h1>' : '<h1 class="text-xl font-bold text-main">' + esc(p.Title) + '</h1>') +
        '</div>' + (eps.length > 1 ? '<div class="flex gap-2"><button class="btn-ghost !w-auto" onclick="playEpisode(' + (idx - 1) + ')"' + (idx === 0 ? ' disabled' : '') + '><i data-lucide="skip-back" class="w-4 h-4"></i> Prev</button>' +
        '<button class="btn-primary !w-auto" onclick="playEpisode(' + (idx + 1) + ')"' + (idx >= eps.length - 1 ? ' disabled' : '') + '>Next <i data-lucide="skip-forward" class="w-4 h-4"></i></button></div>' : '') + '</div>' +
        '<p class="mt-4 text-[15px] leading-relaxed text-muted whitespace-pre-line">' + esc(p.Description) + '</p></div>' +
      waGroupCard(p) +
      '<div class="app-card rounded-2xl p-6"><div class="flex items-center gap-2 mb-4"><i data-lucide="folder-open" class="w-5 h-5 text-accent"></i><h2 class="text-lg font-semibold text-main">Materi Penunjang</h2></div>' +
        '<div class="space-y-3">' + resourcesHtml(p.resources || []) + '</div></div>' +
    '</div>' +
    '<div class="lg:col-span-1"><div class="app-card rounded-2xl p-5 lg:sticky lg:top-24">' +
      '<div class="flex items-center justify-between mb-1"><h2 class="text-base font-semibold text-main">Daftar Episode</h2><span class="badge badge-document">' + eps.length + '</span></div>' +
      '<p class="text-xs text-muted mb-3">' + esc(p.Title) + '</p><div class="playlist space-y-1">' + playlistHtml(eps, idx) + '</div></div></div>';
  refreshIcons();
}

function playEpisode(i) {
  const p = AppState.detail[AppState.detailId];
  if (!p || i < 0 || i >= (p.episodes || []).length) return;
  AppState.episode = i;
  if (p.Category === 'Aplikasi') renderAppRoom(p); else renderClassRoom(p);
  const f = document.getElementById('epFrame');
  if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderAppRoom(p) {
  const box = document.getElementById('detailRoot');
  const eps = p.episodes || [];
  const idx = Math.min(AppState.episode || 0, Math.max(eps.length - 1, 0));
  const cur = eps[idx];
  box.innerHTML =
    '<div class="lg:col-span-2 space-y-6">' +
      '<div class="app-card rounded-2xl p-6"><span class="badge badge-app">Aplikasi</span>' +
        '<h1 class="mt-3 text-2xl font-bold tracking-tight text-main">' + esc(p.Title) + '</h1>' +
        '<p class="mt-3 text-[15px] leading-relaxed text-muted whitespace-pre-line">' + esc(p.Description) + '</p></div>' +
      (cur ? '<div class="app-card rounded-2xl overflow-hidden"><div class="px-5 pt-5 pb-3 flex items-center gap-2"><i data-lucide="monitor-play" class="w-5 h-5 text-accent"></i><h2 class="font-semibold text-main">Video Panduan Instalasi</h2></div>' +
        '<div class="video-frame !rounded-none"><iframe id="epFrame" src="' + esc(cur.url) + '" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
        (eps.length > 1 ? '<div class="p-4 playlist space-y-1">' + playlistHtml(eps, idx) + '</div>' : '<p class="p-4 text-sm font-medium text-main">' + esc(cur.title) + '</p>') + '</div>' : '') +
      '<div class="app-card rounded-2xl p-6"><div class="flex items-center gap-2 mb-4"><i data-lucide="folder-open" class="w-5 h-5 text-accent"></i><h2 class="text-lg font-semibold text-main">Dokumen & Materi</h2></div>' +
        '<div class="space-y-3">' + resourcesHtml(p.resources || []) + '</div></div>' +
      ((p.slides || []).length || (p.previewVideos || []).length ? '<div class="app-card rounded-2xl p-5"><h2 class="font-semibold text-main mb-3">Preview Aplikasi</h2>' + appPreviewHtml(p) + '</div>' : '') +
    '</div>' +
    '<div class="lg:col-span-1 space-y-4"><div class="app-card rounded-2xl p-6 space-y-4 lg:sticky lg:top-24">' +
      (p.fileUrl ? '<button class="btn-primary w-full" onclick="openLink(AppState.detail[' + jsArg(p.Product_ID) + '].fileUrl)"><i data-lucide="download" class="w-4 h-4"></i> Download Source Code</button>' +
        '<div><p class="stat-label mb-2">Detail Berkas</p>' + detailRow('file-archive', 'Nama', p.fileName || '—') + detailRow('hard-drive', 'Ukuran', p.fileSize || '—') + detailRow('history', 'Diperbarui', fmtDate(p.updatedAt)) + '</div>'
        : '<p class="text-sm text-muted">Source code akan tersedia di sini setelah diunggah Admin.</p>') +
      '</div>' + waGroupCard(p) + '</div>';
  initCarousel(box.querySelector('.carousel'));
  refreshIcons();
}

function renderDocOrLink(p) {
  const box = document.getElementById('detailRoot');
  const isDoc = p.Category === 'Document';
  const media = isDoc
    ? '<div class="app-card rounded-2xl overflow-hidden"><div class="relative" style="aspect-ratio:16/9;background:var(--surface-2)">' + (p.thumbnail ? img(p.thumbnail, '', 'style="width:100%;height:100%;object-fit:cover;opacity:.5"') : '') +
      '<div class="absolute inset-0 grid place-items-center">' + (p.fileUrl ? '<button class="btn-primary !w-auto" onclick="previewDocument(AppState.detail[' + jsArg(p.Product_ID) + '].previewUrl,AppState.detail[' + jsArg(p.Product_ID) + '].fileUrl,' + jsArg(p.fileName || p.Title) + ')"><i data-lucide="eye" class="w-4 h-4"></i> Pratinjau Dokumen</button>' : '<p class="text-sm text-muted">Berkas belum diunggah Admin.</p>') + '</div></div></div>'
    : '<div class="app-card rounded-2xl p-10 text-center"><div class="w-16 h-16 mx-auto rounded-2xl grid place-items-center" style="background:var(--indigo-soft);color:var(--indigo)"><i data-lucide="sparkles" class="w-8 h-8"></i></div>' +
      '<h3 class="mt-4 text-lg font-semibold text-main">Akses Link AI</h3><p class="mt-2 text-sm text-muted">Tautan terbuka di tab baru.</p>' +
      (p.externalLink ? '<button class="btn-primary !w-auto mt-6" onclick="openLink(AppState.detail[' + jsArg(p.Product_ID) + '].externalLink)"><i data-lucide="external-link" class="w-4 h-4"></i> Buka Sekarang</button>' : '<p class="mt-6 text-sm" style="color:var(--warning)">Link belum diisi Admin.</p>') + '</div>';
  const side = isDoc && p.fileUrl
    ? '<button class="btn-primary w-full" onclick="openLink(AppState.detail[' + jsArg(p.Product_ID) + '].fileUrl)"><i data-lucide="download" class="w-4 h-4"></i> Download Dokumen</button>' +
      '<div class="pt-2"><p class="stat-label mb-3">Detail Berkas</p>' + detailRow('file-text', 'Nama', p.fileName || '—') + detailRow('hard-drive', 'Ukuran', p.fileSize || '—') + detailRow('history', 'Diperbarui', fmtDate(p.updatedAt)) + '</div>'
    : '<p class="stat-label mb-1">Informasi</p>' + detailRow('tag', 'Kategori', catLabel(p.Category)) + detailRow('check-circle-2', 'Status', 'Sudah dimiliki');
  box.innerHTML = '<div class="lg:col-span-2 space-y-6">' + media + '<div class="app-card rounded-2xl p-6"><span class="badge ' + badgeClassFor(p.Category) + '">' + esc(catLabel(p.Category)) + '</span>' +
    '<h1 class="mt-3 text-2xl font-bold tracking-tight text-main">' + esc(p.Title) + '</h1><p class="mt-3 text-[15px] leading-relaxed text-muted whitespace-pre-line">' + esc(p.Description) + '</p></div></div>' +
    '<div class="lg:col-span-1"><div class="app-card rounded-2xl p-6 space-y-4">' + side + '</div></div>';
  refreshIcons();
}

function detailRow(icon, label, value) {
  return '<div class="flex items-start gap-3 py-2.5 border-t border-app first:border-t-0"><i data-lucide="' + esc(icon) + '" class="w-4 h-4 mt-0.5 text-muted"></i>' +
    '<div class="min-w-0"><p class="text-xs text-muted">' + esc(label) + '</p><p class="text-sm font-medium text-main break-words">' + esc(value) + '</p></div></div>';
}


// ════════════════════════════════════════════════════════════
// GERBANG KELENGKAPAN DATA (Nama panggilan + WA 08xx unik)
// ════════════════════════════════════════════════════════════
async function openProfileDialog(productId) {
  const p = Member.profile();
  const r = await Swal.fire({
    title: 'Lengkapi Data Member', confirmButtonText: 'Simpan & Buka Akses', showCancelButton: !!p.complete || !productId, cancelButtonText: 'Nanti',
    allowOutsideClick: false, focusConfirm: false,
    html: '<div style="text-align:left;display:grid;gap:12px">' +
      '<p class="text-sm text-muted">Data wajib diisi dengan benar. Satu nomor WhatsApp hanya untuk satu akun.</p>' +
      '<div><label class="form-label">Email</label><input class="form-input" value="' + esc(AppState.email) + '" disabled></div>' +
      '<div><label class="form-label" for="pfNick">Nama Panggilan *</label><input id="pfNick" class="form-input" maxlength="40" value="' + esc(p.nickname || '') + '" placeholder="mis. Rina"></div>' +
      '<div><label class="form-label" for="pfWa">No. WhatsApp *</label><input id="pfWa" class="form-input" inputmode="numeric" maxlength="16" value="' + esc(p.whatsapp || '') + '" placeholder="087818485245">' +
      '<p class="text-xs text-muted mt-1">Format: diawali <b>08</b>, 10–13 digit, tanpa spasi. Contoh: <span class="mono">087818485245</span></p></div></div>',
    preConfirm: () => {
      const nick = document.getElementById('pfNick').value.trim();
      const wa = normWa(document.getElementById('pfWa').value);
      if (nick.length < 2) return Swal.showValidationMessage('Nama panggilan minimal 2 karakter.');
      if (!isValidWa(wa)) return Swal.showValidationMessage('No. WhatsApp wajib format 08xxxxxxxxxx (contoh 087818485245).');
      Swal.showLoading();
      return api('updateProfile', { nickname: nick, whatsapp: wa }).then(res => {
        if (!res.success) { Swal.hideLoading(); Swal.showValidationMessage(res.message); return false; }
        return res;
      });
    }
  });
  if (!r.isConfirmed || !r.value) return;
  AppState.m.profile = r.value.data.profile;
  Store.set(userKey('boot'), { t: Date.now(), data: AppState.m });
  showToast('Data tersimpan', r.value.message, 'success');
  renderTopnav();
  if (document.getElementById('homeRoot')) renderHome();
  if (productId) { delete AppState.detail[productId]; openDetail(productId); }
}


// ════════════════════════════════════════════════════════════
// PEMBELIAN — pilihan: transfer manual · redeem kode · Lynk.id
// ════════════════════════════════════════════════════════════
const CO = { info: null, channel: null, proof: null, step: 1 };

async function openBuyDialog(productId) {
  const p = (AppState.m.catalog || []).filter(x => x.Product_ID === productId)[0];
  if (!p) return;
  const r = await Swal.fire({
    title: esc(p.Title), showCloseButton: true, showConfirmButton: false,
    html: '<p class="text-sm text-muted mb-4">' + esc(fmtMoney(p.Price)) + ' · pilih cara mendapatkan akses:</p><div style="display:grid;gap:10px">' +
      '<button class="btn-primary w-full" onclick="Swal.close();startCheckout(' + jsArg(productId) + ')"><i data-lucide="landmark" class="w-4 h-4"></i> Beli Sekarang (Transfer)</button>' +
      (p.Lynk_URL ? '<button class="btn-ghost w-full" onclick="Swal.close();openLink(' + jsArg(p.Lynk_URL) + ')"><i data-lucide="shopping-bag" class="w-4 h-4"></i> Beli via Lynk.id</button>' : '') +
      '<button class="btn-ghost w-full" onclick="Swal.close();openRedeemDialog()"><i data-lucide="key-round" class="w-4 h-4"></i> Saya Punya Kode Akses</button></div>',
    didOpen: refreshIcons
  });
  return r;
}

async function startCheckout(productId) {
  Swal.fire({ title: 'Menyiapkan pembayaran…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const res = await api('checkoutInfo', { productId: productId });
  Swal.close();
  if (!res.success) return showToast('Gagal', res.message, 'error');
  const d = res.data;
  if (d.pendingOrder) {
    return Swal.fire({ icon: 'info', title: 'Pesanan masih diproses', text: 'Pesanan ' + d.pendingOrder.orderId + ' menunggu verifikasi Admin.', confirmButtonText: 'Lihat Pesanan' }).then(() => go('orders'));
  }
  if (!d.channels.length) {
    return Swal.fire({ icon: 'warning', title: 'Channel pembayaran belum tersedia', text: d.lynkUrl ? 'Silakan beli lewat Lynk.id.' : 'Hubungi Admin untuk pembelian.',
      confirmButtonText: d.lynkUrl ? 'Beli via Lynk.id' : 'Hubungi Admin' }).then(r => { if (r.isConfirmed) d.lynkUrl ? openLink(d.lynkUrl) : contactAdmin('Pembelian ' + d.productTitle); });
  }
  CO.info = d; CO.channel = null; CO.proof = null;
  document.getElementById('coProductName').textContent = d.productTitle;
  document.getElementById('coPrice').textContent = fmtMoney(d.price);
  document.getElementById('coSummary').innerHTML = detailRow('package', 'Produk', d.productTitle) + detailRow('mail', 'Email pemesan', AppState.email);
  document.getElementById('coChannels').innerHTML = d.channels.map((c, i) =>
    '<div class="channel-card" data-i="' + i + '" onclick="selectChannel(' + i + ')"><div class="channel-logo">' + esc(c.name.slice(0, 6)) + '</div>' +
    '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-main">' + esc(c.type) + ' · ' + esc(c.name) + '</p>' +
    '<p class="mono text-sm text-main">' + esc(c.number) + '</p><p class="text-xs text-muted">a.n. ' + esc(c.holder) + '</p></div>' +
    '<button class="btn-icon" title="Salin" onclick="event.stopPropagation();copyText(' + jsArg(c.number) + ')"><i data-lucide="copy" class="w-4 h-4"></i></button></div>').join('');
  document.getElementById('coProofPreview').innerHTML = '';
  document.getElementById('coNote').value = '';
  document.getElementById('coNext2').disabled = true;
  document.getElementById('coSubmit').disabled = true;
  bindDropzone(document.getElementById('coDrop'), document.getElementById('coFile'), handleProofUpload);
  coGoStep(1);
  document.getElementById('checkoutModal').hidden = false;
  document.body.style.overflow = 'hidden';
  refreshIcons();
}

function closeCheckout() { document.getElementById('checkoutModal').hidden = true; document.body.style.overflow = ''; }

function coGoStep(n) {
  CO.step = n;
  [1, 2, 3, 4].forEach(i => { document.getElementById('coStep' + i).hidden = i !== n; });
  document.querySelectorAll('#checkoutModal .step').forEach(s => {
    const k = +s.dataset.step;
    s.classList.toggle('is-active', k === n); s.classList.toggle('is-done', k < n);
  });
}

function selectChannel(i) {
  CO.channel = CO.info.channels[i];
  document.querySelectorAll('#coChannels .channel-card').forEach(c => c.classList.toggle('is-selected', +c.dataset.i === i));
  document.getElementById('coNext2').disabled = false;
}

async function handleProofUpload(file) {
  const box = document.getElementById('coProofPreview');
  if (!/^image\//.test(file.type) && file.type !== 'application/pdf') { box.innerHTML = '<p class="text-sm" style="color:var(--error)">Gunakan gambar JPG/PNG atau PDF.</p>'; return; }
  box.innerHTML = '<p class="text-sm text-muted"><span class="spinner-inline"></span> Mengunggah ' + esc(file.name) + '…</p>';
  document.getElementById('coSubmit').disabled = true;
  try {
    const res = await uploadFile('proof', file);
    if (!res.success) throw new Error(res.message);
    CO.proof = res.data;
    const local = /^image\//.test(file.type) ? URL.createObjectURL(file) : '';
    box.innerHTML = '<div class="resource-row">' + (local ? '<img src="' + local + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px">' : '<div class="resource-icon"><i data-lucide="file" class="w-4 h-4"></i></div>') +
      '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-main truncate">' + esc(file.name) + '</p><p class="text-xs" style="color:var(--success)">✓ Terunggah</p></div></div>';
    document.getElementById('coSubmit').disabled = false;
    refreshIcons();
  } catch (e) { box.innerHTML = '<p class="text-sm" style="color:var(--error)">' + esc(e.message) + '</p>'; }
}

async function submitOrder() {
  const btn = document.getElementById('coSubmit');
  const c = CO.channel;
  const res = await withBusy(btn, 'Mengirim…', () => api('createOrder', {
    productId: CO.info.productId, channel: c.type + ' ' + c.name, accountInfo: c.number + ' a.n. ' + c.holder,
    proofFileId: CO.proof.fileId, note: document.getElementById('coNote').value.trim()
  }));
  if (!res.success) return showToast('Gagal', res.message, 'error');
  document.getElementById('coOrderId').textContent = res.data.orderId;
  const s = (AppState.m && AppState.m.settings) || {};
  document.getElementById('coContactAdmin').onclick = e => { e.preventDefault(); contactAdmin('Konfirmasi pesanan ' + res.data.orderId); };
  document.getElementById('coContactAdmin').style.display = (s.adminWhatsApp || s.adminEmail) ? '' : 'none';
  coGoStep(4);
  Member.refresh();
}
