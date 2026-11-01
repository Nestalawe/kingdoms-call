// kc/narrative-lines-go-through-emit (tools/eslint-rules/; plan P1-12, Decision 6): every line of the turn enters the
// GM's log through emit. Refused: a write to turnLog (a mutating call on it, an assignment to it or inside it, delete,
// ++), a log() call (but console's and Math's), a push, unshift or splice on a fight's narrative, an object literal
// with an onlyPlayer key, an event written without its hero (emit's event, or a place with an audience, with no hero
// and no spread: P1-12c2), and a line handed as words (P1-12d18: such an event with a text key, and a string handed to
// narrate, emitNarrLine, narrateAll or narrateAt), and a write to the turn's telemetry's lists but its two snapshots
// (P1-12d33: a record for the statistics goes through recordForTheStatistics). Allowed: emit, narrate, narrateTo,
// narrateAll, narrateAt, takeBackLinesFrom, each handed a fact, recordForTheStatistics, _tel.pre and _tel.orders
// written, reading the log and narratives, console.log, Math.log. Each refusal is red on
// its planted line. Where the rule runs (all of the engine and the views but the events file, since P1-12a4) is
// eslint.config.js's; tests/static/harness.test.ts checks it refuses a planted line there and nowhere else.
// Level 1 (unit): ESLint's RuleTester runs the rule's code on snippets, which a static test, running nothing, can't.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `kc/narrative-lines-go-through-emit` (`tools/eslint-rules/`, P1-12a2; plan P1-12's Decision 6), run by ESLint's
// RuleTester: a write to the GM's log (`turnLog` or `X.turnLog`: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`,
// `reverse`, `fill`, `copyWithin`, an assignment to it or inside it, `delete`, `++`) is refused, and so are a `log(…)`
// or `X.log(…)` call (but console's and Math's, P1-12a3), a `push`, `unshift` or `splice` on `narrative`, `narr` or
// `X.narrative`, an object literal with an `onlyPlayer` key (the option that refused only the writes to the GM's log,
// for the folders not yet converted, went in P1-12a4), and an event written without its hero (P1-12c2: `emit`'s event,
// or an event's place, an object literal with an `audience` as handed to `logSplit` or held in a `const` or an array,
// with no `hero` and no spread), and a line handed as words (P1-12d18: such an event with a `text` key, once it names
// its hero, and a string, a template, a `+` or a choice with one, handed to `narrate`, `emitNarrLine`, `narrateAll` or
// `narrateAt`, alone or in an array written there), and a write to the turn's telemetry's lists (P1-12d33: a mutating
// call, an assignment, `delete` or `++` on `_tel.<list>` or `X._tel.<list>`, but `pre` and `orders`, the realms'
// snapshots); a fact, a fact whose fields hold a string, a hero's id, `null`,
// `THE_HERO_WHOSE_ORDER_IS_RESOLVING`, a spread place and an object with no `audience` pass; `emit`, `narrate`,
// `narrateTo`, `narrateAll`, `narrateAt`, `takeBackLinesFrom`, `recordForTheStatistics`, the two snapshots written, the
// telemetry made and read, reading the log or a narrative, a context made with an
// empty log, another list's push, `console.log` and `Math.log` pass; JavaScript and TypeScript. Each refusal is red on
// its planted line. Where it runs is `harness`'s. Level 1: RuleTester runs the rule's code on snippets, which a static
// test, running nothing, can't
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, test } from 'vitest';
import rule from '../../tools/eslint-rules/narrative-lines-go-through-emit.ts';

RuleTester.describe = describe;
RuleTester.it = test;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const turnLog = [{ messageId: 'turnLog' }];
const log = [{ messageId: 'log' }];
const narrative = [{ messageId: 'narrative' }];
const onlyPlayer = [{ messageId: 'onlyPlayer' }];
const hero = [{ messageId: 'hero' }];
const text = [{ messageId: 'text' }];
const words = [{ messageId: 'words' }];
const statistics = [{ messageId: 'statistics' }];

