/*
 * Mục "Báo cáo & hồ sơ" (quản trị): quyết định mở lớp, báo cáo gửi Sở GD&ĐT và bộ hồ sơ Excel phục vụ kiểm tra.
 * Văn bản hành chính trình bày theo thể thức Nghị định 30/2020/NĐ-CP (A4, lề trên/dưới 20mm, trái 30mm, phải 15mm, Times New Roman).
 */
(function () {
  const { esc, icon } = U;
  const KEY = 'sky_reports_opts_v1';
  const loadO = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const saveO = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* bỏ qua */ } };
  const dots = (n = 40) => '…'.repeat(n);
  const ymd3 = (d) => { const x = U.parse(d); return { d: x.getDate(), m: x.getMonth() + 1, y: x.getFullYear() }; };

  /* Thông tin pháp lý của trung tâm (lưu trong cài đặt chung) */
  const legal = () => {
    const s = App.settings || {}, last = String(s.centerName || '').trim().split(/\s+/).pop() || 'TT';
    return {
      name: s.centerName || U.DEFAULT_SETTINGS.centerName, address: s.centerAddress || '', phone: s.centerPhone || '', director: s.centerDirector || '',
      license: s.centerLicense || '', city: s.centerCity || '', authority: s.centerAuthority || '', abbr: s.centerAbbr || last.toUpperCase(),
      dept: s.centerDept || '',
    };
  };

  /* ---------------- thể thức văn bản hành chính ---------------- */
  const DOC_CSS = `
@page WordSection1{size:21cm 29.7cm;margin:2cm 1.5cm 2cm 3cm;mso-page-orientation:portrait}
@page{size:A4;margin:20mm 15mm 20mm 30mm}
div.WordSection1{page:WordSection1}
*{box-sizing:border-box}
body{font-family:"Times New Roman",Times,serif;font-size:14pt;line-height:1.35;color:#000;margin:0}
.doc{page-break-after:always}.doc:last-child{page-break-after:auto}
table.hd{width:100%;border-collapse:collapse;margin-bottom:8pt}
table.hd td{vertical-align:top;text-align:center;padding:0}
.org1{font-size:12pt;text-transform:uppercase}
.org2{font-weight:bold;font-size:12.5pt;text-transform:uppercase}
.qh{font-weight:bold;font-size:12.5pt;text-transform:uppercase}
.tn{font-weight:bold;font-size:13.5pt}
.ln{width:36%;border-top:1px solid #000;margin:2pt auto 0}
.ln.w{width:58%}
.so{margin-top:8pt;font-size:13.5pt}
.dd{font-style:italic;font-size:13.5pt;margin-top:8pt}
.type{text-align:center;font-weight:bold;font-size:14pt;margin-top:16pt;text-transform:uppercase}
.sub{text-align:center;font-weight:bold;font-size:14pt;margin:2pt 0 4pt}
.sub+.ln{width:22%;margin-bottom:14pt}
.who{text-align:center;font-weight:bold;font-size:14pt;margin:8pt 0 6pt;text-transform:uppercase}
.to{text-align:center;font-size:14pt;margin:4pt 0 10pt}
p{margin:0 0 6pt;text-align:justify;text-indent:1.27cm}
p.ci{font-style:italic}
p.n{text-indent:0}
p.art b{font-weight:bold}
.mid{text-align:center;font-weight:bold;font-size:14pt;margin:8pt 0 6pt;text-transform:uppercase}
table.dt{width:100%;border-collapse:collapse;margin:4pt 0 8pt;font-size:12.5pt;line-height:1.25}
.dt th,.dt td{border:1px solid #000;padding:3pt 5pt;vertical-align:top}
.dt th{text-align:center;font-weight:bold}
.dt td.c{text-align:center}
.dt td.r{text-align:right}
table.sg{width:100%;border-collapse:collapse;margin-top:12pt;page-break-inside:avoid}
table.sg td{vertical-align:top;font-size:12pt}
.nn{font-weight:bold;font-style:italic;font-size:12pt}
.rr{width:50%;text-align:center;font-weight:bold;font-size:14pt;text-transform:uppercase}
.rr i{font-weight:normal;font-size:12pt;text-transform:none}
`;
  const wrapDoc = (body) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Văn bản</title><style>${DOC_CSS}</style></head><body><div class="WordSection1">${body}</div></body></html>`;

  const header = (g, o) => {
    const t = ymd3(o.date);
    return `<table class="hd"><tr>
      <td style="width:42%">${g.authority ? `<div class="org1">${esc(g.authority)}</div>` : ''}<div class="org2">${esc(g.name)}</div><div class="ln"></div>
        <div class="so">Số: ${esc(o.number)}</div></td>
      <td style="width:58%"><div class="qh">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div class="tn">Độc lập - Tự do - Hạnh phúc</div><div class="ln w"></div>
        <div class="dd">${g.city ? esc(g.city) + ', ' : ''}ngày ${t.d} tháng ${t.m} năm ${t.y}</div></td></tr></table>`;
  };
  const signBlock = (g, o, recipients) => `<table class="sg"><tr>
    <td style="width:50%"><div class="nn">Nơi nhận:</div><div style="font-size:11pt;line-height:1.3">${recipients.map((r) => '- ' + esc(r) + ';').join('<br>')}</div></td>
    <td class="rr"><div>${esc(o.title || 'GIÁM ĐỐC')}</div><i>(Ký tên, đóng dấu)</i><div style="height:72pt"></div><div style="text-transform:none">${esc(g.director || dots(18))}</div></td></tr></table>`;

  /* ---------------- dữ liệu dùng chung ---------------- */
  const gradeOf = (v) => (v >= 8 ? 'Giỏi' : v >= 6.5 ? 'Khá' : v >= 5 ? 'Trung bình' : 'Yếu');
  const loadAll = async () => {
    const [students, attendance, assessments, payments] = await Promise.all([DB.q('students'), DB.q('attendance'), DB.q('assessments'), DB.q('payments')]);
    return { students, attendance, assessments, payments };
  };
  const mean = (a) => (a.length ? Math.round((a.reduce((p, c) => p + c, 0) / a.length) * 100) / 100 : '');
  const stat = (c, D, per) => {
    const list = D.students.filter((s) => s.classId === c.id && s.status !== 'inactive');
    const left = D.students.filter((s) => s.classId === c.id && s.status === 'inactive').length;
    const docs = D.attendance.filter((a) => a.classId === c.id && a.date >= per.from && a.date <= per.to);
    let present = 0, absent = 0;
    docs.forEach((d) => Object.values(d.records || {}).forEach((v) => { if (v === true) present++; else if (v === false) absent++; }));
    const tests = D.assessments.filter((a) => a.classId === c.id && a.date >= per.from && a.date <= per.to);
    const avgs = list.map((s) => mean(tests.map((a) => (a.scores && a.scores[s.id] !== undefined && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : null)).filter((x) => x !== null && !isNaN(x)))).filter((x) => x !== '');
    return { list, left, sessions: docs.length, present, absent, rate: present + absent ? Math.round((present / (present + absent)) * 1000) / 10 : '', avg: mean(avgs), avgs, tests: tests.length };
  };
  const tName = (id) => (id ? App.teacherName(id) : '');
  const sortCls = (arr) => arr.slice().sort((a, b) => (a.grade || 0) - (b.grade || 0) || String(a.code).localeCompare(String(b.code)));
  const listNames = (names) => (names.length > 1 ? names.slice(0, -1).join(', ') + ' và ' + names[names.length - 1] : names[0] || '');
  const slotLines = (c) => U.slots(c).map((s) => `${U.dayName(s.day)}: ${U.timeText(s)}${s.periods ? ` (${s.periods} tiết)` : ''}`);

  /* ---------------- Quyết định mở lớp ---------------- */
  const DEFAULT_BASIS = [
    'Căn cứ Luật Giáo dục số 43/2019/QH14 ngày 14 tháng 6 năm 2019;',
    'Căn cứ Thông tư số 21/2018/TT-BGDĐT ngày 24 tháng 8 năm 2018 của Bộ trưởng Bộ Giáo dục và Đào tạo ban hành Quy chế tổ chức và hoạt động của trung tâm ngoại ngữ, tin học;',
    'Căn cứ Quy chế tổ chức và hoạt động của Trung tâm;',
    'Căn cứ nhu cầu học tập của học sinh và điều kiện tổ chức giảng dạy của Trung tâm;',
  ].join('\n');

  const decisionBody = (g, o, cls, D) => {
    const names = cls.map((c) => c.name);
    const subject = `Về việc mở ${cls.length > 1 ? 'các lớp' : 'lớp'} ${listNames(names)}`;
    const basis = String(o.basis || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => `<p class="ci">${esc(x)}</p>`).join('');
    const rows1 = cls.map((c, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(c.name)}</b></td><td class="c">${esc(c.code || '')}</td><td class="c">${c.grade || ''}</td><td class="c">${c.startDate ? U.fmtDate(c.startDate) : dots(6)}</td><td class="r">${c.fee ? U.money(c.fee) : ''}</td><td class="c">${D.students.filter((s) => s.classId === c.id && s.status !== 'inactive').length}</td></tr>`).join('');
    const rows2 = cls.map((c, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(c.name)}</b></td><td>${slotLines(c).map(esc).join('<br>') || dots(8)}</td><td>${esc(tName(c.teacherId)) || dots(8)}</td><td>${esc(tName(c.assistantId))}</td></tr>`).join('');
    const place = `${esc(g.name)}${g.address ? ', địa chỉ: ' + esc(g.address) : ''}`;
    return `<div class="doc">${header(g, o)}
      <div class="type">Quyết định</div><div class="sub">${esc(subject)}</div><div class="ln"></div>
      <div class="who">${esc(o.title || 'GIÁM ĐỐC')} ${esc(g.name)}</div>
      ${basis}
      ${o.proposer ? `<p class="ci">Xét đề nghị của ${esc(o.proposer)};</p>` : ''}
      <div class="mid">QUYẾT ĐỊNH:</div>
      <p class="art"><b>Điều 1.</b> Mở ${cls.length > 1 ? `${cls.length} lớp` : 'lớp'} tại ${place}, cụ thể như sau:</p>
      <table class="dt"><thead><tr><th style="width:7%">STT</th><th>Tên lớp</th><th>Mã lớp</th><th>Khối</th><th>Ngày khai giảng</th><th>Học phí (đ/tháng)</th><th>Sĩ số</th></tr></thead><tbody>${rows1}</tbody></table>
      <p class="art"><b>Điều 2.</b> Thời khóa biểu và phân công giảng dạy của ${cls.length > 1 ? 'các lớp' : 'lớp'} nêu tại Điều 1 như sau:</p>
      <table class="dt"><thead><tr><th style="width:7%">STT</th><th>Lớp</th><th>Thời khóa biểu</th><th>Giáo viên phụ trách</th><th>Trợ giảng</th></tr></thead><tbody>${rows2}</tbody></table>
      <p class="art"><b>Điều 3.</b> Giáo viên được phân công, bộ phận giáo vụ và học sinh ${cls.length > 1 ? 'các lớp' : 'lớp'} có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.</p>
      <p class="art"><b>Điều 4.</b> Quyết định này có hiệu lực kể từ ngày ký./.</p>
      ${signBlock(g, o, ['Như Điều 3', 'Giáo viên được phân công', 'Lưu: VT'])}</div>`;
  };
  const bumpNumber = (n, k) => String(n).replace(/^(\d+)/, (m) => String(+m + k).padStart(m.length, '0'));
  const decisionDocs = (g, o, cls, D) => (o.each ? cls.map((c, i) => decisionBody(g, { ...o, number: bumpNumber(o.number, i) }, [c], D)) : [decisionBody(g, o, cls, D)]).join('');

  /* ---------------- Báo cáo tình hình hoạt động gửi Sở ---------------- */
  const reportBody = (g, o, cls, D, per) => {
    const st = cls.map((c) => ({ c, s: stat(c, D, per) }));
    const hs = st.reduce((a, x) => a + x.s.list.length, 0), left = st.reduce((a, x) => a + x.s.left, 0);
    const present = st.reduce((a, x) => a + x.s.present, 0), absent = st.reduce((a, x) => a + x.s.absent, 0);
    const rate = present + absent ? Math.round((present / (present + absent)) * 1000) / 10 : '';
    const sessions = st.reduce((a, x) => a + x.s.sessions, 0);
    const allAvg = mean(st.flatMap((x) => x.s.avgs));
    const dist = { 'Giỏi': 0, 'Khá': 0, 'Trung bình': 0, 'Yếu': 0 };
    st.forEach((x) => x.s.avgs.forEach((v) => { dist[gradeOf(v)]++; }));
    const rated = Object.values(dist).reduce((a, b) => a + b, 0);
    const tids = [...new Set(cls.flatMap((c) => U.classTeachers(c)))];
    const fees = D.payments.filter((p) => cls.some((c) => c.id === p.classId) && p.month >= per.from.slice(0, 7) && p.month <= per.to.slice(0, 7));
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    const rows1 = st.map((x, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(x.c.name)}</b></td><td class="c">${x.c.grade || ''}</td><td class="c">${x.s.list.length}</td><td>${esc(tName(x.c.teacherId))}${x.c.assistantId ? '<br>Trợ giảng: ' + esc(tName(x.c.assistantId)) : ''}</td><td>${slotLines(x.c).map(esc).join('<br>')}</td></tr>`).join('');
    const rows2 = tids.map((id, i) => {
      const t = App.teachers.find((x) => x.id === id) || { name: tName(id) };
      const mine = cls.filter((c) => U.classTeachers(c).includes(id));
      return `<tr><td class="c">${i + 1}</td><td><b>${esc(t.name)}</b></td><td>${mine.map((c) => esc(c.name) + (c.teacherId === id ? '' : ' (trợ giảng)')).join(', ')}</td><td>${dots(12)}</td><td>${dots(10)}</td></tr>`;
    }).join('');
    const rows3 = st.map((x, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(x.c.name)}</b></td><td class="c">${x.s.sessions}</td><td class="c">${x.s.rate === '' ? '' : x.s.rate + '%'}</td><td class="c">${x.s.avg === '' ? '' : String(x.s.avg).replace('.', ',')}</td><td class="r">${x.c.fee ? U.money(x.c.fee) : ''}</td></tr>`).join('');
    const sub = `Tình hình hoạt động của Trung tâm ${per.label.charAt(0).toLowerCase() + per.label.slice(1)}`;
    return `<div class="doc">${header(g, o)}
      <div class="type">Báo cáo</div><div class="sub">${esc(sub)}</div><div class="ln"></div>
      <div class="to">Kính gửi: ${esc(o.recipient || 'Sở Giáo dục và Đào tạo')}</div>
      <p>${esc(g.name)} báo cáo tình hình hoạt động ${esc(per.label.charAt(0).toLowerCase() + per.label.slice(1))} như sau:</p>
      <p class="n"><b>${roman[0]}. THÔNG TIN CHUNG</b></p>
      <p class="n">- Tên đơn vị: ${esc(g.name)}.</p>
      <p class="n">- Địa chỉ: ${esc(g.address) || dots(30)}; điện thoại: ${esc(g.phone) || dots(12)}.</p>
      <p class="n">- Người đại diện: ${esc(g.director) || dots(20)}.</p>
      <p class="n">- Giấy phép / Quyết định cho phép hoạt động số: ${esc(g.license) || dots(20)}.</p>
      <p class="n"><b>${roman[1]}. QUY MÔ HOẠT ĐỘNG</b></p>
      <p class="n">Hiện Trung tâm có <b>${cls.length}</b> lớp với <b>${hs}</b> học sinh đang theo học${left ? ` (đã nghỉ học: ${left} học sinh)` : ''}:</p>
      <table class="dt"><thead><tr><th style="width:7%">STT</th><th>Lớp</th><th>Khối</th><th>Sĩ số</th><th>Giáo viên</th><th>Thời khóa biểu</th></tr></thead><tbody>${rows1}</tbody></table>
      <p class="n"><b>${roman[2]}. ĐỘI NGŨ GIÁO VIÊN</b></p>
      <p class="n">Trung tâm có <b>${tids.length}</b> giáo viên tham gia giảng dạy:</p>
      <table class="dt"><thead><tr><th style="width:7%">STT</th><th>Họ và tên</th><th>Lớp phụ trách</th><th>Trình độ chuyên môn</th><th>Chứng chỉ</th></tr></thead><tbody>${rows2}</tbody></table>
      <p class="n"><b>${roman[3]}. KẾT QUẢ HOẠT ĐỘNG</b></p>
      <p class="n">- Số buổi học đã tổ chức (có điểm danh): ${sessions} buổi; tỷ lệ chuyên cần chung: ${rate === '' ? dots(5) : rate + '%'}.</p>
      <p class="n">- Điểm trung bình các bài kiểm tra: ${allAvg === '' ? 'chưa có dữ liệu' : String(allAvg).replace('.', ',')}${rated ? `; xếp loại theo điểm trung bình: Giỏi ${dist['Giỏi']}, Khá ${dist['Khá']}, Trung bình ${dist['Trung bình']}, Yếu ${dist['Yếu']} học sinh` : ''}.</p>
      <table class="dt"><thead><tr><th style="width:7%">STT</th><th>Lớp</th><th>Số buổi đã học</th><th>Chuyên cần</th><th>Điểm TB</th><th>Học phí (đ/tháng)</th></tr></thead><tbody>${rows3}</tbody></table>
      <p class="n"><b>${roman[4]}. HỌC PHÍ</b></p>
      <p class="n">Mức thu học phí được niêm yết công khai theo từng lớp (xem bảng trên). Trong kỳ báo cáo đã ghi nhận ${fees.filter((p) => p.paid).length} lượt đóng học phí.</p>
      <p class="n"><b>${roman[5]}. KHÓ KHĂN, KIẾN NGHỊ</b></p>
      <p class="n">${dots(60)}</p><p class="n">${dots(60)}</p>
      <p>Trung tâm kính báo cáo./.</p>
      ${signBlock(g, o, [o.recipient || 'Sở Giáo dục và Đào tạo', 'Lưu: VT'])}</div>`;
  };

  /* ---------------- Hồ sơ Excel ---------------- */
  const CHECKLIST = [
    ['Giấy phép / quyết định cho phép hoạt động giáo dục (còn hiệu lực)', 'Do cơ quan có thẩm quyền cấp'],
    ['Giấy chứng nhận đăng ký doanh nghiệp / hộ kinh doanh', 'Bản sao công chứng hoặc bản chính'],
    ['Quy chế tổ chức và hoạt động, nội quy của Trung tâm', 'Theo Thông tư 21/2018/TT-BGDĐT'],
    ['Quyết định mở lớp của từng lớp', 'In tại mục Báo cáo & hồ sơ'],
    ['Chương trình, danh mục tài liệu dạy học và văn bản báo cáo Sở GD&ĐT', 'Quyết định danh mục tài liệu cho từng đối tượng học viên'],
    ['Hồ sơ giáo viên: hợp đồng, bằng cấp, chứng chỉ nghiệp vụ sư phạm, chứng chỉ ngoại ngữ, lý lịch', 'Giáo viên nước ngoài: thêm giấy phép lao động, hộ chiếu, visa'],
    ['Danh sách học sinh theo lớp, sổ đăng ký học sinh', 'Xuất từ hệ thống'],
    ['Thời khóa biểu, bảng phân công giảng dạy', 'Xuất từ hệ thống'],
    ['Sổ theo dõi điểm danh / sổ đầu bài', 'Xuất từ hệ thống'],
    ['Giáo án, kế hoạch giảng dạy lưu tại Trung tâm', 'Nên lưu bản giấy tại Trung tâm, không chỉ trên máy tính'],
    ['Sổ điểm, kết quả học tập, sổ cấp giấy chứng nhận', 'Xuất từ hệ thống'],
    ['Hồ sơ tài chính: bảng thu học phí, biên lai / hóa đơn, niêm yết công khai mức thu', 'Xuất từ hệ thống'],
    ['Hồ sơ cơ sở vật chất: giấy tờ quyền sử dụng địa điểm, phòng học, phòng cháy chữa cháy, vệ sinh an toàn', 'Hợp đồng thuê nhà / giấy chứng nhận quyền sử dụng'],
    ['Sổ sinh hoạt chuyên môn, biên bản họp giáo viên', 'Nên tổ chức định kỳ và lưu biên bản'],
    ['Báo cáo định kỳ gửi Sở/Phòng GD&ĐT (đầu năm học, cuối năm học, khi có yêu cầu)', 'In tại mục Báo cáo & hồ sơ'],
    ['Biên bản kiểm tra và kiến nghị của đợt kiểm tra trước (nếu có)', 'Kèm báo cáo khắc phục'],
  ];

  const buildSheets = async (keys, cls, per, g) => {
    const D = await loadAll();
    const ids = new Set(cls.map((c) => c.id));
    const sc = sortCls(cls);
    const sts = D.students.filter((s) => ids.has(s.classId));
    const byClass = (list) => sc.flatMap((c) => U.sortVN(list.filter((s) => s.classId === c.id)));
    const today = U.today();
    const info = [[g.address && `Địa chỉ: ${g.address}`, g.phone && `Điện thoại: ${g.phone}`].filter(Boolean).join(' · '),
      [g.director && `Người đại diện: ${g.director}`, g.license && `Giấy phép số: ${g.license}`].filter(Boolean).join(' · '),
      `Kỳ báo cáo: ${per.label} · Ngày lập: ${U.fmtDate(today)}`].filter(Boolean);
    const specs = [];
    const stats = new Map(sc.map((c) => [c.id, stat(c, D, per)]));
    const tuition = keys.has('tuition') || keys.has('review') ? U.tuitionPeriod({ classes: sc, students: sts, attendance: D.attendance, payments: D.payments, settings: App.settings, from: per.from, to: per.to }) : [];
    const sum = (rows, i) => rows.reduce((p, r) => p + (typeof r[i] === 'number' ? r[i] : 0), 0);

    if (keys.has('summary')) {
      const rows = sc.map((c, i) => { const s = stats.get(c.id); return [i + 1, c.grade || '', c.name, c.code || '', c.startDate ? U.fmtDate(c.startDate) : '', s.list.length, s.left, tName(c.teacherId), tName(c.assistantId), s.sessions, s.rate, s.avg]; });
      specs.push({
        name: 'Tổng hợp', title: 'BÁO CÁO TỔNG HỢP TÌNH HÌNH HOẠT ĐỘNG', info,
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Khối', w: 7, align: 'center' }, { h: 'Tên lớp', w: 14, bold: true }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Ngày khai giảng', w: 14, align: 'center' }, { h: 'Số HS đang học', w: 11, align: 'center' }, { h: 'Đã nghỉ', w: 9, align: 'center' },
          { h: 'Giáo viên chính', w: 22 }, { h: 'Trợ giảng', w: 22 }, { h: 'Số buổi đã học', w: 11, align: 'center' }, { h: 'Chuyên cần (%)', w: 12, align: 'center', fmt: '0.0' }, { h: 'Điểm TB', w: 10, align: 'center', fmt: '0.0#' }],
        rows, total: ['', '', 'TỔNG CỘNG', '', '', sum(rows, 5), sum(rows, 6), '', '', sum(rows, 9), '', ''], signature: true,
      });
    }
    if (keys.has('students')) {
      const list = byClass(sts);
      specs.push({
        name: 'Danh sách học sinh', title: 'DANH SÁCH HỌC SINH', info: [...info, `Tổng số: ${list.length} học sinh`],
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Họ và tên', w: 28, bold: true }, { h: 'Lớp', w: 12, align: 'center' }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Số điện thoại', w: 16, align: 'center' }, { h: 'CCCD', w: 18, align: 'center' }, { h: 'Ngày bắt đầu học', w: 15, align: 'center' }, { h: 'Trạng thái', w: 12, align: 'center' }, { h: 'Ghi chú', w: 28 }],
        rows: list.map((s, i) => { const c = App.classById(s.classId) || {}; return [i + 1, s.name, c.name || '', c.code || '', s.phone || '', s.cccd || '', s.startDate ? U.fmtDate(s.startDate) : 'Từ đầu khóa', s.status === 'inactive' ? 'Đã nghỉ' : 'Đang học', s.note || '']; }),
        freezeCols: 2, signature: true,
      });
    }
    if (keys.has('teachers')) {
      const tids = [...new Set(sc.flatMap((c) => U.classTeachers(c)))];
      const rows = tids.map((id, i) => {
        const t = App.teachers.find((x) => x.id === id) || { name: tName(id) };
        const mine = sc.filter((c) => U.classTeachers(c).includes(id));
        return [i + 1, t.name, t.email || '', t.phone || '', mine.filter((c) => c.teacherId === id).map((c) => c.name).join(', '), mine.filter((c) => c.assistantId === id).map((c) => c.name).join(', '), mine.length, '', '', ''];
      });
      specs.push({
        name: 'Danh sách giáo viên', title: 'DANH SÁCH GIÁO VIÊN VÀ PHÂN CÔNG GIẢNG DẠY', info: [...info, 'Các cột màu vàng (trình độ, chứng chỉ, hợp đồng) điền thêm bằng tay hoặc trong Excel.'],
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Họ và tên', w: 26, bold: true }, { h: 'Email', w: 28 }, { h: 'Số điện thoại', w: 16, align: 'center' }, { h: 'Lớp phụ trách (giáo viên chính)', w: 26 }, { h: 'Lớp trợ giảng', w: 22 }, { h: 'Số lớp', w: 8, align: 'center' },
          { h: 'Trình độ chuyên môn', w: 22 }, { h: 'Chứng chỉ (sư phạm, ngoại ngữ)', w: 28 }, { h: 'Hợp đồng lao động', w: 20 }],
        rows, inputCols: [7, 8, 9], freezeCols: 2, signature: true,
      });
    }
    if (keys.has('timetable')) {
      const rows = [];
      sc.forEach((c) => U.slots(c).forEach((s) => rows.push([rows.length + 1, c.grade || '', c.name, c.code || '', U.dayName(s.day), U.timeText(s), s.periods === undefined || s.periods === '' ? '' : Number(s.periods), tName(c.teacherId), tName(c.assistantId)])));
      specs.push({
        name: 'Thời khóa biểu', title: 'THỜI KHÓA BIỂU CÁC LỚP', info,
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Khối', w: 7, align: 'center' }, { h: 'Lớp', w: 14, bold: true }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Thứ', w: 9, align: 'center' }, { h: 'Giờ học', w: 16, align: 'center' }, { h: 'Số tiết', w: 8, align: 'center' }, { h: 'Giáo viên chính', w: 24 }, { h: 'Trợ giảng', w: 24 }],
        rows, freezeCols: 3, signature: true,
      });
    }
    if (keys.has('attendance')) {
      const list = byClass(sts);
      const rows = list.map((s, i) => {
        const c = App.classById(s.classId) || {};
        const docs = D.attendance.filter((a) => a.classId === s.classId && a.date >= per.from && a.date <= per.to && (!s.startDate || a.date >= s.startDate));
        const p = docs.filter((d) => d.records && d.records[s.id] === true).length, a = docs.filter((d) => d.records && d.records[s.id] === false).length;
        return [i + 1, s.name, c.name || '', c.code || '', p + a, p, a, p + a ? Math.round((p / (p + a)) * 1000) / 10 : ''];
      });
      specs.push({
        name: 'Điểm danh', title: 'SỔ THEO DÕI ĐIỂM DANH (TỔNG HỢP)', info,
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Họ và tên', w: 28, bold: true }, { h: 'Lớp', w: 12, align: 'center' }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Số buổi đã học', w: 12, align: 'center' }, { h: 'Có mặt', w: 10, align: 'center', color: () => 'FF0E7A3E' }, { h: 'Vắng', w: 10, align: 'center', color: (v) => (v > 0 ? 'FFC62828' : undefined) }, { h: 'Chuyên cần (%)', w: 13, align: 'center', fmt: '0.0' }],
        rows, total: ['', 'TỔNG CỘNG', '', '', sum(rows, 4), sum(rows, 5), sum(rows, 6), ''], freezeCols: 2, signature: true,
      });
    }
    if (keys.has('results')) {
      const list = byClass(sts);
      const rows = list.map((s, i) => {
        const c = App.classById(s.classId) || {};
        const scs = D.assessments.filter((a) => a.classId === s.classId && a.date >= per.from && a.date <= per.to).map((a) => (a.scores && a.scores[s.id] !== undefined && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : null)).filter((x) => x !== null && !isNaN(x));
        const avg = mean(scs);
        return [i + 1, s.name, c.name || '', c.code || '', scs.length, avg, avg === '' ? '' : gradeOf(avg)];
      });
      specs.push({
        name: 'Kết quả học tập', title: 'TỔNG HỢP KẾT QUẢ HỌC TẬP', info: [...info, 'Xếp loại theo điểm trung bình: Giỏi từ 8,0; Khá từ 6,5; Trung bình từ 5,0; Yếu dưới 5,0.'],
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Họ và tên', w: 28, bold: true }, { h: 'Lớp', w: 12, align: 'center' }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Số bài kiểm tra', w: 12, align: 'center' }, { h: 'Điểm TB', w: 10, align: 'center', fmt: '0.0#', bold: true }, { h: 'Xếp loại', w: 14, align: 'center' }],
        rows, freezeCols: 2, signature: true,
      });
    }
    if (keys.has('tuition')) {
      const rows = tuition.slice().sort((a, b) => (a.cls.grade || 0) - (b.cls.grade || 0) || String(a.cls.code).localeCompare(String(b.cls.code)) || a.student.name.localeCompare(b.student.name, 'vi'))
        .map((r, i) => [i + 1, r.student.name, r.cls.name, r.cls.code || '', r.present, r.absent, r.base, r.deduct, r.total, r.paid ? 'Đã đóng' : 'Chưa đóng']);
      specs.push({
        name: 'Học phí', title: 'BẢNG THU HỌC PHÍ', info: [...info, ...sc.map((c) => `${c.name}: ${U.feeRuleText(c, App.settings)}`)],
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Họ và tên', w: 28, bold: true }, { h: 'Lớp', w: 12, align: 'center' }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Có mặt', w: 9, align: 'center' }, { h: 'Vắng', w: 9, align: 'center' }, { h: 'Học phí', w: 15, fmt: '#,##0" đ"' }, { h: 'Giảm', w: 15, fmt: '#,##0" đ"' }, { h: 'Phải đóng', w: 16, fmt: '#,##0" đ"', bold: true }, { h: 'Trạng thái', w: 12, align: 'center', color: (v) => (v === 'Đã đóng' ? 'FF0E7A3E' : 'FFB45309') }],
        rows, total: ['', 'TỔNG CỘNG', '', '', sum(rows, 4), sum(rows, 5), sum(rows, 6), sum(rows, 7), sum(rows, 8), ''], freezeCols: 2, signature: true,
      });
    }
    if (keys.has('review')) {
      const rows = [];
      const add = (level, who, what, tip) => rows.push([rows.length + 1, level, who, what, tip]);
      sc.forEach((c) => {
        const s = stats.get(c.id);
        if (!c.startDate) add('Cần xử lý', c.name, 'Chưa có ngày khai giảng', 'Vào Lớp học → Sửa lớp để nhập ngày khai giảng.');
        if (!c.teacherId) add('Cần xử lý', c.name, 'Chưa phân công giáo viên chính', 'Phân công tại mục Phân công & đơn giá.');
        if (!(c.slots && c.slots.length) && !(c.days && c.days.length)) add('Cần xử lý', c.name, 'Chưa có thời khóa biểu', 'Sửa lớp và chọn các ngày học trong tuần.');
        if (!c.fee) add('Lưu ý', c.name, 'Chưa đặt học phí cho lớp', 'Sửa lớp và nhập học phí.');
        if (!s.list.length) add('Lưu ý', c.name, 'Lớp chưa có học sinh', 'Thêm học sinh vào lớp.');
        const rec = new Set(D.attendance.filter((a) => a.classId === c.id).map((a) => a.date));
        const miss = U.sessions(c, per.from, per.to < today ? per.to : today).filter((d) => !rec.has(d)).length;
        if (miss) add('Cần xử lý', c.name, `${miss} buổi học đã qua chưa điểm danh`, 'Dùng "Điểm danh bù nhiều ngày" trong tab Điểm danh của lớp.');
        const noPhone = s.list.filter((x) => !x.phone).length, noId = s.list.filter((x) => !x.cccd).length;
        if (noPhone) add('Lưu ý', c.name, `${noPhone} học sinh chưa có số điện thoại`, 'Bổ sung để liên hệ phụ huynh.');
        if (noId) add('Lưu ý', c.name, `${noId} học sinh chưa có CCCD`, 'Bổ sung nếu cơ quan kiểm tra yêu cầu (học sinh nhỏ tuổi có thể chưa có).');
      });
      [...new Set(sc.flatMap((c) => U.classTeachers(c)))].forEach((id) => {
        const t = App.teachers.find((x) => x.id === id);
        if (t && !t.phone) add('Lưu ý', t.name, 'Giáo viên chưa có số điện thoại', 'Bổ sung trong mục Giáo viên.');
      });
      const unpaid = tuition.filter((r) => !r.paid).length;
      if (unpaid) add('Lưu ý', 'Học phí', `${unpaid} học sinh chưa đóng đủ học phí trong kỳ`, 'Xem mục Học phí để đối chiếu.');
      if (!g.license) add('Cần xử lý', 'Thông tin pháp lý', 'Chưa nhập số giấy phép / quyết định hoạt động', 'Nhập ở khung "Thông tin pháp lý" trên trang này.');
      if (!g.address) add('Cần xử lý', 'Thông tin pháp lý', 'Chưa nhập địa chỉ trung tâm', 'Nhập ở khung "Thông tin pháp lý" trên trang này.');
      if (!rows.length) add('Tốt', 'Toàn bộ dữ liệu', 'Không phát hiện thiếu sót', '');
      specs.push({
        name: 'Rà soát hồ sơ', title: 'RÀ SOÁT DỮ LIỆU TRƯỚC KHI KIỂM TRA', info,
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Mức độ', w: 12, align: 'center', color: (v) => (v === 'Cần xử lý' ? 'FFC62828' : v === 'Tốt' ? 'FF0E7A3E' : 'FFB45309'), bold: true }, { h: 'Đối tượng', w: 22, bold: true }, { h: 'Vấn đề', w: 52, wrap: true }, { h: 'Gợi ý xử lý', w: 56, wrap: true }],
        rows,
      });
    }
    if (keys.has('checklist')) {
      specs.push({
        name: 'Danh mục hồ sơ', title: 'DANH MỤC HỒ SƠ CHUẨN BỊ CHO ĐOÀN KIỂM TRA', info: ['Danh mục mang tính tham khảo; hãy đối chiếu với yêu cầu cụ thể trong thông báo kiểm tra của Sở/Phòng GD&ĐT.'],
        cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Hồ sơ cần chuẩn bị', w: 70, wrap: true, bold: true }, { h: 'Ghi chú', w: 46, wrap: true }, { h: 'Đã có (✓)', w: 12, align: 'center' }, { h: 'Nơi lưu / người phụ trách', w: 28 }],
        rows: CHECKLIST.map((r, i) => [i + 1, r[0], r[1], '', '']), inputCols: [3, 4], signature: true,
      });
    }
    return specs;
  };

  /* ---------------- trang ---------------- */
  const SHEETS = [
    ['summary', 'Tổng hợp tình hình hoạt động theo lớp'], ['students', 'Danh sách học sinh theo lớp'], ['teachers', 'Danh sách giáo viên và phân công'],
    ['timetable', 'Thời khóa biểu các lớp'], ['attendance', 'Sổ theo dõi điểm danh (tổng hợp)'], ['results', 'Tổng hợp kết quả học tập'],
    ['tuition', 'Bảng thu học phí'], ['review', 'Rà soát dữ liệu còn thiếu'], ['checklist', 'Danh mục hồ sơ chuẩn bị cho đoàn kiểm tra'],
  ];

  Views.reports = async (root) => {
    const classes = sortCls(App.classes);
    const o = { sheets: SHEETS.map((x) => x[0]), pick: classes.map((c) => c.id), basis: DEFAULT_BASIS, title: 'GIÁM ĐỐC', number: '01/QĐ-' + legal().abbr, each: false, recipient: 'Sở Giáo dục và Đào tạo', rnumber: '01/BC-' + legal().abbr, ...loadO() };
    o.pick = o.pick.filter((id) => classes.some((c) => c.id === id));
    const g0 = legal(), today = U.today();
    if (!classes.length) { root.innerHTML = `${UI.head('Báo cáo & hồ sơ', 'Cần có ít nhất một lớp học.')}${UI.empty('classes', 'Chưa có lớp nào', 'Hãy tạo lớp trước khi lập báo cáo.')}`; return; }
    const inp = (id, label, val, ph = '') => `<div><label class="f">${label}</label><input class="input" id="${id}" value="${esc(val)}" placeholder="${esc(ph)}"></div>`;
    root.innerHTML = `${UI.head('Báo cáo & hồ sơ', 'Quyết định mở lớp, báo cáo gửi Sở Giáo dục và đầy đủ bộ hồ sơ phục vụ kiểm tra, lấy dữ liệu từ lớp, thời khóa biểu, phân công giáo viên đang có trong hệ thống.')}
      <div class="card"><div class="card-h"><h3>1. Thông tin pháp lý của trung tâm</h3><span class="small muted">In ở đầu văn bản và các báo cáo</span></div><div class="card-b">
        <div class="form-grid">
          ${inp('g_authority', 'Cơ quan chủ quản (nếu có, in trên tên trung tâm)', g0.authority, 'Ví dụ: SỞ GIÁO DỤC VÀ ĐÀO TẠO TP. HỒ CHÍ MINH')}
          ${inp('g_abbr', 'Ký hiệu cơ quan (trong số văn bản)', g0.abbr, 'Ví dụ: SKY')}
          ${inp('g_address', 'Địa chỉ', g0.address, 'Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành')}
          ${inp('g_phone', 'Điện thoại', g0.phone)}
          ${inp('g_director', 'Người đại diện / Giám đốc (người ký)', g0.director, 'Họ và tên')}
          ${inp('g_license', 'Giấy phép / Quyết định cho phép hoạt động số', g0.license, 'Số, ngày cấp, cơ quan cấp')}
          ${inp('g_city', 'Địa danh ghi trên văn bản', g0.city, 'Ví dụ: Thủ Đức')}
        </div><div class="row mt"><button class="btn" id="gsave">${icon('check')} Lưu thông tin</button></div></div></div>
      <div class="card mt"><div class="card-h"><h3>2. Chọn lớp</h3><span class="small muted">Áp dụng cho quyết định mở lớp và hồ sơ Excel</span></div><div class="card-b">
        <div class="row" style="margin-bottom:8px"><button class="btn sm soft" id="cp_all">Chọn tất cả</button><button class="btn sm ghost" id="cp_none">Bỏ chọn</button><span class="small muted" id="cp_n"></span></div>
        <div class="rp-tests">${classes.map((c) => `<label class="ck"><input type="checkbox" data-cp="${c.id}" ${o.pick.includes(c.id) ? 'checked' : ''}> <b>${esc(c.name)}</b> <span class="muted small">(${esc(c.code || '')}) · ${esc(U.scheduleText(c))} · ${esc(tName(c.teacherId))}</span></label>`).join('')}</div></div></div>
      <div class="card mt"><div class="card-h"><h3>3. Quyết định mở lớp</h3><span class="small muted">Chọn một lớp hoặc nhiều lớp (nhiều lớp thì ghi tên các lớp vào cùng một văn bản)</span></div><div class="card-b">
        <div class="form-grid">
          ${inp('d_number', 'Số quyết định', o.number)}
          <div><label class="f">Ngày ký</label><input class="input" type="date" id="d_date" value="${today}"></div>
          ${inp('d_title', 'Chức danh người ký', o.title)}
          ${inp('d_proposer', 'Theo đề nghị của (không bắt buộc)', o.proposer || '', 'Ví dụ: bộ phận giáo vụ')}
          <div class="full"><label class="f">Các căn cứ (mỗi dòng một căn cứ, sửa theo giấy phép của trung tâm)</label><textarea class="input" id="d_basis" rows="5">${esc(o.basis)}</textarea>
            <div class="hint">Hãy đối chiếu các văn bản pháp luật nêu trong căn cứ với quy định hiện hành trước khi ban hành.</div></div>
          <div class="full"><label class="ck"><input type="checkbox" id="d_each" ${o.each ? 'checked' : ''}> Mỗi lớp một quyết định riêng (số quyết định tự tăng dần)</label></div>
        </div>
        <div class="row mt"><button class="btn" id="d_prev">${icon('printer')} Xem trước và in</button><button class="btn ghost" id="d_word">${icon('download')} Tải file Word (.doc)</button></div></div></div>
      <div class="card mt"><div class="card-h"><h3>4. Báo cáo tình hình hoạt động gửi Sở Giáo dục</h3><span class="small muted">Văn bản tự điền số liệu theo kỳ chọn</span></div><div class="card-b">
        <div class="form-grid">
          ${inp('r_number', 'Số báo cáo', o.rnumber)}
          <div><label class="f">Ngày ký</label><input class="input" type="date" id="r_date" value="${today}"></div>
          ${inp('r_recipient', 'Kính gửi', o.recipient)}
          <div class="full" id="r_period">${U.periodHtml({ kind: 'semester' })}</div>
        </div>
        <div class="row mt"><button class="btn" id="r_prev">${icon('printer')} Xem trước và in</button><button class="btn ghost" id="r_word">${icon('download')} Tải file Word (.doc)</button></div></div></div>
      <div class="card mt"><div class="card-h"><h3>5. Hồ sơ Excel phục vụ kiểm tra</h3><span class="small muted">Mỗi mục là một sheet trong cùng một file</span></div><div class="card-b">
        <div class="rp-tests">${SHEETS.map(([k, l]) => `<label class="ck"><input type="checkbox" data-sh="${k}" ${o.sheets.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <div id="x_period" style="margin-top:12px">${U.periodHtml({ kind: 'semester' })}</div>
        <div class="row mt"><button class="btn" id="x_go">${icon('download')} Tải bộ hồ sơ Excel</button></div></div></div>`;

    root.querySelectorAll('.period').forEach((p) => U.periodBind(p, classes));
    const q = (s) => root.querySelector(s);
    const picked = () => classes.filter((c) => root.querySelector(`[data-cp="${c.id}"]`).checked);
    const cnt = () => { q('#cp_n').textContent = `Đã chọn ${picked().length} / ${classes.length} lớp`; };
    cnt();
    const persist = () => saveO({
      sheets: [...root.querySelectorAll('[data-sh]:checked')].map((x) => x.dataset.sh), pick: picked().map((c) => c.id), basis: q('#d_basis').value, title: q('#d_title').value, number: q('#d_number').value,
      each: q('#d_each').checked, proposer: q('#d_proposer').value, recipient: q('#r_recipient').value, rnumber: q('#r_number').value,
    });
    const gnow = () => ({ ...legal(), authority: q('#g_authority').value.trim(), abbr: q('#g_abbr').value.trim(), address: q('#g_address').value.trim(), phone: q('#g_phone').value.trim(), director: q('#g_director').value.trim(), license: q('#g_license').value.trim(), city: q('#g_city').value.trim() });
    const dOpts = () => ({ number: q('#d_number').value.trim() || '01/QĐ', date: q('#d_date').value || today, title: q('#d_title').value.trim() || 'GIÁM ĐỐC', proposer: q('#d_proposer').value.trim(), basis: q('#d_basis').value, each: q('#d_each').checked });
    const preview = (title, html) => {
      const m = U.modal({ title, okText: 'In / lưu PDF', wide: true, body: '<iframe id="pv" style="width:100%;height:68vh;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe>', onOk: () => { U.printHTML(html); return false; } });
      m.el.querySelector('#pv').srcdoc = html;
    };
    const asWord = (html) => html.replace('<html lang="vi">', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
    const needClasses = () => { const c = picked(); if (!c.length) throw new Error('Hãy chọn ít nhất một lớp.'); return c; };
    const run = (fn) => async () => { try { await fn(); } catch (e) { U.toast(e.message || String(e), 'err'); } };

    root.addEventListener('change', (e) => { if (e.target.closest('[data-cp]')) cnt(); persist(); });
    q('#cp_all').onclick = () => { root.querySelectorAll('[data-cp]').forEach((x) => { x.checked = true; }); cnt(); persist(); };
    q('#cp_none').onclick = () => { root.querySelectorAll('[data-cp]').forEach((x) => { x.checked = false; }); cnt(); persist(); };
    q('#gsave').onclick = run(async () => {
      const g = gnow();
      await DB.save('settings', 'main', { centerAuthority: g.authority, centerAbbr: g.abbr, centerAddress: g.address, centerPhone: g.phone, centerDirector: g.director, centerLicense: g.license, centerCity: g.city });
      App.settings = { ...App.settings, centerAuthority: g.authority, centerAbbr: g.abbr, centerAddress: g.address, centerPhone: g.phone, centerDirector: g.director, centerLicense: g.license, centerCity: g.city };
      U.toast('Đã lưu thông tin pháp lý', 'ok');
    });
    const decisionHtml = async () => { const cls = needClasses(), D = await loadAll(); persist(); return wrapDoc(decisionDocs(gnow(), dOpts(), cls, D)); };
    q('#d_prev').onclick = run(async () => preview('Quyết định mở lớp', await decisionHtml()));
    q('#d_word').onclick = run(async () => { const h = await decisionHtml(); U.download(`Quyet_dinh_mo_lop_${U.today()}.doc`, '﻿' + asWord(h), 'application/msword'); U.toast('Đã tạo file Word', 'ok'); });
    const reportHtml = async () => {
      const cls = sortCls(App.classes), D = await loadAll(), per = U.periodGet(q('#r_period .period'), cls); persist();
      const op = { number: q('#r_number').value.trim() || '01/BC', date: q('#r_date').value || today, title: q('#d_title').value.trim() || 'GIÁM ĐỐC', recipient: q('#r_recipient').value.trim() || 'Sở Giáo dục và Đào tạo' };
      return wrapDoc(reportBody(gnow(), op, cls, D, per));
    };
    q('#r_prev').onclick = run(async () => preview('Báo cáo gửi Sở Giáo dục', await reportHtml()));
    q('#r_word').onclick = run(async () => { const h = await reportHtml(); U.download(`Bao_cao_hoat_dong_${U.today()}.doc`, '﻿' + asWord(h), 'application/msword'); U.toast('Đã tạo file Word', 'ok'); });
    q('#x_go').onclick = run(async () => {
      const cls = needClasses(), keys = new Set([...root.querySelectorAll('[data-sh]:checked')].map((x) => x.dataset.sh));
      if (!keys.size) throw new Error('Hãy chọn ít nhất một mục hồ sơ.');
      const per = U.periodGet(q('#x_period .period'), cls); persist();
      const specs = await buildSheets(keys, cls, per, gnow());
      await X.exportWorkbook(specs, `Ho_so_kiem_tra_${U.today()}.xlsx`);
    });
  };
})();
