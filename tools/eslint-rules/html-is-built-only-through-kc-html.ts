// kc/html-is-built-only-through-kc-html (plan P1-13, Decision 8; it replaces tests/html-lint.test.js). Every name,
// message and record on screen was typed by someone, so a page builds its HTML only through kcHtml and kcEsc
// (src/ui/shared/kc-safe.ts; P0-19; docs/traps.md, "HTML is built only through kcHtml"). Refused, each a check:
//   template  an untagged `…` with markup and a ${value} in it: tag it kcHtml;
//   concat    markup in quotes joined with + to a value that isn't escaped: '<td>' + name + '</td>' (use kcHtml);
//   sink      innerHTML / outerHTML / insertAdjacentHTML / document.write given a property read (e.message, g.name)
//             or an untagged template, rather than a constant, kcHtml, a variable or a call (whose own building is
//             checked where it happens);
//   plus      kcHtml joined with + or +=, or a list of kcHtml joined with .join(): both make a plain string, which the
//             next kcHtml escapes again. Interpolate the kcHtml, or the list, instead;
//   twice     kcEsc (or an older escaper) inside kcHtml: kcHtml escapes values itself, so the text is escaped twice;
//   handler   a value inside an on…="…" attribute of kcHtml that isn't kcArg(…) or a constant.
// The code is read as JavaScript: a type assertion (`x as T`, `x!`, `x satisfies T`, `<T>x`) counts as the value it
// wraps, as the test this rule replaced read a module with its types stripped.
//
// The option `exceptions` lists the reviewed exceptions (eslint.config.js, HTML_EXCEPTIONS; tools/ratchet.ts counts
// them, allowlistEntries), each a { file, check, code, reason }: the finding of that check in that file (relative to
// the folder ESLint runs in) whose code holds `code` (spaces and line breaks aside, so a reformat doesn't move it) is
// let through. An exception that matches nothing in its file is itself a finding, so the list can't go stale.
import path from 'node:path';
import type { Rule } from 'eslint';
import { z } from 'zod';

// The syntax tree's types, as ESLint's own types give them (ESTree's).
type Listener<K extends keyof Rule.NodeListener> = Parameters<NonNullable<Rule.NodeListener[K]>>[0];
type CallExpression = Listener<'CallExpression'>;
type Expression = Listener<'BinaryExpression'>['right'];
type Argument = CallExpression['arguments'][number];
type TaggedTemplateExpression = Extract<Expression, { type: 'TaggedTemplateExpression' }>;
type MemberExpression = Extract<Expression, { type: 'MemberExpression' }>;
interface SyntaxNode {
  readonly type: string;
}

const CHECKS = ['template', 'concat', 'sink', 'plus', 'twice', 'handler'] as const;
type Check = (typeof CHECKS)[number];

const Exception = z.object({
  file: z.string(),
  check: z.enum(CHECKS),
  code: z.string().min(1),
  reason: z.string().min(1),
});
const Options = z.object({ exceptions: z.array(Exception).default([]) }).default({ exceptions: [] });

const MARKUP = /<[a-zA-Z!/]/;
const ESCAPERS = new Set(['kcEsc', 'esc', '_esc', 'escapeHtml', '_msgEsc', '_rdEsc']);
const SINK_PROPS = new Set(['innerHTML', 'outerHTML']);
const HANDLER_OPEN = /\son[a-z]+\s*=\s*("[^"]*|'[^']*)$/i;
// TypeScript's wrappers of a value, which its types stripped leave out.
const TYPE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

const isNode = (value: unknown): value is SyntaxNode =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
const isTypeWrapper = (node: SyntaxNode): node is SyntaxNode & { expression: Expression } =>
  TYPE_WRAPPERS.has(node.type) && 'expression' in node;
/** A value without the type assertions around it. */
function bare<T extends SyntaxNode>(node: T): T | Expression {
  let at: T | Expression = node;
  while (isTypeWrapper(at)) at = at.expression;
  return at;
}
const isTaggedTemplate = (node: SyntaxNode): node is TaggedTemplateExpression =>
  node.type === 'TaggedTemplateExpression';
const isCall = (node: SyntaxNode): node is CallExpression => node.type === 'CallExpression';
const isKcTag = (node: SyntaxNode): node is TaggedTemplateExpression =>
  isTaggedTemplate(node) && node.tag.type === 'Identifier' && node.tag.name === 'kcHtml';
const isCallTo = (node: SyntaxNode, names: readonly string[]): node is CallExpression =>
  isCall(node) && node.callee.type === 'Identifier' && names.includes(node.callee.name);
