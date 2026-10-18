// The build's manifest (P1-05): which files under src/ make each published file in site/. npm run build
// (tools/build.ts) reads it and nothing else: there is no globbing, so the order can't drift.
//
// A page's template is the page with every inline <script> and <style> block's contents taken out. Each block's place
// is one line, {{kc-build:<name>}}, which the build replaces with that block's files, one after another, byte for byte.
// Order matters: a page's classic scripts share one global scope, so a top-level const or let used before its line
// has run throws (docs/traps.md, "Top-level declaration order"). Keep each list in the order the code runs.
//
// Each .js file is a stretch of whole top-level statements, so it parses on its own (tests/static/build.test.ts). A
// file's folder says what most of it is (plan P1-05: engine/, views/, db/, ui/<page>/), so the later module switch
// renames files rather than moves them. A new file goes into a list here, or the build stops.
//
// Paths are relative to src/. Page names are the published names, in site/.

/** One page: its template, and for each {{kc-build:<name>}} line in it, the files that replace that line. */
export interface Page {
  readonly template: string;
  readonly blocks: Readonly<Record<string, readonly string[]>>;
}

export const PAGES: Readonly<Record<string, Page>> = {
  'kingdoms-call-gm-portal.html': {
    template: 'ui/gm/kingdoms-call-gm-portal.html',
    blocks: {
      'boot-reporter': ['ui/gm/boot-reporter.js'],
      style: ['ui/gm/style.css'],
      main: [
        // The dice and the clock come first, so no code can draw or read them before they exist (P1-07).
        'engine/rng.js',
        'engine/clock.js',
        'ui/gm/startup.js',
        'engine/army-tables.js',
        'engine/battle/fates.js',
        'engine/battle/lines.js',
        'engine/battle/ladder.js',
        'engine/units/movement.js',
        'engine/battle/strength.js',
        'ui/gm/config.js',
        'ui/gm/sign-in.js',
        'ui/gm/game-list.js',
        'ui/gm/game-detail.js',
        'engine/grand-design.js',
        'ui/gm/turn-log.js',
        'ui/gm/turn-zero.js',
        'engine/world/tables.js',
        'engine/battle/fortune.js',
        'engine/names.js',
        'engine/items/tiers-and-hoards.js',
        'engine/graves.js',
        'engine/items/lair-items.js',
        'engine/heroes/fame-and-consecration.js',
        'views/visibility.js',
        'engine/items/equipment.js',
        'engine/heroes/skills-and-hp.js',
        'engine/personal-combat/helpers.js',
        'engine/units/drill-and-spoils.js',
        'engine/dice-and-army-names.js',
        'db/game-meta.js',
        'db/telemetry.js',
        'ui/gm/stats-tab.js',
        'ui/gm/hall-of-fame.js',
        'ui/gm/turn-mode.js',
        'ui/gm/auto-turn.js',
        'engine/bots/setup.js',
        'engine/bots/intel.js',
        'engine/bots/war.js',
        'engine/bots/strategy.js',
        'engine/bots/specialists.js',
        'engine/bots/missions.js',
        'engine/bots/movement.js',
        'engine/bots/economy.js',
        'engine/bots/spellcraft.js',
        'engine/bots/phase-one.js',
        'engine/world/generate.js',
        'engine/world/map-helpers.js',
        'engine/titles/perks.js',
        'engine/heroes/charms-and-neutrals.js',
        'engine/chances-and-lair-grades.js',
        'engine/titles/reckoning.js',
        'views/turn-report.js',
        'engine/discoveries.js',
        'engine/turn/context.js',
        'engine/turn/log-line-helpers.js',
        'engine/turn/mercenary-ids-and-battle-records.js',
        'engine/realms/relations-and-captures.js',
        'engine/titles/title-holders-and-battle-merit.js',
        'engine/heroes/effective-skills-and-hidden-heroes.js',
        'engine/battle/terrain-and-unit-strength.js',
        'engine/units/sea-lift-stranding-and-retreats.js',
        'engine/units/movement-pools.js',
        'engine/turn/intrusion-warnings.js',
        'engine/units/recruit-limits.js',
        'engine/battle/best-commander.js',
        'engine/magic/plague-and-bless-ward.js',
        'engine/heroes/experience-skill-rises-and-earned-hp.js',
        'engine/battle/battle-report-lines-and-force-markers.js',
        'engine/battle/evil-terror.js',
        'engine/magic/pre-battle-spell-choice.js',
        'engine/battle/blood-harvest-and-iron-throne.js',
        'engine/battle/raid-the-coast-and-landing-parties.js',
        'engine/espionage/what-a-spy-learns.js',
        'engine/turn/realm-reports-and-spy-stealth.js',
        'engine/personal-combat/speed-encounter-plans-and-combatants.js',
        'engine/personal-combat/to-hit-wounds-stuns-and-courage.js',
        'engine/personal-combat/combat-spells-and-guardian-abilities.js',
        'engine/personal-combat/melee-flight-and-archery.js',
        'engine/personal-combat/tactics-combat-items-and-actions.js',
        'engine/personal-combat/resolve-personal-combat.js',
        'engine/personal-combat/duels-and-character-encounters.js',
        'engine/personal-combat/lair-guardians-and-the-odds.js',
        'engine/heroes/hero-death-and-leaderless-hosts.js',
        'engine/battle/battles-against-province-defenders.js',
        'engine/battle/pre-battle-duels.js',
        'engine/run-turn.js',
        'ui/gm/turn-shell.js',
        'ui/gm/start.js',
      ],
    },
  },
  'kingdoms-call-player-portal.html': {
    template: 'ui/player/kingdoms-call-player-portal.html',
    blocks: {
      'boot-reporter': ['ui/player/boot-reporter.js'],
      style: ['ui/player/style.css'],
      main: [
        'ui/player/startup.js',
        'ui/player/items-and-heroes.js',
        'ui/player/init.js',
        'ui/player/layout.js',
        'ui/player/sign-in.js',
        'ui/player/game-lists.js',
        'ui/player/join-and-chronicle.js',
        'ui/player/report.js',
        'ui/player/titles.js',
        'ui/player/order-chances.js',
        'ui/player/move-analysis.js',
        'ui/player/orders-form.js',
        'ui/player/pre-orders.js',
        'ui/player/briefing-and-submit.js',
        'ui/player/skills-and-projections.js',
        'ui/player/order-targets.js',
        'ui/player/map-symbols.js',
        'ui/player/map.js',
        'ui/player/dispatches.js',
        'ui/player/start.js',
      ],
    },
  },
  'kingdoms-call-leaderboard.html': {
    template: 'ui/leaderboard/kingdoms-call-leaderboard.html',
    blocks: {
      'boot-reporter': ['ui/leaderboard/boot-reporter.js'],
      style: ['ui/leaderboard/style.css'],
      main: ['ui/leaderboard/main.js'],
    },
  },
  'kingdoms-call-overlord.html': {
    template: 'ui/overlord/kingdoms-call-overlord.html',
    blocks: {
      'boot-reporter': ['ui/overlord/boot-reporter.js'],
      style: ['ui/overlord/style.css'],
      main: ['ui/overlord/main.js'],
    },
  },
  'index.html': {
    template: 'ui/landing/index.html',
    blocks: {
      style: ['ui/landing/style.css'],
    },
  },
  'kingdoms-call-rules.html': {
    template: 'rulebook/kingdoms-call-rules.html',
    blocks: {
      style: ['rulebook/rulebook.css'],
      toc: ['rulebook/toc.js'],
    },
  },
  'kingdoms-call-rules-intro.html': {
    template: 'rulebook/kingdoms-call-rules-intro.html',
    blocks: {
      style: ['rulebook/rulebook.css'],
      toc: ['rulebook/toc.js'],
    },
  },
};

