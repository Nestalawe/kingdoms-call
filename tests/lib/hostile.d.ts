// Types for the parts of tests/lib/hostile.js that TypeScript tests use. Add to them as tests need more.

/** A name for each player-chosen field: names('hostile') gives every payload, names('ordinary') a plain name. */
export type Names = ((field: string, i?: number) => string) & { hostile?: boolean };

export function names(kind: 'hostile' | 'ordinary'): Names;