const isKcValue = (node: SyntaxNode): boolean => isKcTag(node) || isCallTo(node, ['kcHtml', 'kcRaw', 'kcArg']);

/** A member's property name, when written as one (`x.name`, `x.#name`), not computed. */
function propertyName(member: MemberExpression): string | null {
  const p = member.property;
  return !member.computed && (p.type === 'Identifier' || p.type === 'PrivateIdentifier') ? p.name : null;
}
/** The name a call is known by: `f(…)` → f, `x.f(…)` → f. */
function calleeName(node: SyntaxNode): string | null {
  if (!isCall(node)) return null;
  const callee = bare(node.callee);
  if (callee.type === 'Identifier') return callee.name;
  return callee.type === 'MemberExpression' ? propertyName(callee) : null;
}
/** A string the code spells out: a string literal, or a template with nothing interpolated. */
function stringOf(node: Expression): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? null;
  return null;
}
const hasMarkup = (node: Expression): boolean => {
  const s = stringOf(node);
  return s !== null && MARKUP.test(s);
};

/** The leaves of a + chain (a + b + c is ((a + b) + c)). */
function plusLeaves(node: Expression | Listener<'BinaryExpression'>['left'], out: Expression[] = []): Expression[] {
  const n = bare(node);
  if (n.type === 'BinaryExpression' && n.operator === '+') {
    plusLeaves(n.left, out);
    plusLeaves(n.right, out);
  } else if (n.type !== 'PrivateIdentifier') out.push(n);
  return out;
}
/** A piece that may sit next to markup in a + chain: a constant, an escaped value, or a choice between those. */
function safePiece(node: Expression): boolean {
  const n = bare(node);
  if (n.type === 'Literal') return typeof n.value === 'string' || typeof n.value === 'number';
  if (n.type === 'TemplateLiteral') return n.expressions.length === 0;
  if (isCallTo(n, ['kcEsc'])) return true;
  if (n.type === 'ConditionalExpression') return safePiece(n.consequent) && safePiece(n.alternate);
  if (n.type === 'BinaryExpression' && n.operator === '+') return plusLeaves(n).every(safePiece);
  return false;
}
/** What a sink may be given: a constant, kcHtml, a variable or a call (whose own building is checked where it
 *  happens). */
function safeSink(node: Argument): boolean {
  const n = bare(node);
  if (n.type === 'Literal' || n.type === 'Identifier' || n.type === 'CallExpression' || isKcTag(n)) return true;
  if (n.type === 'TemplateLiteral') return n.expressions.length === 0;
  if (n.type === 'ConditionalExpression') return safeSink(n.consequent) && safeSink(n.alternate);
  if (n.type === 'LogicalExpression') return safeSink(n.left) && safeSink(n.right);
  if (n.type === 'BinaryExpression' && n.operator === '+')
    return plusLeaves(n).every((x) => safeSink(x) && !isKcValue(x));
  return false;
}
/** A value inside a handler attribute may be kcArg(…), a number, or a choice between constants. */
function safeHandlerValue(node: Expression): boolean {
  const n = bare(node);
  if (isCallTo(n, ['kcArg'])) return true;
  if (n.type === 'Literal')
    return typeof n.value === 'number' || (typeof n.value === 'string' && /^[\w.]*$/.test(n.value));
  if (n.type === 'ConditionalExpression') return safeHandlerValue(n.consequent) && safeHandlerValue(n.alternate);
  return false;
}

/** Each node inside `node` (itself included), depth first; `stop` keeps a node's insides out. */
function* nodesIn(node: unknown, stop: (n: SyntaxNode) => boolean = () => false): Generator<SyntaxNode> {
  if (!isNode(node) || stop(node)) return;
  yield node;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    for (const child of Array.isArray(value) ? value : [value]) yield* nodesIn(child, stop);
  }
}
/** Whether a kcHtml value calls an escaper, not counting a kcHtml inside it (checked on its own). */
const callsEscaper = (node: Expression): boolean =>
  [...nodesIn(node, isKcTag)].some((n) => isCall(n) && n.callee.type === 'Identifier' && ESCAPERS.has(n.callee.name));
const containsKc = (node: SyntaxNode): boolean => [...nodesIn(node)].some(isKcValue);

/** The node holding `node`, past any type assertion around it. */
function holder(node: Rule.Node): SyntaxNode | null {
  let at: Rule.Node | null = node.parent;
  while (at !== null && TYPE_WRAPPERS.has(at.type)) at = at.parent;
  return at;
}
const isPlus = (node: SyntaxNode | null): boolean =>
  node !== null && node.type === 'BinaryExpression' && 'operator' in node && node.operator === '+';

