// The oracle of plan P1-12's Decision 5: copies of the code that wrote the GM's log (turnLog) before emit, as it was on
// p1-12a1 (cbf6c61): log() (src/engine/turn/context.ts), and the three that pushed or moved lines themselves: logSplit
// and notifyProvinceOwner (src/engine/turn/log-line-helpers.ts) and writeDeferredSkillLines
// (src/engine/heroes/experience-skill-rises-and-earned-hp.ts); and (P1-12a3) the two that write out a fight's
// narrative: emitNarrLine (src/engine/turn/log-line-helpers.ts) and emitBattle
// (src/engine/battle/battle-report-lines-and-force-markers.ts), which now hand each line the fight's event.
// tests/unit/emit-writes-the-lines-log-wrote.test.ts checks that emit and the helpers now in
// src/engine/turn/events-and-their-audiences.ts (and emitBattle) write the same lines, for any input. Kept until
// P1-12a's last row (P1-12a4, which deletes log()), then deleted with that test's oracle half.
// Statement for statement as they were, but for what strict TypeScript and lint ask for, each the same test: a read of
// the meta is an `unknown`, so each `x || y` is or(x, y); `!a || a.b == null` is `a?.b == null`; `a != null ? a : b`
// is `a ?? b`; `prov && prov.id` is `prov?.id` (null and undefined both file no province); and the held lines' group
// key is JSON with undefined kept apart from null, as `p + '|' + phase` kept it (the key only groups them).
import { battleLineTiers, battleTallyLine } from '../../src/engine/battle/fates.ts';
import { narrText } from '../../src/engine/turn/log-line-helpers.ts';

/** The part of the turn's context the old writers read. */
export interface OldContext {
  turnLog: Record<string, unknown>[];
  _battleSeq: number;
  _logCtx: { charId: unknown; phase: unknown };
  _currentPhase: unknown;
  _afterPhases: unknown;
}

/** What a caller passed as log()'s meta: anything (the engine's callers aren't type-checked). */
export type OldMeta = Readonly<Record<string, unknown>>;

function or(x: unknown, y: unknown): unknown {
  if (x) return x;
  return y;
}

/** log(type, text, meta), as context.ts wrote it (without its console line). */
export function oldLog(tc: OldContext, type: unknown, text: unknown, meta: OldMeta = {}): void {
  tc.turnLog.push({
    type,
    text,
    actor: meta['actor'] ?? null,
    targets: or(meta['targets'], []),
    provinceId: meta['provinceId'] ?? null,
    public: meta['public'] ?? false,
    spy: meta['spy'] ?? false,
    system: meta['system'] ?? false,
    armyEstimate: meta['armyEstimate'] ?? null,
    charId: meta['charId'] ?? tc._logCtx.charId,
    charIds: or(meta['charIds'], null),
    phase: meta['phase'] ?? tc._logCtx.phase ?? tc._currentPhase ?? (tc._afterPhases ? 99 : null),
    pinNotice: meta['pinNotice'] ?? false,
    env: meta['env'] ?? false,
    battleId: meta['battleId'] ?? null,
    bTier: meta['bTier'] ?? null,
    gameEnd: meta['gameEnd'] ?? false,
  });
}

/** logSplit: a private line by log(), and its public twin pushed straight into turnLog. */
export function oldLogSplit(tc: OldContext, type: unknown, privText: unknown, pubText: unknown, meta: OldMeta = {}) {
  const actor = meta['actor'] ?? null;
  const targets = meta['targets'];
  oldLog(tc, type, privText, {
    ...meta,
    public: false,
    targets: Array.isArray(targets) && targets.length ? targets : [actor].filter((x) => x != null),
  });
  tc.turnLog.push({
    type,
    text: pubText,
    actor: null,
    targets: [],
    provinceId: meta['provinceId'] ?? null,
    public: true,
    spy: false,
    system: false,
    armyEstimate: null,
    charId: null,
    charIds: null,
    phase: meta['phase'] ?? tc._logCtx.phase ?? tc._currentPhase ?? (tc._afterPhases ? 99 : null),
    pinNotice: false,
    env: false,
    notFor: ([actor] as unknown[]).concat(or(meta['alsoNotFor'], []) as unknown[]).filter((x) => x != null),
  });
}

/** notifyProvinceOwner: a line pushed straight into turnLog, to the province's owner. */
export function oldNotifyProvinceOwner(
  tc: OldContext,
  prov: { id: unknown; owner: unknown } | null | undefined,
  text: unknown,
  casterPlayer: unknown,
  ph?: unknown,
): void {
  if (prov?.owner == null || prov.owner === casterPlayer) return;
  const _ph = ph ?? tc._logCtx.phase ?? tc._currentPhase;
  tc.turnLog.push({
    type: 'system',
    text,
    actor: null,
    targets: [prov.owner],
    provinceId: prov.id,
    public: false,
    spy: false,
    system: false,
    armyEstimate: null,
    charId: null,
    charIds: null,
    phase: _ph,
    pinNotice: false,
    env: false,
  });
}