/** The engine (plan P1-18c): the GM page's main files under engine/ and views/, in page order, so the dice and the
 *  clock come first. Folder equals layer: nothing in these folders reads the screen, the database or the page's
 *  globals as it loads, so tests/lib/engine.ts runs them in a bare Node vm. tests/static/engine-files.test.ts checks
 *  that every file in the two folders is on the GM page's main list, so none escapes the loader. */
export function engineFiles(): string[] {
  const main = PAGES['kingdoms-call-gm-portal.html']?.blocks['main'] ?? [];
  return main.filter((f) => f.startsWith('engine/') || f.startsWith('views/'));
}

/** Files published as they are: the published name (in site/) and the file in src/. */
export const COPIES: Readonly<Record<string, string>> = {
  'kingdoms-call-data.js': 'content/kingdoms-call-data.js',
  'kc-safe.js': 'ui/shared/kc-safe.js',
  'kc-staging-footer.js': 'ui/shared/kc-staging-footer.js',
  'kc-config.js': 'db/kc-config.js',
  'kc-db-guard.js': 'db/kc-db-guard.js',
  'vendor/supabase-js-2.117.3.min.js': 'vendor/supabase-js-2.117.3.min.js',
  'vendor/supabase-js-LICENSE.txt': 'vendor/supabase-js-LICENSE.txt',
};
