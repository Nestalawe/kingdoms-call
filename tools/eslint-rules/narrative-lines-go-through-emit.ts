// kc/narrative-lines-go-through-emit (plan P1-12, Decision 6). Every line of the turn enters the GM's log (turnLog)
// through emit (src/engine/turn/events-and-their-audiences.ts), the one door, which writes it in its stored form with
// its audience: who may read it. A line pushed past it chooses its own audience, the way the leaks P1-04's check finds
// were made. Refused, everywhere but the events file (eslint.config.js lists where the rule runs):
// - a write to turnLog: a call of push, pop, shift, unshift, splice, sort, reverse, fill or copyWithin on it, an
//   assignment to it or to anything inside it, `delete` or `++` there (turnLog, or X.turnLog);
// - a call of log(…) or X.log(…), but console's and Math's: emit(turnContext, event) files a line;
// - push, unshift or splice on a fight's narrative (narrative, narr or X.narrative): narrate(narrative, line), a fact,
// a fact of a kind for its hero's realm alone for one realm (and, for lines already written, narrateAll, narrateAt and
// takeBackLinesFrom);
// - an object literal with an onlyPlayer key: the old line for one realm alone (P1-12c4: a kind of fact says it now);
// - an event written without its hero (P1-12c2): emit's event, or an event's place (an object literal with an audience
//   key: what logSplit, reportHeroFall and the held-back skill rises are handed), with no hero key and no spread. Every
//   event names its hero: a hero's id, null for no hero, or THE_HERO_WHOSE_ORDER_IS_RESOLVING. A spread place carries
//   its own (its literal is checked where it is written; emit throws on one left out);
// - an event written without its phase (P1-12d38), the same two literals and the same spread exemption, once it names its
//   hero. Every event names its phase: a number, 'none', or THE_PHASE_THE_LINE_IS_WRITTEN_IN (emit throws on one left out);
// - a line handed as words (P1-12d18): an event, or an event's place, with a text key (once it names its hero: an event
//   is refused for one fault at a time), and a string handed to narrate, emitNarrLine, narrateAll or narrateAt as the
//   line, or as one of the lines in an array written there. A string is one by its syntax: a string literal, a
//   template, a + with one, a choice (?:, ||, ??) with one. A line is a fact; the views write its words (emit throws on
//   words, on the paths that run: the compiler checks the typed files, this rule the untyped ones too).
// - a write to the turn's telemetry's lists (P1-12d33): a mutating call on _tel.<list> or X._tel.<list> (or on
//   anything inside it), an assignment to it or inside it, `delete` or `++` there, but its two snapshots by realm
//   (_tel.pre, _tel.orders), written where they are taken. A record for the statistics is a fact of its own, filed
//   through recordForTheStatistics(turnContext, fact), in the events file.
// Reading a narrative, emit and the events file's narrative helpers, handed a fact, are allowed.
import type { Rule } from 'eslint';

// The syntax tree's types, as ESLint's own types give them (ESTree's).
type CallExpression = Parameters<NonNullable<Rule.RuleListener['CallExpression']>>[0];
type Expression = CallExpression['callee'];

const TURN_LOG_WRITES = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const NARRATIVE_WRITES = new Set(['push', 'unshift', 'splice']);
/** The events file's helpers that take a fight's line: the place of the line (or lines) among their arguments. */
const THE_LINE_HANDED_TO = new Map([
  ['narrate', 1],
  ['emitNarrLine', 1],
  ['narrateAll', 1],
  ['narrateAt', 2],
]);

/** A member's name when it is written `x.name` or `x['name']`, else null. */
function memberName(node: Expression): string | null {
  if (node.type !== 'MemberExpression') return null;
  const p = node.property;
  if (!node.computed && p.type === 'Identifier') return p.name;
  if (p.type === 'Literal' && typeof p.value === 'string') return p.value;
  return null;
}

