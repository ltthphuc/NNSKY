/* Mục "Tài khoản" (quản trị): thêm, sửa, xóa tài khoản admin / giáo viên và đổi mật khẩu */
(function () {
  const { esc, icon } = U;
  const { head, empty } = window.UI;
  const money = U.money;

  const unassign = async (tid) => {
    for (const c of App.classes.filter((k) => U.classTeachers(k).includes(tid))) {
      const patch = c.teacherId === tid ? { teacherId: '', teacherFrom: '' } : { assistantId: '', assistantFrom: '' };
      const next = { ...c, ...patch }; next.teacherIds = U.classTeachers(next);
      await DB.save('classes', c.id, { ...patch, teacherIds: next.teacherIds });
      for (const col of ['students', 'attendance', 'assessments', 'payments', 'teacherAttendance']) {
        const list = await DB.list(col, [['classId', '==', c.id]]);
        await DB.updateMany(col, list.map((x) => x.id), { teacherId: next.teacherId || '', teacherIds: next.teacherIds });
      }
    }
    await App.refreshClasses();
  };

  Views.accounts = async (root, params = {}) => {
    const users = (await DB.list('users')).sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1) || String(a.name).localeCompare(String(b.name), 'vi'));
    const roleName = (r) => (r === 'admin' ? 'Quản trị (admin)' : 'Giáo viên');

    root.innerHTML = `${head('Tài khoản', 'Tạo, sửa, xóa tài khoản và đổi mật khẩu. Tài khoản admin có quyền quản lý như tài khoản quản trị. Tên đăng nhập không bắt buộc là email.', `<button class="btn" id="add">${icon('plus')} Thêm tài khoản</button>`)}
      <div class="card"><div class="table-wrap">${users.length ? `<table class="t"><thead><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Loại</th><th>Số điện thoại</th><th>Bắt đầu làm việc</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr><td class="name"><div class="row" style="flex-wrap:nowrap"><div class="avatar">${esc(U.initials(u.name))}</div><b>${esc(u.name)}</b>${u.id === App.me.uid ? ' <span class="badge blue">Bạn</span>' : ''}</div></td>
        <td>${esc(U.userName(u.email))}</td><td><span class="badge ${u.role === 'admin' ? 'blue' : ''}">${roleName(u.role)}</span></td><td class="mono">${esc(u.phone || '')}</td>
        <td>${u.role === 'teacher' ? (u.workStart ? U.fmtDate(u.workStart) : '<span class="muted">Chưa nhập</span>') : ''}</td>
        <td>${u.active === false ? '<span class="badge err">Đã khóa</span>' : '<span class="badge ok">Hoạt động</span>'}</td>
        <td class="nowrap right"><button class="icon-btn" data-edit="${u.id}" title="Sửa">${icon('edit')}</button><button class="icon-btn" data-pw="${u.id}" title="Đổi mật khẩu">${icon('key')}</button><button class="icon-btn danger" data-del="${u.id}" title="Xóa tài khoản" ${u.id === App.me.uid ? 'disabled' : ''}>${icon('trash')}</button></td></tr>`).join('')}
      </tbody></table>` : empty('teachers', 'Chưa có tài khoản', '')}</div></div>
      <div class="hint" style="margin-top:10px">Mật khẩu: tài khoản của người khác chỉ đổi được khi biết mật khẩu hiện tại của họ (hoặc gửi email đặt lại nếu tài khoản dùng email thật). Quên mật khẩu mà không có email: xóa tài khoản đó rồi tạo tài khoản mới với tên đăng nhập khác.</div>`;

    const form = (u) => `<div class="form-grid"><div class="full"><label class="f">Họ và tên *</label><input class="input" id="n" value="${esc(u ? u.name : '')}"></div>
      ${u ? '' : `<div class="full"><label class="f">Loại tài khoản</label><select class="select" id="role"><option value="teacher">Giáo viên</option><option value="admin">Quản trị (admin): quyền quản lý như tài khoản quản trị</option></select></div>`}
      <div><label class="f">Tên đăng nhập *</label><input class="input" id="e" value="${esc(u ? U.userName(u.email) : (params.new && params.new !== '1' ? '' : ''))}" ${u ? 'disabled' : ''} autocapitalize="none" placeholder="ví dụ: ngoc.nguyen">${u ? '' : '<div class="hint">3-30 ký tự: chữ không dấu, số, dấu . _ - (hoặc nhập email). Không được trùng tên đã có.</div>'}</div>
      <div><label class="f">Số điện thoại</label><input class="input" id="p" value="${esc(u ? u.phone || '' : '')}"></div>
      <div class="tonly"><label class="f">Bắt đầu làm việc từ ngày</label><input class="input" type="date" id="ws" value="${esc(u ? u.workStart || '' : '')}"><div class="hint">Điểm danh giáo viên chỉ tính từ ngày này.</div></div>
      <div class="tonly"><label class="f">Đơn giá mỗi tiết - giáo viên chính (đ)</label><input class="input" type="number" min="0" step="1000" id="rm" value="${esc(u ? u.rateMain || 0 : 100000)}"></div>
      <div class="tonly"><label class="f">Đơn giá mỗi tiết - trợ giảng (đ)</label><input class="input" type="number" min="0" step="1000" id="ra" value="${esc(u ? u.rateAssistant || 0 : 60000)}"></div>
      ${u ? `<div class="full"><label class="f">Trạng thái</label><select class="select" id="a" ${u.id === App.me.uid ? 'disabled' : ''}><option value="1">Hoạt động</option><option value="0" ${u.active === false ? 'selected' : ''}>Khóa tài khoản</option></select>${u.id === App.me.uid ? '<div class="hint">Bạn không thể tự khóa tài khoản đang đăng nhập.</div>' : ''}</div>`
        : '<div class="full"><label class="f">Mật khẩu ban đầu * (tối thiểu 6 ký tự)</label><input class="input" id="pw" type="text" autocomplete="off"></div>'}</div>`;
    const showRole = (m, role) => m.el.querySelectorAll('.tonly').forEach((x) => { x.style.display = role === 'teacher' ? '' : 'none'; });

    const add = (presetRole) => {
      const m = U.modal({
        title: 'Thêm tài khoản', okText: 'Tạo tài khoản', body: form(null),
        onOk: async (w) => {
          const v = (id) => w.querySelector('#' + id).value.trim();
          const role = v('role');
          if (!v('n') || !v('e')) throw new Error('Nhập họ tên và tên đăng nhập.');
          if (!U.validLogin(v('e'))) throw new Error('Tên đăng nhập gồm 3-30 ký tự: chữ không dấu, số, dấu . _ - (hoặc là một email).');
          if (v('pw').length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự.');
          const id = await DB.createTeacher({ email: v('e'), password: v('pw'), name: v('n'), phone: v('p'), role, rateMain: role === 'teacher' ? Number(v('rm')) || 0 : 0, rateAssistant: role === 'teacher' ? Number(v('ra')) || 0 : 0 });
          if (role === 'teacher' && v('ws')) await DB.save('users', id, { workStart: v('ws') });
          U.toast(role === 'admin' ? 'Đã tạo tài khoản quản trị (admin)' : 'Đã tạo tài khoản giáo viên', 'ok');
          await App.refreshTeachers(); App.render();
        },
      });
      const role = m.el.querySelector('#role');
      if (presetRole) role.value = presetRole;
      role.onchange = () => showRole(m, role.value);
      showRole(m, role.value);
    };
    root.querySelector('#add').onclick = () => add();
    if (params.new) add(params.new === 'admin' ? 'admin' : 'teacher');

    root.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), pw = e.target.closest('[data-pw]'), del = e.target.closest('[data-del]');
      if (ed) {
        const u = users.find((x) => x.id === ed.dataset.edit);
        const m = U.modal({
          title: `Sửa tài khoản: ${u.name}`, body: form(u),
          onOk: async (w) => {
            const v = (id) => w.querySelector('#' + id).value.trim();
            if (!v('n')) throw new Error('Nhập họ tên.');
            const data = { name: v('n'), phone: v('p'), active: u.id === App.me.uid ? true : w.querySelector('#a').value === '1' };
            if (u.role === 'teacher') Object.assign(data, { workStart: v('ws'), rateMain: Number(v('rm')) || 0, rateAssistant: Number(v('ra')) || 0 });
            await DB.save('users', u.id, data);
            U.toast('Đã lưu', 'ok'); await App.refreshTeachers(); App.render();
          },
        });
        showRole(m, u.role);
        return;
      }
      if (pw) {
        const u = users.find((x) => x.id === pw.dataset.pw), me = u.id === App.me.uid, real = !U.isPseudoEmail(u.email);
        U.modal({
          title: `Đổi mật khẩu: ${u.name}`, okText: 'Đổi mật khẩu',
          body: `<div class="form-grid"><div class="full"><label class="f">${me ? 'Mật khẩu hiện tại' : 'Mật khẩu hiện tại của tài khoản này'}</label><input class="input" type="password" id="op" autocomplete="off"></div>
            <div><label class="f">Mật khẩu mới (tối thiểu 6 ký tự)</label><input class="input" type="password" id="np" autocomplete="new-password"></div>
            <div><label class="f">Nhập lại mật khẩu mới</label><input class="input" type="password" id="np2" autocomplete="new-password"></div>
            ${real && !me ? `<div class="full"><button type="button" class="btn sm ghost" id="mail">${icon('key', 14)} Quên mật khẩu? Gửi email đặt lại tới ${esc(u.email)}</button></div>` : ''}</div>`,
          onOk: async (w) => {
            const op = w.querySelector('#op').value, np = w.querySelector('#np').value;
            if (!op) throw new Error('Nhập mật khẩu hiện tại.');
            if (np.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự.');
            if (np !== w.querySelector('#np2').value) throw new Error('Hai lần nhập mật khẩu mới chưa giống nhau.');
            if (me) await DB.changePassword(op, np); else await DB.changeOtherPassword(u.email, op, np);
            U.toast('Đã đổi mật khẩu', 'ok');
          },
        }).el.addEventListener('click', async (ev) => {
          if (!ev.target.closest('#mail')) return;
          try { await DB.resetPassword(u.email); U.toast(`Đã gửi email đặt lại mật khẩu tới ${u.email}`, 'ok'); } catch (er) { U.toast(er.message, 'err'); }
        });
        return;
      }
      if (del) {
        const u = users.find((x) => x.id === del.dataset.del);
        if (u.id === App.me.uid) return;
        if (u.role === 'admin' && users.filter((x) => x.role === 'admin' && x.active !== false).length < 2) { U.toast('Phải còn ít nhất một tài khoản quản trị đang hoạt động.', 'err'); return; }
        const used = App.classes.filter((c) => U.classTeachers(c).includes(u.id));
        if (!(await U.confirm(`Xóa tài khoản <b>${esc(u.name)}</b> (${esc(U.userName(u.email))})?${used.length ? `<br>Tài khoản này đang được phân công ${used.length} lớp (${used.map((c) => esc(c.name)).join(', ')}); các lớp sẽ bỏ phân công. Dữ liệu chấm công cũ vẫn được giữ.` : ''}<br>Người này sẽ không đăng nhập được nữa và tên đăng nhập này không dùng lại được.`, 'Xóa tài khoản'))) return;
        try {
          if (used.length) await unassign(u.id);
          await DB.del('users', u.id);
          U.toast('Đã xóa tài khoản', 'ok'); await App.refreshTeachers(); App.render();
        } catch (er) { U.toast(er.message, 'err'); }
      }
    };
  };
})();
