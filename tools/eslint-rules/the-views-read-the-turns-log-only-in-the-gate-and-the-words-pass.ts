// kc/the-views-read-the-turns-log-only-in-the-gate-and-the-words-pass (B-18a). In the views, which lines of the turn
// a realm reads is decided in one place: the gate
// (src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts), which hands each
// line it lets through with how it reaches the realm. The words pass (src/views/prose/the-words-of-each-line.ts) reads
// the turn's lines to write their words, for every reader alike. A view that read the log itself would pick a realm's
// lines past the gate, the way a report could show a line its audience keeps from it. Refused, in src/views/ but those
// two files (eslint.config.js lists where the rule runs), a read of the turn's log (turnLog or gmLog, or X.turnLog or
// X.gmLog, through TypeScript's `as`, `satisfies` and `!`):
// - a member of it (turnLog.filter(…), turnLog[0], turnLog.length, …);
// - a loop over it (for … of, for … in);
// - a spread of it ([...turnLog], f(...turnLog));
// - a destructuring of its lines (const [first] = turnLog).
// Handing the log on whole (to the gate, to the words pass, in an object, as what a function returns) and taking it out
// of an object (whatTheReportsRead.turnLog, const { gmLog } = …) are allowed. The rule reads names, as the rule that
// lines go through emit does: the compiler's types don't say which list is the turn's log.
import type { Rule } from 'eslint';

/** The names the turn's log goes by in the views: the engine's (turnLog) and the GM's log in words (gmLog). */
const THE_TURNS_LOG = new Set(['turnLog', 'gmLog']);

/** Whether a node is the turn's log: turnLog or gmLog, X.turnLog or X.gmLog (or X['turnLog']), through `as`,
 *  `satisfies` and `!`. */
function isTheTurnsLog(node: unknown): boolean {
  if (typeof node !== 'object' || node === null || !('type' in node)) return false;
  const { type } = node;
  if (type === 'TSAsExpression' || type === 'TSSatisfiesExpression' || type === 'TSNonNullExpression')
    return 'expression' in node && isTheTurnsLog(node.expression);
  if (type === 'Identifier') return 'name' in node && typeof node.name === 'string' && THE_TURNS_LOG.has(node.name);
  if (type !== 'MemberExpression' || !('property' in node) || !('computed' in node)) return false;
  const { property, computed } = node;
  if (typeof property !== 'object' || property === null || !('type' in property)) return false;
  if (!computed && property.type === 'Identifier' && 'name' in property && typeof property.name === 'string')
    return THE_TURNS_LOG.has(property.name);
  if (property.type === 'Literal' && 'value' in property && typeof property.value === 'string')
    return THE_TURNS_LOG.has(property.value);
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: "In the views, the turn's log is read only by the gate that says which lines each realm reads.",
    },
    messages: {
      read:
        "In the views, the turn's lines are read only in the gate (src/views/the-gate-that-says-which-lines-of-the-" +
        'turn-each-realm-reads-and-how-each-reaches-it.ts) and in the words pass (src/views/prose/the-words-of-each-' +
        'line.ts): hand the log to the gate, and read the lines it lets through for the realm, each with how it ' +
        'reaches it.',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isTheTurnsLog(node.object)) context.report({ node, messageId: 'read' });
      },
      ForOfStatement(node) {
        if (isTheTurnsLog(node.right)) context.report({ node: node.right, messageId: 'read' });
      },
      ForInStatement(node) {
        if (isTheTurnsLog(node.right)) context.report({ node: node.right, messageId: 'read' });
      },
      SpreadElement(node) {
        if (isTheTurnsLog(node.argument)) context.report({ node, messageId: 'read' });
      },
      VariableDeclarator(node) {
        if (node.id.type === 'ArrayPattern' && isTheTurnsLog(node.init)) context.report({ node, messageId: 'read' });
      },
      AssignmentExpression(node) {
        if (node.left.type === 'ArrayPattern' && isTheTurnsLog(node.right)) context.report({ node, messageId: 'read' });
      },
    };
  },
};

export default rule;
