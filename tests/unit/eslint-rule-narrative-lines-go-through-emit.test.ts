// kc/narrative-lines-go-through-emit (tools/eslint-rules/; plan P1-12, Decision 6): every line of the turn enters the
// GM's log through emit. Refused: a write to turnLog (a mutating call on it, an assignment to it or inside it, delete,
// ++), everywhere it runs; and, where its option onlyWritesToTheGmLog isn't set, a log() call (but console's), a push,
// unshift or splice on a fight's narrative, and an object literal with an onlyPlayer key. Allowed: emit, narrate,
// narrateTo, reading the log and narratives, console.log. Each refusal is red on its planted line. Where the rule runs
// (the engine and the views but the events file; in full in the folders P1-12a's rows have converted) is
// eslint.config.js's; tests/static/harness.test.ts checks it refuses a planted line there and nowhere else.
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
const gmLogOnly = [{ onlyWritesToTheGmLog: true }];

tester.run('kc/narrative-lines-go-through-emit', rule, {
  valid: [
    // the door, and the narrative's two helpers
    "emit(turnContext, { type: 'system', text, audience: { realms: [pi] } });",
    "narrate(narrative, 'The hosts close.');",
    'narrateTo(narrative, realm, hero.id, line);',
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
    // where only writes to the GM's log are refused (the folders not yet converted)
    { code: "log('system', text, { actor: pi });", options: gmLogOnly },
    { code: "turnContext.log('system', text);", options: gmLogOnly },
    { code: 'narrative.push(line);', options: gmLogOnly },
    { code: 'const l = { text, onlyPlayer: c.player, charId: c.id };', options: gmLogOnly },
    {
      code: 'emit(turnContext, { type: "move", text: t as string, audience: {} });',
      languageOptions: { parser: tseslint.parser },
    },
  ],
  invalid: [
    // a write to the GM's log, wherever the rule runs
    { code: 'turnLog.push(line);', errors: turnLog },
    { code: 'turnContext.turnLog.push(line);', errors: turnLog },
    { code: 'turnLog.push(line);', options: gmLogOnly, errors: turnLog },
    { code: 'const held = turnLog.pop();', options: gmLogOnly, errors: turnLog },
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
    {
      code: "log('system', (text as string), { actor: pi });",
      languageOptions: { parser: tseslint.parser },
      errors: log,
    },
  ],
});
