/**
 * ============================================================
 * DIGITAL PRODUCT HUB v3.0 — core.js
 * State, API (fetch ke GAS), cache SWR (localStorage), router SPA,
 * utilitas UI. Semua halaman dirender di klien → pindah menu 0 ms.
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// 1. STATE
// ════════════════════════════════════════════════════════════
const AppState = {
  token: null, role: null, email: null, name: null, picture: '',
  pub: null,            // data halaman Open Access
  m: null,              // data portal member (bootstrap)
  a: {},                // data panel admin per aksi
  detail: {},           // cache detail produk (memori)
  charts: {}, tables: {}, timers: {},
  currentPage: null, currentParam: null,
  catalogFilter: 'all'
};

const LS_PREFIX = 'dph3:';
const ROLE_ADMIN = 'Superadmin';
const ROLE_MEMBER = 'Customer';


// ════════════════════════════════════════════════════════════
// 2. PENYIMPANAN LOKAL (aman bila diblokir browser)
// ════════════════════════════════════════════════════════════
const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(LS_PREFIX + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch (e) { /* kuota penuh / privat */ } },
  del(key) { try { localStorage.removeItem(LS_PREFIX + key); } catch (e) { /* */ } },
  clearPrefix(prefix) {
    try {
      Object.keys(localStorage).forEach(k => { if (k.indexOf(LS_PREFIX + prefix) === 0) localStorage.removeItem(k); });
    } catch (e) { /* */ }
  }
};

/** Kunci cache per pengguna — mencegah data bocor antar akun di perangkat bersama. */
function userKey(k) { return 'u:' + (AppState.email || 'anon') + ':' + k; }


// ════════════════════════════════════════════════════════════
// 3. API — fetch POST ke GAS (text/plain → tanpa CORS preflight)
// ════════════════════════════════════════════════════════════
/** Aksi baca (aman diulang otomatis bila jaringan HP putus-sambung). Aksi tulis TIDAK diulang. */
const READ_ACTIONS = /^(publicBootstrap|memberBootstrap|session|productDetail|checkoutInfo|dashboard|systemStatus|productsAdmin|ordersAdmin|crm|accessHistory|keysAdmin|helpdeskAdmin|announcementsAdmin|showcaseAdmin|bootcampsAdmin|notifConfig|blastAdmin|blastPreview|blastQueue|logs|logsSince|settingsAdmin|customAdmin)$/;
let _slowToastAt = 0;

async function apiOnce(action, data, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal, cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: AppState.token || '', data: data || {} })
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) {
      // GAS kadang membalas halaman "server sibuk" sesaat → boleh dicoba ulang
      return { success: false, network: true, retryable: res.status >= 500 || res.status === 429,
        message: 'Server membalas HTTP ' + res.status + ' berupa halaman, bukan data JSON. Biasanya URL /exec salah, deployment sudah dihapus, atau akses Web App belum "Anyone".' };
    }
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return { success: false, network: true, retryable: true,
      message: aborted ? 'Server terlalu lama merespons.' : (navigator.onLine === false ? 'Perangkat sedang offline.' : 'Koneksi terputus: ' + err.message) };
  } finally { clearTimeout(timer); }
}

async function api(action, data, opts) {
  opts = opts || {};
  if (!window.GAS_URL || GAS_URL.indexOf('PASTE_') === 0) {
    return { success: false, message: 'GAS_URL belum diisi di js/config.js' };
  }
  const isRead = READ_ACTIONS.test(action);
  const tries = opts.retries !== undefined ? opts.retries + 1 : (isRead ? 3 : 1);
  let res;
  for (let i = 0; i < tries; i++) {
    if (i > 0) {
      if (Date.now() - _slowToastAt > 15000) { _slowToastAt = Date.now(); showToast('Koneksi lambat', 'Mencoba menghubungi server lagi…', 'warning'); }
      await new Promise(r => setTimeout(r, 1200 * i));
      if (navigator.onLine === false) await waitOnline(15000);
    }
    // Percobaan pertama lebih singkat agar cepat pulih dari "server dingin" di HP
    res = await apiOnce(action, data, { timeout: opts.timeout || (isRead ? (i === 0 ? 25000 : 40000) : 90000) });
    if (res.success || !res.retryable) break;
  }
  if (!res.success && res.network && !isRead) res.message += ' Periksa koneksi lalu coba lagi.';
  if (!res.success && res.data && res.data.code === 'AUTH' && !opts.silentAuth) onSessionExpired();
  return res;
}

