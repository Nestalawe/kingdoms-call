# The forms that keep a value: the page's elements and events

How a file is freed, and what its ts-nocheck line checks: [freeing a file](freeing-a-file-of-its-ts-nocheck-line.md).
Each form below keeps every value the old statement gave, on every page the tours and the browser specs show; a form a
row needs that isn't here is added under its kind. P1-16c started this file.

## Elements looked up

- **An element the page always holds** (the rulebook's contents list, the player page's spinner), read without a check
  (`document.getElementById('toc').addEventListener(…)`), is read through `theElementWithTheId(id, Kind)`
  (`src/ui/shared/the-pages-element-with-the-id.ts`; plan P1-16, Open choice 2), with the kind the code reads it as
  (`HTMLElement`, `HTMLInputElement`, …). A missing element still stops the code there, with a `TypeError` that names
  the id, as a property read on `null` did; one of another kind stops it too, which no page meets (the tours run every
  such lookup). Read once where the old code first read it: the throw moves no earlier than the first statement the
  missing element would have stopped.
- **An element the code checks for** (`if (!wrap || !hidden) return;`) keeps its check and its `getElementById`: its
  absence is a case the code meets. Where the code then writes a field of a kind (`hidden.value = …`), the check names
  the kind: `if (!wrap || !(hidden instanceof HTMLInputElement)) return;`, where the page writes that element as that
  kind beside the other (the Hunting Rumours' and the Equip order's hidden `<input>` inside its wrap, the pre-battle
  magic's hidden `<input>`).
- **`querySelectorAll` of a selector that names one kind** (`'input[type=checkbox]'`), read for that kind's fields
  (`b.checked`), is filtered by it: `[...wrap.querySelectorAll('input[type=checkbox]')].filter((b) => b instanceof
  HTMLInputElement)`, which keeps every element the selector finds.
- **A field's value read off an element of no kind the code checks** (`document.getElementById(id)?.value`, the Move
  order's action) is `el ? theValueOfAField(el) : undefined` (`'value' in el ? el.value : undefined`, in
  `the-orders-the-form-holds-handed-to-its-forecasts.ts`): the same value for an element of any kind, none included.
- **A node's parent read for its text** (`b.parentNode.textContent`) goes through a reader that throws, for none, the
  `TypeError` the read threw (`theParentOf`); its `textContent || ''` is `?? ''` (it is words or `null`).

## Writing into the page

- **`el.innerHTML = kcHtml\`…\``** is `el.innerHTML = String(kcHtml\`…\`)`: the setter writes the marked value by its
  `toString`, which is what `String` calls; the HTML lint rule accepts a call there.

## Events and promises

- **A click's target's tag** (`e.target.tagName === 'A'`) is read through a reader typed `unknown` that throws for a
  `null` target, as the read did, and gives `undefined` for a target that isn't an element (`theTagOfWhatWasClicked`,
  `src/rulebook/toc.ts`).
- **A promise the page starts and never awaits** (the player page's start, `kcDbGuard(…).then(…)`) is written
  `void kcDbGuard(…).then(…)`: the same promise, its rejection still unhandled (lint's `no-floating-promises`).
- **A `catch` callback** takes its error as `unknown` (lint's `use-unknown-in-catch-callback-variable`); `'…' +
  err.message` reads the message through `Reflect.get(Object(err), 'message')`, in words, after a check that throws for
  `null` or `undefined` as the read did (`theMessageOf`, `src/ui/player/start.ts`).

## The page's globals

- **A page global a typed file tests for none** (`diploChoices`, which the forecasts test with `typeof … === 'object'`)
  keeps `| null` in its type; a file that reads it unguarded reads it through a reader that throws a `TypeError` for
  `null`, as the read did (`theDiplomaticChoices`, `map-symbols.ts`), and `delete table[key]` on it is
  `Reflect.deleteProperty(table, key)` (lint's `no-dynamic-delete`): the same key taken off a plain object.
- **A page global a freed file reads with a type** (`currentReport`, `discoveryChoices`) is typed in
  `src/globals.d.ts`, where every page global is declared: the report as the most-derived of its typed readers' types
  (`TheReportAsThePagesListsReadIt`, every part optional), a record by words as `Partial<Record<string, unknown>>`. A
  global read only by files that keep their line stays `PageState`.
