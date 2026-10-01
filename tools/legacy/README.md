# Legacy content tools

Kept for reference from the claude.ai Project (27 Sept 2026). They are not run by the tests, and
they still use the fixed paths they were written with.

Together they turn the engine's own army-unit tables into the content files, so those files can't
drift from the code:

1. `claude_unitexport_0927.js`: run from `site/` (`node ../tools/legacy/claude_unitexport_0927.js`).
   Boots the GM portal in Chromium and writes every army unit's numbers to `/tmp/units_raw.json`.
2. `build_unit_workbook_0927.py`: needs Python 3 and `openpyxl`. Builds the Army Units workbook
   (`Kingdoms-Call-Army-Units-v<stamp>.xlsx`) from `/tmp/units_raw.json`.
3. `unit_ability_csv_rows_0927.py`: rewrites the "Unit ability (racial)" rows of
   `kingdomscallgamecontent.csv`, in the current folder, from the same extract.
