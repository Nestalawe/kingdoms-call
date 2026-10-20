// ── JOIN GAME ────
async function showJoinGame(gameId, gameName, maxP, joined, gmName, worldSize) {
  joiningGame = { id: gameId, name: gameName, maxP, joined, gmName, worldSize };
  joinSkills = {};
  document.getElementById('join-game-title').textContent = `Join: ${gameName}`;
  document.getElementById('join-king-name').value = '';
  document.getElementById('join-msg').innerHTML = '';
  renderSkillGrid();
  show('sec-join');

  // Fetch existing players' alignments to enforce unique Divine/Undead
  const { data: slots } = await fetchGameSlots([gameId]);
  const takenAlignments = new Set((slots || []).map((s) => s.alignment).filter(Boolean));

  // Update alignment dropdown
  const alignSel = document.getElementById('join-alignment');
  const UNIQUE_ALIGNS = ['Divine', 'Undead'];
  let warningParts = [];
  Array.from(alignSel.options).forEach((opt) => {
    if (UNIQUE_ALIGNS.includes(opt.value) && takenAlignments.has(opt.value)) {
      opt.disabled = true;
      opt.text = `${opt.value} (taken)`;
      if (alignSel.value === opt.value) alignSel.value = 'Neutral';
      warningParts.push(opt.value);
    } else {
      opt.disabled = false;
      opt.text = opt.value; // restore clean text from value attribute
    }
  });

  // Show info about taken alignments
  const infoEl = document.getElementById('join-game-info');
  const takenNote =
    warningParts.length > 0
      ? kcHtml`<div class="msg-warning" style="margin-top:6px">⚠ <strong>${warningParts.join(' and ')}</strong> alignment${warningParts.length > 1 ? 's are' : ' is'} already taken in this game — only one player per game may be Divine or Undead.</div>`
      : '';
  const gmBox = kcHtml`<div style="background:#f5f0e8;border:1px solid var(--gold);border-radius:3px;padding:8px 12px;font-size:.82rem;line-height:1.6;margin-bottom:8px">
      <div>\u{1F451} <strong>Game Master:</strong> ${joiningGame?.gmName || 'the Game Master'}</div>
      <div>\u{1F5FA}\uFE0F <strong>World size:</strong> ${joiningGame?.worldSize || '—'}</div>
    </div>`;
  infoEl.innerHTML = kcHtml`${gmBox}<div class="msg-info">${joined}/${maxP} players have already joined. There ${maxP - joined === 1 ? 'is' : 'are'} ${maxP - joined} open slot${maxP - joined === 1 ? '' : 's'}.</div>${takenNote}`;
  updateAlignmentDesc();
  updateRaceDesc();
  updateTemperDesc();
}

// Skill descriptions shown on hover (join screen). Edit these as skill mechanics change.
const SKILL_INFO = {
  melee:
    'Close-quarters fighting. Raises your hit chance and damage in duels and monster encounters, and strengthens your character leading front-line troops. The King starts with Melee 2.',
  archery: kcHtml`Ranged combat. In an army battle it sharpens the <strong>pre-battle volley</strong> your ranged units loose before the lines close (each shot does 30% of the shooting unit's own strength, +10% per Archery level, doubled against winged riders; no unit can lose more than 40% of its strength to arrows, 80% for a winged rider) — and every level lifts the missile units you lead by <strong>+5% strength</strong> in the battle itself (Archery 5 = +25%). In personal combat a Fire action hits at 30% + 10% per level (then +5% a level past 5, capped 80%) for 1–3 damage plus half your Archery; at <strong>Archery 3 and above you loose two arrows per Fire action</strong>. A Fire action must first reach bow range — from spell range that is a speed check, from melee you must break away — and <strong>every level of Archery adds +5% to both of those checks</strong> (fieldcraft). An archer standing at bow range also gets a free <strong>parting shot</strong> at any foe who closes into melee. The King starts with Archery 1.`,
  tactical:
    'Battlefield command. Adds roughly +20% strength per level to your land armies in a battle — the single biggest force multiplier when attacking or defending provinces (land and air units — flyers included; fleets use Naval instead; land battles only).',
  march:
    'Marching & coordination. Improves the chance that your other armies link up as reinforcements ("contingent unify") when you attack the same province, and speeds your march: every unit you lead except flyers gains +0/+0/+1/+1/+2/+3 movement at March 0-5, and the column moves at its slowest unit\'s pace.',
  naval: kcHtml`Seamanship. Boosts the strength of your fleets and sea creatures in every battle, on land or at sea (+20% per level), and speeds them across the water. <strong>Sea movement points = the SLOWEST sea unit you lead, after each unit is improved by your Naval bonus</strong> — a squadron sails at the pace of its worst ship, just as a land column marches at the pace of its slowest army. The Naval bonus works like March: every ship and sea-beast gains +0/+0/+1/+1/+2/+3 at Naval 0-5, whatever its speed. A hero leading <em>no</em> armies always has 5 sea movement points — Naval skill is command of a fleet, not of a rowing boat. Essential for a maritime power.`,
  sage: 'Scholarship. Unlocks the Research order (Sage 1+): each level gives a 5% chance per Research to make a permanent Sage Discovery (realm-wide bonuses). Also raises your chance of encounters while exploring. The King starts with Sage 1.',
  spy: 'Espionage. Higher Spy reveals more detail on enemy provinces and characters, and lets your Spy orders reach further. Your best defence against being spied on, too.',
  thief:
    "Larceny. Improves success when stealing gold or magic items — via the Steal order (a hero's pack, their strongbox, or a garrison paymaster), by pickpocketing during encounters, and when lifting a lair's hoard (10% of the original hoard per level, capped at 5).",
  druid: kcHtml`Beast mastery. Required to command creature and monster armies without penalty — each level you fall short of an army's requirement costs it ~20% strength, and <strong>each level you hold above a Creature or Monster unit's requirement adds +20%</strong> (Druid counted to 9, up to +100%; where your realm waives the requirement every level counts). From Druid 3 a natural beast's blows land at half force against you in a personal encounter. Higher Druid unlocks the most powerful Creatures and Monsters.`,
  explorer:
    'Pathfinding. Speeds up how quickly you explore your provinces each turn, revealing hidden lairs and terrain sooner so you can search and settle faster.',
  white:
    'White Magic — holy spells: heal and bless, resurrect fallen heroes, and smite the undead and evil. Your level sets how many spells you can cast (Divine realms start with White 1).',
  psychic:
    'Psychic Magic — mind spells: Psychic Blast (direct damage that ignores armies), Telekinetic Storm, and Clairvoyance for long-range intelligence.',
  illusory:
    'Illusory Magic — deception spells: Mirror Image, Phantasmal Armies, Illusory Terrain, Invisibility and Hide Lairs. Confuse enemy intelligence and battles.',
  elemental:
    'Elemental Magic — destruction spells: Lightning Bolt, Fireball, Earthquake, Flood and Elemental Summon. Raw offensive power against armies and provinces.',
  // this blurb still advertised "Kill Enemy", a spell that does not exist in the engine
  // (see the note beside SPELLS_BY_SCHOOL in the GM portal). The level-5 Necromancy spell is Plague.
  necromancy:
    'Necromancy — death magic: raise Skeletal Armies from battlefield graves, Control Undead, Curse, Hand of Death and Plague (Undead realms start with Necromancy 1).',
};
// Column grouping for the join screen: martial | special | magic
const SKILL_COLUMNS = [
  { head: '⚔ Martial', skills: ['melee', 'archery', 'tactical', 'march', 'naval'] },
  { head: '✦ Special', skills: ['sage', 'spy', 'thief', 'druid', 'explorer'] },
  { head: '✨ Magic', skills: KC_MAGIC_SCHOOLS.slice() },
];

