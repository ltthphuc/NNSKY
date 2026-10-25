/* Khung ứng dụng: đăng nhập, menu, điều hướng */
(function () {
  const { esc, icon } = U;
  const rootEl = document.getElementById('root');
  const App = (window.App = { me: null, settings: { ...U.DEFAULT_SETTINGS }, classes: [], teachers: [] });

  /* ---------- dữ liệu dùng chung ---------- */
  App.classById = (id) => App.classes.find((c) => c.id === id);
  App.teacherName = (id) => (App.teachers.find((t) => t.id === id) || {}).name || 'Chưa phân công';
  App.openClasses = () => App.classes.filter((c) => c.status !== 'closed');
  App.classOptions = (sel, { all = false, closed = false } = {}) =>
    (all ? `<option value="">Tất cả lớp</option>` : '') +
    (closed ? App.classes : App.openClasses())
      .map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)} · ${esc(c.code)}${c.status === 'closed' ? ' (đã đóng)' : ''}</option>`).join('');
  App.refreshClasses = async () => {
    App.classes = (await DB.q('classes')).sort((a, b) => a.grade - b.grade || String(a.code).localeCompare(String(b.code)));
  };
  App.refreshTeachers = async () => {
    App.teachers = DB.isAdmin()
      ? (await DB.list('users', [['role', '==', 'teacher']])).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      : [{ id: App.me.uid, name: App.me.name, email: App.me.email, phone: App.me.phone, active: true, rateMain: App.me.rateMain, rateAssistant: App.me.rateAssistant }];
  };
  App.renderShellTitle = () => { document.title = `${App.settings.centerName} - Quản lý`; };

  /* ---------- điều hướng ---------- */
  const NAV = [
    { name: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
    { name: 'classes', label: 'Danh sách lớp', icon: 'classes', group: 'Lớp học' },
    { name: 'attendance', label: 'Điểm danh', icon: 'attendance', group: 'Lớp học' },
    { name: 'assessments', label: 'Đánh giá & điểm', icon: 'star', group: 'Lớp học' },
    { name: 'tuition', label: 'Học phí', icon: 'wallet', group: 'Lớp học' },
    { name: 'staff', label: 'Giáo viên', icon: 'teachers', admin: true },
    { name: 'payroll', label: 'Công & lương GV', icon: 'clock', admin: true },
    { name: 'assign', label: 'Phân công & đơn giá', icon: 'teachers', admin: true },
    { name: 'reports', label: 'Báo cáo & hồ sơ', icon: 'download', admin: true },
    { name: 'settings', label: 'Cài đặt', icon: 'settings', admin: true },
  ];
  const navLabel = (n) => (!DB.isAdmin() && n.labelT) || n.label;
  const navLink = (n) => `<a href="#/${n.name}" data-nav="${n.name}">${icon(n.icon)}${navLabel(n)}</a>`;
  const navHtml = (list) => {
    let html = '', open = false;
    for (const n of list) {
      if (n.group && !open) { html += `<div class="grp">${icon('classes', 16)} ${n.group}</div><div class="sub">`; open = true; }
      if (!n.group && open) { html += '</div>'; open = false; }
      html += navLink(n);
    }
    return html + (open ? '</div>' : '');
  };
  const parseHash = () => {
    const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [name, arg] = path.split('/');
    const params = Object.fromEntries(new URLSearchParams(qs));
    if (arg) params.id = decodeURIComponent(arg);
    return { name: name || 'dashboard', params };
  };
  App.go = (name, params = {}) => {
    const { id, ...rest } = params;
    const qs = new URLSearchParams(rest).toString();
    const h = `#/${name}${id ? '/' + encodeURIComponent(id) : ''}${qs ? '?' + qs : ''}`;
    if (location.hash === h) App.render(); else location.hash = h;
  };

  App.render = async () => {
    if (!App.me) return;
    const { name, params } = parseHash();
    if (name === 'teachers') { App.go('staff'); return; } // trang tài khoản giáo viên nay nằm trong mục Giáo viên
    if (name === 'students') { App.go('classes'); return; } // danh sách học sinh nay nằm trong từng lớp
    const item = NAV.find((n) => n.name === name && (!n.admin || DB.isAdmin())) || NAV[0];
    document.body.classList.remove('nav-open');
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === item.name));
    const t = document.getElementById('page-title');
    if (t) t.textContent = (item.group ? item.group + ' › ' : '') + navLabel(item);
    const old = document.getElementById('view');
    const view = document.createElement('main');
    view.className = 'content'; view.id = 'view';
    view.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';
    old.replaceWith(view); // phần tử mới để không giữ lại các sự kiện của màn hình trước
    window.scrollTo(0, 0);
    try {
      await Views[item.name](view, params);
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card"><div class="empty">${icon('info', 44)}<h3>Có lỗi xảy ra</h3><div>${esc(e.message || e)}</div></div></div>`;
    }
  };

  /* ---------- giao diện ---------- */
  function showLogin(msg) {
    const demo = DB.mode === 'demo';
    rootEl.innerHTML = `<div class="login">
      <div class="login-art"><div class="brand"><div class="logo">S</div><div><b>Sky</b><span>Trung tâm ngoại ngữ</span></div></div>
        <div><h2>Quản lý lớp học đơn giản, chính xác, mọi lúc mọi nơi</h2><p>Điểm danh nhanh, nhập điểm, tự tính học phí cuối tháng và xuất báo cáo Excel.</p>
        <ul><li>${icon('attendance')} Điểm danh theo đúng lịch của từng lớp</li><li>${icon('wallet')} Tự động trừ học phí khi học sinh vắng</li><li>${icon('star')} Nhập điểm trực tiếp hoặc từ file Excel</li></ul></div>
        <div class="small" style="color:#8fa8cc">© Trung tâm ngoại ngữ Sky</div></div>
      <div class="login-form"><form class="login-box" id="lf">
        <div class="logo" style="margin-bottom:18px">S</div><h1>Đăng nhập</h1><p class="muted" style="margin:0">Dành cho quản trị viên và giáo viên của trung tâm.</p>
        ${msg ? `<div class="alert err" style="margin-top:16px">${esc(msg)}</div>` : ''}
        <div class="f-row"><label class="f">Tên đăng nhập hoặc email</label><input class="input" type="text" id="em" required autocomplete="username" autocapitalize="none" placeholder="tên đăng nhập"></div>
        <div class="f-row"><label class="f">Mật khẩu</label><input class="input" type="password" id="pw" required autocomplete="current-password" placeholder="••••••••"></div>
        <button class="btn lg" style="width:100%;justify-content:center;margin-top:22px" id="go">Đăng nhập</button>
        ${demo ? `<div class="demo-accounts"><b class="small">Chế độ dùng thử</b><div class="small muted">Bấm để điền nhanh tài khoản mẫu:</div>
          <button type="button" class="btn sm soft" data-fill="admin@sky.vn|admin123">Quản trị viên</button>
          <button type="button" class="btn sm soft" data-fill="gv2@sky.vn|123456">Giáo viên (Lớp 3)</button>
          <button type="button" class="btn sm soft" data-fill="gv1@sky.vn|123456">Giáo viên (Lớp 1, 2)</button></div>` : ''}
      </form></div></div>`;
    const f = document.getElementById('lf');
    f.querySelectorAll('[data-fill]').forEach((b) => (b.onclick = () => { const [e, p] = b.dataset.fill.split('|'); f.querySelector('#em').value = e; f.querySelector('#pw').value = p; }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = f.querySelector('#go'); btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
      try { await DB.login(f.querySelector('#em').value, f.querySelector('#pw').value); } catch (er) { showLogin(er.message); }
    };
  }

  function showNoProfile(p) {
    rootEl.innerHTML = `<div class="login-form" style="min-height:100vh"><div class="login-box card" style="padding:28px">
      <div class="logo" style="margin-bottom:14px">S</div><h1 style="font-size:21px">Tài khoản chưa được cấp quyền</h1>
      <p class="muted">Bạn đã đăng nhập (${esc(p.email || '')}) nhưng chưa có hồ sơ trong hệ thống${p.detail ? ' hoặc chưa được phép đọc dữ liệu (kiểm tra Firestore Rules)' : ''}.
      Nếu bạn là quản trị viên đầu tiên, hãy tạo tài liệu <code>users/${esc(p.uid)}</code> trong Firestore theo hướng dẫn README (role = admin). Nếu là giáo viên, hãy nhờ quản trị viên tạo tài khoản.</p>
      <div class="alert" style="word-break:break-all"><b>UID của bạn:</b> ${esc(p.uid)}</div>
      <button class="btn ghost mt" id="lo">${icon('logout')} Đăng xuất</button></div></div>`;
    document.getElementById('lo').onclick = () => DB.logout();
  }

  function showShell() {
    const admin = DB.isAdmin();
    rootEl.innerHTML = `<div class="app">
      <aside class="sidebar"><div class="brand"><div class="logo">S</div><div><b>Sky</b><span>Quản lý trung tâm</span></div></div>
        <nav class="nav"><div class="nav-label">Quản lý</div>${navHtml(NAV.filter((n) => !n.admin))}
        ${admin ? `<div class="nav-label">Quản trị</div>${navHtml(NAV.filter((n) => n.admin))}` : ''}</nav>
        <div class="side-foot">${esc(App.settings.centerName)}<br>${DB.mode === 'demo' ? 'Chế độ dùng thử' : 'Đã kết nối Firebase'}</div></aside>
      <div class="main">
        ${DB.mode === 'demo' ? `<div class="demo-bar">${icon('info', 14)} <b>Chế độ dùng thử:</b> dữ liệu mẫu lưu trên trình duyệt này, chưa kết nối Firebase.</div>` : ''}
        <header class="topbar"><button class="icon-btn menu-btn" id="menu">${icon('menu', 22)}</button><div class="title" id="page-title"></div><div class="grow"></div>
          <div class="user-chip"><div class="meta"><b>${esc(App.me.name)}</b><span>${admin ? 'Quản trị viên' : 'Giáo viên'}</span></div><div class="avatar">${esc(U.initials(App.me.name))}</div>
          <button class="icon-btn" id="pwd" title="Đổi mật khẩu">${icon('key')}</button><button class="icon-btn" id="out" title="Đăng xuất">${icon('logout')}</button></div></header>
        <main class="content" id="view"></main></div></div>`;
    document.getElementById('menu').onclick = () => document.body.classList.toggle('nav-open');
    document.body.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('#menu')) document.body.classList.remove('nav-open'); });
    document.getElementById('out').onclick = () => DB.logout();
    document.getElementById('pwd').onclick = () => U.modal({
      title: 'Đổi mật khẩu', okText: 'Đổi mật khẩu',
      body: `<div class="form-grid"><div class="full"><label class="f">Mật khẩu hiện tại</label><input class="input" type="password" id="op" autocomplete="current-password"></div>
        <div><label class="f">Mật khẩu mới (tối thiểu 6 ký tự)</label><input class="input" type="password" id="np" autocomplete="new-password"></div>
        <div><label class="f">Nhập lại mật khẩu mới</label><input class="input" type="password" id="np2" autocomplete="new-password"></div></div>`,
      onOk: async (w) => {
        const op = w.querySelector('#op').value, np = w.querySelector('#np').value;
        if (!op) throw new Error('Nhập mật khẩu hiện tại.');
        if (np.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự.');
        if (np !== w.querySelector('#np2').value) throw new Error('Hai lần nhập mật khẩu mới chưa giống nhau.');
        await DB.changePassword(op, np);
        U.toast('Đã đổi mật khẩu', 'ok');
      },
    });
  }

  /* ---------- bảng trên điện thoại: tự gắn nhãn cột để hiển thị dạng thẻ ---------- */
  const stackify = () => {
    document.querySelectorAll('table.t:not([data-stacked]):not(.grid-mx)').forEach((t) => {
      if (t.closest('.preview-box') || !t.tHead || !t.tHead.rows.length) return;
      const heads = [...t.tHead.rows[0].cells].map((h) => h.textContent.trim());
      t.dataset.stacked = '1';
      t.classList.add('stack');
      [...t.tBodies].forEach((b) => [...b.rows].forEach((r) => [...r.cells].forEach((c, i) => { c.dataset.l = heads[i] || ''; if (!c.textContent.trim() && !c.querySelector('input,button,select,a,svg')) c.classList.add('empty-cell'); })));
    });
  };
  let stackTimer = 0;
  new MutationObserver(() => { cancelAnimationFrame(stackTimer); stackTimer = requestAnimationFrame(stackify); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- khởi động ---------- */
  App.boot = async (rerender) => {
    const s = await DB.get('settings', 'main').catch(() => null);
    App.settings = { ...U.DEFAULT_SETTINGS, ...(s || {}) };
    delete App.settings.id;
    await Promise.all([App.refreshClasses(), App.refreshTeachers()]);
    App.renderShellTitle();
    if (rerender) { showShell(); App.render(); }
  };

  async function start() {
    try {
      await DB.init();
    } catch (e) {
      rootEl.innerHTML = `<div class="loading"><h3>Không khởi động được</h3><p>${esc(e.message)}</p></div>`;
      return;
    }
    window.addEventListener('hashchange', () => App.render());
    DB.onAuth(async (p) => {
      if (!p) { App.me = null; DB.me = null; showLogin(); return; }
      if (p.error === 'noprofile') { showNoProfile(p); return; }
      if (p.error === 'inactive') { showLogin('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.'); return; }
      App.me = p; DB.me = p;
      try {
        await App.boot(false);
        showShell();
        if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
        App.render();
      } catch (e) {
        console.error(e);
        rootEl.innerHTML = `<div class="loading"><h3>Không tải được dữ liệu</h3><p>${esc(e.message)}</p><button class="btn ghost" onclick="DB.logout()">Đăng xuất</button></div>`;
      }
    });
  }
  start();
})();
