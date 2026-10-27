// A line's facts hold values, not words (plan P1-12d, P1-12's Decisions of 2026-10-26, Decisions 2 and 10): every fact
// literal in src/engine/ whose kind an area of the list below declares holds plain values only (a number, a flag, an
// id or a slug, a name as the world or the content holds it, a copy of a list or a record), never words the engine
// composed (a clause, a plural, a mark, a join, a number formatted for reading). The views write every word
// (src/views/prose/). And no facts module imports the world's types (src/schemas/): a fact never holds a part of the
// world. P1-12d2 lists personal combat, P1-12d3 the battles, P1-12d4 the strength ladder and the grid; P1-12d5 to d10
// add theirs. A facts module's kinds include the kinds of the records its facts hold (P1-12d4: why a unit stands or
// faces as it does, whom it faced, each modifier of the ladder), so a record's literal is read too.
//
// The rule, by syntax tree: a field holds words when its value is, or holds, a string or a template with text in it,
// reached as the value (through a conditional's two branches, +, ||, ??, &&, a template's placeholders, String(), an
// array or an object), through a call to a word helper (its name ends in Line, Words, Word, Label, Clause, Narrative,
// Note, Names, Tag, Verb, Plural, Text, Roll or Icon; or describeArmy, pcSkillLabel, pcWardWord, pcPerkWord,
// monsterCatLabel, fmtRoll, hpGainLine, _pct, forceLabel, realmTag, unitRef, ownedUnitName, aAn (a word's article),
// n0 (a number rounded for reading: P1-12d3); or join, or toFixed),
// through a table of words written in the same file, or through a variable of the same file, by its declaration or a
// later assignment (= or +=). A string that is a call's argument or a comparison's operand is not the value's words.
// The scoping's scanner (P1-12d) counted every string inside a field's expression, so it counted numbers (a damage
// dealt by a call that names its spell) and missed a field handed a variable that a template built.
//
// What it lets through, by kind and field (Decision 2): the fighters' labels ("The Barrow Wight", a hero's name: the
// facts-by-sense slice names a side) and a battle's side's, guard's, realm's or unit's label ("Aldric's leaderless
// host", "the defenders of Highmoor", a realm's tag, "Aldric's Free Lances (Free Lances, Veteran)"), an item's equip
// note (gainedItemNote: the items' words, src/engine/items/, a later row), five slugs or names a string literal gives
// (a strike's class, its channel, a guardian's grade as the content names it, a school's name as the content names it,
// a realm's alignment, a unit's quality, the line an ability places a unit in). It can't see words handed in through a
// function's parameter
// (pcStunTurned's `what`, a lingering harm's label, the verb a battle hands a unit's fate, a force's header's verb):
// see the Parked list.
//
// Red on its base by design (P1-12d2's base: 139 fields of personal combat's facts; P1-12d3's: 121
// fields of the battles' facts; P1-12d4's: the 10 the list of the ladder's and the grid's let through), as the static
// tests of P1-19's
// rows are: the one exception to refactor-only's rule that new tests pass before and after (Theo, 2026-10-25).
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';

/** Each area whose facts hold no words, by its facts module, from the row that made it so. */
const AREAS: readonly (readonly [area: string, factsModule: string, row: string])[] = [
  ['personal combat', 'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts', 'P1-12d2'],
  ['a battle', 'src/engine/battle/the-facts-a-battles-lines-record.ts', 'P1-12d3'],
  ["the sea lift's lines in a battle", 'src/engine/units/the-facts-the-sea-lifts-battle-lines-record.ts', 'P1-12d5'],
  ["a hero's death", 'src/engine/heroes/the-facts-a-heros-death-lines-record.ts', 'P1-12d5'],
  ["the wanderer's escape", 'src/engine/the-facts-the-wanderers-escape-line-records.ts', 'P1-12d5'],
];

/** Every facts module (none may import the world's types). */
const FACTS_MODULES: readonly string[] = [
  'src/engine/battle/the-facts-a-battles-lines-record.ts',
  'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts',
  'src/engine/units/the-facts-the-sea-lifts-battle-lines-record.ts',
  'src/engine/heroes/the-facts-a-heros-death-lines-record.ts',
  'src/engine/the-facts-the-wanderers-escape-line-records.ts',
];

