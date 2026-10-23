/* Tiện ích dùng chung: định dạng, ngày tháng, biểu tượng, hộp thoại, tính học phí */
(function () {
  const U = (window.U = {});

  U.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.money = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + ' đ';
  U.pad = (n) => String(n).padStart(2, '0');
  U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  U.norm = (s) =>
    String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---------- Ngày tháng (chuỗi YYYY-MM-DD) ---------- */
  U.ymd = (d) => `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  U.parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  U.today = () => U.ymd(new Date());
  U.fmtDate = (s) => (s ? s.split('-').reverse().join('/') : '');
  U.shortDate = (s) => (s ? s.slice(8) + '/' + s.slice(5, 7) : '');
  U.dayName = (d) => (d === 0 ? 'CN' : 'Thứ ' + (d + 1));
  U.dayShort = (d) => (d === 0 ? 'CN' : 'T' + (d + 1));
  U.monthLabel = (m) => 'Tháng ' + Number(m.slice(5)) + '/' + m.slice(0, 4);
  U.addMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; };
  U.monthRange = (m) => { const [y, mo] = m.split('-').map(Number); return [m + '-01', m + '-' + U.pad(new Date(y, mo, 0).getDate())]; };
  U.nowText = () => { const d = new Date(); return `${U.pad(d.getHours())}:${U.pad(d.getMinutes())} ${U.fmtDate(U.ymd(d))}`; };

  /* Các buổi học của lớp trong khoảng ngày [from, to] theo lịch (thứ trong tuần) */
  U.sessions = (cls, from, to) => {
    const lo = [from, cls.startDate].filter(Boolean).sort().pop();
    const hi = [to, cls.endDate].filter(Boolean).sort()[0];
    const out = [];
    if (!lo || !hi || lo > hi) return out;
    const days = cls.days || [];
    for (let d = U.parse(lo); U.ymd(d) <= hi; d.setDate(d.getDate() + 1)) {
      if (days.includes(d.getDay())) out.push(U.ymd(d));
    }
    return out;
  };
  /* Lịch học: mỗi ngày trong tuần có giờ riêng (slots). Lớp cũ chỉ có days + start/end thì tự quy đổi. */
  U.slots = (cls) =>
    (Array.isArray(cls.slots) && cls.slots.length ? cls.slots : (cls.days || []).map((d) => ({ day: d, start: cls.start, end: cls.end, periods: cls.periods })))
      .slice().sort((a, b) => (a.day || 7) - (b.day || 7));
  U.slotFor = (cls, date) => U.slots(cls).find((s) => s.day === U.parse(date).getDay()) || { day: U.parse(date).getDay(), start: cls.start, end: cls.end, periods: cls.periods };
  U.timeText = (s) => `${s.start || ''} - ${s.end || ''}`;
  U.scheduleText = (cls) => {
    const sl = U.slots(cls);
    if (sl.length && sl.every((s) => s.start === sl[0].start && s.end === sl[0].end)) return `${sl.map((s) => U.dayName(s.day)).join(', ')} · ${U.timeText(sl[0])}`;
    return sl.map((s) => `${U.dayName(s.day)} ${U.timeText(s)}`).join(' · ');
  };
  U.periodsText = (cls) => [...new Set(U.slots(cls).map((s) => s.periods).filter((p) => p !== undefined && p !== null && p !== ''))].join(' / ');

  /* Sắp xếp tên người Việt theo tên gọi (từ cuối) */
  U.sortVN = (arr, key = (x) => x.name) =>
    arr.slice().sort((a, b) => {
      const wa = key(a).trim().split(/\s+/), wb = key(b).trim().split(/\s+/);
      return wa[wa.length - 1].localeCompare(wb[wb.length - 1], 'vi') || key(a).localeCompare(key(b), 'vi');
    });

  U.maskId = (s) => (s && s.length > 6 ? s.slice(0, 3) + '•'.repeat(s.length - 6) + s.slice(-3) : s ? '•••' : '');
  U.initials = (name) => { const w = String(name || '?').trim().split(/\s+/); return (w[w.length - 1][0] || '?').toUpperCase(); };

  /* ---------- Học phí ---------- */
  U.DEFAULT_SETTINGS = { centerName: 'Trung tâm ngoại ngữ Sky', defaultFee: 400000, deductFrom: 2, deductAmount: 50000, periodMinutes: 45 };

  /* ---------- Giáo viên của lớp & tiết dạy ---------- */
  U.classTeachers = (cls) => [cls.teacherId, cls.assistantId].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  U.suggestPeriods = (start, end, periodMinutes) => {
    const n = (toMin(end) - toMin(start)) / (Number(periodMinutes) || 45);
    return n > 0 ? Math.max(0.5, Math.round(n * 2) / 2) : 1;
  };
  U.roleOf = (cls, teacherId) => (cls.teacherId === teacherId ? 'main' : 'assistant');
  U.roleName = (r) => (r === 'main' ? 'Giáo viên chính' : 'Trợ giảng');

  /* Tính công & lương giáo viên trong tháng từ bảng chấm công (teacherAttendance) */
  U.payrollRows = ({ classes, tAtt, teachers, month }) => {
    const byT = {};
    const today = U.today();
    const [from, to] = U.monthRange(month);
    for (const cls of classes) {
      const docs = tAtt.filter((d) => d.classId === cls.id && String(d.date).slice(0, 7) === month);
      const recorded = new Set(docs.map((d) => d.date));
      const missing = U.sessions(cls, from, to).filter((d) => d <= today && !recorded.has(d)).length;
      for (const d of docs) {
        for (const [tid, rec] of Object.entries(d.records || {})) {
          const t = teachers.find((x) => x.id === tid) || { id: tid, name: '(đã xóa)' };
          const role = U.roleOf(cls, tid);
          const rate = Number(role === 'main' ? t.rateMain : t.rateAssistant) || 0;
          const r = (byT[tid] = byT[tid] || { teacher: t, sessions: 0, absent: 0, periods: 0, amount: 0, lines: {}, missing: 0 });
          const key = cls.id + '|' + role;
          const ln = (r.lines[key] = r.lines[key] || { cls, role, rate, sessions: 0, periods: 0, amount: 0 });
          if (rec && rec.present) {
            const p = Number(rec.periods) || 0;
            r.sessions++; r.periods += p; r.amount += p * rate;
            ln.sessions++; ln.periods += p; ln.amount += p * rate;
          } else r.absent++;
        }
      }
      for (const tid of U.classTeachers(cls)) {
        const t = teachers.find((x) => x.id === tid);
        if (!t) continue;
        const r = (byT[tid] = byT[tid] || { teacher: t, sessions: 0, absent: 0, periods: 0, amount: 0, lines: {}, missing: 0 });
        r.missing += missing;
      }
    }
    return Object.values(byT).sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, 'vi'));
  };
  U.deductText = (s) =>
    s.deductAmount > 0
      ? `Vắng từ ${s.deductFrom} buổi trở lên: trừ ${U.money(s.deductAmount)} cho mỗi buổi vắng`
      : 'Không trừ học phí khi vắng';

  /* Hai cách tính học phí (chọn theo từng lớp):
   *  - 'absence': học phí lớp trừ tiền theo số buổi nghỉ (nghỉ từ N buổi mới trừ)
   *  - 'attend' : tính theo số buổi đã đi học × đơn giá buổi, tối đa bằng học phí tháng của lớp (mức trần) */
  U.calcFee = (cls, settings, present, absent, ratio = 1) => {
    // ratio < 1: học sinh vào học giữa tháng, học phí cố định chỉ tính theo số buổi có theo học
    const fee = Number(cls.fee) || 0;
    const base = cls.feeMode !== 'attend' && ratio < 1 ? Math.round((fee * ratio) / 1000) * 1000 : fee;
    if (cls.feeMode === 'attend') {
      const charge = Math.min(base, present * (Number(cls.sessionRate) || 0));
      return { base, deduct: base - charge, total: charge };
    }
    const from1 = Math.max(1, Number(settings.deductFrom) || 1);
    const deduct = settings.deductAmount > 0 && absent >= from1 ? Math.min(base, absent * settings.deductAmount) : 0;
    return { base, deduct, total: Math.max(0, base - deduct) };
  };
  U.feeRuleText = (cls, settings) =>
    cls && cls.feeMode === 'attend'
      ? `Tính theo buổi đã học: ${U.money(cls.sessionRate)}/buổi, tối đa ${U.money(cls.fee)}/tháng`
      : U.deductText(settings);

  /* Tính học phí tháng cho các lớp. Học sinh nghỉ chỉ hiện nếu còn dữ liệu điểm danh trong tháng. */
  U.tuitionRows = ({ classes, students, attendance, payments, settings, month }) => {
    const rows = [];
    const [from, to] = U.monthRange(month);
    const today = U.today();
    for (const cls of classes) {
      const scheduled = U.sessions(cls, from, to);
      const docs = attendance.filter((a) => a.classId === cls.id && String(a.date).slice(0, 7) === month);
      const recorded = new Set(docs.map((d) => d.date));
      const missing = scheduled.filter((d) => d <= today && !recorded.has(d)).length;
      for (const st of students.filter((s) => s.classId === cls.id)) {
        const sd = st.startDate || '';
        if (sd && sd > to) continue; // chưa bắt đầu học trong tháng này
        const mine = sd ? scheduled.filter((d) => d >= sd) : scheduled; // các buổi học sinh có theo học
        const ratio = scheduled.length ? mine.length / scheduled.length : 1;
        const myDocs = sd ? docs.filter((d) => d.date >= sd) : docs;
        const has = myDocs.some((d) => d.records && st.id in d.records);
        if (st.status === 'inactive' && !has) continue;
        let present = 0, absent = 0;
        myDocs.forEach((d) => { const v = d.records && d.records[st.id]; if (v === true) present++; else if (v === false) absent++; });
        const { base, deduct, total: calc } = U.calcFee(cls, settings, present, absent, ratio);
        const pay = payments.find((p) => p.id === `${st.id}_${month}`);
        rows.push({
          student: st, cls, scheduled: mine.length, classScheduled: scheduled.length, ratio, recorded: docs.length, missing, present, absent,
          base: pay ? pay.base : base, deduct: pay ? pay.deduct : deduct, total: pay ? pay.amount : calc, calc,
          paid: !!(pay && pay.paid), pay,
        });
      }
    }
    return rows;
  };

  /* ---------- Biểu tượng ---------- */
  const IC = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    classes: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    students: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    attendance: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    teachers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  };
  U.icon = (name, size = 18) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`;

  /* ---------- Thông báo & hộp thoại ---------- */
  U.toast = (msg, type = '') => {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = (type === 'err' ? U.icon('x') : type === 'ok' ? U.icon('check') : U.icon('info')) + `<span>${U.esc(msg)}</span>`;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), type === 'err' ? 6000 : 3200);
  };

  U.modal = ({ title, body, okText = 'Lưu', cancelText = 'Hủy', onOk, wide = false, hideFooter = false, danger = false }) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h"><h3>${U.esc(title)}</h3><button class="icon-btn" data-x aria-label="Đóng">${U.icon('x')}</button></div>
      <div class="modal-b">${body}</div>
      ${hideFooter ? '' : `<div class="modal-f"><button class="btn ghost" data-x>${cancelText}</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${okText}</button></div>`}
    </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) close(); });
    const ok = wrap.querySelector('[data-ok]');
    if (ok) {
      ok.onclick = async () => {
        ok.disabled = true;
        try {
          const r = await onOk(wrap, close);
          if (r !== false) close();
        } catch (e) {
          console.error(e);
          U.toast(e.message || String(e), 'err');
        }
        ok.disabled = false;
      };
    }
    const first = wrap.querySelector('input:not([type=hidden]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { el: wrap, close };
  };

  U.confirm = (msg, okText = 'Xác nhận', danger = true) =>
    new Promise((resolve) => {
      let done = false;
      const m = U.modal({
        title: 'Xác nhận', body: `<p style="margin:0">${msg}</p>`, okText, danger,
        onOk: () => { done = true; resolve(true); },
      });
      m.el.addEventListener('click', (e) => { if (e.target.closest('[data-x]') && !done) { done = true; resolve(false); } });
    });

  U.download = (filename, text, mime = 'application/json') => {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  U.printHTML = (html) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument.open();
    f.contentDocument.write(html);
    f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300);
  };
})();
