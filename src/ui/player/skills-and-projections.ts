import { kcHtml, type KcSafeHtml } from '../shared/kc-safe.ts';
import { KC_HUMANOID_RACES, KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import {
  MONSTER_ARMIES,
  TAMED_FLYER_TYPES_D,
  aCompanyIsABeastADruidHalves,
  aLeadersBeastsPayHalfWages,
  druidALeaderBringsToAUnit,
  druidLevelALeaderNeeds,
  druidLevelTheMasteryCounts,
  druidMasteryGainOver,
  druidShortfall,
  CREATURE_ARMIES,
  seaLiftOfAColumn,
  strengthLeftByADruidShortfall,
  takesHalfAHullAboard,
  theDruidMasteryLiftsAUnitOfThisType,
  theItemsAHeroUses,
  theMasteryTierATrainedLevelGives,
  theStrengthAUnitHasBeforeTheGroundAndTheFoe,
  theWageABeastPaysUnderADruid,
  unitBaseStrength,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { kcJoinP } from './a-list-of-kchtml-pieces-joined-by-a-separator.ts';
import { ITEM_UNCAPPED_SKILLS_P } from './order-chances.ts';
import type { AnItemAsThePackReadsIt, TheReportAsThePagesListsReadIt } from './items-and-heroes.ts';
import {
  effSkillP,
  type ACompanyAsTheFormCarriesIt,
  type AHerosSkillsAsTheFormReadsThem,
  type TheEffectiveLevelsBySkill,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import {
  SKILL_LABELS,
  rawSkillLvl,
  type AHeroAsTheOrderFormReadsHim,
} from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';

/** One source of a skill's bonus as the report names it (skillEff's sources, skillExtra, combatSkillBonus). */
interface ASourceOfASkillsBonus {
  readonly label?: unknown;
  readonly delta?: number | undefined;
  readonly kind?: string | undefined;
  readonly scope?: string | undefined;
}
/** A source as the skill row shows it: its kind and scope always named. */
interface ASourceTheRowShows {
  readonly label: unknown;
  readonly delta: number | undefined;
  readonly kind: string;
  readonly scope: string;
}
/** The scoped sources by skill (skillExtra, combatSkillBonus). */
type TheScopedSourcesBySkill = Readonly<Partial<Record<string, readonly ASourceOfASkillsBonus[]>>>;
/** A hero as the skill row reads him: his levels, his effective levels with their base, bonus and sources, and the
 *  scoped extras. */
interface AHeroAsTheSkillRowReadsHim extends AHerosSkillsAsTheFormReadsThem {
  readonly skillEff?:
    | Readonly<
        Partial<
          Record<
            string,
            NonNullable<TheEffectiveLevelsBySkill[string]> & {
              readonly base?: number | undefined;
              readonly bonus?: number | undefined;
              readonly sources?: ASourceOfASkillsBonus[] | null | undefined;
            }
          >
        >
      >
    | null
    | undefined;
  readonly skillExtra?: TheScopedSourcesBySkill | null | undefined;
  readonly combatSkillBonus?: TheScopedSourcesBySkill | null | undefined;
}
/** A company as the army card and its label read it: the form's company, its wage, its move and its Wild Hunt marks. */
interface ACompanyAsTheArmyCardReadsIt extends ACompanyAsTheFormCarriesIt {
  readonly _isSkeletal?: unknown;
  readonly cost?: number | null | undefined;
  readonly moveRate?: number | null | undefined;
  readonly moveKind?: string | undefined;
  readonly _wildHuntUntilTurn?: number | null | undefined;
}
/** A hero as the army card reads him: the order form's hero, his items as the pack reads them. */
interface AHeroAsTheArmyCardReadsHim extends Omit<AHeroAsTheOrderFormReadsHim, 'items'> {
  readonly items?: readonly (AnItemAsThePackReadsIt | null | undefined)[] | null | undefined;
}
/** The skills' names, the sources' kinds, marks and words, and the beasts' classes, read by any key. */
const theSkillsNames: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;

// (ITEM_UNCAPPED_SKILLS_P is declared above effMagicLvl — see the note there.)
// ── BONUS SOURCE COLOURS ────
// Every skill bonus is coloured by WHERE it comes from, and every one is named in full beneath the
// skill list rather than hidden in a hover tooltip (a tooltip is unreachable on a phone, which is
// how half of these were effectively invisible). `kind` colours it; `scope` says when it applies.
export const BONUS_KIND_P = {
  item: { c: '#9a6b12', bg: '#f7edd4', label: 'Item' },
  aura: { c: '#b05e12', bg: '#fbe8d6', label: 'Aura' },
  title: { c: '#6a4a9a', bg: '#ece5f6', label: 'Title' },
  perk: { c: '#1f6f6f', bg: '#dcefef', label: 'Perk' },
  discovery: { c: '#2a5a8a', bg: '#dde9f5', label: 'Discovery' },
  // was a hardcoded #8b1a1a — an off-palette near-miss for the portal's own --crimson, and it
  // disagreed with the no-sources fallback a few lines below, which already paints a negative delta
  // with var(--crimson). One token, used by both branches, so every penalty reads the same red.
  curse: { c: 'var(--crimson)', bg: '#f6dede', label: 'Curse' },
};
export const BONUS_SCOPE_MARK_P = { combat: '⚔', battle: '⚑', move: '➤', order: '✎' };
export const BONUS_SCOPE_TEXT_P = {
  combat: 'personal combat only',
  battle: 'army battles only',
  move: 'movement points only',
  order: 'that order’s own roll only',
};
const theSourcesKinds: Readonly<
  Partial<Record<string, { readonly c: string; readonly bg: string; readonly label: string }>>
> = BONUS_KIND_P;
const theScopesMarks: Readonly<Partial<Record<string, string>>> = BONUS_SCOPE_MARK_P;
const theScopesWords: Readonly<Partial<Record<string, string>>> = BONUS_SCOPE_TEXT_P;
export function _bonusKindP(k: string): { readonly c: string; readonly bg: string; readonly label: string } {
  return theSourcesKinds[k] ?? { c: '#555', bg: '#eeeeee', label: 'Other' };
}
// Every source for one skill: the always-on ones the engine has already folded into the skill, then
// the scoped extras (minor titles, discoveries) that bite only at their own moment.
// `x.kind||'title'`. A report SNAPSHOTTED BEFORE the engine began tagging sources carries no `kind`
// at all, so every source in it fell to the default, and a Curse of −1 was therefore painted in the
// gold ITEM colour: a penalty that read on screen as a bonus. Old reports stay readable in the
// Chronicle for the life of a game, so the fallback has to be sign-aware — nothing that subtracts
// from a skill can be an item or a title.
export const _kindFallbackP = (delta: number | undefined, pos: string): string => ((delta ?? 0) < 0 ? 'curse' : pos);
export function _skillSourcesP(c: AHeroAsTheSkillRowReadsHim | null | undefined, k: string): ASourceTheRowShows[] {
  const e = c?.skillEff?.[k] ?? null;
  const out: ASourceTheRowShows[] = [];
  if (e && Array.isArray(e.sources))
    e.sources.forEach((x) =>
      out.push({
        label: x.label,
        delta: x.delta,
        kind: (x.kind ?? '') || _kindFallbackP(x.delta, 'item'),
        scope: 'always',
      }),
    );
  const extra = (c ? (c.skillExtra ?? c.combatSkillBonus) : undefined) ?? {};
  (extra[k] ?? []).forEach((x) =>
    out.push({
      label: x.label,
      delta: x.delta,
      kind: (x.kind ?? '') || _kindFallbackP(x.delta, 'title'),
      scope: (x.scope ?? '') || 'combat',
    }),
  );
  return out;
}
export function skillRowHTML(c: AHeroAsTheSkillRowReadsHim | null | undefined, style: string): KcSafeHtml | '' {
  const eff = c?.skillEff,
    raw = c?.skills ?? {};
  const extra = (c ? (c.skillExtra ?? c.combatSkillBonus) : undefined) ?? {};
  const keys = eff ? Object.keys(eff) : Object.keys(raw).filter((k) => (raw[k] ?? 0) > 0);
  // A skill with no training can still carry a bonus (an item that grants a school, a title perk);
  // make sure those rows appear instead of being filtered out along with the untrained zeroes.
  Object.keys(extra).forEach((k) => {
    if (!keys.includes(k)) keys.push(k);
  });
  const legendKinds = new Set<string>();
  const detail: KcSafeHtml[] = [];
  const rows = keys
    .map((k) => {
      const e = eff ? eff[k] : null;
      const base = e ? e.base : Number(raw[k]) || 0;
      const bonus = e ? Number(e.bonus) || 0 : 0;
      const srcs = _skillSourcesP(c, k);
      const cb = srcs.filter((s) => s.scope !== 'always').reduce((sm, x) => sm + (Number(x.delta) || 0), 0);
      if (Number(base) <= 0 && bonus <= 0 && cb <= 0) return '';
      const label = (theSkillsNames[k] ?? '') || k;
      const always = srcs.filter((s) => s.scope === 'always');
      const rawTotal = always.reduce((s, x) => s + (Number(x.delta) || 0), 0);
      // ── one coloured delta per SOURCE KIND, on the skill itself ── `bonus` is what the always-on
      // extras are actually WORTH after the engine's cap, so the kinds are shaved pro-rata to it: the
      // chips can never add up to more than the turn will use.
      const chips: KcSafeHtml[] = [];
      if (always.length && bonus !== 0) {
        const byKind: Partial<Record<string, number>> = {};
        const order: string[] = [];
        always.forEach((s) => {
          if (byKind[s.kind] === undefined) {
            byKind[s.kind] = 0;
            order.push(s.kind);
          }
          byKind[s.kind] = Number(byKind[s.kind]) + (Number(s.delta) || 0);
        });
        const posRaw = order.filter((x) => Number(byKind[x]) > 0).reduce((s, x) => s + Number(byKind[x]), 0);
        const neg = order.filter((x) => Number(byKind[x]) < 0).reduce((s, x) => s + Number(byKind[x]), 0);
        const posShown = Math.max(0, bonus - neg);
        let left = posShown;
        order.forEach((kind) => {
          const v = Number(byKind[kind]);
          const st = _bonusKindP(kind);
          let shown = v;
          if (v > 0) {
            shown = posRaw > 0 ? Math.min(left, Math.round((v * posShown) / posRaw)) : 0;
            left -= shown;
          }
          if (!shown) return;
          legendKinds.add(kind);
          chips.push(kcHtml`<span style="color:${st.c};font-weight:600">${shown > 0 ? '+' : ''}${shown}</span>`);
        });
      } else if (bonus !== 0) {
        chips.push(
          kcHtml`<span style="color:${bonus > 0 ? 'var(--gold)' : 'var(--crimson)'};font-weight:600">${bonus > 0 ? '+' : ''}${bonus}</span>`,
        );
      }
      // ── the scoped extras, each with the marker that says WHEN it bites ──
      const scoped: Partial<Record<string, Partial<Record<string, number>>>> = {};
      const scOrder: string[] = [];
      srcs
        .filter((s) => s.scope !== 'always')
        .forEach((s) => {
          let theScope = scoped[s.scope];
          if (!theScope) {
            theScope = {};
            scoped[s.scope] = theScope;
            scOrder.push(s.scope);
          }
          theScope[s.kind] = (Number(theScope[s.kind]) || 0) + (Number(s.delta) || 0);
        });
      scOrder.forEach((sc) => {
        const theScope = scoped[sc];
        if (theScope === undefined) throw new TypeError(`no sources of the scope ${sc}`);
        Object.keys(theScope).forEach((kind) => {
          const v = theScope[kind];
          if (!v) return;
          const st = _bonusKindP(kind);
          legendKinds.add(kind);
          chips.push(
            kcHtml`<span style="color:${st.c};font-weight:600">(${v > 0 ? '+' : ''}${v}${theScopesMarks[sc] ?? ''})</span>`,
          );
        });
      });
      // ── every source NAMED, collected for the breakdown line under the skills ──
      if (srcs.length) {
        const bits = srcs.map((s) => {
          const st = _bonusKindP(s.kind);
          return kcHtml`<span style="background:${st.bg};color:${st.c};border-radius:2px;padding:0 4px;white-space:nowrap">${Number(s.delta) > 0 ? '+' : ''}${s.delta} ${s.label}${s.scope !== 'always' ? ` ${theScopesMarks[s.scope] ?? ''}` : ''}</span>`;
        });
        if (rawTotal > 0 && bonus < rawTotal)
          bits.push(
            kcHtml`<span style="color:#3a3224">(capped at ${ITEM_UNCAPPED_SKILLS_P.has(k) || k === 'druid' ? 9 : 5})</span>`,
          );
        detail.push(
          kcHtml`<span style="white-space:normal"><strong style="color:#231e16">${label}</strong> ${kcJoinP(bits, ' ')}</span>`,
        );
      }
      // melee and archery let item/aura bonuses stack above trained 5 to the ceiling of 9; every
      // other skill still stops at 5. Mirrors ITEM_UNCAPPED_SKILLS in the GM engine.
      const _ceil = ITEM_UNCAPPED_SKILLS_P.has(k) || k === 'druid' ? 9 : 5;
      const parts = srcs.map(
        (s) =>
          `${Number(s.delta) > 0 ? '+' : ''}${String(s.delta)} ${String(s.label)}${s.scope !== 'always' ? ` (${theScopesWords[s.scope] ?? ''})` : ''}`,
      );
      if (rawTotal > 0 && bonus < rawTotal) parts.push('capped at ' + String(_ceil));
      const tip = parts.length ? kcHtml` title="${label + ' ' + String(base) + ' — ' + parts.join(', ')}"` : '';
      return style === 'tags'
        ? kcHtml`<span class="skill-tag"${tip}>${label} ${base}${chips}</span>`
        : kcHtml`<span style="color:var(--forest)"${tip}><strong>${label}:</strong> ${base}${chips}</span>`;
    })
    .filter(Boolean);
  if (!rows.length) return style === 'tags' ? '' : kcHtml`<span style="color:#aaa">No skills</span>`;
  const out: unknown[] = [rows];
  if (detail.length) {
    const legend = kcJoinP(
      [...legendKinds].map((kd) => {
        const st = _bonusKindP(kd);
        return kcHtml`<span style="color:${st.c}">● ${st.label}</span>`;
      }),
      ' ',
    );
    out.push(
      kcHtml`<span style="flex-basis:100%;width:100%;margin-top:3px;font-size:.68rem;color:#2a2419;line-height:1.8;display:block">${[
        kcHtml`<span style="color:#3a3224;text-transform:uppercase;letter-spacing:.04em">Skill bonuses</span> ${legend}`,
        kcHtml`<span style="display:block;margin-top:2px">${kcJoinP(detail, kcHtml` &nbsp; `)}</span>`,
        kcHtml`<span style="display:block;color:#3a3224;margin-top:1px">⚔ personal combat &middot; ⚑ army battles &middot; ➤ movement &middot; ✎ that order&rsquo;s roll — these never change the skill itself</span>`,
      ]}</span>`,
    );
  }
  return kcHtml`${out}`;
}

export function capitalise(s: string | null | undefined): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
// Every primal sub-race is either a Creature or a Monster (the engine's CREATURE_ARMIES / MONSTER_ARMIES sets, which
// src/shared/ hands the portal since P1-11d12 — Druidic favours Creatures, Evil favours Monsters). "Primal" is an
// internal engine term; players only ever see Creature or Monster. Where only the unit type is known (race stored as a
// bare 'Primal'), formatRace reads the unit's class from those sets.
export const HUMANOID_RACES_UI = new Set(KC_HUMANOID_RACES);
const theHumanoidRaces: ReadonlySet<string> = HUMANOID_RACES_UI;
// ── DRUID: WHAT DOES THIS COMMANDER NEED TO LEAD THIS UNIT? (2026-09-27) ────────────────────────
// The order form's Druid line and the army card ask this. The rule is the engine's own, shared through src/shared/
// (plan P1-11b3): the Druid a unit needs with its waivers (druidLevelALeaderNeeds, which reads KC_DRUID_LEVELS, the
// one table), the same-race Druid 1 (druidALeaderBringsToAUnit) and the shortfall (druidShortfall). What stays the
// portal's is the commander's Druid it feeds in: the report's effective level (effSkillP), which counts a Crown of
// Command's +1 as the battle's druIdPenaltyMult does (R-120).
//   req       — Druid needed after waivers: skeletons 0; a creature under a Druidic realm OR a
//               personally Druidic commander 0; a monster under an Evil realm OR a personally Evil
//               commander 0; a winged beast with sd40 Dragon Taming 0
//   effDru    — the commander's Druid, counted as at least 1 for units of his own race
//   shortfall — levels short (each costs 20% strength in battle)
//   counts    — whether leading this unit depends on Druid training at all (an own-race unit's
//               level-1 need is met by birth, so it does not count)
export function druidNeedP(
  a: ACompanyAsTheArmyCardReadsIt | null | undefined,
  c: AHeroAsTheArmyCardReadsHim | null | undefined,
  report?: TheReportAsThePagesListsReadIt | null,
): { readonly req: number; readonly effDru: number; readonly shortfall: number; readonly counts: boolean } {
  const rep = report ?? currentReport ?? {};
  if (!a || a.skeletal || a._isSkeletal) return { req: 0, effDru: 0, shortfall: 0, counts: false };
  const realmAlign = (rep.kingdom?.alignment ?? '') || null;
  const tamed = TAMED_FLYER_TYPES_D.has(a.type) && (rep.discoveries ?? []).some((d) => d?.id === 'sd40');
  const req = druidLevelALeaderNeeds(a.type, realmAlign, c?.alignment, tamed);
  const druLevel = effSkillP(c, 'druid');
  const sameRace = !!(a.race && a.race === c?.race);
  const effDru = druidALeaderBringsToAUnit(druLevel, sameRace);
  return { req, effDru, shortfall: druidShortfall(req, effDru), counts: req > 0 && !(sameRace && req <= 1) };
}
// The army card's figures for the column `arr` the hero `c` leads, on the report `report` (renderReportView's
// "Armies leading"): each unit's Druid need, shortfall, mastery, kin and strength, and the column's total strength,
// upkeep and Druid counts, with the hero's Druid level the card's beast count reads.
export function theArmyCardsFiguresOfAColumn(
  arr: readonly ACompanyAsTheArmyCardReadsIt[],
  c: AHeroAsTheArmyCardReadsHim,
  report: TheReportAsThePagesListsReadIt,
) {
  const kingdom = report.kingdom ?? {};
  const druLevel = effSkillP(c, 'druid');
  // the wage the turn charges: a beast he leads pays half if he holds Druid 6 or his realm's Druidic Wonder
  // stands (aLeadersBeastsPayHalfWages, as Early Winter asks it: R-135); a summons and a Wild Hunt beast draw
  // none, a skeleton its 1g, halved or not
  const hisBeastsPayHalfWages = aLeadersBeastsPayHalfWages(
    rawSkillLvl(c, 'druid') >= 6,
    () => !!kingdom.itsDruidicWonderHalvesItsBeastsWages,
  );
  // Druid requirement, waivers and shortfall: ONE rule, druidNeedP (the engine's, with the portal's level).
  let totalStr = 0,
    totalCost = 0,
    druidUnits = 0,
    druidShort = 0;
  const units = arr.map((a) => {
    // The unit's strength as the turn counts it before the ground, the foe and the battle's tactics (R-135,
    // question 45 (a)): armStr's own steps in its order (theStrengthAUnitHasBeforeTheGroundAndTheFoe), the
    // shortfall and the mastery below handed in.
    const creature = CREATURE_ARMIES.has(a.type),
      monster = MONSTER_ARMIES.has(a.type);
    const _dn = druidNeedP(a, c, report); // skeleton / Druidic-creature / sd40 waivers, same-race Druid 1
    const req = _dn.req;
    if (_dn.counts) druidUnits++;
    const effDru = _dn.effDru;
    const shortfall = _dn.shortfall;
    // a Druid shortfall actually REDUCES the unit's strength — the share it leaves (the engine's own
    // strengthLeftByADruidShortfall: max(0.1, 1−0.2×shortfall)) comes off the unit's base strength, rounded
    // down, as the battle takes it, instead of only tagging the penalty beside a full-strength number.
    let theShareHisShortfallLeaves = 1;
    if (shortfall > 0) {
      druidShort++;
      theShareHisShortfallLeaves = strengthLeftByADruidShortfall(shortfall);
    }
    // DRUID MASTERY (2026-09-24; the engine's own rule, as druidMasteryGain asks it): on a living
    // Creature or Monster, +20% per Druid level over the unit's minimum (0 where the requirement is
    // waived), Druid counted to 9, capped +100%; shown in percent, and applied after the kin below, as
    // in the battle.
    const mastery = theDruidMasteryLiftsAUnitOfThisType(a.type, a.skeletal)
      ? Math.round(druidMasteryGainOver(druidLevelTheMasteryCounts(druLevel), req) * 100)
      : 0;
    // In armStr's order: Druid 8 and Necromancy 6 lift its quality (his trained levels); its base strength at
    // that quality; the shortfall, rounded down; its kin (+20% your king's, +20% its leader's: +44% both) and
    // a rival kin's leader (−20%); the items he uses; the Druid mastery; his minor titles (those the report
    // names). Your realm's unit-strength discoveries, and what a battle or a spell of the turn adds, are left out.
    const _str = theStrengthAUnitHasBeforeTheGroundAndTheFoe(
      { unitType: a.type, quality: a.quality, isSkeletal: !!a.skeletal, race: a.race },
      {
        hisDruidMasteryTier: theMasteryTierATrainedLevelGives(rawSkillLvl(c, 'druid')),
        hisNecromancyMasteryTier: theMasteryTierATrainedLevelGives(rawSkillLvl(c, 'necromancy')),
        theShareHisDruidShortfallLeaves: theShareHisShortfallLeaves,
        theKingsRace: kingdom.race,
        hisRace: c.race,
        // (not yet: the report doesn't carry its discoveries' effects, and the page holds no table of them)
        theRealmsUnitStrengthEffects: [],
        heIsTheKing: !!c.isKing,
        theItemsHeUses: theItemsAHeroUses(c.items ?? [], c),
        theRealmsAlignment: kingdom.alignment,
        hisDruidMasteryGain: mastery / 100,
        heHoldsTheMinorTitle: (title) => (c.minorHeld ?? []).some((t) => t?.key === title),
      },
    );
    const kingRaceMatch = _str.theKin.itsKingIsOfItsKin;
    const leadRaceMatch = _str.theKin.itsLeaderIsOfItsKin;
    const feudLed = _str.theKin.aLeaderOfItsRivalKinLeadsIt;
    const bs = _str.strength;
    totalStr += bs;
    const wage = a.cost ?? 2;
    totalCost +=
      hisBeastsPayHalfWages && !a.temporary && !a.wildHunt && aCompanyIsABeastADruidHalves(a.type)
        ? theWageABeastPaysUnderADruid(wage)
        : wage;
    return {
      creature,
      monster,
      req,
      effDru,
      shortfall,
      theShareHisShortfallLeaves,
      mastery,
      kingRaceMatch,
      leadRaceMatch,
      feudLed,
      bs,
    };
  });
  return { druLevel, units, totalStr, totalCost, druidUnits, druidShort };
}
// The army card's air and sea notes for the column `arr` the hero `c` leads (renderReportView's "Armies leading"),
// as the words the card shows.
export function theArmyCardsAirAndSeaNotesOfAColumn(
  arr: readonly ACompanyAsTheArmyCardReadsIt[],
  c: AHeroAsTheArmyCardReadsHim,
): { readonly _airNote: KcSafeHtml | ''; readonly _seaNote: KcSafeHtml | '' } {
  // FLYING CARRY note. If humanoid flyers are lifting foot soldiers (a mixed airborne
  // column that can cross sea), tell the player so the raised speed and sea reach make
  // sense.
  const _FLY_UI2 = new Set(KC_UNIT_CLASS.flying);
  const _SEA_UI2 = new Set(KC_UNIT_CLASS.sea);
  const _AER_UI2 = new Set(KC_UNIT_CLASS.aerial);
  const _hasFlyer = arr.some((a) => _FLY_UI2.has(a.type));
  const _hasFoot = arr.some((a) => !_AER_UI2.has(a.type) && !_SEA_UI2.has(a.type));
  const _airborne = _hasFlyer && _hasFoot && !arr.some((a) => _SEA_UI2.has(a.type)) && Number(c.effectiveSeaSpeed) > 0;
  const _airNote = _airborne
    ? kcHtml` · <span style="color:#2d6a8a">🦅 Airborne — the flyers carry the foot soldiers, so the whole force flies (crosses sea, moves at the flyers' pace)</span>`
    : '';
  // sea transport: whether this force can put to sea is the turn's own answer (seaLiftOfAColumn, which
  // getSeaCapability and the Move note ask too: R-135): its hulls (each carries double under a trained Naval
  // of 8 or more, R-125) and its humanoid flyers pool their lift. The figures explain it: the hulls its land
  // units need (light foot half a hull, the rest a whole one), the berths it has, the units left ashore.
  const _naval8 = (c.skills?.['naval'] ?? 0) >= 8;
  const _lift = seaLiftOfAColumn(arr, _naval8);
  const _landUnits = arr.filter((a) => !_AER_UI2.has(a.type) && !_SEA_UI2.has(a.type));
  let _hullNeed = _landUnits.reduce((n, a) => n + (takesHalfAHullAboard(a) ? 0.5 : 1), 0);
  if (_naval8) _hullNeed /= 2;
  const _hullNeedShown = Math.ceil(_hullNeed);
  const _hullHave = _lift.berths; // berths: a turtle's Island Back offers two
  const _ashore = _lift.unitsLeftAshore.length;
  const _hulls = kcHtml`needs ${_hullNeedShown} hull${_hullNeedShown !== 1 ? 's' : ''}, has ${_hullHave}`;
  let _seaNote: KcSafeHtml | '';
  if (_lift.answer === 'all')
    _seaNote = kcHtml` · ⚓ <span style="color:#2d6a8a">Sea: every unit sails or flies on its own</span>`;
  else if (_airborne) _seaNote = '';
  else if (_lift.answer === 'sea' && _hullHave >= _hullNeed)
    _seaNote = kcHtml` · ⚓ <span style="color:#1d5a1d">Sea transport: ${_hulls} — can put to sea</span>`;
  else if (_lift.answer === 'sea')
    _seaNote = kcHtml` · ⚓ <span style="color:#1d5a1d">Sea transport: ${_hulls}, and the flyers carry the rest — can put to sea</span>`;
  else
    _seaNote = kcHtml` · ⚓ <span style="color:var(--crimson)">Sea transport: ${_hulls} — ${_ashore} unit${_ashore !== 1 ? 's' : ''} left ashore: more fleet units or flyers to carry the whole force</span>`;
  return { _airNote, _seaNote };
}
export const PRIMAL_SUBRACE_CLASS = {
  'Stone Giant': 'Creature',
  'Forest Ent': 'Creature',
  Thunderbird: 'Creature',
  'Giant Eagle': 'Creature',
  Roc: 'Creature',
  Whale: 'Creature', // 'Giant Eagle' and 'Leviathan': older reports, before the renames of 2026-10-13
  'Great Bear': 'Creature',
  Unicorn: 'Creature',
  Mammoth: 'Creature',
  'Great Turtle': 'Creature', // 2026-10-13 (Creatures and Monsters IV)
  'Cave Troll': 'Monster',
  Manticore: 'Monster',
  Basilisk: 'Monster',
  Dragon: 'Monster',
  Titan: 'Monster',
  'Sea Giant': 'Monster',
  Kraken: 'Monster',
  Hydra: 'Monster',
  Leviathan: 'Monster',
  Shark: 'Monster',
};
// Present a province/unit race cleanly: humanoid races as-is, primal provinces as their
// player-facing
// category — 'Primal:Stone Giant' → 'Creature (Stone Giant)', 'Primal:Cave Troll' → 'Monster (Cave
// Troll)' — and empty/sea provinces as 'Uninhabited'. Never shows the word "Primal".
const thePrimalSubracesClass: Readonly<Partial<Record<string, string>>> = PRIMAL_SUBRACE_CLASS;
export function formatRace(race: string | null | undefined, unitType?: string | null): string {
  if (!race) return 'Uninhabited';
  if (race.startsWith('Primal')) {
    const sub = race.slice(7).trim(); // '' for bare 'Primal', else the sub-race after 'Primal:'
    // Bare 'Primal' (as stored on sea beasts and recruited Whale Cohorts) carries no sub-race, so
    // fall back to classifying the UNIT TYPE — otherwise every Kraken and Leviathan read
    // "Creature".
    if (sub) return (thePrimalSubracesClass[sub] ?? '') || 'Creature';
    if (unitType) return MONSTER_ARMIES.has(unitType) ? 'Monster' : 'Creature';
    return 'Creature';
  }
  return race;
}

// Primal army speeds (for UI calculations) — built from the one primal table in the data file (2026-10-13:
// this was a hand-typed copy, and the roster PR would have left it a move behind).
export const PRIMAL_ARMY_SPEEDS = Object.fromEntries(Object.entries(PRIMAL_ARMY_DEFS_P).map(([t, d]) => [t, d.speed]));

// Army display helper — shows unit name if known, falls back to plain type+quality
export function armyLabel(
  a: ACompanyAsTheArmyCardReadsIt,
  opts: { readonly short?: unknown; readonly noMove?: unknown } = {},
): KcSafeHtml | string {
  const name = a.unitName ?? '';
  if (opts.short) return name ? name : `${String(a.quality)} ${a.type}`;
  // Classification first, then type, quality and the unit's base strength (type × quality tier) —
  // enough to judge a force at a glance without opening the rules. primal armies always lead with
  // the full word 'Creature' or 'Monster' (derived from the unit TYPE, so it shows even when the
  // army carries no race field — e.g. awakened/recruited beasts), and no separate [C]/[M] tag is
  // used.
  const primalWord = CREATURE_ARMIES.has(a.type) ? 'Creature' : MONSTER_ARMIES.has(a.type) ? 'Monster' : null;
  const race = a.race ? formatRace(a.race, a.type) : null;
  // a unit with a HUMANOID race leads with that race — "Orcish (Monster), Wyvern Riders" — so an
  // Orc garrison of wyverns is not mistaken for a primal band. Only raceless / primal units lead
  // with the bare Creature / Monster word.
  const _humanoidRace = !!(a.race && theHumanoidRaces.has(a.race));
  const lead = _humanoidRace ? (primalWord ? `${String(race)} (${primalWord})` : race) : (primalWord ?? race);
  const str = unitBaseStrength(a);
  // 2026-09-23 (Toby item 7): the unit's own movement rate after its strength — computed by the GM
  // report with every bonus the engine applies (March / Naval incl. items, Road & race `move`
  // discoveries, the Swift / Sea-Wolf titles). Shown only where the report supplies it (your led
  // units and garrisons); a column still moves at its slowest unit.
  const _mv =
    a.moveRate != null && !opts.noMove
      ? `Move ${String(a.moveRate)}${a.moveKind === 'sea' ? ' (sea)' : a.moveKind === 'air' ? ' (air)' : ''}`
      : null;
  // 2026-09-23b: labelled BASE — it is type × quality only (no kinship, terrain, Tactical…), so it
  // never matches a battle figure; the Battle stats ladder starts from exactly this number.
  const detail = [lead, a.type, a.quality, `Base str ${String(str)}`, _mv].filter(Boolean).join(', ');
  // beasts bound by the Rite of the Wild Hunt are flagged wherever an army line is rendered — they
  // draw no wages and leave when the binding fails.
  const wild =
    a.wildHunt || a._wildHuntUntilTurn != null
      ? kcHtml` <span style="color:#7a4a10;font-size:.72rem">[Wild Hunt — bound until end of turn ${a.wildHuntUntil ?? a._wildHuntUntilTurn ?? '?'}, no wages]</span>`
      : '';
  return kcHtml`${name ? `${name} (${detail})` : detail}${wild}`;
}
