// kc/narrative-lines-go-through-emit (tools/eslint-rules/; plan P1-12, Decision 6): every line of the turn enters the
// GM's log through emit. Refused: a write to turnLog (a mutating call on it, an assignment to it or inside it, delete,
// ++), a log() call (but console's and Math's), a push, unshift or splice on a fight's narrative, an object literal
// with an onlyPlayer key, and an event written without its hero (emit's event, or a place with an audience, with no hero
// and no spread: P1-12c2). Allowed: emit, narrate, narrateTo, narrateAll, narrateAt, takeBackLinesFrom, reading the log
// and narratives, console.log, Math.log. Each refusal is red on its planted line. Where the rule runs (all of the engine
// and the views but the events file, since P1-12a4) is eslint.config.js's; tests/static/harness.test.ts checks it
// refuses a planted line there and nowhere else.
// Level 1 (unit): ESLint's RuleTester runs the rule's code on snippets, which a static test, running nothing, can't.
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

tester.run('kc/narrative-lines-go-through-emit', rule, {
  valid: [
    // the door, and the narrative's two helpers
    "emit(turnContext, { type: 'system', text, audience: { realms: [pi] }, hero: c.id });",
    // every event names its hero: a hero's id, null for no hero, the hero whose order is resolving; a place with an
    // audience names it too; an event spreading a place carries the place's
    "emit(turnContext, { type: 'system', text, audience: {}, hero: null });",
    "emit(turnContext, { type: 'system', text, audience: { actor: pi }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING });",
    "logSplit(turnContext, 'system', mine, theirs, { audience: { actor: pi }, hero: c.id, province: p.id });",
    'const place = { audience: { realms: [owner] }, hero: null, province: prov.id };',
    "emit(turnContext, { type: 'combat', text: slainLine, ...place });",
    "lines.push([msg, { audience: { actor: pi }, 'hero': THE_HERO_WHOSE_ORDER_IS_RESOLVING }]);",
    // an object that is no event: no audience, not handed to emit
    'const opts = { actor: c.player, charId: c.id };',
    "narrate(narrative, 'The hosts close.');",
    'narrateTo(narrative, realm, hero.id, line);',
    // and the three that move lines already written: a duel's narrative into a battle's, lines put in before a line,
    // lines taken back
    'narrateAll(narrative, res.narrative);',
    'narrateAt(battle.narrative, at, form);',
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
      code: 'emit(turnContext, { type: "move", text: t as string, audience: {}, hero: null });',
      languageOptions: { parser: tseslint.parser },
    },
  ],
  invalid: [
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
    { code: "emit(turnContext, { type: 'system', text, audience: { realms: [pi] } });", errors: hero },
    { code: "emit(turnContext, { type: 'system', text, audience: {}, heroes: [c.id] });", errors: hero },
    { code: "emit(turnContext, { type: 'system', text, audience: {}, charId: c.id });", errors: hero },
    {
      code: "logSplit(turnContext, 'system', mine, theirs, { audience: { actor: pi }, province: p.id });",
      errors: hero,
    },
    { code: 'const place = { audience: { realms: [owner] }, province: prov.id };', errors: hero },
    { code: 'lines.push([msg, { audience: { actor: pi }, phase: ph }]);', errors: hero },
    {
      code: 'emit(turnContext, { type: "move", text: t as string, audience: {} });',
      languageOptions: { parser: tseslint.parser },
      errors: hero,
    },
    {
      code: "log('system', (text as string), { actor: pi });",
      languageOptions: { parser: tseslint.parser },
      errors: log,
    },
  ],
});
