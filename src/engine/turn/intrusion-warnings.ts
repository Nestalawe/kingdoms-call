import { relOfReport, spotEnemyInOwnedProvince } from '../heroes/fame-and-consecration.ts';
import { armySizeBand } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from './events-and-their-audiences.ts';
import type { TurnContext } from './context.ts';
import type { Character, GameState, Province, Realm } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b9): the state as the warnings read it, each list the body guards typed as wide as the guard
// (plan P1-10b's Decision 3), through the context; the context keeps TurnContext for the typed functions it is handed
// to. A phase's name and a force's size are read as JavaScript reads them, `undefined` for no phase.
/** A hero as the warnings read him: his armies guarded. Ids are plain numbers (the schema brands them). */
type AHeroAsTheWarningsReadHim = Pick<Character, 'player' | 'alive' | 'name' | '_invisTurn' | 'skills'> & {
  readonly id: number;
  readonly location: number;
  readonly armies?: readonly unknown[] | null | undefined;
};
/** The state as the warnings read it: a realm's provinces and the heroes guarded. */
interface TheStateAsTheWarningsReadIt {
  readonly players: readonly (Pick<Realm, 'name'> & { readonly provinces?: readonly number[] | null | undefined })[];
  readonly characters?: readonly AHeroAsTheWarningsReadHim[] | null | undefined;
  readonly relations: GameState['relations'];
  readonly turn: number;
  readonly world: { readonly provinces: readonly Province[] };
}

// ── INTRUSION WARNINGS (plan P1-08b: lifted out of resolveTurn) ────
// After each phase, the warnings a realm gets of enemy heroes in its land or beside its own heroes. It takes the turn's
// context first (src/engine/turn/context.ts): the state, the seasons' names and the turn's warnings so far
// (_intrusionAcc), which flushIntrusionNotifications (plan P1-08i1, below) writes into the log after the phases, each
// line a fact (since P1-12d15: the-facts-the-intrusion-warnings-lines-record.ts), its words written in the views.
// ── INTRUSION NOTIFICATIONS ────
// After each phase resolves, scan for situations where players need to be notified about things
// happening in their territory or in provinces where their heroes are present.
export function generateIntrusionNotifications(turnContext: TurnContext, ph: number) {
  const { SEASONS, _intrusionAcc } = turnContext;
  const { G }: { readonly G: TheStateAsTheWarningsReadIt } = turnContext;
  const phaseLabel = SEASONS[ph];
  G.players.forEach((targetPlayer, targetPi) => {
    const targetOwnedProvs = new Set(targetPlayer.provinces ?? []);
    const targetCharProvs = new Set(
      (G.characters ?? []).filter((c) => c.player === targetPi && c.alive).map((c) => c.location),
    );
    const targetKnownProvs = new Set([...targetOwnedProvs, ...targetCharProvs]);

    // Check every other player's characters
    G.players.forEach((actingPlayer, actingPi) => {
      if (actingPi === targetPi) return;
      const actingChars = (G.characters ?? []).filter((c) => c.player === actingPi && c.alive);
      actingChars.forEach((ac) => {
        const acProv = G.world.provinces[ac.location];
        if (!acProv) return;
        if (ac._invisTurn === G.turn) return; // 2026-10-15 (Toby): a hero under Invisibility is not noticed
        const inOwnedProv = targetOwnedProvs.has(ac.location);
        // 2026-10-15 (Toby): a lone enemy lurking in your land with none of your heroes there is
        // reported only if your people spot them — the same roll the report makes for this hero,
        // province and turn (the report is built after the turn counter advances, hence G.turn+1).
        if (
          inOwnedProv &&
          !targetCharProvs.has(ac.location) &&
          !(ac.armies ?? []).length &&
          relOfReport(G, targetPi, actingPi) === 'enemy' &&
          !spotEnemyInOwnedProvince(turnContext.G, targetPi, acProv, ac, G.turn + 1)
        )
          return;
        const inKnownProv = targetKnownProvs.has(ac.location);
        if (!inKnownProv) return; // target doesn't know about this province

        // 2026-10-15 (Toby, D1): the same rough size the map gives, whatever the watcher's Spy
        const forceDesc = armySizeBand((ac.armies ?? []).length);

        // Accumulate the sighting; a single consolidated line per (target, hero, province) is
        // emitted after the turn resolves (see flushIntrusionNotifications). actor is left null
        // on the eventual log so the spotted (intruding) player never receives the owner's line.
        const branch = inOwnedProv ? 'own' : 'known';
        const key = `${String(targetPi)}|${String(ac.id)}|${String(ac.location)}|${branch}`;
        let rec = _intrusionAcc.get(key);
        if (!rec) {
          rec = {
            targetPi,
            branch,
            actingName: actingPlayer.name,
            acName: ac.name,
            provName: acProv.name,
            provId: ac.location,
            phases: [],
            forceByPhase: {},
          };
          _intrusionAcc.set(key, rec);
        }
        if (!rec.phases.includes(ph)) rec.phases.push(ph);
        rec.forceByPhase[ph] = forceDesc;
      });
    });

    // (Wandering hero sightings are reported once at end of turn in the Intelligence
    // section's "Wandering Heroes" list — no need to log each phase's movement here.)
  });
}

export function flushIntrusionNotifications(turnContext: TurnContext) {
  const { SEASONS, _intrusionAcc } = turnContext;
  _intrusionAcc.forEach((rec) => {
    const s = [...rec.phases].sort((a, b) => a - b);
    const lastPh = s[s.length - 1];
    // Each line is a fact (since P1-12d15: the-facts-the-intrusion-warnings-lines-record.ts): the phases he was seen in
    // and each one's name (as SEASONS reads it), each force size seen and the last (as forceByPhase reads it: none for
    // no phase); its words are written in the views.
    if (rec.branch === 'own') {
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: "an enemy hero is spotted in a province of the realm's own",
          heroName: rec.acName,
          realmName: rec.actingName,
          provinceName: rec.provName,
          phases: s,
          seasonNames: s.map((p) => SEASONS[p]),
          sizesSeen: [...new Set(s.map((p) => rec.forceByPhase[p]))],
          lastSize: lastPh === undefined ? undefined : rec.forceByPhase[lastPh],
        },
        audience: { actor: null, realms: [rec.targetPi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: rec.provId,
      });
    } else {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a hero of another realm shares a province with the realm's forces",
          heroName: rec.acName,
          realmName: rec.actingName,
          provinceName: rec.provName,
          phases: s,
          seasonNames: s.map((p) => SEASONS[p]),
          sizesSeen: [...new Set(s.map((p) => rec.forceByPhase[p]))],
          lastSize: lastPh === undefined ? undefined : rec.forceByPhase[lastPh],
        },
        audience: { actor: null, realms: [rec.targetPi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: rec.provId,
      });
    }
  });
}
