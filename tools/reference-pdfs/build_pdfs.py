"""Builds the Kingdoms Call reference PDFs, one per area of the game.

Usage: python3 build_pdfs.py <data.json from extract.js> <output directory>
"""
import json
import os
import sys
from collections import Counter, OrderedDict

from pdfkit import H1, H2, P, PM, RefDoc, bullets, gaps, kv_table, note, spacer, table

DATA = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
STAMP = DATA['KC_DATA_STAMP']

RACES = DATA['KC_HUMANOID_RACES']
ALIGNS = DATA['KC_ALIGNMENTS']
SKILLS = DATA['KC_SKILLS']
LABEL = DATA['KC_SKILL_LABELS']
COST = DATA['ARMY_COST_MASTER']
SPEED = DATA['ARMY_SPEED_MASTER']
BASE = DATA['KC_UNIT_BASE_STR']
UTYPE = DATA['KC_UNIT_TYPE']
UCLASS = DATA['KC_UNIT_CLASS']
DRUID = DATA['KC_DRUID_LEVELS']
TERRAIN = DATA['TERRAIN_MODS']
ABIL = DATA['UNIT_ABILITIES']
PRIMAL = DATA['PRIMAL_ARMY_DEFS_P']
PROV = DATA['PROVINCE_ARMIES_P']
LAND = ['plain', 'desert', 'forest', 'jungle', 'mountain']
TERRS = LAND + ['sea']
TNAME = {'plain': 'Plains', 'desert': 'Desert', 'forest': 'Forest', 'jungle': 'Jungle', 'mountain': 'Mountain', 'sea': 'Sea'}

RACE_OF_UNIT = {}
for t, cell in PROV.items():
    for race, units in cell.items():
        for u in units:
            RACE_OF_UNIT[u] = race
RACE_OF_UNIT.update({'Galleon Fleet': 'Human', 'Corsair Fleet': 'Human (retired)', 'Noble Griffons': 'Human',
                     'Whale Cohort': 'Creature'})
for u in UCLASS['creature']:
    RACE_OF_UNIT[u] = 'Creature'
for u in UCLASS['monster']:
    RACE_OF_UNIT[u] = 'Monster'


def druid_need(u):
    for lvl, lst in DRUID.items():
        if u in lst:
            return lvl
    return '0'


def classes_of(u):
    tags = []
    for k in ['flying', 'aerial', 'missile', 'cavalry', 'garrison', 'lightFoot', 'carrier', 'primalSea', 'tamedFlyer']:
        if u in UCLASS[k]:
            tags.append({'lightFoot': 'light foot (half a hull)', 'primalSea': 'sea-beast (carries nothing)',
                         'tamedFlyer': 'tamed flyer (Dragon Taming)', 'carrier': 'carrier (%d berth%s)' % (
                             DATA['KC_CARRIER_BERTHS'].get(u, 1), '' if DATA['KC_CARRIER_BERTHS'].get(u, 1) == 1 else 's'),
                         'flying': 'winged rider (lifts one foot)', 'aerial': 'crosses sea by air'}.get(k, k))
    return ', '.join(tags)


def fmt_mult(x):
    return '×%.2f' % x if x != 1.0 else '×1'


def pct(x):
    return '%+d%%' % round(x * 100) if abs(x) < 1 or True else str(x)


def spg(u):
    c = COST.get(u)
    b = BASE.get(u)
    if not c or not b:
        return ''
    return '%.2f' % (b / c)


# ── Magic items: the engine's live treasury (designs, their second names and the minted variants), grouped by effect ──
ITEMS_LIVE = DATA['ALL_MAGIC_ITEMS_P']
LEG = DATA['LEGENDARY_ITEMS_P']
ITEM_KINDS = ['weapon', 'armour', 'shield', 'helm', 'cloak', 'ring', 'amulet', 'combat', 'trinket']


def kind_of(it):
    if it.get('slot'):
        return it['slot']
    if it.get('effect', {}).get('stat') == 'combatUse':
        return 'combat'
    return 'trinket'


def item_gate(it):
    if it.get('race'):
        return it['race'] + ' only'
    if it.get('alignment'):
        return it['alignment'] + ' only'
    return ''


def item_groups(items):
    groups = OrderedDict()
    for i in items:
        key = (i['tier'], kind_of(i), item_gate(i), i['desc'])
        if key not in groups:
            groups[key] = dict(i, names=[])
        groups[key]['names'].append(i['name'])
    out = []
    for g in groups.values():
        g['name'] = ' / '.join(g['names'])
        out.append(g)
    return out


