/**
 * ============================================================
 * custom.js — Aplikasi Custom (portal member) + Pendaftaran Member
 * Wizard: Data Diri → Ketentuan → Pertanyaan Dasar → Kesepakatan Harga
 * Status : Baru → Penawaran → Disepakati → Dikerjakan → Selesai → Diterima
 * ============================================================
 */

const CUSTOM_FLOW = ['Baru', 'Penawaran', 'Disepakati', 'Dikerjakan', 'Selesai', 'Diterima'];
const CUSTOM_STATUS_LABEL = {
  Baru: 'Menunggu Penawaran', Penawaran: 'Penawaran Tersedia', Disepakati: 'Harga Disepakati', Dikerjakan: 'Sedang Dikerjakan',
  Selesai: 'Siap Diunduh', Diterima: 'Diterima', Ditolak: 'Ditolak', Dibatalkan: 'Dibatalkan'
};
const CUSTOM_BADGE = { Baru: 'badge-warning', Penawaran: 'badge-ai', Disepakati: 'badge-video', Dikerjakan: 'badge-video', Selesai: 'badge-success', Diterima: 'badge-success', Ditolak: 'badge-error', Dibatalkan: 'badge-document' };
function customBadge(s) { return '<span class="badge ' + (CUSTOM_BADGE[s] || 'badge-document') + '"><span class="dot"></span>' + esc(CUSTOM_STATUS_LABEL[s] || s) + '</span>'; }
function customData() { return (AppState.m && AppState.m.custom) || { config: { enabled: false, questions: [], pricing: {} }, requests: [] }; }

/** Salin satu jawaban / semua jawaban (dipakai member & admin). */
window._copyBuf = [];
function copyBtn(text, small) {
  window._copyBuf.push(String(text || ''));
  return '<button type="button" class="btn-icon' + (small ? ' !w-7 !h-7' : '') + '" title="Salin" onclick="copyText(_copyBuf[' + (window._copyBuf.length - 1) + '])"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>';
}
function answersHtml(answers) {
  window._copyBuf = [];
  const all = answers.map((x, i) => (i + 1) + '. ' + x.q + '\n' + x.a).join('\n\n');
  return '<div class="flex items-center justify-between mb-3"><h3 class="font-semibold text-main">Jawaban Kebutuhan</h3>' +
    '<button type="button" class="btn-ghost !w-auto !py-1.5 !text-xs" onclick="copyText(_copyBuf[0])"><i data-lucide="copy" class="w-3.5 h-3.5"></i> Salin semua</button></div>' +
    (window._copyBuf.push(all), '') +
    '<div class="space-y-2">' + answers.map(x => '<div class="answer-row"><div class="min-w-0 flex-1"><p class="text-xs font-semibold text-muted">' + esc(x.q) + '</p>' +
      '<p class="text-sm text-main whitespace-pre-line break-words mt-0.5">' + esc(x.a) + '</p></div>' + copyBtn(x.a, true) + '</div>').join('') + '</div>';
}


// ════════════════════════════════════════════════════════════
// DAFTAR PENGAJUAN (member)
// ════════════════════════════════════════════════════════════
registerPage('custom', {
  title: 'Aplikasi Custom',
  template: () => '<div class="page-wrap" id="customRoot">' + skeletonRows(4) + '</div>',
  show: () => { if (AppState.m) renderCustomList(); Member.softRefresh(); }
});

