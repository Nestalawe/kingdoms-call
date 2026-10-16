// Types for the parts of tests/lib/scenario.js that TypeScript tests use. Add to them as tests need more.

/** One turn played: S2 is the world as saved after it. */
export interface Turn {
  S2: unknown;
}

export interface Scenario {
  /** The GM portal's window: its functions (e.g. buildTurnReport) as the turn left them. */
  W: { buildTurnReport(S: unknown, playerIndex: number): Record<string, unknown> | null };
  turn(opts: { realms: number; cols?: number; rows?: number }): Promise<Turn>;
}

/** opts.seed fixes the page's own Math.random. */
export function bootScenario(opts?: { seed?: number }): Promise<Scenario>;
