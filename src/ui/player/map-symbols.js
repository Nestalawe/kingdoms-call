import { kcArg, kcHtml } from '../shared/kc-safe.js';
import { KC_TERRAIN_COLORS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.js';
import { kcJoinP } from './startup.js';
import { GD_BY_ALIGNMENT, GUARD_POWER_COLORS_P, deadHeroRealmTagP } from './items-and-heroes.js';
import { ALL_SKILLS, armyLabel, unitEmoji } from './order-chances.js';
import { SKILL_LABELS } from './move-analysis.js';

// ── TERRAIN COLORS ────
export const TERRAIN_COLORS_MAP = { ...KC_TERRAIN_COLORS };

// ── TERRAIN ICONS (proper SVG element creation) ────
export function makeTerrainIcon(svgNS, cx, cy, terrain) {
  const els = [];
  const mk = (tag, attrs) => {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute('pointer-events', 'none');
    return el;
  };
  switch (terrain) {
    case 'sea':
      // every glyph re-centred on (cx,cy) by its bounding box.
      els.push(
        mk('path', {
          d: `M${cx - 8},${cy - 1} q4,-4 8,0 q4,4 8,0`,
          stroke: 'rgba(255,255,255,0.55)',
          'stroke-width': '1.5',
          fill: 'none',
        }),
      );
      els.push(
        mk('path', {
          d: `M${cx - 6},${cy + 3} q3,-3 6,0 q3,3 6,0`,
          stroke: 'rgba(255,255,255,0.35)',
          'stroke-width': '1',
          fill: 'none',
        }),
      );
      break;
    case 'forest':
      [
        [cx - 8.5, cy - 3],
        [cx + 0.5, cy - 3],
      ].forEach(([tx, ty]) => {
        els.push(
          mk('polygon', {
            points: `${tx},${ty + 6} ${tx + 4},${ty - 2} ${tx + 8},${ty + 6}`,
            fill: 'rgba(255,255,255,0.35)',
          }),
        );
        els.push(mk('rect', { x: tx + 3.5, y: ty + 5, width: 1, height: 3, fill: 'rgba(255,255,255,0.3)' }));
      });
      break;
    case 'jungle':
      // Jungle: circles (like forest but round canopies instead of triangles)
      [cx - 9, cx - 3, cx + 3].forEach((tx, i) => {
        const ty = cy + (i === 1 ? -4 : -1);
        els.push(mk('circle', { cx: tx + 3, cy: ty + 2, r: '4', fill: 'rgba(255,255,255,0.28)' }));
        els.push(mk('rect', { x: tx + 2.5, y: ty + 5.5, width: 1, height: 2.5, fill: 'rgba(255,255,255,0.25)' }));
      });
      break;
    case 'mountain':
      els.push(
        mk('polygon', {
          points: `${cx - 10},${cy + 5} ${cx - 4},${cy - 5} ${cx + 2},${cy + 5}`,
          fill: 'rgba(255,255,255,0.2)',
          stroke: 'rgba(255,255,255,0.45)',
          'stroke-width': '0.8',
        }),
      );
      els.push(
        mk('polygon', {
          points: `${cx - 2},${cy + 5} ${cx + 4},${cy - 4} ${cx + 10},${cy + 5}`,
          fill: 'rgba(255,255,255,0.12)',
          stroke: 'rgba(255,255,255,0.35)',
          'stroke-width': '0.8',
        }),
      );
      break;
    case 'desert':
      els.push(
        mk('path', {
          d: `M${cx - 12},${cy + 2} q6,-8 12,0 q6,8 12,0`,
          stroke: 'rgba(255,255,255,0.4)',
          'stroke-width': '1.5',
          fill: 'none',
        }),
      );
      break;
    case 'plain':
      els.push(mk('circle', { cx, cy, r: '3', fill: 'rgba(255,255,255,0.35)' }));
      [
        [0, -6],
        [0, 6],
        [-5, -3],
        [5, -3],
        [-5, 3],
        [5, 3],
      ].forEach(([dx, dy]) => {
        els.push(
          mk('line', {
            x1: cx + dx * 0.55,
            y1: cy + dy * 0.55,
            x2: cx + dx,
            y2: cy + dy,
            stroke: 'rgba(255,255,255,0.3)',
            'stroke-width': '1',
          }),
        );
      });
      break;
  }
  return els;
}

// ── CORE MAP RENDERER ────
// Popup helper: list characters you know are in a province (own / neutral / enemy) at end of turn.
// A player-facing label for an unaligned (player===null) character. Provincial guardians are "local
// chieftains"; only masterless heroes are "wandering". The engine bakes ' (wandering)' into the
// NAME of a guardian once they are beaten off their province, so strip any existing suffix first —
// otherwise a defeated chieftain rendered as "Name (wandering) (wandering)". present a king's
// alignment description as a scannable bullet list instead of one dense paragraph. Splits on a
// period followed by whitespace, so decimals (×1.5), ranges (2–5) and mid-clause em-dashes stay
// intact (their period isn't followed by a space). Curated wording is preserved verbatim; only the
// presentation changes. `text` is shown as text, and each **bold** run becomes <strong> (P0-19).
export function bulletizeDesc(text) {
  if (!text) return '';
  const bold = (s) => s.split(/\*\*(.+?)\*\*/).map((x, i) => (i % 2 ? kcHtml`<strong>${x}</strong>` : x));
  const raw = String(text).trim();
  const parts = raw
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return kcHtml`${bold(String(text))}`;
  const lis = parts.map((p) => {
    const needsDot = !/[.!?]$/.test(p); // last clause keeps its period; earlier ones had theirs stripped
    return kcHtml`<li style="margin-bottom:4px">${bold(p)}${needsDot ? '.' : ''}</li>`;
  });
  return kcHtml`<ul style="margin:2px 0 0;padding-left:1.15em;line-height:1.45">${lis}</ul>`;
}
export function neutralCharLabel(c) {
  const base = String((c && c.name) || '')
    .replace(/\s*\(wandering\)/gi, '')
    .trim();
  return `${base} (${c && c.isNeutralGuard ? 'local chieftain' : 'wandering'})`;
}
// the map tooltip has a very dark background, so a dark realm colour (e.g. navy) would be hard to
// read. Lighten only low-luminance colours (mix toward white); bright ones pass through.
// ── TEXT COLOUR BY BACKGROUND (2026-09-20, Toby) ── One rule: on a DARK background (the map popup)
// a colour is lightened until it reads; on a LIGHT background (the parchment turn report, order
// forms, standings) it is darkened until it reads. Both keep the hue — a realm stays recognisably
// its own colour — and move only as far as a contrast ratio needs (WCAG: 4.5 on the parchment,
// 6 on the near-black popup). Map BORDERS and hex fills use the raw realm colour, untouched.
export function _hexRgb(hex) {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#' || hex.length !== 7) return null;
  const v = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return v.some(isNaN) ? null : v;
}
export function _relLum(rgb) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
export function _contrast(a, b) {
  const la = _relLum(a),
    lb = _relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function _toHex(rgb) {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function _shiftForContrast(hex, bgHex, target, toward) {
  const rgb = _hexRgb(hex),
    bg = _hexRgb(bgHex);
  if (!rgb || !bg) return hex;
  if (_contrast(rgb, bg) >= target) return hex;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const m = rgb.map((c) => c + (toward - c) * t);
    if (_contrast(m, bg) >= target) return _toHex(m);
  }
  return _toHex(rgb.map(() => toward));
}
// text on the dark map popup (#1a1208)
// 2026-09-26b (Toby item 6): the map popup's "Owned by …" line shows the owning realm's name in the
// realm's own colour (lifted for the dark tooltip) followed by the player's standing with it —
// Neutral, Allied or Enemy — read from report.diplomacy.known (matched by owner index, else by name).
export function _ownerLineP(pd) {
  if (!pd || !pd.ownerName) return 'Unclaimed';
  const r = currentReport || {};
  const known = (r.diplomacy && r.diplomacy.known) || [];
  const k = known.find((x) => pd.owner != null && x.index === pd.owner) || known.find((x) => x.name === pd.ownerName);
  const col = _tintForDarkTooltip(pd.ownerColor || (k && k.color)) || '#f2e8d0';
  const rel = k ? k.relation : null;
  const REL = { neutral: ['Neutral', '#e8d8b0'], allied: ['Allied', '#9be07a'], enemy: ['Enemy', '#ff7a6a'] };
  const tag =
    rel && REL[rel] ? kcHtml` <span style="color:${REL[rel][1]};font-weight:600">(${REL[rel][0]})</span>` : '';
  return kcHtml`Owned by <strong style="color:${col}">${pd.ownerName}</strong>${tag}`;
}
export function _tintForDarkTooltip(hex) {
  return _shiftForContrast(hex, '#1a1208', 6, 255);
}
// text on the light report parchment (checked against its palest card, #fdf5e0)
export function reportColour(hex) {
  return _shiftForContrast(hex, '#fdf5e0', 4.5, 0);
}
// ══ ONE SYMBOL TABLE FOR THE HEX AND ITS POPUP ════
// The hex and the popup were drawing the same two things with different glyphs in different
// colours: a fallen hero was ☠ in dark crimson on the map but \u{1F480} in purple in the popup, and
// battlefield graves were ✝ in green-or-grey on the map but the SAME \u{1F480} in lilac — so in the
// popup the two could not even be told apart from one another. They are defined once, here, and
// both renderers read this table, which is the only way they cannot drift apart again.
//
// The popup sits on a very dark ground (#1a1208), so a dark fill is lifted by _tintForDarkTooltip —
// that keeps the HUE identical and only raises the lightness enough to read, which is what "the
// same icon" has to mean on two different backgrounds. 2026-09-17: EVERY map marker now lives here,
// not only the two from item 1 — because the legend and the icon-toggle bar were hand-written HTML
// repeating these glyphs with no symbol font and no variation selector, which is the 2026-09-07
// mobile fault (DEV_LOG 107.7) in a different place: the hex drew a red TEXT sword while the legend
// beside it asked for a bare ⚔ and a phone answered with a colour emoji, and the capital's ♛ was
// requested in Cinzel — a LATIN-ONLY face that carries no such glyph, so a phone fell through to
// its emoji font and ignored the realm colour entirely.
// text:true → text presentation, pinned with VS15; `fill` is honoured.
// text:false → colour emoji, pinned with VS16; `fill` is ignored by the renderer, so these use
// opacity or nothing to carry meaning (the Wonder's gold/grey, per 107.7).
// fill:null → the colour is dynamic (a realm's own colour); `legend` gives the swatch a stand-in.
// the graves cross is no longer a FONT glyph at all. ✝ (U+271D) has no text-style glyph in the
// symbol fonts most phones ship, so even with VS15 pinned the emoji font answered and drew its own
// picture in its own colour — different from the desktop's Segoe/Apple Symbols cross. A marker with
// `path` is drawn as SVG geometry (box×box units, centred on 0,0) by BOTH renderers, so it is
// pixel-for-pixel the same shape in the same fill on every platform, and `fill` is always honoured.
export const MAP_CROSS_PATH = 'M-0.7 -5H0.7V-2.2H3.2V-0.8H0.7V5H-0.7V-0.8H-3.2V-2.2H-0.7Z'; // slim Latin cross (2026-09-19: skinnier)
// A bare skull (2026-09-21) — cranium and jaw as one outline, then the two eye sockets, the nasal
// triangle and two tooth gaps as sub-paths that evenodd punches out. Box 10, centred on 0,0, same
// convention as MAP_CROSS_PATH.
export const MAP_SKULL_PATH =
  'M0,-4.8C3.3,-4.8 4,-2.2 4,0.1C4,1.5 3.35,2.25 2.5,2.6L2.5,3.9C2.5,4.5 2.1,4.9 1.5,4.9L-1.5,4.9C-2.1,4.9 -2.5,4.5 -2.5,3.9L-2.5,2.6C-3.35,2.25 -4,1.5 -4,0.1C-4,-2.2 -3.3,-4.8 0,-4.8Z' +
  'M-2.95,-1A1.2,1.2 0 1,1 -0.55,-1A1.2,1.2 0 1,1 -2.95,-1Z' +
  'M0.55,-1A1.2,1.2 0 1,1 2.95,-1A1.2,1.2 0 1,1 0.55,-1Z' +
  'M0,0.45L0.8,1.95L-0.8,1.95Z' +
  'M-1.15,2.95L-0.6,2.95L-0.6,4.75L-1.15,4.75Z' +
  'M0.6,2.95L1.15,2.95L1.15,4.75L0.6,4.75Z';
export const MAP_SYM = {
  // 2026-09-21: the fallen hero is a plain WHITE SKULL, not a skull-and-crossbones. Like the graves
  // cross it is SVG geometry rather than a font glyph (MAP_CROSS_PATH's reasoning applies twice over
  // here: ☠ has no dependable text-style glyph on phones, so the emoji font answered with its own
  // coloured picture and ignored `fill`). Drawn with fill-rule evenodd so the eye sockets, nose and
  // tooth gaps are holes punched through the bone rather than filled lumps.
  dead: { glyph: '☠', text: true, fill: '#ffffff', label: 'a fallen hero lies here', path: MAP_SKULL_PATH, box: 10 },
  gravesFresh: {
    glyph: '✝',
    text: true,
    fill: '#9de89d',
    label: 'battlefield graves, read this turn',
    path: MAP_CROSS_PATH,
    box: 10,
  },
  gravesStale: {
    glyph: '✝',
    text: true,
    fill: '#9a9a9a',
    label: 'battlefield graves, older knowledge',
    path: MAP_CROSS_PATH,
    box: 10,
  },
  battle: { glyph: '⚔', text: true, fill: '#ff4444', label: 'a battle was fought here this turn' },
  battleOngoing: { glyph: '⚔', text: true, fill: '#ff8800', label: 'a battle still raging — it carries on next turn' },
  duel: { glyph: '⚔', text: true, fill: '#b060ff', label: 'personal combat — a duel, encounter or assassination' },
  capital: {
    glyph: '♛',
    text: true,
    fill: null,
    legend: '#c8922a',
    label: "a realm's home capital, in its own colour",
  },
  flag: { glyph: '⚑', text: true, fill: null, legend: '#c8922a', label: 'your army in the field' },
  consecrate: { glyph: '✨', text: false, fill: null, label: 'consecrated — holy ground' },
  ritual: { glyph: '🌙', text: false, fill: null, label: 'a ritual site you have discovered' },
  wonder: { glyph: '🏛', text: false, fill: null, label: 'a Grand Design — a Wonder of the age' },
  garrison: { glyph: '🛡', text: false, fill: null, label: 'a standing garrison holds this province' },
  lair: { glyph: '⭐', text: false, fill: null, label: 'a lair' },
};
// Paint one onto an SVG <text> node (the hex). `fill` overrides the table for the markers whose
// colour is decided at draw time (a realm's crown, a player's banner, a Wonder that has changed
// hands). 2026-09-18: a `path` marker RETURNS A NEW <g> in place of the <text> the caller built —
// the caller's x/y/font-size/stroke/filter/title/pointer-events are carried across, so the caller
// must append the RETURN VALUE, not its own text node. Callers of glyph markers still get their own
// node back.
export function mapSymSvg(el, sym, fill) {
  const f = fill != null ? fill : sym.fill;
  if (sym.path) {
    const ns = 'http://www.w3.org/2000/svg';
    const size = parseFloat(el.getAttribute('font-size')) || 8,
      box = sym.box || 10,
      sc = size / box;
    const x = parseFloat(el.getAttribute('x')) || 0,
      y = parseFloat(el.getAttribute('y')) || 0;
    const g = document.createElementNS(ns, 'g');
    // a text glyph of this font-size sits on the baseline `y`; centre the geometry where its middle
    // was
    g.setAttribute('transform', `translate(${x} ${y - size * 0.4}) scale(${sc})`);
    ['filter', 'pointer-events', 'opacity'].forEach((a) => {
      if (el.hasAttribute(a)) g.setAttribute(a, el.getAttribute(a));
    });
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', sym.path);
    p.setAttribute('fill-rule', 'evenodd'); // multi-subpath markers (the skull) punch holes; harmless on single-subpath ones
    if (f != null) p.setAttribute('fill', f);
    if (el.hasAttribute('stroke')) {
      p.setAttribute('stroke', el.getAttribute('stroke'));
      p.setAttribute('stroke-width', String((parseFloat(el.getAttribute('stroke-width')) || 0.3) / sc));
      p.setAttribute('paint-order', 'stroke');
      p.setAttribute('stroke-linejoin', 'round');
    }
    Array.from(el.childNodes).forEach((n) => {
      if (n.nodeType === 1) g.appendChild(n);
    }); // keep the <title>
    g.appendChild(p);
    return g;
  }
  if (f != null) el.setAttribute('fill', f);
  (sym.text ? mapTextGlyph : mapEmojiGlyph)(el, sym.glyph);
  return el;
}
// Render one as HTML (the popup), lifted for the dark ground.
export function mapSymHtml(sym, colour, size) {
  if (sym.path) {
    // geometry, not a font glyph — identical on every platform (see MAP_CROSS_PATH)
    const raw = colour != null ? colour : sym.fill || sym.legend;
    const col = raw ? _tintForDarkTooltip(raw) : 'currentColor';
    const b = sym.box || 10,
      sz = size || '1em';
    return kcHtml`<svg viewBox="${-b / 2} ${-b / 2} ${b} ${b}" style="width:${sz};height:${sz};vertical-align:-0.15em" aria-hidden="true"><path d="${sym.path}" fill="${col}" fill-rule="evenodd" stroke="#000" stroke-width="0.4" paint-order="stroke" stroke-linejoin="round"></path></svg>`;
  }
  // The variation selector matters as much as the glyph: VS15 pins TEXT presentation so a phone's
  // emoji font cannot hijack ☠ or ✝ and draw a colour picture that ignores our fill.
  // MAP_SYMBOL_FONT is the same symbol-capable stack the hex uses.
  const vs = sym.text ? '\uFE0E' : '\uFE0F';
  const raw = colour != null ? colour : sym.fill || sym.legend;
  const col = sym.text && raw ? `color:${_tintForDarkTooltip(raw)};` : '';
  return kcHtml`<span style="${col}font-family:${MAP_SYMBOL_FONT}${size ? ';font-size:' + size : ''}">${sym.glyph}${vs}</span>`;
}
// Any OTHER text-presentation symbol printed as HTML (the popup's ♛ before a king's name, the ⚔ on
// a wandering-hero line). Same font stack, same VS15 pin — otherwise a phone draws these two in its
// emoji font at emoji size and in emoji colour, which is exactly the desktop/mobile drift item 2 is
// about.
export function txtGlyph(ch, colour) {
  return kcHtml`<span style="${colour ? `color:${colour};` : ''}font-family:${MAP_SYMBOL_FONT}">${ch}︎</span>`;
}
// ── THE LEGEND IS DRAWN FROM THE SAME TABLE AS THE MAP ────
// Each legend swatch is an empty <span data-mapsym="key"> in the markup; this fills it in from
// MAP_SYM at boot. A legend entry therefore cannot describe a glyph or a colour the map does not
// actually draw, and both get the symbol font and the variation selector on every platform.
export function applyMapSymLegend(root) {
  (root || document).querySelectorAll('[data-mapsym]').forEach((el) => {
    const sym = MAP_SYM[el.getAttribute('data-mapsym')];
    if (!sym) return;
    el.innerHTML = mapSymHtml(
      sym,
      el.getAttribute('data-mapcolour') || null,
      el.getAttribute('data-mapsize') || '1rem',
    );
    if (!el.getAttribute('title')) el.setAttribute('title', sym.label);
  });
}
// The popup's own copy of the hex's race badge — the same lettered disc at text size, so the corner
// of the hex and the line in the popup are visibly the same mark, not a badge and an unrelated
// emoji.
export function mapRaceBadgeHtml(race) {
  const rb = MAP_RACE_BADGE[race];
  if (!rb) return '';
  return kcHtml`<svg width="13" height="13" viewBox="0 0 13 13" style="vertical-align:-2px" aria-hidden="true"><circle cx="6.5" cy="6.5" r="6" fill="${rb.fill}"></circle><text x="6.5" y="9.2" text-anchor="middle" font-size="8" font-weight="700" font-family="Cinzel,serif" fill="${rb.text}">${rb.glyph}</text></svg>`;
}
// each lair in a province popup gets its OWN star, tinted by the guardian's
// difficulty (Weak→green, Moderate→gold, Powerful→orange, Legendary→crimson).
export function _lairStar(f) {
  // use the SAME difficulty palette as the Known Lairs card and the Chronicle
  // (POWER_COLORS) — the old star used a different orange/red set — and tint the lair name too.
  // province feature data carries `monsterPower` (not `power`) — every popup lair was falling
  // through to the default brown. Difficulty now colours the map popup as everywhere else.
  const _pw = f.monsterPower || f.power;
  const col = _tintForDarkTooltip(GUARD_POWER_COLORS_P[_pw] || '#7a5510'); // lightened for the dark popup
  const _tag = _pw ? kcHtml` <span style="font-size:.68rem;opacity:.8">(${_pw})</span>` : '';
  // the guardian's kind rides along in the popup too.
  const _cat =
    !f.cleared && f.monsterCat
      ? kcHtml` <span style="font-size:.68rem;opacity:.7">${f.monsterCat.toLowerCase()}</span>`
      : '';
  return kcHtml`<span style="color:${col}">\u2b50 ${f.name}${_tag}${_cat}</span>`;
}
// ── LAIRS CLEARED ────
// The popup lists only lairs that still STAND, so a province whose lairs have all been cleared
// looked exactly like one where none was ever found — the player had no way to tell "nothing here"
// from "nothing left". Once the ground is FULLY MAPPED (100%, at which point the engine has
// revealed every feature it will show you) that ambiguity can be settled, so the popup says so
// outright. Knowledge only: `pd.features` is already filtered to what THIS realm has discovered,
// and `cleared` is the world's own flag — so a lair another realm cleared counts, and a lair a
// rival has hidden behind a Veil of Illusions is not known to be there at all. The note reports
// what the player knows.
export function _lairsClearedNote(pd) {
  if (!pd || pd.explored == null || pd.explored < 100) return '';
  const lairs = (pd.features || []).filter((f) => f && !f.ritualSite);
  if (lairs.length === 0)
    return kcHtml`<br><span style="color:${_tintForDarkTooltip('#6a7f5a')};font-style:italic">\u{1F5FA} Fully mapped \u2014 no lair was ever found in this province.</span>`;
  if (lairs.some((f) => !f.cleared)) return '';
  return kcHtml`<br><span style="color:${_tintForDarkTooltip('#4a8a4a')};font-weight:600">\u2705 Cleared of all lairs \u2014 ${lairs.length === 1 ? 'its lair has' : `all ${lairs.length} lairs have`} been put to the sword. Nothing is left to fight here.</span>`;
}
// ── GRAVES ON THE MAP ────
// If this realm knows battlefield dead lie in a province, say so in the hex popup — the same lore
// the report's Graveyards Known section shows, keyed by province id. Three readings are possible: a
// full roll of the dead (Control Undead standing on the ground), a PARTIAL one (the Deathpriest's
// Grave-sight, crack and elite only), or a bare sensing (a necromancer marching through). All three
// are stamped with the turn they were learned, because none of them refreshes on its own — the
// graves may since have been raised as skeletons or rotted to nothing.
export let _graveIntelById = null; // rebuilt each report load by _rebuildGraveIntelIndex()
export let _graveIntelTurn = null; // the report's own turn, so the popup can colour a reading the way the hex does
export function _rebuildGraveIntelIndex(report) {
  _graveIntelById = {};
  _graveIntelTurn = report && report.turnNumber != null ? report.turnNumber : null;
  ((report && report.graveIntel) || []).forEach((g) => {
    if (g && g.provinceId != null) _graveIntelById[g.provinceId] = g;
  });
}
// ── 2026-09-18: GARRISON IN THE MAP POP-UP ────
// A province whose standing garrison the player can see — their own (owned tier) or one they have a
// character standing in right now (live tier; the GM ships garrisonArmies on that tier) — reports
// how many units are garrisoned and what they are, tinted in the owner's colour. Nothing is shown
// for border/remembered ground: the report never carries a garrison the player cannot see.
export function _garrisonNote(pd) {
  if (!pd || !(pd.tier === 'owned' || pd.tier === 'live')) return '';
  const g = pd.garrisonArmies || [];
  if (!g.length) return '';
  const col = _tintForDarkTooltip(pd.ownerColor) || '#e8d8b0';
  const counts = {};
  g.forEach((a) => {
    const k = a.type || 'unit';
    counts[k] = (counts[k] || 0) + 1;
  });
  const list = Object.keys(counts)
    .map((k) => `${unitEmoji(k)} ${counts[k] > 1 ? counts[k] + '× ' : ''}${k}`)
    .join(', ');
  return kcHtml`<br>\u{1F6E1} <span style="color:${col}">${g.length} unit${g.length !== 1 ? 's' : ''} garrisoned${pd.tier === 'live' && pd.ownerName ? ` (${pd.ownerName})` : ''}</span> <span style="opacity:.8;font-size:.9em">— ${list}</span>`;
}
export function _graveNote(pd) {
  if (!pd || pd.id == null || !_graveIntelById) return '';
  const g = _graveIntelById[pd.id];
  if (!g) return '';
  // the popup now shows the map's OWN grave cross in the map's own two colours — light green for a
  // reading taken this turn (the dead are certainly still in the ground), grey for older knowledge.
  // It was a purple skull, indistinguishable from the fallen-hero line above.
  const fresh = g.turn != null && _graveIntelTurn != null && g.turn === _graveIntelTurn;
  const sym = fresh ? MAP_SYM.gravesFresh : MAP_SYM.gravesStale;
  const gcol = _tintForDarkTooltip(sym.fill);
  const stamp = kcHtml`<span style="opacity:.75">(known turn ${g.turn != null ? g.turn : '?'})</span>`;
  if (g.detail && g.detail.length) {
    const list = g.detail.map((d) => `${d.n}× ${d.k}`).join(', ');
    return kcHtml`<br>${mapSymHtml(sym)} <span style="color:${gcol}">Battlefield graves: ${g.detailPartial ? 'at least ' : ''}${list}</span> ${stamp}${g.detailPartial ? kcHtml`<br><span style="opacity:.7;font-style:italic">Grave-sight names only the crack and elite — lesser dead may lie here unseen.</span>` : ''}`;
  }
  return kcHtml`<br>${mapSymHtml(sym)} <span style="color:${gcol}">Battlefield graves lie here</span> <span style="opacity:.7;font-style:italic">— how many, and what they hold, is unknown</span> ${stamp}`;
}
// tint a lair name by its guardian's difficulty (Weak→Legendary), for inline
// lists (owned-province cards, etc.). Ritual sites and unknown-difficulty lairs render in plain
// text.
export function _lairName(f) {
  if (!f) return '';
  const col = GUARD_POWER_COLORS_P[f.monsterPower || f.power] || null;
  return col ? kcHtml`<span style="color:${col}">${f.name}</span>` : f.name || '';
}
// GRAND DESIGN: a Wonder of the age is no secret — anyone who can see the province sees the Wonder
// standing in it, and who raised it. Its powers, though, serve only the realm that built it, and
// only while that realm holds the ground: a Wonder in enemy hands is dormant stonework.
// EVIL TERROR (2026-10-12, Toby item 23): an Evil realm's report carries each province's Terror ({pct, stacks,
// byYou} on the map's records and its own provinces); the popup and the Your Provinces entry print it. `light`: the
// report's pale page rather than the dark popup. No reading (any other crown, or no Terror there) → nothing.
// BEAST COMMAND (2026-10-12, Toby item 24; mirrors the GM portal's beastCommandCount): the units that count against a
// hero's Druid level — every living Creature or Monster, not skeletons, a summoned grove or Wild Hunt beasts.
export function beastCommandCountP(a) {
  const C = new Set([...KC_UNIT_CLASS.creature, ...KC_UNIT_CLASS.monster]);
  return (
    !!a &&
    C.has(a.type) &&
    !a.skeletal &&
    !a._isSkeletal &&
    !a.temporary &&
    !a._temporary &&
    !a.wildHunt &&
    a._wildHuntUntilTurn == null &&
    !a.phantom
  );
}
export function terrorNoteP(pd, light) {
  const t = pd && pd.terror;
  if (!t || !(t.pct > 0)) return '';
  const col = light ? '#701010' : '#e08a8a';
  return kcHtml`<br><span style="color:${col}">\u{1F480} Terror ${t.pct}% \u2014 ${t.stacks} stack${t.stacks !== 1 ? 's' : ''}${t.byYou ? ' of your own' : ''}: its next defenders fight at \u2212${t.pct}%${t.byYou ? ' (yours are spared where you hold the ground)' : ''}</span>`;
}
export function _grandDesignNote(pd) {
  const gd = pd && pd.grandDesign;
  if (!gd) return '';
  return kcHtml`<br><span style="color:#d8a63a;font-weight:600">\u{1F3DB} ${gd.name}</span><span style="opacity:.85"> \u2014 a Grand Design raised by <strong>${gd.ownerName || 'a fallen realm'}</strong>${gd.active ? '.' : ', dormant while another crown holds this ground.'}</span>`;
}
// \u2500\u2500 GRAND DESIGN in YOUR PROVINCES (2026-09-27, Toby item 2) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The map popup has named the Wonder standing in a province for a while, but the Your Provinces list
// said nothing \u2014 a realm could raise its one Grand Design and never see it again on the report. The
// province entry now carries it, with what it actually does. The effect text is read from the shared
// KC_GRAND_DESIGNS table by name (the report payload carries the Wonder's name, its builder and
// whether it is active, not its alignment), so the wording can never drift from the engine's.
// (Built lazily, never as a top-level IIFE: a throw at script top level stops the whole portal
// booting — the standing ITEMS_BY_TIER lesson.)
export let _GD_DESC_BY_NAME = null;
export function grandDesignDesc(name) {
  if (!_GD_DESC_BY_NAME) {
    _GD_DESC_BY_NAME = {};
    try {
      Object.values(GD_BY_ALIGNMENT || {}).forEach((d) => {
        if (d && d.name) _GD_DESC_BY_NAME[d.name] = d.desc || '';
      });
    } catch (e) {}
  }
  return _GD_DESC_BY_NAME[name] || '';
}
export function provinceGrandDesignHTML(p) {
  const gd = p && p.grandDesign;
  if (!gd) return '';
  const desc = grandDesignDesc(gd.name);
  const mine = !!gd.active; // active === the builder still holds the ground, i.e. its powers are working
  return kcHtml`<div style="margin-top:4px;border-left:3px solid ${mine ? '#8a6208' : '#7a7160'};background:${mine ? '#fdf3d8' : '#efe9dc'};border-radius:2px;padding:4px 7px">
      <div style="font-family:Cinzel,serif;font-size:.76rem;color:#4a3105;font-weight:700">\u{1F3DB} ${gd.name}
        <span style="font-weight:400;font-size:.7rem;color:${mine ? '#1d541d' : '#7a1010'}">\u2014 ${mine ? 'active' : 'dormant'}</span></div>
      ${desc ? kcHtml`<div style="font-size:.73rem;color:#2a2419;line-height:1.45;margin-top:1px">${desc}</div>` : ''}
      <div style="font-size:.68rem;color:#4a4335;margin-top:1px">Raised by <strong>${gd.ownerName || 'a fallen realm'}</strong>.
        ${
          mine
            ? 'A realm may raise only one Grand Design, and its powers last while that realm holds this province.'
            : 'Its powers serve only the realm that built it \u2014 while another crown holds this ground it is dormant stonework.'
        }</div>
    </div>`;
}
// 2026-10-15 (D1): does a hero your orders can target lead troops? A report now says so (leadsArmies)
// rather than giving another realm's exact count; an older report still carries the count.
export function leadsArmiesP(x) {
  return x && x.leadsArmies != null ? !!x.leadsArmies : ((x && x.armies) || 0) > 0;
}
// 2026-10-15 (Toby, D2/D9): what a Spy on the hero read besides their skills — the magic items they
// carried and the army units they led, as of that spy. Empty for a hero never spied on.
export function spiedExtraP(s) {
  if (!s) return '';
  const h = [];
  if (Array.isArray(s.spiedItems))
    h.push(
      kcHtml`<br><span style="color:#1d5a1d">🔍 Items:</span> ${s.spiedItems.length ? s.spiedItems.join(', ') : 'none'}`,
    );
  if (Array.isArray(s.spiedArmies))
    h.push(
      kcHtml`<br><span style="color:#1d5a1d">🔍 Leads:</span> ${
        s.spiedArmies.length
          ? kcJoinP(
              s.spiedArmies.map((a) => armyLabel(a, { short: true })),
              ', ',
            )
          : 'no armies'
      }`,
    );
  return h.length ? kcHtml`${h}` : '';
}
export function popupKnownChars(pd, deadHeroes) {
  const chars = (pd && pd.characters) || [];
  // a fallen hero must appear ONCE — as "(dead)". De-dupe the dead list by id, and drop from the
  // live lists any character that also appears among the dead (the dead entry wins), so a hero
  // never shows both as a living commander and again as "(dead)".
  const _deadSeen = new Set();
  const dead = (deadHeroes || [])
    .filter((d) => d.locationId === (pd && pd.id))
    .filter((d) => {
      if (_deadSeen.has(d.id)) return false;
      _deadSeen.add(d.id);
      return true;
    });
  const deadIds = new Set(dead.map((d) => d.id));
  if (!chars.length && !dead.length) return '';
  // 2026-10-15 (D1): your own heroes' exact count; anyone else's rough size (armyBand), never a number
  const cnt = (c) =>
    c.armyBand
      ? c.armyBand === 'no armies'
        ? ''
        : kcHtml` <span style="opacity:.7">(${c.armyBand})</span>`
      : c.armyCount > 0
        ? kcHtml` <span style="opacity:.7">(${c.armyCount} unit${c.armyCount !== 1 ? 's' : ''})</span>`
        : '';
  const crown = (c) => (c.isKing ? kcHtml`${txtGlyph('\u265B')} ` : '');
  const own = chars.filter((c) => c.isOwn && !deadIds.has(c.id));
  const enemy = chars.filter((c) => !c.isOwn && !c.isWanderer && !deadIds.has(c.id));
  const wand = chars.filter((c) => c.isWanderer && !deadIds.has(c.id));
  const s = [];
  // colour character names by owner — own & enemy in their realm colour (lightened if needed for
  // the dark tooltip), wandering heroes and local chieftains (neutral) in grey.
  const NEUTRAL_GREY = '#9a9a9a';
  own.forEach((c) => {
    const col = _tintForDarkTooltip(c.ownerColor) || '#f2e8d0';
    s.push(kcHtml`<br>\u{1F464} <span style="color:${col}">${crown(c)}${c.name}</span>${cnt(c)}`);
  });
  enemy.forEach((c) => {
    const col = _tintForDarkTooltip(c.ownerColor) || '#e05050';
    s.push(
      kcHtml`<br>\u{1F441} <span style="color:${col}">${crown(c)}${c.name}${c.ownerName ? ' of ' + c.ownerName : ''}</span>${cnt(c)}`,
    );
  });
  wand.forEach((c) =>
    s.push(
      kcHtml`<br>${txtGlyph('\u2694')} <span style="color:${c.isNeutralGuard ? _tintForDarkTooltip(CHIEFTAIN_MARKER_COLOR) : NEUTRAL_GREY}">${neutralCharLabel(c)}</span>${cnt(c)}`,
    ),
  ); // chieftains in their marker brown
  // dead heroes whose bodies lie here — labelled '(dead)', mirroring the '(wandering)' tag.
  // 2026-09-17: the map's own ☠ in the map's own crimson, not a purple \u{1F480}.
  // 2026-09-27 (Toby item 10): name the realm the body served when it fell (or say it served none),
  // so a player reading the map can tell at a glance whose dead they are looking at — Resurrect
  // raises only your own fallen and heroes who never served a rival crown.
  if (dead.length) {
    const _dc = _tintForDarkTooltip(MAP_SYM.dead.fill);
    dead.forEach((d) =>
      s.push(
        kcHtml`<br>${mapSymHtml(MAP_SYM.dead)} <span style="color:${_dc}">${crown(d)}${d.name} (dead)</span> <span style="font-size:.9em;opacity:.9">${deadHeroRealmTagP(d, null, { dark: true, bare: true })}</span>`,
      ),
    );
  }
  return s.length ? kcHtml`${s}` : '';
}
// Single function renders into any SVG element (inline or fullscreen)
// map marker colour for local chieftains (neutral-province guards). Wandering heroes stay #888 grey
// with '?'; chieftains are light brown with '!'. Keep in step with the legend SVG above.
// 2026-09-11: how a hero's best skill is introduced, by its level — replaces the flat "Best
// skill:". 2026-09-13: a hero who is not yours is described by REPUTATION, never by an exact skill
// number — three bands across levels 1–9. The precise figures are still shown for your own
// characters, and for any hero your Spy (or Clairvoyance) has actually read. A wandering hero's
// reputation as one phrase — "legendary for Tactical". Mirrors the GM engine's heroFameText(); the
// level itself is never shown.
export function heroFameTextP(h) {
  let ts = (h && h.topSkill) || null;
  if (!ts) {
    const sk = Object.entries((h && h.skills) || {}).filter(([, v]) => v > 0);
    if (sk.length) {
      const mx = Math.max(...sk.map(([, v]) => v));
      const tied = sk.filter(([, v]) => v === mx);
      tied.sort((a, b) => ALL_SKILLS.indexOf(a[0]) - ALL_SKILLS.indexOf(b[0]));
      ts = { skill: tied[0][0], level: tied[0][1] };
    }
  }
  return ts ? `${skillFameLabel(ts.level)} ${SKILL_LABELS[ts.skill] || ts.skill}` : 'no notable skills';
}
export function skillFameLabel(level) {
  const l = level || 0;
  return l >= 7 ? 'has a heroic level of' : l >= 4 ? 'legendary for' : 'renowned for';
}
// bottom-right race badges. Keys are formatRace() outputs. 2026-09-11: no outline — the dark ring
// read as a black border at map scale. Fill + glyph only, so `stroke` is deliberately absent from
// every entry (the draw code sets stroke:'none').
// ── MAP GLYPHS THAT MOBILE CAN ACTUALLY DRAW ────
// The map's overlay symbols split into two families, and only one of them was safe on a phone.
//
// TEXT-PRESENTATION symbols — ♛ ⚑ ☠ ⚔ — are coloured by the SVG `fill` (realm colour, player
// colour, battle state). Desktop has Segoe UI Symbol / Apple Symbols, which carry them, so they
// drew correctly. The SVG asked for 'Cinzel,serif' — a Latin-only display face — so on a phone the
// request fell through to the platform serif, which carries none of them: either a tofu box, or
// the EMOJI font stepped in and drew a full-colour picture that ignores `fill` entirely. That is
// the "boxes or the wrong symbol" Toby saw. Fixed by naming a symbol-capable stack that exists on
// Android and iOS, and appending U+FE0E (variation selector-15) to pin TEXT presentation so the
// emoji font can never hijack the glyph again.
//
// EMOJI symbols — 🛡 🏛 ✨ 🌙 — are the reverse case: forcing text presentation on these is what
// risks tofu, because the mono forms are rare. They get U+FE0F (VS16) instead, so every platform
// draws the colour emoji. Their `fill` is then ignored by the renderer, which costs nothing for
// the garrison shield (navy was decoration) — but the Wonder's gold/grey DID carry meaning, so
// active vs dormant is now shown by OPACITY, which emoji honour on every platform.
export const MAP_SYMBOL_FONT =
  "'Noto Sans Symbols 2','Noto Sans Symbols','Segoe UI Symbol','Apple Symbols','Symbola','DejaVu Sans',sans-serif";
// set the glyph WITHOUT wiping child elements \u2014 callers append a <title> tooltip before
// calling these, and `textContent=` was silently deleting it.
export function _setGlyphText(el, s) {
  Array.from(el.childNodes).forEach((n) => {
    if (n.nodeType === 3) el.removeChild(n);
  });
  el.appendChild(document.createTextNode(s));
}
export function mapTextGlyph(el, ch) {
  el.setAttribute('font-family', MAP_SYMBOL_FONT);
  _setGlyphText(el, ch + '\uFE0E');
  return el;
}
export function mapEmojiGlyph(el, ch) {
  _setGlyphText(el, ch + '\uFE0F');
  return el;
}

export const MAP_RACE_BADGE = {
  Human: { glyph: 'H', fill: '#c9a961', text: '#1a1208' },
  Elven: { glyph: 'E', fill: '#6fbf73', text: '#0c2a0e' },
  Dwarven: { glyph: 'D', fill: '#9fa8b8', text: '#151a22' },
  Orcish: { glyph: 'O', fill: '#b8433a', text: '#fff' },
  Creature: { glyph: 'C', fill: '#4fa3c9', text: '#0a1f28' },
  Monster: { glyph: 'M', fill: '#7d4fb5', text: '#fff' },
};
export const CHIEFTAIN_MARKER_COLOR = '#8f6a38'; // darkened from #b08a5a — luminance 111 stays just above the tooltip's 110 lightening threshold so the popup shows the same brown
// ── LOCATE A PROVINCE ON THE MAP (2026-09-20, Toby) ── A province name in the report can be
// hovered to light up its hex on the map (desktop: the map sits beside the report), and clicked or
// tapped to bring the map into view and light it up for a few seconds (phones: switches to the Map
// tab). Every drawn hex group carries data-prov=<id>; the highlight is a pulsing outline laid over
// the whole map (pointer-events:none) so it never blocks the hex popup.
export function provLinkHtml(id, name, extraCls) {
  if (id == null || id === '') return name;
  return kcHtml`<span class="prov-link${extraCls ? ' ' + extraCls : ''}" onmouseenter="highlightMapProv(${kcArg(Number(id))},true)" onmouseleave="highlightMapProv(${kcArg(Number(id))},false)" onclick="locateOnMap(${kcArg(Number(id))})" title="Hover to light up ${name} on the map — click or tap to show it">${name}</span>`;
}