function waitOnline(ms) {
  return new Promise(resolve => {
    if (navigator.onLine !== false) return resolve();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); window.removeEventListener('online', done); resolve(); }
    window.addEventListener('online', done);
  });
}

/** Pemanasan server: GET ringan saat app dibuka (mengurangi "cold start" GAS di HP). */
function warmUpServer() {
  try {
    const last = +sessionStorage.getItem('dph3:warm') || 0;
    if (Date.now() - last < 240000 || !window.GAS_URL || GAS_URL.indexOf('PASTE_') === 0) return;
    sessionStorage.setItem('dph3:warm', String(Date.now()));
  } catch (e) { /* */ }
  fetch(GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

/** Muat skrip/CSS eksternal sesuai kebutuhan (lib admin tidak membebani HP member). */
const _loaded = {};
function loadScript(src) {
  if (_loaded[src]) return _loaded[src];
  _loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete _loaded[src]; rej(new Error('Gagal memuat ' + src)); }; document.head.appendChild(s); });
  return _loaded[src];
}
function loadCss(href) {
  if (_loaded[href]) return _loaded[href];
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href;
  const base = document.querySelector('link[href*="css/base.css"]');   // urutan tetap: lib → base → app → tw
  if (base) document.head.insertBefore(l, base); else document.head.appendChild(l);
  _loaded[href] = Promise.resolve(); return _loaded[href];
}
const AdminLibs = {
  p: null,
  ready() {
    if (this.p) return this.p;
    loadCss('https://cdn.jsdelivr.net/npm/datatables.net-dt@1.13.8/css/jquery.dataTables.min.css');
    this.p = Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js')
        .then(() => loadScript('https://cdn.jsdelivr.net/npm/datatables.net@1.13.8/js/jquery.dataTables.min.js')),
      loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js')
    ]).catch(e => { this.p = null; showToast('Gagal memuat komponen', e.message, 'error'); });
    return this.p;
  }
};

/**
 * Stale-While-Revalidate: tampilkan cache lokal INSTAN, lalu segarkan di latar.
 * onData dipanggil 1× dari cache (bila ada) dan 1× lagi dengan data baru.
 */
async function swr(cacheKey, action, payload, onData, opts) {
  opts = opts || {};
  const cached = Store.get(cacheKey, null);
  if (cached && cached.data !== undefined) onData(cached.data, true);
  const res = await api(action, payload, opts);
  if (res.success) {
    Store.set(cacheKey, { t: Date.now(), data: res.data });
    onData(res.data, false);
  } else if (!cached && opts.onError) opts.onError(res);
  else if (!res.success && !res.network && opts.toastError !== false && res.message) showToast('Gagal memuat', res.message, 'error');
  return res;
}


// ════════════════════════════════════════════════════════════
// 4. SESI
// ════════════════════════════════════════════════════════════
function saveSession(d) {
  AppState.token = d.token; AppState.role = d.role; AppState.email = d.email;
  AppState.name = d.name || d.email; AppState.picture = d.picture || '';
  Store.set('session', { token: d.token, role: d.role, email: d.email, name: AppState.name, picture: AppState.picture });
}
function loadSession() {
  const s = Store.get('session', null);
  if (s && s.token) { AppState.token = s.token; AppState.role = s.role; AppState.email = s.email; AppState.name = s.name; AppState.picture = s.picture || ''; }
}
function clearSession() {
  if (AppState.email) Store.clearPrefix('u:' + AppState.email + ':');
  Store.del('session');
  Object.keys(AppState.timers).forEach(k => clearInterval(AppState.timers[k]));
  AppState.timers = {};
  AppState.token = AppState.role = AppState.email = AppState.name = null;
  AppState.m = null; AppState.a = {}; AppState.detail = {};
  document.querySelectorAll('#app-container .page').forEach(p => { if (p.dataset.layout !== 'public') p.remove(); });
}
let _expiredShown = false;
function onSessionExpired() {
  if (_expiredShown) return;
  _expiredShown = true;
  clearSession();
  showToast('Sesi berakhir', 'Silakan masuk kembali.', 'warning');
  go('login');
  setTimeout(() => { _expiredShown = false; }, 3000);
}
async function logout() {
  const r = await Swal.fire({ title: 'Keluar dari aplikasi?', icon: 'question', showCancelButton: true, confirmButtonText: 'Keluar', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  api('logout', {}, { silentAuth: true });            // tanpa menunggu (fire & forget)
  clearSession();
  go(Pages.explore ? 'explore' : 'login');
}


// ════════════════════════════════════════════════════════════
// 5. ROUTER SPA (hash) — halaman dibuat sekali, lalu hanya tampil/sembunyi
// ════════════════════════════════════════════════════════════
const Pages = {};
function registerPage(name, def) { Pages[name] = Object.assign({ layout: 'member', auth: 'member', title: '' }, def); }

function go(name, param) {
  const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : '');
  if (location.hash === h) route(); else location.hash = h;
}

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'admin') return { name: 'admin-' + (parts[1] || 'dashboard'), param: parts[2] ? decodeURIComponent(parts[2]) : null };
  return { name: parts[0] || '', param: parts[1] ? decodeURIComponent(parts[1]) : null };
}