function renderSkillGrid() {
  const spent = Object.values(joinSkills).reduce((s, v) => s + v, 0);
  const remaining = 4 - spent;
  document.getElementById('join-pts-remaining').textContent =
    `${remaining} point${remaining !== 1 ? 's' : ''} remaining`;
  const pip = (skill) => {
    const lvl = joinSkills[skill] || 0;
    const displayName = SKILL_LABELS[skill] || skill;
    return kcHtml`<div class="skill-pip">
      <button onclick="adjustSkill(${kcArg(skill)},-1)" ${lvl <= 0 ? 'disabled' : ''}>−</button>
      <span class="sk-name" onmousemove="showSkillTip(event,${kcArg(skill)})" onmouseleave="hideSkillTip()">${displayName}</span>
      <span class="sk-val">${lvl}</span>
      <button onclick="adjustSkill(${kcArg(skill)},1)" ${remaining <= 0 || lvl >= 2 ? 'disabled' : ''}>+</button>
    </div>`;
  };
  document.getElementById('join-skills-grid').innerHTML = kcHtml`<div class="skill-cols">${SKILL_COLUMNS.map(
    (col) => kcHtml`<div class="skill-col"><div class="skill-col-head">${col.head}</div>${col.skills.map(pip)}</div>`,
  )}</div>`;
}

