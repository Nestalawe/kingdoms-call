// The player page's lists, tags, skill row, army card and cast note on the values handed them (plan P1-16c): the lines
// P1-16c changed that the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the
// value that reaches it, so a fault planted in one is red.
// - items-and-heroes.ts: the heroes an order may name (the dead, a pre-order card before and after its phase, a
//   charmed enemy), a realm by its index (from the report handed, else the page's own), an item's tier pill, its bound
//   and slot tags, the Grand Design's hint (no alignment: the orders' table's words), the hidden hero's suffix, and the
//   page's controls (the rumoured lairs' and the equipped items' hidden fields, the pre-battle magic, the research
//   choice, the concession) on a document jsdom builds;
// - order-chances.ts: the cast note with no skill yet, an item's cast and the report's own figures; the report's
//   numbers rounded down, a multiplier kept;
// - skills-and-projections.ts: a source of no known kind, the sign-aware fallback, the skill row from raw levels and
//   from scoped extras (capped, a scope with no mark), the Druid a commander needs on the page's own report, the army
//   card's figures with no kingdom and no items, a primal race's class, and the army label's short, humanoid, moving and
//   Wild Hunt forms.
// Level 1 (unit): the page's three files import in Node (P1-13e8); their functions called on plain values, the
// controls on a jsdom document set as the page's own. A page test would boot the whole page to reach each one.
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.js';
import {
  gdHintFor,
  itemBoundTag,
  itemSlotTag,
  itemTierTagP,
  orderTargetCharsP,
  realmNameP,
  realmOfP,
  renderConcede,
  renderPreSchool,
  setConcede,
  setDiscoveryChoice,
  unseenSuffixP,
  updateEquipTarget,
  updateRumourTarget,
} from '../../src/ui/player/items-and-heroes.ts';
import { L79_ORDERS } from '../../src/ui/player/l79-orders.ts';
import { castChanceNote, roundReportNumbers } from '../../src/ui/player/order-chances.ts';
import {
  _bonusKindP,
  _kindFallbackP,
  _skillSourcesP,
  armyLabel,
  capitalise,
  druidNeedP,
  formatRace,
  skillRowHTML,
  theArmyCardsFiguresOfAColumn,
} from '../../src/ui/player/skills-and-projections.ts';

const html = (v: unknown): string => String(v);