/** A fighter's label: still a field's words in this slice (Decision 2), by its field, with the kinds that hold it. */
const LABELS: Readonly<Record<string, readonly string[]>> = {
  // `The ${foe.name}` for a guardian, else the hero's name (resolvePersonalCombat's mercy)
  foeWho: [
    'as their strength fails a fighter begs the foe for mercy',
    'as the foe draws for the killing shot a fighter begs for their life',
    'as the foe readies a power for the killing stroke a fighter begs',
    'beaten and bleeding a fighter sees the killing blow coming',
    'as the foe closes for the kill a fighter cries out for mercy',
    'the guardian pauses over its prey and lets a fighter crawl away',
    'the foe lets a fighter go',
    'the foe lowers their bow and lets a fighter go',
    'the foe lets a power die unspent',
    'the foe stays the blow and lets a fighter go',
    'the foe lowers their weapon in disgust and lets a fighter go',
    'the stroke never falls and the foe spares a fighter',
    'the foe knows nothing of mercy',
    'the foe laughs at the plea',
    'the foe is deaf to the plea',
    'there is no pity in the foe',
  ],
  // `The ${actor.name}` for a guardian, else the hero's name (pcUseCombatItem)
  who: [
    'a fighter uses a combat item',
    'a fighter recovers hit points',
    'a fighter recovers hit points and every lingering affliction lifts',
    'a fighter drinks the stolen vigour',
    'a fighter surges with strength',
    "a fighter's eye sharpens",
    'a fighter is ready to break away',
    'a fighter fades from sight the foe',
  ],
  // A battle's side, as the battle names it: a hero, "Aldric's leaderless host" when he fell, "Aldric's host" (the
  // battles' tally and the tiers find a side by these words; the facts-by-sense slice names a side)
  name: ['a force drawn up for battle'],
  cName: [
    "control undead turns a defending undead unit to the attacker's side",
    'the attacker casts a spell before the battle against the defenders',
    'the attacker has nowhere to retreat and takes further losses',
    'the attacker is repelled by the defenders',
    'the attacker storms ashore in a raid on the coast against the defenders',
    'the attacker sweeps into a province with no one left to stand against him',
    'the attacker unfolds a grand stratagem against the defenders',
    'the attacker wins the battle against the defenders',
    "the attacker's Tactical command does not apply at sea",
    "the attacker's corsairs take his beaten force back to the ships",
    "the attacker's dwarven guard leave the defenders' free lances no broken backs",
    "the attacker's forces retreat to a province",
    "the attacker's free lances find no room to ride",
    "the attacker's free lances ride down the defenders' broken companies",
    "the attacker's monsters are driven to savage fury",
    "the attacker's shield-wall holds and the infantry stand their ground",
    "the attacker's troops fight with fanatical zeal",
    "the attacker's warg riders halve his losses",
    "the defenders' archers find no target among the attacker's forest wardens",
    "the defenders' dwarven guard leave the attacker's free lances no broken backs",
    "the defenders' free lances ride down the attacker's broken companies",
    "the terrain's effect on the attacker's units",
  ],
  atkName: [
    'hosts airborne over open water fight at a penalty',
    "the attacker fights to win back his realm's capital",
    'the attacker has nowhere to retreat',
    'the attacker storms ashore in a raid on the coast',
    'the attacker unfolds a grand stratagem',
    'the attacker wins the battle and seizes the province',
    "the attacker wins the battle but the defender's survivors hold the province",
    "the attacker's assault is repelled and driven from the province",
    "the attacker's assault is repelled but not driven from the province",
    "the attacker's casualties begin",
    "the attacker's forces fight with fanatical zeal",
    "the attacker's siege mastery halves the defenders' fortifications",
    "the attacker's siegecraft wears down the defenders' fortifications",
    "the attacker's stronger host is thrown back but stays",
    "the consecrated ground of the province weakens the attacker's host",
    "the terrain's effect on each side",
  ],
  defName: [
    'hosts airborne over open water fight at a penalty',
    'the attacker wins the battle and seizes the province',
    "the attacker wins the battle but the defender's survivors hold the province",
    "the attacker's assault is repelled and driven from the province",
    "the attacker's assault is repelled but not driven from the province",
    'the defender has nowhere to retreat',
    'the defender unfolds a grand stratagem',
    "the defender's banner of the realm rallies the home defence",
    "the defender's casualties begin",
    "the defender's feigned retreat springs shut",
    "the defender's forces fight with fanatical zeal",
    "the defender's host defends ground held justly",
    "the defender's realm holds its own ground the harder",
    "the defender's stronger host is pushed back but stays",
    'the defenders fight with fanatical zeal on consecrated ground',
    "the terrain's effect on each side",
  ],
  loserName: [
    'the loser retreats to a province',
    "the loser's dwarven guard hold a shield fort with no road out",
    "the loser's dwarven guard withdraw behind a shield fort",
    "the loser's force is destroyed to the last",
    "the loser's forces are completely destroyed and he retreats alone",
    "the loser's skeletal host stands its ground in a deathless march",
    "the loser's surviving forces",
    "the winner's corsairs close the sea lanes to the loser",
  ],
  winnerName: ["the winner's corsairs close the sea lanes to the loser"],
  sideName: [
    "a side's monsters are driven to savage fury",
    "a side's realm discoveries strengthen its army",
    "a side's skeletal legions fight with fanaticism under their undead king",
    "a side's skeletal legions know no fear",
    "a side's war-horn of the plains lets its free lances ride in rough country",
    "the illusory ground of the province confuses a side's forces",
    "the sanctuary wards of the province sap a side's attackers",
  ],
  heroName: ["the hero's archers find no target among the forest wardens"],
  enemyCommanderName: [
    "a curse withers the enemy commander's skill",
    "a psychic blast severs the enemy commander's bond with his beasts",
    "a telekinetic storm scatters the enemy commander's formations",
  ],
  atkLabel: ['the fortune of the battle'],
  defLabel: ['the fortune of the battle'],
  attackersName: ["the onlookers' summary of a battle"],
  hostName: [
    'a host holds a province unopposed and secures it',
    'the hero has the better of the fighting but enemy forces still hold their ground',
    'the hero has the better of the fighting but leaderless defenders still hold the field',
    'the hero has the better of the fighting but the guard still holds the field',
    "the hero has the better of the fighting but the province's garrison still holds",
    'the hero overcomes the defenders and claims the province for his realm',
  ],
  attackersHostName: [
    "an unfinished battle against a province's defenders resumes",
    'an unfinished battle between two hosts resumes',
    'the attacker breaks off a stalled battle and retreats',
    'the attacker finally overcomes the defenders and claims a province',
    'the attacker is pinned in a province with no way out',
    "war comes to a province two realms' hosts share",
  ],
  defendersHostName: [
    'an unfinished battle between two hosts resumes',
    "war comes to a province two realms' hosts share",
  ],
  winnersHostName: ['the winner of a stalled battle secures a province'],
  victorsHost: [
    "a beaten guard's surviving unit breaks ranks and flees as mercenaries",
    "a beaten guard's surviving unit holds its ground unbroken",
    "a beaten guard's surviving unit loses heart and is reduced a tier",
  ],
  // A guard's label: "Ulric and their forces", "the defenders of Highmoor", "the garrison of Highmoor", "the leaderless
  // garrison", whom a province is held by
  guardName: [
    "a beaten guard's surviving unit holds its ground unbroken",
    "a beaten guard's surviving unit loses heart and is reduced a tier",
    'the attacker wins the battle against the defenders',
  ],
  defName2: [
    'the attacker is repelled by the defenders',
    "the attacker wins the battle but the defender's survivors hold the province",
  ],
  heldByName: ['the attacker moves into a province held by its defenders and a battle is initiated'],
  defendersName: ["an unfinished battle against a province's defenders resumes", "the onlookers' summary of a battle"],
  // A realm's tag, " (Westmarch)" (realmTag)
  realmTag: [
    "a hero not at war with the province's realm gains a host inside it",
    "a hero's host turns on a province it has shared with a realm at war",
    'the hero turns a newly gathered host on a province and a battle is initiated',
    "the province's owner learns his defenders still hold against the hero",
    "the province's owner learns the hero was beaten back",
  ],
  attackersRealmTag: ["war comes to a province two realms' hosts share"],
  defendersRealmTag: ["war comes to a province two realms' hosts share"],
  // A unit's label, "Aldric's Free Lances (Free Lances, Veteran)" (unitRef, ownedUnitName)
  unitName: [
    "a beaten guard's surviving unit breaks ranks and flees as mercenaries",
    "a beaten guard's surviving unit holds its ground unbroken",
    'a unit is cut down with no escape',
  ],
  defendingUnitName: ['a defending unit is destroyed in the fighting', 'a defending unit is destroyed in the rout'],
  unitNameAtItsOldQuality: ["a beaten guard's surviving unit loses heart and is reduced a tier"],
  // the units' owner as a unit's disbanding names him: a side's label, or a guard's ("the defenders")
  ownerName: ['a beaten unit has had enough and disbands'],
  // the enemy unit a unit faced, as its fate's line names it (ownedUnitName: battleFacedClauses)
  theEnemyUnit: ['an enemy unit'],
};

