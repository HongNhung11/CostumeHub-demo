/* GỢI Ý SIZE theo chiều cao và số đo, dùng bảng số đo của chính mẫu đó.
   - Có số đo vòng: lấy size NHỎ NHẤT mặc lọt mọi vòng (giữa 2 size thì lấy size lớn hơn, đúng quy tắc của cửa hàng).
   - Chỉ có chiều cao: các khoảng chồng nhau nên chỉ gợi ý tạm và nói rõ. */
(function (root) {
  const GIRTH = [['bust', 'vòng ngực'], ['waist', 'vòng eo'], ['hip', 'vòng mông']];
  const EASE = 2;       // rộng hơn quá mức này (cm) thì báo hơi rộng

  function range(v) {
    const m = String(v || '').match(/^(\d{2,3})(?:\s*[-–]\s*(\d{2,3}))?$/);
    if (!m) return null;
    const a = +m[1], b = +(m[2] || m[1]);
    return [Math.min(a, b), Math.max(a, b)];
  }

  function advise(rows, input) {
    const given = GIRTH.filter(([k]) => input[k] > 0);
    if (!given.length && !(input.height > 0)) return { error: 'Nhập chiều cao hoặc ít nhất một số đo.' };
    const weight = (r) => GIRTH.reduce((s, [k]) => s + (range(r[k])?.[1] || 0), 0);
    const list = [...rows].sort((a, b) => weight(a) - weight(b));
    const notes = [];
    let pick = null;

    if (given.length) {
      const usable = list.filter(r => given.every(([k]) => range(r[k])));
      if (!usable.length) return { error: 'Mẫu này chưa đủ số đo để gợi ý. Hãy nhắn cửa hàng tư vấn.' };
      pick = usable.find(r => given.every(([k]) => input[k] <= range(r[k])[1]));
      if (!pick) return { size: null, notes: ['Số đo lớn hơn mọi size của mẫu này. Hãy chọn mẫu khác hoặc nhờ cửa hàng tư vấn.'] };
      for (const [k, name] of given) {
        const gap = range(pick[k])[0] - input[k];
        if (gap > EASE) notes.push(`Có thể hơi rộng ở ${name} khoảng ${gap} cm.`);
      }
      const h = range(pick.height);
      if (input.height > 0 && h) {
        if (input.height < h[0]) notes.push('Bạn thấp hơn khoảng gợi ý của size này, tà / gấu có thể hơi dài.');
        if (input.height > h[1]) notes.push('Bạn cao hơn khoảng gợi ý của size này, tà / gấu có thể hơi ngắn.');
      }
      if (given.length < GIRTH.length) notes.push('Nhập đủ 3 vòng sẽ chính xác hơn.');
    } else {
      let best = Infinity;
      for (const r of list) {
        const h = range(r.height);
        if (!h || input.height < h[0] - 2 || input.height > h[1] + 2) continue;
        const d = Math.abs(input.height - (h[0] + h[1]) / 2);
        if (d < best) { best = d; pick = r; }
      }
      if (!pick) return { size: null, notes: ['Chiều cao ngoài khoảng của mẫu này. Hãy nhập thêm số đo hoặc nhờ cửa hàng tư vấn.'] };
      notes.push('Mới chỉ theo chiều cao nên là gợi ý tạm. Nhập thêm 3 vòng để chính xác.');
    }
    return { size: pick.size, notes };
  }

  if (typeof module === 'object' && module.exports) { module.exports = { advise }; return; }
  root.SizeAdvisor = { advise };

  const box = document.getElementById('sizeAdvisor');
  if (!box) return;
  const rows = JSON.parse(box.dataset.rows);
  const out = box.querySelector('.sa-result');
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = {};
    box.querySelectorAll('input').forEach(i => { val[i.name] = Number(i.value) || 0; });
    const r = advise(rows, val);
    out.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = r.error || (r.size ? `Nên chọn size ${r.size}` : 'Chưa có size phù hợp');
    out.append(title);
    (r.notes || []).forEach(n => { const d = document.createElement('div'); d.className = 'small'; d.textContent = n; out.append(d); });
    if (!r.size) return;
    const radio = [...document.querySelectorAll('#addCartForm input[name="Size"]')].find(i => i.value === r.size);
    if (!radio || radio.disabled) {
      const d = document.createElement('div');
      d.className = 'small text-danger';
      d.textContent = 'Size này hiện hết hoặc đã kín lịch trong ngày bạn chọn.';
      out.append(d);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-sm mt-2';
    btn.textContent = `Chọn size ${r.size}`;
    btn.addEventListener('click', () => {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      bootstrap.Modal.getOrCreateInstance(document.getElementById('sizeChartModal')).hide();
    });
    out.append(btn);
  });
})(typeof window === 'object' ? window : globalThis);
