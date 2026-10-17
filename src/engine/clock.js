// ── kcClock: the engine's clock (P1-07) ────
// The engine and its views (src/engine/, src/views/) read the time only through kcClock(), never through Date
// (tests/static/dice-and-clock.test.ts). It reads Date.now() at the moment it is called, so a test's pinned Date
// (bootJsdom's opts.now) pins it too. The page's own screens (deadlines, "x minutes ago", the auto-turn watcher)
// read Date as before. P1-18 makes the time an input of the turn.
//   kcClock()        now, in ms since 1970
//   kcClock.date()   now, as a Date (one reading of the clock, as new Date() is)
function kcClock(){ return Date.now(); }
kcClock.date=function(){ return new Date(kcClock()); };

