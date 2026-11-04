// ── A guardian's kind and the label a player reads it by (plan P1-13j) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). A guardian's kind (monsterCat) decides which hoard items it may wield (guardianCanUseItem), how a
// fight treats it and how its lair is named; its label is the word the reports print beside its name (the personal
// combat's and the explore orders' prose, and the realm's view of the world).
// The category already decided which hoard items a guardian could wield, and White Magic's double
// damage against the undead and fiends turns on it — but it was never printed, so a player reading
// "Guardian: Barrow Wight" had to know the bestiary to tell what kind of thing they were sending a
// hero against. Every player-facing list now prints it beside the name. Display only; no mechanic
// moves. Shipped on the feature payloads as `monsterCat` and rendered by the player portal.

/** A guardian as the lair names and its kind read it (a test's may hold its category alone). */
export interface AGuardianAsTheseRead {
  readonly cat?: string | null | undefined;
  readonly name?: string | undefined;
}

export function monsterCat(m: AGuardianAsTheseRead | null | undefined) {
  if (m?.cat) return m.cat;
  const n = (m?.name ?? '').toLowerCase();
  if (
    /lich|skelet|zombie|wraith|ghoul|vampir|bone|death knight|undead|ghost|spectr|drowned|wight|mumm|banshee|dracolich/.test(
      n,
    )
  )
    return 'undead';
  if (/demon|devil|fiend|hell|chaos|brimstone|imp\b|archdemon/.test(n)) return 'fiend';
  if (/dragon|wyrm|wyvern|drake|hydra/.test(n)) return 'dragon';
  if (/giant|troll|ogre|titan/.test(n) && !/giant (rat|wasp|spider|centipede|crab|barnacle|toad|sea|octopus)/.test(n))
    return 'giant';
  if (/golem|sentinel|construct|statue/.test(n)) return 'construct';
  if (/harpy|sprite|siren|hag|pixie|dryad/.test(n)) return 'fey';
  if (/rat|wasp|bat|spider|centipede|piranha|barnacle|crab|leech|mite|jellyfish|swarm/.test(n)) return 'vermin';
  if (/kraken|horror|octopus|abyssal/.test(n)) return 'aberration';
  if (/elemental|devil\b/.test(n)) return 'elemental';
  if (
    /goblin|bandit|cutthroat|assassin|kobold|pirate|merrow|priest|scout|hobgoblin|orc|gnoll|minotaur|shaman|smuggler|wrecker|medusa|warlord|captain|deckhand/.test(
      n,
    )
  )
    return 'humanoid';
  return 'beast';
}
export const MONSTER_CAT_LABELS = {
  humanoid: 'Humanoid',
  undead: 'Undead',
  beast: 'Beast',
  vermin: 'Vermin',
  giant: 'Giant',
  dragon: 'Dragon',
  fiend: 'Fiend',
  fey: 'Fey',
  aberration: 'Aberration',
  elemental: 'Elemental',
  construct: 'Construct',
};
export function monsterCatLabel(m: Parameters<typeof monsterCat>[0]) {
  if (!m) return '';
  const c = monsterCat(m);
  // the table read by any category's name
  const labels: Readonly<Partial<Record<string, string>>> = MONSTER_CAT_LABELS;
  return labels[c] ?? ''; // no label is ''
}
