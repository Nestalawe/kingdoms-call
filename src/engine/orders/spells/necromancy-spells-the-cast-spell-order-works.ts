// The Necromancy action spells the Cast Spell order works (plan P1-19z).
// Each is its branch of resolveCastSpellOrder's chain, moved as it was: the names it read from the function it takes
// as one object (what-an-action-spell-of-the-cast-spell-order-is-handed.ts), a `return;` made `return false;` ("the
// cast ends here": no skill gain) and its end `return true;` ("the spell is worked"). The table in the-action-
// spells-the-cast-spell-order-works-by-slug.ts finds each by its slug.
import { KC_QUALITY_UP } from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import { unitBaseStrength } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import { noteGraveIntel, skeletalRaiseCount, takeBestGrave } from '../../graves.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { getNeighborsP } from '../../world/map-helpers.ts';
import { gdActive } from '../../discoveries.ts';
import {
  emit,
  logSplit,
  notifyProvinceOwner,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
} from '../../turn/events-and-their-audiences.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { applyPlague, blessWardNegates } from '../../magic/plague-and-bless-ward.ts';
import { SKILLGAIN_STD, trySkillGain } from '../../heroes/experience-skill-rises-and-earned-hp.ts';
import { resolveUnitGainInProvince } from '../../battle/hosts-gained-in-a-province.ts';
import { theGravesAsTheLineCountsThem } from '../the-facts-the-cast-spell-orders-lines-record.ts';
import { asItsGuardReadsIt } from '../../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import {
  aRealmsNameOrNone,
  theProvinceTheCasterStandsIn,
  theOneThePickFell,
  theOneTakenOut,
} from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { TheNamesAnActionSpellIsHanded } from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