function renderCustomList() {
  const root = document.getElementById('customRoot');
  if (!root || !AppState.m) return;
  const c = customData(), list = c.requests;
  root.innerHTML =
    '<div class="custom-hero"><div class="min-w-0"><span class="hero-kicker"><i data-lucide="wand-sparkles" class="w-4 h-4"></i> Jasa Pembuatan Aplikasi</span>' +
      '<h1 class="page-title mt-3">Aplikasi Custom Berbasis Apps Script</h1><p class="page-sub max-w-2xl">' + esc(c.config.intro || '') + '</p></div>' +
      (c.config.enabled ? '<button class="btn-primary !w-auto" onclick="go(\'custom-new\')"><i data-lucide="plus" class="w-4 h-4"></i> Ajukan Aplikasi Baru</button>'
                        : '<span class="badge badge-document">Layanan sedang ditutup sementara</span>') + '</div>' +
    '<h2 class="text-lg font-semibold text-main mt-8 mb-3">Pengajuan Saya</h2>' +
    (list.length ? '<div class="space-y-4">' + list.map(r => {
      const step = CUSTOM_FLOW.indexOf(r.status);
      return '<button class="custom-card" onclick="go(\'custom-detail\',' + jsArg(r.id) + ')">' +
        '<div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0 text-left"><p class="mono text-xs text-muted">' + esc(r.id) + ' · ' + esc(fmtDate(r.createdAt)) + '</p>' +
        '<p class="font-semibold text-main mt-1 line-clamp-2">' + esc(r.title) + '</p></div>' + customBadge(r.status) + '</div>' +
        (step > -1 ? '<div class="mini-flow">' + CUSTOM_FLOW.map((s, i) => '<span class="' + (i <= step ? 'is-done' : '') + '"></span>').join('') + '</div>' : '') +
        '<p class="text-xs text-muted mt-2 text-left">' + customNextHint(r) + '</p></button>';
    }).join('') + '</div>'
      : emptyState('wand-sparkles', 'Belum ada pengajuan', 'Ceritakan aplikasi yang Anda butuhkan — Admin akan mengirim penawaran harga.'));
  refreshIcons();
}

function customNextHint(r) {
  switch (r.status) {
    case 'Baru': return 'Admin sedang meninjau kebutuhan Anda.';
    case 'Penawaran': return '👉 Penawaran harga menunggu persetujuan Anda.';
    case 'Disepakati': return 'Harga disepakati (' + fmtMoney(r.finalPrice) + '). Admin menyiapkan jadwal pengerjaan.';
    case 'Dikerjakan': return 'Estimasi selesai: ' + fmtDate(r.estimateDate) + (r.progressNote ? ' · ' + esc(r.progressNote.slice(0, 80)) : '');
    case 'Selesai': return '👉 Aplikasi siap diunduh. Klik untuk menerima.';
    case 'Diterima': return 'Aplikasi sudah Anda terima. Terima kasih!';
    default: return '';
  }
}


// ════════════════════════════════════════════════════════════
// WIZARD PENGAJUAN BARU (4 langkah, draf tersimpan otomatis)
// ════════════════════════════════════════════════════════════
const CW = { step: 1, data: {} };

registerPage('custom-new', {
  title: 'Ajukan Aplikasi Custom',
  template: () => '<div class="page-wrap max-w-3xl" id="customNewRoot">' + skeletonRows(5) + '</div>',
  show: () => {
    if (!AppState.m) { Member.refresh().then(() => { if (AppState.currentPage === 'custom-new') customWizardStart(); }); return; }
    customWizardStart();
  }
});

function customDraftKey() { return userKey('customDraft'); }
function customWizardStart() {
  const p = Member.profile();
  const draft = Store.get(customDraftKey(), null);
  CW.data = draft || { fullName: p.fullName || '', whatsapp: p.whatsapp || '', profession: p.profession || '', agreeDisclaimer: false, answers: {}, pricingChoice: '', proposedPrice: '', customerNote: '', agreeTerms: false };
  CW.step = 1;
  renderCustomWizard();
  if (draft) showToast('Draf dipulihkan', 'Isian terakhir Anda dilanjutkan.', 'info');
}
function saveCustomDraft() { collectWizard(); Store.set(customDraftKey(), CW.data); }

