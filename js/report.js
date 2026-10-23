/* Xuất báo cáo học sinh ra Excel: chọn đối tượng (từng em / đã chọn / cả lớp) và bật tắt từng mục */
(function () {
  const { esc, icon } = U;
  const KEY = 'sky_report_opts_v1';
  const DEFAULTS = {
    code: true, cls: true, phone: true, cccd: false, note: false, status: false,
    scores: true, avg: true, comments: false, att: true, absent: true, detail: false,
    tuition: true, base: true, deduct: true, total: true, paid: true, testScope: 'all',
  };
  const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return { ...DEFAULTS }; } };
  const slug = (s) => U.norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'hoc_sinh';
  const scoreColor = (v) => (typeof v !== 'number' ? undefined : v >= 8 ? 'FF0E7A3E' : v >= 6.5 ? 'FF1F6FEB' : v >= 5 ? 'FFB45309' : 'FFC62828');
  const MONEY = '#,##0" đ"';

  const GROUPS = [
    ['Thông tin học sinh', [['code', 'Mã học sinh'], ['cls', 'Lớp'], ['sdate', 'Ngày bắt đầu học'], ['phone', 'Số điện thoại'], ['cccd', 'CCCD'], ['note', 'Ghi chú'], ['status', 'Trạng thái (đang học / đã nghỉ)']]],
    ['Điểm các bài kiểm tra', [['scores', 'Điểm từng bài kiểm tra'], ['avg', 'Điểm trung bình'], ['comments', 'Kèm nhận xét của từng bài']]],
    ['Điểm danh', [['att', 'Số buổi đi học'], ['absent', 'Số buổi vắng'], ['detail', 'Chi tiết từng buổi (✓ / V)']]],
    ['Học phí của tháng', [['tuition', 'Hiện mục học phí'], ['base', 'Học phí gốc của lớp'], ['deduct', 'Số tiền giảm / trừ'], ['total', 'Số tiền phải đóng'], ['paid', 'Trạng thái đã đóng']]],
  ];

  const R_GROUPS = [
    ['Thông tin', [['r_code', 'Mã học sinh'], ['r_teacher', 'Tên giáo viên']]],
    ['Điểm', [['r_comments', 'Nhận xét của từng bài'], ['r_avg', 'Điểm trung bình']]],
    ['Chuyên cần (trong khoảng ngày)', [['r_present', 'Số buổi đi học'], ['r_absent', 'Số buổi vắng'], ['r_rate', 'Tỷ lệ chuyên cần (%)']]],
    ['Học phí (tháng của ngày kết thúc)', [['r_tuition', 'Hiện mục học phí'], ['r_base', 'Học phí của lớp'], ['r_deduct', 'Giảm / trừ'], ['r_total', 'Số tiền phải đóng'], ['r_paid', 'Trạng thái đã đóng']]],
  ];
  const D2 = {
    mode: 'table', r_code: true, r_teacher: true, r_comments: true, r_avg: true, r_present: true, r_absent: true, r_rate: false,
    r_tuition: false, r_base: true, r_deduct: true, r_total: true, r_paid: true, c_scores: true, c_avg: false, c_blank: false,
    p_org: 'TTNN Sky', p_title: 'Giám đốc', p_signer: '', p_course: '', p_issue: 'blank',
  };
  const fmtLong = (d) => { const x = U.parse(d); return `Ngày ${x.getDate()} tháng ${x.getMonth() + 1} năm ${x.getFullYear()}`; };

  /*
   * opts: { all: mọi học sinh (để tính học phí), filtered: danh sách đang hiển thị, selected: [id], classId, title }
   */
  async function open(opts) {
    const o0 = { ...D2, ...load() };
    const sel = (opts.selected || []).filter((id) => opts.all.some((s) => s.id === id));
    const cls = opts.classId ? App.classById(opts.classId) : null;
    const scopeA = sel.length ? { v: 'sel', t: `Học sinh đã chọn (${sel.length})` } : null;
    const scopeB = { v: 'all', t: cls ? `Cả lớp ${cls.name} (${opts.filtered.length} học sinh)` : `Tất cả học sinh đang hiển thị (${opts.filtered.length})` };
    const scopes = [scopeA, scopeB].filter(Boolean);
    const admin = DB.isAdmin();
    const candidate = [...new Set([...opts.filtered, ...opts.all.filter((s) => sel.includes(s.id))].map((s) => s.classId))];
    const allTests = (await DB.q('assessments')).filter((a) => candidate.includes(a.classId)).sort((a, b) => a.date.localeCompare(b.date));
    const c1 = App.classById(candidate[0]) || {};
    const today = U.today();
    const chk = (k, l, extra = '') => `<label class="ck"><input type="checkbox" data-o="${k}" ${o0[k] ? 'checked' : ''} ${extra}> ${l}</label>`;
    const testsHtml = allTests.length
      ? allTests.map((a) => `<label class="ck"><input type="checkbox" data-t="${a.id}" checked> ${esc(candidate.length > 1 ? ((App.classById(a.classId) || {}).name || '') + ' · ' : '')}${esc(a.title)} <span class="muted small">(${U.fmtDate(a.date)})</span></label>`).join('')
      : '<div class="muted small">Chưa có bài kiểm tra nào để hiển thị.</div>';

    const m = U.modal({
      title: opts.title || 'Xuất báo cáo học sinh', okText: 'Tải file Excel', wide: true,
      body: `<div class="form-grid">
        <div class="full"><label class="f">Kiểu xuất</label><div class="rp-modes">
          <label class="ck"><input type="radio" name="rmode" value="table" ${o0.mode === 'table' ? 'checked' : ''}> <span><b>Bảng tổng hợp</b><small>mỗi học sinh một dòng</small></span></label>
          <label class="ck"><input type="radio" name="rmode" value="result" ${o0.mode === 'result' ? 'checked' : ''}> <span><b>Bảng kết quả học tập</b><small>mỗi học sinh một trang, xếp dọc</small></span></label>
          <label class="ck"><input type="radio" name="rmode" value="cert" ${o0.mode === 'cert' ? 'checked' : ''}> <span><b>Giấy chứng nhận hoàn thành khóa học</b><small>mỗi học sinh một giấy</small></span></label>
        </div></div>
        <div class="full"><label class="f">Xuất cho</label><div class="row">${scopes.map((sc, i) => `<label class="ck"><input type="radio" name="rscope" value="${sc.v}" ${i === 0 ? 'checked' : ''}> ${esc(sc.t)}</label>`).join('')}</div></div>
        <div data-modes="table"><label class="f">Tháng (điểm danh và học phí)</label><input class="input" type="month" id="rmonth" value="${today.slice(0, 7)}"></div>
        <div data-modes="table"><label class="f">Phạm vi bài kiểm tra</label><select class="select" id="rtest"><option value="all" ${o0.testScope === 'all' ? 'selected' : ''}>Tất cả các bài</option><option value="month" ${o0.testScope === 'month' ? 'selected' : ''}>Chỉ các bài trong tháng đã chọn</option></select></div>
        <div data-modes="result"><label class="f">Từ ngày</label><input class="input" type="date" id="rfrom" value="${today.slice(0, 7)}-01"></div>
        <div data-modes="result"><label class="f">Đến ngày</label><input class="input" type="date" id="rto" value="${today}"></div>
      </div>
      <div class="rp-groups" data-modes="table">${GROUPS.map(([t, items]) => `<div class="rp-grp"><div class="rp-t">${t}<button type="button" class="rp-all" data-all="${items.map((i) => i[0]).join(',')}">Chọn / bỏ hết</button></div>
        ${items.map(([k, l]) => `<label class="ck"><input type="checkbox" data-o="${k}" ${o0[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>`).join('')}</div>
      <div class="rp-groups" data-modes="result">${R_GROUPS.map(([t, items]) => `<div class="rp-grp"><div class="rp-t">${t}<button type="button" class="rp-all" data-all="${items.map((i) => i[0]).join(',')}">Chọn / bỏ hết</button></div>
        ${items.map(([k, l]) => chk(k, l)).join('')}</div>`).join('')}</div>
      <div class="rp-groups" data-modes="cert">
        <div class="rp-grp"><div class="rp-t">Thời gian khóa học</div>
          <div class="row" style="flex-wrap:nowrap"><div class="grow"><label class="f">Từ ngày</label><input class="input" type="date" id="cfrom" value="${esc(c1.startDate || '')}"></div><div class="grow"><label class="f">Đến ngày</label><input class="input" type="date" id="cto" value="${esc(c1.endDate || '')}"></div></div>
          ${chk('c_blank', 'Để trống ngày (viết tay sau khi in)')}</div>
        <div class="rp-grp"><div class="rp-t">Nội dung giấy</div>
          <label class="f">Tên khóa học (để trống = tên lớp)</label><input class="input" data-p="p_course" value="${esc(o0.p_course)}" placeholder="${esc(c1.name || 'Ví dụ: Lớp 1')}">
          ${chk('c_scores', 'Hiện điểm các bài kiểm tra đã chọn')}${chk('c_avg', 'Hiện điểm trung bình')}</div>
        <div class="rp-grp"><div class="rp-t">Chữ ký</div>
          <div class="row" style="flex-wrap:nowrap"><div class="grow"><label class="f">Đơn vị</label><input class="input" data-p="p_org" value="${esc(o0.p_org)}"></div><div class="grow"><label class="f">Chức danh</label><input class="input" data-p="p_title" value="${esc(o0.p_title)}"></div></div>
          <label class="f" style="margin-top:8px">Tên người ký (không bắt buộc)</label><input class="input" data-p="p_signer" value="${esc(o0.p_signer)}"></div>
        <div class="rp-grp"><div class="rp-t">Ngày cấp</div>
          <select class="select" data-p="p_issue"><option value="blank" ${o0.p_issue === 'blank' ? 'selected' : ''}>Để trống (viết tay)</option><option value="today" ${o0.p_issue === 'today' ? 'selected' : ''}>Ghi ngày hôm nay</option></select></div>
      </div>
      <div class="rp-grp" data-modes="result cert" style="margin-top:12px"><div class="rp-t">Bài kiểm tra hiển thị<button type="button" class="rp-all" data-alltests>Chọn / bỏ hết</button></div>
        <div class="rp-tests">${testsHtml}</div>
        <div class="hint">Với bảng kết quả, chỉ các bài nằm trong khoảng ngày đã chọn mới hiển thị. Học sinh chỉ hiện bài của lớp mình.</div></div>
      <div class="hint" style="margin-top:10px">Lựa chọn của bạn được nhớ cho lần xuất sau.</div>`,
      onOk: async (w) => {
        const mode = w.querySelector('[name=rmode]:checked').value;
        const o = { testScope: w.querySelector('#rtest').value, mode };
        w.querySelectorAll('[data-o]').forEach((c) => { o[c.dataset.o] = c.checked; });
        w.querySelectorAll('[data-p]').forEach((c) => { o[c.dataset.p] = c.value.trim(); });
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* bỏ qua */ }
        const scope = w.querySelector('[name=rscope]:checked').value;
        const list = scope === 'sel' ? opts.all.filter((s) => sel.includes(s.id)) : opts.filtered;
        if (!list.length) throw new Error('Không có học sinh nào để xuất.');
        const picked = new Set([...w.querySelectorAll('[data-t]:checked')].map((x) => x.dataset.t));
        if (mode === 'table') {
          await build(list, o, w.querySelector('#rmonth').value || today.slice(0, 7), opts.all, admin);
        } else if (mode === 'result') {
          const from = w.querySelector('#rfrom').value, to = w.querySelector('#rto').value;
          if (!from || !to || from > to) throw new Error('Khoảng ngày không hợp lệ (ngày bắt đầu phải trước ngày kết thúc).');
          await buildResults(list, o, picked, from, to, opts.all);
        } else {
          await buildCerts(list, o, picked, w.querySelector('#cfrom').value, w.querySelector('#cto').value);
        }
      },
    });
    const setMode = () => {
      const mode = m.el.querySelector('[name=rmode]:checked').value;
      m.el.querySelectorAll('[data-modes]').forEach((el) => { el.style.display = el.dataset.modes.split(' ').includes(mode) ? '' : 'none'; });
    };
    m.el.querySelectorAll('[name=rmode]').forEach((r) => { r.onchange = setMode; });
    setMode();
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-all]');
      if (b) {
        const boxes = b.dataset.all.split(',').map((k) => m.el.querySelector(`[data-o="${k}"]`));
        const on = boxes.some((x) => !x.checked);
        boxes.forEach((x) => { x.checked = on; });
      }
      if (e.target.closest('[data-alltests]')) {
        const boxes = [...m.el.querySelectorAll('[data-t]')];
        const on = boxes.some((x) => !x.checked);
        boxes.forEach((x) => { x.checked = on; });
      }
    });
  }

  /* dữ liệu từng học sinh dùng chung cho bảng kết quả và giấy chứng nhận */
  const avgOf = (arr) => { const v = arr.filter((x) => typeof x === 'number'); return v.length ? Math.round((v.reduce((p, c) => p + c, 0) / v.length) * 100) / 100 : ''; };
  const sortList = (listIn) => {
    const key = (s) => {
      const c = App.classById(s.classId) || {}, w = s.name.trim().split(/\s+/);
      return String(c.grade || 0).padStart(2, '0') + '|' + (c.code || '') + '|' + w[w.length - 1] + ' ' + s.name;
    };
    return listIn.slice().sort((a, b) => key(a).localeCompare(key(b), 'vi'));
  };
  const testsOf = (s, assessments, picked, from, to) =>
    assessments.filter((a) => a.classId === s.classId && picked.has(a.id) && (!from || a.date >= from) && (!to || a.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((a) => ({ title: a.title, date: a.date, score: a.scores && a.scores[s.id] != null && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : '', comment: (a.comments && a.comments[s.id]) || '' }));
  const fname = (prefix, list) => {
    const classes = [...new Set(list.map((s) => s.classId))].map((id) => App.classById(id)).filter(Boolean);
    return `${prefix}_${list.length === 1 ? slug(list[0].name) : classes.length === 1 ? slug(classes[0].code) : 'hoc_sinh'}.xlsx`;
  };

  async function buildResults(listIn, o, picked, from, to, allStudents) {
    const list = sortList(listIn);
    const classes = [...new Set(list.map((s) => s.classId))].map((id) => App.classById(id)).filter(Boolean);
    const month = to.slice(0, 7);
    const [attendance, assessments, payments] = await Promise.all([DB.q('attendance'), DB.q('assessments'), o.r_tuition ? DB.q('payments', [['month', '==', month]]) : Promise.resolve([])]);
    const trs = o.r_tuition ? U.tuitionRows({ classes, students: allStudents, attendance, payments, settings: App.settings, month }) : [];
    const cards = list.map((s) => {
      const c = App.classById(s.classId) || {};
      const tests = testsOf(s, assessments, picked, from, to);
      const docs = attendance.filter((a) => a.classId === s.classId && a.date >= from && a.date <= to);
      const present = docs.filter((d) => d.records && d.records[s.id] === true).length;
      const absent = docs.filter((d) => d.records && d.records[s.id] === false).length;
      const tr = trs.find((r) => r.student.id === s.id);
      const teacherName = [App.teacherName(c.teacherId), c.assistantId ? 'Trợ giảng: ' + App.teacherName(c.assistantId) : ''].filter(Boolean).join(' · ');
      return {
        center: App.settings.centerName, student: s, cls: c, teacherName, showCode: o.r_code, showTeacher: o.r_teacher,
        subtitle: `${c.name} · từ ngày ${U.fmtDate(from)} đến ngày ${U.fmtDate(to)}`,
        tests, showComments: o.r_comments, avg: o.r_avg ? avgOf(tests.map((t) => t.score)) : null,
        att: o.r_present || o.r_absent || o.r_rate ? { present, absent, showPresent: o.r_present, showAbsent: o.r_absent, showRate: o.r_rate, rate: present + absent ? Math.round((present / (present + absent)) * 100) : '' } : null,
        tuition: o.r_tuition && tr ? { month, base: tr.base, deduct: tr.deduct, total: tr.total, paid: tr.paid, showBase: o.r_base, showDeduct: o.r_deduct, showTotal: o.r_total, showPaid: o.r_paid } : null,
      };
    });
    await X.exportResultCards(cards, fname('Ket_qua_hoc_tap', list));
  }

  async function buildCerts(listIn, o, picked, from, to) {
    const list = sortList(listIn);
    const assessments = o.c_scores || o.c_avg ? await DB.q('assessments') : [];
    const today = U.today();
    const cards = list.map((s) => {
      const c = App.classById(s.classId) || {};
      const tests = testsOf(s, assessments, picked, '', '');
      return {
        center: App.settings.centerName, student: s, courseName: o.p_course || c.name, classCode: c.code,
        from: o.c_blank || !from ? '' : U.fmtDate(from), to: o.c_blank || !to ? '' : U.fmtDate(to),
        tests, showScores: o.c_scores, avg: o.c_avg ? avgOf(tests.map((t) => t.score)) : '',
        org: o.p_org || App.settings.centerName, signerTitle: o.p_title, signerName: o.p_signer, issueDate: o.p_issue === 'today' ? fmtLong(today) : '',
      };
    });
    await X.exportCertificates(cards, fname('Giay_chung_nhan', list));
  }

  async function build(listIn, o, month, allStudents, admin) {
    const key = (s) => {
      const c = App.classById(s.classId) || {}, w = s.name.trim().split(/\s+/);
      return String(c.grade || 0).padStart(2, '0') + '|' + (c.code || '') + '|' + w[w.length - 1] + ' ' + s.name;
    };
    const list = listIn.slice().sort((a, b) => key(a).localeCompare(key(b), 'vi'));
    const classIds = [...new Set(list.map((s) => s.classId))];
    const classes = classIds.map((id) => App.classById(id)).filter(Boolean);
    const [attendance, assessments, payments] = await Promise.all([DB.q('attendance'), DB.q('assessments'), DB.q('payments', [['month', '==', month]])]);

    const cols = [], gets = [];
    const add = (c, g) => { cols.push(c); gets.push(g); };
    add({ h: 'STT', w: 6, align: 'center' }, (s, i) => i + 1);
    if (o.code) add({ h: 'Mã HS', w: 22 }, (s) => s.code || '');
    add({ h: 'Họ và tên', w: 28, bold: true }, (s) => s.name);
    if (o.cls) add({ h: 'Lớp', w: 12, align: 'center' }, (s) => (App.classById(s.classId) || {}).name || '');
    if (o.sdate) add({ h: 'Bắt đầu học', w: 14, align: 'center' }, (s) => (s.startDate ? U.fmtDate(s.startDate) : 'Từ đầu khóa'));
    if (o.phone) add({ h: 'Số điện thoại', w: 16, align: 'center' }, (s) => s.phone || '');
    if (o.cccd) add({ h: 'CCCD', w: 18, align: 'center' }, (s) => (admin ? s.cccd || '' : U.maskId(s.cccd || '')));
    if (o.status) add({ h: 'Trạng thái', w: 12, align: 'center' }, (s) => (s.status === 'inactive' ? 'Đã nghỉ' : 'Đang học'));
    if (o.note) add({ h: 'Ghi chú', w: 28 }, (s) => s.note || '');

    // điểm các bài kiểm tra
    let tests = assessments.filter((a) => classIds.includes(a.classId)).sort((a, b) => a.date.localeCompare(b.date));
    if (o.testScope === 'month') tests = tests.filter((a) => a.date.slice(0, 7) === month);
    const scoreOf = (s, a) => (a.classId === s.classId && a.scores && a.scores[s.id] != null && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : '');
    if (o.scores) {
      tests.forEach((a) => {
        const c = App.classById(a.classId);
        add({ h: `${classes.length > 1 && c ? c.name + ' · ' : ''}${a.title}\n${U.shortDate(a.date)}`, w: 16, align: 'center', fmt: '0.0#', color: scoreColor }, (s) => scoreOf(s, a));
        if (o.comments) add({ h: `Nhận xét: ${a.title}`, w: 30, wrap: true }, (s) => (a.classId === s.classId && a.comments && a.comments[s.id]) || '');
      });
    }
    if (o.avg) {
      add({ h: 'Điểm TB', w: 11, align: 'center', fmt: '0.0#', bold: true, color: scoreColor, avg: true }, (s) => {
        const v = tests.map((a) => scoreOf(s, a)).filter((x) => x !== '');
        return v.length ? Math.round((v.reduce((p, c) => p + c, 0) / v.length) * 100) / 100 : '';
      });
    }

    // điểm danh trong tháng
    const [from, to] = U.monthRange(month);
    const mdocs = attendance.filter((a) => a.date.slice(0, 7) === month);
    const countOf = (s, v) => mdocs.filter((d) => d.classId === s.classId && d.records && d.records[s.id] === v).length;
    if (o.att) add({ h: 'Số buổi đi học', w: 13, align: 'center', color: () => 'FF0E7A3E', bold: true, sum: true }, (s) => countOf(s, true));
    if (o.absent) add({ h: 'Số buổi vắng', w: 13, align: 'center', color: (v) => (v > 0 ? 'FFC62828' : undefined), bold: true, sum: true }, (s) => countOf(s, false));
    if (o.detail) {
      const dates = [...new Set(classes.flatMap((c) => U.sessions(c, from, to)))].sort();
      dates.forEach((d) => add({ h: `${U.dayShort(U.parse(d).getDay())}\n${U.shortDate(d)}`, w: 8, align: 'center', bold: true, color: (v) => (v === 'V' ? 'FFC62828' : 'FF0E7A3E') }, (s) => {
        const doc = mdocs.find((x) => x.classId === s.classId && x.date === d);
        const v = doc && doc.records && doc.records[s.id];
        return v === true ? '✓' : v === false ? 'V' : '';
      }));
    }

    // học phí tháng
    if (o.tuition) {
      const trs = U.tuitionRows({ classes, students: allStudents, attendance, payments, settings: App.settings, month });
      const tr = (s) => trs.find((r) => r.student.id === s.id) || {};
      const money = (key) => (s) => (tr(s)[key] === undefined ? '' : tr(s)[key]);
      if (o.base) add({ h: 'Học phí', w: 15, fmt: MONEY, sum: true }, money('base'));
      if (o.deduct) add({ h: 'Giảm / trừ', w: 15, fmt: MONEY, sum: true, color: (v) => (v > 0 ? 'FFC62828' : undefined) }, money('deduct'));
      if (o.total) add({ h: `Phải đóng\n${U.monthLabel(month)}`, w: 17, fmt: MONEY, bold: true, sum: true }, money('total'));
      if (o.paid) add({ h: 'Đã đóng?', w: 12, align: 'center', color: (v) => (v === 'Đã đóng' ? 'FF0E7A3E' : 'FFB45309') }, (s) => (tr(s).student ? (tr(s).paid ? 'Đã đóng' : 'Chưa đóng') : ''));
    }

    const rows = list.map((s, i) => gets.map((g) => g(s, i)));
    let total;
    if (list.length > 1) {
      const nameIdx = cols.findIndex((c) => c.h === 'Họ và tên');
      total = cols.map((c, i) => {
        if (i === nameIdx) return 'Tổng cộng / trung bình';
        if (c.sum) return rows.reduce((p, r) => p + (typeof r[i] === 'number' ? r[i] : 0), 0);
        if (c.avg) { const v = rows.map((r) => r[i]).filter((x) => typeof x === 'number'); return v.length ? Math.round((v.reduce((p, c2) => p + c2, 0) / v.length) * 100) / 100 : ''; }
        return '';
      });
    }
    const single = list.length === 1;
    const title = single ? 'BÁO CÁO HỌC SINH' : classes.length === 1 ? `BÁO CÁO LỚP ${classes[0].name.toUpperCase()}` : 'BÁO CÁO HỌC SINH';
    const info = [single ? `Học sinh: ${list[0].name}${(App.classById(list[0].classId) || {}).name ? ' · ' + App.classById(list[0].classId).name : ''}` : `Số học sinh: ${list.length}${classes.length === 1 ? ' · Lớp ' + classes[0].name + ' (' + classes[0].code + ')' : ''}`,
      `Tháng: ${month.slice(5)}/${month.slice(0, 4)} · Ngày xuất: ${U.fmtDate(U.today())}`];
    await X.exportTable({
      name: 'Báo cáo học sinh', title, info, cols, rows, total, landscape: cols.length > 7,
      freezeCols: o.code ? 3 : 2, signature: list.length > 1,
    }, `Bao_cao_${single ? slug(list[0].name) : classes.length === 1 ? slug(classes[0].code) : 'hoc_sinh'}_${month}.xlsx`);
  }

  window.Report = { open };
})();
