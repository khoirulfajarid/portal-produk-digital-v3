/**
 * ============================================================
 * public.js — Halaman Open Access (#/explore), Login, Redeem, Lead
 * Bisa diakses tanpa login. Data publik di-cache (SWR).
 * ============================================================
 */

const Public = {
  loaded: false,

  /** Muat data publik di latar (dipakai juga untuk logo & Client ID Google). */
  prefetch() {
    return swr('pub', 'publicBootstrap', {}, (d) => {
      AppState.pub = d;
      rememberBrand(d.settings);
      Public.loaded = true;
      if (AppState.currentPage === 'explore') renderExplore();
      if (AppState.currentPage === 'login') Login.initGoogle();
      renderPubnav();
      if (document.body.classList.contains('layout-admin') && typeof renderSidebarBrand === 'function') renderSidebarBrand();
    }, { toastError: false }).then(res => {
      Public.lastError = res && !res.success ? (res.message || 'Server tidak merespons.') : '';
      if (AppState.currentPage === 'login') Login.initGoogle();
      return res;
    });
  },
  lastError: ''
};

// ════════════════════════════════════════════════════════════
// NAV PUBLIK
// ════════════════════════════════════════════════════════════
function renderPubnav() {
  const s = (AppState.pub && AppState.pub.settings) || {};
  const nav = document.getElementById('pubnav');
  if (!nav || nav.hidden) return;
  nav.querySelector('.pub-brand').innerHTML = brandLogoHtml(32) + '<span class="truncate">' + esc(s.appName || Store.get('brandName', '') || 'Digital Product Hub') + '</span>';
  refreshIcons();
}

function scrollToId(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }


// ════════════════════════════════════════════════════════════
// HALAMAN OPEN ACCESS
// ════════════════════════════════════════════════════════════
registerPage('explore', {
  layout: 'public', auth: 'public', title: 'Aplikasi & Kelas',
  template: () => '<div id="exploreRoot"><div class="page-wrap"><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">' + skeletonCards(6) + '</div></div></div>',
  show: () => { if (AppState.pub) renderExplore(); }
});

