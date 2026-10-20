// ════
// STATS TAB (2026-09-25) — reads turn_events + game_results and answers the balance questions.
// ════
// All the maths is done client-side on the raw rows (a few hundred realm-turns is a few MB, fine).
// Charts are plain HTML bars in the portal's own palette — no chart library, so nothing to load or
// fail. Every chart is also a table: the number sits beside every bar.
const _stats = { rows: null, results: null, games: null, loadedAt: 0 };
const STATS_ACTION_LABEL = {
  move: 'Move',
  defend: 'Defend',
  explore: 'Explore',
  search: 'Search lair',
  hunt_rumours: 'Hunt rumours',
  recruit: 'Recruit',
  hire: 'Hire hero',
  release: 'Release hero',
  leave_army: 'Leave army',
  pickup_army: 'Pick up army',
  disband_army: 'Disband',
  practice: 'Practice',
  rest: 'Rest',
  research: 'Research',
  spy: 'Spy',
  steal: 'Steal',
  cast_spell: 'Cast spell',
  use_item: 'Use item',
  equip_items: 'Equip',
  give_item: 'Give item',
  encounter: 'Encounter',
  consecrate: 'Consecrate',
  call_to_arms: 'Call to Arms',
  broker: 'Broker',
  awaken_wild: 'Awaken Wild',
  call_pit: 'Call from the Pit',
  harvest_field: 'Harvest Field',
  rite: 'Rite',
};
const STATS_COL = { crimson: '#7a1c1c', forest: '#2d4a1e', gold: '#c8922a', blue: '#2f5f8f', stone: '#6b5a42' };
async function openStats(force) {
  show('sec-stats');
  const msg = document.getElementById('stats-msg'),
    body = document.getElementById('stats-body');
  if (!_kcHasTel) {
    msg.innerHTML = `<div class="msg-info">Telemetry is not active: the database has no telemetry tables (see the message on the game list). Nothing has been recorded.</div>`;
    body.innerHTML = '';
    return;
  }
  if (force || !_stats.rows || Date.now() - _stats.loadedAt > 120000) {
    msg.innerHTML = '<div class="msg-info">⏳ Loading recorded turns…</div>';
    body.innerHTML = '';
    try {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb
          .from('turn_events')
          .select('game_id,turn,player_index,is_bot,bot_difficulty,realm,race,alignment,orders,pre,post,outcomes')
          .order('game_id')
          .order('turn')
          .order('player_index')
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const res = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb
          .from('game_results')
          .select('*')
          .range(from, from + 999);
        if (error) throw error;
        res.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      let _gq = sb.from('games').select('id,name,status,turn');
      if (!_kcOverlord) _gq = _gq.eq('gm_user_id', currentUser.id); // Master GM mode: every game's name (P0-32g, D-09)
      const { data: games } = await _gq;
      _stats.rows = rows.map((r) => ({
        ...r,
        orders: _statsJ(r.orders),
        pre: _statsJ(r.pre),
        post: _statsJ(r.post),
        outcomes: _statsJ(r.outcomes),
      }));
      _stats.results = res.map((r) => ({ ...r, setup: _statsJ(r.setup), final: _statsJ(r.final) }));
      _stats.games = games || [];
      _stats.loadedAt = Date.now();
    } catch (e) {
      msg.innerHTML = kcHtml`<div class="msg-error">Could not load statistics: ${e.message || e}</div>`;
      return;
    }
  }
  msg.innerHTML = '';
  // game picker: names from the games table; deleted games keep their rows under their id
  const sel = document.getElementById('stats-game');
  const keep = sel.value;
  const names = {};
  (_stats.games || []).forEach((g) => {
    names[String(g.id)] = g.name;
  });
  (_stats.results || []).forEach((r) => {
    if (!names[r.game_id] && r.game_name) names[r.game_id] = r.game_name;
  });
  const ids = [...new Set(_stats.rows.map((r) => r.game_id))];
  sel.innerHTML = kcHtml`<option value="">All games</option>${ids.map((id) => kcHtml`<option value="${id}">${names[id] || 'deleted game ' + id.slice(0, 8)}${_statsFinished(id) ? ' ✓' : ''}</option>`)}`;
  sel.value = ids.includes(keep) ? keep : '';
  renderStats();
}
function _statsJ(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch (e) {
      return null;
    }
  }
  return v;
}
function _statsFinished(gameId) {
  return (_stats.results || []).some((r) => r.game_id === gameId);
}
function _statsFilter() {
  const gid = document.getElementById('stats-game').value,
    who = document.getElementById('stats-who').value,
    diff = document.getElementById('stats-diff').value,
    fin = document.getElementById('stats-fin').value;
  const okGame = (id) => (!gid || id === gid) && (!fin || (fin === 'finished') === _statsFinished(id));
  const okRealm = (r) => (!who || (who === 'bot') === !!r.is_bot) && (!diff || !r.is_bot || r.bot_difficulty === diff);
  return {
    rows: (_stats.rows || []).filter((r) => okGame(r.game_id) && okRealm(r)),
    results: (_stats.results || []).filter((r) => okGame(r.game_id) && okRealm(r)),
    allRows: (_stats.rows || []).filter((r) => okGame(r.game_id)),
  };
}
// ── tiny chart kit ── a horizontal bar per row: label · bar · value text. `items` = [{label, v, txt, col, sub}]
function statsBars(items, opt) {
  opt = opt || {};
  const max = Math.max(1e-9, ...items.map((i) => i.v || 0), opt.max || 0);
  return kcHtml`<div style="display:grid;grid-template-columns:${opt.labelW || 150}px 1fr auto;gap:4px 8px;align-items:center;font-size:.8rem">${items.map(
    (i) => kcHtml`
    <div style="color:var(--ink-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${i.label || ''}">${i.label}</div>
    <div style="background:#eee4cc;border-radius:3px;height:12px;position:relative"><div style="width:${Math.max(0, Math.min(100, (100 * (i.v || 0)) / max))}%;height:100%;border-radius:3px;background:${i.col || STATS_COL.crimson}"></div>${i.mark != null ? kcHtml`<div title="expected" style="position:absolute;top:-2px;left:${Math.max(0, Math.min(100, (100 * i.mark) / max))}%;width:2px;height:16px;background:${STATS_COL.blue}"></div>` : ''}</div>
    <div style="font-family:monospace;font-size:.74rem;color:var(--stone);white-space:nowrap">${i.txt != null ? i.txt : i.v}</div>`,
  )}</div>`;
}
// a small SVG line chart: series = [{name, pts:[[x,y]...], col}], x = turn number
function statsLines(series, opt) {
  opt = opt || {};
  const W = 560,
    H = 170,
    L = 40,
    R = 12,
    T = 12,
    B = 26;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])),
    ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  if (!xs.length) return kcHtml`<div style="color:var(--stone);font-size:.8rem">No data.</div>`;
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y1 = Math.max(1e-9, ...ys),
    y0 = 0;
  const X = (x) => L + (x1 === x0 ? 0 : (x - x0) / (x1 - x0)) * (W - L - R),
    Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => y0 + f * (y1 - y0));
  const svg = [
    kcHtml`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;font-family:'Crimson Text',serif;font-size:10px">`,
  ];
  ticks.forEach((t) => {
    svg.push(
      kcHtml`<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#d8cbb0" stroke-width="1"/><text x="${L - 4}" y="${Y(t) + 3}" text-anchor="end" fill="#6b5a42">${Math.round(t * 10) / 10}</text>`,
    );
  });
  for (let x = x0; x <= x1; x++) {
    if (x1 - x0 > 12 && x % Math.ceil((x1 - x0) / 12)) continue;
    svg.push(kcHtml`<text x="${X(x)}" y="${H - 8}" text-anchor="middle" fill="#6b5a42">${x}</text>`);
  }
  series.forEach((s) => {
    const pts = s.pts.slice().sort((a, b) => a[0] - b[0]);
    if (!pts.length) return;
    svg.push(
      kcHtml`<polyline fill="none" stroke="${s.col}" stroke-width="2" stroke-linejoin="round" points="${pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`,
    );
    pts.forEach((p) => {
      svg.push(
        kcHtml`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.5" fill="${s.col}"><title>${s.name} · turn ${p[0]}: ${Math.round(p[1] * 10) / 10}</title></circle>`,
      );
    });
  });
  svg.push(
    kcHtml`<text x="${W - R}" y="${H - 8}" text-anchor="start" fill="#6b5a42" font-size="9" dx="6">turn</text></svg>`,
  );
  return kcHtml`<div>${svg}<div style="font-size:.74rem;color:var(--stone);margin-top:2px">${series.map((s, i) => kcHtml`${i ? kcHtml` &nbsp; ` : ''}<span style="display:inline-block;width:10px;height:10px;background:${s.col};border-radius:2px;vertical-align:middle;margin-right:4px"></span>${s.name}`)}${opt.note ? ' · ' + opt.note : ''}</div></div>`;
}
function statsCard(title, body, note) {
  return kcHtml`<div class="card"><h2>${title}</h2>${note ? kcHtml`<div style="font-size:.78rem;color:var(--stone);margin:-6px 0 10px">${note}</div>` : ''}${body}</div>`;
}
const _pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : 0);
const _avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function renderStats() {
  const body = document.getElementById('stats-body');
  if (!body || !_stats.rows) return;
  const { rows, results, allRows } = _statsFilter();
  if (!rows.length) {
    body.innerHTML =
      '<div class="msg-info">No recorded turns match these filters yet. Rows are written each time a turn is resolved.</div>';
    return;
  }
  const games = [...new Set(rows.map((r) => r.game_id))];
  const winners = new Set(results.filter((r) => r.winner).map((r) => r.game_id + '#' + r.player_index));
  const isWinner = (r) => winners.has(r.game_id + '#' + r.player_index);
  const finishedGames = new Set(results.map((r) => r.game_id));
  const html = [];
  // 1. overview
  const humansRT = rows.filter((r) => !r.is_bot).length,
    botsRT = rows.length - humansRT;
  html.push(
    statsCard(
      'Overview',
      kcHtml`<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:.85rem">
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${games.length}</div><div style="color:var(--stone)">games recorded</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${finishedGames.size}</div><div style="color:var(--stone)">finished</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${rows.length}</div><div style="color:var(--stone)">realm-turns (${humansRT} human · ${botsRT} bot)</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${rows.reduce((s, r) => s + ((r.outcomes || {}).battles || {}).asAttacker || 0, 0)}</div><div style="color:var(--stone)">battles</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${rows.reduce((s, r) => s + ((r.outcomes || {}).encounters || {}).fought || 0, 0)}</div><div style="color:var(--stone)">lair fights</div></div>
    <div><div style="font-family:Cinzel,serif;font-size:1.4rem;color:var(--crimson)">${rows.reduce((s, r) => s + ((r.outcomes || {}).deaths || {}).own || 0, 0)}</div><div style="color:var(--stone)">characters killed</div></div>
  </div>`,
    ),
  );
  // 2. who wins
  if (results.length) {
    const by = (key) => {
      const m = {};
      results.forEach((r) => {
        const k = key(r);
        if (k == null) return;
        const o = m[k] || (m[k] = { n: 0, w: 0, rank: [] });
        o.n++;
        if (r.winner) o.w++;
        if (r.rank) o.rank.push(r.rank);
      });
      return Object.entries(m)
        .map(([k, o]) => ({
          label: k,
          v: _pct(o.w, o.n),
          txt: `${_pct(o.w, o.n)}% won · ${o.n} realm${o.n !== 1 ? 's' : ''} · avg rank ${_avg(o.rank).toFixed(1)}`,
        }))
        .sort((a, b) => b.v - a.v);
    };
    const gv = {},
      glen = {};
    results.forEach((r) => {
      gv[r.game_id] = r.victory;
      glen[r.game_id] = r.turns;
    });
    const vict = {};
    Object.values(gv).forEach((v) => {
      vict[v] = (vict[v] || 0) + 1;
    });
    const gN = Object.keys(glen).length;
    html.push(
      statsCard(
        'Who wins',
        kcHtml`<h3>Humans vs bots</h3>${statsBars(by((r) => (r.is_bot ? `Bot (${r.bot_difficulty || '?'})` : 'Human')))}
       <h3 style="margin-top:14px">By race</h3>${statsBars(by((r) => r.race))}
       <h3 style="margin-top:14px">By alignment</h3>${statsBars(by((r) => r.alignment))}
       <h3 style="margin-top:14px">How games end</h3>${statsBars(Object.entries(vict).map(([k, n]) => ({ label: k, v: n, txt: `${n} game${n !== 1 ? 's' : ''}`, col: STATS_COL.forest })))}
       <div style="font-size:.8rem;margin-top:8px">Average game length: <strong>${_avg(Object.values(glen)).toFixed(1)} turns</strong> over ${gN} finished game${gN !== 1 ? 's' : ''}. Realms that dropped out early: ${results.filter((r) => r.out_how).length} (${results.filter((r) => r.out_how === 'conceded').length} conceded, ${results.filter((r) => r.out_how === 'eliminated').length} eliminated).</div>`,
        'From the game_results rows — one per realm per finished game. Win rates are per realm, so with 4 realms a fair race sits at 25%.',
      ),
    );
    // 3. early lead → final rank
    const T5 = 5;
    let lead = 0,
      leadWon = 0;
    const corr = [];
    finishedGames.forEach((gid) => {
      const at = allRows.filter((r) => r.game_id === gid && r.turn === T5);
      if (!at.length) return;
      const top = at.slice().sort((a, b) => ((b.post || {}).taxShare || 0) - ((a.post || {}).taxShare || 0))[0];
      lead++;
      if (isWinner(top)) leadWon++;
      at.forEach((r) => {
        const fr = results.find((x) => x.game_id === gid && x.player_index === r.player_index);
        if (fr && fr.rank) corr.push([r.post.taxShare || 0, fr.rank]);
      });
    });
    if (lead) {
      html.push(
        statsCard(
          'Does an early lead decide it?',
          kcHtml`<div style="font-size:.85rem">The realm holding the most of the world's tax base at the end of turn ${T5} went on to win <strong>${leadWon} of ${lead}</strong> finished games (${_pct(leadWon, lead)}%). ${_pct(leadWon, lead) >= 75 ? 'That is a strong snowball — the mid-game may be too kind to the leader (coalitions, catch-up mechanics, lair rewards for the trailing realms are the usual levers).' : _pct(leadWon, lead) <= 35 ? 'Early leads are not sticking — the game has real come-backs.' : 'A lead helps but does not settle it — a healthy place to be.'}</div>
        <h3 style="margin-top:12px">Turn-${T5} tax share vs final rank</h3>${statsBars(
          corr
            .sort((a, b) => b[0] - a[0])
            .slice(0, 16)
            .map(([sh, rk]) => ({
              label: `${sh}% of world`,
              v: sh,
              txt: `finished #${rk}`,
              col: rk === 1 ? STATS_COL.gold : STATS_COL.stone,
            })),
          { labelW: 110 },
        )}`,
          'Needs finished games with at least ' + T5 + ' turns recorded.',
        ),
      );
    }
  } else {
    html.push(
      statsCard(
        'Who wins',
        kcHtml`<div style="font-size:.85rem;color:var(--stone)">No finished games in this selection yet — win rates, victory types and the early-lead test appear once a game ends (or once you Record Results for a game that finished before telemetry existed: this happens automatically at sign-in for finished games).</div>`,
      ),
    );
  }
  // 4. trajectories
  {
    const key = (r) => (isWinner(r) ? 'winners' : finishedGames.has(r.game_id) ? 'others' : 'running');
    const mk = (f, name) => {
      const byT = {};
      rows.forEach((r) => {
        if (!r.post) return;
        const k = key(r);
        if (k === 'running' && finishedGames.size) return;
        const o = (byT[r.turn] = byT[r.turn] || {});
        (o[k] = o[k] || []).push(f(r.post));
      });
      const ser = [];
      ['winners', 'others', 'running'].forEach((k, i) => {
        const pts = Object.entries(byT)
          .map(([t, o]) => (o[k] ? [+t, _avg(o[k])] : null))
          .filter(Boolean);
        if (pts.length)
          ser.push({
            name:
              k === 'running' ? 'all realms (games still running)' : k === 'winners' ? 'eventual winners' : 'the rest',
            pts,
            col: [STATS_COL.gold, STATS_COL.stone, STATS_COL.blue][i],
          });
      });
      return kcHtml`<h3 style="margin-top:12px">${name}</h3>${statsLines(ser)}`;
    };
    html.push(
      statsCard(
        'How realms grow',
        [
          mk((p) => p.provinces, 'Provinces held'),
          mk((p) => p.gold, 'Treasury (gold)'),
          mk((p) => p.str, 'Army strength (led + garrison)'),
          mk((p) => p.heroes, 'Heroes in service'),
        ],
        'Average per realm at the end of each turn. Where a game has finished, eventual winners are drawn apart from the rest — the gap between the two lines is what winning looks like in this ruleset, and the turn where it opens is where the game is decided.',
      ),
    );
  }
  // 5. orders
  {
    const mix = (sub) => {
      const m = {};
      let tot = 0;
      sub.forEach((r) =>
        Object.values((r.orders || {}).chars || {}).forEach((c) =>
          (c.ph || []).forEach((o) => {
            m[o.a] = (m[o.a] || 0) + 1;
            tot++;
          }),
        ),
      );
      return { m, tot };
    };
    const H = mix(rows.filter((r) => !r.is_bot)),
      Bt = mix(rows.filter((r) => r.is_bot)),
      Wn = mix(rows.filter((r) => isWinner(r))),
      Ls = mix(rows.filter((r) => finishedGames.has(r.game_id) && !isWinner(r)));
    const acts = [...new Set([...Object.keys(H.m), ...Object.keys(Bt.m)])].sort(
      (a, b) => (H.m[b] || 0) + (Bt.m[b] || 0) - ((H.m[a] || 0) + (Bt.m[a] || 0)),
    );
    const lab = (a) => STATS_ACTION_LABEL[a] || a.replace(/_/g, ' ');
    const twoCol = (A, B, an, bn) =>
      kcHtml`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><h3>${an} (${A.tot} character-phases)</h3>${statsBars(
        acts.map((a) => ({ label: lab(a), v: _pct(A.m[a] || 0, A.tot), txt: `${_pct(A.m[a] || 0, A.tot)}%` })),
        { labelW: 110, max: 60 },
      )}</div><div><h3>${bn} (${B.tot})</h3>${statsBars(
        acts.map((a) => ({
          label: lab(a),
          v: _pct(B.m[a] || 0, B.tot),
          txt: `${_pct(B.m[a] || 0, B.tot)}%`,
          col: STATS_COL.forest,
        })),
        { labelW: 110, max: 60 },
      )}</div></div>`;
    const ob = [twoCol(H, Bt, 'Humans', 'Bots')];
    if (Wn.tot && Ls.tot)
      ob.push(kcHtml`<div style="margin-top:14px">${twoCol(Wn, Ls, 'Eventual winners', 'The rest')}</div>`);
    html.push(
      statsCard(
        'What players order',
        ob,
        'Share of every character-phase given each order. Orders humans give that bots never do (and the reverse) are the first thing to teach the bots; orders winners give more than losers are the ones that matter. A "defend" share above ~40% usually means idle heroes.',
      ),
    );
    // recruits by unit type
    const rec = {};
    rows.forEach((r) =>
      Object.values((r.orders || {}).chars || {}).forEach((c) =>
        (c.ph || []).forEach((o) => {
          if (o.a !== 'recruit' || !o.t) return;
          const m = String(o.t).match(/^([^|]+)\|(\d+)/);
          if (m) rec[m[1]] = (rec[m[1]] || 0) + parseInt(m[2]);
        }),
      ),
    );
    const inPlay = {};
    rows
      .filter((r) => r.post)
      .forEach((r) =>
        (r.post.characters || []).forEach((c) =>
          (c.units || []).forEach((u) => {
            inPlay[u.t] = (inPlay[u.t] || 0) + 1;
          }),
        ),
      );
    const types = Object.keys(ARMY_COST_MASTER)
      .filter((t) => rec[t] || inPlay[t])
      .sort((a, b) => (rec[b] || 0) - (rec[a] || 0));
    const never = Object.keys(ARMY_COST_MASTER).filter((t) => !rec[t] && !inPlay[t] && !/Garrison/.test(t));
    html.push(
      statsCard(
        'Units recruited',
        [
          statsBars(
            types.slice(0, 24).map((t) => ({
              label: t,
              v: rec[t] || 0,
              txt: `${rec[t] || 0} ordered · ${inPlay[t] || 0} unit-turns led`,
            })),
            { labelW: 150 },
          ),
          never.length
            ? kcHtml`<div style="font-size:.78rem;color:var(--stone);margin-top:8px">Never recruited or led in these rows: ${never.join(', ')}.</div>`
            : '',
        ],
        'Units ordered by type (from Recruit orders) beside how often each type is actually seen in a led column. A unit nobody buys is either priced wrong, unavailable, or not understood.',
      ),
    );
  }
  // 6. battles
  {
    const B = [];
    const seen = new Set();
    rows.forEach((r) =>
      (((r.outcomes || {}).battles || {}).list || []).forEach((b) => {
        const k =
          r.game_id + '#' + r.turn + '#' + b.ph + '#' + b.prov + '#' + b.atkChar + '#' + b.atkStr + '#' + b.defStr;
        if (seen.has(k)) return;
        seen.add(k);
        B.push({ ...b, game: r.game_id, turn: r.turn, atkBot: r.is_bot && b.atkPi === r.player_index });
      }),
    );
    if (B.length) {
      const buckets = [
        ['< 0.5×', 0, 0.5],
        ['0.5–0.8×', 0.5, 0.8],
        ['0.8–1.25× (even)', 0.8, 1.25],
        ['1.25–2×', 1.25, 2],
        ['2–3×', 2, 3],
        ['3–4×', 3, 4],
        ['≥ 4×', 4, 1e9],
      ];
      const items = buckets
        .map(([label, lo, hi]) => {
          const sub = B.filter((b) => {
            const r = b.defStr > 0 ? b.atkStr / b.defStr : 1e9;
            return r >= lo && r < hi;
          });
          if (!sub.length) return null;
          const exp = _avg(sub.map((b) => 100 * fortuneWinChance(b.defStr > 0 ? b.atkStr / b.defStr : 1e9)));
          return {
            label,
            v: _pct(sub.filter((b) => b.won).length, sub.length),
            mark: exp,
            txt: `${_pct(sub.filter((b) => b.won).length, sub.length)}% attacker wins · expected ${Math.round(exp)}% · ${sub.length} battle${sub.length !== 1 ? 's' : ''}`,
          };
        })
        .filter(Boolean);
      const byT = {};
      B.forEach((b) => {
        const o = byT[b.terrain] || (byT[b.terrain] = { n: 0, w: 0 });
        o.n++;
        if (b.won) o.w++;
      });
      const byK = {};
      B.forEach((b) => {
        const o = byK[b.kind] || (byK[b.kind] = { n: 0, w: 0, al: 0, dl: 0 });
        o.n++;
        if (b.won) o.w++;
        o.al += b.atkLost || 0;
        o.dl += b.defLost || 0;
      });
      const kindLab = {
        neutral: 'vs neutral defenders',
        garrison: 'vs an enemy garrison',
        guard: 'vs a neutral chieftain',
        pvp: 'vs an enemy commander',
      };
      html.push(
        statsCard(
          'Battles',
          kcHtml`<div style="font-size:.85rem;margin-bottom:8px">${B.length} battles · attackers won <strong>${_pct(B.filter((b) => b.won).length, B.length)}%</strong> · average losses ${_avg(B.map((b) => b.atkLost || 0)).toFixed(2)} units (attacker) / ${_avg(B.map((b) => b.defLost || 0)).toFixed(2)} (defender) · ${B.filter((b) => b.carry > 0).length} carried on into a later phase.</div>
         <h3>Attacker win rate by strength ratio (attacker ÷ defender, before the dice)</h3>${statsBars(items, { labelW: 130, max: 100 })}
         <div style="font-size:.76rem;color:var(--stone);margin:4px 0 12px">The blue tick is what the fortune-of-battle curve says should happen at that ratio (2× → 80%, 3× → 90%, 4× → certain). Bars well off their ticks over many battles mean something outside the strength maths is deciding fights — pre-battle magic, archery, or a bug.</div>
         <h3>By terrain</h3>${statsBars(
           Object.entries(byT).map(([t, o]) => ({
             label: t,
             v: _pct(o.w, o.n),
             txt: `${_pct(o.w, o.n)}% attacker wins · ${o.n}`,
             col: STATS_COL.forest,
           })),
           { max: 100 },
         )}
         <h3 style="margin-top:12px">By opponent</h3>${statsBars(
           Object.entries(byK).map(([k, o]) => ({
             label: kindLab[k] || k,
             v: _pct(o.w, o.n),
             txt: `${_pct(o.w, o.n)}% attacker wins · ${o.n} · losses ${(o.al / o.n).toFixed(1)} / ${(o.dl / o.n).toFixed(1)}`,
             col: STATS_COL.blue,
           })),
           { labelW: 170, max: 100 },
         )}`,
          "Every field battle, once (a battle appears in both sides' rows; it is counted here a single time).",
        ),
      );
    }
  }
  // 7. lairs
  {
    const E = [];
    rows.forEach((r) =>
      (((r.outcomes || {}).encounters || {}).list || []).forEach((e) => E.push({ ...e, bot: r.is_bot })),
    );
    if (E.length) {
      const byP = {};
      E.forEach((e) => {
        const o = byP[e.power || '?'] || (byP[e.power || '?'] = { n: 0, w: 0, f: 0, k: 0, d: [] });
        o.n++;
        if (e.won) o.w++;
        if (e.fled) o.f++;
        if (e.killed) o.k++;
        o.d.push(e.dmg || 0);
      });
      const order = ['Weak', 'Moderate', 'Powerful', 'Legendary'];
      html.push(
        statsCard('Lair fights', [
          statsBars(
            Object.entries(byP)
              .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
              .map(([p, o]) => ({
                label: p,
                v: _pct(o.w, o.n),
                txt: `${_pct(o.w, o.n)}% cleared · ${o.n} fight${o.n !== 1 ? 's' : ''} · ${o.f} fled · ${o.k} hero${o.k !== 1 ? 'es' : ''} killed · avg ${_avg(o.d).toFixed(1)} damage taken`,
              })),
            { max: 100 },
          ),
          kcHtml`<div style="font-size:.78rem;color:var(--stone);margin-top:8px">Bots fought ${E.filter((e) => e.bot).length} of these; humans ${E.filter((e) => !e.bot).length}. The guardian ladder was tuned to a ~95% clear rate for a hero built for the band — a band far below that is being attempted too early.</div>`,
        ]),
      );
    }
  }
  // 8. spells
  {
    const S = {};
    rows.forEach((r) =>
      (((r.outcomes || {}).spells || {}).list || []).forEach((s) => {
        const o = S[s.spell] || (S[s.spell] = { n: 0, ok: 0, bot: 0, ch: [] });
        o.n++;
        if (s.ok) o.ok++;
        if (r.is_bot) o.bot++;
        o.ch.push(s.chance || 0);
      }),
    );
    const ents = Object.entries(S).sort((a, b) => b[1].n - a[1].n);
    if (ents.length) {
      const never = Object.keys(SPELL_DEFS_P || {}).filter((n) => SPELL_DEFS_P[n] && SPELL_DEFS_P[n].phase && !S[n]);
      html.push(
        statsCard(
          'Spells cast (phase orders)',
          [
            statsBars(
              ents.map(([n, o]) => ({
                label: n,
                v: o.n,
                txt: `${o.n} cast · ${_pct(o.ok, o.n)}% took (avg chance ${Math.round(_avg(o.ch))}%) · ${o.bot} by bots`,
              })),
              { labelW: 150 },
            ),
            never.length
              ? kcHtml`<div style="font-size:.78rem;color:var(--stone);margin-top:8px">Never cast as a phase order: ${never.join(', ')}.</div>`
              : '',
          ],
          'Battle-magic and duel spells are not counted here (they are chosen in encounter plans, not as orders).',
        ),
      );
    }
  }
  // 9. deaths & captures
  {
    const D = [];
    const seen = new Set();
    rows.forEach((r) =>
      (((r.outcomes || {}).deaths || {}).list || []).forEach((d) => {
        const k = r.game_id + '#' + r.turn + '#' + d.charId;
        if (seen.has(k)) return;
        seen.add(k);
        D.push({ ...d, game: r.game_id, turn: r.turn });
      }),
    );
    const C = [];
    const seenC = new Set();
    rows.forEach((r) =>
      (((r.outcomes || {}).captures || {}).list || []).forEach((c) => {
        const k = r.game_id + '#' + r.turn + '#' + c.ph + '#' + c.prov + '#' + c.to;
        if (seenC.has(k)) return;
        seenC.add(k);
        C.push(c);
      }),
    );
    const byTurn = {};
    D.forEach((d) => {
      byTurn[d.turn] = (byTurn[d.turn] || 0) + 1;
    });
    const how = {};
    D.forEach((d) => {
      how[d.how || 'other'] = (how[d.how || 'other'] || 0) + 1;
    });
    const Dr = D.filter((d) => d.pi != null),
      Dn = D.length - Dr.length;
    html.push(
      statsCard(
        'Deaths and conquests',
        kcHtml`<div style="font-size:.85rem">${Dr.length} realm character${Dr.length !== 1 ? 's' : ''} killed (${Dr.filter((d) => d.king).length} king${Dr.filter((d) => d.king).length !== 1 ? 's' : ''}) over ${rows.length} realm-turns — one every ${Dr.length ? (rows.length / Dr.length).toFixed(1) : '∞'} realm-turns — plus ${Dn} neutral hero${Dn !== 1 ? 'es' : ''} / chieftain${Dn !== 1 ? 's' : ''} slain. ${C.length} provinces changed hands: ${C.filter((c) => c.from == null).length} taken from neutrals, ${C.filter((c) => c.from != null).length} taken from rivals.</div>
      <h3 style="margin-top:12px">Deaths by cause (realm characters and neutrals)</h3>${statsBars(
        Object.entries(how).map(([k, n]) => ({
          label:
            {
              character: 'killed by an enemy character',
              neutral: 'killed by a neutral / guardian',
              other: 'other (duel, spell, execution…)',
            }[k] || k,
          v: n,
        })),
        { labelW: 220 },
      )}
      <h3 style="margin-top:12px">Deaths by turn</h3>${statsBars(
        Object.entries(byTurn)
          .sort((a, b) => +a[0] - +b[0])
          .map(([t, n]) => ({ label: 'turn ' + t, v: n, col: STATS_COL.stone })),
        { labelW: 70 },
      )}`,
      ),
    );
  }
  body.innerHTML = kcHtml`${html}`;
}
// ── exports ──
function _csv(rows, cols) {
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => esc(typeof c === 'function' ? c(r) : r[c])).join(',')))
    .join('\n');
}
function _download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
function exportStats(kind) {
  if (!_stats.rows) return;
  const { rows, results } = _statsFilter();
  const stamp = new Date().toISOString().slice(0, 10);
  const pk = (o, k) => (o || {})[k];
  if (kind === 'turns') {
    const cols = [
      'game_id',
      'turn',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      (r) => pk(r.pre, 'gold'),
      (r) => pk(r.post, 'gold'),
      (r) => pk(r.pre, 'provinces'),
      (r) => pk(r.post, 'provinces'),
      (r) => pk(r.post, 'tax'),
      (r) => pk(r.post, 'taxShare'),
      (r) => pk(r.post, 'units'),
      (r) => pk(r.post, 'str'),
      (r) => pk(r.post, 'heroes'),
      (r) => pk(r.post, 'kingAlive'),
      (r) => pk(r.post, 'items'),
      (r) => pk(r.post, 'discoveries'),
      (r) => pk(pk(r.outcomes, 'battles'), 'fought'),
      (r) => pk(pk(r.outcomes, 'battles'), 'won'),
      (r) => pk(pk(r.outcomes, 'encounters'), 'fought'),
      (r) => pk(pk(r.outcomes, 'encounters'), 'won'),
      (r) => pk(pk(r.outcomes, 'captures'), 'gained'),
      (r) => pk(pk(r.outcomes, 'captures'), 'lost'),
      (r) => pk(pk(r.outcomes, 'deaths'), 'own'),
      (r) => pk(pk(r.outcomes, 'deaths'), 'killed'),
      (r) => pk(pk(r.outcomes, 'spells'), 'cast'),
      (r) => pk(r.outcomes, 'rank'),
      (r) => pk(r.outcomes, 'score'),
      (r) =>
        Object.values(pk(r.orders, 'chars') || {})
          .map((c) => (c.ph || []).map((o) => o.a).join('>'))
          .join(' | '),
    ];
    const names = [
      'game_id',
      'turn',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      'gold_before',
      'gold_after',
      'provinces_before',
      'provinces_after',
      'tax',
      'tax_share_pct',
      'units',
      'army_strength',
      'heroes',
      'king_alive',
      'items',
      'discoveries',
      'battles',
      'battles_won',
      'lair_fights',
      'lairs_cleared',
      'provinces_gained',
      'provinces_lost',
      'own_deaths',
      'enemies_killed',
      'spells_cast',
      'rank',
      'score',
      'orders_by_character',
    ];
    _download(`kc-turns-${stamp}.csv`, _csv(rows, cols).replace(/^[^\n]*/, names.join(',')));
  } else if (kind === 'battles') {
    const B = [];
    const seen = new Set();
    rows.forEach((r) =>
      (pk(pk(r.outcomes, 'battles'), 'list') || []).forEach((b) => {
        const k =
          r.game_id + '#' + r.turn + '#' + b.ph + '#' + b.prov + '#' + b.atkChar + '#' + b.atkStr + '#' + b.defStr;
        if (seen.has(k)) return;
        seen.add(k);
        B.push({
          game_id: r.game_id,
          turn: r.turn,
          phase: b.ph,
          province: b.prov,
          terrain: b.terrain,
          kind: b.kind,
          attacker: b.atkPi,
          defender: b.defPi,
          atk_strength: b.atkStr,
          def_strength: b.defStr,
          ratio: b.defStr > 0 ? Math.round((100 * b.atkStr) / b.defStr) / 100 : '',
          fortune_swing: b.S,
          expected_atk_win_pct: Math.round(100 * fortuneWinChance(b.defStr > 0 ? b.atkStr / b.defStr : 1e9)),
          attacker_won: b.won,
          atk_units: b.atkUnits,
          def_units: b.defUnits,
          atk_lost: b.atkLost,
          def_lost: b.defLost,
          carry_on_round: b.carry,
        });
      }),
    );
    _download(`kc-battles-${stamp}.csv`, _csv(B, Object.keys(B[0] || { game_id: 1 })));
  } else if (kind === 'results') {
    const cols = [
      'game_id',
      'game_name',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      'rank',
      'score',
      'winner',
      'victory',
      'turns',
      'out_turn',
      'out_how',
      (r) => pk(r.setup, 'realms'),
      (r) => pk(r.setup, 'humans'),
      (r) => pk(r.setup, 'seaPct'),
      (r) => pk(r.final, 'provinces'),
      (r) => pk(r.final, 'gold'),
      (r) => pk(r.final, 'str'),
      (r) => pk(r.final, 'heroes'),
    ];
    const names = [
      'game_id',
      'game_name',
      'player_index',
      'realm',
      'is_bot',
      'bot_difficulty',
      'race',
      'alignment',
      'rank',
      'score',
      'winner',
      'victory',
      'turns',
      'out_turn',
      'out_how',
      'realms',
      'humans',
      'sea_pct',
      'final_provinces',
      'final_gold',
      'final_strength',
      'final_heroes',
    ];
    _download(`kc-results-${stamp}.csv`, _csv(results, cols).replace(/^[^\n]*/, names.join(',')));
  } else if (kind === 'json') {
    // (situation → orders → outcome) examples, one per realm-turn, with the realm's final result attached
    const byKey = {};
    results.forEach((r) => {
      byKey[r.game_id + '#' + r.player_index] = r;
    });
    const out = rows.map((r) => {
      const fr = byKey[r.game_id + '#' + r.player_index];
      return {
        game_id: r.game_id,
        turn: r.turn,
        player_index: r.player_index,
        is_bot: r.is_bot,
        bot_difficulty: r.bot_difficulty,
        realm: r.realm,
        race: r.race,
        alignment: r.alignment,
        situation: r.pre,
        orders: r.orders,
        result: r.post,
        outcomes: r.outcomes,
        final: fr
          ? { rank: fr.rank, winner: fr.winner, victory: fr.victory, turns: fr.turns, out_how: fr.out_how }
          : null,
      };
    });
    _download(
      `kc-training-${stamp}.json`,
      JSON.stringify({ v: KC_TEL_V, exported: new Date().toISOString(), build: KC_BUILD_STAMP, rows: out }, null, 0),
      'application/json',
    );
  }
}
async function forgetDeletedGames() {
  if (!_stats.rows) return;
  // A game is "deleted" only if no games row exists for it, whoever runs it: the statistics on screen can include
  // other GMs' games (the Overlord sees every game's, since P0-22), so _stats.games (this account's own) can't decide.
  const recorded = [...new Set([..._stats.rows.map((r) => r.game_id), ..._stats.results.map((r) => r.game_id)])];
  const live = new Set();
  for (let i = 0; i < recorded.length; i += 100) {
    const { data, error } = await sb
      .from('games')
      .select('id')
      .in('id', recorded.slice(i, i + 100));
    if (error) {
      alert('Could not check which games still exist: ' + error.message + '. Nothing was deleted.');
      return;
    }
    (data || []).forEach((g) => live.add(String(g.id)));
  }
  const gone = recorded.filter((id) => !live.has(String(id)));
  if (!gone.length) {
    alert('Every recorded game still exists — nothing to forget.');
    return;
  }
  if (
    !confirm(
      `Delete the recorded turns and results of ${gone.length} game${gone.length !== 1 ? 's' : ''} that no longer exist? This cannot be undone.`,
    )
  )
    return;
  await sb.from('turn_events').delete().in('game_id', gone);
  await sb.from('game_results').delete().in('game_id', gone);
  if (_kcHasLb) await sb.from('game_records').delete().in('game_id', gone); // and their Hall-of-Fame rows
  openStats(true);
}
