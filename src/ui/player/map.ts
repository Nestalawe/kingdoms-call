// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { kcJoinP } from './startup.ts';
import { applyMapZoom, fitMapSvgHeight, setDeskView, setMobileView } from './layout.ts';
import { armyLabel, unitEmoji } from './order-chances.ts';
import { capitalise, formatRace } from './skills-and-projections.ts';
import {
  CHIEFTAIN_MARKER_COLOR,
  MAP_RACE_BADGE,
  MAP_SYM,
  TERRAIN_COLORS_MAP,
  _garrisonNote,
  _grandDesignNote,
  _graveIntelById,
  _graveNote,
  _lairStar,
  _lairsClearedNote,
  _ownerLineP,
  _rebuildGraveIntelIndex,
  applyMapSymLegend,
  makeTerrainIcon,
  mapRaceBadgeHtml,
  mapSymHtml,
  mapSymSvg,
  mapTextGlyph,
  popupKnownChars,
  terrorNoteP,
  txtGlyph,
} from './map-symbols.ts';

// ── EVERY PROVINCE NAME IN THE REPORT IS A MAP LINK (2026-09-20, Toby) ── Rather than editing the
// ~40 places the report prints a province name (Chronicle lines, Realm Events, Your Provinces, Known
// Lairs, Graveyards Known, sightings, spy reports, titles…), one pass walks the report column's TEXT
// NODES and wraps every known province name (report.worldMeta names + owned provinces) in a
// prov-link span with the same hover / click / tap behaviour as provLinkHtml. Only text is touched —
// never attributes, form controls, buttons, links, SVG or an existing link — and the span inherits
// the surrounding colour (realm tints stay). A MutationObserver on the column re-runs the pass
// (debounced) whenever a section is re-rendered or loaded late; a pass that finds nothing new
// changes nothing, so it cannot loop.
export const _PROV_LINK_SKIP = new Set([
  'SCRIPT',
  'STYLE',
  'BUTTON',
  'SELECT',
  'OPTION',
  'TEXTAREA',
  'INPUT',
  'A',
  'svg',
  'SVG',
  'LABEL',
]);
export let _provNameRe = null,
  _provNameMap = null,
  _provNameKey = '';
export function _buildProvNameIndex(report) {
  const map = new Map();
  const add = (id, name) => {
    if (id == null || !name || typeof name !== 'string') return;
    const n = name.trim();
    if (n.length < 3) return;
    if (!map.has(n)) map.set(n, id);
  };
  ((report && report.worldMeta && report.worldMeta.provinces) || []).forEach((p) => add(p.id, p.name));
  ((report && report.ownedProvinces) || []).forEach((p) => add(p.id, p.name));
  const key = [...map.keys()].sort().join('|');
  if (key === _provNameKey) return;
  _provNameKey = key;
  _provNameMap = map;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = [...map.keys()].sort((a, b) => b.length - a.length).map(esc);
  _provNameRe = names.length
    ? new RegExp('(?<![A-Za-z\u00C0-\u024F])(' + names.join('|') + ')(?![A-Za-z\u00C0-\u024F])', 'g')
    : null;
}
export function _makeProvLinkEl(id, name) {
  const sp = document.createElement('span');
  sp.className = 'prov-link prov-auto';
  sp.setAttribute('data-prov-link', String(id));
  sp.title = `Hover to light up ${name} on the map — click or tap to show it`;
  sp.textContent = name;
  sp.onmouseenter = () => highlightMapProv(id, true);
  sp.onmouseleave = () => highlightMapProv(id, false);
  sp.onclick = (ev) => {
    ev.stopPropagation();
    locateOnMap(id);
  };
  return sp;
}
export let _provLinking = false;
export function linkProvinceNames(root) {
  if (!root || _provLinking) return;
  _buildProvNameIndex(viewingReport || currentReport);
  if (!_provNameRe) return;
  _provLinking = true;
  try {
    const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.length < 3) return window.NodeFilter.FILTER_REJECT;
        for (let el = n.parentNode; el && el !== root; el = el.parentNode) {
          if (_PROV_LINK_SKIP.has(el.nodeName) || el.namespaceURI === 'http://www.w3.org/2000/svg')
            return window.NodeFilter.FILTER_REJECT;
          if (el.classList && (el.classList.contains('prov-link') || el.classList.contains('no-prov-link')))
            return window.NodeFilter.FILTER_REJECT;
          if (el.isContentEditable) return window.NodeFilter.FILTER_REJECT;
        }
        _provNameRe.lastIndex = 0;
        return _provNameRe.test(n.nodeValue) ? window.NodeFilter.FILTER_ACCEPT : window.NodeFilter.FILTER_REJECT;
      },
    });
    const hits = [];
    let n;
    while ((n = walker.nextNode())) hits.push(n);
    hits.forEach((t) => {
      const txt = t.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0,
        m;
      _provNameRe.lastIndex = 0;
      while ((m = _provNameRe.exec(txt))) {
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        frag.appendChild(_makeProvLinkEl(_provNameMap.get(m[1]), m[1]));
        last = m.index + m[1].length;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      t.parentNode.replaceChild(frag, t);
    });
  } catch (e) {
    /* a failed pass must never break the report */
  } finally {
    _provLinking = false;
  }
}
export let _provLinkObs = null,
  _provLinkTimer = null;
