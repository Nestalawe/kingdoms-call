// ── THE FACTS THE DEFEND WATCH'S LINES RECORD (plan P1-12d14: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines a hero on a Defend order writes while he keeps watch (units/defend-ride-outs-ambushes-and-
// reinforcements.ts): a general stranded on drowned ground, holding his own gate, held by an unresolved battle, riding
// out to meet a column (runDefendReactions) and told when no battle came of it (reconcileDefendRideOuts), riding in to
// a host raised in a province of his realm (defendAnswerUnitGain), riding out to a host standing in his watch, falling
// upon it and winning the ground back (runDefendMaterializedReactions), a lone hero's ambush, its odds, a miss and the
// strike (runDefendAmbush), and a column hurried in ahead of the enemy (runReinforcementArrivals). Each kind holds plain
// values: a hero's, a province's or a realm's name as the world holds it (null where the line falls back: the prose
// writes "their realm"), the names of the heroes a column marches with (copied as the line is told: the prose joins
// them), a flag for each clause the line chooses, and the ambush's Spy level, chance and roll (the prose writes the
// mark), and the realm's name a raiser's tag is written from (since P1-12d25). The prose writes every word
// (src/views/prose/the-words-of-the-defend-watchs-lines.ts). Each is filed on its own, with the audience its event names (its event's): no audience changes. The lines
// of the fight an ambush springs are personal combat's, and the slain line a hero's death's.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** What a line of the Defend watch records. */
export type TheFactOfADefendWatchsLine =
  | {
      kind: 'a defender on drowned ground is stranded and cannot ride out';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a defender holds his own province with the enemy at its gate';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a defender held by an unresolved battle cannot ride out';
      heroName: string;
      provinceName: string;
      /** The province he would have ridden out to. */
      threatenedProvinceName: string;
    }
  | {
      kind: 'a defender rides out to meet a column crossing into a province of his realm';
      heroName: string;
      /** The heroes leading the columns marching in (the prose joins them with "and"). */
      invaderNames: string[];
      provinceName: string;
    }
  | {
      kind: 'a defender rides out but the column never crosses the border';
      heroName: string;
      provinceName: string;
      invaderNames: string[];
    }
  | {
      kind: 'a defender rides out and faces a column but no battle is joined';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a defender rides in to meet a host raised in a province of his realm';
      heroName: string;
      raiserName: string;
      /** The realm's name, as the world holds it, or null for no realm: the prose writes its tag, " (Westmarch)". */
      realmTag: string | null;
      /** The raiser turns a host already camped inside on the province (a war front), else he gathers one there. */
      turningAWarFront: boolean;
      provinceName: string;
    }
  | {
      kind: 'a defender rides out to meet a host risen in his watch';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a defender forms his line against a host taking shape where he stands';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a defender falls upon a host in his watch';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a defender drives the interlopers out and secures the province';
      heroName: string;
      provinceName: string;
      /** His realm's name as the world holds it; null: no realm found (the prose says "their realm"). */
      realmName: string | null;
    }
  | {
      kind: "the odds of a lone defender's ambush";
      heroName: string;
      /** His Spy level as it counts in play. */
      spy: number;
      quarryName: string;
      /** The quarry leads troops, so the chance was halved. */
      guarded: boolean;
      chance: number;
      roll: number;
    }
  | {
      kind: 'a lone defender finds no opening to strike';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a lone defender springs his ambush';
      heroName: string;
      quarryName: string;
      provinceName: string;
    }
  | {
      kind: 'a column is hurried in ahead of the enemy';
      heroName: string;
      provinceName: string;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCHS_LINE: Readonly<
  Record<TheFactOfADefendWatchsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a defender on drowned ground is stranded and cannot ride out': "its event's",
  'a defender holds his own province with the enemy at its gate': "its event's",
  'a defender held by an unresolved battle cannot ride out': "its event's",
  'a defender rides out to meet a column crossing into a province of his realm': "its event's",
  'a defender rides out but the column never crosses the border': "its event's",
  'a defender rides out and faces a column but no battle is joined': "its event's",
  'a defender rides in to meet a host raised in a province of his realm': "its event's",
  'a defender rides out to meet a host risen in his watch': "its event's",
  'a defender forms his line against a host taking shape where he stands': "its event's",
  'a defender falls upon a host in his watch': "its event's",
  'a defender drives the interlopers out and secures the province': "its event's",
  "the odds of a lone defender's ambush": "its event's",
  'a lone defender finds no opening to strike': "its event's",
  'a lone defender springs his ambush': "its event's",
  'a column is hurried in ahead of the enemy': "its event's",
};