function renderCustomWizard() {
  const root = document.getElementById('customNewRoot');
  if (!root) return;
  const c = customData().config;
  if (!c.enabled) { root.innerHTML = emptyState('pause-circle', 'Layanan ditutup sementara', 'Silakan kembali lagi nanti.'); refreshIcons(); return; }
  const d = CW.data, steps = ['Data Diri', 'Ketentuan', 'Kebutuhan', 'Kesepakatan'];
  let body = '';

  if (CW.step === 1) {
    body = '<div class="grid gap-4">' +
      '<div><label class="form-label">Nama Lengkap *</label><input id="cwName" class="form-input" value="' + esc(d.fullName) + '" placeholder="Nama sesuai identitas"></div>' +
      '<div><label class="form-label">Email</label><input class="form-input" value="' + esc(AppState.email) + '" disabled></div>' +
      '<div><label class="form-label">No. WhatsApp *</label><input id="cwWa" class="form-input" inputmode="numeric" maxlength="16" value="' + esc(d.whatsapp) + '" placeholder="087818485245"><p class="text-xs text-muted mt-1">Format 08xxxxxxxxxx, dipakai Admin untuk konfirmasi.</p></div>' +
      '<div><label class="form-label">Profesi *</label><input id="cwProf" class="form-input" value="' + esc(d.profession) + '" placeholder="mis. Guru, Pemilik Toko, Staf TU"></div></div>';
  } else if (CW.step === 2) {
    body = '<div class="disclaimer-box">' + esc(c.disclaimer) + '</div>' +
      '<label class="agree-row mt-4"><input type="checkbox" id="cwAgree1"' + (d.agreeDisclaimer ? ' checked' : '') + '><span>Saya sudah <b>membaca, paham, dan setuju</b> dengan seluruh ketentuan di atas.</span></label>';
  } else if (CW.step === 3) {
    body = '<p class="text-sm text-muted mb-4">Semua pertanyaan <b>wajib dijawab</b>. Jawaban jelas = penawaran lebih tepat.</p><div class="grid gap-5">' +
      c.questions.map((q, i) => {
        const v = d.answers[q.id] || '';
        let input;
        if (q.type === 'choice') input = '<div class="choice-grid">' + (q.options || []).map(o => '<label class="choice-opt"><input type="radio" name="cwq_' + esc(q.id) + '" value="' + esc(o) + '"' + (v === o ? ' checked' : '') + '><span>' + esc(o) + '</span></label>').join('') + '</div>';
        else if (q.type === 'short') input = '<input class="form-input" data-q="' + esc(q.id) + '" value="' + esc(v) + '">';
        else input = '<textarea class="form-input" rows="3" data-q="' + esc(q.id) + '">' + esc(v) + '</textarea>';
        return '<div><label class="form-label">' + (i + 1) + '. ' + esc(q.label) + ' *</label>' + (q.help ? '<p class="text-xs text-muted -mt-1 mb-1.5">' + esc(q.help) + '</p>' : '') + input + '</div>';
      }).join('') + '</div>';
  } else {
    const pr = c.pricing || {};
    const opt = (key, label, desc) => '<label class="price-opt' + (d.pricingChoice === key ? ' is-selected' : '') + '"><input type="radio" name="cwPrice" value="' + key + '"' + (d.pricingChoice === key ? ' checked' : '') + ' onchange="saveCustomDraft();renderCustomWizard()">' +
      '<span class="min-w-0"><b>' + esc(label) + '</b><small>' + esc(desc || '') + '</small></span></label>';
    const answers = c.questions.map(q => ({ q: q.label, a: d.answers[q.id] || '' }));
    body = '<p class="form-label">Pilih kesepakatan harga *</p><div class="grid gap-3">' +
      opt('exclusive', pr.exclusiveLabel, pr.exclusiveDesc) + opt('resale', pr.resaleLabel, pr.resaleDesc) + opt('propose', pr.proposeLabel, pr.proposeDesc) + '</div>' +
      (d.pricingChoice === 'propose' ? '<div class="mt-4"><label class="form-label">Harga yang Anda ajukan (Rp) *</label><input id="cwPrice" type="number" min="0" step="10000" class="form-input" value="' + esc(d.proposedPrice) + '" placeholder="750000"></div>' : '') +
      '<div class="mt-4"><label class="form-label">Catatan khusus ' + (d.pricingChoice === 'propose' ? '*' : '(opsional)') + '</label><textarea id="cwNote" class="form-input" rows="3" placeholder="Permintaan khusus, contoh tampilan, integrasi, dll.">' + esc(d.customerNote) + '</textarea></div>' +
      '<div class="app-card rounded-2xl p-5 mt-6">' + answersHtml(answers) + '</div>' +
      '<label class="agree-row mt-5"><input type="checkbox" id="cwAgree2"' + (d.agreeTerms ? ' checked' : '') + '><span>' + esc(c.agreement) + '</span></label>';
  }

  root.innerHTML =
    '<button class="text-sm text-muted hover:text-main inline-flex items-center gap-1 mb-4" onclick="go(\'custom\')"><i data-lucide="arrow-left" class="w-4 h-4"></i> Pengajuan Saya</button>' +
    '<h1 class="page-title">Ajukan Aplikasi Custom</h1>' +
    '<div class="stepper !px-0 !border-0 mt-4 mb-2">' + steps.map((s, i) => (i ? '<div class="step-line"></div>' : '') +
      '<div class="step' + (i + 1 === CW.step ? ' is-active' : i + 1 < CW.step ? ' is-done' : '') + '"><span class="step-dot">' + (i + 1 < CW.step ? '✓' : i + 1) + '</span><span class="step-label">' + s + '</span></div>').join('') + '</div>' +
    '<div class="app-card rounded-2xl p-6 mt-4">' + body + '</div>' +
    '<div class="flex gap-3 mt-6">' +
      (CW.step > 1 ? '<button class="btn-ghost flex-1" onclick="customWizardGo(-1)"><i data-lucide="arrow-left" class="w-4 h-4"></i> Kembali</button>' : '') +
      (CW.step < 4 ? '<button class="btn-primary flex-1" onclick="customWizardGo(1)">' + (CW.step === 2 ? 'Paham & Setuju, Lanjut' : 'Lanjut') + ' <i data-lucide="arrow-right" class="w-4 h-4"></i></button>'
                   : '<button id="cwSubmit" class="btn-primary flex-1" onclick="submitCustom()"><i data-lucide="send" class="w-4 h-4"></i> Kirim Pengajuan</button>') +
    '</div><p class="text-xs text-muted text-center mt-3">Isian tersimpan otomatis sebagai draf di perangkat ini.</p>';
  root.querySelectorAll('input,textarea').forEach(el => el.addEventListener('input', debounce(saveCustomDraft, 400)));
  root.querySelectorAll('input[type=radio]').forEach(el => el.addEventListener('change', saveCustomDraft));
  window.scrollTo(0, 0);
  refreshIcons();
}