export function ensureProvinceLinking() {
  const col = document.getElementById('rp-report-col');
  if (!col) return;
  linkProvinceNames(col);
  if (_provLinkObs || typeof MutationObserver === 'undefined') return;
  _provLinkObs = new MutationObserver(() => {
    if (_provLinking) return;
    clearTimeout(_provLinkTimer);
    _provLinkTimer = setTimeout(() => linkProvinceNames(document.getElementById('rp-report-col')), 60);
  });
  _provLinkObs.observe(col, { childList: true, subtree: true });
}
export let _provHlTimer = null;
export function highlightMapProv(id, on) {
  document.querySelectorAll('.prov-hl').forEach((n) => n.remove());
  if (!on) return;
  const ns = 'http://www.w3.org/2000/svg';
  document.querySelectorAll(`svg g[data-prov="${id}"]`).forEach((g) => {
    const poly = g.querySelector('polygon');
    const svg = g.ownerSVGElement;
    if (!poly || !svg) return;
    const hl = document.createElementNS(ns, 'polygon');
    hl.setAttribute('points', poly.getAttribute('points'));
    hl.setAttribute('fill', '#fff');
    hl.setAttribute('fill-opacity', '.3');
    hl.setAttribute('stroke', '#ffe27a');
    hl.setAttribute('stroke-width', '3');
    hl.setAttribute('stroke-linejoin', 'round');
    hl.setAttribute('pointer-events', 'none');
    hl.setAttribute('class', 'prov-hl');
    hl.setAttribute('filter', 'drop-shadow(0 0 3px #ffe27a)');
    svg.appendChild(hl);
  });
}
export function locateOnMap(id) {
  try {
    if (window.innerWidth < 821) setMobileView('map');
    else if (typeof _deskLeftView !== 'undefined' && _deskLeftView !== 'map' && typeof setDeskView === 'function')
      setDeskView('left', 'map');
  } catch (e) {}
  setTimeout(() => {
    highlightMapProv(id, true);
    const g = document.querySelector(`#report-map-svg g[data-prov="${id}"]`);
    // scroll only the map's own container (a zoomed map), never the page or the report column
    try {
      const box = document.getElementById('report-map-container');
      if (g && box) {
        const r = g.getBoundingClientRect(),
          b = box.getBoundingClientRect();
        box.scrollLeft += r.left + r.width / 2 - (b.left + b.width / 2);
        box.scrollTop += r.top + r.height / 2 - (b.top + b.height / 2);
      }
    } catch (e) {}
    clearTimeout(_provHlTimer);
    _provHlTimer = setTimeout(() => highlightMapProv(id, false), 4000);
  }, 60);
}
export function renderMapIntoSvg(svgEl, report) {
  const svgNS = 'http://www.w3.org/2000/svg';
  svgEl.innerHTML = '';
  _rebuildGraveIntelIndex(report); // province-id lookup for the hex popup's grave line

  const worldMeta = report.worldMeta;
  if (!worldMeta) {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', '10');
    t.setAttribute('y', '30');
    t.setAttribute('fill', '#aaa');
    t.setAttribute('font-size', '14');
    t.textContent = 'Map not available — awaiting Turn 0';
    svgEl.appendChild(t);
    return;
  }

  const { cols, rows, provinces: provs } = worldMeta;
  if (!provs || provs.length === 0) return;

  // ── HORIZONTAL CENTRING ON THE FOUNDING CAPITAL ────
  // The world wraps east-west. Drawn at its true column, a realm founded near column 0 sits hard
  // against the left edge with its own western neighbours appearing on the far right, which is
  // miserable to read. The GM report supplies centreCol (the capital's column, frozen at world gen
  // and never updated as land changes hands), and every province is drawn at a DISPLAY column
  // rolled so that column lands in the middle. The wrap seam then falls behind the player instead
  // of through their territory.
  //
  // This is purely a rendering offset: p.col and p.id are untouched, so neighbours, tooltips and
  // every id-keyed lookup are unaffected. Row parity drives the hex stagger and an integer column
  // shift preserves it, so the grid geometry is unchanged. Reports snapshotted before centreCol
  // existed simply have no offset and draw exactly as they did before.
  const centreCol = worldMeta.centreCol != null && cols > 0 ? worldMeta.centreCol : null;
  const colShift = centreCol == null ? 0 : Math.floor(cols / 2) - centreCol;
  function displayCol(col) {
    return cols > 0 ? (((col + colShift) % cols) + cols) % cols : col;
  }

  const HS = 22;
  function hexCentre(col, row) {
    return { x: col * HS * 1.75 + (row % 2) * HS * 0.875 + HS, y: row * HS * 1.52 + HS };
  }
  function hexPts(cx, cy, r) {
    r = r || HS - 1.5;
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  }

  // viewBox
  const c0 = hexCentre(0, 0),
    c1 = hexCentre(cols - 1, rows - 1);
  const pad = HS * 1.5;
  svgEl.setAttribute(
    'viewBox',
    `${c0.x - pad} ${c0.y - pad} ${c1.x - c0.x + pad * 2 + HS} ${c1.y - c0.y + pad * 2 + HS}`,
  );

  // Visibility sets
  const playerColor = report.kingdom?.color || '#fcb4c0'; // first colour of the colour-blind-safe realm palette
  const _isPagan =
    ((report.kingdom && report.kingdom.alignment) || (report.playerSetup && report.playerSetup.alignment)) === 'Pagan';
  void _isPagan; // retained for possible Pagan-only map cues
  const ownedIds = new Set((report.ownedProvinces || []).map((p) => p.id));
  const visitedIds = new Set([...(report.visitedProvinceIds || []), ...ownedIds]);
  const adjacentIds = new Set();
  provs.forEach((p) => {
    if (visitedIds.has(p.id)) {
      (p.neighbors || []).forEach((nid) => {
        if (!visitedIds.has(nid)) adjacentIds.add(nid);
      });
    }
  });

  // Province data lookup
  const provById = {};
  provs.forEach((p) => (provById[p.id] = p));
  // keep the worldMeta character list when it exists — it is the stealth-filtered, fully attributed
  // one (owner colour/name, wanderer/chieftain flags).
  (report.ownedProvinces || []).forEach((op) => {
    const _wm = provById[op.id];
    provById[op.id] = {
      ..._wm,
      ...op,
      characters: _wm && Array.isArray(_wm.characters) ? _wm.characters : op.characters,
    };
  });

  // Shared tooltip
  let tt = document.getElementById('map-tooltip');
  if (!tt) {
    tt = document.createElement('div');
    tt.id = 'map-tooltip';
    tt.style.cssText =
      'position:fixed;background:#1a1208;color:#f2e8d0;border:1px solid #c8922a;padding:8px 12px;font-size:.78rem;line-height:1.6;pointer-events:none;z-index:99999;max-width:220px;display:none;border-radius:2px;font-family:"Crimson Text",serif;box-shadow:0 4px 16px rgba(0,0,0,.6)';
    document.body.appendChild(tt);
  }

  // Item: all map SYMBOLS (prosperity dots, character markers, battle swords, army banners, ritual
  // moons) are collected into a single layer appended AFTER every province's fill and coloured
  // border, so a neighbouring hex drawn later can never paint over them. pointer-events:none lets
  // hover fall through to the province beneath.
  const symbolLayer = document.createElementNS(svgNS, 'g');
  symbolLayer.setAttribute('pointer-events', 'none');

  provs.forEach((p) => {
    if (p.row === undefined || p.col === undefined) return;
    const { x, y } = hexCentre(displayCol(p.col), p.row);
    const pd = provById[p.id] || p;
    // visibility tier from the report (owned / live / border / remembered / unknown).
    const tier = pd.tier || (ownedIds.has(p.id) ? 'owned' : 'unknown');
    const isOwned = tier === 'owned';
    const isRemembered = tier === 'remembered';
    const isVisited = (tier === 'live' || tier === 'border' || tier === 'remembered') && !isOwned;
    const isAdj = tier === 'border';
    const known = tier !== 'unknown';
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('data-prov', String(p.id)); // lets the report's province links find this hex (highlightMapProv)

    // Hex fill
    const fill = document.createElementNS(svgNS, 'polygon');
    fill.setAttribute('points', hexPts(x, y));
    if (known && pd.terrain) {
      fill.setAttribute('fill', TERRAIN_COLORS_MAP[pd.terrain] || '#555');
      fill.setAttribute(
        'opacity',
        isOwned ? '1' : tier === 'live' || tier === 'border' ? '0.85' : isRemembered ? '0.45' : '0.5',
      );
    } else {
      fill.setAttribute('fill', '#555');
      fill.setAttribute('opacity', '1');
    }
    fill.setAttribute('stroke', 'rgba(0,0,0,0.4)');
    fill.setAttribute('stroke-width', '0.5');
    g.appendChild(fill);

    // Terrain icon
    if (known && pd.terrain) {
      makeTerrainIcon(svgNS, x, y - 2, pd.terrain).forEach((el) => g.appendChild(el));
    }

    // Ownership outline
    if (isOwned) {
      const ol = document.createElementNS(svgNS, 'polygon');
      ol.setAttribute('points', hexPts(x, y, HS - 0.5));
      ol.setAttribute('fill', 'none');
      ol.setAttribute('stroke', playerColor);
      ol.setAttribute('stroke-width', '2.5');
      ol.setAttribute('pointer-events', 'none');
      g.appendChild(ol);
    } else if (pd.ownerName && (isVisited || isAdj)) {
      const ol = document.createElementNS(svgNS, 'polygon');
      ol.setAttribute('points', hexPts(x, y, HS - 0.5));
      ol.setAttribute('fill', 'none');
      const ownerBorderColor = pd.ownerColor || 'rgba(255,255,255,0.45)';
      ol.setAttribute('stroke', ownerBorderColor);
      ol.setAttribute('stroke-width', isVisited ? '2' : '1.2');
      ol.setAttribute('opacity', isVisited ? '0.8' : '0.5');
      ol.setAttribute('pointer-events', 'none');
      g.appendChild(ol);
    }

    // Name label and explored % — show on all known provinces
    if (pd.name && known) {
      const lbl = document.createElementNS(svgNS, 'text');
      const lblY = pd.explored !== undefined && pd.explored > 0 ? y + HS - 10 : y + HS - 7;
      lbl.setAttribute('x', x);
      lbl.setAttribute('y', lblY);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('dominant-baseline', 'middle');
      lbl.setAttribute('font-size', '4.2');
      lbl.setAttribute('fill', isOwned ? '#fff' : isVisited ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)');
      lbl.setAttribute('pointer-events', 'none');
      lbl.setAttribute('font-family', 'Cinzel,serif');
      lbl.textContent = pd.name.length > 10 ? pd.name.substring(0, 9) + '\u2026' : pd.name;
      g.appendChild(lbl);
      if (pd.explored !== undefined && pd.explored > 0) {
        const el = document.createElementNS(svgNS, 'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y + HS - 3);
        el.setAttribute('text-anchor', 'middle');
        el.setAttribute('font-size', '3.5');
        el.setAttribute('fill', isOwned ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)');
        el.setAttribute('pointer-events', 'none');
        el.textContent = pd.explored + '%';
        g.appendChild(el);
      }
    }

    // Prosperity dots: top-left corner of hex — shown in every visible province
    if (pd.wealth) {
      const wStyles = {
        Rich: { fill: '#FFD700', stroke: '#FFA500', glow: 'drop-shadow(0 0 1.5px #FFD700)' },
        Prosperous: { fill: '#C0C0C0', stroke: '#A8A8A8', glow: null },
        Poor: { fill: '#CD7F32', stroke: '#A0522D', glow: null },
      };
      const ws = wStyles[pd.wealth] || wStyles.Poor;
      // Position: the TOP-LEFT CORNER of the hex. A pointy-top hex narrows above dy=-HS/2, so the
      // dot sits at dy≈-0.55·HS where roughly 14px of half-width is still available for the dot's
      // own top edge — it sits comfortably inside the outline at r=1.75.
      const dotX = x - HS * 0.477;
      const dotY = y - HS * 0.5;
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', dotX);
      dot.setAttribute('cy', dotY);
      dot.setAttribute('r', '1.75');
      dot.setAttribute('fill', ws.fill);
      dot.setAttribute('stroke', ws.stroke);
      dot.setAttribute('stroke-width', '0.5');
      if (ws.glow) dot.setAttribute('filter', ws.glow);
      dot.setAttribute('pointer-events', 'none');
      dot.setAttribute('class', 'sym-prosper');
      symbolLayer.appendChild(dot);
    }

    // Character markers — own (player color), enemy (their color), wanderer (grey-gold)
    if ((isOwned || isVisited) && pd.characters?.length > 0) {
      const ownChars = pd.characters.filter((c) => c.isOwn);
      // Neutral characters — wandering heroes AND the sworn guardians of neutral provinces — render
      // grey. An "enemy" is only a character that belongs to another PLAYER (has a real realm
      // colour); guards have no ownerColor, so they can never fall into the red enemy bucket.
      const enemyChars = pd.characters.filter((c) => !c.isOwn && !c.isWanderer && !c.isNeutralGuard && c.ownerColor);
      // local chieftains (sworn guards of neutral provinces) get their own marker — light brown
      // with an exclamation mark — so they can be told apart from wandering heroes (grey, ?).
      const chieftains = pd.characters.filter((c) => !c.isOwn && c.isNeutralGuard);
      const wanderers = pd.characters.filter((c) => !c.isOwn && !c.isNeutralGuard && (c.isWanderer || !c.ownerColor));

      let markerX = x + HS - 11; // item: nudged inward so it clearly sits inside the hex
      // Own characters
      if (ownChars.length > 0) {
        const mx = markerX,
          my = y - HS + 12;
        const mg = document.createElementNS(svgNS, 'g');
        mg.setAttribute('transform', `translate(${mx} ${my}) scale(0.75) translate(${-mx} ${-my})`); // ×1.5 of prior 0.5 (item: all map symbols 1.5× except prosperity dots)
        const circ = document.createElementNS(svgNS, 'circle');
        circ.setAttribute('cx', mx);
        circ.setAttribute('cy', my);
        circ.setAttribute('r', '5');
        circ.setAttribute('fill', playerColor);
        circ.setAttribute('stroke', '#fff');
        circ.setAttribute('stroke-width', '1');
        circ.setAttribute('pointer-events', 'none');
        const clbl = document.createElementNS(svgNS, 'text');
        clbl.setAttribute('x', mx);
        clbl.setAttribute('y', my + 2);
        clbl.setAttribute('text-anchor', 'middle');
        clbl.setAttribute('font-size', '5.5');
        clbl.setAttribute('fill', '#fff');
        clbl.setAttribute('pointer-events', 'none');
        const hasKing = ownChars.some((c) => c.isKing);
        if (hasKing) mapTextGlyph(clbl, '\u265B');
        else clbl.textContent = ownChars.length > 1 ? String(ownChars.length) : '';
        mg.appendChild(circ);
        mg.appendChild(clbl);
        // Hero person icon (head+shoulders) for non-king single hero
        if (!hasKing && ownChars.length === 1) {
          const hd = document.createElementNS(svgNS, 'circle');
          hd.setAttribute('cx', mx);
          hd.setAttribute('cy', my - 1.5);
          hd.setAttribute('r', '1.8');
          hd.setAttribute('fill', '#fff');
          hd.setAttribute('pointer-events', 'none');
          const sh = document.createElementNS(svgNS, 'path');
          sh.setAttribute('d', `M${mx - 2.8},${my + 2.2} Q${mx},${my + 0.5} ${mx + 2.8},${my + 2.2}`);
          sh.setAttribute('fill', '#fff');
          sh.setAttribute('pointer-events', 'none');
          mg.appendChild(hd);
          mg.appendChild(sh);
        }
        mg.setAttribute('class', 'sym-char');
        symbolLayer.appendChild(mg);
        markerX -= 8;
      }
      // Enemy characters
      if (enemyChars.length > 0) {
        const mx = markerX,
          my = y - HS + 12;
        const mg = document.createElementNS(svgNS, 'g');
        mg.setAttribute('transform', `translate(${mx} ${my}) scale(0.75) translate(${-mx} ${-my})`); // ×1.5 of prior 0.5 (item: all map symbols 1.5× except prosperity dots)
        // Now the disc is cut into one wedge per realm present (in the order the characters are
        // listed), so a shared province reads as shared at a glance.
        const realmCols = [...new Set(enemyChars.map((c) => c.ownerColor || '#7a1c1c'))];
        const ec = document.createElementNS(svgNS, 'g');
        ec.setAttribute('pointer-events', 'none');
        if (realmCols.length === 1) {
          const c1 = document.createElementNS(svgNS, 'circle');
          c1.setAttribute('cx', mx);
          c1.setAttribute('cy', my);
          c1.setAttribute('r', '4.5');
          c1.setAttribute('fill', realmCols[0]);
          c1.setAttribute('stroke', '#fff');
          c1.setAttribute('stroke-width', '0.8');
          ec.appendChild(c1);
        } else {
          const R = 4.5,
            n = realmCols.length;
          realmCols.forEach((col, i) => {
            const a0 = -Math.PI / 2 + (2 * Math.PI * i) / n,
              a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / n;
            const x0 = mx + R * Math.cos(a0),
              y0 = my + R * Math.sin(a0),
              x1 = mx + R * Math.cos(a1),
              y1 = my + R * Math.sin(a1);
            const w = document.createElementNS(svgNS, 'path');
            w.setAttribute(
              'd',
              `M${mx},${my} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`,
            );
            w.setAttribute('fill', col);
            ec.appendChild(w);
          });
          const ring = document.createElementNS(svgNS, 'circle');
          ring.setAttribute('cx', mx);
          ring.setAttribute('cy', my);
          ring.setAttribute('r', '4.5');
          ring.setAttribute('fill', 'none');
          ring.setAttribute('stroke', '#fff');
          ring.setAttribute('stroke-width', '0.8');
          ec.appendChild(ring);
        }
        const elbl = document.createElementNS(svgNS, 'text');
        elbl.setAttribute('x', mx);
        elbl.setAttribute('y', my + 2);
        elbl.setAttribute('text-anchor', 'middle');
        elbl.setAttribute('font-size', '5');
        elbl.setAttribute('fill', '#fff');
        elbl.setAttribute('pointer-events', 'none');
        const eHasKing = enemyChars.some((c) => c.isKing);
        if (eHasKing) mapTextGlyph(elbl, '\u265B');
        else elbl.textContent = enemyChars.length > 1 ? String(enemyChars.length) : ''; // a count, as the own-marker shows
        mg.appendChild(ec);
        mg.appendChild(elbl);
        if (!eHasKing && enemyChars.length === 1) {
          const ehd = document.createElementNS(svgNS, 'circle');
          ehd.setAttribute('cx', mx);
          ehd.setAttribute('cy', my - 1.5);
          ehd.setAttribute('r', '1.8');
          ehd.setAttribute('fill', '#fff');
          ehd.setAttribute('pointer-events', 'none');
          const esh = document.createElementNS(svgNS, 'path');
          esh.setAttribute('d', `M${mx - 2.8},${my + 2.2} Q${mx},${my + 0.5} ${mx + 2.8},${my + 2.2}`);
          esh.setAttribute('fill', '#fff');
          esh.setAttribute('pointer-events', 'none');
          mg.appendChild(ehd);
          mg.appendChild(esh);
        }
        mg.setAttribute('class', 'sym-char');
        symbolLayer.appendChild(mg);
        markerX -= 8;
      }
      // Wandering heroes
      if (wanderers.length > 0) {
        const mx = markerX,
          my = y - HS + 12;
        const mg = document.createElementNS(svgNS, 'g');
        mg.setAttribute('transform', `translate(${mx} ${my}) scale(0.75) translate(${-mx} ${-my})`); // ×1.5 of prior 0.5 (item: all map symbols 1.5× except prosperity dots)
        const wc = document.createElementNS(svgNS, 'circle');
        wc.setAttribute('cx', mx);
        wc.setAttribute('cy', my);
        wc.setAttribute('r', '4.5');
        wc.setAttribute('fill', '#888');
        wc.setAttribute('stroke', '#fff');
        wc.setAttribute('stroke-width', '1');
        wc.setAttribute('pointer-events', 'none');
        const wlbl = document.createElementNS(svgNS, 'text');
        wlbl.setAttribute('x', mx);
        wlbl.setAttribute('y', my + 2);
        wlbl.setAttribute('text-anchor', 'middle');
        wlbl.setAttribute('font-size', '5');
        wlbl.setAttribute('fill', '#fff');
        wlbl.setAttribute('pointer-events', 'none');
        wlbl.textContent = '?';
        mg.appendChild(wc);
        mg.appendChild(wlbl);
        mg.setAttribute('class', 'sym-char');
        symbolLayer.appendChild(mg);
        markerX -= 8;
      }
      // Local chieftains — light brown dot with an exclamation mark
      if (chieftains.length > 0) {
        const mx = markerX,
          my = y - HS + 12;
        const mg = document.createElementNS(svgNS, 'g');
        mg.setAttribute('transform', `translate(${mx} ${my}) scale(0.75) translate(${-mx} ${-my})`);
        const gc = document.createElementNS(svgNS, 'circle');
        gc.setAttribute('cx', mx);
        gc.setAttribute('cy', my);
        gc.setAttribute('r', '4.5');
        gc.setAttribute('fill', CHIEFTAIN_MARKER_COLOR);
        gc.setAttribute('stroke', '#fff');
        gc.setAttribute('stroke-width', '1');
        gc.setAttribute('pointer-events', 'none');
        const glbl = document.createElementNS(svgNS, 'text');
        glbl.setAttribute('x', mx);
        glbl.setAttribute('y', my + 2);
        glbl.setAttribute('text-anchor', 'middle');
        glbl.setAttribute('font-size', '5');
        glbl.setAttribute('font-weight', '700');
        glbl.setAttribute('fill', '#fff');
        glbl.setAttribute('pointer-events', 'none');
        glbl.textContent = '!';
        mg.appendChild(gc);
        mg.appendChild(glbl);
        mg.setAttribute('class', 'sym-char');
        symbolLayer.appendChild(mg);
      }
    }

    // Item 5/10: a distinct "(dead)" skull marker for any fallen hero whose body lies in a province
    // this player can see. Sits BOTTOM-LEFT. The name-with-"(dead)" shows in the hex tooltip
    // (popupKnownChars). Drawn even when no living characters stand here, and never the same glyph
    // as a living commander.
    if (isOwned || isVisited) {
      const deadHere = (report.visibleDeadHeroes || []).filter((d) => d.locationId === pd.id);
      if (deadHere.length > 0) {
        const dx = x - HS + 8,
          dy = y + HS - 10; // moved to the bottom-left corner
        const dt = document.createElementNS(svgNS, 'text');
        dt.setAttribute('x', dx);
        dt.setAttribute('y', dy);
        dt.setAttribute('text-anchor', 'middle');
        dt.setAttribute('font-size', '6'); // item: half size
        // the skull is WHITE, so it needs a DARK keyline to hold its shape over pale terrain — the
        // old parchment halo was there to lift a dark crimson ☠ and would now erase the mark.
        dt.setAttribute('stroke', '#241a12');
        dt.setAttribute('stroke-width', '0.35');
        dt.setAttribute('paint-order', 'stroke');
        dt.setAttribute('filter', 'drop-shadow(0 0 1px rgba(0,0,0,.7))'); // same shadow as the graves cross
        dt.setAttribute('pointer-events', 'none');
        // a `path` marker returns a NEW <g> carrying the attributes across — append the RETURN
        // VALUE, never `dt` itself, or the skull is built and thrown away (see mapSymSvg).
        const dNode = mapSymSvg(dt, MAP_SYM.dead); // 💀 — one definition, shared with the popup
        dNode.setAttribute('class', 'sym-dead');
        symbolLayer.appendChild(dNode);
      }
    }
    // a small race badge in the BOTTOM-RIGHT corner of every known hex — H/E/D/O for the humanoid
    // races, C for Creature, M for Monster (Whale Cohorts are creatures; sea beasts are monsters) —
    // so a glance shows which peoples live where. formatRace() collapses the engine's
    // 'Primal:<sub-race>' values to Creature/Monster. Uninhabited land and empty sea show nothing.
    if (known && pd.race) {
      const rb = MAP_RACE_BADGE[formatRace(pd.race)];
      if (rb) {
        const rx = x + HS - 7.5,
          ry = y + HS - 16.5;
        const rg = document.createElementNS(svgNS, 'g');
        const rc = document.createElementNS(svgNS, 'circle');
        rc.setAttribute('cx', rx);
        rc.setAttribute('cy', ry);
        rc.setAttribute('r', '3');
        rc.setAttribute('fill', rb.fill);
        rc.setAttribute('stroke', 'none');
        rc.setAttribute('opacity', known && !isOwned && !isVisited ? '0.7' : '1');
        const rt = document.createElementNS(svgNS, 'text');
        rt.setAttribute('x', rx);
        rt.setAttribute('y', ry + 1.4);
        rt.setAttribute('text-anchor', 'middle');
        rt.setAttribute('font-size', '4');
        rt.setAttribute('font-weight', '700');
        rt.setAttribute('font-family', 'Cinzel,serif');
        rt.setAttribute('fill', rb.text);
        rt.textContent = rb.glyph;
        const rtt = document.createElementNS(svgNS, 'title');
        rtt.textContent = formatRace(pd.race) + ' province';
        rg.appendChild(rtt);
        rg.appendChild(rc);
        rg.appendChild(rt);
        rg.setAttribute('pointer-events', 'none');
        rg.setAttribute('class', 'sym-race');
        symbolLayer.appendChild(rg);
      }
    }

    // a shield at the BOTTOM-RIGHT of any owned hex where the player holds GARRISONED (unled) units
    // — a glance tells them which provinces are actually held by a standing garrison rather than
    // just owned on paper. Keyed on pd.garrisonArmies (only populated for owned provinces); the
    // bottom-right corner is kept clear of the dead-hero (bottom-left), battle (top-mid) and
    // consecrate (top-right) markers.
    if (isOwned && (pd.garrisonArmies || []).length > 0) {
      const gx = x + HS - 13,
        gy = y + HS - 10;
      const gtxt = document.createElementNS(svgNS, 'text');
      gtxt.setAttribute('x', gx);
      gtxt.setAttribute('y', gy);
      gtxt.setAttribute('text-anchor', 'middle');
      gtxt.setAttribute('font-size', '5.5'); // item: half size
      gtxt.setAttribute('fill', '#2c3e6a');
      gtxt.setAttribute('stroke', '#f4ead8');
      gtxt.setAttribute('stroke-width', '0.25');
      gtxt.setAttribute('pointer-events', 'none');
      const _gn = (pd.garrisonArmies || []).length;
      const _tt = document.createElementNS(svgNS, 'title');
      _tt.textContent = `Garrison: ${_gn} unit${_gn !== 1 ? 's' : ''} holding this province`;
      gtxt.setAttribute('pointer-events', 'auto');
      gtxt.appendChild(_tt);
      mapSymSvg(gtxt, MAP_SYM.garrison); // 🛡 garrison
      gtxt.setAttribute('class', 'sym-garrison');
      symbolLayer.appendChild(gtxt);
    }

    // Battle icon — crossed swords at the TOP-MIDDLE of any hex where a battle was fought this
    // turn, OR where a battle is still raging unresolved (a carry-on that will resume) — item 14.
    // An ongoing fight glows a little brighter and its tooltip says so.
    if (pd.hadBattle || pd.battleUnresolved) {
      const bx = x,
        by = y - HS + 12;
      const btxt = document.createElementNS(svgNS, 'text');
      btxt.setAttribute('x', bx);
      btxt.setAttribute('y', by);
      btxt.setAttribute('text-anchor', 'middle');
      btxt.setAttribute('font-size', '9'); // ×1.5 of prior 6
      btxt.setAttribute('pointer-events', 'auto');
      btxt.setAttribute('filter', 'drop-shadow(0 0 2px #000)');
      const _bt = document.createElementNS(svgNS, 'title');
      _bt.textContent = pd.battleUnresolved
        ? 'Battle still raging here — it will carry on next turn'
        : 'Battle fought here this turn';
      btxt.appendChild(_bt);
      mapSymSvg(btxt, pd.battleUnresolved ? MAP_SYM.battleOngoing : MAP_SYM.battle);
      btxt.setAttribute('class', 'sym-battle');
      symbolLayer.appendChild(btxt);
    }

    // Personal-combat icon — PURPLE crossed swords for a fight that was NOT a field battle: a duel
    // (ambush, pursuit, thief caught, a Challenge), a lair or monster encounter, or an
    // assassination attempt. The GM only sets hadCombat for realms that were actually IN the fight,
    // so a covert ambush never advertises itself to a bystander. Sits beside the red battle swords
    // when a province saw both, otherwise takes the same top-middle slot.
    if (pd.hadCombat) {
      const cx2 = x + (pd.hadBattle || pd.battleUnresolved ? 12 : 0),
        cy2 = y - HS + 12;
      const ctx2 = document.createElementNS(svgNS, 'text');
      ctx2.setAttribute('x', cx2);
      ctx2.setAttribute('y', cy2);
      ctx2.setAttribute('text-anchor', 'middle');
      ctx2.setAttribute('font-size', '9');
      ctx2.setAttribute('pointer-events', 'auto');
      ctx2.setAttribute('filter', 'drop-shadow(0 0 2px #000)');
      const _ct = document.createElementNS(svgNS, 'title');
      _ct.textContent =
        'Personal combat fought here this turn — a duel, encounter or assassination attempt, not a field battle';
      ctx2.appendChild(_ct);
      mapSymSvg(ctx2, MAP_SYM.duel);
      ctx2.setAttribute('class', 'sym-combat');
      symbolLayer.appendChild(ctx2);
    }

    // DIVINE — Consecrate: a ✨ at the TOP-RIGHT marks the realm's holy ground so the player can
    // confirm at a glance that the blessing is active (+50% tax, doubly-fanatical defenders, −15%
    // to Undead/Evil attackers, and resurrection anchor all key off this province).
    if (pd.consecrated) {
      const ctxt = document.createElementNS(svgNS, 'text');
      ctxt.setAttribute('x', x + HS * 0.42);
      ctxt.setAttribute('y', y - HS * 0.2); // pulled inward, clear of the top-right hero markers
      ctxt.setAttribute('text-anchor', 'middle');
      ctxt.setAttribute('font-size', '8');
      ctxt.setAttribute('pointer-events', 'none');
      ctxt.setAttribute('filter', 'drop-shadow(0 0 2px #000)');
      mapSymSvg(ctxt, MAP_SYM.consecrate);
      ctxt.setAttribute('class', 'sym-consec');
      symbolLayer.appendChild(ctxt);
    }

    // Capital crown — a ♛ at the TOP-LEFT of any hex that is a realm's HOME CAPITAL, drawn in that
    // realm's own colour. Shown to ANYONE who can see the province (owned, occupied, bordering,
    // remembered or seen by Clairvoyance), not just the owner, so every player can tell at a glance
    // where the other crowns sit. The GM re-reads homeProvinceIdFor every turn and the remembered
    // tier carries the snapshot taken when the hex was last observed, so a seat that MOVES is
    // followed rather than frozen. The top-left corner is otherwise free: the prosperity dot has
    // been nudged down the left flank, the hero markers sit top-right and the battle swords
    // top-middle.
    if (pd.isHomeCapitalOfOwner && pd.ownerColor) {
      //HALF the old size (font 9 → 4.5) and a skinny WHITE border instead
      // of the parchment one, so the realm's own colour reads cleanly against any hex fill. The
      // baseline is left exactly where it was: a pointy-top hex narrows fast toward its top corner,
      // and lifting the crown even 1.5px pushed the glyph's top edge outside the hex at this x
      // (harness 0913a E10). The smaller crown therefore sits a shade lower in the same slot, still
      // clear of the prosperity dot on the left flank, the swords top-middle and the hero markers
      // top-right. paint-order:stroke puts the white ring OUTSIDE the glyph — at this size a
      // centred stroke would eat the crown itself — and the drop shadow is softened to 1px so it
      // frames the white border rather than smearing over it. 2026-09-17: the crown gives the
      // TOP-LEFT CORNER back to the prosperity dot and takes the upper LEFT FLANK instead
      // (dy≈-0.05·HS) — the hex is at its full width there, so the larger glyph has more room than
      // it did in the corner, and it stays clear of the grave cross below it on the same flank and
      // of the battle swords top-middle.
      const kx = x - HS * 0.62,
        ky = y - HS * 0.145;
      const ktxt = document.createElementNS(svgNS, 'text');
      ktxt.setAttribute('x', kx);
      ktxt.setAttribute('y', ky);
      //the home-capital crown is 50% larger — 4.5 → 6.75 — so a realm's
      // seat reads at a glance on a crowded map. The white keyline grows with it (0.3 → 0.45) so the
      // glyph keeps the same proportion of outline and does not turn into a blob at the larger
      // size.
      ktxt.setAttribute('text-anchor', 'middle');
      ktxt.setAttribute('font-size', '6.75');
      ktxt.setAttribute('font-weight', '700');
      ktxt.setAttribute('font-family', 'Cinzel,serif');
      ktxt.setAttribute('fill', pd.ownerColor);
      ktxt.setAttribute('stroke', '#ffffff');
      ktxt.setAttribute('stroke-width', '0.45');
      ktxt.setAttribute('paint-order', 'stroke');
      ktxt.setAttribute('filter', 'drop-shadow(0 0 1px rgba(0,0,0,.6))');
      ktxt.setAttribute('pointer-events', 'auto');
      const _kt = document.createElementNS(svgNS, 'title');
      _kt.textContent =
        (pd.ownerName ? pd.ownerName + "'s" : 'The') +
        ' home capital' +
        (pd.tier === 'remembered' ? ' — as last seen' : '');
      ktxt.appendChild(_kt);
      mapSymSvg(ktxt, MAP_SYM.capital, pd.ownerColor);
      ktxt.setAttribute('class', 'sym-capital');
      symbolLayer.appendChild(ktxt);
    }

    // ── BATTLEFIELD GRAVES ────
    // A small cross on the LEFT FLANK of any hex this realm knows holds the graves of fallen army
    // units (the same lore the report lists under "Graveyards Known" and the hex popup spells out).
    // Two readings, and the colour is the whole point of the marker:
    // • LIGHT GREEN — learned THIS turn. The graves are certainly there right now.
    // • GREY — learned on an earlier turn. The knowledge is stale: the dead may since have been
    // raised as skeletons or rotted away, so it is a place worth marching to, not a promise.
    // Sits below the capital crown on the same flank and above the bottom-left banner row.
    if (_graveIntelById && pd.id != null && _graveIntelById[pd.id]) {
      const _gi = _graveIntelById[pd.id];
      const _fresh = _gi.turn != null && report.turnNumber != null && _gi.turn === report.turnNumber;
      const vx = x - HS * 0.62,
        vy = y + HS * 0.227;
      const vtxt = document.createElementNS(svgNS, 'text');
      vtxt.setAttribute('x', vx);
      vtxt.setAttribute('y', vy);
      vtxt.setAttribute('text-anchor', 'middle');
      vtxt.setAttribute('font-size', '6.4'); // 80% of the old 8
      vtxt.setAttribute('font-weight', '700');
      vtxt.setAttribute('stroke', '#000');
      vtxt.setAttribute('stroke-width', '0.3');
      vtxt.setAttribute('paint-order', 'stroke');
      vtxt.setAttribute('filter', 'drop-shadow(0 0 1px rgba(0,0,0,.7))');
      vtxt.setAttribute('pointer-events', 'auto');
      const _vt = document.createElementNS(svgNS, 'title');
      _vt.textContent = _fresh
        ? 'Battlefield graves lie here — read this turn, so the dead are certainly still in the ground.'
        : `Battlefield graves were here as of turn ${_gi.turn != null ? _gi.turn : '?'} — they may since have been raised or rotted away.`;
      vtxt.appendChild(_vt);
      // the cross is SVG geometry now (MAP_CROSS_PATH), so mapSymSvg hands back a <g> built from
      // vtxt's position/size/stroke/title — append THAT, not the text node.
      const vnode = mapSymSvg(vtxt, _fresh ? MAP_SYM.gravesFresh : MAP_SYM.gravesStale); // shared with the popup
      vnode.setAttribute('class', 'sym-graves');
      symbolLayer.appendChild(vnode);
    }

    // Own commander leading an army (item): a banner at the BOTTOM-LEFT of the hex marks any
    // province where this player has a character with troops under their command. Pagan ritual-site
    // moons sit just to its right so the two never collide.
    if (pd.ownArmyHere || (pd.characters || []).some((c) => c.isOwn && (c.armyCount || 0) > 0)) {
      const _deadBL = (report.visibleDeadHeroes || []).some((d) => d.locationId === pd.id); // dead marker shares the bottom-left
      const lx = x - HS + 8 + (_deadBL ? 9 : 0),
        ly = y + HS - 10;
      const ltxt = document.createElementNS(svgNS, 'text');
      ltxt.setAttribute('x', lx);
      ltxt.setAttribute('y', ly);
      ltxt.setAttribute('text-anchor', 'middle');
      ltxt.setAttribute('font-size', '9');
      ltxt.setAttribute('fill', playerColor);
      ltxt.setAttribute('pointer-events', 'none'); // item: army banner in the player's colour
      ltxt.setAttribute('filter', 'drop-shadow(0 0 1.5px #000)');
      mapSymSvg(ltxt, MAP_SYM.flag, playerColor);
      ltxt.setAttribute('class', 'sym-flag');
      symbolLayer.appendChild(ltxt);
    }

    // GRAND DESIGN: a 🏛 at the bottom-left of any hex holding a Wonder of the age. Visible to
    // every realm that can see the province, gold while its builder still holds the ground and grey
    // once it has been taken — the stones stand either way, but the blessings do not.
    if (pd.grandDesign) {
      const _flagGD = pd.ownArmyHere || (pd.characters || []).some((c) => c.isOwn && (c.armyCount || 0) > 0);
      const _deadGD = (report.visibleDeadHeroes || []).some((d) => d.locationId === pd.id);
      const _ritGD = (pd.features || []).some((f) => f.ritualSite);
      const gx = x - HS + 8 + ((_deadGD ? 9 : 0) + (_flagGD ? 9 : 0) + (_ritGD ? 9 : 0)),
        gy = y + HS - 10;
      const gtxt = document.createElementNS(svgNS, 'text');
      gtxt.setAttribute('x', gx);
      gtxt.setAttribute('y', gy);
      gtxt.setAttribute('text-anchor', 'middle');
      gtxt.setAttribute('font-size', '9');
      gtxt.setAttribute('fill', pd.grandDesign.active ? '#d8a63a' : '#8a8a8a');
      gtxt.setAttribute('pointer-events', 'none');
      gtxt.setAttribute('filter', 'drop-shadow(0 0 1.5px #000)');
      gtxt.setAttribute('opacity', pd.grandDesign.active ? '1' : '0.45'); // dormant Wonders read by opacity now that the glyph is an emoji
      mapSymSvg(gtxt, MAP_SYM.wonder);
      gtxt.setAttribute('class', 'sym-wonder');
      symbolLayer.appendChild(gtxt);
    }

    // Ritual sites: a 🌙 at the bottom-left of any hex where THIS player has DISCOVERED a ritual
    // site — shown to every realm that has found it (like a lair's star), and persisting on
    // remembered provinces regardless of who owns the ground. Only Pagan realms may actually
    // Perform Rites here
    // (the popup notes this); anyone who found the stones can still see them on their map.
    if ((pd.features || []).some((f) => f.ritualSite)) {
      const hasFlag = pd.ownArmyHere || (pd.characters || []).some((c) => c.isOwn && (c.armyCount || 0) > 0);
      const _deadBL2 = (report.visibleDeadHeroes || []).some((d) => d.locationId === pd.id);
      const mnx = x - HS + 8 + ((_deadBL2 ? 9 : 0) + (hasFlag ? 9 : 0) + (pd.grandDesign ? 9 : 0)),
        mny = y + HS - 10;
      const mtxt = document.createElementNS(svgNS, 'text');
      mtxt.setAttribute('x', mnx);
      mtxt.setAttribute('y', mny);
      mtxt.setAttribute('text-anchor', 'middle');
      mtxt.setAttribute('font-size', '9');
      mtxt.setAttribute('pointer-events', 'none');
      mtxt.setAttribute('filter', 'drop-shadow(0 0 1.5px #000)');
      mapSymSvg(mtxt, MAP_SYM.ritual);
      mtxt.setAttribute('class', 'sym-ritual');
      symbolLayer.appendChild(mtxt);
    }

    // Tooltip
    if (known) {
      g.style.cursor = 'pointer';
      // the popup is built by ONE function called from both mousemove (desktop hover) and click
      // (a tap). A tap that re-selects a hex after the popup was dismissed by tapping elsewhere does
      // not always produce an emulated mousemove on touch browsers (the "hover" never left), so the
      // click must draw the popup itself — before 2026-09-20 it only made it sticky, and a dismissed
      // popup could not be re-opened until the view was switched.
      const showTip = (ev) => {
        const h = [
          kcHtml`<strong style="font-family:'Cinzel',serif;font-size:.8rem">${pd.name || capitalise(pd.terrain) || 'Unknown'}</strong><br>`,
        ];
        // the province's native armies, one per line, or a note that it has none
        const natives = () =>
          pd.armyTypes?.length
            ? pd.armyTypes.map((t) => kcHtml`<br>${unitEmoji(t)} ${t}`)
            : kcHtml`<br>${txtGlyph('\u2694')} <span style="opacity:.7;font-style:italic">No native recruitable armies</span>`;
        // its standing lairs, one per line (2026-09-24, Toby item 9), and its ritual sites (item 4)
        const lairsAndRites = () => {
          const kf = (pd.features || []).filter((f) => !f.cleared);
          const lairs = kf.filter((f) => !f.ritualSite),
            rituals = kf.filter((f) => f.ritualSite);
          return [
            lairs.length ? kcHtml`<br>${kcJoinP(lairs.map(_lairStar), kcHtml`<br>`)}` : '',
            _lairsClearedNote(pd),
            rituals.length
              ? kcHtml`<br>\u{1F319} ${rituals.map((f) => f.name).join(', ')} <span style="opacity:.7;font-style:italic">(ritual site${rituals.length !== 1 ? 's' : ''})</span>`
              : '',
          ];
        };
        if (isOwned) {
          h.push(
            kcHtml`${capitalise(pd.terrain)} · <span style="color:#e8b84b">${pd.tax ?? '?'}g/turn</span> · <span style="color:#8fbc5a">Your province</span>`,
          );
          if (pd.consecrated)
            h.push(
              kcHtml`<br><span style="color:#f0d060">\u2728 Consecrated \u2014 holy ground (+50% tax, defenders twice as fanatical, Undead/Evil attackers \u221215%, resurrections return here)</span>`,
            );
          h.push(_grandDesignNote(pd));
          h.push(terrorNoteP(pd)); // item 23: an Evil realm sees the Terror
          h.push(kcHtml`<br>${mapRaceBadgeHtml(formatRace(pd.race))} ${formatRace(pd.race)}`); // the hex's own race badge
          if (pd.explored !== undefined) h.push(kcHtml`<br>\u{1F50D} ${pd.explored}% explored`);
          h.push(lairsAndRites());
          h.push(natives());
          h.push(popupKnownChars(pd, report.visibleDeadHeroes));
          if (pd.neutralDefenders?.length)
            h.push(
              kcHtml`${pd.neutralGuard ? kcHtml`<br>\u{1F6E1} ${pd.neutralGuard.name} leads:` : ''}${pd.neutralDefenders.map((d) => kcHtml`<br>${unitEmoji(d.type)} <span style="color:#d8cfbd">${armyLabel(d)}</span>`)}`,
            );
          h.push(_garrisonNote(pd)); // the standing garrison
          h.push(_graveNote(pd)); // known battlefield graves
        } else if (isVisited) {
          h.push(`${capitalise(pd.terrain || '?')} · ${pd.wealth || '?'}`);
          if (pd.race !== undefined) h.push(` · ${formatRace(pd.race)}`);
          h.push(kcHtml`<br>${_ownerLineP(pd)}`);
          h.push(_grandDesignNote(pd));
          h.push(terrorNoteP(pd)); // item 23: an Evil realm sees the Terror
          if (pd.explored !== undefined) h.push(kcHtml`<br>\u{1F50D} ${pd.explored}% explored`);
          h.push(lairsAndRites());
          h.push(natives());
          if (pd.tier === 'remembered')
            h.push(
              kcHtml`<br><span style="color:#c8922a;font-style:italic">\u{1F441} Last seen turn ${pd.seenTurn ?? '?'}</span>`,
            );
          h.push(popupKnownChars(pd, report.visibleDeadHeroes));
          h.push(_garrisonNote(pd)); // a garrison seen by a character standing here
          h.push(_graveNote(pd)); // known battlefield graves
        } else {
          h.push(`${capitalise(pd.terrain || '?')} terrain · ${pd.wealth || 'unknown wealth'}`);
          h.push(kcHtml`<br>${_ownerLineP(pd)}`);
          h.push(_grandDesignNote(pd));
          h.push(terrorNoteP(pd)); // item 23: an Evil realm sees the Terror
          h.push(natives());
          h.push(_graveNote(pd)); // grave lore is remembered even for distant ground
        }
        tt.innerHTML = kcHtml`${h}<div style="text-align:right;margin-top:8px;border-top:1px solid #4a3a1a;padding-top:6px"><button onclick="_closeMapTip(event)" style="background:#7a1c1c;color:#fff;border:none;padding:6px 14px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:.72rem;pointer-events:auto">\u2715 Close</button></div>`;
        tt.style.display = 'block';
        tt.style.left = ev.clientX + 16 + 'px';
        tt.style.top = ev.clientY + 16 + 'px';
        _clampMapTip(tt); // keep the whole popup — Close button included — inside the viewport
      };
      g.addEventListener('mousemove', showTip);
      g.addEventListener('mouseleave', () => {
        if (!tt._sticky) tt.style.display = 'none';
      });
      // a tap/click makes the popup STICKY and interactive (so the Close button works on mobile,
      // where there is no mouse-leave to dismiss it). Desktop hover still auto-hides on
      // mouse-leave.
      g.addEventListener('click', (ev) => {
        showTip(ev);
        tt._sticky = true;
        tt.style.pointerEvents = 'auto';
        ev.stopPropagation();
      });
    }

    svgEl.appendChild(g);
  });
  svgEl.appendChild(symbolLayer); // symbols on top of every province fill/border
}

// ── INLINE MAP ────
// dismiss the sticky province popup (mobile — no mouse-leave to hide it).
export function _closeMapTip(ev) {
  if (ev) {
    ev.stopPropagation();
  }
  const tt = document.getElementById('map-tooltip');
  if (tt) {
    tt.style.display = 'none';
    tt._sticky = false;
    tt.style.pointerEvents = 'none';
  }
}
// 2026-09-11. Root causes: (1) the popup was placed at the tap point +16px with no bounds check, so
// a tap near the right/bottom edge pushed its Close button off-screen; (2) nothing closed it when
// the player switched Map/Report/Orders views or tapped elsewhere. Fixes: clamp the popup inside
// the viewport after it is shown; a tap or click anywhere outside the popup, an Escape key, a
// view/tab switch or closing the fullscreen map all dismiss it.
export function _clampMapTip(tt) {
  try {
    const r = tt.getBoundingClientRect(),
      vw = window.innerWidth || 0,
      vh = window.innerHeight || 0,
      pad = 8;
    if (!vw || !vh) return;
    let l = r.left,
      t = r.top;
    if (l + r.width > vw - pad) l = Math.max(pad, vw - pad - r.width);
    if (t + r.height > vh - pad) t = Math.max(pad, vh - pad - r.height);
    if (l < pad) l = pad;
    if (t < pad) t = pad;
    tt.style.left = l + 'px';
    tt.style.top = t + 'px';
    tt.style.maxHeight = Math.max(120, vh - 2 * pad) + 'px';
    tt.style.overflowY = 'auto';
  } catch (e) {}
}
document.addEventListener(
  'click',
  (ev) => {
    const tt = document.getElementById('map-tooltip');
    if (!tt || tt.style.display === 'none' || !tt._sticky) return;
    if (tt.contains(ev.target)) return;
    _closeMapTip();
  },
  true,
);
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') _closeMapTip();
});

