// kc/big-tables-and-profiles-are-read-by-named-columns (plan P1-13, Decision 8; it replaces
// tests/profiles-columns.test.js). A page reads the big tables, games, game_players and turn_logs, and the players'
// profiles, by naming the columns it needs:
// - every column (`*`, or `.select()` with no list, as after an insert) of a big table sends the saved game state and
//   every report with it (docs/traps.md, "select('*') on big tables");
// - every column of profiles, or its email, is refused by the database once the email column's privilege is taken
//   away, even for your own row, and no page shows another player's email (P0-31, ruling D-08).
// Read from `sb.from('<table>')…select('<columns>')`, a chain written in one expression with the table and the columns
// as plain strings, and from a resource embedded in the columns (`games(*)`, `profiles(name, email)`). A table or a
// list of columns held in a variable isn't read. The reads that were already there when the rule came in are in
// eslint-suppressions.json, for P1-17's access layer to take out.
import type { Rule } from 'eslint';

// The syntax tree's types, as ESLint's own types give them (ESTree's).
type CallExpression = Parameters<NonNullable<Rule.RuleListener['CallExpression']>>[0];
type MemberExpression = Extract<CallExpression['callee'], { type: 'MemberExpression' }>;
type Argument = CallExpression['arguments'][number];

const BIG_TABLES = new Set(['games', 'game_players', 'turn_logs', 'profiles']);

/** A string the code spells out: a string literal, or a template with nothing interpolated. */
function plainString(node: Argument | undefined): string | null {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? null;
  return null;
}

/** The table a `.select` reads: the `.from('<table>')` further down its own chain, if it names one. */
function tableOf(select: MemberExpression): string | null {
  let at: MemberExpression['object'] = select.object;
  while (at.type === 'CallExpression' && at.callee.type === 'MemberExpression') {
    const callee: MemberExpression = at.callee;
    if (!callee.computed && callee.property.type === 'Identifier' && callee.property.name === 'from')
      return plainString(at.arguments[0]);
    at = callee.object;
  }
  return null;
}

interface Read {
  table: string;
  columns: string[];
}

/** The top-level items of a PostgREST column list, split on the commas outside parentheses. */
function items(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out.filter((s) => s !== '');
}

/** The table read and its columns, and each resource embedded in them (`alias:table!hint(columns)`), in order. */
function readsOf(table: string, list: string): Read[] {
  const columns: string[] = [];
  const embedded: Read[] = [];
  for (const item of items(list)) {
    const open = item.indexOf('(');
    if (open < 0 || !item.endsWith(')')) {
      columns.push(item);
      continue;
    }
    const head = item.slice(0, open).trim();
    const name = (head.split(':').pop() ?? '').split('!')[0]?.trim() ?? '';
    embedded.push(...readsOf(name, item.slice(open + 1, -1)));
  }
  return [{ table, columns }, ...embedded];
}

/** A column item's own name: `alias:column::cast` → column. */
const columnName = (item: string): string => ((item.split('::')[0] ?? '').split(':').pop() ?? '').trim();

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Read games, game_players, turn_logs and profiles by named columns, never email.' },
    messages: {
      bare:
        '.select() with no list of columns reads every column of {{table}}: name the columns this page needs ' +
        '(docs/traps.md, "select(\'*\') on big tables").',
      star:
        "'{{columns}}' reads every column of {{table}}: name the columns this page needs " +
        '(docs/traps.md, "select(\'*\') on big tables").',
      email:
        "No page reads profiles' email (P0-31, ruling D-08): the database refuses it, and no player may see another's.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'select') return;
        const table = tableOf(callee);
        if (table === null) return;
        if (node.arguments.length === 0) {
          if (BIG_TABLES.has(table)) context.report({ node, messageId: 'bare', data: { table } });
          return;
        }
        const list = plainString(node.arguments[0]);
        if (list === null) return;
        // One finding a read, naming every big table it reads every column of.
        const reads = readsOf(table, list).filter((r) => BIG_TABLES.has(r.table));
        const everyColumn = [
          ...new Set(reads.filter((r) => r.columns.some((c) => columnName(c) === '*')).map((r) => r.table)),
        ];
        if (everyColumn.length > 0)
          context.report({ node, messageId: 'star', data: { table: everyColumn.join(' and '), columns: list } });
        if (reads.some((r) => r.table === 'profiles' && r.columns.some((c) => columnName(c) === 'email')))
          context.report({ node, messageId: 'email' });
      },
    };
  },
};

export default rule;