/** Whether a node is turnLog, X.turnLog, or anything inside one of them (turnLog[0], turnLog.length, …). */
function isInTurnLog(node: Expression | { type: string }): boolean {
  if (node.type === 'Identifier') return 'name' in node && node.name === 'turnLog';
  if (node.type !== 'MemberExpression' || !('object' in node)) return false;
  return memberName(node) === 'turnLog' || isInTurnLog(node.object);
}

/** The realms' two snapshots in the turn's telemetry, written where they are taken: its only lists a write may reach. */
const THE_TELEMETRYS_SNAPSHOTS = new Set(['pre', 'orders']);

/** Whether a node is one of the turn's telemetry's lists but its snapshots (_tel.battles, X._tel.factsInTheTurnsOrder,
 *  a list named by a computed key), or anything inside one. */
function isInTheTelemetrysLists(node: Expression | { type: string }): boolean {
  if (node.type !== 'MemberExpression' || !('object' in node)) return false;
  const { object } = node;
  const isTheTelemetry = (object.type === 'Identifier' && object.name === '_tel') || memberName(object) === '_tel';
  if (isTheTelemetry) return !THE_TELEMETRYS_SNAPSHOTS.has(memberName(node) ?? '');
  return isInTheTelemetrysLists(object);
}

/** Whether a node is a fight's narrative: narrative, narr or X.narrative. */
function isNarrative(node: Expression): boolean {
  if (node.type === 'Identifier') return node.name === 'narrative' || node.name === 'narr';
  return memberName(node) === 'narrative';
}

/** Whether a node is console or X.console (whose log echoes a line, writing none), or Math or X.Math (whose log is a
 *  logarithm). */
const isConsoleOrMath = (node: Expression): boolean =>
  (node.type === 'Identifier' && (node.name === 'console' || node.name === 'Math')) ||
  memberName(node) === 'console' ||
  memberName(node) === 'Math';

/** Whether a node is a string by its syntax: a string literal, a template, a + with one, or a choice (?:, ||, ??) with
 *  one, through TypeScript's `as`, `satisfies` and `!`. */
function isAString(node: unknown): boolean {
  if (typeof node !== 'object' || node === null || !('type' in node)) return false;
  const { type } = node;
  if (type === 'TemplateLiteral') return true;
  if (type === 'Literal') return 'value' in node && typeof node.value === 'string';
  if (type === 'TSAsExpression' || type === 'TSSatisfiesExpression' || type === 'TSNonNullExpression')
    return 'expression' in node && isAString(node.expression);
  if ((type === 'BinaryExpression' && 'operator' in node && node.operator === '+') || type === 'LogicalExpression')
    return 'left' in node && 'right' in node && (isAString(node.left) || isAString(node.right));
  if (type === 'ConditionalExpression')
    return 'consequent' in node && 'alternate' in node && (isAString(node.consequent) || isAString(node.alternate));
  return false;
}