function collectWizard() {
  const d = CW.data, v = id => { const el = document.getElementById(id); return el ? el.value : null; };
  if (CW.step === 1) { d.fullName = (v('cwName') || '').trim(); d.whatsapp = normWa(v('cwWa') || ''); d.profession = (v('cwProf') || '').trim(); }
  if (CW.step === 2) { const a = document.getElementById('cwAgree1'); if (a) d.agreeDisclaimer = a.checked; }
  if (CW.step === 3) {
    document.querySelectorAll('#customNewRoot [data-q]').forEach(el => d.answers[el.dataset.q] = el.value.trim());
    document.querySelectorAll('#customNewRoot input[type=radio]:checked').forEach(el => d.answers[el.name.replace('cwq_', '')] = el.value);
  }
  if (CW.step === 4) {
    const r = document.querySelector('input[name=cwPrice]:checked'); if (r) d.pricingChoice = r.value;
    if (v('cwPrice') !== null) d.proposedPrice = v('cwPrice');
    if (v('cwNote') !== null) d.customerNote = v('cwNote').trim();
    const a = document.getElementById('cwAgree2'); if (a) d.agreeTerms = a.checked;
  }
}

function customWizardGo(dir) {
  collectWizard();
  const d = CW.data, c = customData().config;
  if (dir > 0) {
    if (CW.step === 1) {
      if (d.fullName.length < 3) return showToast('Lengkapi data', 'Nama lengkap minimal 3 karakter.', 'warning');
      if (!isValidWa(d.whatsapp)) return showToast('No. WhatsApp tidak valid', 'Format 08xxxxxxxxxx, contoh 087818485245.', 'warning');
      if (d.profession.length < 2) return showToast('Lengkapi data', 'Profesi wajib diisi.', 'warning');
    }
    if (CW.step === 2 && !d.agreeDisclaimer) return showToast('Wajib disetujui', 'Centang "paham dan setuju" untuk melanjutkan.', 'warning');
    if (CW.step === 3) {
      const miss = c.questions.filter(q => !(d.answers[q.id] || '').trim());
      if (miss.length) return showToast('Pertanyaan belum dijawab', miss.length + ' pertanyaan wajib: "' + miss[0].label + '"', 'warning');
    }
  }
  Store.set(customDraftKey(), d);
  CW.step = Math.min(4, Math.max(1, CW.step + dir));
  renderCustomWizard();
}

