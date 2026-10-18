// tests/suite.ts: the test scripts npm test runs, each with its level (tests/README.md says what each checks).
// tests/legacy.test.ts runs each one in its own Node process, with these arguments and environment; it passes when
// the script exits 0. A script that checks at more than one level sits at its highest. Sizes are the scripts' own
// command-line arguments; `full` (npm run test:full) gives the bigger runs. Moved here from tests/run.js (P1-01a);
// the scripts become Vitest tests over P1-14.

export const LEVELS = ['static', 'unit', 'scenario', 'simulation', 'page'] as const;
export type Level = (typeof LEVELS)[number];

export interface Script {
  level: Level;
  name: string;
  file: string;
  args: string[];
  env: Record<string, string>;
}

const GM = 'kingdoms-call-gm-portal.html';

export function suite(full: boolean): Script[] {
  // [level, name, file, args, env]
  const rows: [Level, string, string, string[]?, Record<string, string>?][] = [
    ['static', 'syntax', 'tests/syntax.test.js'],
    ['static', 'docs', 'tests/docs.test.js'],
    ['static', 'rulings', 'tests/rulings.test.js'],
    ['static', 'stamps', 'tests/stamps.test.js'],
    ['static', 'config', 'tests/config.test.js'],
    ['static', 'vendor-supabase', 'tests/vendor-supabase.test.js'],
    ['static', 'db-min', 'tests/db-min.test.js'],
    ['static', 'html-lint', 'tests/html-lint.test.js'],
    ['unit', 'kc-safe', 'tests/kc-safe.test.js'],
    ['static', 'workflow-api-auth', 'tests/workflow-api-auth.test.js'],
    ['static', 'sql-banners', 'tests/sql-banners.test.js'],
    ['static', 'gm-portal-no-signup', 'tests/gm-portal-no-signup.test.js'],
    ['static', 'profiles-columns', 'tests/profiles-columns.test.js'],
    ['static', 'sort-comparators', 'tests/sort-comparators.test.js'],
    ['unit', 'dangerous-paths', 'tests/dangerous-paths.test.js'],
    ['unit', 'staging', 'tests/staging.test.js'],
    ['page', 'staging-footer', 'tests/staging-footer.test.js'],
    ['unit', 'migrations', 'tests/migrations.test.js'],
    ['static', 'landing-footer', 'tests/landing-footer.test.js'],
    ['static', 'flyers-soldiers-words', 'tests/flyers-soldiers-words.test.js'],
    ['static', 'unit-type-words', 'tests/unit-type-words.test.js'],
    ['static', 'volley-thirty-words', 'tests/volley-thirty-words.test.js'],
    ['static', 'battle-lines-words', 'tests/battle-lines-words.test.js'],
    ['static', 'roster-words', 'tests/roster-words.test.js'],
    ['static', 'abilities-words', 'tests/abilities-words.test.js'],
    ['static', 'primal-words', 'tests/primal-words.test.js'],
    ['page', 'boot-pages', 'tests/boot-pages.test.js'],
    ['page', 'db-guard', 'tests/db-guard.test.js'],
    ['page', 'gm-offer-and-gate', 'tests/gm-offer-and-gate.test.js'],
    ['page', 'other-realms-slots', 'tests/other-realms-slots.test.js'],
    ['page', 'games-for-their-players', 'tests/games-for-their-players.test.js'],
    ['page', 'dispatch-limits', 'tests/dispatch-limits.test.js'],
    ['page', 'report-dispatch', 'tests/report-dispatch.test.js'],
    ['page', 'eliminated-dispatches', 'tests/eliminated-dispatches.test.js'],
    ['scenario', 'eliminated-report', 'tests/eliminated-report.test.js'],
    ['page', 'overlord-page', 'tests/overlord-page.test.js'],
    ['page', 'overlord-suspend-delete', 'tests/overlord-suspend-delete.test.js'],
    ['page', 'hostile-overlord', 'tests/hostile-overlord.test.js'],
    ['page', 'hostile-leaderboard', 'tests/hostile-leaderboard.test.js'],
    ['page', 'hostile-gm-portal', 'tests/hostile-gm-portal.test.js'],
    ['page', 'hostile-player-portal', 'tests/hostile-player-portal.test.js'],
    ['page', 'master-gm-mode', 'tests/master-gm-mode.test.js'],
    ['page', 'profiles-no-email', 'tests/profiles-no-email.test.js'],
    ['page', 'hall-of-fame-controls', 'tests/hall-of-fame-controls.test.js'],
    ['page', 'stats-forget-deleted', 'tests/stats-forget-deleted.test.js'],
    ['scenario', 'meta-missing-turn', 'tests/meta-missing-turn.test.js'],
    ['simulation', 'turn-fuzz', 'tests/turn-fuzz.test.js', full ? ['16', '12'] : ['4', '6']],
    ['unit', 'home-placement', 'tests/home-placement.test.js', [], { RUNS: full ? '1000' : '200' }],
    ['unit', 'druid-and-war-spoils', 'tests/druid-and-war-spoils.test.js'],
    ['unit', 'flyers-soldiers', 'tests/flyers-soldiers.test.js'],
    ['unit', 'unit-types', 'tests/unit-types.test.js'],
    ['scenario', 'volley-thirty', 'tests/volley-thirty.test.js'],
    ['unit', 'battle-grid', 'tests/battle-grid.test.js'],
    ['unit', 'battle-facing', 'tests/battle-facing.test.js'],
    ['unit', 'battle-scout', 'tests/battle-scout.test.js'],
    ['unit', 'battle-faced-lines', 'tests/battle-faced-lines.test.js'],
    ['scenario', 'battle-faced-turn', 'tests/battle-faced-turn.test.js'],
    ['unit', 'roster', 'tests/roster.test.js'],
    ['scenario', 'goblins-two-a-turn', 'tests/goblins-two-a-turn.test.js'],
    ['unit', 'abilities-human', 'tests/abilities-human.test.js'],
    ['unit', 'abilities-elven', 'tests/abilities-elven.test.js'],
    ['unit', 'abilities-dwarven', 'tests/abilities-dwarven.test.js'],
    ['unit', 'abilities-orcish', 'tests/abilities-orcish.test.js'],
    ['scenario', 'abilities-turn', 'tests/abilities-turn.test.js'],
    ['unit', 'primal-roster', 'tests/primal-roster.test.js'],
    ['unit', 'primal-renames', 'tests/primal-renames.test.js'],
    ['scenario', 'two-crowns', 'tests/two-crowns.test.js'],
    ['scenario', 'shark-waters', 'tests/shark-waters.test.js'],
    ['scenario', 'new-creatures', 'tests/new-creatures.test.js'],
    ['unit', 'abilities-beasts', 'tests/abilities-beasts.test.js'],
    ['scenario', 'abilities-beasts-turn', 'tests/abilities-beasts-turn.test.js'],
    ['unit', 'battle-fronts-meet', 'tests/battle-fronts-meet.test.js'],
    ['scenario', 'beast-calls-gone', 'tests/beast-calls-gone.test.js'],
    ['unit', 'terror-visible', 'tests/terror-visible.test.js'],
    ['scenario', 'beast-command', 'tests/beast-command.test.js'],
    ['static', 'primal-abilities-words', 'tests/primal-abilities-words.test.js'],
    ['scenario', 'island-back', 'tests/island-back.test.js'],
    ['unit', 'leaderboard-records', 'tests/leaderboard-records.test.js', [], { N: full ? '3000' : '100' }],
    ['unit', 'leaderboard-golden', 'tests/leaderboard-golden.test.js'],
    ['page', 'leaderboard-render', 'tests/leaderboard-render.test.js'],
    ['unit', 'leaderboard-events-paging', 'tests/leaderboard-events-paging.test.js'],
    ['page', 'leaderboard-realm-bests', 'tests/leaderboard-realm-bests.test.js'],
    ['scenario', 'battle-spells-recorded', 'tests/battle-spells-recorded.test.js'],
    ['scenario', 'concede', 'tests/concede.test.js'],
    ['unit', 'monarch-grave', 'tests/monarch-grave.test.js'],
    ['scenario', 'guardian-traits', 'tests/guardian-traits.test.js'],
    ['unit', 'unit-fates', 'tests/unit-fates.test.js'],
    ['scenario', 'move-points', 'tests/move-points.test.js'],
    ['scenario', 'overtures', 'tests/overtures.test.js'],
    ['page', 'orders-group-by-location', 'tests/orders-group-by-location.test.js'],
    ['unit', 'duel-refuse-default', 'tests/duel-refuse-default.test.js'],
    ['page', 'cast-practice-projection', 'tests/cast-practice-projection.test.js'],
    ['simulation', 'lair-province-unique', 'tests/lair-province-unique.test.js'],
    ['simulation', 'lair-effects-spread', 'tests/lair-effects-spread.test.js'],
    ['scenario', 'duel-skill-rise', 'tests/duel-skill-rise.test.js'],
    ['simulation', 'skill-names-capitalised', 'tests/skill-names-capitalised.test.js'],
    ['scenario', 'item-equip-note', 'tests/item-equip-note.test.js'],
    ['simulation', 'crown-wild-near', 'tests/crown-wild-near.test.js', full ? ['12'] : ['4']],
    ['simulation', 'neutral-best-mix', 'tests/neutral-best-mix.test.js'],
    ['page', 'cast-practice-assumed', 'tests/cast-practice-assumed.test.js'],
    ['scenario', 'research-persevere', 'tests/research-persevere.test.js'],
    ['scenario', 'surgery-lines', 'tests/surgery-lines.test.js'],
    ['unit', 'guardian-special-odds', 'tests/guardian-special-odds.test.js'], // batch 2026-10-14
    ['scenario', 'xp-lair-thief', 'tests/xp-lair-thief.test.js'], // batch 2026-10-14
    ['scenario', 'practice-human', 'tests/practice-human.test.js'], // batch 2026-10-14
    ['scenario', 'xp-small-chances', 'tests/xp-small-chances.test.js'], // batch 2026-10-14
    ['static', 'spell-words', 'tests/spell-words.test.js'], // batch 2026-10-14
    ['static', 'lair-readiness-words', 'tests/lair-readiness-words.test.js'], // batch 2026-10-14
    ['static', 'rulebook-review-words', 'tests/rulebook-review-words.test.js'], // batch 2026-10-15
    ['static', 'game-text-review-words', 'tests/game-text-review-words.test.js'], // batch 2026-10-15
    ['unit', 'corsairs-retired', 'tests/corsairs-retired.test.js'], // batch 2026-10-15
    ['unit', 'sight-shared-province', 'tests/sight-shared-province.test.js'], // batch 2026-10-15
    ['scenario', 'spy-reveals', 'tests/spy-reveals.test.js'], // batch 2026-10-15
    ['static', 'mastery-hints-words', 'tests/mastery-hints-words.test.js'], // batch 2026-10-15
    ['unit', 'guard-cast-chance', 'tests/guard-cast-chance.test.js'], // batch 2026-10-15
    ['scenario', 'hierophant-no-consecrate', 'tests/hierophant-no-consecrate.test.js'], // batch 2026-10-15
    ['scenario', 'intrusion-invisible', 'tests/intrusion-invisible.test.js'], // batch 2026-10-15
    ['scenario', 'intrusion-lurker', 'tests/intrusion-lurker.test.js'], // batch 2026-10-15
    ['static', 'rulebook-order', 'tests/rulebook-order.test.js'], // 2026-10-15
    ['simulation', 'province-pools', 'tests/province-pools.test.js', full ? ['10'] : ['4']],
    ['scenario', 'warg-run-down', 'tests/warg-run-down.test.js'],
    ['scenario', 'battle-lines-report', 'tests/battle-lines-report.test.js'],
    ['page', 'hire-price', 'tests/hire-price.test.js'],
    ['scenario', 'defend-naval-overland', 'tests/defend-naval-overland.test.js'],
    ['scenario', 'defend-once', 'tests/defend-once.test.js'],
    ['scenario', 'hero-every-phase', 'tests/hero-every-phase.test.js'],
    [
      'simulation',
      'report-privacy',
      'tests/report-privacy.test.js',
      full ? [GM, '6', '20', '6'] : [GM, '3', '10', '5'],
    ],
    [
      'simulation',
      'fuzz-wages-combat',
      'tests/fuzz-wages-combat.test.js',
      full ? [GM, '6', '20', '6'] : [GM, '3', '10', '5'],
    ],
    [
      'simulation',
      'fuzz-advance-masking',
      'tests/fuzz-advance-masking.test.js',
      full ? [GM, '6', '20', '6'] : [GM, '3', '10', '5'],
    ],
  ];
  return rows.map(([level, name, file, args = [], env = {}]) => ({ level, name, file, args, env }));
}
