# The forms that keep a value: guards, parameters and types

How a file is freed, and what its ts-nocheck line checks: [freeing a file](freeing-a-file-of-its-ts-nocheck-line.md).
Each form below keeps every value the old statement gave; a form a row needs that isn't here is added under its kind.

## Guards and the compiler's narrowing

- **A guard on a value the code has made sure** (`if (!x) return;` after a read through `?.`) is added where the
  compiler can't see it; it changes no value. A guard lint calls needless is dropped only where the code would already
  have thrown without it.
- **A value guarded in one place and read unguarded in another** (a fight's narrative, a foe, a fighter's hero) keeps
  its type, and the guarded reads go through `asItsGuardReadsIt(value)` (in `rules-on-plain-values/`). A guard
  on a field the schema requires stays where an untyped caller may still leave it out; so does one on a field a database
  function's generated type makes sure while its column may hold `null` (`gm_reported_messages`' `turn`): the callback
  that reads it takes the row as its table holds it (`AReportedDispatchAsItsTablesHoldIt`).
- **A `const` typed as a wide list is narrowed by its value** (`const l: readonly Army[] | null | undefined =
  hero.armies` is `Army[]`): type the object instead (`const h: AHeroAsEarlyWinterReadsHisArmies = hero`, his `armies`
  optional), or a callback's parameter; an object's optional field isn't narrowed away.
- **A state the code tests, then hands to a call that changes it** (a fight's state: an action sets who fled, a spell
  conjures a Mirror Image) is read again through a reader typed as the state is kept (`theFightAsItIsNow`), so a test
  after the call isn't read as always false; so is a province's owner after a battle and its bookkeeping
  (`theOwnerAsItIsNow`), and a hero's life or a province's battle after a battle or a fight (`whetherHeLivesNow`,
  `whetherItsBattleIsUnresolvedNow`).