// ── MAP ICON TOGGLES ────
// Each overlay icon type carries a CSS class (sym-<type>); a shared <style> hides the classes the
// player has switched off, so the setting persists across map re-renders and applies to both the
// inline and fullscreen maps. The toggle bar is built once.
export const MAP_ICON_TYPES = [
  { key: 'char', emoji: '\u{1F464}', label: 'Heroes' },
  { key: 'flag', sym: 'flag', label: 'Army flags' },
  { key: 'garrison', sym: 'garrison', label: 'Garrisons' },
  { key: 'battle', sym: 'battle', label: 'Battles' },
  { key: 'combat', sym: 'duel', label: 'Duels' },
  { key: 'capital', sym: 'capital', label: 'Capitals' },
  { key: 'dead', sym: 'dead', label: 'Fallen' },
  { key: 'consec', sym: 'consecrate', label: 'Consecrated' },
  { key: 'ritual', sym: 'ritual', label: 'Ritual sites' },
  { key: 'prosper', dot: '#FFD700', label: 'Prosperity' },
  { key: 'graves', sym: 'gravesFresh', label: 'Graves' },
  { key: 'race', badge: 'Human', label: 'Races' },
];
export const _mapIconOff = new Set();
export function applyMapIconVisibility() {
  let st = document.getElementById('map-icon-style');
  if (!st) {
    st = document.createElement('style');
    st.id = 'map-icon-style';
    document.head.appendChild(st);
  }
  st.textContent = [..._mapIconOff].map((k) => `.sym-${k}{display:none!important;}`).join('');
  // reflect button states
  document.querySelectorAll('#map-icon-toggles button[data-icon]').forEach((b) => {
    const off = _mapIconOff.has(b.getAttribute('data-icon'));
    b.style.opacity = off ? '0.4' : '1';
    b.style.textDecoration = off ? 'line-through' : 'none';
  });
}
export function toggleMapIcon(key) {
  if (_mapIconOff.has(key)) _mapIconOff.delete(key);
  else _mapIconOff.add(key);
  applyMapIconVisibility();
}
export function buildMapIconToggles() {
  const bar = document.getElementById('map-icon-toggles');
  if (!bar || bar._built) return;
  bar._built = true;
  // the swatch on each button is drawn from MAP_SYM, exactly as the hex and the legend are — so the
  // button, the legend entry and the marker on the map are one glyph in one colour on every
  // platform.
  const swatch = (t) => {
    if (t.sym && MAP_SYM[t.sym]) return mapSymHtml(MAP_SYM[t.sym], null, '.8rem');
    if (t.emoji) return kcHtml`<span style="font-size:.8rem">${t.emoji}\uFE0F</span>`;
    if (t.dot)
      return kcHtml`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.dot};vertical-align:0"></span>`;
    if (t.badge) return mapRaceBadgeHtml(t.badge);
    return '';
  };
  bar.innerHTML = kcHtml`${MAP_ICON_TYPES.map(
    (t) =>
      kcHtml`<button type="button" data-icon="${t.key}" onclick="toggleMapIcon(${kcArg(t.key)})" title="Show/hide ${t.label}" style="background:#241810;color:#e8b84b;border:1px solid #4a3418;border-radius:2px;padding:2px 6px;cursor:pointer;font-size:.62rem;line-height:1.3;display:inline-flex;align-items:center;gap:4px">${swatch(t)}${t.label}</button>`,
  )}`;
  applyMapIconVisibility();
}
export function renderPlayerMap(report) {
  const svg = document.getElementById('report-map-svg');
  const r = report || viewingReport || currentReport;
  if (!svg || !r) return;
  buildMapIconToggles(); // ensure the icon on/off bar exists
  applyMapSymLegend(); // legend swatches drawn from MAP_SYM, same as the hexes
  renderMapIntoSvg(svg, r);
  applyMapIconVisibility(); // re-assert toggles onto the freshly drawn icons
  applyMapZoom(); // keep the current zoom (and its scroll bars) after a re-render
}

