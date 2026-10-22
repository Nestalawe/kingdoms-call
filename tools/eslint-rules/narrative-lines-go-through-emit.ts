// kc/narrative-lines-go-through-emit (plan P1-12, Decision 6). Every line of the turn enters the GM's log (turnLog)
// through emit (src/engine/turn/events-and-their-audiences.ts), the one door, which writes it in its stored form with
// its audience: who may read it. A line pushed past it chooses its own audience, the way the leaks P1-04's check finds
// were made. Refused, everywhere but the events file (eslint.config.js lists where the rule runs):
// - a write to turnLog: a call of push, pop, shift, unshift, splice, sort, reverse, fill or copyWithin on it, an
//   assignment to it or to anything inside it, `delete` or `++` there (turnLog, or X.turnLog);
// and, unless the option `onlyWritesToTheGmLog` is set (the folders P1-12a's rows haven't converted yet):
// - a call of log(…) or X.log(…), but console's: emit(turnContext, event) files a line;
// - push, unshift or splice on a fight's narrative (narrative, narr or X.narrative): narrate(narrative, text), or
//   narrateTo(narrative, realm, heroId, text) for one realm alone;
// - an object literal with an onlyPlayer key: narrateTo makes it.
// Reading a narrative, emit, narrate and narrateTo are allowed.
import type { Rule } from 'eslint';

// The syntax tree's types, as ESLint's own types give them (ESTree's).
type CallExpression = Parameters<NonNullable<Rule.RuleListener['CallExpression']>>[0];
type Expression = CallExpression['callee'];

const TURN_LOG_WRITES = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const NARRATIVE_WRITES = new Set(['push', 'unshift', 'splice']);

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

/** Whether a node is a fight's narrative: narrative, narr or X.narrative. */
function isNarrative(node: Expression): boolean {
  if (node.type === 'Identifier') return node.name === 'narrative' || node.name === 'narr';
  return memberName(node) === 'narrative';
}

/** Whether a node is console or X.console. */
const isConsole = (node: Expression): boolean =>
  (node.type === 'Identifier' && node.name === 'console') || memberName(node) === 'console';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: "Every line of the turn enters the GM's log through emit, with its audience." },
    messages: {
      turnLog:
        "A line enters the GM's log only through emit (src/engine/turn/events-and-their-audiences.ts), which writes it " +
        'in its stored form with its audience: docs/traps.md, "A line goes through emit".',
      log:
        'File the line with emit(turnContext, event), whose audience says who may read it (log() goes in plan ' +
        'P1-12a4): docs/traps.md, "A line goes through emit".',
      narrative:
        "Add to a fight's narrative with narrate(narrative, text), or narrateTo(narrative, realm, heroId, text) for one " +
        'realm alone (src/engine/turn/events-and-their-audiences.ts).',
      onlyPlayer:
        'A line of a narrative for one realm alone is narrateTo(narrative, realm, heroId, text), not an object with ' +
        'onlyPlayer.',
    },
    schema: [
      {
        type: 'object',
        properties: { onlyWritesToTheGmLog: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options: unknown = context.options[0];
    const onlyWritesToTheGmLog =
      typeof options === 'object' &&
      options !== null &&
      'onlyWritesToTheGmLog' in options &&
      options.onlyWritesToTheGmLog === true;
    return {
      CallExpression(node) {
        const { callee } = node;
        const name = memberName(callee);
        if (callee.type === 'MemberExpression' && name !== null) {
          if (TURN_LOG_WRITES.has(name) && isInTurnLog(callee.object)) {
            context.report({ node, messageId: 'turnLog' });
            return;
          }
          if (onlyWritesToTheGmLog) return;
          if (NARRATIVE_WRITES.has(name) && isNarrative(callee.object))
            context.report({ node, messageId: 'narrative' });
          else if (name === 'log' && !isConsole(callee.object)) context.report({ node, messageId: 'log' });
          return;
        }
        if (!onlyWritesToTheGmLog && callee.type === 'Identifier' && callee.name === 'log')
          context.report({ node, messageId: 'log' });
      },
      AssignmentExpression(node) {
        if (isInTurnLog(node.left)) context.report({ node, messageId: 'turnLog' });
      },
      UpdateExpression(node) {
        if (isInTurnLog(node.argument)) context.report({ node, messageId: 'turnLog' });
      },
      UnaryExpression(node) {
        if (node.operator === 'delete' && isInTurnLog(node.argument)) context.report({ node, messageId: 'turnLog' });
      },
      Property(node) {
        if (onlyWritesToTheGmLog || node.parent.type !== 'ObjectExpression' || node.computed) return;
        const { key } = node;
        const keyName = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null;
        if (keyName === 'onlyPlayer') context.report({ node, messageId: 'onlyPlayer' });
      },
    };
  },
};

export default rule;
