// ── NEUTRAL HERO PROGRESSION (2026-09-17 (late), Toby item 1) ── see the end-of-turn call in
// runTurn.
// Pure function of the game state plus an optional rng/emit, so the harness can fuzz it directly.
// Returns the list of {id, skill, from, to, teacher} gains applied this call.
// ── SERVICE HISTORY (2026-09-23, Toby item 2) ── Every realm a hero has ever served, kept on the
// character (c._servedRealms) and copied onto their grave. Resurrect refuses a body that ever
// served ANOTHER realm, so a rival's fallen hero — or one they released or who deserted them —
// cannot be raised into your service. Old saves carry no history: the grave's own `player` and a
// release stamp (_releasedBy) still count.
// ── PRE-ORDER HERO IDS AS RECIPIENTS (2026-09-23, Toby item 3) ── A hero on a hire / resurrect /
// charm pre-order card has the synthetic id '<kind>_<heroId>_via_<caster>_ph<N>' in the player
// portal, and may now be named as a recipient (Send Item, Transfer Army, Muster to, a friendly
// spell). isPreOrderRef tells the synthetic form apart; orderCharRef resolves either form to the
// real character record (by id, never by array index) — or null. Every caller still checks the
// hero is the orderer's own, so a hire that failed (or a rival's) is refused, never honoured.
function isPreOrderRef(raw) {
  return /^(?:hired|resurrect|charm)_\d+_via_/.test(String(raw == null ? '' : raw).trim());
}
// ── A HERO UNDER A CHARM THIS TURN ───────────────────────────────────────────────────────────────
// Either kind: an ENEMY whose command was seized for the season (`_charmTempControl`, reverts at the
// Early Winter turn-end), or a WANDERER swayed into permanent service this very turn (`_charmedTurn`,
// which stops mattering once the turn rolls over and they are an ordinary hero of the realm).
// 2026-09-24 (Toby): an enchanter borrows a mind, not a quartermaster. Such a hero handles NO items —
// they may not be given one, may not use one, and may not send one to anybody. Their own gear is
// untouched: they keep it, fight with it, and its passive magic still works. This predicate is the
// single gate; the player portal hides the three orders, and these engine checks catch a stale or
// hand-crafted submission that walks past the form.
function isCharmedNow(G, c) {
  return !!(c && (c._charmTempControl || c._charmedTurn === (G && G.turn)));
}
function orderCharRef(G, raw) {
  const t = String(raw == null ? '' : raw).trim();
  const m = t.match(/^(?:hired|resurrect|charm)_(\d+)_via_/);
  const id = m ? parseInt(m[1]) : parseInt(t);
  if (!Number.isInteger(id)) return null;
  return ((G && G.characters) || []).find((ch) => ch && ch.id === id) || null;
}
function noteServedRealm(c, pi) {
  if (!c || pi == null) return;
  if (!Array.isArray(c._servedRealms)) c._servedRealms = [];
  if (!c._servedRealms.includes(pi)) c._servedRealms.push(pi);
}
function graveServedOther(g, pi) {
  if (!g) return false;
  if (g.player != null && g.player !== pi) return true;
  if (g._releasedBy != null && g._releasedBy !== pi) return true;
  return Array.isArray(g.served) && g.served.some((x) => x != null && x !== pi);
}
const NEUTRAL_PROG_FROM_TURN = 5; // first END OF TURN at which neutral heroes roll
const NEUTRAL_PROG_PCT = 25; // chance per neutral hero per turn of gaining one point (2026-09-23: was 50)
const NEUTRAL_PROG_CAP = 5; // a neutral hero's own growth never lifts a skill past this (higher skills they already hold are kept)
const NEUTRAL_PROG_TOP_PCT = 75; // 2026-09-26 (Toby): when the idle roll lands, 75% it deepens their BEST skill, 25% a random other
// Hex neighbours of a province, as ids. progressNeutralHeroes is module scope and cannot reach
// runTurn's neighborInDir, so the offsets live here too — same even/odd row convention as the rest
// of the map code.
function _neutralAdjIds(gs, p) {
  const w = gs && gs.world;
  if (!w || !p) return [];
  const even = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const odd = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const out = [];
  (p.row % 2 === 0 ? even : odd).forEach(([dr, dc]) => {
    const nr = p.row + dr;
    if (nr < 0 || nr >= w.rows) return;
    const nc = (((p.col + dc) % w.cols) + w.cols) % w.cols;
    out.push(nr * w.cols + nc);
  });
  return out;
}
// ── NEUTRAL HERO PROGRESSION ──────────────────────────────────────────────────────────────
// 2026-09-26 (Toby), three changes:
// • A neutral who already earned a skill this turn THROUGH BATTLE (trySkillGain now runs for
//   neutrals inside a battle series, stamping `_neutralXpTurn`) does not also take the idle roll.
//   Fighting replaces sitting still; it never stacks on top of it.
// • Peer teaching now reaches ADJACENT provinces as well as the hero's own, and takes PRECEDENCE:
//   a teacher is looked for first, and only a hero with no reachable peer falls back to self-study.
//   Same-province peers are still preferred over neighbours — a hero standing beside you teaches
//   you before one a province away.
// • Self-study is no longer a flat random pick among their skills: 75% it deepens whichever skill
//   they are already best at (a random one of them if several tie), 25% it goes to a different
//   skill of theirs chosen at random. Falls back to the other branch when one has nothing legal.
function progressNeutralHeroes(gs, emit, rng) {
  rng = rng || kcRng;
  const turn = (gs && gs.turn) || 0;
  if (turn < NEUTRAL_PROG_FROM_TURN) return [];
  const chars = (gs && gs.characters) || [];
  const neutrals = chars.filter((c) => c && c.alive && c.player === null && !c.isKing);
  // Snapshot every neutral's skills BEFORE anyone gains, so two heroes in one province read each
  // other's start-of-sweep levels — order of iteration must not change who learns what.
  const snap = new Map(neutrals.map((c) => [c.id, { ...(c.skills || {}) }]));
  const topSkillsOf = (sk) => {
    let best = 0;
    ALL_SKILLS.forEach((k) => {
      best = Math.max(best, sk[k] || 0);
    });
    return best > 0 ? ALL_SKILLS.filter((k) => (sk[k] || 0) === best) : [];
  };
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  // neutrals indexed by the province they stand in, so the adjacency sweep is a lookup not a scan
  const byProv = new Map();
  neutrals.forEach((o) => {
    const k = o.location;
    if (!byProv.has(k)) byProv.set(k, []);
    byProv.get(k).push(o);
  });
  const provs = (gs.world && gs.world.provinces) || [];
  const gains = [];
  neutrals.forEach((c) => {
    // battle experience this turn stands in place of the idle roll
    if (c._neutralXpTurn === turn) return;
    if (rng() * 100 >= NEUTRAL_PROG_PCT) return;
    c.skills = c.skills || {};
    const _cap = Math.min(SKILL_MAX, NEUTRAL_PROG_CAP);
    const own = ALL_SKILLS.filter((k) => (c.skills[k] || 0) > 0 && (c.skills[k] || 0) < _cap);
    let skill = null,
      teacher = null,
      nearby = false;
    // 1. TEACHING FIRST — own province, then adjacent ones.
    const here = (byProv.get(c.location) || []).filter((o) => o !== c);
    let ring = [];
    _neutralAdjIds(gs, provs[c.location]).forEach((nid) => {
      (byProv.get(nid) || []).forEach((o) => {
        if (o !== c) ring.push(o);
      });
    });
    for (const group of [here, ring]) {
      if (skill || !group.length) continue;
      // only peers who actually have something legal to teach are worth approaching
      const able = group.filter((t) => topSkillsOf(snap.get(t.id) || {}).some((k) => (c.skills[k] || 0) < _cap));
      if (!able.length) continue;
      const t = pick(able);
      const cand = topSkillsOf(snap.get(t.id) || {}).filter((k) => (c.skills[k] || 0) < _cap);
      if (cand.length) {
        skill = pick(cand);
        teacher = t;
        nearby = group === ring;
      }
    }
    // 2. SELF-STUDY — 75% their best skill, 25% one of the others.
    if (!skill && own.length) {
      const best = topSkillsOf(c.skills).filter((k) => (c.skills[k] || 0) < _cap);
      const rest = own.filter((k) => best.indexOf(k) < 0);
      const wantTop = rng() * 100 < NEUTRAL_PROG_TOP_PCT;
      if (wantTop) skill = best.length ? pick(best) : rest.length ? pick(rest) : null;
      else skill = rest.length ? pick(rest) : best.length ? pick(best) : null;
    }
    if (!skill) return;
    const from = c.skills[skill] || 0,
      to = from + 1;
    c.skills[skill] = to;
    gains.push({ id: c.id, skill, from, to, teacher: teacher ? teacher.id : null, nearby });
    if (emit) {
      const pv = gs.world && gs.world.provinces ? gs.world.provinces[c.location] : null;
      const nm = String(c.name || '').replace(/\s*\(wandering\)/i, '');
      const lbl = (typeof SKILL_LABELS !== 'undefined' && SKILL_LABELS[skill]) || skill;
      const tn = teacher ? String(teacher.name || '').replace(/\s*\(wandering\)/i, '') : '';
      const tpv = teacher && provs[teacher.location] ? provs[teacher.location] : null;
      emit(
        teacher
          ? nearby
            ? `📜 ${nm}${pv ? ` in ${pv.name}` : ''} rides out to ${tn}${tpv ? ` in ${tpv.name}` : ''} to learn — ${lbl} rises to ${to}.`
            : `📜 ${nm}${pv ? ` in ${pv.name}` : ''} learns from ${tn} — ${lbl} rises to ${to}.`
          : `📜 ${nm}${pv ? ` in ${pv.name}` : ''} hones their craft — ${lbl} rises to ${to}.`,
        pv,
      );
    }
  });
  return gains;
}
