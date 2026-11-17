/* Mood Collect × SIORÉ · B2B Partner Mall — front-end (GitHub Pages) */
(() => {
'use strict';
const API = (window.MALL_API || '').trim();
const TK = 'mcmall_token';
const S = { token: null, me: null, config: null, orders: [], sales: [], payments: [], users: [], page: 'home', cart: {}, f: {} };
try { S.token = localStorage.getItem(TK); } catch (e) {}

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const pad = n => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const toD = v => v ? new Date(v) : null;
const fmtD = v => { const d = toD(v); return d && !isNaN(d) ? `${d.getMonth() + 1}/${d.getDate()}` : (v || ''); };
const fmtDT = v => { const d = toD(v); return d && !isNaN(d) ? `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
const monthOf = v => { const d = toD(v); return d && !isNaN(d) ? ym(d) : String(v || '').slice(0, 7); };
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ym(d); };
const isAdmin = () => S.me && S.me.role === 'admin';
const isAll = () => S.me && (S.me.role === 'admin' || S.me.scope === 'ALL');
const products = () => (S.config ? S.config.products : []).filter(p => p.active !== false);
const prod = sku => (S.config ? S.config.products : []).find(p => p.sku === sku) || { name: sku };
const branches = () => (S.config ? S.config.branches : []).filter(b => b.active !== false);
const brName = id => ((S.config ? S.config.branches : []).find(b => b.id === id) || {}).name || (id ? id : '전체');
const setting = k => (S.config && S.config.settings && S.config.settings[k]) || '';
const qtyOf = items => Object.values(items || {}).reduce((a, q) => a + (Number(q) || 0), 0);
const amountOf = items => Object.entries(items || {}).reduce((a, [s, q]) => a + (Number(q) || 0) * (Number(prod(s).supply) || 0), 0);
const itemsLine = items => Object.entries(items || {}).filter(([, q]) => q > 0).map(([s, q]) => `${esc(prod(s).name)} ${q}`).join(', ');
const SHIPPED = ['출고완료', '배송완료'];
const OPEN = ['접수대기', '승인', '출고완료'];
const pillOf = st => ({ '접수대기': 'p-wait', '승인': 'p-br', '출고완료': 'p-ship', '배송완료': 'p-ok', '반려': 'p-bad', '취소': 'p-gray', '입력': 'p-wait', '확정': 'p-ok', '확인대기': 'p-wait', '확인': 'p-ok', '불일치': 'p-bad', 'pending': 'p-wait', 'approved': 'p-ok', 'rejected': 'p-bad', 'suspended': 'p-gray' }[st] || 'p-gray');
const stLabel = st => ({ pending: '승인 대기', approved: '사용 중', rejected: '거절', suspended: '정지' }[st] || st);
const pill = st => `<span class="pill ${pillOf(st)}">${esc(stLabel(st))}</span>`;

let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
function busy(on) { $('#busy').classList.toggle('on', !!on); }
function openModal(html, bind) { $('#modal').innerHTML = html; $('#mbg').classList.add('on'); bind && bind($('#modal')); const f = $('#modal input:not([type=hidden])'); f && setTimeout(() => f.focus(), 50); }
function closeModal() { $('#mbg').classList.remove('on'); $('#modal').innerHTML = ''; }
$('#mbg').addEventListener('mousedown', e => { if (e.target.id === 'mbg' && !$('#modal [data-lock]')) closeModal(); });
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('복사했어요'); }
  catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('복사했어요'); } catch (x) { toast('복사하지 못했어요. 길게 눌러 직접 복사해 주세요'); } a.remove(); }
}

/* ---------- API ---------- */
async function api(action, data = {}, opt = {}) {
  if (!API) throw new Error('서버 주소가 아직 연결되지 않았어요 (config.js)');
  if (!opt.silent) busy(true);
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: S.token }, data)) });
    const j = await res.json();
    if (!j.ok) {
      if (j.code === 'AUTH') { logoutLocal('로그인이 만료됐어요. 다시 로그인해 주세요'); throw new Error('__auth'); }
      throw new Error(j.error || '처리하지 못했어요');
    }
    return j;
  } catch (e) {
    if (e.message === '__auth') throw e;
    if (e instanceof TypeError) throw new Error('인터넷 연결을 확인해 주세요');
    throw e;
  } finally { if (!opt.silent) busy(false); }
}
async function act(action, data, okMsg) {
  try { const r = await api(action, data); if (okMsg) toast(okMsg); await load(true); return r; }
  catch (e) { if (e.message !== '__auth') toast(e.message); return null; }
}
async function load(silent) {
  const j = await api('bootstrap', {}, { silent });
  S.me = j.me; S.config = j.config;
  S.orders = (j.orders || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  S.sales = (j.sales || []).sort((a, b) => String(b.month).localeCompare(String(a.month)));
  S.payments = (j.payments || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  S.users = j.users || [];
  render();
}
function logoutLocal(msg) {
  S.token = null; S.me = null; try { localStorage.removeItem(TK); } catch (e) {}
  S.loginMsg = msg || ''; render();
}
async function logout() { try { await api('logout', {}, { silent: true }); } catch (e) {} logoutLocal(); }

/* ---------- top-level render ---------- */
function render() {
  const app = $('#app');
  if (!S.token) { app.innerHTML = landingView(); bindLanding(); window.scrollTo(0, 0); return; }
  if (!S.me) { app.innerHTML = '<div class="loading"><span class="spin"></span>불러오는 중…</div>'; load().catch(e => { if (e.message !== '__auth') { app.innerHTML = `<div class="gate"><div class="card"><h2>연결하지 못했어요</h2><p class="sub" style="margin:8px 0 14px">${esc(e.message)}</p><button class="btn" id="rt">다시 시도</button> <button class="btn sec" id="lo">로그아웃</button></div></div>`; $('#rt').onclick = () => render(); $('#lo').onclick = () => logoutLocal(); } }); return; }
  if (S.me.mustChange) { app.innerHTML = headerView(false) + pwGateView(); bindHeader(); bindPwGate(); return; }
  if (S.me.status !== 'approved') { app.innerHTML = headerView(false) + pendingView(); bindHeader(); $('#rf') && ($('#rf').onclick = () => load()); return; }
  const pages = PAGES();
  if (!pages.find(p => p.id === S.page)) S.page = 'home';
  const pg = pages.find(p => p.id === S.page);
  const keep = captureInputs();
  app.innerHTML = headerView(true) + `<main>${pg.view()}</main>`;
  restoreInputs(keep);
  bindHeader(); pg.bind && pg.bind();
}
function captureInputs() { const m = {}; $$('main [data-keep]').forEach(i => m[i.dataset.keep] = i.value); return m; }
function restoreInputs(m) { $$('main [data-keep]').forEach(i => { if (m[i.dataset.keep] !== undefined && document.activeElement !== i) i.value = m[i.dataset.keep]; }); }
function go(p) { S.page = p; render(); window.scrollTo(0, 0); }

/* ---------- landing ---------- */
function landingView() {
  return `<div class="landing">
  <section class="dg">
    <div class="ia" role="img" aria-label="Mood Collect 컬러 원단"></div>
    <div class="ib"><img alt="SIORÉ 브랜드 이미지" src="img/siore-model.jpg"></div>
    <svg class="cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="64" y1="0" x2="36" y2="100" stroke="#fff" vector-effect="non-scaling-stroke" style="stroke-width:2px"/></svg>
    <div class="shade"></div>
    <div class="tagA"><b>Mood Collect</b>PERSONAL COLOR STUDIO</div>
    <div class="tagB"><b>SIORÉ</b>PHARMACY DERMA COSMETICS</div>
    <div class="center">
      <div class="lk"><span class="mc">Mood Collect</span><span class="x">×</span><span class="si">SIORÉ</span></div>
      <div class="hb">B2B PARTNER MALL</div>
      <div class="sl">좋은 컬러는 건강한 피부 위에서 완성됩니다</div>
    </div>
  </section>
  <form class="lbox" id="lf" autocomplete="on">
    <div class="gk">PARTNER LOGIN</div>
    ${S.loginMsg ? `<div class="err">${esc(S.loginMsg)}</div>` : ''}
    <input id="lid" name="username" autocomplete="username" placeholder="아이디" autocapitalize="off" spellcheck="false">
    <input id="lpw" name="password" type="password" autocomplete="current-password" placeholder="비밀번호">
    <button class="gb p" type="submit">로그인</button>
    <div class="or">처음 오셨나요?</div>
    <button class="gb s" type="button" id="su">회원가입</button>
    <div class="gn">승인 후 이용할 수 있어요 · <a id="fp">비밀번호 찾기</a></div>
  </form>
</div>
<div class="lfoot">Mood Collect × SIORÉ · B2B Partner Mall · ㈜파마브로스</div>`;
}
function bindLanding() {
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const id = $('#lid').value.trim(), pw = $('#lpw').value;
    if (!id || !pw) { S.loginMsg = '아이디와 비밀번호를 입력해 주세요'; render(); $('#lid').value = id; return; }
    try {
      const j = await api('login', { id, pw });
      S.token = j.token; S.me = null; S.loginMsg = ''; S.page = 'home';
      try { localStorage.setItem(TK, j.token); } catch (x) {}
      render();
    } catch (err) { S.loginMsg = err.message; render(); $('#lid').value = id; $('#lpw').focus(); }
  };
  $('#su').onclick = signupModal;
  $('#fp').onclick = resetModal;
}
async function signupModal() {
  let br = [];
  try { br = (await api('publicConfig')).branches || []; } catch (e) { toast(e.message); return; }
  openModal(`<div class="eyebrow">JOIN</div><h2 style="margin:4px 0 4px">파트너 회원가입</h2>
    <p class="sub" style="font-size:12.5px;margin-bottom:14px">가입 신청 후 시오레 담당자가 승인하면 이용할 수 있어요.</p>
    <form id="sf" class="grid" style="gap:10px">
      <label class="f">아이디<input id="s_id" placeholder="영문 소문자·숫자 4~20자" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
      <div class="grid g2" style="gap:10px">
        <label class="f">비밀번호<input id="s_pw" type="password" placeholder="영문+숫자 8자 이상" autocomplete="new-password"></label>
        <label class="f">비밀번호 확인<input id="s_pw2" type="password" autocomplete="new-password"></label>
      </div>
      <div class="grid g2" style="gap:10px">
        <label class="f">이름<input id="s_nm" autocomplete="name"></label>
        <label class="f">연락처<input id="s_ph" type="tel" placeholder="010-0000-0000" autocomplete="tel"></label>
      </div>
      <label class="f">이메일 <span class="muted" style="font-weight:400">(선택)</span><input id="s_em" type="email" autocomplete="email"></label>
      <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--sub)">소속
        <div class="chips" id="s_org"><span class="chip on" data-v="BRANCH">지점</span><span class="chip" data-v="HQ">무드컬렉트 본사</span></div>
      </div>
      <label class="f" id="s_brw">지점 선택
        <select id="s_br">${br.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}<option value="__etc">목록에 없어요 (직접 입력)</option></select>
      </label>
      <label class="f" id="s_bnw" ${br.length ? 'hidden' : ''}>지점명<input id="s_bn" placeholder="예: 성수점"></label>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--sub);line-height:1.5"><input type="checkbox" id="s_ag" style="margin-top:3px">
        <span>입력한 이름·연락처·이메일은 시오레와의 거래(발주·정산) 관리와 연락 목적으로만 사용되는 것에 동의해요.</span></label>
      <div class="row" style="justify-content:flex-end;margin-top:6px"><button type="button" class="btn sec" id="mx">닫기</button><button class="btn" type="submit">가입 신청</button></div>
    </form>`, m => {
    let org = 'BRANCH';
    if (!br.length) $('#s_br', m).value = '__etc';
    $('#s_org', m).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; org = c.dataset.v; $$('#s_org .chip', m).forEach(x => x.classList.toggle('on', x === c)); $('#s_brw', m).hidden = org === 'HQ' || !br.length; $('#s_bnw', m).hidden = org === 'HQ' || $('#s_br', m).value !== '__etc'; };
    $('#s_br', m).onchange = () => { $('#s_bnw', m).hidden = $('#s_br', m).value !== '__etc'; };
    $('#mx', m).onclick = closeModal;
    $('#sf', m).onsubmit = async e => {
      e.preventDefault();
      const v = k => $('#' + k, m).value.trim();
      if (!/^[a-z0-9._-]{4,20}$/.test(v('s_id').toLowerCase())) return toast('아이디는 영문 소문자·숫자 4~20자로 만들어 주세요');
      if ($('#s_pw', m).value.length < 8 || !/[A-Za-z]/.test($('#s_pw', m).value) || !/\d/.test($('#s_pw', m).value)) return toast('비밀번호는 영문과 숫자를 섞어 8자 이상으로 정해 주세요');
      if ($('#s_pw', m).value !== $('#s_pw2', m).value) return toast('비밀번호 확인이 일치하지 않아요');
      if (!v('s_nm') || !v('s_ph')) return toast('이름과 연락처를 입력해 주세요');
      if (!$('#s_ag', m).checked) return toast('정보 이용 동의에 체크해 주세요');
      const sel = $('#s_br', m).value;
      try {
        await api('signup', { id: v('s_id').toLowerCase(), pw: $('#s_pw', m).value, name: v('s_nm'), phone: v('s_ph'), email: v('s_em'), orgType: org,
          branchId: org === 'HQ' || sel === '__etc' ? '' : sel, branchName: org === 'HQ' ? '' : (sel === '__etc' ? v('s_bn') : '') });
        openModal(`<div style="text-align:center;padding:10px 4px"><div style="font-size:40px">🎉</div><h2 style="margin:8px 0">가입 신청을 보냈어요</h2>
          <p class="sub" style="font-size:13px">시오레 담당자가 승인하면 같은 아이디·비밀번호로 로그인할 수 있어요.<br>승인 전에 로그인하면 대기 화면이 보여요.</p>
          <button class="btn" style="margin-top:16px" id="mx">확인</button></div>`, mm => { $('#mx', mm).onclick = closeModal; });
      } catch (err) { toast(err.message); }
    };
  });
}
function resetModal() {
  openModal(`<h2>비밀번호 찾기</h2><p class="sub" style="font-size:12.5px;margin:6px 0 14px">아이디와 가입할 때 쓴 연락처 끝 4자리를 넣으면, 시오레 담당자에게 초기화 요청이 가요. 담당자가 임시 비밀번호를 알려드려요.</p>
    <form id="rf2" class="grid" style="gap:10px"><label class="f">아이디<input id="r_id" autocapitalize="off"></label><label class="f">연락처 끝 4자리<input id="r_p4" inputmode="numeric" maxlength="4"></label>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" id="mx">닫기</button><button class="btn">요청 보내기</button></div></form>`, m => {
    $('#mx', m).onclick = closeModal;
    $('#rf2', m).onsubmit = async e => { e.preventDefault(); try { const j = await api('requestReset', { id: $('#r_id', m).value.trim(), phone4: $('#r_p4', m).value.trim() }); closeModal(); toast(j.message); } catch (err) { toast(err.message); } };
  });
}

