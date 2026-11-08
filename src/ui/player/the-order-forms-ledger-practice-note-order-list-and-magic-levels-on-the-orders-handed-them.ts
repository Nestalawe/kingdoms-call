// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import {
  KC_MAGIC_SCHOOLS,
  KC_RUMOUR_COST_BY_POWER,
  KC_SKILL_LABELS,
  KC_SKILLS,
} from '../../content/kingdoms-call-data.ts';
import {
  aCompanyIsABeastADruidHalves,
  aHeroMayGiveTheAlignmentOrderAsKingOrNot,
  aHerosWageAfterTheCutsAndTheCeilings,
  aLeadersBeastsPayHalfWages,
  aRealmOfThisCreedMayGiveTheAlignmentOrder,
  aSkillAtThisLevelIsPractisedNoFurther,
  aWageAfterEachCut,
  aWageUnderEachCeiling,
  dispFloor,
  heroHireWage,
  theAlignmentOrdersByTheNameTheFormWrites,
  theChanceAHeroPractisingAloneRaisesHisSkill,
  theHostLeadersCut,
  theLevelAHerosSkillCountsAt,
  theNameTheFormWritesOfTheAlignmentOrder,
  thePriceADruidPaysForABeast,
  theWageABeastPaysUnderADruid,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { L79_ORDERS } from './l79-orders.ts';
import {
  effSkillP,
  theOrderField,
  whereAHeroStandsAfterTheOrdersBefore,
  whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';

// The order form's treasury ledger, the note under an order that quotes its chance (the Practice Skill note among
// them), the orders the form offers a hero and the levels of magic his practices may raise (plan P1-11e42), with the
// tables they read. Like the forecasts' file (P1-11e41), they read only what they are handed: the report, and the
// orders the form holds (`orders`, the page's snapshot of its fields, read by the forecasts' theOrderField). The page
// asks them by its old names (computeOrderLedgerP, orderChanceNote, actionsFor, projectedMagicLevels):
// the-orders-the-form-holds-handed-to-its-forecasts.ts.

// ── TABLES AND CHECKS THE FOUR READ (from move-analysis.ts, items-and-heroes.ts and skills-and-projections.ts) ────
export const SKILL_LABELS = { ...KC_SKILL_LABELS };
export const RUMOUR_COST_BY_POWER_P = { ...KC_RUMOUR_COST_BY_POWER }; // keep in step with the GM portal's RUMOUR_COST_BY_POWER
export const ACTIONS = [
  'Move',
  'Explore',
  'Search Lair',
  'Hunting Rumours',
  'Recruit Armies',
  'Hire Hero',
  'Release Hero',
  'Encounter Character',
  'Steal',
  'Disband Army',
  'Leave/Transfer Army',
  'Pick Up Army',
  'Send Item',
  'Cast Spell',
  'Use Item',
  'Equip Items',
  'Spy',
  'Practice Skill',
  'Research',
  // the alignment orders' names, from their rows (plan P1-11d7)
  theNameTheFormWritesOfTheAlignmentOrder('perform-rite'),
  theNameTheFormWritesOfTheAlignmentOrder('consecrate'),
  theNameTheFormWritesOfTheAlignmentOrder('call-to-arms'),
  theNameTheFormWritesOfTheAlignmentOrder('broker'),
  theNameTheFormWritesOfTheAlignmentOrder('harvest-the-field'),
  'Sabotage',
  'Forced March',
  'Grand Heist',
  'Awaken Grove',
  'Chart the Unknown',
  'Discover Lost Ruin',
  'Blockade',
  'Research Breakthrough',
  'Assassinate',
  'Vanish',
  'Challenge',
  'Rampage',
  'Rain of Arrows',
  "Sniper's Mark",
  'Feigned Retreat',
  'Grand Stratagem',
  'Lightning Advance',
  'Raid the Coast',
  'Wild Calling',
  'Grand Design',
  'Defend',
  'Rest',
];
// Alignment-signature actions: shown only to the realm that owns them (and Perform Rite joins the
// same gating — no more dangling Pagan action in every dropdown). King-only actions are hidden from
// heroes' dropdowns entirely: the engine rejects them from a hero. Druidic and Evil have no signature
// order since 2026-10-12 (item 22). Each by the name the form writes, its row: its creed and whether the
// king alone gives it, which actionsFor asks the engine's two checks of (plan P1-11d7).
export const ALIGN_ACTIONS = theAlignmentOrdersByTheNameTheFormWrites();
// 2026-09-27 (Toby item 4): ONE Wonder per realm, ever. The engine pushes the discovery with id 'gd'
// and refuses a second outright, so once it is there the order is withdrawn from every hero of the
// realm rather than being offered and then rejected at resolution.
export function gdAlreadyBuiltP(report) {
  const r = report || {};
  return (r.discoveries || []).some((d) => d && d.id === 'gd');
}
export const rawSkillLvl = (charObj, sk) => ((charObj && charObj.skills) || {})[sk] || 0;
// ── A CHARACTER WHOSE SHEET THE PLAYER CANNOT READ ──────────────────────────────────────────────
// Two pre-order cards carry one: a hero being HIRED this turn (`_unknownSkills` — the GM ships only
// their fame, never their levels) and a hero being CHARMED (`_hiddenSkills` — you have borrowed a
// mind, not read a life; their pack is not yours to rummage). For every order field the two mean the
// same thing: the placeholder's `skills:{}` and `items:[]` are NOT facts about the character, they are
// an ABSENCE of information. So nothing may be printed that is computed from them — no level, no
// level-derived percentage, no greyed-out tier, no "you have no Thief skill", and no claim that a pack
// is empty. Offer the full choice and let the engine judge at resolution.
// 2026-09-24 (Toby): these two flags had drifted badly apart — each was patched at a different site on
// a different day, so gates closed for a hired hero stood wide open for a charmed one (the Steal and
// Spy percentages, the Research and Explore notes, and the whole L7/L9 set). ONE
// predicate now serves every site. Add future gates through it; never test either flag directly.
export const skillsUnseenP = (c) => !!(c && (c._hiddenSkills || c._unknownSkills));
// dropdown display order — most-used orders near the top, and any alignment-signature order
// (Broker, Consecrate, Call to Arms, Perform Rite, Harvest the Field)
// pinned to the VERY TOP (each is only shown to its own realm, so this simply puts a realm's special order
// first when it appears). Mastery (L7/L9) orders sink to the bottom as rare, situational picks.
// Adjust freely — this array is the single source of the ordering.
export const ACTION_DISPLAY_ORDER = [
  // ── SPECIAL actions the character can take — pinned to the very top ── Alignment-signature
  // orders (each shown only to its own realm)…
  'Broker',
  'Consecrate',
  'Call to Arms',
  'Perform Rite',
  'Harvest the Field',
  // …and MASTERY (L7/L9) orders, which surface only when the hero's skill is high enough.
  // actionsFor() already filters both groups down to what THIS character actually qualifies for, so
  // only the specials available to them appear here.
  'Sabotage',
  'Forced March',
  'Grand Heist',
  'Awaken Grove',
  'Chart the Unknown',
  'Discover Lost Ruin',
  'Blockade',
  'Research Breakthrough',
  'Assassinate',
  'Vanish',
  'Challenge',
  'Rampage',
  'Rain of Arrows',
  "Sniper's Mark",
  'Feigned Retreat',
  'Grand Stratagem',
  'Lightning Advance',
  'Raid the Coast',
  'Wild Calling',
  'Grand Design',
  // ── Everyday orders — exact order requested ──
  'Move',
  'Practice Skill',
  'Research',
  'Cast Spell',
  'Explore',
  'Search Lair',
  'Hunting Rumours',
  'Recruit Armies',
  'Pick Up Army',
  'Leave/Transfer Army',
  'Disband Army',
  'Hire Hero',
  'Release Hero',
  'Defend',
  'Encounter Character',
  'Spy',
  'Send Item',
  'Use Item',
  'Equip Items',
  'Steal',
  'Rest',
];
export const _actionRank = (a) => {
  const i = ACTION_DISPLAY_ORDER.indexOf(a);
  return i < 0 ? ACTION_DISPLAY_ORDER.length : i;
};
export function theOrdersTheFormOffersAHero(report, c) {
  const align = report?.kingdom?.alignment;
  return ACTIONS.filter((a) => {
    if (ALIGN_ACTIONS[a] && !aRealmOfThisCreedMayGiveTheAlignmentOrder(ALIGN_ACTIONS[a], align)) return false;
    if (ALIGN_ACTIONS[a] && !aHeroMayGiveTheAlignmentOrderAsKingOrNot(ALIGN_ACTIONS[a], c && c.isKing)) return false;
    // 2026-09-24 (Toby): a character whose sheet you cannot read gets NO mastery orders at all.
    // Item 8 had offered the whole L7/L9 set to such a card — since the levels are unseen, filtering
    // by level would have leaked them. But offering all twenty is its own leak in reverse: a player
    // could fish for hidden mastery by ordering Assassinate / Grand Heist / Wild Calling and reading
    // the result. Mastery is the mark of a hero who has served under you; it is not on the table for a
    // hero still being hired, nor for a mind you have merely charmed. A charmed WANDERER who joins
    // for good is an ordinary hero from next turn and the level gate below applies as usual.
    if (L79_ORDERS[a] && skillsUnseenP(c)) return false;
    // 2026-09-27 (Toby item 4): a realm raises ONE Grand Design in the whole game. Once the Wonder
    // stands, the order leaves every hero's dropdown — the engine already refuses a second, and an
    // order that can only ever be refused should not be on the form.
    if (a === 'Grand Design' && gdAlreadyBuiltP(report)) return false;
    if (L79_ORDERS[a] && !skillsUnseenP(c) && rawSkillLvl(c, L79_ORDERS[a].skill) < L79_ORDERS[a].lvl) return false;
    // Research (Sage 1+) and Steal (Thief 1+) are gated as the engine gates them: Research on the
    // character's BASE Sage (the research order reads the raw level), Steal on the Thief the turn
    // counts, his items' too (the steal order reads `effStat`; R-130: Gloves of the Nightcrawler
    // make an untrained hero a Thief 2). A CHARMED hero is the one exception: the charmer cannot see
    // their levels, so the placeholder card carries `skills:{}` and every lookup returns 0 — which
    // silently stripped both orders from a hero who may well have the skill. Offer them and let the
    // engine enforce the real requirement at resolution.
    if (a === 'Research' && !skillsUnseenP(c) && rawSkillLvl(c, 'sage') < 1) return false; // Research: Sage 1+ only (discovery roll)
    if (a === 'Steal' && !skillsUnseenP(c) && effSkillP(c, 'thief') < 1) return false; // Steal: Thief 1+, his items counted (R-130)
    if (a === 'Release Hero' && c && c.isKing) return false; // a king cannot release himself
    // ── A CHARMED HERO AND ITEMS: NONE OF IT ──────────────────────────────────────────────────────
    // 2026-09-12 hid Send Item from a charmed hero; 2026-09-18 replaced that with ONE engine-chosen
    // Send Item per turn; 2026-09-24 (Toby) SUPERSEDES both and settles the rule the other way, for
    // every direction items could travel: a charmed hero may not be GIVEN items, may not USE an item,
    // and may not SEND one to anybody. An enchanter borrows a mind for a season — they do not gain a
    // quartermaster. Nothing about the hero's own gear changes: they keep it, they fight with it, and
    // whatever passive magic they carry still works.
    // Enforced in the ENGINE too (give_item as sender AND as recipient, use_item — see isCharmedNow
    // in the GM portal), because a stale or hand-crafted submission would otherwise walk straight
    // past this form-level gate. Equip Items is deliberately left: it addresses the hero's OWN gear,
    // and the form can only ever show it as "not yours to see", so there is nothing to order.
    if (c && c._hiddenSkills && (a === 'Send Item' || a === 'Give Item' || a === 'Use Item' || a === 'Release Hero'))
      return false;
    // an ENEMY hero whose command you have seized for the turn is held by an enchantment, not an
    // oath — they will not disband companies that are not theirs, perform your realm's alignment
    // rites, or spend their own mastery for you. The engine refuses these orders at resolution too
    // (see the _charmTempControl guard in processOrder); this keeps them off the form. A WANDERING
    // hero charmed into permanent service has genuinely joined the realm and is unrestricted.
    if (c && c._charmEnemy && (L79_ORDERS[a] || ALIGN_ACTIONS[a] || a === 'Disband Army')) return false;
    return true;
  }).sort((a, b) => _actionRank(a) - _actionRank(b));
}

// 2026-10-08 (Toby item 12): the price of hiring THIS hero, as the engine will charge it. The report
// now sends it with every hireable hero (hireWage: alignment distance + the hero's skill premium, null
// for a hero who will not serve); the alignment-only estimate above is kept only for a report from an
// older engine that does not send it. Every hire price the order form shows goes through here, so the
// dropdown, the Broker list, the hired hero's card and the order ledger agree with the report.
export function heroHireWageOfP(h, report) {
  if (h && Object.prototype.hasOwnProperty.call(h, 'hireWage')) return h.hireWage;
  return heroHireWage(((report || {}).kingdom || {}).alignment || 'Neutral', h && h.alignment);
}

// ── TREASURY LEDGER (2026-09-23, Toby item 6; from orders-form.ts) ────
// A running account at the top of the orders column (sticky, like the report's jump-bar): what the
// treasury holds, what the orders entered so far will spend and on what, and an estimate of the
// treasury once this turn has resolved — after the season's tax comes in and every wage is paid,
// including the wages of the units recruited and heroes hired by these orders. Read straight from
// the live form (every order row, pre-order cards included) and refreshed on any change.
// Prices: native recruits from the province's own list, mercenaries from their sighting, hero
// wages from the alignment table, the rest from report.orderPrices (the GM engine's own figures).
// It is an ESTIMATE: an order that fails (unaffordable, target gone, province not taken) costs
// nothing, and Hunting Rumours pays per lair actually heard of.
// Since P1-11e29 (R-134), a company's price and wage follow the turn's cuts (src/shared/): a Druid 6 recruiter pays
// half for a beast; a beast in the column of a Druid 6 leader, or of a realm whose Druidic Wonder stands, pays half
// wages; and a company in the Host-Leader's column pays 1g less, where the report names him (his minorHeld: the titles
// public). Where a company musters is the turn's (whereTheCompaniesAHerosRecruitRaisesMuster). Since P1-11e30, the
// upkeep and hero-wage discoveries' cuts (Supply Depots, Granaries, Inspiring Leadership…) are each shared under the
// room the report gives it, a company or hero at a time, as Early Winter shares them; an older report's are the type's.
export function theTreasuryLedgerOnTheseOrders(report, orders) {
  const rep = report || {};
  const k = rep.kingdom || {};
  const P = rep.orderPrices || {};
  const wageOf = (t) => (P.unitWage && P.unitWage[t] != null ? P.unitWage[t] : (P.unitCost || {})[t] || 2);
  const mk = () => ({ g: 0, n: 0, wage: 0 });
  const cats = { armies: mk(), mercs: mk(), heroes: mk(), intel: mk(), other: mk() };
  const notes = new Set();
  const heroesAvail = Object.values(rep.provinceOrderData || {}).flatMap((pd) => pd.availableHeroes || []);
  const hired = new Set(),
    mercsTaken = new Set();
  // what each discovery's cut or ceiling has saved on the orders' new companies and heroes, under the room the report
  // gives it (R-134, P1-11e30)
  const theirSavings = new Map();
  const itsRoom = (x) => (x.theRoomLeftUnderItsCap == null ? undefined : x.theRoomLeftUnderItsCap);
  const upkeepCuts = Array.isArray(k.theUpkeepDiscoveriesCutsAndTheirRoom)
    ? k.theUpkeepDiscoveriesCutsAndTheirRoom
    : null;
  const theUpkeepCutsOn = (type) =>
    upkeepCuts.map((x) => {
      const g = (x.theGoldItCutsFromAUnitOfEachType || {})[type];
      return [x, g == null ? null : { theGold: g, itsOwnCeiling: itsRoom(x) }];
    });
  const theHeroWageCutsOn = (alignment) =>
    (k.theHeroWageDiscoveriesCutsAndTheirRoom || []).map((x) => {
      const g = (x.theGoldItCutsFromAHeroOfEachAlignment || {})[alignment];
      return [x, g == null ? null : { theGold: g, itsOwnCeiling: itsRoom(x) }];
    });
  const theHeroWageCeilings = (k.theHeroWageDiscoveriesCeilingsAndTheirRoom || []).map((x) => [
    x,
    { theWagesCeiling: x.theWagesCeiling, itsOwnCeiling: itsRoom(x) },
  ]);
  const hireHero = (hid) => {
    hid = String(hid);
    if (!/^\d+$/.test(hid) || hired.has(hid)) return;
    const h = heroesAvail.find((x) => String(x.id) === hid);
    if (!h) return;
    const w = heroHireWageOfP(h, rep);
    if (w == null) return;
    hired.add(hid);
    cats.heroes.g += w;
    cats.heroes.n++;
    cats.heroes.wage += aHerosWageAfterTheCutsAndTheCeilings(
      (x) => aWageAfterEachCut(theHeroWageCutsOn(h.alignment), x, theirSavings, null),
      (x) => aWageUnderEachCeiling(theHeroWageCeilings, x, theirSavings, null),
      w,
    );
  };
  (rep.characters || [])
    .filter((c) => c && c.alive !== false)
    .forEach((c) => {
      for (let ph = 0; ph < 5; ph++) {
        const act = theOrderField(orders, 'action', c.id, ph)?.value || '';
        if (!act) continue;
        const tgt = String(theOrderField(orders, 'target', c.id, ph)?.value || '');
        if (act === 'Recruit Armies') {
          const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, c.id, ph);
          const pd = loc ? (rep.provinceOrderData || {})[loc.id] : null;
          const ticks = tgt
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
          // the column each company joins, and the wage the turn charges it there (R-134, P1-11e29)
          const musters = whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders(report, orders, c, ph, ticks);
          const leader = musters.dest;
          const hisBeastsPayHalfWages = aLeadersBeastsPayHalfWages(
            rawSkillLvl(leader, 'druid') >= 6,
            () => !!k.itsDruidicWonderHalvesItsBeastsWages,
          );
          const heIsTheHostLeader = (leader.minorHeld || []).some((t) => t && t.key === 'hostleader');
          // (one company's: each draws on the upkeep discoveries' room in turn)
          const theWageOf = (type, joinsTheColumn) => {
            const halved = joinsTheColumn && hisBeastsPayHalfWages && aCompanyIsABeastADruidHalves(type);
            const raw = (P.unitCost || {})[type] || 2;
            let w;
            if (upkeepCuts) {
              // the turn halves the wage before the upkeep discoveries' cuts, each under its room (P1-11e30)
              w = aWageAfterEachCut(
                theUpkeepCutsOn(type),
                halved ? theWageABeastPaysUnderADruid(raw) : raw,
                theirSavings,
                null,
              );
            } else {
              // an older report: the cut it gives for the type, after the half
              w = wageOf(type);
              if (halved) w = Math.max(0, theWageABeastPaysUnderADruid(raw) - Math.max(0, raw - w));
            }
            return joinsTheColumn && heIsTheHostLeader ? theHostLeadersCut(w, 1).theWagesLeft : w;
          };
          const intoTheColumn = (type, unitName) =>
            musters.toTheColumn.some((u) => u.type === type && (unitName == null || u.unitName === unitName));
          ticks.forEach((tok) => {
            if (tok.startsWith('to:')) return;
            if (tok.startsWith('merc:')) {
              if (mercsTaken.has(tok)) return;
              const m = (rep.mercIntel || []).find((x) => 'merc:' + x.id === tok);
              if (!m) return;
              mercsTaken.add(tok);
              cats.mercs.g += m.cost || 0;
              cats.mercs.n++;
              cats.mercs.wage += theWageOf(m.type, intoTheColumn(m.type, m.unitName));
              return;
            }
            const [type, q] = tok.split('|');
            const n = Math.max(1, parseInt(q) || 1);
            const at = ((pd && pd.armyTypes) || []).find((a) => a.type === type);
            let cost = at && at.cost != null ? at.cost : (P.unitCost || {})[type] || 2;
            if (rawSkillLvl(c, 'druid') >= 6 && aCompanyIsABeastADruidHalves(type))
              cost = thePriceADruidPaysForABeast(cost); // a Druid 6 recruiter's half price (R-134)
            cats.armies.g += cost * n;
            cats.armies.n += n;
            for (let i = 0; i < n; i++) cats.armies.wage += theWageOf(type, intoTheColumn(type));
          });
        } else if (act === 'Hire Hero') {
          hireHero(tgt);
        } else if (act === 'Broker') {
          if (tgt.startsWith('hire:')) hireHero(tgt.slice(5));
          else if (tgt.startsWith('spy:')) {
            cats.intel.g +=
              P.brokerSpy != null ? P.brokerSpy : ALIGN_ACTIONS.Broker.theNumbers.thePriceOfWordFromAProvince.value;
            cats.intel.n++;
          }
        } else if (act === 'Harvest the Field') {
          cats.armies.g += P.harvest != null ? P.harvest : ALIGN_ACTIONS['Harvest the Field'].theNumbers.thePrice.value; // its row's, on a report that names no price
          cats.armies.n++;
          cats.armies.wage += 1; // a skeletal unit's wage is a flat 1g
        } else if (act === 'Perform Rite' && /^wild/i.test(tgt)) {
          const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, c.id, ph);
          const pd = loc ? (rep.provinceOrderData || {})[loc.id] : null;
          if (pd && pd.wildHuntCost != null) {
            cats.other.g += pd.wildHuntCost;
            cats.other.n++;
          } // bound beasts draw no wage
        } else if (act === 'Hunting Rumours') {
          // 2026-09-24 (Toby item 1): count the ticked lairs at their grade price (Weak 1 … Legendary
          // 4), the same figures the engine charges — read from the province the hero will stand in.
          const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, c.id, ph);
          const pd =
            (loc ? (rep.provinceOrderData || {})[loc.id] : null) || (rep.provinceOrderData || {})[c.locationId] || null;
          const feats = ((pd && pd.features) || []).filter((f) => !f.ritualSite && f.monster);
          tgt
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .forEach((ix) => {
              const f = feats.find((x) => String(x.idx) === ix);
              if (!f) return;
              cats.intel.g += RUMOUR_COST_BY_POWER_P[f.monsterPower] || 1;
              cats.intel.n++;
            });
        }
      }
    });
  const spend = Object.values(cats).reduce((s, x) => s + x.g, 0);
  const newWages = Object.values(cats).reduce((s, x) => s + x.wage, 0);
  const gold = k.gold || 0,
    tax = k.taxIncome || 0;
  const armyW = k.nextArmyWages != null ? k.nextArmyWages : k.armyWages || 0,
    heroW = k.nextHeroWages != null ? k.nextHeroWages : k.heroWages || 0;
  return {
    gold,
    spend,
    left: gold - spend,
    tax,
    armyW,
    heroW,
    newWages,
    cats,
    notes: [...notes],
    projected: gold - spend + tax - armyW - heroW - newWages,
  };
}