function defaultPage() {
  if (AppState.role === ROLE_ADMIN) return 'admin-dashboard';
  if (AppState.role === ROLE_MEMBER) return 'home';
  return 'explore';
}

function route() {
  let r = parseHash();
  let def = Pages[r.name];
  if (!def) { r = { name: defaultPage(), param: null }; def = Pages[r.name]; }

  // Penjaga akses
  if (def.auth === 'member' && AppState.role !== ROLE_MEMBER) { return go(AppState.role === ROLE_ADMIN ? 'admin/dashboard' : 'login'); }
  if (def.auth === 'admin' && AppState.role !== ROLE_ADMIN) { return go(AppState.role === ROLE_MEMBER ? 'home' : 'login'); }
  if (def.auth === 'guest' && AppState.role) { return go(AppState.role === ROLE_ADMIN ? 'admin/dashboard' : 'home'); }

  setLayout(def.layout);
  const container = document.getElementById('app-container');
  let el = container.querySelector('.page[data-page="' + r.name + '"]');
  if (!el) {
    el = document.createElement('section');
    el.className = 'page'; el.dataset.page = r.name; el.dataset.layout = def.layout;
    el.innerHTML = def.template ? def.template() : '';
    container.appendChild(el);
    if (def.mount) def.mount(el);
  }
  container.querySelectorAll('.page').forEach(p => { p.hidden = p !== el; });
  if (AppState.currentPage && AppState.currentPage !== r.name && Pages[AppState.currentPage] && Pages[AppState.currentPage].leave) {
    try { Pages[AppState.currentPage].leave(); } catch (e) { /* */ }
  }
  AppState.currentPage = r.name; AppState.currentParam = r.param;
  document.title = (def.title ? def.title + ' · ' : '') + appTitle();
  updateActiveNav(r.name);
  closeSidebar();
  window.scrollTo(0, 0);
  if (def.show) def.show(el, r.param);
  refreshIcons();
}

function appTitle() {
  return (AppState.m && AppState.m.settings && AppState.m.settings.appName) ||
         (AppState.pub && AppState.pub.settings && AppState.pub.settings.appName) || 'Digital Product Hub';
}

function setLayout(layout) {
  document.body.classList.remove('layout-public', 'layout-member', 'layout-admin', 'layout-bare');
  document.body.classList.add('layout-' + layout);
  document.getElementById('sidebar').hidden = layout !== 'admin';
  document.getElementById('topnav').hidden = layout !== 'member';
  document.getElementById('pubnav').hidden = layout !== 'public';
  if (layout === 'admin') renderSidebar();
  if (layout === 'member') renderTopnav();
  if (layout === 'public') renderPubnav();
}

function updateActiveNav(name) {
  document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('is-active', el.dataset.nav === name));
}


