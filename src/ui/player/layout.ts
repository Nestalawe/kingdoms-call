import { _closeMapTip, renderPlayerMap } from './map.ts';
import { onMessagesShown, refreshMsgBadgeSoon } from './dispatches.ts';

// ── MOBILE VIEW SWITCHER ────
// On narrow screens (see the @media block) the Map / Report / Orders columns are shown one at a
// time, chosen by the fixed bottom tab bar. This toggles a single class on #rp-layout; on desktop
// the class is inert (all three columns show regardless). No effect on the engine or on saved data.
export function setMobileView(view) {
  const lay = document.getElementById('rp-layout');
  if (!lay) return;
  if (view === 'messages' && !_msgEnabled) view = 'report'; // no messaging in a one-human game
  // The messages column ships with an inline display:none (so it cannot flash before the desk layout
  // places it). On a phone the mv-* classes own visibility, and an inline value would beat them — so
  // clear it here. teardownDeskLayout does the same, but it returns early on a session that never
  // built the desk layout at all (a phone that opened a report straight away).
  if (window.innerWidth < 821) {
    const _mc = document.getElementById('rp-msg-col');
    if (_mc) _mc.style.display = '';
  }
  lay.classList.remove('mv-map', 'mv-report', 'mv-messages', 'mv-orders');
  lay.classList.add('mv-' + view);
  try {
    _closeMapTip();
  } catch (e) {} // a lingering province popup must not survive a view switch
  document
    .querySelectorAll('#mobile-tabbar button')
    .forEach((b) => b.classList.toggle('active', b.getAttribute('data-mv') === view));
  if (view === 'map') {
    try {
      applyMapZoom();
    } catch (e) {}
  } // map fix: re-fit the SVG height now the column is visible
  if (view === 'messages') {
    try {
      onMessagesShown();
    } catch (e) {}
  } else refreshMsgBadgeSoon();
  try {
    window.scrollTo(0, 0);
  } catch (e) {} // start each view at its head
}

