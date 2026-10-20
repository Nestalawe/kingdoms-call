// ── BOT_SPECIALIST_SKILLS: a constant read as the page loads ────
// Moved here unchanged (plan P1-09b) from src/engine/bots/strategy.js, the file just after this one in the page.
// src/engine/bots/specialists.js reads it as the page loads, and the two files are in one cycle of files that read each
// other: once the page is made of modules (P1-09d), the file that runs second could meet it before its line has run. A
// file that reads nothing runs before every file that reads it (docs/traps.md, "Top-level declaration order").
const BOT_SPECIALIST_SKILLS={scholar:'sage',scout:'explorer',spy:'spy',thief:'thief',slayer:'melee',mage:'magic'};   // 'magic' = the mage's two focus schools (botMageSchools), not a skill key