// ════════════════════════════════════════════════════════════
// 6. UTILITAS
// ════════════════════════════════════════════════════════════
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escAttr(v) { return esc(v).replace(/\\/g, '\\\\'); }
function jsArg(v) { return esc(JSON.stringify(String(v === null || v === undefined ? '' : v))); }
function refreshIcons() { try { lucide.createIcons(); } catch (e) { /* */ } }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function fmtDate(iso) {
  if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function timeAgo(iso) {
  const t = new Date(iso).getTime(); if (!t) return '—';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + ' dtk lalu'; if (s < 3600) return Math.round(s / 60) + ' mnt lalu';
  if (s < 86400) return Math.round(s / 3600) + ' jam lalu'; return fmtDate(iso);
}
function fmtMoney(n) { n = Number(n) || 0; return n === 0 ? 'Gratis' : 'Rp ' + n.toLocaleString('id-ID'); }
function fmtBytes(b) { b = Number(b) || 0; if (b < 1024) return b + ' B'; const u = ['KB', 'MB', 'GB', 'TB']; let i = -1; do { b /= 1024; i++; } while (b >= 1024 && i < 3); return b.toFixed(b < 10 ? 2 : 1) + ' ' + u[i]; }
function initial(t) { return String(t || '?').trim().charAt(0).toUpperCase() || '?'; }
function debounce(fn, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms || 250); }; }
function toInputDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }
function waLink(wa, text) { const n = String(wa || '').replace(/^0/, '62'); return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : ''); }
function isValidWa(v) { return /^08[1-9][0-9]{7,11}$/.test(String(v || '').replace(/[\s\-]/g, '')); }
function normWa(v) {
  let s = String(v || '').replace(/[\s\-().]/g, '');
  if (s.indexOf('+62') === 0) s = '0' + s.slice(3); else if (s.indexOf('62') === 0 && s.length >= 11) s = '0' + s.slice(2);
  return s;
}

const CAT_LABEL = { 'Kelas': 'Kelas', 'Aplikasi': 'Aplikasi', 'Document': 'Dokumen', 'AI Link': 'AI Link', 'Video Series': 'Kelas' };
function catLabel(c) { return CAT_LABEL[c] || c; }
function badgeClassFor(c) {
  if (c === 'Kelas' || c === 'Video Series') return 'badge-video';
  if (c === 'Aplikasi') return 'badge-app';
  if (c === 'AI Link') return 'badge-ai';
  return 'badge-document';
}
function iconFor(c) {
  if (c === 'Kelas' || c === 'Video Series') return 'play-circle';
  if (c === 'Aplikasi') return 'app-window';
  if (c === 'AI Link') return 'sparkles';
  return 'file-text';
}

/** Buka link di tab baru TANPA menampilkan URL di layar/href (Point 9). */
function openLink(url) {
  if (!url) return;
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;
}

/** Gambar Drive: coba URL cadangan lh3 sekali, lalu jatuh ke placeholder. */
function driveImgAlt(url) {
  const m = String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w1000' : '';
}
function onImgError(img) {
  if (!img.dataset.retried) {
    const alt = driveImgAlt(img.src);
    img.dataset.retried = '1';
    if (alt) { img.src = alt; return; }
  }
  if (img.dataset.fallback) { img.src = img.dataset.fallback; img.removeAttribute('data-fallback'); img.onerror = null; }
  else img.style.visibility = 'hidden';
}
function img(src, alt, extra, fallbackText) {
  const fb = 'https://placehold.co/800x500/E2E8F0/64748B?text=' + encodeURIComponent(fallbackText || 'Gambar');
  return '<img src="' + esc(src || fb) + '" alt="' + esc(alt || '') + '" loading="lazy" referrerpolicy="no-referrer" ' +
    'data-fallback="' + esc(fb) + '" onerror="onImgError(this)" ' + (extra || '') + '>';
}

function showToast(title, message, type) {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  const icon = { success: 'check-circle-2', error: 'alert-circle', warning: 'alert-triangle' }[type] || 'info';
  el.className = 'toast is-' + (type || 'info');
  el.innerHTML = '<i data-lucide="' + icon + '" class="w-5 h-5 mt-0.5" style="color:var(--' + (type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'accent') + ')"></i>' +
    '<div class="min-w-0"><p class="toast-title">' + esc(title) + '</p>' + (message ? '<p class="toast-msg">' + esc(message) + '</p>' : '') + '</div>';
  stack.appendChild(el);
  refreshIcons();
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, type === 'error' ? 6000 : 3800);
}
function toastRes(res, okTitle) {
  if (res && res.success) showToast(okTitle || 'Berhasil', res.message, 'success');
  else showToast('Gagal', (res && res.message) || 'Terjadi kesalahan.', 'error');
  return res && res.success;
}

function setBusy(btn, label) {
  if (!btn) return function () {};
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> ' + esc(label || 'Memproses…');
  return function () { btn.disabled = false; btn.innerHTML = html; refreshIcons(); };
}
async function withBusy(btn, label, fn) { const done = setBusy(btn, label); try { return await fn(); } finally { done(); } }