function showSkillTip(ev, skill) {
  let tip = document.getElementById('skill-info-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'skill-info-tip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = kcHtml`<strong>${SKILL_LABELS[skill] || skill}</strong><br>${SKILL_INFO[skill] || ''}`;
  tip.style.display = 'block';
  // Keep the tooltip on-screen near the cursor
  const pad = 14,
    w = tip.offsetWidth || 250,
    h = tip.offsetHeight || 80;
  let x = ev.clientX + pad,
    y = ev.clientY + pad;
  if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
  tip.style.left = Math.max(8, x) + 'px';
  tip.style.top = Math.max(8, y) + 'px';
}
function hideSkillTip() {
  const tip = document.getElementById('skill-info-tip');
  if (tip) tip.style.display = 'none';
}

function adjustSkill(skill, delta) {
  const spent = Object.values(joinSkills).reduce((s, v) => s + v, 0);
  const current = joinSkills[skill] || 0;
  if (delta > 0) {
    if (spent >= 4 || current >= 2) return;
  } else {
    if (current <= 0) return;
  }
  joinSkills[skill] = current + delta;
  if (joinSkills[skill] === 0) delete joinSkills[skill];
  renderSkillGrid();
}

async function joinGame() {
  const kingName = document.getElementById('join-king-name').value.trim();
  const kingdomName = document.getElementById('join-kingdom-name').value.trim();
  const race = document.getElementById('join-race').value;
  const alignment = document.getElementById('join-alignment').value;
  const temper = document.getElementById('join-temper').value;
  const msg = document.getElementById('join-msg');
  if (!kingName) {
    msg.innerHTML = '<div class="msg-error">Please enter your King\'s name.</div>';
    return;
  }
  if (!kingdomName) {
    msg.innerHTML = '<div class="msg-error">Please name your Realm.</div>';
    return;
  }
  const spent = Object.values(joinSkills).reduce((s, v) => s + v, 0);
  if (spent < 4) {
    msg.innerHTML = kcHtml`<div class="msg-warning">You still have ${4 - spent} skill point${4 - spent !== 1 ? 's' : ''} to spend. Are you sure? <button class="btn btn-gold" style="padding:4px 10px;margin-left:8px" onclick="doJoinGame(${kcArg(String(joiningGame.id))})">Join Anyway</button></div>`;
    return;
  }
  await doJoinGame(joiningGame.id);
}

// "Make sure a player cannot sign up for the same game more than once." The OPEN GAMES list already
// hides a game you are in (`myGameIds.has(g.id)`), but that is a view filter, not a guard — a stale
// tab, a second window, the browser back button or a double-click on
// the Join button all reach this function with the list's opinion out of date, and nothing here ever
// re-checked it. Two guards, the same defence-in-depth pattern the alignment and private-visibility
// checks already use:
// 1. `_joinInFlight` closes the double-click race, which no database round-trip can (both inserts
// would be in flight before either returned).
// 2. A submit-time read of game_players for this game AND this user, so a stale page cannot insert
// a second realm however it got here.
// 2026-09-16 UPDATE: Toby has now run
// create unique index if not exists game_players_one_per_user on game_players (game_id, user_id);
// so the database itself is the third and absolute guard — it covers anything talking to Supabase
// directly, not just this portal. A violation comes back as Postgres error code 23505, which is
// handled at the insert below and turned into the SAME sentence the portal-side check uses, so the
// three guards never disagree in front of the player. The two portal guards are kept: they are
// faster (no failed round-trip) and _joinInFlight still closes the double-click race that the
// database can only resolve AFTER both inserts have been sent.
let _joinInFlight = false;
// One sentence for "you are already in this game", wherever it is detected — portal check or
// database constraint. Kept in one place so the three guards can never word it differently.
const JOIN_DUP_MSG = kcHtml`You have already joined this game — a player may hold only one realm in any game. Open it from <strong>My Games</strong> instead.`;
async function doJoinGame(gameId) {
  if (_joinInFlight) return;
  const kingName = document.getElementById('join-king-name').value.trim();
  const kingdomName = document.getElementById('join-kingdom-name').value.trim() || kingName;
  const race = document.getElementById('join-race').value;
  const alignment = document.getElementById('join-alignment').value;
  const temper = document.getElementById('join-temper').value;
  const msg = document.getElementById('join-msg');

  // Re-check alignment uniqueness at submit time (in case someone bypassed the dropdown)
  const UNIQUE_ALIGNS_CHECK = ['Divine', 'Undead'];
  if (UNIQUE_ALIGNS_CHECK.includes(alignment)) {
    const { data: slots2 } = await fetchGameSlots([gameId]);
    const takenNow = new Set((slots2 || []).map((s) => s.alignment).filter(Boolean));
    if (takenNow.has(alignment)) {
      msg.innerHTML = kcHtml`<div class="msg-error">⚠ The <strong>${alignment}</strong> alignment is already taken in this game. Only one player per game may choose Divine or Undead. Please choose a different alignment.</div>`;
      return;
    }
  }
  // ── ONE REALM PER PLAYER PER GAME ── checked at submit time, not just hidden from the list.
  {
    const { data: mine, error: meErr } = await sb
      .from('game_players')
      .select('id,player_index')
      .eq('game_id', gameId)
      .eq('user_id', currentUser.id);
    if (meErr) {
      msg.innerHTML = kcHtml`<div class="msg-error">${meErr.message}</div>`;
      return;
    }
    if (mine && mine.length) {
      msg.innerHTML = kcHtml`<div class="msg-error">${JOIN_DUP_MSG}</div>`;
      setTimeout(() => {
        show('sec-games');
        loadAllGames();
      }, 2500);
      return;
    }
  }
  _joinInFlight = true;
  msg.innerHTML = '<div class="msg-info">Joining game…</div>';

  // Defense-in-depth: re-check visibility at submit time. A Private game may only be joined by an
  // invited player, even if they somehow reached this flow without seeing the (hidden) card.
  {
    const { data: gRow } = await sb.from('games').select('game_state,status').eq('id', gameId).single();
    let cfg = {};
    try {
      cfg = typeof gRow?.game_state === 'string' ? JSON.parse(gRow.game_state) : gRow?.game_state || {};
    } catch (e) {}
    if (gRow?.status === 'setup' && cfg.visibility === 'private') {
      const inv = Array.isArray(cfg.invited) ? cfg.invited : [];
      if (!inv.includes(currentUser.id)) {
        // latched true for the life of the page — every later Join click then hit
        // `if(_joinInFlight)
        // return;` and did nothing at all, with no message to say why. Clear it on every exit path.
        _joinInFlight = false;
        msg.innerHTML =
          '<div class="msg-error">This is a private game and you are not on its invite list. Ask the GM to invite you.</div>';
        return;
      }
    }
  }

  // Find next available player_index
  const { data: existingSlots, error: slotsErr } = await fetchGameSlots([gameId]);
  if (slotsErr) {
    _joinInFlight = false;
    msg.innerHTML = '<div class="msg-error"></div>';
    msg.firstChild.textContent = slotsErr.message;
    return;
  }
  const takenIndices = new Set((existingSlots || []).map((s) => s.player_index));
  const maxP = joiningGame.maxP || 4;
  let nextIndex = 0;
  while (takenIndices.has(nextIndex) && nextIndex < maxP) nextIndex++;
  if (nextIndex >= maxP) {
    _joinInFlight = false;
    msg.innerHTML = '<div class="msg-error">This game is now full.</div>';
    return;
  } // clear the flag — see the private-game note above

  const playerSetup = { kingName, kingdomName, race, alignment, temper, skills: joinSkills };
  const { data: slot, error } = await sb
    .from('game_players')
    .insert({
      game_id: gameId,
      user_id: currentUser.id,
      player_index: nextIndex,
      display_name: kingdomName,
      orders_submitted: false,
      turn_report: JSON.stringify({ playerSetup, status: 'joined', waitingForTurn0: true }),
    })
    .select()
    .single();

  _joinInFlight = false;
  if (error) {
    // ── 2026-09-16: the database's own guard speaking ────
    // game_players_one_per_user (unique on game_id, user_id) rejects a second realm with Postgres
    // 23505. Raw, that reads "duplicate key value violates unique constraint …" — meaningless to a
    // player and alarming besides. Show the same sentence the portal-side check uses and send them
    // to My Games, so a race the two portal guards cannot see still ends in a sensible place.
    // (Supabase surfaces the code on error.code; the message text is matched too in case a proxy or
    // a future client version drops the code field.)
    // P0-20: game_players_one_per_number refuses a slot number someone took a moment ago: not a second realm.
    if (/one_per_number/.test(error.message || '')) {
      msg.innerHTML =
        '<div class="msg-error">Another player joined this game at the same moment. Please press Join again.</div>';
      return;
    }
    const _dup = error.code === '23505' || /duplicate key|unique constraint|one_per_user/i.test(error.message || '');
    if (_dup) {
      msg.innerHTML = kcHtml`<div class="msg-error">${JOIN_DUP_MSG}</div>`;
      setTimeout(() => {
        show('sec-games');
        loadAllGames();
      }, 2500);
      return;
    }
    msg.innerHTML = kcHtml`<div class="msg-error">${error.message}<br><small>If this keeps happening, try refreshing the page and joining again.</small></div>`;
    return;
  }
  msg.innerHTML = '<div class="msg-success">You have joined the game! Waiting for the GM to start Turn 0.</div>';
  setTimeout(() => {
    show('sec-games');
    loadAllGames();
  }, 2000);
}

// The Chronicle's "Intelligence Reports" section. `inner` = the turn's logged intel (title
// dispatches, standings, [Intelligence] lines). On the current-turn view it ends with #report-intel,
// which renderReportView fills with the province reports, spied provinces and spy activity.
function intelSectionShell(inner) {
  const host = viewedTurn == null ? kcHtml`<div id="report-intel"></div>` : '';
  return kcHtml`<div class="char-chronicle intel-plain" id="intel-reports-section" style="margin-bottom:22px;border:1px solid #c8922a;border-radius:3px;overflow:hidden">
        <div class="cc-head" style="font-family:'Cinzel',serif;font-size:.88rem;color:#fff;
          padding:7px 12px;background:#c8922a;display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">👁</span>
          <span style="font-weight:600">Intelligence Reports</span>
          <button type="button" class="cc-toggle" title="Minimise / maximise" aria-expanded="true" onclick="toggleSection(this)">&#9662;</button>
        </div>
        <div style="padding:6px 8px">${inner || ''}${host}</div></div>`;
}
function buildChronicle(log, chars_for_log) {
  const PHASE_NAMES = KC_PHASE_NAMES.slice();
  const PHASE_COLORS = KC_PHASE_COLORS.slice();

  // ── the Reckoning / endgame notice is pinned to the VERY TOP of the Chronicle for EVERY player,
  // above all phase events — it is the most consequential thing that can happen in a turn, and all
  // endgame updates belong in this one prominent place.
  // 2026-09-28 (Toby item 6): the END-OF-GAME report (the "👑 THE RECKONING IS CALLED — …" and
  // "🏆 THE GAME IS DECIDED — …" announcements and the numbered Legacy standings) is lifted OUT of
  // Realm Events and set directly under the Game-is-Decided banner, so it is the first thing every
  // player reads. The engine tags these lines gameEnd:true; older reports are matched by shape.
  const _goActive = !!(currentReport && currentReport.titles && currentReport.titles.gameOver);
  const _GE_HEAD_RE = /^\s*(👑 THE RECKONING IS CALLED —|🏆 THE GAME IS DECIDED —)/;
  const _GE_STAND_RE = /^\s+\d+\.\s.+ — -?\d+ Legacy\b/;
  const _isGameEnd = (e) =>
    !!e &&
    (e.gameEnd ||
      (_goActive && e.charId == null && (_GE_HEAD_RE.test(e.text || '') || _GE_STAND_RE.test(e.text || ''))));
  // A line of report text with some runs marked up (P0-19): the text stays text. _markRuns splits every piece of
  // text, and the inside of every earlier mark, at each match of `re`, as the old replace on the HTML string did;
  // wrap(inner) is a match's markup. _showRuns turns the pieces into a list for kcHtml.
  const _markRuns = (nodes, re, wrap) =>
    nodes.flatMap((n) => {
      if (typeof n !== 'string') return [{ wrap: n.wrap, kids: _markRuns(n.kids, re, wrap) }];
      const out = [];
      let last = 0,
        m;
      re.lastIndex = 0;
      while ((m = re.exec(n))) {
        if (!m[0]) {
          re.lastIndex++;
          continue;
        }
        out.push(n.slice(last, m.index), { wrap, kids: [m[0]] });
        last = m.index + m[0].length;
      }
      out.push(n.slice(last));
      return out.filter((x) => x !== '');
    });
  const _showRuns = (nodes) => nodes.map((n) => (typeof n === 'string' ? n : n.wrap(_showRuns(n.kids))));
  const _reText = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const _gameEndLines = (log || []).filter(_isGameEnd);
  if (_gameEndLines.length) log = log.filter((e) => !_isGameEnd(e));
  const _gameEndHtml = (() => {
    if (!_gameEndLines.length) return '';
    const _realms = ((currentReport && currentReport.allKingdoms) || [])
      .filter((k) => k && k.name)
      .sort((a, b) => b.name.length - a.name.length);
    const _tint = (txt) => {
      let h = [String(txt == null ? '' : txt)];
      _realms.forEach((k) => {
        if (!k.color) return;
        h = _markRuns(
          h,
          new RegExp(_reText(k.name), 'g'),
          (x) => kcHtml`<strong style="color:${reportColour(k.color)}">${x}</strong>`,
        );
      });
      return _showRuns(h);
    };
    const heads = _gameEndLines.filter((e) => !_GE_STAND_RE.test(e.text || ''));
    const rows = _gameEndLines.filter((e) => _GE_STAND_RE.test(e.text || ''));
    return kcHtml`${heads.map((e) => kcHtml`<div style="font-size:.8rem;color:#231e16;margin-top:6px;line-height:1.5">${_tint((e.text || '').trim())}</div>`)}${
      rows.length
        ? kcHtml`<div style="margin-top:8px;border-top:1px solid #d9c48f;padding-top:6px"><div style="font-family:'Cinzel',serif;font-size:.8rem;color:#5a4410;margin-bottom:3px">Final Legacy standings</div>${rows.map(
            (e, i) =>
              kcHtml`<div style="font-size:.8rem;color:#231e16;line-height:1.55;${i === 0 ? 'font-weight:600;' : ''}">${_tint((e.text || '').trim())}</div>`,
          )}</div>`
        : ''
    }`;
  })();
  const _reckoningBanner = (() => {
    const t = (currentReport && currentReport.titles) || {};
    if (t.gameOver) {
      const go = t.gameOver;
      return kcHtml`<div style="background:#fdf3d8;border:2px solid var(--gold);border-radius:3px;padding:9px 12px;margin-bottom:12px">
        <div style="font-family:'Cinzel',serif;font-size:.92rem;color:var(--crimson)">🏆 ${go.byConcession ? 'The game is decided' : 'The Reckoning is complete'} — ${go.winnerName || 'No-one'} ${go.byElimination ? 'is the last realm standing' : go.byConcession ? 'holds the field as every rival concedes' : 'is judged supreme'}!</div>
        ${_gameEndHtml || kcHtml`<div style="font-size:.76rem;color:#231e16;margin-top:3px">The game is over. See Titles &amp; Victory for the final standings.</div>`}
      </div>`;
    }
    if (_gameEndHtml) {
      return kcHtml`<div style="background:#fdf3d8;border:2px solid var(--gold);border-radius:3px;padding:9px 12px;margin-bottom:12px">
        <div style="font-family:'Cinzel',serif;font-size:.92rem;color:var(--crimson)">🏆 The game is decided</div>${_gameEndHtml}</div>`;
    }
    if (t.reckoning) {
      const r = t.reckoning;
      return kcHtml`<div style="background:#fdeaea;border:2px solid var(--crimson);border-radius:3px;padding:9px 12px;margin-bottom:12px">
        <div style="font-family:'Cinzel',serif;font-size:.9rem;color:var(--crimson)">👑 The Reckoning has been called${r.byName ? ` by ${r.byName}` : ''}!</div>
        <div style="font-size:.78rem;color:#444;margin-top:3px;line-height:1.5">The world will be judged at the end of <strong>Turn ${r.resolveAtTurn}</strong> unless the claim is broken before then. ${r.mine ? kcHtml`<strong>This is your claim — hold your dominance to the end.</strong>` : 'Drive the claimant\u2019s bloc below the threshold to shatter it and play on.'}</div>
      </div>`;
    }
    return '';
  })();

  if (!log.length) {
    document.getElementById('report-log').innerHTML =
      kcHtml`${_reckoningBanner}<em style="color:#3a3224;font-size:.85rem">No events yet.</em>${viewedTurn == null ? intelSectionShell('') : ''}`;
  } else {
    // ── SORT ENTRIES INTO STRUCTURE ────
    // charEntries: charId → { name, isKing, phases: [ [], [], [], [], [] ] }
    // systemByPhase: phase (0-4) → entries[]
    // intelByPhase: phase (0-4) → entries[]

    const charEntries = {};
    const systemByPhase = { 0: [], 1: [], 2: [], 3: [], 4: [], 99: [] }; // 99 = no-phase (wages/tax)
    const intelByPhase = { 0: [], 1: [], 2: [], 3: [], 4: [], 99: [] };
    const titleIntel = []; // imperial-title perk lines ([The Throne], [The Sea Lord] …) — their own subsection
    const dispatches = []; // player-to-player messages received/sent this turn — their own section
    // The imperial titles whose per-turn perk is an intelligence line (emitted end-of-turn to the
    // holder).
    // ANY "[The …]" dispatch is a title's intel — matched by shape, not by a list of names. (The old
    // list named nine titles, so the Spymaster, Cartographer, Beastlord and Wildwarden reports fell
    // through to Realm Events → End of Turn.)
    const TITLE_INTEL_RE = /^\[(The [^\]]+)\]\s*/;

    // Build char map keyed by id; king first
    const orderedChars = [...chars_for_log].sort((a, b) => (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0));
    orderedChars.forEach((c) => {
      charEntries[c.id] = { id: c.id, name: c.name, isKing: c.isKing, phases: [[], [], [], [], [], []] }; // [5] = End of Turn
    });

    log.forEach((e) => {
      // environmental province events (earthquake / flood / plague / blessing / part-sea /
      // consecrate) are shown in their own Province Reports section, so keep them OUT of the
      // Chronicle character blocks and Realm Events here. Item 3:...EXCEPT when the entry is one of
      // this viewer's own characters' doing
      // (the caster of an Earthquake / Flood / Plague / Bless / Part Sea) — the target and outcome of
      // your own spell belongs under that hero, directly after its "📊 … casts …" roll line.
      if (e.env && !(e.charId != null && e.charId in charEntries)) return;
      const ph = e.phase != null && e.phase >= 0 && e.phase <= 4 ? e.phase : 99;
      const _txt = e.text || '';
      const isIntel = _txt.startsWith('[Intelligence]');
      const isTitleIntel = TITLE_INTEL_RE.test(_txt);
      // Route to a character's section if the entry names one of THIS viewer's characters — either
      // as the primary charId, or via charIds.
      let _secCharId =
        e.charId != null && e.charId in charEntries
          ? e.charId
          : Array.isArray(e.charIds)
            ? e.charIds.find((id) => id in charEntries)
            : undefined;
      const hasChar = _secCharId != null && _secCharId !== undefined;

      if (e.type === 'message') {
        dispatches.push(e); // player-to-player dispatch — its own section, never scattered
      } else if (isTitleIntel) {
        titleIntel.push(e); // grouped into their own Intelligence subsection, not scattered by phase
      } else if (isIntel) {
        intelByPhase[ph] = intelByPhase[ph] || [];
        intelByPhase[ph].push(e);
      } else if (hasChar) {
        // an explicit end-of-turn entry (phase 99 — couriers, escapes, observatory) files under
        // "End of Turn" AFTER Early Winter, not in Spring. Unphased turn-START entries keep Spring.
        charEntries[_secCharId].phases[ph >= 0 && ph <= 4 ? ph : e.phase === 99 ? 5 : 0].push(e);
      } else {
        systemByPhase[ph] = systemByPhase[ph] || [];
        systemByPhase[ph].push(e);
      }
    });

    // ── Items 2 & 3: battle-force markers + player-colour map ────
    // The engine emits '⚑FORCE⚑{json}' lines for each side of a battle (name, owner colour, neutral
    // flag, role/verb, army roster). We expand those into icon rows (like "Your Realm") and tint
    // every participant's name in the owner's map colour; neutral names go dark grey.
    const NEUTRAL_COLOR = '#555';
    const nameColors = new Map(); // name (and bare/realm variants) → {color|null, neutral}
    // a local chieftain (neutral-province guard) is registered with guard=true and is tinted
    // CHIEFTAIN_MARKER_COLOR everywhere in the Chronicle — the same brown as their map marker.
    function _registerName(nm, color, neutral, guard) {
      if (!nm) return;
      const add = (k) => {
        if (k && !nameColors.has(k))
          nameColors.set(k, {
            color: guard ? CHIEFTAIN_MARKER_COLOR : neutral ? null : reportColour(color),
            neutral: !!neutral && !guard,
          });
      }; // realm colours darkened for the parchment
      add(nm);
      add(
        String(nm)
          .replace(/\s*\(.*?\)\s*$/, '')
          .trim(),
      ); // strip trailing "(Realm)"
      const km = String(nm).match(/\(([^)]+)\)\s*$/);
      if (km) add(km[1]); // the realm name itself
    }
    log.forEach((e) => {
      const t = e.text || '';
      if (t.startsWith('⚑FORCE⚑')) {
        try {
          const f = JSON.parse(t.slice(7));
          _registerName(f.name, f.color, f.neutral, !!f.guard);
          // tint every custom-NAMED unit in the force too, so battle lines that reference a unit by
          // its name (archery, pre-battle magic, casualties, pursuit…) show whose it is. Generic type
          // names (e.g. "Elven Bowmen") can belong to either side and stay untinted.
          (f.armies || []).forEach((a) => {
            const un = a && a.unitName;
            if (un && un !== a.type && !String(un).startsWith('undefined'))
              _registerName(un, f.color, f.neutral, !!f.guard);
          });
        } catch (_) {}
      }
    });
    // Seed the viewer's own characters with their realm colour, in case they never appear in a
    // marker.
    const _ownColor = (viewingReport && viewingReport.kingdom && viewingReport.kingdom.color) || null;
    if (_ownColor) (chars_for_log || []).forEach((c) => _registerName(c.name, _ownColor, false));
    // register EVERY character the viewer can name so their name is tinted in EVERY Chronicle
    // section, in the colour of the player who controls them. Enemy heroes take their realm colour;
    // wandering heroes and neutral-province guardians are dark grey.
    const _chronRep = viewingReport || currentReport || {};
    // Guardians (the monster defending a feature) are named throughout the Chronicle by their
    // monster
    // name — tint each by its difficulty tier (Weak → Legendary) instead of the default neutral grey.
    // Registered BEFORE the neutral sightings below so the difficulty colour wins (the first colour
    // registered for a name key sticks). Matches the POWER_COLORS used on the Known Features card.
    const _GUARD_POWER_COLORS = { ...GUARD_POWER_COLORS_P };
    (_chronRep.knownFeatures || []).forEach((f) => {
      if (!f) return;
      // tint BOTH the guardian AND the lair itself in the guardian's difficulty colour, everywhere
      // they appear in the report (chronicle, realm events, intel) — cleared or not, so long as the
      // difficulty is known. Registered here (before the neutral sightings below) so the difficulty
      // colour wins the first-registered-wins race.
      const _pcol = _GUARD_POWER_COLORS[f.monsterPower] || null;
      if (!_pcol) return;
      if (f.monster && f.monster !== 'unknown guardian') _registerName(f.monster, _pcol, false);
      if (f.name) _registerName(f.name, _pcol, false);
    });
    (_chronRep.heroSightings || []).forEach((s) => {
      if (s.type === 'enemy') _registerName(s.name, s.kingdomColor || null, false);
      else _registerName(s.name, null, true, s.type === 'neutral_guard'); // wandering (grey) / neutral_guard (chieftain brown)
    });
    ((_chronRep.worldMeta && _chronRep.worldMeta.provinces) || []).forEach((p) => {
      (p.characters || []).forEach((ch) => {
        if (ch.isOwn) return; // own already seeded in the realm colour
        if (ch.ownerColor && !ch.isWanderer && !ch.isNeutralGuard) _registerName(ch.name, ch.ownerColor, false);
        else _registerName(ch.name, null, true, !!ch.isNeutralGuard); // neutral → grey; chieftain → brown
      });
    });
    // Tasks 1 & 4: register EVERY player's realm name in that player's colour, and every named
    // (living / just-fallen, non-cloaked) character in its controlling player's colour — so realm
    // and character names are tinted even when they never appeared as a sighting or battle marker
    // (e.g. title-intel rivals, distant conquests). Registered AFTER the visible/guardian sources so
    // the more specific colours already set win (first-registered-wins).
    (_chronRep.allKingdoms || []).forEach((k) => {
      if (k && k.name && k.color) _registerName(k.name, k.color, false);
    });
    (_chronRep.nameColors || []).forEach((n) => {
      if (n && n.name) _registerName(n.name, n.color || null, !!n.neutral, !!n.guard);
    });
    const _nameKeys = [...nameColors.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
    // Tints each name this viewer knows in `nodes` (text, or _markRuns pieces), longest first; returns pieces.
    function colorizeNames(nodes, bold) {
      const wt = bold ? ';font-weight:700' : '';
      _nameKeys.forEach((nm) => {
        const info = nameColors.get(nm);
        const col = info.neutral ? NEUTRAL_COLOR : info.color;
        if (!col) return;
        const re = new RegExp('\\b' + _reText(nm) + '\\b', 'g');
        nodes = _markRuns(nodes, re, (m) => kcHtml`<span style="color:${col}${wt}">${m}</span>`);
      });
      return nodes;
    }
    function renderForceBlock(f, compact) {
      const col = f.guard ? CHIEFTAIN_MARKER_COLOR : f.neutral ? NEUTRAL_COLOR : reportColour(f.color) || NEUTRAL_COLOR;
      // 2026-09-23d: the short battle view shows each side on ONE line — who, what they did, and a
      // count of each unit type — instead of the full roster.
      if (compact) {
        const cnt = {};
        (f.armies || []).forEach((a) => {
          const k = a.type || 'unit';
          cnt[k] = (cnt[k] || 0) + 1;
        });
        const n = (f.armies || []).length;
        const verb = String(f.verb || '')
          .replace(/,\s*(with|leading)\s*$/, '')
          .replace(/\s*—\s*\d+ defending units?\s*$/, '');
        const kinds = Object.keys(cnt)
          .map((k) => `${unitEmoji(k)} ${cnt[k] > 1 ? cnt[k] + '× ' : ''}${k}`)
          .join(', ');
        return kcHtml`<div class="log-entry combat" style="border-left-width:4px;background:#fdf0f0;margin-top:3px;font-size:.8rem">⚔ <span style="color:${col};font-weight:700">${f.name}</span> ${verb} — ${n ? `${n} unit${n !== 1 ? 's' : ''}: ${kinds}` : 'no armies'}</div>`;
      }
      const header = kcHtml`⚔ <span style="color:${col};font-weight:700">${f.name}</span> ${f.verb || ''}:`;
      const rows = (f.armies || []).length
        ? f.armies.map(
            (a) =>
              kcHtml`<div style="padding-left:16px;font-size:.82rem${a.phantom ? ';opacity:.75;font-style:italic' : ''}">${a.phantom ? '✨' : unitEmoji(a.type)} <span style="color:${col}">${armyLabel(a)}</span></div>`,
          )
        : kcHtml`<div style="padding-left:16px;font-size:.82rem;opacity:.7">— no armies —</div>`;
      return kcHtml`<div class="log-entry combat" style="border-left-width:4px;background:#fdf0f0;margin-top:6px"><div>${header}</div>${rows}</div>`;
    }

    // ── HELPER: render a single log entry ──
    // opt: {compact} — the short battle view (one-line forces, no indentation); {tail} — HTML put at
    // the right-hand end of the line (the battle fold button).
    function renderEntry(e, opt) {
      opt = opt || {};
      const raw0 = e.text || '';
      if (raw0.startsWith('⚑FORCE⚑')) {
        try {
          return renderForceBlock(JSON.parse(raw0.slice(7)), !!opt.compact);
        } catch (_) {
          /* fall through */
        }
      }
      // 2026-09-23d: an indented line (a duel blow, an arrow volley, a Battle-stats ladder row) is a
      // sub-line of the one above it — drawn indented and smaller in the full report instead of
      // flush like a headline. The short view has no sub-lines, so it just trims the indent.
      const _ind = (raw0.match(/^ +/) || [''])[0].length;
      const rawText = roundReportNumbers(raw0.replace(/^ +/, ''));
      const isStat = rawText.startsWith('📊');
      const isTally = rawText.startsWith('⚰');
      const isBattleHeader = rawText.startsWith('⚔') || rawText.startsWith('⚠');
      // the line is text; each **bold** run becomes <strong>
      const bold = rawText
        .split(/\*\*(.+?)\*\*/)
        .map((s, i) => (i % 2 ? { wrap: (k) => kcHtml`<strong>${k}</strong>`, kids: [s] } : s))
        .filter((x) => x !== '');
      // tint EVERY character's name in EVERY section — in the controlling player's colour
      // (neutrals dark grey) — not only battle/stat lines.
      const text = _showRuns(colorizeNames(bold));
      const tail = opt.tail ? kcHtml`<span style="flex:1"></span>${opt.tail}` : '';
      const flex = opt.tail ? 'display:flex;align-items:flex-start;gap:6px;' : '';
      const inner = opt.tail ? kcHtml`<span style="min-width:0">${text}</span>${tail}` : text;
      const sub =
        _ind > 0 && !opt.compact
          ? `margin-left:${Math.min(4, Math.ceil(_ind / 2)) * 12}px;font-size:.76rem;padding-top:2px;padding-bottom:2px;margin-bottom:1px;`
          : '';
      const _gridLine = /│/.test(rawText) ? 'white-space:pre;overflow-x:auto;' : ''; // 2026-10-11: a battle-lines grid keeps its columns
      if (isStat) return kcHtml`<div class="log-entry stat" style="${flex}${sub}${_gridLine}">${inner}</div>`;
      if (isTally)
        return kcHtml`<div class="log-entry combat" style="${flex}border-left-width:4px;background:#f6ecdf;font-weight:600">${inner}</div>`;
      if (isBattleHeader && !sub)
        return kcHtml`<div class="log-entry combat" style="${flex}border-left-width:4px;background:#fdf0f0;margin-top:6px;font-weight:600">${inner}</div>`;
      return kcHtml`<div class="log-entry ${e.type || ''}" style="${flex}${sub}">${inner}</div>`;
    }
    // ── BATTLE FOLDING (2026-09-23d, Toby item 1) ── The engine tags every line of a battle with its
    // battleId and a tier (k key · d detail · t losses tally · s onlookers' one-line summary). A run
    // of lines from one battle is drawn as a .battle-fold: the short account by default, the full
    // report behind the side button. Reports from before this build carry no battleId and render
    // exactly as they always did.
    function renderBattleGroup(g) {
      const hasDetail = g.some((e) => e.bTier === 'd');
      if (!hasDetail) return g.filter((e) => e.bTier !== 't').map((e) => renderEntry(e)); // an onlooker's lone summary line
      const shortE = g.filter((e) => e.bTier === 'k' || e.bTier === 't'),
        fullE = g.filter((e) => e.bTier !== 't' && e.bTier !== 's');
      const btn = (open) =>
        kcHtml`<button type="button" class="secall-btn bf-toggle" style="flex-shrink:0;font-weight:400" aria-expanded="${open ? 'true' : 'false'}" onclick="toggleBattleFold(this)">${open ? '▾ short summary' : '▸ full report'}</button>`;
      const view = (list, open, compact) => {
        let hi = list.findIndex((e) => /^\s*⚔ \*\*Battle for /.test(e.text || ''));
        if (hi < 0) hi = 0;
        return list.map((e, i) => renderEntry(e, { compact, tail: i === hi ? btn(open) : null }));
      };
      return kcHtml`<div class="battle-fold"><div class="bf-short">${view(shortE, false, true)}</div><div class="bf-full" style="display:none">${view(fullE, true, false)}</div></div>`;
    }
    function renderEntryList(list) {
      let out = [];
      for (let i = 0; i < list.length;) {
        const e = list[i];
        if (e && e.battleId != null) {
          let j = i;
          while (j < list.length && list[j] && list[j].battleId === e.battleId) j++;
          out.push(renderBattleGroup(list.slice(i, j)));
          i = j;
          continue;
        }
        out.push(renderEntry(e));
        i++;
      }
      return out;
    }

    // ── HELPER: render a phase sub-header ──
    function phaseHeader(ph, color) {
      return kcHtml`<div style="font-family:'Cinzel',serif;font-size:.68rem;color:${color || 'var(--stone)'};
        text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;
        border-bottom:1px dotted var(--parchment-dark);margin:6px 0 4px;
        display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color || 'var(--stone)'}"></span>
        ${PHASE_NAMES[ph]}
      </div>`;
    }

    let html = [];

    // ════
    // SECTION 1: Characters — king first, then heroes Each character shows all 5 phases that have
    // entries
    // ════
    orderedChars.forEach((c) => {
      const ce = charEntries[c.id];
      if (!ce) return;
      const hasAny = ce.phases.some((ph) => ph.length > 0);
      if (!hasAny) return;

      const accentColor = c.isKing ? 'var(--crimson)' : 'var(--forest)';
      html.push(kcHtml`<div class="char-chronicle" style="margin-bottom:22px;border:1px solid ${c.isKing ? 'var(--crimson)' : 'var(--stone)'};border-radius:3px;overflow:hidden">
        <div class="cc-head" style="font-family:'Cinzel',serif;font-size:.88rem;color:#fff;
          padding:7px 12px;background:${accentColor};
          display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">${c.isKing ? '👑' : '⚔'}</span>
          <span style="font-weight:600">${c.name}</span>
          ${c.isKing ? kcHtml`<span style="font-size:.68rem;opacity:.8;margin-left:auto">King</span>` : ''}
          <button type="button" class="cc-toggle" title="Minimise / maximise this character" aria-expanded="true" onclick="toggleSection(this)" style="${c.isKing ? 'margin-left:8px' : ''}">&#9662;</button>
        </div>
        <div style="padding:6px 8px">`);

      let hasContent = false;
      ce.phases.forEach((entries, ph) => {
        if (!entries.length) return;
        hasContent = true;
        // a battle-lock pin notice ("… is still locked in the unresolved battle … cannot march
        // away") is hoisted to the TOP of the phase, so the reader learns WHY this character is
        // fighting-not-marching before the battle narrative that follows. Stable sort keeps every
        // other line in its original order.
        const ordered = [...entries].sort((a, b) => (b.pinNotice ? 1 : 0) - (a.pinNotice ? 1 : 0));
        html.push(phaseHeader(ph, PHASE_COLORS[ph]));
        html.push(renderEntryList(ordered));
      });

      if (!hasContent)
        html.push(
          kcHtml`<em style="color:#aaa;font-size:.8rem;padding:4px 8px;display:block">No activity this turn.</em>`,
        );
      html.push(kcHtml`</div></div>`);
    });

    // ════
    // SECTION: Dispatches — player-to-player messages. Shown prominently above Realm Events.
    if (dispatches.length > 0) {
      html.push(kcHtml`<div class="char-chronicle" style="margin-bottom:22px;border:1px solid #6b8ec8;border-radius:3px;overflow:hidden">
        <div class="cc-head" style="font-family:'Cinzel',serif;font-size:.88rem;color:#fff;
          padding:7px 12px;background:#4a6ea5;display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">📨</span>
          <span style="font-weight:600">Dispatches</span>
          <button type="button" class="cc-toggle" title="Minimise / maximise" aria-expanded="true" onclick="toggleSection(this)">&#9662;</button>
        </div>
        <div style="padding:6px 10px">`);
      dispatches.forEach((e) => {
        html.push(
          kcHtml`<div class="log-entry" style="padding:5px 4px;border-bottom:1px dotted var(--parchment-dark)">${e.text || ''}</div>`,
        );
      });
      html.push(kcHtml`</div></div>`);
    }

    // ════
    // SECTION 2: Realm Events — system events grouped by phase
    const hasSystemEvents = Object.values(systemByPhase).some((a) => a.length > 0);
    if (hasSystemEvents) {
      html.push(kcHtml`<div class="char-chronicle" style="margin-bottom:22px;border:1px solid var(--stone);border-radius:3px;overflow:hidden">
        <div class="cc-head" style="font-family:'Cinzel',serif;font-size:.88rem;color:#fff;
          padding:7px 12px;background:var(--stone);display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">⚙</span>
          <span style="font-weight:600">Realm Events</span>
          <span style="font-size:.7rem;opacity:.7;margin-left:auto">Battles · Conquests · Tax &amp; Wages</span>
          <button type="button" class="cc-toggle" title="Minimise / maximise" aria-expanded="true" onclick="toggleSection(this)" style="margin-left:8px">&#9662;</button>
        </div>
        <div style="padding:6px 8px">`);

      // Phased events (0-4) first
      [0, 1, 2, 3, 4].forEach((ph) => {
        const entries = systemByPhase[ph] || [];
        if (!entries.length) return;
        html.push(phaseHeader(ph, PHASE_COLORS[ph]));
        html.push(renderEntryList(entries));
      });

      // Unphased events (wages, tax, turn-level) last
      const unphased = systemByPhase[99] || [];
      if (unphased.length) {
        html.push(kcHtml`<div style="font-family:'Cinzel',serif;font-size:.68rem;color:var(--stone);
          text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;
          border-bottom:1px dotted var(--parchment-dark);margin:6px 0 4px">
          End of Turn
        </div>`);
        html.push(renderEntryList(unphased));
      }
      html.push(kcHtml`</div></div>`);
    }

    // ════
    // SECTION 3: Intelligence entries — by phase
    // ════
    // Where this realm stands in every title race (percentages only) — current turn only; a past
    // turn's Chronicle must not show today's standings.
    // 2026-09-21: the "📊 Your standing in the Imperial Titles" block is gone from Intelligence.
    // Every one of its percentages is already printed against its own title in 🏆 Titles & Victory,
    // so this repeated the whole ladder a second time in another card.
    const hasIntel = Object.values(intelByPhase).some((a) => a.length > 0) || titleIntel.length > 0;
    // On the current-turn view the section ALWAYS renders: it also hosts the province / spy
    // intelligence that used to have its own "Intelligence" card (filled by renderReportView into
    // #report-intel). A past-turn view shows only that turn's logged intel.
    if (hasIntel || viewedTurn == null) {
      let html0 = html;
      html = [];
      // an intel line: its first "[Intelligence]" becomes the small [Intel] tag; the rest is text
      const _intelLine = (t) => {
        const i = t.indexOf('[Intelligence]');
        return i < 0
          ? t
          : kcHtml`${t.slice(0, i)}<span style="color:#c8922a;font-family:Cinzel,serif;font-size:.68rem">[Intel]</span>${t.slice(i + 14)}`;
      };

      // ── Imperial Titles subsection ── the per-turn intel your held titles grant (rival
      // treasuries, strongest armies/fleets, rival discoveries, and so on), grouped apart from
      // field intelligence.
      const _subHead = (t) => kcHtml`<div style="font-family:'Cinzel',serif;font-size:.68rem;color:#9a6a1a;
          text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;
          border-bottom:1px dotted var(--parchment-dark);margin:2px 0 4px">${t}</div>`;
      if (titleIntel.length) {
        html.push(_subHead('👑 Imperial Titles'));
        // ONE block per title: the tag once, then every piece of that title's report together.
        const byTitle = new Map();
        titleIntel.forEach((e) => {
          const m = TITLE_INTEL_RE.exec(e.text || '');
          const k = m ? m[1] : 'Titles';
          if (!byTitle.has(k)) byTitle.set(k, []);
          byTitle.get(k).push((e.text || '').replace(TITLE_INTEL_RE, ''));
        });
        byTitle.forEach((parts, k) => {
          const tag = kcHtml`<span style="color:#9a6a1a;font-family:Cinzel,serif;font-weight:700;font-size:.72rem">[${k}]</span>`;
          // every character and realm name bold + tinted in its realm's colour
          const body = parts.map((t) => kcHtml`<div class="ti-line">${_showRuns(colorizeNames([t], true))}</div>`);
          html.push(kcHtml`<div class="log-entry system">${tag}${body}</div>`);
        });
      }

      [0, 1, 2, 3, 4].forEach((ph) => {
        const entries = intelByPhase[ph] || [];
        if (!entries.length) return;
        html.push(phaseHeader(ph, '#c8922a'));
        entries.forEach((e) => {
          html.push(kcHtml`<div class="log-entry system">${_intelLine(e.text || '')}</div>`);
        });
      });

      const unphased = intelByPhase[99] || [];
      if (unphased.length) {
        html.push(kcHtml`<div style="font-family:'Cinzel',serif;font-size:.68rem;color:#c8922a;
          text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;
          border-bottom:1px dotted var(--parchment-dark);margin:6px 0 4px">General</div>`);
        unphased.forEach((e) => {
          html.push(kcHtml`<div class="log-entry system">${_intelLine(e.text || '')}</div>`);
        });
      }
      html = [...html0, intelSectionShell(html)];
    }

    document.getElementById('report-log').innerHTML =
      kcHtml`${_reckoningBanner}${html.length ? html : kcHtml`<em style="color:#3a3224;font-size:.85rem">No events yet.</em>`}`;
  } // end else (log.length > 0)
} // end buildChronicle

