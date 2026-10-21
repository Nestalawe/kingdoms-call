// The strict version of a schema of src/schemas/, for the tests (plan P1-10, Decision 4). The schemas use z.object,
// whose parse drops a key it doesn't name; this one refuses it, at any depth, so a test that parses a state or a
// payload with it fails on a field the schemas don't know (a new field the engine writes, a misspelt one). The same
// schema otherwise: each object becomes z.strictObject with its fields made strict in turn, and every other kind
// keeps its own checks. A kind it doesn't know stops it, so a schema can't be made strict only in part.
import { z } from 'zod';

type Schema = z.core.$ZodType;
const made = new Map<Schema, Schema>();

/** `schema`, with every object in it strict (an unnamed key fails the parse). */
export function strictVersionOf(schema: Schema): Schema {
  const known = made.get(schema);
  if (known) return known;
  const strict = strictOf(schema);
  made.set(schema, strict);
  return strict;
}

// z.ZodObject's own shape type holds `any`; the schemas' shapes hold schemas.
const isObject = (s: Schema): s is z.ZodObject<z.core.$ZodShape> => s instanceof z.ZodObject;

function strictOf(schema: Schema): Schema {
  if (isObject(schema)) {
    const shape: Record<string, Schema> = {};
    for (const [key, field] of Object.entries(schema.shape)) shape[key] = strictVersionOf(field);
    return z.strictObject(shape);
  }
  if (schema instanceof z.ZodOptional) return z.optional(strictVersionOf(schema.unwrap()));
  if (schema instanceof z.ZodNullable) return z.nullable(strictVersionOf(schema.unwrap()));
  if (schema instanceof z.ZodNonOptional) return z.nonoptional(strictVersionOf(schema.unwrap()));
  if (schema instanceof z.ZodArray) return z.array(strictVersionOf(schema.element));
  if (schema instanceof z.ZodRecord) return z.record(schema.keyType, strictVersionOf(schema.valueType));
  if (schema instanceof z.ZodUnion) return z.union(schema.options.map((option) => strictVersionOf(option)));
  if (
    schema instanceof z.ZodString ||
    schema instanceof z.ZodNumber ||
    schema instanceof z.ZodBoolean ||
    schema instanceof z.ZodNull ||
    schema instanceof z.ZodLiteral ||
    schema instanceof z.ZodUnknown
  )
    return schema;
  throw new Error(`strictVersionOf doesn't know a schema of type ${schema._zod.def.type}: add it here`);
}

/** Where `value` fails `schema` made strict, one line an issue (`characters.0.armies.2: unrecognized_keys …`). */
export function strictIssues(schema: Schema, value: unknown): string[] {
  const result = z.safeParse(strictVersionOf(schema), value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.code} ${i.message}`);
}
