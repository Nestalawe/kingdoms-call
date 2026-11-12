import {
  _closeMapTip,
  _PROV_LINK_SKIP,
  _buildProvNameIndex,
  _provNameMap,
  _provNameRe,
  applyMapZoom,
  highlightMapProv,
} from './map.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { onMessagesShown, refreshMsgBadgeSoon, applyDeskViews, setDeskView } from './dispatches.ts';

// ── MOBILE VIEW SWITCHER ────
// On narrow screens (see the @media block) the Map / Report / Orders columns are shown one at a
// time, chosen by the fixed bottom tab bar. This toggles a single class on #rp-layout; on desktop
// the class is inert (all three columns show regardless). No effect on the engine or on saved data.
export function setMobileView(view: string) {
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
  } catch {
    // a lingering province popup must not survive a view switch
  }
  document
    .querySelectorAll('#mobile-tabbar button')
    .forEach((b) => b.classList.toggle('active', b.getAttribute('data-mv') === view));
  if (view === 'map') {
    try {
      applyMapZoom();
    } catch {
      // the map may not be drawn yet
    }
  } // map fix: re-fit the SVG height now the column is visible
  if (view === 'messages') {
    try {
      onMessagesShown();
    } catch {
      // the dispatches' state may not be declared yet
    }
  } else refreshMsgBadgeSoon();
  try {
    window.scrollTo(0, 0);
  } catch {
    // start each view at its head
  }
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
    theElementWithTheId('desk-left-body', HTMLElement).appendChild(map);
    if (msg) theElementWithTheId('desk-left-body', HTMLElement).appendChild(msg);
    theElementWithTheId('desk-right-body', HTMLElement).appendChild(ord);
    theElementWithTheId('desk-right-body', HTMLElement).appendChild(rep); // the report lives on the right, permanently
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
export let _deskFitObs: ResizeObserver | null = null;
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
  const h = `${String(Math.max(360, Math.floor(window.innerHeight - top - 8)))}px`;
  if (l.style.height !== h) l.style.height = h;
  if (r.style.height !== h) r.style.height = h;
  if (!_deskFitObs && typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      fitDeskPanels();
    });
    _deskFitObs = observer;
    document.querySelectorAll('#sec-report > .detail-header, #new-turn-banner').forEach((el) => {
      observer.observe(el);
    });
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
} // must match #report-map-zoomwrap width in the ≤820px media block
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
window.addEventListener('resize', () => {
  if (window.innerWidth < 821) teardownDeskLayout();
  else setupDeskLayout();
  applyMapZoom();
});
export function ensureMobileDefault() {
  const lay = document.getElementById('rp-layout');
  if (lay && !/\bmv-(map|report|messages|orders)\b/.test(lay.className)) setMobileView('report');
}
export function _makeProvLinkEl(id: unknown, name: string) {
  const sp = document.createElement('span');
  sp.className = 'prov-link prov-auto';
  sp.setAttribute('data-prov-link', String(id));
  sp.title = `Hover to light up ${name} on the map — click or tap to show it`;
  sp.textContent = name;
  sp.onmouseenter = () => {
    highlightMapProv(id, true);
  };
  sp.onmouseleave = () => {
    highlightMapProv(id, false);
  };
  sp.onclick = (ev) => {
    ev.stopPropagation();
    locateOnMap(id);
  };
  return sp;
}
export let _provLinking = false;
export function linkProvinceNames(root: Node | null | undefined) {
  if (!root || _provLinking) return;
  _buildProvNameIndex(viewingReport ?? currentReport);
  // the index sets the expression and the map together, and nothing here builds it again
  const provNameRe = _provNameRe,
    provNameMap = _provNameMap;
  if (!provNameRe) return;
  _provLinking = true;
  try {
    const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.length < 3) return window.NodeFilter.FILTER_REJECT;
        for (let el = n.parentNode; el && el !== root; el = el.parentNode) {
          // a node with no namespace, classes or editing (a fragment, the document) reads each as missing
          if (
            _PROV_LINK_SKIP.has(el.nodeName) ||
            (el instanceof Element && el.namespaceURI === 'http://www.w3.org/2000/svg')
          )
            return window.NodeFilter.FILTER_REJECT;
          if (el instanceof Element && (el.classList.contains('prov-link') || el.classList.contains('no-prov-link')))
            return window.NodeFilter.FILTER_REJECT;
          if (el instanceof HTMLElement && el.isContentEditable) return window.NodeFilter.FILTER_REJECT;
        }
        provNameRe.lastIndex = 0;
        return provNameRe.test(n.nodeValue) ? window.NodeFilter.FILTER_ACCEPT : window.NodeFilter.FILTER_REJECT;
      },
    });
    const hits: Node[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) hits.push(n);
    hits.forEach((t) => {
      const txt = theWordsOfTheTextAccepted(t);
      const frag = document.createDocumentFragment();
      let last = 0,
        m: RegExpExecArray | null;
      provNameRe.lastIndex = 0;
      while ((m = provNameRe.exec(txt))) {
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        const name = theProvinceNameMatched(m);
        if (provNameMap === null) throw new TypeError("Cannot read properties of null (reading 'get')");
        frag.appendChild(_makeProvLinkEl(provNameMap.get(name), name));
        last = m.index + name.length;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      theParentOfTheTextAccepted(t).replaceChild(frag, t);
    });
  } catch {
    /* a failed pass must never break the report */
  } finally {
    _provLinking = false;
  }
}
// A text node the walk accepted holds words (three letters or more), and sits in the column.
function theWordsOfTheTextAccepted(t: Node): string {
  const words = t.nodeValue;
  if (words === null) throw new TypeError("Cannot read properties of null (reading 'slice')");
  return words;
}
function theParentOfTheTextAccepted(t: Node): ParentNode {
  const parent = t.parentNode;
  if (parent === null) throw new TypeError("Cannot read properties of null (reading 'replaceChild')");
  return parent;
}
// The province expression's one group, the name, is in every match.
function theProvinceNameMatched(m: RegExpExecArray): string {
  const name = m[1];
  if (name === undefined) throw new TypeError("Cannot read properties of undefined (reading 'length')");
  return name;
}
export let _provLinkObs: MutationObserver | null = null,
  _provLinkTimer: ReturnType<typeof setTimeout> | null = null;
