// ── The Terror an Evil victory leaves: its share a stack and its most stacks (plan P1-13i) ────
// Terror lingers until the next battle fought there, demoralising whoever defends (−10% strength per stack, at most 3
// stacks: −30%; 2026-10-12, Toby item 21 — it was 5, −50%). The two constants below are read by the engine
// (spreadTerror, consumeTerror in src/engine/battle/evil-terror.ts) and by buildTurnReport too (terrorReadingOf in
// src/views/turn-report.ts), which shows Evil realms the reading: one copy of the figures, on plain values
// (src/engine/rules-on-plain-values/). Reign of Terror sets a province's own share.
export const TERROR_PCT_PER_STACK = 0.1,
  TERROR_MAX_STACKS = 3;