describe('items-and-heroes.ts: the lists and the tags', () => {
  test('the heroes an order may name: not the dead, a pre-order card only after its phase, a charmed enemy only if let', () => {
    const report = {
      characters: [
        null,
        { id: 1, name: 'Ser Brann', alive: false },
        { id: 2, name: 'Ilse' },
        { id: 'hired_7_via_2_ph0', name: 'Hired', hiredInPhase: 1 },
        { id: 'charm_9_via_2_ph0', name: 'Charmed', hiredInPhase: 0, _charmEnemy: true },
      ],
    };
    const names = (ph: number | null, allow?: boolean) =>
      orderTargetCharsP(report, ph, allow === undefined ? undefined : { allowCharmEnemy: allow }).map((c) => c.name);
    expect(names(null)).toEqual(['Ilse']);
    expect(names(1)).toEqual(['Ilse']);
    expect(names(2)).toEqual(['Ilse', 'Hired']);
    expect(names(2, true)).toEqual(['Ilse', 'Hired', 'Charmed']);
    expect(orderTargetCharsP(null, 1)).toEqual([]);
  });

  test("a realm by its index: from the report handed, else the page's own report; none for no index or no match", () => {
    const report = { allKingdoms: [null, { index: 0, name: 'Varrow' }, { index: 1, name: 'Ashmoor' }] };
    expect(realmNameP(1, report)).toBe('Ashmoor');
    expect(realmOfP(null, report)).toBeNull();
    expect(realmOfP(5, report)).toBeNull();
    expect(realmNameP(5, report)).toBe('enemy');
    currentReport = { allKingdoms: [{ index: 3, name: 'Thornwick' }] };
    expect(realmNameP(3)).toBe('Thornwick');
    currentReport = null;
    expect(realmOfP(3)).toBeNull();
  });

  test("an item's tier pill: none or tier 0 reads Weak, tier 4 Legendary", () => {
    expect(html(itemTierTagP(undefined))).toContain('Weak');
    expect(html(itemTierTagP({ tier: 0 }))).toContain('Weak');
    expect(html(itemTierTagP({ tier: 0 }))).toContain('var(--stone)');
    expect(html(itemTierTagP({ tier: 3 }))).toContain('Powerful');
    expect(html(itemTierTagP({ tier: 4 }))).toContain('Legendary');
  });

  test("an item bound to a race or an alignment, in the wrong hands; the slot tag's free count", () => {
    expect(html(itemBoundTag({ name: 'Elf-Bow', race: 'Elven' }, { race: 'Human' }))).toContain(
      '[Elven characters only',
    );
    expect(html(itemBoundTag({ name: 'Holy Mace', alignment: 'Divine' }, { alignment: 'Evil' }))).toContain(
      '[Divine characters only',
    );
    expect(itemBoundTag({ name: 'Holy Mace', alignment: 'Divine' }, { alignment: 'Divine' })).toBe('');
    expect(itemBoundTag({ name: 'Rope' }, null)).toBe('');
    // no hero: an unequipped item uses none of its slot; one equipped uses one
    expect(html(itemSlotTag({ name: 'Iron Helm', slot: 'helm', equipped: false }, null))).toContain('1 of 1 free');
    expect(html(itemSlotTag({ name: 'Iron Helm', slot: 'helm' }, null))).toContain('0 of 1 free');
    // a hero with two rings, one taken off, one he can't use
    const rings = [
      null,
      { name: 'Gold Ring', slot: 'ring' },
      { name: 'Silver Ring', slot: 'ring', equipped: false },
      { name: 'Elf Ring', slot: 'ring', race: 'Elven' },
    ];
    expect(html(itemSlotTag({ name: 'Gold Ring', slot: 'ring' }, { race: 'Human', items: rings }))).toContain(
      '1 of 2 free',
    );
    expect(html(itemSlotTag({ name: 'Gold Ring', slot: 'ring' }, { race: 'Human', items: null }))).toContain(
      '2 of 2 free',
    );
  });

  test("the Grand Design's hint: the realm's Wonder, or the orders' table's words for a realm of no alignment", () => {
    expect(html(gdHintFor({ kingdom: { alignment: 'Good' } }))).toContain('Free City Charter');
    expect(gdHintFor({ kingdom: { alignment: '' } })).toBe(L79_ORDERS['Grand Design']?.hint);
    expect(gdHintFor({ kingdom: null })).toContain('complete your realm');
    currentReport = { kingdom: { alignment: 'Neutral' } };
    expect(html(gdHintFor())).toContain('Grand Library');
    currentReport = null;
    expect(gdHintFor()).toContain('complete your realm');
  });

  test("a hidden hero's suffix: his name, else 'this hero'; not known until he joins, or hidden", () => {
    expect(unseenSuffixP({ name: '', _unknownSkills: true })).toBe(
      'this hero’s level is not known until they have joined',
    );
    expect(unseenSuffixP({ name: 'Ilse', _unknownSkills: true })).toBe(
      'Ilse’s level is not known until they have joined',
    );
    expect(unseenSuffixP(null)).toBe('this hero’s level is hidden from you');
    expect(unseenSuffixP({ name: 'Ilse' })).toBe('Ilse’s level is hidden from you');
  });
});