/* ---------- header / nav ---------- */
const FABRIC = ['#B5342B', '#C0561F', '#C98F2A', '#6E7A3E', '#2E7D78', '#2C5A8A', '#5B3A6E', '#C24A6E', '#8C6A4F', '#3E4A5C', '#D7A9A0', '#A8B89A', '#E0C77A', '#7FA7B8'];
function headerView(withNav) {
  const me = S.me || {};
  const pages = withNav ? PAGES() : [];
  return `<header class="hero"><div class="rail"></div><div class="fabrics">${FABRIC.map(c => `<div class="fb" style="background-color:${c}"></div>`).join('')}</div>
    <div class="who"><span class="nm">${esc(me.name || '')}${me.orgName ? ' · ' + esc(me.orgName) : ''}</span><span class="role ${isAdmin() ? 'admin' : 'partner'}">${isAdmin() ? 'ADMIN' : 'PARTNER'}</span>${S.me ? '<button type="button" class="lo" id="lo">로그아웃</button>' : ''}</div>
    <div class="hero-in"><div class="lk"><span class="mc">Mood Collect</span><span class="x">×</span><span class="si">SIORÉ</span></div><div class="hub">B2B PARTNER MALL</div></div></header>
    ${withNav ? `<nav class="nav"><div class="nav-in">${pages.map((p, i) => `<a data-go="${p.id}" class="${S.page === p.id ? 'on' : ''}" style="--c:${['#B5342B', '#C0561F', '#9A7019', '#5F6B32', '#2E7D78', '#2C5A8A', '#5B3A6E', '#C24A6E'][i % 8]}">${p.label}${p.badge ? `<span class="badge">${p.badge}</span>` : ''}</a>`).join('')}</div></nav>` : ''}`;
}
function bindHeader() { $$('[data-go]').forEach(a => a.onclick = () => go(a.dataset.go)); }

