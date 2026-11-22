// ── The kinds of result a bot weighs, and the shape of a bot version's weights (B-06h, T7: the rules pulled out) ──
// The rule says what, the bot says how much (docs/decisions/README.md): the bot asks a rule what an effect does (a
// company's wage: 3 gold a turn), and a weights file for its version says what the bot makes of a unit of each kind of
// result. The weights are keyed by the kind of result, never by the effect, so a new effect of a kind the bots weigh
// needs no new bot code. The economy's is the first kind (B-06h); the titles' and the alignments' join it (B-06r,
// P1-19bb8). A version's file ends `satisfies Record<AKindOfResultABotWeighs, …>`, so a kind it gives no weights fails
// to compile. The weights are the bots', never content's: content holds the rules only.

/** The kinds of result a rule's what-if hands a bot, each of which a bot version's weights file weighs. */
export type AKindOfResultABotWeighs = 'gold';

/** A kind of result's weights in a bot version: each a number, named for what it weighs. */
export type TheWeightsOfAKindOfResult = Readonly<Record<string, number>>;
