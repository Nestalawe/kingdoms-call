// A value parsed strictly against a schema of src/schemas/, for the tests (plan P1-10, Decision 4). The schemas use
// z.object, whose parse drops a key it doesn't name; their strict version (src/schemas/the-strict-version-of-a-schema.ts,
// here until P1-15d, which moved it there for the check of a saved game at load) refuses it, at any depth, so a test
// that parses a state or a payload with it fails on a field the schemas don't know (a new field the engine writes, a
// misspelt one).
import { z } from 'zod';
import { strictVersionOf } from '../../src/schemas/the-strict-version-of-a-schema.ts';

type Schema = z.core.$ZodType;

/** Where `value` fails `schema` made strict, one line an issue (`characters.0.armies.2: unrecognized_keys …`). */
export function strictIssues(schema: Schema, value: unknown): string[] {
  const result = z.safeParse(strictVersionOf(schema), value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.code} ${i.message}`);
}