ITEM_GROUPS = item_groups(ITEMS_LIVE)
LEG_GROUPS = item_groups(LEG)


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 1. RACES
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_races():
    d = RefDoc(os.path.join(OUT, '01-races.pdf'), 'Races', 'The four peoples: gifts, feuds, home rosters and what else is keyed to race', STAMP)
    d.cover('Race is the blood of a realm: it sets which troops the home province raises, the ground most of its '
            'provinces lie on, and two gifts no other people share. Two rules apply to every race alike (kinship and '
            'the ancient feuds). This sheet puts the four side by side so their gifts can be weighed against each other.',
            ['Are the two gifts of each race worth about the same? Human and Orcish gifts are about growth and gold; '
             'Elven and Dwarven gifts are battle multipliers.',
             'Does each home roster have a unit of every type (infantry, ranged, cavalry, flyer, naval)?',
             'Strength per gold of each race\'s units (see the Army units sheet for the full roster).',
             'Which race-keyed extras exist: Heritage discoveries (20 each), race-only magic items, guardian weaknesses.'],
            ['Rulebook: The Four Races, Founding Your Realm, Hit points.',
             'Engine: PROVINCE_ARMIES_P, ARMY_COST_MASTER, KC_UNIT_BASE_STR, SIGNATURE_TERRAIN_P, kinship in terrain-and-unit-strength.js.',
             'Data file: SAGE_DISCOVERIES_P (Heritage fields), ALL_MAGIC_ITEMS_P (race-gated items), MONSTERS_P (Old Enemy weaknesses).'])

    d.add(H1('Rules shared by every race'))
    d.add(kv_table([
        ('King\'s kin', 'A unit of the same race as the king (the realm\'s chosen race) fights at +20% base strength.'),
        ('Leader\'s kin', 'A unit led by a character of its own race (king or hero) fights at +20%. Stacks with King\'s kin: a king leading his own people fields them at ×1.44.'),
        ('Recruits take the province\'s race', 'A unit\'s race is the race of the province it was raised in, not the realm\'s. Foreign recruits earn no King\'s-kin bonus.'),
        ('Ancient grudges', 'Elves and Dwarves, Humans and Orcs: an army led by a commander of its rival race fights at −20% (×0.8).'),
        ('Leading another race', 'Needs Druid 1 (a commander leads his own race as if he had Druid 1). Each missing level costs that unit 20% strength.'),
        ('Home province', 'Recruits every land unit of the realm\'s race whatever its terrain, two of anything a season; a fleet too if coastal. Starting income 10 gold, treasury 20.'),
        ('Signature terrain', 'Each race\'s provinces are weighted toward one terrain (about two thirds of that terrain\'s provinces carry its race).'),
        ('Mithril / Iron constitution / Quick learners', 'Race gifts that name "a character of a X realm" apply only when the character\'s race matches the realm\'s race; a hired hero of another blood gets none of them.'),
    ]))

    d.add(H1('The four races side by side'))
    sig = DATA['SIGNATURE_TERRAIN_P']
    gifts = {
        'Human': ('Drillmasters: human units rise an experience tier twice as readily, from a commander\'s drills (Practice Tactical/Naval, garrison self-drill) and from surviving battle.',
                  'Quick learners: human characters of a Human realm gain skill levels 50% faster, in every skill and by every means (practice ×1.5, experience ×1.5).'),
        'Elven': ('Woodland mastery: an Elven realm\'s own elven troops fight at ×1.5 in forest and jungle.',
                  'Homeward Flight: an elven unit of an Elven realm that would be killed in battle may slip away home instead: 30% in desert or mountain, 45% on plains, 60% in forest or jungle. Delivered to the home province (or wealthiest remaining) at turn\'s end, into its garrison.'),
        'Dwarven': ('Bulwark: dwarven armies defending fight at ×1.5, on top of the usual defender\'s edge (×1.25, ×1.5 at the home capital).',
                    'Mithril Armour: every dwarven character of a Dwarven realm bears mithril (granted at start and on hiring a dwarf): melee blows and arrows against them do 2 less damage. Never found in a lair, scores nothing, cannot change hands.'),
        'Orcish': ('War-spoils: orcish units that win a battle as part of an attacking force pay only half wages that turn (R-065: a true half, on every attacking win).',
                   'Iron constitution: orcish characters of an Orcish realm start at 18 max HP instead of 15, and every band of the HP-gain curve sits 5 points higher (so they keep gaining 1–3 up to 45, 1–2 up to 54).'),
    }
    rows = []
    for r in RACES:
        home = [u for u in {x for cell in PROV.values() for x in cell.get(r, [])}]
        home = sorted(home, key=lambda u: (UTYPE.get(u, 'infantry'), -BASE.get(u, 0)))
        fleet = PROV['sea'].get(r, []) + (['Galleon Fleet'] if r == 'Human' else [])
        roster = ', '.join('%s (%s, str %s, %sg)' % (u, UTYPE.get(u, '?'), BASE.get(u, '?'), COST.get(u, '?')) for u in home + fleet)
        rows.append([r, TNAME[sig[r]], DATA['KC_RIVAL_RACE'][r], gifts[r][0], gifts[r][1], roster])
    d.add(table(['Race', 'Home ground', 'Feud with', 'Gift 1', 'Gift 2', 'Full roster (type, base strength, cost = wage)'],
                rows, [0.07, 0.07, 0.07, 0.22, 0.25, 0.32]))

    d.add(H1('Roster shape by race'))
    d.add(P('How many units of each type each race can raise anywhere, and their strength per gold at Average quality (base strength × 2 ÷ cost). Garrisons excluded from the averages.'))
    rows = []
    for r in RACES:
        units = sorted({x for cell in PROV.values() for x in cell.get(r, [])} | ({'Galleon Fleet', 'Noble Griffons'} if r == 'Human' else set()))
        cnt = Counter(UTYPE.get(u, 'infantry') for u in units)
        nong = [u for u in units if u not in UCLASS['garrison']]
        avg_spg = sum(BASE[u] / COST[u] for u in nong) / len(nong)
        avg_cost = sum(COST[u] for u in nong) / len(nong)
        avg_move = sum(SPEED[u] for u in nong if u not in UCLASS['sea']) / len([u for u in nong if u not in UCLASS['sea']])
        best = max(nong, key=lambda u: BASE[u])
        rows.append([r, str(len(units)), str(cnt['infantry']), str(cnt['ranged']), str(cnt['cavalry']), str(cnt['flyer']), str(cnt['naval']),
                     '%.2f' % avg_spg, '%.1fg' % avg_cost, '%.1f' % avg_move, '%s (%d)' % (best, BASE[best])])
    d.add(table(['Race', 'Units', 'Infantry', 'Ranged', 'Cavalry', 'Flyer', 'Naval', 'Avg base str per gold', 'Avg cost', 'Avg land move', 'Strongest unit (base)'],
                rows, [0.08, 0.06, 0.07, 0.07, 0.07, 0.06, 0.06, 0.12, 0.08, 0.1, 0.23]))

    d.add(H1('Which units each terrain offers, by race'))
    d.add(P('An ordinary province offers two of these three times in four, three one time in four, drawn from its race\'s cell for its terrain. Every province also offers its race\'s garrison; a coastal one its fleet. The first two non-garrison entries of the home terrain\'s cell are the king\'s two starting companies.'))
    rows = []
    for t in LAND + ['sea']:
        rows.append([TNAME[t]] + [', '.join(PROV[t].get(r, [])) or '—' for r in RACES])
    d.add(table(['Terrain'] + RACES, rows, [0.08, 0.23, 0.23, 0.23, 0.23]))

    d.add(H1('Everything else keyed to race'))
    disc = DATA['SAGE_DISCOVERIES_P']
    items = ITEM_GROUPS + LEG_GROUPS
    mons = DATA['MONSTERS_P']
    rows = []
    for r in RACES:
        her = [x['name'] for x in disc if x.get('race') == r]
        its = ['%s (%s)' % (x['name'], x.get('slot', 'trinket')) for x in items if x.get('race') == r]
        weak = [m['name'] for m in mons if m['weak']['kind'] == 'race' and m['weak']['key'] == r]
        rows.append([r, '%d: %s' % (len(her), ', '.join(her)), '%d: %s' % (len(its), ', '.join(its)), '%d guardians: %s' % (len(weak), ', '.join(weak))])
    d.add(table(['Race', 'Heritage discoveries (race-only research)', 'Race-only magic items', 'Guardians weak to this blood (double damage)'],
                rows, [0.07, 0.36, 0.3, 0.27]))

    d.add(gaps([
        'The gifts are not of one kind. Elven (×1.5 in woods) and Dwarven (×1.5 defending) gifts are battle multipliers that apply often; Human gifts are about learning speed and Orcish about wages and HP. Is that the intended spread, and are they worth the same?',
        'Elves and Dwarves get their multiplier only as "an Elven/Dwarven realm\'s own troops". Hired elves in a Human realm get nothing. The Orcish war-spoils rule reads as applying to orcish units in any realm. Check which reading is wanted for each.',
        'Humans have the widest roster (9 land and sea units) and the only race with a unit in every terrain cell for plains; Elves have no desert cavalry and Dwarves have no jungle cavalry. The Elven desert cell is three units, two of them flyers/ranged.',
        'Human cavalry (Gilded Lances, base 7 for 4g) is the best horse; Orcish Black Arrows and Dwarven Ironwood Crossbows are the cheapest ranged (base 4 for 2g). See the Army units sheet for strength-per-gold across the whole roster.',
        'Corsair Fleet is retired (R-109) but is still present in the cost, speed, terrain and unit-type tables and in the Minor Title "heavy units" list. Harmless but worth tidying so a reference does not resurrect it.',
        'Race-only items are not evenly dealt: Dwarven %d, Human %d, Orcish %d, Elven %d. Guardian "Old Enemy" weaknesses: see the table above for how many each race can exploit.' % tuple(
            len([x for x in items if x.get('race') == r]) for r in ['Dwarven', 'Human', 'Orcish', 'Elven']),
        'The rulebook\'s "Choosing a race" box says "Human + anything leans on the fastest heroes and troops in the game", but Elven and Orcish light horse and the winged riders move as fast or faster. Reword or decide.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 2. ALIGNMENTS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
ALIGN_DETAIL = OrderedDict([
    ('Divine', {
        'zeal': 50, 'skill': 'White Magic +1 (heirs too)', 'order': 'Consecrate (king only)',
        'passives': ['Rest heals ×1.5 (30% of max HP, lifted by half again, rounded up).',
                     'Bless Province adds +80% tax (others +60%); +100% when the Divine king casts it in person.',
                     'Divine grace: a slain character (king included) spends one full turn dead and returns at half health, without armies or items, in the nearest consecrated province the realm holds; the miracle spends that consecration. No consecrated ground: the grace is lost and an heir is crowned as usual (R-009).',
                     'Consecrated ground: +50% tax, defenders roll zeal at double chance, Undead and Evil hosts attacking it fight at −15%, and it is the only ground the fallen return on. Never the home or its neighbours, never bordering other holy ground; up to one per level of the king\'s White. Captured holy ground loses its consecration and every unit of the conqueror\'s column has a 50% chance to gain a tier (R-045).'],
        'hiring': 'Holy end: dark heroes cost up to 4g/turn; Undead heroes never serve.',
        'gd': 'Grand Cathedral'}),
    ('Good', {
        'zeal': 40, 'skill': 'none', 'order': 'Call to Arms (king only, once per turn, from anywhere): a free Green garrison unit of the native type musters in any owned humanoid province.',
        'passives': ['Righteous Defence: any army defending a province you own fights at +10%.',
                     'Banner of Fellowship: allied contingents converging on the same battle unify +15% more readily.',
                     'A felled Cowardly enemy who begs mercy is spared 75% of the time (they flee with 1 HP and hand over an item).'],
        'hiring': 'Near the centre: most heroes 2–3g/turn.',
        'gd': 'Free City Charter'}),
    ('Druidic', {
        'zeal': 20, 'skill': 'Druid +1 (heirs too)', 'order': 'none (Awaken the Wild removed 2026-10-12)',
        'passives': ['All Creature armies follow your heroes with no Druid requirement (every Druid level then counts as mastery, +20% each). A hero still leads at most as many beasts as his Druid level (R-103).',
                     'Home of the Wild: Creature armies fight at ×1.5 in forest and jungle.',
                     'Starts beside a Creature province it can lead from turn one; at least one Creature province within two provinces of home.'],
        'hiring': 'Central: most heroes 2–3g/turn.',
        'gd': 'World-Tree Grove'}),
    ('Neutral', {
        'zeal': 10, 'skill': 'none', 'order': 'Broker (king only): hire any wandering hero the realm can see without leaving the hall, or buy a guaranteed full Spy report on any province ever seen, for 2g.',
        'passives': ['Trade: province tax income +20%.',
                     'Cheapest court: every wandering hero costs at most 3g/turn, most the base 2g; mercenary bands cost 2g less.',
                     'Scholars: each Sage level adds a further +5% discovery chance (10% a level, 50% at Sage 5).'],
        'hiring': 'Centre: nobody refuses, nobody costs 4g.',
        'gd': 'Grand Library'}),
    ('Pagan', {
        'zeal': 15, 'skill': 'Explorer +1 (heirs too)', 'order': 'Perform Rite at a discovered ritual site (owned or not): Wild Hunt binds two of the province\'s beasts as Veterans for the price of one (no wages, serve to the end of the following turn; Creature/Monster provinces only); Blood Offering sacrifices units to raise an equal number of others +2 tiers (to Elite). One rite per province per turn (R-008).',
        'passives': ['Starts beside a wild forest or jungle province holding a ritual site.',
                     'Blood Harvest: +1g per enemy unit your characters destroy in a victory.'],
        'hiring': 'Central-to-dark: most heroes 2–3g/turn.',
        'gd': 'Standing Stones'}),
    ('Evil', {
        'zeal': 25, 'skill': 'Druid +1 (heirs too)', 'order': 'none (Call from the Pit removed). Conquest doctrine instead: loot (Plunder) or Enslave, chosen on the orders form.',
        'passives': ['Savage fury: a host with any Monster unit fights at ×1.25 every battle, no roll. Never stacks with zeal (the ×1.30 counts instead). Needs a commander.',
                     'All Monster armies follow your heroes with no Druid requirement (Druid levels then add +20% each).',
                     'Terror: after a Decisive or better victory the province and its neighbours are terrorised: defenders there fight −10% in their next battle, stacking to three (−30%). Only Evil realms see Terror (R-102).',
                     'Reign of Fear: your Monsters fight ×1.5 when attacking a province still under your own Terror; the Terror is spent by that battle.',
                     'Plunder: conquering a province yields 50% of its tax value at once. Enslave instead: a Green garrison unit of the native type joins the garrison in chains and the province pays −1 tax for 3 turns.',
                     'Felled Cowardly enemies are spared only 20% of the time. Evil hosts attacking consecrated ground fight −15%.'],
        'hiring': 'Dark end: righteous heroes cost up to 4g/turn.',
        'gd': 'Iron Throne of Skulls'}),
    ('Undead', {
        'zeal': 0, 'skill': 'Necromancy +1 (heirs too), and a unit of Skeletal Shieldwall Levies', 'order': 'Harvest the Field: any character standing on battlefield graves raises one grave as a Skeletal unit for 2g, no magic needed (the most experienced dead rises). Hand it to a Necromancy 1 character before turn\'s end or it crumbles.',
        'passives': ['No zeal roll. Undying fanaticism instead: any host with skeletal armies fights ×1.5 under the king in person, ×1.3 under any other commander. Never a leaderless garrison.',
                     'Skeletal armies ignore the Druid penalty, cost 1g wages, never change quality, never disband for wages (last to go in bankruptcy), and crumble at turn\'s end unless held by a Necromancy 1 character.',
                     'Deathless March: an all-skeleton force is never cut down in flight; with no retreat it stands and holds.',
                     'Battlefield graves in your provinces decay at 5% a turn instead of 10%.'],
        'hiring': 'Unholy end: righteous heroes cost up to 4g/turn; Divine heroes never serve.',
        'gd': 'Deathless Legion'}),
])


def build_alignments():
    d = RefDoc(os.path.join(OUT, '02-alignments.pdf'), 'Alignments', 'The seven creeds: zeal, signature orders, passives, hiring and the Grand Designs', STAMP)
    d.cover('Alignment is the soul of a realm. It sets the chance of fanatical zeal in battle, who will serve the crown and '
            'at what price, the king\'s opening skill, the realm\'s signature order, and its Grand Design (the Sage 9 Wonder). '
            'The spectrum runs Divine, Good, Druidic, Neutral, Pagan, Evil, Undead, and hiring cost follows the distance along it.',
            ['Do the seven creeds get a comparable amount? Divine has the most rules; Neutral and Good have the fewest.',
             'Zeal percentages: Divine 50, Good 40, Evil 25, Druidic 20, Pagan 15, Neutral 10, Undead 0 (replaced by fervour). Each is a ×1.30 roll per battle.',
             'Two creeds (Druidic, Evil) have no signature order since their summoning orders were removed; their strength is the beasts they lead free.',
             'The 20 Creed discoveries per alignment and the alignment-only items (listed at the end).'],
            ['Rulebook: The Seven Alignments, Your alignment\'s signature action, How a Battle Is Fought (fervour).',
             'Engine: FANATIC_CHANCE_BY_ALIGN, KC_GRAND_DESIGNS, relations-and-captures.js (Evil conquest), ALIGN_ACTIONS.',
             'Rulings R-009, R-030, R-045, R-102, R-104.'])

    d.add(H1('At a glance'))
    gd = DATA['KC_GRAND_DESIGNS']
    rows = []
    for a in ALIGNS:
        x = ALIGN_DETAIL[a]
        rows.append([a, '%d%%' % x['zeal'], x['skill'], x['order'], x['hiring'], '%s: %s' % (gd[a]['name'], gd[a]['desc'])])
    d.add(table(['Alignment', 'Zeal', 'King starts with', 'Signature order', 'Hiring', 'Grand Design (Sage 9 Wonder)'],
                rows, [0.08, 0.05, 0.13, 0.3, 0.15, 0.29]))

    d.add(H1('Rules shared by every creed'))
    d.add(kv_table([
        ('Zeal', 'Before each battle a force rolls at its alignment\'s chance; on a success it fights at ×1.30. Defenders on consecrated ground roll at double chance.'),
        ('Fervour never stacks', 'Zeal ×1.30, Evil Monster fury ×1.25, Undead skeletal fanaticism ×1.5 (king) or ×1.3 (hero): only the strongest counts (R-030).'),
        ('Hiring by distance', 'A wandering hero costs 2g/turn at 0–1 steps apart, 3g at 2–3, 4g at 4–5; at six steps (Divine and Undead) they refuse each other. A hero who has grown while wandering asks 1g more per 4 skill levels beyond a fresh hero\'s.'),
        ('Mercy', 'A felled Cowardly enemy begging for mercy is spared 75% by Good, Divine or Druidic; 50% by Neutral or Pagan; 20% by Evil or Undead.'),
        ('Titles', 'No creed scores any Imperial Title differently (R-002).'),
        ('King-only orders', 'Consecrate, Call to Arms and Broker can be given only to the king.'),
        ('Grand Design', 'The Sage 9 mastery order "Grand Design" realises the alignment\'s Wonder; each is realm-wide and permanent.'),
    ]))

    for a in ALIGNS:
        x = ALIGN_DETAIL[a]
        d.add(H1('%s (zeal %d%%)' % (a, x['zeal'])))
        d.add(P('<b>King starts with:</b> %s. <b>Signature order:</b> %s' % (x['skill'], x['order'])))
        d.add(bullets(x['passives']))
        d.add(P('<b>Hiring:</b> %s <b>Grand Design:</b> %s, %s' % (x['hiring'], gd[a]['name'], gd[a]['desc'])))

    d.add(H1('Everything else keyed to alignment'))
    disc = DATA['SAGE_DISCOVERIES_P']
    items = ITEM_GROUPS + LEG_GROUPS
    mons = DATA['MONSTERS_P']
    rows = []
    for a in ALIGNS:
        cr = [x['name'] for x in disc if x.get('alignment') == a]
        its = ['%s (%s)' % (x['name'], x.get('slot', 'trinket')) for x in items if x.get('alignment') == a]
        weak = [m['name'] for m in mons if m['weak']['kind'] == 'align' and m['weak']['key'] == a]
        rows.append([a, '%d: %s' % (len(cr), ', '.join(cr)), '%d: %s' % (len(its), ', '.join(its)) if its else '0', '%d: %s' % (len(weak), ', '.join(weak)) if weak else '0'])
    d.add(table(['Alignment', 'Creed discoveries (alignment-only research)', 'Alignment-only magic items', 'Guardians weak to this creed (double damage)'],
                rows, [0.08, 0.4, 0.3, 0.22]))

    d.add(gaps([
        'Druidic and Evil have no signature order since 2026-10-12. The rulebook\'s signature-action table still lists "Evil: Enslave (passive)"; the engine offers Enslave as a conquest mode on the orders form (loot or enslave). Decide whether that counts as the signature and whether Druidic wants one.',
        'Zeal is the only alignment rule that fires in every battle, and it is very uneven: Divine 50% against Neutral 10%. Neutral is compensated in gold (+20% tax) and Undead by fervour; Pagan (15%) gets Blood Harvest and rites. Is Pagan\'s package as strong as the others?',
        'R-102 open question: with the Reign of Terror discovery a Terror stack is −25%, so three stacks are −75%. Did Toby mean the total capped at −30%?',
        'R-104 open question: the Druidic discovery Deep Roots lost its first half with Awaken the Wild and now reads only "Creatures 10% less likely to die defending".',
        'Alignment-only items exist for only some creeds (see the table above). Divine, Good and Evil have several; check whether Pagan, Druidic, Neutral and Undead want their own.',
        'Only one Undead realm is allowed per game (join-screen text), which no other creed has. Confirm it is still wanted.',
        'Good\'s Banner of Fellowship ("+15% more readily") is the one passive with no figure a player can check; the unify roll is not in the rulebook.',
        'Divine grace plus Consecrate makes the Divine king the hardest to lose; the Cowardly temper text says a Cowardly king is "the safest". Worth a line in the rulebook comparing the two.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 3. TEMPERS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_tempers():
    d = RefDoc(os.path.join(OUT, '03-tempers.pdf'), 'Tempers', 'How a character fights and when they run: every figure the engine applies', STAMP)
    d.cover('Temper governs personal combat: duels, encounters and lair fights. One table in the data file drives every temper '
            'effect in the game. This sheet shows that table raw, then the derived figures the rulebook quotes, then the '
            'special trait of each temper and the items that change a temper.',
            ['Is each temper worth choosing? Berserk is all offence, Brave the complete soldier, Cautious the hardest to kill, Cowardly the best archer and thief.',
             'Cautious and Cowardly heroes break off below 40% HP, so they clear lairs less often; is that trade clear enough to players?',
             'The "None" profile exists only for lair guardians (no perks, no flight).'],
            ['Data file: TEMPER_TRAITS, KC_TEMPERS. Engine: personal-combat/*. Rulebook: Personal Combat & Temper.',
             'Items: ALL_MAGIC_ITEMS_P entries with effect.stat = temper.'])
    T = DATA['TEMPER_TRAITS']
    cols = ['Berserk', 'Brave', 'Cautious', 'Cowardly', 'None (guardians)']
    keys = [
        ('meleeHit', 'Melee to-hit bonus (%)', 'Added to the character\'s own melee to-hit.'),
        ('archeryHit', 'Archery to-hit bonus (%)', 'Added to the character\'s own archery to-hit.'),
        ('defence', 'Guard (%)', 'Subtracted from anyone attacking them in melee; also lowers the 80% melee ceiling against them.'),
        ('meleeDamage', 'Melee damage bonus', 'Flat bonus to melee damage dealt.'),
        ('damageSoak', 'Damage soak', 'Flat reduction on incoming melee damage (never below 1).'),
        ('hitSoakPct', 'Hit soak (fraction)', 'Fraction of each incoming melee or archery hit shrugged off.'),
        ('withdrawMod', 'Break-out modifier (%)', 'Added to breaking out of melee back to firing range.'),
        ('stealMod', 'Steal modifier (%)', 'Added to Steal attempts.'),
        ('fleeMod', 'Flee modifier (%)', 'Added to flee attempts (base 30%).'),
        ('fleeAt', 'Looks to flee below (fraction of max HP)', 'HP fraction below which they look for a way out.'),
        ('fleeUrge', 'Chance per round of bolting', 'Chance per round of acting on that impulse once below the threshold.'),
        ('losingOnly', 'Only while losing', 'Considers flight only while behind on HP.'),
        ('secondWind', 'Second wind (fraction of max HP)', 'Recovered once per fight on first dropping below fleeAt + 5%.'),
        ('riposte', 'Riposte chance', 'Chance to counterattack when a melee attack on them misses.'),
        ('openingShot', 'Opening shot', 'The first move up to firing range in a fight cannot fail.'),
        ('mercy', 'Begs for mercy', 'May beg for mercy when felled instead of dying.'),
        ('rageHp', 'Rage HP', 'Extra HP gained for the fight (unused: null for every temper).'),
    ]
    d.add(H1('The raw table (TEMPER_TRAITS)'))
    rows = []
    for k, label, what in keys:
        rows.append([label] + [str(T[c.split(' ')[0]][k]) for c in cols] + [what])
    d.add(table(['Trait'] + cols + ['Meaning'], rows, [0.17, 0.08, 0.08, 0.08, 0.08, 0.1, 0.41]))

    d.add(H1('Derived figures (as the rulebook quotes them)'))
    rows = [
        ['Highest melee to-hit anyone can reach against them', '80%', '76%', '66%', '74%', '80% cap less the guard'],
        ['Flee chance (30% + modifier)', '10%', '40%', '50%', '60%', '+25% against a slow guardian, −15% against a fast one; Invisibility +30; Charm doubles'],
        ['Second wind triggers below', '—', '30% HP', '—', '—', 'fleeAt + 5%, once per fight, recovers 26%'],
        ['Melee damage', '1–3 + ceil(Melee/2) + 3', '1–3 + ceil(Melee/2) + 1', '1–3 + ceil(Melee/2)', '1–3 + ceil(Melee/2)', 'Less what a guarded foe soaks (Cautious 2); mithril −2'],
        ['Incoming melee/archery hit', '×0.88', '×1', '−2 (melee only)', '×1', 'No attack ever reduced below half of what it would have dealt'],
        ['Mercy when felled', 'no', 'no', 'no', 'yes', 'Spared 75% by Good/Divine/Druidic, 50% Neutral/Pagan, 20% Evil/Undead; escapes with 1 HP, hands over a random item; never against a lair guardian'],
    ]
    d.add(table(['Figure', 'Berserk', 'Brave', 'Cautious', 'Cowardly', 'Notes'], rows, [0.2, 0.13, 0.13, 0.13, 0.13, 0.28]))

    d.add(H1('The special trait of each temper'))
    d.add(table(['Temper', 'Trait', 'What it does', 'Best at', 'Weak at'], [
        ['Berserk', 'Rage', '+3 damage on every melee hit; shrugs off 12% of every incoming melee or archery hit. No guard, no soak, no second wind; every attacker gets +10% against them.', 'Killing fast; melee duels', 'Dying fast; fleeing (10%)'],
        ['Brave', 'Second Wind', '+1 melee damage; once per fight, the first time they drop below 30% HP they recover 26% of max HP. Only consider flight while behind on HP.', 'The complete soldier; lairs', 'Nothing in particular'],
        ['Cautious', 'Guarded and Riposte', 'Every incoming melee hit reduced by 2; when a melee attack on them misses, 40% chance of a free melee blow. No attack bonus.', 'Surviving; punishing wild attackers', 'Clearing lairs (breaks off at 40%)'],
        ['Cowardly', 'Opening Shot and Beg for Mercy', 'First move to firing range always succeeds and they loose a shot first; +22% archery to-hit; +15 Steal; may plead for their life when felled.', 'Archery, theft, spying; a king you cannot lose', 'Melee (−4); lairs (breaks off at 40%)'],
    ], [0.08, 0.14, 0.42, 0.18, 0.18]))

    d.add(H1('Items that change a temper'))
    its = [i for i in ITEM_GROUPS if i.get('effect', {}).get('stat') == 'temper']
    d.add(table(['Item', 'Slot', 'Tier', 'Sets temper to', 'Description'],
                [[i['name'], i.get('slot', '—'), str(i['tier']), i['effect']['temper'], i['desc']] for i in its],
                [0.2, 0.08, 0.05, 0.12, 0.55]))
    d.add(note('Temper is chosen for the king at founding and for each heir; a hero\'s temper is rolled. A character auto-equips items, so a found temper item changes a hero\'s temper unless unequipped.'))

    d.add(gaps([
        'rageHp is null for every temper: a field the table carries but nothing uses. Remove it or give Berserk a rage pool.',
        'Cautious has no attack bonus at all and relies on the 40% riposte; against a guardian that rarely misses (keen eye +20%) it has nothing. Check Cautious heroes\' lair results in the Hunting Rumours odds.',
        'Cowardly is the only temper with mercy, which hands the victor a random item; a Cowardly king carrying relics is a relic donor. Is that intended?',
        'The rulebook says Brave\'s second wind triggers "below 30%" while the table says fleeAt 0.25 + 0.05; the two agree, but the figure is derived rather than stored. Store it or keep the note.',
        'The temper items are all Weak-tier field kit (a temper is utility, not combat kit under R-051). A Powerful-tier temper item with a second effect may be wanted.',
        'The "None" profile has fleeAt 0.25 but fleeUrge 0, so guardians never flee; fine, but any future "neutral hero" temper would need its own row.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 4. SKILLS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
SKILL_ROWS = {
    'melee': ('Martial', 'To hit in personal combat 30% + 10%/level to 5 (then +5%/level to 100% at 9; final figure capped 80%). Damage 1–3 + ceil(raw Melee/2) + temper. Items and auras count past 5 to 9.', 'none', 'A landed blow in a fight; winning any personal fight; losing and living (small)', 'Yes (to 9)', 'Minor: The Duelist'),
    'archery': ('Martial', 'Pre-battle volley: each ranged unit shoots 30% of its own strength, +10% per Archery level (half again at 5). +5% strength per level to every ranged unit led (+25% at 5). Personal combat to-hit same ladder as Melee; arrows 1–3 + ceil(Archery/2); two arrows per Fire action from Archery 3; +5%/level to both range checks; the parting shot.', 'none', 'A landed arrow; losing and living (small)', 'Yes (to 9)', 'Minor: The Marksman'),
    'tactical': ('Martial', '×1.2 army strength per level (×2.0 at 5, hard cap). Land and air units only, land battles only. Practising drills every land and air unit led (Green 5% / Average 4% / Veteran 3% / Crack 2% × level per practice, doubled for Humans). Each level takes −5% off a lone enemy\'s chance to slip past your sentries. Flank riders: Tactical + 1 cavalry.', 'none', 'Winning a land battle; losing and living (small)', 'No', 'Grand Marshal; Minor: The Strategist'),
    'march': ('Martial', 'Adds land movement points to every unit led: +0/+1/+1/+2/+3 at levels 1–5. Counts three times toward initiative. Flyers ignore it.', 'none', 'Marching a column (small)', 'No', 'Minor: The Swift'),
    'naval': ('Martial', '×1.2 per level to every fleet and sea-beast led (cap ×2.0), in every battle on land or sea. Sea movement +0/+1/+1/+2/+3 for every ship. Practising drills fleets. A hero with no ships always has 5 sea points.', 'none', 'Winning a sea battle; every voyage leading ships (passengers learn nothing); losing and living (small)', 'No', 'Sea Lord; Minor: The Sea-Wolf'),
    'spy': ('Special', 'Spy order succeeds at 20% + 20%/level (100% at 4). Stealth: an enemy\'s chance to spot you lurking in their province is 100 −20%/level of yours (to 5) +10%/level of their best Spy there, clamped 25–95%. Counter-watch on your own ground (+10%/level). Spying a capital can steal a discovery at 10% + 10%/level. Encounter catch 70% +5%/level −5%/theirs. Slip past sentries +5%/level. Ambush from Defend 10% + 9%/level.', 'none', 'A successful Spy order, a sprung ambush, running down a quarry, spotting a lurker; Hunting Rumours and a failed Spy (small)', 'No', 'Spymaster; Minor: The Shadow'),
    'thief': ('Special', 'Steal lands at 50% + 10%/level (to 5, cap 95%), halved against a commander with troops or a guarded paymaster. Getaway: Thief × 20%. Lair hoard: 10% of original gold per level; one item at 30% + 10%/level (cap 80%, never a relic). In-combat steal less the guardian\'s watchfulness (−15/30/45 by grade).', 'Thief 1: the Steal order', 'A Steal; stealing from a guardian in a fight; a failed Steal (small)', 'No', 'Minor: The Cutpurse'),
    'druid': ('Special', 'Lead other races and every wild thing: Druid 1 all humanoids and their fleets and winged riders; 3 Whale Cohort, Shark Shoals; 4 the Druid-4 beasts; 5 Elder Dragons, Crimson Rocs, Titan Warbeasts, Dread Hydras. Each missing level −20% on that unit. Mastery: +20% per level above the requirement, to +100%, counting to 9 (items included). A hero leads at most as many beasts as his Druid level. From Druid 3 a natural beast\'s blows land at half force against you. Beast special strikes land at 30% + 10%/level (cap 90%).', 'Druid 1: lead another race', 'Any battle with beasts on either side (loser half); leading newly recruited beasts; recruiting a beast anywhere (small)', 'Yes (to 9, every level counts)', 'Minor: The Naturalist'),
    'sage': ('Special', 'Research rolls 5% per level (to 5); Neutral realms double. A success offers a choice of two discoveries. Practising Sage trains only.', 'Sage 1: the Research order', 'Making a discovery; a fruitless Research or using a magic item (small)', 'No', 'Loremaster; Minor: The Loreseeker'),
    'explorer': ('Special', 'Each Explore charts (terrain base) × (level + 1) points, counted to 5: plains 35, desert 25, sea 25, forest 20, mountain 20, jungle 15.', 'none', 'An Explore order; first step into a province the realm has not fully charted (both small)', 'No', 'Cartographer; Minor: The Trailblazer'),
    'white': ('Magic', 'Five core spells at level 1. Cast 30% + 10%/level (cap 95%). Action spells per turn 1/1/2/3/3 at levels 1–5; combat spells per fight 1 at level 1, 2 from level 2. Effects counted to 5. Items raise cast chance only, to 9.', 'Level 1: the school\'s spells', 'Every successful cast; a fizzle (small)', 'Yes (cast chance only)', 'Archmage, Hierophant; Minor: The Warlock'),
    'psychic': ('Magic', 'As White.', 'Level 1: the school\'s spells', 'As White', 'Yes (cast chance only)', 'Archmage'),
    'illusory': ('Magic', 'As White.', 'Level 1: the school\'s spells', 'As White', 'Yes (cast chance only)', 'Archmage'),
    'elemental': ('Magic', 'As White.', 'Level 1: the school\'s spells', 'As White', 'Yes (cast chance only)', 'Archmage'),
    'necromancy': ('Magic', 'As White. Necromancy 1 also senses battlefield graves in every province entered and is required to hold a skeletal army at all.', 'Level 1: the school\'s spells; holding skeletons', 'As White', 'Yes (cast chance only)', 'Archmage, Deathpriest'),
}


def build_skills():
    d = RefDoc(os.path.join(OUT, '04-skills.pdf'), 'Skills', 'The fifteen skills: what each level buys, what gates on them, how they rise, and their mastery ladder', STAMP)
    d.cover('Every character has fifteen skills from 0 to 9. Levels 1–5 can be trained and give the skill\'s base effect; '
            '6–9 come only from field experience and give the mastery perks (see the Mastery sheet). This sheet puts the '
            'fifteen side by side with the figures the engine uses.',
            ['Are the fifteen worth about the same? March and Explorer buy little past their first levels; Tactical and Druid are large multipliers.',
             'Which skills an item can carry past 5 (Melee, Archery, the five schools, and Druid in its own way).',
             'How each skill is learned in the field (R-023, R-056) and which Imperial Title it feeds.',
             'The king starts with 4 points (max 2 per skill); each hero with 3 at random.'],
            ['Rulebook: The Fifteen Skills, How skills work, Training on the Practice ground, Mastery.',
             'Engine: army-tables.js (SKILL_BENEFIT_CAP 5, SKILL_MAX 9, ITEM_UNCAPPED_SKILLS), KC_BASIC_EXPLORE, MASTERY_UNLOCKS.'])

    d.add(H1('The fifteen skills'))
    rows = []
    for s in SKILLS:
        g, eff, gate, exp, past5, title = SKILL_ROWS[s]
        m = DATA['MASTERY_UNLOCKS'][s]
        rows.append([LABEL[s], g, eff, gate, exp, past5, title, '6: %s 7: %s 8: %s 9: %s' % (m['6'], m['7'], m['8'], m['9'])])
    d.add(table(['Skill', 'Group', 'What each level does (1–5)', 'Gates', 'Field experience (how it rises)', 'Items past 5?', 'Title it feeds', 'Mastery 6 / 7 / 8 / 9'],
                rows, [0.07, 0.05, 0.3, 0.07, 0.13, 0.06, 0.08, 0.24], font=6.8))

    d.add(H1('Rules that cut across every skill'))
    d.add(kv_table([
        ('Three caps', 'Levels 1–5 trainable; 6–9 only by experience; the raw benefit caps at 5 and levels 6–9 buy perks and Title points instead. Exceptions: Melee/Archery to-hit climbs +5% a level past 5, Melee/Archery damage reads the raw level, Druid counts every level to 9.'),
        ('Initiative', 'Order of action within a phase = the sum of all fifteen levels, with March counted three times.'),
        ('One rise per phase', 'A character gains at most one skill level per phase, chosen at random among the candidates (a Practice success always takes the phase). A skill rises from experience at most once a turn, and at most once across a battle and its carry-ons. Each Practice rise earlier in the turn makes the next experience chance ×0.8.'),
        ('Practice (levels 1–5)', 'Alone: 25% (0 to 1), 20%, 15%, 10%, 5% (4 to 5). With a peer at the same level +50%. Under a more skilled mentor: automatic. Perseverance: each failed practice ×1.2 on the next this turn. Humans of a Human realm ×1.5.'),
        ('Items', 'An item\'s skill levels stop at an effective 5 for Tactical, Naval, Sage, Spy, Thief, Explorer, March. Melee, Archery and the five schools stack to 9 (schools: cast chance only). Druid: every level counts.'),
        ('Hit points', 'No skill raises max HP. HP is earned by fighting (see the Heroes sheet).'),
        ('Zero gates', 'No Sage, no Research; no Thief, no Steal; no school level, no spells; no Druid, no leading another race or wild unit; no Necromancy, skeletons crumble at turn\'s end.'),
        ('Wages', 'A hero\'s wage = total skill levels ÷ 4, rounded up, min 1g. Every four levels adds 1g.'),
    ]))

    d.add(H1('Casting, by school level'))
    d.add(table(['Level', '1', '2', '3', '4', '5', '6–9'], [
        ['Cast chance (every spell, every use)', '40%', '50%', '60%', '70%', '80%', '80% (items +10%/level to 95%; mastery L8 +10% per school)'],
        ['Action spells per school per turn', '1', '1', '2', '3', '3', '3'],
        ['Combat spells per school per fight', '1', '2', '2', '2', '2', '2'],
        ['Spell effect level', '1', '2', '3', '4', '5', '5 (never higher)'],
        ['New spells', 'all five core', '', '', '', '', 'one at 7, one at 9'],
    ], [0.3, 0.07, 0.07, 0.07, 0.07, 0.07, 0.35]))

    d.add(gaps([
        'March buys +0 at level 1 and +1 at level 2: the first point in March does nothing to movement (it still counts three times to initiative). Is a dead first level intended?',
        'Explorer\'s per-level benefit is only exploration speed, and R-023 notes Explorer out-trains March in bot games. Halving its field rate is the open suggestion.',
        'Spy 4 makes the Spy order certain (100%) before counter-measures, yet Spy 5 still raises stealth and catch rolls. The order\'s cap at 4 may be worth noting on the join screen.',
        'Tactical never touches fleets and Naval never touches land troops except at sea penalties; a mixed landing uses both. The rulebook says this clearly; the join-screen blurb for March still talks about "contingent unify", which the Tactical/Good rules describe differently.',
        'The join-screen Sage blurb says Sage "also raises your chance of encounters while exploring", which no engine rule does.',
        'The five magic schools are described once ("as White") because their skill rules are identical; the difference is entirely in the spells (see the Spells sheet).',
        'Melee and Archery are the only skills whose to-hit keeps rising past 5. A Melee 9 hero at 100% minus the 80% cap always hits a Berserk; the temper guard is the only thing left that matters. Check this against the guardian hard-to-hit perks.',
        'The king\'s 4 starting points are capped at 2 per skill on the join screen; the rulebook does not say so.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 5. MASTERY
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_mastery():
    d = RefDoc(os.path.join(OUT, '05-mastery.pdf'), 'Mastery: perks, orders and spells', 'Levels 6 to 9 of every skill, the twenty mastery orders, the ten mastery spells and the seven Grand Designs', STAMP)
    d.cover('Past level 5 a skill stops growing its base effect and instead grants a perk at 6 and 8 (always on) and a new '
            'order or spell at 7 and 9. These levels come only from field experience. The rulebooks may hint at mastery but '
            'never name it (R-114), so this sheet is the one place the whole ladder is written out.',
            ['Are the even-level perks of similar value across skills? Some are precise (Melee 6 Parry), some vague (Spy 8 "your spycraft deepens").',
             'Do the order hints on the player\'s form agree with the unlock text? Several differ in the figure quoted.',
             'Each L7/L9 order is once per turn per character. Mastery spells are once per turn too.',
             'The Grand Design (Sage 9) is each alignment\'s Wonder.'],
            ['Data file: MASTERY_UNLOCKS (what the hero is told on reaching the level), SPELL_DEFS_P (reqLevel 7/9), KC_GRAND_DESIGNS.',
             'Player portal: L79_ORDERS (the order hints). Engine: MASTERY_ORDER_KEYS, war-mastery-orders, espionage-orders.'])

    M = DATA['MASTERY_UNLOCKS']
    d.add(H1('The mastery ladder, skill by skill'))
    rows = [[LABEL[s], M[s]['6'], M[s]['7'], M[s]['8'], M[s]['9']] for s in SKILLS]
    d.add(table(['Skill', 'Level 6 (perk)', 'Level 7 (order or spell)', 'Level 8 (perk)', 'Level 9 (order or spell)'], rows, [0.09, 0.23, 0.23, 0.22, 0.23]))

    d.add(H1('The twenty mastery orders, as the orders form describes them'))
    L = DATA['L79_ORDERS']
    rows = []
    order_names = [k for k in L.keys()]
    for name in order_names:
        o = L[name]
        rows.append([name, LABEL[o['skill']], str(o['lvl']), o.get('target', '') + (' (%s)' % o['provKind'] if o.get('provKind') else ''), o['hint']])
    rows.append(['Grand Design', 'Sage', '9', 'none', 'Realise your alignment\'s Wonder (see below). Hint is written per realm on the form.'])
    rows.sort(key=lambda r: (SKILLS.index([k for k, v in LABEL.items() if v == r[1]][0]), int(r[2])))
    d.add(table(['Order', 'Skill', 'Level', 'Target', 'What the form tells the player'], rows, [0.12, 0.07, 0.04, 0.1, 0.67]))

    d.add(H1('The ten mastery spells'))
    S = DATA['SPELL_DEFS_P']
    rows = []
    for name, sp in S.items():
        if sp.get('reqLevel'):
            rows.append([name, LABEL[sp['school']], str(sp['reqLevel']), sp['target'], sp['desc']])
    rows.sort(key=lambda r: (DATA['KC_MAGIC_SCHOOLS'].index([k for k, v in LABEL.items() if v == r[1]][0]), int(r[2])))
    d.add(table(['Spell', 'School', 'Level', 'Target', 'Effect'], rows, [0.12, 0.1, 0.05, 0.08, 0.65]))

    d.add(H1('Grand Designs (Sage 9): one Wonder per alignment'))
    gd = DATA['KC_GRAND_DESIGNS']
    d.add(table(['Alignment', 'Wonder', 'Effect'], [[a, gd[a]['name'], gd[a]['desc']] for a in ALIGNS], [0.12, 0.2, 0.68]))

    d.add(H1('Rules'))
    d.add(kv_table([
        ('How it is earned', 'Levels 6–9 only through field experience (fighting, casting, exploring, leading); never the Practice ground. One rise per phase, one per skill per turn.'),
        ('Once per turn', 'Each L7/L9 mastery order may be attempted once per turn per character, spent win or lose. Mastery spells likewise.'),
        ('Secrecy', 'The rulebooks hint at mastery but never name a perk, order or spell (R-114). A hero\'s own report spells it out on reaching the level.'),
        ('Titles', 'Every level past 5 counts toward the Imperial Titles.'),
        ('Cast chance', 'Each school\'s L8 perk adds +10% to every cast; the four stack to the 95% ceiling.'),
    ]))

    d.add(gaps([
        'Unlock text and form hint disagree on figures: Feigned Retreat (unlock "+strength", hint "+25%"); Grand Stratagem ("dictate the terms of one battle" vs "+20% strength"); Lightning Advance (unlock "no terrain bonus, no pre-battle magic, no pre-battle archery" vs hint "lose their defensive footing (−20%)"); Sabotage ("−tax / disband a garrison unit" vs "yields no tax next turn and loses a garrison unit"); Raid the Coast (unlock "plundering the province treasury" vs hint "+25% strength"). The engine should be read for the truth and both texts aligned.',
        'Spy 8 ("your spycraft deepens") and Explorer 6 ("spot one random undiscovered lair") are the vaguest and smallest perks; compare with Thief 8 (double heist gold, pockets cannot be picked) or Tactical 8 (half losses).',
        'Sage 6 is +5 gold per discovery and Sage 8 +1 tax base per discovery (R-059): both pay only when discoveries are still being made, so they fade late in a game once the fields run dry (R-037).',
        'Druid 6 (half cost and wages for beasts) overlaps the Druidic Grand Design (half wages, muster as Veterans). Stacking order should be stated.',
        'Melee 7 Challenge targets a lone enemy hero; Melee 9 Rampage "after winning a duel" (unlock) vs "hurl yourself at an enemy force" (hint). Different triggers.',
        'Forced March is described as "with a 50% chance to slip past a battle this phase"; at March 7 a hero already has +3 points from level 5, so the order\'s worth is the battle-skip, not the move.',
        'Grand Heist\'s hint is the longest single rule text on the orders form (about 150 words). Consider shortening.',
        'Naval 8 "one naval hull now carries what once needed two" plus Great Turtles\' two berths: check they stack as intended (four units a turtle?).',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 6. ORDERS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
ORDERS = [
    # (name, group, who, needs, target, what it does, cost, movement, notes)
    ('Move', 'Movement', 'Any', '', 'An adjacent province', 'Travel one province. Into a defended enemy or neutral province it triggers a battle; with armies you can conquer. A displaced character still heads for the named province.', '', '1 land (1 sea if the step touches water); +1 for a victory', 'One Move = one province whatever the pool; five phases is the ceiling.'),
    ('Defend', 'Movement', 'Any', '', 'none', 'Keep watch to turn\'s end over your province and every neighbouring province you own. A general with troops rides out to meet an enemy army marching into, or raised inside, a watched province and fights as the defender (×1.25, ×1.5 at home). A lone character lies in ambush instead (10% + 9%/Spy level, halved against a commander with troops).', '', '1 per ride-out', 'A blank phase counts as Defend (R-085). One reaction per phase; own gate first; ends on a battle, a Move or an Encounter.'),
    ('Explore', 'Scouting', 'Any', '', 'Here', 'Chart the province: (terrain base) × (Explorer + 1) points. Reveals terrain, wealth, defenders and lairs as the figure climbs.', '', '0', 'Base per terrain: plains 35, desert 25, sea 25, forest 20, mountain 20, jungle 15.'),
    ('Search Lair', 'Scouting', 'Any', 'A discovered lair here', 'A lair', 'Fight its guardian in personal combat for the hoard: gold, one magic item of the guardian\'s grade, an HP roll and field experience.', '', '0', 'Uses the Encounter Plan. A hero who flees leaves the hoard.'),
    ('Hunting Rumours', 'Scouting', 'Any', 'Known lairs here', 'Any number of lairs', 'For each lair paid for, learn the guardian\'s weakness (kept for that kind forever), the exact hoard, and your own odds in five bands.', 'Weak 1g, Moderate 2g, Powerful 3g, Legendary 4g', '0', 'Spy fieldwork (may raise Spy). R-035: always learns everything paid for.'),
    ('Spy', 'Scouting', 'Any', '', 'Here, or a character here', 'Province: defenders, owner, lairs, characters and their units, and the characters in neighbouring provinces. Character: every skill, item and unit. A rival capital also yields tax income, hero count and a chance to copy a discovery.', '', '0', '20% + 20%/level. R-111 lists what spying shows.'),
    ('Recruit Armies', 'Armies', 'Any', 'A province you hold', 'Unit types offered here', 'Raise units at the listed price (paid again as wage the same turn). Garrison units always muster into the garrison. Mercenary bands roaming the province are hired here too.', 'The unit\'s cost', '0', 'Cap one of each type per province per turn; two for garrisons, Goblin Hordes, humanoid fleets, and anything at the home capital. Beasts count against the Druid cap.'),
    ('Hire Hero', 'Armies', 'Any', 'A wandering hero here', 'A hero', 'Take them into service at the alignment-distance wage. Their orders for the rest of the turn can be written at once and apply only if the hire lands.', '2–4g/turn, plus 1g per 4 skill levels above a fresh hero', '0', 'Higher initiative wins a contested hire. R-014.'),
    ('Release Hero', 'Armies', 'Any (never the king)', 'Leading no army', 'Self', 'Dismiss a hero; they wander again, keeping their items; not re-hirable the same turn.', '', '0', ''),
    ('Disband Army', 'Armies', 'Any', '', 'Units led', 'Dismiss units you no longer wish to pay for.', '', '0', ''),
    ('Leave/Transfer Army', 'Armies', 'Any', '', 'Garrison, or a character here', 'Drop units as garrison or hand them to another of your characters in the same province.', '', '0', 'Refused on open water if it would leave either column short of hulls. Beasts count against the receiver\'s Druid cap.'),
    ('Pick Up Army', 'Armies', 'Any', '', 'Garrison units here', 'Take command of unled units here, all or a subset. Slower units slow the column at once.', '', '0', 'On open water only what the ships and flyers can carry.'),
    ('Send Item', 'Belongings', 'Any', '', 'Any living character of yours', 'Send one or more magic items anywhere; hand to hand if together, otherwise by courier arriving at turn\'s end (a Grand Heist can rob a courier).', '', '0', ''),
    ('Equip Items', 'Belongings', 'Any', '', 'Self', 'Choose what is worn in every slot: weapon, armour, shield, cloak, helm, two rings, amulet, two combat items. Unslotted items are always active.', '', '0', 'A character auto-equips the first item held for each slot.'),
    ('Use Item', 'Belongings', 'Any', 'An item with a Use', 'Self', 'Activate a magic item\'s power; spell items cast their spell at a flat 95% with no skill and no casting slot.', '', '0', 'Using an item is small Sage experience (R-023).'),
    ('Encounter Character', 'Confrontation', 'Any', 'A visible enemy character', 'A character', 'Hunt them down one province a phase. Once sharing a province, corner them on a Spy contest (70% +5%/your Spy −5%/theirs). Both with armies: a battle; otherwise a duel; a lone hunter must slip through the quarry\'s camp (60% −8%/unit +5%/Spy −5%/their Tactical, 5–95%).', '', '1 per step', 'Only a king may run down a king (R-021). Catch chance R-042.'),
    ('Steal', 'Confrontation', 'Any', 'Thief 1', 'A character here, or the garrison paymaster', 'Take one magic item or 5% of the target realm\'s treasury; a paymaster yields 1g per garrison unit. 50% + 10%/Thief level (to 5), halved against troops or a guarded paymaster. A failed, spotted thief is set upon.', '', '0', 'Getaway Thief × 20%. Lead with Flee in the Encounter Plan to avoid the fight.'),
    ('Cast Spell', 'Power', 'Any', 'Level 1 in the school', 'Per spell', 'Work an action spell (see the Spells sheet). Cast at 30% + 10%/level, cap 95%. Spells per school per turn 1/1/2/3/3.', '', '0', 'A spell whose target has ridden out is never worked and costs nothing.'),
    ('Practice Skill', 'Self-improvement', 'Any', '', 'A skill (to level 5)', 'Alone 25/20/15/10/5% for 0→1 to 4→5; peers at the same level +50%; a better mentor present makes it automatic. Perseverance ×1.2 per failure this turn. Practising Tactical or Naval also drills the units led.', '', '0', 'Humans of a Human realm ×1.5.'),
    ('Research', 'Self-improvement', 'Any', 'Sage 1', 'A field of study', 'Roll 5% per Sage level (to 5; Neutral double; perseverance ×1.2 per failure this turn). A success brings two discoveries from the field; keep one with your next orders.', '', '0', 'An unlooked-for find from any field is rolled first, at a long shot.'),
    ('Rest', 'Self-improvement', 'Any', '', 'Self', 'Recover 30% of max HP, rounded up (at least 1); Divine half as much again.', '', '0', ''),
    ('Consecrate', 'Alignment: Divine', 'King only', 'An owned province, not home or its neighbours, not bordering holy ground', 'A province', 'Sanctify it: +50% tax, stauncher defenders, Undead and Evil attack at −15%, and the only ground the fallen return on. Up to one per level of the king\'s White.', '', '0', ''),
    ('Call to Arms', 'Alignment: Good', 'King only', '', 'Any owned humanoid province', 'A free Green garrison unit of the native type musters there. Once per turn, from anywhere.', '', '0', ''),
    ('Broker', 'Alignment: Neutral', 'King only', '', 'A visible wandering hero, or a province ever seen', 'Hire a distant hero without leaving the hall, or buy a guaranteed full Spy report on a far province.', '2g for a report', '0', ''),
    ('Perform Rite', 'Alignment: Pagan', 'Any', 'A discovered ritual site here (owned or not)', 'Wild Hunt or Blood Offering', 'Wild Hunt: two of the province\'s beasts join as Veterans for the price of one, no wages, until the end of the following turn. Blood Offering: sacrifice units to raise an equal number of others +2 tiers.', 'Wild Hunt: one beast\'s price', '0', 'One rite per province per turn (R-008). Only the Blood Offering at a humanoid province\'s stones.'),
    ('Harvest the Field', 'Alignment: Undead', 'Any', 'Battlefield graves here', 'Here', 'Raise one grave (the most experienced dead) as a Skeletal unit, no magic needed.', '2g', '0', 'Give it to a Necromancy 1 character before turn\'s end.'),
]


def build_orders():
    d = RefDoc(os.path.join(OUT, '06-orders.pdf'), 'Orders', 'Every order a character can be given: the everyday ones, the alignment signatures and the twenty mastery orders', STAMP)
    d.cover('Each character takes one order per phase, five phases a turn. The orders form offers %d actions in all: %d '
            'everyday orders, 5 alignment signatures and 20 mastery orders (two for each of the ten non-magic skills; the Sage 9 '
            'order is the Grand Design). This sheet lists every one with who can give it, what it needs, what it does, what it '
            'costs and what it spends in movement.'
            % (len(DATA['ACTIONS']), len(DATA['ACTIONS']) - 5 - 20),
            ['Is every order worth a phase? Rest, Explore and Practice compete with each other on a quiet turn.',
             'Which orders are gated by a skill at 1 (Research, Steal, Cast Spell) and which by mastery at 7 or 9.',
             'The movement costs of conquest (R-081): attack and win costs two points.',
             'Defend is the longest rule in the game; its summary is here, the worked examples are in the rulebook.'],
            ['Rulebook: Every Order Explained, The Defend order in full, Movement & Marching.',
             'Player portal: ACTIONS, ACTION_DISPLAY_ORDER, ALIGN_ACTIONS, KING_ONLY_ACTIONS, L79_ORDERS.',
             'Engine: src/engine/orders/* (one file per family of orders).'])

    d.add(H1('Everyday orders and alignment signatures'))
    rows = [list(o) for o in ORDERS]
    d.add(table(['Order', 'Group', 'Who', 'Needs', 'Target', 'What it does', 'Gold', 'Movement', 'Notes'], rows,
                [0.09, 0.07, 0.05, 0.08, 0.08, 0.33, 0.07, 0.08, 0.15], font=6.9))

    d.add(H1('Mastery orders (level 7 and 9 of a non-magic skill)'))
    L = DATA['L79_ORDERS']
    M = DATA['MASTERY_UNLOCKS']
    rows = []
    for name, o in L.items():
        rows.append([name, '%s %d' % (LABEL[o['skill']], o['lvl']), o.get('target', '') + (' (%s)' % o['provKind'] if o.get('provKind') else ''), M[o['skill']][str(o['lvl'])].replace('New order — ', ''), o['hint']])
    rows.append(['Grand Design', 'Sage 9', 'none', M['sage']['9'].replace('New order — ', ''), 'Realise your alignment\'s Wonder; see the Mastery sheet.'])
    rows.sort(key=lambda r: (SKILLS.index([k for k, v in LABEL.items() if v == r[1].rsplit(' ', 1)[0]][0]), r[1]))
    d.add(table(['Order', 'Skill', 'Target', 'What the hero is told on unlocking it', 'What the orders form says'], rows, [0.11, 0.07, 0.1, 0.3, 0.42], font=6.9))

    d.add(H1('What each action costs in movement points'))
    d.add(table(['What you do', 'Points'], [
        ['Move one province (any terrain)', '1'], ['Sail into the sea, or land on a coast', '1 sea'],
        ['March into empty unclaimed land, or an undefended enemy province (and take it)', '1'],
        ['Attack and win', '2 (1 to step in, 1 for the victory)'], ['Attack and lose', '1'],
        ['Press on with an unfinished battle next phase', '1 if you have one (fought anyway if not)'],
        ['Defend: ride out to a neighbour', '1'], ['Encounter: each step of a chase', '1'],
        ['Search a lair, fight its guardian, Explore, retreat after a loss', '0'],
    ], [0.6, 0.4]))
    d.add(note('A character leading no army has a flat 5 land and 5 sea points. A column moves at its slowest unit\'s pace plus the leader\'s March (land) or Naval (sea): +0/+1/+1/+2/+3 at levels 1–5.'))

    d.add(H1('The order of events inside a phase'))
    d.add(table(['When', 'What happens'], [
        ['Start of phase', 'Defend orders for this phase take effect; every army about to march into a watched province is spotted. Nobody moves.'],
        ['Non-moving orders', 'Casting, transfers, items, recruiting, hiring, practice, research, rest, spying and the rest resolve in initiative order (sum of all skills, March ×3) with everyone where the phase began.'],
        ['The Defend step', 'Generals on watch ride out: first to the strongest marching threat (or hold their own gate), failing that to a host raised inside the watch.'],
        ['Moves and Encounters', 'Columns arrive, battles are fought, chases close.'],
        ['After all orders', 'A last sweep for enemy hosts inside a watch; lone characters on Defend spring ambushes.'],
        ['End of turn', 'Tax and wages settle together; graves decay; garrisons drill; couriers arrive; charms fade; Elven survivors come home.'],
    ], [0.18, 0.82]))

    d.add(gaps([
        'Druidic and Evil realms have no signature order; every other creed has one. See the Alignments sheet.',
        'Mastery order hints and unlock texts differ in several figures (listed on the Mastery sheet).',
        'Hunting Rumours and Explore both cost a phase and spend no movement; Rest competes with them. A hero in a quiet province has three "free" orders and no way to do two at once.',
        'Hire Hero lets you pre-write the hero\'s orders; Charm and Resurrect do too (R-014). Broker hires at a distance but the rulebook does not say whether pre-written orders apply there.',
        'Steal halves against a commander leading troops; Encounter\'s slip-past roll loses 8% per unit led. The two "guarded" penalties use different shapes.',
        'Sabotage, Assassinate and Grand Heist are limited to realms you are at war with; the rulebook says only "some mastery abilities". The list should be stated once.',
        'The orders form knows %d actions; a new player sees far fewer' % len(DATA['ACTIONS']) + ' because alignment, king-only and mastery orders are filtered. Worth a line in the rulebook saying the list grows.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 7. SPELLS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_spells():
    d = RefDoc(os.path.join(OUT, '07-spells.pdf'), 'Spells', 'The twenty-five core spells, the ten mastery spells, how casting works, and the items that cast them', STAMP)
    S = DATA['SPELL_DEFS_P']
    bm = set(DATA['BATTLE_MAGIC_SPELL_NAMES'])
    d.cover('Five schools, five core spells each at level 1, plus one mastery spell at 7 and one at 9. A spell can work as an '
            'action (a phase order), in personal combat, or as battle magic before an army clash; many do more than one. '
            'Effects are worked out on the caster\'s level counted to 5.',
            ['Does each school have a comparable mix of action, combat and battle-magic uses? (' + '; '.join('%s %d action / %d combat / %d battle' % (LABEL[sc].replace(' Magic', ''), sum(1 for n, x in S.items() if x['school'] == sc and not x.get('reqLevel') and x.get('phase')), sum(1 for n, x in S.items() if x['school'] == sc and not x.get('reqLevel') and x.get('encounter')), sum(1 for n, x in S.items() if x['school'] == sc and not x.get('reqLevel') and n in bm)) for sc in DATA['KC_MAGIC_SCHOOLS']) + ').',
             'Are the damage spells in step with each other at level 5 (Lightning 5–15, Fireball 20%/round for 3 rounds, Hand of Death 60% for 40%, Telekinetic Storm 27%)?',
             'Which action spells have no spell item (the items cast at a flat 95%).',
             'Whether battle-magic effects are worth a cast slot next to the action use.'],
            ['Data file: SPELL_DEFS_P (flags: phase = action, encounter = combat; target). Engine: BATTLE_MAGIC_SPELL_NAMES, NPC_SCHOOL_SPELL.',
             'Rulebook: Magic: The Five Schools, The Spellbook, Mastery spells. Rulings R-010, R-017, R-024, R-028, R-031, R-053, R-112, R-113, R-115.'])

    d.add(H1('Casting rules'))
    d.add(kv_table([
        ('Cast chance', '30% + 10% per school level, cap 95%: 40% at 1, 80% at 5. The same roll for an action, battle magic or a duel, and for a guardian hero (R-115). Items add +10% a level past 5; mastery L8 +10% per school; some discoveries add more.'),
        ('How many', 'Action spells per school per turn: 1 at levels 1–2, 2 at 3, 3 at 4–5. Combat spells per school per fight: 1 at level 1, 2 from 2; each spell once per fight.'),
        ('Effect level', 'Every effect reads the level counted to 5. Levels 6–9 buy cast chance and the mastery spells only.'),
        ('Weakness', 'A guardian weak to the school cannot resist: cast at a flat 95%, damage and every effect doubled.'),
        ('Wards', 'A guardian\'s school ward takes −20/30/40/50% off the cast chance by grade; stun wards turn stuns aside; spell resistance cuts damage.'),
        ('Spell items', 'Two items per core action spell cast it at a flat 95% with no skill and no slot (as at least a level-3 casting). No item casts a mastery spell.'),
        ('Missed targets', 'A character-targeted spell whose target rode out earlier is never worked and costs nothing. Province spells and Clairvoyance always work.'),
        ('Graves', 'Battlefield graves decay 10% a turn (5% in Undead provinces). Necromancy 1 senses whether graves lie in every province entered.'),
    ]))

    spell_items = {}
    for it in ITEM_GROUPS + LEG_GROUPS:
        e = it.get('effect', {})
        if e.get('stat') == 'castSpell':
            spell_items.setdefault(e['spell'], []).extend(it['names'])

    for school in DATA['KC_MAGIC_SCHOOLS']:
        d.add(H1(LABEL[school]))
        rows = []
        for name, sp in S.items():
            if sp['school'] != school:
                continue
            uses = []
            if sp.get('phase'):
                uses.append('Action')
            if sp.get('encounter'):
                uses.append('Combat')
            if name in bm:
                uses.append('Battle magic')
            rows.append([name, 'Mastery %d' % sp['reqLevel'] if sp.get('reqLevel') else 'Core (level 1)', ', '.join(uses), sp['target'], sp['desc'], ', '.join(spell_items.get(name, [])) or '—'])
        d.add(table(['Spell', 'Needs', 'Used as', 'Target', 'Effect', 'Items that cast it'], rows, [0.1, 0.07, 0.09, 0.06, 0.52, 0.16]))

    d.add(H1('Summary by school'))
    rows = []
    for school in DATA['KC_MAGIC_SCHOOLS']:
        sp = [(n, s) for n, s in S.items() if s['school'] == school and not s.get('reqLevel')]
        rows.append([LABEL[school], str(len(sp)), str(sum(1 for n, s in sp if s.get('phase'))), str(sum(1 for n, s in sp if s.get('encounter'))), str(sum(1 for n, s in sp if n in bm)),
                     str(sum(len(spell_items.get(n, [])) for n, s in sp)), ', '.join(n for n, s in sp if s.get('phase') and not spell_items.get(n)) or '—'])
    d.add(table(['School', 'Core spells', 'Action', 'Combat', 'Battle magic', 'Spell items', 'Action spells with no item'], rows, [0.14, 0.09, 0.08, 0.08, 0.1, 0.09, 0.42]))

    d.add(gaps([
        'Illusory has no battle-magic spell at all; Elemental and White have two each, Necromancy three. An Illusory caster adds nothing to an army battle until Phantasmal Armies is cast beforehand.',
        'Elemental has only three action spells (Earthquake, Flood, Elemental Summon) where the other schools have four or five, and Lightning Bolt and Fireball are the only pure combat spells in the game besides Mirror Image, Spiritwrack and Hand of Death.',
        'Action spells with no spell item (see the summary) cannot be cast by a non-mage; check that list is deliberate (combat-only spells have none by design).',
        'Hand of Death is a 60% chance (at Necromancy 6+, counted "at most 60%") for 40% of max HP, capped by the half-HP rule (R-080). Against a 60 HP hero that is 24. Fireball at level 5 does 20% a round for three rounds (60%). Compare these in the Hunting Rumours odds.',
        'Psychic Blast as an action removes 2 skill levels permanently and lowers the victim\'s wage (R-024). It is the only permanent skill loss in the game; is that balance wanted next to Curse (temporary)?',
        'Charm resistance grows 30% per Charm (R-017, open question). Charm doubling the Flee chance in combat is a small combat effect for a level-1 slot.',
        'Spell descriptions quote some figures "counted to level 5" and some not (Lightning Bolt says so, Fireball says "at 5"). A single phrasing would help.',
        'The rulebook spellbook tables (A/C/B markers) are generated from the data; the data file\'s "phase" and "encounter" flags, plus BATTLE_MAGIC_SPELL_NAMES, are the truth.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 8. ARMY UNITS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def unit_row(u):
    terr = ' '.join('%s %s' % (TNAME[t][:3], fmt_mult(TERRAIN[t].get(u, 1.0))) for t in LAND if u not in UCLASS['sea'])
    return [u, RACE_OF_UNIT.get(u, '?'), UTYPE.get(u, 'infantry'), str(BASE.get(u, '?')), str(COST.get(u, '?')), spg(u), str(SPEED.get(u, '?')),
            druid_need(u), classes_of(u), terr, ABIL.get(u, '')]


def build_units():
    d = RefDoc(os.path.join(OUT, '08-army-units.pdf'), 'Army units', 'Every unit in the game: strength, cost, speed, type, Druid requirement, terrain and abilities', STAMP)
    hum = [u for u in BASE if u not in PRIMAL and not u.endswith('Elemental') and u != 'Corsair Fleet' and u != 'Whale Cohort']
    d.cover('%d units: %d humanoid (four races, with garrisons and fleets), 9 Creatures and 9 Monsters, and the five '
            'summoned elementals. A unit\'s real strength is base × quality (Green 1, Average 2, Veteran 3, Crack 4, Elite 5); '
            'its cost is both the recruit price and the wage every turn. Strength per gold is base ÷ cost.'
            % (len(hum) + len(PRIMAL) + 5, len(hum)),
            ['Strength per gold: humanoid line units sit around 2.0; the beasts were set at 2.6–2.75 (Druid 4) and 2.4–2.6 (Druid 5) because they never get the ×1.44 kinship.',
             'Every humanoid unit has a matchup ability and one more (R-095); every beast a signature multiplier and most a pre-battle strike (R-106).',
             'Terrain multipliers per unit (also on the Terrain sheet) and the Druid level needed to lead it.',
             'Which units are missing from a race\'s cells by terrain (see the Races sheet).'],
            ['Data file: KC_UNIT_BASE_STR, KC_UNIT_TYPE, KC_UNIT_CLASS, KC_DRUID_LEVELS, PRIMAL_ARMY_DEFS_P, PROVINCE_ARMIES_P.',
             'Engine: ARMY_COST_MASTER, ARMY_SPEED_MASTER, TERRAIN_MODS, UNIT_ABILITIES (player portal), recruit-limits.js.',
             'Rulebook: Armies, Quality & the Wage Rule; How a Battle Is Fought. Rulings R-088 to R-096, R-100, R-103 to R-106, R-109.'])

    cols = ['Unit', 'Race / family', 'Type', 'Base str', 'Cost = wage', 'Str per gold', 'Move', 'Druid', 'Classes', 'Terrain (plains, desert, forest, jungle, mountain)', 'Abilities']
    widths = [0.09, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.04, 0.1, 0.15, 0.35]
    for race in RACES:
        d.add(H1('%s units' % race))
        units = [u for u in BASE if RACE_OF_UNIT.get(u) == race]
        units.sort(key=lambda u: (['infantry', 'ranged', 'cavalry', 'flyer', 'naval'].index(UTYPE.get(u, 'infantry')), -BASE[u]))
        d.add(table(cols, [unit_row(u) for u in units], widths, font=6.6))

    d.add(H1('Creatures (Druidic realms lead them free)'))
    units = [u for u in UCLASS['creature']]
    units.sort(key=lambda u: (int(druid_need(u)), -BASE[u]))
    d.add(table(cols, [unit_row(u) for u in units], widths, font=6.6))
    d.add(H1('Monsters (Evil realms lead them free)'))
    units = [u for u in UCLASS['monster']]
    units.sort(key=lambda u: (int(druid_need(u)), -BASE[u]))
    d.add(table(cols, [unit_row(u) for u in units], widths, font=6.6))
    d.add(H1('Summoned elementals (Elemental Summon, for the rest of the turn)'))
    d.add(table(['Unit', 'Base str', 'Type', 'Notes'], [[u, str(BASE[u]), UTYPE[u], 'Random one of the five; stands in the line like foot; dissolves at turn\'s end. "Roughly as strong as a powerful primal unit".'] for u in BASE if u.endswith('Elemental')], [0.2, 0.08, 0.08, 0.64]))

    d.add(H1('Beast pre-battle strikes'))
    rows = []
    for u, p in PRIMAL.items():
        for sp in p.get('spells', []):
            rows.append([u, sp['name'], '%d–%d' % tuple(sp['dmg']), 'every enemy unit' if sp['target'] == 'all' else 'one enemy unit', '30% + 10% per Druid level of the commander, max 90%', sp['flavour']])
    for u, txt in [('Noble Griffons', 'Screech Dive: 2–4 on one unit, flat 50%'), ('Wyvern Riders', 'Acid Spit: 2–5 on one unit, flat 50%')]:
        rows.append([u, txt.split(':')[0], txt.split(':')[1].split(' on')[0].strip(), 'one enemy unit', 'flat 50% whatever the Druid', ''])
    d.add(table(['Unit', 'Strike', 'Damage', 'Hits', 'Chance', 'Flavour'], rows, [0.12, 0.14, 0.06, 0.1, 0.22, 0.36]))
    d.add(note('No special strike: Shark Shoals, Great Bears, Unicorn Herd, Great Turtles. Pre-battle damage is taken off each unit\'s finished strength, after every multiplier (R-041).'))

    d.add(H1('Quality, recruiting and wages'))
    d.add(kv_table([
        ('Quality multiplier', 'Green ×1, Average ×2 (a new recruit), Veteran ×3, Crack ×4, Elite ×5. Below Green a unit disbands (no grave).'),
        ('Promotion', 'Winning battles (by result band), a commander\'s drills (Practice Tactical for land and air, Naval for fleets: Green 5% / Average 4% / Veteran 3% / Crack 2% × level), and garrison self-drill at Tactical/Naval 1 each turn. Humans doubled. Skeletons never change.'),
        ('Wage', 'The recruit price again every turn, garrison included, paid with tax at turn\'s end (so a new unit costs double its first turn). Skeletons 1g. Orcish attackers who win pay half that turn. Druid 6 halves beast wages; the Druidic Wonder too.'),
        ('Recruit cap', 'One of each type per province per turn; two for garrisons, Goblin Hordes and humanoid fleets; two of anything at the home capital (R-047). Beasts are recruited where they live, and a hero leads at most as many as his Druid level (R-103).'),
        ('Bankruptcy', 'Units disband greenest first anywhere in the realm, skeletons last; then heroes desert. A ship carrying troops at sea is never disbanded while they would be stranded.'),
        ('Sea lift', 'One land unit per hull (two per Great Turtle); light foot take half a hull; cavalry and walking beasts a full one; sea-beasts carry nothing. Winged riders lift one foot unit each. Land troops fight at sea at ×0.75; air-carried at ×0.25 (their carriers ×0.5).'),
        ('Druid shortfall', 'Each missing Druid level costs the unit 20%; each level above adds 20%, to +100% (R-036).'),
    ]))

    d.add(H1('Strength per gold, every unit (base ÷ cost; higher is cheaper strength)'))
    rows = sorted([(BASE[u] / COST[u], u) for u in BASE if u in COST and u != 'Corsair Fleet'], reverse=True)
    d.add(table(['Unit', 'Family', 'Type', 'Base', 'Cost', 'Str per gold'], [[u, RACE_OF_UNIT.get(u, '?'), UTYPE.get(u, '?'), str(BASE[u]), str(COST[u]), '%.2f' % v] for v, u in rows], [0.25, 0.15, 0.12, 0.1, 0.1, 0.12], font=7))

    d.add(gaps([
        'Strength per gold runs from %s to %s. Garrisons and line foot sit at 2.0; most elite humanoid units at 1.5\u20131.75. The beasts are deliberately above the humans (no kinship); the lowest three are well below everything else.' % (
            ', '.join('%s %.2f' % (u, v) for v, u in rows[-3:][::-1]), ', '.join('%s %.2f' % (u, v) for v, u in rows[:3])),
        'Corsair Fleet is retired (R-109) yet still in the cost, speed, terrain and unit-type tables; "Siege Towers" appears in the Minor Title heavy-unit list though no such unit exists.',
        'The primal "cat" field (Heavy, Free Lances, Naval, Cavalry) is an internal category that still calls flyers "Free Lances"; harmless but confusing in the data file.',
        'Goblin Horde (3 for 2g) is the weakest humanoid unit and can be raised two a turn; Sheer Numbers (+10% per other orc foot, to +30%) is what makes it work. Check it is used that way.',
        'Elven Galleys\' Sea Archers removes the land-unit penalty at sea for ranged units only; nothing lifts infantry or cavalry at sea except Naval 8. Fleets of the four races are 5/5/7/5 strength for 3/3/4/3 gold with one ability each.',
        'Four units have no pre-battle strike (Shark Shoals, Great Bears, Unicorn Herd, Great Turtles); the Thunderbirds\' strike (4–8 on one unit) and the Crimson Rocs\' (5–9) are the biggest single-unit strikes while the all-line strikes do 2–4 to 3–6 each.',
        'R-095 open question: Pack Hunt (Wargs), Panic (Wyverns) and Close Order were not built as third abilities.',
        'Flyers fight ×0.75 under trees (R-100) and the winged riders take double from arrows and are shot first; the flying beasts take normal arrows and are not singled out. Two different flyer rules for the player to remember.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 9. TERRAIN
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_terrain():
    d = RefDoc(os.path.join(OUT, '09-terrain.pdf'), 'Terrain', 'The six terrains: exploration, battle fronts, unit multipliers, movement and what each is home to', STAMP)
    d.cover('Provinces are plains, desert, forest, jungle, mountain or sea. Terrain decides how fast a province is charted, how '
            'wide a battle front is, which units thrive or suffer, which race\'s provinces lie there and which troops it offers. '
            'The per-unit multipliers are written once, in the engine\'s TERRAIN_MODS, and shown in full here.',
            ['Is each terrain someone\'s home ground? Plains humans, forest elves, mountain dwarves, desert orcs; jungle belongs to nobody.',
             'How much the multipliers vary: cavalry ×0.70–0.75 in jungle and forest, dwarves ×1.10–1.15 in mountains, flyers ×0.75 under trees.',
             'Front width by terrain (R-089): mountains squeeze a battle to 2–4 units a side.',
             'Sea: a separate world with its own tax, lairs, guardians and penalties.'],
            ['Engine: TERRAIN_MODS, KC_BASIC_EXPLORE, SIGNATURE_TERRAIN_P, battle/lines.js (front width), SEA_LAND_PENALTY, illusoryTerrainMult.',
             'Rulebook: The World & Provinces, Movement & Marching, The battle lines. Rulings R-081, R-089, R-100.'])

    d.add(H1('The six terrains'))
    rows = [
        ['Plains', '35', '6–8', 'Human', 'Yes (Tactical + 1 riders)', 'Humans ×1.10 line foot and longbows; horse ×1.15; Titans, Unicorns, Mammoths ×1.10', 'Dwarven Guard ×0.9, Mountain Guns ×0.85, Giants/Ents/Basilisks ×0.9', 'Ride Them Down (+6%/Free Lances to enemy losses)'],
        ['Desert', '25', '6–8', 'Orcish', 'Yes', 'Horse ×1.15, Wargs ×1.10, Berserkers ×1.05, Basilisks and Titans ×1.10', 'Elven Bowmen ×0.8, Ents ×0.75, Bears ×0.8, Hydras and Mammoths ×0.85', 'Ride Them Down'],
        ['Forest', '20', '4–6', 'Elven', 'No (Stag Riders and Unicorns still take a flank)', 'Elven units ×1.10–1.15 (and an Elven realm\'s own ×1.5); Ents ×1.15; Trolls, Bears, Unicorns, Berserkers ×1.10', 'Horse ×0.75, flyers ×0.75, Mammoths and Guns ×0.80, Titans ×0.8', 'Forest Wardens\' Ambush (no enemy archery phase); Druidic Creatures ×1.5; Pagan Standing Stones +25% defending'],
        ['Jungle', '15', '4–6', 'none', 'No (Stag Riders and Unicorns)', 'Elves ×1.10, Ents ×1.15, Basilisks and Hydras ×1.10', 'Horse ×0.70, flyers ×0.75, Guns and Titans and Mammoths ×0.75, line foot ×0.85', 'As forest'],
        ['Mountain', '20', '2–4', 'Dwarven', 'No (Ironhoof Rams take a flank)', 'Dwarven Guard, Crossbows, Guns ×1.10, Dwarf Garrison ×1.15, Stone Giants and Trolls ×1.15, Bears ×1.10', 'Horse ×0.75, Wargs ×0.8, Stag Riders and Unicorns ×0.85, Titans ×0.8', 'Pagan Standing Stones +25% defending'],
        ['Sea', '25', '8–10 (no flanks)', 'none (wild sea-beasts and open water)', 'No', 'Fleets and sea-beasts ×1 everywhere; Kraken ×1.35 at sea; Shark Shoals swarm', 'Every land unit ×0.75 (Elven Galleys lift their archers); air-carried troops ×0.25, their carriers ×0.5', 'Only fleets, carried troops, flyers or Part Sea may enter. Tax 1 open water, 2–3 whale and shark waters, 4–6 the sea-monsters\' waters. Lairs and guardians of its own.'],
    ]
    d.add(table(['Terrain', 'Explore base (points per Explore at Explorer 0)', 'Battle front width', 'Signature race', 'Cavalry flanks', 'Who thrives', 'Who suffers', 'Other rules'], rows, [0.07, 0.07, 0.06, 0.07, 0.1, 0.22, 0.2, 0.21]))

    d.add(H1('Unit strength multipliers by terrain (the engine\'s table in full)'))
    d.add(P('Fleets and sea-beasts read ×1 everywhere. Flyers read ×1 except ×0.75 in forest and jungle. A unit not listed in a terrain reads ×1.'))
    units = [u for u in BASE if not u.endswith('Elemental') and u != 'Corsair Fleet']
    units.sort(key=lambda u: (['Human', 'Elven', 'Dwarven', 'Orcish', 'Creature', 'Monster'].index(RACE_OF_UNIT.get(u, 'Monster')) if RACE_OF_UNIT.get(u) in ['Human', 'Elven', 'Dwarven', 'Orcish', 'Creature', 'Monster'] else 9, u))
    rows = []
    for u in units:
        if u in UCLASS['sea']:
            vals = ['×1 (naval)'] * 5
        else:
            vals = [fmt_mult(TERRAIN[t].get(u, 1.0)) for t in LAND]
        worst = min(TERRAIN[t].get(u, 1.0) for t in LAND) if u not in UCLASS['sea'] else 1.0
        rows.append([u, RACE_OF_UNIT.get(u, '?'), UTYPE.get(u, '?')] + vals + ['×0.75' if u in UCLASS['sea'] or u in UCLASS['aerial'] else '×0.75 (sea penalty)', fmt_mult(min(0.85, worst)) if u not in UCLASS['sea'] else '—'])
    d.add(table(['Unit', 'Family', 'Type', 'Plains', 'Desert', 'Forest', 'Jungle', 'Mountain', 'At sea', 'Under Illusory Terrain'], rows, [0.16, 0.08, 0.07, 0.08, 0.08, 0.08, 0.08, 0.08, 0.13, 0.16], font=7))
    d.add(note('At sea: every land unit that does not fly fights at ×0.75 (the sea penalty, applied on top of this table). Illusory Terrain: a non-caster force fights as if in the worst land terrain for each unit, always at least ×0.85.'))

    d.add(H1('Terrain and the wider rules'))
    d.add(kv_table([
        ('Exploration', 'Each Explore charts (base) × (Explorer level + 1) points, Explorer counted to 5. A plains province goes 35 to 100% in three orders at Explorer 0.'),
        ('Front width', 'Rolled per battle, same for both sides: plains and desert 6–8, forest and jungle 4–6, mountain 2–4, sea 8–10. The side that knows the ground better may take the roll or one wider or narrower. Behind the front: second line ×0.5 (ranged over a fighter ×1), reserve ×0.25, beyond ×0.125.'),
        ('Flanks', 'Tactical + 1 cavalry ride the flanks on plains and desert only. Stag Riders and Unicorns take a flank in forest and jungle; Ironhoof Rams in the mountains.'),
        ('Movement', 'Every land step costs 1 point whatever the terrain; sea steps cost a sea point. Terrain never slows a march; unit speed does.'),
        ('Race placement', 'Each race is about six times as likely to be placed in its signature terrain; about two thirds of a terrain\'s provinces carry its race. Jungle has no signature race.'),
        ('Wild country', 'Creature and Monster provinces hold one beast type each and a ritual site; Creatures tend to forest, mountain and plain, Monsters to mountain, desert and jungle, by their terrain tables.'),
        ('World shape', '40% sea in coherent coasts and inland seas; the land shared equally between the four races, with a portion of wild country. Map size by realm count: 2 realms 8×5 to 9–10 realms 16×11.'),
        ('Homeward Flight', 'Elven units of an Elven realm escape death at 30% in desert or mountain, 45% on plains, 60% in forest or jungle.'),
        ('Standing Stones', 'The Pagan Wonder: armies fight +25% defending forest, jungle or mountain.'),
    ]))

    d.add(H1('Lair site names by terrain (the older terrain-named pools)'))
    fp = DATA['FEATURE_POOLS_P']
    d.add(table(['Terrain', 'Site names'], [[TNAME.get(t, t), ', '.join(v)] for t, v in fp.items()], [0.12, 0.88]))
    d.add(note('World generation now names a lair from its guardian\'s category pool (see the Lairs sheet). These terrain pools are still read by generate.js in two places; check whether they are still wanted.'))

    d.add(gaps([
        'Jungle has no signature race and is the harshest terrain for almost everyone (cavalry ×0.70, line foot ×0.85, guns ×0.75); only elves, ents, basilisks and hydras like it. Is it meant to be the empty quarter?',
        'Mountain fronts are 2–4 units wide, so a mountain battle is decided by the two to four strongest units a side; numbers barely count. That rewards elite dwarves and giants heavily. Confirm it is wanted.',
        'Elven units carry both a per-unit forest bonus (×1.10–1.15) and the realm-wide Woodland Mastery ×1.5, so an Elven realm\'s bowmen in a forest fight at about ×1.7 before kinship; with a king of their own blood about ×2.5 (before Tactical). Check against the dwarves\' ×1.5 defending plus ×1.1–1.15 in the mountains.',
        'Desert is the orcs\' home but their units get only ×1.05–1.10 there; the human horse gets ×1.15 in the desert too. The orcish home-ground edge is small.',
        'The sea penalty ×0.75 applies to every non-flying land unit, and nothing removes it for infantry (Naval 8 aside). Landings are therefore mostly a fleet-strength fight.',
        'Sea tax (1 for open water) is the one place a province pays less than 2 (R-015 open question).',
        'Terrain does not change movement cost (R-081), only exploration and battle; the rulebook never says a mountain march costs the same as a plains march. A line would help.',
        'Two sets of lair names exist: the guardian-category pools (used for naming) and the older terrain pools (still referenced by generate.js). One set should go or their roles be stated.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 10. LAIRS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_lairs():
    d = RefDoc(os.path.join(OUT, '10-lairs.pdf'), 'Lairs', 'Lair grades, hoards, where they are placed, how they are named, ritual sites and what each grade yields', STAMP)
    d.cover('Lairs are guarded treasure sites on land and sea. Every lair has one guardian of a grade (Weak, Moderate, Powerful, '
            'Legendary), a fixed hoard of gold and exactly one magic item of that grade. Clearing them is the main source of '
            'hero hit points and items. Ritual sites are lairs with no guardian, used by Pagan rites.',
            ['The reward ladder per grade: gold, item tier, HP band of the guardian, rumour price, steal penalty.',
             'Placement: 60/30/10 near home, Legendary lairs as far apart as the map allows, always 22 of them.',
             'What each item tier holds by role (R-051): Weak lairs never hold combat kit.',
             'Naming: category pools on land and sea, plus signature names for the great Legendary powers.'],
            ['Data file: LAIR_POOLS_CAT_P, LAIR_POOLS_MONSTER_P, KC_RUMOUR_COST_BY_POWER. Engine: ENCOUNTER_CLEAR_GOLD_BANDS, LAIR_ITEM_ODDS, ITEM_TIER_TARGET, STEAL_TIER_PEN, GUARDIAN_MELEE_BASE, RITUAL_SITE_NAMES, LAIR_EFFECT_SPREAD, world/generate.js.',
             'Rulebook: Lairs, Monsters & Treasure; Hunting Rumours; Ritual sites. Rulings R-001, R-008, R-011, R-051, R-052, R-072, R-108.'])

    gold = DATA['ENCOUNTER_CLEAR_GOLD_BANDS']
    mons = DATA['MONSTERS_P']
    d.add(H1('The four grades'))
    hpb = {'Weak': '11–17', 'Moderate': '19–25', 'Powerful': '32–42', 'Legendary': '53–65'}
    bench = {'Weak': '15 HP, no items, Melee 3 / Archery 2 (five points): a starting hero after a little training',
             'Moderate': '~30 HP, no fighting items, Melee 5–6 and a school at 3–4: after six to eight Weak lairs',
             'Powerful': '~45 HP, a full set of Moderate items, Melee 7 and a school at 5–6: after six to eight Moderate lairs',
             'Legendary': '~60 HP, a full set of Powerful items, Melee 9 and a school at 7–8: after about six Powerful lairs'}
    win = {'Weak': 'about 19 in 20', 'Moderate': 'about half (nine in ten for a Powerful-row hero)', 'Powerful': 'about one in five (four in five for a Legendary-row hero)', 'Legendary': 'about one in three'}
    rows = []
    for g in ['Weak', 'Moderate', 'Powerful', 'Legendary']:
        cnt = sum(1 for m in mons if m['power'] == g)
        rows.append([g, '%d–%d' % tuple(gold[g]), 'Tier %d (%s)' % (DATA['LAIR_ITEM_ODDS'] and {'Weak': 1, 'Moderate': 2, 'Powerful': 3, 'Legendary': 4}[g], {'Weak': 'field and office kit, nothing that helps in a fight', 'Moderate': 'first rung of arms, armour, potions, school +1', 'Powerful': 'second rung: +3 weapons, +2 rings, crowns, wards', 'Legendary': 'one of the 22 relics'}[g]),
                     hpb[g], '%d–%d + Melee' % tuple(DATA['GUARDIAN_MELEE_BASE'][g]), str({'Weak': 1, 'Moderate': 2, 'Powerful': 3, 'Legendary': 4}[g]), '%dg' % DATA['KC_RUMOUR_COST_BY_POWER'][g], '−%d%%' % DATA['STEAL_TIER_PEN'][g], str(cnt), bench[g], win[g]])
    d.add(table(['Grade', 'Gold', 'Item', 'Guardian HP', 'Guardian blow', 'Perks', 'Rumours', 'Steal penalty', 'Guardian kinds', 'The hero it is cut for', 'That hero wins'], rows,
                [0.07, 0.05, 0.14, 0.06, 0.07, 0.04, 0.05, 0.05, 0.05, 0.27, 0.15]))

    d.add(H1('Rules'))
    d.add(kv_table([
        ('One item, always', 'Every lair holds exactly one magic item, of the guardian\'s own grade, decided when the world is made. A hoard is never empty; once the treasury of a tier is spent a Weak lair takes any utility item of any tier, and combat kit only when nothing else is left.'),
        ('Fixed hoard', 'Gold and item are fixed at generation. Hunting Rumours reports them exactly, and whether a thief has been through. A slain challenger\'s kit joins the hoard.'),
        ('Near home', 'In and around the home provinces about 60% Weak, 30% Moderate, 10% Powerful (R-001). Every home province holds a Weak lair and never a Legendary one. Further out, fewer Weak and more Moderate and Powerful; the deep wilds are almost all dangerous.'),
        ('Legendary', 'Always 22 Legendary lairs in a world, so always the 22 relics, set as far apart as the map allows. A relic can never be stolen from a lair; only the guardian\'s defeat yields it.'),
        ('Effects spread', 'Lairs within 3 provinces of each other never hold the same item effect while the treasury has another choice (R-052).'),
        ('Unique per province', 'No province holds two lairs of the same base name, nor two of the same guardian (R-108).'),
        ('Who wields the hoard', 'Humanoids, the intelligent undead, giants and fiends use the hoard\'s weapons and potions against you; fey and dragons wear only its trinkets; beasts, vermin, constructs, elementals and aberrations use nothing (R-011).'),
        ('Thieves', 'The Steal tactic lifts 10% of the original gold per Thief level (to 5) and one item at 30% + 10%/level (cap 80%), less the grade penalty above; never a relic.'),
        ('Hunting Rumours', 'Pay the grade\'s price per lair to learn the guardian\'s weakness (kept for that kind of creature for the rest of the game), the exact hoard, and your own odds in five bands (the world fights the lair many times in the background).'),
        ('Sea lairs', 'Found at sea as on land; the sea-themed guardians are listed on the Guardians sheet. A strong navy opens them.'),
        ('Kinds of creature', 'Humanoid, undead, beast, vermin, giant, dragon, fiend, fey, aberration, elemental, construct. The kind decides Holy Symbol (×1.5 on undead and fiends), hoard use, and whether a Druid reads the animal (beasts and vermin only).'),
    ]))

    d.add(H1('Item stock per tier, by kind and role (ITEM_TIER_TARGET: utility / combat)'))
    tt = DATA['ITEM_TIER_TARGET']
    kinds = ['trinket', 'ring', 'amulet', 'cloak', 'helm', 'weapon', 'armour', 'shield', 'combat']
    rows = []
    for t, name in [('1', 'Weak'), ('2', 'Moderate'), ('3', 'Powerful')]:
        rows.append([name] + ['%d / %d' % tuple(tt[t][k]) for k in kinds] + [str(sum(sum(tt[t][k]) for k in kinds))])
    rows.append(['Legendary'] + ['—'] * 9 + ['22 named relics'])
    d.add(table(['Tier'] + [k.title() for k in kinds] + ['Total'], rows, [0.1] + [0.085] * 9 + [0.135]))
    d.add(note('Each tier is sized so the largest map does not run short (a ten-realm map seats about 240 Weak lairs). Within a tier every kind is dealt evenly, region by region, and a find made in play is drawn from whichever kind that realm has seen least of.'))

    d.add(H1('Ritual sites'))
    d.add(kv_table([
        ('Names', ', '.join(DATA['RITUAL_SITE_NAMES'])),
        ('Where', 'Every wild (Creature or Monster) land province holds one (both rites possible); about a quarter of humanoid land provinces hold one (Blood Offering only). Placed only when a Pagan realm is in the game; a Pagan home always borders a wild forest or jungle province with one.'),
        ('Rules', 'No guardian, never cleared, discovered by exploration like any lair. One rite per province per turn, by anyone (R-008). Only Pagan realms can use them.'),
    ]))

    d.add(H1('Lair names by guardian category'))
    cat = DATA['LAIR_POOLS_CAT_P']
    rows = [[c.title(), ', '.join(v['land']), ', '.join(v['sea'])] for c, v in cat.items()]
    d.add(table(['Category', 'Land names', 'Sea names'], rows, [0.1, 0.55, 0.35]))
    d.add(H1('Signature lairs of the great Legendary powers'))
    mp = DATA['LAIR_POOLS_MONSTER_P']
    d.add(table(['Guardian', 'Its lair names'], [[k, ', '.join(v)] for k, v in mp.items()], [0.2, 0.8]))
    d.add(note('A name is never repeated in the world; when a pool runs dry the lair takes a place-qualified form ("Wolf Den beneath Karnholt").'))

    d.add(gaps([
        'Legendary gold (40–60) is about four times Moderate (12–18) for a fight the benchmark hero wins one time in three; the relic and the HP roll are the real prize. Say whether gold should matter more at the top.',
        'Moderate lairs are the hard step: the benchmark hero wins about half, where Weak is 19 in 20 and Powerful one in five. The ladder is not even.',
        'Guardian kinds per grade: Weak %d, Moderate %d, Powerful %d, Legendary %d. Ten Legendary guardians for 22 Legendary lairs means each kind appears about twice per world.' % tuple(sum(1 for m in mons if m['power'] == g) for g in ['Weak', 'Moderate', 'Powerful', 'Legendary']),
        'Steal penalties (\u221215/30/45 by grade) give a Thief 3 hero 80% against a Weak hoard but 35% against a Legendary one; a Thief 5 Cowardly hero with Invisibility still reaches 85% there. Say whether a relic-guarding lair should be that open to a master thief\'s gold.',
        'Two lair-naming systems remain (see the Terrain sheet). The terrain-named sites include guardians such as "Sand Drake" and "Sphinx" that match no guardian in MONSTERS_P.',
        'R-001 is confirmed but has no test; the 60/30/10 split is the kind of thing a seeded test can hold.',
        'The sea guardians are a fixed set of names; a sea lair never holds a land guardian. Check the sea has every grade well represented (see the Guardians sheet).',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 11. GUARDIANS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_guardians():
    d = RefDoc(os.path.join(OUT, '11-guardians.pdf'), 'Guardians', 'The %d lair guardians: statistics, specials, perks and weaknesses, grade by grade' % len(DATA['MONSTERS_P']), STAMP)
    mons = DATA['MONSTERS_P']
    sea = set(DATA['SEA_GUARDIAN_NAMES'])
    d.cover('Every lair is held by one guardian from this bestiary. A guardian has hit points, a Melee and Archery skill, a '
            'speed, one or more specials (an action in its plan, resolved like a spell with a cast chance), one perk per step of '
            'its grade, and exactly one weakness. Guardians fight with the "None" temper: no perks, never flee.',
            ['Within a grade, are the guardians of similar difficulty? HP, blow, special weight and perks all vary.',
             'Every guardian is weak to one thing (a school, archery, a race or a creed) and never resists it (R-079). All undead are weak to White.',
             'Which schools are warded most often (school wards are the commonest perk).',
             'Sea guardians are marked; check each grade has enough of them.'],
            ['Data file: MONSTERS_P (regenerated by tools/guardian_rework.js, table version 20). Engine: GUARDIAN_MELEE_BASE, GUARDIAN_BODY_CAP_PCT, PC_HIT_CAP_FRAC, SEA_GUARDIAN_NAMES, personal-combat/*.',
             'Rulebook: How strong a hero does a lair need; Every guardian has a weakness; Guardian perks by grade. Rulings R-011, R-072, R-077, R-079, R-080.'])

    d.add(H1('How a guardian fights'))
    d.add(kv_table([
        ('Blow', 'Base by grade (Weak 1–3, Moderate 2–5, Powerful 3–7, Legendary 4–9) + 1 per level of its Melee. A special does that blow × its weight.'),
        ('Specials', 'One action a round like a hero. A special fires at its cast chance (50–95%); on a failure it attacks instead. Its school decides which wards and weaknesses apply.'),
        ('Perks', 'One per step of grade (Weak 1, Moderate 2, Powerful 3, Legendary 4), each valued by its grade. Many are school wards (−20/30/40/50% off that school\'s cast chance). Never warded against the school it is weak to.'),
        ('Weakness', 'Fixed per kind of creature: a school (cast at 95%, damage and effects doubled), Archery (double arrow damage), a race or a creed (double damage from everything). Learned by Hunting Rumours or by using it once; then marked for every creature of that kind.'),
        ('Hit cap', 'No single hit takes more than half a fighter\'s max HP (R-080); every Legendary guardian also carries a 20% cap of its own (some declare a tighter one).'),
        ('Half rule', 'No landed attack is reduced below half of its unreduced damage by any stack of wards.'),
        ('Range', 'A fast guardian advances two steps a round, a slow one one; a guardian with a bow never backs out of melee to shoot.'),
        ('Druid', 'From Druid 3 a natural beast\'s or vermin\'s blows land at half force against the hero.'),
    ]))

    def fx_text(p):
        return p['desc']

    for g in ['Weak', 'Moderate', 'Powerful', 'Legendary']:
        d.add(H1('%s guardians (%d)' % (g, sum(1 for m in mons if m['power'] == g))))
        rows = []
        for m in sorted([m for m in mons if m['power'] == g], key=lambda m: (m['cat'], -m['hp'])):
            specials = '; '.join('%s (%s, ×%s, %d%%%s)' % (s['name'], LABEL.get(s['school'], s['school']).replace(' Magic', ''), s['dmgW'], s['castChance'], (': ' + s['effect']) if s.get('effect') else '') for s in m['spells'])
            perks = '; '.join('%s: %s' % (p['name'], fx_text(p)) for p in m['passives'])
            w = m['weak']
            rows.append([m['name'] + (' (sea)' if m['name'] in sea else ''), m['cat'], str(m['hp']), str(m['melee']), str(m['archery']), m['speed'], '%d–%d' % (m['minG'], m['maxG']), specials, perks, '%s: %s' % (w['name'], w['desc'])])
        d.add(table(['Guardian', 'Kind', 'HP', 'Melee', 'Archery', 'Speed', 'Gold field', 'Specials (school, weight, chance: effect)', 'Perks', 'Weakness'], rows,
                    [0.1, 0.05, 0.03, 0.045, 0.05, 0.05, 0.045, 0.21, 0.23, 0.19], font=6.4))

    d.add(H1('Summary'))
    cats = sorted({m['cat'] for m in mons})
    rows = []
    for c in cats:
        ms = [m for m in mons if m['cat'] == c]
        byg = Counter(m['power'] for m in ms)
        weak = Counter(m['weak']['name'] for m in ms)
        rows.append([c.title(), str(len(ms)), ' / '.join(str(byg[g]) for g in ['Weak', 'Moderate', 'Powerful', 'Legendary']), str(sum(1 for m in ms if m['name'] in sea)), ', '.join('%s (%d)' % (k, v) for k, v in weak.most_common())])
    d.add(table(['Kind', 'Guardians', 'Weak / Moderate / Powerful / Legendary', 'At sea', 'Weaknesses'], rows, [0.1, 0.07, 0.17, 0.06, 0.6]))
    wards = Counter(p['fx']['school'] for m in mons for p in m['passives'] if p['fx'].get('ward') == 'schoolWard')
    weakschool = Counter(m['weak']['key'] for m in mons if m['weak']['kind'] == 'school')
    rows = [[LABEL[s], str(wards.get(s, 0)), str(weakschool.get(s, 0))] for s in DATA['KC_MAGIC_SCHOOLS']]
    d.add(table(['School', 'Guardians warded against it', 'Guardians weak to it'], rows, [0.3, 0.35, 0.35]))
    speed = Counter(m['speed'] for m in mons)
    d.add(P('Speed: fast %d, medium %d, slow %d. Weaknesses by kind: school %d, archery %d, race %d, creed %d.' % (speed['fast'], speed['medium'], speed['slow'],
            sum(1 for m in mons if m['weak']['kind'] == 'school'), sum(1 for m in mons if m['weak']['kind'] == 'archery'), sum(1 for m in mons if m['weak']['kind'] == 'race'), sum(1 for m in mons if m['weak']['kind'] == 'align'))))

    d.add(gaps([
        'The "gold field" (minG–maxG) on each guardian is what world generation writes as the lair\'s first treasure, but the hoard is then set from the grade\'s gold band (5–8 / 12–18 / 20–30 / 40–60). The per-guardian figures look like a legacy field; confirm which is live.',
        'Only ten Legendary guardians exist for the 22 Legendary lairs in every world, so each appears about twice; the sea has its own fixed set. Check the sea\'s share at each grade (table above).',
        'Illusory is weak-to for giants and warded by several others; Psychic is the dragons\' weakness. Count wards against weaknesses per school in the table above and see whether any school is a poor lair-fighting choice overall.',
        'HP bands (R-072) are confirmed but no test holds them. The guardian table is regenerated by a tool; any hand edit is lost on the next regeneration.',
        'Specials fire at 50–95%; a Weak guardian with a 90% special (Dire Rat) and a Legendary one at 83% differ little in reliability. The grade shows in the weight and blow, not the chance.',
        'The Hunting Rumours odds come from fighting the lair in the background; the "that hero wins" column on the Lairs sheet is the benchmark the rulebook quotes. Any rebalancing should rerun the benchmark harness.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 12. MAGIC ITEMS
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def item_kind(it):
    e = it.get('effect', {})
    st = e.get('stat', '')
    if st == 'combatUse':
        return 'combat (%s)' % e.get('use', '')
    if st == 'castSpell':
        return 'spell item (%s)' % e.get('spell', '')
    if st == 'temper':
        return 'temper'
    if st in SKILLS:
        return '%s +%d' % (LABEL[st], e.get('bonus', 0))
    nice = {'pc': 'personal combat', 'armour': 'armour ward', 'maxHp': 'Max HP', 'taxBonus': 'tax gold', 'taxPerProv': 'gold per province',
            'armyBonus': 'armies led', 'homeDefBonus': 'home defence', 'siegeBonus': 'siege', 'cavBonus': 'cavalry led', 'infBonus': 'infantry led',
            'undeadBonus': 'v undead', 'infStay': 'infantry hold', 'archerStr': 'archers led', 'heavyBonus': 'heavy units led', 'oracle': 'oracle',
            'primalStrike': 'beast strikes', 'cavPursuit': 'pursuit', 'archBonus': 'archers led', 'navalBonus': 'fleets led', 'navalMove': 'sea movement',
            'necroAuto': 'auto-cast', 'massPromote': 'promotion', 'hidden': 'hidden', 'aura': 'aura'}
    lab = nice.get(st, st)
    if e.get('bonus'):
        lab += ' +%s' % e['bonus']
    return lab


def build_items():
    items = ITEMS_LIVE
    leg = LEG
    designs = [i for i in items if not i.get('_variantOf')]
    d = RefDoc(os.path.join(OUT, '12-magic-items.pdf'), 'Magic items', 'The live treasury: %d item designs as %d named items in play, the slot rules, spell items, temper items and the 22 Legendary relics' % (len(ITEM_GROUPS), len(items)), STAMP)
    d.cover('Items are won from lairs, looted and stolen. They come in four tiers named for the guardians that keep them. The '
            'data file holds the designs; when the engine loads it sorts them into tiers by role and score (a combat item is '
            'never Weak), gives many a second name, and mints further named copies of a design until every tier and kind holds '
            'its quota (%d names in play from %d distinct effects). Every name is unique in the world; the same effect can exist '
            'under two or three names. Slot items give their power only when equipped; everything else is always active.'
            % (len(items), len(ITEM_GROUPS)),
            ['Is each tier\'s kit a clear step up (+1 and +2 weapons at Moderate, +3 at Powerful, +4 relics)?',
             'The spread of kinds per tier (counts below) and which effects dominate.',
             'The score column: the engine\'s 0\u201310 estimate of an item\'s worth, which decides its tier (Powerful takes nothing under 4.5, Moderate nothing under 2).',
             'Race- and alignment-only items: who gets what.',
             'Whether the 22 relics are each "a thing no other item can do".'],
            ['Data file: ALL_MAGIC_ITEMS_P (the designs), LEGENDARY_ITEMS_P, _ITEM_NAME_ALTS, _VARIANT_BANK, KC_ITEM_SLOT_CAP, KC_ITEM_UNCAPPED_SKILLS. Engine: items/equipment.js (roles, scores, tier targets, minting), items/tiers-and-hoards.js. The lists here are read after the engine has loaded, so they are what a game stocks.',
             'Rulebook: Magic items. Rulings R-011, R-049, R-050, R-051, R-052.'])

    d.add(H1('Rules'))
    d.add(kv_table([
        ('Slots', 'One each of weapon, armour, shield, cloak, helm, amulet; two rings; two combat items. Only equipped slot items give their power. A character auto-equips the first item held per slot; Equip Items chooses.'),
        ('Always active', 'Items with no slot (horns, banners, ledgers, tomes, trinkets) work from the pack.'),
        ('Combat items', 'Potions, scrolls and devices: equipped in a combat slot, used once per fight when the moment calls (a potion when hurt, holy water against undead), never consumed; each use takes the round\'s action. One name each, never minted.'),
        ('Skill items', 'Count past a trained 5, to 9, only for Melee, Archery and the five schools (schools: cast chance only). Druid counts every level. Every other skill stops at an effective 5.'),
        ('Spell items', 'Use Item casts the named action spell at a flat 95%, no skill, no casting slot, as at least a level-3 cast. Two names per core action spell; none for mastery spells.'),
        ('Tiers by role', 'Weak lairs hold only utility kit (nothing that helps in a fight); Moderate the first rung of combat kit; Powerful the second; Legendary the relics (R-051). The engine scores every design and places it; a short band is topped up by minting named copies of the designs already in it.'),
        ('Tax items', 'All bonus tax gold together is capped at 5% of the realm\'s base tax (R-050).'),
        ('Relics', 'Each Legendary relic held at the Reckoning is worth 1 point. Never stolen from a lair; can be stolen from a carrier.'),
        ('Charmed heroes', 'A charmed hero handles no items (R-049). Cowardly mercy hands the victor one random item.'),
        ('Mithril', 'A Dwarven realm\'s dwarves are born with it; never found, never scored, never traded.'),
    ]))

    d.add(H1('Counts by tier and kind (names in play / distinct effects)'))
    rows = []
    for t, name in [(1, 'Weak'), (2, 'Moderate'), (3, 'Powerful')]:
        c = Counter(kind_of(i) for i in items if i['tier'] == t)
        g = Counter(kind_of(i) for i in ITEM_GROUPS if i['tier'] == t)
        rows.append([name] + ['%d / %d' % (c[k], g[k]) for k in ITEM_KINDS] + ['%d / %d' % (sum(c.values()), sum(g.values()))])
    c = Counter(kind_of(i) for i in leg)
    rows.append(['Legendary'] + ['%d' % c[k] for k in ITEM_KINDS] + [str(sum(c.values()))])
    d.add(table(['Tier'] + [k.title() for k in ITEM_KINDS] + ['Total'], rows, [0.1] + [0.085] * 9 + [0.135]))
    c = Counter(item_kind(i).split(' (')[0].split(' +')[0] for i in ITEM_GROUPS)
    d.add(P('Distinct effects across the three tiers: ' + ', '.join('%s %d' % (k, v) for k, v in c.most_common()) + '.'))

    cols = ['Names in play', 'Kind', 'Gate', 'Effect', 'Score', 'What it does']
    widths = [0.2, 0.07, 0.07, 0.13, 0.04, 0.49]
    for t, name, what in [(1, 'Weak', 'field and office kit: nothing that helps in a fight'), (2, 'Moderate', 'first rung of arms, armour, potions and school buffs'), (3, 'Powerful', 'second rung: +3 weapons, +2 rings, crowns, wards, big potions')]:
        d.add(H1('Tier %d: %s items (%s)' % (t, name, what)))
        its = sorted([i for i in ITEM_GROUPS if i['tier'] == t], key=lambda i: (ITEM_KINDS.index(kind_of(i)), -float(i.get('_score') or 0), i['name']))
        d.add(table(cols, [[i['name'], kind_of(i), item_gate(i), item_kind(i), str(i.get('_score', '')), i['desc']] for i in its], widths, font=6.8))
    d.add(H1('Tier 4: the 22 Legendary relics'))
    d.add(table(['Relic', 'Kind', 'Score', 'What it does', 'Lore'], [[i['name'], kind_of(i), str(i.get('_score', '')), i['desc'], i['lore']] for i in leg], [0.15, 0.07, 0.04, 0.34, 0.4], font=6.8))

    d.add(H1('Spell items (two names per core action spell)'))
    sp = {}
    for i in ITEM_GROUPS + LEG_GROUPS:
        e = i.get('effect', {})
        if e.get('stat') == 'castSpell':
            sp.setdefault(e['spell'], []).extend('%s (tier %d)' % (n, i['tier']) for n in i['names'])
    S = DATA['SPELL_DEFS_P']
    rows = [[s, LABEL[S[s]['school']] if s in S else '?', ', '.join(v)] for s, v in sorted(sp.items(), key=lambda kv: (DATA['KC_MAGIC_SCHOOLS'].index(S[kv[0]]['school']) if kv[0] in S else 9, kv[0]))]
    d.add(table(['Spell', 'School', 'Items'], rows, [0.15, 0.12, 0.73]))

    weak_n = sum(1 for i in items if i['tier'] == 1)
    mod_n = sum(1 for i in items if i['tier'] == 2)
    pow_n = sum(1 for i in items if i['tier'] == 3)
    d.add(gaps([
        'The data file\'s own "tier" field is not the live tier: the engine re-sorts every design by role and score at load (%d Weak, %d Moderate, %d Powerful names in play, against the tier targets 288 / 293 / 108). Anyone editing an item should check where the scorer puts it, not where the file lists it.' % (weak_n, mod_n, pow_n),
        'Minted copies: %d names in play are minted variants of a design (marked _variantOf) and %d more are second names from the alternates bank, so a hero can find the same effect under two or three names in one game. "Every item is unique" holds by name; R-052 only keeps the same effect out of lairs within three provinces.' % (len(items) - len(designs), len(designs) - len({i['desc'] for i in designs}) if False else len(designs) - len(ITEM_GROUPS)),
        'Weak lairs hold the first six to eight finds of a hero, all field kit by design (R-051). Playtesters should say whether the first fighting item arrives soon enough.',
        'Trinkets and other no-slot items are %d of the %d distinct effects; nothing limits how many always-active items a hero stacks except the 5%% tax cap.' % (sum(1 for i in ITEM_GROUPS if kind_of(i) == 'trinket'), len(ITEM_GROUPS)),
        'Combat items (%d, one name each): used automatically "when the moment calls". Two combat slots is the only limit, so a hero with many potions must choose which two.' % sum(1 for i in ITEM_GROUPS if kind_of(i) == 'combat'),
        'Race-only items: %s. Alignment-only items: %s. Uneven, and most are Weak-tier.' % (
            ', '.join('%s %d' % (r, n) for r, n in Counter(i['race'] for i in ITEM_GROUPS + LEG_GROUPS if i.get('race')).most_common()),
            ', '.join('%s %d' % (a, n) for a, n in Counter(i['alignment'] for i in ITEM_GROUPS + LEG_GROUPS if i.get('alignment')).most_common())),
        'Spell items exist for most action spells; see the Spells sheet summary for the action spells with none.',
        'Six relics are marked _unscorable (placed by hand). Any new item should be scored (equipment.js) before it is added, to see which tier it lands in.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 13. SAGE DISCOVERIES
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_discoveries():
    disc = DATA['SAGE_DISCOVERIES_P']
    d = RefDoc(os.path.join(OUT, '13-sage-discoveries.pdf'), 'Sage discoveries', 'All %d discoveries by field, with the Heritage and Creed fields each realm can research' % len(disc), STAMP)
    cats = []
    for x in disc:
        if x['category'] not in cats:
            cats.append(x['category'])
    d.cover('Research (Sage 1+) is the only way to make a discovery: a permanent, realm-wide upgrade. There are %d, every '
            'effect unique, each tuned to be worth about 1.5 gold a turn to an engaged player (R-026). The open fields are '
            'Military, Economy, Espionage, Scholarship, Heroic and Special; each race has a Heritage field and each creed a '
            'Creed field only it can research.' % len(disc),
            ['Are the fields of comparable size and worth? Military 20, Economy 16, Scholarship 16, Espionage 10, Heroic 10, Special 4, and 20 in every Heritage and Creed field.',
             'Whether any discovery still refers to a rule that has since changed (Deep Roots, R-104).',
             'The R-026 open question: most income discoveries pay +1g a turn; is that the feel wanted?',
             'A realm can research 20 Heritage + 20 Creed + 76 open = 116 discoveries at most.'],
            ['Data file: SAGE_DISCOVERIES_P (ids sd30 and sd34 retired, never reused; descriptions generated from the effect rows). Engine: discoveries.js, research-and-practice-orders.',
             'Rulebook: Sage discoveries; the Sage skill; Research order. Rulings R-012, R-026, R-037, R-059.'])

    d.add(H1('How research works'))
    d.add(kv_table([
        ('Chance', '5% per Sage level counted to 5 (25% at Sage 5); Neutral realms 10% a level; the Loreseeker minor title +5%; the Grand Library Wonder guarantees one a turn; Sage 7 Research Breakthrough guarantees one.'),
        ('Choice of two', 'A success brings two discoveries from the chosen field; keep one with your next orders, the other is lost to your realm for good (unchosen, one is kept at random). The kept one works from the next turn (R-012).'),
        ('Fields', 'Choose a field with the order; an exhausted field cannot be chosen; if another scholar empties it earlier the same turn the Research turns to a random other field (R-037).'),
        ('Unlooked-for find', 'Rolled first, a long shot not raised by Sage, from a field you cannot ask for; it replaces the ordinary find that season.'),
        ('Perseverance', 'Every failed Research ×1.2 on the character\'s next this turn.'),
        ('Spies', 'Spying a rival\'s capital can copy one of their discoveries at 10% + 10% per Spy level (never a Heritage or Creed their realm could not use). The Loremaster copies one free each turn.'),
        ('Mastery', 'Sage 6: +5 gold per discovery made. Sage 8: each discovery raises the tax base of the province the scholar stands in by +1 (max 10) (R-059).'),
        ('Experience', 'A discovery is Sage experience; a fruitless season or using an item a small chance.'),
    ]))

    for c in cats:
        xs = [x for x in disc if x['category'] == c]
        d.add(H1('%s (%d)' % (c, len(xs))))
        rows = []
        for x in xs:
            e = x['effect']
            kinds = (e.get('kind') or e.get('type', '')) + (' + ' + (x['effect2'].get('kind') or x['effect2'].get('type', '')) if x.get('effect2') else '')
            rows.append([x['id'], x['name'], x.get('race') or x.get('alignment') or 'all', x['desc'], kinds])
        d.add(table(['Id', 'Discovery', 'Who', 'Effect', 'Effect kind (engine)'], rows, [0.05, 0.15, 0.07, 0.58, 0.15], font=6.9))

    d.add(H1('Effect kinds across the table'))
    c = Counter(x['effect'].get('kind') or x['effect'].get('type') for x in disc)
    c2 = Counter(x['effect2'].get('kind') or x['effect2'].get('type') for x in disc if x.get('effect2'))
    rows = [[k, str(v), str(c2.get(k, 0))] for k, v in c.most_common()]
    d.add(table(['Effect kind', 'As the main effect', 'As a second effect'], rows, [0.4, 0.3, 0.3]))

    d.add(gaps([
        'R-026 open: most income discoveries pay +1g a turn. Lowering the gold weighting lifts most to +2g.',
        'R-104 open: Deep Roots (Druidic) lost half its effect when Awaken the Wild was removed.',
        'unitStr is the main effect of 66 discoveries; stacked discovery strength on a unit is capped at ×1.30 (R-026), so a Military-heavy realm hits the cap after a few. Say whether the cap is per unit or per realm in the rulebook.',
        'The open fields differ in size (Military 20, Espionage 10, Special 4). With a choice of two per success, a 10-discovery field is exhausted in five successes.',
        'The Special field (4) is the unlooked-for finds; the rulebook calls them a long shot but gives no figure.',
        'Descriptions are generated from the effect rows by a tool (t/gen.js, not in this repo). Hand edits to a description will be lost if it is rerun; the effect row is the truth.',
        'Discovery names that sound like orders or units (War Drums, Silent Scouts) can be confused with the unit abilities and items of the same flavour; a style pass could help.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 14. TITLES (extra)
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_titles():
    d = RefDoc(os.path.join(OUT, '14-titles-and-the-reckoning.pdf'), 'Titles and the Reckoning', 'The thirteen Imperial Titles, the twenty Minor Titles, the relics, and how the game is won', STAMP)
    d.cover('The game ends at the Reckoning: a king who holds enough of the world\'s tax base claims the throne, and after two '
            'turns of grace the realm with the most Legacy wins. Legacy is scored on the thirteen Imperial Titles (20 for the '
            'Throne, 10 each for the rest) and one point per Legendary relic. Minor Titles are personal perks re-awarded each turn '
            'and count for nothing at the Reckoning.',
            ['Eight Imperial Titles stand on a skill; five on deeds or holdings. Every creed competes on the same terms (R-002).',
             'The perk each Title gives while held (from turn 5), which is the main intelligence in the game.',
             'The Minor Title perks: small, personal, and several add +1 to a skill in one situation only.',
             'The Reckoning bar by realm count and the ally step.'],
            ['Data file: TITLE_DEFS. Engine: titles/reckoning.js (MINOR_TITLES, SKILL_EXTRA_MINORS), titles/perks.js (TITLES_PUBLIC_FROM_TURN 5).',
             'Rulebook: How to Win: The Reckoning; Minor Titles. Rulings R-002, R-003, R-022, R-087, R-116.'])

    d.add(H1('The thirteen Imperial Titles'))
    rows = [[t['name'], str(t['prize']), 'realm' if t.get('kingdomLevel') else 'character', t['req'], t['perk']] for t in DATA['TITLE_DEFS']]
    rows.append(['The Relics', '1 each', 'realm', 'Each Legendary relic held at the Reckoning. 22 in the world.', '—'])
    d.add(table(['Title', 'Legacy', 'Held by', 'Awarded for', 'Perk while held (from turn 5)'], rows, [0.12, 0.05, 0.07, 0.4, 0.36]))

    d.add(H1('The twenty Minor Titles'))
    rows = [[t['name'], t['req'], t['perk']] for t in DATA['MINOR_TITLES']]
    d.add(table(['Minor Title', 'Awarded for (highest living character)', 'Perk'], rows, [0.2, 0.4, 0.4]))
    d.add(note('The Duelist, Marksman, Widowmaker and Relic-Hunter add to a skill in personal combat only; the Strategist in army battles only; the Swift and Sea-Wolf to movement only; the Loreseeker to the Research roll only. The character card marks where each applies.'))

    d.add(H1('The Reckoning'))
    d.add(kv_table([
        ('When', 'Turn 10 or later, the king alive, and the realm (with its direct allies) holding the bar of the world\'s total tax base (every province, land and sea, held or neutral). With allies, the claimant alone must hold half the bar.'),
        ('The bar', 'Base by realm count: 2 realms 60%, 3 50%, 4 45%, 5 42%, 6 or more 40%. Less 5 points per turn after turn 15 (floor 25%). Plus one ally step per ally: 50 ÷ realms, rounded (+13 in a 4-realm game), never past 80%. Fixed when the claim is lodged.'),
        ('Grace', 'Two full turns. Driven below the bar, the claim lapses and play continues. The erosion clock stops while a claim stands.'),
        ('Scoring', 'Total Legacy: Titles (20 + 12 × 10 = 140 on the board) plus relics (22). Ties by tax base, then treasury. A Title nobody qualifies for stands vacant.'),
        ('Standings', 'Hidden for turns 1–4, shown from turn 5 as percentages of the holder, never a rival\'s name or score. Your Titles card lists your own titles first (R-022).'),
        ('Conceding', 'Permanent: heroes only Defend, no private dispatches. If one un-conceded realm (or one allied bloc) remains the game ends at once.'),
        ('Merit', 'Battle merit: +1 per enemy unit destroyed by the winning commander, −1 per own unit lost by the loser; land to the Grand Marshal, sea to the Sea Lord; neutral guards count the same (no commander of theirs to punish).'),
        ('Hall of Fame', 'Public (R-070); keeps every realm\'s best (R-087).'),
    ]))

    d.add(gaps([
        'The Throne (20) is worth two Titles and is pure tax base, which also gates the Reckoning; a realm large enough to call it already leads the Throne. Is the double weight wanted?',
        'The Beastlord and Wildwarden reward recruiting beasts and winning with them; Evil and Druidic realms recruit them free of Druid, so those two Titles lean toward two creeds despite R-002.',
        'The Hierophant counts Bless, Holy Symbol and Resurrect but not Consecrate (R-116); the Deathpriest counts "every dark rite". The two mirror titles count differently.',
        'The Minor Title perks are small and some overlap: The Beastmaster and The Naturalist both give beasts +5%; The Cutpurse and Champion both +2g. Fine, but worth knowing.',
        'Imperial Title perks hand out rival intelligence every turn; R-003 confirms they name every rival. With R-046 (unmet realms are nameless) check how a Title perk names a realm you have never met.',
        'The ally step makes a small ally a net loss (the rulebook says so); allied victory within a bloc goes to the highest Legacy, so an alliance at the end is a race.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 15. HEROES AND THE ECONOMY (extra)
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_heroes():
    d = RefDoc(os.path.join(OUT, '15-heroes-wages-and-the-economy.pdf'), 'Heroes, wages and the economy', 'Hit points, hero wages, hiring and neutral heroes, succession, income, wealth bands and bankruptcy', STAMP)
    d.cover('Kings and heroes are the realm\'s characters; gold is what keeps their armies. This sheet gathers the rules that '
            'sit between the skills and the armies: how a character toughens, what they cost, how they are hired and replaced, '
            'and how the treasury works.',
            ['Hit points come only from fighting; the gain bands and the Orcish shift.',
             'Hero wage = total skill levels ÷ 4; a strong hero costs 5–6g a turn, more than most units.',
             'Wealth bands and the neutral guard that comes with each; the 5% cap on bonus tax.',
             'The starting position every realm shares.'],
            ['Rulebook: Kings & Heroes, Hit points & recovery, Hiring wandering heroes, Hero wages, Death & succession, The Economy, Wealth, Neutral guards, What you start with.',
             'Engine: heroes/skills-and-hp.js, heroes/charms-and-neutrals.js, turn/early-winter (taxes and wages). Rulings R-015, R-016, R-027, R-047, R-050, R-076, R-086.'])

    d.add(H1('Hit points'))
    d.add(kv_table([
        ('Start', '15 max HP; 18 for an Orcish character of an Orcish realm. No skill ever raises it.'),
        ('Gains', 'After a fight the winner rolls and adds +1; any other character who took at least 1 damage and lived rolls too (one roll per fight). Every roll gains (R-086).'),
        ('Bands', 'Below 40: 1–3. 40–49: 1–2. 50 and above: 1. Orcish characters of an Orcish realm: every band 5 higher. A rise heals into the new headroom.'),
        ('Recovery', 'Wounds do not heal on their own. Rest: 30% of max, rounded up (Divine ×1.5). Potions, items, spells, Brave second wind, White 6 Mass Healing (half max for everyone in the province at turn\'s end). The Colossus minor title +2 on a Rest.'),
        ('Death', 'A character at 0 HP may die; some survive wounded; the Cowardly may beg. No single blow takes more than half of max HP (R-080). A body stays where it fell (R-076) and can be looted or Resurrected (own fallen and never-sworn heroes only, R-028).'),
        ('Items', 'Max HP items (15 of them) sit on top of the earned pool; remove the item and the bonus goes.'),
    ]))

    d.add(H1('Wages and hiring'))
    d.add(table(['Total skill levels', '1–4', '5–8', '9–12', '13–16', '17–20', '21–24', '25–28'],
                [['Wage per turn', '1g', '2g', '3g', '4g', '5g', '6g', '7g']], [0.23] + [0.11] * 7))
    d.add(kv_table([
        ('Hero wage', 'Total skill levels ÷ 4, rounded up, minimum 1g; recalculated whenever a skill rises. Kings draw no wage. Psychic Blast lowering a skill lowers the wage (R-024). Some discoveries reduce wages.'),
        ('Hiring a wanderer', 'Opening wage by alignment distance: 2g at 0–1 steps, 3g at 2–3, 4g at 4–5, refusal at 6 (Divine and Undead). Plus 1g per 4 total skill levels beyond a fresh hero\'s first few. Neutral realms pay at most 3g. Higher initiative wins a contested hire.'),
        ('Neutral heroes grow', 'From the end of turn 5 every wanderer and chieftain has a 25% chance a turn of one skill point, never past level 5; sharing a province with another neutral hero, the skill learned is that hero\'s highest (R-027).'),
        ('Other routes', 'Charm (Psychic) hires a wanderer free; Broker (Neutral king) hires at a distance; Resurrect raises the never-sworn. Orders for a hero not yet yours apply only if the hire lands (R-014).'),
        ('Release', 'A hero (never the king) leading no army can be released; they wander again with their items and cannot be re-hired that turn.'),
    ]))

    d.add(H1('Kings and succession'))
    d.add(kv_table([
        ('The king', 'Leads, fights, casts and gives the king-only orders (Consecrate, Call to Arms, Broker, Grand Design). Cannot be charmed. Only a king may run down a king (R-021). Starts with 4 skill points (at most 2 in one skill), the realm\'s race and alignment, a chosen temper, a small army and two heroes of 3 random points each.'),
        ('Heir', 'When the king dies an heir is crowned in the wealthiest province at the start of the next turn: a green ruler whose name, temper and skill points you choose afresh (the alignment\'s +1 skill applies). A Divine king awaiting return is not succeeded while holy ground holds (R-009).'),
        ('Extinction', 'A realm ends only when its king dies with no land to crown an heir in, or when it loses all land (R-061 for conceded realms).'),
        ('Resurrect', 'Only the realm\'s own most recently fallen king, borne home, reclaims the throne; a rival\'s king never.'),
    ]))

    d.add(H1('The economy'))
    d.add(table(['Band', 'Tax', 'Neutral guard', 'Notes'], [
        ['Poor', '2–3', '1–2 units', 'No land province pays less than 2 (R-015).'],
        ['Prosperous', '4–6', '2–3 units', ''],
        ['Rich', '7–10', '3–4 units', 'A rich province (7+) is a Grand Heist target. Tax base can be raised to 10 by Sage 8 and Explorer 8.'],
        ['Home', 'top of the scale', '—', 'Starting income 10g a turn; fully explored; recruits every land unit of the race, two a season.'],
        ['Sea', '1 open water; 2–3 whale and shark waters; 4–6 the sea-monsters\' waters', 'sea-beasts and their guardians', 'Claimable by a fleet; the one tax below 2.'],
    ], [0.12, 0.2, 0.15, 0.53]))
    d.add(kv_table([
        ('Start', '20 gold (R-016), 10 income, the king, two heroes, a small army; one poor and one prosperous neighbour, at least one of the king\'s race; a sea province beside a king with Naval; a Weak lair at home (R-018, R-057, R-071).'),
        ('Income', 'Province tax, plus Neutral trade +20%, Bless (+60/80/100%), Consecrate (+50%), Plunder (Evil, 50% of tax on conquest), Blood Harvest (Pagan, 1g per unit destroyed), Sage 6 (+5g per discovery), discoveries, items, titles and stipends. Provinces conquered this turn pay at its end.'),
        ('Bonus cap', 'No single source of bonus tax (one discovery, or all tax items together) pays more than 5% of the realm\'s base tax, rounded down, never less than 1g (R-050).'),
        ('Spending', 'Recruiting (price), wages (price again every turn, garrison included; skeletons 1g; hero wages), hiring, Harvest the Field 2g, a Broker report 2g, Hunting Rumours 1–4g per lair, Wild Hunt one beast\'s price.'),
        ('Settlement', 'Tax and wages settle together at turn\'s end, so a unit raised this turn is paid this turn: the first season costs double.'),
        ('Bankruptcy', 'Units disband greenest first anywhere in the realm (random within a tier), skeletons last; then heroes desert. A ship carrying troops at sea is never disbanded while they would be stranded. The Deathless Legion Wonder exempts skeletons.'),
        ('Theft', 'Steal takes 5% of a treasury; Grand Heist 25% (doubled at Thief 8). Sabotage removes a province\'s tax next turn; Earthquake this turn; Cataclysm permanently.'),
    ]))

    d.add(gaps([
        'A hero at 24 skill levels costs 6g a turn, more than any unit; late-game courts are the biggest wage line. Say whether the ÷4 rate is the lever to pull for balance.',
        'HP gains stall at 60; the Legendary benchmark is 60 HP. A hero past 60 gains 1 (2 as a winner) per fight, so the last twenty points take twenty fights.',
        'The bonus-tax cap (5% of base) makes every +gold item and discovery worth at most the same amount per realm; a small realm\'s Ring of Wealth pays 1g. R-050 is confirmed but has an open question.',
        'Neutral heroes grow to level 5 only; a wandering hero hired on turn 12 can be a 20-level hero costing 5g from the first turn. Players may need the asking price explained on the hire list (it is shown).',
        'The king\'s 4 starting points and 2-per-skill limit are not in the rulebook text.',
        'The home province pays "the top of the scale" but no figure is given; the starting income is 10, which with the home at tax 10 means neighbours pay nothing until taken. State the home tax.',
    ]))
    return d.build()


# ─────────────────────────────────────────────────────────────────────────────────────────────────
# 16. BATTLES (extra)
# ─────────────────────────────────────────────────────────────────────────────────────────────────
def build_battles():
    d = RefDoc(os.path.join(OUT, '16-battles.pdf'), 'Battles', 'How an army battle is fought: the order of multipliers, the lines, who faces whom, fortune and the result bands', STAMP)
    d.cover('Every army battle runs the same fixed sequence. This sheet lists the multipliers in the order the engine applies '
            'them, the battle lines, the matchups and the result bands, so a unit or rule change can be traced to its effect '
            'on a fight. It complements the Army units and Terrain sheets.',
            ['The stacking order (R-041): every modifier first, pre-battle damage last.',
             'The matchup multipliers between unit types and the line multipliers behind the front.',
             'The fortune curve: twice as strong wins about 80%, four times always.',
             'The six result bands and what each does to the loser.'],
            ['Rulebook: How a Battle Is Fought; The battle, step by step; What happens to a unit on the losing side. Engine: battle/*.',
             'Rulings R-034, R-039, R-041, R-058, R-063, R-067, R-082 to R-084, R-089 to R-092, R-100.'])

    d.add(H1('The sequence'))
    d.add(table(['Step', 'What happens'], [
        ['1. Pre-battle duel', 'Opposing commanders may face each other in single combat first (a hero refuses unless told otherwise, R-107).'],
        ['2. Unit strength fixed', 'base × quality, then per-unit: kinship (×1.2 king\'s kin, ×1.2 leader\'s kin), feud ×0.8, terrain, Illusory Terrain, Druid shortfall (−20%/level) or mastery (+20%/level), racial gifts (Elven woods ×1.5, Dwarven Bulwark ×1.5), items, unit abilities, Terror (−10% a stack), discoveries (cap ×1.30).'],
        ['3. Command', 'Tactical ×(1 + 0.2 × level) on land and air units (cap ×2.0, land battles only); Archery +5%/level on ranged units; Naval ×(1 + 0.2 × level) on fleets and sea-beasts everywhere (cap ×2.0).'],
        ['4. Whole force', 'Fervour (the strongest of: zeal ×1.30, Evil Monster fury ×1.25, Undead skeletal ×1.5 king / ×1.3 hero); defender\'s edge ×1.25 (×1.5 at the home capital; a king retaking his capital attacks at ×1.5); Good Righteous Defence +10%; Sanctuary −25%; Feigned Retreat, Grand Stratagem, Reaver Crews +25%, Raid the Coast +25%, duel morale.'],
        ['5. Battle lines', 'Front width rolled by terrain; the side that knows the ground better lines up second and may take a wider or narrower front; each commander shifts his line once per Tactical level; the fronts always meet.'],
        ['6. Battle magic', 'Holy Symbol, Spiritwrack, Fireball, Telekinetic Storm, Lightning Bolt, Curse, Psychic Blast, Control Undead, each at the caster\'s cast chance; the Thunderbirds\' and other beasts\' strikes (30% + 10%/Druid, cap 90%); Griffon and Wyvern strikes at 50%; Flak Screen.'],
        ['7. Archery', 'Each ranged unit shoots 30% of its own strength (+10% per Archery level, half again at 5), at a random enemy unit (winged riders first and for double); no unit loses more than 40% to arrows (80% winged; Crossbows 55/90%). Defending Longbows loose twice; Ambush removes the phase.'],
        ['8. The clash', 'Each front unit fights the unit opposite with the matchup multiplier; flank riders duel or ride free; the second line and reserve at their depth multipliers; flyers from the air. Totals compared.'],
        ['9. Fortune', 'One luck swing proportional to strength: 2× wins about 80%, 3× about 90%, 4× always; 1.5× about two in three, 1.2× barely more than half.'],
        ['10. Result', 'Margin = |winner − loser| ÷ total, giving one of six bands (below); unit deaths, quality changes, retreat, pursuit, Terror, merit, spoils, graves.'],
    ], [0.14, 0.86]))

    d.add(H1('Lines and matchups'))
    d.add(kv_table([
        ('Front width', 'Plains and desert 6–8; forest and jungle 4–6; mountain 2–4; sea 8–10 (hulls hold the front, no flanks).'),
        ('Flanks', 'Tactical + 1 cavalry ride free of the front on plains and desert (Stag Riders and Unicorns in woods; Ironhoof Rams in mountains). Riders pair in duels (Free Lances ×1.15); a spare rider guards a threatened end; a rider with nothing to do rides free (×1.3) and turns the flank: enemy second-line ranged units ×0.75 unless infantry anchor both ends.'),
        ('Depth', 'Ranged unit behind a fighter: ×1 (shoots over). Anything else in the second line ×0.5, reserve ×0.25, beyond ×0.125 (Flanking Tactics lifts these). Titan Warbeasts fight from the second line at full strength.'),
        ('Front matchups', 'Cavalry v ranged ×1.25, cavalry v infantry ×0.85 (Gilded Lances ×1.15; a Spear Hedge or Boulder Wall caps cavalry at ×0.75); infantry v cavalry ×1.15, infantry v ranged ×1.25; a ranged unit left in the front ×0.75 (Black Arrows ×1).'),
        ('Shooting over', 'A ranged unit behind a fighter hits the enemy opposite: infantry ×1.25, cavalry ×0.75 (Longbows and Elven Bowmen differ by ability).'),
        ('Wrapping', 'A wider front\'s spare units wrap the enemy\'s end (×1.2) and that end unit is struck from the side (×0.9), unless a spare flank rider guards it or the unit is Rooted, Hold the Gate or Unbreakable.'),
        ('Flyers', 'Winged riders and flying beasts take no place: full strength up to the enemy\'s units in line and in the air (never below 2), half beyond. Archers single out the winged riders. ×0.75 under trees.'),
        ('Sea', 'Land units ×0.75; air-carried land units ×0.25 and their carriers ×0.5; fleets, sea-beasts and flying beasts full.'),
    ]))

    d.add(H1('Result bands'))
    d.add(table(['Band', 'Margin', 'Winner unit death', 'Loser unit death', 'Winner quality gain', 'Loser quality gain', 'Loser quality loss'], [
        ['Pyrrhic', '0–4%', '15%', '12%', '60%', '20%', '5%'],
        ['Narrow', '4–10%', '12%', '12%', '50%', '12%', '10%'],
        ['Clear', '10–30%', '5%', '18%', '30%', '6%', '20%'],
        ['Decisive', '30–55%', '1%', '35%', '15%', '2%', '30%'],
        ['Crushing', '55–75%', '1%', '50%', '8%', '1%', '45%'],
        ['Annihilating', 'over 75%', '1%', '60%', '5%', '1%', '55%'],
    ], [0.14, 0.12, 0.14, 0.14, 0.16, 0.15, 0.15]))
    d.add(kv_table([
        ('Per unit', 'Death chances are per unit, scaled by quality, +35% per carry-on round (to ×2.5), halved by Tactical 8, cut by discoveries, +6% per Free Lances (max +18%) in open country, +15% under Run Them Down, Relentless Hunt or Feeding Frenzy.'),
        ('Then', 'A survivor rolls quality loss (a Green unit that would fall disbands) or, failing that, quality gain (Green 1.5× as likely as Average, Elite never; Humans doubled). Knightly Example spares Levies and Men-at-Arms the loss; Cave Trolls shrug off a death 30%.'),
        ('Retreat', 'To a friendly adjacent province (never into a Flood; onto parted sea only as a last resort, R-084); a landing back to the sea it sailed from if its ships can carry it (R-058). No retreat: a further 15% per unit and the province stays contested. Shield Fort withdraws in good order; all-skeleton hosts take no flight losses.'),
        ('Terror', 'An Evil Decisive or better win terrorises the province and its neighbours (−10% to defenders, three stacks).'),
        ('Merit', '+1 to the winning commander per enemy unit destroyed; −1 to the loser per own unit lost (Grand Marshal on land, Sea Lord at sea).'),
        ('Spoils', 'Orcish attackers who win pay half wages; Pagan Blood Harvest +1g per unit destroyed; Evil Plunder 50% of tax on conquest; a consecrated province captured gives the column a 50% tier gain per unit.'),
        ('Graves', 'The dead are left as battlefield graves (10% decay a turn, 5% Undead); disbanded units leave none; skeletons crumble to dust.'),
    ]))

    d.add(gaps([
        'The pre-battle volley does 30% of the shooting unit\'s strength per shot (R-092) and the cap on arrow losses is 40% (80% winged). With Prepared Ground (two volleys) and Archery 5, defending Elite Longbows can take an attacker\'s front unit to the cap before the clash. Check archer-heavy defences in the balance matrix.',
        'Tactical ×2.0 and Naval ×2.0 are hard caps, but kinship (×1.44), Elven woods (×1.5), Bulwark (×1.5), fervour (×1.3–1.5) and the defender\'s edge (×1.25–1.5) all multiply on top. A dwarven king defending his mountain capital with his own Guard is about ×1.44 × 1.5 × 1.5 × 1.1 × 2.0 before zeal: roughly ×7. Worth stating the realistic ceiling.',
        'Mountain fronts of 2–4 make the Tactical line-shifts (one per level) decisive; the line-up rules are the newest part of the engine (R-089 to R-091).',
        'Fortune is a fixed curve; the rulebook gives four points on it. A table of win chance by ratio would help players reading the odds the portal shows.',
        'Carry-on rounds raise casualties +35% each to ×2.5, and the attacker spends a point per phase; a contested province is the one place numbers and time both matter.',
        'R-082 open: Run Them Down is now a field slaughter, not a chase; is the no-chase reading final?',
    ]))
    return d.build()


if __name__ == '__main__':
    built = []
    for fn in [build_races, build_alignments, build_tempers, build_skills, build_mastery, build_orders, build_spells,
               build_units, build_terrain, build_lairs, build_guardians, build_items, build_discoveries, build_titles,
               build_heroes, build_battles]:
        built.append(fn())
        print('built', built[-1])
