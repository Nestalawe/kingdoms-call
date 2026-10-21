// kc/no-random-or-argument-less-sort-comparator (plan P1-13, Decision 8; it replaces tests/sort-comparators.test.js).
// A sort whose comparator draws a random number, or takes no arguments, gives inconsistent answers: the order it
// produces, and how many random numbers it uses, then depend on the JavaScript engine's sort algorithm, so a newer
// Node or Chrome generates a different world from the same seed. Refused: a `.sort(…)` or `.toSorted(…)` whose
// comparator is a function with no parameters, e.g. `.sort(() => 0)`, or whose arguments call a random source
// anywhere (Math.random, kcRng, rnd, rng or random, as a name or a method), e.g. `.sort(() => Math.random() - 0.5)` or
// a tie-break `|| rnd() - 0.5`. To shuffle, use shuffleP(arr, rnd), then sort by a real key.
import type { Rule } from 'eslint';

// The syntax tree's types, as ESLint's own types give them (ESTree's).
type CallExpression = Parameters<NonNullable<Rule.RuleListener['CallExpression']>>[0];

const SORTS = new Set(['sort', 'toSorted']);
const RANDOM_SOURCES = new Set(['random', 'rnd', 'rng', 'kcRng']);

/** The name a call's callee is known by: `f(…)` → f, `x.f(…)` and `x['f'](…)` → f. */
function calleeName(callee: CallExpression['callee']): string | null {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type !== 'MemberExpression') return null;
  const p = callee.property;
  if (!callee.computed && p.type === 'Identifier') return p.name;
  if (p.type === 'Literal' && typeof p.value === 'string') return p.value;
  return null;
}

/** Whether a node of the syntax tree is a call. */
const isCall = (node: object): node is CallExpression => 'type' in node && node.type === 'CallExpression';

/** Whether a node, or anything inside it, calls a random source. */
function callsRandom(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(callsRandom);
  if (typeof node !== 'object' || node === null || !('type' in node)) return false;
  if (isCall(node)) {
    const name = calleeName(node.callee);
    if (name !== null && RANDOM_SOURCES.has(name)) return true;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    if (callsRandom(value)) return true;
  }
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Refuse a sort comparator that is random or takes no arguments.' },
    messages: {
      random:
        "This sort's comparator draws a random number, so the order depends on the JavaScript engine: a newer Node " +
        'or Chrome makes a different world from the same seed. Shuffle with shuffleP(arr, rnd), then sort by a real key.',
      argumentless:
        "This sort's comparator takes no arguments, so it ignores what it compares and the order depends on the " +
        'JavaScript engine. Compare the two values it is given.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (node.callee.type !== 'MemberExpression' || name === null || !SORTS.has(name)) return;
        const [comparator] = node.arguments;
        if (comparator === undefined) return; // .sort() sorts as strings: no comparator, nothing to check
        const isFunction = comparator.type === 'ArrowFunctionExpression' || comparator.type === 'FunctionExpression';
        if (isFunction && comparator.params.length === 0) context.report({ node, messageId: 'argumentless' });
        else if (callsRandom(node.arguments)) context.report({ node, messageId: 'random' });
      },
    };
  },
};

export default rule;