describe("items-and-heroes.ts: the page's controls", () => {
  let page: Document;
  beforeAll(() => {
    const { window } = bootJsdom('<!doctype html><html><body><div id="here"></div></body></html>');
    page = window['document'] as Document;
    Object.assign(globalThis, {
      document: page,
      HTMLInputElement: window['HTMLInputElement'],
      confirm: () => true,
    });
  });
  const stage = (inner: string) => {
    const here = page.getElementById('here');
    if (here) here.innerHTML = inner;
  };
  const valueOf = (id: string) => {
    const el = page.getElementById(id);
    return el && 'value' in el ? el.value : 'none';
  };

  test('the rumoured lairs ticked fill the hidden field and the cost', () => {
    stage(`<div id="po-rumour-wrap-4-1">
        <label><input type="checkbox" value="7" checked> Lair A 30g</label>
        <label><input type="checkbox" value="9"> Lair B 10g</label>
        <label><input type="checkbox" value="11" checked> Lair C 15g</label>
        <div id="po-rumour-total-4-1">Cost: <strong>0g</strong></div>
        <input type="hidden" id="po-target-4-1" value=""></div>`);
    updateRumourTarget(4, 1);
    expect(valueOf('po-target-4-1')).toBe('7,11');
    expect(page.querySelector('#po-rumour-total-4-1 strong')?.textContent).toBe('45g');
  });

  test('the equipped items chosen fill the hidden field once each; no wrap leaves it', () => {
    stage(`<div id="po-equip-wrap-5-2">
        <select><option value="Iron Helm" selected>Iron Helm</option></select>
        <select><option value="">none</option></select>
        <select><option value="Iron Helm" selected>Iron Helm</option></select>
        <select><option value="Gold Ring" selected>Gold Ring</option></select>
        <input type="hidden" id="po-target-5-2" value=""></div>`);
    updateEquipTarget(5, 2);
    expect(valueOf('po-target-5-2')).toBe('Iron Helm,Gold Ring');
    stage(`<input type="hidden" id="po-target-5-2" value="x">`);
    updateEquipTarget(5, 2);
    expect(valueOf('po-target-5-2')).toBe('x');
  });

  test('the pre-battle magic shows the school chosen, or the button to choose one', () => {
    stage(`<div id="ep-preschool-display-6"></div><input type="hidden" id="ep-preschool-6" value="Elemental">`);
    renderPreSchool(6);
    expect(page.getElementById('ep-preschool-display-6')?.textContent).toContain('Random Elemental Magic spell');
    stage(`<div id="ep-preschool-display-6"></div><input type="hidden" id="ep-preschool-6" value="">`);
    renderPreSchool(6);
    expect(page.getElementById('ep-preschool-display-6')?.textContent).toContain('Choose spell school');
  });

  test('the research choice: a lead kept is marked, the finder named or "a scholar"', () => {
    stage(`<div id="orders-discovery-choice"></div>`);
    currentReport = {
      pendingDiscoveryChoices: [
        null,
        { key: 'r1', charName: '', turn: 4, options: [{ id: 'd1', name: 'Lens', category: 'Sage', desc: 'a' }] },
        { key: 'r2', charName: 'Ilse', options: [{ id: 'd2', name: 'Forge', category: 'War', desc: 'b' }] },
        { key: 'r3', options: [] },
      ],
    };
    setDiscoveryChoice('r2', 'd2');
    expect(discoveryChoices['r2']).toBe('d2');
    const w = page.getElementById('orders-discovery-choice');
    expect(w?.textContent).toContain('Found by a scholar (turn 4)');
    expect(w?.textContent).toContain('Found by Ilse');
    expect(w?.querySelectorAll('input[checked]').length).toBe(1);
    expect(w?.innerHTML).toContain('border-top:1px solid');
    currentReport = null;
  });

  test('the concession: offered, then to be sent, then cancelled; a realm that has conceded says so', () => {
    stage(`<div id="concede-wrap"></div>`);
    currentReport = { kingdom: {} };
    setConcede(true);
    expect(concedeGame).toBe(true);
    expect(page.getElementById('concede-wrap')?.textContent).toContain('You will CONCEDE the game');
    setConcede(false);
    expect(concedeGame).toBe(false);
    expect(page.getElementById('concede-wrap')?.textContent).toContain('Concede the game');
    currentReport = { kingdom: { conceded: true } };
    renderConcede();
    expect(page.getElementById('concede-wrap')?.textContent).toContain('Your realm has conceded.');
    currentReport = null;
  });
});

