/* Màn hình: Điểm danh, Đánh giá, Học phí, Giáo viên, Cài đặt */
(function () {
  const { esc, icon, money } = U;
  const { empty, head } = UI;
  const monthNav = (m) => `<div class="month-nav"><button class="icon-btn" data-mprev>${icon('left')}</button><b>${U.monthLabel(m)}</b><button class="icon-btn" data-mnext>${icon('right')}</button></div>`;
  const noClass = (title) => `${head(title)}<div class="card">${empty('classes', 'Chưa có lớp nào', DB.isAdmin() ? 'Hãy vào mục Lớp học để tạo lớp trước.' : 'Quản trị viên chưa phân công lớp cho bạn.')}</div>`;

  /* ===================================================================
   *  ĐIỂM DANH
   * =================================================================== */
  Views.attendance = async (root, params) => {
    const classes = App.openClasses();
    if (!classes.length) { root.innerHTML = noClass('Điểm danh'); return; }
    let cls = classes.find((c) => c.id === (params.class || App.classId)) || classes[0];
    App.classId = cls.id;
    let month = params.month || (params.date || U.today()).slice(0, 7);
    let sel = params.date || null, students = [], docs = [], marks = {}, dirty = false, savedAt = '';
    let tDocs = [], tMarks = {};
    const teacherIds = () => U.classTeachers(cls);
    const tName = (id) => App.teacherName(id);

    const sessions = () => U.sessions(cls, ...U.monthRange(month));
    const loadClass = async () => {
      students = U.sortVN((await DB.q('students', [['classId', '==', cls.id]])).filter((s) => s.status !== 'inactive'));
      docs = await DB.q('attendance', [['classId', '==', cls.id]]);
      tDocs = await DB.q('teacherAttendance', [['classId', '==', cls.id]]);
    };
    const pickDefault = () => {
      const ss = sessions(), t = U.today();
      if (sel && ss.includes(sel)) return;
      sel = ss.includes(t) ? t : ss.filter((d) => d <= t).pop() || ss[0] || null;
    };
    const loadDay = () => {
      const doc = docs.find((d) => d.date === sel);
      marks = {};
      students.forEach((s) => { marks[s.id] = doc ? !(doc.records && doc.records[s.id] === false) : true; });
      const td = tDocs.find((d) => d.date === sel);
      tMarks = {};
      teacherIds().forEach((id) => {
        const r = td && td.records && td.records[id];
        tMarks[id] = r ? { present: !!r.present, periods: Number(r.periods) || 0 } : { present: true, periods: Number(U.slotFor(cls, sel).periods) || Number(cls.periods) || 2 };
      });
      dirty = false;
      savedAt = doc ? `Đã lưu${doc.updatedBy ? ' bởi ' + doc.updatedBy : ''}` : 'Chưa điểm danh buổi này';
    };
    // chỉ những học sinh đã bắt đầu học tại ngày được chọn mới có trong danh sách điểm danh
    const roster = () => students.filter((s) => !s.startDate || !sel || s.startDate <= sel);
    const counts = () => {
      const r = roster();
      const p = r.filter((s) => marks[s.id]).length;
      return { p, a: r.length - p };
    };

    const render = () => {
      const ss = sessions(), today = U.today();
      const recorded = new Set(docs.map((d) => d.date));
      const strip = ss.length
        ? ss.map((d) => `<button class="chip ${d === sel ? 'sel' : ''} ${recorded.has(d) ? 'rec' : ''} ${d === today ? 'today' : ''}" data-chip="${d}"><span class="dot"></span><small>${U.dayName(U.parse(d).getDay())}</small><b>${U.shortDate(d)}</b></button>`).join('')
        : `<div class="alert warn">Không có buổi học nào trong ${U.monthLabel(month).toLowerCase()} theo lịch và thời gian học của lớp.</div>`;
      const { p, a } = counts();
      const rows = roster().map((s, i) => `<label class="att-row ${marks[s.id] ? '' : 'absent'}"><span class="stt">${i + 1}</span><input type="checkbox" data-sid="${s.id}" ${marks[s.id] ? 'checked' : ''}><span class="box">${icon('check', 18)}</span><span class="nm">${esc(s.name)}</span><span class="st">${marks[s.id] ? 'Có mặt' : 'Vắng'}</span></label>`).join('');

      // bảng tổng hợp tháng
      const byDate = Object.fromEntries(docs.map((d) => [d.date, d]));
      const settings = App.settings;
      const mx = students.map((s, i) => {
        let ab = 0, pr = 0;
        const cells = ss.map((d) => {
          const v = byDate[d] && byDate[d].records && byDate[d].records[s.id];
          if (s.startDate && d < s.startDate) return '<td class="mk-n" title="Chưa vào học">–</td>';
          if (v === true) { pr++; return '<td class="mk-p">✓</td>'; }
          if (v === false) { ab++; return '<td class="mk-a">✗</td>'; }
          return '<td class="mk-n">·</td>';
        }).join('');
        const mineN = s.startDate ? ss.filter((d) => d >= s.startDate).length : ss.length;
        const fee = U.calcFee(cls, settings, pr, ab, ss.length ? mineN / ss.length : 1);
        return `<tr><td class="muted">${i + 1}</td><td class="name">${esc(s.name)}</td>${cells}<td>${pr}</td><td><b>${ab}</b></td><td class="right mono"><b>${money(fee.total)}</b>${fee.deduct ? `<div class="small muted">-${money(fee.deduct)}</div>` : ''}</td></tr>`;
      }).join('');

      root.innerHTML = `${head('Điểm danh', 'Chọn buổi học theo lịch của lớp, bỏ tick những em vắng mặt rồi bấm Lưu.',
        `<button class="btn ghost" id="exp">${icon('download')} Tải mẫu / xuất Excel</button><button class="btn ghost" id="imp">${icon('upload')} Nhập từ Excel</button><input type="file" id="afile" accept=".xlsx,.xls" class="hidden">`)}
        <div class="card toolbar">
          <select class="select" id="cls">${App.classOptions(cls.id)}</select>
          ${monthNav(month)}
          ${DB.isAdmin() ? `<select class="select" id="fmode" title="Cách tính học phí của lớp"><option value="absence" ${cls.feeMode !== 'attend' ? 'selected' : ''}>Học phí: theo số buổi nghỉ</option><option value="attend" ${cls.feeMode === 'attend' ? 'selected' : ''}>Học phí: theo số buổi đi học</option></select>` : ''}
          <span class="muted"><b>${esc(cls.name)}</b> · ${esc(U.scheduleText(cls))}</span>
        </div>
        <div class="small muted" style="margin:-6px 0 14px">${icon('info', 14)} ${esc(U.feeRuleText(cls, App.settings))}</div>
        <div class="strip">${strip}</div>
        ${sel && teacherIds().length ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Giáo viên dạy buổi này</h3><span class="small muted">Tick nếu có dạy, nhập số tiết để tính tiền giáo viên</span></div>
          <div class="att-list">${teacherIds().map((id) => { const m = tMarks[id]; return `<div class="att-row ${m.present ? '' : 'absent'}" style="cursor:default">
            <label style="display:flex;align-items:center;gap:14px;flex:1;cursor:pointer"><input type="checkbox" data-tid="${id}" ${m.present ? 'checked' : ''}><span class="box">${icon('check', 18)}</span>
            <span class="nm">${esc(tName(id))}</span><span class="badge ${id === cls.teacherId ? 'blue' : ''}">${U.roleName(U.roleOf(cls, id))}</span></label>
            <span class="small muted">Số tiết</span><input class="input" type="number" min="0" max="10" step="0.5" style="width:78px;text-align:center" data-tp="${id}" value="${m.periods}" ${m.present ? '' : 'disabled'}></div>`; }).join('')}</div></div>` : ''}
        ${sel ? `<div class="card">
          <div class="card-h">
            <div><h3>${U.dayName(U.parse(sel).getDay())}, ${U.fmtDate(sel)} · ${esc(U.timeText(U.slotFor(cls, sel)))}</h3><div class="small muted" id="saved">${esc(savedAt)}</div></div>
            <div class="grow"></div>
            <div class="att-summary"><span class="badge ok" id="cp">Có mặt: ${p}</span><span class="badge err" id="ca">Vắng: ${a}</span><span class="badge" id="ct">Tổng: ${roster().length}</span><span class="badge warn ${dirty ? '' : 'hidden'}" id="dirty">Chưa lưu</span></div>
          </div>
          <div class="row" style="padding:12px 16px 0"><button class="btn sm soft" id="allp">${icon('check', 15)} Có mặt tất cả</button><button class="btn sm ghost" id="alla">Vắng tất cả</button></div>
          ${roster().length ? `<div class="att-list">${rows}</div>` : empty('students', 'Chưa có học sinh nào đang học vào ngày này', 'Thêm học sinh trong trang của lớp (Lớp học → chọn lớp).')}
          <div class="sticky-bar"><button class="btn ok lg" id="save" ${roster().length ? '' : 'disabled'}>${icon('check')} Lưu điểm danh</button><button class="btn ghost" id="mkass">${icon('star')} Tạo đánh giá cho buổi này</button></div>
        </div>` : ''}
        ${students.length && ss.length ? `<div class="card mt"><div class="card-h"><h3>Tổng hợp ${U.monthLabel(month).toLowerCase()}</h3><span class="small muted">${esc(U.feeRuleText(cls, settings))}</span></div>
          <div class="table-wrap"><table class="t grid-mx"><thead><tr><th>#</th><th>Học sinh</th>${ss.map((d) => `<th>${U.shortDate(d)}</th>`).join('')}<th>Có mặt</th><th>Vắng</th><th class="right">Học phí tạm tính</th></tr></thead><tbody>${mx}</tbody></table></div></div>` : ''}`;
    };

    const updateCounts = () => {
      const { p, a } = counts();
      root.querySelector('#cp').textContent = 'Có mặt: ' + p;
      root.querySelector('#ca').textContent = 'Vắng: ' + a;
      root.querySelector('#dirty').classList.toggle('hidden', !dirty);
    };
    const guard = async () => !dirty || (await U.confirm('Bạn chưa lưu điểm danh buổi này. Bỏ các thay đổi?', 'Bỏ thay đổi'));
    const setAll = (v) => {
      students.forEach((s) => { marks[s.id] = v; });
      dirty = true;
      root.querySelectorAll('input[data-sid]').forEach((c) => {
        const r = c.closest('.att-row');
        c.checked = v; r.classList.toggle('absent', !v);
        const st = r.querySelector('.st'); if (st) st.textContent = v ? 'Có mặt' : 'Vắng';
      });
      updateCounts();
    };
    const gotoMonth = async (m) => { if (!(await guard())) return; month = m; sel = null; pickDefault(); loadDay(); render(); };

    const importAtt = async (file) => {
      const res = await X.parseAttendanceGrid(file, month);
      const byCode = Object.fromEntries(students.filter((x) => x.code).map((x) => [U.norm(x.code), x]));
      const byName = {};
      students.forEach((x) => { (byName[U.norm(x.name)] = byName[U.norm(x.name)] || []).push(x); });
      const sess = new Set(sessions());
      const dates = res.dates.filter((d) => sess.has(d));
      const off = res.dates.filter((d) => !sess.has(d));
      const matched = [], unmatched = [];
      res.rows.forEach((r) => {
        const x = (r.code && byCode[U.norm(r.code)]) || ((byName[U.norm(r.name)] || []).length === 1 ? byName[U.norm(r.name)][0] : null);
        if (!x) return unmatched.push(r.name);
        matched.push({ x, marks: r.marks });
      });
      const perDate = dates.map((d) => ({ d, n: matched.filter((m) => d in m.marks).length })).filter((p) => p.n);
      const cells = perDate.reduce((a, p) => a + p.n, 0);
      if (!cells) throw new Error('Không có ô điểm danh hợp lệ nào để nhập (kiểm tra lại tháng đang chọn, ngày học và ký hiệu ✓ / V).');
      U.modal({
        title: 'Xem trước dữ liệu điểm danh', okText: `Nhập ${cells} ô điểm danh`,
        body: `<div class="alert ok" style="margin-bottom:12px">Khớp <b>${matched.length}</b> học sinh, <b>${cells}</b> ô điểm danh trên <b>${perDate.length}</b> buổi (${perDate.map((p) => U.shortDate(p.d)).join(', ')}).</div>
          ${unmatched.length ? `<div class="alert warn" style="margin-bottom:8px">Không khớp học sinh nào trong lớp: ${unmatched.slice(0, 6).map(esc).join(', ')}${unmatched.length > 6 ? '…' : ''} (bị bỏ qua).</div>` : ''}
          ${off.concat(res.skipped).length ? `<div class="alert warn">Bỏ qua các cột không thuộc lịch học của lớp trong ${U.monthLabel(month).toLowerCase()}: ${off.concat(res.skipped).map(U.shortDate).join(', ')}.</div>` : ''}
          <div class="hint">Dữ liệu nhập sẽ ghi đè điểm danh của các học sinh có trong file ở những buổi đó.</div>`,
        onOk: async () => {
          for (const p of perDate) {
            const old = docs.find((x) => x.date === p.d);
            const records = { ...((old && old.records) || {}) };
            matched.forEach((m) => { if (p.d in m.marks) records[m.x.id] = m.marks[p.d]; });
            const data = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), date: p.d, records, updatedBy: App.me.name + ' (nhập Excel)' };
            const id = `${cls.id}_${p.d}`;
            await DB.save('attendance', id, data, true);
            docs = docs.filter((x) => x.date !== p.d).concat([{ id, ...data }]);
          }
          U.toast(`Đã nhập ${cells} ô điểm danh từ Excel`, 'ok');
          loadDay(); render();
        },
      });
    };
    root.onchange = async (e) => {
      if (e.target.id === 'afile') {
        const f = e.target.files[0]; e.target.value = '';
        if (f) { try { await importAtt(f); } catch (er) { U.toast(er.message, 'err'); } }
        return;
      }
      if (e.target.id === 'cls') { if (!(await guard())) { e.target.value = cls.id; return; } App.go('attendance', { class: e.target.value }); return; }
      if (e.target.id === 'fmode') {
        try { await DB.save('classes', cls.id, { feeMode: e.target.value }); cls.feeMode = e.target.value; U.toast('Đã đổi cách tính học phí của lớp', 'ok'); render(); } catch (er) { U.toast(er.message, 'err'); }
        return;
      }
      const tid = e.target.dataset && e.target.dataset.tid;
      if (tid) {
        tMarks[tid].present = e.target.checked; dirty = true;
        const row = e.target.closest('.att-row'); row.classList.toggle('absent', !e.target.checked);
        const pin = row.querySelector('[data-tp]'); pin.disabled = !e.target.checked;
        updateCounts();
        return;
      }
      const sid = e.target.dataset && e.target.dataset.sid;
      if (sid) {
        marks[sid] = e.target.checked; dirty = true;
        const row = e.target.closest('.att-row');
        row.classList.toggle('absent', !e.target.checked);
        row.querySelector('.st').textContent = e.target.checked ? 'Có mặt' : 'Vắng';
        updateCounts();
      }
    };
    root.oninput = (e) => {
      const tp = e.target.dataset && e.target.dataset.tp;
      if (tp) { tMarks[tp].periods = Number(e.target.value) || 0; dirty = true; updateCounts(); }
    };
    root.onclick = async (e) => {
      const t = e.target;
      const chip = t.closest('[data-chip]');
      if (chip) { if (chip.dataset.chip === sel || !(await guard())) return; sel = chip.dataset.chip; loadDay(); render(); return; }
      if (t.closest('[data-mprev]')) return gotoMonth(U.addMonth(month, -1));
      if (t.closest('[data-mnext]')) return gotoMonth(U.addMonth(month, 1));
      if (t.closest('#allp')) return setAll(true);
      if (t.closest('#alla')) return setAll(false);
      if (t.closest('#mkass')) { if (await guard()) App.go('assessments', { class: cls.id, new: 1, date: sel }); return; }
      if (t.closest('#imp')) { if (await guard()) root.querySelector('#afile').click(); return; }
      if (t.closest('#exp')) {
        try { const byDate = Object.fromEntries(docs.map((d) => [d.date, d])); X.exportAttendance(cls, month, students, sessions(), byDate); } catch (er) { U.toast(er.message, 'err'); }
        return;
      }
      if (t.closest('#save')) {
        const btn = t.closest('#save'); btn.disabled = true;
        try {
          const old = docs.find((d) => d.date === sel);
          const records = { ...((old && old.records) || {}) };
          roster().forEach((s) => { records[s.id] = !!marks[s.id]; });
          const data = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), date: sel, records, updatedBy: App.me.name };
          const id = `${cls.id}_${sel}`;
          await DB.save('attendance', id, data, true);
          docs = docs.filter((d) => d.date !== sel).concat([{ id, ...data }]);
          if (teacherIds().length) {
            const oldT = tDocs.find((d) => d.date === sel);
            const tr = { ...((oldT && oldT.records) || {}) };
            const plannedP = Number(U.slotFor(cls, sel).periods) || Number(cls.periods) || 0;
            teacherIds().forEach((tid) => { tr[tid] = { present: !!tMarks[tid].present, periods: tMarks[tid].present ? Number(tMarks[tid].periods) || 0 : 0, planned: plannedP, note: (tr[tid] && tr[tid].note) || '' }; });
            const tdata = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), date: sel, records: tr, updatedBy: App.me.name };
            await DB.save('teacherAttendance', id, tdata, true);
            tDocs = tDocs.filter((d) => d.date !== sel).concat([{ id, ...tdata }]);
          }
          dirty = false; savedAt = `Đã lưu lúc ${U.nowText()} bởi ${App.me.name}`;
          U.toast(`Đã lưu điểm danh ${U.fmtDate(sel)}: ${counts().p} có mặt, ${counts().a} vắng`, 'ok');
          render();
        } catch (er) { U.toast(er.message, 'err'); btn.disabled = false; }
      }
    };

    root.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';
    await loadClass();
    pickDefault(); loadDay(); render();
  };

  /* ===================================================================
   *  ĐÁNH GIÁ / ĐIỂM
   * =================================================================== */
  const scoreCls = (v) => (v >= 8 ? 'hi' : v >= 6.5 ? 'mid' : v >= 5 ? 'lo' : 'vlo');
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 100) / 100 : null);
  const scoresOf = (a, ids) => ids.map((id) => a.scores && a.scores[id]).filter((v) => v !== undefined && v !== null && v !== '').map(Number);

  Views.assessments = async (root, params) => {
    if (params.id) return assessEditor(root, params.id);
    const classes = App.openClasses();
    if (!classes.length) { root.innerHTML = noClass('Đánh giá'); return; }
    const cls = classes.find((c) => c.id === (params.class || App.classId)) || classes[0];
    App.classId = cls.id;
    const students = U.sortVN((await DB.q('students', [['classId', '==', cls.id]])).filter((s) => s.status !== 'inactive'));
    let list = (await DB.q('assessments', [['classId', '==', cls.id]])).sort((a, b) => b.date.localeCompare(a.date));

    const rows = list.map((a) => {
      const sc = scoresOf(a, students.map((s) => s.id)), m = avg(sc);
      return `<tr><td class="nowrap">${U.fmtDate(a.date)}</td><td class="name">${esc(a.title)}</td><td>${sc.length}/${students.length}</td>
        <td>${m === null ? '<span class="muted">-</span>' : `<span class="score-badge ${scoreCls(m)}">${m}</span>`}</td>
        <td class="nowrap right"><a class="btn sm soft" href="#/assessments/${a.id}">${icon('edit', 15)} Nhập / xem điểm</a> <button class="icon-btn danger" data-del="${a.id}">${icon('trash')}</button></td></tr>`;
    }).join('');

    const ordered = list.slice().sort((a, b) => a.date.localeCompare(b.date));
    const matrix = ordered.length && students.length
      ? `<div class="card mt"><div class="card-h"><h3>Bảng tổng hợp điểm theo học sinh</h3><div class="grow"></div><button class="btn sm ghost" id="expm">${icon('download', 15)} Xuất Excel</button></div>
        <div class="table-wrap"><table class="t grid-mx"><thead><tr><th>#</th><th>Học sinh</th>${ordered.map((a) => `<th title="${esc(a.title)}">${esc(a.title.length > 14 ? a.title.slice(0, 13) + '…' : a.title)}<br><span style="text-transform:none;font-weight:400">${U.shortDate(a.date)}</span></th>`).join('')}<th>ĐTB</th></tr></thead><tbody>
        ${students.map((s, i) => {
          const v = ordered.map((a) => (a.scores && a.scores[s.id] != null && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : null));
          const m = avg(v.filter((x) => x !== null));
          return `<tr><td class="muted">${i + 1}</td><td class="name">${esc(s.name)}</td>${v.map((x) => `<td>${x === null ? '<span class="mk-n">·</span>' : `<span class="score-badge ${scoreCls(x)}">${x}</span>`}</td>`).join('')}<td>${m === null ? '' : `<b>${m}</b>`}</td></tr>`;
        }).join('')}</tbody></table></div></div>` : '';

    root.innerHTML = `${head('Đánh giá & điểm số', 'Tạo bài đánh giá cho buổi học có kiểm tra, nhập điểm trực tiếp hoặc bằng file Excel.',
      `<button class="btn ghost" id="impm">${icon('upload')} Nhập nhiều bài từ Excel</button><input type="file" id="mfile" accept=".xlsx,.xls" class="hidden"><button class="btn" id="add">${icon('plus')} Tạo đánh giá</button>`)}
      <div class="card toolbar"><select class="select" id="cls">${App.classOptions(cls.id)}</select><span class="muted"><b>${esc(cls.name)}</b> · ${students.length} học sinh</span></div>
      <div class="card"><div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>Ngày</th><th>Bài đánh giá</th><th>Đã chấm</th><th>Điểm TB lớp</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('star', 'Chưa có bài đánh giá nào', 'Bấm "Tạo đánh giá" khi buổi học có tiết kiểm tra.')}</div></div>
      ${matrix}`;

    const create = (date) => {
      const ss = U.sessions(cls, '2000-01-01', U.today());
      const d0 = date || ss.pop() || U.today();
      U.modal({
        title: 'Tạo bài đánh giá', okText: 'Tạo và nhập điểm',
        body: `<div class="form-grid"><div class="full"><label class="f">Tên bài đánh giá *</label><input class="input" id="t" placeholder="Ví dụ: Kiểm tra giữa kỳ, Test Unit 3" value="Kiểm tra"></div>
          <div class="full"><label class="f">Ngày (buổi học) *</label><input class="input" type="date" id="d" value="${d0}"></div></div>`,
        onOk: async (w) => {
          const title = w.querySelector('#t').value.trim(), date = w.querySelector('#d').value;
          if (!title || !date) throw new Error('Nhập tên bài đánh giá và ngày.');
          const id = await DB.save('assessments', null, { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), title, date, scores: {}, comments: {}, createdBy: App.me.name }, true);
          App.go('assessments', { id });
        },
      });
    };
    root.querySelector('#add').onclick = () => create();
    root.querySelector('#impm').onclick = () => root.querySelector('#mfile').click();
    root.querySelector('#mfile').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const res = await X.parseScoreMatrix(f);
        const y0 = Number((cls.startDate || U.today()).slice(0, 4));
        const tests = res.tests.map((t) => {
          let date = null;
          for (const y of [y0, y0 + 1, y0 + 2]) { const d = `${y}-${U.pad(t.m)}-${U.pad(t.d)}`; if ((!cls.startDate || d >= cls.startDate) && (!cls.endDate || d <= cls.endDate)) { date = d; break; } }
          if (!date) date = `${y0}-${U.pad(t.m)}-${U.pad(t.d)}`;
          return { ...t, date, existing: list.find((a) => a.date === date && U.norm(a.title) === U.norm(t.title)) };
        });
        const byCode = Object.fromEntries(students.filter((x) => x.code).map((x) => [U.norm(x.code), x]));
        const byName = {};
        students.forEach((x) => { (byName[U.norm(x.name)] = byName[U.norm(x.name)] || []).push(x); });
        const matched = [], unmatched = [];
        res.students.forEach((r) => {
          const x = (r.code && byCode[U.norm(r.code)]) || ((byName[U.norm(r.name)] || []).length === 1 ? byName[U.norm(r.name)][0] : null);
          if (x) matched.push({ x, scores: r.scores }); else unmatched.push(r.name);
        });
        let bad = 0, cells = 0;
        const plan = tests.map((t, j) => {
          const sc = {};
          matched.forEach((m) => { const raw = m.scores[j]; if (raw === '') return; const n = Number(raw); if (isNaN(n) || n < 0 || n > 10) { bad++; return; } sc[m.x.id] = n; cells++; });
          return { t, sc };
        });
        if (!cells) throw new Error('Không có điểm hợp lệ nào để nhập.');
        U.modal({
          title: 'Xem trước điểm nhập từ Excel', okText: `Nhập ${cells} điểm`, wide: true,
          body: `<div class="alert ok" style="margin-bottom:12px">Khớp <b>${matched.length}</b> học sinh, <b>${tests.length}</b> bài kiểm tra, <b>${cells}</b> điểm hợp lệ.</div>
            ${unmatched.length ? `<div class="alert warn" style="margin-bottom:8px">Không khớp học sinh: ${unmatched.slice(0, 6).map(esc).join(', ')}${unmatched.length > 6 ? '…' : ''}</div>` : ''}
            ${bad ? `<div class="alert warn" style="margin-bottom:8px">${bad} ô điểm không hợp lệ (phải từ 0 đến 10) bị bỏ qua.</div>` : ''}
            <div class="preview-box"><table class="t"><thead><tr><th>Bài kiểm tra</th><th>Ngày</th><th>Số điểm</th><th>Xử lý</th></tr></thead><tbody>
            ${plan.map((p) => `<tr><td class="name">${esc(p.t.title)}</td><td>${U.fmtDate(p.t.date)}</td><td>${Object.keys(p.sc).length}</td><td>${p.t.existing ? '<span class="badge warn">Cập nhật bài có sẵn</span>' : '<span class="badge ok">Tạo bài mới</span>'}</td></tr>`).join('')}</tbody></table></div>`,
          onOk: async () => {
            for (const p of plan) {
              if (!Object.keys(p.sc).length) continue;
              const old = p.t.existing;
              const data = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), title: old ? old.title : p.t.title, date: p.t.date,
                scores: { ...((old && old.scores) || {}), ...p.sc }, comments: (old && old.comments) || {}, createdBy: (old && old.createdBy) || App.me.name, updatedBy: App.me.name + ' (nhập Excel)' };
              await DB.save('assessments', old ? old.id : null, data, true);
            }
            U.toast(`Đã nhập ${cells} điểm từ Excel`, 'ok');
            App.render();
          },
        });
      } catch (er) { U.toast(er.message, 'err'); }
    };
    root.querySelector('#cls').onchange = (e) => App.go('assessments', { class: e.target.value });
    const ex = root.querySelector('#expm');
    if (ex) ex.onclick = () => { try { X.exportScoreMatrix(cls, ordered, students); } catch (e) { U.toast(e.message, 'err'); } };
    root.onclick = async (e) => {
      const d = e.target.closest('[data-del]');
      if (!d) return;
      const a = list.find((x) => x.id === d.dataset.del);
      if (!(await U.confirm(`Xóa bài đánh giá <b>${esc(a.title)}</b> và toàn bộ điểm đã nhập?`, 'Xóa'))) return;
      await DB.del('assessments', a.id);
      U.toast('Đã xóa', 'ok');
      App.render();
    };
    if (params.new) create(params.date);
  };

  async function assessEditor(root, id) {
    const a = await DB.get('assessments', id);
    if (!a) { root.innerHTML = `${head('Không tìm thấy')}<div class="card">${empty('star', 'Bài đánh giá không tồn tại', '<a href="#/assessments">Quay lại danh sách</a>')}</div>`; return; }
    const cls = App.classById(a.classId);
    if (!cls) { root.innerHTML = `<div class="card">${empty('star', 'Bạn không có quyền xem bài đánh giá này', '')}</div>`; return; }
    const all = await DB.q('students', [['classId', '==', cls.id]]);
    const students = U.sortVN(all.filter((s) => s.status !== 'inactive' || (a.scores && a.scores[s.id] != null)));
    const scores = { ...(a.scores || {}) }, comments = { ...(a.comments || {}) };

    root.innerHTML = `<div class="page-head"><div><a href="#/assessments?class=${cls.id}" class="small">${icon('back', 14)} Danh sách đánh giá</a><h1 style="margin-top:6px">${esc(a.title)}</h1><p>${esc(cls.name)} (${esc(cls.code)}) · ${U.fmtDate(a.date)}</p></div>
        <div class="row"><button class="btn ghost" id="tpl">${icon('download')} Tải file mẫu</button><button class="btn ghost" id="imp">${icon('upload')} Nhập từ Excel</button><button class="btn ghost" id="exp">${icon('download')} Xuất Excel</button><input type="file" id="file" accept=".xlsx,.xls,.csv" class="hidden"></div></div>
      <div class="card"><div class="card-h"><div class="row"><div><label class="f">Tên bài</label><input class="input" id="title" value="${esc(a.title)}" style="min-width:240px"></div><div><label class="f">Ngày</label><input class="input" type="date" id="date" value="${esc(a.date)}"></div></div>
        <div class="grow"></div><div class="right"><div class="small muted">Điểm trung bình lớp</div><b style="font-size:24px" id="avg">-</b></div></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Học sinh</th><th>Điểm (0-10)</th><th style="width:48%">Nhận xét</th></tr></thead><tbody>
        ${students.map((s, i) => `<tr><td class="muted">${i + 1}</td><td class="name">${esc(s.name)}<div class="small muted">${esc(s.code || '')}</div></td>
          <td><input class="input score-in" type="number" min="0" max="10" step="0.05" inputmode="decimal" data-sid="${s.id}" value="${scores[s.id] != null ? esc(scores[s.id]) : ''}"></td>
          <td><input class="input" data-cm="${s.id}" maxlength="300" placeholder="Nhận xét..." value="${esc(comments[s.id] || '')}"></td></tr>`).join('')}
        </tbody></table></div>
        <div class="sticky-bar"><button class="btn ok lg" id="save">${icon('check')} Lưu điểm & nhận xét</button><button class="btn ghost danger-text" id="del" style="color:var(--err)">${icon('trash')} Xóa bài đánh giá</button></div></div>`;

    const refreshAvg = () => {
      const vals = Object.values(scores).filter((v) => v !== '' && v != null).map(Number).filter((v) => !isNaN(v));
      root.querySelector('#avg').textContent = vals.length ? avg(vals) : '-';
    };
    refreshAvg();
    root.oninput = (e) => {
      const t = e.target;
      if (t.dataset.sid) {
        const raw = t.value.replace(',', '.');
        const n = Number(raw);
        t.classList.toggle('bad', raw !== '' && (isNaN(n) || n < 0 || n > 10));
        scores[t.dataset.sid] = raw === '' ? null : n;
        refreshAvg();
      }
      if (t.dataset.cm) comments[t.dataset.cm] = t.value;
    };
    root.querySelector('#save').onclick = async (e) => {
      if (root.querySelector('.score-in.bad')) return U.toast('Có điểm không hợp lệ (phải từ 0 đến 10).', 'err');
      const title = root.querySelector('#title').value.trim(), date = root.querySelector('#date').value;
      if (!title || !date) return U.toast('Nhập tên bài và ngày.', 'err');
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const sc = {}, cm = {};
        students.forEach((s) => { if (scores[s.id] != null) sc[s.id] = scores[s.id]; if (comments[s.id]) cm[s.id] = comments[s.id]; });
        await DB.save('assessments', id, { classId: a.classId, teacherId: a.teacherId || '', teacherIds: U.classTeachers(cls), title, date, scores: sc, comments: cm, createdBy: a.createdBy || App.me.name, updatedBy: App.me.name }, true);
        U.toast('Đã lưu điểm và nhận xét', 'ok');
      } catch (er) { U.toast(er.message, 'err'); }
      btn.disabled = false;
    };
    root.querySelector('#del').onclick = async () => {
      if (!(await U.confirm(`Xóa bài đánh giá <b>${esc(a.title)}</b>?`, 'Xóa'))) return;
      await DB.del('assessments', id);
      U.toast('Đã xóa', 'ok');
      App.go('assessments', { class: cls.id });
    };
    root.querySelector('#tpl').onclick = () => { try { X.scoreTemplate(cls, students, a.title, a.date); } catch (e) { U.toast(e.message, 'err'); } };
    root.querySelector('#exp').onclick = () => {
      try { X.exportScores(cls, { ...a, scores: Object.fromEntries(Object.entries(scores).filter(([, v]) => v != null)), comments }, students); } catch (e) { U.toast(e.message, 'err'); }
    };
    root.querySelector('#imp').onclick = () => root.querySelector('#file').click();
    root.querySelector('#file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const rows = await X.parseScores(f);
        const byCode = Object.fromEntries(students.filter((s) => s.code).map((s) => [U.norm(s.code), s]));
        const byName = {};
        students.forEach((s) => { (byName[U.norm(s.name)] = byName[U.norm(s.name)] || []).push(s); });
        let ok = 0, bad = [], miss = [];
        rows.forEach((r, i) => {
          if (!r.code && !r.name) return;
          const s = (r.code && byCode[U.norm(r.code)]) || ((byName[U.norm(r.name)] || []).length === 1 ? byName[U.norm(r.name)][0] : null);
          if (!s) return miss.push(r.name || r.code);
          if (r.comment) { comments[s.id] = r.comment; root.querySelector(`[data-cm="${s.id}"]`).value = r.comment; }
          if (r.score === '') return;
          const n = Number(r.score);
          if (isNaN(n) || n < 0 || n > 10) return bad.push(`${s.name} (${r.score})`);
          scores[s.id] = n; ok++;
          const inp = root.querySelector(`[data-sid="${s.id}"]`); inp.value = n; inp.classList.remove('bad');
        });
        refreshAvg();
        const extra = (miss.length ? ` Không khớp: ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}.` : '') + (bad.length ? ` Điểm sai: ${bad.slice(0, 3).join(', ')}.` : '');
        U.toast(`Đã điền ${ok} điểm từ Excel. Bấm "Lưu" để lưu lại.${extra}`, bad.length || miss.length ? 'err' : 'ok');
      } catch (er) { U.toast(er.message, 'err'); }
    };
  }

  /* ===================================================================
   *  HỌC PHÍ
   * =================================================================== */
  const receiptHTML = (rows, month, settings) => {
    const one = (r) => `<div class="rc"><h2>${esc(settings.centerName)}</h2><h3>PHIẾU THU HỌC PHÍ - ${U.monthLabel(month).toUpperCase()}</h3>
      <table><tr><td>Học sinh</td><td><b>${esc(r.student.name)}</b></td></tr><tr><td>Lớp</td><td>${esc(r.cls.name)} (${esc(r.cls.code)})</td></tr>
      <tr><td>Số buổi có mặt / vắng</td><td>${r.present} / ${r.absent}</td></tr><tr><td>Học phí tháng</td><td>${money(r.base)}</td></tr>
      <tr><td>Trừ do vắng</td><td>${r.deduct ? '- ' + money(r.deduct) : '0 đ'}</td></tr>
      <tr class="tt"><td>SỐ TIỀN PHẢI ĐÓNG</td><td>${money(r.total)}</td></tr></table>
      <p class="sm">${esc(U.feeRuleText(r.cls, settings))}</p>
      <div class="sg"><div>Phụ huynh<br><i>(ký, ghi rõ họ tên)</i></div><div>Người thu tiền<br><i>(ký, ghi rõ họ tên)</i></div></div></div>`;
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#111;margin:0}.rc{width:640px;margin:0 auto;padding:36px 30px;page-break-after:always;border-bottom:1px dashed #999}
      h2{margin:0;text-align:center;font-size:18px}h3{text-align:center;margin:8px 0 22px;font-size:16px}table{width:100%;border-collapse:collapse}
      td{padding:9px 6px;border-bottom:1px solid #ddd;font-size:14px}td:last-child{text-align:right}.tt td{font-size:16px;font-weight:bold;border-top:2px solid #111}
      .sm{font-size:12px;color:#555}.sg{display:flex;justify-content:space-around;margin-top:34px;text-align:center;font-size:13px;height:90px}
    </style></head><body>${rows.map(one).join('')}</body></html>`;
  };

  Views.tuition = async (root, params) => {
    const classes = App.classes;
    if (!classes.length) { root.innerHTML = noClass('Học phí'); return; }
    const admin = DB.isAdmin();
    const st = (App.tuitionState = App.tuitionState || { month: U.today().slice(0, 7), classId: '' });
    if (params.month) st.month = params.month;
    let students = [], attendance = [], payments = [];
    const load = async () => {
      [students, attendance, payments] = await Promise.all([DB.q('students'), DB.q('attendance'), DB.q('payments', [['month', '==', st.month]])]);
    };
    const compute = () => {
      const cl = classes.filter((c) => !st.classId || c.id === st.classId);
      const rows = U.tuitionRows({ classes: cl, students, attendance, payments, settings: App.settings, month: st.month });
      const vnKey = (r) => { const w = r.student.name.trim().split(/\s+/); return w[w.length - 1] + ' ' + r.student.name; };
      rows.sort((a, b) => a.cls.grade - b.cls.grade || a.cls.code.localeCompare(b.cls.code) || vnKey(a).localeCompare(vnKey(b), 'vi'));
      return { rows, cl };
    };

    const render = () => {
      const { rows, cl } = compute();
      const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
      const due = sum((r) => r.total), got = sum((r) => (r.paid ? r.total : 0));
      const miss = cl.map((c) => ({ c, n: (rows.find((r) => r.cls.id === c.id) || {}).missing || 0 })).filter((x) => x.n > 0);
      const body = rows.map((r, i) => `<tr>
        <td class="muted">${i + 1}</td><td class="name">${esc(r.student.name)}</td><td><span class="badge blue">${esc(r.cls.name)}</span></td>
        <td class="center">${r.present}</td><td class="center">${r.absent ? `<b style="color:var(--err)">${r.absent}</b>` : 0}</td>
        <td class="right mono">${money(r.base)}</td><td class="right mono">${r.deduct ? '-' + money(r.deduct) : '-'}</td>
        <td class="right mono"><b>${money(r.total)}</b>${r.paid && r.total !== r.calc ? `<div class="small" style="color:var(--warn)" title="Số liệu hiện tại: ${money(r.calc)}">đã thay đổi</div>` : ''}</td>
        <td>${r.paid ? `<span class="badge ok">${icon('check', 13)} Đã đóng</span>` : '<span class="badge warn">Chưa đóng</span>'}</td>
        <td class="nowrap right">${admin ? (r.paid ? `<button class="btn sm ghost" data-unpay="${r.student.id}">Hoàn tác</button>` : `<button class="btn sm ok" data-pay="${r.student.id}">Đã đóng</button>`) : ''}<button class="icon-btn" data-print="${r.student.id}" title="In phiếu thu">${icon('printer')}</button></td></tr>`).join('');

      root.innerHTML = `${head('Học phí', 'Học phí tự động tính từ học phí của lớp và số buổi vắng trong tháng.',
        `${admin ? `<button class="btn ghost" id="imp">${icon('upload')} Nhập từ Excel</button><input type="file" id="tfile" accept=".xlsx,.xls" class="hidden">` : ''}<button class="btn ghost" id="printall" ${rows.length ? '' : 'disabled'}>${icon('printer')} In tất cả phiếu</button><button class="btn ghost" id="exp" ${rows.length ? '' : 'disabled'}>${icon('download')} Xuất Excel</button>`)}
        <div class="card toolbar">${monthNav(st.month)}
          <select class="select" id="cls"><option value="">Tất cả lớp</option>${classes.map((c) => `<option value="${c.id}" ${st.classId === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.code)})</option>`).join('')}</select>
          <span class="muted grow">${icon('info', 15)} ${esc(st.classId ? U.feeRuleText(App.classById(st.classId), App.settings) : 'Cách tính học phí được chọn riêng cho từng lớp (xem cột Cách tính ở mục Lớp học)')}${admin ? ' · <a href="#/settings">Đổi quy tắc trừ tiền</a>' : ''}</span></div>
        <div class="stats">
          <div class="card stat"><div class="ico">${icon('wallet', 24)}</div><div><b>${money(due)}</b><span>Tổng phải thu</span></div></div>
          <div class="card stat"><div class="ico g">${icon('check', 24)}</div><div><b>${money(got)}</b><span>Đã thu</span></div></div>
          <div class="card stat"><div class="ico o">${icon('clock', 24)}</div><div><b>${money(due - got)}</b><span>Còn phải thu</span></div></div>
          <div class="card stat"><div class="ico s">${icon('attendance', 24)}</div><div><b>${money(sum((r) => r.deduct))}</b><span>Tổng tiền đã trừ do vắng</span></div></div>
        </div>
        ${miss.length ? `<div class="alert warn" style="margin-bottom:16px">${icon('info', 15)} Chưa điểm danh đủ các buổi đã qua: ${miss.map((x) => `<b>${esc(x.c.name)}</b> còn ${x.n} buổi`).join(', ')}. Học phí có thể thay đổi sau khi điểm danh bổ sung.</div>` : ''}
        <div class="card"><div class="table-wrap">${rows.length ? `<table class="t"><thead><tr><th>#</th><th>Học sinh</th><th>Lớp</th><th class="center">Có mặt</th><th class="center">Vắng</th><th class="right">Học phí</th><th class="right">Giảm</th><th class="right">Phải đóng</th><th>Trạng thái</th><th></th></tr></thead><tbody>${body}</tbody>
          <tfoot><tr><td colspan="5">Tổng cộng (${rows.length} học sinh)</td><td class="right mono">${money(sum((r) => r.base))}</td><td class="right mono">-${money(sum((r) => r.deduct))}</td><td class="right mono">${money(due)}</td><td colspan="2"></td></tr></tfoot></table>` : empty('wallet', 'Không có dữ liệu học phí', 'Chưa có học sinh trong lớp đã chọn.')}</div></div>`;
    };

    const importTuition = async (file) => {
      const list = await X.parseTuition(file);
      const rows = compute().rows;
      const byCode = Object.fromEntries(rows.filter((r) => r.student.code).map((r) => [U.norm(r.student.code), r]));
      const byName = {};
      rows.forEach((r) => { (byName[U.norm(r.student.name)] = byName[U.norm(r.student.name)] || []).push(r); });
      const toPay = [], toUnpay = [], unmatched = [];
      list.forEach((x) => {
        const r = (x.code && byCode[U.norm(x.code)]) || ((byName[U.norm(x.name)] || []).length === 1 ? byName[U.norm(x.name)][0] : null);
        if (!r) return unmatched.push(x.name);
        if (x.paid && !r.paid) toPay.push(r); else if (x.unpaid && r.paid) toUnpay.push(r);
      });
      if (!toPay.length && !toUnpay.length) throw new Error('Không có thay đổi nào: trạng thái trong file trùng với dữ liệu hiện tại' + (unmatched.length ? ` (không khớp ${unmatched.length} học sinh).` : '.'));
      U.modal({
        title: `Nhập trạng thái học phí ${U.monthLabel(st.month).toLowerCase()}`, okText: 'Cập nhật',
        body: `<div class="alert ok" style="margin-bottom:10px">Đánh dấu <b>đã đóng</b>: ${toPay.length} học sinh (tổng ${money(toPay.reduce((a, r) => a + r.calc, 0))}). Hoàn tác về <b>chưa đóng</b>: ${toUnpay.length}.</div>
          ${unmatched.length ? `<div class="alert warn">Không khớp học sinh: ${unmatched.slice(0, 6).map(esc).join(', ')}${unmatched.length > 6 ? '…' : ''}</div>` : ''}`,
        onOk: async () => {
          for (const r of toPay) {
            const data = { studentId: r.student.id, classId: r.cls.id, teacherId: r.cls.teacherId || '', teacherIds: U.classTeachers(r.cls), month: st.month, paid: true, amount: r.calc, base: r.base, deduct: r.deduct, absent: r.absent, paidAt: new Date().toISOString(), confirmedBy: App.me.name + ' (nhập Excel)' };
            const id = `${r.student.id}_${st.month}`;
            await DB.save('payments', id, data, true);
            payments = payments.filter((p) => p.id !== id).concat([{ id, ...data }]);
          }
          for (const r of toUnpay) { const id = `${r.student.id}_${st.month}`; await DB.del('payments', id); payments = payments.filter((p) => p.id !== id); }
          U.toast('Đã cập nhật trạng thái học phí từ Excel', 'ok'); render();
        },
      });
    };
    root.onchange = async (e) => {
      if (e.target.id === 'cls') { st.classId = e.target.value; render(); return; }
      if (e.target.id === 'tfile') {
        const f = e.target.files[0]; e.target.value = '';
        if (f) { try { await importTuition(f); } catch (er) { U.toast(er.message, 'err'); } }
      }
    };
    root.onclick = async (e) => {
      const t = e.target;
      if (t.closest('[data-mprev]')) { st.month = U.addMonth(st.month, -1); await reload(); return; }
      if (t.closest('[data-mnext]')) { st.month = U.addMonth(st.month, 1); await reload(); return; }
      const pay = t.closest('[data-pay]'), un = t.closest('[data-unpay]'), pr = t.closest('[data-print]');
      const find = (id) => compute().rows.find((r) => r.student.id === id);
      if (pay) {
        const r = find(pay.dataset.pay);
        if (r.missing && !(await U.confirm(`Lớp ${esc(r.cls.name)} còn ${r.missing} buổi chưa điểm danh nên học phí có thể chưa chính xác. Vẫn đánh dấu đã đóng?`, 'Vẫn xác nhận', false))) return;
        const data = { studentId: r.student.id, classId: r.cls.id, teacherId: r.cls.teacherId || '', teacherIds: U.classTeachers(r.cls), month: st.month, paid: true, amount: r.calc, base: r.base, deduct: r.deduct, absent: r.absent, paidAt: new Date().toISOString(), confirmedBy: App.me.name };
        const id = `${r.student.id}_${st.month}`;
        await DB.save('payments', id, data, true);
        payments = payments.filter((p) => p.id !== id).concat([{ id, ...data }]);
        U.toast(`Đã ghi nhận ${r.student.name} đóng ${money(r.calc)}`, 'ok'); render();
      }
      if (un) {
        const id = `${un.dataset.unpay}_${st.month}`;
        if (!(await U.confirm('Hoàn tác trạng thái "Đã đóng" của học sinh này?', 'Hoàn tác'))) return;
        await DB.del('payments', id);
        payments = payments.filter((p) => p.id !== id); render();
      }
      if (pr) U.printHTML(receiptHTML([find(pr.dataset.print)], st.month, App.settings));
      if (t.closest('#imp')) { root.querySelector('#tfile').click(); return; }
      if (t.closest('#printall')) U.printHTML(receiptHTML(compute().rows, st.month, App.settings));
      if (t.closest('#exp')) { try { X.exportTuition(compute().rows, st.month, App.settings); } catch (er) { U.toast(er.message, 'err'); } }
    };
    const reload = async () => { root.querySelector('.card.toolbar') && (root.style.opacity = .6); await load(); root.style.opacity = 1; render(); };
    root.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tính học phí...</div>';
    await load(); render();
  };

  /* ===================================================================
   *  GIÁO VIÊN (quản trị)
   * =================================================================== */
  /* ===================================================================
   *  CÔNG & LƯƠNG GIÁO VIÊN (theo tiết)
   * =================================================================== */
  Views.payroll = async (root, params) => {
    const admin = DB.isAdmin();
    const st = (App.payrollState = App.payrollState || { month: U.today().slice(0, 7) });
    if (params.month) st.month = params.month;
    let tAtt = [], payouts = [];
    const load = async () => {
      tAtt = await DB.q('teacherAttendance');
      payouts = admin ? await DB.list('payouts', [['month', '==', st.month]]) : (await DB.list('payouts', [['teacherId', '==', App.me.uid]])).filter((p) => p.month === st.month);
    };
    const compute = () => {
      let rows = U.payrollRows({ classes: App.classes, tAtt, teachers: App.teachers, month: st.month });
      if (!admin) rows = rows.filter((r) => r.teacher.id === App.me.uid);
      rows.forEach((r) => { const p = payouts.find((x) => x.id === `${r.teacher.id}_${st.month}`); r.pay = p; r.paid = !!(p && p.paid); if (r.paid) r.amount = p.amount; });
      return rows;
    };
    /* ---------- chấm công giáo viên theo ngày: dạy đủ / nghỉ cả buổi / nghỉ một số tiết ---------- */
    st.day = st.day || U.today();
    const rateOf = (c, tid) => { const t = App.teachers.find((x) => x.id === tid) || {}; return Number(U.roleOf(c, tid) === 'main' ? t.rateMain : t.rateAssistant) || 0; };
    const dayCard = () => {
      const d = st.day;
      const cl = App.classes.filter((c) => U.sessions(c, d, d).length);
      const blocks = cl.map((c) => {
        const slot = U.slotFor(c, d);
        const planned = Number(slot.periods) || Number(c.periods) || 0;
        const doc = tAtt.find((x) => x.classId === c.id && x.date === d);
        const trs = U.classTeachers(c).map((tid) => {
          const rec = doc && doc.records && doc.records[tid];
          const taught = rec && rec.present ? Number(rec.periods) || 0 : 0;
          const mode = !rec ? 'full' : !rec.present ? 'none' : taught < planned ? 'part' : 'full';
          const off = mode === 'none' ? planned : mode === 'part' ? planned - taught : 0;
          const rate = rateOf(c, tid);
          return `<div class="tday-row" data-tid="${tid}" data-rate="${rate}">
            <div class="grow"><b>${esc(App.teacherName(tid))}</b> <span class="badge ${tid === c.teacherId ? 'blue' : ''}">${U.roleName(U.roleOf(c, tid))}</span></div>
            <select class="select" data-mode>${[['full', 'Dạy đủ'], ['none', 'Nghỉ cả buổi'], ['part', 'Nghỉ một số tiết']].map(([v, l]) => `<option value="${v}" ${v === mode ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <label class="small muted ${mode === 'part' ? '' : 'hidden'}" data-offbox>Số tiết nghỉ <input class="input" type="number" min="0.5" max="${planned}" step="0.5" data-off value="${mode === 'part' ? off : 0.5}" style="width:78px"></label>
            <input class="input" data-note placeholder="Lý do (không bắt buộc)" value="${esc((rec && rec.note) || '')}">
            <span class="small ${off ? '' : 'muted'}" data-sum style="min-width:170px">${off ? `Nghỉ ${off}/${planned} tiết · trừ ${money(off * rate)}` : `Dạy đủ ${planned} tiết`}</span></div>`;
        }).join('');
        return `<div class="dayclass" data-cls="${c.id}" data-planned="${planned}"><div class="dc-h"><b>${esc(c.name)}</b> <span class="muted">${esc(U.timeText(slot))} · ${planned} tiết</span> ${doc ? '<span class="badge ok">Đã chấm công</span>' : '<span class="badge warn">Chưa chấm công</span>'}</div>${trs}</div>`;
      }).join('');
      return `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Chấm công giáo viên theo ngày</h3><div class="grow"></div>
          <div class="row" style="flex-wrap:nowrap"><button class="icon-btn" id="dayprev" title="Ngày trước">${icon('left')}</button><input class="input" type="date" id="cday" value="${esc(d)}" style="width:auto"><button class="icon-btn" id="daynext" title="Ngày sau">${icon('right')}</button><button class="btn sm ghost" id="daytoday">Hôm nay</button></div></div>
        <div class="card-b">${blocks || `<div class="muted">Ngày ${U.fmtDate(d)} (${U.dayName(U.parse(d).getDay())}) không có lớp nào học theo lịch.</div>`}
        ${blocks ? `<div class="hint" style="margin-top:8px">Chọn "Nghỉ cả buổi" hoặc "Nghỉ một số tiết" cho giáo viên nghỉ, số tiền bị trừ tính bằng số tiết nghỉ nhân đơn giá tiết. Mặc định là dạy đủ.</div><div class="row mt"><button class="btn ok" id="saveday">${icon('check')} Lưu chấm công ngày ${U.fmtDate(d)}</button></div>` : ''}</div></div>`;
    };
    const render = () => {
      const rows = compute();
      const total = rows.reduce((s, r) => s + r.amount, 0), paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
      const norate = rows.filter((r) => Object.values(r.lines).some((l) => !l.rate && l.sessions));
      const miss = rows.filter((r) => r.missing);
      const lines = rows.flatMap((r) => Object.values(r.lines).map((l) => ({ r, l })));
      root.innerHTML = `${head('Công & lương giáo viên', 'Tiền giáo viên = số tiết đã dạy × đơn giá mỗi tiết. Giáo viên nghỉ cả buổi hoặc nghỉ một số tiết đều bị trừ tương ứng, ghi nhận ở phần "Chấm công giáo viên theo ngày" bên dưới.',
        `${admin ? `<button class="btn ghost" id="tgrid">${icon('download')} Tải mẫu chấm công</button><button class="btn ghost" id="impg">${icon('upload')} Nhập chấm công từ Excel</button><input type="file" id="gfile" accept=".xlsx,.xls" class="hidden">` : ''}<button class="btn ghost" id="exp" ${rows.length ? '' : 'disabled'}>${icon('download')} Xuất Excel</button>`)}
        <div class="card toolbar">${monthNav(st.month)}<span class="muted grow">${icon('info', 15)} 1 tiết = ${esc(App.settings.periodMinutes)} phút. Số tiết mỗi buổi chọn khi điểm danh giáo viên.</span></div>
        ${dayCard()}
        <div class="stats">
          <div class="card stat"><div class="ico">${icon('wallet', 24)}</div><div><b>${money(total)}</b><span>Tổng tiền thực nhận</span></div></div>
          <div class="card stat"><div class="ico g">${icon('check', 24)}</div><div><b>${money(paid)}</b><span>Đã trả</span></div></div>
          <div class="card stat"><div class="ico o">${icon('clock', 24)}</div><div><b>${money(total - paid)}</b><span>Còn phải trả</span></div></div>
          <div class="card stat"><div class="ico s">${icon('calendar', 24)}</div><div><b>${money(rows.reduce((s, r) => s + r.deduct, 0))}</b><span>Đã trừ do nghỉ (${rows.reduce((s, r) => s + r.off, 0)} tiết)</span></div></div>
        </div>
        ${norate.length ? `<div class="alert warn" style="margin-bottom:12px">Chưa nhập đơn giá tiết cho: <b>${norate.map((r) => esc(r.teacher.name)).join(', ')}</b>${admin ? ' (vào mục Giáo viên để nhập).' : '.'}</div>` : ''}
        ${miss.length ? `<div class="alert warn" style="margin-bottom:16px">Còn buổi chưa điểm danh giáo viên: ${miss.map((r) => `<b>${esc(r.teacher.name)}</b> ${r.missing} buổi`).join(', ')}. Tiền có thể thay đổi sau khi bổ sung.</div>` : ''}
        <div class="card"><div class="table-wrap">${rows.length ? `<table class="t"><thead><tr><th>Giáo viên</th><th class="center">Buổi dạy</th><th class="center">Nghỉ cả buổi</th><th class="center">Tiết theo lịch</th><th class="center">Tiết nghỉ</th><th class="center">Tiết đã dạy</th><th class="right">Lương theo lịch</th><th class="right">Trừ do nghỉ</th><th class="right">Thực nhận</th><th>Trạng thái</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
          ${rows.map((r) => `<tr><td class="name">${esc(r.teacher.name)}</td><td class="center">${r.sessions}</td><td class="center">${r.absent ? `<b style="color:var(--err)">${r.absent}</b>` : 0}</td><td class="center">${r.planned}</td><td class="center">${r.off ? `<b style="color:var(--err)">${r.off}</b>` : 0}</td><td class="center"><b>${r.periods}</b></td><td class="right mono">${money(r.gross)}</td><td class="right mono">${r.deduct ? '<span style="color:var(--err)">-' + money(r.deduct) + '</span>' : '-'}</td><td class="right mono"><b>${money(r.amount)}</b></td>
            <td>${r.paid ? `<span class="badge ok">${icon('check', 13)} Đã trả</span>` : '<span class="badge warn">Chưa trả</span>'}</td>
            ${admin ? `<td class="right nowrap">${r.paid ? `<button class="btn sm ghost" data-unpay="${r.teacher.id}">Hoàn tác</button>` : `<button class="btn sm ok" data-pay="${r.teacher.id}">Đã trả</button>`}</td>` : ''}</tr>`).join('')}
          </tbody><tfoot><tr><td>Tổng cộng</td><td class="center">${rows.reduce((s, r) => s + r.sessions, 0)}</td><td class="center">${rows.reduce((s, r) => s + r.absent, 0)}</td><td class="center">${rows.reduce((s, r) => s + r.planned, 0)}</td><td class="center">${rows.reduce((s, r) => s + r.off, 0)}</td><td class="center">${rows.reduce((s, r) => s + r.periods, 0)}</td><td class="right mono">${money(rows.reduce((s, r) => s + r.gross, 0))}</td><td class="right mono">-${money(rows.reduce((s, r) => s + r.deduct, 0))}</td><td class="right mono">${money(total)}</td><td colspan="${admin ? 2 : 1}"></td></tr></tfoot></table>` : empty('wallet', 'Chưa có dữ liệu dạy trong tháng này', 'Tiền giáo viên được tính từ phần "Giáo viên dạy buổi này" trong màn hình Điểm danh.')}</div></div>
        ${lines.length ? `<div class="card mt"><div class="card-h"><h3>Chi tiết theo lớp</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>Giáo viên</th><th>Lớp</th><th>Vai trò</th><th class="center">Số buổi dạy</th><th class="center">Nghỉ cả buổi</th><th class="center">Tiết theo lịch</th><th class="center">Tiết nghỉ</th><th class="center">Tiết đã dạy</th><th class="right">Đơn giá/tiết</th><th class="right">Trừ do nghỉ</th><th class="right">Thực nhận</th></tr></thead><tbody>
          ${lines.map(({ r, l }) => `<tr><td class="name">${esc(r.teacher.name)}</td><td><span class="badge blue">${esc(l.cls.name)}</span></td><td>${U.roleName(l.role)}</td><td class="center">${l.sessions}</td><td class="center">${l.absent}</td><td class="center">${l.planned}</td><td class="center">${l.off ? `<b style="color:var(--err)">${l.off}</b>` : 0}</td><td class="center">${l.periods}</td><td class="right mono">${money(l.rate)}</td><td class="right mono">${l.deduct ? '-' + money(l.deduct) : '-'}</td><td class="right mono">${money(l.amount)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    };
    const gridData = () => {
      const [from, to] = U.monthRange(st.month);
      const cl = App.classes.filter((c) => U.sessions(c, from, to).length);
      const dates = [...new Set(cl.flatMap((c) => U.sessions(c, from, to)))].sort();
      const entries = cl.flatMap((c) => U.classTeachers(c).map((tid) => {
        const byDate = {};
        tAtt.filter((d) => d.classId === c.id && d.date.slice(0, 7) === st.month).forEach((d) => { if (d.records && d.records[tid]) byDate[d.date] = d.records[tid]; });
        return { cls: c, teacherId: tid, name: App.teacherName(tid), role: U.roleOf(c, tid), byDate };
      }));
      return { dates, entries };
    };
    const importGrid = async (file) => {
      const rows = await X.parseTeacherGrid(file, st.month);
      const plan = [], bad = [];
      rows.forEach((r) => {
        const c = App.classes.find((k) => U.norm(k.code) === U.norm(r.classCode));
        const tid = c && U.classTeachers(c).find((id) => U.norm(App.teacherName(id)) === U.norm(r.teacher));
        if (!c || !tid) return bad.push(`${r.classCode} / ${r.teacher}`);
        const sess = new Set(U.sessions(c, ...U.monthRange(st.month)));
        Object.entries(r.cells).forEach(([d, v]) => { if (sess.has(d)) plan.push({ c, tid, d, v }); });
      });
      if (!plan.length) throw new Error('Không có ô chấm công hợp lệ nào để nhập (kiểm tra mã lớp, tên giáo viên, tháng và ngày học).');
      U.modal({
        title: 'Xem trước chấm công giáo viên', okText: `Nhập ${plan.length} ô`,
        body: `<div class="alert ok" style="margin-bottom:10px">Có <b>${plan.length}</b> ô chấm công hợp lệ (${plan.filter((p) => p.v === 'V').length} ô nghỉ, tổng ${plan.reduce((a, p) => a + (p.v === 'V' ? 0 : p.v), 0)} tiết).</div>
          ${bad.length ? `<div class="alert warn">Không khớp lớp / giáo viên: ${bad.slice(0, 5).map(esc).join('; ')}${bad.length > 5 ? '…' : ''}</div>` : ''}<div class="hint">Ghi đè chấm công của giáo viên ở những buổi có trong file.</div>`,
        onOk: async () => {
          const touched = {};
          plan.forEach((p) => { (touched[`${p.c.id}_${p.d}`] = touched[`${p.c.id}_${p.d}`] || { c: p.c, d: p.d, items: [] }).items.push(p); });
          for (const [id, g] of Object.entries(touched)) {
            const old = tAtt.find((x) => x.id === id);
            const records = { ...((old && old.records) || {}) };
            const planned = Number(U.slotFor(g.c, g.d).periods) || Number(g.c.periods) || 0;
            g.items.forEach((p) => { records[p.tid] = p.v === 'V' ? { present: false, periods: 0, planned } : { present: p.v > 0, periods: p.v, planned }; });
            const data = { classId: g.c.id, teacherId: g.c.teacherId || '', teacherIds: U.classTeachers(g.c), date: g.d, records, updatedBy: App.me.name + ' (nhập Excel)' };
            await DB.save('teacherAttendance', id, data, true);
            tAtt = tAtt.filter((x) => x.id !== id).concat([{ id, ...data }]);
          }
          U.toast(`Đã nhập ${plan.length} ô chấm công từ Excel`, 'ok'); render();
        },
      });
    };
    const sumRow = (row) => {
      const planned = Number(row.closest('.dayclass').dataset.planned);
      const mode = row.querySelector('[data-mode]').value;
      const off = mode === 'none' ? planned : mode === 'part' ? Math.min(planned, Math.max(0, Number(row.querySelector('[data-off]').value) || 0)) : 0;
      const sum = row.querySelector('[data-sum]');
      sum.textContent = off ? `Nghỉ ${off}/${planned} tiết · trừ ${money(off * Number(row.dataset.rate))}` : `Dạy đủ ${planned} tiết`;
      sum.classList.toggle('muted', !off);
    };
    root.oninput = (e) => { if (e.target.matches('[data-off]')) sumRow(e.target.closest('.tday-row')); };
    const saveDay = async (btn) => {
      btn.disabled = true;
      try {
        for (const block of root.querySelectorAll('.dayclass')) {
          const c = App.classById(block.dataset.cls), planned = Number(block.dataset.planned);
          const id = `${c.id}_${st.day}`;
          const old = tAtt.find((x) => x.id === id);
          const records = { ...((old && old.records) || {}) };
          for (const row of block.querySelectorAll('.tday-row')) {
            const mode = row.querySelector('[data-mode]').value, note = row.querySelector('[data-note]').value.trim();
            let off = mode === 'part' ? Number(row.querySelector('[data-off]').value) || 0 : 0;
            if (mode === 'part' && !(off > 0)) throw new Error('Nhập số tiết nghỉ (lớn hơn 0).');
            if (mode === 'part' && off >= planned) off = planned;
            const none = mode === 'none' || (mode === 'part' && off >= planned);
            records[row.dataset.tid] = none ? { present: false, periods: 0, planned, note } : { present: true, periods: planned - off, planned, note };
          }
          const data = { classId: c.id, teacherId: c.teacherId || '', teacherIds: U.classTeachers(c), date: st.day, records, updatedBy: App.me.name };
          await DB.save('teacherAttendance', id, data, true);
          tAtt = tAtt.filter((x) => x.id !== id).concat([{ id, ...data }]);
        }
        U.toast(`Đã lưu chấm công giáo viên ngày ${U.fmtDate(st.day)}`, 'ok');
        render();
      } catch (er) { U.toast(er.message, 'err'); btn.disabled = false; }
    };
    root.onchange = async (e) => {
      if (e.target.id === 'cday') { if (e.target.value) { st.day = e.target.value; render(); } return; }
      if (e.target.matches('[data-mode]')) {
        const row = e.target.closest('.tday-row');
        row.querySelector('[data-offbox]').classList.toggle('hidden', e.target.value !== 'part');
        sumRow(row);
        return;
      }
      if (e.target.matches('[data-off]')) { sumRow(e.target.closest('.tday-row')); return; }
      if (e.target.id !== 'gfile') return;
      const f = e.target.files[0]; e.target.value = '';
      if (f) { try { await importGrid(f); } catch (er) { U.toast(er.message, 'err'); } }
    };
    const shiftDay = (n) => { const x = U.parse(st.day); x.setDate(x.getDate() + n); st.day = U.ymd(x); render(); };
    root.onclick = async (e) => {
      const t = e.target;
      if (t.closest('#dayprev')) return shiftDay(-1);
      if (t.closest('#daynext')) return shiftDay(1);
      if (t.closest('#daytoday')) { st.day = U.today(); render(); return; }
      if (t.closest('#saveday')) return saveDay(t.closest('#saveday'));
      if (t.closest('#tgrid')) { const g = gridData(); if (!g.entries.length) return U.toast('Không có lớp nào có buổi học trong tháng này.', 'err'); X.exportTeacherGrid(g.entries, st.month, g.dates); return; }
      if (t.closest('#impg')) { root.querySelector('#gfile').click(); return; }
      if (t.closest('[data-mprev]')) { st.month = U.addMonth(st.month, -1); await load(); return render(); }
      if (t.closest('[data-mnext]')) { st.month = U.addMonth(st.month, 1); await load(); return render(); }
      if (t.closest('#exp')) { try { X.exportPayroll(compute(), st.month); } catch (er) { U.toast(er.message, 'err'); } return; }
      const pay = t.closest('[data-pay]'), un = t.closest('[data-unpay]');
      if (pay) {
        const r = compute().find((x) => x.teacher.id === pay.dataset.pay);
        const id = `${r.teacher.id}_${st.month}`;
        const data = { teacherId: r.teacher.id, month: st.month, paid: true, amount: r.amount, periods: r.periods, sessions: r.sessions, paidAt: new Date().toISOString(), confirmedBy: App.me.name };
        await DB.save('payouts', id, data, true);
        payouts = payouts.filter((p) => p.id !== id).concat([{ id, ...data }]);
        U.toast(`Đã ghi nhận trả ${money(r.amount)} cho ${r.teacher.name}`, 'ok'); render();
      }
      if (un) {
        if (!(await U.confirm('Hoàn tác trạng thái "Đã trả" của giáo viên này?', 'Hoàn tác'))) return;
        const id = `${un.dataset.unpay}_${st.month}`;
        await DB.del('payouts', id); payouts = payouts.filter((p) => p.id !== id); render();
      }
    };
    root.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tính...</div>';
    await load(); render();
  };

  /* ===================================================================
   *  GIÁO VIÊN (quản trị)
   * =================================================================== */
  Views.teachers = async (root, params = {}) => {
    const list = App.teachers;
    root.innerHTML = `${head('Giáo viên', 'Tạo tài khoản đăng nhập cho giáo viên. Mỗi giáo viên chỉ thấy các lớp được phân công.', `<button class="btn" id="add">${icon('plus')} Thêm giáo viên</button>`)}
      <div class="card"><div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>Giáo viên</th><th>Email đăng nhập</th><th>Số điện thoại</th><th>Lớp phụ trách</th><th class="right">Đơn giá/tiết</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr><td class="name"><div class="row" style="flex-wrap:nowrap"><div class="avatar">${esc(U.initials(t.name))}</div>${esc(t.name)}</div></td><td>${esc(t.email)}</td><td class="mono">${esc(t.phone || '')}</td>
        <td>${App.classes.filter((c) => U.classTeachers(c).includes(t.id)).map((c) => `<span class="badge ${c.teacherId === t.id ? 'blue' : ''}" title="${U.roleName(U.roleOf(c, t.id))}">${esc(c.name)}${c.teacherId === t.id ? '' : ' (TG)'}</span>`).join(' ') || '<span class="muted">Chưa có</span>'}</td>
        <td class="right small mono">Chính: ${money(t.rateMain)}<br>Trợ giảng: ${money(t.rateAssistant)}</td>
        <td>${t.active === false ? '<span class="badge err">Đã khóa</span>' : '<span class="badge ok">Hoạt động</span>'}</td>
        <td class="nowrap right"><button class="icon-btn" data-edit="${t.id}" title="Sửa">${icon('edit')}</button><button class="icon-btn" data-reset="${t.id}" title="Gửi email đặt lại mật khẩu">${icon('key')}</button></td></tr>`).join('')}
      </tbody></table>` : empty('teachers', 'Chưa có giáo viên', 'Bấm "Thêm giáo viên" để tạo tài khoản.')}</div></div>`;

    const form = (t) => `<div class="form-grid"><div class="full"><label class="f">Họ và tên *</label><input class="input" id="n" value="${esc(t ? t.name : '')}"></div>
      <div><label class="f">Email đăng nhập *</label><input class="input" type="email" id="e" value="${esc(t ? t.email : '')}" ${t ? 'disabled' : ''}></div>
      <div><label class="f">Số điện thoại</label><input class="input" id="p" value="${esc(t ? t.phone || '' : '')}"></div>
      <div><label class="f">Đơn giá mỗi tiết - giáo viên chính (đ)</label><input class="input" type="number" min="0" step="1000" id="rm" value="${esc(t ? t.rateMain || 0 : 100000)}"></div>
      <div><label class="f">Đơn giá mỗi tiết - trợ giảng (đ)</label><input class="input" type="number" min="0" step="1000" id="ra" value="${esc(t ? t.rateAssistant || 0 : 60000)}"></div>
      ${t ? `<div class="full"><label class="f">Trạng thái</label><select class="select" id="a"><option value="1">Hoạt động</option><option value="0" ${t.active === false ? 'selected' : ''}>Khóa tài khoản</option></select></div>`
        : '<div class="full"><label class="f">Mật khẩu ban đầu * (tối thiểu 6 ký tự)</label><input class="input" id="pw" type="text" autocomplete="off"><div class="hint">Giáo viên có thể tự đổi mật khẩu sau khi đăng nhập.</div></div>'}</div>`;
    const addTeacher = () => U.modal({
      title: 'Thêm giáo viên', okText: 'Tạo tài khoản', body: form(null),
      onOk: async (w) => {
        const v = (id) => w.querySelector('#' + id).value.trim();
        if (!v('n') || !v('e')) throw new Error('Nhập họ tên và email.');
        if (!/^\S+@\S+\.\S+$/.test(v('e'))) throw new Error('Email không hợp lệ.');
        if (v('pw').length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự.');
        await DB.createTeacher({ email: v('e'), password: v('pw'), name: v('n'), phone: v('p'), rateMain: Number(v('rm')) || 0, rateAssistant: Number(v('ra')) || 0 });
        U.toast('Đã tạo tài khoản giáo viên', 'ok');
        await App.refreshTeachers(); App.render();
      },
    });
    root.querySelector('#add').onclick = addTeacher;
    if (params.new) addTeacher();
    root.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), rs = e.target.closest('[data-reset]');
      if (ed) {
        const t = list.find((x) => x.id === ed.dataset.edit);
        U.modal({
          title: 'Sửa giáo viên', body: form(t),
          onOk: async (w) => {
            const name = w.querySelector('#n').value.trim();
            if (!name) throw new Error('Nhập họ tên.');
            await DB.save('users', t.id, { name, phone: w.querySelector('#p').value.trim(), active: w.querySelector('#a').value === '1', rateMain: Number(w.querySelector('#rm').value) || 0, rateAssistant: Number(w.querySelector('#ra').value) || 0 });
            U.toast('Đã lưu', 'ok'); await App.refreshTeachers(); App.render();
          },
        });
      }
      if (rs) {
        const t = list.find((x) => x.id === rs.dataset.reset);
        try { await DB.resetPassword(t.email); U.toast(`Đã gửi email đặt lại mật khẩu tới ${t.email}`, 'ok'); } catch (er) { U.toast(er.message, 'err'); }
      }
    };
  };

  /* ===================================================================
   *  PHÂN CÔNG GIẢNG DẠY & ĐƠN GIÁ TIẾT (quản trị)
   * =================================================================== */
  Views.assign = async (root) => {
    const teachers = App.teachers.filter((t) => t.active !== false);
    const opts = (sel) => `<option value="">-- Không có --</option>${teachers.map((t) => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}`;
    const draw = () => {
      root.innerHTML = `${head('Phân công giảng dạy & đơn giá tiết', 'Chọn giáo viên chính, trợ giảng cho từng lớp và nhập số tiền mỗi tiết giáo viên được hưởng. Thay đổi được lưu ngay.',
        `<a class="btn" href="#/classes?new=1">${icon('plus')} Thêm lớp mới</a><a class="btn ghost" href="#/teachers?new=1">${icon('plus')} Thêm giáo viên</a>`)}
        <div class="card"><div class="card-h"><h3>1. Phân công lớp dạy</h3><span class="small muted">Mỗi lớp có 1 giáo viên chính và có thể có 1 trợ giảng</span></div>
        <div class="table-wrap">${App.classes.length ? `<table class="t"><thead><tr><th>Lớp</th><th>Lịch học</th><th>Giáo viên chính</th><th>Trợ giảng</th><th>Số tiết/buổi</th></tr></thead><tbody>
          ${App.classes.map((c) => `<tr><td class="name">${esc(c.name)}<div class="small muted">${esc(c.code)}${c.status === 'closed' ? ' · đã đóng' : ''}</div></td><td class="nowrap small">${esc(U.scheduleText(c))}</td>
            <td><select class="select" data-main="${c.id}">${opts(c.teacherId)}</select></td>
            <td><select class="select" data-ta="${c.id}">${opts(c.assistantId)}</select></td>
            <td class="small">${esc(U.periodsText(c))} tiết<div class="muted">sửa trong form lớp</div></td></tr>`).join('')}
        </tbody></table>` : empty('classes', 'Chưa có lớp nào', `<a class="btn mt" href="#/classes?new=1">${icon('plus')} Thêm lớp mới</a>`)}</div></div>
        <div class="card mt"><div class="card-h"><h3>2. Số tiền mỗi tiết giáo viên được hưởng</h3><span class="small muted">Tiền lương = số tiết đã dạy × đơn giá (xem ở mục Công & lương GV)</span></div>
        <div class="table-wrap">${teachers.length ? `<table class="t"><thead><tr><th>Giáo viên</th><th>Lớp phụ trách</th><th>Đơn giá/tiết khi là giáo viên chính (đ)</th><th>Đơn giá/tiết khi là trợ giảng (đ)</th></tr></thead><tbody>
          ${teachers.map((t) => `<tr><td class="name">${esc(t.name)}</td>
            <td>${App.classes.filter((c) => U.classTeachers(c).includes(t.id)).map((c) => `<span class="badge ${c.teacherId === t.id ? 'blue' : ''}">${esc(c.name)}${c.teacherId === t.id ? '' : ' (TG)'}</span>`).join(' ') || '<span class="muted">Chưa có</span>'}</td>
            <td><input class="input" type="number" min="0" step="1000" style="width:170px" data-rm="${t.id}" value="${esc(t.rateMain || 0)}"></td>
            <td><input class="input" type="number" min="0" step="1000" style="width:170px" data-ra="${t.id}" value="${esc(t.rateAssistant || 0)}"></td></tr>`).join('')}
        </tbody></table>` : empty('teachers', 'Chưa có giáo viên', `<a class="btn mt" href="#/teachers?new=1">${icon('plus')} Thêm giáo viên</a>`)}</div></div>`;
    };
    draw();
    root.onchange = async (e) => {
      const d = e.target.dataset || {};
      try {
        if (d.main || d.ta || d.per) {
          const c = App.classById(d.main || d.ta || d.per);
          const patch = {};
          if (d.main) patch.teacherId = e.target.value;
          if (d.ta) patch.assistantId = e.target.value;
          if (d.per) { patch.periods = Number(e.target.value); if (!(patch.periods > 0)) throw new Error('Số tiết không hợp lệ.'); }
          const next = { ...c, ...patch };
          if (next.teacherId && next.teacherId === next.assistantId) { U.toast('Giáo viên chính và trợ giảng phải là hai người khác nhau.', 'err'); return draw(); }
          next.teacherIds = U.classTeachers(next);
          await DB.save('classes', c.id, { ...patch, teacherIds: next.teacherIds });
          if (U.classTeachers(c).join() !== next.teacherIds.join()) {
            for (const col of ['students', 'attendance', 'assessments', 'payments', 'teacherAttendance']) {
              const list = await DB.list(col, [['classId', '==', c.id]]);
              await DB.updateMany(col, list.map((x) => x.id), { teacherId: next.teacherId || '', teacherIds: next.teacherIds });
            }
          }
          await App.refreshClasses();
          U.toast(`Đã lưu phân công ${c.name}`, 'ok'); draw();
        } else if (d.rm || d.ra) {
          const id = d.rm || d.ra;
          const v = Math.max(0, Number(e.target.value) || 0);
          await DB.save('users', id, d.rm ? { rateMain: v } : { rateAssistant: v });
          await App.refreshTeachers();
          U.toast(`Đã lưu đơn giá: ${money(v)}/tiết`, 'ok');
        }
      } catch (er) { U.toast(er.message, 'err'); draw(); }
    };
  };

  /* ===================================================================
   *  CÀI ĐẶT (quản trị)
   * =================================================================== */
  Views.settings = async (root) => {
    const s = App.settings;
    const demo = DB.mode === 'demo';
    root.innerHTML = `${head('Cài đặt', 'Quy tắc trừ tiền khi vắng, số phút mỗi tiết và thông tin trung tâm. Cách tính học phí (theo buổi nghỉ hay theo buổi đi học) chọn riêng cho từng lớp.')}
      <div class="two-col"><div class="card"><div class="card-h"><h3>Quy tắc học phí & trừ tiền khi vắng</h3></div><div class="card-b">
        <div class="form-grid">
          <div class="full"><label class="f">Tên trung tâm (in trên phiếu thu)</label><input class="input" id="cn" value="${esc(s.centerName)}"></div>
          <div><label class="f">Học phí mặc định mỗi tháng (đ)</label><input class="input" type="number" min="0" step="1000" id="df" value="${esc(s.defaultFee)}"><div class="hint">Gợi ý khi tạo lớp mới. Mỗi lớp có thể có học phí riêng.</div></div>
          <div><label class="f">Số phút của 1 tiết</label><input class="input" type="number" min="15" max="120" step="5" id="pm" value="${esc(s.periodMinutes || 45)}"><div class="hint">Dùng để gợi ý số tiết mỗi buổi (ví dụ 17:30-19:00 = 2 tiết).</div></div>
          <div><label class="f">Bắt đầu trừ tiền khi vắng từ (buổi)</label><input class="input" type="number" min="1" max="20" id="dfrom" value="${esc(s.deductFrom)}"><div class="hint">Ví dụ 2: vắng 1 buổi không trừ, vắng từ 2 buổi trở lên mới trừ.</div></div>
          <div><label class="f">Số tiền trừ mỗi buổi vắng (đ)</label><input class="input" type="number" min="0" step="1000" id="damt" value="${esc(s.deductAmount)}"><div class="hint">Nhập 0 nếu không trừ tiền khi vắng.</div></div>
          <div class="full"><div class="alert" id="ex"></div></div>
        </div><div class="row mt"><button class="btn" id="save">${icon('check')} Lưu cài đặt</button></div></div></div>
      <div class="card"><div class="card-h"><h3>Dữ liệu & hệ thống</h3></div><div class="card-b">
        <dl class="kv"><dt>Chế độ</dt><dd>${demo ? '<span class="badge warn">Dùng thử (lưu trên trình duyệt)</span>' : '<span class="badge ok">Firebase (trực tuyến)</span>'}</dd></dl>
        <div class="row mt"><button class="btn ghost" id="bk">${icon('download')} Sao lưu dữ liệu (JSON)</button>${demo ? '<button class="btn ghost" id="rs" style="color:var(--err)">Đặt lại dữ liệu mẫu</button>' : ''}</div>
        <p class="hint">Nên sao lưu định kỳ hằng tháng. File sao lưu chứa thông tin học sinh, hãy cất giữ cẩn thận.</p></div></div></div>`;
    const ex = () => {
      const f = Math.max(1, Number(root.querySelector('#dfrom').value) || 1), a = Number(root.querySelector('#damt').value) || 0, fee = Number(root.querySelector('#df').value) || 0;
      const n = f + 1, d = a * n;
      root.querySelector('#ex').innerHTML = a > 0
        ? `<b>Ví dụ</b> (học phí ${money(fee)}): vắng ${f - 1 > 0 ? f - 1 : 0} buổi → không trừ; vắng ${f} buổi → trừ ${money(a * f)} → đóng ${money(Math.max(0, fee - a * f))}; vắng ${n} buổi → trừ ${money(d)} → đóng ${money(Math.max(0, fee - d))}.`
        : 'Hiện không trừ học phí khi học sinh vắng.';
    };
    ['dfrom', 'damt', 'df'].forEach((id) => { root.querySelector('#' + id).oninput = ex; });
    ex();
    root.querySelector('#save').onclick = async () => {
      const data = {
        centerName: root.querySelector('#cn').value.trim() || U.DEFAULT_SETTINGS.centerName,
        defaultFee: Math.max(0, Number(root.querySelector('#df').value) || 0),
        periodMinutes: Math.max(15, Number(root.querySelector('#pm').value) || 45),
        deductFrom: Math.max(1, Math.floor(Number(root.querySelector('#dfrom').value) || 1)),
        deductAmount: Math.max(0, Number(root.querySelector('#damt').value) || 0),
      };
      try { await DB.save('settings', 'main', data); App.settings = { ...U.DEFAULT_SETTINGS, ...data }; U.toast('Đã lưu cài đặt', 'ok'); App.renderShellTitle(); } catch (e) { U.toast(e.message, 'err'); }
    };
    root.querySelector('#bk').onclick = async () => {
      try { U.download(`sao_luu_sky_${U.today()}.json`, JSON.stringify(await DB.backup(), null, 1)); } catch (e) { U.toast(e.message, 'err'); }
    };
    const rs = root.querySelector('#rs');
    if (rs) rs.onclick = async () => {
      if (!(await U.confirm('Xóa toàn bộ dữ liệu dùng thử hiện tại và nạp lại dữ liệu mẫu ban đầu?', 'Đặt lại'))) return;
      DB.resetDemo(); await App.boot(true);
      U.toast('Đã nạp lại dữ liệu mẫu', 'ok');
    };
  };
})();
