import { TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { noteGraveIntel } from '../graves.ts';
import { TITLES_PUBLIC_FROM_TURN } from './perks.ts';
import { MINOR_TITLES } from '../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { computeMinorTitles, computeStandings } from './reckoning.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theOneThePickFell } from '../orders/spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { ATitleThatCountsTheRealmsNotMet } from './the-facts-the-title-intelligence-lines-record.ts';
import {
  theBoardsOfTheImperialTitlesAtAStage,
  type AStageOfAnImperialTitlesBoard,
  type TheTitlesWhoseBoardsAreToldAt,
} from '../rules/the-registry-of-the-imperial-titles-effects.ts';
import type { TurnContext } from '../turn/context.ts';
import type {
  GameState,
  MajorTitleHolder,
  MajorTitleSnapshot,
  MinorTitleHolder,
  MinorTitleSnapshot,
  Province,
  Realm,
} from '../../schemas/saved-game-state.ts';

// ── THE TITLES AT THE TURN'S END (plan P1-08k6: the last stages taken out of the end of resolveTurn's body) ─────────
// Once the new turn is done (new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-
// final-reconcile.js: the final reconcile and the stranded guards), two stages, in this order, each once a turn:
//   1. the title intel: from turn 5 (TITLES_PUBLIC_FROM_TURN), or once the game is over, the realm holding each title
//      is told what it shows of the realms it has met (the Throne, the Vaultkeeper, the Grand Marshal, the Sea Lord,
//      the Monster-Bane, the Loremaster, who may copy one rival's fresh discovery, the Archmage, the Hierophant, the
//      Deathpriest, who files what Grave-sight finds under Graveyards Known, the Spymaster, the Cartographer, the
//      Beastlord and the Wildwarden), with one line for the realms it hasn't met;
//   2. the title changes: each realm's titles won and lost since last turn's snapshot (every title held, the first
//      turn they are public), for the report, and this turn's snapshot.
// Each was an immediately-invoked function in resolveTurn; each is a named function now, taking the turn's context
// (src/engine/turn/context.ts) and nothing else: it reads no value of the phase loop's. The bodies keep resolveTurn's
// indent inside the function they were (plan P1-08's Decisions).

