/* Ô chọn ngày / tháng hiển thị theo dd/mm/yyyy (mm/yyyy) trên mọi trình duyệt.
 * Giữ nguyên giao diện lập trình: .value vẫn đọc / ghi dạng yyyy-mm-dd (yyyy-mm), nên các màn hình không phải sửa.
 * Gõ số tự chèn dấu /, có nút lịch để chọn ngày. */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  const KINDS = {
    date: {
      ph: 'dd/mm/yyyy', max: 10,
      disp: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : ''),
      iso: (t) => {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t).trim());
        if (!m) return '';
        const d = +m[1], mo = +m[2], y = +m[3], x = new Date(y, mo - 1, d);
        return x.getFullYear() === y && x.getMonth() === mo - 1 && x.getDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : '';
      },
      mask: (t) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.split('-').reverse().join('/');
        const d = t.replace(/\D/g, '').slice(0, 8);
        return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
      },
    },
    month: {
      ph: 'mm/yyyy', max: 7,
      disp: (v) => (/^\d{4}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : ''),
      iso: (t) => { const m = /^(\d{1,2})\/(\d{4})$/.exec(String(t).trim()); return m && +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${pad(+m[1])}` : ''; },
      mask: (t) => {
        if (/^\d{4}-\d{2}$/.test(t)) return t.split('-').reverse().join('/');
        const d = t.replace(/\D/g, '').slice(0, 6);
        return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
      },
    },
  };

  function enhance(el) {
    if (el.dataset.vn) return;
    const kind = el.type === 'month' ? 'month' : 'date', K = KINDS[kind];
    el.dataset.vn = kind;
    const min = el.getAttribute('min') || '', max = el.getAttribute('max') || '';
    const cur = proto.get.call(el);
    const inline = (el.getAttribute('style') || '').includes('width:auto') || (el.closest('.toolbar, .row') && !el.closest('.form-grid'));
    el.type = 'text';
    el.placeholder = K.ph; el.maxLength = K.max; el.autocomplete = 'off'; el.inputMode = 'numeric'; el.size = 12;
    el.style.paddingRight = '32px';
    proto.set.call(el, K.disp(cur));
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() { return K.iso(proto.get.call(this)); },
      set(v) { proto.set.call(this, K.disp(String(v || ''))); check(); },
    });

    const wrap = document.createElement('span');
    wrap.className = 'dwrap' + (inline ? ' inl' : '');
    el.replaceWith(wrap);
    wrap.appendChild(el);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'date-pick'; btn.title = 'Chọn ngày trên lịch'; btn.innerHTML = CAL; btn.tabIndex = -1;
    const nat = document.createElement('input');
    nat.type = kind; nat.tabIndex = -1; nat.setAttribute('aria-hidden', 'true'); nat.style.cssText = 'position:absolute;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0';
    wrap.append(btn, nat);
    nat.dataset.vn = 'native';
    btn.onclick = () => {
      nat.value = el.value || ''; if (min) nat.min = min; if (max) nat.max = max;
      try { nat.showPicker(); } catch (e) { nat.focus(); nat.click(); }
    };
    nat.onchange = () => {
      if (!nat.value) return;
      proto.set.call(el, K.disp(nat.value)); check();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    function check() {
      const t = proto.get.call(el), iso = K.iso(t);
      const bad = t !== '' && (!iso || (min && iso < min) || (max && iso > max));
      el.classList.toggle('bad', bad);
      el.title = bad ? (iso ? 'Ngày nằm ngoài khoảng cho phép' : `Nhập đúng dạng ${K.ph}`) : '';
    }
    el.addEventListener('input', (e) => {
      if (!(e.inputType && /delete/.test(e.inputType))) { const t = proto.get.call(el), m = K.mask(t); if (m !== t) proto.set.call(el, m); }
    }, true);
    el.addEventListener('blur', check);
    el.addEventListener('change', check);
    // ẩn / hiện cả khung theo ô nhập (code ứng dụng hay bật tắt style.display hoặc class hidden)
    const vis = () => { wrap.style.display = el.style.display === 'none' || el.classList.contains('hidden') ? 'none' : ''; };
    new MutationObserver(vis).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    vis(); check();
  }

  const scan = (root) => { if (root.querySelectorAll) root.querySelectorAll('input[type=date]:not([data-vn]),input[type=month]:not([data-vn])').forEach(enhance); };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.matches && n.matches('input[type=date]:not([data-vn]),input[type=month]:not([data-vn])')) enhance(n);
    scan(n);
  }))).observe(document.documentElement, { childList: true, subtree: true });
  scan(document);
})();
