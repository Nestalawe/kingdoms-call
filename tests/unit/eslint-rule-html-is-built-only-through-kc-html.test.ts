// kc/html-is-built-only-through-kc-html (tools/eslint-rules/; plan P1-13, Decision 8), the rule that replaced
// tests/html-lint.test.js: a page builds HTML only through kcHtml and kcEsc (P0-19). Each of its six checks refuses
// what the old test refused (an untagged template with markup, markup joined to a value not escaped, a sink given a
// property read, kcHtml joined, an escaper inside kcHtml, a handler value that isn't kcArg), and lets through what it
// let through; a type assertion counts as the value it wraps, as the old test read a module with its types stripped.
// A reviewed exception lets one finding through, and one that matches nothing is a finding. Where the rule runs
// (src/, public/, the templates' scripts) is tests/static/harness.test.ts's and the templates' test's.
// Level 1 (unit): ESLint's RuleTester runs the rule's code on snippets, which a static test, running nothing, can't.
import path from 'node:path';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, test } from 'vitest';
import rule from '../../tools/eslint-rules/html-is-built-only-through-kc-html.ts';

RuleTester.describe = describe;
RuleTester.it = test;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const typescript = { parser: tseslint.parser };
const errors = (...messageIds: string[]) => messageIds.map((messageId) => ({ messageId }));
const filename = path.join(process.cwd(), 'src/ui/x.ts');
const exception = (check: string, code: string, file = 'src/ui/x.ts') => [
  { exceptions: [{ file, check, code, reason: 'a reason' }] },
];