// ── IMPERIAL TITLE INTEL (Items 1, 2, 4) ── Titles are AWARDED here, AFTER all turn resolution
// (combat, conquest, tax, resurrection, wandering-drift) and the final reconcile — so this ONE
// end-of-turn standings computation is what every title benefit reports from. The intel lines,
// the holders board and each report's gains/losses therefore never disagree on who holds what.
// Each rival / piece of intel is its OWN line, and any character named carries their province.
// Gated: nothing emits before Titles go public (turn 5) or once the game is over.
// Every line is a fact (plan P1-12d13): the title intelligence's kinds (titles/the-facts-the-title-intelligence-lines-
// record.ts), each holding a realm as the line names it, a province's name as the world holds it (null where it has
// none), counts and figures; the prose writes the words, each line's "[The Throne] " first
// (src/views/prose/the-words-of-the-title-intelligence-lines.ts).
// Its types (plan P1-10b35): the state is the saved game's (a list the code guards read through asItsGuardReadsIt, a
// gap among them through a callback typed as wide as its guard); a realm's `eliminated` is read as the line reads it.
export function imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy(turnContext: TurnContext) {
  const { G } = turnContext;
  const _pub = (G.turn || 1) >= TITLES_PUBLIC_FROM_TURN || !!G.gameOver;
  if (!_pub) return;
  let STD: ReturnType<typeof computeStandings>;
  try {
    STD = computeStandings(G);
  } catch {
    return;
  }
  const TH = asItsGuardReadsIt(STD.titles) ?? {};
  const provs: readonly (Province | null | undefined)[] = asItsGuardReadsIt(G.world.provinces) ?? [];
  const holder = (key: string) => {
    const h = TH[key];
    return h?.playerIndex ?? null;
  };
  // 2026-09-24 (Toby item 5): a title tells its holder nothing about a realm the crown has not
  // yet MET (player._encountered — the same list that gates Treat / Declare War). Unmet realms
  // are neither named nor measured; one closing line per title says how many stay in the dark.
  const met = (pi: number, i: number) => i === pi || (G.players[pi]?._encountered ?? []).includes(i);
  const unmetLine = (pi: number, title: ATitleThatCountsTheRealmsNotMet) => {
    const n = (asItsGuardReadsIt(G.players) ?? []).filter(
      (pl: (Realm & { readonly eliminated?: unknown }) | null | undefined, i) =>
        pl && i !== pi && !pl.conceded && !pl.eliminated && !met(pi, i),
    ).length;
    if (n > 0)
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a title's holder learns how many realms his crown has not met", title, count: n },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
  };
  // Each title's board (B-06o, B-06p): each title's effect, in the registry of the Imperial Titles' effects, gives its
  // board's lines in the order its block wrote them; each is written for the holder's realm alone, what the
  // Deathpriest's Grave-sight finds filed under the realm's Graveyards Known just before its line; then the
  // Loremaster's scholars copy one fresh discovery a met realm made, if there is one his realm lacks (the one die of
  // the title intelligence, drawn here, after his board's lines); then, at the stages whose titles count them, the
  // line for the realms the holder hasn't met.
  const tellTheBoardsAt = <TheStage extends AStageOfAnImperialTitlesBoard>(
    theStage: TheStage,
    thenTheRealmsNotMet: (theTitle: TheTitlesWhoseBoardsAreToldAt<TheStage>, pi: number) => void,
  ) => {
    theBoardsOfTheImperialTitlesAtAStage(
      theStage,
      holder,
      (pi) => ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, theStandings: STD, heHasMet: met }),
      (theTitle, pi, theBoard) => {
        const _dpl = G.players[pi];
        theBoard.theLines.forEach((fact, k) => {
          const theGraveSight = theBoard.theGraveSightItFilesBeforeEachLine?.[k];
          if (theGraveSight && _dpl)
            noteGraveIntel(_dpl, theGraveSight.theProvinceId, G.turn, theGraveSight.theDead, { partial: true });
          emit(turnContext, {
            type: 'system',
            fact,
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          });
        });
        const lp = G.players[pi];
        const learn = theBoard.theFreshDiscoveriesHisScholarsMayCopy ?? [];
        if (lp && learn.length) {
          const pk = theOneThePickFell(learn[Math.floor(kcRng() * learn.length)]).d;
          const itsDiscoveries = lp.discoveries ?? [];
          lp.discoveries = itsDiscoveries;
          itsDiscoveries.push({
            id: pk.id,
            name: pk.name,
            category: pk.category,
            desc: pk.desc,
            turnDiscovered: G.turn,
          });
          emit(turnContext, {
            type: 'system',
            fact: { kind: "the Loremaster's scholars copy a rival's fresh discovery", discoveryName: pk.name },
            audience: { actor: pi, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          });
        }
        thenTheRealmsNotMet(theTitle, pi);
      },
    );
  };
  const thenTheLineForTheRealmsNotMet = (theTitle: ATitleThatCountsTheRealmsNotMet, pi: number) => {
    unmetLine(pi, theTitle);
  };
  const andNoLineForTheRealmsNotMet = () => {
    // the boards of the fallen and of the spies count no realm the holder hasn't met
  };
  // THE THRONE and THE VAULTKEEPER, the titles of the realm (their boards: rules/the-imperial-titles/the-boards-of-
  // the-titles-that-read-each-rival-realm-and-the-facts-their-lines-record.ts).
  tellTheBoardsAt('the board an Imperial Title of the realm shows its holder', thenTheLineForTheRealmsNotMet);
  // THE GRAND MARSHAL, THE SEA LORD, THE MONSTER-BANE, THE LOREMASTER (and his copy) and THE ARCHMAGE (their boards:
  // rules/the-imperial-titles/the-boards-of-the-titles-that-read-each-realms-heroes-lore-the-fallen-and-the-spies-and-
  // the-facts-their-lines-record.ts).
  tellTheBoardsAt(
    "the board a hero's Imperial Title shows of each realm's heroes and lore",
    thenTheLineForTheRealmsNotMet,
  );
  // THE HIEROPHANT, THE DEATHPRIEST and THE SPYMASTER (their boards: the same file): no line for the realms not met.
  tellTheBoardsAt(
    "the board a hero's Imperial Title shows of the fallen and of the spies in his lands",
    andNoLineForTheRealmsNotMet,
  );
  // THE CARTOGRAPHER, THE BEASTLORD and THE WILDWARDEN (their boards: the first file).
  tellTheBoardsAt("the board a hero's Imperial Title shows his realm", thenTheLineForTheRealmsNotMet);
}

