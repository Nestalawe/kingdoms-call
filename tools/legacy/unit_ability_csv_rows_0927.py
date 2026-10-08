#!/usr/bin/env python3
"""unit_ability_csv_rows_0927.py — rewrites the 'Unit ability (racial)' block of
kingdomscallgamecontent.csv from the SAME engine extract the Army Units workbook is built from
(/tmp/units_raw.json + the prose in claude/build_unit_workbook_0927.py).

Why: those rows were hand-maintained and had gone stale in two places (Punch Through still read
0.45 / 0.90 after the engine moved to 0.55 / 0.90 on 2026-09-24) and only covered 15 of the 35
abilities. Generating them keeps the CSV in step with the engine the way every other category
already is. Run this BEFORE claude/csvgen_0924.js, which carries the block forward.
"""
import csv, io, sys, importlib.util, json

spec = importlib.util.spec_from_file_location('ub', 'claude/build_unit_workbook_0927.py')
ub = importlib.util.module_from_spec(spec)
sys.modules['ub'] = ub
spec.loader.exec_module(ub)

rows = ub.build_rows()
RAW = ub.RAW

RACE_LABEL = {'Human': 'Human', 'Elven': 'Elf', 'Dwarven': 'Dwarf', 'Orcish': 'Orc',
              'Any': 'Any realm', 'Elemental': 'Summoned'}

out = []
seen = set()
for r in rows:
    name = r['aname']
    if name.startswith('—'):
        continue                      # garrisons and elementals carry no ability
    if name in seen:
        continue
    seen.add(name)
    gained = ('Always-on for that unit type. Raised by: %s. Druid %s to lead without penalty.'
              % (RACE_LABEL.get(r['race'], r['race']), r['druid']))
    typecol = '%s · %s' % (RACE_LABEL.get(r['race'], r['race']), r['type'])
    # one-paragraph form of the workbook prose (the CSV is a flat reference, not a wrapped sheet)
    effect = ' '.join(r['adesc'].split())
    out.append(['Unit ability (racial)', name, typecol, gained, effect, ''])

path = 'kingdomscallgamecontent.csv'
src = list(csv.reader(io.open(path, encoding='utf-8')))
head, body = src[0], [x for x in src[1:] if x and x[0] != 'Unit ability (racial)']
removed = len(src) - 1 - len(body)

with io.open(path, 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, lineterminator='\n')
    w.writerow(head)
    w.writerows(body)
    w.writerows(out)

print('replaced %d hand-maintained unit-ability rows with %d generated ones' % (removed, len(out)))
print('CSV now %d data rows' % (len(body) + len(out)))
