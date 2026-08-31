(() => {
  'use strict';

  const STATIONS = [
    { id: 'A', brand: 'TOTAL', name: 'Total Access — Nîmes Nord', km: 8,  offset: 0.4, sp95: 1.89, sp98: 1.98, e10: 1.85 },
    { id: 'B', brand: 'CARRE', name: 'Carrefour — Le Vigan',       km: 14, offset: 2.4, sp95: 1.78, sp98: 1.86, e10: 1.74 },
    { id: 'C', brand: 'ESSO',  name: 'Esso — A9 Aire Lédenon',     km: 22, offset: 0.2, sp95: 1.96, sp98: 2.05, e10: 1.92 },
    { id: 'D', brand: 'LECL',  name: 'Leclerc — Calvisson',        km: 28, offset: 4.6, sp95: 1.72, sp98: 1.80, e10: 1.68 },
    { id: 'E', brand: 'AVIA',  name: 'Avia — Sommières',           km: 35, offset: 1.1, sp95: 1.84, sp98: 1.92, e10: 1.81 },
    { id: 'F', brand: 'ITM',   name: 'Intermarché — Quissac',      km: 42, offset: 6.8, sp95: 1.69, sp98: 1.77, e10: 1.65 },
  ];

  const state = { fuel: 'sp95', liters: 45, conso: 6.5, maxDetour: 5 };

  const xOf = (km) => 60 + (km / 48) * 700;
  const yOf = (offset, sign) => 200 + sign * (offset * 14);
  const signFor = (id) => ['B', 'D', 'F'].includes(id) ? -1 : 1;

  function escapeHtml(v) {
    return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function compute() {
    const f = state.fuel;
    const avgPrice = STATIONS.reduce((a, b) => a + b[f], 0) / STATIONS.length;
    const enriched = STATIONS.map((s) => {
      const price = s[f];
      const detourKm = s.offset * 2;
      const extraLitres = (detourKm * state.conso) / 100;
      const detourCost = extraLitres * avgPrice;
      const totalCost = price * state.liters + detourCost;
      const baselineCost = avgPrice * state.liters;
      const savings = baselineCost - totalCost;
      const within = s.offset <= state.maxDetour;
      return { ...s, price, detourKm, detourCost, totalCost, savings, within };
    });
    const eligible = enriched.filter((s) => s.within);
    const best = eligible.length === 0
      ? null
      : eligible.reduce((m, s) => (s.totalCost < m.totalCost ? s : m), eligible[0]);
    return { enriched, best, avgPrice };
  }

  function renderMap({ enriched, best }) {
    const md = state.maxDetour;
    const parts = [];

    parts.push(`<line x1="40" y1="200" x2="780" y2="200" stroke="#3a4a58" stroke-width="1.4" stroke-dasharray="6 4"/>`);
    parts.push(`<line x1="40" y1="200" x2="780" y2="200" stroke="#69c8e0" stroke-width="2" opacity="0.4"/>`);

    [0, 10, 20, 30, 40].forEach((k) => {
      const x = xOf(k);
      parts.push(`<g><line x1="${x}" y1="194" x2="${x}" y2="206" stroke="#5b6770" stroke-width="0.6"/><text x="${x}" y="222" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5b6770" letter-spacing="1">${k}km</text></g>`);
    });

    parts.push(`<g><rect x="36" y="184" width="14" height="32" fill="#e6ede0" stroke="#e6ede0"/><circle cx="43" cy="180" r="2" fill="#e6ede0"/><text x="43" y="170" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#e6ede0" letter-spacing="1">MOI</text></g>`);

    parts.push(`<g><circle cx="780" cy="200" r="6" fill="#69c8e0"/><circle cx="780" cy="200" r="11" stroke="#69c8e0" stroke-width="0.6" fill="none" stroke-dasharray="3 3"/><text x="780" y="180" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#69c8e0" letter-spacing="1">→ DEST</text></g>`);

    parts.push(`<rect x="40" y="${200 - md * 14}" width="740" height="${md * 28}" fill="rgba(240,168,54,0.05)" stroke="rgba(240,168,54,0.3)" stroke-width="0.6" stroke-dasharray="4 4"/>`);
    parts.push(`<text x="48" y="${200 - md * 14 - 6}" font-family="JetBrains Mono" font-size="8.5" fill="#f0a836" letter-spacing="1">ZONE DÉTOUR · ±${md}KM</text>`);

    enriched.forEach((s) => {
      const sign = signFor(s.id);
      const cx = xOf(s.km);
      const cy = yOf(s.offset, sign);
      const isBest = best && s.id === best.id;
      const overLimit = !s.within;
      const color = isBest ? '#f0a836' : overLimit ? '#e25a4c' : '#9aa3a8';
      const opacity = overLimit ? 0.5 : 1;

      let svg = `<g opacity="${opacity}">`;
      svg += `<line x1="${cx}" y1="200" x2="${cx}" y2="${cy}" stroke="${color}" stroke-width="1"${overLimit ? ' stroke-dasharray="3 3"' : ''}/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="${isBest ? 9 : 6}" fill="${isBest ? 'rgba(240,168,54,0.15)' : 'rgba(0,0,0,0)'}" stroke="${color}" stroke-width="${isBest ? 2 : 1.4}"/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${color}"/>`;
      if (isBest) {
        svg += `<circle cx="${cx}" cy="${cy}" r="14" stroke="${color}" stroke-width="0.8" fill="none" stroke-dasharray="3 3"><animate attributeName="r" values="14;18;14" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite"/></circle>`;
      }
      const ly = cy + sign * 22;
      const dy1 = sign > 0 ? 4 : -8;
      const dy2 = sign > 0 ? 16 : -20;
      svg += `<text x="${cx}" y="${ly + dy1}" text-anchor="middle" font-family="JetBrains Mono" font-size="9.5" fill="${color}" letter-spacing="0.5">${s.price.toFixed(2)}€</text>`;
      svg += `<text x="${cx}" y="${ly + dy2}" text-anchor="middle" font-family="JetBrains Mono" font-size="7.5" fill="#5b6770" letter-spacing="1">${escapeHtml(s.brand)} · ${s.offset.toFixed(1)}km</text>`;
      if (isBest) {
        svg += `<text x="${cx}" y="${cy + sign * 38 + (sign > 0 ? 6 : -28)}" text-anchor="middle" font-family="Space Grotesk" font-size="11" font-weight="600" fill="#f0a836" letter-spacing="0.5">↳ MEILLEUR</text>`;
      }
      svg += `</g>`;
      parts.push(svg);
    });

    const el = document.getElementById('demo-svg');
    if (el) el.innerHTML = parts.join('');
  }

  function renderPanel({ enriched, best, avgPrice }) {
    document.getElementById('liters-val').textContent = state.liters;
    document.getElementById('conso-val').textContent = state.conso.toFixed(1);
    document.getElementById('detour-val').textContent = state.maxDetour;

    document.querySelectorAll('.fuel-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fuel === state.fuel);
    });

    const fuelUp = state.fuel.toUpperCase();
    document.getElementById('fuel-titlebar').textContent = fuelUp;
    document.getElementById('fuel-stalist').textContent = fuelUp;
    document.getElementById('fuel-status').textContent = best ? 'CALCULÉ' : 'AUCUNE STATION';

    const resultEl = document.getElementById('result');
    if (best) {
      resultEl.style.borderColor = '';
      resultEl.innerHTML =
        `<div class="result-h"><span>→ STATION RECOMMANDÉE</span><span style="color:var(--ink-faint)">ID · ${best.id}</span></div>` +
        `<div class="result-best">${escapeHtml(best.brand)} <em>· ${best.offset.toFixed(1)} km</em></div>` +
        `<div class="result-rows">` +
        `<div class="result-row"><div class="l">Prix au L.</div><div class="v a">${best.price.toFixed(2)}€</div></div>` +
        `<div class="result-row"><div class="l">Coût plein</div><div class="v">${(best.price * state.liters).toFixed(2)}€</div></div>` +
        `<div class="result-row"><div class="l">Coût détour</div><div class="v">${best.detourCost.toFixed(2)}€</div></div>` +
        `<div class="result-row"><div class="l">Économie vs moy.</div><div class="v ${best.savings > 0 ? 'g' : 'r'}">${best.savings > 0 ? '+' : ''}${best.savings.toFixed(2)}€</div></div>` +
        `</div>`;
    } else {
      resultEl.style.borderColor = 'var(--crimson)';
      resultEl.innerHTML =
        `<div class="result-h" style="color:var(--crimson)"><span>→ ZONE TROP RESTREINTE</span></div>` +
        `<div class="result-best">Aucune station dans <em>±${state.maxDetour} km</em></div>` +
        `<p style="font-family:var(--mono);font-size:12px;color:var(--ink-soft);margin-top:8px;line-height:1.5">Élargis la zone de détour pour intégrer plus de stations.</p>`;
    }

    const stalist = document.getElementById('stalist');
    const sorted = [...enriched].sort((a, b) => a.price - b.price);
    stalist.innerHTML = sorted
      .map((s) => {
        const isBest = best && s.id === best.id;
        const cls = isBest ? 'best' : (!s.within ? 'over' : '');
        const diff = s.price - avgPrice;
        const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(2);
        return (
          `<div class="sta ${cls}">` +
          `<div class="sta-mark">${s.id}</div>` +
          `<div class="sta-name">${escapeHtml(s.brand)}<small>${s.km}km · détour ${s.offset.toFixed(1)}km</small></div>` +
          `<div class="sta-prices"><div class="p">${s.price.toFixed(2)}€</div><div class="d">${diffStr}€ moy.</div></div>` +
          `</div>`
        );
      })
      .join('');
  }

  function render() {
    const data = compute();
    renderMap(data);
    renderPanel(data);
  }

  function init() {
    const sliders = { 'slider-liters': 'liters', 'slider-conso': 'conso', 'slider-detour': 'maxDetour' };
    Object.entries(sliders).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = state[key];
      el.addEventListener('input', () => {
        state[key] = +el.value;
        render();
      });
    });
    document.querySelectorAll('.fuel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.fuel = btn.dataset.fuel;
        render();
      });
    });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