/** writeDeferredSkillLines: each held-back line by log(), moved after its battle's last line in the same phase. */
export function oldWriteDeferredSkillLines(
  tc: OldContext,
  list: readonly (readonly [unknown, OldMeta])[] | null | undefined,
  inPlace?: boolean,
): void {
  const { turnLog } = tc;
  const blocks = new Map<string, { p: unknown; ph: unknown; ents: unknown[] }>();
  (list ?? []).forEach(([msg, meta]) => {
    const m: Record<string, unknown> = { ...meta };
    const p = m['afterBattleIn'];
    delete m['afterBattleIn'];
    oldLog(tc, 'system', msg, m);
    if (p == null || inPlace) return;
    const k = [p, m['phase']].map((x) => (x === undefined ? 'undefined' : JSON.stringify(x))).join('|');
    if (!blocks.has(k)) blocks.set(k, { p, ph: m['phase'], ents: [] });
    blocks.get(k)?.ents.push(turnLog.pop());
  });
  blocks.forEach(({ p, ph, ents }) => {
    let at = -1;
    for (let i = turnLog.length - 1; i >= 0; i--) {
      const x = turnLog[i];
      if (x?.['battleId'] != null && x['provinceId'] === p && x['phase'] === ph) {
        at = i;
        break;
      }
    }
    const lines = ents as Record<string, unknown>[];
    if (at < 0) turnLog.push(...lines);
    else turnLog.splice(at + 1, 0, ...lines);
  });
}

/** emitNarrLine: a line of a fight's narrative by log(); a line for one realm alone told to that realm only, under its
 *  hero. */
export function oldEmitNarrLine(tc: OldContext, type: unknown, line: unknown, meta: OldMeta | null | undefined): void {
  const m: OldMeta = meta ?? {};
  if (typeof line === 'object' && line !== null && 'text' in line && line.text != null) {
    const l: { text: unknown; onlyPlayer?: unknown; charId?: unknown } = line;
    if (l.onlyPlayer == null) {
      oldLog(tc, type, l.text, m);
      return;
    }
    oldLog(tc, type, l.text, {
      ...m,
      actor: null,
      public: false,
      summary: false,
      battleDetail: false,
      targets: [l.onlyPlayer],
      charIds: null,
      charId: l.charId ?? m['charId'],
    });
    return;
  }
  oldLog(tc, type, line, m);
}

/** What emitBattle was handed besides the context. */
export interface OldBattle {
  battle: { narrative?: unknown[] | undefined; summaryText?: string | undefined } | null | undefined;
  prov: { id: number } | null | undefined;
  ph: number | null | undefined;
  participants: (number | null | undefined)[] | null | undefined;
  opts:
    | {
        actor?: number | null | undefined;
        charId?: number | null | undefined;
        charIds?: number[] | null | undefined;
        summaryText?: string | undefined;
      }
    | null
    | undefined;
}

/** emitBattle: every line of a battle by emitNarrLine and log(), numbered, each with its tier, the losses tally where
 *  the casualties begin, and the summary last. */
export function oldEmitBattle(tc: OldContext, { battle, prov, ph, participants, opts }: OldBattle): void {
  const o = opts ?? {};
  const parts = (participants ?? []).filter((x) => x != null);
  const base = {
    provinceId: prov?.id,
    phase: ph ?? undefined,
    public: true,
    actor: o.actor ?? null,
    charId: o.charId !== undefined ? o.charId : null,
    charIds: or(o.charIds, null),
    targets: parts,
  };
  const _bid = ++tc._battleSeq;
  const _lines = or(battle?.narrative, []) as unknown[];
  const _texts = _lines.map(narrText);
  const _tiers = battleLineTiers(_texts);
  let _tally = null;
  try {
    _tally = battleTallyLine(_texts);
  } catch {
    _tally = null;
  }
  // (Written in the loop's callback, which TypeScript's narrowing doesn't follow.)
  let _tallyDone = false as boolean;
  _lines.forEach((line, i) => {
    if (_tally && !_tallyDone && i === _tiers.casIdx) {
      oldLog(tc, 'combat', _tally, { ...base, battleDetail: true, battleId: _bid, bTier: 't' });
      _tallyDone = true;
    }
    oldEmitNarrLine(tc, 'combat', line, { ...base, battleDetail: true, battleId: _bid, bTier: or(_tiers.t[i], 'k') });
  });
  if (_tally && !_tallyDone) oldLog(tc, 'combat', _tally, { ...base, battleDetail: true, battleId: _bid, bTier: 't' });
  const sTxt = or(o.summaryText, battle?.summaryText);
  if (sTxt) oldLog(tc, 'combat', sTxt, { ...base, summary: true, battleId: _bid, bTier: 's' });
}
