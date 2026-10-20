// Types for the parts of tests/lib/scenario.js that TypeScript tests use. Add to them as tests need more.

/** One turn played: S2 is the world as saved after it. */
export interface Turn<S = unknown, X = unknown> {
  /** The world as staged (before the turn). */
  S: S;
  S2: unknown;
  /** The GM's full log for the turn. */
  log: { text?: unknown; type?: unknown; phase?: unknown; charId?: unknown; [key: string]: unknown }[];
  /** The turn's statistics rows (turn_events, one per realm), with bootScenario({telemetry:true}). */
  events: unknown[];
  /** Each human realm's turn report, by its index, as the player portal receives it. */
  reports: Record<number, Record<string, unknown>>;
  /** What `prepare` returned. */
  extra: X;
  text(charId?: number): string;
}

/** One phase's order. */
export interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}

export interface TurnOptions<S, X> {
  realms: number;
  cols?: number;
  rows?: number;
  seaPct?: number;
  /** A realm's alignment and race, by index (a realm not named keeps the one it was dealt). */
  alignments?: string[];
  races?: string[];
  /** The realms left to the bots, by index (every other realm is human-held). */
  bots?: number[];
  /** Edits the fresh world before the turn; what it returns is the turn's `extra`. */
  prepare?: (S: S, W: ScenarioWindow) => X;
  /** Each character's five orders, by id; every other character Rests. */
  orders?: Record<number, Order[]> | ((S: S, extra: X) => Record<number, Order[]>);
}

/** The GM portal's window: its functions (e.g. buildTurnReport) as the turn left them. */
export interface ScenarioWindow {
  buildTurnReport(S: unknown, playerIndex: number): Record<string, unknown> | null;
  getNeighborsP(p: unknown, cols: number, rows: number, provinces: unknown[]): unknown[];
  /** A character's skill with every bonus counted, as the rolls use it. */
  effSkillOf(c: unknown, stat: string, chars: unknown[]): number;
  eval(code: string): unknown;
  close(): void;
}

export interface Scenario {
  W: ScenarioWindow;
  /** Page errors seen so far. */
  errs: string[];
  turn<S = unknown, X = unknown>(opts: TurnOptions<S, X>): Promise<Turn<S, X>>;
}

/** opts.seed fixes the page's own Math.random; opts.now pins its clock; opts.telemetry has the page write its
 *  statistics rows (Turn.events). */
export function bootScenario(opts?: {
  seed?: number;
  now?: number | string;
  telemetry?: boolean;
}): Promise<Scenario>;

export function order(action: string, target?: string | number, extra?: string | number): Order;
/** Five orders: the given ones first, then Rest. */
export function plan(...orders: Order[]): Order[];
