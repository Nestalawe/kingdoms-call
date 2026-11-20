// What vitest.config.ts gives each project's tests through inject(). The export makes this file a module, so the
// declaration below adds to Vitest's own types rather than replacing them.
export {};

declare module 'vitest' {
  interface ProvidedContext {
    // The db project's only (tests/setup/the-local-supabase.ts): the local Supabase's address and its own keys.
    theLocalSupabase: { url: string; anonKey: string; serviceRoleKey: string };
  }
}