describe('order-chances.ts: the cast note and the rounding', () => {
  test('no skill yet; an item cast; the report figures with what lifts them; the formula for an older report', () => {
    expect(html(castChanceNote({ skills: {} }, 'Fireball'))).toContain('No Elemental Magic skill yet');
    expect(castChanceNote({ skills: {} }, 'No Such Spell')).toBe('');
    expect(html(castChanceNote(null, 'Fireball', { itemCast: true }))).toContain('worked from the item');
    const rec = { level: 4, chance: 95, arcane: 10, mastery: 5, discovery: 3 };
    const note = html(castChanceNote({ castChance: { elemental: rec } }, 'Fireball'));
    expect(note).toContain('Elemental Magic 4, +10% Arcane Codex, +5% school mastery, +3% discoveries — the 95% cap');
    expect(html(castChanceNote({ skills: { elemental: 2 } }, 'Fireball'))).toContain(
      '<strong>50%</strong> (Elemental Magic 2)',
    );
  });

  test("the report's numbers rounded down, a multiplier kept, none as no words", () => {
    expect(roundReportNumbers('lost 3.7 men, × 1.5 edge, a 6.1× lead')).toBe('lost 3 men, × 1.5 edge, a 6.1× lead');
    expect(roundReportNumbers(null)).toBe('');
    expect(roundReportNumbers(undefined)).toBe('');
  });
});