function renderExplore() {
  const root = document.getElementById('exploreRoot');
  if (!root || !AppState.pub) return;
  const d = AppState.pub, s = d.settings || {};
  const apps = d.apps || [], classes = d.classes || [], boots = d.bootcamps || [], shows = d.showcase || [];

  const hero =
    '<section class="hero">' +
      '<div class="page-wrap !py-14 md:!py-20">' +
        '<div class="max-w-3xl">' +
          '<span class="hero-kicker"><i data-lucide="sparkles" class="w-4 h-4"></i> ' + esc(s.appName || '') + '</span>' +
          '<h1 class="hero-title">' + esc(s.exploreTitle || 'Aplikasi & Kelas Siap Pakai') + '</h1>' +
          '<p class="hero-sub">' + esc(s.exploreSubtitle || s.appDescription || '') + '</p>' +
          '<div class="flex flex-wrap gap-3 mt-7">' +
            (apps.length ? '<button class="btn-primary !w-auto" onclick="scrollToId(\'secApps\')"><i data-lucide="app-window" class="w-4 h-4"></i> Lihat Aplikasi</button>' : '') +
            ((boots.length || classes.length) ? '<button class="btn-ghost !w-auto" onclick="scrollToId(\'secClass\')"><i data-lucide="graduation-cap" class="w-4 h-4"></i> Kelas & Bootcamp</button>' : '') +
            (s.customEnabled ? '<button class="btn-ghost !w-auto" onclick="scrollToId(\'secCustom\')"><i data-lucide="wand-sparkles" class="w-4 h-4"></i> Aplikasi Custom</button>' : '') +
            '<button class="btn-ghost !w-auto" onclick="askAdmin(\'WhatsApp\', \'Info umum\')"><i data-lucide="message-circle" class="w-4 h-4"></i> Tanya Admin</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';

  const appsHtml = apps.length
    ? '<section id="secApps" class="page-wrap !pb-4">' + sectionHead('app-window', 'Etalase Aplikasi', 'Lihat preview hasil aplikasi. Beli di Lynk.id untuk mendapatkan source code, video instalasi, dan panduannya.') +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">' + apps.map(publicAppCard).join('') + '</div></section>'
    : '';

  const classHtml = (boots.length || classes.length)
    ? '<section id="secClass" class="page-wrap !pb-4">' + sectionHead('graduation-cap', 'Kelas & Bootcamp', 'Daftar lewat Lynk.id, lalu masuk ke kelas dengan kode akses yang Anda terima.') +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">' + boots.map(bootcampCard).join('') + classes.map(publicClassCard).join('') + '</div></section>'
    : '';

  const showHtml = shows.length
    ? '<section id="secShow" class="page-wrap !pb-4">' + sectionHead('trophy', 'Pameran Karya Member', 'Hasil karya terbaik para member kami.') +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">' + shows.map(showcaseCard).join('') + '</div></section>'
    : '';

  const customHtml = s.customEnabled
    ? '<section id="secCustom" class="page-wrap !pb-4"><div class="custom-hero">' +
        '<div class="min-w-0"><span class="hero-kicker"><i data-lucide="wand-sparkles" class="w-4 h-4"></i> Jasa Pembuatan Aplikasi</span>' +
        '<h2 class="text-2xl font-bold tracking-tight text-main mt-3">Butuh Aplikasi Custom Berbasis Apps Script?</h2>' +
        '<p class="text-sm text-muted mt-2 max-w-2xl">' + esc(s.customIntro || '') + '</p>' +
        '<div class="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-muted"><span>✓ Harga eksklusif / hemat / ajukan sendiri</span><span>✓ Estimasi jadwal jelas</span><span>✓ Source code .zip + video tutorial</span></div></div>' +
        '<div class="flex flex-wrap gap-2"><button class="btn-primary !w-auto" onclick="startCustomOrder()"><i data-lucide="wand-sparkles" class="w-4 h-4"></i> Ajukan Aplikasi</button>' +
        '<button class="btn-ghost !w-auto" onclick="openRegisterDialog()"><i data-lucide="user-plus" class="w-4 h-4"></i> Daftar Member</button></div>' +
      '</div></section>'
    : '';

  const cta =
    '<section class="page-wrap">' +
      '<div class="cta-band">' +
        '<div class="min-w-0"><h3 class="text-xl font-bold">Sudah beli di Lynk.id?</h3>' +
        '<p class="mt-1 opacity-80 text-sm">Masukkan kode akses yang Anda terima untuk membuka kelas & materi di portal member.</p></div>' +
        '<div class="flex flex-wrap gap-3">' +
          '<button class="btn-primary !w-auto" onclick="openRedeemDialog()"><i data-lucide="key-round" class="w-4 h-4"></i> Redeem Kode</button>' +
          '<button class="btn-ghost !w-auto" onclick="go(\'login\')"><i data-lucide="log-in" class="w-4 h-4"></i> Masuk Portal</button>' +
          '<button class="btn-ghost !w-auto" onclick="openRegisterDialog()"><i data-lucide="user-plus" class="w-4 h-4"></i> Daftar Member</button>' +
        '</div>' +
      '</div>' +
      (s.testimoniUrl ? '<div class="testi-band mt-6"><div class="flex items-center gap-3 min-w-0"><div class="testi-icon"><i data-lucide="star" class="w-5 h-5"></i></div>' +
        '<div class="min-w-0"><p class="font-semibold text-main">Apa kata member kami?</p><p class="text-sm text-muted">Baca pengalaman nyata para member.</p></div></div>' +
        '<button class="btn-primary !w-auto" onclick="openLink(' + jsArg(s.testimoniUrl) + ')"><i data-lucide="external-link" class="w-4 h-4"></i> ' + esc(s.testimoniLabel || 'Lihat Testimoni') + '</button></div>' : '') +
      '<div class="ask-band mt-6">' +
        '<p class="font-semibold text-main">Masih ragu? Tanya langsung ke Admin</p>' +
        '<div class="flex flex-wrap gap-2">' +
          (s.adminWhatsApp ? '<button class="btn-wa" onclick="askAdmin(\'WhatsApp\', \'Info umum\')"><i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp</button>' : '') +
          (s.adminEmail ? '<button class="btn-ghost !w-auto" onclick="askAdmin(\'Email\', \'Info umum\')"><i data-lucide="mail" class="w-4 h-4"></i> Email</button>' : '') +
        '</div>' +
      '</div>' +
      '<p class="text-center text-xs text-muted mt-10">© ' + new Date().getFullYear() + ' ' + esc(s.appName || '') + '</p>' +
    '</section>';

  const empty = (!apps.length && !classes.length && !boots.length && !shows.length && !s.customEnabled)
    ? '<div class="page-wrap">' + emptyState('package-open', 'Belum ada yang dipamerkan', 'Admin belum menambahkan aplikasi, kelas, atau karya member.') + '</div>' : '';

  root.innerHTML = hero + appsHtml + classHtml + customHtml + showHtml + empty + cta;
  refreshIcons();
}

function sectionHead(icon, title, sub) {
  return '<div class="flex items-start gap-3 mb-6 mt-10"><div class="stat-icon"><i data-lucide="' + icon + '" class="w-5 h-5"></i></div>' +
    '<div><h2 class="text-2xl font-bold tracking-tight text-main">' + esc(title) + '</h2><p class="text-sm text-muted mt-1">' + esc(sub) + '</p></div></div>';
}