function skeletonCards(n) {
  let s = '';
  for (let i = 0; i < (n || 4); i++) s += '<div class="product-card"><div class="skeleton" style="aspect-ratio:16/10;border-radius:0"></div><div class="p-5 space-y-3"><div class="skeleton h-4 w-24"></div><div class="skeleton h-5 w-3/4"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-10 w-full"></div></div></div>';
  return s;
}
function skeletonRows(n) { let s = ''; for (let i = 0; i < (n || 5); i++) s += '<div class="skeleton h-10 w-full mb-2"></div>'; return s; }
function emptyState(icon, title, sub) {
  return '<div class="empty-state"><div class="empty-icon"><i data-lucide="' + esc(icon) + '" class="w-7 h-7"></i></div>' +
    '<p class="text-base font-semibold text-main">' + esc(title) + '</p>' + (sub ? '<p class="mt-1 text-sm max-w-md">' + esc(sub) + '</p>' : '') + '</div>';
}

function readFileAsBase64(file, maxMB) {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1048576) return reject(new Error('Ukuran maksimal ' + maxMB + ' MB.'));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Gagal membaca berkas.'));
    r.readAsDataURL(file);
  });
}

/** Unggah berkas ke Drive via API. kind: thumb | doc | proof */
async function uploadFile(kind, file, extra) {
  const max = { thumb: 5, doc: 25, proof: 10 }[kind] || 5;
  const b64 = await readFileAsBase64(file, max);
  return api('upload', Object.assign({ kind: kind, base64: b64, fileName: file.name, mimeType: file.type || 'application/octet-stream' }, extra || {}), { timeout: 180000 });
}

function bindDropzone(dropEl, inputEl, onFile) {
  if (!dropEl || !inputEl || dropEl.dataset.bound) return;
  dropEl.dataset.bound = '1';
  dropEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => { if (inputEl.files.length) onFile(inputEl.files[0]); inputEl.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach(ev => dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.remove('is-drag'); }));
  dropEl.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]); });
}

/** Pilih berkas lewat dialog sementara → Promise<File> */
function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept || '*/*'; input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    input.click();
  });
}

function copyText(text) {
  const done = () => showToast('Disalin', text.length > 60 ? text.slice(0, 60) + '…' : text, 'success');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* */ } ta.remove();
}

function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Parser CSV sederhana (tanda kutip, pemisah koma/titik-koma otomatis). */
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.join('').trim() !== '');
}