describe('skills-and-projections.ts: the skill row, the Druid and the army card', () => {
  test("a source's kind: an unknown one reads Other; with none, a penalty is a curse", () => {
    expect(_bonusKindP('nope').label).toBe('Other');
    expect(_bonusKindP('perk').label).toBe('Perk');
    expect(_kindFallbackP(-1, 'item')).toBe('curse');
    expect(_kindFallbackP(undefined, 'item')).toBe('item');
    const hero = {
      skillEff: {
        melee: {
          base: 3,
          bonus: 1,
          sources: [
            { label: 'Sword', delta: 1 },
            { label: 'Hex', delta: -1, kind: '' },
          ],
        },
      },
      skillExtra: {
        melee: [
          { label: 'Duellist', delta: 1 },
          { label: 'Charge', delta: 2, scope: 'battle', kind: 'perk' },
        ],
      },
    };
    expect(_skillSourcesP(hero, 'melee')).toEqual([
      { label: 'Sword', delta: 1, kind: 'item', scope: 'always' },
      { label: 'Hex', delta: -1, kind: 'curse', scope: 'always' },
      { label: 'Duellist', delta: 1, kind: 'title', scope: 'combat' },
      { label: 'Charge', delta: 2, kind: 'perk', scope: 'battle' },
    ]);
    expect(_skillSourcesP({ combatSkillBonus: { sage: [{ label: 'Owl', delta: 1 }] } }, 'sage')).toHaveLength(1);
    expect(_skillSourcesP(null, 'sage')).toEqual([]);
  });

  test('the skill row: raw levels with no breakdown; scoped extras with their marks; a cap named', () => {
    const raw = html(skillRowHTML({ skills: { melee: 2, sage: 0 } }, 'tags'));
    expect(raw).toContain('Melee 2');
    expect(raw).not.toContain('Sage');
    expect(skillRowHTML({ skills: {} }, 'tags')).toBe('');
    // a breakdown's skill of no level and no bonus is left out; one of no bonus shows its level alone
    const plain = html(skillRowHTML({ skillEff: { sage: { base: 0 }, archery: { base: 2 } } }, 'tags'));
    expect(plain).not.toContain('Sage');
    expect(plain).toContain('Archery 2</span>');
    expect(html(skillRowHTML(null, 'inline'))).toContain('No skills');
    const hero = {
      skillEff: { melee: { base: 5, bonus: 1, sources: [{ label: 'Sword', delta: 3, kind: 'item' }] } },
      skillExtra: {
        melee: [
          { label: 'Duellist', delta: 1, kind: 'title' },
          { label: 'Oddity', delta: 2, kind: 'title', scope: 'elsewhere' },
        ],
      },
    };
    const row = html(skillRowHTML(hero, 'inline'));
    expect(row).toContain('(+1⚔)');
    expect(row).toContain('(+2)');
    expect(row).toContain('(capped at 9)');
    expect(row).toContain('capped at 9"');
    expect(row).toContain('+3 Sword');
    expect(row).toContain('+1 Duellist (personal combat only)');
    expect(row).toContain('+2 Oddity ()');
  });

  test('capitalise: the first letter, none for no words', () => {
    expect(capitalise('melee')).toBe('Melee');
    expect(capitalise('')).toBe('');
    expect(capitalise(null)).toBe('');
  });

  test("the Druid a commander needs, on the page's own report: an Evil realm waives a monster's; sd40 a tamed flyer's", () => {
    currentReport = { kingdom: { alignment: 'Evil' } };
    expect(druidNeedP({ type: 'Manticore Pride' }, { id: 1, skills: {} }).req).toBe(0);
    currentReport = { kingdom: { alignment: '' }, discoveries: [null, { id: 'sd40' }] };
    expect(druidNeedP({ type: 'Thunderbirds' }, { id: 1, skills: {} }).req).toBe(0);
    currentReport = { kingdom: { alignment: '' }, discoveries: [{ id: 'sd39' }] };
    expect(druidNeedP({ type: 'Thunderbirds' }, { id: 1, skills: {} }).req).toBe(4);
    currentReport = null;
    expect(druidNeedP({ type: 'Manticore Pride' }, null).req).toBe(4);
    expect(druidNeedP({ type: 'Manticore Pride', skeletal: true }, null)).toEqual({
      req: 0,
      effDru: 0,
      shortfall: 0,
      counts: false,
    });
  });

  test("the army card's figures with no kingdom on the report and no items on the hero", () => {
    const f = theArmyCardsFiguresOfAColumn(
      [
        { type: 'Swordsmen', quality: 'Average', cost: 3 },
        { type: 'Swordsmen', quality: 'Average' },
      ],
      { id: 1, items: null, race: 'Human' },
      { kingdom: null },
    );
    expect(f.totalCost).toBe(5);
    expect(f.units).toHaveLength(2);
    expect(f.totalStr).toBe(2 * (f.units[0]?.bs ?? NaN));
  });

  test("a primal race's class: a known sub-race, an unknown one, a bare Primal by its unit's type", () => {
    expect(formatRace('Primal:Cave Troll')).toBe('Monster');
    expect(formatRace('Primal:Nothing Known')).toBe('Creature');
    expect(formatRace('Primal', 'Swordsmen')).toBe('Creature');
    expect(formatRace('Primal')).toBe('Creature');
    expect(formatRace('')).toBe('Uninhabited');
    expect(formatRace('Elven')).toBe('Elven');
  });

  test('the army label: short, with a humanoid race, moving by sea, and a Wild Hunt beast', () => {
    expect(armyLabel({ type: 'Swordsmen', quality: 'Elite' }, { short: true })).toBe('Elite Swordsmen');
    expect(armyLabel({ type: 'Swordsmen', unitName: 'The Grey', quality: 'Elite' }, { short: true })).toBe('The Grey');
    expect(html(armyLabel({ type: 'Wyvern Riders', race: 'Orcish', quality: 'Average' }))).toContain('Orcish');
    expect(html(armyLabel({ type: 'Swordsmen', quality: 'Average', moveRate: 3, moveKind: 'sea' }))).toContain(
      'Move 3 (sea)',
    );
    expect(html(armyLabel({ type: 'Swordsmen', quality: 'Average', moveRate: 3 }, { noMove: true }))).not.toContain(
      'Move',
    );
    expect(html(armyLabel({ type: 'Great Bear', quality: 'Average', wildHunt: true }))).toContain(
      'bound until end of turn ?, no wages',
    );
    expect(html(armyLabel({ type: 'Great Bear', quality: 'Average', _wildHuntUntilTurn: 6 }))).toContain(
      'bound until end of turn 6, no wages]</span>',
    );
  });
});