/** A property's name when its key is written as a name or a string. */
function keyNameOf(property: { key: { type: string; name?: string; value?: unknown } }): unknown {
  const { key } = property;
  return key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: "Every line of the turn enters the GM's log through emit, with its audience." },
    messages: {
      turnLog:
        "A line enters the GM's log only through emit (src/engine/turn/events-and-their-audiences.ts), which writes it " +
        'in its stored form with its audience: docs/traps.md, "A line goes through emit".',
      log:
        'File the line with emit(turnContext, event), whose audience says who may read it: docs/traps.md, "A line ' +
        'goes through emit".',
      narrative:
        "Add to a fight's narrative with narrate(narrative, line): a fact (one for its hero's realm alone is a kind " +
        'whose audience says so: src/engine/turn/events-and-their-audiences.ts).',
      onlyPlayer:
        "A line of a narrative for one realm alone is a fact of a kind whose audience is its hero's realm alone " +
        '(docs/traps.md, "A line for one realm alone inside a fight"), not an object with onlyPlayer.',
      hero:
        "Every event names its hero: hero: <a hero's id>, hero: null for no hero, or hero: " +
        'THE_HERO_WHOSE_ORDER_IS_RESOLVING (docs/traps.md, "Every event names its hero").',
      phase:
        "Every event names its phase: phase: <a number>, phase: 'none' for no phase, or phase: " +
        'THE_PHASE_THE_LINE_IS_WRITTEN_IN (docs/traps.md, "Every event names its hero", which covers the phase too).',
      text:
        "An event records the fact its line's words are written from, never the words: fact: <one kind of LineFact> " +
        '(the views write the words: docs/traps.md, "A line goes through emit").',
      words:
        "A fight's line is the fact its words are written from, never a string: a kind of LineFact, typed in its " +
        'area\'s module (the views write the words: docs/traps.md, "A line goes through emit").',
      statistics:
        "A record for the turn's statistics is a fact of its own, filed with recordForTheStatistics(turnContext, " +
        "fact) (src/engine/turn/events-and-their-audiences.ts); only the realms' snapshots (_tel.pre, _tel.orders) " +
        'are written where they are taken.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        const name = memberName(callee);
        if (callee.type === 'MemberExpression' && name !== null) {
          if (TURN_LOG_WRITES.has(name) && isInTurnLog(callee.object)) {
            context.report({ node, messageId: 'turnLog' });
            return;
          }
          if (TURN_LOG_WRITES.has(name) && isInTheTelemetrysLists(callee.object)) {
            context.report({ node, messageId: 'statistics' });
            return;
          }
          if (NARRATIVE_WRITES.has(name) && isNarrative(callee.object))
            context.report({ node, messageId: 'narrative' });
          else if (name === 'log' && !isConsoleOrMath(callee.object)) context.report({ node, messageId: 'log' });
          return;
        }
        if (callee.type === 'Identifier' && callee.name === 'log') context.report({ node, messageId: 'log' });
        const at = callee.type === 'Identifier' ? THE_LINE_HANDED_TO.get(callee.name) : undefined;
        if (at === undefined) return;
        const handed = node.arguments[at];
        const lines = handed?.type === 'ArrayExpression' ? handed.elements : [handed];
        lines.forEach((line) => {
          if (isAString(line)) context.report({ node: line ?? node, messageId: 'words' });
        });
      },
      AssignmentExpression(node) {
        if (isInTurnLog(node.left)) context.report({ node, messageId: 'turnLog' });
        else if (isInTheTelemetrysLists(node.left)) context.report({ node, messageId: 'statistics' });
      },
      UpdateExpression(node) {
        if (isInTurnLog(node.argument)) context.report({ node, messageId: 'turnLog' });
        else if (isInTheTelemetrysLists(node.argument)) context.report({ node, messageId: 'statistics' });
      },
      UnaryExpression(node) {
        if (node.operator !== 'delete') return;
        if (isInTurnLog(node.argument)) context.report({ node, messageId: 'turnLog' });
        else if (isInTheTelemetrysLists(node.argument)) context.report({ node, messageId: 'statistics' });
      },
      Property(node) {
        if (node.parent.type !== 'ObjectExpression' || node.computed) return;
        if (keyNameOf(node) === 'onlyPlayer') context.report({ node, messageId: 'onlyPlayer' });
      },
      ObjectExpression(node) {
        const { parent } = node;
        const isEmitsEvent =
          parent.type === 'CallExpression' &&
          parent.callee.type === 'Identifier' &&
          parent.callee.name === 'emit' &&
          parent.arguments[1] === node;
        const keys = node.properties.map((p) => (p.type === 'Property' && !p.computed ? keyNameOf(p) : null));
        if (!isEmitsEvent && !keys.includes('audience')) return;
        if (!keys.includes('hero') && !node.properties.some((p) => p.type === 'SpreadElement'))
          context.report({ node, messageId: 'hero' });
        else if (!keys.includes('phase') && !node.properties.some((p) => p.type === 'SpreadElement'))
          context.report({ node, messageId: 'phase' });
        else if (keys.includes('text')) context.report({ node, messageId: 'text' });
      },
    };
  },
};

export default rule;