/** A title as its changes are told: its key and name, and whether a realm (not a hero) holds it. */
interface ATitleAsItsChangesAreTold {
  readonly key: string;
  readonly name: string;
  readonly kingdomLevel?: boolean | undefined;
}
/** Who holds a title, as its changes read it (nobody, where no record holds it). */
interface ATitleHeldAsItsChangesReadIt {
  readonly charId?: number | null | undefined;
  readonly playerIndex?: number | null | undefined;
}
/** A title a realm lost this turn, as the turn records it. */
type ATitleLost = NonNullable<GameState['_titleLossesByPlayer']>[string][number];
/** A title a realm won this turn, as the turn records it (its realm's name none where its index names no realm). */
type ATitleGained = Omit<NonNullable<GameState['_titleGainsByPlayer']>[string][number], 'kingdomName'> & {
  kingdomName: string | null;
};
/** The turn's record of the titles, as the title changes write it: the saved game's, read and written as a view. */
interface TheTitlesRecordAsTheChangesWriteIt {
  _titlesSnapshot?:
    | {
        readonly major?: Readonly<Partial<Record<string, MajorTitleSnapshot>>> | undefined;
        readonly minor?: Readonly<Partial<Record<string, MinorTitleSnapshot>>> | undefined;
        readonly wasPublic: boolean;
      }
    | undefined;
  _titleGainsByPlayer?: Partial<Record<string, ATitleGained[]>> | undefined;
  _titleLossesByPlayer?: Partial<Record<string, ATitleLost[]>> | undefined;
}