/** Not words, though a string literal gives them, by field, with the kinds that hold it. */
const NOT_WORDS: Readonly<Record<string, readonly string[]>> = {
  // an item's equip note: gainedItemNote's words (src/engine/items/equipment.ts), the items' area, a later row
  gainedItemNote: ['a gained item noted'],
  // the class of the killing strike, 'melee', 'ranged' or 'power': a slug the prose reads
  strikeClass: [
    'as the foe readies a power for the killing stroke a fighter begs',
    'the foe lets a power die unspent',
    'the foe knows nothing of mercy',
    'the foe laughs at the plea',
    'the foe is deaf to the plea',
    'there is no pity in the foe',
  ],
  // a strike's channel, 'melee', 'archery' or 'spell' (PC_CHANNEL): a slug the prose reads
  channel: [
    'the first harm to reach the target is drunk by their armour',
    "the target's shield takes the blow square on",
    "the target's mithril armour turns aside some of the harm",
    "the hunter finds the target's weakness",
    "the target reads the beast's every move",
    "the target's armour turns aside some of the harm",
    'the target turns aside all they can but the harm still lands',
  ],
  // a guardian's grade as the content names it ('Weak' when it has none)
  tier: ['a fighter slips past the guardian and seizes the prize', "a fighter's theft is noticed"],
  // a magic school's name as the content names it (SKILL_LABELS), else its slug: 'elemental' for a spell with none
  schoolLabel: ['the defender casts a spell before the battle'],
  // a realm's alignment as the world names it ('Neutral' when it has none): the prose writes it in lower case
  attackersAlignment: ["the consecrated ground of the province weakens the attacker's host"],
  // the quality a unit fights at, as the world names it ('Average' when it has none): armStr's trace
  quality: ['it fights at another quality'],
  // the line an ability places a unit in, 'front' or 'second': a slug the prose reads (battleRegrid)
  itsLine: ['its ability gives it its place'],
};

