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
- **A mark the page writes on an element of its own** (the map popup's `_sticky`, the icon bar's `_built`) is read and
  written through `Reflect.get(el, '_sticky')` and `Reflect.set(el, '_sticky', true)`: the same property on the same
  element, which no DOM type declares.
- **An element found or made** (`let tt = getElementById(…); if (!tt) { tt = createElement(…); … }`) that closures
  read later is read into a `const` once it is sure (`const tt = ttFound;`): a `let` loses its narrowing in a closure.
- **`svg g[…]` read for its `ownerSVGElement`** is filtered by `instanceof SVGElement`, which keeps every `<g>` an SVG
  holds (`highlightMapProv`).
- **A field's value written on an element of no kind the code checks** (`ex.value = v`, where the code tells a
  `<select>` by its `tagName` only) is `Reflect.set(ex, 'value', v)`: the same setter, with the same value, on an
  element of any kind (`refreshLaterCastSpells`, `pre-orders.ts`).
- **`querySelectorAll` by a class the page gives one kind** (`.bo-sel`, each a `<select>`), read for that kind's field,
  is filtered by that kind (`s instanceof HTMLSelectElement`): it keeps every element the page writes with the class.
- **A node's parent read for its text** (`b.parentNode.textContent`) goes through a reader that throws, for none, the
  `TypeError` the read threw (`theParentOf`); its `textContent || ''` is `?? ''` (it is words or `null`).

## Writing into the page

- **`el.innerHTML = kcHtml\`…\``** is `el.innerHTML = String(kcHtml\`…\`)`: the setter writes the marked value by its
  `toString`, which is what `String` calls; the HTML lint rule accepts a call there.

## Events and promises

- **A click's target's tag** (`e.target.tagName === 'A'`) is read through a reader typed `unknown` that throws for a
  `null` target, as the read did, and gives `undefined` for a target that isn't an element (`theTagOfWhatWasClicked`,
  `src/rulebook/toc.ts`).
- **A click's target handed to `contains`** goes through a reader that gives a node or `null` as it is and throws, for
  any other target, the `TypeError` `contains` threw (`theNodeClicked`, `map.ts`).
- **A promise the page starts and never awaits** (the player page's start, `kcDbGuard(…).then(…)`) is written
  `void kcDbGuard(…).then(…)`: the same promise, its rejection still unhandled (lint's `no-floating-promises`).
- **A `catch` callback** takes its error as `unknown` (lint's `use-unknown-in-catch-callback-variable`); `'…' +
  err.message` reads the message through `Reflect.get(Object(err), 'message')`, in words, after a check that throws for
  `null` or `undefined` as the read did (`theMessageOf`, `src/ui/player/start.ts`).

- **An `async` function that awaits nothing** (a page global no caller awaits: Resubmit) is a plain function (lint's
  `require-await`): its promise was read by nobody, and its body throws only where the page holds none of an element
  every screen holds.

## The page's globals

- **A page global a freed file writes into** (the pre-order cards add their placeholders to the report's heroes, and the
  heir's fields write his name and temper) is typed with that field writable (`TheReportAsThePreOrderCardsHoldIt`'s
  `characters`, P1-16g): a reader's `readonly` type still takes it.

- **A page global a typed file tests for none** (`diploChoices`, which the forecasts test with `typeof … === 'object'`)
  keeps `| null` in its type; a file that reads it unguarded reads it through a reader that throws a `TypeError` for
  `null`, as the read did (`theDiplomaticChoices`, `map-symbols.ts`), and `delete table[key]` on it is
  `Reflect.deleteProperty(table, key)` (lint's `no-dynamic-delete`): the same key taken off a plain object.
- **A page global a freed file reads with a type** (`currentReport`, `discoveryChoices`) is typed in
  `src/globals.d.ts`, where every page global is declared: the report as the most-derived of its typed readers' types
  (`TheReportAsTheMapDrawsIt` since P1-16e, every part optional; `viewingReport` the same), a record by words as
  `Partial<Record<string, unknown>>`, a seat as the fields its reader reads (`currentGamePlayer`: its id and its orders).
  A global read only by files that keep their line stays `PageState`. A derived report type may make a field its base
  leaves optional sure only where the base already does (the map's province keeps the forecasts' `row`, `col`); a guard
  on it reads it through `asItsGuardReadsIt`, which the player page takes from `src/shared/`.
