/* Màn hình: Điểm danh, Đánh giá, Học phí, Giáo viên, Cài đặt */
(function () {
  const { esc, icon, money } = U;
  const { empty, head } = UI;
  const monthNav = (m, min, max) => `<div class="month-nav"><button class="icon-btn" data-mprev ${min && m <= min ? 'disabled' : ''}>${icon('left')}</button><b>${U.monthLabel(m)}</b><button class="icon-btn" data-mnext ${max && m >= max ? 'disabled' : ''}>${icon('right')}</button></div>`;
  const minMonth = (cl) => (cl.map((c) => c.startDate).filter(Boolean).sort()[0] || '').slice(0, 7);
  /* đọc lại bản mới nhất trước khi ghi để không đè dữ liệu người khác vừa sửa (nhiều người dùng cùng lúc) */
  const fresh = async (col, id, cached) => { try { return (await DB.get(col, id)) || cached; } catch (e) { return cached; } };
  const noClass = (title) => `${head(title)}<div class="card">${empty('classes', 'Chưa có lớp nào', DB.isAdmin() ? 'Hãy vào mục Lớp học để tạo lớp trước.' : 'Quản trị viên chưa phân công lớp cho bạn.')}</div>`;

  /* ===================================================================
   *  ĐIỂM DANH
   * =================================================================== */
  Views.attendance = async (root, params) => {
    const embed = !!params.embed; // hiển thị bên trong trang chi tiết của lớp
    const classes = App.openClasses();
    if (!classes.length) { root.innerHTML = noClass('Điểm danh'); return; }
    let cls = classes.find((c) => c.id === (params.class || App.classId)) || classes[0];
    App.classId = cls.id;
    const startM = cls.startDate ? cls.startDate.slice(0, 7) : '', endM = cls.endDate ? cls.endDate.slice(0, 7) : '';
    let month = params.month || (params.date || U.today()).slice(0, 7);
    if (startM && month < startM) month = startM; // không hiển thị tháng trước ngày mở lớp
    if (endM && month > endM) month = endM;
    let sel = params.date || null, students = [], docs = [], marks = {}, dirty = false, savedAt = '';
    let tDocs = [], tMarks = {};
    const teacherIds = () => U.classTeachers(cls);
    const tName = (id) => App.teacherName(id);
    const rateOf = (id) => { const t = App.teachers.find((x) => x.id === id) || {}; return Number(U.roleOf(cls, id) === 'main' ? t.rateMain : t.rateAssistant) || 0; };
    const tSum = (id) => {
      const t = tMarks[id];
      const off = t.mode === 'none' ? t.planned : t.mode === 'part' ? Math.min(t.planned, Math.max(0, Number(t.off) || 0)) : 0;
      const rate = rateOf(id);
      return off ? `Nghỉ ${off}/${t.planned} tiết${rate ? ' · trừ ' + money(off * rate) : ''}` : `Dạy đủ ${t.planned} tiết`;
    };

    let scope = params.scope || 'month'; // all: từ khi mở lớp đến hôm nay, month, week
    let weekRef = params.date || U.today();
    const startD = cls.startDate || '';
    const weekDates = () => {
      const d = U.parse(weekRef), dow = (d.getDay() + 6) % 7;
      return [U.ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)), U.ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 6))];
    };
    const monthSessions = () => U.sessions(cls, ...U.monthRange(month));
    const sessions = () => (scope === 'all' ? U.sessions(cls, startD || '2000-01-01', U.today()) : scope === 'week' ? U.sessions(cls, ...weekDates()) : monthSessions());
    const loadClass = async () => {
      students = U.sortVN((await DB.q('students', [['classId', '==', cls.id]])).filter((s) => s.status !== 'inactive'));
      docs = await DB.q('attendance', [['classId', '==', cls.id]]);
      tDocs = await DB.q('teacherAttendance', [['classId', '==', cls.id]]);
    };
    const pickDefault = () => {
      const ss = sessions(), t = U.today();
      if (sel && ss.includes(sel)) return;
      sel = ss.includes(t) ? t : ss.filter((d) => d <= t).pop() || ss[0] || null;
      if (sel) month = sel.slice(0, 7);
    };
    const loadDay = () => {
      const doc = docs.find((d) => d.date === sel);
      marks = {};
      students.forEach((s) => { marks[s.id] = doc ? !(doc.records && doc.records[s.id] === false) : true; });
      const td = tDocs.find((d) => d.date === sel);
      tMarks = {};
      const planned = sel ? Number(U.slotFor(cls, sel).periods) || Number(cls.periods) || 0 : 0;
      teacherIds().forEach((id) => {
        const r = td && td.records && td.records[id];
        const taught = r && r.present ? Number(r.periods) || 0 : 0;
        const mode = !r ? 'full' : !r.present ? 'none' : taught < planned ? 'part' : 'full';
        tMarks[id] = { mode, off: mode === 'part' ? planned - taught : 0.5, note: (r && r.note) || '', planned };
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
      const mss = monthSessions();
      const recorded = new Set(docs.map((d) => d.date));
      const chip = (d) => `<button class="chip ${d === sel ? 'sel' : ''} ${recorded.has(d) ? 'rec' : ''} ${d === today ? 'today' : ''}" data-chip="${d}"><span class="dot"></span><small>${U.dayName(U.parse(d).getDay())}</small><b>${U.shortDate(d)}</b></button>`;
      const scopeName = scope === 'all' ? 'từ khi mở lớp đến hôm nay' : scope === 'week' ? 'trong tuần này' : `trong ${U.monthLabel(month).toLowerCase()}`;
      const strip = ss.length
        ? (scope === 'all'
          ? [...new Set(ss.map((d) => d.slice(0, 7)))].map((m) => { const l = ss.filter((d) => d.startsWith(m)); return `<div class="chip-month"><div class="cm-t">${U.monthLabel(m)} <span>· ${l.length} buổi</span></div><div class="strip">${l.map(chip).join('')}</div></div>`; }).join('')
          : ss.map(chip).join(''))
        : `<div class="alert warn">Không có buổi học nào ${scopeName} theo lịch và thời gian học của lớp.</div>`;
      const { p, a } = counts();
      const rows = roster().map((s, i) => `<label class="att-row ${marks[s.id] ? '' : 'absent'}"><span class="stt">${i + 1}</span><input type="checkbox" data-sid="${s.id}" ${marks[s.id] ? 'checked' : ''}><span class="box">${icon('check', 18)}</span><span class="nm">${esc(s.name)}</span><span class="st">${marks[s.id] ? 'Có mặt' : 'Vắng'}</span></label>`).join('');

      // bảng tổng hợp tháng
      const byDate = Object.fromEntries(docs.map((d) => [d.date, d]));
      const settings = App.settings;
      const mx = students.map((s, i) => {
        let ab = 0, pr = 0;
        const cells = mss.map((d) => {
          const v = byDate[d] && byDate[d].records && byDate[d].records[s.id];
          if (s.startDate && d < s.startDate) return '<td class="mk-n" title="Chưa vào học">–</td>';
          if (v === true) { pr++; return '<td class="mk-p">✓</td>'; }
          if (v === false) { ab++; return '<td class="mk-a">✗</td>'; }
          return '<td class="mk-n">·</td>';
        }).join('');
        const mineN = s.startDate ? mss.filter((d) => d >= s.startDate).length : mss.length;
        const fee = U.calcFee(cls, settings, pr, ab, mss.length ? mineN / mss.length : 1);
        return `<tr><td class="muted">${i + 1}</td><td class="name">${esc(s.name)}</td>${cells}<td>${pr}</td><td><b>${ab}</b></td><td class="right mono"><b>${money(fee.total)}</b>${fee.deduct ? `<div class="small muted">-${money(fee.deduct)}</div>` : ''}</td></tr>`;
      }).join('');

      const actions = `<button class="btn ghost" id="exp">${icon('download')} Tải mẫu / xuất Excel</button><button class="btn ghost" id="imp">${icon('upload')} Nhập từ Excel</button><input type="file" id="afile" accept=".xlsx,.xls" class="hidden">`;
      root.innerHTML = `${embed ? `<div class="row" style="justify-content:flex-end;margin-bottom:12px">${actions}</div>` : head('Điểm danh', 'Chọn buổi học theo lịch của lớp, điểm danh học sinh và giáo viên rồi bấm Lưu.', actions)}
        <div class="card toolbar">
          ${embed ? '' : `<select class="select" id="cls">${App.classOptions(cls.id)}</select>`}
          <div class="seg"><button data-scope="all" class="${scope === 'all' ? 'on' : ''}">Từ khi mở lớp</button><button data-scope="month" class="${scope === 'month' ? 'on' : ''}">Theo tháng</button><button data-scope="week" class="${scope === 'week' ? 'on' : ''}">Theo tuần</button></div>
          ${scope === 'month' ? monthNav(month, startM, endM) : scope === 'week' ? `<div class="month-nav"><button class="icon-btn" data-wprev ${startD && weekDates()[0] <= startD ? 'disabled' : ''}>${icon('left')}</button><b>Tuần ${U.shortDate(weekDates()[0])} - ${U.shortDate(weekDates()[1])}</b><button class="icon-btn" data-wnext>${icon('right')}</button></div>` : ''}
          ${DB.isAdmin() ? `<select class="select" id="fmode" title="Cách tính học phí của lớp"><option value="absence" ${cls.feeMode !== 'attend' ? 'selected' : ''}>Học phí: theo số buổi nghỉ</option><option value="attend" ${cls.feeMode === 'attend' ? 'selected' : ''}>Học phí: theo số buổi đi học</option></select>` : ''}
          <span class="muted"><b>${esc(cls.name)}</b> · ${esc(U.scheduleText(cls))}</span>
        </div>
        <div class="small muted" style="margin:-6px 0 14px">${icon('info', 14)} ${esc(U.feeRuleText(cls, App.settings))}${cls.startDate ? ` · Lớp khai giảng ${U.fmtDate(cls.startDate)}, chỉ có các buổi từ ngày này` : ''} · ${ss.length} buổi ${scopeName}, đã điểm danh ${ss.filter((d) => recorded.has(d)).length}</div>
        ${cls.startDate ? '' : `<div class="alert warn" style="margin-bottom:14px">${icon('info', 14)} Lớp chưa có ngày khai giảng nên chưa chặn được các ngày trước khi mở lớp. ${DB.isAdmin() ? 'Vào Lớp học → Sửa lớp để nhập ngày khai giảng.' : 'Nhờ quản trị viên nhập ngày khai giảng.'}</div>`}
        <div class="${scope === 'all' ? 'strip-groups' : 'strip'}">${strip}</div>
        ${sel && teacherIds().length ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Điểm danh giáo viên buổi này</h3><span class="small muted">Dạy đủ, nghỉ cả buổi hoặc nghỉ một số tiết (tiền nghỉ trừ vào lương, lưu cùng nút "Lưu điểm danh")</span></div>
          ${teacherIds().map((id) => { const t = tMarks[id]; return `<div class="tday-row" data-tid="${id}">
            <div class="grow"><b>${esc(tName(id))}</b> <span class="badge ${id === cls.teacherId ? 'blue' : ''}">${U.roleName(U.roleOf(cls, id))}</span></div>
            <select class="select" data-mode>${[['full', 'Dạy đủ'], ['none', 'Nghỉ cả buổi'], ['part', 'Nghỉ một số tiết']].map(([v, l]) => `<option value="${v}" ${v === t.mode ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <label class="small muted ${t.mode === 'part' ? '' : 'hidden'}" data-offbox>Số tiết nghỉ <input class="input" type="number" min="0.5" max="${t.planned}" step="0.5" data-off value="${esc(t.off)}" style="width:78px"></label>
            <input class="input" data-note placeholder="Lý do nghỉ (không bắt buộc)" value="${esc(t.note)}">
            <span class="small ${t.mode === 'full' ? 'muted' : ''}" data-sum style="min-width:170px">${esc(tSum(id))}</span></div>`; }).join('')}</div>` : ''}
        ${sel ? `<div class="card">
          <div class="card-h">
            <div><h3>${U.dayName(U.parse(sel).getDay())}, ${U.fmtDate(sel)} · ${esc(U.timeText(U.slotFor(cls, sel)))}</h3><div class="small muted" id="saved">${esc(savedAt)}</div></div>
            <div class="grow"></div>
            <div class="att-summary"><span class="badge ok" id="cp">Có mặt: ${p}</span><span class="badge err" id="ca">Vắng: ${a}</span><span class="badge" id="ct">Tổng: ${roster().length}</span><span class="badge warn ${dirty ? '' : 'hidden'}" id="dirty">Chưa lưu</span></div>
          </div>
          <div class="row" style="padding:12px 16px 0"><button class="btn sm soft" id="allp">${icon('check', 15)} Có mặt tất cả</button><button class="btn sm ghost" id="alla">Vắng tất cả</button><div class="grow"></div><button class="btn sm ok" id="bulk" title="Chọn nhiều ngày đã học trước đây và cho cả lớp có mặt cùng lúc">${icon('check', 15)} Điểm danh bù nhiều ngày</button></div>
          ${roster().length ? `<div class="att-list">${rows}</div>` : empty('students', 'Chưa có học sinh nào đang học vào ngày này', 'Thêm học sinh trong trang của lớp (Lớp học → chọn lớp).')}
          <div class="sticky-bar"><button class="btn ok lg" id="save" ${roster().length ? '' : 'disabled'}>${icon('check')} Lưu điểm danh</button><button class="btn ghost" id="mkass">${icon('star')} Tạo đánh giá cho buổi này</button></div>
        </div>` : ''}
        ${students.length && mss.length ? `<div class="card mt"><div class="card-h"><h3>Tổng hợp ${U.monthLabel(month).toLowerCase()}</h3><span class="small muted">${esc(U.feeRuleText(cls, settings))}</span></div>
          <div class="table-wrap"><table class="t grid-mx"><thead><tr><th>#</th><th>Học sinh</th>${mss.map((d) => `<th>${U.shortDate(d)}</th>`).join('')}<th>Có mặt</th><th>Vắng</th><th class="right">Học phí tạm tính</th></tr></thead><tbody>${mx}</tbody></table></div></div>` : ''}`;
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
    const bulk = async () => {
      if (!(await guard())) return;
      const ss = U.sessions(cls, startD || '2000-01-01', U.today());
      if (!ss.length) { U.toast('Lớp chưa có buổi học nào đã diễn ra.', 'err'); return; }
      const has = (d) => docs.some((x) => x.date === d);
      const byM = {};
      ss.forEach((d) => { (byM[d.slice(0, 7)] = byM[d.slice(0, 7)] || []).push(d); });
      const list = Object.keys(byM).sort().reverse().map((m) => `<div class="small muted" style="margin:10px 0 4px"><b>${U.monthLabel(m)}</b></div><div class="row" style="flex-wrap:wrap;gap:6px">${byM[m].slice().reverse().map((d) => `<label class="ck" style="margin:0;padding:6px 10px;border:1px solid var(--line,#dbe3f0);border-radius:8px"><input type="checkbox" data-bd="${d}" ${has(d) ? '' : 'checked'}> ${U.dayName(U.parse(d).getDay())} ${U.shortDate(d)}${has(d) ? ' <span class="badge ok">đã ĐD</span>' : ''}</label>`).join('')}</div>`).join('');
      const bm = U.modal({
        title: 'Điểm danh bù nhiều ngày', okText: 'Điểm danh bù',
        body: `<p style="margin-top:0">Tick các ngày đã học trước đây, bấm <b>Điểm danh bù</b>: <b>tất cả học sinh trong lớp có mặt</b> vào các ngày đã chọn (mỗi em chỉ tính từ ngày bắt đầu học của em đó).</p>
          <div class="row" style="gap:8px;margin-bottom:6px"><button class="btn sm soft" type="button" data-pick="new">Chỉ ngày chưa điểm danh</button><button class="btn sm ghost" type="button" data-pick="all">Chọn tất cả</button><button class="btn sm ghost" type="button" data-pick="none">Bỏ chọn</button><span class="small muted" id="bcnt"></span></div>
          <div style="max-height:46vh;overflow:auto">${list}</div>
          <label class="ck" style="margin-top:10px"><input type="checkbox" id="bo"> Ghi đè các ngày đã điểm danh (đặt cả những em đang vắng thành có mặt)</label>
          <label class="ck"><input type="checkbox" id="bt"> Đồng thời ghi giáo viên dạy đủ các buổi này</label>
          <div class="hint">Với ngày đã điểm danh, nếu không ghi đè thì giữ nguyên các em đã có dữ liệu và chỉ thêm em chưa có. Sau đó vẫn sửa lại từng ngày được.</div>`,
        onOk: async (w) => {
          const mode = w.querySelector('#bo').checked ? 'all' : 'new', withT = w.querySelector('#bt').checked;
          const targets = [...w.querySelectorAll('[data-bd]:checked')].map((c) => c.dataset.bd).sort();
          if (!targets.length) throw new Error('Hãy tick ít nhất một ngày.');
          for (const d of targets) {
            const id = `${cls.id}_${d}`;
            const old = await fresh('attendance', id, docs.find((x) => x.date === d));
            const records = { ...((old && old.records) || {}) };
            students.filter((s) => !s.startDate || s.startDate <= d).forEach((s) => { if (mode === 'all' || records[s.id] === undefined) records[s.id] = true; });
            const data = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), date: d, records, updatedBy: App.me.name + ' (điểm danh nhanh)' };
            await DB.save('attendance', id, data, true);
            docs = docs.filter((x) => x.date !== d).concat([{ id, ...data }]);
            if (withT && teacherIds().length) {
              const oldT = await fresh('teacherAttendance', id, tDocs.find((x) => x.date === d));
              const tr = { ...((oldT && oldT.records) || {}) };
              const planned = Number(U.slotFor(cls, d).periods) || Number(cls.periods) || 0;
              teacherIds().forEach((tid) => { if (mode === 'all' || !tr[tid]) tr[tid] = { present: true, periods: planned, planned, note: '' }; });
              const tdata = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), date: d, records: tr, updatedBy: App.me.name + ' (điểm danh nhanh)' };
              await DB.save('teacherAttendance', id, tdata, true);
              tDocs = tDocs.filter((x) => x.date !== d).concat([{ id, ...tdata }]);
            }
          }
          U.toast(`Đã điểm danh bù ${targets.length} buổi cho ${students.length} học sinh`, 'ok');
          loadDay(); render();
        },
      });
      const cnt = () => { bm.el.querySelector('#bcnt').textContent = 'Đã chọn ' + bm.el.querySelectorAll('[data-bd]:checked').length + ' ngày'; };
      bm.el.addEventListener('click', (e) => {
        const p = e.target.closest('[data-pick]'); if (!p) return;
        bm.el.querySelectorAll('[data-bd]').forEach((c) => { c.checked = p.dataset.pick === 'all' || (p.dataset.pick === 'new' && !has(c.dataset.bd)); });
        cnt();
      });
      bm.el.addEventListener('change', cnt); cnt();
    };
    const gotoMonth = async (m) => { if ((startM && m < startM) || (endM && m > endM)) return; if (!(await guard())) return; month = m; sel = null; pickDefault(); loadDay(); render(); };

    const importAtt = async (file) => {
      const res = await X.parseAttendanceGrid(file, month);
      const byCode = Object.fromEntries(students.filter((x) => x.code).map((x) => [U.norm(x.code), x]));
      const byName = {};
      students.forEach((x) => { (byName[U.norm(x.name)] = byName[U.norm(x.name)] || []).push(x); });
      const sess = new Set(monthSessions());
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
      if (e.target.matches('[data-mode]')) {
        const row = e.target.closest('.tday-row'), t = tMarks[row.dataset.tid];
        t.mode = e.target.value; dirty = true;
        row.querySelector('[data-offbox]').classList.toggle('hidden', t.mode !== 'part');
        const sm = row.querySelector('[data-sum]'); sm.textContent = tSum(row.dataset.tid); sm.classList.toggle('muted', t.mode === 'full');
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
      const row = e.target.closest && e.target.closest('.tday-row');
      if (!row) return;
      const t = tMarks[row.dataset.tid];
      if (e.target.matches('[data-off]')) t.off = e.target.value;
      else if (e.target.matches('[data-note]')) t.note = e.target.value;
      else return;
      dirty = true; updateCounts();
      const sm = row.querySelector('[data-sum]'); sm.textContent = tSum(row.dataset.tid);
    };
    root.onclick = async (e) => {
      const t = e.target;
      const chip = t.closest('[data-chip]');
      if (chip) { if (chip.dataset.chip === sel || !(await guard())) return; sel = chip.dataset.chip; month = sel.slice(0, 7); loadDay(); render(); return; }
      const sc = t.closest('[data-scope]');
      if (sc) {
        if (sc.dataset.scope === scope || !(await guard())) return;
        scope = sc.dataset.scope; weekRef = sel || U.today(); sel = null; pickDefault(); loadDay(); render(); return;
      }
      if (t.closest('[data-wprev]') || t.closest('[data-wnext]')) {
        if (!(await guard())) return;
        const d = U.parse(weekRef); d.setDate(d.getDate() + (t.closest('[data-wprev]') ? -7 : 7));
        weekRef = U.ymd(d); sel = null; pickDefault(); loadDay(); render(); return;
      }
      if (t.closest('#bulk')) return bulk();
      if (t.closest('[data-mprev]')) return gotoMonth(U.addMonth(month, -1));
      if (t.closest('[data-mnext]')) return gotoMonth(U.addMonth(month, 1));
      if (t.closest('#allp')) return setAll(true);
      if (t.closest('#alla')) return setAll(false);
      if (t.closest('#mkass')) { if (await guard()) App.go('assessments', { class: cls.id, new: 1, date: sel }); return; }
      if (t.closest('#imp')) { if (await guard()) root.querySelector('#afile').click(); return; }
      if (t.closest('#exp')) {
        try { const byDate = Object.fromEntries(docs.map((d) => [d.date, d])); X.exportAttendance(cls, month, students, monthSessions(), byDate); } catch (er) { U.toast(er.message, 'err'); }
        return;
      }
      if (t.closest('#save')) {
        const btn = t.closest('#save'); btn.disabled = true;
        try {
          // kiểm tra phần điểm danh giáo viên trước khi lưu
          const trNew = {};
          for (const tid of teacherIds()) {
            const t = tMarks[tid];
            const off = t.mode === 'part' ? Number(t.off) || 0 : 0;
            if (t.mode === 'part' && !(off > 0)) throw new Error(`Nhập số tiết nghỉ của ${tName(tid)} (lớn hơn 0).`);
            const none = t.mode === 'none' || (t.mode === 'part' && off >= t.planned);
            trNew[tid] = none ? { present: false, periods: 0, planned: t.planned, note: t.note || '' } : { present: true, periods: t.planned - off, planned: t.planned, note: t.note || '' };
          }
          const old = await fresh('attendance', `${cls.id}_${sel}`, docs.find((d) => d.date === sel));
          const records = { ...((old && old.records) || {}) };
          roster().forEach((s) => { records[s.id] = !!marks[s.id]; });
          const data = { classId: cls.id, teacherId: cls.teacherId || '', teacherIds: U.classTeachers(cls), date: sel, records, updatedBy: App.me.name };
          const id = `${cls.id}_${sel}`;
          await DB.save('attendance', id, data, true);
          docs = docs.filter((d) => d.date !== sel).concat([{ id, ...data }]);
          if (teacherIds().length) {
            const oldT = await fresh('teacherAttendance', `${cls.id}_${sel}`, tDocs.find((d) => d.date === sel));
            const tr = { ...((oldT && oldT.records) || {}), ...trNew };
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
    if (params.class !== undefined) st.classId = params.class;
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
        <div class="card toolbar">${monthNav(st.month, minMonth(App.classes))}
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
    const exportDialog = () => {
      const cl = classes.filter((c) => !st.classId || c.id === st.classId);
      const m = U.modal({
        title: 'Xuất học phí ra Excel', okText: 'Tải file Excel',
        body: `${U.periodHtml({ month: st.month })}
          <div class="hint">Học sinh vào học giữa kỳ chỉ tính từ ngày bắt đầu học; nhiều tháng thì cộng dồn từng tháng.</div>
          <label class="f" style="margin-top:12px">Ghi kèm</label>
          <div class="row"><label class="ck"><input type="checkbox" id="xn" checked> Tên lớp</label><label class="ck"><input type="checkbox" id="xc" checked> Mã lớp</label></div>
          <div class="small muted" style="margin-top:8px">Phạm vi: ${st.classId ? 'lớp đang chọn' : 'tất cả các lớp'}</div>`,
        onOk: async (w) => {
          const per = U.periodGet(w.querySelector('.period'), cl);
          const pays = await DB.q('payments');
          const rows = U.tuitionPeriod({ classes: cl, students, attendance, payments: pays, settings: App.settings, from: per.from, to: per.to });
          if (!rows.length) throw new Error('Không có dữ liệu học phí trong kỳ này.');
          const vnKey = (r) => { const x = r.student.name.trim().split(/\s+/); return x[x.length - 1] + ' ' + r.student.name; };
          rows.sort((a, b) => a.cls.grade - b.cls.grade || a.cls.code.localeCompare(b.cls.code) || vnKey(a).localeCompare(vnKey(b), 'vi'));
          await X.exportTuition(rows, per.month || per.from.slice(0, 7), App.settings, { label: per.label, file: `Hoc_phi_${per.file}.xlsx`, showName: w.querySelector('#xn').checked, showCode: w.querySelector('#xc').checked });
        },
      });
      U.periodBind(m.el.querySelector('.period'));
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
      if (t.closest('#exp')) exportDialog();
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
    const rateOf = (c, tid) => { const t = App.teachers.find((x) => x.id === tid) || {}; return Number(U.roleOf(c, tid) === 'main' ? t.rateMain : t.rateAssistant) || 0; };
    const offList = () => tAtt.filter((d) => String(d.date).slice(0, 7) === st.month).flatMap((d) => {
      const c = App.classById(d.classId);
      if (!c) return [];
      return Object.entries(d.records || {}).filter(([tid]) => admin || tid === App.me.uid).map(([tid, rec]) => {
        const planned = rec.planned != null ? Number(rec.planned) : Number(U.slotFor(c, d.date).periods) || Number(c.periods) || 0;
        const off = Math.max(0, planned - (rec.present ? Number(rec.periods) || 0 : 0));
        return off > 0 ? { date: d.date, c, tid, planned, off, none: !rec.present, note: rec.note || '', rate: rateOf(c, tid) } : null;
      }).filter(Boolean);
    }).sort((a, b) => b.date.localeCompare(a.date));
    const render = () => {
      const rows = compute();
      const total = rows.reduce((s, r) => s + r.amount, 0), paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
      const norate = rows.filter((r) => Object.values(r.lines).some((l) => !l.rate && l.sessions));
      const miss = rows.filter((r) => r.missing);
      const lines = rows.flatMap((r) => Object.values(r.lines).map((l) => ({ r, l })));
      root.innerHTML = `${head('Công & lương giáo viên', 'Tiền giáo viên = số tiết đã dạy × đơn giá mỗi tiết. Giáo viên nghỉ cả buổi hoặc nghỉ một số tiết đều bị trừ tương ứng, ghi nhận ở phần "Chấm công giáo viên theo ngày" bên dưới.',
        `${admin ? `<button class="btn ghost" id="tgrid">${icon('download')} Tải mẫu chấm công</button><button class="btn ghost" id="impg">${icon('upload')} Nhập chấm công từ Excel</button><input type="file" id="gfile" accept=".xlsx,.xls" class="hidden">` : ''}<button class="btn ghost" id="exp" ${rows.length ? '' : 'disabled'}>${icon('download')} Xuất Excel</button>`)}
        <div class="card toolbar">${monthNav(st.month, minMonth(App.classes))}<span class="muted grow">${icon('info', 15)} 1 tiết = ${esc(App.settings.periodMinutes)} phút. Số tiết mỗi buổi chọn khi điểm danh giáo viên.</span></div>
        <div class="alert" style="margin-bottom:16px">${icon('info', 15)} Chấm công giáo viên (dạy đủ, nghỉ cả buổi, nghỉ một số tiết) thực hiện trong trang của từng lớp: <b>Lớp học → chọn lớp → Điểm danh</b>. Bảng dưới đây tự tổng hợp từ dữ liệu đó.</div>
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
        ${offList().length ? `<div class="card mt"><div class="card-h"><h3>Các buổi giáo viên nghỉ trong tháng</h3><span class="small muted">Tiền trừ = số tiết nghỉ × đơn giá tiết</span></div><div class="table-wrap"><table class="t"><thead><tr><th>Ngày</th><th>Lớp</th><th>Giáo viên</th><th>Loại nghỉ</th><th class="center">Tiết nghỉ</th><th class="right">Tiền trừ</th><th>Lý do</th></tr></thead><tbody>
          ${offList().map((o) => `<tr><td class="nowrap">${U.fmtDate(o.date)}</td><td><span class="badge blue">${esc(o.c.name)}</span></td><td class="name">${esc(App.teacherName(o.tid))}</td><td>${o.none ? '<span class="badge err">Nghỉ cả buổi</span>' : '<span class="badge warn">Nghỉ một số tiết</span>'}</td><td class="center">${o.off}/${o.planned}</td><td class="right mono">${o.rate ? '-' + money(o.off * o.rate) : '-'}</td><td class="small">${esc(o.note)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
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
            const old = await fresh('teacherAttendance', id, tAtt.find((x) => x.id === id));
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
    root.onchange = async (e) => {
      if (e.target.id !== 'gfile') return;
      const f = e.target.files[0]; e.target.value = '';
      if (f) { try { await importGrid(f); } catch (er) { U.toast(er.message, 'err'); } }
    };
    root.onclick = async (e) => {
      const t = e.target;
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
    root.innerHTML = `${head('Giáo viên', 'Tạo tài khoản giáo viên, mở hồ sơ để phân công lớp (dạy chính / trợ giảng) và điểm danh nhanh theo ngày, theo tuần.', `<button class="btn" id="add">${icon('plus')} Thêm giáo viên</button>`)}
      <div class="card"><div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>Giáo viên</th><th>Email đăng nhập</th><th>Số điện thoại</th><th>Lớp phụ trách</th><th class="right">Đơn giá/tiết</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr><td class="name"><div class="row" style="flex-wrap:nowrap"><div class="avatar">${esc(U.initials(t.name))}</div><a href="#/staff/${t.id}">${esc(t.name)}</a></div></td><td>${esc(t.email)}</td><td class="mono">${esc(t.phone || '')}</td>
        <td>${App.classes.filter((c) => U.classTeachers(c).includes(t.id)).map((c) => `<span class="badge ${c.teacherId === t.id ? 'blue' : ''}" title="${U.roleName(U.roleOf(c, t.id))}">${esc(c.name)}${c.teacherId === t.id ? '' : ' (TG)'}</span>`).join(' ') || '<span class="muted">Chưa có</span>'}</td>
        <td class="right small mono">Chính: ${money(t.rateMain)}<br>Trợ giảng: ${money(t.rateAssistant)}</td>
        <td>${t.active === false ? '<span class="badge err">Đã khóa</span>' : '<span class="badge ok">Hoạt động</span>'}</td>
        <td class="nowrap right"><a class="btn sm soft" href="#/staff/${t.id}">${icon('classes', 15)} Phân công & chấm công</a> <button class="icon-btn" data-edit="${t.id}" title="Sửa">${icon('edit')}</button><button class="icon-btn" data-reset="${t.id}" title="Gửi email đặt lại mật khẩu">${icon('key')}</button></td></tr>`).join('')}
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
   *  GIÁO VIÊN: phân công lớp + điểm danh nhanh theo ngày / theo tuần
   * =================================================================== */
  const setClassTeachers = async (c, patch) => {
    const next = { ...c, ...patch };
    next.teacherIds = U.classTeachers(next);
    await DB.save('classes', c.id, { ...patch, teacherIds: next.teacherIds });
    if (U.classTeachers(c).join() !== next.teacherIds.join()) {
      for (const col of ['students', 'attendance', 'assessments', 'payments', 'teacherAttendance']) {
        const list = await DB.list(col, [['classId', '==', c.id]]);
        await DB.updateMany(col, list.map((x) => x.id), { teacherId: next.teacherId || '', teacherIds: next.teacherIds });
      }
    }
    await App.refreshClasses();
  };

  Views.staff = async (root, params = {}) => {
    const admin = DB.isAdmin();
    if (!params.id && admin) return Views.teachers(root, params);
    const tid = params.id || App.me.uid;
    if (!admin && tid !== App.me.uid) { root.innerHTML = `<div class="card">${empty('teachers', 'Bạn chỉ xem được hồ sơ của chính mình', '')}</div>`; return; }
    const teacher = App.teachers.find((x) => x.id === tid);
    if (!teacher) { root.innerHTML = `${head('Không tìm thấy giáo viên')}<div class="card">${empty('teachers', 'Giáo viên không tồn tại', '<a href="#/staff">Quay lại danh sách</a>')}</div>`; return; }
    const st = (App.staffState = App.staffState || { mode: 'month', ref: U.today(), month: U.today().slice(0, 7) });
    let tAtt = [], cells = {};
    const today = U.today();
    const mine = () => App.classes.filter((c) => U.classTeachers(c).includes(tid) && c.status !== 'closed');
    const loadAtt = async () => { tAtt = await DB.q('teacherAttendance'); };

    const period = () => {
      if (st.mode === 'day') return [st.ref];
      if (st.mode === 'month') { const [from, to] = U.monthRange(st.ref.slice(0, 7)); const out = []; for (let d = U.parse(from); U.ymd(d) <= to; d.setDate(d.getDate() + 1)) out.push(U.ymd(d)); return out; }
      const d = U.parse(st.ref); const dow = (d.getDay() + 6) % 7;
      return Array.from({ length: 7 }, (_, i) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + i); return U.ymd(x); });
    };
    const buildCells = () => {
      cells = {};
      const dates = period();
      const rows = mine().map((c) => {
        const row = { c, cols: dates.map((d) => {
          if (!U.sessions(c, d, d).length) return null;
          const planned = Number(U.slotFor(c, d).periods) || Number(c.periods) || 0;
          const doc = tAtt.find((x) => x.classId === c.id && x.date === d);
          const rec = doc && doc.records && doc.records[tid];
          const taught = rec && rec.present ? Number(rec.periods) || 0 : 0;
          const orig = !rec ? 'new' : !rec.present ? 'none' : taught < planned ? 'part' : 'full';
          const cell = { key: `${c.id}|${d}`, c, d, planned, orig, taught, note: (rec && rec.note) || '', on: orig !== 'none', future: d > today };
          cells[cell.key] = cell;
          return cell;
        }) };
        return row;
      }).filter((r) => r.cols.some(Boolean));
      return { dates, rows };
    };

    const periodLabel = (dates) => (st.mode === 'day' ? `${U.dayName(U.parse(dates[0]).getDay())}, ${U.fmtDate(dates[0])}` : st.mode === 'month' ? U.monthLabel(st.ref.slice(0, 7)) : `Tuần ${U.fmtDate(dates[0])} - ${U.fmtDate(dates[6])}`);
    const classesTable = () => {
      const own = mine();
      const assignable = App.openClasses().filter((c) => !U.classTeachers(c).includes(tid));
      return `<div class="card"><div class="card-h"><h3>Lớp được phân công</h3><span class="small muted">${own.length} lớp</span></div>
        <div class="table-wrap">${own.length ? `<table class="t"><thead><tr><th>Lớp</th><th>Lịch học</th><th>Vai trò</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
          ${own.map((c) => `<tr><td class="name"><a href="#/classes/${c.id}?tab=attendance">${esc(c.name)}</a><div class="small muted">${esc(c.code)}</div></td><td class="small">${esc(U.scheduleText(c))}</td>
            <td>${admin ? `<select class="select" data-role="${c.id}" style="min-width:150px"><option value="main" ${c.teacherId === tid ? 'selected' : ''}>Giáo viên chính</option><option value="assistant" ${c.teacherId === tid ? '' : 'selected'}>Trợ giảng</option></select>` : `<span class="badge ${c.teacherId === tid ? 'blue' : ''}">${U.roleName(U.roleOf(c, tid))}</span>`}</td>
            ${admin ? `<td class="right"><button class="icon-btn danger" data-unassign="${c.id}" title="Bỏ phân công lớp này">${icon('trash')}</button></td>` : ''}</tr>`).join('')}</tbody></table>` : empty('classes', 'Chưa được phân công lớp nào', admin ? 'Chọn lớp bên dưới để phân công.' : 'Quản trị viên chưa phân công lớp cho bạn.')}</div>
        ${admin ? `<div class="card-b" style="border-top:1px solid var(--line)"><label class="f">Phân công thêm vào lớp đã có</label>
          <div class="row"><select class="select" id="addcls" style="min-width:240px;flex:1">${assignable.length ? assignable.map((c) => `<option value="${c.id}">${esc(c.name)} · ${esc(c.code)} · ${esc(U.scheduleText(c))}</option>`).join('') : '<option value="">(Đã phân công vào mọi lớp đang mở)</option>'}</select>
          <select class="select" id="addrole" style="width:auto"><option value="main">Dạy chính</option><option value="assistant">Trợ giảng</option></select>
          <button class="btn" id="addbtn" ${assignable.length ? '' : 'disabled'}>${icon('plus')} Phân công</button></div></div>` : ''}</div>`;
    };
    const firstDate = () => mine().map((c) => c.startDate).filter(Boolean).sort()[0] || '';
    const prevOff = () => { const f = firstDate(); return !!f && period()[0] <= f; };
    const quickCard = () => {
      const { dates, rows } = buildCells();
      const usedDates = dates.filter((d, i) => rows.some((r) => r.cols[i]));
      const dayBtns = usedDates.map((d) => `<button type="button" class="colbtn" data-col="${d}" title="Chọn / bỏ cả ngày này cho mọi lớp">${U.dayShort(U.parse(d).getDay())} <small>${U.shortDate(d)}</small></button>`).join('');
      const cards = rows.map((r) => {
        const list = r.cols.filter(Boolean);
        return `<div class="qclass"><div class="qc-h"><div class="grow"><b>${esc(r.c.name)}</b> <span class="badge ${U.roleOf(r.c, tid) === 'main' ? 'blue' : ''}">${U.roleName(U.roleOf(r.c, tid))}</span> <span class="small muted">${esc(U.scheduleText(r.c))}</span></div>
            <span class="small" data-cnt="${r.c.id}"></span><button type="button" class="btn sm ghost" data-row="${r.c.id}" title="Chọn / bỏ tất cả các ngày của lớp này">Chọn / bỏ cả lớp</button></div>
          <div class="qchips">${list.map((x) => `<label class="qchip ${x.future ? 'future' : ''}" title="${x.future ? 'Chưa đến ngày dạy' : esc(U.timeText(U.slotFor(x.c, x.d))) + ' · ' + x.planned + ' tiết'}"><input type="checkbox" data-cell="${x.key}" ${x.on ? 'checked' : ''} ${x.future ? 'disabled' : ''}><span class="qc"><b>${U.dayShort(U.parse(x.d).getDay())}</b><small>${U.shortDate(x.d)}</small>${x.orig === 'part' ? `<i title="Đã nghỉ một phần: ${x.planned - x.taught} tiết">½</i>` : ''}${x.orig === 'new' ? '' : '<em></em>'}</span></label>`).join('')}</div></div>`;
      }).join('');
      return `<div class="card mt"><div class="card-h"><h3>Điểm danh nhanh</h3><div class="grow"></div>
          <div class="seg"><button class="${st.mode === 'month' ? 'on' : ''}" data-mode="month">Theo tháng</button><button class="${st.mode === 'week' ? 'on' : ''}" data-mode="week">Theo tuần</button><button class="${st.mode === 'day' ? 'on' : ''}" data-mode="day">Theo ngày</button></div></div>
        <div class="toolbar" style="margin:0;border-bottom:1px solid var(--line);border-radius:0">
          <button class="icon-btn" id="qprev" ${prevOff() ? 'disabled' : ''}>${icon('left')}</button>
          ${st.mode === 'day' ? `<input class="input" type="date" id="qref" value="${esc(st.ref)}" min="${esc(firstDate())}" style="width:auto">` : `<b>${esc(periodLabel(dates))}</b>`}
          <button class="icon-btn" id="qnext">${icon('right')}</button><button class="btn sm ghost" id="qtoday">${st.mode === 'day' ? 'Hôm nay' : st.mode === 'week' ? 'Tuần này' : 'Tháng này'}</button>
          <div class="grow"></div><button class="btn sm soft" id="qall">${icon('check', 15)} Chọn tất cả (lên lớp)</button><button class="btn sm ghost" id="qnone">Bỏ chọn tất cả (nghỉ)</button></div>
        <div class="card-b">${rows.length ? `${usedDates.length > 1 ? `<div class="daystrip"><span class="small muted">Chọn / bỏ nhanh một ngày cho tất cả lớp:</span>${dayBtns}</div>` : ''}${cards}
          <div class="hint">Mỗi lớp hiện các ngày lớp đó có buổi học. <b>Ô xanh = giáo viên đã lên lớp</b>, <b>ô trắng = nghỉ cả buổi</b> (bị trừ lương). Chấm xanh nhỏ = đã lưu trước đó, "½" = đã nghỉ một số tiết (sửa chi tiết trong tab Điểm danh của lớp). Ngày chưa tới không chọn được.</div>
          <div class="row mt"><button class="btn ok" id="qsave">${icon('check')} Lưu điểm danh giáo viên</button></div>` : empty('calendar', 'Không có buổi dạy nào trong khoảng này', 'Giáo viên chưa được phân công lớp, hoặc các lớp không có lịch học ở thời gian đã chọn.')}</div></div>`;
    };
    const paySummary = () => {
      const rows = U.payrollRows({ classes: App.classes, tAtt, teachers: App.teachers, month: st.month }).filter((r) => r.teacher.id === tid);
      const r = rows[0] || { sessions: 0, absent: 0, partial: 0, periods: 0, planned: 0, off: 0, amount: 0, deduct: 0, gross: 0 };
      return `<div class="card mt"><div class="card-h"><h3>Công và lương ${U.monthLabel(st.month).toLowerCase()}</h3><div class="grow"></div>${monthNav(st.month, minMonth(App.classes))}</div>
        <div class="card-b"><div class="stats" style="margin:0">
          <div class="card stat"><div class="ico">${icon('wallet', 24)}</div><div><b>${money(r.amount)}</b><span>Thực nhận</span></div></div>
          <div class="card stat"><div class="ico g">${icon('calendar', 24)}</div><div><b>${r.periods}/${r.planned}</b><span>Tiết đã dạy / theo lịch</span></div></div>
          <div class="card stat"><div class="ico o">${icon('clock', 24)}</div><div><b>${r.absent}</b><span>Buổi nghỉ cả buổi (+${r.partial} nghỉ một phần)</span></div></div>
          <div class="card stat"><div class="ico s">${icon('attendance', 24)}</div><div><b>${money(r.deduct)}</b><span>Trừ do nghỉ (${r.off} tiết)</span></div></div></div>
          <div class="small muted" style="margin-top:10px">Đơn giá: ${money(teacher.rateMain)}/tiết khi dạy chính, ${money(teacher.rateAssistant)}/tiết khi trợ giảng.${admin ? ' <a href="#/payroll">Xem bảng lương tất cả giáo viên</a>' : ''}</div></div></div>`;
    };
    const render = () => {
      root.innerHTML = `<div class="page-head"><div>${admin ? `<a href="#/staff" class="small">${icon('back', 14)} Danh sách giáo viên</a>` : ''}
          <h1 style="margin-top:6px">${esc(teacher.name)}</h1><p>${esc(teacher.email || '')}${teacher.phone ? ' · ' + esc(teacher.phone) : ''}</p></div></div>
        ${classesTable()}${quickCard()}${paySummary()}`;
      counts();
    };

    const toggleCells = (pred, on) => { Object.values(cells).forEach((x) => { if (!x.future && pred(x)) x.on = on; }); };
    const sync = () => { root.querySelectorAll('[data-cell]').forEach((i) => { i.checked = cells[i.dataset.cell].on; }); counts(); };
    const flip = (pred) => { const list = Object.values(cells).filter((x) => !x.future && pred(x)); if (!list.length) return; const on = list.some((x) => !x.on); list.forEach((x) => { x.on = on; }); sync(); };
    const shift = (n) => {
      if (n < 0 && prevOff()) return;
      if (st.mode === 'month') { st.ref = U.addMonth(st.ref.slice(0, 7), n) + '-01'; if (st.ref.slice(0, 7) === today.slice(0, 7)) st.ref = today; } else { const d = U.parse(st.ref); d.setDate(d.getDate() + (st.mode === 'day' ? n : 7 * n)); st.ref = U.ymd(d); }
      render();
    };
    const counts = () => {
      root.querySelectorAll('[data-cnt]').forEach((el) => {
        const list = Object.values(cells).filter((x) => x.c.id === el.dataset.cnt && !x.future);
        const on = list.filter((x) => x.on).length;
        el.textContent = list.length ? `Lên lớp ${on}/${list.length} buổi${list.length - on ? ' · nghỉ ' + (list.length - on) : ''}` : '';
        el.className = 'small ' + (list.length - on ? 'qc-off' : 'muted');
      });
    };

    root.onchange = async (e) => {
      const t = e.target;
      if (t.dataset.cell) { cells[t.dataset.cell].on = t.checked; counts(); return; }
      if (t.id === 'qref') { if (t.value) { st.ref = t.value; render(); } return; }
      if (t.dataset.role && admin) {
        const c = App.classById(t.dataset.role);
        const role = t.value;
        const patch = role === 'main' ? { teacherId: tid, assistantId: c.assistantId === tid ? '' : c.assistantId } : { assistantId: tid, teacherId: c.teacherId === tid ? '' : c.teacherId };
        const other = role === 'main' ? c.teacherId : c.assistantId;
        if (other && other !== tid && !(await U.confirm(`${esc(App.teacherName(other))} đang là ${role === 'main' ? 'giáo viên chính' : 'trợ giảng'} của ${esc(c.name)}. Thay bằng ${esc(teacher.name)}?`, 'Thay thế', false))) { render(); return; }
        try { await setClassTeachers(c, patch); U.toast('Đã cập nhật vai trò', 'ok'); } catch (er) { U.toast(er.message, 'err'); }
        render();
      }
    };
    root.onclick = async (e) => {
      const t = e.target;
      const col = t.closest('[data-col]'), row = t.closest('[data-row]'), mode = t.closest('[data-mode]');
      if (mode) { st.mode = mode.dataset.mode; render(); return; }
      if (col) return flip((x) => x.d === col.dataset.col);
      if (row) return flip((x) => x.c.id === row.dataset.row);
      if (t.closest('#qprev')) return shift(-1);
      if (t.closest('#qnext')) return shift(1);
      if (t.closest('#qtoday')) { st.ref = today; render(); return; }
      if (t.closest('#qall')) { toggleCells(() => true, true); sync(); return; }
      if (t.closest('#qnone')) { toggleCells(() => true, false); sync(); return; }
      if (t.closest('[data-mprev]')) { st.month = U.addMonth(st.month, -1); render(); return; }
      if (t.closest('[data-mnext]')) { st.month = U.addMonth(st.month, 1); render(); return; }
      const un = t.closest('[data-unassign]');
      if (un && admin) {
        const c = App.classById(un.dataset.unassign);
        if (!(await U.confirm(`Bỏ phân công <b>${esc(teacher.name)}</b> khỏi lớp <b>${esc(c.name)}</b>? Dữ liệu chấm công cũ vẫn được giữ.`, 'Bỏ phân công'))) return;
        try { await setClassTeachers(c, c.teacherId === tid ? { teacherId: '' } : { assistantId: '' }); U.toast('Đã bỏ phân công', 'ok'); } catch (er) { U.toast(er.message, 'err'); }
        render(); return;
      }
      if (t.closest('#addbtn') && admin) {
        const c = App.classById(root.querySelector('#addcls').value), role = root.querySelector('#addrole').value;
        if (!c) return;
        const other = role === 'main' ? c.teacherId : c.assistantId;
        if (other && !(await U.confirm(`${esc(App.teacherName(other))} đang là ${role === 'main' ? 'giáo viên chính' : 'trợ giảng'} của ${esc(c.name)}. Thay bằng ${esc(teacher.name)}?`, 'Thay thế', false))) return;
        try { await setClassTeachers(c, role === 'main' ? { teacherId: tid } : { assistantId: tid }); U.toast(`Đã phân công ${teacher.name} vào ${c.name}`, 'ok'); } catch (er) { U.toast(er.message, 'err'); }
        render(); return;
      }
      if (t.closest('#qsave')) {
        const btn = t.closest('#qsave'); btn.disabled = true;
        try {
          const touched = {};
          let n = 0;
          Object.values(cells).forEach((x) => {
            if (x.future) return;
            const changed = x.orig === 'new' ? true : x.orig === 'none' ? x.on : (x.orig === 'part' ? !x.on : !x.on);
            if (!changed) return;
            const g = (touched[`${x.c.id}_${x.d}`] = touched[`${x.c.id}_${x.d}`] || { c: x.c, d: x.d, items: [] });
            g.items.push(x); n++;
          });
          if (!n) { U.toast('Không có thay đổi nào để lưu.', 'ok'); btn.disabled = false; return; }
          for (const [id, g] of Object.entries(touched)) {
            const old = await fresh('teacherAttendance', id, tAtt.find((z) => z.id === id));
            const records = { ...((old && old.records) || {}) };
            const prevNote = (records[tid] && records[tid].note) || '';
            g.items.forEach((x) => { records[tid] = x.on ? { present: true, periods: x.planned, planned: x.planned, note: '' } : { present: false, periods: 0, planned: x.planned, note: prevNote }; });
            const data = { classId: g.c.id, teacherId: g.c.teacherId || '', teacherIds: U.classTeachers(g.c), date: g.d, records, updatedBy: App.me.name };
            await DB.save('teacherAttendance', id, data, true);
            tAtt = tAtt.filter((z) => z.id !== id).concat([{ id, ...data }]);
          }
          U.toast(`Đã lưu điểm danh giáo viên (${n} buổi)`, 'ok');
          render();
        } catch (er) { U.toast(er.message, 'err'); btn.disabled = false; }
      }
    };

    root.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';
    await loadAtt(); render();
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
          <div><label class="f">Tên trung tâm (in trên phiếu thu, phiếu hoàn thành)</label><input class="input" id="cn" value="${esc(s.centerName)}"></div>
          <div><label class="f">Center name (English, in trên phiếu hoàn thành)</label><input class="input" id="cne" value="${esc(s.centerNameEn || U.centerEn())}"></div>
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
        centerNameEn: root.querySelector('#cne').value.trim() || U.DEFAULT_SETTINGS.centerNameEn,
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