async function submitCustom() {
  collectWizard();
  const d = CW.data;
  if (!d.pricingChoice) return showToast('Pilih opsi harga', '', 'warning');
  if (d.pricingChoice === 'propose' && !(Number(d.proposedPrice) > 0)) return showToast('Isi harga ajuan', '', 'warning');
  if (d.pricingChoice === 'propose' && !d.customerNote) return showToast('Isi catatan', 'Catatan wajib saat mengajukan harga sendiri.', 'warning');
  if (!d.agreeTerms) return showToast('Centang kesepakatan', '', 'warning');
  const res = await withBusy(document.getElementById('cwSubmit'), 'Mengirim…', () => api('customSubmit', d));
  if (!res.success) return Swal.fire({ icon: 'error', title: 'Belum terkirim', text: res.message });
  Store.del(customDraftKey());
  AppState.m.custom.requests = res.data.requests;
  AppState.m.profile.fullName = d.fullName; AppState.m.profile.profession = d.profession; AppState.m.profile.whatsapp = d.whatsapp;
  Store.set(userKey('boot'), { t: Date.now(), data: AppState.m });
  await Swal.fire({ icon: 'success', title: 'Pengajuan terkirim!', html: 'Nomor pengajuan <b class="mono">' + esc(res.data.id) + '</b>.<br>Admin akan mengirim penawaran harga — cek email/WhatsApp Anda.' });
  go('custom-detail', res.data.id);
}


// ════════════════════════════════════════════════════════════
// DETAIL PENGAJUAN (member)
// ════════════════════════════════════════════════════════════
registerPage('custom-detail', {
  title: 'Detail Pengajuan',
  template: () => '<div class="page-wrap max-w-5xl" id="customDetailRoot">' + skeletonRows(5) + '</div>',
  show: (el, id) => { AppState.customId = id; if (AppState.m) renderCustomDetail(); Member.softRefresh(); }
});