// ════════════════════════════════════════════════════════════
// 7. MODAL PRATINJAU DOKUMEN / GAMBAR
// ════════════════════════════════════════════════════════════
function previewDocument(previewUrl, downloadUrl, title) {
  document.getElementById('previewTitle').textContent = title || 'Pratinjau';
  const dl = document.getElementById('previewDownload');
  dl.onclick = e => { e.preventDefault(); openLink(downloadUrl); };
  dl.style.display = downloadUrl ? '' : 'none';
  document.getElementById('previewBody').innerHTML = previewUrl
    ? '<iframe src="' + esc(previewUrl) + '" title="Pratinjau" loading="lazy" allow="autoplay"></iframe>'
    : '<p class="text-sm text-muted text-center py-10">Pratinjau tidak tersedia.</p>';
  document.getElementById('previewModal').hidden = false;
  document.body.style.overflow = 'hidden';
  refreshIcons();
}
function previewImage(src, title) {
  document.getElementById('previewTitle').textContent = title || 'Gambar';
  document.getElementById('previewDownload').style.display = 'none';
  document.getElementById('previewBody').innerHTML = '<div class="text-center">' + img(src, title, 'style="max-height:72dvh;margin:0 auto"') + '</div>';
  document.getElementById('previewModal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closePreview() {
  document.getElementById('previewModal').hidden = true;
  document.getElementById('previewBody').innerHTML = '';
  document.body.style.overflow = '';
}


// ════════════════════════════════════════════════════════════
// 8. TEMA & BRAND
// ════════════════════════════════════════════════════════════
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  Store.set('theme', t);
  retintCharts();
}
function toggleDarkMode() { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
function retintCharts() {
  if (!window.Chart) return;
  Chart.defaults.color = cssVar('--text-muted');
  Chart.defaults.borderColor = cssVar('--border');
  Object.keys(AppState.charts).forEach(k => { try { AppState.charts[k].update(); } catch (e) { /* */ } });
}

function brandLogoHtml(size) {
  const s = (AppState.m && AppState.m.settings) || (AppState.pub && AppState.pub.settings) || {};
  const logo = s.logo || Store.get('brandLogo', '');
  const name = s.appName || 'Digital Product Hub';
  if (logo) return '<span class="brand-logo" style="width:' + size + 'px;height:' + size + 'px">' + img(logo, 'Logo', '', name.charAt(0)) + '</span>';
  return '<span class="brand-badge" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 2.4) + 'px">' + esc(initial(name)) + '</span>';
}
function rememberBrand(settings) {
  if (!settings) return;
  Store.set('brandLogo', settings.logo || '');
  Store.set('brandName', settings.appName || '');
}


// ════════════════════════════════════════════════════════════
// 9. SIDEBAR & NAV
// ════════════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('is-open');
  document.getElementById('sidebarScrim').classList.toggle('is-open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('is-open');
  document.getElementById('sidebarScrim').classList.remove('is-open');
}
function setNavBadge(page, count) {
  document.querySelectorAll('[data-badge="' + page + '"]').forEach(b => { b.textContent = count; b.hidden = !count; });
}


// ════════════════════════════════════════════════════════════
// 10. DATATABLES & CHART HELPER
// ════════════════════════════════════════════════════════════
function buildTable(id, cfg) {
  if (AppState.tables[id]) { try { AppState.tables[id].destroy(); } catch (e) { /* */ } delete AppState.tables[id]; }
  const el = document.getElementById(id);
  if (!el || !window.jQuery || !jQuery.fn.dataTable) return null;
  AppState.tables[id] = jQuery(el).DataTable(Object.assign({
    pageLength: 25, lengthMenu: [10, 25, 50, 100, 250], order: [], autoWidth: false, deferRender: true,
    language: {
      search: 'Cari:', lengthMenu: 'Tampilkan _MENU_', info: '_START_–_END_ dari _TOTAL_', infoEmpty: '0 data',
      infoFiltered: '(disaring dari _MAX_)', zeroRecords: 'Tidak ada data yang cocok', emptyTable: 'Belum ada data',
      paginate: { previous: '‹', next: '›' }
    },
    drawCallback: refreshIcons
  }, cfg));
  return AppState.tables[id];
}

function makeChart(id, config) {
  if (!window.Chart) return;
  const cv = document.getElementById(id);
  if (!cv) return;
  if (AppState.charts[id]) { AppState.charts[id].destroy(); }
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.color = cssVar('--text-muted');
  Chart.defaults.borderColor = cssVar('--border');
  AppState.charts[id] = new Chart(cv, config);
}


// ════════════════════════════════════════════════════════════
// 11. BOOT
// ════════════════════════════════════════════════════════════
function hideLoadingOverlay() {
  const o = document.getElementById('loadingOverlay');
  if (!o) return;
  o.style.opacity = '0';
  setTimeout(() => o.remove(), 300);
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(Store.get('theme', 'light'));
  loadSession();
  warmUpServer();
  if (AppState.role === ROLE_ADMIN) AdminLibs.ready();
  window.addEventListener('hashchange', route);
  route();
  hideLoadingOverlay();

  // Validasi sesi & muat data di latar (UI sudah tampil dari cache)
  if (AppState.role === ROLE_MEMBER && typeof Member !== 'undefined') Member.refresh();
  if (AppState.role === ROLE_ADMIN && typeof Admin !== 'undefined') Admin.boot();
  if (typeof Public !== 'undefined') Public.prefetch();

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });

  // Kembali online / app dibuka lagi dari latar belakang (HP) → segarkan data diam-diam
  window.addEventListener('online', () => { showToast('Kembali online', 'Menyegarkan data…', 'success'); refreshCurrent(); });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 120000) { warmUpServer(); refreshCurrent(); }
  });
});

function refreshCurrent() {
  if (AppState.role === ROLE_MEMBER && typeof Member !== 'undefined') Member.refresh();
  else if (AppState.role === ROLE_ADMIN && Pages[AppState.currentPage] && Pages[AppState.currentPage].show) route();
  else if (typeof Public !== 'undefined') Public.prefetch();
}

/** Tampilan gagal dengan tombol "Coba lagi" (dipakai saat belum ada data cache). */
function errorState(msg, retryJs) {
  return '<div class="empty-state"><div class="empty-icon" style="color:var(--warning)"><i data-lucide="wifi-off" class="w-7 h-7"></i></div>' +
    '<p class="text-base font-semibold text-main">Belum bisa terhubung ke server</p><p class="mt-1 text-sm max-w-md">' + esc(msg || '') + '</p>' +
    '<button class="btn-primary !w-auto mt-4" onclick="' + retryJs + '"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Coba lagi</button></div>';
}
