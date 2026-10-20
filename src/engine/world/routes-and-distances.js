// ── ROUTES AND DISTANCES (plan P1-08i1: lifted out of resolveTurn) ────
// How many provinces apart two provinces are (provDistance, kept for the turn in the context's _distCache), and the first
// step of a passable route toward a province (stepToward, stepTowardPath; stepTowardPreferSafe takes a route over safe
// ground when it is no longer, provSafePassageFor). They take the turn's context first (src/engine/turn/context.js).
// Breadth-first province distance (hex grid, wraps E/W like the rest of the map code).
function provDistance(turnContext, fromId, toId) {
  const { _distCache, G } = turnContext;
  if (fromId == null || toId == null) return Infinity;
  if (fromId === toId) return 0;
  const key = fromId + ':' + toId;
  if (_distCache.has(key)) return _distCache.get(key);
  const seen = new Set([fromId]);
  let frontier = [G.world.provinces[fromId]],
    d = 0;
  while (frontier.length && d < 40) {
    d++;
    const next = [];
    for (const p of frontier) {
      if (!p) continue;
      for (const nb of getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces)) {
        if (!nb || seen.has(nb.id)) continue;
        seen.add(nb.id);
        if (nb.id === toId) {
          _distCache.set(key, d);
          return d;
        }
        next.push(nb);
      }
    }
    frontier = next;
  }
  _distCache.set(key, Infinity);
  return Infinity;
}

// First step of a legal path from the character's current province toward a destination. Respects
// the terrain the character's armies can actually cross. Returns null if no route. A province a
// player's column can pass THROUGH without starting a fight or being turned back: their own land,
// an ally's, or unowned ground with no live armed neutral guard.
function provSafePassageFor(turnContext, p, pi) {
  const { G } = turnContext;
  if (!p) return false;
  if (p.owner === pi) return true;
  if (p.owner != null) return relationBetween(turnContext, pi, p.owner) === 'allied';
  return !(G.characters || []).some(
    (g) => g && g.alive && g.player === null && g._isNeutralGuard && g.location === p.id && (g.armies || []).length > 0,
  );
}
// prov:-move detour: prefer a route whose INTERMEDIATE provinces are all safe passage (the final
// target itself may be hostile — that is the player's chosen destination). Falls back to the
// plain shortest route when no safe one exists, so the column still makes progress. 2026-09-17:
// THE SHORTEST ROUTE ALWAYS WINS. Now the unrestricted BFS sets the distance, and the safe route
// is only preferred when it is NO LONGER than it — an equal-length detour onto friendly ground,
// never a longer one. If the only short road runs through a rival's province, the column takes
// it.
function stepTowardPreferSafe(turnContext, c, toId) {
  const any = stepTowardPath(turnContext, c, toId);
  if (!any) return null;
  if (c && c.player != null) {
    const safe = stepTowardPath(
      turnContext,
      c,
      toId,
      (p) => p.id === toId || provSafePassageFor(turnContext, p, c.player),
    );
    if (safe && safe.depth <= any.depth) return safe.first;
  }
  return any.first;
}
function stepToward(turnContext, c, toId, extraFilter) {
  const r = stepTowardPath(turnContext, c, toId, extraFilter);
  return r ? r.first : null;
}
// BFS from the character's province toward `toId`. Returns {first, depth} — the first step of a
// shortest passable path and how many steps that path takes — or null if no route exists.
function stepTowardPath(turnContext, c, toId, extraFilter) {
  const { G, seaCap } = turnContext;
  const from = G.world.provinces[c.location];
  if (!from || toId == null || c.location === toId) return null;
  const sc = seaCap[c.id] || 'land';
  const passable = (p) => !!p && canEnterTerrain(c, p.terrain, sc) && (!extraFilter || extraFilter(p));
  // 2026-09-26 (Toby item 2): a column that leads ANY naval unit (fleet or sea-beast) cannot
  // march land→land — the move handler refuses it ("cannot march overland while leading naval
  // units"). The BFS used to ignore that, so a displaced admiral in a coastal province picked the
  // adjacent coastal LAND province as his first step, was refused, and held all phase. Every
  // land→land edge is now closed to such a column: from land it must put out to an adjacent sea
  // province first, and it may land again only from the sea.
  const _naval = (c.armies || []).some((a) => a && SEA_TYPES.has(a.type));
  const edgeOk = (a, b) => !_naval || a.terrain === 'sea' || b.terrain === 'sea';
  const seen = new Set([from.id]);
  // BFS storing the first step taken on each path
  let frontier = getNeighborsP(from, G.world.cols, G.world.rows, G.world.provinces)
    .filter((p) => passable(p) && edgeOk(from, p))
    .map((p) => ({ p, first: p }));
  frontier.forEach((e) => seen.add(e.p.id));
  let depth = 0;
  while (frontier.length && depth < 40) {
    for (const e of frontier) {
      if (e.p.id === toId) return { first: e.first, depth: depth };
    }
    const next = [];
    for (const e of frontier) {
      for (const nb of getNeighborsP(e.p, G.world.cols, G.world.rows, G.world.provinces)) {
        if (!nb || seen.has(nb.id) || !passable(nb) || !edgeOk(e.p, nb)) continue;
        seen.add(nb.id);
        next.push({ p: nb, first: e.first });
      }
    }
    frontier = next;
    depth++;
  }
  return null;
}
