// Kingdoms Call: which database this copy of the site talks to (P0-13). Every page reads KC_CONFIG,
// so a staging copy of the site replaces only this file (.github/workflows/staging.yml writes its own).
// The key is the project's public (anon) key: it's public by design; access is controlled by the
// database's rules. Plain data only: nothing else may live here.
const KC_CONFIG=Object.freeze({
  env:'live',
  supabaseUrl:'https://yymsnsrpggpgmzgcfrys.supabase.co',
  supabaseKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bXNuc3JwZ2dwZ216Z2NmcnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTQ0ODMsImV4cCI6MjA5ODQ3MDQ4M30.fxEG8Gg9s-c9H6KaOP2njjLA87GC3ZqIIXORHNQ2HdY',
});