// (from order-chances.ts)
// ── ORDER SUCCESS CHANCE ────
// Quotes the odds the engine will roll for an order, from the `orderChance` block the GM ships (its
// own formulas, computed from the same effective skills the turn resolves with). Where a factor
// cannot be known at order time — an enemy's counter-espionage, whether a vault is guarded, who
// ends up practising alongside — the note says so instead of pretending the number is final.
export function chanceLine(txt, tone) {
  const col = tone === 'bad' ? 'var(--crimson)' : tone === 'sure' ? '#2d6a2d' : 'var(--forest)';
  return kcHtml`<div style="font-size:.72rem;color:${col};margin-top:2px">🎲 ${txt}</div>`;
}
export function theNoteUnderAnOrderThatQuotesItsChance(report, orders, c, action, ph) {
  const oc = (c && c.orderChance) || null;
  if (!oc) return '';
  const pct = (n) => kcHtml`<strong>${Math.max(0, Math.min(100, dispFloor(n)))}%</strong>`;
  switch (action) {
    case 'Spy': {
      const o = oc.spy || {};
      if (o.auto)
        return chanceLine(
          kcHtml`Success is <strong>certain</strong> — ${o.autoWhy || 'your craft'} never fails. Only an enemy's counter-espionage could trouble it.`,
          'sure',
        );
      if (!o.level)
        return chanceLine(kcHtml`No Spy skill — ${pct(o.chance || 20)} at best. Espionage rewards training.`, 'bad');
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Spy ${o.level}). A realm with Cipher Scripts is up to 25% harder to spy on.`,
      );
    }
    case 'Research': {
      const o = oc.research || {};
      if ((o.rawLevel || 0) < 1)
        return chanceLine('Research needs Sage 1+ — without it the archives yield nothing.', 'bad');
      return chanceLine(
        kcHtml`Discovery: ${pct(o.chance)} (Sage ${o.level}). A failed search still passes the season; nothing else is lost. Each failed Research this turn makes the hero's next one ×1.2 likelier (a discovery resets it).`,
      );
    }
    case 'Assassinate': {
      const o = oc.assassinate || {};
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Spy ${o.level}) — but only ${pct(Math.max(0, o.chance - (o.kingPenalty || 25)))} against a king, who is heavily guarded. Failure is noticed.`,
      );
    }
    case 'Steal': {
      const o = oc.steal || {};
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Thief ${o.level}), halved if the target leads troops or the paymaster is guarded. Fail and you are seen unless you slip away (${pct(o.escape)}).`,
      );
    }
    case 'Grand Heist': {
      const o = oc.grandHeist || {};
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Thief ${o.level}), halved if the vaults are guarded — a garrison, or an enemy commander here with troops. Fail and you are seen unless you slip away (${pct(o.escape)}).`,
      );
    }
    case 'Blockade':
      return chanceLine(
        kcHtml`The blockade forms ${pct((oc.blockade || {}).chance || 50)} of the time — wind and tide decide the rest.`,
      );
    case 'Practice Skill': {
      const o = oc.practice || {};
      const by = o.byLevel || [25, 20, 15, 10, 5];
      const _pick = KC_SKILLS.indexOf(theOrderField(orders, 'target', c.id, ph)?.value || '');
      const sel = _pick >= 0 ? KC_SKILLS[_pick] : ''; // only a skill the game knows is named in the note
      // the level he holds as the report gives it (the turn reads it as the phase begins: a rise earlier this turn is
      // a forecast limit, as is a failed practice's perseverance), and the chance the turn rolls when he practises
      // alone (R-134): the base by his level and his realm's practice discoveries (in percent on the report), x1.5 for
      // a Human of a Human realm; no roll at all once practice can raise it no further
      const lvl = sel ? (c.skills || {})[sel] || 0 : null;
      const scale = `Chance falls as mastery grows: ${by.map((v, i) => `${v}% at ${i}`).join(', ')}.`;
      const extra = `Practising alongside someone of equal level adds half again; anyone of HIGHER level teaches you, and the lesson cannot fail. A run of failures makes the next attempt likelier.`;
      if (lvl == null) return chanceLine(`${scale} ${extra}`);
      const label = SKILL_LABELS[sel] || sel;
      if (aSkillAtThisLevelIsPractisedNoFurther(lvl))
        return chanceLine(
          kcHtml`No roll is made: practice raises a skill only to level 5, and ${label} is at ${lvl}. Higher levels come only from experience in the field.`,
        );
      const discoveries = (o.astro || 0) + (o.discovery || 0) + (o.bySkill ? o.bySkill[sel] || 0 : 0); // + skill-scoped practice discoveries
      const quick = c.race === 'Human' && (report?.kingdom || {}).race === 'Human';
      const chance = theChanceAHeroPractisingAloneRaisesHisSkill(lvl, discoveries / 100, 0, quick) * 100;
      return chanceLine(
        kcHtml`Improvement: ${pct(chance)} at ${label} ${lvl}.${quick ? ' A Human of a Human realm learns half as fast again (×1.5).' : ''} ${extra}`,
      );
    }
    default:
      return '';
  }
}

export const rawMagicLvl = (charObj, school) => ((charObj && charObj.skills) || {})[school] || 0;

// The level of a magic school the order form offers spells by: the level the turn casts at (R-135, question 45 (c)),
// asked of the turn's own rule (theLevelAHerosSkillCountsAt: his trained level counts to 5, then his items' bonus and
// the aura stack to 9). The items' bonus and the aura are the report's (skillEff: each item name once, an equipped
// slot item only, a Crown of Command worn by a hero of his realm in his province, R-120); the trained level is the
// hero's own, or the one his earlier Practice orders project (projectedMagicLevels). A Curse ends with the turn, so no
// report shows one. The form forecasts from the report: if the Crown's wearer leaves before the cast, the turn casts
// without it.
export function effMagicLvl(charObj, school) {
  const trained = ((charObj && charObj.skills) || {})[school] || 0;
  const eff = charObj && charObj.skillEff && charObj.skillEff[school];
  return theLevelAHerosSkillCountsAt(school, trained, (eff && eff.items) || 0, (eff && eff.aura) || 0, 0);
}

// 2026-10-13 (item 2, Toby): the level each magic school may have reached by phase `ph`, assuming
// every Practice Skill order on it in an earlier phase succeeds (+1 each). Practice trains a skill
// only up to 5 (6–9 come from experience), so a school already at 5 or more gains nothing; item
// bonuses and the aura are then added as effMagicLvl does. `practising` is the set of schools with such an order.
export function theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise(orders, c, ph) {
  const practice = {};
  for (let prevPh = 0; prevPh < ph; prevPh++) {
    const prevAction = theOrderField(orders, 'action', c.id, prevPh)?.value || '';
    if (prevAction !== 'Practice Skill') continue;
    const t = theOrderField(orders, 'target', c.id, prevPh)?.value || '';
    if (t && KC_MAGIC_SCHOOLS.includes(t)) practice[t] = (practice[t] || 0) + 1;
  }
  const projected = {},
    trained = {};
  KC_MAGIC_SCHOOLS.forEach((school) => {
    const raw = rawMagicLvl(c, school),
      n = practice[school] || 0;
    const rawProj = raw >= 5 ? raw : Math.min(5, raw + n);
    trained[school] = rawProj;
    projected[school] = effMagicLvl({ ...c, skills: { ...((c && c.skills) || {}), [school]: rawProj } }, school);
  });
  // `trained`: each school's trained level after those practices (the Warlock's best school is read from it, R-123)
  return { practising: new Set(Object.keys(practice)), projected, practice, trained };
}