function renderCustomDetail() {
  const root = document.getElementById('customDetailRoot');
  if (!root || !AppState.m) return;
  const r = customData().requests.filter(x => x.id === AppState.customId)[0];
  if (!r) { root.innerHTML = emptyState('search-x', 'Pengajuan tidak ditemukan', ''); refreshIcons(); return; }
  const c = customData().config, pr = c.pricing || {};
  const step = CUSTOM_FLOW.indexOf(r.status);
  const choiceLabel = { exclusive: pr.exclusiveLabel, resale: pr.resaleLabel, propose: pr.proposeLabel, special: 'Harga Khusus', manual: 'Kesepakatan langsung' };

  let action = '';
  if (r.status === 'Baru') {
    action = '<div class="notice"><i data-lucide="hourglass" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Admin sedang meninjau kebutuhan Anda. Penawaran harga akan dikirim lewat email/WhatsApp.</p></div>' +
      '<button class="btn-ghost !w-auto mt-4" onclick="customCancel(' + jsArg(r.id) + ')"><i data-lucide="x-circle" class="w-4 h-4"></i> Batalkan Pengajuan</button>';
  } else if (r.status === 'Penawaran' && r.quote) {
    const q = r.quote, opts = [];
    if (q.exclusivePrice) opts.push(['exclusive', pr.exclusiveLabel, pr.exclusiveDesc, q.exclusivePrice]);
    if (q.resalePrice) opts.push(['resale', pr.resaleLabel, pr.resaleDesc, q.resalePrice]);
    if (q.specialPrice) opts.push(['special', 'Tanggapan untuk Harga Ajuan Anda', 'Harga khusus dari Admin atas pengajuan harga Anda.', q.specialPrice]);
    action = '<h3 class="font-semibold text-main mb-3">Penawaran Harga</h3>' + (q.note ? '<div class="notice mb-4"><i data-lucide="message-square-text" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1 whitespace-pre-line">' + esc(q.note) + '</p></div>' : '') +
      '<div class="grid gap-3">' + opts.map((o, i) => '<label class="price-opt"><input type="radio" name="cqOpt" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '><span class="min-w-0 flex-1"><b>' + esc(o[1]) + '</b><small>' + esc(o[2] || '') + '</small></span><span class="price-tag">' + esc(fmtMoney(o[3])) + '</span></label>').join('') + '</div>' +
      '<label class="agree-row mt-4"><input type="checkbox" id="cqAgree"><span>Saya menyetujui harga yang saya pilih dan ketentuan pengerjaan.</span></label>' +
      '<div class="flex flex-wrap gap-3 mt-4"><button id="cqBtn" class="btn-primary !w-auto" onclick="customAcceptQuote(' + jsArg(r.id) + ')"><i data-lucide="handshake" class="w-4 h-4"></i> Setujui Penawaran</button>' +
      '<button class="btn-ghost !w-auto" onclick="contactAdmin(\'Nego penawaran ' + esc(r.id) + '\')"><i data-lucide="message-circle" class="w-4 h-4"></i> Diskusi dengan Admin</button>' +
      '<button class="btn-ghost !w-auto" onclick="customCancel(' + jsArg(r.id) + ')">Batalkan</button></div>';
  } else if (r.status === 'Disepakati') {
    action = '<div class="notice notice-success"><i data-lucide="handshake" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Harga disepakati: <b>' + esc(fmtMoney(r.finalPrice)) + '</b> (' + esc(choiceLabel[r.finalChoice] || r.finalChoice) + '). Admin sedang menyiapkan jadwal pengerjaan.</p></div>';
  } else if (r.status === 'Dikerjakan') {
    action = '<div class="estimate-box"><i data-lucide="calendar-clock" class="w-7 h-7"></i><div><p class="stat-label">Estimasi Selesai</p><p class="text-2xl font-bold text-main">' + esc(fmtDate(r.estimateDate)) + '</p></div></div>' +
      (r.progressNote ? '<div class="notice mt-4"><i data-lucide="activity" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1 whitespace-pre-line"><b>Progres terbaru:</b> ' + esc(r.progressNote) + '</p></div>' : '');
  } else if (r.status === 'Selesai' || r.status === 'Diterima') {
    const dv = r.delivery || {};
    action = '<h3 class="font-semibold text-main mb-3">🎉 Aplikasi Anda Sudah Jadi</h3>' +
      (dv.videoEmbed ? '<div class="video-frame mb-4"><iframe src="' + esc(dv.videoEmbed) + '" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div>' : '') +
      (dv.note ? '<p class="text-sm text-muted whitespace-pre-line mb-4">' + esc(dv.note) + '</p>' : '') +
      '<div class="flex flex-wrap gap-3">' + (dv.fileUrl ? '<button class="btn-primary !w-auto" onclick="openLink(' + jsArg(dv.fileUrl) + ')"><i data-lucide="download" class="w-4 h-4"></i> Download Aplikasi (.zip)</button>' : '') +
      (r.status === 'Selesai' ? '<button class="btn-ghost !w-auto" onclick="customAcceptDelivery(' + jsArg(r.id) + ')"><i data-lucide="check-circle-2" class="w-4 h-4"></i> Oke, Aplikasi Diterima</button>' : '') + '</div>' +
      (r.status === 'Diterima' && !r.demoConsent ? '<div class="notice notice-warning mt-4"><i data-lucide="presentation" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Bolehkah aplikasi ini dibuatkan demo untuk etalase pameran kami?</p><button class="btn-primary !w-auto" onclick="customDemoConsent(' + jsArg(r.id) + ')">Jawab</button></div>' : '') +
      (r.demoConsent ? '<p class="text-xs text-muted mt-3">Izin etalase: ' + (r.demoConsent === 'yes' ? 'boleh dibuatkan demo' : 'hanya preview video sekilas') + '.</p>' : '');
  } else {
    action = '<div class="notice notice-error"><i data-lucide="x-circle" class="w-5 h-5 flex-none"></i><p class="text-sm flex-1">Pengajuan ' + esc(r.status === 'Ditolak' ? 'ditolak Admin' : 'dibatalkan') + '.' +
      (r.history.length ? ' ' + esc(r.history[r.history.length - 1].note || '') : '') + '</p></div>';
  }

  root.innerHTML =
    '<button class="text-sm text-muted hover:text-main inline-flex items-center gap-1 mb-4" onclick="go(\'custom\')"><i data-lucide="arrow-left" class="w-4 h-4"></i> Pengajuan Saya</button>' +
    '<div class="flex flex-wrap items-start justify-between gap-3 mb-5"><div class="min-w-0"><p class="mono text-xs text-muted">' + esc(r.id) + ' · diajukan ' + esc(fmtDateTime(r.createdAt)) + '</p>' +
      '<h1 class="page-title mt-1">' + esc(r.title) + '</h1></div>' + customBadge(r.status) + '</div>' +
    (step > -1 ? '<div class="flow-bar">' + CUSTOM_FLOW.map((s, i) => '<div class="flow-step' + (i < step ? ' is-done' : i === step ? ' is-active' : '') + '"><span>' + (i < step ? '✓' : i + 1) + '</span><small>' + esc(CUSTOM_STATUS_LABEL[s]) + '</small></div>').join('') + '</div>' : '') +
    '<div class="grid lg:grid-cols-[1.4fr_1fr] gap-6 mt-6">' +
      '<div class="space-y-6"><div class="app-card rounded-2xl p-6">' + action + '</div>' +
        '<div class="app-card rounded-2xl p-6">' + answersHtml(r.answers) + '</div></div>' +
      '<div class="space-y-6"><div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-2">Ringkasan</h3>' +
        detailRow('user', 'Nama', r.fullName) + detailRow('briefcase', 'Profesi', r.profession) + detailRow('phone', 'WhatsApp', r.whatsapp) +
        detailRow('tag', 'Pilihan awal', (choiceLabel[r.pricingChoice] || r.pricingChoice) + (r.pricingChoice === 'propose' ? ' · ' + fmtMoney(r.proposedPrice) : '')) +
        (r.finalPrice ? detailRow('badge-check', 'Harga final', fmtMoney(r.finalPrice)) : '') +
        (r.customerNote ? detailRow('sticky-note', 'Catatan Anda', r.customerNote) : '') + '</div>' +
      '<div class="app-card rounded-2xl p-6"><h3 class="font-semibold text-main mb-3">Riwayat</h3>' +
        r.history.slice().reverse().map(h => '<div class="log-row"><div class="log-dot"></div><div class="min-w-0 flex-1"><p class="text-sm text-main"><b>' + esc(CUSTOM_STATUS_LABEL[h.status] || h.status) + '</b></p>' +
          '<p class="text-xs text-muted">' + esc(h.note || '') + ' · ' + esc(fmtDateTime(h.at)) + '</p></div></div>').join('') + '</div></div>' +
    '</div>';
  refreshIcons();
}

async function customRespond(id, payload, btn, label) {
  const res = btn ? await withBusy(btn, label || 'Memproses…', () => api('customRespond', Object.assign({ id: id }, payload))) : await api('customRespond', Object.assign({ id: id }, payload));
  if (!res.success) { Swal.fire({ icon: 'error', title: 'Gagal', text: res.message }); return false; }
  AppState.m.custom.requests = res.data.requests;
  Store.set(userKey('boot'), { t: Date.now(), data: AppState.m });
  showToast('Berhasil', res.message, 'success');
  renderCustomDetail();
  return true;
}
function customAcceptQuote(id) {
  const opt = document.querySelector('input[name=cqOpt]:checked');
  if (!opt) return showToast('Pilih harga', '', 'warning');
  if (!document.getElementById('cqAgree').checked) return showToast('Centang persetujuan', '', 'warning');
  customRespond(id, { action: 'accept_quote', option: opt.value, agree: true }, document.getElementById('cqBtn'), 'Menyetujui…');
}
async function customCancel(id) {
  const r = await Swal.fire({ title: 'Batalkan pengajuan?', input: 'text', inputPlaceholder: 'Alasan (opsional)', icon: 'warning', showCancelButton: true, confirmButtonText: 'Batalkan', cancelButtonText: 'Tidak' });
  if (r.isConfirmed) customRespond(id, { action: 'cancel', reason: r.value });
}
async function customAcceptDelivery(id) {
  const r = await Swal.fire({ title: 'Terima aplikasi?', text: 'Pastikan berkas ZIP sudah Anda unduh & video tutorial sudah ditonton.', icon: 'question', showCancelButton: true, confirmButtonText: 'Oke, Diterima', cancelButtonText: 'Nanti' });
  if (!r.isConfirmed) return;
  if (await customRespond(id, { action: 'accept_delivery' })) customDemoConsent(id);
}
async function customDemoConsent(id) {
  const r = await Swal.fire({
    icon: 'question', title: 'Boleh dibuatkan demo?', showDenyButton: true, confirmButtonText: 'Ya, boleh dibuat demo', denyButtonText: 'Tidak, preview video saja', allowOutsideClick: false,
    html: '<p class="text-sm text-muted">Apakah aplikasi ini boleh kami buatkan <b>demo</b> untuk etalase pameran produk kami?<br><br>Jika tidak, kami hanya menampilkan <b>preview video sekilas</b> di pameran — data Anda tetap aman.</p>'
  });
  if (r.isConfirmed || r.isDenied) customRespond(id, { action: 'demo_consent', consent: r.isConfirmed ? 'yes' : 'no' });
}


// ════════════════════════════════════════════════════════════
// PENDAFTARAN MEMBER (non-member) & CTA publik Aplikasi Custom
// ════════════════════════════════════════════════════════════
async function openRegisterDialog(prefillEmail, reason) {
  const saved = Store.get('lead', {});
  const r = await Swal.fire({
    title: 'Daftar sebagai Member', confirmButtonText: 'Kirim Pendaftaran', showCancelButton: true, cancelButtonText: 'Batal', focusConfirm: false,
    html: '<div style="text-align:left;display:grid;gap:12px">' +
      '<p class="text-sm text-muted">' + esc(reason || 'Isi data berikut. Akun aktif setelah disetujui Admin — kabar dikirim lewat email/WhatsApp.') + '</p>' +
      '<div><label class="form-label">Nama Lengkap *</label><input id="rgName" class="form-input" value="' + esc(saved.name || '') + '"></div>' +
      '<div><label class="form-label">Email *</label><input id="rgEmail" type="email" class="form-input" value="' + esc(typeof prefillEmail === 'string' ? prefillEmail : (saved.email || '')) + '" autocomplete="off"></div>' +
      '<div><label class="form-label">No. WhatsApp *</label><input id="rgWa" class="form-input" inputmode="numeric" placeholder="087818485245" value="' + esc(saved.whatsapp || '') + '"></div>' +
      '<div><label class="form-label">Profesi *</label><input id="rgProf" class="form-input" placeholder="mis. Guru, Pemilik Usaha"></div>' +
      '<div><label class="form-label">Keperluan (opsional)</label><input id="rgNote" class="form-input" placeholder="mis. Ingin pesan aplikasi custom"></div></div>',
    preConfirm: () => {
      const v = { fullName: document.getElementById('rgName').value.trim(), email: document.getElementById('rgEmail').value.trim().toLowerCase(),
        whatsapp: normWa(document.getElementById('rgWa').value), profession: document.getElementById('rgProf').value.trim(), note: document.getElementById('rgNote').value.trim() };
      if (v.fullName.length < 3) return Swal.showValidationMessage('Nama lengkap minimal 3 karakter.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) return Swal.showValidationMessage('Email tidak valid.');
      if (!isValidWa(v.whatsapp)) return Swal.showValidationMessage('No. WhatsApp wajib format 08xxxxxxxxxx.');
      if (v.profession.length < 2) return Swal.showValidationMessage('Profesi wajib diisi.');
      Swal.showLoading();
      return api('register', v).then(res => {
        if (!res.success) { Swal.hideLoading(); Swal.showValidationMessage(res.message); return false; }
        return res;
      });
    },
    allowOutsideClick: () => !Swal.isLoading()
  });
  if (!r.isConfirmed || !r.value) return;
  Swal.fire({ icon: 'success', title: 'Pendaftaran terkirim', text: r.value.message });
}

/** Tombol "Ajukan Aplikasi Custom" di halaman publik. */
async function startCustomOrder() {
  if (AppState.role === ROLE_MEMBER) return go('custom-new');
  const r = await Swal.fire({
    title: 'Ajukan Aplikasi Custom', icon: 'info', showDenyButton: true, showCancelButton: true,
    confirmButtonText: 'Saya sudah member — Masuk', denyButtonText: 'Belum member — Daftar', cancelButtonText: 'Batal',
    html: '<p class="text-sm text-muted">Pengajuan dilakukan di portal member agar progres, penawaran, dan berkas aplikasi tersimpan rapi untuk Anda.</p>'
  });
  if (r.isConfirmed) { Store.set('afterLogin', 'custom-new'); go('login'); }
  else if (r.isDenied) openRegisterDialog('', 'Untuk memesan aplikasi custom, daftar dulu sebagai member. Setelah disetujui Admin, masuk dan ajukan aplikasi Anda.');
}
