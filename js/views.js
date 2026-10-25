/* Màn hình: Tổng quan, Lớp học, Học sinh */
window.Views = window.Views || {};
(function () {
  const { esc, icon, money } = U;
  const empty = (ic, title, text) => `<div class="empty">${icon(ic, 44)}<h3>${esc(title)}</h3><div>${text || ''}</div></div>`;
  const head = (title, sub, actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${actions}</div></div>`;
  window.UI = { empty, head };

  const schoolYears = () => {
    const now = new Date(), sy = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return [sy - 1, sy, sy + 1, sy + 2].map((y) => `${y}-${y + 1}`);
  };
  const currentSchoolYear = () => schoolYears()[1];
  const termDates = (term, sy) => {
    const y = Number(sy.slice(0, 4));
    if (term === 'HK1') return [`${y}-09-01`, `${y + 1}-01-15`];
    if (term === 'HK2') return [`${y + 1}-01-20`, `${y + 1}-05-31`];
    return [`${y}-09-01`, `${y + 1}-05-31`];
  };
  const termName = (t) => ({ HK1: 'Học kỳ 1', HK2: 'Học kỳ 2', NH: 'Cả năm học' }[t] || t || '');

  /* ===================================================================
   *  TỔNG QUAN
   * =================================================================== */
  Views.dashboard = async (root) => {
    const classes = App.classes.filter((c) => c.status !== 'closed');
    const [students, attendance] = await Promise.all([DB.q('students'), DB.q('attendance')]);
    const active = students.filter((s) => s.status !== 'inactive' && classes.some((c) => c.id === s.classId));
    const today = U.today(), month = today.slice(0, 7);
    const todays = classes.filter((c) => U.sessions(c, today, today).length);

    let money4 = '';
    if (DB.isAdmin()) {
      const payments = await DB.list('payments', [['month', '==', month]]);
      const rows = U.tuitionRows({ classes, students, attendance, payments, settings: App.settings, month });
      const due = rows.reduce((s, r) => s + r.total, 0), got = rows.filter((r) => r.paid).reduce((s, r) => s + r.total, 0);
      money4 = `<div class="card stat"><div class="ico o">${icon('wallet', 24)}</div><div><b>${money(got)}</b><span>Đã thu / ${money(due)} (${U.monthLabel(month)})</span></div></div>`;
    } else {
      const abs = attendance.filter((a) => a.date.slice(0, 7) === month).reduce((n, a) => n + Object.values(a.records || {}).filter((v) => v === false).length, 0);
      money4 = `<div class="card stat"><div class="ico o">${icon('attendance', 24)}</div><div><b>${abs}</b><span>Lượt vắng trong ${U.monthLabel(month).toLowerCase()}</span></div></div>`;
    }

    const todayHtml = todays.length
      ? todays.map((c) => {
          const doc = attendance.find((a) => a.classId === c.id && a.date === today);
          const abs = doc ? Object.values(doc.records || {}).filter((v) => v === false).length : 0;
          return `<div class="list-item"><div class="time">${esc(U.timeText(U.slotFor(c, today)))}</div>
            <div class="grow"><b>${esc(c.name)}</b> <span class="muted">· ${esc(c.code)}</span><div class="small muted">${esc(App.teacherName(c.teacherId))}</div></div>
            ${doc ? `<span class="badge ok">${icon('check', 14)} Đã điểm danh${abs ? ' · ' + abs + ' vắng' : ''}</span>` : '<span class="badge warn">Chưa điểm danh</span>'}
            <a class="btn sm ${doc ? 'ghost' : ''}" href="#/classes/${c.id}?tab=attendance&date=${today}">${doc ? 'Xem' : 'Điểm danh'}</a></div>`;
        }).join('')
      : empty('calendar', 'Hôm nay không có lớp nào học', 'Chọn mục Điểm danh để xem các buổi khác theo lịch.');

    const classHtml = classes.length
      ? classes.map((c) => {
          const n = active.filter((s) => s.classId === c.id).length;
          return `<div class="list-item"><div class="avatar" style="border-radius:12px">${esc(c.grade)}</div>
            <div class="grow"><a href="#/classes/${c.id}"><b>${esc(c.name)}</b></a><div class="small muted">${esc(U.scheduleText(c))}</div></div>
            <div class="right"><b>${n}</b><div class="small muted">học sinh</div></div></div>`;
        }).join('')
      : empty('classes', 'Chưa có lớp nào', DB.isAdmin() ? 'Vào mục Lớp học để tạo lớp mới.' : 'Quản trị viên chưa phân công lớp cho bạn.');

    root.innerHTML = `${head(`Xin chào, ${esc(App.me.name)}`, `Hôm nay ${U.dayName(new Date().getDay())}, ${U.fmtDate(today)}`)}
      <div class="stats">
        <div class="card stat"><div class="ico">${icon('classes', 24)}</div><div><b>${classes.length}</b><span>Lớp đang mở</span></div></div>
        <div class="card stat"><div class="ico s">${icon('students', 24)}</div><div><b>${active.length}</b><span>Học sinh đang học</span></div></div>
        <div class="card stat"><div class="ico g">${icon('calendar', 24)}</div><div><b>${todays.length}</b><span>Buổi học hôm nay</span></div></div>
        ${money4}
      </div>
      <div class="two-col">
        <div class="card"><div class="card-h"><h3>Lịch học hôm nay</h3></div>${todayHtml}</div>
        <div class="card"><div class="card-h"><h3>${DB.isAdmin() ? 'Các lớp đang mở' : 'Lớp của tôi'}</h3></div>${classHtml}</div>
      </div>`;
  };

  /* ===================================================================
   *  LỚP HỌC
   * =================================================================== */
  Views.classes = async (root, params = {}) => {
    if (params.id) return classDetail(root, params.id, params);
    const admin = DB.isAdmin();
    const students = await DB.q('students');
    const rowHtml = (c) => {
      const n = students.filter((s) => s.classId === c.id && s.status !== 'inactive').length;
      return `<tr>
        <td><span class="badge blue">${esc(c.code)}</span></td>
        <td class="name"><a href="#/classes/${c.id}">${esc(c.name)}</a></td>
        <td class="nowrap">${esc(U.scheduleText(c))}</td>
        <td>${esc(termName(c.term))}<div class="small muted">${esc(c.schoolYear || '')}</div></td>
        <td>${esc(App.teacherName(c.teacherId))}${c.assistantId ? `<div class="small muted">TG: ${esc(App.teacherName(c.assistantId))}</div>` : ''}</td>
        <td class="center">${esc(U.periodsText(c))}</td>
        <td class="right mono">${money(c.fee)}<div class="small muted">${c.feeMode === 'attend' ? 'Theo buổi học' : 'Theo buổi nghỉ'}</div></td>
        <td class="center"><b>${n}</b></td>
        <td>${c.status === 'closed' ? '<span class="badge">Đã đóng</span>' : '<span class="badge ok">Đang mở</span>'}</td>
        <td class="nowrap right"><a class="btn sm soft" href="#/classes/${c.id}">${icon('students', 15)} Học sinh</a> <a class="btn sm soft" href="#/classes/${c.id}?tab=attendance">${icon('attendance', 15)} Điểm danh</a> <button class="icon-btn" data-rep="${c.id}" title="Xuất báo cáo cả lớp">${icon('download')}</button>${admin ? `<button class="icon-btn" data-edit="${c.id}" title="Sửa">${icon('edit')}</button><button class="icon-btn danger" data-del="${c.id}" title="Xóa">${icon('trash')}</button>` : ''}</td>
      </tr>`;
    };
    root.innerHTML = `${head('Lớp học', admin ? 'Tạo lớp theo học kỳ hoặc năm học, mỗi lớp có mã riêng.' : 'Các lớp bạn được phân công.', `<button class="btn ghost" id="batch">${icon('printer')} In phiếu hoàn thành hàng loạt</button>${admin ? `<button class="btn" id="add">${icon('plus')} Tạo lớp mới</button>` : ''}`)}
      <div class="card toolbar">${App.classFilterBar()}<span class="muted grow">${App.shown().length}/${App.classes.length} lớp</span></div>
      <div class="card"><div class="table-wrap">${App.shown().length ? `<table class="t"><thead><tr>
        <th>Mã lớp</th><th>Tên lớp</th><th>Lịch học</th><th>Học kỳ</th><th>Giáo viên</th><th class="center">Tiết/buổi</th><th class="right">Học phí/tháng</th><th class="center">Sĩ số</th><th>Trạng thái</th><th></th>
      </tr></thead><tbody>${App.shown().slice().sort((a, b) => a.grade - b.grade || a.code.localeCompare(b.code)).map(rowHtml).join('')}</tbody></table>` : empty('classes', App.classes.length ? 'Không có lớp nào theo bộ lọc' : 'Chưa có lớp nào', App.classes.length ? 'Hãy đổi bộ lọc lớp ở phía trên.' : admin ? 'Bấm "Tạo lớp mới" để bắt đầu.' : 'Quản trị viên chưa phân công lớp cho bạn.')}</div></div>`;

    if (admin) {
      root.querySelector('#add').onclick = () => classModal(null);
      if (params.new) classModal(null);
    }
    root.onclick = async (e) => {
      if (e.target.closest('#batch')) { batchModal(); return; }
      const rp = e.target.closest('[data-rep]');
      if (rp) { const c = App.classById(rp.dataset.rep); const list = students.filter((s) => s.classId === c.id && s.status !== 'inactive'); Report.open({ all: students, filtered: list, selected: [], classId: c.id, title: `Báo cáo lớp ${c.name}` }); return; }
      if (!admin) return;
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
      if (ed) classModal(App.classById(ed.dataset.edit));
      if (de) {
        const c = App.classById(de.dataset.del);
        if (students.some((s) => s.classId === c.id)) return U.toast('Lớp còn học sinh. Hãy chuyển hoặc xóa học sinh trước, hoặc đổi trạng thái lớp thành "Đã đóng".', 'err');
        if (!(await U.confirm(`Xóa lớp <b>${esc(c.name)}</b> (${esc(c.code)}) cùng toàn bộ dữ liệu điểm danh, đánh giá?`, 'Xóa lớp'))) return;
        for (const col of ['attendance', 'assessments', 'teacherAttendance']) for (const d of await DB.list(col, [['classId', '==', c.id]])) await DB.del(col, d.id);
        await DB.del('classes', c.id);
        U.toast('Đã xóa lớp', 'ok');
        await App.refreshClasses();
        App.render();
      }
    };
  };


  /* In hàng loạt phiếu hoàn thành (song ngữ): chọn nhiều lớp, in phiếu của mọi học sinh trong từng lớp (lớp nào xếp liền lớp đó) */
  async function batchModal() {
    const classes = App.shown().slice().sort((a, b) => a.grade - b.grade || a.code.localeCompare(b.code));
    if (!classes.length) return U.toast('Không có lớp nào theo bộ lọc lớp đang chọn.', 'err');
    const [students, assess] = await Promise.all([DB.q('students'), DB.q('assessments')]);
    const KEY = 'sky_complete_opts_v1';
    let o = { org: 'TTNN Sky', title: 'Giám đốc', signer: '', issue: 'today', scores: true, certCmt: false, sumCmt: true };
    try { o = { ...o, ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { /* bỏ qua */ }
    const today = U.today();
    const act = (c) => U.sortVN(students.filter((s) => s.classId === c.id && s.status !== 'inactive'));
    const testsOf = (c) => assess.filter((a) => a.classId === c.id).sort((a, b) => a.date.localeCompare(b.date));
    const avgOf = (v) => { const n = v.filter((x) => typeof x === 'number'); return n.length ? Math.round((n.reduce((p, c) => p + c, 0) / n.length) * 100) / 100 : ''; };
    const longDate = (d) => { const x = U.parse(d); return `Ngày ${x.getDate()} tháng ${x.getMonth() + 1} năm ${x.getFullYear()}`; };
    const m = U.modal({
      title: 'In hàng loạt phiếu hoàn thành theo lớp (song ngữ Anh - Việt)', wide: true, hideFooter: true,
      body: `<label class="f">Chọn các lớp cần in</label>
        <div class="rp-grp" style="margin-bottom:12px"><div class="rp-t">Lớp<button type="button" class="rp-all" id="allc">Chọn / bỏ hết</button></div>
          ${classes.map((c) => `<label class="ck"><input type="checkbox" data-c="${c.id}" ${c.status === 'closed' ? '' : 'checked'}> <b>${esc(c.name)}</b> · ${esc(c.code)} <span class="muted small">· ${act(c).length} học sinh đang học · ${testsOf(c).length} bài kiểm tra${c.status === 'closed' ? ' · lớp đã đóng' : ''}</span></label>`).join('')}</div>
        <div class="form-grid">
          <div><label class="f">Đơn vị ký / Organization</label><input class="input" id="borg" value="${esc(o.org)}"></div>
          <div><label class="f">Chức danh (Việt)</label><input class="input" id="btitle" value="${esc(o.title)}"></div>
          <div><label class="f">Title (English)</label><input class="input" id="btitleen" value="${esc(U.enTitle(o.title))}"></div>
          <div><label class="f">Tên người ký / Signer (không bắt buộc)</label><input class="input" id="bsigner" value="${esc(o.signer)}"></div>
          <div><label class="f">Ngày ký</label><select class="select" id="bissue"><option value="today" ${o.issue === 'today' ? 'selected' : ''}>Ghi ngày hôm nay</option><option value="custom" ${o.issue === 'custom' ? 'selected' : ''}>Nhập ngày ký</option><option value="blank" ${o.issue === 'blank' ? 'selected' : ''}>Để trống (viết tay)</option></select>
          <input class="input ${o.issue === 'custom' ? '' : 'hidden'}" type="date" id="bissuedate" value="${today}" style="margin-top:8px"></div></div>
        <div class="row" style="margin:12px 0 4px;gap:18px"><label class="ck"><input type="checkbox" id="bsc" ${o.scores ? 'checked' : ''}> Hiện điểm trên phiếu</label>
          <label class="ck"><input type="checkbox" id="bcc" ${o.certCmt ? 'checked' : ''}> Hiện nhận xét trên phiếu</label>
          <label class="ck"><input type="checkbox" id="bsm" ${o.sumCmt ? 'checked' : ''}> Hiện nhận xét trong bảng tổng hợp</label></div>
        <div class="hint">Phiếu song ngữ Anh - Việt. Thời gian khóa học lấy theo ngày khai giảng của từng lớp đến ngày kết thúc (hoặc hôm nay nếu lớp chưa kết thúc). Mỗi học sinh đang học một phiếu A4, các lớp in nối tiếp nhau. Bản Excel gom tất cả vào một sheet, 2 phiếu trên mỗi tờ A4.</div>
        <div class="alert" id="bsum" style="margin:12px 0"></div>
        <div class="row"><button class="btn" id="bpc">${icon('printer')} In phiếu hoàn thành</button><button class="btn" id="bps">${icon('printer')} In bảng tổng hợp từng lớp</button><button class="btn ghost" id="bxc">${icon('download')} Xuất Excel phiếu (1 sheet)</button><div class="grow"></div><button class="btn ghost" data-x>Đóng</button></div>`,
    });
    const w = m.el, q = (s2) => w.querySelector(s2);
    const chosen = () => classes.filter((c) => q(`[data-c="${c.id}"]`).checked);
    const sumText = () => { const cl = chosen(); q('#bsum').textContent = `Đã chọn ${cl.length} lớp, tổng ${cl.reduce((n, c) => n + act(c).length, 0)} phiếu hoàn thành sẽ được in.`; };
    sumText();
    w.addEventListener('change', (e) => {
      if (e.target.dataset.c !== undefined) sumText();
      if (e.target.id === 'bissue') q('#bissuedate').classList.toggle('hidden', e.target.value !== 'custom');
    });
    w.addEventListener('click', (e) => {
      if (e.target.closest('#allc')) { const b = [...w.querySelectorAll('[data-c]')]; const on = b.some((x) => !x.checked); b.forEach((x) => { x.checked = on; }); sumText(); return; }
      const btn = e.target.closest('#bpc, #bps, #bxc');
      if (!btn) return;
      const cl = chosen();
      if (!cl.length) return U.toast('Hãy chọn ít nhất một lớp.', 'err');
      const opt = { org: q('#borg').value.trim() || App.settings.centerName, title: q('#btitle').value.trim(), signer: q('#bsigner').value.trim(), issue: q('#bissue').value, scores: q('#bsc').checked, certCmt: q('#bcc').checked, sumCmt: q('#bsm').checked };
      const titleEn = q('#btitleen').value.trim() || U.enTitle(opt.title);
      try { localStorage.setItem(KEY, JSON.stringify({ ...o, ...opt })); } catch (er) { /* bỏ qua */ }
      const center = App.settings.centerName, centerEn = U.centerEn();
      const issue = opt.issue === 'today' ? longDate(today) : opt.issue === 'custom' && q('#bissuedate').value ? longDate(q('#bissuedate').value) : '', issueEn = '';
      const perClass = cl.map((c) => {
        const tests = testsOf(c);
        const rows = act(c).map((s) => {
          const items = tests.map((a) => ({ title: a.title, date: a.date, score: a.scores && a.scores[s.id] != null && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : '', comment: (a.comments && a.comments[s.id]) || '' }));
          return { student: s, tests: items, avg: avgOf(items.map((i) => i.score)) };
        });
        const from = c.startDate ? U.fmtDate(c.startDate) : '', to = U.fmtDate(c.endDate && c.endDate < today ? c.endDate : today);
        return { c, tests, rows, from, to };
      }).filter((x) => x.rows.length);
      if (!perClass.length) return U.toast('Các lớp đã chọn chưa có học sinh đang học.', 'err');
      if (btn.id === 'bpc') {
        Report.printCertificates(perClass.flatMap((x) => x.rows.map((r) => ({ ...r, course: x.c.name, code: x.c.code, from: x.from, to: x.to }))),
          { center, centerEn, showScores: opt.scores, showComments: opt.certCmt, org: opt.org, title: opt.title, titleEn, signer: opt.signer, issue, issueEn });
      } else if (btn.id === 'bps') {
        Report.printSummaries(perClass.map((x) => ({
          center, centerEn, cls: x.c, teachers: teachersBi(x.c), from: x.from, to: x.to, tests: x.tests, rows: x.rows, classTotal: x.rows.length,
          showComments: opt.sumCmt, org: opt.org, title: opt.title, titleEn, signer: opt.signer, issue, issueEn,
        })));
      } else {
        X.exportCertificates(perClass.flatMap((x) => x.rows.map((r) => ({ center, centerEn, student: r.student, courseName: x.c.name, classCode: x.c.code, from: x.from, to: x.to, tests: r.tests, showScores: opt.scores, avg: opt.scores ? r.avg : '', org: opt.org, signerTitle: opt.title, signerTitleEn: titleEn, signerName: opt.signer, issueDate: issue, issueDateEn: issueEn }))), `Giay_chung_nhan_hang_loat_${today}.xlsx`);
      }
    });
  }

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomClassCode = () => {
    for (;;) {
      const b = new Uint32Array(5); crypto.getRandomValues(b);
      const code = 'SKY-' + [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
      if (!App.classes.some((k) => k.code === code)) return code;
    }
  };

  /* Bước 1: nhập tên lớp -> tạo mã ngẫu nhiên; Bước 2: nhập các thông tin còn lại */
  function classModal(c) {
    if (c) return classForm(c);
    U.modal({
      title: 'Tạo lớp mới', okText: 'Tạo lớp',
      body: `<label class="f">Tên lớp *</label><input class="input" id="nm" placeholder="Ví dụ: Lớp 3A, Tiếng Anh khối 3..." maxlength="60">
        <div class="hint">Sau khi bấm "Tạo lớp", hệ thống tự tạo mã lớp ngẫu nhiên (không trùng) và mở form nhập thông tin lớp.</div>`,
      onOk: (w) => {
        const name = w.querySelector('#nm').value.trim().replace(/\s+/g, ' ');
        if (!name) throw new Error('Vui lòng nhập tên lớp.');
        setTimeout(() => classForm(null, { name, code: randomClassCode() }), 0);
      },
    });
  }

  function classForm(c, init) {
    const isNew = !c;
    const sy0 = currentSchoolYear();
    const d = c || { grade: 1, name: 'Lớp 1', term: 'HK1', schoolYear: sy0, days: [2, 4], start: '17:30', end: '19:00', fee: App.settings.defaultFee, status: 'open', teacherId: '', assistantId: '', periods: U.suggestPeriods('17:30', '19:00', App.settings.periodMinutes) };
    if (isNew) {
      [d.startDate, d.endDate] = termDates(d.term, d.schoolYear);
      d.code = init.code; d.name = init.name;
      const gm = /[1-5]/.exec(init.name); if (gm) d.grade = Number(gm[0]);
    }
    const teachers = App.teachers.filter((t) => t.active !== false || t.id === d.teacherId || t.id === d.assistantId);
    let dateTouched = !isNew;
    const slotState = {};
    U.slots(d).forEach((s) => { slotState[s.day] = { start: s.start, end: s.end, periods: s.periods, touched: Number(s.periods) !== U.suggestPeriods(s.start, s.end, App.settings.periodMinutes) }; });
    const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
    const tOpts = (sel) => `<option value="">-- Không có --</option>${teachers.map((t) => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}`;
    const m = U.modal({
      title: isNew ? `Thông tin lớp ${d.name}` : `Sửa lớp ${d.name}`, okText: isNew ? 'Lưu lớp' : 'Lưu thay đổi', wide: true,
      body: `<div class="form-grid">
        <div class="full"><div class="code-box"><span>Mã lớp</span><b>${esc(d.code)}</b><small>Mã tạo ngẫu nhiên, không trùng với lớp khác</small></div></div>
        <div><label class="f">Khối</label><select class="select" id="grade">${[1, 2, 3, 4, 5].map((g) => `<option value="${g}" ${d.grade == g ? 'selected' : ''}>Khối ${g}</option>`).join('')}</select></div>
        <div><label class="f">Tên lớp *</label><input class="input" id="name" value="${esc(d.name)}"></div>
        <div><label class="f">Năm học</label><select class="select" id="year">${schoolYears().map((y) => `<option ${d.schoolYear === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        <div><label class="f">Học kỳ</label><select class="select" id="term">${['HK1', 'HK2', 'NH'].map((t) => `<option value="${t}" ${d.term === t ? 'selected' : ''}>${termName(t)}</option>`).join('')}</select></div>
        <div><label class="f">Giáo viên chính</label><select class="select" id="teacher">${tOpts(d.teacherId)}</select></div>
        <div><label class="f">Trợ giảng (không bắt buộc)</label><select class="select" id="assistant">${tOpts(d.assistantId)}</select></div>
        <div class="full"><label class="f">Lịch học hằng tuần * (mỗi ngày chọn giờ riêng)</label>
          <div class="day-pick">${DAY_ORDER.map((n) => `<label><input type="checkbox" name="day" value="${n}" ${slotState[n] ? 'checked' : ''}><span>${U.dayName(n)}</span></label>`).join('')}</div>
          <div id="slots" class="slots"></div>
          <div class="hint">Mỗi ngày học có giờ bắt đầu, giờ kết thúc và số tiết riêng. Số tiết tự gợi ý theo giờ (1 tiết = ${esc(App.settings.periodMinutes)} phút) và dùng để tính tiền giáo viên.</div></div>
        <div><label class="f">Ngày khai giảng (ngày mở lớp) *</label><input class="input" type="date" id="sd" value="${esc(d.startDate || '')}"></div>
        <div><label class="f">Ngày kết thúc</label><input class="input" type="date" id="ed" value="${esc(d.endDate || '')}"></div>
        <div><label class="f">Học phí mỗi tháng (đ) *</label><input class="input" type="number" min="0" step="1000" id="fee" value="${esc(d.fee)}"><div class="hint">Học phí này dùng để tự tính tiền cuối tháng cho lớp.</div></div>
        <div><label class="f">Cách tính học phí học sinh</label><select class="select" id="feemode"><option value="absence" ${d.feeMode !== 'attend' ? 'selected' : ''}>Theo số buổi nghỉ (trừ tiền khi vắng)</option><option value="attend" ${d.feeMode === 'attend' ? 'selected' : ''}>Theo số buổi đã đi học</option></select></div>
        <div id="rate-box"><label class="f">Đơn giá mỗi buổi học (đ)</label><input class="input" type="number" min="0" step="1000" id="rate" value="${esc(d.sessionRate != null ? d.sessionRate : Math.round((d.fee || 0) / 8))}"><div class="hint">Học phí = số buổi có mặt × đơn giá, tối đa bằng học phí tháng của lớp (đi đủ thì không tính thêm).</div></div>
        <div><label class="f">Trạng thái</label><select class="select" id="status"><option value="open" ${d.status !== 'closed' ? 'selected' : ''}>Đang mở</option><option value="closed" ${d.status === 'closed' ? 'selected' : ''}>Đã đóng (kết thúc)</option></select></div>
      </div>`,
      onOk: async (w) => {
        const v = (id) => w.querySelector('#' + id).value.trim();
        const slots = DAY_ORDER.filter((n) => w.querySelector(`[name=day][value="${n}"]`).checked).map((n) => ({ day: n, start: slotState[n].start, end: slotState[n].end, periods: Number(slotState[n].periods) }));
        const days = slots.map((s) => s.day);
        const code = d.code;
        if (!v('name')) throw new Error('Vui lòng nhập tên lớp.');
        if (!v('sd')) throw new Error('Vui lòng nhập ngày khai giảng (ngày mở lớp). Các buổi học chỉ được tạo từ ngày này.');
        if (App.classes.some((k) => k.id !== (c && c.id) && k.code.toLowerCase() === code.toLowerCase())) throw new Error('Mã lớp bị trùng, vui lòng đóng cửa sổ và tạo lại.');
        if (!days.length) throw new Error('Chọn ít nhất một ngày học trong tuần.');
        for (const s of slots) {
          if (!s.start || !s.end || s.start >= s.end) throw new Error(`Giờ học ${U.dayName(s.day)} không hợp lệ (giờ kết thúc phải sau giờ bắt đầu).`);
          if (!(s.periods > 0)) throw new Error(`Số tiết ${U.dayName(s.day)} không hợp lệ.`);
        }
        if (v('sd') && v('ed') && v('sd') > v('ed')) throw new Error('Ngày kết thúc phải sau ngày khai giảng.');
        if (v('fee') === '' || Number(v('fee')) < 0) throw new Error('Học phí không hợp lệ.');
        const data = {
          code, name: v('name'), grade: Number(v('grade')), term: v('term'), schoolYear: v('year'), days, slots, start: slots[0].start, end: slots[0].end,
          startDate: v('sd'), endDate: v('ed'), fee: Number(v('fee')), teacherId: v('teacher'), assistantId: v('assistant'), status: v('status'),
          periods: slots[0].periods, feeMode: v('feemode'), sessionRate: Math.max(0, Number(v('rate')) || 0),
        };
        if (data.feeMode === 'attend' && !(data.sessionRate > 0)) throw new Error('Nhập đơn giá mỗi buổi học (lớn hơn 0).');
        if (data.teacherId && data.teacherId === data.assistantId) throw new Error('Giáo viên chính và trợ giảng phải là hai người khác nhau.');
        data.teacherIds = U.classTeachers(data);
        const id = await DB.save('classes', c && c.id, data);
        if (c && U.classTeachers(c).join() !== data.teacherIds.join()) {
          // đồng bộ giáo viên cho dữ liệu của lớp (để giáo viên mới nhìn thấy)
          for (const col of ['students', 'attendance', 'assessments', 'payments', 'teacherAttendance']) {
            const list = await DB.list(col, [['classId', '==', id]]);
            await DB.updateMany(col, list.map((x) => x.id), { teacherId: data.teacherId, teacherIds: data.teacherIds });
          }
        }
        U.toast(isNew ? `Đã tạo lớp ${data.name} (mã ${data.code})` : 'Đã lưu thay đổi', 'ok');
        await App.refreshClasses();
        App.render();
      },
    });
    const w = m.el;
    const upd = () => {
      if (!dateTouched) { const [a, b] = termDates(w.querySelector('#term').value, w.querySelector('#year').value); w.querySelector('#sd').value = a; w.querySelector('#ed').value = b; }
    };
    const showRate = () => { w.querySelector('#rate-box').classList.toggle('hidden', w.querySelector('#feemode').value !== 'attend'); };
    w.querySelector('#feemode').onchange = showRate; showRate();
    /* khung giờ riêng cho từng ngày học */
    const slotsBox = w.querySelector('#slots');
    const renderSlots = () => {
      const checked = DAY_ORDER.filter((n) => w.querySelector(`[name=day][value="${n}"]`).checked);
      DAY_ORDER.forEach((n) => { if (!checked.includes(n)) delete slotState[n]; });
      let last = null;
      checked.forEach((n) => {
        if (!slotState[n]) {
          const src = last || { start: '17:30', end: '19:00' };
          slotState[n] = { start: src.start, end: src.end, periods: U.suggestPeriods(src.start, src.end, App.settings.periodMinutes), touched: false };
        }
        last = slotState[n];
      });
      slotsBox.innerHTML = checked.length
        ? checked.map((n) => `<div class="slot-row" data-day="${n}"><b>${U.dayName(n)}</b>
            <input class="input" type="time" data-f="start" value="${esc(slotState[n].start || '')}"><span class="muted">đến</span>
            <input class="input" type="time" data-f="end" value="${esc(slotState[n].end || '')}">
            <label class="small muted">Số tiết</label><input class="input" type="number" min="0.5" max="10" step="0.5" data-f="periods" value="${esc(slotState[n].periods)}"></div>`).join('')
          + (checked.length > 1 ? '<button type="button" class="btn sm ghost" id="copyslot">Dùng giờ của ngày đầu cho tất cả các ngày</button>' : '')
        : '<div class="muted small">Chọn các ngày học trong tuần ở trên.</div>';
    };
    w.querySelectorAll('[name=day]').forEach((x) => { x.onchange = renderSlots; });
    slotsBox.oninput = (e) => {
      const row = e.target.closest('.slot-row'); if (!row) return;
      const st = slotState[row.dataset.day], f = e.target.dataset.f;
      st[f] = e.target.value;
      if (f === 'periods') st.touched = true;
      else if (!st.touched) { st.periods = U.suggestPeriods(st.start, st.end, App.settings.periodMinutes); row.querySelector('[data-f=periods]').value = st.periods; }
    };
    slotsBox.onclick = (e) => {
      if (!e.target.closest('#copyslot')) return;
      const first = slotsBox.querySelector('.slot-row'); const s0 = slotState[first.dataset.day];
      slotsBox.querySelectorAll('.slot-row').forEach((r) => { Object.assign(slotState[r.dataset.day], { start: s0.start, end: s0.end, periods: s0.periods, touched: s0.touched }); });
      renderSlots();
    };
    renderSlots();
    w.querySelector('#sd').oninput = w.querySelector('#ed').oninput = () => { dateTouched = true; };
    ['grade', 'term', 'year'].forEach((id) => { w.querySelector('#' + id).onchange = upd; });
    if (isNew) upd();
  }

  /* ===================================================================
   *  HỌC SINH CỦA LỚP (nằm trong trang chi tiết lớp)
   * =================================================================== */
  const nextCode = (cls, all) => {
    let mx = 0;
    all.filter((s) => s.classId === cls.id).forEach((s) => { const mm = /-(\d+)$/.exec(s.code || ''); if (mm) mx = Math.max(mx, +mm[1]); });
    return mx;
  };

  Views.students = async () => { App.go('classes'); };

  /* Trang chi tiết lớp: xem, thêm, sửa, nhập Excel, xuất báo cáo học sinh của lớp */
  async function classDetail(root, id, params = {}) {
    const cls = App.classById(id);
    if (!cls) { root.innerHTML = `${head('Không tìm thấy lớp')}<div class="card">${empty('classes', 'Lớp không tồn tại hoặc bạn không có quyền xem', '<a href="#/classes">Quay lại danh sách lớp</a>')}</div>`; return; }
    const admin = DB.isAdmin();
    const tab = params.tab === 'attendance' ? 'attendance' : params.tab === 'complete' ? 'complete' : 'students';
    const teachersText = [App.teacherName(cls.teacherId), cls.assistantId ? 'Trợ giảng: ' + App.teacherName(cls.assistantId) : ''].filter(Boolean).join(' · ');
    const tabs = [['students', 'Học sinh', `#/classes/${id}`], ['attendance', 'Điểm danh học sinh & giáo viên', `#/classes/${id}?tab=attendance`], ['complete', 'Phiếu hoàn thành khóa học', `#/classes/${id}?tab=complete`], ['assess', 'Điểm kiểm tra', `#/assessments?class=${id}`], ['tuition', 'Học phí', `#/tuition?class=${id}`]];
    root.innerHTML = `<div class="page-head"><div><a href="#/classes" class="small">${icon('back', 14)} Danh sách lớp</a>
        <h1 style="margin-top:6px">${esc(cls.name)} <span class="badge blue" style="vertical-align:middle">${esc(cls.code)}</span></h1>
        <p>${esc(U.scheduleText(cls))} · ${esc(teachersText)}</p></div>
        <div class="row">${admin ? `<button class="btn ghost" id="editcls">${icon('edit')} Sửa lớp</button>` : ''}</div></div>
      <div class="tabs">${tabs.map(([k, l, h]) => `<a class="tab ${k === tab ? 'on' : ''}" href="${h}">${l}</a>`).join('')}</div>
      <div id="tabbody"></div>`;
    const ec = root.querySelector('#editcls');
    if (ec) ec.onclick = () => classModal(cls);
    const body = root.querySelector('#tabbody');
    if (tab === 'attendance') { await Views.attendance(body, { class: id, date: params.date, month: params.month, scope: params.scope, embed: 1 }); return; }
    if (tab === 'complete') { await completePanel(body, cls); return; }
    await studentsPanel(body, cls);
  }


  /* Tab "Phiếu hoàn thành khóa học" (song ngữ Anh - Việt): chọn học sinh đã hoàn thành, in phiếu từng em và bảng tổng hợp cả lớp (điểm + nhận xét) */
  const teachersBi = (c) => [`Giáo viên / Teacher: ${App.teacherName(c.teacherId)}`, c.assistantId ? `Trợ giảng / Assistant: ${App.teacherName(c.assistantId)}` : ''].filter(Boolean).join(' · ');
  async function completePanel(root, cls) {
    const id = cls.id;
    const [students, assess] = await Promise.all([DB.q('students', [['classId', '==', id]]), DB.q('assessments', [['classId', '==', id]])]);
    const list = U.sortVN(students.filter((s) => s.status !== 'inactive'));
    const tests = assess.slice().sort((a, b) => a.date.localeCompare(b.date));
    const KEY = 'sky_complete_opts_v1';
    let o = { org: 'TTNN Sky', title: 'Giám đốc', signer: '', issue: 'today', scores: true, certCmt: false, sumCmt: true };
    try { o = { ...o, ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { /* bỏ qua */ }
    const teachers = teachersBi(cls);
    const today = U.today();
    const scoreOf = (st, a) => (a.scores && a.scores[st.id] != null && a.scores[st.id] !== '' ? Number(a.scores[st.id]) : '');
    const avgOf = (v) => { const n = v.filter((x) => typeof x === 'number'); return n.length ? Math.round((n.reduce((p, c) => p + c, 0) / n.length) * 100) / 100 : ''; };
    const scoreColor = (v) => (typeof v !== 'number' ? undefined : v >= 8 ? 'FF0E7A3E' : v >= 6.5 ? 'FF1F6FEB' : v >= 5 ? 'FFB45309' : 'FFC62828');
    const longDate = (d) => { const x = U.parse(d); return `Ngày ${x.getDate()} tháng ${x.getMonth() + 1} năm ${x.getFullYear()}`; };

    root.innerHTML = `<div class="card"><div class="card-h"><h3>Thông tin phiếu hoàn thành <span class="muted" style="font-weight:500">/ Certificate details</span></h3><span class="small muted">Phiếu song ngữ Anh - Việt, dùng cho cả phiếu từng học sinh và bảng tổng hợp của lớp</span></div><div class="card-b"><div class="form-grid">
        <div><label class="f">Tên khóa học (tiếng Việt)</label><input class="input" id="cname" value="${esc(cls.name)}"></div>
        <div><label class="f">Course name (English)</label><input class="input" id="cnameen" value="${esc(U.enClass(cls.name))}"></div>
        <div><label class="f">Từ ngày / From</label><input class="input" type="date" id="cfrom" value="${esc(cls.startDate || '')}"></div>
        <div><label class="f">Đến ngày / To</label><input class="input" type="date" id="cto" value="${esc(cls.endDate && cls.endDate < today ? cls.endDate : today)}"></div>
        <div><label class="f">Đơn vị ký / Organization</label><input class="input" id="corg" value="${esc(o.org)}"></div>
        <div><label class="f">Ngày ký</label><select class="select" id="cissue"><option value="today" ${o.issue === 'today' ? 'selected' : ''}>Ghi ngày hôm nay</option><option value="custom" ${o.issue === 'custom' ? 'selected' : ''}>Nhập ngày ký</option><option value="blank" ${o.issue === 'blank' ? 'selected' : ''}>Để trống (viết tay)</option></select>
          <input class="input ${o.issue === 'custom' ? '' : 'hidden'}" type="date" id="cissuedate" value="${today}" style="margin-top:8px"></div>
        <div><label class="f">Chức danh (tiếng Việt)</label><input class="input" id="ctitle" value="${esc(o.title)}"></div>
        <div><label class="f">Title (English)</label><input class="input" id="ctitleen" value="${esc(U.enTitle(o.title))}"></div>
        <div class="full"><label class="f">Tên người ký / Signer (không bắt buộc)</label><input class="input" id="csigner" value="${esc(o.signer)}"></div></div></div></div>
      <div class="card mt"><div class="card-h"><h3>Bài kiểm tra hiển thị <span class="muted" style="font-weight:500">/ Tests shown</span></h3><div class="grow"></div><button class="btn sm ghost" id="alltests">Chọn / bỏ hết</button></div><div class="card-b">
        ${tests.length ? `<div class="rp-tests">${tests.map((a) => `<label class="ck"><input type="checkbox" data-t="${a.id}" checked> ${esc(a.title)} <span class="muted small">(${U.fmtDate(a.date)})</span></label>`).join('')}</div>` : '<div class="muted">Lớp chưa có bài kiểm tra nào. Vào tab "Điểm kiểm tra" để tạo và nhập điểm.</div>'}
        <div class="row" style="margin-top:12px;gap:18px"><label class="ck"><input type="checkbox" id="oscores" ${o.scores ? 'checked' : ''}> Hiện điểm trên phiếu từng học sinh</label>
          <label class="ck"><input type="checkbox" id="ocert" ${o.certCmt ? 'checked' : ''}> Hiện nhận xét trên phiếu từng học sinh</label>
          <label class="ck"><input type="checkbox" id="osum" ${o.sumCmt ? 'checked' : ''}> Hiện nhận xét trong bảng tổng hợp lớp</label></div></div></div>
      <div class="card mt"><div class="card-h"><h3>Học sinh đã hoàn thành khóa học <span class="muted" style="font-weight:500">/ Students who completed</span></h3><div class="grow"></div><span class="badge ok" id="cnt"></span></div>
        <div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th class="chk"><input type="checkbox" id="pickall" checked></th><th>#</th><th>Họ và tên</th><th class="center">Số bài đã chấm</th><th class="center">Điểm TB</th></tr></thead><tbody>
          ${list.map((s, i) => { const v = tests.map((a) => scoreOf(s, a)); return `<tr><td class="chk"><input type="checkbox" data-s="${s.id}" checked></td><td class="muted">${i + 1}</td><td class="name">${esc(s.name)}</td><td class="center">${v.filter((x) => x !== '').length}/${tests.length}</td><td class="center"><b>${esc(avgOf(v) === '' ? '–' : avgOf(v))}</b></td></tr>`; }).join('')}</tbody></table>` : empty('students', 'Lớp chưa có học sinh', 'Thêm học sinh ở tab "Học sinh".')}</div>
        <div class="card-b" style="border-top:1px solid var(--line)"><div class="row">
          <button class="btn" id="pcert">${icon('printer')} In phiếu hoàn thành (từng học sinh)</button>
          <button class="btn" id="psum">${icon('printer')} In bảng tổng hợp lớp</button>
          <button class="btn ghost" id="xcert">${icon('download')} Xuất Excel phiếu (1 sheet, 2 phiếu / A4)</button>
          <button class="btn ghost" id="xsum">${icon('download')} Xuất Excel tổng hợp lớp</button></div>
          <div class="hint" style="margin-top:8px">Mọi nội dung trên phiếu đều song ngữ Anh - Việt. Bấm "In", cửa sổ in của trình duyệt mở ra: chọn máy in hoặc "Lưu thành PDF". Phiếu từng học sinh in A4 dọc, bảng tổng hợp lớp in A4 ngang. File Excel phiếu gom tất cả học sinh vào một sheet, mỗi tờ A4 có 2 phiếu.</div></div></div>`;

    const q = (sel) => root.querySelector(sel);
    const count = () => { const n = root.querySelectorAll('[data-s]:checked').length; q('#cnt').textContent = `Đã chọn ${n} / ${list.length} học sinh`; const pa = q('#pickall'); if (pa) pa.checked = n === list.length && n > 0; };
    count();
    root.onchange = (e) => {
      const t = e.target;
      if (t.id === 'pickall') { root.querySelectorAll('[data-s]').forEach((c) => { c.checked = t.checked; }); }
      if (t.id === 'cissue') q('#cissuedate').classList.toggle('hidden', t.value !== 'custom');
      count();
    };
    const gather = () => {
      const selTests = tests.filter((a) => q(`[data-t="${a.id}"]`).checked);
      const rows = list.filter((s) => q(`[data-s="${s.id}"]`).checked).map((s) => {
        const items = selTests.map((a) => ({ title: a.title, date: a.date, score: scoreOf(s, a), comment: (a.comments && a.comments[s.id]) || '' }));
        return { student: s, tests: items, avg: avgOf(items.map((i) => i.score)) };
      });
      const opt = { org: q('#corg').value.trim() || App.settings.centerName, title: q('#ctitle').value.trim(), signer: q('#csigner').value.trim(), issue: q('#cissue').value, scores: q('#oscores').checked, certCmt: q('#ocert').checked, sumCmt: q('#osum').checked };
      try { localStorage.setItem(KEY, JSON.stringify(opt)); } catch (e) { /* bỏ qua */ }
      const from = q('#cfrom').value, to = q('#cto').value;
      return {
        selTests, rows, opt, course: q('#cname').value.trim() || cls.name, courseEn: q('#cnameen').value.trim() || U.enClass(cls.name), titleEn: q('#ctitleen').value.trim() || U.enTitle(opt.title),
        from: from ? U.fmtDate(from) : '', to: to ? U.fmtDate(to) : '',
        issue: opt.issue === 'today' ? longDate(today) : opt.issue === 'custom' && q('#cissuedate').value ? longDate(q('#cissuedate').value) : '', issueEn: '',
      };
    };
    root.onclick = (e) => {
      const t = e.target;
      if (t.closest('#alltests')) { const b = [...root.querySelectorAll('[data-t]')]; const on = b.some((x) => !x.checked); b.forEach((x) => { x.checked = on; }); return; }
      const btn = t.closest('#pcert, #psum, #xcert, #xsum');
      if (!btn) return;
      const g = gather();
      if (!g.rows.length) return U.toast('Hãy chọn ít nhất một học sinh đã hoàn thành.', 'err');
      const center = App.settings.centerName, centerEn = U.centerEn();
      if (btn.id === 'pcert') {
        Report.printCertificates(g.rows, { center, centerEn, course: g.course, courseEn: g.courseEn, code: cls.code, from: g.from, to: g.to, showScores: g.opt.scores, showComments: g.opt.certCmt, org: g.opt.org, title: g.opt.title, titleEn: g.titleEn, signer: g.opt.signer, issue: g.issue, issueEn: g.issueEn });
      } else if (btn.id === 'psum') {
        Report.printSummary({ center, centerEn, cls, teachers, from: g.from, to: g.to, tests: g.selTests, rows: g.rows, classTotal: list.length, showComments: g.opt.sumCmt, org: g.opt.org, title: g.opt.title, titleEn: g.titleEn, signer: g.opt.signer, issue: g.issue, issueEn: g.issueEn });
      } else if (btn.id === 'xcert') {
        X.exportCertificates(g.rows.map((r) => ({ center, centerEn, student: r.student, courseName: g.course, courseNameEn: g.courseEn, classCode: cls.code, from: g.from, to: g.to, tests: r.tests, showScores: g.opt.scores, avg: g.opt.scores ? r.avg : '', org: g.opt.org, signerTitle: g.opt.title, signerTitleEn: g.titleEn, signerName: g.opt.signer, issueDate: g.issue, issueDateEn: g.issueEn })), `Giay_chung_nhan_${cls.code}.xlsx`);
      } else {
        const cols = [{ h: 'STT\nNo.', w: 7, align: 'center' }, { h: 'Họ và tên\nFull name', w: 28, bold: true }];
        g.selTests.forEach((a) => {
          cols.push({ h: `${a.title}\n${U.shortDate(a.date)}`, w: 12, align: 'center', fmt: '0.0#', bold: true, color: scoreColor });
          if (g.opt.sumCmt) cols.push({ h: `Nhận xét / Comment:\n${a.title}`, w: 36, wrap: true });
        });
        cols.push({ h: 'Điểm TB\nAverage', w: 11, align: 'center', fmt: '0.0#', bold: true, color: scoreColor });
        const rows = g.rows.map((r, i) => [i + 1, r.student.name, ...r.tests.flatMap((tt) => (g.opt.sumCmt ? [tt.score, tt.comment] : [tt.score])), r.avg]);
        const avgCol = (idx) => avgOf(g.rows.map((r) => r.tests[idx].score));
        const total = ['', 'Điểm trung bình lớp / Class average', ...g.selTests.flatMap((a, j) => (g.opt.sumCmt ? [avgCol(j), ''] : [avgCol(j)])), avgOf(g.rows.map((r) => r.avg))];
        X.exportTable({
          name: 'Hoàn thành khóa học', title: `DANH SÁCH HỌC SINH HOÀN THÀNH KHÓA HỌC ${cls.name.toUpperCase()}\nLIST OF STUDENTS WHO COMPLETED THE COURSE - ${U.enClass(cls.name).toUpperCase()}`, landscape: true,
          info: [`Lớp / Class: ${cls.name} / ${U.enClass(cls.name)} (${cls.code}) · ${teachers}`, `Thời gian khóa học / Course duration: từ ngày ${g.from || '………'} đến ngày ${g.to || '………'} (from ${g.from || '………'} to ${g.to || '………'})`, `Tổng số học sinh hoàn thành / Total students completed: ${g.rows.length} / ${list.length}`],
          cols, rows, total: g.selTests.length ? total : undefined, freezeCols: 2, signature: true,
        }, `Tong_hop_hoan_thanh_${cls.code}.xlsx`);
      }
    };
  }

  async function studentsPanel(root, cls) {
    const id = cls.id;
    const admin = DB.isAdmin();
    let all = await DB.q('students', [['classId', '==', id]]);
    const st = { q: '', status: 'active' };
    const picked = new Set();
    const filtered = () => U.sortVN(all.filter((s) =>
      (st.status === 'all' || (st.status === 'inactive') === (s.status === 'inactive')) &&
      (!st.q || U.norm(s.name + ' ' + (s.phone || '') + ' ' + (s.code || '')).includes(U.norm(st.q)))));
    const reload = async () => { all = await DB.q('students', [['classId', '==', id]]); draw(); };

    const syncCount = (list) => {
      const n = list.filter((x) => picked.has(x.id)).length;
      root.querySelector('#count').textContent = `${list.length} học sinh${n ? ` · đã chọn ${n}` : ''}`;
      root.querySelector('#exp').innerHTML = `${icon('download')} Xuất báo cáo${n ? ` (${n})` : ''}`;
    };
    const draw = () => {
      const list = filtered();
      const body = list.map((s, i) => `<tr class="${picked.has(s.id) ? 'picked' : ''}">
          <td class="chk"><input type="checkbox" data-pick="${s.id}" ${picked.has(s.id) ? 'checked' : ''}></td>
          <td class="muted">${i + 1}</td>
          <td class="small muted nowrap">${esc(s.code || '')}</td>
          <td class="name">${esc(s.name)}</td>
          <td class="mono">${esc(s.phone || '')}</td>
          <td class="mono muted">${esc(admin ? s.cccd || '' : U.maskId(s.cccd || ''))}</td>
          <td class="nowrap">${s.startDate ? esc(U.fmtDate(s.startDate)) : '<span class="muted">Từ đầu khóa</span>'}</td>
          <td>${s.status === 'inactive' ? '<span class="badge">Đã nghỉ</span>' : '<span class="badge ok">Đang học</span>'}</td>
          <td class="nowrap right"><button class="icon-btn" data-rep="${s.id}" title="Tải báo cáo của học sinh này">${icon('download')}</button><button class="icon-btn" data-edit="${s.id}" title="Sửa">${icon('edit')}</button><button class="icon-btn danger" data-del="${s.id}" title="Xóa">${icon('trash')}</button></td>
        </tr>`).join('');
      root.querySelector('#tbl').innerHTML = list.length
        ? `<table class="t"><thead><tr><th class="chk"><input type="checkbox" id="pickall" title="Chọn tất cả"></th><th>#</th><th>Mã HS</th><th>Họ và tên</th><th>Số điện thoại</th><th>CCCD</th><th>Bắt đầu học</th><th>Trạng thái</th><th></th></tr></thead><tbody>${body}</tbody></table>`
        : empty('students', 'Chưa có học sinh', 'Bấm "Thêm học sinh" hoặc "Nhập Excel" để thêm danh sách cho lớp này.');
      const pa = root.querySelector('#pickall');
      if (pa) pa.checked = list.length > 0 && list.every((x) => picked.has(x.id));
      syncCount(list);
    };

    root.innerHTML = `<div class="row" style="justify-content:flex-end;margin-bottom:14px">
          <button class="btn ghost" id="tpl">${icon('download')} Tải file mẫu</button>
          <button class="btn ghost" id="imp">${icon('upload')} Nhập Excel</button>
          <button class="btn ghost" id="exp">${icon('download')} Xuất báo cáo</button>
          <button class="btn" id="add">${icon('plus')} Thêm học sinh</button>
          <input type="file" id="file" accept=".xlsx,.xls,.csv" class="hidden"></div>
      <div class="card toolbar">
        <select class="select" id="fstatus"><option value="active">Đang học</option><option value="inactive">Đã nghỉ</option><option value="all">Tất cả</option></select>
        <div class="search">${icon('search', 16)}<input class="input" id="q" placeholder="Tìm theo tên, SĐT, mã HS..."></div>
        <span class="muted grow right" id="count"></span>
      </div>
      <div class="card"><div class="table-wrap" id="tbl"></div></div>`;
    draw();

    root.querySelector('#fstatus').onchange = (e) => { st.status = e.target.value; draw(); };
    root.querySelector('#q').oninput = (e) => { st.q = e.target.value; draw(); };
    root.querySelector('#add').onclick = () => studentModal(null, cls, reload);
    root.querySelector('#tpl').onclick = () => { try { X.studentTemplate([cls]); } catch (e) { U.toast(e.message, 'err'); } };
    root.querySelector('#exp').onclick = () => {
      const list = filtered();
      Report.open({ all, filtered: list, selected: list.filter((x) => picked.has(x.id)).map((x) => x.id), classId: id, title: `Báo cáo lớp ${cls.name}` });
    };
    root.querySelector('#tbl').onchange = (e) => {
      const t = e.target;
      if (t.id === 'pickall') { filtered().forEach((x) => { if (t.checked) picked.add(x.id); else picked.delete(x.id); }); draw(); return; }
      if (t.dataset.pick) {
        if (t.checked) picked.add(t.dataset.pick); else picked.delete(t.dataset.pick);
        t.closest('tr').classList.toggle('picked', t.checked); syncCount(filtered());
        const pa = root.querySelector('#pickall'); if (pa) pa.checked = filtered().every((x) => picked.has(x.id));
      }
    };
    root.querySelector('#imp').onclick = () => root.querySelector('#file').click();
    root.querySelector('#file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { await importFlow(f, all, cls, reload); } catch (err) { U.toast(err.message, 'err'); }
    };
    root.querySelector('#tbl').onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]'), rp = e.target.closest('[data-rep]');
      if (rp) { const one = all.find((x) => x.id === rp.dataset.rep); Report.open({ all, filtered: [one], selected: [one.id], classId: id, title: `Báo cáo: ${one.name}` }); return; }
      if (ed) studentModal(all.find((s) => s.id === ed.dataset.edit), cls, reload);
      if (de) {
        const s = all.find((x) => x.id === de.dataset.del);
        if (!(await U.confirm(`Xóa học sinh <b>${esc(s.name)}</b>? Nếu chỉ nghỉ học, nên đổi trạng thái sang "Đã nghỉ" để giữ lịch sử điểm danh.`, 'Xóa học sinh'))) return;
        await DB.del('students', s.id);
        all = all.filter((x) => x.id !== s.id);
        U.toast('Đã xóa học sinh', 'ok');
        draw();
      }
    };
  }

  function studentModal(s, cls0, done) {
    const isNew = !s;
    const admin = DB.isAdmin();
    const classes = App.openClasses();
    if (!classes.some((c) => c.id === cls0.id)) classes.push(cls0);
    const hideId = s && !admin && s.cccd;
    U.modal({
      title: isNew ? `Thêm học sinh vào ${cls0.name}` : 'Sửa thông tin học sinh', okText: isNew ? 'Thêm' : 'Lưu',
      body: `<div class="form-grid">
        <div class="full"><label class="f">Họ và tên *</label><input class="input" id="name" value="${esc(s ? s.name : '')}"></div>
        <div><label class="f">Lớp *</label><select class="select" id="cls">${classes.map((c) => `<option value="${c.id}" ${(s ? s.classId : cls0.id) === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.code)})</option>`).join('')}</select></div>
        <div><label class="f">Ngày bắt đầu học</label><input class="input" type="date" id="sdate" value="${esc(s ? s.startDate || '' : '')}"><div class="hint">Để trống nếu học từ đầu khóa. Học phí và điểm danh chỉ tính từ ngày này.</div></div>
        <div><label class="f">Số điện thoại</label><input class="input" id="phone" inputmode="tel" value="${esc(s ? s.phone || '' : '')}"></div>
        <div><label class="f">CCCD</label><input class="input" id="cccd" inputmode="numeric" value="${hideId ? '' : esc(s ? s.cccd || '' : '')}" placeholder="${hideId ? 'Đã có (' + esc(U.maskId(s.cccd)) + ') - để trống nếu giữ nguyên' : '12 số (không bắt buộc)'}"></div>
        ${isNew ? '' : `<div><label class="f">Trạng thái</label><select class="select" id="status"><option value="active" ${s.status !== 'inactive' ? 'selected' : ''}>Đang học</option><option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Đã nghỉ</option></select></div>`}
        <div class="${isNew ? 'full' : ''}"><label class="f">Ghi chú</label><input class="input" id="note" value="${esc(s ? s.note || '' : '')}" placeholder="Ví dụ: tên phụ huynh, lưu ý..."></div>
      </div>`,
      onOk: async (w) => {
        const v = (id) => (w.querySelector('#' + id) ? w.querySelector('#' + id).value.trim() : '');
        if (!v('name')) throw new Error('Vui lòng nhập họ tên học sinh.');
        const phone = v('phone').replace(/[\s.\-]/g, '');
        if (phone && !/^\d{9,11}$/.test(phone)) throw new Error('Số điện thoại không hợp lệ (9-11 chữ số).');
        let cccd = v('cccd').replace(/[\s.\-]/g, '');
        if (cccd && !/^(\d{9}|\d{12})$/.test(cccd)) throw new Error('CCCD phải gồm 12 chữ số (hoặc 9 số với CMND cũ).');
        if (!cccd && hideId) cccd = s.cccd;
        const cls = App.classById(v('cls'));
        const inClass = await DB.q('students', [['classId', '==', cls.id]]);
        const dup = inClass.find((x) => x.id !== (s && s.id) && U.norm(x.name) === U.norm(v('name')));
        if (dup && !(await U.confirm(`Lớp ${esc(cls.name)} đã có học sinh tên "${esc(dup.name)}". Vẫn thêm?`, 'Vẫn thêm', false))) return false;
        const data = { name: v('name').replace(/\s+/g, ' '), classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), phone, cccd, note: v('note'), startDate: v('sdate'), status: isNew ? 'active' : v('status') };
        if (isNew || s.classId !== cls.id) data.code = `${cls.code}-${U.pad(nextCode(cls, inClass) + 1)}`;
        await DB.save('students', s && s.id, data);
        U.toast(isNew ? 'Đã thêm học sinh' : 'Đã lưu', 'ok');
        await done();
      },
    });
  }

  async function importFlow(file, all, cls, done) {
    const rows = await X.parseStudents(file);
    if (!rows.length) throw new Error('File không có dòng dữ liệu nào.');
    const exist = new Set(all.map((s) => U.norm(s.name)));
    const seen = new Set();
    const items = rows.map((r) => {
      let err = '';
      if (!r.name) err = 'Thiếu họ tên';
      else if (r.classCode && U.norm(r.classCode) !== U.norm(cls.code)) err = `Thuộc lớp khác (mã ${r.classCode})`;
      else if (r.startDate === 'INVALID') err = 'Ngày bắt đầu học không hợp lệ';
      else {
        const key = U.norm(r.name);
        if (exist.has(key) || seen.has(key)) err = 'Trùng, bỏ qua';
        seen.add(key);
      }
      return { ...r, err };
    });
    const good = items.filter((i) => !i.err);
    U.modal({
      title: `Xem trước danh sách nhập vào ${cls.name}`, wide: true, okText: `Nhập ${good.length} học sinh`,
      body: `<div class="alert ${good.length ? 'ok' : 'warn'}" style="margin-bottom:12px">Đọc được <b>${items.length}</b> dòng: <b>${good.length}</b> hợp lệ, <b>${items.length - good.length}</b> bị bỏ qua.</div>
        <div class="preview-box"><table class="t"><thead><tr><th>Dòng</th><th>Họ tên</th><th>SĐT</th><th>CCCD</th><th>Bắt đầu học</th><th>Kết quả</th></tr></thead><tbody>
        ${items.map((i) => `<tr><td class="muted">${i.line}</td><td>${esc(i.name)}</td><td>${esc(i.phone)}</td><td>${esc(U.maskId(i.cccd))}</td><td>${i.startDate && i.startDate !== 'INVALID' ? U.fmtDate(i.startDate) : '<span class="muted">Từ đầu khóa</span>'}</td><td>${i.err ? `<span class="badge err">${esc(i.err)}</span>` : '<span class="badge ok">Hợp lệ</span>'}</td></tr>`).join('')}
        </tbody></table></div>`,
      onOk: async () => {
        if (!good.length) throw new Error('Không có dòng hợp lệ để nhập.');
        let n = nextCode(cls, all);
        for (const i of good) {
          n++;
          await DB.save('students', null, {
            name: i.name, classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), phone: i.phone, cccd: i.cccd, note: i.note,
            startDate: i.startDate || '', status: 'active', code: `${cls.code}-${U.pad(n)}`,
          });
        }
        U.toast(`Đã nhập ${good.length} học sinh vào ${cls.name}`, 'ok');
        await done();
      },
    });
  }
})();
