"""Counts how often each alignment ability fired in a bot-matrix run, from the games' GM logs.

Usage:  python3 -I tools/handplay/matrix/count-uses.py <log dir> [<log dir> ...]

A log dir is what KC_DUMP_LOG=<dir> writes during `npm run balance` (one bots-NN.log and scripted-NN.log a game).
Only the bot games are read. Prints, for each ability, the mean number of matching log lines a game.
Each marker is a regular expression for the line the engine writes when the ability fires. An ability with no
marker (a standing bonus with no line of its own, such as Markets or Tithes) is not counted: read its effect from
the matrix's figures instead. When an ability's log text changes in src/, change its marker here.
"""
import glob, re, sys

MARKERS = {
    'Divine': {
        'Consecrate': r'consecrates .* \(5g\)', 'Smite the Unholy': r'Smite the Unholy ×', 'The Last Rites': r'Last Rites',
        'Divine Grace': r'Divine Resurrection', 'Proclaim Crusade': r'proclaims a Crusade', 'Sanctuary': r'Sanctuary',
        'Absolution': r'Absolution:', 'The sword consecrates': r'sword consecrates',
    },
    'Good': {
        'Shield of the Realm': r'Shield of the Realm', 'Reclaim': r'Reclaim ×1\.5', 'Light the Beacons': r'lights the beacons',
        'Good Works': r'Good Works:', 'Hearts of Oak': r'Hearts of Oak', 'Loyal hearts': r'stout heart',
    },
    'Druidic': {
        'Home of the Wild': r'Home of the Wild', 'The beasts are yours': r'Parley with the Wild', 'The wild breeds': r'wild answers the druids',
        'Grow the Wild': r'Grow the Wild:', 'Call of the Wild': r'sounds the Call of the Wild', 'Green healing': r'green mends',
        "Healers' fees": r"healers' fees",
    },
    'Neutral': {
        'Condottieri in battle': r'Condottieri ×', 'Open ranks': r'Open ranks', 'Trade Pact': r'Trade Pact:',
        'Embargo': r'declares an Embargo', 'Ransom': r'Ransom:',
    },
    'Pagan': {
        'Favour of the Old Gods': r'Favour of the Old Gods ×', 'Rite of Awakening': r'Rite of Awakening at',
        'Rite of the Wild Hunt': r'Rite of the Wild Hunt', 'Blood Offering': r'makes a Blood Offering', 'Rite of the Ley': r'walks the ley',
        'Call down the storm': r'calls the sky down', 'Blood Harvest': r'old gods pay in strength',
    },
    'Evil': {
        'Terror': r'[Tt]error radiates|Terror lingers|fight demoralised', 'Spread Dread': r'Spread Dread:', 'Tribute of Fear': r'Tribute of Fear',
        'Savage Fury': r'Savage Fury ×', 'Dominion of the Pits': r'Dominion of the Pits', 'The pits breed': r'beast-pits of', 'Dark Pact': r'Dark Pact( \(called from afar[^)]*\))?:',
    },
    'Undead': {
        'The dead fear nothing': r'The dead fear nothing ×', 'Bind the Bones': r'Bind the Bones:', 'The barrow dead': r'fills again',
        'Lichdom': r'Lichdom:', 'Blight the Land': r'Blight the Land:', 'Grave Goods': r'grave goods',
        'The dead of this soil': r'dead of this soil rise', 'The soul is taken': r'soul is taken', 'Desecrate': r'Desecrate:',
    },
}


def main():
    files = sorted(f for d in sys.argv[1:] for f in glob.glob(f'{d}/bots-*.log'))
    if not files:
        sys.exit('No bots-NN.log files in the folders given.')
    texts = [open(f, encoding='utf-8', errors='replace').read() for f in files]
    print(f'{len(files)} bot games. Mean uses a game:')
    for alignment, rows in MARKERS.items():
        print(f'\n{alignment}')
        for name, marker in rows.items():
            rx = re.compile(marker)
            hits = sum(len(rx.findall(t)) for t in texts)
            print(f'  {name:28s} {hits / len(files):7.2f}')


if __name__ == '__main__':
    main()
