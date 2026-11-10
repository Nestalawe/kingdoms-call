// A list of kcHtml pieces with `sep` between them, to put into kcHtml (P0-19): .join(sep) would make them a plain
// string, which kcHtml shows as text. `sep` is text, or kcHtml for markup (kcHtml`<br>`).
export function kcJoinP<Piece, Separator>(list: readonly Piece[], sep: Separator): (Piece | Separator)[] {
  return list.flatMap((x, i) => (i ? [sep, x] : [x]));
}