function publicAppCard(p) {
  const cover = (p.slides && p.slides[0] && p.slides[0].image) || p.thumbnail;
  const n = (p.slides || []).length + (p.previewVideos || []).length;
  return '<article class="product-card">' +
    '<div class="product-thumb cursor-pointer" onclick="openAppPreview(' + jsArg(p.Product_ID) + ')">' + img(cover, p.Title, '', 'Aplikasi') +
      (n ? '<span class="owned-badge" style="background:var(--slate-deep)"><i data-lucide="images" class="w-3.5 h-3.5"></i> ' + n + ' preview</span>' : '') + '</div>' +
    '<div class="p-5 flex flex-col flex-1">' +
      '<div class="flex items-center justify-between gap-2"><span class="badge badge-app">Aplikasi</span><span class="text-sm font-bold text-accent">' + esc(fmtMoney(p.Price)) + '</span></div>' +
      '<h3 class="mt-3 text-[17px] font-semibold leading-snug text-main line-clamp-2">' + esc(p.Title) + '</h3>' +
      '<p class="mt-2 text-sm text-muted line-clamp-2 flex-1">' + esc(p.Tagline || p.Description) + '</p>' +
      '<div class="grid grid-cols-2 gap-2 mt-4">' +
        '<button class="btn-ghost" onclick="openAppPreview(' + jsArg(p.Product_ID) + ')"><i data-lucide="eye" class="w-4 h-4"></i> Preview</button>' +
        (p.Lynk_URL ? '<button class="btn-primary" onclick="openLink(' + jsArg(p.Lynk_URL) + ')"><i data-lucide="shopping-cart" class="w-4 h-4"></i> Beli</button>'
                    : '<button class="btn-primary" onclick="askAdmin(\'WhatsApp\', ' + jsArg('Aplikasi: ' + p.Title) + ')"><i data-lucide="message-circle" class="w-4 h-4"></i> Tanya</button>') +
      '</div>' +
    '</div></article>';
}

function publicClassCard(p) {
  return '<article class="product-card">' +
    '<div class="product-thumb">' + img(p.thumbnail, p.Title, '', catLabel(p.Category)) + '</div>' +
    '<div class="p-5 flex flex-col flex-1">' +
      '<div class="flex items-center justify-between gap-2"><span class="badge ' + badgeClassFor(p.Category) + '">' + esc(catLabel(p.Category)) + '</span><span class="text-sm font-bold text-accent">' + esc(fmtMoney(p.Price)) + '</span></div>' +
      '<h3 class="mt-3 text-[17px] font-semibold leading-snug text-main line-clamp-2">' + esc(p.Title) + '</h3>' +
      '<p class="mt-2 text-sm text-muted line-clamp-3 flex-1">' + esc(p.Tagline || p.Description) + '</p>' +
      (p.episodeCount ? '<p class="mt-3 text-xs text-muted inline-flex items-center gap-1"><i data-lucide="list-video" class="w-3.5 h-3.5"></i> ' + p.episodeCount + ' episode</p>' : '') +
      (p.Lynk_URL ? '<button class="btn-primary w-full mt-4" onclick="openLink(' + jsArg(p.Lynk_URL) + ')"><i data-lucide="ticket" class="w-4 h-4"></i> Join Kelas</button>'
                  : '<button class="btn-ghost w-full mt-4" onclick="askAdmin(\'WhatsApp\', ' + jsArg('Kelas: ' + p.Title) + ')"><i data-lucide="message-circle" class="w-4 h-4"></i> Tanya Admin</button>') +
    '</div></article>';
}

function bootcampCard(b) {
  return '<article class="product-card">' +
    '<div class="product-thumb">' + img(b.poster, b.title, '', 'Bootcamp') + '<span class="owned-badge" style="background:var(--indigo)"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> Bootcamp</span></div>' +
    '<div class="p-5 flex flex-col flex-1">' +
      '<h3 class="text-[17px] font-semibold leading-snug text-main">' + esc(b.title) + '</h3>' +
      (b.schedule ? '<p class="mt-2 text-sm text-main inline-flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4 text-accent"></i> ' + esc(b.schedule) + '</p>' : '') +
      '<p class="mt-2 text-sm text-muted flex-1 whitespace-pre-line line-clamp-4">' + esc(b.description) + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-3">' +
        (b.priceLabel ? '<span class="badge badge-success">' + esc(b.priceLabel) + '</span>' : '') +
        (b.quotaLabel ? '<span class="badge badge-warning">' + esc(b.quotaLabel) + '</span>' : '') +
      '</div>' +
      (b.ctaUrl ? '<button class="btn-primary w-full mt-4" onclick="openLink(' + jsArg(b.ctaUrl) + ')"><i data-lucide="arrow-right" class="w-4 h-4"></i> ' + esc(b.ctaLabel) + '</button>'
                : '<button class="btn-ghost w-full mt-4" onclick="askAdmin(\'WhatsApp\', ' + jsArg('Bootcamp: ' + b.title) + ')"><i data-lucide="message-circle" class="w-4 h-4"></i> Tanya Admin</button>') +
    '</div></article>';
}

