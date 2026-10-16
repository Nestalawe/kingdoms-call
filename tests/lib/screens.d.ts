// Types for the parts of tests/lib/screens.js that TypeScript tests use. Add to them as tests need more.
import type { Browser, Page } from '@playwright/test';
import type { Names } from './hostile.js';

/** One way into a page: its query string, and whether it is a page that can't start (its error is expected). */
export interface Mode {
  url: string;
  bootError?: boolean;
}

/** A page's screen tour: a staged world (plain data, its names from N) and the modes to show it in. */
export interface Tour {
  page: string;
  modes: Record<string, Mode>;
  world(N: Names): unknown;
}

export const TOURS: Record<'leaderboard' | 'overlord' | 'gmPortal' | 'playerPortal', Tour>;

/** Runs a tour's mode in Chromium; visit(label, page) after each screen. Gives the page's errors. */
export function runChromium(
  browser: Browser,
  tour: Tour,
  mode: string,
  W: unknown,
  visit: (label: string, page: Page) => Promise<void>,
  opts?: { site?: string; url?: string },
): Promise<string[]>;
