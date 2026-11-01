// ── THE STATISTICS OF THE TURN, AS THE WRITER READS THEM (plan P1-12d33: P1-12d's last slice, Decision 1) ────
// The turn files what its statistics record as facts of their own, in the turn's order (recordForTheStatistics,
// src/engine/turn/events-and-their-audiences.ts), beside each realm's two snapshots (pre and orders). This builds what
// db/telemetry.ts's writeTurnTelemetry reads (buildReports hands it to the shell): the two snapshots as they were
// taken, then one list a kind of record (battles, lair fights, captures, deaths, spells), each record as its fact holds
// it, key for key, in the turn's order. The rows the writer makes from them (turn_events) are the same, row for row.
import type { TurnTelemetry } from '../engine/turn/context.ts';
import type { ABattleAsTheStatisticsRecordIt } from '../engine/battle/the-facts-a-battles-lines-record.ts';
import type { AHerosDeathAsTheStatisticsRecordIt } from '../engine/heroes/the-facts-a-heros-death-lines-record.ts';
import type { AProvinceChangingHandsAsTheStatisticsRecordIt } from '../engine/realms/the-facts-relations-and-captures-lines-record.ts';
import type { ASpellCastByTheOrderAsTheStatisticsRecordIt } from '../engine/orders/the-facts-the-cast-spell-orders-lines-record.ts';
import type { ALairFoughtAsTheStatisticsRecordIt } from '../engine/orders/the-facts-the-explore-and-search-orders-lines-record.ts';
import type { ASpellWorkedInAFightAsTheStatisticsRecordIt } from '../engine/turn/log-line-helpers.ts';

/** The turn's statistics as db/telemetry.ts reads them: each realm's two snapshots, then each list, in that order. */
export interface TheStatisticsOfTheTurn {
  pre: TurnTelemetry['pre'];
  orders: TurnTelemetry['orders'];
  battles: ABattleAsTheStatisticsRecordIt[];
  encounters: ALairFoughtAsTheStatisticsRecordIt[];
  captures: AProvinceChangingHandsAsTheStatisticsRecordIt[];
  deaths: AHerosDeathAsTheStatisticsRecordIt[];
  spells: (ASpellWorkedInAFightAsTheStatisticsRecordIt | ASpellCastByTheOrderAsTheStatisticsRecordIt)[];
}

/** The turn's statistics, built from its telemetry: the snapshots as taken, and each fact's record in its list. */
export function theStatisticsOfTheTurn(telemetry: TurnTelemetry): TheStatisticsOfTheTurn {
  const statistics: TheStatisticsOfTheTurn = {
    pre: telemetry.pre,
    orders: telemetry.orders,
    battles: [],
    encounters: [],
    captures: [],
    deaths: [],
    spells: [],
  };
  for (const fact of telemetry.factsInTheTurnsOrder)
    switch (fact.kind) {
      case 'a battle fought, for the statistics':
        statistics.battles.push(fact.record);
        break;
      case 'a lair fought, for the statistics':
        statistics.encounters.push(fact.record);
        break;
      case 'a province changing hands, for the statistics':
        statistics.captures.push(fact.record);
        break;
      case "a hero's death, for the statistics":
        statistics.deaths.push(fact.record);
        break;
      case 'a spell worked in a battle or a duel, for the statistics':
      case 'a spell cast by the Cast Spell order, for the statistics':
        statistics.spells.push(fact.record);
        break;
    }
  return statistics;
}