/** The work of control-undead (`necromancy_control`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workControlUndead({
  turnContext,
  G,
  c,
  ph,
  extra,
  prov,
  school,
  targetChar,
}: TheNamesAnActionSpellIsHanded): boolean {
  // Province-scan mode: cast on the province the caster stands in to sense the battlefield
  // dead lying there (the units a Skeletal Armies cast could raise).
  //
  // AN UNTARGETED CONTROL UNDEAD IS A PROVINCE SCAN. The spell has two modes and the order
  // form offers both in one dropdown, whose default option is the empty "— Target character
  // —". A player who chose Control Undead and left that default sent `extra:''`, which fell
  // through to the seize-a-unit branch and was reported as "no valid target hero stands in
  // <province> this phase" — a failure, for a spell that had a perfectly good thing to do
  // where the caster was standing. An empty target is now read as the scan: there is always
  // a province underfoot, so the cast is never wasted.
  if (extra === '' || extra == null || extra === '__scan__') {
    const graves = prov.battleGraves ?? [];
    if (graves.length === 0) {
      noteGraveIntel(G.players[c.player], prov.id, G.turn, []); // seen bare — forget any stale record
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'Control Undead senses no dead in the province', heroName: c.name, provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      noteGraveIntel(G.players[c.player], prov.id, G.turn, graves); // the fuller reading is kept in Graveyards known
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'Control Undead senses the dead of the province',
          heroName: c.name,
          provinceName: prov.name,
          graves: theGravesAsTheLineCountsThem(graves),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
    // THE SPELL REACHES PAST THE PROVINCE LINE. The caster also feels which of the
    // SURROUNDING provinces hold battlefield dead. That is all it gives: existence, never
    // the count and never what the graves hold — for that a caster must stand on the ground
    // and scan it. Each neighbour is written into the realm's graveyard lore with `null`
    // detail, which noteGraveIntel treats as a bare sensing (any richer reading already on
    // record keeps its own older turn stamp and is NOT downgraded); a neighbour sensed
    // EMPTY is written as `[]`, which clears any stale promise of graves there. Both feed
    // the report's Graveyards Known.
    {
      const _pl = G.players[c.player];
      const _nbrs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter(
        (p2) => asItsGuardReadsIt(p2)?.id != null,
      );
      const _withDead: string[] = [];
      _nbrs.forEach((nb) => {
        if ((nb.battleGraves ?? []).length > 0) {
          noteGraveIntel(_pl, nb.id, G.turn, null);
          _withDead.push(nb.name);
        } else noteGraveIntel(_pl, nb.id, G.turn, []);
      });
      if (_withDead.length > 0)
        emit(turnContext, {
          type: 'explore',
          fact: {
            kind: 'the sending finds battlefield graves in the provinces around',
            heroName: c.name,
            provinceName: prov.name,
            provincesWithDead: _withDead.sort(),
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      else if (_nbrs.length > 0)
        emit(turnContext, {
          type: 'explore',
          fact: { kind: 'the sending finds the provinces around quiet', heroName: c.name, provinceName: prov.name },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
    }
    trySkillGain(turnContext, c, school, SKILLGAIN_STD);
    return false;
  }
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Control Undead finds no hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Control Undead cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const undeadIdxs = (asItsGuardReadsIt(targetChar.armies) ?? [])
    .map((a, i) => ({ a, i }))
    .filter(
      (x) =>
        (x.a._isSkeletal ?? false) ||
        x.a.race === 'Undead' ||
        /Skelet|Bone|Wraith|Zombie|Ghoul|Lich/i.test(x.a.type || ''),
    );
  if (undeadIdxs.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "Control Undead finds no undead among a hero's forces",
        heroName: c.name,
        targetName: targetChar.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return false;
  }
  const pick = theOneThePickFell(undeadIdxs[Math.floor(kcRng() * undeadIdxs.length)]);
  const seized = theOneTakenOut(targetChar.armies, pick.i);
  c.armies = asItsGuardReadsIt(c.armies) ?? [];
  c.armies.push(seized);
  logSplit(
    turnContext,
    'hire',
    {
      kind: 'Control Undead wrests a company from a hero',
      heroName: c.name,
      unitName: seized.unitName || seized.type,
      targetName: targetChar.name,
      provinceName: prov.name,
    },
    {
      kind: 'onlookers see Control Undead wrest a company from a hero',
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      unitName: seized.unitName || seized.type,
      targetName: targetChar.name,
      targetsRealmName: aRealmsNameOrNone(G.players, targetChar.player),
      provinceName: prov.name,
    },
    {
      audience: { actor: c.player },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      alsoNotFor: [targetChar.player],
    },
  );
  notifyTarget(
    turnContext,
    targetChar,
    {
      kind: 'a hero learns Control Undead wrested a company from him',
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      unitName: seized.unitName || seized.type,
      targetName: targetChar.name,
      provinceName: prov.name,
    },
    ph,
    'hire',
  );
  resolveUnitGainInProvince(turnContext, c, prov, ph);

  return true;
}
/** The work of skeletal-armies (`necromancy_skeletal`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workSkeletalArmies({ turnContext, c, ph, prov }: TheNamesAnActionSpellIsHanded): boolean {
  // Skeletal Armies: raise destroyed armies from this province's battlefield graves
  const graves = prov.battleGraves ?? [];
  if (graves.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Skeletal Armies finds no dead to answer', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return false;
  }
  // Units raised per cast scale with the caster's Necromancy (benefit scale, items count):
  // 1 at level 1-2, 2 at level 3-4, 3 at level 5+ — never more than the graves hold. An
  // item-cast by a non-necromancer (Reaper's Bell, Ossuary Key) raises one.
  const _skN = skeletalRaiseCount(effStat(turnContext, c, 'necromancy'));
  const _uTier = gdActive(turnContext, c.player, 'Undead'); // GRAND DESIGN — Undead: +1 tier when raised
  // the tier above each quality, by any quality
  const qualityUp: Readonly<Partial<Record<string, string>>> = KC_QUALITY_UP;
  for (let _sk = 0; _sk < _skN && (prov.battleGraves ?? []).length > 0; _sk++) {
    const grave = takeBestGrave(prov); // the most experienced dead answer first
    if (!grave) break;
    const skel = {
      type: grave.type,
      quality: _uTier ? (qualityUp[grave.quality] ?? '') || grave.quality : grave.quality,
      race: 'Undead',
      _isSkeletal: true,
      unitName: `${String(grave.unitName || armyUnitName(grave.type))} (Skeletal)`,
    };
    c.armies = asItsGuardReadsIt(c.armies) ?? [];
    c.armies.push(skel);
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'a skeletal company rises from the graves',
        heroName: c.name,
        unitName: skel.unitName,
        quality: skel.quality,
        unitType: skel.type,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  // the caster has just gained a unit here — if this is a neutral/enemy province, that
  // force must fight any defenders this phase, or take control if the land is undefended.
  resolveUnitGainInProvince(turnContext, c, prov, ph);

  return true;
}
/** The work of curse (`necromancy_curse`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workCurse({ turnContext, c, ph, prov, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Curse finds no hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Curse cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // EVERY skill the target has is halved (rounded down) for the rest of the turn — was the
  // single highest skill. A second Curse the same turn halves what is left again.
  const _cursed = Object.entries(asItsGuardReadsIt(targetChar.skills) ?? {}).filter(
    (e): e is [string, number] => e[1] !== undefined && e[1] > 0,
  );
  if (!_cursed.length) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero has no skills to curse', targetName: targetChar.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  targetChar._curses = targetChar._curses ?? {};
  const theCurses = targetChar._curses;
  const _parts = _cursed.map(([sk, val]) => {
    const cur = Math.max(0, val - (Number(theCurses[sk]) || 0)); // what the skill IS right now, after any earlier curse
    const reduce = cur - Math.floor(cur / 2);
    theCurses[sk] = (Number(theCurses[sk]) || 0) + reduce;
    return { skill: sk, levelBefore: cur };
  });
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a Curse halves a hero's skills",
      heroName: c.name,
      targetName: targetChar.name,
      skills: [..._parts],
    },
    audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  notifyTarget(
    turnContext,
    targetChar,
    {
      kind: 'a hero learns a Curse settles over him',
      heroName: c.name,
      targetName: targetChar.name,
      skills: [..._parts],
    },
    ph,
    'combat',
  );

  return true;
}
/** The work of plague (`necromancy_plague`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workPlague({
  turnContext,
  G,
  c,
  ph,
  spellLevelEff,
  targetProv,
}: TheNamesAnActionSpellIsHanded): boolean {
  // Target the caster's province or an adjacent one.
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Plague is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetProv._plaguedTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a province is already stricken with plague this turn', provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (blessWardNegates(turnContext, targetProv, c, 'Plague')) return false;
  targetProv._plaguedTurn = G.turn;
  targetProv._plagueLevel = spellLevelEff;
  targetProv._plagueCaster = c.player;
  const res = applyPlague(turnContext, targetProv, spellLevelEff, ph);
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'a Plague strikes a province',
      heroName: c.name,
      provinceName: targetProv.name,
      tested: res.tested,
      affected: res.affected,
    },
    audience: {
      actor: c.player,
      realms: targetProv.owner != null && targetProv.owner !== c.player ? [targetProv.owner] : [],
      seen: 'battle',
    },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: targetProv.id,
    env: true,
  });
  notifyProvinceOwner(
    turnContext,
    targetProv,
    {
      kind: 'a realm learns an enemy Plague struck its province',
      provinceName: targetProv.name,
      affected: res.affected,
    },
    c.player,
    ph,
  );

  return true;
}
/** The work of raise-wraiths (`necromancy_wraiths`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workRaiseWraiths({ turnContext, G, c, ph, prov }: TheNamesAnActionSpellIsHanded): boolean {
  const graves = prov.battleGraves ?? [];
  if (graves.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Raise Wraiths finds no dead to answer', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return false;
  }
  let _wbi = 0,
    _wbs = -1;
  graves.forEach((gr, i) => {
    const st = unitBaseStrength({ type: gr.type, quality: gr.quality || 'Average' });
    if (st > _wbs) {
      _wbs = st;
      _wbi = i;
    }
  }); // raise the STRONGEST fallen unit
  const g = theOneTakenOut(graves, _wbi);
  const wraith = {
    type: g.type,
    quality: 'Elite',
    race: 'Undead',
    _isSkeletal: true,
    _isWraith: true,
    unitName: `Wraiths (${String(armyUnitName(g.type))})`,
  };
  c.armies = asItsGuardReadsIt(c.armies) ?? [];
  c.armies.push(wraith);
  logSplit(
    turnContext,
    'explore',
    { kind: 'the dead are bound into Wraiths', heroName: c.name, provinceName: prov.name, unitName: wraith.unitName },
    {
      kind: 'onlookers see the dead bound into Wraiths',
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      provinceName: prov.name,
      unitName: wraith.unitName,
    },
    { audience: { actor: c.player }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, province: prov.id },
  );
  resolveUnitGainInProvince(turnContext, c, prov, ph);

  return true;
}
/** The work of deaths-dominion (`necromancy_dominion`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workDeathsDominion({
  turnContext,
  c,
  ph,
  prov,
  spellLevelEff,
}: TheNamesAnActionSpellIsHanded): boolean {
  const graves = prov.battleGraves ?? [];
  if (graves.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: "Death's Dominion finds no fallen army to raise", heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return false;
  }
  // the tier above each quality, by any quality (it holds no '', so each `??` below gives what its `||` gave)
  const QUALITY_UP: Readonly<Partial<Record<string, string>>> = { ...KC_QUALITY_UP };
  // Death's Dominion already raises the dead one tier stronger than they fell. The
  // Deathless Legion adds ITS tier on top, so an Undead realm holding its Wonder pulls them
  // up TWO tiers — Average dead rise Crack. Elite is still the ceiling.
  const _ddUp = gdActive(turnContext, c.player, 'Undead')
    ? (q: string) => QUALITY_UP[QUALITY_UP[q] ?? q] ?? QUALITY_UP[q] ?? q
    : (q: string) => QUALITY_UP[q] ?? q;
  const n = Math.min(graves.length, spellLevelEff);
  let raised = 0;
  for (let k = 0; k < n; k++) {
    const g = takeBestGrave(prov);
    if (!g) break;
    /*best first, down the line */ c.armies = asItsGuardReadsIt(c.armies) ?? [];
    c.armies.push({
      type: g.type,
      quality: _ddUp(g.quality),
      race: 'Undead',
      _isSkeletal: true,
      unitName: `${String(g.unitName || armyUnitName(g.type))} (Skeletal)`,
    });
    raised++;
  }
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: "Death's Dominion raises skeletal companies from the graves",
      heroName: c.name,
      provinceName: prov.name,
      raised: raised,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  resolveUnitGainInProvince(turnContext, c, prov, ph);

  return true;
}