const WORD_HELPER =
  /(Line|Lines|Words|Word|Label|Clause|Clauses|Narrative|Note|Names|Tag|Verb|Plural|Text|Roll|Icon)$|^(describeArmy|pcSkillLabel|pcWardWord|pcPerkWord|monsterCatLabel|fmtRoll|hpGainLine|_pct|forceLabel|realmTag|unitRef|ownedUnitName|aAn|n0)$/;
/** String methods whose result holds the words of the string they are called on. */
const ON_ITS_STRING = new Set(['toLowerCase', 'toUpperCase', 'trim', 'slice', 'replace', 'padStart', 'padEnd']);
/** Calls that write words of what they are given. */
const WRITE_WORDS = new Set(['join', 'toFixed', 'concat', 'repeat']);

/** Every expression a variable is given before a place in a file: its last declaration before the place, and every
 *  assignment (= or +=) to it after that declaration and before the place. */
function whatAVariableIsGiven(sf: ts.SourceFile, name: string, before: number): ts.Expression[] {
  let declaration: ts.VariableDeclaration | undefined;
  const assignments: ts.BinaryExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      node.getStart(sf) < before
    )
      declaration = !declaration || node.getStart(sf) > declaration.getStart(sf) ? node : declaration;
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      node.left.text === name &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) &&
      node.getStart(sf) < before
    )
      assignments.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!declaration?.initializer) return [];
  const from = declaration.getStart(sf);
  return [declaration.initializer, ...assignments.filter((a) => a.getStart(sf) > from).map((a) => a.right)];
}