tester.run('kc/html-is-built-only-through-kc-html', rule, {
  valid: [
    // kcHtml, kcEsc and constants
    'el.innerHTML = kcHtml`<b>${name}</b>`;',
    "const s = '<td>' + kcEsc(name) + '</td>';",
    "const s = '<td>' + (on ? 'yes' : 'no') + '</td>' + 3;",
    "const s = '<br>' + '<hr>';",
    'const s = `<b>bold</b>`;',
    'const s = `Hello ${name}`;',
    "const s = 'Hello ' + name;",
    // a sink given a constant, kcHtml, a variable, a call, or a choice between those
    "el.innerHTML = '';",
    'el.innerHTML = html;',
    'el.innerHTML = rows(list);',
    'el.outerHTML = ok ? kcHtml`<b>${a}</b>` : fallback;',
    'el.innerHTML = cached || build();',
    "el.innerHTML = '<p>' + kcEsc(note) + '</p>';",
    "el.insertAdjacentHTML('beforeend', kcHtml`<li>${name}</li>`);",
    "document.write('<p>loading</p>');",
    'el.textContent = g.name;',
    // a kcHtml put inside kcHtml, a list of them, and joins that hold no kcHtml
    'const s = kcHtml`<ul>${items.map((i) => kcHtml`<li>${i.name}</li>`)}</ul>`;',
    "const s = names.map((n) => n.trim()).join(', ');",
    // a handler's value: kcArg, a number, a constant, or a choice between them
    'const s = kcHtml`<button onclick="pick(${kcArg(id)})">${name}</button>`;',
    'const s = kcHtml`<button onclick="pick(${3})">x</button>`;',
    "const s = kcHtml`<button onclick=\"${on ? 'show' : 'hide'}()\">x</button>`;",
    'const s = kcHtml`<button title="${name}" onclick="go()">x</button>`;',
    // comments and strings
    '// el.innerHTML = g.name;\nconst s = "el.innerHTML = g.name";',
    // TypeScript: a type assertion counts as the value it wraps
    { code: 'el.innerHTML = (kcHtml`<b>${name}</b>` as unknown as string);', languageOptions: typescript },
    { code: 'el.innerHTML = html!;', languageOptions: typescript },
    { code: "const s: string = '<td>' + kcEsc(name as string) + '</td>';", languageOptions: typescript },
    { code: 'type T = `<b>${string}</b>`;', languageOptions: typescript },
    // a reviewed exception: its finding is let through
    {
      code: "const re = new RegExp('(?<![A-Z])(' + names.join('|') + ')');",
      filename,
      options: exception('concat', "'(?<![A-Z])('  +  names.join('|')"),
    },
  ],
  invalid: [
    // template
    { code: 'const s = `<b>${name}</b>`;', errors: errors('template') },
    { code: 'f(`<a href="${url}">x</a>`);', errors: errors('template') },
    { code: 'const s = other`<b>${name}</b>`;', errors: errors('template') },
    // concat
    { code: "const s = '<td>' + name + '</td>';", errors: errors('concat') },
    // the += and the + inside it, each
    { code: "s += '<li>' + g.name;", errors: errors('concat', 'concat') },
    { code: "el.innerHTML = '<p>' + note + '</p>';", errors: errors('concat') },
    { code: "const s = '<td>' + (on ? name : 'no') + '</td>';", errors: errors('concat') },
    // sink
    { code: 'el.innerHTML = g.name;', errors: errors('sink') },
    { code: 'el.innerHTML += e.message;', errors: errors('sink') },
    { code: 'el.outerHTML = `<b>${name}</b>`;', errors: errors('sink', 'template') },
    { code: "el.insertAdjacentHTML('beforeend', g.name);", errors: errors('sink') },
    { code: 'document.write(e.message);', errors: errors('sink') },
    { code: 'document.writeln(g.name);', errors: errors('sink') },
    { code: 'el.innerHTML = ok ? html : g.name;', errors: errors('sink') },
    { code: "el.innerHTML = kcHtml`<b>${a}</b>` + '';", errors: errors('sink', 'plus') },
    // plus
    { code: 'const s = kcHtml`<b>${a}</b>` + kcHtml`<i>${b}</i>`;', errors: errors('plus') },
    { code: 's += kcHtml`<li>${a}</li>`;', errors: errors('plus') },
    { code: "const s = list.map((x) => kcHtml`<li>${x}</li>`).join('');", errors: errors('plus') },
    { code: "const s = kcRaw('<br>') + name;", errors: errors('plus') },
    // twice
    { code: 'const s = kcHtml`<b>${kcEsc(name)}</b>`;', errors: errors('twice') },
    { code: 'const s = kcHtml`<b>${esc(g.name).trim()}</b>`;', errors: errors('twice') },
    { code: 'const s = kcHtml`<b>${on ? escapeHtml(a) : b}</b>`;', errors: errors('twice') },
    // a kcHtml inside kcHtml is checked on its own
    { code: 'const s = kcHtml`<b>${kcHtml`<i>${kcEsc(x)}</i>`}</b>`;', errors: errors('twice') },
    // handler
    { code: 'const s = kcHtml`<button onclick="pick(${id})">x</button>`;', errors: errors('handler') },
    { code: 'const s = kcHtml`<a onmouseover=\'show("${name}")\'>x</a>`;', errors: errors('handler') },
    { code: "const s = kcHtml`<b onclick=\"go('${'a b'}')\">x</b>`;", errors: errors('handler') },
    {
      code: 'const s = kcHtml`<b onclick="pick(${kcEsc(id)})">x</b>`;',
      errors: errors('handler', 'twice'),
    },
    // TypeScript: the same faults, through a type assertion
    { code: 'el.innerHTML = (g.name as string);', languageOptions: typescript, errors: errors('sink') },
    { code: "const s = '<td>' + (name as string) + '</td>';", languageOptions: typescript, errors: errors('concat') },
    { code: 'const s = (kcHtml`<b>${a}</b>` as string) + x;', languageOptions: typescript, errors: errors('plus') },
    { code: 'el.innerHTML = g!.name!;', languageOptions: typescript, errors: errors('sink') },
    // an exception lets only its own finding through, and one that matches nothing is a finding
    {
      code: "const s = '<td>' + name + '</td>';\nconst t = '<td>' + other + '</td>';",
      filename,
      options: exception('concat', "'<td>' + name"),
      errors: [{ messageId: 'concat', line: 2 }],
    },
    {
      code: "const s = '<td>' + name + '</td>';",
      filename,
      options: exception('sink', "'<td>' + name"),
      errors: [{ messageId: 'unusedException' }, { messageId: 'concat', line: 1 }],
    },
    {
      code: "const s = '<td>' + name + '</td>';",
      filename,
      options: exception('concat', "'<td>' + name", 'src/ui/y.ts'),
      errors: errors('concat'),
    },
    {
      code: 'const s = 1;',
      filename,
      options: exception('concat', "'<td>' + name"),
      errors: [{ messageId: 'unusedException', line: 1 }],
    },
  ],
});
