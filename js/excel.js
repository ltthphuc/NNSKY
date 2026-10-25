/*
 * Nhập / xuất Excel và các file mẫu.
 *  - Đọc file (nhập dữ liệu): SheetJS
 *  - Ghi file có định dạng đẹp (tiêu đề, màu, viền, định dạng số, cố định dòng tiêu đề, in A4): ExcelJS
 */
(function () {
  const X = (window.X = {});

  const NAVY = 'FF0E2748', BLUE = 'FF1F6FEB', LINE = 'FFC9D5E8', ZEBRA = 'FFF5F8FD', TOTAL = 'FFE3EEFF', INPUT = 'FFFFF9DB', GRAYTXT = 'FF51607A';
  const FONT = 'Arial';
  const MONEY = '#,##0" đ"';
  const border = { top: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };

  const needRead = () => { if (!window.XLSX) throw new Error('Chưa tải được thư viện đọc Excel (cần kết nối mạng).'); };
  const needWrite = () => { if (!window.ExcelJS) throw new Error('Chưa tải được thư viện xuất Excel (cần kết nối mạng lần đầu).'); };
  const slug = (s) => U.norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'file';
  const center = () => (App.settings && App.settings.centerName) || 'Trung tâm ngoại ngữ Sky';
  /* mọi hàm xuất: bắt lỗi và báo cho người dùng */
  const safe = (fn) => (...a) => Promise.resolve().then(() => fn(...a)).catch((e) => { console.error(e); U.toast(e.message || String(e), 'err'); });

  /* ---------- dựng file ---------- */
  const newBook = () => {
    needWrite();
    const wb = new ExcelJS.Workbook();
    wb.creator = center(); wb.created = new Date();
    return wb;
  };
  const saveBook = async (wb, name) => {
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    U.toast('Đã tạo file ' + name, 'ok');
  };
  const pageSetup = (landscape = true) => ({
    orientation: landscape ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.25, footer: 0.25 },
  });

  /*
   * spec = { name, title, info:[..], cols:[{h, w, align, fmt, color(v)}], rows:[[..]], total:[..], notes:[..], freezeCols, sample:Set(rowIndex), inputCols:[idx] }
   * Trả về { ws, headerRow, firstRow }
   */
  function addSheet(wb, s) {
    const n = s.cols.length;
    const ws = wb.addWorksheet(s.name.slice(0, 31), { pageSetup: pageSetup(s.landscape !== false), views: [{ showGridLines: false }] });
    s.cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w || 14; });
    let r = 1;
    const line = (text, font, h) => {
      if (n > 1) ws.mergeCells(r, 1, r, n);
      const c = ws.getCell(r, 1);
      c.value = text; c.font = font; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      if (h) ws.getRow(r).height = h;
      r++;
    };
    line(center().toUpperCase(), { name: FONT, bold: true, size: 11, color: { argb: BLUE } }, 18);
    line(s.title, { name: FONT, bold: true, size: 16, color: { argb: NAVY } }, String(s.title).includes('\n') ? 46 : 30);
    (s.info || []).forEach((t) => line(t, { name: FONT, size: 10.5, color: { argb: GRAYTXT } }, 17));
    r++;
    const headerRow = r;
    const hr = ws.getRow(r); hr.height = 30;
    s.cols.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.h;
      cell.font = { name: FONT, bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = border;
    });
    r++;
    const firstRow = r;
    s.rows.forEach((row, ri) => {
      const xr = ws.getRow(r); xr.height = 21;
      s.cols.forEach((c, i) => {
        const v = row[i];
        const cell = xr.getCell(i + 1);
        cell.value = v === '' || v === undefined ? null : v;
        const isInput = s.inputCols && s.inputCols.includes(i);
        const sample = s.sample && s.sample.has(ri);
        cell.font = { name: FONT, size: 10.5, italic: !!sample, color: { argb: sample ? 'FF8A97AD' : (c.color && c.color(v)) || 'FF1B2B45' }, bold: !!(c.bold) };
        cell.alignment = { horizontal: c.align || (typeof v === 'number' ? 'right' : 'left'), vertical: 'middle', wrapText: !!c.wrap };
        cell.border = border;
        if (c.fmt) cell.numFmt = c.fmt;
        if (isInput) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } };
        else if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      });
      r++;
    });
    if (s.total) {
      const tr = ws.getRow(r); tr.height = 24;
      s.cols.forEach((c, i) => {
        const cell = tr.getCell(i + 1);
        const v = s.total[i];
        cell.value = v === '' || v === undefined ? null : v;
        cell.font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL } };
        cell.alignment = { horizontal: c.align || (typeof v === 'number' ? 'right' : 'left'), vertical: 'middle' };
        cell.border = { ...border, top: { style: 'medium', color: { argb: NAVY } } };
        if (c.fmt) cell.numFmt = c.fmt;
      });
      r++;
    }
    if (s.notes && s.notes.length) {
      r++;
      s.notes.forEach((t) => {
        if (n > 1) ws.mergeCells(r, 1, r, n);
        const c = ws.getCell(r, 1);
        c.value = t; c.font = { name: FONT, italic: true, size: 10, color: { argb: GRAYTXT } };
        c.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        ws.getRow(r).height = t.length > 110 ? 30 : 17;
        r++;
      });
    }
    r++;
    if (s.signature) {
      const half = Math.max(1, Math.floor(n / 2));
      ws.mergeCells(r, 1, r, half); ws.mergeCells(r, half + 1, r, n);
      [[1, 'Người lập bảng'], [half + 1, 'Chủ trung tâm']].forEach(([col, t]) => {
        const c = ws.getCell(r, col); c.value = t; c.font = { name: FONT, bold: true, size: 10.5, color: { argb: NAVY } }; c.alignment = { horizontal: 'center' };
      });
      r++;
      ws.mergeCells(r, 1, r, half); ws.mergeCells(r, half + 1, r, n);
      [1, half + 1].forEach((col) => { const c = ws.getCell(r, col); c.value = '(ký, ghi rõ họ tên)'; c.font = { name: FONT, italic: true, size: 9.5, color: { argb: GRAYTXT } }; c.alignment = { horizontal: 'center' }; });
    }
    ws.views = [{ state: 'frozen', xSplit: s.freezeCols || 0, ySplit: headerRow, showGridLines: false }];
    if (s.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + s.rows.length, column: n } };
    ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
    const pd = s.printDate !== undefined ? s.printDate : !!(window.App && App.settings && App.settings.showPrintDate);
    ws.headerFooter = { oddFooter: `&L&8${center()}&C&8Trang &P / &N${pd ? '&R&8In ngày &D' : ''}` };
    return { ws, headerRow, firstRow };
  }

  /* Trang hướng dẫn: tiêu đề + các dòng + (tuỳ chọn) bảng mã lớp */
  function addGuide(wb, title, lines, table) {
    const ws = wb.addWorksheet('Hướng dẫn', { pageSetup: pageSetup(false), views: [{ showGridLines: false }] });
    [26, 22, 40].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = 1;
    ws.mergeCells(r, 1, r, 3);
    const t = ws.getCell(r, 1); t.value = title; t.font = { name: FONT, bold: true, size: 15, color: { argb: NAVY } }; t.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = 30; r += 2;
    lines.forEach((l, i) => {
      ws.mergeCells(r, 1, r, 3);
      const c = ws.getCell(r, 1); c.value = l; c.font = { name: FONT, size: 11, color: { argb: 'FF1B2B45' } };
      c.alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(r).height = l.length > 80 ? 34 : 20;
      r++;
    });
    let range = null;
    if (table) {
      r++;
      const hr = ws.getRow(r); hr.height = 26;
      table.head.forEach((h, i) => {
        const c = hr.getCell(i + 1); c.value = h;
        c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = border;
      });
      r++;
      const first = r;
      table.rows.forEach((row, ri) => {
        row.forEach((v, i) => {
          const c = ws.getRow(r).getCell(i + 1); c.value = v; c.font = { name: FONT, size: 10.5 }; c.border = border;
          if (ri % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
        });
        r++;
      });
      range = `'Hướng dẫn'!$A$${first}:$A$${Math.max(first, r - 1)}`;
    }
    return { ws, range };
  }

  /* ---------- đọc file ---------- */
  X.read = (file) =>
    new Promise((resolve, reject) => {
      needRead();
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Không đọc được file.'));
      fr.onload = () => {
        try { resolve(XLSX.read(fr.result, { type: 'array' })); } catch (e) { reject(new Error('File không đúng định dạng Excel (.xlsx).')); }
      };
      fr.readAsArrayBuffer(file);
    });
  const rowsOf = (wb) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: true });
  const findCol = (header, ...names) => {
    const h = header.map((x) => U.norm(x));
    for (const n of names) { const i = h.findIndex((x) => x.includes(U.norm(n))); if (i >= 0) return i; }
    return -1;
  };
  /* tìm dòng tiêu đề trong 15 dòng đầu (file mẫu có dòng tiêu đề phía trên) */
  const headerIndex = (rows, test) => rows.findIndex((r, i) => i < 15 && test(r.map((x) => U.norm(x))));
  const fixPhone = (p) => { p = String(p || '').replace(/[\s.\-]/g, ''); return /^\d{9}$/.test(p) ? '0' + p : p; };
  const fixId = (p) => { p = String(p || '').replace(/[\s.\-]/g, ''); return /^\d{11}$/.test(p) ? '0' + p : p; };

  /* ===== Học sinh ===== */
  X.studentTemplate = safe(async (classes) => {
    const wb = newBook();
    const c = classes[0];
    const single = classes.length === 1;
    const cname = c ? c.name : 'Lớp 1', code = c ? c.code : 'SKY-AB123';
    const { ws, firstRow } = addSheet(wb, {
      name: 'Danh sách học sinh', title: single ? `DANH SÁCH HỌC SINH ${c.name.toUpperCase()}` : 'DANH SÁCH HỌC SINH', landscape: true,
      info: ['Điền mỗi học sinh một dòng (các dòng "(mẫu)" sẽ tự bị bỏ qua). Cột có dấu * là bắt buộc.',
        'Ngày bắt đầu học: ngày học sinh vào lớp, viết dạng dd/mm/yyyy. Để trống = học từ đầu khóa. Điểm danh và học phí chỉ tính từ ngày này.'],
      cols: [{ h: 'Họ tên học sinh *', w: 28 }, { h: 'Tên lớp', w: 14 }, { h: 'Mã lớp', w: 16, align: 'center' }, { h: 'Số điện thoại', w: 16, align: 'center' },
        { h: 'CCCD', w: 18, align: 'center' }, { h: 'Ngày bắt đầu học', w: 17, align: 'center' }, { h: 'Ghi chú', w: 30 }],
      rows: [['Nguyễn Văn An (mẫu)', cname, code, '0912345678', '', '', 'Phụ huynh: Nguyễn Văn B'], ['Trần Thị Bình (mẫu)', cname, code, '0987654321', '079318000123', '15/10/2026', 'Vào học muộn']],
      sample: new Set([0, 1]),
    });
    const guide = addGuide(wb, 'HƯỚNG DẪN NHẬP DANH SÁCH HỌC SINH', [
      '1. Điền thông tin học sinh ở sheet "Danh sách học sinh", mỗi học sinh một dòng. Hai dòng "(mẫu)" sẽ tự bị bỏ qua khi nhập.',
      '2. "Họ tên học sinh" là bắt buộc. Số điện thoại và CCCD không bắt buộc (học sinh tiểu học có thể chưa có CCCD).',
      single ? '3. "Tên lớp" và "Mã lớp" đã điền sẵn đúng lớp này. Nếu để trống, hệ thống tự hiểu là lớp đang mở.'
        : '3. "Mã lớp": chọn từ danh sách xổ xuống (mã có trong bảng bên dưới).',
      '4. "Ngày bắt đầu học": ví dụ lớp khai giảng 01/10 nhưng em này vào học từ 15/10 thì điền 15/10/2026. Học phí và điểm danh sẽ chỉ tính từ ngày đó. Để trống nếu học từ đầu khóa.',
      '5. Số điện thoại và CCCD được định dạng văn bản để giữ số 0 ở đầu.',
      '6. Học sinh trùng họ tên trong cùng một lớp sẽ bị bỏ qua.',
      '7. Lưu file rồi chọn "Nhập Excel" trong trang của lớp.',
    ], { head: ['Mã lớp', 'Tên lớp', 'Lịch học'], rows: classes.map((k) => [k.code, k.name, U.scheduleText(k)]) });
    for (let i = 0; i < 300; i++) {
      const row = firstRow + i;
      ws.getCell(row, 4).numFmt = '@'; ws.getCell(row, 5).numFmt = '@'; ws.getCell(row, 6).numFmt = '@';
      if (i >= 2) {
        for (let col = 1; col <= 7; col++) { const cell = ws.getCell(row, col); cell.border = border; cell.font = { name: FONT, size: 10.5 }; }
        ws.getCell(row, 3).alignment = { horizontal: 'center' }; ws.getCell(row, 4).alignment = { horizontal: 'center' };
        ws.getCell(row, 5).alignment = { horizontal: 'center' }; ws.getCell(row, 6).alignment = { horizontal: 'center' };
        if (single && i < 120) { ws.getCell(row, 2).value = cname; ws.getCell(row, 3).value = code; }
      }
      if (!single && guide.range) ws.getCell(row, 3).dataValidation = { type: 'list', allowBlank: true, formulae: [guide.range], showErrorMessage: false };
    }
    ws.autoFilter = undefined;
    await saveBook(wb, single ? `Mau_nhap_hoc_sinh_${slug(c.code)}.xlsx` : 'Mau_nhap_hoc_sinh.xlsx');
  });

  const parseJoinDate = (v) => {
    v = String(v || '').trim();
    if (!v) return '';
    let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${U.pad(m[2])}-${U.pad(m[1])}`; }
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
    if (m) return `${m[1]}-${U.pad(m[2])}-${U.pad(m[3])}`;
    if (/^\d{5}$/.test(v)) { const d = new Date(Math.round((+v - 25569) * 86400000)); return `${d.getUTCFullYear()}-${U.pad(d.getUTCMonth() + 1)}-${U.pad(d.getUTCDate())}`; }
    return 'INVALID';
  };

  X.parseStudents = async (file) => {
    const rows = rowsOf(await X.read(file));
    const hi = headerIndex(rows, (h) => h.some((x) => x.includes('ho va ten') || x.includes('ho ten')));
    if (hi < 0) throw new Error('Không tìm thấy cột "Họ tên học sinh". Hãy dùng file mẫu của hệ thống.');
    const h = rows[hi];
    const iName = findCol(h, 'ho va ten', 'ho ten');
    const iClassName = findCol(h, 'ten lop');
    const iClass = findCol(h, 'ma lop');
    const iPhone = findCol(h, 'so dien thoai', 'sdt', 'dien thoai');
    const iId = findCol(h, 'cccd', 'can cuoc');
    const iDate = findCol(h, 'ngay bat dau', 'ngay vao hoc', 'bat dau hoc');
    const iNote = findCol(h, 'ghi chu');
    return rows.slice(hi + 1).map((r, i) => ({
      line: hi + i + 2,
      name: String(r[iName] || '').replace(/\s+/g, ' ').trim(),
      className: iClassName >= 0 ? String(r[iClassName] || '').trim() : '',
      classCode: iClass >= 0 ? String(r[iClass] || '').trim() : '',
      phone: iPhone >= 0 ? fixPhone(r[iPhone]) : '',
      cccd: iId >= 0 ? fixId(r[iId]) : '',
      startDate: iDate >= 0 ? parseJoinDate(r[iDate]) : '',
      note: iNote >= 0 ? String(r[iNote] || '').trim() : '',
    })).filter((r) => (r.name || r.phone) && !/\(mẫu\)\s*$/i.test(r.name));
  };

  X.exportStudents = safe(async (list, classOf, canSeeId) => {
    const wb = newBook();
    addSheet(wb, {
      name: 'Học sinh', title: 'DANH SÁCH HỌC SINH', info: [`Ngày xuất: ${U.fmtDate(U.today())} · Tổng số: ${list.length} học sinh`],
      cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Mã HS', w: 22 }, { h: 'Họ và tên', w: 28, bold: true }, { h: 'Lớp', w: 12, align: 'center' }, { h: 'Mã lớp', w: 14, align: 'center' },
        { h: 'Số điện thoại', w: 16, align: 'center' }, { h: 'CCCD', w: 18, align: 'center' }, { h: 'Trạng thái', w: 12, align: 'center', color: (v) => (v === 'Đã nghỉ' ? 'FFB45309' : 'FF0E7A3E') }, { h: 'Ghi chú', w: 32 }],
      rows: list.map((s, i) => { const c = classOf(s.classId) || {}; return [i + 1, s.code || '', s.name, c.name || '', c.code || '', s.phone || '', canSeeId ? s.cccd || '' : U.maskId(s.cccd || ''), s.status === 'inactive' ? 'Đã nghỉ' : 'Đang học', s.note || '']; }),
      freezeCols: 3,
    });
    await saveBook(wb, `Danh_sach_hoc_sinh_${U.today()}.xlsx`);
  });

  /* ===== Điểm đánh giá ===== */
  X.scoreTemplate = safe(async (cls, students, title, date, parts = [], autoAvg = true) => {
    const wb = newBook();
    const np = parts.length, ovHead = np ? (autoAvg ? 'Điểm chung (tự tính, có thể để trống)' : 'Điểm chung (0-10)') : 'Điểm (0-10)';
    const cols = [{ h: 'Mã HS', w: 22 }, { h: 'Họ và tên', w: 28, bold: true }, ...parts.map((p) => ({ h: p.name, w: 12, align: 'center', fmt: '0.0#' })), { h: ovHead, w: np ? 16 : 14, align: 'center', fmt: '0.0#' }, { h: 'Nhận xét', w: 52, wrap: true }];
    const { ws, firstRow } = addSheet(wb, {
      name: 'Nhập điểm', title: 'BẢNG NHẬP ĐIỂM ĐÁNH GIÁ', landscape: np > 3,
      info: [`Lớp: ${cls.name} (${cls.code})`, `Bài đánh giá: ${title || ''}${date ? ' · Ngày ' + U.fmtDate(date) : ''}`, `Chỉ điền vào các ô màu vàng (${np ? 'điểm các cột, ' : 'Điểm và '}Nhận xét).`],
      cols, rows: students.map((s) => [s.code || '', s.name, ...parts.map(() => ''), '', '']),
      inputCols: cols.map((c, i) => i).filter((i) => i >= 2),
    });
    students.forEach((s, i) => {
      for (let k = 0; k <= np; k++) ws.getCell(firstRow + i, 3 + k).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 10], allowBlank: true, showErrorMessage: true, errorTitle: 'Điểm không hợp lệ', error: 'Vui lòng nhập điểm từ 0 đến 10.' };
    });
    addGuide(wb, 'HƯỚNG DẪN NHẬP ĐIỂM', [
      `Lớp: ${cls.name} (${cls.code})`,
      `Bài đánh giá: ${title || ''}${date ? ' - ngày ' + U.fmtDate(date) : ''}`,
      `1. Chỉ điền các ô màu vàng${np ? ` (cột ${parts.map((p) => '"' + p.name + '"').join(', ')}, điểm chung và Nhận xét)` : ' (Điểm và Nhận xét)'}. Không sửa cột "Mã HS" và "Họ và tên".`,
      '2. Điểm từ 0 đến 10, có thể dùng số thập phân (ví dụ 8.5 hoặc 8,5).',
      np && autoAvg ? '3. Điểm chung được hệ thống tự tính bằng trung bình các cột thành phần, không cần điền.' : '3. Để trống điểm nếu học sinh vắng hoặc chưa chấm.',
      '4. Lưu file rồi chọn "Nhập từ Excel" trên màn hình Đánh giá.',
    ]);
    await saveBook(wb, `Mau_nhap_diem_${slug(cls.code)}.xlsx`);
  });

  X.parseScores = async (file, parts = []) => {
    const rows = rowsOf(await X.read(file));
    const hi = headerIndex(rows, (h) => h.some((x) => x.includes('diem')) && h.some((x) => x.includes('ma hs') || x.includes('ho va ten')));
    if (hi < 0) throw new Error('File không đúng mẫu. Hãy dùng "Tải file mẫu" của hệ thống.');
    const h = rows[hi], hn = h.map((x) => U.norm(x));
    const iCode = findCol(h, 'ma hs', 'ma hoc sinh');
    const iName = findCol(h, 'ho va ten', 'ho ten');
    const pIdx = parts.map((p) => hn.findIndex((x) => x === U.norm(p.name)));
    const iScore = hn.findIndex((x, k) => /^diem/.test(x) && !pIdx.includes(k));
    const iCmt = findCol(h, 'nhan xet');
    return rows.slice(hi + 1).map((r) => ({
      code: iCode >= 0 ? String(r[iCode] || '').trim() : '',
      name: iName >= 0 ? String(r[iName] || '').trim() : '',
      score: iScore >= 0 ? String(r[iScore] ?? '').trim().replace(',', '.') : '',
      parts: Object.fromEntries(parts.map((p, k) => [p.id, pIdx[k] >= 0 ? String(r[pIdx[k]] ?? '').trim().replace(',', '.') : ''])),
      comment: iCmt >= 0 ? String(r[iCmt] || '').trim() : '',
    }));
  };

  const scoreColor = (v) => (typeof v !== 'number' ? undefined : v >= 8 ? 'FF0E7A3E' : v >= 6.5 ? 'FF1F6FEB' : v >= 5 ? 'FFB45309' : 'FFC62828');
  const avgOf = (a) => { const n = a.filter((x) => typeof x === 'number'); return n.length ? Math.round((n.reduce((s, x) => s + x, 0) / n.length) * 100) / 100 : ''; };

  X.exportScores = safe(async (cls, a, students) => {
    const wb = newBook();
    const parts = a.parts || [], np = parts.length;
    const vals = students.map((s) => (a.scores && a.scores[s.id] != null ? Number(a.scores[s.id]) : ''));
    const pv = (s, p) => (a.partScores && a.partScores[s.id] && a.partScores[s.id][p.id] != null ? Number(a.partScores[s.id][p.id]) : '');
    addSheet(wb, {
      name: 'Điểm', title: 'BẢNG ĐIỂM ĐÁNH GIÁ', landscape: np > 3,
      info: [`Lớp: ${cls.name} (${cls.code})`, `Bài đánh giá: ${a.title} · Ngày ${U.fmtDate(a.date)}`],
      cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Mã HS', w: 22 }, { h: 'Họ và tên', w: 28, bold: true },
        ...parts.map((p) => ({ h: p.name, w: 11, align: 'center', fmt: '0.0#', color: scoreColor })),
        { h: np ? 'Điểm chung' : 'Điểm', w: 11, align: 'center', fmt: '0.0#', bold: true, color: scoreColor }, { h: 'Nhận xét', w: 52, wrap: true }],
      rows: students.map((s, i) => [i + 1, s.code || '', s.name, ...parts.map((p) => pv(s, p)), vals[i], (a.comments && a.comments[s.id]) || '']),
      total: ['', '', 'Điểm trung bình lớp', ...parts.map((p) => avgOf(students.map((s) => pv(s, p)))), avgOf(vals), ''], signature: true,
    });
    await saveBook(wb, `Diem_${slug(cls.code)}_${a.date}.xlsx`);
  });

  X.exportScoreMatrix = safe(async (cls, assessments, students) => {
    const wb = newBook();
    const rows = students.map((s, i) => {
      const v = assessments.map((a) => (a.scores && a.scores[s.id] != null && a.scores[s.id] !== '' ? Number(a.scores[s.id]) : ''));
      return [i + 1, s.code || '', s.name, ...v, avgOf(v)];
    });
    const colAvg = assessments.map((_, j) => avgOf(rows.map((r) => r[3 + j])));
    addSheet(wb, {
      name: 'Tổng hợp điểm', title: 'TỔNG HỢP ĐIỂM ĐÁNH GIÁ', info: [`Lớp: ${cls.name} (${cls.code}) · ${assessments.length} bài đánh giá`],
      cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Mã HS', w: 20 }, { h: 'Họ và tên', w: 28, bold: true },
        ...assessments.map((a) => ({ h: `${a.title}\n${U.shortDate(a.date)}`, w: 16, align: 'center', fmt: '0.0#', color: scoreColor })),
        { h: 'Điểm TB', w: 11, align: 'center', fmt: '0.0#', bold: true, color: scoreColor }],
      rows, total: ['', '', 'Trung bình lớp', ...colAvg, avgOf(rows.map((r) => r[r.length - 1]))], freezeCols: 3,
      notes: ['File này dùng được làm mẫu để nhập lại điểm nhiều bài kiểm tra cùng lúc: mỗi cột là một bài, tiêu đề cột gồm tên bài, xuống dòng, rồi ngày/tháng.'],
    });
    await saveBook(wb, `Tong_hop_diem_${slug(cls.code)}.xlsx`);
  });

  /* ===== Điểm danh tháng ===== */
  X.exportAttendance = safe(async (cls, month, students, dates, docsByDate, opt = {}) => {
    const wb = newBook();
    const mark = (v) => (v === 'V' ? 'FFC62828' : 'FF0E7A3E');
    const rows = students.map((s, i) => {
      let p = 0, a = 0;
      const cells = dates.map((d) => {
        const v = docsByDate[d] && docsByDate[d].records && docsByDate[d].records[s.id];
        if (v === true) { p++; return '✓'; }
        if (v === false) { a++; return 'V'; }
        return '';
      });
      return [i + 1, s.code || '', s.name, ...cells, p, a];
    });
    addSheet(wb, {
      name: 'Điểm danh', title: `BẢNG ĐIỂM DANH ${opt.label || U.monthLabel(month).toUpperCase()}`,
      info: [`Lớp: ${cls.name} (${cls.code}) · ${U.scheduleText(cls)}`, `Giáo viên: ${App.teacherName(cls.teacherId)}${cls.assistantId ? ' · Trợ giảng: ' + App.teacherName(cls.assistantId) : ''}`],
      cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Mã HS', w: 20 }, { h: 'Họ và tên', w: 28, bold: true },
        ...dates.map((d) => ({ h: `${U.dayShort(U.parse(d).getDay())}\n${U.shortDate(d)}`, w: 8, align: 'center', color: mark, bold: true })),
        { h: 'Có mặt', w: 9, align: 'center', color: () => 'FF0E7A3E', bold: true }, { h: 'Vắng', w: 9, align: 'center', color: (v) => (v > 0 ? 'FFC62828' : 'FF8A97AD'), bold: true }],
      rows, freezeCols: 3, notes: ['Ghi chú: ✓ = có mặt, V = vắng, ô trống = chưa điểm danh. File này dùng được làm mẫu để nhập lại điểm danh (✓ hoặc x = có mặt, V = vắng).'], signature: true,
    });
    await saveBook(wb, `Diem_danh_${slug(cls.code)}_${opt.file || month}.xlsx`);
  });

  /* ===== Lương giáo viên ===== */
  X.exportPayroll = safe(async (rows, month) => {
    const wb = newBook();
    const red = (v) => (v > 0 ? 'FFC62828' : undefined);
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
    addSheet(wb, {
      name: 'Tổng hợp', title: `BẢNG TỔNG HỢP TIỀN GIÁO VIÊN ${U.monthLabel(month).toUpperCase()}`,
      info: ['Thành tiền = số tiết đã dạy × đơn giá mỗi tiết.'],
      cols: [{ h: 'STT', w: 6, align: 'center' }, { h: 'Giáo viên', w: 26, bold: true }, { h: 'Số buổi dạy', w: 11, align: 'center' }, { h: 'Nghỉ cả buổi', w: 11, align: 'center', color: red },
        { h: 'Tiết theo lịch', w: 11, align: 'center' }, { h: 'Tiết nghỉ', w: 10, align: 'center', color: red }, { h: 'Tiết đã dạy', w: 11, align: 'center', bold: true },
        { h: 'Thành tiền', w: 16, fmt: MONEY, bold: true },
        { h: 'Trạng thái', w: 12, align: 'center', color: (v) => (v === 'Đã trả' ? 'FF0E7A3E' : 'FFB45309') }],
      rows: rows.map((r, i) => [i + 1, r.teacher.name, r.sessions, r.absent, r.planned, r.off, r.periods, r.amount, r.paid ? 'Đã trả' : 'Chưa trả']),
      total: ['', 'TỔNG CỘNG', sum((r) => r.sessions), sum((r) => r.absent), sum((r) => r.planned), sum((r) => r.off), sum((r) => r.periods), sum((r) => r.amount), ''],
      signature: true,
    });
    const det = [];
    rows.forEach((r) => Object.values(r.lines).forEach((l) => det.push([r.teacher.name, `${l.cls.name} (${l.cls.code})`, U.roleName(l.role), l.sessions, l.absent, l.planned, l.off, l.periods, l.rate, l.amount])));
    addSheet(wb, {
      name: 'Chi tiết theo lớp', title: `CHI TIẾT GIỜ DẠY THEO LỚP ${U.monthLabel(month).toUpperCase()}`,
      cols: [{ h: 'Giáo viên', w: 26, bold: true }, { h: 'Lớp', w: 30 }, { h: 'Vai trò', w: 17 }, { h: 'Số buổi dạy', w: 11, align: 'center' }, { h: 'Nghỉ cả buổi', w: 11, align: 'center', color: red },
        { h: 'Tiết theo lịch', w: 11, align: 'center' }, { h: 'Tiết nghỉ', w: 10, align: 'center', color: red }, { h: 'Tiết đã dạy', w: 11, align: 'center' },
        { h: 'Đơn giá/tiết', w: 14, fmt: MONEY }, { h: 'Thành tiền', w: 16, fmt: MONEY, bold: true }],
      rows: det,
      total: ['TỔNG', '', '', det.reduce((s, r) => s + r[3], 0), det.reduce((s, r) => s + r[4], 0), det.reduce((s, r) => s + r[5], 0), det.reduce((s, r) => s + r[6], 0), det.reduce((s, r) => s + r[7], 0), '', det.reduce((s, r) => s + r[9], 0)],
    });
    await saveBook(wb, `Luong_giao_vien_${month}.xlsx`);
  });

  /* ===== Học phí ===== */
  X.exportTuition = safe(async (rows, month, settings, opt = {}) => {
    const wb = newBook();
    const label = opt.label || U.monthLabel(month), showName = opt.showName !== false, showCode = !!opt.showCode;
    const classes = [...new Map(rows.map((r) => [r.cls.id, r.cls])).values()];
    const cols = [], gets = [], sums = [];
    const add = (c, g, sum) => { cols.push(c); gets.push(g); sums.push(!!sum); };
    add({ h: 'STT', w: 6, align: 'center' }, (r, i) => i + 1);
    add({ h: 'Mã HS', w: 22 }, (r) => r.student.code || '');
    add({ h: 'Họ và tên', w: 28, bold: true }, (r) => r.student.name);
    if (showName) add({ h: 'Lớp', w: 12, align: 'center' }, (r) => r.cls.name);
    if (showCode) add({ h: 'Mã lớp', w: 16, align: 'center' }, (r) => r.cls.code || '');
    add({ h: 'Số buổi có mặt', w: 11, align: 'center' }, (r) => r.present, true);
    add({ h: 'Số buổi vắng', w: 11, align: 'center', color: (v) => (v > 0 ? 'FFC62828' : undefined) }, (r) => r.absent, true);
    add({ h: 'Học phí', w: 15, fmt: MONEY }, (r) => r.base, true);
    add({ h: 'Giảm', w: 15, fmt: MONEY, color: (v) => (v > 0 ? 'FFC62828' : undefined) }, (r) => r.deduct, true);
    add({ h: 'Phải đóng', w: 16, fmt: MONEY, bold: true }, (r) => r.total, true);
    add({ h: 'Trạng thái', w: 12, align: 'center', color: (v) => (v === 'Đã đóng' ? 'FF0E7A3E' : 'FFB45309') }, (r) => (r.paid ? 'Đã đóng' : 'Chưa đóng'));
    const data = rows.map((r, i) => gets.map((g) => g(r, i)));
    const clsText = (c) => [showName ? c.name : '', showCode && c.code ? (showName ? `(${c.code})` : c.code) : ''].filter(Boolean).join(' ') || c.name;
    addSheet(wb, {
      name: 'Học phí', title: `BẢNG HỌC PHÍ ${label.toUpperCase()}`, info: [`Số học sinh: ${rows.length} · Đã đóng: ${rows.filter((r) => r.paid).length}`],
      cols, rows: data,
      total: cols.map((c, i) => (i === 2 ? 'TỔNG CỘNG' : sums[i] ? data.reduce((p, r) => p + (Number(r[i]) || 0), 0) : '')),
      notes: classes.map((c) => `${clsText(c)}: ${U.feeRuleText(c, settings)}`), freezeCols: 3, signature: true, printDate: opt.printDate,
    });
    await saveBook(wb, opt.file || `Hoc_phi_${month}.xlsx`);
  });

  /* Nhiều sheet trong một file: specs là danh sách spec của addSheet */
  X.exportWorkbook = safe(async (specs, filename) => {
    const wb = newBook();
    specs.forEach((sp) => addSheet(wb, sp));
    await saveBook(wb, filename);
  });

  /* Phiếu thu / phiếu báo học phí dạng Excel (sửa trực tiếp được). groups: [{ student, cls, blank?, items:[{month,total,paid,cut}] }]
   * o: { per, kind:'thu'|'bao', qr, qrSrc, due, showCode } */
  X.exportReceipts = safe(async (groups, o, settings, filename, extraSheets = []) => {
    const wb = newBook();
    extraSheets.forEach((sp) => addSheet(wb, sp)); // các sheet danh sách đặt trước sheet phiếu
    const per = o.per || 4, cols = per >= 4 ? 2 : 1, bao = o.kind === 'bao', NC = 6;
    const ws = wb.addWorksheet(bao ? 'Phiếu báo học phí' : 'Phiếu thu học phí', {
      pageSetup: { ...pageSetup(false), fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }, views: [{ showGridLines: false }],
    });
    const W = [12, 14, 12, 9, 9, 9];
    for (let k = 0; k < cols; k++) {
      W.forEach((w, i) => { ws.getColumn(1 + k * (NC + 1) + i).width = w; });
      if (k < cols - 1) ws.getColumn(NC + 1 + k * (NC + 1)).width = 2;
    }
    let imgId = null;
    if (o.qr !== false && o.qrSrc) { try { imgId = wb.addImage({ buffer: await (await fetch(o.qrSrc)).arrayBuffer(), extension: 'jpeg' }); } catch (e) { /* bỏ qua nếu không tải được ảnh */ } }
    const maxItems = Math.max(1, ...groups.map((g) => g.items.length));
    const anyOwe = groups.some((g) => g.items.length > 1 && g.items.some((r) => !r.paid) && g.items.filter((r) => !r.paid).reduce((a, r) => a + r.total, 0) !== g.items.reduce((a, r) => a + r.total, 0));
    const BLUE2 = 'FF4F8EF7', LIGHT = 'FFDFF0FF';
    const edge = { style: 'medium', color: { argb: BLUE2 } };
    const font = (size, bold, color = 'FF1B2B45', italic = false) => ({ name: 'Arial', size, bold, italic, color: { argb: color } });
    const rowsPerBlock = 4 + 1 + maxItems + 1 + (anyOwe ? 1 : 0) + 1 + 1 + 1 + 1;
    let r = 1;
    const pageRows = per / cols;
    for (let p = 0; p < groups.length; p += cols) {
      const pair = groups.slice(p, p + cols);
      const top = r;
      const heights = [20, 26, 20, bao ? 20 : 6, 22, ...Array(maxItems).fill(22), 26, ...(anyOwe ? [22] : []), 34, 34, 46, 24];
      heights.forEach((h, k) => { ws.getRow(top + k).height = h; });
      const last = top + heights.length - 1;
      pair.forEach((g, side) => {
        const c0 = 1 + side * (NC + 1);
        let q = top;
        const span = (from, to, value, f, fill, align = 'center') => {
          for (let i = from; i <= to; i++) { const c = ws.getCell(q, c0 + i - 1); if (fill) c.fill = fillBg(fill); c.alignment = { horizontal: align, vertical: 'middle', wrapText: true }; }
          ws.mergeCells(q, c0 + from - 1, q, c0 + to - 1);
          const c = ws.getCell(q, c0 + from - 1); c.value = value; c.font = f;
        };
        const nm = g.blank ? '' : g.student.name, cn = g.blank ? '' : g.cls.name;
        span(1, NC, settings.centerName, font(11, true, 'FFFFFFFF'), BLUE2); q++;
        span(1, NC, g.items.length > 1 ? (bao ? 'PHIẾU BÁO HỌC PHÍ' : 'PHIẾU THU HỌC PHÍ') : `${bao ? 'PHIẾU BÁO HỌC PHÍ' : 'PHIẾU THU HỌC PHÍ'} - ${U.monthLabel(g.items[0].month).toUpperCase()}`, font(14, true, 'FFFFFFFF'), 'FF8A7BF0'); q++;
        const who = g.blank ? '' : `${nm} · ${cn}${o.showCode !== false && g.cls.code ? ' (' + g.cls.code + ')' : ''}`;
        span(1, NC, bao ? `Kính gửi Quý phụ huynh${g.blank ? '' : ' em ' + who},` : g.blank ? '' : `Học sinh: ${who}`, font(10.5, false)); q++;
        span(1, NC, bao ? 'Trung tâm xin thông báo học phí như sau:' : '', font(10.5, false)); q++;
        const tableTop = q;
        ['Tháng', 'Phải đóng', 'Tình trạng'].forEach((h, i) => { const c = ws.getCell(q, c0 + i); c.value = h; c.font = font(10, true, 'FF1B4F86'); c.fill = fillBg(LIGHT); c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = border; });
        q++;
        for (let k = 0; k < maxItems; k++) {
          const it = g.items[k];
          const vals = it ? [U.monthLabel(it.month).replace('Tháng ', 'T') + (it.cut ? ` (đến ${U.fmtDate(it.cut).slice(0, 5)})` : ''), it.total, it.paid ? 'Đã đóng' : 'Chưa đóng'] : ['', '', ''];
          vals.forEach((v, i) => { const c = ws.getCell(q, c0 + i); c.value = v === '' ? null : v; c.font = font(10.5, i === 1, i === 2 ? (it && it.paid ? 'FF0E7A3E' : 'FFD9730D') : 'FF1B2B45'); c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = border; if (i === 1) c.numFmt = MONEY; });
          q++;
        }
        const tot = g.items.reduce((a, it) => a + it.total, 0), owe = g.items.filter((it) => !it.paid).reduce((a, it) => a + it.total, 0), multi = g.items.length > 1;
        const totRow = (label, val, fill) => {
          for (let i = 1; i <= 3; i++) { const c = ws.getCell(q, c0 + i - 1); c.fill = fillBg(fill); c.border = border; c.alignment = { horizontal: 'center', vertical: 'middle' }; }
          ws.mergeCells(q, c0, q, c0 + 1);
          const a = ws.getCell(q, c0); a.value = label; a.font = font(10.5, true, 'FF7A2250');
          const b = ws.getCell(q, c0 + 2); b.value = val; b.numFmt = MONEY; b.font = font(11, true, 'FF7A2250'); q++;
        };
        totRow(multi ? 'TỔNG CỘNG' : 'SỐ TIỀN PHẢI ĐÓNG', tot, 'FFFFE58A');
        if (anyOwe) { if (multi && owe !== tot) totRow('CÒN PHẢI ĐÓNG', owe, 'FFFFD9B0'); else q++; }
        span(1, 3, o.due ? `PH vui lòng hoàn thành học phí trước ngày ${U.fmtDate(o.due).slice(0, 5)} để Công ty hoàn thành việc quyết toán thuế.` : '', font(9.5, false, 'FF8A1F11')); q++;
        span(1, 3, 'Trân trọng cảm ơn Quý phụ huynh!', font(10.5, true, 'FFC2185B'));
        for (let i = 4; i <= 6; i++) { const c = ws.getCell(q, c0 + i - 1); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }
        ws.mergeCells(q, c0 + 3, q, c0 + 5);
        const cap = ws.getCell(q, c0 + 3); cap.value = o.qr !== false ? 'Quý PH có thể đóng HP qua tài khoản trên hoặc đóng trực tiếp' : ''; cap.font = font(8.5, true, 'FF1B4F86'); q++;
        // chỗ ký
        ws.mergeCells(q, c0, q, c0 + 2); ws.mergeCells(q, c0 + 3, q, c0 + 5);
        const s1 = ws.getCell(q, c0), s2 = ws.getCell(q, c0 + 3);
        s1.value = bao ? '' : 'Phụ huynh\n(ký, ghi rõ họ tên)'; s2.value = bao ? 'Trung tâm\n(ký, đóng dấu)' : 'Người thu tiền\n(ký, ghi rõ họ tên)';
        [s1, s2].forEach((c) => { c.font = font(9, false, 'FF1B2B45', true); c.alignment = { horizontal: 'center', vertical: 'top', wrapText: true }; });
        q++;
        // dòng ghi chú để tự điền
        ws.mergeCells(q, c0 + 1, q, c0 + NC - 1);
        const nt = ws.getCell(q, c0); nt.value = 'Note:'; nt.font = font(10, true); nt.alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 };
        for (let i = 2; i <= NC; i++) ws.getCell(q, c0 + i - 1).border = { bottom: { style: 'dotted', color: { argb: 'FF6B7A90' } } };
        // khung viền
        for (let rr = top; rr <= last; rr++) for (let cc = 1; cc <= NC; cc++) {
          const cell = ws.getCell(rr, c0 + cc - 1), bd = { ...(cell.border || {}) };
          if (cc === 1) bd.left = edge; if (cc === NC) bd.right = edge; if (rr === top) bd.top = edge; if (rr === last) bd.bottom = edge;
          cell.border = bd;
        }
        if (imgId !== null) ws.addImage(imgId, { tl: { col: c0 + 2.95, row: tableTop - 1 + 0.1 }, ext: { width: 118, height: 131 } });
      });
      r = last + 2; ws.getRow(last + 1).height = 10;
      if (((p / cols) + 1) % pageRows === 0 && p + cols < groups.length) ws.getRow(last + 1).addPageBreak();
    }
    ws.pageSetup.printArea = `A1:${ws.getColumn(cols * (NC + 1) - 1).letter}${r}`;
    await saveBook(wb, filename);
  });

  /* ===== Phiếu theo từng học sinh: bảng kết quả học tập (dạng dọc) & giấy chứng nhận ===== */
  const usedNames = () => new Set();
  const sheetName = (name, used) => {
    const base = String(name).replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 27) || 'HS';
    let n = base, i = 2;
    while (used.has(n.toLowerCase())) n = base.slice(0, 24) + ' ' + i++;
    used.add(n.toLowerCase());
    return n;
  };
  const fillBg = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const scoreCol = (v) => (typeof v !== 'number' ? 'FF1B2B45' : v >= 8 ? 'FF0E7A3E' : v >= 6.5 ? 'FF1F6FEB' : v >= 5 ? 'FFB45309' : 'FFC62828');

  /* card: { center, student, cls, teacherName, subtitle, tests:[{title,date,score,comment}], showComments, avg, att:{present,absent,total,rate}|null, tuition:{month,base,deduct,total,paid}|null, showCode, showTeacher } */
  X.exportResultCards = safe(async (cards, filename) => {
    const wb = newBook();
    const used = usedNames();
    cards.forEach((c) => {
      const ws = wb.addWorksheet(sheetName(c.student.name, used), { pageSetup: pageSetup(false), views: [{ showGridLines: false }] });
      const n = c.showComments ? 3 : 2;
      [30, 12, c.showComments ? 34 : 3].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      let r = 1;
      const centered = (text, font, h) => {
        for (let i = 1; i <= n; i++) ws.getCell(r, i).alignment = { horizontal: 'centerContinuous', vertical: 'middle' };
        const cell = ws.getCell(r, 1); cell.value = text; cell.font = font;
        if (h) ws.getRow(r).height = h;
        r++;
      };
      const bar = (text) => {
        for (let i = 1; i <= n; i++) { const cell = ws.getCell(r, i); cell.fill = fillBg(NAVY); cell.border = border; }
        const cell = ws.getCell(r, 1); cell.value = text; cell.font = { name: FONT, bold: true, size: 9.5, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle' }; ws.getRow(r).height = 18; r++;
      };
      const pair = (label, value, o = {}) => {
        const a = ws.getCell(r, 1), b = ws.getCell(r, 2);
        a.value = label; a.font = { name: FONT, size: 10, bold: !!o.bold, color: { argb: 'FF1B2B45' } };
        b.value = value === '' || value === undefined ? null : value;
        b.font = { name: FONT, size: 10, bold: true, color: { argb: o.color || 'FF1B2B45' } };
        b.alignment = { horizontal: o.left ? 'left' : 'center', vertical: 'middle' };
        a.alignment = { vertical: 'middle', indent: 1 };
        if (o.fmt) b.numFmt = o.fmt;
        for (let i = 1; i <= n; i++) { const cell = ws.getCell(r, i); cell.border = border; if (o.fill) cell.fill = fillBg(o.fill); else if (o.zebra) cell.fill = fillBg(ZEBRA); }
        ws.getRow(r).height = 17; r++;
      };
      const gap = () => { ws.getRow(r).height = 6; r++; };

      centered(c.center.toUpperCase(), { name: FONT, bold: true, size: 10, color: { argb: BLUE } }, 15);
      centered(c.title || 'BẢNG KẾT QUẢ HỌC TẬP', { name: FONT, bold: true, size: 14, color: { argb: NAVY } }, 24);
      centered(c.subtitle, { name: FONT, size: 9, italic: true, color: { argb: GRAYTXT } }, 15);
      gap();
      pair('Họ tên học sinh', c.student.name, { bold: true, left: true, fill: TOTAL });
      if (c.showCode && c.student.code) pair('Mã học sinh', c.student.code, { left: true });
      pair('Lớp', `${c.cls.name} (${c.cls.code})`, { left: true });
      if (c.showTeacher && c.teacherName) pair('Giáo viên', c.teacherName, { left: true });
      gap();
      if (c.tests.length || c.avg !== null && c.avg !== undefined && c.avg !== false) {
        bar('KẾT QUẢ CÁC BÀI KIỂM TRA');
        if (c.tests.length) {
          const hr = ws.getRow(r); hr.height = 17;
          ['Bài kiểm tra', 'Điểm', 'Nhận xét'].slice(0, n).forEach((t, i) => {
            const cell = hr.getCell(i + 1); cell.value = t; cell.font = { name: FONT, bold: true, size: 9.5, color: { argb: NAVY } };
            cell.fill = fillBg('FFDCE8FB'); cell.border = border; cell.alignment = { horizontal: i === 1 ? 'center' : 'left', vertical: 'middle', indent: i === 1 ? 0 : 1 };
          });
          r++;
        }
        c.tests.forEach((t, i) => {
          const a = ws.getCell(r, 1), b = ws.getCell(r, 2);
          a.value = `${t.title} (${U.shortDate(t.date)})`; a.font = { name: FONT, size: 10 }; a.alignment = { vertical: 'middle', indent: 1 };
          b.value = typeof t.score === 'number' ? t.score : null; b.numFmt = '0.0#'; b.font = { name: FONT, size: 10.5, bold: true, color: { argb: scoreCol(t.score) } }; b.alignment = { horizontal: 'center', vertical: 'middle' };
          if (c.showComments) { const d = ws.getCell(r, 3); d.value = t.comment || null; d.font = { name: FONT, size: 9, italic: true, color: { argb: GRAYTXT } }; d.alignment = { vertical: 'middle', wrapText: true, indent: 1 }; }
          for (let k = 1; k <= n; k++) { const cell = ws.getCell(r, k); cell.border = border; if (i % 2) cell.fill = fillBg(ZEBRA); }
          ws.getRow(r).height = t.comment && t.comment.length > 42 ? 26 : 17; r++;
        });
        if (c.avg !== null && c.avg !== undefined && c.avg !== false) pair('Điểm trung bình', c.avg === '' ? null : c.avg, { bold: true, fill: TOTAL, fmt: '0.0#', color: scoreCol(c.avg) });
        gap();
      }
      if (c.att) {
        bar('CHUYÊN CẦN');
        if (c.att.showPresent) pair('Số buổi đi học', c.att.present, { color: 'FF0E7A3E' });
        if (c.att.showAbsent) pair('Số buổi vắng', c.att.absent, { color: c.att.absent > 0 ? 'FFC62828' : undefined, zebra: true });
        if (c.att.showRate && c.att.rate !== '') pair('Tỷ lệ chuyên cần', c.att.rate / 100, { fmt: '0%' });
        gap();
      }
      if (c.tuition) {
        bar(`HỌC PHÍ ${U.monthLabel(c.tuition.month).toUpperCase()}`);
        if (c.tuition.showBase) pair('Học phí của lớp', c.tuition.base, { fmt: MONEY });
        if (c.tuition.showDeduct) pair('Giảm / trừ', c.tuition.deduct, { fmt: MONEY, zebra: true, color: c.tuition.deduct > 0 ? 'FFC62828' : undefined });
        if (c.tuition.showTotal) pair('Số tiền phải đóng', c.tuition.total, { fmt: MONEY, bold: true, fill: TOTAL });
        if (c.tuition.showPaid) pair('Trạng thái', c.tuition.paid ? 'Đã đóng' : 'Chưa đóng', { color: c.tuition.paid ? 'FF0E7A3E' : 'FFB45309' });
        gap();
      }
      gap();
      // chữ ký
      const sig = (col, t1, t2) => { const a = ws.getCell(r, col), b = ws.getCell(r + 1, col); a.value = t1; a.font = { name: FONT, bold: true, size: 10, color: { argb: NAVY } }; a.alignment = { horizontal: 'center' }; b.value = t2; b.font = { name: FONT, italic: true, size: 8.5, color: { argb: GRAYTXT } }; b.alignment = { horizontal: 'center' }; };
      sig(1, 'Giáo viên', '(ký, ghi rõ họ tên)'); sig(n, 'Phụ huynh', '(ký, ghi rõ họ tên)');
      ws.getRow(r + 1).height = 15;
      ws.headerFooter = { oddFooter: `&L&8${c.center}${App.settings && App.settings.showPrintDate ? '&R&8Ngày xuất ' + U.fmtDate(U.today()) : ''}` };
    });
    await saveBook(wb, filename);
  });

  /*
   * Giấy chứng nhận SONG NGỮ Anh - Việt: TẤT CẢ học sinh trong 1 sheet.
   * Tờ A4 NGANG, mỗi tờ in 2 giấy xếp TRÁI - PHẢI (mỗi giấy 1/2 tờ), có khoảng trống giữa hai giấy.
   * card: { center, centerEn?, student, courseName, courseNameEn?, classCode, from, to, tests, avg, showScores, org, signerTitle, signerTitleEn?, signerName, issueDate }
   */
  X.exportCertificates = safe(async (cards, filename) => {
    const wb = newBook();
    const SERIF = 'Times New Roman', GOLD = 'FFB8860B', MAXT = 8;
    const F = 500; // chiều cao khung (point)
    const ws = wb.addWorksheet('Giấy chứng nhận', {
      pageSetup: { ...pageSetup(true), fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
      views: [{ showGridLines: false }],
    });
    // giấy trái: cột 1-6, cột 7 là khoảng trống, giấy phải: cột 8-13
    for (let i = 1; i <= 13; i++) ws.getColumn(i).width = i === 7 ? 2 : 11.3;
    const dbl = { style: 'double', color: { argb: NAVY } };
    const ink = { argb: 'FF1B2B45' };
    const thinB = { top: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };
    const span = (rr, from, to, text, font, h = 'centerContinuous') => {
      for (let i = from; i <= to; i++) ws.getCell(rr, i).alignment = { horizontal: h, vertical: 'middle', wrapText: false };
      const cell = ws.getCell(rr, from); cell.value = text; cell.font = font;
    };
    let r = 1, truncated = false;
    for (let p = 0; p < cards.length; p += 2) {
      const pair = [cards[p], cards[p + 1]].filter(Boolean);
      const T = Math.max(0, ...pair.map((c) => (c.showScores ? Math.min(MAXT, c.tests.length) : 0)));
      if (pair.some((c) => c.showScores && c.tests.length > MAXT)) truncated = true;
      const top = r;
      // chiều cao các dòng, dùng chung cho hai giấy trong cùng một tờ
      let hs = [20, 20, 16, 32, 18, 18, 34, 22, 20, 22, 20, 10];
      if (T) { hs.push(22); for (let k = 0; k < T; k++) hs.push(20); hs.push(20, 10); }
      hs.push(17, 17, 17, 15, 44, 18);
      let used = hs.reduce((a, b) => a + b, 0);
      if (used > F) { const k = F / used; hs = hs.map((h) => Math.floor(h * k)); used = hs.reduce((a, b) => a + b, 0); }
      hs.push(Math.max(2, F - used));
      hs.forEach((h, k) => { ws.getRow(top + k).height = h; });
      const last = top + hs.length - 1;
      pair.forEach((c, side) => {
        const c0 = side ? 8 : 1, c1 = c0 + 5;
        let q = top;
        const next = () => q++;
        const nl = (text, font) => span(next(), c0, c1, text, font);
        const fromT = c.from || '…………………', toT = c.to || '…………………';
        const courseEn = c.courseNameEn || U.enClass(c.courseName);
        next();
        nl(c.center.toUpperCase(), { name: SERIF, bold: true, size: 14, color: { argb: BLUE } });
        nl(c.centerEn || U.centerEn(), { name: SERIF, italic: true, size: 11, color: { argb: BLUE } });
        nl('GIẤY CHỨNG NHẬN', { name: SERIF, bold: true, size: 24, color: { argb: NAVY } });
        nl('HOÀN THÀNH KHÓA HỌC  ·  CERTIFICATE OF COURSE COMPLETION', { name: SERIF, bold: true, size: 10, color: { argb: BLUE } });
        nl('Chứng nhận học sinh / This is to certify that', { name: SERIF, italic: true, size: 11, color: { argb: GRAYTXT } });
        const nr = next();
        span(nr, c0, c1, c.student.name.toUpperCase(), { name: SERIF, bold: true, size: 20, color: { argb: 'FFB3261E' } });
        for (let i = c0 + 1; i <= c1 - 1; i++) ws.getCell(nr, i).border = { bottom: { style: 'thin', color: { argb: GOLD } } };
        nl(`Đã hoàn thành khóa học: ${c.courseName}${c.classCode ? ' (' + c.classCode + ')' : ''}`, { name: SERIF, size: 12, color: ink });
        nl(`has successfully completed the course: ${courseEn}`, { name: SERIF, italic: true, size: 11, color: ink });
        nl(`Thời gian: từ ngày ${fromT} đến ngày ${toT}`, { name: SERIF, size: 12, color: ink });
        nl(`Duration: from ${fromT} to ${toT}`, { name: SERIF, italic: true, size: 11, color: ink });
        next();
        if (T) {
          const hr = next();
          span(hr, c0, c0 + 3, 'Bài kiểm tra / Test', { name: SERIF, bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } }, 'left');
          span(hr, c0 + 4, c1, 'Điểm / Score', { name: SERIF, bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } });
          for (let i = c0; i <= c1; i++) { ws.getCell(hr, i).fill = fillBg(NAVY); ws.getCell(hr, i).border = thinB; }
          const tests = c.showScores ? c.tests.slice(0, T) : [];
          for (let k = 0; k < T; k++) {
            const row = next(), t = tests[k];
            span(row, c0, c0 + 3, t ? `${t.title} (${U.shortDate(t.date)})` : '', { name: SERIF, size: 12, color: ink }, 'left');
            const sc = t && typeof t.score === 'number' ? t.score : null;
            span(row, c0 + 4, c1, sc, { name: SERIF, bold: true, size: 12, color: { argb: scoreCol(sc) } });
            ws.getCell(row, c0 + 4).numFmt = '0.0#';
            for (let i = c0; i <= c1; i++) ws.getCell(row, i).border = thinB;
          }
          const ar = next();
          span(ar, c0, c0 + 3, 'Điểm trung bình / Average score', { name: SERIF, bold: true, size: 11.5, color: { argb: NAVY } }, 'left');
          const av = c.showScores && c.avg !== '' && c.avg !== undefined && c.avg !== null ? c.avg : null;
          span(ar, c0 + 4, c1, av, { name: SERIF, bold: true, size: 13, color: { argb: scoreCol(av) } });
          ws.getCell(ar, c0 + 4).numFmt = '0.0#';
          for (let i = c0; i <= c1; i++) { ws.getCell(ar, i).fill = fillBg(TOTAL); ws.getCell(ar, i).border = thinB; }
          next();
        }
        // khối chữ ký nằm bên phải của giấy
        const sg = (text, font) => span(next(), c0 + 2, c1, text, font);
        sg(c.issueDate || U.ISSUE_BLANK, { name: SERIF, italic: true, size: 11, color: ink });
        sg(c.org, { name: SERIF, bold: true, size: 12, color: { argb: NAVY } });
        sg(`${c.signerTitle} / ${c.signerTitleEn || U.enTitle(c.signerTitle)}`, { name: SERIF, bold: true, size: 11.5, color: { argb: NAVY } });
        sg('(ký tên, đóng dấu) / (Signature & seal)', { name: SERIF, italic: true, size: 10, color: { argb: GRAYTXT } });
        next();
        sg(c.signerName || '', { name: SERIF, bold: true, size: 12, color: { argb: NAVY } });
        // viền kép quanh khung
        for (let rr = top; rr <= last; rr++) {
          for (let col = c0; col <= c1; col++) {
            const cell = ws.getCell(rr, col), bd = { ...(cell.border || {}) };
            if (col === c0) bd.left = dbl;
            if (col === c1) bd.right = dbl;
            if (rr === top) bd.top = dbl;
            if (rr === last) bd.bottom = dbl;
            cell.border = bd;
          }
        }
      });
      r = last + 1;
      if (p + 2 < cards.length) ws.getRow(last).addPageBreak();
    }
    ws.pageSetup.printArea = `A1:M${r - 1}`;
    ws.headerFooter = { oddFooter: '' };
    await saveBook(wb, filename);
    if (truncated) U.toast(`Mỗi giấy chỉ hiển thị tối đa ${MAXT} bài kiểm tra đầu tiên.`, 'ok');
  });

  /* ===== Bảng tuỳ chọn cột (báo cáo học sinh) ===== */
  X.exportTable = safe(async (spec, filename) => {
    const wb = newBook();
    addSheet(wb, spec);
    await saveBook(wb, filename);
  });

  /* ===== Nhập điểm danh học sinh từ bảng ✓ / V ===== */
  const PRESENT = ['✓', '✔', 'x', '1', 'c', 'co', 'có', 'p', 'có mặt', 'đi học'];
  const ABSENT = ['v', 'vắng', 'vang', '0', 'a', 'k', 'không', 'khong', '-', '✗', '✘', 'nghỉ', 'nghi'];
  const dateCols = (h) => h.map((x, i) => { const m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(String(x)); return m ? { i, d: +m[1], m: +m[2] } : null; }).filter(Boolean);

  X.parseAttendanceGrid = async (file, month) => {
    const rows = rowsOf(await X.read(file));
    const hi = headerIndex(rows, (h) => h.some((x) => x.includes('ho va ten')) && h.some((x) => /\d+\s*\/\s*\d+/.test(x)));
    if (hi < 0) throw new Error('Không tìm thấy bảng điểm danh. Hãy dùng "Tải file mẫu / xuất Excel" của hệ thống rồi điền ✓ hoặc V.');
    const h = rows[hi];
    const iName = findCol(h, 'ho va ten', 'ho ten'), iCode = findCol(h, 'ma hs');
    const year = Number(month.slice(0, 4));
    const cols = dateCols(h).map((c) => ({ ...c, date: `${year}-${U.pad(c.m)}-${U.pad(c.d)}` }));
    const skipped = cols.filter((c) => c.date.slice(0, 7) !== month).map((c) => c.date);
    const use = cols.filter((c) => c.date.slice(0, 7) === month);
    const out = [];
    rows.slice(hi + 1).forEach((r, k) => {
      const name = String(r[iName] || '').trim();
      if (!name || /^ghi chu/.test(U.norm(name))) return;
      const marks = {};
      use.forEach((c) => {
        const v = String(r[c.i] === undefined ? '' : r[c.i]).trim().toLowerCase();
        if (!v) return;
        if (PRESENT.includes(v)) marks[c.date] = true; else if (ABSENT.includes(v)) marks[c.date] = false;
      });
      out.push({ line: hi + k + 2, name, code: iCode >= 0 ? String(r[iCode] || '').trim() : '', marks });
    });
    return { rows: out, dates: use.map((c) => c.date), skipped };
  };

  /* ===== Nhập bảng điểm nhiều bài kiểm tra ===== */
  X.parseScoreMatrix = async (file) => {
    const rows = rowsOf(await X.read(file));
    const hi = headerIndex(rows, (h) => h.some((x) => x.includes('ho va ten')) && h.some((x) => x.includes('diem tb') || x.includes('diem trung binh')));
    if (hi < 0) throw new Error('Không đúng mẫu. Hãy dùng "Tải bảng tổng hợp" của hệ thống (có cột Điểm TB) làm mẫu.');
    const h = rows[hi];
    const iName = findCol(h, 'ho va ten', 'ho ten'), iCode = findCol(h, 'ma hs'), iAvg = findCol(h, 'diem tb', 'diem trung binh');
    const tests = [];
    h.forEach((x, i) => {
      if (i === iName || i === iCode || i === iAvg || /^stt$/.test(U.norm(x))) return;
      const parts = String(x).split(/\n/).map((t) => t.trim());
      const m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(parts[parts.length - 1] || '');
      if (!m || parts.length < 2) return;
      tests.push({ i, title: parts.slice(0, -1).join(' '), d: +m[1], m: +m[2] });
    });
    if (!tests.length) throw new Error('Không thấy cột bài kiểm tra nào (tiêu đề cột cần có dạng "Tên bài", xuống dòng, "ngày/tháng").');
    const students = [];
    rows.slice(hi + 1).forEach((r) => {
      const name = String(r[iName] || '').trim();
      if (!name || /^(trung binh|ghi chu)/.test(U.norm(name))) return;
      students.push({ name, code: iCode >= 0 ? String(r[iCode] || '').trim() : '', scores: tests.map((t) => String(r[t.i] === undefined ? '' : r[t.i]).trim().replace(',', '.')) });
    });
    return { tests, students };
  };

  /* ===== Nhập trạng thái đóng học phí ===== */
  X.parseTuition = async (file) => {
    const rows = rowsOf(await X.read(file));
    const hi = headerIndex(rows, (h) => h.some((x) => x.includes('trang thai')) && h.some((x) => x.includes('ho va ten')));
    if (hi < 0) throw new Error('Không đúng mẫu. Hãy dùng file "Xuất Excel" của màn hình Học phí, điền cột Trạng thái là "Đã đóng" hoặc "Chưa đóng".');
    const h = rows[hi];
    const iName = findCol(h, 'ho va ten'), iCode = findCol(h, 'ma hs'), iSt = findCol(h, 'trang thai');
    return rows.slice(hi + 1).map((r) => ({
      name: String(r[iName] || '').trim(), code: iCode >= 0 ? String(r[iCode] || '').trim() : '',
      paid: /^(da (dong|thu|nop)|dong|paid|x)$/.test(U.norm(r[iSt])),
      unpaid: /^chua/.test(U.norm(r[iSt])),
    })).filter((r) => r.name && (r.paid || r.unpaid));
  };

  /* ===== Chấm công giáo viên theo ngày (số tiết mỗi buổi) ===== */
  X.exportTeacherGrid = safe(async (entries, month, dates) => {
    const wb = newBook();
    const rows = entries.map((e) => {
      let total = 0;
      const cells = dates.map((d) => {
        const r = e.byDate[d];
        if (!r) return '';
        if (r.present) { total += Number(r.periods) || 0; return Number(r.periods) || 0; }
        return 'V';
      });
      return [e.cls.code, e.cls.name, e.name, U.roleName(e.role), ...cells, total];
    });
    addSheet(wb, {
      name: 'Chấm công GV', title: `BẢNG CHẤM CÔNG GIÁO VIÊN ${U.monthLabel(month).toUpperCase()}`,
      info: ['Mỗi ô là số tiết giáo viên đã dạy trong buổi đó (ô trống = chưa điểm danh, V = nghỉ không dạy).'],
      cols: [{ h: 'Mã lớp', w: 14, align: 'center' }, { h: 'Lớp', w: 12 }, { h: 'Giáo viên', w: 26, bold: true }, { h: 'Vai trò', w: 16 },
        ...dates.map((d) => ({ h: `${U.dayShort(U.parse(d).getDay())}\n${U.shortDate(d)}`, w: 8, align: 'center', color: (v) => (v === 'V' ? 'FFC62828' : 'FF0E7A3E'), bold: true })),
        { h: 'Tổng tiết', w: 11, align: 'center', bold: true }],
      rows, freezeCols: 3, notes: ['File này dùng được làm mẫu để nhập lại chấm công: điền số tiết đã dạy vào ô của buổi học (ví dụ 2), hoặc V nếu nghỉ.'],
    });
    await saveBook(wb, `Cham_cong_giao_vien_${month}.xlsx`);
  });

  X.parseTeacherGrid = async (file, month) => {
    const rows = rowsOf(await X.read(file));
    const hi = headerIndex(rows, (h) => h.some((x) => x.includes('ma lop')) && h.some((x) => x.includes('giao vien')));
    if (hi < 0) throw new Error('Không đúng mẫu. Hãy dùng "Tải mẫu chấm công" của hệ thống.');
    const h = rows[hi];
    const iCls = findCol(h, 'ma lop'), iT = findCol(h, 'giao vien');
    const year = Number(month.slice(0, 4));
    const cols = dateCols(h).map((c) => ({ ...c, date: `${year}-${U.pad(c.m)}-${U.pad(c.d)}` })).filter((c) => c.date.slice(0, 7) === month);
    return rows.slice(hi + 1).map((r, k) => {
      const cells = {};
      cols.forEach((c) => {
        const v = String(r[c.i] === undefined ? '' : r[c.i]).trim().toLowerCase().replace(',', '.');
        if (!v) return;
        if (v === 'v' || v === 'nghỉ' || v === 'nghi') cells[c.date] = 'V'; else if (!isNaN(Number(v))) cells[c.date] = Number(v);
      });
      return { line: hi + k + 2, classCode: String(r[iCls] || '').trim(), teacher: String(r[iT] || '').trim(), cells };
    }).filter((r) => r.classCode && r.teacher);
  };
})();