async function loadPastReport(gameId, playerIndex, turn) {
  viewedTurn = turn;
  refreshTurnNavHighlight();
  const banner = document.getElementById('prev-report-banner');
  banner.style.display = 'block';
  const pi = playerIndex;

  // Strictly hide orders and submit sections — past-turn views must never affect orders.
  document.getElementById('orders-card').style.display = 'none';
  refreshOrdersVisibility(false); // past turn — orders unavailable (desk-safe)
  const sw = document.getElementById('orders-submit-wrap');
  if (sw) sw.style.display = 'none';
  document.getElementById('orders-msg').innerHTML = '';
  document.getElementById('save-msg').style.display = 'none';

  // 1. Try to load this player's full snapshot for the turn (gives the correct historical MAP).
  let snapshot = null;
  try {
    const { data: snapRows } = await sb
      .from('turn_logs')
      .select('*')
      .eq('game_id', gameId)
      .eq('turn', turn)
      .eq('player_index', pi)
      .limit(1);
    if (snapRows && snapRows[0] && snapRows[0].entries) {
      const e = snapRows[0].entries;
      snapshot = typeof e === 'string' ? JSON.parse(e) : e;
    }
  } catch (err) {
    snapshot = null;
  }

  banner.innerHTML = kcHtml`Viewing Turn ${snapshotTurnLabel(turn)}${turn === 0 ? ' (founding)' : ''} — read only. <button onclick="returnToCurrentReport()" style="margin-left:8px;font-size:.72rem;padding:2px 7px;border:1px solid #c8922a;background:transparent;color:#5a3f08;cursor:pointer;border-radius:2px">← Current Turn</button>`;

  if (snapshot) {
    // Whole report body straight from the snapshot — map, chronicle, AND every other section revert
    // to this turn. (Order forms stay hidden; renderReportView only paints the read-only view.)
    viewingReport = snapshot;
    renderReportView(snapshot);
    return;
  }

  // 2. Fallback for games/turns saved before per-turn snapshots existed:
  // rebuild the chronicle from the GM full log and keep the current map (noted in the banner).
  const { data: logs } = await sb
    .from('turn_logs')
    .select('*')
    .eq('game_id', gameId)
    .eq('turn', turn)
    .eq('player_index', -1)
    .limit(1);
  const { data: g } = await sb.from('games').select('*').eq('id', gameId).single();
  const gameState = g?.game_state || {};
  const allChars = gameState.characters || [];
  const ownCharIds = new Set(allChars.filter((c) => c.player === pi).map((c) => c.id));

  const entries = ((logs && logs[0]?.entries) || [])
    .filter((e) => {
      if ((e.targets || []).includes(pi)) return true;
      if (e.actor === pi) return true;
      if (e.charId != null && ownCharIds.has(e.charId)) return true;
      if (Array.isArray(e.charIds) && e.charIds.some((id) => ownCharIds.has(id))) return true;
      return false;
    })
    .map((e) => {
      // Route to one of THIS player's characters via charId, or via charIds (a duel/battle names
      // both).
      let cid =
        e.charId != null && ownCharIds.has(e.charId)
          ? e.charId
          : Array.isArray(e.charIds)
            ? (e.charIds.find((id) => ownCharIds.has(id)) ?? null)
            : null;
      return { type: e.type, text: e.text, charId: cid, phase: e.phase ?? null };
    });

  if (entries.length > 0) {
    buildChronicle(
      entries,
      allChars.filter((c) => c.player === pi),
    );
  } else if (turn === 0) {
    document.getElementById('report-log').innerHTML =
      kcHtml`<div class="log-entry system">Your realm is founded. The realm awaits your first commands.</div>`;
  }
  banner.innerHTML = kcHtml`Viewing Turn ${snapshotTurnLabel(turn)} — read only. <span style="opacity:.8">(map history isn't available for this turn — showing the current map)</span> <button onclick="returnToCurrentReport()" style="margin-left:8px;font-size:.72rem;padding:2px 7px;border:1px solid #c8922a;background:transparent;color:#5a3f08;cursor:pointer;border-radius:2px">← Current Turn</button>`;
}

