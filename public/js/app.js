// ===== Chức năng phía Client cho module Trang phục =====
document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------
     5 + 6: Chọn dòng (click cả dòng hoặc ô vuông) + đếm số lượng
     --------------------------------------------------------- */
  const checkAll = document.getElementById('checkAll');
  const rowChks = () => Array.from(document.querySelectorAll('.rowChk'));

  function refreshSelection() {
    const all = rowChks();
    const checked = all.filter(c => c.checked);
    const n = checked.length;

    // Tô sáng dòng đang chọn
    all.forEach(c => {
      const tr = c.closest('tr');
      if (tr) tr.classList.toggle('row-selected', c.checked);
    });

    // Cập nhật "(n)" trên nút + bật/tắt nút
    document.querySelectorAll('.selCount').forEach(s => s.textContent = n ? ` (${n})` : '');
    const btnCopy = document.getElementById('btnCopyMany');
    const btnDel = document.getElementById('btnDeleteMany');
    if (btnCopy) btnCopy.disabled = n === 0;
    if (btnDel) btnDel.disabled = n === 0;

    const info = document.getElementById('selInfo');
    if (info) info.textContent = n ? `Đã chọn ${n}/${all.length} dòng` : 'Chưa chọn dòng nào · bấm vào dòng để chọn';

    // Trạng thái ô "chọn tất cả"
    if (checkAll) {
      checkAll.checked = n > 0 && n === all.length;
      checkAll.indeterminate = n > 0 && n < all.length;
    }
  }

  // Ô "chọn tất cả"
  if (checkAll) {
    checkAll.addEventListener('change', () => {
      rowChks().forEach(c => c.checked = checkAll.checked);
      refreshSelection();
    });
  }

  // Mỗi ô vuông đổi trạng thái -> cập nhật
  rowChks().forEach(c => c.addEventListener('change', refreshSelection));

  // 5: Bấm vào BẤT KỲ chỗ nào trên dòng cũng tick được dòng đó
  document.querySelectorAll('tr.prod-row').forEach(tr => {
    tr.addEventListener('click', (e) => {
      // Bỏ qua khi bấm trực tiếp vào link/nút/ảnh/ô nhập (để không chặn thao tác khác)
      if (e.target.closest('a, button, input, label, img')) return;
      const chk = tr.querySelector('.rowChk');
      if (!chk) return;
      chk.checked = !chk.checked;
      refreshSelection();
    });
  });

  refreshSelection();

  // --- Xóa 1 bản ghi (gửi form DELETE qua method-override) ---
  document.querySelectorAll('.btnDelOne').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Xóa trang phục này?')) return;
      const id = btn.dataset.id;
      const f = document.getElementById('delOneForm');
      f.action = '/products/' + id + '?_method=DELETE';
      f.submit();
    });
  });

  // --- 10: Cấu hình ẩn/hiện cột (lưu localStorage) ---
  const KEY = 'ch_cols_hidden';
  let hidden = [];
  try { hidden = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { hidden = []; }
  function applyCols() {
    document.querySelectorAll('[data-col]').forEach(el => {
      el.style.display = hidden.includes(el.dataset.col) ? 'none' : '';
    });
    document.querySelectorAll('.col-toggle').forEach(chk => {
      chk.checked = !hidden.includes(chk.dataset.col);
    });
  }
  document.querySelectorAll('.col-toggle').forEach(chk => {
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const col = chk.dataset.col;
      const i = hidden.indexOf(col);
      if (chk.checked && i > -1) hidden.splice(i, 1);
      if (!chk.checked && i === -1) hidden.push(col);
      try { localStorage.setItem(KEY, JSON.stringify(hidden)); } catch (_) {}
      applyCols();
    });
  });
  const colMenu = document.getElementById('colMenu');
  if (colMenu) colMenu.addEventListener('click', e => e.stopPropagation());
  applyCols();

  // --- 11: Phím tắt CRUD ---
  document.addEventListener('keydown', (e) => {
    if (!e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { const b = document.getElementById('btnNew'); if (b) { e.preventDefault(); location.href = '/products/new'; } }
    if (k === 'f') { const s = document.getElementById('searchBox'); if (s) { e.preventDefault(); s.focus(); } }
    if (k === 's') { const b = document.getElementById('btnSave'); if (b) { e.preventDefault(); b.click(); } }
    if (k === 'a') { if (checkAll) { e.preventDefault(); checkAll.checked = !checkAll.checked; rowChks().forEach(c => c.checked = checkAll.checked); refreshSelection(); } }
    if (k === 'd') { const b = document.getElementById('btnDeleteMany'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
  });

  /* --- Nav đổ bóng khi cuộn --- */
  const chNav = document.querySelector('.navbar.ch-nav');
  if (chNav) {
    const onScroll = () => chNav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     1: Hiệu ứng — hiện dần khi cuộn (scroll reveal)
     --------------------------------------------------------- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------------------------------------------------------
     1: Hiệu ứng — đếm số tăng dần cho các chỉ số ở trang chủ
     --------------------------------------------------------- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const run = (el) => {
      const target = parseInt(el.dataset.count, 10) || 0;
      if (reduce || !target) { el.textContent = target || el.textContent; return; }
      const dur = 900, t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('vi-VN');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver((ents) => {
        ents.forEach(en => { if (en.isIntersecting) { run(en.target); io2.unobserve(en.target); } });
      }, { threshold: 0.4 });
      counters.forEach(el => io2.observe(el));
    } else counters.forEach(run);
  }
});
