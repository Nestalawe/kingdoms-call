// The same answer every time, in both test runners (vitest.config.mts and playwright.config.ts): the time zone and
// locale every test process starts with, and the seed a run uses when KC_SEED isn't given (tests/lib/boot.js seeds
// Math.random from it).
export const FIXED = { TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };
export const DEFAULT_SEED = '20261001';
