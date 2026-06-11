document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('rateioBox');
  const chk = document.getElementById('comRateio');
  const rows = document.getElementById('rateioRows');
  const add = document.getElementById('addRateio');
  const mode = document.getElementById('rateioModo');

  function syncRateio() {
    if (!box || !chk) return;
    box.classList.toggle('hidden', !chk.checked);
    syncMode();
  }
  function syncMode() {
    if (!mode || !rows) return;
    const percentual = mode.value === 'manual_percentual';
    rows.querySelectorAll('[name="rateioPercentual"]').forEach(el => {
      el.disabled = !percentual;
      el.closest('.rateio-row')?.classList.toggle('using-percentual', percentual);
    });
    rows.querySelectorAll('[name="rateioValor"]').forEach(el => {
      el.disabled = percentual;
      el.closest('.rateio-row')?.classList.toggle('using-valor', !percentual);
    });
  }
  function wireRemove(scope=document) {
    scope.querySelectorAll('.remove-rateio').forEach(btn => {
      btn.onclick = () => {
        if (!rows) return;
        const all = rows.querySelectorAll('.rateio-row');
        if (all.length > 2) btn.closest('.rateio-row')?.remove();
      };
    });
  }
  if (chk) chk.addEventListener('change', syncRateio);
  if (mode) mode.addEventListener('change', syncMode);
  if (add && rows) add.addEventListener('click', () => {
    const first = rows.querySelector('.rateio-row');
    if (!first) return;
    const clone = first.cloneNode(true);
    clone.querySelectorAll('input').forEach(i => i.value = '');
    clone.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    rows.appendChild(clone);
    wireRemove(clone);
    syncMode();
  });
  wireRemove();
  syncRateio();
});