/** Why a value holds words (null: it holds none). */
function whyItHoldsWords(
  sf: ts.SourceFile,
  value: ts.Expression,
  place: number,
  seen: ReadonlySet<string>,
): string | null {
  const inner = (e: ts.Expression): string | null => whyItHoldsWords(sf, e, place, seen);
  const first = (es: readonly ts.Expression[]): string | null => {
    for (const e of es) {
      const why = inner(e);
      if (why) return why;
    }
    return null;
  };
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    return value.text ? `the words ${JSON.stringify(value.text)}` : null;
  if (ts.isTemplateExpression(value)) {
    const text = value.head.text + value.templateSpans.map((s) => s.literal.text).join('');
    return text
      ? `a template with the words ${JSON.stringify(text)}`
      : first(value.templateSpans.map((s) => s.expression));
  }
  if (
    ts.isParenthesizedExpression(value) ||
    ts.isAsExpression(value) ||
    ts.isNonNullExpression(value) ||
    ts.isSatisfiesExpression(value)
  )
    return inner(value.expression);
  if (ts.isConditionalExpression(value)) return first([value.whenTrue, value.whenFalse]);
  if (ts.isBinaryExpression(value)) {
    const operator = value.operatorToken.kind;
    return operator === ts.SyntaxKind.PlusToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.AmpersandAmpersandToken
      ? first([value.left, value.right])
      : null;
  }
  if (ts.isArrayLiteralExpression(value)) return first(value.elements);
  if (ts.isObjectLiteralExpression(value))
    return first(
      value.properties.flatMap((p) =>
        ts.isPropertyAssignment(p) ? [p.initializer] : ts.isShorthandPropertyAssignment(p) ? [p.name] : [],
      ),
    );
  if (ts.isElementAccessExpression(value) || ts.isPropertyAccessExpression(value)) {
    let table: ts.Expression = value.expression;
    while (ts.isParenthesizedExpression(table)) table = table.expression;
    if (ts.isIdentifier(table) && !seen.has(table.text)) {
      const given = whatAVariableIsGiven(sf, table.text, place);
      table = given.length === 1 && given[0] ? given[0] : table;
    }
    return ts.isObjectLiteralExpression(table) || ts.isArrayLiteralExpression(table)
      ? inner(table) && `a table of words (${value.expression.getText(sf)})`
      : null;
  }
  if (ts.isCallExpression(value)) {
    const callee = value.expression;
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
    if (name === 'String' && value.arguments[0]) return inner(value.arguments[0]);
    if (WRITE_WORDS.has(name) && ts.isPropertyAccessExpression(callee)) return `words written by ${name}`;
    if (ON_ITS_STRING.has(name) && ts.isPropertyAccessExpression(callee)) return inner(callee.expression);
    return WORD_HELPER.test(name) ? `the word helper ${name}` : null;
  }
  if (ts.isIdentifier(value) && !seen.has(value.text)) {
    const inside = new Set([...seen, value.text]);
    for (const given of whatAVariableIsGiven(sf, value.text, place)) {
      const why = whyItHoldsWords(sf, given, given.getStart(sf), inside);
      if (why) return `${value.text}, given ${why}`;
    }
  }
  return null;
}

/** The kinds a facts module declares (each `kind: '…'` of its types). */
function kindsDeclaredIn(file: string): Set<string> {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const kinds = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertySignature(node) &&
      node.name.getText(sf) === 'kind' &&
      node.type &&
      ts.isLiteralTypeNode(node.type) &&
      ts.isStringLiteral(node.type.literal)
    )
      kinds.add(node.type.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return kinds;
}

