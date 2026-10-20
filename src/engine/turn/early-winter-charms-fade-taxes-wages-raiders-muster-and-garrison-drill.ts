import { kcRng } from '../rng.ts';
import { ARMY_COST_MASTER, QUALITY_TIERS } from '../army-tables.ts';
import { CARRIER_TYPES, CREATURE_ARMIES, MONSTER_ARMIES } from '../units/movement.ts';
import { neutralTradeGold } from '../grand-design.ts';
import { isConsecrated } from '../heroes/fame-and-consecration.ts';
import { activeItems } from '../items/equipment.ts';
import { GARRISON_DRILL_LEVEL, UNIT_DRILL_BASE, humanXPMult } from '../units/drill-and-spoils.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { perkTier } from '../titles/perks.ts';
import { noteServedRealm } from '../heroes/charms-and-neutrals.ts';
import {
  capItemTaxGold,
  discEff,
  discHeroWage,
  discTaxAdd,
  discUpkeepWage,
  gdActive,
  hasDisc,
  realmBaseTax,
  taxBonusCap,
  taxRecordsGold,
} from '../discoveries.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { isOpenSea, seaLiftShortfall, settleStrandedAtSea } from '../units/sea-lift-stranding-and-retreats.ts';
import { setMovePool } from '../units/movement-pools.ts';

// ── EARLY WINTER (plan P1-08k2: a stage taken out of resolveTurn's phase loop) ─────────────────────────────────────
// After the four stages of the turn's last phase (Early Winter), the realms settle their accounts, in this order:
//   1. a hero whose command an enemy Charm seized returns to his own lord, before anyone pays him;
//   2. taxes: each realm's treasury is told, then each province's tax with its spells and discoveries, item and title
//      gold, interest, Taxation Records, neutral trade and the Thief network are collected;
//   3. wages: every company (in the field or in garrison) and every hero but the king is paid, after the discounts
//      (war-spoils, Druid, discoveries, the Host-Leader); a realm that can't pay loses its rawest companies first (the
//      dead last, ships carrying troops at sea kept), then heroes may desert;
//   4. Raiders' Muster: an orcish province that saw an orc victory this turn gains a Goblin Horde;
//   5. garrison drill: an unled garrison company may rise one grade; then any column left at sea without hulls enough
//      is settled.
// It takes the turn's context (src/engine/turn/context.js) and nothing else: it reads none of the loop's values (the
// phase, the intents, where each hero stood). The body keeps the loop's indent (plan P1-08's Decisions).

