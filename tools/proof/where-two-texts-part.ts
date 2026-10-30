// Where two texts that should be the same part, shown short: a long line (a GM log's entry as JSON) that differs in one
// word shows that word, not its first few hundred characters. For the GM-log comparison and the two-engine comparison.

/** How many characters to show before the first that differs, and in all. */
export const BEFORE = 40;
export const SHOWN = 160;

/** The two texts from a little before the first character where they part, each cut to SHOWN characters ('…' where
 *  cut); null if they are the same. */
export function whereTwoTextsPart(a: string, b: string): { at: number; a: string; b: string } | null {
  if (a === b) return null;
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  const from = Math.max(0, at - BEFORE);
  const cut = (s: string) => (from ? '…' : '') + s.slice(from, from + SHOWN) + (s.length > from + SHOWN ? '…' : '');
  return { at, a: cut(a), b: cut(b) };
}