/** Every field of a fact literal of the kinds given that holds words, in a file's text: "line kind field: why". */
function fieldsHoldingWords(file: string, text: string, kinds: ReadonlySet<string>): string[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const kindField = node.properties.find(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) && p.name.getText(sf) === 'kind' && ts.isStringLiteralLike(p.initializer),
      );
      const kind = kindField && ts.isStringLiteralLike(kindField.initializer) ? kindField.initializer.text : null;
      if (kind !== null && kinds.has(kind))
        for (const field of node.properties) {
          if (field === kindField) continue;
          const name =
            ts.isPropertyAssignment(field) || ts.isShorthandPropertyAssignment(field) ? field.name.getText(sf) : '';
          const value = ts.isPropertyAssignment(field)
            ? field.initializer
            : ts.isShorthandPropertyAssignment(field)
              ? field.name
              : null;
          const why = value ? whyItHoldsWords(sf, value, node.getStart(sf), new Set()) : 'a spread: its fields unseen';
          if (why && !LABELS[name]?.includes(kind) && !NOT_WORDS[name]?.includes(kind)) {
            const line = sf.getLineAndCharacterOfPosition(field.getStart(sf)).line + 1;
            found.push(`${String(line)} ${kind} ${name}: ${why}`);
          }
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Every .ts file under a folder of the repository, by its path from the root. */
function filesUnder(folder: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, folder), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(folder, f))
    .sort();
}

test.for(AREAS)("%s's facts hold values, not words (%s, %s)", ([, factsModule]) => {
  const kinds = kindsDeclaredIn(factsModule);
  expect(kinds.size, `the kinds ${factsModule} declares`).toBeGreaterThan(0);
  const found = filesUnder('src/engine').flatMap((file) =>
    fieldsHoldingWords(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), kinds).map((f) => `${file}:${f}`),
  );
  expect(found).toEqual([]);
});

test.for(FACTS_MODULES)('%s imports none of the world’s types (src/schemas/)', (file) => {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = sf.statements
    .filter(ts.isImportDeclaration)
    .map((i) => (ts.isStringLiteral(i.moduleSpecifier) ? i.moduleSpecifier.text : ''));
  expect(imports.filter((from) => from.includes('schemas/'))).toEqual([]);
});

// The rule finds what it should: each way a field can hold words, planted in one file, and none of the values.
test('the rule refuses every way of handing words, and lets every value through', () => {
  const kinds = new Set(['a planted line']);
  const planted = `
    const table = { Weak: 'a dangerous' };
    const clause = 'a clause';
    let built = '';
    built += \` and \${n} more\`;
    const count = pcHitSkill(foe, 'melee'), roll = d100(), copy = aListAsTheLineTellsIt(names);
    narrate(narrative, {
      kind: 'a planted line',
      words: 'a word',
      plural: n !== 1 ? 's' : '',
      mark: roll <= chance ? ' ✓' : ' ✗',
      template: \`\${n}%\`,
      onlyInAPlaceholder: \`\${clause}\`,
      joined: names.join(', '),
      formatted: pct.toFixed(0),
      helper: fmtRoll(chance, roll),
      icon: pcWardIcon(target),
      fallback: what || 'the daze',
      lowered: clause.toLowerCase(),
      fromATable: table[power],
      throughAVariable: clause,
      builtUp: built,
      inARecord: { odds: \` (\${mercy}%)\` },
      ...spread,
      aNumber: count,
      aRoll: roll,
      aName: target.name,
      aFlag: target.kind === 'monster',
      aCopy: copy,
      aRecord: { mercy, shown },
      anArgument: theNamesAsTheLineTellsThem(spells.slice(0, 4)),
      aKey: aFightersWardAsTheLineTellsIt(target, 'schoolWard'),
      aSlug: PC_CHANNEL[kind],
    });
    narrate(narrative, { kind: 'another area', words: 'its words' });`;
  expect(fieldsHoldingWords('planted.ts', planted, kinds).map((f) => f.split(':')[0]?.split(' ').pop())).toEqual([
    'words',
    'plural',
    'mark',
    'template',
    'onlyInAPlaceholder',
    'joined',
    'formatted',
    'helper',
    'icon',
    'fallback',
    'lowered',
    'fromATable',
    'throughAVariable',
    'builtUp',
    'inARecord',
    '',
  ]);
});