// ── DESKTOP TWO-COLUMN LAYOUT ────
// Left panel switches Map ↔ Report ↔ Dispatches; right panel switches Report ↔ Orders.
// 2026-09-27 (Toby): the left-hand Report tab is back, between Map and Dispatches, so a player can
// read the report on the left while the orders form stays open on the right. There is only ONE
// report column in the document, so it is MOVED into whichever panel is showing it — the left tab
// wins, and choosing Report on one side pushes the other side to its alternative (Orders on the
// right, Map on the left). Torn down below the desktop breakpoint so the mobile tab bar keeps
// working unchanged.
//
// _msgEnabled is declared HERE, above the layout functions that read it, rather than in the DISPATCHES
// block at the end of the script: a top-level `let` is hoisted but sits in its temporal dead zone until
// its declaration executes, and setupDeskLayout / setMobileView can be reached from a hash-restored
// report before the tail of the script has run. (The ITEMS_BY_TIER hang is the same trap.)
// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/player/globals.ts says why).
globalThis._msgEnabled = false;
globalThis._deskLeftView = 'map';
export let _deskRightView = 'report';
// Whether the Orders view is currently AVAILABLE (true on the live turn; false on past turns and
// Turn 0). On desktop the orders column's actual visibility is owned by applyDeskViews (the
// right-panel tab), so the current/past-turn code sets this flag via refreshOrdersVisibility()
// rather than poking the column's display directly — otherwise it would override the tab and stack
// Orders on top of Report.
export let _ordersAvailable = true;
export function setupDeskLayout() {
  const lay = document.getElementById('rp-layout');
  const map = document.getElementById('rp-map-col');
  const rep = document.getElementById('rp-report-col');
  const msg = document.getElementById('rp-msg-col');
  const ord = document.getElementById('orders-column');
  if (!lay || !map || !rep || !ord) return;
  if (window.innerWidth < 821) {
    return;
  } // mobile: leave the columns as direct children of #rp-layout
  if (!document.getElementById('desk-left')) {
    const left = document.createElement('div');
    left.id = 'desk-left';
    left.innerHTML =
      '<div class="desk-tabs">' +
      '<button data-side="left" data-view="map" onclick="setDeskView(\'left\',\'map\')">🗺 Map</button>' +
      '<button data-side="left" data-view="report" onclick="setDeskView(\'left\',\'report\')">📜 Report</button>' +
      '<button data-side="left" data-view="messages" id="desk-msg-tab" style="display:none" onclick="setDeskView(\'left\',\'messages\')">✉ Dispatches<span id="desk-msg-badge"></span></button>' +
      '</div><div class="desk-body" id="desk-left-body"></div>';
    const right = document.createElement('div');
    right.id = 'desk-right';
    right.innerHTML =
      '<div class="desk-tabs">' +
      '<button data-side="right" data-view="report" onclick="setDeskView(\'right\',\'report\')">📜 Report</button>' +
      '<button data-side="right" data-view="orders" onclick="setDeskView(\'right\',\'orders\')">📋 Orders</button>' +
      '</div><div class="desk-body" id="desk-right-body">' +
      '<div id="desk-right-none" style="display:none;padding:22px;font-family:\'Crimson Text\',Georgia,serif;font-size:.9rem;color:#dccba8">' +
      'The Report is open in the left panel. There are no orders to give for this turn — choose 📜 Report here to bring it back to this side.</div>' +
      '</div>';
    lay.appendChild(left);
    lay.appendChild(right);
    document.getElementById('desk-left-body').appendChild(map);
    if (msg) document.getElementById('desk-left-body').appendChild(msg);
    document.getElementById('desk-right-body').appendChild(ord);
    document.getElementById('desk-right-body').appendChild(rep); // the report lives on the right, permanently
    injectMapZoomBar();
  }
  lay.classList.add('desk');
  applyDeskViews();
  fitDeskPanels();
}
// 2026-10-08 (Toby item 11): the two panels end at the foot of the WINDOW. They were a fixed
// calc(100vh - 120px) tall, but they start lower than 120px down the page (masthead + game bar ≈
// 220px), so their last 100px sat below the fold until the page itself was scrolled — and with them
// the orders column's sticky Save Draft / Submit bar. Measured from where the panels really start,
// and re-measured whenever something above them (the game bar, the new-turn banner) changes size.
export let _deskFitObs = null;
export function fitDeskPanels() {
  const l = document.getElementById('desk-left'),
    r = document.getElementById('desk-right');
  if (!l || !r) return;
  if (window.innerWidth < 821) {
    l.style.height = '';
    r.style.height = '';
    return;
  }
  const top = l.getBoundingClientRect().top + (window.scrollY || 0);
  const h = Math.max(360, Math.floor(window.innerHeight - top - 8)) + 'px';
  if (l.style.height !== h) l.style.height = h;
  if (r.style.height !== h) r.style.height = h;
  if (!_deskFitObs && typeof ResizeObserver === 'function') {
    _deskFitObs = new ResizeObserver(() => fitDeskPanels());
    document
      .querySelectorAll('#sec-report > .detail-header, #new-turn-banner')
      .forEach((el) => _deskFitObs.observe(el));
  }
}
export function teardownDeskLayout() {
  const lay = document.getElementById('rp-layout');
  const dl = document.getElementById('desk-left'),
    dr = document.getElementById('desk-right');
  if (!lay || !dl) return;
  const map = document.getElementById('rp-map-col'),
    rep = document.getElementById('rp-report-col'),
    msg = document.getElementById('rp-msg-col'),
    ord = document.getElementById('orders-column');
  // Restore original order as direct children of #rp-layout for the mobile stacked view. The
  // messages column's visibility is owned by the mv-* class on #rp-layout there, so clear the inline
  // display the desk layout set on it (an inline display:none would beat the media block).
  [map, rep, msg, ord].forEach((el) => {
    if (el) {
      el.style.display = '';
      lay.appendChild(el);
    }
  });
  dl.remove();
  if (dr) dr.remove();
  lay.classList.remove('desk');
}
export function setDeskView(side, view) {
  if (side === 'left') {
    if (view === 'messages' && !_msgEnabled) view = 'map';
    _deskLeftView = view;
    // one report column: asking for it on the left hands the right panel over to Orders.
    if (view === 'report' && _deskRightView === 'report') _deskRightView = 'orders';
  } else {
    _deskRightView = view;
    // …and asking for it on the right sends the left panel back to the map.
    if (view === 'report' && _deskLeftView === 'report') _deskLeftView = 'map';
  }
  applyDeskViews();
  if (side === 'left' && view === 'messages') {
    try {
      onMessagesShown();
    } catch (e) {}
  } else refreshMsgBadgeSoon();
}
export function applyDeskViews() {
  const map = document.getElementById('rp-map-col'),
    rep = document.getElementById('rp-report-col'),
    msg = document.getElementById('rp-msg-col'),
    ord = document.getElementById('orders-column');
  const lb = document.getElementById('desk-left-body'),
    rb = document.getElementById('desk-right-body');
  if (!map || !rep || !ord || !lb || !rb) return;
  if (_deskLeftView === 'messages' && !_msgEnabled) _deskLeftView = 'map';
  // Both panels cannot show the one report column at once — the left tab wins (a stale pair can
  // only arise from a restored view state, never from setDeskView).
  if (_deskLeftView === 'report' && _deskRightView === 'report') _deskRightView = 'orders';
  const repLeft = _deskLeftView === 'report';
  if (repLeft) {
    if (rep.parentNode !== lb) lb.appendChild(rep);
  } else if (rep.parentNode !== rb) rb.appendChild(rep);
  if (msg && msg.parentNode !== lb) lb.appendChild(msg);
  const mt = document.getElementById('desk-msg-tab');
  if (mt) mt.style.display = _msgEnabled ? '' : 'none';
  // 'flex', not '': clearing the inline value also dropped the column's inline display:flex, so the
  // map column fell back to a block, the map grew past the panel's foot (cut off, nothing to scroll).
  map.style.display = _deskLeftView === 'map' ? 'flex' : 'none';
  if (msg) msg.style.display = _deskLeftView === 'messages' ? 'flex' : 'none';
  ord.style.display = (repLeft || _deskRightView === 'orders') && _ordersAvailable ? '' : 'none';
  rep.style.display =
    repLeft || _deskRightView === 'report' || (_deskRightView === 'orders' && !_ordersAvailable) ? '' : 'none';
  // Report on the left with no orders to give (a past turn, or Turn 0) leaves the right panel with
  // nothing to show — say so rather than presenting a blank pane.
  const none = document.getElementById('desk-right-none');
  if (none) none.style.display = repLeft && !_ordersAvailable ? '' : 'none';
  // Reflect active tab state. With the report on the left the right panel is showing Orders.
  const rightTab = repLeft ? 'orders' : _deskRightView;
  document
    .querySelectorAll('#desk-left .desk-tabs button')
    .forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === _deskLeftView));
  document
    .querySelectorAll('#desk-right .desk-tabs button')
    .forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === rightTab));
  if (_deskLeftView === 'map') {
    try {
      renderPlayerMap();
    } catch (e) {}
  }
}
// Set whether the Orders view is available (live turn vs past/Turn-0) and re-assert the layout. On
// desktop the right-panel tab governs the orders column (via applyDeskViews); on mobile we still
// toggle the column's display directly, exactly as before, since the mobile view-switcher owns that
// panel.
export function refreshOrdersVisibility(available) {
  _ordersAvailable = !!available;
  const lay = document.getElementById('rp-layout');
  const oc = document.getElementById('orders-column');
  if (lay && lay.classList.contains('desk')) {
    if (!_ordersAvailable && _deskRightView === 'orders' && _deskLeftView !== 'report') _deskRightView = 'report'; // can't sit on an unavailable tab (unless the report is already on the left)
    applyDeskViews();
  } else if (oc) {
    oc.style.display = _ordersAvailable ? 'flex' : 'none';
  }
}
// Map zoom: at 1× the map fits the window; above 1× the SVG is sized in explicit pixels
// (container content size × zoom) so it genuinely overflows and the container (#report-map-container,
// overflow:auto) shows horizontal AND vertical scroll bars for panning. Re-applied after every
// render and on resize so the current zoom always matches the panel.
export let _mapZoom = 1;
// Map fix: give an SVG an explicit pixel height matching its viewBox aspect ratio at the given
// pixel width. Inline <svg> with CSS height:auto is NOT reliably sized from the viewBox on phone
// browsers (it falls back to the 150px replaced-element default), which shrank the map to a thin
// strip. Returns the height set (or null if the SVG has no usable viewBox).
export function fitMapSvgHeight(svgEl, widthPx) {
  if (!svgEl) return null;
  const vb = (svgEl.getAttribute('viewBox') || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0) || !(widthPx > 0)) {
    svgEl.style.height = '';
    return null;
  }
  const h = Math.round((widthPx * vb[3]) / vb[2]);
  svgEl.style.height = h + 'px';
  return h;
}
export const MOBILE_MAP_WIDTH = 700; // must match #report-map-zoomwrap width in the ≤820px media block
export function injectMapZoomBar() {
  const hdr = document.querySelector('#rp-map-col > div'); // the map header row
  if (!hdr || document.getElementById('map-zoom-bar')) return;
  const bar = document.createElement('span');
  bar.id = 'map-zoom-bar';
  bar.innerHTML =
    '<button title="Zoom out" onclick="mapZoom(-0.25)">−</button>' +
    '<button title="Reset zoom" onclick="mapZoom(0)">⤢</button>' +
    '<button title="Zoom in" onclick="mapZoom(0.25)">+</button>';
  // place the zoom bar just before the fullscreen button
  const fs = hdr.querySelector('button');
  if (fs) hdr.insertBefore(bar, fs);
  else hdr.appendChild(bar);
}
export function applyMapZoom() {
  const svg = document.getElementById('report-map-svg');
  const cont = document.getElementById('report-map-container');
  const wrap = document.getElementById('report-map-zoomwrap');
  if (!svg) return;
  // on phones the map is sized purely by the mobile CSS (700px wrapper, native pinch-zoom). Android
  // fires `resize` whenever the URL bar collapses or the keyboard opens, and this was re-applying
  // desktop inline sizes to the wrapper/SVG every time — leave the phone layout alone. Map fix: the
  // SVG gets an explicit pixel height from its viewBox at the 700px phone width (CSS height:auto
  // was resolving to 150px on phones, leaving the map as a tiny strip).
  if (window.innerWidth < 821) {
    if (wrap) {
      wrap.style.width = '';
      wrap.style.height = '';
    }
    svg.style.width = '';
    svg.style.maxWidth = '';
    svg.style.maxHeight = '';
    // Map fix 2: kill the desktop flex sizing inline as well (flex:1 1 0 + min-height:0 collapsed
    // the panel to 0px on phones)
    if (cont) {
      cont.style.overflow = '';
      cont.style.flex = 'none';
      cont.style.minHeight = '60vh';
      cont.style.height = '60vh';
    }
    fitMapSvgHeight(svg, MOBILE_MAP_WIDTH);
    return;
  }
  // the scroll container is a flex child; without min-height/min-width:0 it GREW to fit the zoomed
  // map instead of scrolling (flex items default to min-size:auto) — which is why the bars never
  // appeared. The map is now zoomed via an explicitly sized WRAPPER block, so the container's
  // content is a plain oversized div and overflow:auto scrolls on both axes.
  if (cont) {
    cont.style.minHeight = '0';
    cont.style.minWidth = '0';
    cont.style.overflow = 'auto';
    cont.style.flex = '';
    cont.style.flexGrow = '1';
    cont.style.flexShrink = '1';
    cont.style.flexBasis = '0';
    cont.style.height = '';
  }
  const setW = (w, h) => {
    if (wrap) {
      wrap.style.width = w;
      wrap.style.height = h;
    }
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
  };
  if (_mapZoom <= 1) {
    setW('100%', '100%');
    return;
  }
  const pad = 12; // container padding (6px each side)
  const cw = Math.max(50, ((cont && cont.clientWidth) || 320) - pad);
  const ch = Math.max(50, ((cont && cont.clientHeight) || 320) - pad);
  setW(cw * _mapZoom + 'px', ch * _mapZoom + 'px');
}
export function mapZoom(delta) {
  _mapZoom = delta === 0 ? 1 : Math.max(1, Math.min(4, _mapZoom + delta));
  applyMapZoom();
}
window.addEventListener('resize', () => {
  if (window.innerWidth < 821) teardownDeskLayout();
  else setupDeskLayout();
  applyMapZoom();
});
export function ensureMobileDefault() {
  const lay = document.getElementById('rp-layout');
  if (lay && !/\bmv-(map|report|messages|orders)\b/.test(lay.className)) setMobileView('report');
}
