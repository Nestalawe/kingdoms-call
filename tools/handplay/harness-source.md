# The hand-play harness: source

This is the source of the harness the alignment test games were played with. It is kept here as text, not as a code
file, because it is loose research code: it reads the saved game as untyped JSON, so it would not pass the repo's strict
lint and type checks, and the repo's rules allow no new untyped code.

To use it, save the code block below as `tools/handplay/handplay.ts` in your working copy and run it with `npx tsx`
(see README.md). Do not commit that file. If the harness becomes a permanent tool, type it properly first: parse the
saved state with its Zod schema and give the report fields it reads a small schema of their own.

```ts
// Hand-play harness (research tool for the alignment test games; see tools/handplay/README.md): a game with every kit on, every realm held by a player who reads
// the realm's report and writes its orders. Run from the repo root: npx tsx tools/handplay/handplay.ts <command> ...
//   new <game.json> --seed N --alignments A,B,C [--races R,R,R] [--sea 20] [--diplomacy normal|hostile]
//   view <game.json> <realm>            the realm's last report and its situation, as text
//   orders <game.json> <realm> <orders.json>   {"<charId>": [5 x {action,target,extra,desc}], ...} plus optional
//                                       "diplomacy": {"<realm>": "enemy"|"treat"}
//   run <game.json>                     plays the turn with the orders given (heroes without orders Rest)
import fs from 'node:fs';
import path from 'node:path';
import { newWorldOf, PAGE_DRAWS_AS_IT_LOADS, stampedAsTheShellSaves } from '../../tests/lib/matrix-game.ts';
import { scenarioInTheVm } from '../../tests/lib/scenario-in-the-vm.ts';
import type { GameSpec } from '../balance/matrix.ts';

const [cmd, file, ...rest] = process.argv.slice(2);
const arg = (name: string, d = ''): string => {
  const i = rest.indexOf('--' + name);
  return i >= 0 ? (rest[i + 1] ?? d) : d;
};
type Any = any;
interface Game { spec: GameSpec; state: string; turn: number; reports: Record<string, Any>; orders: Record<string, Any>; logs: string[]; summaries: string[] }
const load = (): Game => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (g: Game) => fs.writeFileSync(file, JSON.stringify(g));
const scenario = (seed: number) => {
  const sc = scenarioInTheVm({ seed });
  sc.reportEveryRealm();
  return sc;
};

if (cmd === 'new') {
  const aligns = arg('alignments').split(',').filter(Boolean);
  const races = (arg('races') || 'Human,Elven,Dwarven,Orcish,Human,Elven').split(',');
  const spec: GameSpec = {
    id: path.basename(file, '.json'), group: 'bots', seed: Number(arg('seed', '77')), realms: aligns.length,
    seaPct: Number(arg('sea', '20')), diplomacy: (arg('diplomacy', 'normal') as 'normal' | 'hostile'), races, alignments: aligns,
  };
  process.env['KC_ALIGN_PROTO'] = 'Divine,Good,Druidic,Neutral,Pagan,Evil,Undead';
  process.env['KC_ALIGN_TACTICS'] = '1';
  process.env['KC_BOT_LAIRS'] = '1';
  const sc = scenario(spec.seed);
  for (let i = 0; i < PAGE_DRAWS_AS_IT_LOADS; i++) sc.W.eval('kcRng()');
  const state = newWorldOf(sc.engine, spec);
  save({ spec, state, turn: 1, reports: {}, orders: {}, logs: [], summaries: [] });
  console.log('made', file, 'realms', aligns.join(','));
} else if (cmd === 'view') {
  const g = load();
  const pi = Number(rest[0]);
  const S = JSON.parse(g.state);
  const pl = S.players[pi];
  const provs: Any[] = S.world.provinces;
  const cols = S.world.cols;
  const out: string[] = [];
  out.push(`== Turn ${g.turn} · ${pl.name} (${pl.alignment}, ${pl.race}) · gold ${pl.gold}g · ${pl.provinces.length} provinces`);
  if (pl.alignment === 'Divine') {
    const held = pl.provinces.map((id: number) => S.world.provinces[id]).filter((p: Any) => p && (p.features || []).some((f: Any) => f && f.ritualSite && f.siteKind === 'holy'));
    const cons = pl.consecratedProvIds || [];
    const shining = held.filter((p: Any) => cons.includes(p.id)).length;
    const crus = (pl._crusadeUntil ?? -1) >= S.turn ? 1 : 0;
    const power = Math.min(6, held.length + (shining > 0 ? 1 : 0) + crus + Math.floor(cons.length / 3));
    out.push(`Divine Power ${power} (holy sites held ${held.length}, shining ${shining}, crusade ${crus}, consecrated ${cons.length} -> +${Math.floor(cons.length / 3)}); gifts: ${['Sanctuary','Grace abounding','Revelation','Pilgrim roads','Absolution','Church Triumphant'].slice(0, Math.min(6, power)).join(', ') || 'none'}`);
  }
  const rel = (j: number) => S.relations[pi < j ? `${pi}-${j}` : `${j}-${pi}`] || 'neutral';
  out.push('Realms: ' + S.players.map((p: Any, j: number) => `${j}:${p.name} (${p.alignment}${j === pi ? ', you' : ', ' + rel(j) + (pl._encountered?.includes(j) ? '' : ', not met')})`).join(' | '));
  const ownerName = (o: number | null) => (o == null ? 'unclaimed' : S.players[o].name);
  const feats = (p: Any) => (p.features || []).filter((f: Any) => f && (f.discoveredBy?.includes(pi) || f.discovered || p.owner === pi)).map((f: Any) => f.ritualSite ? (f.siteKind === 'holy' ? 'HOLY SITE' : f.siteKind === 'barrow' ? 'BARROW' : 'RITUAL STONES' + (p._riteActivatedBy === pi ? ' (woken)' : '')) : f.monster && !f.cleared ? `lair: ${typeof f.monster === 'string' ? f.monster : f.monster.name || f.name}` : f.cleared ? '' : f.name ? `ruin: ${f.name}` : '').filter(Boolean).join(', ');
  const marks = (p: Any) => [p._despoiled != null ? 'BLIGHTED' : '', p._terrorStacks ? `Terror x${p._terrorStacks}` : '', (pl.consecratedProvIds || []).includes(p.id) ? 'consecrated' : '', p._plaguedTurn != null ? 'plague' : ''].filter(Boolean).join(', ');
  const garr = (p: Any) => (p.garrisonArmies || []).map((a: Any) => `${a.type}(${a.quality[0]})`).join(' ');
  const neighIds = (p: Any) => {
    const offs = p.row % 2 === 0 ? [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]] : [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
    const dirs = ['NW','NE','W','E','SW','SE'];
    return offs.map(([dr, dc], k) => { const r = p.row + dr; if (r < 0 || r >= S.world.rows) return null; const c = (((p.col + dc) % cols) + cols) % cols; return { dir: dirs[k], n: provs[r * cols + c] }; }).filter((x) => x && x.n) as { dir: string; n: Any }[];
  };
  out.push('\n-- Your provinces --');
  for (const id of pl.provinces) { const p = provs[id]; if (!p) continue;
    out.push(`#${p.id} ${p.name} [${p.terrain}, ${p.race || 'wild'}, tax ${p.tax}]${p.id === pl.homeProvinceId ? ' CAPITAL' : ''} garrison: ${garr(p) || 'none'}${feats(p) ? ' · ' + feats(p) : ''}${marks(p) ? ' · ' + marks(p) : ''} · recruits: ${(p.armyTypes || []).join(', ')} · graves ${(p.battleGraves || []).length}`);
    out.push('    neighbours: ' + neighIds(p).map(({ dir, n }) => `${dir}:#${n.id} ${n.name} (${n.terrain}${n.terrain === 'sea' ? '' : ', ' + ownerName(n.owner) + ', tax ' + n.tax + ''}${feats(n) ? ', ' + feats(n) : ''}${n._terrorStacks ? ', Terror x' + n._terrorStacks : ''})`).join('; '));
  }
  out.push('\n-- Your heroes --');
  for (const c of S.characters.filter((c: Any) => c.alive && c.player === pi)) {
    const p = provs[c.location];
    const sk = Object.entries(c.skills || {}).filter(([, v]) => (v as number) > 0).map(([k, v]) => `${k} ${v}`).join(', ');
    out.push(`[id ${c.id}] ${c.name}${c.isKing ? ' (KING)' : ''} at #${p.id} ${p.name} · hp ${c.hp}/${c.maxHp} · ${sk} · items: ${(c.items || []).map((it: Any) => it.name).join(', ') || 'none'}${c._captiveOf != null ? ' · CAPTIVE' : ''}`);
    out.push(`    armies (${(c.armies || []).length}): ${(c.armies || []).map((a: Any) => `${a.type}(${a.quality}${a._isSkeletal ? ', skeletal' : ''})`).join(', ') || 'none'}`);
  }
  const wanderers = S.characters.filter((c: Any) => c.alive && c.player == null && !c._isNeutralGuard && pl.provinces.includes(c.location));
  if (wanderers.length) out.push('Wandering heroes for hire in your land: ' + wanderers.map((c: Any) => `[id ${c.id}] ${c.name} at #${c.location} (${Object.entries(c.skills || {}).filter(([, v]) => (v as number) > 0).map(([k, v]) => k + ' ' + v).join(', ')})`).join('; '));
  const mercs = (S.mercenaries || []).filter((m: Any) => pl.provinces.includes(m.location));
  if (mercs.length) out.push('Mercenary bands in your land: ' + mercs.map((m: Any) => `${m.type} (${m.quality}) at #${m.location}, id ${m.id}`).join('; '));
  // round 25: the sight rule as the engine has it: another realm's hero standing in your land or with one of your heroes,
  // and one LEADING ARMIES in a province next to yours (his host at a glance, never the exact count)
  const band = (n: number) => (n <= 0 ? 'no armies' : n <= 2 ? 'a small escort' : n <= 5 ? 'a modest band' : n <= 9 ? 'a sizeable host' : n <= 15 ? 'a large host' : 'a vast host');
  const myLocs = new Set(S.characters.filter((c: Any) => c.alive && c.player === pi).map((c: Any) => c.location));
  const seenEnemies = S.characters.filter((c: Any) => c.alive && c.player != null && c.player !== pi && (pl.provinces.includes(c.location) || myLocs.has(c.location) || ((c.armies || []).length > 0 && pl.provinces.some((id: number) => neighIds(provs[id]).some(({ n }) => n.id === c.location)))));
  if (seenEnemies.length) out.push('Other realms\' heroes you can see: ' + seenEnemies.map((c: Any) => `[id ${c.id}] ${c.name} of ${S.players[c.player].name} at #${c.location} ${provs[c.location].name}, leading ${myLocs.has(c.location) ? (c.armies || []).length + ' companies' : band((c.armies || []).length)}`).join('; '));
  const rep = g.reports[String(pi)];
  if (rep) {
    out.push(`\n-- What you know (from your report) --`);
    for (const t of rep.intel || []) out.push('intel: ' + t);
    for (const pc of rep.pendingDiscoveryChoices || []) out.push(`research choice ${pc.key}: ` + (pc.options || []).map((o: Any) => `${o.id} ${o.name} (${o.category}: ${String(o.desc).slice(0, 90)})`).join(' | '));
    for (const f of rep.knownFeatures || []) if (!f.isOwned || !f.cleared) out.push(`feature: ${f.province}: ${f.name}${f.ritualSite ? ' (site)' : ''}${f.monster ? ` — lair of ${f.monster} (${f.monsterPower})` : ''}${f.cleared ? ' (cleared)' : ''}`);
    for (const c of rep.visibleChars || []) out.push('seen: ' + JSON.stringify(c).slice(0, 300));
    for (const m of rep.mercIntel || []) out.push('mercenaries: ' + JSON.stringify(m).slice(0, 200));
    for (const [prov, hs] of Object.entries(rep.availableHeroesByProv || {})) out.push(`heroes for hire at ${prov}: ` + JSON.stringify(hs).slice(0, 400));
    if ((rep.encounterTargets || []).length) out.push('encounter targets: ' + JSON.stringify(rep.encounterTargets).slice(0, 400));
    const pod = rep.provinceOrderData || {};
    const recruitable = Object.entries(pod).filter(([, d]: Any) => d.canRecruit).map(([id, d]: Any) => `#${id} ${d.name}: ` + (d.armyTypes || []).map((a: Any) => `${a.type} ${a.cost}g`).join(', ') + (d.wildHuntType ? ` · Wild Hunt ${d.wildHuntType} ${d.wildHuntCost}g` : ''));
    if (recruitable.length) out.push('recruit here: ' + recruitable.join(' | '));
    out.push(`\n-- Your turn report for turn ${g.turn - 1} --`);
    for (const l of rep.lastTurnLog || []) {
      if (!l || !l.text) continue;
      let t = String(l.text).replace(/\*\*/g, '');
      const fm = /⚑FORCE⚑(\{.*\})$/.exec(t);
      if (fm) { try { const f = JSON.parse(fm[1]); t = `${f.role === 'attacker' ? '⚔' : '🛡'} ${f.name} ${f.verb} ` + (f.armies || []).map((a: Any) => `${a.type} (${a.quality}${a.skeletal ? ', skeletal' : ''})`).join(', '); } catch { /* keep */ } }
      if (/^📊 (Nekros|[A-Z][a-z]+ +[12](st|nd) │)/.test(t) || /│/.test(t)) continue;
      out.push((l.phase != null && l.phase !== 99 ? `[ph${l.phase}] ` : '') + t);
    }
  } else out.push('\n(no report yet: this is the first turn)');
  console.log(out.join('\n'));
} else if (cmd === 'orders') {
  const g = load();
  const pi = rest[0]; const o = JSON.parse(fs.readFileSync(rest[1], 'utf8'));
  g.orders[pi] = o; save(g); console.log('orders set for realm', pi, 'heroes', Object.keys(o).filter((k) => k !== 'diplomacy').join(','));
} else if (cmd === 'run') {
  const g = load();
  process.env['KC_ALIGN_PROTO'] = 'Divine,Good,Druidic,Neutral,Pagan,Evil,Undead';
  process.env['KC_ALIGN_TACTICS'] = '1';
  process.env['KC_BOT_LAIRS'] = '1';
  const sc = scenario(g.spec.seed + g.turn * 7919);
  const S = JSON.parse(g.state);
  const rows = S.players.map((p: Any, i: number) => {
    const o = g.orders[String(i)] || {};
    const { diplomacy, encounterPlans, discoveryChoices, kingSkills, callReckoning, ...heroOrders } = o;
    const payload = { orders: heroOrders, encounterPlans: encounterPlans || {}, forTurn: g.turn, diplomacy: diplomacy || {}, discoveryChoices: discoveryChoices || {}, kingSkills: kingSkills || {}, callReckoning: callReckoning === true };
    return { id: 'G1gp' + i, game_id: 'G1', user_id: 'u' + i, player_index: i, display_name: p.name, orders_submitted: true, orders: JSON.stringify(payload), turn_report: '{}' };
  });
  const played: Any = sc.play(g.state, rows);
  g.state = stampedAsTheShellSaves(JSON.stringify(played.S2));
  g.reports = played.reports;
  const S2 = JSON.parse(g.state);
  const log: string[] = (played.log || []).map((l: Any) => l.text).filter(Boolean);
  g.logs.push(...log.map((t: string) => `T${g.turn}: ${t}`));
  const summary = `Turn ${g.turn} done. ` + S2.players.map((p: Any, i: number) => `${p.name}(${p.alignment}): ${p.provinces.length} prov, ${p.gold}g, ${S2.characters.filter((c: Any) => c.alive && c.player === i).length} heroes`).join(' | ') + (S2.gameOver ? ` GAME OVER: winner ${S2.gameOver.winner}` : '');
  g.summaries.push(summary); g.turn += 1; g.orders = {}; save(g);
  console.log(summary);
  if (process.env['KC_SHOW_GM']) for (const t of log.filter((t) => /battle|captur|slain|wins|takes|falls|claims|Ransom|storm|Crusade|consecrat|Blight|Terror|Beacons|Embargo|Trade Pact|Dark Pact|Bind the Bones|rite|Rite|Hunt|Offering|ley|Harvest|dead rise|breeds|answers|Hearts|Grace|Resurrection/i).slice(0, 60)) console.log('  ' + t.slice(0, 220));
} else {
  console.log('usage: new|view|orders|run');
}
```