// ── FULLSCREEN MAP ────
export function showFullscreenMap() {
  const old = document.getElementById('map-fullscreen-modal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'map-fullscreen-modal';
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:10000;display:flex;flex-direction:column';
  const hdr = document.createElement('div');
  hdr.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#1a1208;border-bottom:1px solid #c8922a;flex-shrink:0';
  hdr.innerHTML =
    '<span style="font-family:Cinzel,serif;color:#e8b84b;font-size:.85rem">Known World</span>' +
    '<button onclick="_closeMapTip();document.getElementById(\'map-fullscreen-modal\').remove()" ' +
    'style="background:#7a1c1c;color:#fff;border:none;padding:7px 16px;cursor:pointer;font-family:Cinzel,serif;font-size:.72rem;border-radius:2px">\u2715 Close</button>';
  const body = document.createElement('div');
  body.className = 'kc-map-scroll';
  body.style.cssText =
    'flex:1;overflow:auto;padding:12px;background:#0e0a04;display:flex;align-items:flex-start;justify-content:flex-start';
  const fsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // Render large enough to be readable and to genuinely overflow the window on both axes, so the
  // fullscreen map has clear horizontal + vertical scroll bars for panning. Map fix: explicit pixel
  // width AND height. `height:auto` resolved to 150px on phones, so the 1500px-wide map was
  // squashed into a 1500x150 box and looked "zoomed right out".
  const fsW = Math.max(window.innerWidth || 0, 1500);
  fsSvg.style.cssText = 'display:block;width:' + fsW + 'px;flex:0 0 auto';
  body.appendChild(fsSvg);
  modal.appendChild(hdr);
  modal.appendChild(body);
  document.body.appendChild(modal);
  if (viewingReport || currentReport) renderMapIntoSvg(fsSvg, viewingReport || currentReport);
  if (fitMapSvgHeight(fsSvg, fsW) == null) fsSvg.style.height = Math.max(200, (window.innerHeight || 400) - 80) + 'px';
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) {
      _closeMapTip();
      modal.remove();
    }
  });
}