function PAGES() {
  if (isAdmin()) {
    const nOrd = S.orders.filter(o => o.status === '접수대기').length;
    const nUsr = S.users.filter(u => u.status === 'pending' || u.resetRequested).length;
    const nPay = S.payments.filter(p => p.status === '확인대기').length;
    const nSal = S.sales.filter(s => s.status !== '확정').length;
    return [
      { id: 'home', label: '대시보드', view: adminHome, bind: bindCommon },
      { id: 'aorders', label: '발주 처리', badge: nOrd, view: adminOrders, bind: bindAdminOrders },
      { id: 'asettle', label: '월 정산', badge: nSal, view: adminSettle, bind: bindAdminSettle },
      { id: 'apay', label: '입금 확인', badge: nPay, view: adminPay, bind: bindAdminPay },
      { id: 'members', label: '회원 관리', badge: nUsr, view: membersView, bind: bindMembers },
      { id: 'setup', label: '거래 설정', view: setupView, bind: bindSetup },
      { id: 'me', label: '내 정보', view: meView, bind: bindMe }
    ];
  }
  return [
    { id: 'home', label: '대시보드', view: partnerHome, bind: bindCommon },
    { id: 'order', label: '발주하기', view: orderView, bind: bindOrder },
    { id: 'orders', label: '발주 내역', view: ordersView, bind: bindOrders },
    { id: 'sales', label: '월 판매 입력', view: salesView, bind: bindSales },
    { id: 'settle', label: '정산·입금', view: settleView, bind: bindSettle },
    { id: 'info', label: '거래 안내', view: infoView },
    { id: 'me', label: '내 정보', view: meView, bind: bindMe }
  ];
}
function bindCommon() { $$('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto)); }

/* ---------- gates ---------- */
function pendingView() {
  const me = S.me;
  const st = me.status;
  return `<div class="gate"><div class="card" style="text-align:center">
    <div style="font-size:38px">${st === 'pending' ? '⏳' : '🔒'}</div>
    <h2 style="margin:8px 0">${st === 'pending' ? '승인을 기다리고 있어요' : '이용할 수 없는 계정이에요'}</h2>
    <p class="sub" style="font-size:13px">${st === 'pending' ? `${esc(me.name)}님(${esc(me.orgName)})의 가입 신청이 시오레 담당자에게 전달됐어요.<br>승인되면 발주·정산 메뉴가 열려요.` : '시오레 담당자에게 문의해 주세요.'}</p>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn" id="rf">승인됐는지 확인</button><button class="btn sec" id="lo">로그아웃</button></div>
  </div></div>`;
}
function pwGateView() {
  return `<div class="gate"><div class="card">
    <div class="eyebrow">SECURITY</div><h2 style="margin:4px 0 6px">새 비밀번호를 정해 주세요</h2>
    <p class="sub" style="font-size:12.5px;margin-bottom:14px">임시 비밀번호로 로그인했어요. 본인만 아는 비밀번호로 바꾸면 바로 이용할 수 있어요.</p>
    <form id="pg" class="grid" style="gap:10px">
      <label class="f">임시(현재) 비밀번호<input type="password" id="g_old" autocomplete="current-password"></label>
      <label class="f">새 비밀번호<input type="password" id="g_new" placeholder="영문+숫자 8자 이상" autocomplete="new-password"></label>
      <label class="f">새 비밀번호 확인<input type="password" id="g_new2" autocomplete="new-password"></label>
      <div class="row" style="justify-content:flex-end;margin-top:4px"><button type="button" class="btn sec" id="lo">로그아웃</button><button class="btn">비밀번호 변경</button></div>
    </form></div></div>`;
}
function bindPwGate() {
  $('#pg').onsubmit = async e => {
    e.preventDefault();
    if ($('#g_new').value !== $('#g_new2').value) return toast('새 비밀번호 확인이 일치하지 않아요');
    try { await api('changePassword', { oldPw: $('#g_old').value, newPw: $('#g_new').value }); toast('비밀번호를 바꿨어요'); await load(); }
    catch (err) { if (err.message !== '__auth') toast(err.message); }
  };
}
document.addEventListener('click', e => { if (e.target && e.target.id === 'lo') logout(); });

/* ---------- shared calcs ---------- */
function branchStats(bid) {
  const os = S.orders.filter(o => o.branchId === bid && o.status !== '취소' && o.status !== '반려');
  const shipped = os.filter(o => SHIPPED.includes(o.status));
  const ss = S.sales.filter(s => s.branchId === bid);
  const cm = ym();
  return {
    orderedThisMonth: os.filter(o => monthOf(o.createdAt) === cm).reduce((a, o) => a + Number(o.qty || 0), 0),
    shippedTotal: shipped.reduce((a, o) => a + Number(o.qty || 0), 0),
    shippedThisMonth: shipped.filter(o => monthOf(o.shipDate || o.updatedAt) === cm).reduce((a, o) => a + Number(o.qty || 0), 0),
    soldTotal: ss.reduce((a, s) => a + Number(s.qty || 0), 0),
    lastSales: ss[0],
    open: os.filter(o => OPEN.includes(o.status)).length
  };
}
function welcome(sub) {
  return `<div class="welcome"><div class="wt"><div class="k">MOOD COLLECT × SIORÉ</div><h1>좋은 컬러는 <em>건강한 피부</em> 위에서 완성됩니다</h1><p>${sub}</p></div><div class="wi"></div></div>`;
}
function branchTable(list) {
  if (!list.length) return `<div class="empty">등록된 지점이 없어요${isAdmin() ? ' · 거래 설정에서 지점을 추가해 주세요' : ''}</div>`;
  return `<div class="tbl-wrap"><table class="resp"><thead><tr><th>지점</th><th class="n">이번 달 발주</th><th class="n">출고 누계</th><th class="n">판매 누계</th><th class="n">예상 재고</th><th>최근 판매 입력</th></tr></thead><tbody>
    ${list.map(b => { const s = branchStats(b.id); const stock = s.shippedTotal - s.soldTotal; return `<tr><td data-l="지점"><b>${esc(b.name)}</b></td><td class="n" data-l="이번 달 발주">${won(s.orderedThisMonth)}</td><td class="n" data-l="출고 누계">${won(s.shippedTotal)}</td><td class="n" data-l="판매 누계">${won(s.soldTotal)}</td><td class="n" data-l="예상 재고"><b style="color:${stock < 5 ? 'var(--bad)' : 'inherit'}">${won(stock)}</b></td><td data-l="최근 판매 입력">${s.lastSales ? `${esc(s.lastSales.month)} ${pill(s.lastSales.status)}` : '<span class="muted">없음</span>'}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function ordersTable(list, opt = {}) {
  if (!list.length) return `<div class="empty">${opt.empty || '발주 내역이 없어요'}</div>`;
  return `<div class="tbl-wrap"><table class="resp"><thead><tr><th>주문일</th><th>지점</th><th>품목</th><th class="n">수량</th><th class="n">금액</th><th>희망일</th><th>상태</th><th>송장</th>${opt.cancel ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(o => `<tr><td data-l="주문일">${fmtDT(o.createdAt)}</td><td data-l="지점">${esc(o.branchName)}</td><td class="full" data-l="품목" style="max-width:320px">${itemsLine(o.items)}${o.memo ? `<div class="muted" style="font-size:12px">메모: ${esc(o.memo)}</div>` : ''}${o.adminNote ? `<div style="font-size:12px;color:var(--brown)">시오레: ${esc(o.adminNote)}</div>` : ''}</td>
      <td class="n" data-l="수량">${won(o.qty)}</td><td class="n" data-l="금액">${o.amount ? '₩' + won(o.amount) : '<span class="muted">-</span>'}</td><td data-l="희망일">${esc(fmtD(o.wantDate)) || '-'}</td><td data-l="상태">${pill(o.status)}</td>
      <td data-l="송장">${o.tracking ? esc(o.tracking) + (o.shipDate ? `<div class="muted" style="font-size:11.5px">${fmtD(o.shipDate)} 출고</div>` : '') : '<span class="muted">-</span>'}</td>
      ${opt.cancel ? `<td data-l="">${o.status === '접수대기' ? `<button class="btn sec sm" data-cancel="${esc(o.orderId)}">취소</button>` : ''}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- partner pages ---------- */
function partnerHome() {
  const cm = ym();
  const mine = S.orders.filter(o => o.status !== '취소');
  const monthQty = mine.filter(o => monthOf(o.createdAt) === cm && o.status !== '반려').reduce((a, o) => a + Number(o.qty || 0), 0);
  const open = mine.filter(o => OPEN.includes(o.status)).length;
  const pm = prevMonth();
  const salesPrev = S.sales.filter(s => s.month === pm);
  const myBranches = isAll() ? branches() : branches().filter(b => b.id === S.me.scope);
  const stock = myBranches.reduce((a, b) => { const s = branchStats(b.id); return a + s.shippedTotal - s.soldTotal; }, 0);
  const notice = setting('notice');
  return `${welcome(`${esc(S.me.name)}님, 반가워요. ${esc(S.me.orgName)} 발주와 월 정산을 여기서 한 번에 관리해요.`)}
  ${notice ? `<div class="note" style="margin-bottom:14px">📢 ${esc(notice)}</div>` : ''}
  <div class="grid g4" style="margin-bottom:14px">
    <div class="card kpi br"><div class="l">이번 달 발주 수량</div><div class="v">${won(monthQty)}</div><div class="s">${cm}</div></div>
    <div class="card kpi bl"><div class="l">진행 중 발주</div><div class="v">${open}건</div><div class="s">접수·승인·출고</div></div>
    <div class="card kpi wa"><div class="l">${pm} 판매 입력</div><div class="v">${salesPrev.length ? won(salesPrev.reduce((a, s) => a + Number(s.qty || 0), 0)) + '개' : '미입력'}</div><div class="s">${esc(setting('terms_settle') || '익월 초 입력')}</div></div>
    <div class="card kpi ok"><div class="l">예상 매장 재고</div><div class="v">${won(stock)}</div><div class="s">출고 누계 − 판매 누계</div></div>
  </div>
  <div class="row" style="margin-bottom:14px"><button class="btn lg" data-goto="order">＋ 발주하기</button><button class="btn sec lg" data-goto="sales">월 판매 입력</button></div>
  ${isAll() ? `<div class="card" style="margin-bottom:14px"><h2 style="margin-bottom:8px">지점별 현황</h2>${branchTable(myBranches)}</div>` : ''}
  <div class="card"><div class="row" style="margin-bottom:8px"><h2>최근 발주</h2><span class="sp"></span><button class="btn sec sm" data-goto="orders">전체 보기</button></div>${ordersTable(S.orders.slice(0, 5))}</div>`;
}

function orderView() {
  const ps = products();
  const myBr = isAll() ? branches() : branches().filter(b => b.id === S.me.scope);
  if (!S.f.obr || !myBr.find(b => b.id === S.f.obr)) S.f.obr = (myBr[0] || {}).id;
  const qty = qtyOf(S.cart), amt = amountOf(S.cart);
  const noPrice = ps.some(p => !p.supply);
  return `<div class="head"><div><div class="eyebrow">ORDER</div><h1>발주하기</h1><p>수량을 넣고 아래 [발주하기]를 누르면 시오레 담당자에게 바로 전달돼요.</p></div></div>
  ${!myBr.length ? `<div class="note">아직 지점이 연결되지 않았어요. 시오레 담당자에게 문의해 주세요.</div>` : `
  <div class="card" style="margin-bottom:14px">
    ${isAll() ? `<div style="font-size:12px;font-weight:700;color:var(--sub);margin-bottom:6px">받을 지점</div><div class="chips" id="obr" style="margin-bottom:14px">${myBr.map(b => `<span class="chip ${S.f.obr === b.id ? 'on' : ''}" data-v="${esc(b.id)}">${esc(b.name)}</span>`).join('')}</div>` : `<div class="note bl" style="margin-bottom:14px">받을 지점: <b>${esc(brName(S.f.obr))}</b></div>`}
    <div class="plist">${ps.map(p => `<div class="prow"><span class="dot ${p.line === 'RELIEF' ? 'd-rel' : 'd-nmn'}"></span><div class="pn"><b>${esc(p.name)}</b><span>${p.line === 'RELIEF' ? 'DAILY RELIEF' : 'NMN'}${p.vol ? ' · ' + esc(p.vol) : ''}${p.supply ? ' · 공급가 ₩' + won(p.supply) : ''}</span></div>
      <div class="qty"><button type="button" data-dec="${esc(p.sku)}">−</button><input inputmode="numeric" data-q="${esc(p.sku)}" value="${S.cart[p.sku] || ''}" placeholder="0"><button type="button" data-inc="${esc(p.sku)}">＋</button></div></div>`).join('')}</div>
    <div class="grid g2" style="gap:10px;margin-top:14px">
      <label class="f">희망 입고일 <span class="muted" style="font-weight:400">(선택)</span><input type="date" id="o_wd" data-keep="o_wd" min="${ymd()}"></label>
      <label class="f">요청 메모 <span class="muted" style="font-weight:400">(선택)</span><input type="text" id="o_memo" data-keep="o_memo" placeholder="예: 테스터 함께 부탁드려요"></label>
    </div>
    ${noPrice ? `<p class="muted" style="font-size:11.5px;margin-top:10px">공급가가 협의 중인 제품은 금액이 0으로 표시돼요. 수량 기준으로 접수돼요.</p>` : ''}
  </div>
  <div class="sumbar"><div>총 <b id="sq">${won(qty)}</b>개${amt ? ` · <b id="sa">₩${won(amt)}</b>` : '<span id="sa"></span>'}</div><span class="sp"></span><button class="btn sec" id="oclr" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)">비우기</button><button class="btn" id="osub" style="background:#fff;color:var(--ink);border-color:#fff">발주하기</button></div>`}`;
}
function bindOrder() {
  const upd = () => { const q = qtyOf(S.cart), a = amountOf(S.cart); $('#sq') && ($('#sq').textContent = won(q)); if ($('#sa')) $('#sa').innerHTML = a ? '₩' + won(a) : ''; };
  const setQ = (sku, v) => { v = Math.max(0, Math.min(9999, Math.round(Number(v) || 0))); if (v) S.cart[sku] = v; else delete S.cart[sku]; const i = $(`[data-q="${CSS.escape(sku)}"]`); if (i) i.value = v || ''; upd(); };
  $$('[data-q]').forEach(i => i.oninput = () => setQ(i.dataset.q, i.value.replace(/\D/g, '')));
  $$('[data-inc]').forEach(b => b.onclick = () => setQ(b.dataset.inc, (S.cart[b.dataset.inc] || 0) + 1));
  $$('[data-dec]').forEach(b => b.onclick = () => setQ(b.dataset.dec, (S.cart[b.dataset.dec] || 0) - 1));
  $('#obr') && ($('#obr').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; S.f.obr = c.dataset.v; render(); });
  $('#oclr') && ($('#oclr').onclick = () => { S.cart = {}; render(); });
  $('#osub') && ($('#osub').onclick = () => {
    const items = Object.fromEntries(Object.entries(S.cart).filter(([, q]) => q > 0));
    if (!Object.keys(items).length) return toast('수량을 1개 이상 넣어 주세요');
    const wd = $('#o_wd').value, memo = $('#o_memo').value.trim();
    openModal(`<h2>이대로 발주할까요?</h2><p class="sub" style="font-size:12.5px;margin:6px 0 12px">받을 지점: <b>${esc(brName(S.f.obr))}</b>${wd ? ` · 희망 입고 ${esc(wd)}` : ''}</p>
      <div class="tbl-wrap"><table>${Object.entries(items).map(([s, q]) => `<tr><td>${esc(prod(s).name)}</td><td class="n">${q}개</td></tr>`).join('')}<tr><td><b>합계</b></td><td class="n"><b>${won(qtyOf(items))}개${amountOf(items) ? ' · ₩' + won(amountOf(items)) : ''}</b></td></tr></table></div>
      ${memo ? `<p class="sub" style="font-size:12.5px;margin-top:8px">메모: ${esc(memo)}</p>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="mx">수정할게요</button><button class="btn" id="mo">발주하기</button></div>`, m => {
      $('#mx', m).onclick = closeModal;
      $('#mo', m).onclick = async () => {
        $('#mo', m).disabled = true;
        const r = await act('placeOrder', { branchId: S.f.obr, items, wantDate: wd, memo });
        if (r) { S.cart = {}; openModal(`<div style="text-align:center;padding:8px"><div style="font-size:40px">📦</div><h2 style="margin:8px 0">발주가 접수됐어요</h2><p class="sub" style="font-size:13px">시오레 담당자에게 알림이 갔어요.<br>진행 상황은 발주 내역에서 볼 수 있어요.</p><div class="row" style="justify-content:center;margin-top:16px"><button class="btn" id="mo2">발주 내역 보기</button></div></div>`, mm => { $('#mo2', mm).onclick = () => { closeModal(); $$('main [data-keep]').forEach(i => i.value = ''); go('orders'); }; }); }
        else $('#mo', m) && ($('#mo', m).disabled = false);
      };
    });
  });
}

function ordersView() {
  const f = S.f.of || 'all';
  const list = S.orders.filter(o => f === 'all' || (f === 'open' ? OPEN.includes(o.status) : f === 'done' ? o.status === '배송완료' : ['취소', '반려'].includes(o.status)));
  return `<div class="head"><div><div class="eyebrow">ORDERS</div><h1>발주 내역</h1><p>접수대기 상태일 때만 직접 취소할 수 있어요.</p></div>
    <div class="chips" id="of">${[['all', '전체'], ['open', '진행 중'], ['done', '배송완료'], ['x', '취소·반려']].map(([k, l]) => `<span class="chip ${f === k ? 'on' : ''}" data-v="${k}">${l}</span>`).join('')}</div></div>
  <div class="card">${ordersTable(list, { cancel: true })}</div>`;
}
function bindOrders() {
  $('#of').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; S.f.of = c.dataset.v; render(); };
  $$('[data-cancel]').forEach(b => b.onclick = () => openModal(`<h2>발주를 취소할까요?</h2><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="mx">아니요</button><button class="btn br" id="mo">취소하기</button></div>`, m => {
    $('#mx', m).onclick = closeModal; $('#mo', m).onclick = async () => { closeModal(); await act('cancelOrder', { orderId: b.dataset.cancel }, '발주를 취소했어요'); };
  }));
}

function salesView() {
  const myBr = isAll() ? branches() : branches().filter(b => b.id === S.me.scope);
  if (!S.f.sm) S.f.sm = new Date().getDate() <= 15 ? prevMonth() : ym();
  if (!S.f.sbr || !myBr.find(b => b.id === S.f.sbr)) S.f.sbr = (myBr[0] || {}).id;
  const rec = S.sales.find(s => s.month === S.f.sm && s.branchId === S.f.sbr);
  const locked = rec && rec.status === '확정';
  const ps = products();
  return `<div class="head"><div><div class="eyebrow">MONTHLY SALES</div><h1>월 판매 입력</h1><p>한 달 동안 매장에서 판매한 수량을 넣어 주세요. ${esc(setting('terms_settle'))}</p></div></div>
  <div class="card" style="margin-bottom:14px">
    <div class="row" style="margin-bottom:12px;align-items:flex-end">
      <label class="f" style="width:170px">정산 월<input type="month" id="smon" value="${esc(S.f.sm)}" max="${ym()}"></label>
      ${isAll() ? `<div><div style="font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px">지점</div><div class="chips" id="sbr">${myBr.map(b => `<span class="chip ${S.f.sbr === b.id ? 'on' : ''}" data-v="${esc(b.id)}">${esc(b.name)}</span>`).join('')}</div></div>` : `<div class="note bl">지점: <b>${esc(brName(S.f.sbr))}</b></div>`}
      <span class="sp"></span>${rec ? pill(rec.status) : '<span class="pill p-gray">미입력</span>'}
    </div>
    ${locked ? `<div class="note" style="margin-bottom:12px">이 달은 정산이 확정됐어요 (확정 금액 ₩${won(rec.confirmedAmount || rec.amount)}). 수정이 필요하면 시오레 담당자에게 연락해 주세요.</div>` : ''}
    <div class="plist">${ps.map(p => `<div class="prow"><span class="dot ${p.line === 'RELIEF' ? 'd-rel' : 'd-nmn'}"></span><div class="pn"><b>${esc(p.name)}</b><span>${p.supply ? '공급가 ₩' + won(p.supply) : ''}</span></div>
      <input inputmode="numeric" data-sq="${esc(p.sku)}" value="${rec && rec.items[p.sku] ? rec.items[p.sku] : ''}" placeholder="0" style="width:90px;text-align:right" ${locked ? 'disabled' : ''}></div>`).join('')}</div>
    <label class="f" style="margin-top:12px">메모 <span class="muted" style="font-weight:400">(선택)</span><input type="text" id="snote" value="${esc(rec ? rec.note : '')}" ${locked ? 'disabled' : ''} placeholder="예: 테스터 사용 2개 포함"></label>
    ${locked ? '' : `<div class="row" style="margin-top:14px"><div class="sub" id="ssum"></div><span class="sp"></span><button class="btn lg" id="ssave">${rec ? '수정 저장' : '판매 수량 저장'}</button></div>`}
  </div>
  <div class="card"><h2 style="margin-bottom:8px">입력 이력</h2>${salesTable(S.sales)}</div>`;
}
function salesTable(list) {
  if (!list.length) return '<div class="empty">아직 입력한 판매가 없어요</div>';
  return `<div class="tbl-wrap"><table class="resp"><thead><tr><th>월</th><th>지점</th><th>품목</th><th class="n">판매 수량</th><th class="n">정산 금액</th><th>상태</th><th>입력</th></tr></thead><tbody>
    ${list.map(s => `<tr><td data-l="월"><b>${esc(s.month)}</b></td><td data-l="지점">${esc(s.branchName)}</td><td class="full" data-l="품목">${itemsLine(s.items) || '<span class="muted">판매 없음</span>'}</td><td class="n" data-l="판매 수량">${won(s.qty)}</td><td class="n" data-l="정산 금액">₩${won(s.status === '확정' ? (s.confirmedAmount || s.amount) : s.amount)}</td><td data-l="상태">${pill(s.status)}</td><td data-l="입력">${fmtDT(s.updatedAt)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function bindSales() {
  const sum = () => { const it = {}; $$('[data-sq]').forEach(i => { const v = Math.round(Number(i.value.replace(/\D/g, '')) || 0); if (v) it[i.dataset.sq] = v; }); const a = amountOf(it); $('#ssum') && ($('#ssum').innerHTML = `합계 <b>${won(qtyOf(it))}</b>개${a ? ` · 정산 예상 <b>₩${won(a)}</b>` : ''}`); return it; };
  $$('[data-sq]').forEach(i => i.oninput = () => { i.value = i.value.replace(/\D/g, ''); sum(); });
  sum();
  $('#smon').onchange = e => { S.f.sm = e.target.value; render(); };
  $('#sbr') && ($('#sbr').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; S.f.sbr = c.dataset.v; render(); });
  $('#ssave') && ($('#ssave').onclick = async () => {
    const items = sum();
    if (!Object.keys(items).length && !confirmZero()) return;
    await act('saveSales', { month: S.f.sm, branchId: S.f.sbr, items, note: $('#snote').value.trim() }, `${S.f.sm} 판매 수량을 저장했어요`);
  });
  function confirmZero() { if (S._zeroOk) { S._zeroOk = false; return true; } toast('판매가 없는 달이면 한 번 더 누르면 0개로 저장돼요'); S._zeroOk = true; setTimeout(() => S._zeroOk = false, 4000); return false; }
}

function settleView() {
  const myBr = isAll() ? branches() : branches().filter(b => b.id === S.me.scope);
  const months = [...new Set(S.sales.map(s => s.month))].sort().reverse();
  const bank = setting('bank');
  return `<div class="head"><div><div class="eyebrow">SETTLEMENT</div><h1>정산 · 입금</h1><p>${esc(setting('terms_close'))} · ${esc(setting('terms_pay'))}</p></div></div>
  ${bank ? `<div class="note bl" style="margin-bottom:14px">입금 계좌: <b>${esc(bank)}</b></div>` : ''}
  <div class="grid g2" style="margin-bottom:14px">
    <div class="card"><h2 style="margin-bottom:8px">월별 정산</h2>
      ${months.length ? `<div class="tbl-wrap"><table class="resp"><thead><tr><th>월</th><th class="n">정산 금액</th><th class="n">입금 등록</th><th class="n">남은 금액</th><th>상태</th></tr></thead><tbody>
      ${months.map(m => { const ss = S.sales.filter(s => s.month === m && myBr.some(b => b.id === s.branchId)); const amt = ss.reduce((a, s) => a + Number(s.status === '확정' ? (s.confirmedAmount || s.amount) : s.amount || 0), 0); const paid = S.payments.filter(p => p.month === m && p.status !== '불일치').reduce((a, p) => a + Number(p.amount || 0), 0); const done = ss.every(s => s.status === '확정');
        return `<tr><td data-l="월"><b>${m}</b></td><td class="n" data-l="정산 금액">₩${won(amt)}</td><td class="n" data-l="입금 등록">₩${won(paid)}</td><td class="n" data-l="남은 금액"><b style="color:${amt - paid > 0 ? 'var(--bad)' : 'var(--ok)'}">₩${won(Math.max(0, amt - paid))}</b></td><td data-l="상태">${done ? pill('확정') : '<span class="pill p-wait">확정 전</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">월 판매를 입력하면 정산 금액이 계산돼요</div>'}
    </div>
    <div class="card"><h2 style="margin-bottom:10px">입금 등록</h2>
      <form id="pf" class="grid" style="gap:10px">
        <div class="grid g2" style="gap:10px"><label class="f">정산 월<input type="month" id="p_m" value="${esc(months[0] || prevMonth())}"></label><label class="f">입금액(원)<input id="p_a" inputmode="numeric" placeholder="0"></label></div>
        <div class="grid g2" style="gap:10px"><label class="f">입금일<input type="date" id="p_d" value="${ymd()}"></label><label class="f">입금자명<input id="p_p" placeholder="통장에 찍힌 이름"></label></div>
        <button class="btn">입금 등록</button>
      </form>
    </div>
  </div>
  <div class="card"><h2 style="margin-bottom:8px">입금 내역</h2>${payTable(S.payments, false)}</div>`;
}
function payTable(list, admin) {
  if (!list.length) return '<div class="empty">입금 내역이 없어요</div>';
  return `<div class="tbl-wrap"><table class="resp"><thead><tr><th>등록일</th>${admin ? '<th>파트너</th>' : ''}<th>정산 월</th><th class="n">금액</th><th>입금일</th><th>입금자명</th><th>상태</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(p => `<tr><td data-l="등록일">${fmtDT(p.createdAt)}</td>${admin ? `<td data-l="파트너">${esc(p.userName)}${p.branchId ? ' · ' + esc(brName(p.branchId)) : ''}</td>` : ''}<td data-l="정산 월">${esc(p.month)}</td><td class="n" data-l="금액"><b>₩${won(p.amount)}</b></td><td data-l="입금일">${esc(fmtD(p.date))}</td><td data-l="입금자명">${esc(p.payer)}</td><td data-l="상태">${pill(p.status)}${p.note ? `<div class="muted" style="font-size:11.5px">${esc(p.note)}</div>` : ''}</td>
      ${admin ? `<td data-l=""><div class="row" style="gap:6px;justify-content:flex-end">${p.status !== '확인' ? `<button class="btn sm" data-pok="${esc(p.payId)}">확인</button>` : ''}${p.status !== '불일치' ? `<button class="btn sec sm" data-pbad="${esc(p.payId)}">불일치</button>` : ''}</div></td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}
function bindSettle() {
  $('#p_a').oninput = e => { const v = e.target.value.replace(/\D/g, ''); e.target.value = v ? Number(v).toLocaleString('ko-KR') : ''; };
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    const amount = Number($('#p_a').value.replace(/\D/g, ''));
    if (!amount) return toast('입금액을 넣어 주세요');
    await act('addPayment', { month: $('#p_m').value, amount, date: $('#p_d').value, payer: $('#p_p').value.trim(), branchId: isAll() ? '' : S.me.scope }, '입금을 등록했어요. 시오레 담당자가 확인할게요');
  };
}

function infoView() {
  const ps = products();
  return `<div class="head"><div><div class="eyebrow">TERMS</div><h1>거래 안내</h1></div></div>
  <div class="grid g2">
    <div class="card"><h2 style="margin-bottom:10px">정산 기준</h2>
      <div class="grid" style="gap:8px;font-size:13.5px">
        ${[['월 마감', setting('terms_close')], ['판매 입력', setting('terms_settle')], ['입금', setting('terms_pay')], ['입금 계좌', setting('bank')], ['시오레 담당', setting('contact')]].filter(x => x[1]).map(([k, v]) => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div style="width:84px;flex:none;color:var(--sub);font-weight:700;font-size:12.5px">${k}</div><div>${esc(v)}</div></div>`).join('')}
      </div></div>
    <div class="card"><h2 style="margin-bottom:8px">공급 제품</h2><div class="tbl-wrap"><table><thead><tr><th>제품</th><th class="n">공급가</th><th class="n">권장 소비자가</th></tr></thead><tbody>
      ${ps.map(p => `<tr><td><div class="sku"><span class="dot ${p.line === 'RELIEF' ? 'd-rel' : 'd-nmn'}"></span>${esc(p.name)}</div></td><td class="n">${p.supply ? '₩' + won(p.supply) : '<span class="muted">협의 중</span>'}</td><td class="n">${p.rrp ? '₩' + won(p.rrp) : '-'}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
}

function meView() {
  const me = S.me;
  return `<div class="head"><div><div class="eyebrow">MY ACCOUNT</div><h1>내 정보</h1><p>아이디 <b>${esc(me.id)}</b> · ${esc(me.orgName)} · ${isAll() ? '전 지점' : esc(brName(me.scope))}</p></div><button class="btn sec" id="lo">로그아웃</button></div>
  <div class="grid g2">
    <div class="card"><h2 style="margin-bottom:10px">연락처</h2><form id="mf" class="grid" style="gap:10px">
      <label class="f">이름<input id="m_n" value="${esc(me.name)}"></label><label class="f">연락처<input id="m_p" type="tel" value="${esc(me.phone)}"></label><label class="f">이메일<input id="m_e" type="email" value="${esc(me.email)}"></label>
      <div><button class="btn">저장</button></div></form></div>
    <div class="card"><h2 style="margin-bottom:10px">비밀번호 변경</h2><form id="cf" class="grid" style="gap:10px">
      <label class="f">현재 비밀번호<input type="password" id="c_o" autocomplete="current-password"></label>
      <label class="f">새 비밀번호<input type="password" id="c_n" placeholder="영문+숫자 8자 이상" autocomplete="new-password"></label>
      <label class="f">새 비밀번호 확인<input type="password" id="c_n2" autocomplete="new-password"></label>
      <div><button class="btn">비밀번호 변경</button></div></form></div>
  </div>`;
}
function bindMe() {
  $('#mf').onsubmit = async e => { e.preventDefault(); await act('updateProfile', { name: $('#m_n').value.trim(), phone: $('#m_p').value.trim(), email: $('#m_e').value.trim() }, '저장했어요'); };
  $('#cf').onsubmit = async e => {
    e.preventDefault();
    if ($('#c_n').value !== $('#c_n2').value) return toast('새 비밀번호 확인이 일치하지 않아요');
    const r = await act('changePassword', { oldPw: $('#c_o').value, newPw: $('#c_n').value }, '비밀번호를 바꿨어요');
    if (r) $$('#cf input').forEach(i => i.value = '');
  };
}

/* ---------- admin pages ---------- */
function adminHome() {
  const cm = ym();
  const waitO = S.orders.filter(o => o.status === '접수대기').length;
  const waitU = S.users.filter(u => u.status === 'pending').length;
  const shippedM = S.orders.filter(o => SHIPPED.includes(o.status) && monthOf(o.shipDate || o.updatedAt) === cm).reduce((a, o) => a + Number(o.qty || 0), 0);
  const waitP = S.payments.filter(p => p.status === '확인대기');
  return `${welcome('무드컬렉트 전 지점의 발주·출고·판매·정산을 한눈에 봐요.')}
  <div class="grid g4" style="margin-bottom:14px">
    <div class="card kpi wa" data-goto="aorders" style="cursor:pointer"><div class="l">처리할 발주</div><div class="v">${waitO}건</div><div class="s">접수대기</div></div>
    <div class="card kpi br" data-goto="members" style="cursor:pointer"><div class="l">가입 승인 대기</div><div class="v">${waitU}명</div><div class="s">회원 관리</div></div>
    <div class="card kpi bl"><div class="l">이번 달 출고 수량</div><div class="v">${won(shippedM)}</div><div class="s">${cm}</div></div>
    <div class="card kpi ok" data-goto="apay" style="cursor:pointer"><div class="l">입금 확인 대기</div><div class="v">${waitP.length}건</div><div class="s">₩${won(waitP.reduce((a, p) => a + Number(p.amount || 0), 0))}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-bottom:8px">지점별 현황</h2>${branchTable(branches())}</div>
  <div class="card"><div class="row" style="margin-bottom:8px"><h2>최근 발주</h2><span class="sp"></span><button class="btn sec sm" data-goto="aorders">발주 처리</button></div>${ordersTable(S.orders.slice(0, 6))}</div>`;
}

function adminOrders() {
  const f = S.f.aof || 'wait';
  const list = S.orders.filter(o => f === 'all' || (f === 'wait' ? o.status === '접수대기' : f === 'prog' ? ['승인', '출고완료'].includes(o.status) : f === 'done' ? o.status === '배송완료' : ['취소', '반려'].includes(o.status)));
  const cnt = k => S.orders.filter(o => k === 'wait' ? o.status === '접수대기' : ['승인', '출고완료'].includes(o.status)).length;
  return `<div class="head"><div><div class="eyebrow">ORDER DESK</div><h1>발주 처리</h1><p>승인 → [수기발주 복사]로 슬랙 등록 → 출고 처리(송장) → 배송완료 순서예요.</p></div>
    <div class="chips" id="aof">${[['wait', `접수대기 ${cnt('wait')}`], ['prog', `진행 중 ${cnt('prog')}`], ['done', '배송완료'], ['x', '취소·반려'], ['all', '전체']].map(([k, l]) => `<span class="chip ${f === k ? 'on' : ''}" data-v="${k}">${l}</span>`).join('')}</div></div>
  ${!list.length ? '<div class="card"><div class="empty">해당하는 발주가 없어요</div></div>' : `<div class="grid" style="gap:12px">${list.map(o => `
    <div class="card"><div class="row" style="margin-bottom:8px"><b style="font-size:15px">${esc(o.branchName)}</b>${pill(o.status)}${o.manualDone ? '<span class="pill p-ok">수기발주 등록됨</span>' : (o.status === '승인' ? '<span class="pill p-wait">수기발주 미등록</span>' : '')}<span class="sp"></span><span class="muted" style="font-size:12px">${fmtDT(o.createdAt)} · ${esc(o.userName)} · ${esc(o.orderId)}</span></div>
      <div style="font-size:13.5px">${itemsLine(o.items)}</div>
      <div class="sub" style="font-size:12.5px;margin-top:4px">총 <b>${won(o.qty)}</b>개${o.amount ? ' · ₩' + won(o.amount) : ''}${o.wantDate ? ' · 희망 입고 <b>' + esc(o.wantDate) + '</b>' : ''}${o.memo ? ' · 메모: ' + esc(o.memo) : ''}</div>
      ${o.tracking || o.adminNote ? `<div class="sub" style="font-size:12.5px;margin-top:4px">${o.tracking ? '송장 ' + esc(o.tracking) + (o.shipDate ? ' (' + esc(o.shipDate) + ' 출고)' : '') : ''}${o.adminNote ? ' · 메모 ' + esc(o.adminNote) : ''}</div>` : ''}
      <div class="row" style="margin-top:12px;gap:6px">
        ${o.status === '접수대기' ? `<button class="btn sm" data-oa="승인" data-id="${esc(o.orderId)}">승인</button><button class="btn sec sm" data-oa="반려" data-id="${esc(o.orderId)}">반려</button>` : ''}
        ${['접수대기', '승인'].includes(o.status) ? `<button class="btn br sm" data-man="${esc(o.orderId)}">수기발주 복사</button>` : ''}
        ${o.status === '승인' ? `<button class="btn bl sm" data-oa="출고완료" data-id="${esc(o.orderId)}">출고 처리</button>` : ''}
        ${o.status === '출고완료' ? `<button class="btn sm" data-oa="배송완료" data-id="${esc(o.orderId)}">배송완료</button><button class="btn sec sm" data-oa="출고수정" data-id="${esc(o.orderId)}">송장 수정</button>` : ''}
        ${['반려', '취소', '배송완료'].includes(o.status) ? `<button class="btn sec sm" data-oa="되돌리기" data-id="${esc(o.orderId)}">상태 되돌리기</button>` : ''}
      </div></div>`).join('')}</div>`}`;
}
function bindAdminOrders() {
  $('#aof').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; S.f.aof = c.dataset.v; render(); };
  $$('[data-oa]').forEach(b => b.onclick = () => {
    const id = b.dataset.id, a = b.dataset.oa, o = S.orders.find(x => x.orderId === id);
    if (a === '승인' || a === '배송완료') return act('adminOrder', { orderId: id, status: a }, a + ' 처리했어요');
    if (a === '반려') return openModal(`<h2>발주 반려</h2><label class="f" style="margin-top:12px">반려 사유 <span class="muted" style="font-weight:400">(파트너에게 보여요)</span><input id="nt"></label>
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="mx">닫기</button><button class="btn br" id="mo">반려</button></div>`, m => { $('#mx', m).onclick = closeModal; $('#mo', m).onclick = async () => { const nt = $('#nt', m).value; closeModal(); await act('adminOrder', { orderId: id, status: '반려', adminNote: nt }, '반려했어요'); }; });
    if (a === '출고완료' || a === '출고수정') return openModal(`<h2>출고 처리</h2><p class="sub" style="font-size:12.5px;margin:6px 0 12px">입력하면 파트너 발주 내역에 바로 보여요.</p>
      <div class="grid g2" style="gap:10px"><label class="f">출고일<input type="date" id="sd" value="${esc(o.shipDate || ymd())}"></label><label class="f">택배사·송장번호<input id="tk" value="${esc(o.tracking || '')}" placeholder="CJ대한통운 0000-0000-0000"></label></div>
      <label class="f" style="margin-top:10px">메모 <span class="muted" style="font-weight:400">(파트너에게 보여요)</span><input id="nt" value="${esc(o.adminNote || '')}" placeholder="예: 테스터 2개 동봉"></label>
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="mx">닫기</button><button class="btn bl" id="mo">${a === '출고완료' ? '출고 완료' : '저장'}</button></div>`, m => { $('#mx', m).onclick = closeModal; $('#mo', m).onclick = async () => { const v = { shipDate: $('#sd', m).value, tracking: $('#tk', m).value, adminNote: $('#nt', m).value }; closeModal(); await act('adminOrder', Object.assign({ orderId: id, status: '출고완료' }, v), '출고 처리했어요'); }; });
    if (a === '되돌리기') return openModal(`<h2>상태 되돌리기</h2><div class="chips" style="margin-top:12px">${['접수대기', '승인', '출고완료'].map(s => `<span class="chip" data-s="${s}">${s}</span>`).join('')}</div>`, m => { m.onclick = async e => { const c = e.target.closest('[data-s]'); if (!c) return; closeModal(); await act('adminOrder', { orderId: id, status: c.dataset.s }, c.dataset.s + '(으)로 바꿨어요'); }; });
  });
  $$('[data-man]').forEach(b => b.onclick = () => manualModal(S.orders.find(x => x.orderId === b.dataset.man)));
}
function manualModal(o) {
  if (!o) return;
  const br = (S.config.branches || []).find(x => x.id === o.branchId) || {};
  const fields = [
    ['요청자명', S.me.name || '로건'],
    ['요청 발송일', o.wantDate || ymd()],
    ['수령인 정보', `무드컬렉트 ${br.name || ''}\n${br.contact || '(수령인)'} / ${br.phone || '(연락처)'}\n${br.address || '(주소 — 거래 설정에서 입력)'}`],
    ['상품명 · 수량', Object.entries(o.items || {}).filter(([, q]) => q > 0).map(([s, q]) => `${prod(s).name}${prod(s).vol ? ' ' + prod(s).vol : ''} × ${q}`).join('\n')],
    ['구분', '수기-국내 B2B'],
    ['사용내역', `무드컬렉트 위탁 발주요청건 > ${br.name || ''} 공급`],
    ['특이사항 · 추가요청', [o.memo, o.wantDate ? '희망 입고 ' + o.wantDate : ''].filter(Boolean).join(' / ') || '-']
  ];
  openModal(`<h2>슬랙 수기발주 복사</h2><p class="sub" style="font-size:12.5px;margin:6px 0 14px">수기발주 워크플로 칸 순서대로예요. 칸별로 복사해 붙여넣고, 제출 후 <b>등록 완료</b>를 눌러 주세요.</p>
    <div class="grid" style="gap:9px">${fields.map(([l, v], i) => `<div class="row" style="align-items:flex-start;flex-wrap:nowrap;gap:8px"><div style="width:96px;flex:none;font-size:12px;font-weight:700;color:var(--sub);padding-top:6px">${esc(l)}</div>
      <pre style="flex:1;min-width:0;white-space:pre-wrap;word-break:break-all;font:inherit;font-size:13px;background:#F7F2EE;border-radius:8px;padding:7px 10px;margin:0">${esc(v)}</pre><button class="btn sec sm" data-cp="${i}">복사</button></div>`).join('')}</div>
    ${!br.address ? `<div class="note" style="margin-top:12px">이 지점의 배송 정보가 비어 있어요. 거래 설정에서 수령인·연락처·주소를 넣으면 다음부터 자동으로 채워져요.</div>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="cpall">전체 복사</button><button class="btn sec" id="mx">닫기</button><button class="btn br" id="mo">${o.manualDone ? '등록 완료 취소' : '수기발주 등록 완료'}</button></div>`, m => {
    $$('[data-cp]', m).forEach(x => x.onclick = () => copyText(fields[+x.dataset.cp][1]));
    $('#cpall', m).onclick = () => copyText(fields.map(([l, v]) => `[${l}]\n${v}`).join('\n\n'));
    $('#mx', m).onclick = closeModal;
    $('#mo', m).onclick = async () => { closeModal(); await act('adminOrder', { orderId: o.orderId, manualDone: !o.manualDone, status: o.status === '접수대기' && !o.manualDone ? '승인' : undefined }, o.manualDone ? '등록 완료를 취소했어요' : '수기발주 등록 완료로 표시했어요'); };
  });
}

function adminSettle() {
  if (!S.f.asm) S.f.asm = new Date().getDate() <= 15 ? prevMonth() : ym();
  const m = S.f.asm;
  const rows = branches().map(b => ({ b, s: S.sales.find(x => x.month === m && x.branchId === b.id) }));
  S.sales.filter(x => x.month === m && !branches().some(b => b.id === x.branchId)).forEach(s => rows.push({ b: { id: s.branchId, name: s.branchName }, s }));
  const total = rows.reduce((a, r) => a + (r.s ? Number(r.s.status === '확정' ? (r.s.confirmedAmount || r.s.amount) : r.s.amount) : 0), 0);
  const paid = S.payments.filter(p => p.month === m && p.status === '확인').reduce((a, p) => a + Number(p.amount || 0), 0);
  return `<div class="head"><div><div class="eyebrow">MONTHLY CLOSE</div><h1>월 정산</h1><p>파트너가 입력한 판매 수량을 확인하고 금액을 확정해요. 확정하면 파트너는 수정할 수 없어요.</p></div>
    <label class="f" style="width:170px">정산 월<input type="month" id="asm" value="${esc(m)}"></label></div>
  <div class="grid g3" style="margin-bottom:14px">
    <div class="card kpi br"><div class="l">${m} 정산 합계</div><div class="v">₩${won(total)}</div></div>
    <div class="card kpi ok"><div class="l">확인된 입금</div><div class="v">₩${won(paid)}</div></div>
    <div class="card kpi wa"><div class="l">미수</div><div class="v">₩${won(Math.max(0, total - paid))}</div></div>
  </div>
  <div class="card"><div class="tbl-wrap"><table class="resp"><thead><tr><th>지점</th><th>품목</th><th class="n">판매 수량</th><th class="n">자동 계산</th><th class="n">확정 금액</th><th>상태</th><th></th></tr></thead><tbody>
    ${rows.map(({ b, s }) => !s ? `<tr><td data-l="지점"><b>${esc(b.name)}</b></td><td class="full" data-l="품목"><span class="muted">아직 입력 안 함</span></td><td class="n" data-l="판매 수량">-</td><td class="n" data-l="자동 계산">-</td><td class="n" data-l="확정 금액">-</td><td data-l="상태"><span class="pill p-gray">미입력</span></td><td></td></tr>`
      : `<tr><td data-l="지점"><b>${esc(b.name)}</b></td><td class="full" data-l="품목">${itemsLine(s.items) || '<span class="muted">판매 없음</span>'}${s.note ? `<div class="muted" style="font-size:12px">메모: ${esc(s.note)}</div>` : ''}</td><td class="n" data-l="판매 수량">${won(s.qty)}</td><td class="n" data-l="자동 계산">₩${won(s.amount)}</td>
        <td class="n" data-l="확정 금액">${s.status === '확정' ? `<b>₩${won(s.confirmedAmount || s.amount)}</b>` : `<input inputmode="numeric" data-camt="${esc(s.key)}" value="${s.amount || ''}" style="width:120px;text-align:right">`}</td><td data-l="상태">${pill(s.status)}</td>
        <td data-l=""><button class="btn ${s.status === '확정' ? 'sec' : ''} sm" data-conf="${esc(s.key)}" data-op="${s.status === '확정' ? 'reopen' : 'confirm'}">${s.status === '확정' ? '확정 취소' : '확정'}</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">지점이 없어요</div></td></tr>'}
  </tbody></table></div></div>`;
}
function bindAdminSettle() {
  $('#asm').onchange = e => { S.f.asm = e.target.value; render(); };
  $$('[data-camt]').forEach(i => i.oninput = () => i.value = i.value.replace(/\D/g, ''));
  $$('[data-conf]').forEach(b => b.onclick = () => { const k = b.dataset.conf, op = b.dataset.op; const i = $(`[data-camt="${CSS.escape(k)}"]`); act('adminSales', { key: k, op, amount: i ? Number(i.value) : undefined }, op === 'confirm' ? '정산을 확정했어요' : '확정을 취소했어요'); });
}

function adminPay() {
  const f = S.f.apf || 'wait';
  const list = S.payments.filter(p => f === 'all' || (f === 'wait' ? p.status === '확인대기' : p.status !== '확인대기'));
  return `<div class="head"><div><div class="eyebrow">PAYMENTS</div><h1>입금 확인</h1><p>통장 입금 내역과 맞으면 [확인], 다르면 [불일치]를 눌러 주세요.</p></div>
    <div class="chips" id="apf">${[['wait', '확인 대기'], ['done', '처리 완료'], ['all', '전체']].map(([k, l]) => `<span class="chip ${f === k ? 'on' : ''}" data-v="${k}">${l}</span>`).join('')}</div></div>
  <div class="card">${payTable(list, true)}</div>`;
}
function bindAdminPay() {
  $('#apf').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; S.f.apf = c.dataset.v; render(); };
  $$('[data-pok]').forEach(b => b.onclick = () => act('adminPayment', { payId: b.dataset.pok, status: '확인' }, '입금을 확인했어요'));
  $$('[data-pbad]').forEach(b => b.onclick = () => openModal(`<h2>입금 불일치</h2><label class="f" style="margin-top:12px">사유 <span class="muted" style="font-weight:400">(파트너에게 보여요)</span><input id="nt" placeholder="예: 입금액 차이 10,000원"></label>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="mx">닫기</button><button class="btn br" id="mo">불일치 표시</button></div>`, m => { $('#mx', m).onclick = closeModal; $('#mo', m).onclick = async () => { const nt = $('#nt', m).value; closeModal(); await act('adminPayment', { payId: b.dataset.pbad, status: '불일치', note: nt }, '불일치로 표시했어요'); }; }));
}

function scopeSelect(u, attr) {
  const cur = u.status === 'pending' ? (u.orgType === 'HQ' ? 'ALL' : (u.branchId || '')) : u.scope;
  return `<select ${attr} style="width:auto;min-width:130px"><option value="">범위 선택</option><option value="ALL" ${cur === 'ALL' ? 'selected' : ''}>전 지점 (본사)</option>${branches().map(b => `<option value="${esc(b.id)}" ${cur === b.id ? 'selected' : ''}>${esc(b.name)}만</option>`).join('')}</select>`;
}
function membersView() {
  const pend = S.users.filter(u => u.status === 'pending');
  const rest = S.users.filter(u => u.status !== 'pending' && u.role !== 'admin');
  return `<div class="head"><div><div class="eyebrow">MEMBERS</div><h1>회원 관리</h1><p>가입 신청을 승인할 때 볼 수 있는 범위(지점)를 정해요. 퇴사자는 [정지]만 누르면 돼요.</p></div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-bottom:10px">가입 승인 대기 ${pend.length ? `<span class="pill p-wait">${pend.length}</span>` : ''}</h2>
    ${!pend.length ? '<div class="empty">새 가입 신청이 없어요</div>' : `<div class="grid" style="gap:10px">${pend.map(u => `<div class="prow" style="flex-wrap:wrap">
      <div class="pn" style="min-width:200px"><b>${esc(u.name)} <span class="muted" style="font-weight:500">(${esc(u.id)})</span></b><span>${u.orgType === 'HQ' ? '무드컬렉트 본사' : esc(u.orgName)} · ${esc(u.phone)}${u.email ? ' · ' + esc(u.email) : ''} · ${fmtDT(u.createdAt)} 신청</span>
      ${u.orgType !== 'HQ' && !u.branchId ? `<span style="color:var(--bad);display:block">'${esc(u.orgName)}'은(는) 지점 목록에 없어요. 거래 설정에서 지점을 먼저 추가해 주세요.</span>` : ''}</div>
      <div class="row" style="gap:6px">${scopeSelect(u, `data-scope="${esc(u.id)}"`)}<button class="btn sm" data-ua="approve" data-id="${esc(u.id)}">승인</button><button class="btn sec sm" data-ua="reject" data-id="${esc(u.id)}">거절</button></div></div>`).join('')}</div>`}
  </div>
  <div class="card"><h2 style="margin-bottom:8px">파트너 계정</h2>
    ${!rest.length ? '<div class="empty">아직 승인된 파트너가 없어요</div>' : `<div class="tbl-wrap"><table class="resp"><thead><tr><th>이름</th><th>아이디</th><th>소속</th><th>볼 수 있는 범위</th><th>상태</th><th>최근 로그인</th><th></th></tr></thead><tbody>
    ${rest.map(u => `<tr><td data-l="이름"><b>${esc(u.name)}</b>${u.resetRequested ? '<div><span class="pill p-wait">비번 초기화 요청</span></div>' : ''}</td><td data-l="아이디">${esc(u.id)}</td><td data-l="소속">${esc(u.orgName)}</td>
      <td data-l="범위">${scopeSelect(u, `data-chscope="${esc(u.id)}"`)}</td><td data-l="상태">${pill(u.status)}</td><td data-l="최근 로그인">${fmtDT(u.lastLogin) || '<span class="muted">-</span>'}</td>
      <td data-l=""><div class="row" style="gap:6px;justify-content:flex-end">${u.status === 'approved' ? `<button class="btn sec sm" data-ua="suspend" data-id="${esc(u.id)}">정지</button>` : `<button class="btn sec sm" data-ua="resume" data-id="${esc(u.id)}">${u.status === 'rejected' ? '승인으로 변경' : '재개'}</button>`}<button class="btn ${u.resetRequested ? 'br' : 'sec'} sm" data-ua="reset" data-id="${esc(u.id)}">비번 초기화</button></div></td></tr>`).join('')}
    </tbody></table></div>`}
  </div>`;
}
function bindMembers() {
  $$('[data-ua]').forEach(b => b.onclick = async () => {
    const id = b.dataset.id, op = b.dataset.ua;
    if (op === 'approve') {
      const sc = $(`[data-scope="${CSS.escape(id)}"]`).value;
      if (!sc) return toast('볼 수 있는 범위(지점)를 먼저 선택해 주세요');
      return act('adminUser', { id, op, scope: sc }, '승인했어요');
    }
    if (op === 'resume') { const u = S.users.find(x => x.id === id); if (u.status === 'rejected') { const sc = $(`[data-chscope="${CSS.escape(id)}"]`).value; if (!sc) return toast('볼 수 있는 범위를 먼저 선택해 주세요'); return act('adminUser', { id, op: 'approve', scope: sc }, '승인으로 바꿨어요'); } }
    if (op === 'reset') {
      return openModal(`<h2>비밀번호 초기화</h2><p class="sub" style="font-size:13px;margin:8px 0 0">${esc(id)} 계정의 임시 비밀번호를 만들어요. 기존 로그인은 모두 끊기고, 상대방은 임시 비밀번호로 로그인한 뒤 새 비밀번호를 정해야 해요.</p>
        <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="mx">닫기</button><button class="btn br" id="mo">초기화</button></div>`, m => {
        $('#mx', m).onclick = closeModal;
        $('#mo', m).onclick = async () => { const r = await act('adminUser', { id, op: 'reset' }); if (r && r.tempPw) openModal(`<div data-lock><h2>임시 비밀번호</h2><p class="sub" style="font-size:12.5px;margin:6px 0 12px">이 창을 닫으면 다시 볼 수 없어요. 카톡·문자로 전달해 주세요.</p>
            <div style="font-size:24px;font-weight:800;letter-spacing:2px;text-align:center;background:#F7F2EE;border-radius:12px;padding:16px">${esc(r.tempPw)}</div>
            <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" id="cp">복사</button><button class="btn" id="mx">닫기</button></div></div>`, mm => { $('#cp', mm).onclick = () => copyText(`[무드컬렉트 파트너몰] 아이디 ${id} / 임시 비밀번호 ${r.tempPw}\n로그인 후 새 비밀번호로 바꿔 주세요.`); $('#mx', mm).onclick = closeModal; }); };
      });
    }
    const label = { reject: '거절했어요', suspend: '정지했어요', resume: '다시 사용하도록 했어요' }[op];
    act('adminUser', { id, op }, label);
  });
  $$('[data-chscope]').forEach(s => s.onchange = () => s.value && S.users.find(u => u.id === s.dataset.chscope).status !== 'rejected' && act('adminUser', { id: s.dataset.chscope, op: 'scope', scope: s.value }, '범위를 바꿨어요'));
}

function setupView() {
  const c = S.config; const st = c.settings || {};
  if (!S.f.draft) S.f.draft = { branches: JSON.parse(JSON.stringify(c.branches || [])), products: JSON.parse(JSON.stringify(c.products || [])) };
  const d = S.f.draft;
  const on = k => (st[k] || 'on') !== 'off';
  return `<div class="head"><div><div class="eyebrow">SETTINGS</div><h1>거래 설정</h1><p>지점·제품·정산 조건·알림을 바꾸고 아래 [전체 저장]을 눌러 주세요.</p></div></div>
  <div class="card" style="margin-bottom:14px"><div class="row" style="margin-bottom:8px"><h2>지점 · 배송 정보</h2><span class="sp"></span><button class="btn sec sm" id="addb">＋ 지점 추가</button></div>
    <div class="tbl-wrap"><table class="resp" id="bt"><thead><tr><th>지점명</th><th>수령인</th><th>연락처</th><th>주소</th><th>사용</th></tr></thead><tbody>
    ${d.branches.map((b, i) => `<tr data-i="${i}"><td data-l="지점명"><input data-k="name" value="${esc(b.name)}" placeholder="예: 가로수길점"></td><td data-l="수령인"><input data-k="contact" value="${esc(b.contact || '')}"></td><td data-l="연락처"><input data-k="phone" value="${esc(b.phone || '')}"></td><td data-l="주소" style="min-width:220px"><input data-k="address" value="${esc(b.address || '')}"></td><td data-l="사용"><input type="checkbox" data-k="active" ${b.active !== false ? 'checked' : ''}></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">지점을 추가해 주세요</div></td></tr>'}
    </tbody></table></div></div>
  <div class="card" style="margin-bottom:14px"><div class="row" style="margin-bottom:8px"><h2>공급 제품</h2><span class="sp"></span><button class="btn sec sm" id="addp">＋ 제품 추가</button></div>
    <div class="tbl-wrap"><table class="resp" id="pt"><thead><tr><th>제품명</th><th>라인</th><th>용량</th><th class="n">공급가</th><th class="n">권장 소비자가</th><th>판매</th></tr></thead><tbody>
    ${d.products.map((p, i) => `<tr data-i="${i}"><td data-l="제품명" style="min-width:180px"><input data-k="name" value="${esc(p.name)}"></td><td data-l="라인"><select data-k="line"><option value="NMN" ${p.line !== 'RELIEF' ? 'selected' : ''}>NMN</option><option value="RELIEF" ${p.line === 'RELIEF' ? 'selected' : ''}>DAILY RELIEF</option></select></td>
      <td data-l="용량"><input data-k="vol" value="${esc(p.vol || '')}" style="width:90px"></td><td class="n" data-l="공급가"><input data-k="supply" inputmode="numeric" value="${p.supply === '' || p.supply == null ? '' : p.supply}" style="width:110px;text-align:right"></td><td class="n" data-l="권장 소비자가"><input data-k="rrp" inputmode="numeric" value="${p.rrp === '' || p.rrp == null ? '' : p.rrp}" style="width:110px;text-align:right"></td><td data-l="판매"><input type="checkbox" data-k="active" ${p.active !== false ? 'checked' : ''}></td></tr>`).join('')}
    </tbody></table></div></div>
  <div class="grid g2" style="margin-bottom:14px">
    <div class="card"><h2 style="margin-bottom:10px">정산 조건 · 공지</h2><div class="grid" style="gap:10px">
      <label class="f">파트너 공지 <span class="muted" style="font-weight:400">(대시보드 상단)</span><input data-st="notice" value="${esc(st.notice || '')}"></label>
      <label class="f">월 마감<input data-st="terms_close" value="${esc(st.terms_close || '')}"></label>
      <label class="f">판매 입력 기한<input data-st="terms_settle" value="${esc(st.terms_settle || '')}"></label>
      <label class="f">입금 기한<input data-st="terms_pay" value="${esc(st.terms_pay || '')}"></label>
      <label class="f">입금 계좌<input data-st="bank" value="${esc(st.bank || '')}"></label>
      <label class="f">시오레 담당 연락처<input data-st="contact" value="${esc(st.contact || '')}"></label></div></div>
    <div class="card"><h2 style="margin-bottom:10px">알림 받기</h2><div class="grid" style="gap:10px;font-size:13.5px">
      ${[['notify_order', '새 발주 · 취소'], ['notify_signup', '가입 신청'], ['notify_sales', '월 판매 입력'], ['notify_payment', '입금 등록'], ['notify_reset', '비밀번호 초기화 요청'], ['notify_mail', '메일로도 받기 (끄면 슬랙만)']].map(([k, l]) => `<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-nt="${k}" ${on(k) ? 'checked' : ''}> ${l}</label>`).join('')}
      <p class="muted" style="font-size:12px">슬랙 알림은 앱스 스크립트의 스크립트 속성 SLACK_WEBHOOK 이 연결돼 있을 때 가요.</p></div></div>
  </div>
  <div class="sumbar"><div>변경 후 꼭 저장해 주세요</div><span class="sp"></span><button class="btn sec" id="rs" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)">되돌리기</button><button class="btn" id="sv" style="background:#fff;color:var(--ink);border-color:#fff">전체 저장</button></div>`;
}
function bindSetup() {
  const d = S.f.draft;
  const collect = () => {
    $$('#bt tr[data-i]').forEach(tr => { const b = d.branches[+tr.dataset.i]; $$('[data-k]', tr).forEach(i => b[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value.trim()); });
    $$('#pt tr[data-i]').forEach(tr => { const p = d.products[+tr.dataset.i]; $$('[data-k]', tr).forEach(i => p[i.dataset.k] = i.type === 'checkbox' ? i.checked : (['supply', 'rrp'].includes(i.dataset.k) ? (i.value.replace(/\D/g, '') === '' ? '' : Number(i.value.replace(/\D/g, ''))) : i.value.trim())); });
  };
  $('#addb').onclick = () => { collect(); d.branches.push({ id: '', name: '', contact: '', phone: '', address: '', active: true }); render(); };
  $('#addp').onclick = () => { collect(); d.products.push({ sku: '', line: 'NMN', name: '', vol: '', supply: '', rrp: '', active: true }); render(); };
  $('#rs').onclick = () => { S.f.draft = null; render(); toast('저장된 상태로 되돌렸어요'); };
  $('#sv').onclick = async () => {
    collect();
    const settings = {};
    $$('[data-st]').forEach(i => settings[i.dataset.st] = i.value.trim());
    $$('[data-nt]').forEach(i => settings[i.dataset.nt] = i.checked ? 'on' : 'off');
    const r = await act('adminConfig', { branches: d.branches.filter(b => b.name), products: d.products.filter(p => p.name), settings }, '저장했어요');
    if (r) { S.f.draft = null; render(); }
  };
}

/* ---------- start ---------- */
if (!API) {
  $('#app').innerHTML = landingView();
  bindLanding();
  S.loginMsg = '';
} else render();
window.addEventListener('pageshow', e => { if (e.persisted && S.token) load(true).catch(() => {}); });
})();
