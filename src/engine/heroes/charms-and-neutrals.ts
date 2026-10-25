import { kcRng } from '../rng.ts';
import { SKILL_LABELS, SKILL_MAX } from '../army-tables.ts';
import { ALL_SKILLS } from '../rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
import type { Character, Province } from '../../schemas/saved-game-state.ts';

// What an order names a hero by: his id, or a pre-order card's synthetic id (below), as the order carries it.
type AHeroAsAnOrderNamesHim = string | number | null | undefined;

// ── NEUTRAL HERO PROGRESSION (2026-09-17 (late), Toby item 1) ── see the end-of-turn call in
// runTurn.
// Pure function of the game state plus an optional rng and line-teller, so the harness can fuzz it directly.
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
export function isPreOrderRef(raw: AHeroAsAnOrderNamesHim) {
  return /^(?:hired|resurrect|charm)_\d+_via_/.test(String(raw ?? '').trim());
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
export function isCharmedNow(
  G: Pick<GameStateAsTheseRead, 'turn'> | null | undefined,
  c: Pick<Character, '_charmTempControl' | '_charmedTurn'> | null | undefined,
) {
  return !!(c && (Boolean(c._charmTempControl) || c._charmedTurn === (G ? G.turn : G)));
}
export function orderCharRef<Hero extends { readonly id: number }>(
  G: { readonly characters?: readonly (Hero | null | undefined)[] | null | undefined } | null | undefined,
  raw: AHeroAsAnOrderNamesHim,
) {
  const t = String(raw ?? '').trim();
  const m = /^(?:hired|resurrect|charm)_(\d+)_via_/.exec(t);
  const id = m ? parseInt(m[1] ?? '') : parseInt(t); // a match always holds its digits
  if (!Number.isInteger(id)) return null;
  return (G?.characters ?? []).find((ch) => ch?.id === id) ?? null;
}
export function noteServedRealm(c: Pick<Character, '_servedRealms'> | null | undefined, pi: number | null | undefined) {
  if (!c || pi == null) return;
  if (!Array.isArray(c._servedRealms)) c._servedRealms = [];
  if (!c._servedRealms.includes(pi)) c._servedRealms.push(pi);
}
// a fallen hero's grave as these read it: today's, or an older save's (no service history, a release stamp)
interface AGraveAsTheseRead {
  readonly player?: number | null | undefined;
  readonly _releasedBy?: number | null | undefined;
  readonly served?: readonly (number | null | undefined)[] | null | undefined;
}
export function graveServedOther(g: AGraveAsTheseRead | null | undefined, pi: number | null | undefined) {
  if (!g) return false;
  if (g.player != null && g.player !== pi) return true;
  if (g._releasedBy != null && g._releasedBy !== pi) return true;
  return Array.isArray(g.served) && g.served.some((x) => x != null && x !== pi);
}
export const NEUTRAL_PROG_FROM_TURN = 5; // first END OF TURN at which neutral heroes roll
export const NEUTRAL_PROG_PCT = 25; // chance per neutral hero per turn of gaining one point (2026-09-23: was 50)
export const NEUTRAL_PROG_CAP = 5; // a neutral hero's own growth never lifts a skill past this (higher skills they already hold are kept)
export const NEUTRAL_PROG_TOP_PCT = 75; // 2026-09-26 (Toby): when the idle roll lands, 75% it deepens their BEST skill, 25% a random other
// Hex neighbours of a province, as ids. progressNeutralHeroes is module scope and cannot reach
// runTurn's neighborInDir, so the offsets live here too — same even/odd row convention as the rest
// of the map code.
export function _neutralAdjIds(
  gs: Pick<GameStateAsTheseRead, 'world'> | null | undefined,
  p: Pick<Province, 'row' | 'col'> | null | undefined,
) {
  const w = gs?.world;
  if (!w || !p) return [];
  const even: readonly (readonly [number, number])[] = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const odd: readonly (readonly [number, number])[] = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const out: number[] = [];
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
// The game's state as these read it: the turn's, or one a test stages, so a list or a field may be missing (the
// guards below say so). Today's GameState passes.
interface AProvinceAsTheseRead {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly name: string;
}
interface AHeroAsTheseRead {
  readonly id: number;
  readonly name?: string | undefined;
  readonly alive?: boolean | undefined;
  readonly player?: number | null | undefined;
  readonly isKing?: boolean | undefined;
  readonly location: number;
  readonly _neutralXpTurn?: number | undefined;
  skills?: Record<string, number | undefined> | null | undefined;
}
interface GameStateAsTheseRead {
  readonly turn?: number | undefined;
  readonly characters?: readonly (AHeroAsTheseRead | null | undefined)[] | null | undefined;
  readonly world?:
    | {
        readonly rows: number;
        readonly cols: number;
        readonly provinces?: readonly (AProvinceAsTheseRead | null | undefined)[] | null | undefined;
      }
    | null
    | undefined;
}
// One point a neutral hero gained, and from whom.
interface ANeutralHerosGain {
  id: number;
  skill: string;
  from: number;
  to: number;
  teacher: number | null;
  nearby: boolean;
}
export function progressNeutralHeroes(
  gs: GameStateAsTheseRead | null | undefined,
  tellANeutralHerosLesson?: ((line: string, where: AProvinceAsTheseRead | null | undefined) => void) | null,
  rng?: (() => number) | null,
): ANeutralHerosGain[] {
  const theDice = rng ?? kcRng;
  const turn = Number(gs?.turn) || 0;
  if (turn < NEUTRAL_PROG_FROM_TURN) return [];
  const chars = gs?.characters ?? [];
  const neutrals = chars.filter((c): c is AHeroAsTheseRead => !!(c && c.alive && c.player === null && !c.isKing));
  // Snapshot every neutral's skills BEFORE anyone gains, so two heroes in one province read each
  // other's start-of-sweep levels — order of iteration must not change who learns what.
  const snap = new Map(neutrals.map((c) => [c.id, { ...(c.skills ?? {}) }]));
  const topSkillsOf = (sk: Readonly<Record<string, number | undefined>>) => {
    let best = 0;
    ALL_SKILLS.forEach((k) => {
      best = Math.max(best, Number(sk[k]) || 0);
    });
    return best > 0 ? ALL_SKILLS.filter((k) => (Number(sk[k]) || 0) === best) : [];
  };
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(theDice() * arr.length)];
  // neutrals indexed by the province they stand in, so the adjacency sweep is a lookup not a scan
  const byProv = new Map<number, AHeroAsTheseRead[]>();
  neutrals.forEach((o) => {
    const k = o.location;
    const here = byProv.get(k);
    if (here) here.push(o);
    else byProv.set(k, [o]);
  });
  const provs = gs?.world?.provinces ?? [];
  const gains: ANeutralHerosGain[] = [];
  neutrals.forEach((c) => {
    // battle experience this turn stands in place of the idle roll
    if (c._neutralXpTurn === turn) return;
    if (theDice() * 100 >= NEUTRAL_PROG_PCT) return;
    const skills = (c.skills ??= {}); // the same object as c.skills, which the closures below read
    const _cap = Math.min(SKILL_MAX, NEUTRAL_PROG_CAP);
    const own = ALL_SKILLS.filter((k) => (Number(skills[k]) || 0) > 0 && (Number(skills[k]) || 0) < _cap);
    let skill: string | null | undefined = null,
      teacher: AHeroAsTheseRead | null = null,
      nearby = false;
    // 1. TEACHING FIRST — own province, then adjacent ones.
    const here = (byProv.get(c.location) ?? []).filter((o) => o !== c);
    let ring: AHeroAsTheseRead[] = [];
    _neutralAdjIds(gs, provs[c.location]).forEach((nid) => {
      (byProv.get(nid) ?? []).forEach((o) => {
        if (o !== c) ring.push(o);
      });
    });
    for (const group of [here, ring]) {
      if (skill || !group.length) continue;
      // only peers who actually have something legal to teach are worth approaching
      const able = group.filter((t) => topSkillsOf(snap.get(t.id) ?? {}).some((k) => (Number(skills[k]) || 0) < _cap));
      if (!able.length) continue;
      const t = pick(able);
      if (!t) continue; // never met: able isn't empty
      const cand = topSkillsOf(snap.get(t.id) ?? {}).filter((k) => (Number(skills[k]) || 0) < _cap);
      if (cand.length) {
        skill = pick(cand);
        teacher = t;
        nearby = group === ring;
      }
    }
    // 2. SELF-STUDY — 75% their best skill, 25% one of the others.
    if (!skill && own.length) {
      const best = topSkillsOf(skills).filter((k) => (Number(skills[k]) || 0) < _cap);
      const rest = own.filter((k) => !best.includes(k));
      const wantTop = theDice() * 100 < NEUTRAL_PROG_TOP_PCT;
      if (wantTop) skill = best.length ? pick(best) : rest.length ? pick(rest) : null;
      else skill = rest.length ? pick(rest) : best.length ? pick(best) : null;
    }
    if (!skill) return;
    const from = Number(skills[skill]) || 0,
      to = from + 1;
    skills[skill] = to;
    gains.push({ id: c.id, skill, from, to, teacher: teacher ? teacher.id : null, nearby });
    if (tellANeutralHerosLesson) {
      const pv = gs?.world?.provinces ? gs.world.provinces[c.location] : null;
      const nm = (c.name ?? '').replace(/\s*\(wandering\)/i, '');
      const labelOfASkill: Readonly<Record<string, string | undefined>> = SKILL_LABELS; // read by any skill's name
      const lbl = labelOfASkill[skill] ?? skill;
      const tn = teacher ? (teacher.name ?? '').replace(/\s*\(wandering\)/i, '') : '';
      const tpv = teacher ? (provs[teacher.location] ?? null) : null;
      tellANeutralHerosLesson(
        teacher
          ? nearby
            ? `📜 ${nm}${pv ? ` in ${pv.name}` : ''} rides out to ${tn}${tpv ? ` in ${tpv.name}` : ''} to learn — ${lbl} rises to ${String(to)}.`
            : `📜 ${nm}${pv ? ` in ${pv.name}` : ''} learns from ${tn} — ${lbl} rises to ${String(to)}.`
          : `📜 ${nm}${pv ? ` in ${pv.name}` : ''} hones their craft — ${lbl} rises to ${String(to)}.`,
        pv,
      );
    }
  });
  return gains;
}
