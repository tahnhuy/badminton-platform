/* SmashPro — Giải đấu, bản mẫu v1. Vanilla JS, dữ liệu minh họa trong data.js. */
(() => {
  const D = window.SP_DATA;
  const S = window.SP_SCORE;
  const $ = sel => document.querySelector(sel);
  const main = $('#main');
  const state = {
    role: 'player', status: 'IN_PROGRESS', tab: 'info', consoleTab: 'matches',
    filters: { q: '', status: 'all', type: 'all', free: false, fit: false },
    removed: new Set(),
  };

  // ------------------------------------------------------------------ helpers
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const money = v => (v === 0 ? 'Miễn phí' : `${v.toLocaleString('vi-VN')}đ`);
  const lvl = rank => D.levels.find(l => l.rank === rank)?.name ?? '—';
  const range = t => (t.minRank === null && t.maxRank === null ? 'Mọi trình độ'
    : t.minRank === null ? `Đến ${lvl(t.maxRank)}` : t.maxRank === null ? `Từ ${lvl(t.minRank)}` : `${lvl(t.minRank)} – ${lvl(t.maxRank)}`);
  const dt = iso => { const d = new Date(iso); return `${d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${d.toTimeString().slice(0, 5)}`; };
  const statusLabel = { DRAFT: 'Bản nháp', OPEN_FOR_REGISTRATION: 'Đang mở đăng ký', REGISTRATION_CLOSED: 'Đã đóng đăng ký', READY: 'Đã bốc thăm', IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã huỷ' };
  const chip = s => `<span class="chip status-${s}">${statusLabel[s]}</span>`;
  const typeLabel = t => (t === 'SINGLES' ? 'Đơn' : 'Đôi');
  const me = { name: 'Đặng Quỳnh Như', id: 105 };
  const myRank = () => (state.role === 'ineligible' ? 2 : 4);
  const isOrganizer = () => state.role === 'organizer';
  const isRegistered = () => state.role === 'registered';
  const t1 = () => ({ ...D.tournaments[0], status: state.status });
  const toast = msg => { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); };
  const eligible = t => (t.minRank === null || myRank() >= t.minRank) && (t.maxRank === null || myRank() <= t.maxRank);

  function renderHeaderUser() {
    const el = $('#header-user');
    if (state.role === 'visitor') { el.innerHTML = `<a class="btn ghost sm" href="#/">Đăng nhập</a><a class="btn primary sm" href="#/">Tạo tài khoản</a>`; return; }
    const name = isOrganizer() ? 'Nguyễn Văn Tài' : me.name;
    el.innerHTML = `<span class="chip hide-sm">${icon('wallet')}${money(D.wallet.balance)}</span><span class="avatar">${name.split(' ').slice(-2).map(w => w[0]).join('')}</span>`;
  }

  // ------------------------------------------------------------------ list
  function viewList() {
    const f = state.filters;
    const list = D.tournaments.map(t => (t.id === 1 ? t1() : t)).filter(t => {
      if (f.q && !t.name.toLowerCase().includes(f.q.toLowerCase())) return false;
      if (f.status === 'open' && t.status !== 'OPEN_FOR_REGISTRATION') return false;
      if (f.status === 'live' && !['READY', 'IN_PROGRESS', 'REGISTRATION_CLOSED'].includes(t.status)) return false;
      if (f.status === 'done' && !['COMPLETED', 'CANCELLED'].includes(t.status)) return false;
      if (f.type !== 'all' && t.matchType !== f.type) return false;
      if (f.free && t.fee !== 0) return false;
      if (f.fit && !eligible(t)) return false;
      return true;
    });
    const seg = (key, options) => `<div class="seg" role="group">${options.map(([v, label]) => `<button type="button" data-filter="${key}" data-value="${v}" aria-pressed="${f[key] === v}">${label}</button>`).join('')}</div>`;
    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Giải chuyên nghiệp</p><h1>Giải đấu</h1>
          <p class="lead">Tìm giải hợp trình độ, đăng ký và trả lệ phí bằng ví. Kết quả giải chuyên nghiệp quyết định điểm phong độ và bậc trình độ của bạn.</p></div>
        ${state.role === 'visitor' ? '' : `<div style="display:flex;gap:8px"><a class="btn outline" href="#/mine">${icon('user')}Giải của tôi</a><a class="btn primary" href="#/new">${icon('plus')}Tạo giải</a></div>`}
      </div>
      <div class="filters">
        <label class="search">${icon('search')}<span class="sr-only">Tìm giải</span><input id="q" placeholder="Tìm theo tên giải" value="${f.q}"></label>
        ${seg('status', [['all', 'Tất cả'], ['open', 'Đang mở'], ['live', 'Sắp & đang đấu'], ['done', 'Đã xong']])}
        ${seg('type', [['all', 'Đơn & đôi'], ['SINGLES', 'Đơn'], ['DOUBLES', 'Đôi']])}
        <button class="toggle" type="button" data-toggle="free" aria-pressed="${f.free}">Miễn phí</button>
        ${state.role === 'visitor' ? '' : `<button class="toggle" type="button" data-toggle="fit" aria-pressed="${f.fit}">${icon('gauge')}Hợp trình độ tôi</button>`}
      </div>
      <div class="grid">${list.map(card).join('') || '<p class="lead">Không có giải phù hợp bộ lọc.</p>'}</div>`;
    $('#q').addEventListener('input', e => { f.q = e.target.value; const pos = e.target.selectionStart; viewList(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); });
    main.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { f[b.dataset.filter] = b.dataset.value; viewList(); }));
    main.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => { f[b.dataset.toggle] = !f[b.dataset.toggle]; viewList(); }));
  }

  function card(t) {
    const pct = Math.round((t.confirmed / t.limit) * 100);
    const fit = state.role !== 'visitor' && t.status === 'OPEN_FOR_REGISTRATION' && eligible(t);
    return `<a class="t-card" href="#/t/${t.id}">
      ${fit ? `<span class="chip fit-badge" style="background:#e2f6d5;color:#2c6a00">${icon('check')}Hợp trình</span>` : ''}
      <div>${chip(t.status)}</div>
      <h3>${t.name}</h3>
      <div class="meta">
        <span>${icon('calendar')}${dt(t.start)}</span>
        <span>${icon('pin')}${t.venue}</span>
        <span>${icon('gauge')}${range(t)} · ${typeLabel(t.matchType)}</span>
      </div>
      <footer><span class="fee ${t.fee === 0 ? 'free' : ''}">${money(t.fee)}</span>
        <span class="slots">${t.confirmed}/${t.limit} ${t.matchType === 'DOUBLES' ? 'đội' : 'VĐV'}<div class="bar"><i style="width:${pct}%"></i></div></span></footer>
    </a>`;
  }

  // ------------------------------------------------------------------ detail
  function viewDetail(id) {
    const t = id === 1 ? t1() : D.tournaments.find(x => x.id === id);
    if (!t) { main.innerHTML = '<p class="lead">Không tìm thấy giải.</p>'; return; }
    const tabs = [['info', 'Thông tin', icon('flag')], ['people', `Người tham gia <span class="count">${t.confirmed}</span>`, icon('users')], ['bracket', 'Nhánh đấu', icon('trophy')], ['schedule', 'Lịch thi đấu', icon('clock')]];
    main.innerHTML = `
      <section class="hero">
        <div class="hero-grid">
          <div>
            <a class="back" href="#/">${icon('chevron-left')}Tất cả giải</a>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${chip(t.status)}<span class="chip">${icon('trophy')}Chuyên nghiệp</span><span class="chip">${typeLabel(t.matchType)}</span></div>
            <h1>${t.name}</h1>
            <div class="hero-meta"><span>${icon('calendar')}${dt(t.start)}</span><span>${icon('pin')}${t.venue}</span><span>${icon('user')}Tổ chức: ${t.organizer}</span></div>
          </div>
          <div class="hero-cta">${heroCta(t)}</div>
        </div>
        <div class="stats">
          <div><small>Lệ phí</small><strong>${money(t.fee)}</strong></div>
          <div><small>Trình độ</small><strong>${range(t)}</strong></div>
          <div><small>Số lượng</small><strong>${t.confirmed}/${t.limit} ${t.matchType === 'DOUBLES' ? 'đội' : 'VĐV'}</strong></div>
          <div><small>Thể thức</small><strong>Loại trực tiếp · 3 set 21</strong></div>
        </div>
      </section>
      <div class="tabs" role="tablist">${tabs.map(([k, label, ic]) => `<button role="tab" data-tab="${k}" aria-selected="${state.tab === k}">${ic}${label}</button>`).join('')}</div>
      <section id="tab-body"></section>`;
    main.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; viewDetail(id); }));
    main.querySelector('[data-action="register"]')?.addEventListener('click', () => registerDialog(t));
    main.querySelector('[data-action="withdraw"]')?.addEventListener('click', () => withdrawDialog(t));
    main.querySelector('[data-action="share"]')?.addEventListener('click', () => shareDialog(t));
    const body = $('#tab-body');
    if (state.tab === 'info') body.innerHTML = infoTab(t);
    if (state.tab === 'people') body.innerHTML = peopleTab(t);
    if (state.tab === 'bracket') body.innerHTML = id === 1 ? bracketView(t) : emptyBracket(t);
    if (state.tab === 'schedule') body.innerHTML = id === 1 ? scheduleList(t) : emptyBracket(t);
  }

  function heroCta(t) {
    if (isOrganizer()) return `<a class="btn lime lg" href="#/t/${t.id}/manage">${icon('settings')}Quản lý giải</a><span class="note">Bạn là Organizer của giải này.</span>`;
    if (state.role === 'visitor') return t.status === 'OPEN_FOR_REGISTRATION' ? `<a class="btn lime lg" href="#/">Đăng nhập để đăng ký</a>` : '';
    if (t.status === 'COMPLETED' && isRegistered()) return `<button class="btn lime lg" data-action="share">${icon('share')}Chia sẻ kết quả</button><span class="note">Bạn đạt Bán kết · có thể đăng bài vinh danh lên bảng tin.</span>`;
    if (isRegistered()) {
      return t.status === 'OPEN_FOR_REGISTRATION'
        ? `<span class="chip" style="background:var(--lime);color:var(--forest)">${icon('check')}Bạn đã đăng ký</span><button class="btn outline" data-action="withdraw" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.3)">Rút đăng ký (hoàn 100%)</button>`
        : `<span class="chip" style="background:var(--lime);color:var(--forest)">${icon('check')}Bạn đã đăng ký</span><span class="note">Đã đóng đăng ký: không thể rút. Vắng mặt sẽ bị xử thua, không hoàn lệ phí.</span>`;
    }
    if (t.status !== 'OPEN_FOR_REGISTRATION') return `<span class="note">Giải không còn nhận đăng ký.</span>`;
    if (!eligible(t)) return `<button class="btn lime lg" disabled>Đăng ký</button><span class="note">${icon('alert')} Giải dành cho trình <b>${range(t)}</b>. Trình hiện tại của bạn: <b>${lvl(myRank())}</b>.</span>`;
    return `<button class="btn lime lg" data-action="register">Đăng ký · ${money(t.fee)}</button><span class="note">Trừ ví ngay khi đăng ký. Rút trước khi đóng đăng ký được hoàn 100%.</span>`;
  }

  function infoTab(t) {
    const myNext = isRegistered() && t.status === 'IN_PROGRESS' ? `
      <div class="my-match"><span class="eyebrow" style="margin:0">Trận tiếp theo của bạn</span>
        <div class="when">${icon('clock')}09:40 · Sân 2</div>
        <div>Bán kết · gặp <b>Trần Bảo Ngọc</b> (hạt giống 2)</div>
        <div class="notice info">${icon('radio')}Bạn sẽ được nhắc trước 30 phút. Giờ có thể đổi — theo dõi trang này, dữ liệu tự cập nhật.</div>
      </div>` : '';
    return `<div class="two-col">
      <div class="panel"><h2>Thông tin giải</h2>
        <dl class="kv">
          <dt>Thời gian thi đấu</dt><dd>${dt(t.start)} → ${dt(t.end)}</dd>
          <dt>Hạn đăng ký</dt><dd>${dt(t.regEnd)}</dd>
          <dt>Địa điểm</dt><dd>${t.venue}</dd>
          <dt>Nội dung</dt><dd>${typeLabel(t.matchType)} · loại trực tiếp · 3 set, set 21 điểm (cách 2, tối đa 30)</dd>
          <dt>Trình độ</dt><dd>${range(t)}</dd>
          <dt>Lệ phí</dt><dd>${money(t.fee)} — trừ ví khi đăng ký; rút trước hạn hoàn 100%</dd>
          <dt>Tổ chức</dt><dd>${t.organizer}</dd>
        </dl>
        ${t.description ? `<h2 style="margin-top:20px">Thể lệ</h2><p style="margin:0;color:var(--muted)">${t.description}</p>` : ''}
      </div>
      <div style="display:grid;gap:16px;align-content:start">
        ${myNext}
        ${t.status === 'IN_PROGRESS' ? `<div class="notice info">${icon('radio')}Nhánh đấu, lịch và tỉ số cập nhật trực tiếp.</div>` : ''}
        ${isRegistered() || isOrganizer() ? `<a class="panel" style="display:flex;gap:12px;align-items:center;text-decoration:none" href="#/">${icon('message')}<div><b>Nhóm chat của giải</b><div class="lvl" style="color:var(--muted);font-size:13px">9 thành viên · Organizer thông báo tại đây</div></div>${icon('chevron-right')}</a>` : ''}
        <div class="panel"><h2>Quy định</h2><ul style="margin:0;padding-left:18px;color:var(--muted);display:grid;gap:6px;font-size:14px">
          <li>Đã đóng đăng ký thì không rút được.</li><li>Vắng mặt: xử thua (walkover), không hoàn lệ phí.</li>
          <li>Bỏ cuộc giữa trận: ghi nhận các set đã đánh, đối thủ thắng.</li><li>Kết quả dùng để tính điểm phong độ và bậc trình độ.</li></ul></div>
      </div></div>`;
  }

  function peopleTab(t) {
    if (t.id !== 1) return `<div class="panel">${t.confirmed} người đã đăng ký.</div>`;
    const seeds = state.status === 'OPEN_FOR_REGISTRATION' || state.status === 'REGISTRATION_CLOSED';
    return `<div class="panel" style="margin-bottom:40px"><h2>${t.confirmed} vận động viên</h2>
      <div class="people">${D.players.map((p, i) => `<div class="person">
        <span class="seed ${seeds ? 'none' : ''}">${seeds ? '–' : i + 1}</span><span class="avatar">${p.initials}</span>
        <div><div class="name">${p.name}</div><div class="lvl">${lvl(p.rank)}</div></div></div>`).join('')}</div>
      <p class="lead" style="font-size:13px;margin-top:12px">${seeds ? 'Hạt giống được công bố sau khi bốc thăm.' : 'Số bên trái là hạt giống.'} Không hiển thị email hay số điện thoại.</p></div>`;
  }

  function emptyBracket(t) {
    return `<div class="panel" style="text-align:center;padding:40px;margin-bottom:40px">${icon('shuffle')}<h2 style="margin-top:8px">Chưa bốc thăm</h2><p class="lead" style="margin-inline:auto">Nhánh đấu và lịch thi đấu xuất hiện sau khi Organizer đóng đăng ký và bốc thăm${t.status === 'OPEN_FOR_REGISTRATION' ? ` (hạn đăng ký ${dt(t.regEnd)})` : ''}.</p></div>`;
  }

  // ------------------------------------------------------------------ bracket
  function bracketRounds() {
    const rounds = JSON.parse(JSON.stringify(D.bracket));
    const done = state.status === 'COMPLETED';
    if (done) {
      rounds[1].matches[0] = { ...rounds[1].matches[0], sets: [[21, 17], [21, 15]], winner: 'a', status: 'COMPLETED' };
      rounds[1].matches[1] = { ...rounds[1].matches[1], sets: [[21, 19], [17, 21], [22, 20]], winner: 'b', status: 'COMPLETED' };
      rounds[2].matches[0] = { ...rounds[2].matches[0], a: rounds[1].matches[0].a, b: rounds[1].matches[1].b, sets: [[21, 18], [23, 21]], winner: 'a', status: 'COMPLETED' };
    }
    if (state.status === 'OPEN_FOR_REGISTRATION' || state.status === 'REGISTRATION_CLOSED') return null;
    return rounds;
  }

  function mRow(side, m, key) {
    if (!side) return `<div class="m-row"><span class="seed none">?</span><span class="nm tbd">Chờ đối thủ</span><span></span></div>`;
    const cls = m.winner ? (m.winner === key ? 'win' : 'lose') : '';
    const idx = key === 'a' ? 0 : 1;
    const sc = m.sets.map(s => `<b class="${s[idx] > s[1 - idx] ? 'w' : ''}">${s[idx]}</b>`).join('');
    return `<div class="m-row ${cls}"><span class="seed">${side.seed}</span><span class="nm">${side.p.name}</span><span class="sc">${sc}${m.resolution === 'WALKOVER' && m.winner === key ? '<b class="w">W/O</b>' : ''}</span></div>`;
  }

  function bracketView() {
    const rounds = bracketRounds();
    if (!rounds) return emptyBracket(t1());
    const names = ['Tứ kết', 'Bán kết', 'Chung kết'];
    const champ = state.status === 'COMPLETED' ? rounds[2].matches[0].a.p : null;
    return `<div class="bracket-wrap"><div class="bracket">
      ${rounds.map((r, i) => `<div class="round"><h3>${names[i]}</h3><div class="stack">${r.matches.map(m => `
        <article class="m-card ${m.status === 'IN_PROGRESS' ? 'live' : ''}">
          <div class="m-head"><span>${m.court} · ${m.time}</span><span>${m.status === 'IN_PROGRESS' ? '<b style="color:var(--live)">● Đang đánh</b>' : m.status === 'COMPLETED' ? 'Đã xong' : 'Chờ'}</span></div>
          ${mRow(m.a, m, 'a')}${mRow(m.b, m, 'b')}
          ${m.note ? `<div class="m-note">${m.note}</div>` : ''}
        </article>`).join('')}</div></div>`).join('')}
      <div class="round"><h3>Vô địch</h3><div class="stack"><div class="champion">${icon('trophy')}
        ${champ ? `<span class="avatar lg">${champ.initials}</span><b>${champ.name}</b><span class="chip" style="background:var(--lime);color:var(--forest)">Vô địch</span>` : '<b style="color:var(--muted)">Chưa xác định</b>'}</div></div></div>
    </div></div>`;
  }

  // ------------------------------------------------------------------ schedule (public)
  function allMatches() {
    const rounds = bracketRounds() ?? [];
    const names = ['Tứ kết', 'Bán kết', 'Chung kết'];
    return rounds.flatMap((r, i) => r.matches.map(m => ({ ...m, roundName: names[i] }))).sort((a, b) => a.time.localeCompare(b.time) || a.court.localeCompare(b.court));
  }

  function scheduleList(t) {
    const ms = allMatches();
    if (ms.length === 0) return emptyBracket(t);
    const mine = m => isRegistered() && [m.a?.p.id, m.b?.p.id].includes(105);
    return `<p class="lead" style="margin:0 0 12px">${t.courts} sân ảo · mỗi trận ~${t.duration} phút · nghỉ tối thiểu ${t.rest} phút giữa hai trận của một VĐV.</p>
      <div class="sched-list">${ms.map(m => `<div class="sched-item ${mine(m) ? 'mine' : ''}">
        <time>${m.time}</time><span class="chip">${m.court}</span>
        <div><b>${m.a ? m.a.p.name : 'Chờ đối thủ'}</b> <span style="color:var(--muted)">vs</span> <b>${m.b ? m.b.p.name : 'Chờ đối thủ'}</b><div style="font-size:12.5px;color:var(--muted)">${m.roundName}${mine(m) ? ' · trận của bạn' : ''}</div></div>
        ${m.status === 'IN_PROGRESS' ? '<span class="chip status-IN_PROGRESS">Đang đánh</span>' : m.status === 'COMPLETED' ? '<span class="chip status-COMPLETED">Đã xong</span>' : '<span class="chip">Chờ</span>'}
      </div>`).join('')}</div>`;
  }

  // ------------------------------------------------------------------ dialogs
  function openDialog(html, onMount) {
    const el = $('#dialog'); el.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`; el.hidden = false;
    const close = () => { el.hidden = true; el.innerHTML = ''; };
    el.onclick = e => { if (e.target === el || e.target.closest('[data-close]')) close(); };
    document.onkeydown = e => { if (e.key === 'Escape') close(); };
    onMount?.(el, close);
    el.querySelector('input, button:not([data-close])')?.focus();
  }

  function registerDialog(t) {
    const after = D.wallet.balance - t.fee;
    const short = after < 0;
    openDialog(`<header><h2>Đăng ký giải</h2><button class="btn ghost sm" data-close aria-label="Đóng">${icon('x')}</button></header>
      <p style="margin:0 0 12px"><b>${t.name}</b><br><span style="color:var(--muted)">${dt(t.start)} · ${typeLabel(t.matchType)}</span></p>
      <div class="pay-box"><div><span>Lệ phí</span><b>${money(t.fee)}</b></div><div><span>Số dư ví</span><span>${money(D.wallet.balance)}</span></div>
        <div class="total"><span>Sau khi đăng ký</span><span style="color:${short ? 'var(--danger)' : 'inherit'}">${short ? 'Không đủ' : money(after)}</span></div></div>
      ${short ? `<div class="notice" style="margin-top:12px">${icon('alert')}Ví còn thiếu ${money(-after)}. Nạp thêm rồi quay lại đăng ký.</div>`
        : `<p style="font-size:13px;color:var(--muted)">Lệ phí bị trừ ngay và đăng ký được xác nhận. Rút trước ${dt(t.regEnd)} được hoàn 100% về ví.</p>`}
      <div class="actions"><button class="btn ghost" data-close>Huỷ</button>${short ? `<a class="btn primary" href="#/">${icon('wallet')}Nạp ví</a>` : `<button class="btn primary" id="confirm-reg">Xác nhận · ${money(t.fee)}</button>`}</div>`,
    (el, close) => el.querySelector('#confirm-reg')?.addEventListener('click', () => { close(); state.role = 'registered'; $('#proto-role').value = 'registered'; toast('Đăng ký thành công — đã trừ ví.'); route(); }));
  }

  function withdrawDialog() {
    openDialog(`<header><h2>Rút đăng ký?</h2><button class="btn ghost sm" data-close aria-label="Đóng">${icon('x')}</button></header>
      <p>Bạn sẽ được hoàn <b>150.000đ</b> về ví ngay. Bạn có thể đăng ký lại khi giải còn slot.</p>
      <div class="actions"><button class="btn ghost" data-close>Giữ đăng ký</button><button class="btn danger" id="ok">Rút đăng ký</button></div>`,
    (el, close) => el.querySelector('#ok').addEventListener('click', () => { close(); state.role = 'player'; $('#proto-role').value = 'player'; toast('Đã rút đăng ký — hoàn 150.000đ về ví.'); route(); }));
  }

  function shareDialog(t) {
    openDialog(`<header><h2>Chia sẻ kết quả lên bảng tin</h2><button class="btn ghost sm" data-close aria-label="Đóng">${icon('x')}</button></header>
      <div class="panel" style="box-shadow:none;background:linear-gradient(135deg,var(--forest),var(--moss));color:#fff;border:0">
        <div style="display:flex;gap:10px;align-items:center;color:var(--lime)">${icon('trophy')}<b>${t.name}</b></div>
        <div style="margin-top:8px;font-size:13.5px;color:var(--mint)">07/12/2026 · Vô địch: Nguyễn Minh Khang · Á quân: Trần Bảo Ngọc</div>
        <div style="margin-top:10px"><span class="chip" style="background:var(--lime);color:var(--forest)">Bạn: Đồng hạng 3</span></div></div>
      <div class="field" style="margin-top:12px"><label for="cap">Lời nhắn (không bắt buộc)</label><textarea id="cap" maxlength="2000" placeholder="Cảm ơn BTC và các đối thủ…"></textarea><span class="hint">Thẻ kết quả do hệ thống tạo, bạn chỉ sửa được lời nhắn.</span></div>
      <div class="actions"><button class="btn ghost" data-close>Để sau</button><button class="btn primary" data-close onclick="">Đăng lên bảng tin</button></div>`);
  }

  // ------------------------------------------------------------------ organizer console
  const consoleTabs = [
    ['setup', 'Thiết lập', 'settings'], ['people', 'Người tham gia', 'users'], ['seeds', 'Hạt giống & bốc thăm', 'shuffle'],
    ['board', 'Lịch thi đấu', 'calendar'], ['matches', 'Trận đấu', 'play'], ['finish', 'Kết thúc giải', 'flag'],
  ];
  const order = ['DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED'];
  const reached = s => order.indexOf(state.status) >= order.indexOf(s);

  function viewConsole(isNew = false) {
    if (!isOrganizer() && !isNew) { main.innerHTML = `<div class="panel" style="margin:30px 0">${icon('alert')} Chỉ Organizer quản lý được giải. Đổi "Người xem" thành Organizer ở thanh bản mẫu.</div>`; return; }
    const t = t1();
    const steps = ['Nháp', 'Mở đăng ký', 'Đóng đăng ký', 'Bốc thăm', 'Thi đấu', 'Kết thúc'];
    const si = isNew ? 0 : Math.max(0, order.indexOf(state.status));
    main.innerHTML = `
      <div class="page-head" style="margin-bottom:0"><div><a class="back" href="#/t/1" style="color:var(--muted);text-decoration:none;font-weight:600;font-size:13.5px">${icon('chevron-left')}Trang giải</a>
        <p class="eyebrow" style="margin-top:8px">${isNew ? 'Tạo giải mới' : 'Bảng điều khiển Organizer'}</p><h1>${isNew ? 'Giải đấu mới' : t.name}</h1></div>
        ${isNew ? '' : `<div>${chip(state.status)}</div>`}</div>
      <div class="steps" style="margin-top:14px">${steps.map((s, i) => `<span class="${i < si ? 'done' : i === si ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
      <div class="console">
        ${isNew ? '' : `<nav class="side" aria-label="Quản lý">${consoleTabs.map(([k, label, ic]) => `<button data-ctab="${k}" aria-current="${state.consoleTab === k}">${icon(ic)}${label}</button>`).join('')}</nav>`}
        <section id="console-body" ${isNew ? 'style="grid-column:1/-1"' : ''}></section>
      </div>`;
    main.querySelectorAll('[data-ctab]').forEach(b => b.addEventListener('click', () => { state.consoleTab = b.dataset.ctab; viewConsole(); }));
    const body = $('#console-body');
    const tab = isNew ? 'setup' : state.consoleTab;
    ({ setup: () => setupForm(body, isNew), people: () => peopleAdmin(body), seeds: () => seedsPanel(body), board: () => boardPanel(body), matches: () => matchesPanel(body), finish: () => finishPanel(body) })[tab]();
  }

  function setupForm(body, isNew) {
    const st = isNew ? 'DRAFT' : state.status;
    const open = st === 'OPEN_FOR_REGISTRATION'; const closed = reached('REGISTRATION_CLOSED') && !isNew;
    const locked = (rule) => (rule ? `<span class="lock">${icon('alert')}${rule}</span>` : '');
    const dis = c => (c ? 'disabled' : '');
    const t = isNew ? { name: '', fee: 0, limit: 16, venue: '', courts: 2, duration: 45, rest: 15, dayStart: '08:00', dayEnd: '21:00', minRank: null, maxRank: null } : t1();
    const opt = (sel) => `<option value="">Không giới hạn</option>${D.levels.map(l => `<option ${sel === l.rank ? 'selected' : ''}>${l.name}</option>`).join('')}`;
    body.innerHTML = `<div class="panel"><h2>${isNew ? 'Thông tin giải' : 'Thiết lập'}</h2>
      ${closed ? `<div class="notice info" style="margin-bottom:14px">${icon('alert')}Sau khi đóng đăng ký chỉ sửa được mô tả, địa điểm và cài đặt lịch.</div>` : ''}
      <div class="form">
        <div class="field full"><label>Tên giải</label><input value="${t.name}" placeholder="Ví dụ: Giải đơn mùa đông 2026" ${dis(closed)}></div>
        <div class="field"><label>Nội dung ${locked(open ? 'Khoá khi đang mở' : '')}</label><select ${dis(open || closed)}><option>Đơn</option><option>Đôi</option></select></div>
        <div class="field"><label>Số lượng tối đa</label><input type="number" value="${t.limit}" min="2" max="128" ${dis(closed)}><span class="hint">${open ? 'Không thấp hơn số đã đăng ký (8).' : 'Đơn: số VĐV · Đôi: số đội. 2–128.'}</span></div>
        <div class="field"><label>Lệ phí (đ) ${locked(open ? 'Khoá: đã có người đăng ký' : '')}</label><input type="number" value="${t.fee}" step="10000" ${dis(open || closed)}><span class="hint">0 = miễn phí. Trừ ví khi đăng ký.</span></div>
        <div class="field"><label>Trình độ ${locked(open ? 'Khoá: đã có người đăng ký' : '')}</label><div style="display:flex;gap:8px"><select ${dis(open || closed)}>${opt(t.minRank)}</select><select ${dis(open || closed)}>${opt(t.maxRank)}</select></div><span class="hint">Tối thiểu – tối đa. Đôi: cả hai thành viên.</span></div>
        <div class="field"><label>Mở đăng ký ${locked(open ? 'Đã bắt đầu' : '')}</label><input type="datetime-local" value="2026-11-25T08:00" ${dis(open || closed)}></div>
        <div class="field"><label>Hạn đăng ký</label><input type="datetime-local" value="2026-12-05T23:59" ${dis(closed)}><span class="hint">${open ? 'Chỉ được gia hạn, không rút ngắn.' : ''}</span></div>
        <div class="field"><label>Bắt đầu thi đấu</label><input type="datetime-local" value="2026-12-07T08:00" ${dis(closed)}></div>
        <div class="field"><label>Kết thúc</label><input type="datetime-local" value="2026-12-07T21:00" ${dis(closed)}></div>
        <div class="field full"><label>Địa điểm</label><input value="${t.venue}" placeholder="Tên nhà thi đấu, địa chỉ"><span class="hint">Nhập tự do — không cần là sân trên hệ thống. Bắt buộc trước khi mở đăng ký.</span></div>
        <fieldset><legend>Lịch thi đấu (sân ảo)</legend>
          <div class="field"><label>Số sân</label><input type="number" value="${t.courts}" min="1" max="20"></div>
          <div class="field"><label>Mỗi trận (phút)</label><input type="number" value="${t.duration}" min="10" max="180"></div>
          <div class="field"><label>Nghỉ tối thiểu (phút)</label><input type="number" value="${t.rest}" min="0" max="240"></div>
          <div class="field"><label>Khung giờ mỗi ngày</label><div style="display:flex;gap:6px"><input type="time" value="${t.dayStart}"><input type="time" value="${t.dayEnd}"></div></div>
        </fieldset>
        <div class="field full"><label>Mô tả / thể lệ</label><textarea placeholder="Thể lệ, giải thưởng, lưu ý…">${t.description ?? ''}</textarea></div>
      </div>
      <div class="actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        ${isNew ? `<button class="btn outline">Lưu nháp</button><button class="btn primary">${icon('check')}Lưu & mở đăng ký</button>` : `<button class="btn primary">${icon('check')}Lưu thay đổi</button>`}
        ${!isNew && st === 'OPEN_FOR_REGISTRATION' ? `<button class="btn outline" id="close-reg">Đóng đăng ký</button>` : ''}
        ${!isNew && !reached('IN_PROGRESS') ? `<button class="btn danger" id="cancel-t">Huỷ giải</button>` : ''}
      </div></div>`;
    body.querySelector('#cancel-t')?.addEventListener('click', () => openDialog(`<header><h2>Huỷ giải?</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
      <p>8 người đã đăng ký sẽ được <b>hoàn 100% lệ phí</b> (tổng 1.200.000đ). Không thể hoàn tác.</p>
      <div class="field"><label>Lý do</label><input placeholder="Ví dụ: Nhà thi đấu đóng cửa"></div>
      <div class="actions"><button class="btn ghost" data-close>Giữ giải</button><button class="btn danger" data-close>Huỷ giải và hoàn tiền</button></div>`));
  }

  function peopleAdmin(body) {
    const canRemove = state.status === 'OPEN_FOR_REGISTRATION' || state.status === 'REGISTRATION_CLOSED';
    body.innerHTML = `<div class="panel"><h2>Người tham gia (${D.players.length - state.removed.size}/8)</h2>
      ${canRemove ? '' : `<div class="notice info" style="margin-bottom:12px">${icon('alert')}Đã bốc thăm — không thể loại thêm người. Vắng mặt xử lý bằng walkover ở tab Trận đấu.</div>`}
      <table class="table"><thead><tr><th>VĐV</th><th>Trình độ</th><th>Đăng ký lúc</th><th>Lệ phí</th><th></th></tr></thead><tbody>
      ${D.players.filter(p => !state.removed.has(p.id)).map((p, i) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><span class="avatar sm">${p.initials}</span>${p.name}</div></td><td>${lvl(p.rank)}</td><td>2${i}/11 · 2${i % 3}:0${i}</td><td>150.000đ</td>
        <td style="text-align:right">${canRemove ? `<button class="btn danger sm" data-remove="${p.id}">Loại</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      const p = D.players.find(x => x.id === Number(b.dataset.remove));
      openDialog(`<header><h2>Loại ${p.name}?</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
        <p>VĐV được hoàn <b>150.000đ</b> về ví và nhận thông báo kèm lý do.</p>
        <div class="field"><label for="why">Lý do (bắt buộc)</label><input id="why" maxlength="300" placeholder="Ví dụ: Sai thông tin trình độ"></div>
        <div class="actions"><button class="btn ghost" data-close>Thôi</button><button class="btn danger" id="rm" disabled>Loại và hoàn tiền</button></div>`,
      (el, close) => { const why = el.querySelector('#why'); const rm = el.querySelector('#rm'); why.addEventListener('input', () => { rm.disabled = !why.value.trim(); }); rm.addEventListener('click', () => { state.removed.add(p.id); close(); toast(`Đã loại ${p.name} — hoàn 150.000đ.`); viewConsole(); }); });
    }));
  }

  function seedsPanel(body) {
    const drawn = reached('READY');
    const entries = D.players.map((p, i) => ({ p, suggested: i + 1 }));
    const pairs = [[1, 8], [4, 5], [3, 6], [2, 7]];
    body.innerHTML = `<div class="panel"><h2>Hạt giống & bốc thăm</h2>
      ${state.status === 'OPEN_FOR_REGISTRATION' ? `<div class="notice">${icon('alert')}Đóng đăng ký trước khi xếp hạt giống.</div>` : ''}
      ${drawn ? `<div class="notice ok" style="margin-bottom:12px">${icon('check')}Đã bốc thăm lúc 06/12 20:15 · mã bốc thăm #184 027 (tái lập được). Hạt giống và nhánh đấu đã khoá.</div>`
        : `<p class="lead" style="margin:0 0 12px;font-size:14px">Hệ thống gợi ý theo trình độ (đôi: tổng trình hai người, bằng nhau thì ngẫu nhiên). Sửa số hạt giống hoặc để trống để bốc thăm ngẫu nhiên. Hạt giống 1–2 ở hai nửa nhánh, 1–4 ở bốn phần tư; suất miễn đấu (BYE) dành cho hạt giống cao.</p>`}
      <div class="seed-list">${entries.map(({ p, suggested }) => `<div class="seed-row"><span class="grip">${icon('grip')}</span><span class="avatar sm">${p.initials}</span>
        <div><b>${p.name}</b><div style="font-size:12.5px;color:var(--muted)">${lvl(p.rank)} · gợi ý #${suggested}</div></div>
        <input type="number" min="1" max="8" value="${suggested}" aria-label="Hạt giống của ${p.name}" ${drawn ? 'disabled' : ''}>
        <span class="seed">${suggested}</span></div>`).join('')}</div>
      <h2 style="margin-top:18px">Vòng 1 (xem trước)</h2>
      <div class="preview-pairs">${pairs.map(([a, b]) => `<div class="pair">#${a} ${D.players[a - 1].name.split(' ').pop()} <span style="color:var(--muted)">vs</span> #${b} ${D.players[b - 1].name.split(' ').pop()}</div>`).join('')}</div>
      <p style="font-size:12.5px;color:var(--muted)">Ví dụ 5 người → nhánh 8, hạt giống 1–3 được miễn vòng 1.</p>
      ${drawn ? '' : `<div class="actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn outline">Dùng gợi ý</button><button class="btn outline">Xoá hết (bốc thăm ngẫu nhiên)</button><button class="btn primary" id="draw" ${state.status !== 'REGISTRATION_CLOSED' ? 'disabled' : ''}>${icon('shuffle')}Bốc thăm & xếp lịch</button></div>`}
    </div>`;
    body.querySelector('#draw')?.addEventListener('click', () => openDialog(`<header><h2>Bốc thăm?</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
      <p>Hệ thống tạo nhánh đấu và <b>tự xếp lịch</b> trên 2 sân từ 07/12 08:00. Sau đó hạt giống và nhánh đấu bị khoá; lịch vẫn sửa được.</p>
      <div class="actions"><button class="btn ghost" data-close>Chưa</button><button class="btn primary" id="go">${icon('shuffle')}Bốc thăm</button></div>`,
    (el, close) => el.querySelector('#go').addEventListener('click', () => { close(); state.status = 'READY'; $('#proto-status').value = 'IN_PROGRESS'; state.status = 'IN_PROGRESS'; state.consoleTab = 'board'; toast('Đã bốc thăm và xếp lịch.'); viewConsole(); })));
  }

  function boardPanel(body) {
    const ms = allMatches();
    if (ms.length === 0) { body.innerHTML = `<div class="panel">${emptyBracket(t1())}</div>`; return; }
    const start = 8 * 60; const end = 12 * 60; const px = 1; // 1px = 1 phút
    const y = time => { const [h, m] = time.split(':').map(Number); return (h * 60 + m - start) * px; };
    const courts = ['Sân 1', 'Sân 2'];
    const warn = id => id === 22; // minh họa: bán kết 2 bị kéo sớm → cảnh báo nghỉ chưa đủ
    const ticks = []; for (let m = start; m <= end; m += 30) ticks.push(m);
    body.innerHTML = `<div class="panel"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div><h2 style="margin:0">Lịch thi đấu · 07/12</h2><span style="font-size:13px;color:var(--muted)">2 sân ảo · 45 phút/trận · nghỉ ≥ 15 phút · 08:00–21:00</span></div>
        <button class="btn outline" id="rerun">${icon('shuffle')}Xếp lại tự động</button></div>
      <div class="notice" style="margin-bottom:12px">${icon('alert')}1 cảnh báo: <b>Đặng Quỳnh Như</b> chỉ nghỉ 10 phút giữa tứ kết (kết thúc 09:30) và bán kết 09:40 (tối thiểu 15). Bấm trận để sửa — cảnh báo không chặn việc lưu.</div>
      <div style="overflow-x:auto"><div class="board" style="--courts:${courts.length}">
        <div class="col-head" style="border-left:0">Giờ</div>${courts.map(c => `<div class="col-head">${c}</div>`).join('')}
        <div class="time-col" style="height:${(end - start) * px}px">${ticks.map(m => `<span class="tick" style="top:${(m - start) * px}px">${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</span>`).join('')}</div>
        ${courts.map(c => `<div class="lane" style="height:${(end - start) * px}px">${ms.filter(m => m.court === c).map(m => `
          <button class="block ${m.status === 'COMPLETED' ? 'done' : m.status === 'IN_PROGRESS' ? 'live' : ''} ${warn(m.id) ? 'warn' : ''}" data-block="${m.id}" style="top:${y(m.time)}px;height:${45 * px - 4}px">
            ${warn(m.id) ? `<span class="w-badge">${icon('alert')}</span>` : ''}<span class="t">${m.time} · ${m.roundName}</span>
            <span>${m.a ? m.a.p.name.split(' ').pop() : '?'} – ${m.b ? m.b.p.name.split(' ').pop() : '?'}</span></button>`).join('')}</div>`).join('')}
      </div></div>
      <div class="board-legend"><span><i style="background:var(--brand-light);border:1px solid #cfe8c6"></i>Chưa đánh (bấm để sửa)</span><span><i style="background:#fff1f1;border:1px solid #f3b1b3"></i>Đang đánh (cố định)</span><span><i style="background:var(--subtle)"></i>Đã xong</span><span><i style="background:#fff8e6;border:1px solid #e8b54a"></i>Có cảnh báo</span></div></div>`;
    body.querySelectorAll('[data-block]').forEach(b => b.addEventListener('click', () => {
      const m = ms.find(x => x.id === Number(b.dataset.block));
      if (m.status !== 'CONFIRMED') { toast('Trận đã bắt đầu hoặc đã xong — không thể dời.'); return; }
      openDialog(`<header><h2>Sửa lịch · ${m.roundName}</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
        <p style="margin-top:0">${m.a ? m.a.p.name : 'Chờ đối thủ'} vs ${m.b ? m.b.p.name : 'Chờ đối thủ'}</p>
        <div class="form"><div class="field"><label>Sân</label><input id="court" value="${m.court}"><span class="hint">Nhập tự do, ví dụ "Sân 3" hoặc "Sân VIP".</span></div><div class="field"><label>Giờ bắt đầu</label><input id="time" type="time" value="${m.time}"></div></div>
        <div id="warns" style="margin-top:10px"></div>
        <div class="actions"><button class="btn ghost" data-close>Huỷ</button><button class="btn primary" data-close>Lưu</button></div>`,
      el => {
        const check = () => {
          const t = el.querySelector('#time').value; const c = el.querySelector('#court').value.trim().toLowerCase();
          const clash = ms.find(x => x.id !== m.id && x.court.toLowerCase() === c && Math.abs(y(x.time) - y(t)) < 45);
          const early = m.id === 22 && t < '09:45';
          el.querySelector('#warns').innerHTML = [clash ? `<div class="notice">${icon('alert')}Trùng ${clash.court} với trận ${clash.time} (${clash.roundName}).</div>` : '',
            early ? `<div class="notice" style="margin-top:6px">${icon('alert')}VĐV nghỉ chưa đủ 15 phút sau trận trước.</div>` : '',
            !clash && !early ? `<div class="notice ok">${icon('check')}Không có xung đột.</div>` : ''].join('');
        };
        el.querySelectorAll('input').forEach(i => i.addEventListener('input', check)); check();
      });
    }));
    body.querySelector('#rerun').addEventListener('click', () => openDialog(`<header><h2>Xếp lại tự động?</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
      <p>Các trận <b>chưa đánh</b> được xếp lại từ bây giờ (làm tròn 5 phút); trận đang đánh và đã xong giữ nguyên. <b>Các chỉnh tay của trận chưa đánh sẽ bị ghi đè.</b></p>
      <div class="actions"><button class="btn ghost" data-close>Thôi</button><button class="btn primary" data-close>${icon('shuffle')}Xếp lại</button></div>`));
  }

  function matchesPanel(body) {
    const ms = allMatches();
    if (ms.length === 0) { body.innerHTML = `<div class="panel">${emptyBracket(t1())}</div>`; return; }
    body.innerHTML = `<div class="panel"><h2>Trận đấu</h2><div class="sched-list" style="margin:0">${ms.map(m => {
      const playable = m.a && m.b;
      const action = m.status === 'IN_PROGRESS' ? `<button class="btn primary sm" data-score="${m.id}">${icon('pencil')}Nhập tỉ số</button>`
        : m.status === 'CONFIRMED' && playable ? `<div style="display:flex;gap:6px"><button class="btn primary sm" data-start="${m.id}">${icon('play')}Bắt đầu</button><button class="btn outline sm" data-wo="${m.id}">Walkover</button></div>`
          : m.status === 'COMPLETED' ? `<button class="btn ghost sm" data-score="${m.id}">${icon('pencil')}Sửa</button>` : '<span class="chip">Chờ đối thủ</span>';
      return `<div class="sched-item"><time>${m.time}</time><span class="chip">${m.court}</span>
        <div><b>${m.a ? m.a.p.name : 'Chờ'}</b> <span style="color:var(--muted)">vs</span> <b>${m.b ? m.b.p.name : 'Chờ'}</b>
        <div style="font-size:12.5px;color:var(--muted)">${m.roundName} · ${m.sets.length ? m.sets.map(s => s.join('–')).join(', ') : m.note ?? 'chưa có tỉ số'}</div></div>${action}</div>`;
    }).join('')}</div>
    <p style="font-size:12.5px;color:var(--muted);margin-bottom:0">Sửa kết quả được khi trận kế tiếp chưa bắt đầu; sau khi kết thúc giải chỉ sửa tỉ số trong 48 giờ.</p></div>`;
    body.querySelectorAll('[data-score]').forEach(b => b.addEventListener('click', () => scoreDialog(ms.find(m => m.id === Number(b.dataset.score)))));
    body.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => toast('Đã bắt đầu trận — người xem thấy "Đang đánh".')));
    body.querySelectorAll('[data-wo]').forEach(b => b.addEventListener('click', () => openDialog(`<header><h2>Ghi walkover</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
      <p>Chọn người <b>thắng</b> (đối thủ vắng mặt). Không có tỉ số; người vắng mặt không được hoàn lệ phí.</p>
      <div class="result-type"><button class="btn outline">Thắng: bên 1</button><button class="btn outline">Thắng: bên 2</button></div>
      <div class="actions"><button class="btn ghost" data-close>Huỷ</button></div>`)));
  }

  function scoreDialog(m) {
    const initial = m.sets.length ? m.sets.map(([a, b]) => ({ a: String(a), b: String(b) })) : [];
    const sets = [0, 1, 2].map(i => initial[i] ?? { a: '', b: '' });
    let type = 'SETS';
    openDialog(`<header><h2>Tỉ số · ${m.roundName}</h2><button class="btn ghost sm" data-close>${icon('x')}</button></header>
      <div class="result-type" role="group"><button class="btn sm primary" data-type="SETS">Kết quả</button><button class="btn sm outline" data-type="RETIRED">Bỏ cuộc</button><button class="btn sm outline" data-type="CANCEL">Huỷ trận</button></div>
      <div id="score-body"></div>
      <div class="actions"><button class="btn ghost" data-close>Huỷ</button><button class="btn primary" id="save" disabled>Lưu kết quả</button></div>`,
    (el, close) => {
      const render = () => {
        el.querySelectorAll('[data-type]').forEach(b => b.className = `btn sm ${b.dataset.type === type ? 'primary' : 'outline'}`);
        const box = el.querySelector('#score-body');
        if (type === 'CANCEL') {
          box.innerHTML = `<p>Trận bị huỷ không có người thắng, không ai đi tiếp. Bạn có thể ghi kết quả sau.</p><div class="field"><label>Lý do</label><input id="why" placeholder="Ví dụ: Mất điện"></div>`;
          el.querySelector('#save').disabled = false; return;
        }
        const r = S.evaluate(sets);
        const thirdOn = r.wins[0] === 1 && r.wins[1] === 1;
        box.innerHTML = `<div class="players-line"><span></span><span>${m.a.p.name}</span><span></span><span>${m.b.p.name}</span></div>
          <div class="sets">${sets.map((s, i) => `<div class="set-row"><b>Set ${i + 1}</b>
            <input inputmode="numeric" data-i="${i}" data-k="a" value="${s.a}" ${i === 2 && !thirdOn && !s.a ? 'disabled' : ''} class="${r.problems[i] ? 'bad' : ''}" aria-label="Set ${i + 1} ${m.a.p.name}">
            <span style="text-align:center">–</span>
            <input inputmode="numeric" data-i="${i}" data-k="b" value="${s.b}" ${i === 2 && !thirdOn && !s.b ? 'disabled' : ''} class="${r.problems[i] ? 'bad' : ''}" aria-label="Set ${i + 1} ${m.b.p.name}">
            ${r.problems[i] ? `<span class="set-err">${r.problems[i]}</span>` : ''}</div>`).join('')}</div>
          ${type === 'RETIRED' ? `<div class="field" style="margin-top:12px"><label>Bên bỏ cuộc</label><select id="ret"><option value="1">${m.a.p.name}</option><option value="2">${m.b.p.name}</option></select><span class="hint">Set cuối có thể đang dở; các set đã đánh được giữ.</span></div>` : ''}
          <div style="margin-top:12px">${type === 'RETIRED' ? `<div class="winner-preview">${icon('trophy')}Đối thủ của bên bỏ cuộc thắng và đi tiếp.</div>`
            : r.winner ? `<div class="winner-preview">${icon('trophy')}${r.winner === 1 ? m.a.p.name : m.b.p.name} thắng ${r.wins[r.winner - 1]}–${r.wins[2 - r.winner]} và đi tiếp.</div>`
              : '<p style="font-size:13px;color:var(--muted)">3 set thắng 2 · set 21 điểm, cách 2, tối đa 30 (ví dụ 21–19, 22–20, 30–29).</p>'}</div>`;
        el.querySelector('#save').disabled = type === 'SETS' ? !r.winner || Object.keys(r.problems).length > 0 : Object.keys(r.problems).length > 0 && false;
        box.querySelectorAll('input[data-i]').forEach(inp => inp.addEventListener('input', () => {
          sets[inp.dataset.i][inp.dataset.k] = inp.value.replace(/\D/g, '').slice(0, 2);
          const pos = `${inp.dataset.i}${inp.dataset.k}`; render();
          const again = box.querySelector(`input[data-i="${pos[0]}"][data-k="${pos[1]}"]`); again?.focus(); again?.setSelectionRange(99, 99);
        }));
      };
      el.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { type = b.dataset.type; render(); }));
      el.querySelector('#save').addEventListener('click', () => { close(); toast('Đã lưu kết quả — người thắng đi tiếp, nhánh đấu cập nhật trực tiếp.'); });
      render();
    });
  }

  function finishPanel(body) {
    const finalDone = state.status === 'COMPLETED';
    body.innerHTML = `<div class="panel"><h2>Kết thúc giải</h2>
      ${finalDone ? `<div class="notice ok">${icon('check')}Giải đã kết thúc 07/12 11:40. Đã chuyển <b>1.200.000đ</b> lệ phí vào ví của bạn. Sửa tỉ số được đến 09/12 11:40.</div>`
        : `<p class="lead" style="font-size:14px">Sau trận chung kết, bấm "Kết thúc giải" để công bố kết quả. Nếu không bấm, hệ thống tự kết thúc 3 ngày sau ngày thi đấu (nếu chung kết đã có kết quả).</p>
          <div class="pay-box" style="margin:12px 0"><div><span>Lệ phí đã thu (8 × 150.000đ)</span><b>1.200.000đ</b></div><div><span>Đã hoàn</span><span>0đ</span></div><div class="total"><span>Chuyển vào ví Organizer khi kết thúc</span><span>1.200.000đ</span></div></div>
          <div class="notice">${icon('alert')}Chung kết chưa có kết quả — chưa thể kết thúc.</div>
          <div class="actions" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" disabled>${icon('flag')}Kết thúc giải</button></div>`}
      <h2 style="margin-top:18px">Sau khi kết thúc</h2>
      <ul style="margin:0;padding-left:18px;color:var(--muted);display:grid;gap:6px;font-size:14px"><li>Điểm phong độ và bậc trình độ của VĐV được cập nhật.</li><li>Vị trí (Vô địch, Á quân, Đồng hạng 3…) hiện trên hồ sơ và bảng xếp hạng.</li><li>Organizer và top 4 có thể đăng bài vinh danh lên bảng tin.</li><li>Nhóm chat của giải khoá sau 30 ngày.</li></ul></div>`;
  }

  function viewMine() {
    const pick = [t1(), D.tournaments[1]];
    main.innerHTML = `<div class="page-head"><div><p class="eyebrow">Của tôi</p><h1>Giải của tôi</h1></div></div>
      <div class="tabs"><button aria-selected="true">Đã đăng ký</button><button>Tổ chức</button><button>Lời mời vào đội <span class="count">1</span></button></div>
      <div class="grid">${pick.map(card).join('')}</div>`;
  }

  // ------------------------------------------------------------------ router
  function route() {
    renderHeaderUser();
    const hash = location.hash.replace(/^#/, '') || '/';
    let m;
    if ((m = hash.match(/^\/t\/(\d+)\/manage$/))) viewConsole();
    else if ((m = hash.match(/^\/t\/(\d+)$/))) viewDetail(Number(m[1]));
    else if (hash === '/new') viewConsole(true);
    else if (hash === '/mine') viewMine();
    else viewList();
    window.scrollTo({ top: 0 });
  }
  $('#proto-role').addEventListener('change', e => { state.role = e.target.value; route(); });
  $('#proto-status').addEventListener('change', e => { state.status = e.target.value; route(); });
  window.addEventListener('hashchange', () => { if (!location.hash.includes('manage')) state.tab = state.tab; route(); });
  route();
})();
