// ── BOT_SCHOOLS: a constant read as the page loads ────
// Moved here unchanged (plan P1-09b) from src/engine/bots/specialists.js, the file just after this one in the page.
// src/engine/bots/missions.js reads it as the page loads, and the two files are in one cycle of files that read each
// other: once the page is made of modules (P1-09d), the file that runs second could meet it before its line has run. A
// file that reads nothing runs before every file that reads it (docs/traps.md, "Top-level declaration order").
// NOT a copy of KC_MAGIC_SCHOOLS/KC_SKILLS: this ORDER is the tie-break priority. Leave it hand-kept (2026-09-27).
const BOT_SCHOOLS = ['elemental', 'white', 'psychic', 'illusory', 'necromancy'];
