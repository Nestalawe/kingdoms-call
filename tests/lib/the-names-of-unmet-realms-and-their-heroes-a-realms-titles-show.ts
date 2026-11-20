// The names of unmet realms and of their heroes that a realm's titles show (2026-09-27, the ruling R-046): the check of
// the titles in a realm's report (the standings, the title holders, the minor titles, the titles lost and the
// Reckoning) against the world the turn left. Exact names only, since bot realms can be "X" and "X II", and a name a met
// realm or hero also has is not a leak. Used on the engine's modules (tests/simulation/whole-all-bot-games-pay-…) and
// on the GM page's own report builder (tests/page/the-gm-pages-own-report-builder-…).

/** A realm in the world, as the check reads it. */
export interface ARealmAsTheTitlesCheckReadsIt {
  name?: string;
  _encountered?: number[];
}
/** A hero in the world, as the check reads it. */
export interface AHeroAsTheTitlesCheckReadsIt {
  name?: string;
  player?: number | null;
}
/** The world the turn left, as the check reads it. */
export interface TheWorldAsTheTitlesCheckReadsIt {
  players: ARealmAsTheTitlesCheckReadsIt[];
  characters: AHeroAsTheTitlesCheckReadsIt[];
}
/** A realm's titles, as its report holds them, as far as the check reads them. */
export interface ARealmsTitles {
  public?: unknown;
  gameOver?: unknown;
  standings?: { name?: string }[];
  holders?: Record<string, { holderName?: string; charName?: string }>;
  minor?: { all?: { kingdomName?: string; holderName?: string }[] };
  losses?: { newHolderName?: string }[];
  reckoning?: { byName?: string };
}

/** Whether `titles` are shown at all: public, and the game not over (then every name is shown). */
export const theTitlesAreShownMasked = (titles: ARealmsTitles | undefined): titles is ARealmsTitles =>
  Boolean(titles?.public) && !titles?.gameOver;

/** Each name of an unmet realm, or of a hero of one, that realm `realm`'s `titles` show, as a line saying where. */
export function theUnmetNamesTheTitlesShow(
  S: TheWorldAsTheTitlesCheckReadsIt,
  realm: number,
  titles: ARealmsTitles,
): string[] {
  const met = new Set([realm, ...(S.players[realm]?._encountered ?? [])]);
  const realmsNamed = (isMet: boolean) =>
    new Set(S.players.flatMap((p, i) => (met.has(i) === isMet && p.name ? [p.name] : [])));
  const heroesNamed = (isMet: boolean) =>
    new Set(
      S.characters.flatMap((c) => {
        const ofAMetRealm = c.player == null || met.has(c.player);
        return ofAMetRealm === isMet && c.name ? [c.name] : [];
      }),
    );
  const unmetRealms = realmsNamed(false);
  const metRealms = realmsNamed(true);
  const unmetHeroes = heroesNamed(false);
  const metHeroes = heroesNamed(true);
  const realmNames: [string, string | undefined][] = [
    ...(titles.standings ?? []).map((s): [string, string | undefined] => ['the standings', s.name]),
    ...Object.values(titles.holders ?? {}).map((h): [string, string | undefined] => ["a title's holder", h.holderName]),
    ...(titles.minor?.all ?? []).map((x): [string, string | undefined] => ['a minor title', x.kingdomName]),
    ...(titles.losses ?? []).map((l): [string, string | undefined] => ['a title lost', l.newHolderName]),
    ...(titles.reckoning ? [['the Reckoning', titles.reckoning.byName] as [string, string | undefined]] : []),
  ];
  const heroNames = [
    ...Object.values(titles.holders ?? {}).map((h) => h.charName),
    ...(titles.minor?.all ?? []).map((x) => x.holderName),
  ];
  return [
    ...realmNames
      .filter(([, name]) => name && unmetRealms.has(name) && !metRealms.has(name))
      .map(([field, name]) => `realm ${String(realm)} sees the unmet realm "${String(name)}" in ${field}`),
    ...heroNames
      .filter((name) => name && unmetHeroes.has(name) && !metHeroes.has(name))
      .map((name) => `realm ${String(realm)} sees the unmet realm's hero "${String(name)}" holding a title`),
  ];
}