- **A flag read into a `const` that a later branch reads with its element** (a march locked in a contested province, and
  the province's name) is `x !== undefined && Boolean(x.flag)`: the compiler narrows `x` where the `const` is true, and
  the value is `!!(x && x.flag)`'s, a truthy flag that isn't `true` included.
- **A `let` set inside a `forEach` callback** is still its first value to the compiler: a `for … of` over the same list,
  `continue` for the callback's `return`; or, where it is handed back, the function's return type written.
  A `let` set in a loop inside a `while` may still read as its first value (`null`: the frontier's best, P1-10b41):
  one `const` object holding it (`best.id`, `best.oc`) is read as its declared type.
  One set inside a `forEach` callback reads as `null` after the call too: the callback is a `for … of` loop, its
  `return` a `continue` (the same calls in the same order: the feint's foe, P1-10b42).
- **A table's element made sure by a key that is a field** (`if (!G.turnOrders[h.id]) …; G.turnOrders[h.id][p]`)
  is read by a plain `const` key (`const hiredsId = h.id`), and `if (!x) x = []` on it is `x ??= []`, which narrows.
- **A branch the check above makes dead** (`h.player === null ? wage : h.pay || 1` after a check that every hired
  hero is a wanderer) is dropped: lint refuses the always-true test, and the value is the same. One whose text a
  static test reads (the march's `'move'` strings) stays, its test read through `asItsGuardReadsIt`, and so does one a
  vm test stages (`typeof asItsGuardReadsIt(nextHeroName) === 'function'`: an engine with no name-giver names the heir
  "Heir of …"); an `if (false) {}` before an `else if` goes, its comment kept. A `??` after a field a typed callee always
  sets (a standing's `index ?? pi ?? -1`) goes: the value is the field's.
- **A part the view hands only where it sees it** (a province's garrison) goes through a check that throws for none;
  a field added to a built object, through `Object.assign`.
- **A value read back from a table just after it is written there by a key** (`p.exploredBy[i] = x; p.explored =
  p.exploredBy[i]`) is the `const` written, read again (`mappedNow`): the same number. An element just read into a
  `const` and written back spread is spread from the `const` (`{ ...allyOrder, _unifiedWith }`): the same object read.
- **An arrow whose body is a call that gives nothing** (lint's `no-confusing-void-expression`: `(pv) => emit(…)`) gets
  braces, `(pv) => { emit(…); }`: the same call, and the callback still gives `undefined`.
- **A value a closure reads later** (`pcDeferEffect`'s rider) is read into a `const` before it, so the test before it
  narrows it inside too. A table read by the same key several times is read once into a `const`.
- **A `try` whose `catch` gave a value where a missing element threw** checks for none first inside the `try`, with
  the same value (`if (!g) return 0;`, `takeBestGrave`).
- **Arguments a function never reads, after the ones it reads** (a closure handed the winner's force and the winner
  beside the loser's), are dropped from the call where each is a plain read: the same call, the same values. A last
  parameter no caller hands and the body never reads (a hero's merit's `ctx`) goes from the signature, and so does one
  every caller hands that the body never reads (the spells' target field's sixth), with a comment saying so.
- **A value read by nothing, kept alive by `void x;`** (lint's `no-meaningless-void-operator`) or held by a `const`
  nobody reads (lint's `no-unused-vars`): a pure one goes (a count, a product, a name destructured and never read); one
  a call gives keeps the call as a bare statement (`effStat(…);`, `armyTotalStr(…);`), its reads and writes as they
  were. One whose read can throw (the cast plan's known dead, on a world of no players' list) is read in a
  function called as a bare statement (`theKnownDeadOf(G, pi);`): the same throw, nothing else. A flag a stand-in may leave out (`c.alive === false`) is read `asItsGuardReadsIt(c.alive) === false`.
- **A value the code has made sure, read for a field after a test that may skip the read** (`kb === ka || b.tier !==
  a.tier`, a lair's one item) goes through its check where the field is read (`madeSureByTheStocking(b).tier`), not
  where the element is read: a test before it that skips the read keeps its value, and only the read the old code made
  throws. A call whose typed callee takes a realm's index, made for a hero who may serve none, is made only for a
  realm's hero where the callee does nothing at `G.players[null]` (`if (c.player !== null) recordDeadHeroSighting(…)`).
- **A list indexed by a key that may be missing** (`G.world.provinces[c._attackedFrom]`) is `k === undefined ?
  undefined : list[k]`; where a staged world may lack the list itself (a realm of no home), `list[k ?? -1]` keeps the
  read and its throw (no list holds a `-1` element, nor an `undefined` one: P1-10b41's case failed on the first form); a record by words indexed by a realm's index that may be `null` is `table?.[String(n)]`, as
  JavaScript reads `table[null]`.
- **A `let` that a `try` and its `catch` (or its `finally`) always set** is declared with its type and no first value
  (`let base: number;`): the compiler sees it set after them, and lint's `no-useless-assignment` no longer finds a first
  value nobody reads. A `catch (e)` whose `e` is unread is `catch {`; an empty one holds a comment saying why
  (`// the statistics never stop a hero's death`), which lint's `no-empty` asks for. A `let` set once after its unread
  first value is a `const` where it is set (the Stone's `already`).
- **A `catch` that writes what was thrown into its own error's words** (`${(e && e.message) || e}`) reads the message
  through `Reflect.get(Object(e), 'message')` into an `unknown`, else `e` itself, then `String()` (`theWordsOfWhatWasThrown`,
  `run-turn.ts`): an object thrown with a message, and an error of another realm's class (a test's `vm`), keep their
  words, which `e instanceof Error` would not. The error it throws carries `{ cause: e }` (lint's
  `preserve-caught-error`): its words are the same.
- **A rule's switch that holds one value today** (`ARCHERY_PARTING_SHOT = true`) is typed by an alias of `boolean`, so
  its test still reads it.

- **A reader of any value as a list** (`Array.isArray(v) ? v : []`, the Dispatches' `_msgArr`), handed typed lists
  and values of any kind, keeps a typed list's element type by an overload (`<Item>(v: readonly Item[] | null |
  undefined): readonly Item[]`, then `(v: unknown): readonly unknown[]`): one body, the same value.

- **A parameter set to its own default that callbacks read** (`hooks = hooks || {}`, then `hooks.duelSim` in a
  `forEach`) is a `const` of the old name set from the parameter renamed (`const hooks = hooksHanded ?? {};`): a
  callback keeps a `const`'s narrowing, not a reassigned parameter's. **`list.filter(p)[0]`** (lint's `prefer-find`)
  is `list.find(p)`, the same first element or `undefined`, where `p` changes nothing.

- **`typeof f === 'function' ? f(…) : …` on a function its own module declares** (the order form's forecasts, from when the
  page's files were scripts) is the call: the test always held, and lint refuses it.

- **`typeof f === 'function'` on a function the file imports** (`unitEmoji`, `refreshAllMoveModeNotes`) always holds:
  the call alone, as lint's `no-unnecessary-condition` asks.
- **A value a `forEach` callback finds** (`heroData = h`, two loops deep) is kept in a holder (`{ hero: null }`) read
  after the loops: the compiler forgets what a callback sets in a `let`; the same callbacks run in the same order.
- **`{}` handed where a typed hero is needed** (`find(…) || list[i] || {}`) is an object whose `id` reads `undefined`
  and isn't its own enumerable field (`theEmptyHero`, `pre-orders.ts`): every read the field makes gives what `{}` gave.

## Parameters, shapes and claims

- **An object the code builds whose ids are plain numbers** (the world's making: a province, a hero, a realm) is typed by a
  local shape with `id`, `owner` and `player` as `number` (the save's ids are branded, P1-10a1). A typed callee it is
  handed to takes the fields it reads (`Pick<Province, …>` and a plain `owner`), not the saved type: types only.
- **A stretch a test cuts out and runs on its own** (`tests/home-placement.test.js`, `statementsBetween`) calls only what
  the stretch declares: a check it needs is a `function` declared inside it, not an arrow with a type parameter, which a
  `.js` parse reads as JSX.
- **A parameter is typed from what its callers pass and as wide as the body's guards**, by what the function reads,
  not the schema's whole type: an interface beside it ("the state as these read it"), each field a guard tests
  optional, a plain `number` where the schema has a brand. A function that reads only the state takes
  `Pick<TurnContext, 'G'>`; one that reads part of the state through the context, `const { G }: { readonly G:
  TheStateAsEarlyWinterReadsIt } = turnContext`. A typed callee's parameter type its file doesn't export is
  `Parameters<typeof callee>[0]`.
- **The turn's marks an order writes that the schema lacks** (a Curse's levels taken, a Clairvoyance's watchers, Part
  Sea's waters) are typed on a local shape beside it, built on the battle's (`AHeroAsTheCastMarksHim` from
  `HeroInABattle`), and the state is read through `Omit<GameState, …> & { … }` with its heroes and provinces so marked,
  a guarded list optional and the turn's lists added (`TheStateAsTheCastReadsIt`).
- **A shape whose fields are all optional** is refused for a value that has none of them (TypeScript's weak-type
  check): type it `object & { … }`. A fighter's `ref` is a hero or a guardian: a hero's fields are read through a
  reader typed `object & { … }` with only the fields read, so the guardian passes.
- **A field the code tests with `typeof x !== 'object'` and `Array.isArray` before writing it whole** (a realm's
  grave lore) is typed as wide as those tests: its record, a list (not `readonly`), words, a number, a flag or none
  (`TheGraveLoreAsItsGuardsReadIt`), so each test narrows it to the record.
- **A hero, his realm and his province as processOrder hands them** (`Character`, `Realm | undefined`, `Province |
  undefined`): where the order indexes by his realm, it starts with `servesARealm`'s check, as the Cast Spell order does;
  his realm and his province are made sure by `theRealmIsHanded` and `theProvinceIsHanded` (assertion functions, which
  throw for none), before their first read. Not through a check in the dispatch's call when a test pins the call's
  form (`[^)]*` in the order family's own tests).
- **A guard `c.player == null` before a typed callee that needs his realm's index** (`applyEvilConquest`) is a type
  predicate, `!aHeroOfARealm(c)` (`!= null`), which narrows inside closures too; where his realm is already found by
  that index (`pl`), the call adds `&& aHeroOfARealm(x)`, always true there.
- **Where the body guards a hero who serves no realm** (`c.player != null`), no `servesARealm` check: each read of his
  realm by its index is `c.player === null ? undefined : G.players[c.player]`, as JavaScript reads `G.players[null]`
  (`hisRealm`, the Search; the Spy too, whose body reads his realm both ways). A rest-spread arrow handing its arguments on after the turn's context is typed
  `(...a: AfterTheTurnsContext<typeof f>)`. A field a test's stand-in gives a typed callee's result and the callee never
  does (a pacified fight) is read through a type that adds it, optional (`TheFightAsTheSearchReadsIt`).
- **A target the body turns into words** (`(t || '').toString()`, `String(t)`, `parseInt(t)`) is typed `string | number |
  null | undefined`, so each conversion stays; its `t || ''` is `(t ?? '') || ''`, which turns a `0` into `''` too.
  A phase fallback `ph ?? THE_PHASE_THE_LINE_IS_WRITTEN_IN` whose callers all pass a number goes.
- **A callback that hands every argument on** (`.filter((...a) => isHostileInvasion(tc, ...a))`) to a typed function
  that takes one is handed that one, `(it) => isHostileInvasion(tc, it)`: the others were never read. A call that
  leaves out a typed callee's last parameter passes `undefined` there (`theStatShownAsALineTellsIt(…, 'spy',
  undefined)`), the value it had.
- **A parameter the body never reads** (a callee handed the province and a skill reader it no longer uses) is typed
  `unknown`, with a comment that says so.
- **A field written back by any key** (`real[k] = copy[k]` over `Object.keys(copy)`) is
  `Object.assign(real, { [k]: v })`, `v` read `Reflect.get(copy, k)` into an `unknown`: the same write, which throws
  where a strict assignment would.
- **A result typed as one of the heroes a function was handed** (`resolveDuel`'s winner, a fighter's `ref`, a hero or a
  guardian to the compiler) goes through a check that hands back the one it is (`theDuellistTheFighterIs`), throwing
  for any other; a winner and a loser the callee names together or not at all, through a check that throws for one
  without the other.
- **A result of two kinds told apart by a flag** (an item lifted, or `{ guarded: true }`) is typed so the flag reads on
  both, `(Item & { readonly guarded?: undefined }) | { readonly guarded: true } | null` (`liftRandomItem`): its
  caller's `stolen?.guarded` narrows it, as `stolen && stolen.guarded` read it.
- **A parameter whose kind a flag says** is a rest tuple (`...[army, typeOnly]: [string, true] | [AUnit, false?]`); a
  callback option only one case calls is required only there (`{ won: true } | { won: false; demoteAt }`).
- **A function that reads an old save** takes the old save's shape, every field it reads optional. A function that
  hands back what it was given (`activeItems`) is generic in its type (so is `createTurnContext`, in the state it is
  handed: a test stages part of a world, and `nearestConsecratedProv`, in the provinces: the Divine return writes the one
  it gets); one that adds fields to its argument returns `Object.assign(g, { units,
  total })`, the same object.
- **A type goes in the file whose code it types most** (a file of types alone is in no page's bundle, which
  `tests/static/pages-build.test.ts` refuses): the fighter, `AFighterInAPersonalCombat`, is in `helpers.ts`; the Mirror
  Image, in the combat spells' file. A copy whose id is a string (a Hunting Rumours hero) is `AHeroAsAFightTakesHim`.
- **A save parsed from words** (`JSON.parse` into an `unknown`) is the game's state once the upgrade's first refusal lets
  it through (`refuseASaveThatIsNotAGameInPlay`, an assertion: provinces, realms and a list of heroes); the check after
  the upgrade names where its shape differs, and the turn runs on it as it is. `resolveTurn` makes it first.
- **A claim the compiler can't check is made only through a check that holds it**: a copy made through JSON parses into
  `unknown` and a type predicate holds when `JSON.stringify(copy) === JSON.stringify(original)` (Theo, 2026-10-30); a
  hero handed to a callee that needs his name as words passes a predicate `typeof hero.name === 'string'`; a caster
  passes `servesARealm` (only a hero of a realm acts in a phase), so each `c.player` after it is a realm's index. Each check
  never fails on a sound save, and throws if it does. A typed callee that takes a value its caller may lack (a hero's
  province) gets it through a check that throws for none, named for the invariant that makes it sure.
- **A page's hook the engine reads behind `typeof window`** (the bots' `__botDiag` and `__botHyg`, the purity's
  reviewed exception) is declared on `Window` in the file that reads it (`declare global { interface Window { … } }`),
  each hook optional and typed as the code reads it (`unknown` where it tests `Array.isArray`): the read stays as it is.
- **A copy's id that no hero carries** (the duel forecast's −1 and −2) is typed as a hero's id through a predicate that
  holds what the schema checks (`Number.isFinite`: the brand is a type only), in a reader that throws for none.
- **A hero a fight hands on that a typed callee takes by a number's id** (a fighter's `ref` to `syncMaxHp`) passes an
  assertion that throws for a fight's copy, whose id is words (`theHeroIsNoFightsCopy`: a Hunting Rumours fight is
  simulated, and rolls no rise); a line that needs his name and maximum, a predicate on the line itself
  (`aRiseAsItIsTold`), with the throw beside it.
- **A return type written on a callee that keeps its line** is a claim, checked once that file is freed; write in a
  comment where it doesn't hold. It changes what its other untyped callers give: type their result too, fix the typed
  readers' new findings and prune their cleared suppressions. Freed, a claim that holds only for some values takes
  only those, and reads the value through a check that holds it: `effStat` takes a hero, never none, and reads his
  total through `aHerosSkillAsItIsCounted`, which throws only where `skillBonusBreakdown` counts none (no hero).

- **A row's number read by a dotted path a static test reads** (`ALIGN_ACTIONS['Harvest the Field'].theNumbers.thePrice.value`)
  goes through a reader of the row that hands back its numbers as getters (`theNumbersOfTheRow(row).thePrice.value`): no
  row throws the `TypeError` the read threw, each number is read only where it was, and the text the test reads stays.
- **A page's global its one typed reader hands to typed functions** (`currentReport`, which the forecasts' page side
  hands them) is declared in `src/globals.d.ts` with the type they take, every part optional: its writers, untyped, are
  unchecked, so the type stays a claim until they are freed.

## The types the code corrects

- **A type that disagrees with the code is corrected, not the code**: a fact's field the engine may leave `undefined`
  (the druid's line's channel, a guardian's perk's words) is `string | undefined` in the facts file, and its words read
  it `${String(x)}`; a shared type its readers show too narrow is widened (a fighter's kind may be a Mirror Image's
  phantom), a field the code writes loses its `readonly` (a phase intent's kind, march and destination, which the
  phase's second stage rewrites as a Defend), and one they show too wide is narrowed (a guardian's weakness has its name
  and words). `armyUnitName` takes any unit's type, as a save holds it (a type with no pool of names draws the Guard's),
  and so does a capture's column (`AUnitOfTheColumn`). A hero's id that a function only compares is typed as every
  caller holds it (`effSkillOf`'s: a fight's copy of a Hunting Rumours hero holds it as words). A saved field the code
  writes `|| null` to is nullable in the schema (a spied hero's alignment and race). A typed file's `unknown` field a
  freed file reads takes its callee's return type (the view's titles).
- **A list the saved state holds as `z.unknown()` that a freed file reads** (the parcels on the road, which the Grand
  Heist cuts an item from) gains its element's schema, written from the code that fills it (Send Item's `{ toId, items,
  fromName }`), so long as every save holds the list empty or holds none (the couriers empty it each turn): a save of
  any version still meets it, and no version is bumped. A `refactor-only` row changes no saved shape: there each value
  is narrowed where the code reads it, through a check that hands back what the code fills it with and throws for any
  other (a hero's spectral doubles, `_phantoms`: `theSpectralDoubleStoredThere`, which keeps a gap as it is; the Iron
  Throne's queued rises, `theRiseQueuedThere`).
- **A season's name read by a phase** (`SEASONS[ph]`, a fact's words) goes through `theSeasonOfThePhase`, which throws
  for none (a phase is one of the five seasons): the fact and its prose keep their types.
- **A fact's realm name read by an index** (`G.players[c.player]?.name`) may be `undefined` where the index names no
  realm: the fact's field allows it, and the prose writes it `${String(x)}`, the same words.
- **A saved record the code writes a missing value into** (a realm's memory of a province, its owner's name where the
  index names no realm) is written through a local view of the same record whose field allows `undefined`
  (`AProvinceAsItIsRemembered`): the saved schema is unchanged. So is one the code writes a plain number into where
  the schema holds a brand (a monarch's grave's resting place, `AMonarchsGraveAsItIsWritten`; an heir's id and realm,
  `AnHeirAsTheSuccessionCrownsHim`), one keyed by a closed set that the code fills by any key, or leaves empty (the
  titles' snapshot when the standings fail; a title won by a realm the list doesn't name:
  `TheTitlesRecordAsTheChangesWriteIt`), one written with a callee's result its schema is narrower than (the game's
  end, its standings as `computeStandings` gives them: `TheStateAsTheVictoryWritesIt`), and a hero's field written
  `null` the schema's `optional()` doesn't name (a bot's second role where none ranks: `theSecondRoleWritten`).
- **A constant flag set `false`** (`BOT_SLAYER_FIGHTERS_ONLY`, a choice kept off) is read through a reader typed
  `boolean` (`theSlayersMustFight`): read as it is, lint's `no-unnecessary-condition` calls the test always false.
- **A value parsed from JSON** is typed `unknown`, each field read through `fieldAsJavaScriptReadsIt(value, key)`, which
  does what `value[key]` does (for `null`, the TypeError that read throws: a game's setup, `bots/setup.ts`).
- **What a realm sent, parsed from JSON or as its slot row holds it** (its orders, read field by field) goes through one
  reader that hands it back typed `Readonly<Partial<Record<string, unknown>>>` for any value but `null` and `undefined`,
  and for those throws the `TypeError` its first field's read threw (`theOrdersAsTheRealmSentThem`); a field's `x || {}`
  through an `if` reader (`itOrAnEmptyObject`). What the merge keeps as it was sent (a realm's declarations, research
  picks and messages, a hero's phases) is written into the context's typed record through a view of the same record
  typed `Record<number, unknown>`, and read back through a local typed as wide as the reader's guards (`Partial<Dispatch>
  | null | undefined`).
- **A unit an estimate weighs that holds no name** (the bots' estimates of a neutral mix) is a member of the grid row's
  unit type, `AUnitAnEstimateWeighs`, its `unitName` `undefined`; the facings, which meet only a battle's whole armies,
  read the unit through `theWholeArmyABattlesGridHolds`, which throws for one of no name.
- **A cache that other files write fields to** (the bots' scratch state for a turn) is typed with the fields its own
  file reads and `[field: string]: unknown` for the rest, so an untyped writer's field still passes.
- **A line rewritten in place by its index** (`narrative[i].whatBecomesOfTheProvince = …`, the battle's outcome held by
  the beaten) is read through a check that hands back the line's kind and throws for any other (`theOutcomeLineAt`);
  reading the list's element so inline is "too complex to represent" (TS2590).
- **A `for … of` over a literal list of tuples** (each side's pursuits and its record) takes `as const`, so each element
  keeps its type: a side's words handed where its record belongs then fail `tsc`.
- **A ternary or a list of many kinds of line** can be "too complex to represent" (TS2590) as `NarrativeLine`: type it
  by the kinds it holds, `Extract<TheFactOfAPersonalCombatsLine, { kind: … }>`, and build a list of them with other
  lines in two steps (a literal of them, then `push`).
- **A line a registry names from a union wider than this copy's facts** (a battle spell's line, each copy's own kinds
  in one union) is read through a check that hands back one of the kinds this copy writes there, and throws for any
  other (`theLineThisCopyOfTheBattleWrites(done.theLine, "…")`): the registry's tables name one a copy, so it never
  throws. A ternary of records (the defenders as a line names them) is typed by its fact type on the `const`, and so is a
  fact a battle returns for its caller to hand on (the onlookers' summary: else its kind is `string`).
- **A test that calls a freed function on its own shapes** (a staged context, hero and province) hands its
  arguments through one cast, `f(...([tc, atk, field, guard] as unknown as Parameters<typeof f>))`.
- **`{ ...(x || {}) }`** is `{ ...x }`: a spread of a missing or falsy value adds nothing.
- **A value from a parsed draft compared as a number** (`fromIdx < 0`, `splice(fromIdx, 1)`, P1-16h2's dragged tactic)
  is read `Number(fromIdx)` there: both read it through the same conversion; its `===` compares it as it is.
- **`set.has(x)` on a value of no type** (a target read off the page) uses a `Set<unknown>`: the same members, and a value
  of another kind is never one of them, as before.
- **The item a hero carries as the order form's forecasts hand it** (`AnItemAHeroCarries`) is the rules' item too
  (`itemSlot`'s: a report's item always has its name), with the fields the item fields read (`equipped`, `desc`,
  `_spent`, the spell an item casts): the forecasts hand the report's own items back, so the type the code reads them as
  is theirs (P1-16f).