function showcaseCard(s) {
  return '<article class="product-card">' +
    '<div class="product-thumb cursor-pointer" onclick="openShowcase(' + jsArg(s.id) + ')">' + img(s.image, s.title, '', 'Karya') +
      (s.featured ? '<span class="owned-badge" style="background:var(--warning)"><i data-lucide="award" class="w-3.5 h-3.5"></i> Unggulan</span>' : '') +
      (s.videoEmbed ? '<span class="play-dot"><i data-lucide="play" class="w-5 h-5"></i></span>' : '') + '</div>' +
    '<div class="p-5 flex flex-col flex-1">' +
      '<h3 class="text-[16px] font-semibold leading-snug text-main line-clamp-2">' + esc(s.title) + '</h3>' +
      (s.memberName ? '<p class="mt-1 text-xs text-muted inline-flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i> ' + esc(s.memberName) + '</p>' : '') +
      '<p class="mt-2 text-sm text-muted line-clamp-2 flex-1">' + esc(s.description) + '</p>' +
      '<button class="btn-ghost w-full mt-4" onclick="openShowcase(' + jsArg(s.id) + ')"><i data-lucide="eye" class="w-4 h-4"></i> Lihat Karya</button>' +
    '</div></article>';
}

/** Detail karya (dipakai di publik & portal member). */
function openShowcase(id) {
  const list = (AppState.m && AppState.m.showcase) || (AppState.pub && AppState.pub.showcase) || [];
  const s = list.filter(x => x.id === id)[0];
  if (!s) return;
  Swal.fire({
    width: 820, showConfirmButton: !!s.demoUrl, confirmButtonText: 'Buka Demo', showCloseButton: true,
    html: '<div style="text-align:left">' +
      (s.videoEmbed ? '<div class="video-frame"><iframe src="' + esc(s.videoEmbed) + '" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div>'
                    : '<div class="rounded-xl overflow-hidden">' + img(s.image, s.title, 'style="width:100%"') + '</div>') +
      '<h3 class="mt-4 text-xl font-bold text-main">' + esc(s.title) + '</h3>' +
      (s.memberName ? '<p class="text-sm text-muted mt-1">oleh ' + esc(s.memberName) + '</p>' : '') +
      '<p class="mt-3 text-[15px] text-muted whitespace-pre-line">' + esc(s.description) + '</p></div>'
  }).then(r => { if (r.isConfirmed) openLink(s.demoUrl); });
}

/** Preview Aplikasi: slide gambar + video YouTube. Dipakai publik & member. */
function openAppPreview(productId) {
  const pool = [].concat((AppState.pub && AppState.pub.apps) || [], (AppState.m && AppState.m.catalog) || []);
  const p = pool.filter(x => x.Product_ID === productId)[0];
  if (!p) return;
  const loggedMember = AppState.role === ROLE_MEMBER;
  Swal.fire({
    width: 920, showCloseButton: true,
    showConfirmButton: !!(p.Lynk_URL || loggedMember),
    confirmButtonText: loggedMember ? (p.owned ? 'Buka Aplikasi' : 'Beli / Redeem Kode') : 'Beli di Lynk.id',
    html: '<div style="text-align:left">' + appPreviewHtml(p) +
      '<h3 class="mt-4 text-xl font-bold text-main">' + esc(p.Title) + '</h3>' +
      '<p class="mt-2 text-[15px] text-muted whitespace-pre-line">' + esc(p.Description) + '</p>' +
      '<p class="mt-3 font-bold text-accent">' + esc(fmtMoney(p.Price)) + '</p></div>',
    didOpen: () => { initCarousel(document.querySelector('.swal2-popup .carousel')); refreshIcons(); }
  }).then(r => {
    if (!r.isConfirmed) return;
    if (!loggedMember) openLink(p.Lynk_URL);
    else if (p.owned) go('product', p.Product_ID);
    else openBuyDialog(p.Product_ID);
  });
}

