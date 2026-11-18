/* ============================================================
   LỊCH CHỌN KHOẢNG NGÀY THUÊ (1 lịch, bấm 2 lần)
   - Bấm lần 1: ngày nhận · bấm lần 2: ngày trả (bấm lại đúng ngày nhận = thuê 1 ngày)
   - Cả khoảng nhận → trả tô cùng 1 màu = các ngày thuê; số ngày tính cả ngày nhận và ngày trả
   - Ngày đã qua bị mờ, hôm nay có viền. Bấm "Áp dụng" để gửi form.
   Cách gắn:
     <div class="rp" data-min="YYYY-MM-DD" data-max-days="30" data-submit="1">
       <input type="hidden" name="start" class="rp-start"> <input type="hidden" name="end" class="rp-end">
       <button type="button" class="rp-trigger">...<span class="rp-label-start"></span>...<span class="rp-label-end"></span></button>
     </div>
   ============================================================ */
(function () {
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const vi = s => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const rentDays = (a, b) => diff(a, b) + 1;   // nhận 18, trả 20 = 3 ngày

  function init(root) {
    const inStart = root.querySelector('.rp-start'), inEnd = root.querySelector('.rp-end');
    const trigger = root.querySelector('.rp-trigger');
    const lblS = root.querySelector('.rp-label-start'), lblE = root.querySelector('.rp-label-end');
    const today = ymd(new Date());
    const minOf = () => root.dataset.min || today;   // đọc lại mỗi lần vẽ (ngày sớm nhất đổi theo nơi nhận đồ)
    const maxDays = +root.dataset.maxDays || 30;

    let start = inStart.value || '', end = inEnd.value || '';
    let view = parse(start || minOf()); view.setDate(1);

    const pop = document.createElement('div');
    pop.className = 'rp-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Chọn ngày nhận và ngày trả');
    pop.hidden = true;
    root.appendChild(pop);

    function label() {
      lblS.textContent = inStart.value ? vi(inStart.value) : 'Từ ngày';
      lblE.textContent = inEnd.value ? vi(inEnd.value) : 'Đến ngày';
      lblS.classList.toggle('is-empty', !inStart.value);
      lblE.classList.toggle('is-empty', !inEnd.value);
    }

    function render() {
      const min = minOf();
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1);
      const offset = (first.getDay() + 6) % 7;              // tuần bắt đầu thứ 2
      const gridStart = new Date(y, m, 1 - offset);
      const canPrev = ymd(new Date(y, m, 0)) >= min;         // tháng trước còn ngày chọn được
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
        const s = ymd(d);
        const cls = ['rp-day'];
        const past = s < min, tooFar = start && !end && s > start && rentDays(start, s) > maxDays;
        if (d.getMonth() !== m) cls.push('is-out');
        if (past || tooFar) cls.push('is-off');
        if (s === today) cls.push('is-today');
        if (s === start) cls.push('is-start');
        if (s === end) cls.push('is-end');
        if (start && end && s > start && s < end) cls.push('is-mid');
        if (start && end && s >= start && s <= end) cls.push('is-in');
        cells += `<button type="button" class="${cls.join(' ')}" data-d="${s}" ${past || tooFar ? 'disabled' : ''}>${d.getDate()}</button>`;
      }
      const hint = !start ? 'Chọn <b>ngày nhận</b> đồ' : !end ? 'Chọn <b>ngày trả</b> đồ' : `${vi(start)} → ${vi(end)} · thuê <b>${rentDays(start, end)} ngày</b>`;
      pop.innerHTML = `
        <div class="rp-cal">
          <div class="rp-head">
            <b>Tháng ${m + 1}, ${y}</b>
            <span>
              <button type="button" class="rp-nav" data-step="-1" aria-label="Tháng trước" ${canPrev ? '' : 'disabled'}><i class="bi bi-chevron-left"></i></button>
              <button type="button" class="rp-nav" data-step="1" aria-label="Tháng sau"><i class="bi bi-chevron-right"></i></button>
            </span>
          </div>
          <div class="rp-week">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => `<span>${w}</span>`).join('')}</div>
          <div class="rp-grid">${cells}</div>
        </div>
        <div class="rp-legend">
          <span><i class="lg-today"></i>Hôm nay</span><span><i class="lg-range"></i>Các ngày thuê</span>
        </div>
        <div class="rp-foot">
          <span class="rp-hint">${hint}</span>
          <span class="d-flex gap-2">
            ${start ? '<button type="button" class="btn btn-light btn-sm rp-clear">Chọn lại</button>' : ''}
            <button type="button" class="btn btn-primary btn-sm rp-apply" ${start && end ? '' : 'disabled'}>Áp dụng</button>
          </span>
        </div>`;
    }

    function open() { pop.hidden = false; root.classList.add('is-open'); render(); }
    function close() { pop.hidden = true; root.classList.remove('is-open'); }

    trigger.addEventListener('click', () => (pop.hidden ? open() : close()));
    pop.addEventListener('click', (e) => {
      e.stopPropagation();   // lịch vẽ lại sau mỗi lần bấm -> đừng để "bấm ra ngoài" hiểu nhầm mà đóng lịch
      const nav = e.target.closest('.rp-nav');
      if (nav) { view.setMonth(view.getMonth() + +nav.dataset.step); render(); return; }
      const day = e.target.closest('.rp-day');
      if (day && !day.disabled) {
        const s = day.dataset.d;
        // chưa có ngày nhận, hoặc đã đủ 2 ngày, hoặc bấm trước ngày nhận -> chọn lại ngày nhận
        // bấm lại đúng ngày nhận -> nhận và trả cùng ngày (thuê 1 ngày)
        if (!start || end || s < start) { start = s; end = ''; }
        else end = s;
        render(); return;
      }
      if (e.target.closest('.rp-clear')) { start = ''; end = ''; render(); return; }
      if (e.target.closest('.rp-apply') && start && end) {
        inStart.value = start; inEnd.value = end; label(); close();
        root.dispatchEvent(new CustomEvent('rp:change', { bubbles: true, detail: { start, end } }));
        if (root.dataset.submit) {
          // data-form: id của form cần gửi (khi ô lịch nằm trong form khác), mặc định form bao ngoài
          const f = root.dataset.form ? document.getElementById(root.dataset.form) : root.closest('form');
          if (f) f.submit();
        }
      }
    });
    // Bấm ra ngoài / Esc để đóng
    document.addEventListener('click', (e) => { if (!pop.hidden && !root.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { close(); trigger.focus(); } });

    label();
  }

  document.querySelectorAll('.rp').forEach(init);
})();