function returnToCurrentReport() {
  viewedTurn = null;
  refreshTurnNavHighlight();
  document.getElementById('prev-report-banner').style.display = 'none';
  document.getElementById('orders-card').style.display = 'block';
  refreshOrdersVisibility(true); // back on the live turn — orders available (desk tab governs display)
  // Restore the correct submit wrap based on the TRUE submitted state (not on whatever DOM happens
  // to be there). If the live turn is not submitted, ensure a live Submit button — this clears any
  // stale "success / ↺ Resubmit" block from an earlier submission. If it IS submitted, leave the
  // existing submitted/resubmit control in place.
  const submitWrap = document.getElementById('orders-submit-wrap');
  const _submitted = !!(currentGamePlayer && currentGamePlayer.orders_submitted);
  if (submitWrap && !_submitted && !submitWrap.querySelector('#submit-btn')) {
    restoreSubmitWrap('Submit');
  }
  if (submitWrap) submitWrap.style.display = 'flex';
  // Restore the WHOLE current-turn body. loadPastReport paints every read-only section (realm,
  // provinces, intel, discoveries, diplomacy, titles, mastery, map AND chronicle) from the
  // past-turn snapshot, so returning must repaint every one of them from the current report — not
  // just the map and chronicle. Repainting only those two left the other sections frozen on the
  // turn just viewed, which read as a report "muddled" with a previous one until the browser was
  // reloaded.
  viewingReport = currentReport;
  if (currentReport) {
    renderReportView(currentReport);
  }
}
