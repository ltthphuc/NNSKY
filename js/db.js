/*
 * Lớp dữ liệu: cùng một giao diện cho 2 chế độ
 *  - "demo": lưu trong localStorage của trình duyệt (dùng thử, có dữ liệu mẫu)
 *  - "firebase": Firebase Authentication + Cloud Firestore
 * Bộ sưu tập: users, classes, students, attendance, assessments, payments, settings
 */
(function () {
  const COLS = ['users', 'classes', 'students', 'attendance', 'assessments', 'payments', 'settings', 'teacherAttendance', 'payouts'];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const DB = (window.DB = { mode: 'demo', me: null });

  /* Với giáo viên, mọi truy vấn phải kèm teacherId == uid (khớp với Firestore Rules) */
  DB.isAdmin = () => !!DB.me && DB.me.role === 'admin';
  DB.scope = () => (DB.isAdmin() ? [] : [['teacherIds', 'array-contains', DB.me.uid]]);
  DB.q = (col, extra = []) => DB.list(col, [...DB.scope(), ...extra]);

  const authMsg = (e) => {
    const c = e && e.code ? e.code : '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
    if (/too-many-requests/.test(c)) return new Error('Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút.');
    if (/email-already-in-use/.test(c)) return new Error('Tên đăng nhập này đã có tài khoản, hãy chọn tên khác.');
    if (/requires-recent-login/.test(c)) return new Error('Vui lòng đăng xuất, đăng nhập lại rồi thử lại.');
    if (/weak-password/.test(c)) return new Error('Mật khẩu quá yếu (tối thiểu 6 ký tự).');
    if (/network/.test(c)) return new Error('Mất kết nối mạng.');
    if (/permission-denied/.test(c)) return new Error('Không có quyền thực hiện thao tác này.');
    return e instanceof Error ? e : new Error(String(e));
  };

  /* =====================================================================
   *  CHẾ ĐỘ DÙNG THỬ (localStorage)
   * ===================================================================== */
  const Demo = (() => {
    const KEY = 'sky_demo_v7', SKEY = 'sky_demo_session_v7';
    let store = null, listener = null;

    function seed() {
      let r = 12345;
      const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
      const hk1 = m >= 8 || m === 1;
      const sy = m >= 8 ? y : y - 1;
      const yy = String(sy).slice(2) + String(sy + 1).slice(2);
      const term = hk1 ? 'HK1' : 'HK2';
      const startDate = hk1 ? `${sy}-09-01` : `${sy + 1}-01-20`;
      const endDate = hk1 ? `${sy + 1}-01-15` : `${sy + 1}-05-31`;

      const s = { users: {}, classes: {}, students: {}, attendance: {}, assessments: {}, payments: {}, settings: {}, teacherAttendance: {}, payouts: {} };
      s.settings.main = { ...U.DEFAULT_SETTINGS };
      s.users.u_admin = { name: 'Quản trị Sky', email: 'admin@sky.vn', phone: '0900000001', role: 'admin', active: true, password: 'admin123' };
      s.users.u_gv1 = { name: 'Cô Nguyễn Thu Lan', email: 'gv1@sky.vn', phone: '0912345601', role: 'teacher', active: true, password: '123456', rateMain: 120000, rateAssistant: 70000 };
      s.users.u_gv2 = { name: 'Thầy Trần Quang Minh', email: 'gv2@sky.vn', phone: '0912345602', role: 'teacher', active: true, password: '123456', rateMain: 130000, rateAssistant: 70000 };
      s.users.u_gv3 = { name: 'Cô Lê Hà My', email: 'gv3@sky.vn', phone: '0912345603', role: 'teacher', active: true, password: '123456', rateMain: 120000, rateAssistant: 70000 };

      const plan = [
        [1, [1, 3], '17:30', '19:00', 'u_gv1', ''],
        [2, [2, 4], '17:30', '19:00', 'u_gv1', ''],
        [3, [2, 4], '17:30', '19:00', 'u_gv2', 'u_gv1'],
        [4, [1, 3], '17:30', '19:00', 'u_gv3', 'u_gv2'],
        [5, [2, 5], '17:30', '19:00', 'u_gv3', ''],
      ];
      const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý'];
      const dem = ['Minh', 'Gia', 'Bảo', 'Thùy', 'Ngọc', 'Hoàng', 'Anh', 'Khánh', 'Thanh', 'Đức', 'Phương', 'Tuấn'];
      const ten = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khoa', 'Linh', 'Nam', 'Phúc', 'Quân', 'Trang', 'Vy', 'Yến', 'Hân', 'Long', 'Nhi', 'Sơn', 'Thảo'];
      plan.forEach(([g, days, st, en, t, ta]) => {
        const id = 'c_' + g;
        const code = ['SKY-4HQ7M', 'SKY-9TR2X', 'SKY-6WD3B', 'SKY-2NF8K', 'SKY-7PC5Z'][g - 1];
        const tids = [t, ta].filter(Boolean);
        const slots = days.map((dd, i) => (g === 3 ? { day: dd, start: i ? '14:00' : '08:00', end: i ? '15:30' : '09:30', periods: 2 } : { day: dd, start: st, end: en, periods: 2 }));
        s.classes[id] = { code, name: `Lớp ${g}`, grade: g, term, schoolYear: `${sy}-${sy + 1}`, days, slots, start: slots[0].start, end: slots[0].end, startDate, endDate, fee: 400000, teacherId: t, assistantId: ta, teacherIds: tids, periods: 2, feeMode: g === 2 ? 'attend' : 'absence', sessionRate: 50000, status: 'open' };
        const n = 7 + (g % 3);
        const used = new Set();
        for (let i = 1; i <= n; i++) {
          let name;
          do { name = `${pick(ho)} ${pick(dem)} ${pick(ten)}`; } while (used.has(name));
          used.add(name);
          const sid = `s_${g}_${i}`;
          s.students[sid] = {
            name, classId: id, teacherId: t, teacherIds: tids, code: `${code}-${U.pad(i)}`, status: 'active',
            phone: '09' + String(Math.floor(10000000 + rnd() * 89999999)), cccd: i === 1 ? '079318000123' : '', note: '',
            startDate: g === 3 && i === 2 ? `${y}-${U.pad(m)}-15` : '',
          };
        }
        // điểm danh mẫu từ 45 ngày trước đến hôm nay
        const from = new Date(); from.setDate(from.getDate() - 45);
        U.sessions(s.classes[id], [U.ymd(from), startDate].sort().pop(), U.today()).forEach((d) => {
          const records = {};
          Object.entries(s.students).filter(([, v]) => v.classId === id).forEach(([sid, v]) => { if (v.startDate && d < v.startDate) return; records[sid] = rnd() > 0.14; });
          s.attendance[`${id}_${d}`] = { classId: id, teacherId: t, teacherIds: tids, date: d, records, updatedBy: 'Dữ liệu mẫu' };
          const tr = { [t]: { present: true, periods: rnd() > 0.9 ? 1 : 2, planned: 2 } };
          if (ta) tr[ta] = { present: rnd() > 0.1, periods: 2, planned: 2 };
          s.teacherAttendance[`${id}_${d}`] = { classId: id, teacherId: t, teacherIds: tids, date: d, records: tr, updatedBy: 'Dữ liệu mẫu' };
        });
      });
      // một bài đánh giá mẫu cho lớp 3
      const c3 = s.classes.c_3;
      const sess = U.sessions(c3, startDate, U.today());
      if (sess.length > 2) {
        const scores = {}, comments = {};
        Object.keys(s.students).filter((k) => s.students[k].classId === 'c_3').forEach((k) => {
          scores[k] = Math.round((5 + rnd() * 5) * 4) / 4;
          comments[k] = scores[k] >= 8 ? 'Làm bài tốt, phát âm rõ ràng.' : scores[k] >= 6.5 ? 'Cần ôn thêm từ vựng.' : 'Cần chú ý luyện tập thêm ở nhà.';
        });
        s.assessments.a_demo1 = { classId: 'c_3', teacherId: 'u_gv2', teacherIds: ['u_gv2', 'u_gv1'], date: sess[sess.length - 2], title: 'Kiểm tra từ vựng Unit 3', scores, comments };
      }
      return s;
    }

    function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* bỏ qua */ } }
    function load() {
      if (store) return;
      try { store = JSON.parse(localStorage.getItem(KEY)); } catch (e) { store = null; }
      if (!store) { store = seed(); persist(); }
      COLS.forEach((c) => { store[c] = store[c] || {}; });
    }
    const matches = (doc, [f, op, v]) => {
      const x = doc[f];
      if (op === '==') return x === v;
      if (op === 'in') return v.includes(x);
      if (op === 'array-contains') return Array.isArray(x) && x.includes(v);
      if (op === '>=') return x >= v;
      if (op === '<=') return x <= v;
      return true;
    };

    return {
      async init() { load(); },
      reset() { store = seed(); persist(); },
      onAuth(cb) {
        listener = cb;
        const uid = sessionStorage.getItem(SKEY);
        const u = uid && store.users[uid];
        cb(u ? { uid, ...clone(u) } : null);
      },
      async login(email, pw) {
        const hit = Object.entries(store.users).find(([, u]) => u.email.toLowerCase() === U.loginId(email));
        if (!hit || hit[1].password !== pw) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
        if (hit[1].active === false) throw new Error('Tài khoản đã bị khóa.');
        sessionStorage.setItem(SKEY, hit[0]);
        listener({ uid: hit[0], ...clone(hit[1]) });
      },
      async logout() { sessionStorage.removeItem(SKEY); listener(null); },
      async resetPassword() { throw new Error('Chế độ dùng thử không gửi email. Khi dùng Firebase, tính năng này sẽ gửi email đặt lại mật khẩu.'); },
      async list(col, wheres = []) {
        return Object.entries(store[col] || {}).map(([id, d]) => ({ id, ...clone(d) })).filter((d) => wheres.every((w) => matches(d, w)));
      },
      async get(col, id) { const d = store[col] && store[col][id]; return d ? { id, ...clone(d) } : null; },
      async save(col, id, data, replace = false) {
        id = id || U.uid();
        const clean = clone(data); delete clean.id;
        clean.updatedAt = new Date().toISOString();
        store[col][id] = replace ? clean : { ...(store[col][id] || {}), ...clean };
        persist();
        return id;
      },
      async del(col, id) { delete store[col][id]; persist(); },
      async updateMany(col, ids, patch) { ids.forEach((id) => { if (store[col][id]) Object.assign(store[col][id], patch); }); persist(); },
      async createTeacher({ email, password, name, phone, rateMain, rateAssistant, role = 'teacher' }) {
        email = U.loginId(email);
        if (Object.values(store.users).some((u) => u.email.toLowerCase() === email)) throw new Error('Tên đăng nhập này đã có tài khoản, hãy chọn tên khác.');
        const uid = 'u_' + U.uid();
        store.users[uid] = { name, email, phone, role, active: true, password, rateMain: rateMain || 0, rateAssistant: rateAssistant || 0 };
        persist();
        return uid;
      },
      async changePassword(oldPw, newPw) {
        const uid = sessionStorage.getItem(SKEY), u = store.users[uid];
        if (!u || u.password !== oldPw) throw new Error('Mật khẩu hiện tại không đúng.');
        u.password = newPw; persist();
      },
    };
  })();

  /* =====================================================================
   *  CHẾ ĐỘ FIREBASE
   * ===================================================================== */
  const Fb = (() => {
    let auth, fs, cfg;
    const V = '10.12.2';
    const loadScript = (src) => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Không tải được Firebase SDK. Kiểm tra kết nối mạng.'));
      document.head.appendChild(s);
    });
    return {
      async init(config) {
        cfg = config;
        for (const f of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-${f}-compat.js`);
        firebase.initializeApp(config);
        auth = firebase.auth();
        fs = firebase.firestore();
      },
      onAuth(cb) {
        auth.onAuthStateChanged(async (u) => {
          if (!u) return cb(null);
          try {
            const snap = await fs.collection('users').doc(u.uid).get();
            if (!snap.exists) return cb({ error: 'noprofile', uid: u.uid, email: u.email });
            const p = snap.data();
            if (p.active === false) { await auth.signOut(); return cb({ error: 'inactive' }); }
            cb({ uid: u.uid, ...p });
          } catch (e) { cb({ error: 'noprofile', uid: u.uid, email: u.email, detail: e.message }); }
        });
      },
      async login(email, pw) { try { await auth.signInWithEmailAndPassword(U.loginId(email), pw); } catch (e) { throw authMsg(e); } },
      async changePassword(oldPw, newPw) {
        try {
          const u = auth.currentUser;
          await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, oldPw));
          await u.updatePassword(newPw);
        } catch (e) { throw /wrong-password|invalid-credential/.test(e.code || '') ? new Error('Mật khẩu hiện tại không đúng.') : authMsg(e); }
      },
      async logout() { await auth.signOut(); },
      async resetPassword(email) { try { await auth.sendPasswordResetEmail(email); } catch (e) { throw authMsg(e); } },
      async list(col, wheres = []) {
        let q = fs.collection(col);
        wheres.forEach(([f, op, v]) => { q = q.where(f, op, v); });
        try { const snap = await q.get(); return snap.docs.map((d) => ({ id: d.id, ...d.data() })); } catch (e) { throw authMsg(e); }
      },
      async get(col, id) {
        try { const d = await fs.collection(col).doc(id).get(); return d.exists ? { id: d.id, ...d.data() } : null; } catch (e) { throw authMsg(e); }
      },
      async save(col, id, data, replace = false) {
        id = id || fs.collection(col).doc().id;
        const clean = clone(data); delete clean.id;
        clean.updatedAt = new Date().toISOString();
        try { await fs.collection(col).doc(id).set(clean, replace ? {} : { merge: true }); } catch (e) { throw authMsg(e); }
        return id;
      },
      async del(col, id) { try { await fs.collection(col).doc(id).delete(); } catch (e) { throw authMsg(e); } },
      async updateMany(col, ids, patch) {
        for (let i = 0; i < ids.length; i += 400) {
          const b = fs.batch();
          ids.slice(i, i + 400).forEach((id) => b.update(fs.collection(col).doc(id), patch));
          try { await b.commit(); } catch (e) { throw authMsg(e); }
        }
      },
      /* Tạo tài khoản bằng app phụ để quản trị viên không bị đăng xuất */
      async createTeacher({ email, password, name, phone, rateMain, rateAssistant, role = 'teacher' }) {
        const sec = firebase.apps.find((a) => a.name === 'sec') || firebase.initializeApp(cfg, 'sec');
        email = U.loginId(email);
        try {
          const cred = await sec.auth().createUserWithEmailAndPassword(email, password);
          await sec.auth().signOut();
          await fs.collection('users').doc(cred.user.uid).set({ name, email, phone, role, active: true, rateMain: rateMain || 0, rateAssistant: rateAssistant || 0, createdAt: new Date().toISOString() });
          return cred.user.uid;
        } catch (e) { throw authMsg(e); }
      },
    };
  })();

  /* =====================================================================
   *  API chung
   * ===================================================================== */
  let impl = Demo;
  DB.init = async () => {
    const cfg = window.SKY_CONFIG && window.SKY_CONFIG.firebase;
    if (cfg && cfg.apiKey) { DB.mode = 'firebase'; impl = Fb; } else { DB.mode = 'demo'; impl = Demo; }
    await impl.init(cfg);
  };
  ['onAuth', 'login', 'logout', 'resetPassword', 'changePassword', 'list', 'get', 'save', 'del', 'updateMany', 'createTeacher'].forEach((k) => {
    DB[k] = (...a) => impl[k](...a);
  });
  DB.resetDemo = () => Demo.reset();
  DB.backup = async () => {
    const out = {};
    for (const c of COLS.filter((c) => c !== 'users')) out[c] = await DB.list(c);
    return out;
  };
})();