function appPreviewHtml(p) {
  const slides = p.slides || [], vids = p.previewVideos || [];
  let html = '';
  if (slides.length) {
    html += '<div class="carousel" data-index="0">' +
      '<div class="carousel-track">' + slides.map(s => '<figure class="carousel-slide">' + img(s.image, s.caption || p.Title, 'onclick="previewImage(this.src,' + jsArg(s.caption || p.Title) + ')"') +
        (s.caption ? '<figcaption>' + esc(s.caption) + '</figcaption>' : '') + '</figure>').join('') + '</div>' +
      (slides.length > 1 ? '<button type="button" class="carousel-btn prev" aria-label="Sebelumnya"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>' +
        '<button type="button" class="carousel-btn next" aria-label="Berikutnya"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>' +
        '<div class="carousel-dots">' + slides.map((s, i) => '<span class="' + (i ? '' : 'is-active') + '"></span>').join('') + '</div>' : '') +
      '</div>';
  }
  if (vids.length) {
    html += '<div class="grid gap-3 mt-4 ' + (vids.length > 1 ? 'sm:grid-cols-2' : '') + '">' + vids.map(v =>
      '<div><div class="video-frame"><iframe src="' + esc(v.url) + '" loading="lazy" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div>' +
      (v.title ? '<p class="text-sm font-medium text-main mt-2">' + esc(v.title) + '</p>' : '') + '</div>').join('') + '</div>';
  }
  if (!html) html = '<div class="rounded-xl overflow-hidden">' + img(p.thumbnail, p.Title, 'style="width:100%"') + '</div>';
  return html;
}

function initCarousel(el) {
  if (!el) return;
  const track = el.querySelector('.carousel-track'), n = track.children.length;
  const dots = el.querySelectorAll('.carousel-dots span');
  const set = i => {
    i = (i + n) % n; el.dataset.index = i;
    track.style.transform = 'translateX(-' + (i * 100) + '%)';
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  };
  const prev = el.querySelector('.prev'), next = el.querySelector('.next');
  if (prev) prev.onclick = () => set(+el.dataset.index - 1);
  if (next) next.onclick = () => set(+el.dataset.index + 1);
  dots.forEach((d, k) => d.onclick = () => set(k));
  let x0 = null;
  track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) set(+el.dataset.index + (dx < 0 ? 1 : -1)); x0 = null; });
}


// ════════════════════════════════════════════════════════════
// TANYA ADMIN (lead capture non-member → CRM)
// ════════════════════════════════════════════════════════════
async function askAdmin(channel, interest) {
  const s = (AppState.pub && AppState.pub.settings) || (AppState.m && AppState.m.settings) || {};
  if (channel === 'WhatsApp' && !s.adminWhatsApp) channel = 'Email';
  if (channel === 'Email' && !s.adminEmail) { showToast('Kontak belum diatur', 'Admin belum mengisi kontak.', 'warning'); return; }
  const saved = Store.get('lead', {});
  const r = await Swal.fire({
    title: 'Tanya Admin', confirmButtonText: 'Lanjut ke ' + channel, showCancelButton: true, cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div style="text-align:left;display:grid;gap:12px">' +
      '<p class="text-sm text-muted">Isi data singkat agar Admin bisa membantu Anda lebih cepat.</p>' +
      '<div><label class="form-label" for="ldName">Nama</label><input id="ldName" class="form-input" value="' + esc(saved.name || '') + '" placeholder="Nama Anda"></div>' +
      '<div><label class="form-label" for="ldWa">No. WhatsApp</label><input id="ldWa" class="form-input" inputmode="numeric" value="' + esc(saved.whatsapp || '') + '" placeholder="087818485245"></div>' +
      '<div><label class="form-label" for="ldEmail">Email (opsional)</label><input id="ldEmail" type="email" class="form-input" value="' + esc(saved.email || '') + '" placeholder="nama@email.com"></div>' +
      '<div><label class="form-label" for="ldMsg">Pertanyaan</label><textarea id="ldMsg" class="form-input" rows="2">' + esc(interest && interest !== 'Info umum' ? 'Halo Admin, saya tertarik dengan ' + interest.replace(/^[^:]+:\s*/, '') + '.' : 'Halo Admin, saya ingin bertanya.') + '</textarea></div></div>',
    preConfirm: () => {
      const name = document.getElementById('ldName').value.trim();
      const wa = normWa(document.getElementById('ldWa').value);
      const email = document.getElementById('ldEmail').value.trim();
      if (name.length < 2) return Swal.showValidationMessage('Nama wajib diisi.');
      if (!isValidWa(wa)) return Swal.showValidationMessage('No. WhatsApp wajib format 08xxxxxxxxxx (contoh 087818485245).');
      return { name: name, whatsapp: wa, email: email, msg: document.getElementById('ldMsg').value.trim() };
    }
  });
  if (!r.isConfirmed) return;
  const v = r.value;
  Store.set('lead', { name: v.name, whatsapp: v.whatsapp, email: v.email });
  // Buka tab dulu (sinkron) agar tidak diblokir popup blocker, lalu isi URL setelah lead tersimpan
  const win = window.open('', '_blank');
  const text = v.msg + '\n\nNama: ' + v.name + '\nWA: ' + v.whatsapp + (v.email ? '\nEmail: ' + v.email : '') + (interest ? '\nMinat: ' + interest : '');
  const url = channel === 'WhatsApp'
    ? waLink(s.adminWhatsApp, text)
    : 'mailto:' + s.adminEmail + '?subject=' + encodeURIComponent('Pertanyaan: ' + (interest || 'Info')) + '&body=' + encodeURIComponent(text);
  api('submitLead', { name: v.name, whatsapp: v.whatsapp, email: v.email, channel: channel, interest: interest || '' })
    .then(res => { if (!res.success && !res.network) showToast('Catatan', res.message, 'warning'); });
  if (win) win.location.href = url; else location.href = url;
}


