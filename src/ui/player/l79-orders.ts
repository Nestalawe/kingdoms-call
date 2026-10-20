// ── L79_ORDERS: a constant read as the page loads ────
// Moved here unchanged (plan P1-09b) from src/ui/player/items-and-heroes.js, the file just after this one in the page.
// src/ui/player/pre-orders.js reads it as the page loads, and the two files are in one cycle of files that read each
// other: once the page is made of modules (P1-09d), the file that runs second could meet it before its line has run. A
// file that reads nothing runs before every file that reads it (docs/traps.md, "Top-level declaration order").
// L7/L9 mastery ORDERS — gated by the hero's RAW skill level (past-5 comes from experience only).
// target: 'none' (self/current province), 'province' (a seen province), or 'character' (an enemy
// hero here).
export const L79_ORDERS = {
  Sabotage: {
    skill: 'spy',
    lvl: 7,
    target: 'province',
    provKind: 'enemy',
    hint: 'Spy 7: wreck an enemy province you can see — it yields no tax next turn and loses a garrison unit.',
  },
  'Forced March': {
    skill: 'march',
    lvl: 7,
    target: 'province',
    provKind: 'move_adjacent',
    hint: 'March 7: march to an adjacent province — if an enemy army or a Defend order awaits, a 50% chance to slip in without a battle this phase (the fight comes next phase if you stay, or at turn end).',
  },
  'Grand Heist': {
    skill: 'thief',
    lvl: 7,
    target: 'here',
    hint: "Thief 7 · ONE attempt per thief per turn (spent win or lose). You crack the vaults of THE PROVINCE YOU STAND IN — no hero is targeted. Where: the province must be held by a realm you are AT WAR with, and be their HOME CAPITAL or RICH country (tax 7+). Take: 25% of that realm's treasury (doubled at Thief 8, even past what they can cover) AND one magic item — cut from a courier still on the road inside their realm, from a Send Item order made earlier this turn (a heist never touches what a hero carries in their own pack — that is the Steal order). Odds: 60% +5% per Thief level past 5, halved if the vaults are guarded (a garrison stands there, or an enemy commander of that realm is present with troops). Fail and you are seen unless you slip away (Thief × 20%) — then a hero of that realm draws steel on you (lead with Flee in your Encounter Plan if you would rather not fight), or if none is there the guards beat you off.",
  },
  'Awaken Grove': {
    skill: 'druid',
    lvl: 7,
    target: 'none',
    hint: 'Druid 7: while in an owned forest, jungle or wild (Creature or Monster) province, raise a temporary Creature host that fights until turn\u2019s end.',
  },
  'Chart the Unknown': {
    skill: 'explorer',
    lvl: 7,
    target: 'here_or_adjacent',
    hint: 'Explorer 7: fully chart the province you stand in OR one bordering it — 100% mapped, every lair in it revealed, and all ITS neighbours glimpsed at 25%.',
  },
  'Discover Lost Ruin': {
    skill: 'explorer',
    lvl: 9,
    target: 'lair_tier',
    hint: "Explorer 9: name a class of lair. EVERY lair of that class in your province and in each bordering province is laid bare at once. A rival's Hide Lairs glamour still conceals what it covers.",
  },
  Blockade: {
    skill: 'naval',
    lvl: 7,
    target: 'province',
    provKind: 'sea_adjacent',
    hint: 'Naval 7: seal a sea province you are in or adjacent to — enemy fleets may not cross it this turn.',
  },
  'Research Breakthrough': {
    skill: 'sage',
    lvl: 7,
    target: 'none',
    hint: 'Sage 7: a guaranteed scholarly discovery this turn (if any remain undiscovered by your realm).',
  },
  Assassinate: {
    skill: 'spy',
    lvl: 9,
    target: 'character',
    hint: 'Spy 9: attempt to slay an enemy hero in the province you stand in — a spy-level chance to kill.',
  },
  Vanish: {
    skill: 'thief',
    lvl: 9,
    target: 'none',
    hint: 'Thief 9: melt into the shadows — for the rest of this turn no pursuit, Encounter or ambush can bring you to bay, and no thief caught in the act can be cornered.',
  },
  Challenge: {
    skill: 'melee',
    lvl: 7,
    target: 'character',
    hint: 'Melee 7: call out a LONE enemy hero in your province to single combat — the loser is wounded, or slain.',
  },
  Rampage: {
    skill: 'melee',
    lvl: 9,
    target: 'character',
    hint: 'Melee 9: hurl yourself at an enemy force in your province — cut down several of its units and wound its commander.',
  },
  'Rain of Arrows': {
    skill: 'archery',
    lvl: 7,
    target: 'character',
    hint: 'Archery 7: loose a volley on an enemy force in your province, felling several of its units.',
  },
  "Sniper's Mark": {
    skill: 'archery',
    lvl: 9,
    target: 'character',
    hint: 'Archery 9: mark an enemy commander in your province — a telling shot that wounds, and may slay.',
  },
  'Feigned Retreat': {
    skill: 'tactical',
    lvl: 7,
    target: 'none',
    hint: 'Tactical 7: bait your attacker — if you are attacked this turn, your defence counters at +25% strength.',
  },
  'Grand Stratagem': {
    skill: 'tactical',
    lvl: 9,
    target: 'none',
    hint: 'Tactical 9: dictate the terms of battle — your next battle this turn is fought at +20% strength.',
  },
  'Lightning Advance': {
    skill: 'march',
    lvl: 9,
    target: 'none',
    hint: 'March 9: strike before they can set — enemies you attack this turn lose their defensive footing (−20%).',
  },
  'Raid the Coast': {
    skill: 'naval',
    lvl: 9,
    target: 'none',
    hint: 'Naval 9: an amphibious assault — when you come ashore from the sea this turn and fight for the coast you land on, you hit at +25% strength (the whole landing does, even if another hero takes command of it).',
  },
  'Wild Calling': {
    skill: 'druid',
    lvl: 9,
    target: 'none',
    hint: 'Druid 9: while standing in a wild (Creature or Monster) province, call its wild host to your banner — several of its beasts defect to you.',
  },
  // 2026-09-27 (Toby item 3): the old hint promised "+1 tax in every province, forever" — an effect
  // no Wonder has had for a long time. Each alignment raises a DIFFERENT Wonder (see GD_BY_ALIGNMENT
  // below, and _GD_DEFS in the GM engine's 'grand_design' case), so the hint is rewritten for the
  // reader's OWN realm by gdHintFor() as the order form is drawn. This string is only the fallback
  // for a report that carries no alignment.
  'Grand Design': {
    skill: 'sage',
    lvl: 9,
    target: 'none',
    hint: 'Sage 9: complete your realm\u2019s Grand Design — a unique, once-ever Wonder whose blessing is set by your realm\u2019s alignment.',
  },
};