// ── TITLE CHANGES ── compare this turn's holders to last turn's snapshot so each player's report
// can announce titles their characters/realm newly won this turn (with how + effect).
// Its types (plan P1-10b35): the turn's record of the titles is written through a view of the same record (its snapshot
// by any title's key, empty when the standings fail; a gain's realm none where its index names no realm): the saved
// schema is unchanged.
export function titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn(turnContext: TurnContext) {
  const { G } = turnContext;
  const theTitlesRecord: TheTitlesRecordAsTheChangesWriteIt = G;
  let curMajor: Partial<Record<string, MajorTitleSnapshot>> = {},
    curMinor: Partial<Record<string, MinorTitleSnapshot>> = {};
  try {
    const st = computeStandings(G);
    TITLE_DEFS.forEach((t) => {
      const h: Partial<MajorTitleHolder> = st.titles[t.key] ?? {};
      curMajor[t.key] = {
        charId: h.charId ?? null,
        playerIndex: h.playerIndex ?? null,
        kingdomLevel: !!t.kingdomLevel,
      };
    });
    const mh = computeMinorTitles(G);
    MINOR_TITLES.forEach((t) => {
      const h: Partial<MinorTitleHolder> = mh[t.key] ?? {};
      curMinor[t.key] = {
        charId: h.charId ?? null,
        playerIndex: h.playerIndex ?? null,
      };
    });
  } catch {
    curMajor = {};
    curMinor = {};
  }
  const prev = theTitlesRecord._titlesSnapshot ?? null;
  const nowPublic = (G.turn || 1) >= TITLES_PUBLIC_FROM_TURN || !!G.gameOver;
  // The FIRST turn titles go public, announce every title a player currently holds (their initial
  // standing). After that, announce only titles that change hands. `firstPublic` is true when we
  // are public now but the previous snapshot was taken while NOT public (or there is no prior
  // snapshot).
  const firstPublic = nowPublic && !prev?.wasPublic;
  const gainsByPlayer: Partial<Record<string, ATitleGained[]>> = {};
  const lossesByPlayer: Partial<Record<string, ATitleLost[]>> = {}; // title CHANGES also notify the previous holder they lost it.
  if (nowPublic) {
    const chName = (id: number | null | undefined) => {
      const c = (asItsGuardReadsIt(G.characters) ?? []).find((x) => x.id === id);
      return c ? c.name : null;
    };
    const pName = (pi: number) => {
      const p = G.players[pi];
      return p ? p.name : null;
    };
    // A title changed hands away from `was` — record the loss for the OLD holder (a rival now
    // holds it, or it has fallen vacant). Never fired on the first public reveal (no prior public
    // holder), and never when the same realm keeps it via a different character.
    const recordLoss = (
      scope: string,
      t: ATitleAsItsChangesAreTold,
      cur: ATitleHeldAsItsChangesReadIt,
      was: ATitleHeldAsItsChangesReadIt,
    ) => {
      if (firstPublic) return;
      const hadHolder = t.kingdomLevel ? was.playerIndex != null : was.charId != null;
      const nowDifferent = t.kingdomLevel ? cur.playerIndex !== was.playerIndex : cur.charId !== was.charId;
      if (!hadHolder || !nowDifferent) return;
      const loserPi = was.playerIndex;
      if (loserPi == null || loserPi === cur.playerIndex) return; // same realm kept it → not a loss
      const itsLosses = lossesByPlayer[loserPi] ?? [];
      lossesByPlayer[loserPi] = itsLosses;
      itsLosses.push({
        scope,
        key: t.key,
        name: t.name,
        kingdomLevel: !!t.kingdomLevel,
        vacant: cur.playerIndex == null,
        newHolderIndex: cur.playerIndex ?? null, // 2026-09-27 item 3: lets the report withhold the name of a realm this player has not met
        newHolderName: cur.playerIndex != null ? pName(cur.playerIndex) : null,
        newCharName: t.kingdomLevel || cur.charId == null ? null : chName(cur.charId),
      });
    };
    TITLE_DEFS.forEach((t) => {
      const cur: ATitleHeldAsItsChangesReadIt = curMajor[t.key] ?? {},
        was: ATitleHeldAsItsChangesReadIt = prev?.major?.[t.key] ?? {};
      const changed = firstPublic
        ? cur.playerIndex != null // first reveal → any current holder
        : t.kingdomLevel
          ? cur.playerIndex != null && cur.playerIndex !== was.playerIndex
          : cur.charId != null && cur.charId !== was.charId;
      if (changed) {
        const pi = cur.playerIndex;
        if (pi != null) {
          const itsGains = gainsByPlayer[pi] ?? [];
          gainsByPlayer[pi] = itsGains;
          itsGains.push({
            scope: 'major',
            key: t.key,
            name: t.name,
            charName: t.kingdomLevel ? null : chName(cur.charId),
            kingdomName: pName(pi),
            kingdomLevel: !!t.kingdomLevel,
            perk: t.perk,
            req: t.req,
            initial: firstPublic,
          });
        }
      }
      recordLoss('major', t, cur, was);
    });
    MINOR_TITLES.forEach((t) => {
      const cur: ATitleHeldAsItsChangesReadIt = curMinor[t.key] ?? {},
        was: ATitleHeldAsItsChangesReadIt = prev?.minor?.[t.key] ?? {};
      const changed = firstPublic ? cur.charId != null : cur.charId != null && cur.charId !== was.charId;
      if (changed) {
        const pi = cur.playerIndex;
        if (pi != null) {
          const itsGains = gainsByPlayer[pi] ?? [];
          gainsByPlayer[pi] = itsGains;
          itsGains.push({
            scope: 'minor',
            key: t.key,
            name: t.name,
            charName: chName(cur.charId),
            kingdomName: pName(pi),
            perk: t.perk,
            req: t.req,
            initial: firstPublic,
          });
        }
      }
      recordLoss('minor', t, cur, was);
    });
  }
  theTitlesRecord._titleGainsByPlayer = gainsByPlayer;
  theTitlesRecord._titleLossesByPlayer = lossesByPlayer;
  theTitlesRecord._titlesSnapshot = { major: curMajor, minor: curMinor, wasPublic: nowPublic };
}