tester.run('kc/narrative-lines-go-through-emit', rule, {
  valid: [
    // the door, and the narrative's two helpers
    "emit(turnContext, { type: 'system', fact, audience: { realms: [pi] }, hero: c.id });",
    // every event names its hero: a hero's id, null for no hero, the hero whose order is resolving; a place with an
    // audience names it too; an event spreading a place carries the place's
    "emit(turnContext, { type: 'system', fact, audience: {}, hero: null });",
    "emit(turnContext, { type: 'system', fact, audience: { actor: pi }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING });",
    "logSplit(turnContext, 'system', mine, theirs, { audience: { actor: pi }, hero: c.id, province: p.id });",
    'const place = { audience: { realms: [owner] }, hero: null, province: prov.id };',
    "emit(turnContext, { type: 'combat', fact: slainLine, ...place });",
    "lines.push([msg, { audience: { actor: pi }, 'hero': THE_HERO_WHOSE_ORDER_IS_RESOLVING }]);",
    // an object that is no event: no audience, not handed to emit
    'const opts = { actor: c.player, charId: c.id };',
    "narrate(narrative, { kind: 'the hosts close', province: prov.name });",
    'narrate(narrative, line);',
    'narrateTo(narrative, realm, hero.id, line);',
    // and the three that move lines already written: a duel's narrative into a battle's, lines put in before a line,
    // lines taken back
    'narrateAll(narrative, res.narrative);',
    'narrateAt(battle.narrative, at, form);',
    'narrateAt(narrative, at, [plea, refused]);',
    "narrateAll(narrative, [battleWidthLine(prov.terrain, w), { kind: 'the hosts close' }]);",
    "emitNarrLine(turnContext, line, { ...fight, battle: { id, tier: 'd' } });",
    // a fact whose fields hold a string, and a string handed elsewhere: only the line itself is refused
    "narrate(narrative, { kind: 'a blow', who: `${a.name}'s host` });",
    "notes.push('a note'); describe('words');",
    // an object with a text key that is no event: no audience, not handed to emit
    "const shown = { text: 'a line', bTier: 'k' };",
    'const tail = takeBackLinesFrom(narrative, at);',
    // reading the log and a narrative
    'turnLog.forEach((e) => seen.add(e.charId));',
    'const last = turnLog[turnLog.length - 1];',
    'const x = turnContext.turnLog.filter((e) => e.public).map((e) => e.text);',
    'const copy = turnLog.slice();',
    "const at = narrative.findIndex((l) => narrText(l).startsWith('—'));",
    'const n = narrative.length;',
    'function f(line) { if (line.onlyPlayer == null) return line.text; }',
    'const { text, onlyPlayer } = line;',
    // a context made with an empty log, and a log of another name
    'const turnContext = { G, freshPlayers, turnLog: [] };',
    'lines.push(text);',
    'report.lastTurnLog.push(line);',
    // console's log, under any name
    'console.log(`[${type}] ${text}`);',
    'globalThis.console.log(text);',
    // Math's log, a logarithm
    'const r = Math.log(Math.max(a, 1e-9) / Math.max(b, 1e-9));',
    'const small = Math.abs(S) < globalThis.Math.log(1.15);',
    {
      code: 'emit(turnContext, { type: "move", fact: f as LineFact, audience: {}, hero: null });',
      languageOptions: { parser: tseslint.parser },
    },
    // the turn's statistics (P1-12d33): a record filed through its door; the realms' two snapshots written where they
    // are taken; the telemetry made, handed on and read
    "recordForTheStatistics(turnContext, { kind: 'a battle fought, for the statistics', record });",
    'if (pl) _tel.pre[pi] = telRealmSnapshot(G, pi);',
    'turnContext._tel.orders[pi] = telOrdersFor(G, pi, flags);',
    'const _tel = { pre: {}, orders: {}, factsInTheTurnsOrder: [] };',
    'turnContext._tel = _tel;',
    'const n = _tel.factsInTheTurnsOrder.length;',
    'statistics.battles.push(fact.record);',
  ],
  invalid: [
    // a write to the turn's telemetry's lists, but its snapshots (P1-12d33)
    { code: '_tel.battles.push({ ph, prov: prov.id });', errors: statistics },
    { code: 'turnContext._tel.spells.push(record);', errors: statistics },
    { code: '_tel.factsInTheTurnsOrder.push(fact);', errors: statistics },
    { code: "_tel['encounters'].unshift(record);", errors: statistics },
    { code: '_tel[list].push(record);', errors: statistics },
    { code: '_tel.captures[0] = record;', errors: statistics },
    { code: '_tel.deaths = [];', errors: statistics },
    { code: 'delete _tel.deaths[0];', errors: statistics },
    { code: '_tel.counts.battles++;', errors: statistics },
    // a write to the GM's log
    { code: 'turnLog.push(line);', errors: turnLog },
    { code: 'turnContext.turnLog.push(line);', errors: turnLog },
    { code: 'const held = turnLog.pop();', errors: turnLog },
    { code: 'turnLog.splice(at + 1, 0, ...ents);', errors: turnLog },
    { code: 'turnLog.unshift(line);', errors: turnLog },
    { code: 'turnLog.shift();', errors: turnLog },
    { code: 'turnLog.sort((a, b) => a.phase - b.phase);', errors: turnLog },
    { code: 'turnLog.reverse();', errors: turnLog },
    { code: "turnLog['push'](line);", errors: turnLog },
    { code: 'turnContext.turnLog = [];', errors: turnLog },
    { code: 'turnLog[0] = line;', errors: turnLog },
    { code: 'turnLog.length = 0;', errors: turnLog },
    { code: "turnLog[i].text = 'changed';", errors: turnLog },
    { code: 'turnLog[i].phase++;', errors: turnLog },
    { code: 'delete turnLog[i];', errors: turnLog },
    // a line logged past emit
    { code: "log('system', text, { actor: pi, targets: [pi] });", errors: log },
    { code: "log('system', '═ Tax collection ═');", errors: log },
    { code: "turnContext.log('move', text, meta);", errors: log },
    { code: "this.log('move', text);", errors: log },
    // a narrative written past narrate and narrateTo
    { code: 'narrative.push(line);', errors: narrative },
    { code: 'narr.push(`— ${name} falls.`);', errors: narrative },
    { code: 'battle.narrative.push(line);', errors: narrative },
    { code: 'narrative.unshift(line);', errors: narrative },
    { code: 'narrative.splice(at, 0, ...lines);', errors: narrative },
    { code: "if (narrative) narrative['push'](msg);", errors: narrative },
    // a line for one realm alone made by hand
    { code: 'const l = { text: line, onlyPlayer: real.player, charId: real.id };', errors: onlyPlayer },
    {
      code: 'lines.forEach((l) => out.push(l.priv != null ? { text: l.text, onlyPlayer: l.priv } : l.text));',
      errors: onlyPlayer,
    },
    { code: "const l = { text, 'onlyPlayer': 1 };", errors: onlyPlayer },
    // an event written without its hero: emit's, or a place with an audience
    { code: "emit(turnContext, { type: 'system', fact, audience: { realms: [pi] } });", errors: hero },
    { code: "emit(turnContext, { type: 'system', fact, audience: {}, heroes: [c.id] });", errors: hero },
    { code: "emit(turnContext, { type: 'system', fact, audience: {}, charId: c.id });", errors: hero },
    // an event with no hero and words too: refused for its hero first (one fault at a time)
    { code: "emit(turnContext, { type: 'system', text, audience: {} });", errors: hero },
    {
      code: "logSplit(turnContext, 'system', mine, theirs, { audience: { actor: pi }, province: p.id });",
      errors: hero,
    },
    { code: 'const place = { audience: { realms: [owner] }, province: prov.id };', errors: hero },
    { code: 'lines.push([msg, { audience: { actor: pi }, phase: ph }]);', errors: hero },
    {
      code: 'emit(turnContext, { type: "move", fact: f as LineFact, audience: {} });',
      languageOptions: { parser: tseslint.parser },
      errors: hero,
    },
    // a line handed as words (P1-12d18): an event or a place with a text key, once it names its hero
    { code: "emit(turnContext, { type: 'system', text, audience: { realms: [pi] }, hero: c.id });", errors: text },
    { code: "emit(turnContext, { type: 'system', text: 'A line.', audience: {}, hero: null });", errors: text },
    { code: "emit(turnContext, { type: 'combat', text: slainLine, ...place });", errors: text },
    { code: 'emit(turnContext, { ...fight, text: line });', errors: text },
    { code: "emit(turnContext, { type: 'system', 'text': t, audience: {}, hero: null });", errors: text },
    {
      code: "logSplit(turnContext, 'system', a, b, { audience: { actor: pi }, hero: c.id, text: line });",
      errors: text,
    },
    { code: 'const place = { audience: { realms: [owner] }, hero: null, text: line };', errors: text },
    // and a string handed to a fight's narrative: a string, a template, a + or a choice with one, in an array too
    { code: "narrate(narrative, 'The hosts close.');", errors: words },
    { code: 'narrate(narr, `— ${name} falls.`);', errors: words },
    { code: "narrate(narrative, '  ' + line);", errors: words },
    { code: "narrate(narrative, won ? fact : 'The hosts break.');", errors: words },
    { code: "narrate(narrative, fact || 'The hosts break.');", errors: words },
    { code: "emitNarrLine(turnContext, 'A line.', fight);", errors: words },
    { code: "narrateAll(narrative, [fact, 'A line.', `— ${name}`]);", errors: [...words, ...words] },
    { code: "narrateAll(narrative, 'A line.');", errors: words },
    { code: "narrateAt(battle.narrative, at, ['A line.']);", errors: words },
    {
      code: 'narrate(narrative, `${name} falls.` as LineFact);',
      languageOptions: { parser: tseslint.parser },
      errors: words,
    },
    {
      code: 'emit(turnContext, { type: "move", text: t as string, audience: {}, hero: null });',
      languageOptions: { parser: tseslint.parser },
      errors: text,
    },
    {
      code: "log('system', (text as string), { actor: pi });",
      languageOptions: { parser: tseslint.parser },
      errors: log,
    },
  ],
});