// ════════════════════════════════════════════════════════════
// LOGIN (Member email · Superadmin Google OAuth)
// ════════════════════════════════════════════════════════════
const Login = {
  tab: 'member',
  historyKey: 'emailHistory',
  getHistory() { return Store.get(this.historyKey, []).slice(0, 5); },
  pushHistory(email) {
    const list = this.getHistory().filter(e => e !== email); list.unshift(email);
    Store.set(this.historyKey, list.slice(0, 5));
  },
  removeHistory(email) { Store.set(this.historyKey, this.getHistory().filter(e => e !== email)); this.renderHistory(); },
  clearHistory() { Store.del(this.historyKey); this.renderHistory(); },
  renderHistory() {
    const box = document.getElementById('emailHistory');
    if (!box) return;
    const list = this.getHistory();
    box.innerHTML = list.length
      ? '<p class="text-xs text-muted mb-1.5 flex items-center justify-between">Pernah masuk di perangkat ini <button type="button" class="text-xs underline" onclick="Login.clearHistory()">Hapus semua</button></p>' +
        list.map(e => '<div class="hist-row"><button type="button" class="hist-pick" onclick="Login.pick(' + jsArg(e) + ')"><i data-lucide="history" class="w-3.5 h-3.5"></i> ' + esc(e) + '</button>' +
          '<button type="button" class="hist-del" title="Hapus" onclick="Login.removeHistory(' + jsArg(e) + ')"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></div>').join('')
      : '';
    refreshIcons();
  },
  pick(email) { const i = document.querySelector('#formMember input[data-email]'); if (i) { i.value = email; i.focus(); } },
  switchTab(t) {
    this.tab = t;
    document.getElementById('tabMember').classList.toggle('login-tab-active', t === 'member');
    document.getElementById('tabAdmin').classList.toggle('login-tab-active', t === 'admin');
    document.getElementById('formMember').hidden = t !== 'member';
    document.getElementById('formAdmin').hidden = t !== 'admin';
    if (t === 'admin') this.initGoogle();
  },
  async submitMember(e) {
    e.preventDefault();
    const input = document.querySelector('#formMember input[data-email]');
    const email = input.value.trim().toLowerCase();
    const btn = e.submitter || document.querySelector('#formMember button[type=submit]');
    const res = await withBusy(btn, 'Memeriksa…', () => api('loginMember', { email: email }));
    if (!res.success) {
      const code = res.data && res.data.code;
      if (code === 'NOT_REGISTERED') {
        Swal.fire({
          icon: 'warning', title: 'Email tidak terdaftar', text: res.message, showDenyButton: true, showCancelButton: true,
          confirmButtonText: 'Redeem Kode Akses', denyButtonText: 'Daftar Member', cancelButtonText: 'Coba email lain'
        }).then(r => { if (r.isConfirmed) openRedeemDialog(email); else if (r.isDenied) openRegisterDialog(email); });
      } else if (code === 'PENDING') {
        Swal.fire({ icon: 'info', title: 'Menunggu persetujuan', text: res.message, confirmButtonText: 'OK', showDenyButton: true, denyButtonText: 'Tanya Admin' })
          .then(r => { if (r.isDenied) askAdmin('WhatsApp', 'Status pendaftaran ' + email); });
      } else if (code === 'REJECTED') {
        Swal.fire({ icon: 'warning', title: 'Pendaftaran belum disetujui', text: res.message, showDenyButton: true, showCancelButton: true,
          confirmButtonText: 'Ajukan Ulang', denyButtonText: 'Tanya Admin', cancelButtonText: 'Tutup' })
          .then(r => { if (r.isConfirmed) openRegisterDialog(email, 'Perbaiki data Anda lalu kirim ulang pendaftaran.'); else if (r.isDenied) askAdmin('WhatsApp', 'Status pendaftaran ' + email); });
      } else Swal.fire({ icon: 'error', title: 'Gagal masuk', text: res.message });
      return;
    }
    this.pushHistory(email);
    onMemberLogin(res.data);
    showToast('Berhasil masuk', res.message, 'success');
  },
  initGoogle() {
    const box = document.getElementById('gsiButton');
    if (!box) return;
    const cid = AppState.pub && AppState.pub.googleClientId;
    const retryBtn = '<button type="button" class="btn-ghost !w-auto !py-1.5 mt-3" onclick="Login.retryGoogle()"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Coba lagi</button>';
    const diag = (title, msg) => { box.innerHTML = '<div class="notice notice-error text-left"><i data-lucide="alert-triangle" class="w-5 h-5 flex-none"></i><div class="flex-1 text-sm"><b>' + esc(title) + '</b><br>' + msg + '</div></div>' + '<div class="text-center">' + retryBtn + '</div>'; box.style.flexDirection = 'column'; refreshIcons(); };
    if (!cid) {
      if (Public.lastError) return diag('Tidak bisa terhubung ke server (Apps Script)', esc(Public.lastError) + '<br>Periksa <code>GAS_URL</code> di <code>js/config.js</code> dan pastikan deploy Web App: <i>Execute as: Me</i>, <i>Who has access: Anyone</i>.');
      if (AppState.pub) return diag('Google Client ID belum diisi di server', 'Isi <code>INITIAL_GOOGLE_CLIENT_ID</code> di Kode.gs, jalankan fungsi <code>setGoogleClientId()</code>, lalu klik Coba lagi.');
      box.innerHTML = '<p class="text-sm text-muted text-center"><span class="spinner-inline"></span> Memuat Sign in with Google…</p>';
      clearTimeout(Login._t); Login._t = setTimeout(() => { if (!(AppState.pub && AppState.pub.googleClientId) && !Public.lastError) diag('Server lambat merespons', 'Belum ada jawaban dari Apps Script setelah 20 detik.'); }, 20000);
      return;
    }
    if (!window.google || !google.accounts || !google.accounts.id) {
      Login._gsiWait = (Login._gsiWait || 0) + 1;
      if (Login._gsiWait > 40) return diag('Skrip Google tidak termuat', 'Matikan ad-blocker/ekstensi privasi untuk situs ini, lalu muat ulang halaman.');
      setTimeout(() => Login.initGoogle(), 400); return;
    }
    if (box.dataset.ready === cid) return;
    google.accounts.id.initialize({ client_id: cid, callback: Login.onGoogle, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup' });
    box.innerHTML = '';
    google.accounts.id.renderButton(box, { theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 300, locale: 'id' });
    box.dataset.ready = cid;
  },
  retryGoogle() {
    const box = document.getElementById('gsiButton'); if (box) { box.dataset.ready = ''; box.style.flexDirection = ''; }
    Store.del('pub'); Public.lastError = ''; Login._gsiWait = 0; AppState.pub = null;
    Login.initGoogle(); Public.prefetch();
  },
  async onGoogle(resp) {
    const box = document.getElementById('gsiStatus');
    if (box) box.innerHTML = '<span class="spinner-inline"></span> Memverifikasi akun Google…';
    const res = await api('loginSuperadmin', { credential: resp.credential });
    if (box) box.innerHTML = '';
    if (!res.success) { Swal.fire({ icon: 'error', title: 'Akses ditolak', text: res.message }); return; }
    saveSession(res.data);
    showToast('Selamat datang', res.data.name, 'success');
    Admin.boot();
    go('admin/dashboard');
  }
};

registerPage('login', {
  layout: 'public', auth: 'guest', title: 'Masuk',
  template: () =>
    '<div class="min-h-[calc(100dvh-64px)] flex items-center justify-center px-4 py-10 dot-grid">' +
      '<div class="w-full max-w-md">' +
        '<div class="app-card rounded-2xl overflow-hidden">' +
          '<div class="px-8 pt-8 pb-6 text-center">' +
            '<div id="loginBrand" class="mx-auto w-14 h-14"></div>' +
            '<h1 class="mt-4 text-2xl font-bold tracking-tight text-main">Selamat Datang</h1>' +
            '<p class="mt-1 text-sm text-muted">Masuk untuk mengakses kelas & aplikasi Anda.</p>' +
          '</div>' +
          '<div class="px-8"><div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2">' +
            '<button type="button" id="tabMember" onclick="Login.switchTab(\'member\')" class="login-tab login-tab-active">Member</button>' +
            '<button type="button" id="tabAdmin" onclick="Login.switchTab(\'admin\')" class="login-tab">Superadmin</button>' +
          '</div></div>' +
          '<form id="formMember" class="px-8 py-6 space-y-4" onsubmit="Login.submitMember(event)" autocomplete="off">' +
            '<div><label class="form-label">Email Terdaftar</label>' +
            '<input data-email name="m_' + Math.random().toString(36).slice(2, 8) + '" type="email" required autocomplete="off" autocapitalize="off" spellcheck="false" ' +
              'data-lpignore="true" data-1p-ignore data-form-type="other" class="form-input" placeholder="nama@email.com">' +
            '<p class="mt-1.5 text-xs text-muted">Gunakan email yang Anda pakai saat membeli / redeem kode.</p>' +
            '<div id="emailHistory" class="mt-3"></div></div>' +
            '<button type="submit" class="btn-primary w-full"><i data-lucide="log-in" class="w-4 h-4"></i> Masuk sebagai Member</button>' +
            '<button type="button" onclick="openRedeemDialog()" class="btn-ghost w-full"><i data-lucide="key-round" class="w-4 h-4"></i> Punya Kode Akses? Redeem di sini</button>' +
            '<p class="text-center text-xs text-muted">Belum punya akun? <button type="button" class="text-accent font-semibold" onclick="openRegisterDialog()">Daftar sebagai member</button></p>' +
          '</form>' +
          '<div id="formAdmin" class="px-8 py-6 space-y-4" hidden>' +
            '<div class="text-center"><div class="w-12 h-12 mx-auto rounded-2xl grid place-items-center" style="background:var(--accent-soft);color:var(--accent)"><i data-lucide="shield-check" class="w-6 h-6"></i></div>' +
            '<p class="mt-3 text-sm text-muted">Khusus Superadmin. Masuk dengan akun Google yang terdaftar (OAuth 2.0).</p></div>' +
            '<div id="gsiButton" class="flex justify-center min-h-[44px]"></div>' +
            '<p id="gsiStatus" class="text-center text-sm text-muted"></p>' +
          '</div>' +
          '<div class="px-8 pb-6 text-center"><button type="button" class="text-sm text-muted hover:text-main inline-flex items-center gap-1" onclick="go(\'explore\')"><i data-lucide="arrow-left" class="w-4 h-4"></i> Kembali ke beranda</button></div>' +
        '</div>' +
      '</div>' +
    '</div>',
  show: () => {
    document.getElementById('loginBrand').innerHTML = brandLogoHtml(56);
    Login.renderHistory();
    if (Login.tab === 'admin') Login.initGoogle();
  }
});

function onMemberLogin(d) {
  saveSession(d);
  if (d.profile) {
    AppState.m = AppState.m || Store.get(userKey('boot'), { data: null }).data;
  }
  const next = Store.get('afterLogin', '');
  if (next) Store.del('afterLogin');
  go(next && Pages[next] ? next : 'home');
  Member.refresh();
}


// ════════════════════════════════════════════════════════════
// REDEEM KODE (tanpa login → akun dibuat otomatis)
// ════════════════════════════════════════════════════════════
async function openRedeemDialog(prefillEmail) {
  const logged = AppState.role === ROLE_MEMBER;
  const r = await Swal.fire({
    title: 'Redeem Kode Akses', confirmButtonText: 'Tukarkan Kode', showCancelButton: true, cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div style="text-align:left;display:grid;gap:12px">' +
      '<p class="text-sm text-muted">Masukkan kode yang Anda terima setelah membeli di Lynk.id.</p>' +
      '<div><label class="form-label" for="rdCode">Kode Akses</label><input id="rdCode" class="form-input mono" style="text-transform:uppercase" placeholder="LYNK-XXXXX-X" autocomplete="off"></div>' +
      (logged ? '' : '<div><label class="form-label" for="rdEmail">Email Anda</label><input id="rdEmail" type="email" class="form-input" value="' + esc(typeof prefillEmail === 'string' ? prefillEmail : '') + '" placeholder="nama@email.com" autocomplete="off">' +
        '<p class="text-xs text-muted mt-1">Email ini menjadi akun login Anda. Pastikan penulisannya benar.</p></div>') + '</div>',
    preConfirm: () => {
      const code = document.getElementById('rdCode').value.trim().toUpperCase();
      const email = logged ? AppState.email : (document.getElementById('rdEmail').value || '').trim().toLowerCase();
      if (!code) return Swal.showValidationMessage('Kode wajib diisi.');
      if (!logged && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Swal.showValidationMessage('Email tidak valid.');
      Swal.showLoading();
      return api('redeem', { code: code, email: email }).then(res => {
        if (!res.success) { Swal.hideLoading(); Swal.showValidationMessage(res.message); return false; }
        return res;
      });
    },
    allowOutsideClick: () => !Swal.isLoading()
  });
  if (!r.isConfirmed || !r.value) return;
  const res = r.value, d = res.data;
  if (d.token) { Login.pushHistory(d.email); saveSession(d); }
  await Swal.fire({ icon: 'success', title: d.isNew ? 'Akun dibuat & akses aktif!' : 'Berhasil!', text: res.message, confirmButtonText: 'Buka Sekarang' });
  delete AppState.detail[d.productId];
  if (AppState.role === ROLE_MEMBER) { await Member.refresh(); go('product', d.productId); }
}
