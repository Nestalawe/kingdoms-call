"""Pools bot-matrix runs over seed sets and prints each alignment's figures, with a 95% range for the shares.

Usage:  python3 -I tools/handplay/matrix/compare.py <runs dir> <tag> [<base tag>]

Reads, from <runs dir>, the files run-kits.sh writes: all-<set>-<tag>.json (all seven kits on), <Alignment>-<set>-<tag>.json
(one kit alone) and base-<set>-<base tag>.json (today's rules; <base tag> defaults to <tag>). Any that are missing are
left out. Only the 48 bot games of each set are counted (the scripted games have a human-shaped player in them).
Prints the tables and writes <runs dir>/<tag>-summary.json.
"""
import json, math, os, sys

ALIGNMENTS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead']
SETS = ['A', 'B', 'C', 'D', 'E']
FIGURES = [  # (statistic, label, is a share)
    ('game: won', 'Won the game', True),
    ('game: realm alive at the end', 'Alive at the end', True),
    ('realms: provinces at the end', 'Provinces at the end', False),
    ('realms: army strength at the end', 'Army strength at the end', False),
    ('realms: gold at the end', 'Gold at the end', False),
    ('realms: provinces at turn 10', 'Provinces at turn 10', False),
    ('realms: army strength at turn 10', 'Army strength at turn 10', False),
]


def load(path):
    """(statistic name -> index, bot games) of one run, or None if the file is missing."""
    if not os.path.exists(path):
        return None
    with open(path) as f:
        d = json.load(f)
    index = {name: i for i, name in enumerate(d['statNames'])}
    return index, [g for g in d['games'] if g['id'].startswith('bots-') and g.get('stats')]


def pooled(run, key):
    """(sum, count) of one statistic over a run's bot games. Each game's statistic is [sum, count] over its realms."""
    if not run or key not in run[0]:
        return (0, 0)
    s = c = 0
    for g in run[1]:
        st = g['stats'][run[0][key]]
        if st:
            s += st[0]
            c += st[1]
    return (s, c)


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def mean(sc):
    return sc[0] / sc[1] if sc[1] else None


def show(v, share):
    return '-' if v is None else (f'{100 * v:.0f}%' if share else f'{v:.1f}')


def main():
    runs_dir, tag = sys.argv[1], sys.argv[2]
    base_tag = sys.argv[3] if len(sys.argv) > 3 else tag
    p = lambda name: os.path.join(runs_dir, name)
    allr = {st: load(p(f'all-{st}-{tag}.json')) for st in SETS}
    alone = {(a, st): load(p(f'{a}-{st}-{tag}.json')) for a in ALIGNMENTS for st in SETS}
    base = {st: load(p(f'base-{st}-{base_tag}.json')) for st in SETS}
    done = [st for st in SETS if allr[st]]
    out = {'sets': done, 'all': {}, 'alone': {}, 'base': {}, 'matchups': {}}
    print('Seed sets with an all-seven run:', ''.join(done) or 'none')
    for key, label, share in FIGURES:
        print(f'\n== {label}')
        print(f"{'':9s} {'today':>7s} {'alone':>7s} {'all 7':>7s}   per set (all 7)")
        for a in ALIGNMENTS:
            k = f'{key} | by alignment: {a}'
            b = al = tot = (0, 0)
            per = []
            for st in SETS:
                if base[st] and alone[(a, st)]:  # today vs kit alone: only on sets where both were played
                    b = add(b, pooled(base[st], k))
                    al = add(al, pooled(alone[(a, st)], k))
                if allr[st]:
                    x = pooled(allr[st], k)
                    tot = add(tot, x)
                    per.append(show(mean(x), share))
            m = mean(tot)
            out['base'].setdefault(key, {})[a] = mean(b)
            out['alone'].setdefault(key, {})[a] = mean(al)
            out['all'].setdefault(key, {})[a] = [m, tot[1]]
            rng = ''
            if share and m is not None and tot[1]:
                half = 1.96 * math.sqrt(m * (1 - m) / tot[1])
                rng = f'  95% range {100 * max(0, m - half):.0f}% to {100 * min(1, m + half):.0f}% (n={tot[1]})'
            print(f'{a:9s} {show(mean(b), share):>7s} {show(mean(al), share):>7s} {show(m, share):>7s}   '
                  f'{" ".join(f"{x:>5s}" for x in per)}{rng}')
    print('\n== Attacker won, by alignment of attacker (rows) and defender (columns), all seven kits on')
    print(f"{'':8s}" + ''.join(f'{y[:7]:>12s}' for y in ALIGNMENTS))
    for x in ALIGNMENTS:
        row = []
        for y in ALIGNMENTS:
            if x == y:
                row.append(f'{"-":>12s}')
                continue
            t = (0, 0)
            for st in done:
                t = add(t, pooled(allr[st], f'battles: attacker won | by alignments: {x} vs {y}'))
            m = mean(t)
            out['matchups'][f'{x} vs {y}'] = [m, t[1]]
            row.append(f'{"-" if m is None else f"{100 * m:.0f}% ({t[1]})":>12s}')
        print(f'{x[:7]:8s}' + ''.join(row))
    with open(p(f'{tag}-summary.json'), 'w') as f:
        json.dump(out, f, indent=1)


if __name__ == '__main__':
    main()
