// ── THE WORDS OF THE DEFEND WATCH'S LINES (plan P1-12d14: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the Defend watch's lines record (src/engine/units/the-facts-the-defend-
// watchs-lines-record.ts), in the same words the engine wrote before (units/defend-ride-outs-ambushes-and-
// reinforcements.ts). The heroes a column marches with are joined with "and"; the ambush's mark is fmtRoll's, which the
// engine still calls elsewhere, on the chance and the roll alone. A kind with no words here is a compile error (the
// `never` below).
import type { TheFactOfADefendWatchsLine } from '../../engine/units/the-facts-the-defend-watchs-lines-record.ts';
import { fmtRoll } from '../../engine/dice-and-army-names.ts';

/** The words of one fact of the Defend watch's lines. */
export function theWordsOfADefendWatchsLine(fact: TheFactOfADefendWatchsLine): string {
  switch (fact.kind) {
    case 'a defender on drowned ground is stranded and cannot ride out':
      return `${fact.heroName} is stranded by the waters covering ${fact.provinceName} — without a fleet their troops cannot march out, and hold what ground remains.`;
    case 'a defender holds his own province with the enemy at its gate':
      return `${fact.heroName} holds ${fact.provinceName} rather than march to its neighbours — the enemy is already at this gate.`;
    case 'a defender held by an unresolved battle cannot ride out':
      return `${fact.heroName} is still locked in the unresolved battle for ${fact.provinceName} and cannot ride out to ${fact.threatenedProvinceName} — the fight here must be seen through first.`;
    case 'a defender rides out to meet a column crossing into a province of his realm':
      return `🛡 ${fact.heroName} is standing watch — word reaches them that ${fact.invaderNames.join(' and ')} ${fact.invaderNames.length > 1 ? 'are' : 'is'} crossing into ${fact.provinceName}. They break camp at once and march to meet the threat.`;
    case 'a defender rides out but the column never crosses the border':
      return `🛡 ${fact.heroName} reaches ${fact.provinceName} in battle order, but ${fact.invaderNames.join(' and ')} never crossed the border — no battle is fought, and they hold ${fact.provinceName} for the rest of the season.`;
    case 'a defender rides out and faces a column but no battle is joined':
      return `🛡 ${fact.heroName} stands in ${fact.provinceName} facing an enemy column, but no battle was joined this season — the contest will be settled next phase.`;
    case 'a defender rides in to meet a host raised in a province of his realm':
      return `🛡 ${fact.heroName} is standing watch — word reaches them that ${fact.raiserName}${fact.realmTag} ${fact.turningAWarFront ? 'is turning the host camped inside ' + fact.provinceName + ' on the province' : 'is gathering a host inside ' + fact.provinceName}. They break camp at once and reach ${fact.provinceName} before it can be seized, drawing up to defend it.`;
    case 'a defender rides out to meet a host risen in his watch':
      return `🛡 ${fact.heroName} stands watch — word comes that an enemy host has risen in ${fact.provinceName}. They break camp and march to meet it.`;
    case 'a defender forms his line against a host taking shape where he stands':
      return `🛡 ${fact.heroName} stands watch as an enemy host takes shape in ${fact.provinceName} — they form their line to give battle.`;
    case 'a defender falls upon a host in his watch':
      return `⚔ ${fact.heroName} falls upon ${fact.quarryName}'s host in ${fact.provinceName}!`;
    case 'a defender drives the interlopers out and secures the province':
      return `${fact.heroName} drives the interlopers out and secures ${fact.provinceName} for ${fact.realmName ?? 'their realm'}!`;
    case "the odds of a lone defender's ambush":
      return `📊 Ambush — ${fact.heroName} (Spy ${String(fact.spy)}) lies in wait for ${fact.quarryName}${fact.guarded ? ' (guarded — halved)' : ''}: ${fmtRoll(fact.chance, fact.roll)}`;
    case 'a lone defender finds no opening to strike':
      return `${fact.heroName} watches ${fact.quarryName} pass through ${fact.provinceName} but cannot find the opening to strike.`;
    case 'a lone defender springs his ambush':
      return `⚔ ${fact.heroName} springs from cover and sets upon ${fact.quarryName} in ${fact.provinceName}!`;
    case 'a column is hurried in ahead of the enemy':
      return `${fact.heroName} force-marches into ${fact.provinceName} ahead of the enemy — their troops are in the line before the first banners appear over the ridge.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the Defend watch's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
