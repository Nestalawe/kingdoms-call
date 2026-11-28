// ── The garrison band a neutral province's tax deals its defenders in ────
// Rich (tax 7 and over) 3-4 defenders, Prosperous (4 and over) 2-3, Poor 1-2. A leaf module (it imports nothing), so
// the world's making (units/drill-and-spoils.ts, which re-exports it) and the bots' guess at a defence ask the same
// function. The rest of the reasoning (the label and the band must move together) is written beside neutralDefCount.
export function neutralDefBand(tax: number): [number, number] {
  return tax >= 7 ? [3, 4] : tax >= 4 ? [2, 3] : [1, 2];
}