export function ensureProvinceLinking() {
  const col = document.getElementById('rp-report-col');
  if (!col) return;
  linkProvinceNames(col);
  if (_provLinkObs || typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => {
    if (_provLinking) return;
    clearTimeout(_provLinkTimer ?? undefined);
    _provLinkTimer = setTimeout(() => {
      linkProvinceNames(document.getElementById('rp-report-col'));
    }, 60);
  });
  _provLinkObs = observer;
  observer.observe(col, { childList: true, subtree: true });
}
export let _provHlTimer: ReturnType<typeof setTimeout> | null = null;
export function locateOnMap(id: unknown) {
  try {
    if (window.innerWidth < 821) setMobileView('map');
    else if (typeof _deskLeftView !== 'undefined' && _deskLeftView !== 'map') setDeskView('left', 'map');
  } catch {
    // the desk's state may not be declared yet
  }
  setTimeout(() => {
    highlightMapProv(id, true);
    const g = document.querySelector(`#report-map-svg g[data-prov="${String(id)}"]`);
    // scroll only the map's own container (a zoomed map), never the page or the report column
    try {
      const box = document.getElementById('report-map-container');
      if (g && box) {
        const r = g.getBoundingClientRect(),
          b = box.getBoundingClientRect();
        box.scrollLeft += r.left + r.width / 2 - (b.left + b.width / 2);
        box.scrollTop += r.top + r.height / 2 - (b.top + b.height / 2);
      }
    } catch {
      // the map may not be drawn yet
    }
    clearTimeout(_provHlTimer ?? undefined);
    _provHlTimer = setTimeout(() => {
      highlightMapProv(id, false);
    }, 4000);
  }, 60);
}