export function earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill(turnContext) {
  const { G, log } = turnContext;
  // ── Charm revert ── A hero whose command was seized by an enemy Charm returns to their own
  // lord as the season turns. This happens BEFORE tax and wages so the original owner (not the
  // charmer) pays their upkeep, per the spell's terms. Order/battle control has already run for
  // the turn.
  (G.characters || []).forEach((hc) => {
    if (hc && hc._charmTempControl && hc._charmOriginalPlayer != null) {
      const back = hc._charmOriginalPlayer;
      if (hc.player !== back) {
        hc.player = back;
        if (typeof setMovePool === 'function') setMovePool(turnContext, hc);
      }
      delete hc._charmTempControl;
      delete hc._charmControlFrom;
      delete hc._charmedByPlayer;
      delete hc._charmedForPhase;
      delete hc._charmOriginalPlayer;
      if (hc.alive)
        log('system', `As the season turns, the enchantment on ${hc.name} fades and they return to their own lord.`, {
          actor: back,
          targets: [back],
        });
    }
  });
  const ARMY_COST = ARMY_COST_MASTER; // alias → master table at top of script
  // Army cost lookup (matches ARMY_TYPES cost values in game.js)

  // ── SAGE DISCOVERIES ────
  // 40 discoveries organised by category. effect: {type,...params} — applied at turn resolution time

  // Tax collection (before wages)
  log('system', '═ Tax collection ═');
  G.players.forEach((p) => {
    const pi = p.id;
    // open the Realm Events economy block with the treasury balance the realm carries INTO tax
    // collection (p.gold before any income is added), so the player sees their starting gold
    // above the tax/wages lines that follow.
    if (
      (p.provinces || []).length > 0 ||
      (G.characters || []).some((c) => c.player === p.id && c.alive) ||
      (p.gold || 0) > 0
    ) {
      log('system', `${p.name} has ${p.gold || 0}g in the treasury.`, { actor: p.id, targets: [p.id] });
    }
    const _taxAcc = new Map(); // capped `tax` discoveries: gold paid so far this collection
    const _baseTax = realmBaseTax(G, pi),
      _taxCap = taxBonusCap(_baseTax); // 5%-of-base ceiling (Toby 2026-09-24)
    let _consecBonus = 0; // DIVINE — Consecrate: track the +50% holy-ground uplift so the player can SEE it itemised
    const income = (p.provinces || []).reduce((s, id) => {
      const pv = G.world.provinces[id];
      if (!pv) return s;
      let t = pv.tax || 0;
      if (pv._earthquakeNoTax === G.turn) t = 0; // Earthquake: no revenue this turn
      if (pv._sabotagedForTurn === G.turn) t = 0; // SPY L7 Sabotage: wrecked province yields no tax this turn
      if (pv._blessedTurn === G.turn) t = Math.round(t * (pv._blessedMult || 1.6)); // Bless Province: +60% (or +100% from a Divine king)
      if (isConsecrated(p, pv.id)) {
        const _cb = t;
        t = Math.round(t * 1.5);
        _consecBonus += t - _cb;
      } // DIVINE — Consecrate: hallowed ground prospers (+50%)
      if (pv._enslavedUntil != null && pv._enslavedUntil >= G.turn) t = Math.max(0, t - 1); // EVIL — Enslave: resentment (−1 tax while it lasts)
      if (pv._earthquakeTax) t = Math.max(0, t - (pv._earthquakeTax || 0));
      // every province-tax discovery (sd11 / sd15 / sd18 and the heritage & creed ones), capped
      // per discovery — see discTaxAdd. Keep in step with buildTurnReport.
      t += discTaxAdd(p, pv, G, pi, _taxAcc, _taxCap);
      // GRAND DESIGN — Good (Free City Charter): +2 tax on every province you hold with a
      // garrison.
      if (gdActive(turnContext, pi, 'Good') && (pv.garrisonArmies || []).length > 0) t += 2;
      return s + t;
    }, 0);
    const pChars = (G.characters || []).filter((c) => c.player === p.id && c.alive);
    const itemStat = (st) =>
      pChars.reduce(
        (s, c) =>
          s + activeItems(c).reduce((a, it) => a + (it.effect && it.effect.stat === st ? it.effect.bonus : 0), 0),
        0,
      );
    // Ring of Wealth & co (flat) and Merchant's Ledger (+1g per province owned, if any hero
    // carries one) pay tax gold — together they are capped at 5% of the realm's base tax income.
    const _taxBonusRaw = pChars.reduce((s, c) => s + (c.taxBonus || 0), 0) + itemStat('taxBonus');
    const ledgers = pChars.some((c) => activeItems(c).some((it) => it.effect && it.effect.stat === 'taxPerProv'));
    const _perProvRaw = ledgers ? (G.world.provinces || []).filter((pv) => pv.owner === p.id).length : 0;
    const _itemTax = capItemTaxGold(_taxBonusRaw, _perProvRaw, _taxCap);
    const taxBonus = _itemTax.taxBonus,
      perProvBonus = _itemTax.perProvBonus;
    const interestBonus = discEff(turnContext, pi, 'interest').reduce(
      (s2, e) => s2 + Math.min(_taxCap, Math.floor((p.gold || 0) * (e.pct || 0))),
      0,
    ); // interest discoveries
    // Neutral trade: +20% of province income, rounded down.
    // (10 -> floor(1.9999...) = 1 instead of 2). Keep in step with neutralTradeGold / the report builder.
    // sd14 Taxation Records: +10% of province income, rounded down. Integer maths for the same
    // reason neutralTradeGold uses it — floor(income*0.10) drifts a gold on float-unfriendly
    // totals.
    const taxRecordsBonus = hasDisc(turnContext, pi, 'sd14') ? taxRecordsGold(income, _taxCap) : 0;
    const neutralTradeBonus = neutralTradeGold(p, income);
    // ── MINOR-TITLE PERKS (economy) ── Cutpurse / Champion of the People +2g, Castellan +1g
    // per 5 provinces.
    // (The nine Imperial Titles carry NO economic perk — their per-turn benefit is an intel line at end of turn.)
    let titlePerkGold = 0,
      titlePerkNote = '';
    pChars.forEach((pc) => {
      if (charMinor(turnContext, pc, 'cutpurse')) {
        titlePerkGold += 2;
        titlePerkNote += ` (+2g the Cutpurse)`;
      }
      if (charMinor(turnContext, pc, 'champion')) {
        titlePerkGold += 2;
        titlePerkNote += ` (+2g Champion of the People)`;
      }
      if (charMinor(turnContext, pc, 'castellan')) {
        const cg = Math.floor((G.world.provinces || []).filter((pv) => pv.owner === pi).length / 5);
        if (cg > 0) {
          titlePerkGold += cg;
          titlePerkNote += ` (+${cg}g the Castellan)`;
        }
      }
    });
    // THIEF L6: +5g income per Thief-6 character. Pay it here.
    const thiefStipend = pChars.reduce((sm, ch) => sm + (perkTier(ch, 'thief') > 0 ? 5 : 0), 0);
    const thiefNote = thiefStipend > 0 ? ` (+${thiefStipend}g Thief network)` : '';
    p.gold =
      (p.gold || 0) +
      income +
      taxBonus +
      perProvBonus +
      interestBonus +
      neutralTradeBonus +
      taxRecordsBonus +
      titlePerkGold +
      thiefStipend;
    if (income > 0 || perProvBonus > 0 || titlePerkGold > 0 || thiefStipend > 0)
      log(
        'system',
        `${p.name} collects ${income + taxBonus + perProvBonus + interestBonus + neutralTradeBonus + taxRecordsBonus + titlePerkGold + thiefStipend}g in taxes${taxRecordsBonus > 0 ? ` (+${taxRecordsBonus}g Taxation Records)` : ''}${perProvBonus > 0 ? ` (+${perProvBonus}g Merchant's Ledger)` : ''}${neutralTradeBonus > 0 ? ` (+${neutralTradeBonus}g Neutral trade bonus)` : ''}${interestBonus > 0 ? ` (+${interestBonus}g Merchant Guilds interest)` : ''}${_consecBonus > 0 ? ` (+${_consecBonus}g from consecrated ground)` : ''}${titlePerkNote}${thiefNote}.`,
        { actor: p.id, targets: [p.id] },
      );
  });
  log('system', '═ Army wages & hero wages ═');
  G.players.forEach((p) => {
    const pi = p.id;
    // the same 5%-of-base-income ceiling the tax collection above uses: `upkeep`, `heroWage` and
    // `heroWageCap` discoveries are each capped at it per turn (2026-09-26, Toby). Recomputed
    // here because the collection loop is a separate pass with its own scope.
    const _taxCap = taxBonusCap(realmBaseTax(G, pi));
    const playerChars = (G.characters || []).filter((c) => c.player === p.id && c.alive);
    // Army wages — every carried army costs its recruitment cost per turn
    const allArmies = playerChars.flatMap((c) => c.armies || []);
    // Also count garrison armies left in provinces
    const garrisonArmies = (G.world.provinces || [])
      .filter((pv) => pv.owner === p.id)
      .flatMap((pv) => pv.garrisonArmies || []);
    const allKingdomArmies = [...allArmies, ...garrisonArmies];
    // temporary summons (elementals) are a spell effect that dissolves at turn end — they draw
    // no wage and are never disbanded for non-payment (see the disband loop below). ORC
    // WAR-SPOILS — an Orcish unit of an Orcish realm that won a battle as part of an attacking
    // force THIS turn pays only half upkeep for this turn (min 1g).
    const _orcKingdom = p.race === 'Orcish';
    // DRUID L6 — creatures/monsters led by a Druid-6 character pay half wages. Built as a Set
    // of the actual army objects (identity), since the wage sum flattens away the leader
    // association.
    const _druidHalfWage = new Set();
    playerChars.forEach((ch) => {
      if (perkTier(ch, 'druid') > 0 || gdActive(turnContext, p.id, 'Druidic'))
        (ch.armies || []).forEach((a) => {
          if (CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type)) _druidHalfWage.add(a);
        });
    }); // + GRAND DESIGN Druidic
    const _upkAcc = new Map();
    let _discUpkeepG = 0;
    let _orcSpoilsG = 0; // 2026-09-10 item 3: itemised so the report can explain the one-off discount
    // 2026-09-27 (Toby items 8 & 9): ORC WAR-SPOILS WAS NOT PAYING 50%.
    // The discount was `Math.max(1, Math.round(w*0.5))` PER UNIT, and every odd wage rounds the
    // wrong way: a 3g unit halved to 2g, not 1.5g. A host of four 3g units and one 4g unit —
    // 16g of wages — therefore saved 6g where the rule promises 8g, which is exactly the
    // shortfall reported. Rounding each unit DOWN instead would overshoot the other way (10g off
    // the same host). The halving now carries its remainder from unit to unit: each qualifying
    // unit pays floor(w/2), and the accumulated half-golds are paid by rounding the next unit up
    // as soon as a whole gold has built up. Across the qualifying units the total is exactly half
    // (or half rounded to the nearest gold), which is what "half upkeep" has always meant.
    // The 1g floor still applies per unit, so a 1g unit is never free.
    let _orcFrac = 0;
    let armyWages = allKingdomArmies.reduce((s, a) => {
      if (a._temporary) return s;
      // Wild Hunt: the bound beasts answer the old gods, not a paymaster. They draw NO wage for
      // the two turns they serve, and are never disbanded for non-payment (see the loop below).
      if (a._wildHuntUntilTurn != null) return s;
      if (a._isSkeletal) return s + 1;
      let w = ARMY_COST[a.type] || 2;
      if (_orcKingdom && a.race === 'Orcish' && a._orcAtkWinTurn === G.turn) {
        const _w0 = w,
          _half = _w0 * 0.5;
        let _wHalf = Math.floor(_half);
        if (_wHalf < 1) {
          // The 1g floor bites: this unit already pays MORE than half, so it neither banks a
          // remainder nor spends one. (Letting a 1g unit both claim the floor and consume the
          // carry undercharged the rest of the host by a gold every time.)
          _wHalf = 1;
        } else {
          _orcFrac += _half - _wHalf;
          if (_orcFrac >= 1 - 1e-9) {
            _wHalf += 1;
            _orcFrac -= 1;
          }
        }
        w = _wHalf;
        _orcSpoilsG += _w0 - w;
      }
      if (_druidHalfWage.has(a)) w = Math.max(1, Math.floor(w * 0.5)); // DRUID L6
      {
        const _w0 = w;
        w = discUpkeepWage(p, a, w, _upkAcc, _taxCap);
        _discUpkeepG += _w0 - w;
      } // `upkeep` discoveries
      return s + w;
    }, 0);
    // MINOR TITLE — The Host-Leader: this realm's greatest general pays 1g less per unit he
    // leads (min 1/unit).
    let _hostLeaderG = 0;
    {
      const hl = playerChars.find((c) => charMinor(turnContext, c, 'hostleader'));
      if (hl) {
        const led = (hl.armies || []).filter((a) => !a._temporary && a._wildHuntUntilTurn == null).length;
        _hostLeaderG = Math.min(armyWages, led);
        armyWages = Math.max(0, armyWages - led);
      }
    }

    // Hero wages
    const heroes = playerChars.filter((c) => !c.isKing);
    // heroWage / heroWageCap discoveries (sd17 Granaries, sd38 Inspiring Leadership, creeds) —
    // one shared helper, mirrored in buildTurnReport.
    const _hwAcc = new Map();
    let _heroWageDisc = 0;
    const heroWages = heroes.reduce((s, h) => {
      const raw = h.pay || 0;
      const w = discHeroWage(p, h, raw, _hwAcc, _taxCap);
      _heroWageDisc += Math.max(0, raw - w);
      return s + w;
    }, 0);

    const totalWages = armyWages + heroWages;
    // 2026-09-10 item 3: the figures ACTUALLY charged this turn are stamped on the player.
    // buildTurnReport reads them for the "Your Realm" box, so the two sections are one number
    // by construction; the forward forecast only appears as a "next turn" note when the
    // end-of-turn roster (disbands, escaped units returning, skeleton rises, heirs…) changes
    // it.
    p._lastWages = {
      turn: G.turn,
      armyWages,
      heroWages,
      hostLeaderG: _hostLeaderG,
      heroWageDisc: _heroWageDisc,
      orcSpoilsG: _orcSpoilsG,
      discUpkeepG: _discUpkeepG,
    };

    if (totalWages === 0) {
      log('system', `${p.name}: no wages to pay.`);
      return;
    }

    {
      const _notes = [
        _hostLeaderG > 0 ? `−${_hostLeaderG}g the Host-Leader` : '',
        _orcSpoilsG > 0 ? `−${_orcSpoilsG}g Orcish war-spoils` : '',
        _heroWageDisc > 0 ? `−${_heroWageDisc}g hero wage discounts` : '',
        _discUpkeepG > 0 ? `−${_discUpkeepG}g army upkeep discoveries` : '',
      ].filter(Boolean);
      log(
        'system',
        `${p.name} owes ${totalWages}g wages (armies: ${armyWages}g, heroes: ${heroWages}g)${_notes.length ? ` — after ${_notes.join(', ')}` : ''}.`,
        { actor: p.id, targets: [p.id] },
      );
    }

    if ((p.gold || 0) >= totalWages) {
      p.gold -= totalWages;
      log('system', `${p.name} pays ${totalWages}g in wages. Treasury: ${p.gold}g remaining.`, {
        actor: p.id,
        targets: [p.id],
      });
    } else {
      // Can't pay in full — armies disband first (cheapest first), then heroes desert
      log(
        'system',
        `⚠ ${p.name} cannot pay ${totalWages}g wages! Only ${p.gold || 0}g available. The rawest troops melt away first — the greenest companies anywhere in the realm, garrison or field alike — then better men as the shortfall bites. The skeletal dead ask for nothing and are the last to go. Heroes may desert.`,
        { actor: p.id, targets: [p.id] },
      );
      let deficit = totalWages - (p.gold || 0);
      p.gold = 0;

      // ── WHO GOES FIRST ────
      // Was: cheapest-first, which put SKELETONS (1g) at the head of the queue — the opposite
      // of what a realm of the dead should suffer, since skeletons neither eat nor desert. Now:
      // 1. Skeletal units are ALWAYS last. Nothing else disbands while a skeleton could.
      // 2. Within each of those two groups the raw levies go first — lowest experience tier
      // before higher, so a Green garrison melts away before a Crack company.
      // 3. Within one experience tier the choice is RANDOM ACROSS THE WHOLE EMPIRE — no more
      // "garrisons always, field armies never". A random key is decorated onto each unit up
      // front so the comparator stays a valid (consistent) ordering.
      const _qRank = (a) => {
        const i = QUALITY_TIERS.indexOf(a && a.quality);
        return i < 0 ? 1 : i;
      }; // unknown quality ≈ Average
      const sortedArmies = [...allKingdomArmies]
        .map((a) => ({ a, skel: a._isSkeletal ? 1 : 0, q: _qRank(a), r: kcRng() }))
        .sort((x, y) => x.skel - y.skel || x.q - y.q || x.r - y.r)
        .map((x) => x.a);
      const _sparedHulls = []; // 2026-09-23c: ships carrying troops at sea are never disbanded from under them
      // A hull spared earlier in this pass is looked at again every time a unit disbands: once the
      // troops it carried are gone it is no longer needed and takes its place in the queue again
      // (Toby, 2026-09-23c) — it was reached before the unit that just went, so it goes next.
      const _revisitSpared = () => {
        for (let _i = 0; _i < _sparedHulls.length && deficit > 0; _i++) {
          const _h = _sparedHulls[_i],
            _oc = playerChars.find((ch) => (ch.armies || []).includes(_h));
          if (!_oc) {
            _sparedHulls.splice(_i--, 1);
            continue;
          }
          if (
            isOpenSea(G.world.provinces[_oc.location]) &&
            seaLiftShortfall(
              (_oc.armies || []).filter((a) => a !== _h),
              _oc,
            ) > 0
          )
            continue; // still carrying
          _oc.armies.splice(_oc.armies.indexOf(_h), 1);
          _sparedHulls.splice(_i--, 1);
          deficit -= _h._isSkeletal ? 1 : ARMY_COST[_h.type] || 2;
          log(
            'hire',
            `${_h.unitName ? _h.unitName + ' (' + _h.type + ')' : 'A ' + _h.quality + ' ' + _h.type} disbands — ${p.name} could not pay their wages, and with the troops aboard gone the ship is no longer needed to carry them.`,
            { actor: p.id, targets: [p.id] },
          );
        }
      };
      sortedArmies.forEach((army) => {
        if (deficit <= 0) return;
        // elementals and other temporary summons are never disbanded for non-payment — they
        // dissolve on their own at turn's end (and no longer draw a wage above).
        if (army._temporary) return;
        if (army._wildHuntUntilTurn != null) return; // Wild Hunt beasts draw no wage, so they cannot be disbanded for one
        if (army._isSkeletal && gdActive(turnContext, p.id, 'Undead')) return; // GRAND DESIGN — Undead (Deathless Legion): skeletal units never disband for unpaid wages
        // _isSkeletal armies cost 1g upkeep (all types); base cost-0 armies (other summons)
        // still free
        const cost = army._isSkeletal ? 1 : ARMY_COST[army.type] || 2;
        if (cost === 0) return; // other free armies never disband for non-payment
        // 2026-09-23c (Toby): a hull that is carrying land troops at sea is protected — disbanding it
        // would strand the men aboard. Judged live, so a hull made spare by a unit already gone
        // this pass can still go.
        if (CARRIER_TYPES.has(army.type)) {
          const _oc = playerChars.find((ch) => (ch.armies || []).includes(army));
          if (
            _oc &&
            isOpenSea(G.world.provinces[_oc.location]) &&
            seaLiftShortfall(
              (_oc.armies || []).filter((a) => a !== army),
              _oc,
            ) > 0
          ) {
            _sparedHulls.push(army);
            return;
          }
        }
        // Find and remove this army from its owner character or garrison match the EXACT army
        // object (identity), never a same-type stand-in — the old `a.type===army.type`
        // fallback, with characters searched first, could disband a hero's unit in place of the
        // garrison unit that was actually selected. The search order below (garrisons, then
        // characters) is now only a lookup path — the sort above already chose WHICH unit goes,
        // and identity matching means the lookup cannot pick a different one.
        let removed = false;
        (G.world.provinces || [])
          .filter((pv) => pv.owner === p.id)
          .forEach((pv) => {
            if (removed) return;
            const idx = (pv.garrisonArmies || []).findIndex((a) => a === army);
            if (idx >= 0) {
              pv.garrisonArmies.splice(idx, 1);
              removed = true;
            }
          });
        if (!removed)
          playerChars.forEach((c) => {
            if (removed) return;
            const idx = (c.armies || []).findIndex((a) => a === army);
            if (idx >= 0) {
              c.armies.splice(idx, 1);
              removed = true;
            }
          });
        if (removed) {
          deficit -= cost;
          log(
            'hire',
            `${army.unitName ? army.unitName + ' (' + army.type + ')' : 'A ' + army.quality + ' ' + army.type} disbands — ${p.name} could not pay their wages.`,
            { actor: p.id, targets: [p.id] },
          );
          if (_sparedHulls.length) _revisitSpared(); // a ship kept for these troops may now be free to go
        }
      });

      if (_sparedHulls.length)
        log(
          'system',
          `⚓ ${_sparedHulls.length} ship${_sparedHulls.length !== 1 ? 's' : ''} carrying troops at sea ${_sparedHulls.length !== 1 ? 'are' : 'is'} kept at the oars unpaid — disbanding ${_sparedHulls.length !== 1 ? 'them' : 'it'} would leave the men aboard stranded.`,
          { actor: p.id, targets: [p.id] },
        );
      // If still in deficit, heroes desert
      if (deficit > 0) {
        heroes
          .sort((a, b) => (b.pay || 0) - (a.pay || 0))
          .forEach((h) => {
            if (deficit <= 0) return;
            if (kcRng() > 0.4) {
              noteServedRealm(h, h.player);
              h.player = null;
              h.name = h.name.replace(' (wandering)', '') + ' (wandering)';
              deficit -= h.pay || 0;
              p.heroes = (p.heroes || []).filter((id) => id !== h.id);
              log('hire', `${h.name} abandons ${p.name}'s service, unpaid and disillusioned.`, {
                actor: p.id,
                targets: [p.id],
              });
            }
          });
      }
    }
  });
  // ── RAIDERS' MUSTER (2026-10-11, Toby, the unit abilities) ── An orcish province that saw an orc
  // victory this turn adds one Goblin Horde to its garrison for nothing: plunder feeds the horde. It
  // is owed wages from next turn like any garrison unit. The battle set the flag; the province must
  // still be an orc realm's at turn's end.
  (G.world.provinces || []).forEach((pv) => {
    if (!pv || pv._raidersMuster !== G.turn) {
      if (pv && pv._raidersMuster != null && pv._raidersMuster !== G.turn) delete pv._raidersMuster;
      return;
    }
    delete pv._raidersMuster;
    if (pv.race !== 'Orcish' || pv.owner == null || !G.players[pv.owner] || G.players[pv.owner].race !== 'Orcish')
      return;
    pv.garrisonArmies = pv.garrisonArmies || [];
    const _gob = { type: 'Goblin Horde', quality: 'Average', race: 'Orcish', unitName: armyUnitName('Goblin Horde') };
    pv.garrisonArmies.push(_gob);
    log(
      'hire',
      `🥁 Raiders' Muster — word of the victory at ${pv.name} draws ${_gob.unitName} (Goblin Horde, Average) to its garrison for nothing.`,
      { actor: pv.owner, targets: [pv.owner], provinceId: pv.id },
    );
  });
  // ── GARRISON DRILL (2026-09-23c, Toby) ── Every unled unit garrisoned in a province its realm
  // owns may rise one experience level at turn's end, at exactly the chance a commander gives by
  // practising: land and air units as if by Tactical 1, fleets and sea-beasts as if by Naval 1
  // (UNIT_DRILL_BASE × GARRISON_DRILL_LEVEL), doubled for Human drillmasters. After wages, so a
  // unit disbanded for want of pay never trains. Skeletal, summoned and Wild Hunt units never do.
  (G.world.provinces || []).forEach((pv) => {
    if (!pv || pv.owner == null || !G.players[pv.owner]) return;
    const _up = []; // one line per province, however many rise
    (pv.garrisonArmies || []).forEach((a) => {
      if (!a || a._isSkeletal || a._temporary || a._phantom || a._wildHuntUntilTurn != null) return;
      const _qi = QUALITY_TIERS.indexOf(a.quality);
      if (_qi < 0 || _qi >= QUALITY_TIERS.length - 1) return;
      const _ch = (UNIT_DRILL_BASE[a.quality] || 0) * GARRISON_DRILL_LEVEL * humanXPMult(a, pv.owner, G);
      if (kcRng() < _ch) {
        const _q0 = a.quality;
        a.quality = QUALITY_TIERS[_qi + 1];
        _up.push(`${a.unitName ? `${a.unitName} (${a.type})` : `a ${a.type}`} ${_q0} → **${a.quality}**`);
      }
    });
    if (_up.length)
      log('hire', `🎖 Garrison drills in ${pv.name}: ${_up.join('; ')}.`, {
        actor: pv.owner,
        targets: [pv.owner],
        provinceId: pv.id,
      });
  });
  settleStrandedAtSea(turnContext, 4, 'too few hulls left to carry the whole column'); // safety net after wages
}
