# Reference PDFs

The sheets in `docs/reference/` are one PDF per area of the game (races, alignments, tempers, skills, mastery, orders,
spells, army units, terrain, lairs, guardians, magic items, Sage discoveries, titles, heroes and the economy, battles).
Each lists what every element does today, with the figures the engine uses, and ends with observations for Toby: gaps,
questions and places where two sources disagree. They are for playtesters working through the game area by area.

**They name what the rulebook keeps secret** (mastery perks, the discoveries, the relics: rulings R-005 and R-114), so
share them with playtesters who may know that, not with players who should find it in play.

## How to rebuild them

The tables come from the data file and the engine, read after the engine has loaded (so the magic items are the
treasury a game stocks, tiered and minted, not the file's raw designs); the prose (races, alignments, skills, orders,
battles) is written in `build_pdfs.py` from the rulebook. Rebuild after a data change:

```sh
npx tsx tools/reference-pdfs/extract.ts /tmp/kc-data.json                     # the game's tables, as JSON
python3 tools/reference-pdfs/build_pdfs.py /tmp/kc-data.json docs/reference   # the sixteen PDFs
```

Needs the repo's Node (`.nvmrc`) with `npm ci` done, and Python 3 with `reportlab` (`pip install reportlab`) and the
DejaVu Sans fonts (`/usr/share/fonts/truetype/dejavu/`). The footer of every page carries the data file's stamp, so a
sheet can be checked against the build it describes.

When a rule changes, change the figure in the sheet that quotes it from the rulebook (the `ALIGN_DETAIL`, `SKILL_ROWS`
and `ORDERS` tables in `build_pdfs.py`); the tables read from the data file follow it on the next rebuild.
