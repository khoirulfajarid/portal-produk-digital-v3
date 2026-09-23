/**
 * ============================================================
 * admin-people.js — Verifikasi Pesanan, CRM Member & Non-Member,
 * Pemberian Akses (drag & drop), Kode Akses
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// VERIFIKASI PESANAN
// ════════════════════════════════════════════════════════════
const OF = { status: 'Pending' };

adminRoute('orders', {
  title: 'Verifikasi Pesanan',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Verifikasi Pesanan', 'Periksa bukti transfer, lalu setujui atau tolak.') +
    '<div id="ordKpi" class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6"></div>' +
    '<div class="app-card rounded-2xl p-5"><div class="flex flex-wrap gap-2 mb-4" id="ordTabs"></div>' +
    '<div class="overflow-x-auto"><table id="tblOrders" class="display w-full"><thead><tr><th>Pesanan</th><th>Member</th><th>Produk</th><th>Nominal</th><th>Channel</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table></div></div></div>',
  show: () => Admin.load('ordersAdmin')
});

ADMIN_RENDER.ordersAdmin = function (d) {
  if (!document.getElementById('tblOrders') || !d) return;
  const k = d.kpi;
  document.getElementById('ordKpi').innerHTML = kpi('Menunggu', k.pending, 'clock', cssVar('--warning')) + kpi('Disetujui', k.approved, 'check-circle-2', cssVar('--success')) +
    kpi('Ditolak', k.rejected, 'x-circle', cssVar('--error')) + kpi('Pendapatan', fmtMoney(k.revenue).replace('Gratis', 'Rp 0'), 'wallet', cssVar('--accent'));
  document.getElementById('ordTabs').innerHTML = [['Pending', 'Menunggu'], ['Approved', 'Disetujui'], ['Rejected', 'Ditolak'], ['all', 'Semua']].map(t =>
    '<button class="chip' + (OF.status === t[0] ? ' chip-active' : '') + '" onclick="OF.status=\'' + t[0] + '\';ADMIN_RENDER.ordersAdmin(AppState.a.ordersAdmin)">' + t[1] + '</button>').join('');
  window._orders = d.orders;
  buildTable('tblOrders', {
    data: d.orders.filter(o => OF.status === 'all' || o.Status === OF.status),
    columns: [
      { data: null, render: o => '<p class="mono text-xs">' + esc(o.Order_ID) + '</p><p class="text-xs text-muted">' + esc(fmtDateTime(o.Created_At)) + '</p>' },
      { data: null, render: o => '<p class="font-medium text-main">' + esc(o.Name || '—') + '</p><p class="text-xs text-muted">' + esc(o.Email) + '</p>' + (o.WhatsApp ? '<p class="text-xs text-muted mono">' + esc(o.WhatsApp) + '</p>' : '') },
      { data: 'Product' },
      { data: 'Amount', render: (v, t) => t === 'display' ? esc(fmtMoney(v)) : v },
      { data: null, render: o => esc(o.Channel) + (o.Note ? '<p class="text-xs text-muted max-w-[220px] truncate" title="' + esc(o.Note) + '">📝 ' + esc(o.Note) + '</p>' : '') },
      { data: 'Status', render: s => statusBadge(s) },
      { data: null, orderable: false, render: o => '<div class="flex gap-1.5">' +
        (o.proofUrl ? '<button class="btn-icon" title="Bukti transfer" onclick="previewDocument(' + jsArg(o.proofUrl) + ',\'\',' + jsArg('Bukti ' + o.Order_ID) + ')"><i data-lucide="image" class="w-4 h-4"></i></button>' : '') +
        (o.Status === 'Pending' ? '<button class="btn-icon" title="Setujui" style="color:var(--success)" onclick="verifyOrder(' + jsArg(o.Order_ID) + ',true)"><i data-lucide="check" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon" title="Tolak" style="color:var(--error)" onclick="verifyOrder(' + jsArg(o.Order_ID) + ',false)"><i data-lucide="x" class="w-4 h-4"></i></button>' : '') +
        (o.WhatsApp ? '<button class="btn-icon" title="Chat WA" onclick="openLink(waLink(' + jsArg(o.WhatsApp) + '))"><i data-lucide="message-circle" class="w-4 h-4"></i></button>' : '') + '</div>' }
    ]
  });
};

async function verifyOrder(id, approve) {
  const o = (window._orders || []).filter(x => x.Order_ID === id)[0] || {};
  const r = await Swal.fire({
    title: approve ? 'Setujui pesanan?' : 'Tolak pesanan?', icon: approve ? 'question' : 'warning', showCancelButton: true, cancelButtonText: 'Batal',
    confirmButtonText: approve ? 'Setujui & Buka Akses' : 'Tolak Pesanan',
    html: '<p class="text-sm">' + esc(o.Email) + '<br><b>' + esc(o.Product) + '</b> · ' + esc(fmtMoney(o.Amount)) + '</p>',
    input: approve ? undefined : 'textarea', inputPlaceholder: 'Alasan penolakan (dikirim ke member)…',
    inputValidator: approve ? undefined : v => !v.trim() && 'Alasan wajib diisi.'
  });
  if (!r.isConfirmed) return;
  Swal.fire({ title: 'Memproses…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const res = await api('verifyOrder', { orderId: id, approve: approve, note: approve ? '' : r.value });
  Swal.close();
  if (toastRes(res)) { Admin.fetch('ordersAdmin'); Admin.fetch('dashboard'); }
}


// ════════════════════════════════════════════════════════════
// CRM — MEMBER & NON-MEMBER (Point 8)
// ════════════════════════════════════════════════════════════
const CF = { tab: 'members', status: 'all', complete: 'all', product: 'all', leadStatus: 'all' };

adminRoute('crm', {
  title: 'CRM Member',
  template: () => '<div class="page-wrap-fluid">' + adminHead('CRM Member & Non-Member', 'Member = akses portal via redeem/beli. Non-Member = pengunjung Open Access yang bertanya lewat WhatsApp/Email.',
      '<button class="btn-ghost !w-auto" onclick="exportCrm()"><i data-lucide="download" class="w-4 h-4"></i> Export CSV</button>' +
      '<button class="btn-primary !w-auto" onclick="openMemberForm()"><i data-lucide="user-plus" class="w-4 h-4"></i> Tambah Member</button>') +
    '<div id="crmKpi" class="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6"></div>' +
    '<div class="app-card rounded-2xl p-5"><div class="flex flex-wrap items-center gap-2 mb-4">' +
      '<div class="seg"><button data-tab="members" onclick="CF.tab=\'members\';ADMIN_RENDER.crm(AppState.a.crm)">Member</button><button data-tab="leads" onclick="CF.tab=\'leads\';ADMIN_RENDER.crm(AppState.a.crm)">Non-Member</button></div>' +
      '<div id="crmFilters" class="flex flex-wrap gap-2 ml-auto"></div></div>' +
      '<div id="crmTableBox" class="overflow-x-auto"></div></div></div>',
  show: () => Admin.load('crm')
});

ADMIN_RENDER.crm = function (d) {
  if (!document.getElementById('crmKpi') || !d) return;
  const m = d.members, l = d.leads;
  const complete = m.filter(x => x.complete).length, blocked = m.filter(x => x.status === 'Blocked').length;
  document.getElementById('crmKpi').innerHTML =
    kpi('Total Member', m.length, 'users', cssVar('--accent')) + kpi('Data Lengkap', complete, 'user-check', cssVar('--success'), (m.length ? Math.round(complete / m.length * 100) : 0) + '%') +
    kpi('Belum Lengkap', m.length - complete, 'user-x', cssVar('--warning')) + kpi('Diblokir', blocked, 'ban', cssVar('--error')) +
    kpi('Non-Member', l.length, 'user-search', cssVar('--indigo'), l.filter(x => x.status === 'Baru').length + ' baru');
  document.querySelectorAll('.seg [data-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.tab === CF.tab));
  const sel = (id, val, opts, onchg) => '<select class="form-input !py-2 !w-auto" onchange="' + onchg + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  const box = document.getElementById('crmTableBox');

  if (CF.tab === 'members') {
    document.getElementById('crmFilters').innerHTML =
      sel('s', CF.status, [['all', 'Semua status'], ['Active', 'Aktif'], ['Blocked', 'Diblokir']], 'CF.status=this.value;ADMIN_RENDER.crm(AppState.a.crm)') +
      sel('c', CF.complete, [['all', 'Semua data'], ['yes', 'Data lengkap'], ['no', 'Belum lengkap']], 'CF.complete=this.value;ADMIN_RENDER.crm(AppState.a.crm)') +
      sel('p', CF.product, [['all', 'Semua produk']].concat(d.products.map(p => [p.id, p.title])), 'CF.product=this.value;ADMIN_RENDER.crm(AppState.a.crm)');
    const rows = m.filter(x => (CF.status === 'all' || x.status === CF.status) && (CF.complete === 'all' || (CF.complete === 'yes') === x.complete) &&
      (CF.product === 'all' || x.productIds.indexOf(CF.product) > -1));
    window._crmRows = rows;
    box.innerHTML = '<table id="tblCrm" class="display w-full"><thead><tr><th>Member</th><th>WhatsApp</th><th>Produk</th><th>Sumber</th><th>Login Terakhir</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table>';
    buildTable('tblCrm', {
      data: rows, columns: [
        { data: null, render: x => '<div class="cell-user"><div class="cell-avatar">' + esc(initial(x.nickname || x.email)) + '</div><div class="min-w-0"><p class="font-medium text-main">' + esc(x.nickname || '—') +
          (x.complete ? '' : ' <span class="badge badge-warning !py-0">belum lengkap</span>') + '</p><p class="text-xs text-muted">' + esc(x.email) + '</p></div></div>' },
        { data: 'whatsapp', render: w => w ? '<button class="mono text-sm text-accent" onclick="openLink(waLink(' + jsArg(w) + '))">' + esc(w) + '</button>' : '<span class="text-muted">—</span>' },
        { data: null, render: (x, t) => t === 'display' ? '<span title="' + esc(x.products.join(', ')) + '">' + x.products.length + ' produk</span>' : x.products.length },
        { data: 'source' },
        { data: 'lastLogin', render: (v, t) => t === 'display' ? (v ? timeAgo(v) : '—') : v },
        { data: 'status', render: s => statusBadge(s) },
        { data: null, orderable: false, render: x => '<div class="flex gap-1.5"><button class="btn-icon" title="Ubah data" onclick="openMemberForm(' + jsArg(x.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon" title="Beri akses" onclick="openAssignModal(' + jsArg(x.email) + ')"><i data-lucide="gift" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon" title="' + (x.status === 'Blocked' ? 'Aktifkan' : 'Blokir') + '" onclick="toggleMember(' + jsArg(x.id) + ')"><i data-lucide="' + (x.status === 'Blocked' ? 'unlock' : 'ban') + '" class="w-4 h-4"></i></button></div>' }
      ]
    });
  } else {
    document.getElementById('crmFilters').innerHTML = sel('ls', CF.leadStatus, [['all', 'Semua status'], ['Baru', 'Baru'], ['Dihubungi', 'Dihubungi'], ['Tertarik', 'Tertarik'], ['Member', 'Jadi Member'], ['Tidak Tertarik', 'Tidak Tertarik']], 'CF.leadStatus=this.value;ADMIN_RENDER.crm(AppState.a.crm)');
    const rows = l.filter(x => CF.leadStatus === 'all' || x.status === CF.leadStatus);
    box.innerHTML = '<table id="tblLeads" class="display w-full"><thead><tr><th>Nama</th><th>Kontak</th><th>Minat</th><th>Via</th><th>Masuk</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody></tbody></table>';
    buildTable('tblLeads', {
      data: rows, columns: [
        { data: 'name', render: v => '<b class="text-main">' + esc(v) + '</b>' },
        { data: null, render: x => '<p class="mono text-sm">' + esc(x.whatsapp) + '</p><p class="text-xs text-muted">' + esc(x.email || '') + '</p>' },
        { data: 'interest', render: v => '<span class="text-sm">' + esc(v || '—') + '</span>' },
        { data: 'channel' },
        { data: 'createdAt', render: (v, t) => t === 'display' ? timeAgo(v) : v },
        { data: null, render: x => '<select class="form-input !py-1 !px-2 !text-xs !w-auto" onchange="saveLead(' + jsArg(x.id) + ',{status:this.value})">' +
          ['Baru', 'Dihubungi', 'Tertarik', 'Member', 'Tidak Tertarik'].map(s => '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' },
        { data: 'note', render: v => '<span class="text-xs text-muted">' + esc(v || '—') + '</span>' },
        { data: null, orderable: false, render: x => '<div class="flex gap-1.5"><button class="btn-icon" title="Chat WA" onclick="openLink(waLink(' + jsArg(x.whatsapp) + ',' + jsArg('Halo ' + x.name + ', ') + '))"><i data-lucide="message-circle" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon" title="Catatan" onclick="editLeadNote(' + jsArg(x.id) + ')"><i data-lucide="sticky-note" class="w-4 h-4"></i></button>' +
          '<button class="btn-icon" title="Hapus" onclick="deleteLead(' + jsArg(x.id) + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>' }
      ]
    });
  }
  refreshIcons();
};

function exportCrm() {
  const d = AppState.a.crm; if (!d) return;
  if (CF.tab === 'members') downloadCsv('member_' + new Date().toISOString().slice(0, 10) + '.csv',
    [['Email', 'Nama', 'WhatsApp', 'Status', 'Lengkap', 'Sumber', 'Terdaftar', 'Login Terakhir', 'Produk']].concat(
      d.members.map(x => [x.email, x.nickname, x.whatsapp, x.status, x.complete ? 'Ya' : 'Tidak', x.source, fmtDate(x.createdAt), fmtDateTime(x.lastLogin), x.products.join('; ')])));
  else downloadCsv('non_member_' + new Date().toISOString().slice(0, 10) + '.csv',
    [['Nama', 'WhatsApp', 'Email', 'Minat', 'Via', 'Status', 'Catatan', 'Masuk']].concat(d.leads.map(x => [x.name, x.whatsapp, x.email, x.interest, x.channel, x.status, x.note, fmtDateTime(x.createdAt)])));
}

async function openMemberForm(id) {
  const d = AppState.a.crm || { members: [], products: [] };
  const m = id ? d.members.filter(x => x.id === id)[0] : null;
  const r = await Swal.fire({
    title: m ? 'Ubah Data Member' : 'Tambah Member', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false, width: 560,
    html: '<div style="text-align:left;display:grid;gap:12px">' +
      '<div><label class="form-label">Email *</label><input id="mfEmail" type="email" class="form-input" value="' + esc(m ? m.email : '') + '">' +
      (m ? '<p class="text-xs text-muted mt-1">Mengganti email akan memindahkan seluruh akses & pesanan ke email baru.</p>' : '') + '</div>' +
      '<div><label class="form-label">Nama Panggilan</label><input id="mfNick" class="form-input" value="' + esc(m ? m.nickname : '') + '"></div>' +
      '<div><label class="form-label">No. WhatsApp</label><input id="mfWa" class="form-input" inputmode="numeric" placeholder="087818485245" value="' + esc(m ? m.whatsapp : '') + '"></div>' +
      (m ? '' : '<div><label class="form-label">Langsung beri akses (opsional)</label><div class="product-picker">' + d.products.map(p =>
        '<label class="picker-row"><input type="checkbox" value="' + esc(p.id) + '" class="mfProd"><span class="text-sm">' + esc(p.title) + '</span><span class="badge ' + badgeClassFor(p.category) + ' ml-auto">' + esc(catLabel(p.category)) + '</span></label>').join('') + '</div></div>') + '</div>',
    preConfirm: () => {
      const email = document.getElementById('mfEmail').value.trim().toLowerCase();
      const wa = normWa(document.getElementById('mfWa').value);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Swal.showValidationMessage('Email tidak valid.');
      if (wa && !isValidWa(wa)) return Swal.showValidationMessage('WA wajib format 08xxxxxxxxxx.');
      return { id: m ? m.id : '', email: email, nickname: document.getElementById('mfNick').value.trim(), whatsapp: wa,
        productIds: Array.from(document.querySelectorAll('.mfProd:checked')).map(c => c.value) };
    }
  });
  if (!r.isConfirmed) return;
  const res = await api(m ? 'updateMember' : 'addMember', r.value);
  if (toastRes(res)) Admin.fetch('crm');
}

async function toggleMember(id) {
  const d = AppState.a.crm; const m = d && d.members.filter(x => x.id === id)[0];
  if (!m) return;
  const blocking = m.status !== 'Blocked';
  const r = await Swal.fire({ title: blocking ? 'Blokir member?' : 'Aktifkan member?', text: m.email + (blocking ? ' tidak akan bisa masuk portal.' : ''), icon: 'warning', showCancelButton: true, confirmButtonText: blocking ? 'Blokir' : 'Aktifkan', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  m.status = blocking ? 'Blocked' : 'Active'; ADMIN_RENDER.crm(d);          // optimistic
  const res = await api('toggleMember', { id: id });
  if (!toastRes(res)) { m.status = blocking ? 'Active' : 'Blocked'; ADMIN_RENDER.crm(d); }
}

async function saveLead(id, patch) {
  const d = AppState.a.crm; const l = d && d.leads.filter(x => x.id === id)[0];
  if (l) Object.assign(l, patch);
  const res = await api('saveLead', Object.assign({ id: id }, patch));
  if (!res.success) showToast('Gagal', res.message, 'error'); else if (patch.note !== undefined) ADMIN_RENDER.crm(d);
}
async function editLeadNote(id) {
  const l = AppState.a.crm.leads.filter(x => x.id === id)[0];
  const r = await Swal.fire({ title: 'Catatan: ' + esc(l.name), input: 'textarea', inputValue: l.note || '', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal' });
  if (r.isConfirmed) saveLead(id, { note: r.value });
}
async function deleteLead(id) {
  const r = await Swal.fire({ title: 'Hapus lead ini?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  const res = await api('deleteLead', { id: id });
  if (toastRes(res)) Admin.fetch('crm');
}


// ════════════════════════════════════════════════════════════
// PEMBERIAN AKSES — drag & drop massal + riwayat
// ════════════════════════════════════════════════════════════
const GA = { selected: [], dropped: [], picked: [], q: '' };

adminRoute('access', {
  title: 'Pemberian Akses',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Pemberian Akses', 'Pilih member (klik), seret ke kotak tujuan, centang produk, lalu berikan akses.') +
    '<div class="grid xl:grid-cols-2 gap-6 mb-6">' +
      '<div class="app-card rounded-2xl p-5"><div class="flex items-center justify-between gap-3 mb-3"><h3 class="font-semibold text-main">Member <span id="gaSel" class="text-sm text-muted"></span></h3>' +
        '<input id="gaSearch" class="form-input !py-2 !w-56" placeholder="Cari email / nama…"></div><div id="gaPool" class="chip-pool"></div></div>' +
      '<div class="app-card rounded-2xl p-5 space-y-4"><div id="gaDrop" class="drop-target"><p class="text-sm text-center"><i data-lucide="mouse-pointer-click" class="w-5 h-5 mx-auto mb-1"></i>Seret member terpilih ke sini</p></div>' +
        '<div><label class="form-label">Produk</label><div id="gaProducts" class="product-picker"></div></div>' +
        '<button id="gaBtn" class="btn-primary w-full" onclick="submitGrant()" disabled><i data-lucide="gift" class="w-4 h-4"></i> Berikan Akses</button></div>' +
    '</div>' +
    '<div class="app-card rounded-2xl p-5"><h3 class="font-semibold text-main mb-3">Riwayat Pemberian Akses</h3><div class="overflow-x-auto"><table id="tblAccess" class="display w-full"><thead><tr><th>Member</th><th>Produk</th><th>Sumber</th><th>Waktu</th><th></th></tr></thead><tbody></tbody></table></div></div></div>',
  mount: () => {
    document.getElementById('gaSearch').addEventListener('input', debounce(e => { GA.q = e.target.value.toLowerCase(); renderGrantPool(); }, 200));
    const drop = document.getElementById('gaDrop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('is-over');
      const emails = GA.selected.length ? GA.selected.slice() : [e.dataTransfer.getData('text/plain')].filter(Boolean);
      emails.forEach(x => { if (GA.dropped.indexOf(x) === -1) GA.dropped.push(x); });
      GA.selected = []; renderGrantPool(); renderGrantDrop();
    });
  },
  show: () => { Admin.load('crm'); loadAccessHistory(); }
});

const _crmRenderBase = ADMIN_RENDER.crm;
ADMIN_RENDER.crm = function (d) { _crmRenderBase(d); if (document.getElementById('gaPool')) { renderGrantPool(); renderGrantProducts(); renderGrantDrop(); } };

function renderGrantPool() {
  const d = AppState.a.crm; const box = document.getElementById('gaPool');
  if (!d || !box) return;
  const list = d.members.filter(m => m.status !== 'Blocked' && GA.dropped.indexOf(m.email) === -1 && (!GA.q || (m.email + ' ' + m.nickname).toLowerCase().indexOf(GA.q) > -1)).slice(0, 300);
  box.innerHTML = list.map(m => '<span class="cust-chip' + (GA.selected.indexOf(m.email) > -1 ? ' is-selected' : '') + '" draggable="true" data-email="' + esc(m.email) + '">' +
    '<span class="chip-avatar">' + esc(initial(m.nickname || m.email)) + '</span>' + esc(m.nickname ? m.nickname + ' · ' + m.email : m.email) + '</span>').join('') || '<p class="text-sm text-muted">Tidak ada member.</p>';
  box.querySelectorAll('.cust-chip').forEach(ch => {
    ch.onclick = () => { const e = ch.dataset.email, i = GA.selected.indexOf(e); if (i > -1) GA.selected.splice(i, 1); else GA.selected.push(e); ch.classList.toggle('is-selected'); updateGrantSel(); };
    ch.ondragstart = ev => { ev.dataTransfer.setData('text/plain', ch.dataset.email); if (GA.selected.indexOf(ch.dataset.email) === -1) GA.selected.push(ch.dataset.email); ch.classList.add('is-dragging'); };
    ch.ondragend = () => ch.classList.remove('is-dragging');
  });
  updateGrantSel();
}
function updateGrantSel() { const el = document.getElementById('gaSel'); if (el) el.textContent = GA.selected.length ? '· ' + GA.selected.length + ' dipilih' : ''; }
function renderGrantDrop() {
  const box = document.getElementById('gaDrop'); if (!box) return;
  box.classList.toggle('has-items', GA.dropped.length > 0);
  box.innerHTML = GA.dropped.length ? '<div class="flex flex-wrap gap-2 w-full">' + GA.dropped.map(e => '<span class="dropped-chip">' + esc(e) + '<button onclick="GA.dropped=GA.dropped.filter(x=>x!==' + esc(JSON.stringify(e)) + ');renderGrantPool();renderGrantDrop()">×</button></span>').join('') +
    '<button class="text-xs text-muted underline" onclick="GA.dropped=[];renderGrantPool();renderGrantDrop()">Kosongkan</button></div>'
    : '<p class="text-sm text-center"><i data-lucide="mouse-pointer-click" class="w-5 h-5 mx-auto mb-1"></i>Seret member terpilih ke sini</p>';
  updateGrantBtn(); refreshIcons();
}
function renderGrantProducts() {
  const d = AppState.a.crm, box = document.getElementById('gaProducts');
  if (!d || !box) return;
  box.innerHTML = d.products.map(p => '<label class="picker-row' + (GA.picked.indexOf(p.id) > -1 ? ' is-checked' : '') + '"><input type="checkbox" ' + (GA.picked.indexOf(p.id) > -1 ? 'checked' : '') +
    ' onchange="togglePick(' + jsArg(p.id) + ',this)"><span class="text-sm flex-1">' + esc(p.title) + '</span><span class="badge ' + badgeClassFor(p.category) + '">' + esc(catLabel(p.category)) + '</span></label>').join('');
}
function togglePick(id, el) { const i = GA.picked.indexOf(id); if (i > -1) GA.picked.splice(i, 1); else GA.picked.push(id); el.closest('.picker-row').classList.toggle('is-checked', el.checked); updateGrantBtn(); }
function updateGrantBtn() {
  const b = document.getElementById('gaBtn'); if (!b) return;
  b.disabled = !(GA.dropped.length && GA.picked.length);
  b.innerHTML = '<i data-lucide="gift" class="w-4 h-4"></i> Berikan Akses' + (GA.dropped.length && GA.picked.length ? ' (' + GA.dropped.length + ' × ' + GA.picked.length + ')' : '');
  refreshIcons();
}
async function submitGrant() {
  const res = await withBusy(document.getElementById('gaBtn'), 'Memberikan akses…', () => api('grantBulk', { emails: GA.dropped, productIds: GA.picked }));
  if (toastRes(res)) { GA.dropped = []; GA.picked = []; Admin.fetch('crm'); loadAccessHistory(); }
}

async function openAssignModal(email) {
  const d = AppState.a.crm; const m = d.members.filter(x => x.email === email)[0];
  const r = await Swal.fire({
    title: 'Beri Akses', width: 560, showCancelButton: true, confirmButtonText: 'Berikan', cancelButtonText: 'Batal',
    html: '<p class="text-sm text-muted mb-3">' + esc(email) + '</p><div class="product-picker" style="max-height:340px;text-align:left">' + d.products.map(p => {
      const own = m && m.productIds.indexOf(p.id) > -1;
      return '<label class="picker-row' + (own ? ' is-checked' : '') + '"><input type="checkbox" class="amProd" value="' + esc(p.id) + '"' + (own ? ' checked disabled' : '') + '><span class="text-sm flex-1">' + esc(p.title) + '</span>' + (own ? '<span class="text-xs text-muted">dimiliki</span>' : '') + '</label>';
    }).join('') + '</div>',
    preConfirm: () => { const ids = Array.from(document.querySelectorAll('.amProd:checked:not(:disabled)')).map(c => c.value); if (!ids.length) return Swal.showValidationMessage('Pilih minimal satu produk baru.'); return ids; }
  });
  if (!r.isConfirmed) return;
  const res = await api('grantBulk', { emails: [email], productIds: r.value });
  if (toastRes(res)) { Admin.fetch('crm'); loadAccessHistory(); }
}

async function loadAccessHistory() {
  const render = list => {
    if (!document.getElementById('tblAccess')) return;
    buildTable('tblAccess', { data: list, columns: [
      { data: 'email' }, { data: 'product' }, { data: 'by' },
      { data: 'at', render: (v, t) => t === 'display' ? fmtDateTime(v) : v },
      { data: null, orderable: false, render: a => '<button class="btn-icon" title="Cabut akses" onclick="revokeAccess(' + jsArg(a.id) + ')"><i data-lucide="user-minus" class="w-4 h-4"></i></button>' }
    ] });
  };
  swr(Admin.key('accessHistory'), 'accessHistory', {}, render);
}
async function revokeAccess(id) {
  const r = await Swal.fire({ title: 'Cabut akses ini?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Cabut', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  const res = await api('revokeAccess', { accessId: id });
  if (toastRes(res)) { loadAccessHistory(); Admin.fetch('crm'); }
}


// ════════════════════════════════════════════════════════════
// KODE AKSES (1 produk = 1 kode, dapat dipakai berkali-kali)
// ════════════════════════════════════════════════════════════
adminRoute('keys', {
  title: 'Kode Akses',
  template: () => '<div class="page-wrap-fluid">' + adminHead('Kode Akses', 'Satu produk memiliki satu kode Lynk.id yang bisa ditukar oleh banyak pembeli.') +
    '<div class="app-card rounded-2xl p-5 mb-6"><form class="grid md:grid-cols-4 gap-4 items-end" onsubmit="generateKey(event)">' +
      '<div class="md:col-span-2"><label class="form-label">Produk (yang belum punya kode)</label><select id="kProd" class="form-input" required></select></div>' +
      '<div><label class="form-label">Kode kustom (opsional)</label><input id="kCode" class="form-input mono" style="text-transform:uppercase" placeholder="otomatis LYNK-XXXXX-X"></div>' +
      '<div><label class="form-label">Kedaluwarsa (opsional)</label><input id="kExp" type="date" class="form-input"></div>' +
      '<button class="btn-primary md:col-span-4 md:!w-auto" type="submit"><i data-lucide="key-round" class="w-4 h-4"></i> Buat Kode</button></form></div>' +
    '<div class="app-card rounded-2xl p-5 overflow-x-auto"><table id="tblKeys" class="display w-full"><thead><tr><th>Kode</th><th>Produk</th><th>Ditukar</th><th>Terakhir oleh</th><th>Kedaluwarsa</th><th>Aksi</th></tr></thead><tbody></tbody></table></div></div>',
  show: () => Admin.load('keysAdmin')
});

ADMIN_RENDER.keysAdmin = function (d) {
  if (!document.getElementById('tblKeys') || !d) return;
  document.getElementById('kProd').innerHTML = d.products.length ? d.products.map(p => '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>').join('') : '<option value="">Semua produk sudah memiliki kode</option>';
  window._keys = d.keys;
  buildTable('tblKeys', { data: d.keys, columns: [
    { data: 'code', render: c => '<span class="mono font-semibold">' + esc(c) + '</span> <button class="btn-icon !w-7 !h-7" onclick="copyText(' + jsArg(c) + ')"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>' },
    { data: 'product' }, { data: 'count', render: v => v + '×' },
    { data: 'lastEmail', render: v => esc(v || '—') },
    { data: 'expiry', render: (v, t) => t === 'display' ? (v ? fmtDate(v) + (new Date(v) < new Date() ? ' <span class="badge badge-error">habis</span>' : '') : 'Tanpa batas') : v },
    { data: null, orderable: false, render: k => '<div class="flex gap-1.5"><button class="btn-icon" onclick="editKey(' + jsArg(k.id) + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>' +
      '<button class="btn-icon" onclick="deleteKey(' + jsArg(k.id) + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>' }
  ] });
};

async function generateKey(e) {
  e.preventDefault();
  const pid = document.getElementById('kProd').value;
  if (!pid) return;
  const res = await withBusy(e.submitter, 'Membuat…', () => api('generateKey', { productId: pid, customCode: document.getElementById('kCode').value.trim(), expiry: document.getElementById('kExp').value }));
  if (toastRes(res)) { document.getElementById('kCode').value = ''; copyText(res.data.code); Admin.fetch('keysAdmin'); }
}
async function editKey(id) {
  const k = window._keys.filter(x => x.id === id)[0];
  const r = await Swal.fire({ title: 'Ubah Kode', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div style="text-align:left;display:grid;gap:12px"><div><label class="form-label">Kode</label><input id="ekCode" class="form-input mono" value="' + esc(k.code) + '"></div>' +
      '<div><label class="form-label">Kedaluwarsa</label><input id="ekExp" type="date" class="form-input" value="' + toInputDate(k.expiry) + '"></div></div>',
    preConfirm: () => ({ id: id, code: document.getElementById('ekCode').value.trim(), expiry: document.getElementById('ekExp').value }) });
  if (!r.isConfirmed) return;
  if (toastRes(await api('editKey', r.value))) Admin.fetch('keysAdmin');
}
async function deleteKey(id) {
  const r = await Swal.fire({ title: 'Hapus kode?', text: 'Pembeli baru tidak bisa redeem dengan kode ini lagi. Akses yang sudah diberikan tetap aman.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
  if (!r.isConfirmed) return;
  if (toastRes(await api('deleteKey', { id: id }))) Admin.fetch('keysAdmin');
}