const squashed = (code: string) => code.replace(/\s+/g, '');

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Refuse HTML built other than through kcHtml and kcEsc.' },
    messages: {
      template:
        'A template with markup and a value in it builds HTML from a plain string, so a name with markup in it ' +
        'becomes markup. Tag it kcHtml.',
      concat:
        'Markup joined with + to a value that is not escaped: a name with markup in it becomes markup. Build it ' +
        'with kcHtml.',
      sink:
        'This puts a value into the page as HTML. Give it a constant, kcHtml, a variable or a call, not a ' +
        'property read or an untagged template.',
      plus:
        'kcHtml joined with +, += or .join() makes a plain string, which the next kcHtml escapes again, so the ' +
        'markup shows as text. Put the kcHtml, or the list of them, inside a kcHtml instead.',
      twice:
        'kcHtml escapes every value itself: an escaper inside it escapes the text twice, so & shows as &amp;. ' +
        'Put the value in as it is.',
      handler:
        'A value inside an on…="…" attribute must be kcArg(…) or a constant, so a name with a quote in it cannot ' +
        'become code.',
      unusedException:
        'The exception for the {{check}} check with "{{code}}" matches nothing in this file: take it out of ' +
        'HTML_EXCEPTIONS (eslint.config.js).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          exceptions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                check: { enum: [...CHECKS] },
                code: { type: 'string', minLength: 1 },
                reason: { type: 'string', minLength: 1 },
              },
              required: ['file', 'check', 'code', 'reason'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const file = path.relative(context.cwd, context.filename).split(path.sep).join('/');
    const exceptions = Options.parse(context.options[0]).exceptions.filter((e) => e.file === file);
    const used = new Set<number>();
    const add = (check: Check, node: Rule.Node | Expression) => {
      const code = squashed(context.sourceCode.getText(node));
      const i = exceptions.findIndex((e) => e.check === check && code.includes(squashed(e.code)));
      if (i >= 0) used.add(i);
      else context.report({ node, messageId: check });
    };
    /** A + chain, or the right of a +=, joining markup to a value not escaped, or joining kcHtml. */
    const joined = (node: Rule.Node, leaves: Expression[]) => {
      if (leaves.some(hasMarkup) && !leaves.every(safePiece) && !leaves.some(isKcValue)) add('concat', node);
      if (leaves.some(isKcValue)) add('plus', node);
    };
    return {
      TemplateLiteral(node) {
        const parent = node.parent;
        const tagged = isKcTag(parent) && parent.quasi === node;
        const text = node.quasis.map((q) => q.value.cooked ?? '').join('');
        if (node.expressions.length > 0 && !tagged && MARKUP.test(text)) add('template', node);
      },
      TaggedTemplateExpression(node) {
        if (!isKcTag(node)) return;
        let text = '';
        node.quasi.expressions.forEach((e, i) => {
          text += node.quasi.quasis[i]?.value.cooked ?? '';
          if (HANDLER_OPEN.test(text) && !safeHandlerValue(e)) add('handler', e);
          if (callsEscaper(e)) add('twice', e);
          text += '0';
        });
      },
      BinaryExpression(node) {
        if (node.operator === '+' && !isPlus(holder(node))) joined(node, plusLeaves(node));
      },
      AssignmentExpression(node) {
        if (node.operator === '+=') joined(node, plusLeaves(node.right));
        const left = node.left;
        if (left.type === 'MemberExpression') {
          const name = propertyName(left);
          if (name !== null && SINK_PROPS.has(name) && !safeSink(node.right)) add('sink', node);
        }
      },
      CallExpression(node) {
        const name = calleeName(node);
        const callee = bare(node.callee);
        const object = callee.type === 'MemberExpression' ? bare(callee.object) : null;
        if (name === 'join' && object !== null && calleeName(object) === 'map' && containsKc(object)) add('plus', node);
        const sinkValue =
          name === 'insertAdjacentHTML'
            ? node.arguments[1]
            : (name === 'write' || name === 'writeln') && object?.type === 'Identifier' && object.name === 'document'
              ? node.arguments[0]
              : undefined;
        if (sinkValue !== undefined && !safeSink(sinkValue)) add('sink', node);
      },
      'Program:exit'() {
        exceptions.forEach((e, i) => {
          if (!used.has(i))
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'unusedException',
              data: { check: e.check, code: e.code },
            });
        });
      },
    };
  },
};

export default rule;
