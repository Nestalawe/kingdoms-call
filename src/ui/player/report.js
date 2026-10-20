import { kcArg, kcHtml } from '../shared/kc-safe.js';
import { KC_CARRIER_BERTHS, KC_RIVAL_RACE, KC_SEASONS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.js';
import { kcJoinP, sb } from './startup.js';
import { GUARD_POWER_COLORS_P, deadHeroRealmTagP, itemBoundTag, itemSlotTag, itemTierTagP, itemUsableByP, itemsForDisplayP } from './items-and-heroes.js';
import { refreshTurnNavHighlight, show, snapshotTurnLabel } from './init.js';
import { refreshOrdersVisibility } from './layout.js';
import { turnDeadlineText } from './game-lists.js';
import { buildChronicle, loadPastReport, returnToCurrentReport } from './join-and-chronicle.js';
import { renderMastery, renderTitles } from './titles.js';
import { armyLabel, floorNumP, unitBaseStrengthP, unitEmoji } from './order-chances.js';
import { SKILL_LABELS } from './move-analysis.js';
import { buildOrdersForm } from './orders-form.js';
import { effSkillP, itemAcquiredTagP, itemLoreTip, unitAbilityTip } from './briefing-and-submit.js';
import { CREATURE_ARMIES_UI, MONSTER_ARMIES_UI, capitalise, druidNeedP, formatRace, skillRowHTML } from './skills-and-projections.js';
import { CHIEFTAIN_MARKER_COLOR, _lairName, beastCommandCountP, bulletizeDesc, provLinkHtml, provinceGrandDesignHTML, reportColour, skillFameLabel, spiedExtraP, terrorNoteP } from './map-symbols.js';
import { ensureProvinceLinking, renderPlayerMap } from './map.js';
import { initMessaging } from './dispatches.js';

// ── TURN REPORT ────
export async function openReport(gamePlayerId) {
  currentGamePlayerId = gamePlayerId;
  try {
    history.replaceState(null, '', location.pathname + location.search + '#game=' + encodeURIComponent(gamePlayerId));
  } catch (e) {} // a refresh returns here
  show('sec-report');
  {
    const _ntb = document.getElementById('new-turn-banner');
    if (_ntb) _ntb.style.display = 'none';
  } // clear any stale new-turn notice
  document.getElementById('report-title').textContent = 'Loading…';

  // Fetch game_player row first
  const { data: gp, error } = await sb.from('game_players').select('*').eq('id', gamePlayerId).single();
  if (error) {
    document.getElementById('report-title').textContent = 'Error: ' + error.message;
    return;
  }
  // Fetch game separately to avoid RLS join issue. Disk-IO (2026-09-25): the report screen reads
  // only name / turn / status off the game row — never its world. block_eliminated_msgs is the GM's Dispatches
  // switch (P0-25, R-075).
  const { data: g, error: gErr } = await sb
    .from('games')
    .select('id,name,gm_user_id,status,turn,max_players,block_eliminated_msgs')
    .eq('id', gp.game_id)
    .single();
  if (gErr) {
    document.getElementById('report-title').textContent = 'Error loading game: ' + gErr.message;
    return;
  }
  gp.games = g; // attach for compatibility
  currentGamePlayer = gp;
  currentGamePlayer._liveTurn = g.turn || 1; // actual current turn for orders
  const report = typeof gp.turn_report === 'string' ? JSON.parse(gp.turn_report) : gp.turn_report || {};
  currentReport = report;
  currentReport._liveTurn = g.turn || 1; // ensure submit uses live turn not report turn
  // Royal succession: re-apply any saved heir skill allocation from this turn's DRAFT onto the heir
  // characters BEFORE the realm + orders sections render. This makes the allocation (a) survive a
  // re-render (openReport re-fetches the pristine turn_report, which would otherwise wipe it) and
  // (b) take effect immediately this turn — the order forms read c.skills, so newly-bought magic
  // surfaces its spells straight away. Also snapshot each heir's crowned skills as _heirBase so the
  // ± allocator knows the floor it may not reduce below.
  try {
    const _draft = typeof gp.orders === 'string' ? JSON.parse(gp.orders || '{}') : gp.orders || {};
    const _ks = _draft && _draft.kingSkills;
    (currentReport.characters || []).forEach((c) => {
      if (!c._isHeir) return;
      const a = _ks && _ks[c.id];
      if (a) {
        if (a.base) c._heirBase = { ...a.base };
        if (a.skills) c.skills = { ...a.skills };
        if (typeof a.pending === 'number') c._pendingSkillAllocation = a.pending;
        if (a.name) c.name = a.name;
        if (a.temper) c.temper = a.temper;
      }
      // First sighting (or a draft with no base recorded yet): the current skills ARE the base.
      if (!c._heirBase) c._heirBase = { ...(c.skills || {}) };
    });
  } catch (e) {
    /* no draft yet — heir shows freshly-crowned base skills */
  }
  diploChoices = {}; // fresh pending diplomacy each time a report opens (restored from any saved draft below)
  discoveryChoices = {};
  reckoningCall = false;
  concedeGame = false;
  viewingReport = report; // map/history starts on the current report

  // DISPATCHES (2026-09-27). Started here, BEFORE the waiting-for-Turn-0 return below, because
  // messages are not part of the turn cycle: realms can write to each other from the moment the game
  // has two human players. It is awaited nowhere — a slow roster query must not hold up the report.
  initMessaging(gp.game_id, gp.player_index, report, g).catch((e) => console.warn('Dispatches:', e));

  // Turn numbering, player-facing:
  // liveTurn = the turn the realm is living through — the one being planned now, and the number
  //   the GM portal, the game list and the Orders card all show. The report header shows it too
  //   (2026-09-27): a realm on Turn 13 is reading its Turn 13 report.
  // resolvedTurn = the most recent RESOLVED turn. It is NOT a label any more — it is only the
  //   turn_logs key of the newest snapshot (see snapshotTurnLabel).
  const liveTurn = g.turn != null ? g.turn : 1; // 0 during setup, and the header should say so
  const resolvedTurn = Math.max(0, (g.turn || 1) - 1);
  document.getElementById('report-title').textContent = `${g.name} — Turn ${liveTurn}`;
  document.getElementById('orders-turn-num').textContent = Math.max(1, liveTurn);

  // Build turn navigation buttons: one per snapshot, labelled by the turn the player knew it as
  // (founding = Turn 1) up to the live turn.
  const navEl = document.getElementById('turn-nav-btns');
  if (navEl) {
    navEl.innerHTML = '';
    if ((g.turn || 0) >= 1) {
      for (let d = 0; d <= resolvedTurn; d++) {
        const btn = document.createElement('button');
        const lbl = snapshotTurnLabel(d);
        btn.textContent = `T${lbl}`;
        btn.dataset.turn = d;
        btn.title =
          d === 0
            ? `Turn ${lbl} — the founding report, your starting position`
            : `Turn ${lbl} — the report you received then`;
        btn.onclick = (() => {
          const turn = d;
          const pi = gp.player_index;
          const cur = resolvedTurn;
          return () => (turn === cur ? returnToCurrentReport() : loadPastReport(gp.game_id, pi, turn));
        })();
        navEl.appendChild(btn);
      }
      navEl.dataset.resolved = resolvedTurn;
      viewedTurn = null; // the main render always shows the current turn
      refreshTurnNavHighlight();
    }
  }
  document.getElementById('prev-report-banner').style.display = 'none';

  // Status pill
  const submitted = gp.orders_submitted;
  document.getElementById('report-status-pill').innerHTML = submitted
    ? '<span class="pill pill-blue">✓ Orders submitted</span>'
    : g.status === 'active'
      ? '<span class="pill pill-amber">⏳ Orders needed</span>'
      : '<span class="pill pill-green">Waiting to start</span>';
  {
    const _dl = document.getElementById('turn-deadline-line');
    if (_dl) {
      const t = turnDeadlineText(g);
      _dl.style.display = t ? 'block' : 'none';
      _dl.innerHTML = t;
    }
  }

  // Waiting for Turn 0
  if (report.waitingForTurn0 || g.turn === 0) {
    document.getElementById('report-kingdom').innerHTML =
      '<div class="msg-info">The GM is setting up the game world. Check back soon — your turn report will appear here once Turn 0 has been run.</div>';
    document.getElementById('report-provinces').innerHTML = '';
    {
      const _ri = document.getElementById('report-intel');
      if (_ri) _ri.innerHTML = '';
    }
    {
      const _of = document.getElementById('report-other-forces');
      if (_of) _of.innerHTML = '';
      const _lr = document.getElementById('report-lairs');
      if (_lr) _lr.innerHTML = '';
    }
    document.getElementById('orders-card').style.display = 'none';
    refreshOrdersVisibility(false); // Turn 0 setup — no orders yet (desk-safe)
    return;
  }

  document.getElementById('orders-card').style.display = 'block';
  refreshOrdersVisibility(true); // live turn — orders available; on desktop the desk tab decides display
  // (so Orders no longer overrides applyDeskViews and stacks over Report)

  // Orders form (current turn only). Built here, before the shared read-only view renders; it lives
  // in its own container (orders-column), so building it first is harmless. Past-turn views hide
  // that container and never reach this line.
  currentGamePlayer = gp;
  buildOrdersForm(report.characters || [], gp.orders_submitted, gp.orders, g.turn);

  // Render the whole read-only report body from THIS report object. Shared with past-turn viewing
  // so that opening an old turn reverts every section (not just the map + chronicle) to that turn.
  renderReportView(report);
}

// Renders the full read-only report body (chronicle, realm, provinces, intel, discoveries,
// diplomacy, titles, mastery, and the map) from whatever report object it is handed — the live
// turn_report for the current turn, or a per-turn snapshot when viewing history.
export function renderReportView(report) {
  // Render chronicle
  buildChronicle(report.lastTurnLog || [], report.characters || []);

  // Realm summary
  const kingdom = report.kingdom || {};
  const chars = report.characters || [];
  const taxIncome = kingdom.taxIncome || 0;
  const armyWages = kingdom.armyWages || 0;
  const heroWages = kingdom.heroWages || 0;
  const netIncome = taxIncome - armyWages - heroWages;
  const playerAlignment = kingdom.alignment || 'Neutral';

  const ALIGNMENT_SUMMARIES = {
    Divine: `Your realm walks in the light of the divine. All heroes recover twice as much HP when they Rest (60% of maximum HP rather than the usual 30%). Your White Magic spells draw on deeper power — Bless Province adds 80% of a province's tax value rather than 60%, and when the KING works the blessing in person, the province yields a full 100% more. Should any of your characters — king or hero — fall, divine grace will return them to life after one full turn in death, restored to half health but stripped of armies and items — but ONLY upon consecrated ground: they rise in the nearest consecrated province you still hold, and the miracle spends that province's consecration. If the realm holds no consecrated province when the time comes, the grace is lost (a fallen king is then succeeded by an heir). Consecrate: your king may sanctify owned provinces, up to his White skill level at once (not the home province or its neighbours, and never two side by side — the crown's hearth was already anointed at the coronation, and the gods bid you carry the light outward). Consecrated ground yields +50% tax, its defenders are twice as likely to fight with fanatical zeal, Undead and Evil hosts attacking it fight at −15%, and it is where your fallen are restored. Guard it: a consecrated province that is captured loses its consecration at once, and each unit of the army that takes it has a 50% chance to gain an experience level. Your armies fight with a 50% chance of fanatical zeal — the highest of any alignment. But beware: your court is priced at the far end of the alignment spectrum — dark-hearted heroes cost dearly, and Undead heroes will never serve you at all.`,
    Good: `Your realm is known for honour and fellowship. Your armies fight with a solid 40% chance of fanaticism — second only to the Divine. Banner of Fellowship: allied contingents converging on the same battle unify 15% more readily under your honourable cause. Righteous Defence: any army defending a province you own fights at +10% — your soldiers know the ground they hold is held justly. Call to Arms: once per turn your king may summon the folk of any owned humanoid province — wherever they happen to be — and a free Green garrison unit of that province's native type musters to defend it. Sitting close to the centre of the alignment spectrum, most wandering heroes serve you cheaply.`,
    Druidic: `Your realm is bound to the living world. Your king commands Druid 1 from the outset, and all Creature armies — Thunderbirds, Forest Ents, Great Bears, Stone Giants, Unicorn Herd, Mammoth Host, Crimson Rocs, Whale Cohort and Great Turtles — follow your heroes without any Druid skill requirement, though a hero leads at most as many Creature and Monster units as his Druid level. There is always at least one Creature province within two provinces of your home. Home of the Wild: in forest and jungle, your Creature armies fight at ×1.5 strength. Your armies fight with a 20% chance of fanaticism, and your central place on the spectrum keeps most heroes affordable.`,
    Neutral: `Your realm prizes pragmatism above all. Province tax income flows 20% richer than other realms — traders and merchants gravitate toward your neutral courts. Standing at the exact centre of the alignment spectrum, EVERY wandering hero costs you at most 3g/turn — and most cost the base 2g — the cheapest court in the world. Mercenary bands cost 2g less to hire than the going rate. Broker: your king trades in influence rather than marches — they may hire any wandering hero the realm can see without leaving their hall (they serve from wherever they stand), or buy a guaranteed full Spy report on any province the realm has ever seen for 2g. Your scholars are twice as effective — each level of Sage skill doubles your chance of making a discovery. Your armies fight with a 10% chance of fanaticism.`,
    Pagan: `Your realm draws on ancient and forgotten powers. Your king walks the wild places from birth — Explorer 1 from the outset. Perform Rite at discovered ritual sites (now found across much of the world, commonest in wild Creature and Monster country): the Wild Hunt binds a province's creatures to your host, and a Blood Offering sacrifices units to empower an equal number of others (+2 quality tiers each, to Elite). Blood Harvest: +1g per enemy unit your characters destroy in victory. Your armies fight with a 15% chance of fanaticism.`,
    Evil: `Your realm rules through fear and domination. Your king commands Druid 1 from the outset, and all Monster armies follow your heroes without any Druid skill requirement (every level of Druid a commander does hold adds +20% to them), though a hero leads at most as many Creature and Monster units as his Druid level. You begin beside a Monster province you can lead from turn one, and there is always at least one within two provinces of your home. When your forces win decisively, a Terror effect lingers — any army defending that province in the next battle fights at −10% strength, broken by what they witnessed — and by Reign of Fear your Monsters fight at ×1.5 when they attack a province your own Terror still grips. Monster armies — Cave Trolls, Manticore Pride, Basilisk Brood, Sea Giants, Eldritch Kraken, Elder Dragons, Titan Warbeasts, Dread Hydras and Shark Shoals — fight with savage fury under your command — a host with any of them in it fights at ×1.25 in every battle (no roll; it does not stack with zeal, the stronger counts). When you conquer a province, your forces immediately plunder 50% of the province's tax value in gold. Your armies fight with a 25% base chance of fanaticism.`,
    Undead: `Your realm defies death itself. Your king commands Necromancy 1 from the outset and begins with a unit of Skeletal Shieldwall Levies at their side. All skeletal armies under your banner are exempt from the Druid penalty, cost only 1g upkeep each, and fight with undying fanaticism in EVERY battle — ×1.5 (+50%) when the king leads them in person, ×1.3 (+30%) under any other commander — the whole host is lifted. Harvest the Field: any of your characters standing where armies have fallen may raise one grave as a Skeletal unit for 2g — no magic, no Necromancy skill, just corpse-carters and cold work. Deathless March: a force of skeletons alone can never be cut down in flight — with no line of retreat they simply stand and hold the ground, because the dead do not panic. Battlefield graves in your provinces decay at half the normal rate, preserving more fallen armies for the Skeletal Armies spell. But beware: your court is priced at the far end of the alignment spectrum — righteous heroes cost dearly, and Divine heroes will never serve you at all.`,
  };

  const alignSummary = ALIGNMENT_SUMMARIES[playerAlignment] || '';
  const alignColours = {
    Divine: '#c8922a',
    Good: '#2d6a2d',
    Druidic: '#1a5e1a',
    Neutral: '#555',
    Pagan: '#7a4a00',
    Evil: '#8a1c1c',
    Undead: '#3a1a6a',
  };
  const alignIcons = { Divine: '✨', Good: '⚔', Druidic: '🌿', Neutral: '⚖', Pagan: '🔥', Evil: '💀', Undead: '💀' };
  const alignBanner = alignSummary
    ? kcHtml`
    <div style="background:#fdf8ee;border-left:4px solid ${alignColours[playerAlignment] || '#888'};padding:8px 12px;margin-bottom:10px;border-radius:0 3px 3px 0">
      <div style="font-family:'Cinzel',serif;font-size:.72rem;color:${alignColours[playerAlignment] || '#888'};text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;font-weight:700">${alignIcons[playerAlignment] || ''} ${playerAlignment} Realm</div>
      <div style="font-size:.78rem;color:#444;line-height:1.5">${bulletizeDesc(alignSummary)}</div>
    </div>`
    : '';

  const cmGuide =
    playerAlignment === 'Druidic' || playerAlignment === 'Evil'
      ? kcHtml`
    <div style="font-size:.72rem;color:var(--stone);background:#f5f0e8;border:1px solid var(--stone);border-radius:2px;padding:5px 8px;margin-bottom:8px">
      ${playerAlignment === 'Druidic' ? kcHtml`🌿 <strong>Druidic bonuses</strong> — <span style="color:#1d5a1d"><strong>[C] Creature</strong></span> armies get no Druid penalty and fight at ×1.5 in forest/jungle; every level of Druid your commander holds adds +20% to them. Your king starts with Druid +1.` : ''}
      ${playerAlignment === 'Evil' ? kcHtml`💀 <strong>Evil bonuses</strong> — <span style="color:#701010"><strong>[M] Monster</strong></span> armies get no Druid penalty and lift the whole host to ×1.25 in every battle (not stacking with zeal); every level of Druid your commander holds adds +20% to them. Your king starts with Druid +1. On decisive wins: Terror effect, and Reign of Fear — your Monsters fight ×1.5 attacking ground your Terror grips. On province conquest: instant 50% loot.` : ''}
      <br><span style="color:#1d5a1d;font-weight:600">[C] Creatures:</span> Thunderbirds, Forest Ents, Great Bears, Stone Giants, Unicorn Herd, Mammoth Host, Crimson Rocs, Whale Cohort, Great Turtles
      ${playerAlignment === 'Evil' ? kcHtml`<br><span style="color:#701010;font-weight:600">[M] Monsters:</span> Cave Trolls, Manticore Pride, Basilisk Brood, Sea Giants, Eldritch Kraken, Elder Dragons, Titan Warbeasts, Dread Hydras, Shark Shoals` : ''}
    </div>`
      : '';
  // Royal-succession skill allocation is rendered at the TOP of the orders column now
  // (see heirSelectorHTML in buildOrdersForm), not here in the realm section.
  document.getElementById('report-kingdom').innerHTML = kcHtml`${alignBanner}${cmGuide}
    <div class="report-grid">
      <div class="stat-box"><div class="stat-label">Treasury</div><div class="stat-value">${kingdom.gold || 0}g</div></div>
      <div class="stat-box"><div class="stat-label">Tax Income</div><div class="stat-value">${taxIncome}g/turn</div>${(() => {
        // A ledger: the bare province tax first, then one line per SOURCE of bonus, then penalties —
        // the lines always sum to the total above. Every gold-paying Sage discovery is ONE line.
        const K = (k) => kingdom[k] || 0;
        const sage =
          kingdom.sageDiscG != null
            ? kingdom.sageDiscG
            : K('sdRecords') + K('sdAgri') + K('sdMining') + K('sdAqueduct') + K('sdCreed') + K('interestBonus');
        const bonuses = [
          [K('consecG'), 'consecrated ground'],
          [K('neutralTradeBonus'), 'Neutral trade'],
          [sage, 'Sage Discoveries'],
          [K('sdGrand'), 'Grand Design'],
          [K('taxBonus'), 'magic items (tax bonus)'],
          [K('perProvBonus'), "Merchant's Ledger"],
          [K('thiefStipend'), 'master Thief stipend'],
          [K('cutpurseG'), 'the Cutpurse'],
          [K('championG'), 'Champion of the People'],
          [K('castellanG'), 'the Castellan'],
        ].filter((b) => b[0] > 0);
        const eq = K('earthquakeReduction'),
          ens = K('enslaveReduction');
        const bonusSum = bonuses.reduce((a, b) => a + b[0], 0);
        // older saved reports carry no rawTaxBase — derive it so the ledger still sums
        const rawBase = kingdom.rawTaxBase != null ? kingdom.rawTaxBase : Math.max(0, taxIncome - bonusSum + eq + ens);
        const row = (txt, col) =>
          kcHtml`<div style="font-size:.62rem;color:${col};margin-top:1px;line-height:1.3">${txt}</div>`;
        const incl = [
          row(`Base province tax: ${rawBase}g`, 'var(--stone)'),
          bonuses.map((b) => row(`+${b[0]}g ${b[1]}`, '#2d7a2d')),
          bonuses.length ? '' : row('no bonuses', 'var(--stone)'),
          // 2026-09-24: every tax-gold source is capped at 5% of the base province tax; say so when
          // the cap actually bit on the item gold (the discovery lines are capped one by one).
          K('taxBonusCutG') > 0
            ? row(
                `−${K('taxBonusCutG')}g of item tax gold above the ${K('taxBonusCapG')}g cap (5% of base tax)`,
                '#8a6d1f',
              )
            : '',
        ];
        const eqLine = eq > 0 ? row(`−${eq}g lost to earthquake damage`, '#c00') : '';
        const ensLine = ens > 0 ? row(`−${ens}g enslaved provinces seethe`, '#c00') : '';
        // The box projects NEXT turn's collection from the realm as it stands now; what was
        // actually banked this turn (with any one-turn Bless / Earthquake / Sabotage effects) is
        // the "collects...g in taxes" line under Kingdom Events.
        const noteLine = kcHtml`<div style="font-size:.6rem;color:var(--stone);margin-top:2px;line-height:1.3">projected for next turn — this turn's actual take is under Kingdom Events</div>`;
        return kcHtml`${incl}${eqLine}${ensLine}${noteLine}`;
      })()}</div>
      <div class="stat-box"><div class="stat-label">Army Wages</div><div class="stat-value" style="color:${armyWages > 0 ? '#c00' : 'inherit'}">${armyWages}g/turn</div>${(kingdom.hostLeaderG || 0) > 0 ? kcHtml`<div style="font-size:.62rem;color:#1d5a1d;margin-top:2px;line-height:1.3">after −${kingdom.hostLeaderG}g the Host-Leader</div>` : ''}${(kingdom.orcSpoilsG || 0) > 0 ? kcHtml`<div style="font-size:.62rem;color:#1d5a1d;margin-top:2px;line-height:1.3">after −${kingdom.orcSpoilsG}g Orcish war-spoils</div>` : ''}${kingdom.nextArmyWages != null && kingdom.nextArmyWages !== kingdom.armyWages ? kcHtml`<div style="font-size:.62rem;color:#2a2419;margin-top:2px;line-height:1.3">next turn: ${kingdom.nextArmyWages}g</div>` : ''}</div>
      <div class="stat-box"><div class="stat-label">Hero Wages</div><div class="stat-value" style="color:${heroWages > 0 ? '#c00' : 'inherit'}">${heroWages}g/turn</div>${(kingdom.heroWageDisc || 0) > 0 ? kcHtml`<div style="font-size:.62rem;color:#1d5a1d;margin-top:2px;line-height:1.3">after −${kingdom.heroWageDisc}g wage discounts</div>` : ''}${kingdom.nextHeroWages != null && kingdom.nextHeroWages !== kingdom.heroWages ? kcHtml`<div style="font-size:.62rem;color:#2a2419;margin-top:2px;line-height:1.3">next turn: ${kingdom.nextHeroWages}g</div>` : ''}</div>
      <div class="stat-box"><div class="stat-label">Net Income</div><div class="stat-value" style="color:${netIncome >= 0 ? '#2d7a2d' : '#c00'}">${netIncome >= 0 ? '+' : ''}${netIncome}g/turn</div></div>
      <div class="stat-box"><div class="stat-label">Provinces</div><div class="stat-value">${(report.ownedProvinces || []).length}</div></div>
    </div>
    ${chars
      .filter((c) => c.alive !== false)
      .map((c) => {
        const hpPct = floorNumP((c.hp / c.maxHp) * 100) || 0;
        // 2026-09-09e: was the raw trained level only — item, aura and Curse changes never showed, so
        // this card disagreed with both the orders column and the engine. Now the shared renderer.
        const skillRow = skillRowHTML(c, 'inline'); // match the orders column's inline style
        const effSpd =
          (c.armies || []).length === 0
            ? 5
            : c.effectiveSpeed != null
              ? c.effectiveSpeed
              : Math.min(...(c.armies || []).map((a) => a.speed || 3));
        return kcHtml`<div class="char-card">
        <div class="char-card-head">
          <span style="font-size:.9rem">${c.isKing ? '👑' : '⚔'}</span>
          <span class="cname">${c.name} ${c.isKing ? '(Your King)' : '(Hero)'}</span>
          <div class="char-hp-wrap"><div class="char-hp-bar" style="width:${hpPct}%"></div></div>
          <span style="font-size:.7rem;color:var(--stone)">HP ${c.hp}/${c.maxHp}</span>
        </div>
        <div class="char-detail" style="background:#fdf5e0;border:1px solid var(--parchment-dark);border-radius:2px;padding:5px 10px 6px;font-size:.76rem;line-height:1.6;display:flex;flex-wrap:wrap;gap:8px">
          <span style="flex-basis:100%;width:100%;color:var(--stone)">${formatRace(c.race)} · ${c.alignment || '—'} · ${c.temper || '—'}${c.temperEff && c.temperEff !== c.temper ? kcHtml` <span style="color:#6a4a9a">(fights as ${c.temperEff} — equipped item)</span>` : ''}</span>
          <span><strong>HP:</strong> ${c.hp}/${c.maxHp}</span>
          <span>📍 In ${provLinkHtml(c.locationId, c.locationName || 'Unknown')}</span>
          <span style="color:var(--forest)" title="1 province per phase used to move, +1 per province conquered"><strong>Move:</strong> ${effSpd} province${effSpd !== 1 ? 's' : ''}/turn</span>
          ${!c.isKing ? kcHtml`<span><strong>Pay:</strong> ${c.pay || 1}g/turn</span>` : ''}
          ${skillRow}
          ${itemsForDisplayP(c).map((i) => kcHtml`<div style="flex-basis:100%;width:100%;color:var(--item-ink);font-weight:600">${itemAcquiredTagP(i)}🔮 ${itemLoreTip(i, i.name)}${itemTierTagP(i)}${itemBoundTag(i, c)}${itemUsableByP(i, c) ? itemSlotTag(i, c) : ''}${i.desc ? kcHtml` <span style="color:var(--item-desc);font-weight:400">(${i.desc})</span>` : ''}</div>`)}
          ${(() => {
            const maj = c.titlesHeld || [],
              min = c.minorHeld || [];
            if (!maj.length && !min.length) return '';
            const majH = maj.map(
              (tt) =>
                kcHtml`<div style="font-size:.72rem;margin-top:3px"><span style="background:#fdf3d8;border:1px solid var(--gold);border-radius:2px;padding:0 4px;font-family:'Cinzel',serif;color:#5a3f08">🏆 ${tt.name}</span> <span style="color:#231e16">${tt.perk || ''}</span></div>`,
            );
            const minH = min.map(
              (tt) =>
                kcHtml`<div style="font-size:.72rem;margin-top:2px"><span style="background:#eef3e6;border:1px solid #b8c9a8;border-radius:2px;padding:0 4px;color:#3a5a2a">🎖 ${tt.name}</span> <span style="color:#231e16">${tt.perk || ''}</span></div>`,
            );
            return kcHtml`<div style="flex-basis:100%;width:100%;margin-top:5px;border-top:1px dashed var(--parchment-dark);padding-top:4px"><div style="font-size:.64rem;color:var(--stone);text-transform:uppercase;letter-spacing:.05em">Titles &amp; perks</div>${majH}${minH}</div>`;
          })()}
          ${(() => {
            // Item: Armies Leading — the force under this character, with a summary of total
            // strength, move rate, upkeep, and which units need Druid skill to command.
            const arr = c.armies || [];
            const head = kcHtml`<div style="flex-basis:100%;width:100%;margin-top:5px;border-top:1px dashed var(--parchment-dark);padding-top:4px"><div style="font-size:.64rem;color:var(--stone);text-transform:uppercase;letter-spacing:.05em">Armies leading</div>`;
            if (arr.length === 0)
              return kcHtml`${head}<div style="font-size:.75rem;color:#3a3224">No armies led — moves 5 provinces/turn on its own.</div></div>`;
            const druLevel = effSkillP(c, 'druid');
            // Druid requirement, waivers and shortfall: ONE rule, druidNeedP (mirrors the engine).
            let totalStr = 0,
              totalCost = 0,
              druidUnits = 0,
              druidShort = 0;
            const lines = arr.map((a) => {
              // humanoid race affinity — a unit of the same race as your KING gets +20%, and a unit
              // led by a character of the same race gets +20% (they STACK → +44% when both apply). Same
              // base-strength boost the engine applies; a character's race is always humanoid, so
              // Creatures/ Monsters/skeletons never match. Shown before terrain/tactics, like
              // everything else here.
              const rawBs = unitBaseStrengthP(a);
              const kingRaceMatch = !!(a.race && kingdom.race && a.race === kingdom.race);
              const leadRaceMatch = !!(a.race && a.race === c.race);
              // Racial animosity: Elves & Dwarves, Humans & Orcs fight at −20% under a rival-kin
              // commander.
              const _RIVAL_RACE_UI = { ...KC_RIVAL_RACE };
              const feudLed = !!(a.race && c.race && _RIVAL_RACE_UI[a.race] === c.race);
              let bs = rawBs;
              if (kingRaceMatch) bs = Math.round(bs * 1.2);
              if (leadRaceMatch) bs = Math.round(bs * 1.2);
              if (feudLed) bs = Math.round(bs * 0.8);
              const creature = CREATURE_ARMIES_UI.has(a.type),
                monster = MONSTER_ARMIES_UI.has(a.type);
              const _dn = druidNeedP(a, c, report); // skeleton / Druidic-creature / sd40 waivers, same-race Druid 1
              const req = _dn.req;
              if (_dn.counts) druidUnits++;
              const effDru = _dn.effDru;
              const shortfall = _dn.shortfall;
              // a Druid shortfall actually REDUCES the unit's strength — apply it to the shown
              // figure and the panel total (matching the engine's max(0.1, 1−0.2×shortfall)),
              // instead of only tagging the penalty beside a full-strength number.
              if (shortfall > 0) {
                druidShort++;
                bs = Math.max(1, Math.round(bs * Math.max(0.1, 1 - shortfall * 0.2)));
              }
              // DRUID MASTERY (2026-09-24, mirrors GM druidMasteryGain): +20% per Druid level over the
              // unit's minimum (0 where the requirement is waived), Druid counted to 9, capped +100%.
              const mastery =
                !a.skeletal && (creature || monster) ? Math.min(100, 20 * Math.max(0, Math.min(9, druLevel) - req)) : 0;
              if (mastery > 0) bs = Math.round(bs * (1 + mastery / 100));
              totalStr += bs;
              totalCost += a.cost != null ? a.cost : 2;
              const mast =
                mastery > 0
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.66rem">+${mastery}% Druid mastery</span>`
                  : '';
              const pen =
                shortfall > 0
                  ? kcHtml` <span style="color:var(--crimson);font-size:.68rem">−${shortfall * 20}% str (Druid ${effDru}/${req})</span>`
                  : '';
              const raceBoost =
                kingRaceMatch || leadRaceMatch
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.66rem">+${kingRaceMatch && leadRaceMatch ? 44 : 20}% kin</span>`
                  : '';
              const feudTag = feudLed
                ? kcHtml` <span style="color:var(--crimson);font-size:.66rem">−20% feud</span>`
                : '';
              const tag =
                creature || monster
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.62rem">[${creature ? 'Creature' : 'Monster'}]</span>`
                  : '';
              return kcHtml`<div style="font-size:.75rem">${unitAbilityTip(a.type, kcHtml`${unitEmoji(a.type)} <span style="color:${reportColour(kingdom.color) || 'var(--ink)'}">${armyLabel(a, { noMove: true })}</span>`)} <span style="color:var(--stone);font-size:.66rem">str ${bs}${a.moveRate != null ? ` · move ${a.moveRate}${a.moveKind === 'sea' ? ' (sea)' : a.moveKind === 'air' ? ' (air)' : ''}` : ''}</span>${tag}${raceBoost}${feudTag}${mast}${pen}</div>`;
            });
            const effSpd2 = c.effectiveSpeed != null ? c.effectiveSpeed : Math.min(...arr.map((a) => a.speed || 3));
            // FLYING CARRY note. If humanoid flyers are lifting foot soldiers (a mixed airborne
            // column that can cross sea), tell the player so the raised speed and sea reach make
            // sense.
            const _FLY_UI2 = new Set(KC_UNIT_CLASS.flying);
            const _SEA_UI2 = new Set(KC_UNIT_CLASS.sea);
            const _AER_UI2 = new Set(KC_UNIT_CLASS.aerial);
            const _hasFlyer = arr.some((a) => _FLY_UI2.has(a.type));
            const _hasFoot = arr.some((a) => !_AER_UI2.has(a.type) && !_SEA_UI2.has(a.type));
            const _airborne =
              _hasFlyer && _hasFoot && !arr.some((a) => _SEA_UI2.has(a.type)) && c.effectiveSeaSpeed > 0;
            const _airNote = _airborne
              ? kcHtml` · <span style="color:#2d6a8a">🦅 Airborne — the flyers carry the foot soldiers, so the whole force flies (crosses sea, moves at the flyers' pace)</span>`
              : '';
            // sea transport — how many hulls this force needs to enter a sea province, and how many
            // it has. Mirrors the engine's getSeaCapability: only the six carrier fleets carry (a
            // hull each); light foot (levies, Men-at-Arms, archers incl. Black Arrows, gun-crews,
            // garrisons, Goblin Horde, Forest Wardens, Dwarven Guard, Orc Berserkers:
            // KC_UNIT_CLASS.lightFoot) take ½ a hull, everything else on foot takes
            // a full hull; flyers and sea units need none; Naval mastery (level 8+) halves the
            // need; a fully airborne column needs no ships at all.
            const _CARRIER_UI2 = new Set(KC_UNIT_CLASS.carrier);
            const _LIGHT_UI2 = new Set(KC_UNIT_CLASS.lightFoot);
            const _landUnits = arr.filter((a) => !_AER_UI2.has(a.type) && !_SEA_UI2.has(a.type));
            let _hullNeed = _landUnits.reduce((n, a) => n + (_LIGHT_UI2.has(a.type) ? 0.5 : 1), 0);
            if (effSkillP(c, 'naval') >= 8) _hullNeed /= 2;
            const _hullNeedShown = Math.ceil(_hullNeed);
            const _hullHave = arr.reduce(
              (n, a) => n + (_CARRIER_UI2.has(a.type) ? (KC_CARRIER_BERTHS && KC_CARRIER_BERTHS[a.type]) || 1 : 0),
              0,
            ); // berths: a turtle's Island Back offers two
            let _seaNote = '';
            if (_landUnits.length === 0)
              _seaNote = kcHtml` · ⚓ <span style="color:#2d6a8a">Sea: every unit sails or flies on its own</span>`;
            else if (_airborne) _seaNote = '';
            else if (_hullHave >= _hullNeed)
              _seaNote = kcHtml` · ⚓ <span style="color:#1d5a1d">Sea transport: needs ${_hullNeedShown} hull${_hullNeedShown !== 1 ? 's' : ''}, has ${_hullHave} — can put to sea</span>`;
            else
              _seaNote = kcHtml` · ⚓ <span style="color:var(--crimson)">Sea transport: needs ${_hullNeedShown} hull${_hullNeedShown !== 1 ? 's' : ''}, has ${_hullHave} — ${_hullNeedShown - _hullHave} more fleet unit${_hullNeedShown - _hullHave !== 1 ? 's' : ''} to carry the whole force</span>`;
            const druNote =
              druidUnits > 0
                ? kcHtml` · 🌿 ${druidUnits} unit${druidUnits !== 1 ? 's' : ''} need Druid ${druidShort > 0 ? kcHtml`<span style="color:var(--crimson)">(${druidShort} under-led — losing strength)</span>` : kcHtml`<span style="color:#1d5a1d">(${c.name.split(' ')[0]} qualifies)</span>`}`
                : '';
            const summary = kcHtml`<div style="margin-top:3px;font-size:.7rem;color:var(--stone);border-top:1px dotted var(--parchment-dark);padding-top:2px">⚔ Total strength <strong>${totalStr}</strong> <span style="font-size:.64rem">(base, before terrain/tactics/fanaticism)</span> · 🏃 Move <strong>${effSpd2}</strong> province${effSpd2 !== 1 ? 's' : ''}/turn · 💰 Upkeep <strong>${totalCost}g/turn</strong>${druNote}${_airNote}${_seaNote}</div>`;
            // ONE line stands for the whole army — strength, a count of each unit type, and the
            // land / flying / sea pace — with a button that unfolds the full unit list (and the
            // upkeep/druid/sea-transport notes) beneath it. The list starts folded.
            const _typeCounts = {};
            arr.forEach((a) => {
              const k = a.type || 'unit';
              _typeCounts[k] = (_typeCounts[k] || 0) + 1;
            });
            const _typeLine = Object.keys(_typeCounts)
              .map((k) => `${unitEmoji(k)} ${_typeCounts[k] > 1 ? _typeCounts[k] + '× ' : ''}${k}`)
              .join(', ');
            const _airSpd = c.effectiveAirSpeed != null ? c.effectiveAirSpeed : 0;
            const _seaSpd = c.effectiveSeaSpeed != null ? c.effectiveSeaSpeed : 0;
            const _paceBits = [kcHtml`🏃 Land <strong>${effSpd2}</strong>`];
            if (_airSpd > 0) _paceBits.push(kcHtml`🦅 Flying <strong>${_airSpd}</strong>`);
            if (_seaSpd > 0) _paceBits.push(kcHtml`⚓ Sea <strong>${_seaSpd}</strong>`);
            // Item 24 (2026-10-12): a hero leads at most as many Creature and Monster units as his Druid level.
            const _bLed = arr.filter(beastCommandCountP).length;
            const _bNote =
              _bLed > 0
                ? kcHtml` · <span style="color:${_bLed > druLevel ? 'var(--crimson)' : '#1d5a1d'}" title="A hero may lead only as many Creature and Monster units as his Druid level">🐾 beasts ${_bLed}/${druLevel}${_bLed > druLevel ? ' — over his Druid, he takes on no more' : ''}</span>`
                : '';
            const _oneLine = kcHtml`<div style="font-size:.74rem;line-height:1.5;display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap">
              <span style="flex:1;min-width:0">⚔ <strong>${arr.length}</strong> unit${arr.length !== 1 ? 's' : ''} · strength <strong>${totalStr}</strong>${druidShort > 0 ? kcHtml` <span style="color:var(--crimson);font-size:.66rem">(${druidShort} under-led)</span>` : ''}${_bNote} · ${_typeLine} · ${kcJoinP(_paceBits, ' · ')}</span>
              <button type="button" class="secall-btn" style="flex-shrink:0" aria-expanded="false" onclick="var d=this.parentNode.nextElementSibling;var open=d.style.display==='none';d.style.display=open?'block':'none';this.setAttribute('aria-expanded',open?'true':'false');this.textContent=open?'▾ hide units':'▸ show units'">&#9656; show units</button>
            </div>`;
            return kcHtml`${head}${_oneLine}<div style="display:none">${lines}${summary}</div></div>`;
          })()}
        </div>
      </div>`;
      })}`;

  // Provinces list your provinces alphabetically by name (a copy — never sort the report array in
  // place).
  const provs = [...(report.ownedProvinces || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  document.getElementById('report-provinces').innerHTML = provs.length
    ? provs.map(
        (p) => kcHtml`<div class="prov-entry">
        <div class="prov-name">${p.name} <span style="font-size:.7rem;color:var(--stone);font-family:serif">${capitalise(p.terrain)}</span></div>
        <div class="prov-detail">
          Tax: ${p.tax}g/turn · ${formatRace(p.race)} · Explored: ${p.explored || 0}%<br>
          ${
            (p.features || []).filter((f) => f.discovered && !f.cleared).length > 0
              ? kcHtml`Known lairs: ${kcJoinP(
                  p.features.filter((f) => f.discovered && !f.cleared).map((f) => _lairName(f)),
                  ', ',
                )}`
              : 'No lairs discovered yet'
          }
          ${
            (p.features || []).filter((f) => f.cleared).length > 0
              ? kcHtml`<br>Cleared: ${kcJoinP(
                  p.features.filter((f) => f.cleared).map((f) => _lairName(f)),
                  ', ',
                )}`
              : ''
          }
          <br>Recruitable: ${
            (p.armyTypes || []).length
              ? kcJoinP(
                  p.armyTypes.map((t) => unitAbilityTip(t, `${unitEmoji(t)} ${t}`)),
                  ' · ',
                )
              : 'none'
          }
          ${(p.garrisonArmies || []).length ? kcHtml`<br><strong>Garrisoned (unled):</strong>${p.garrisonArmies.map((a) => kcHtml`<br>${unitAbilityTip(a.type, kcHtml`${unitEmoji(a.type)} <span style="color:${reportColour(kingdom.color) || 'var(--ink)'}">${armyLabel(a)}</span>`)}`)}` : ''}
          ${(p.neutralDefenders || []).length ? kcHtml`<br><strong>Defenders:</strong>${p.neutralDefenders.map((d) => kcHtml`<br>${unitAbilityTip(d.type, kcHtml`${unitEmoji(d.type)} <span style="color:#231e16">${armyLabel(d)}</span>`)}`)}` : ''}
          ${provinceGrandDesignHTML(p)}
          ${terrorNoteP(p, true)}
        </div>
      </div>`,
      )
    : kcHtml`<div style="color:#3a3224;font-size:.85rem">No provinces owned yet.</div>`;

  // Intel — province info + hero sightings
  const intel = report.intel || [];
  const sightings = report.heroSightings || [];
  const knownFeatures = report.knownFeatures || [];
  const mercs = report.mercIntel || [];
  let intelHtml = [];
  let otherForcesHtml = []; // item: mercenary bands + wandering heroes + enemy heroes sighted → own card
  let lairsHtml = []; // item: known lairs → own card

  // Dead heroes visible to this player — listed here in the Other Armies & Heroes card (a dead
  // character whose body-province you can see, plus any you witnessed fall this turn). They also
  // get a "(dead)" marker on the map (see renderPlayerMap).
  const visDeadHeroes = report.visibleDeadHeroes || [];
  if (visDeadHeroes.length > 0) {
    otherForcesHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#46275f;margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">💀 Fallen Heroes</div>`,
    );
    otherForcesHtml.push(
      visDeadHeroes.map(
        (h) => kcHtml`<div class="intel-entry" style="border-left-color:#5a3a7a;background:#f8f0ff">
      <strong>${h.name}</strong> <span style="color:#701010">(dead)</span>${h.race || h.alignment ? ` (${[h.race, h.alignment].filter(Boolean).join(', ')})` : ''} ${deadHeroRealmTagP(h, report)} when they fell — body lies in ${h.locationName} (fell turn ${h.killedOnTurn})<br>
      <span style="font-size:.78rem">${h.topSkill ? kcHtml`${skillFameLabel(h.topSkill.level)} <span style="color:var(--gold)">${SKILL_LABELS[h.topSkill.skill] || h.topSkill.skill}</span>` : 'No notable skills'}</span><br>
      ${
        (h.servedOther !== undefined ? h.servedOther : h.player != null && !h.isOwn)
          ? kcHtml`<span style="font-size:.72rem;color:#701010">⛔ Sworn to another crown in life — Resurrect will not raise them for you. Only your own fallen and heroes who never served a rival can be brought back.</span>`
          : h.inVisibleProv
            ? kcHtml`<span style="font-size:.72rem;color:#46275f">💀 A hero with the Resurrect spell can raise them from this province.</span>`
            : kcHtml`<span style="font-size:.72rem;color:#332c20">Last known location — send a caster with the Resurrect spell to their province to raise them.</span>`
      }
    </div>`,
      ),
    );
  }

  // ── GRAVEYARDS KNOWN ────
  // Every province this realm has learned holds battlefield graves. A necromancer standing on the
  // ground senses only THAT they are there; Control Undead's province scan buys the roll of the
  // dead, and that fuller reading is shown here too. Both are stamped with the turn they were
  // learned, because neither is refreshed from a distance — the graves may since have been raised
  // or rotted away.
  // 2026-09-21: ONLY graveyards this realm knows something SPECIFIC about are listed here. A bare
  // "graves lie here, contents unknown" reading is already on the map as the ✝ marker, so printing
  // a paragraph per province for it buried the two or three readings that actually name the dead.
  // The bare sensings are untouched in `report.graveIntel` (and so on the map) — they are simply
  // not repeated in this section.
  const graveIntel = (report.graveIntel || []).filter((g) => g && g.detail && g.detail.length > 0);
  if (graveIntel.length > 0) {
    otherForcesHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#2e2e2e;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">💀 Graveyards Known</div>`,
    );
    otherForcesHtml.push(
      graveIntel.map((g) => {
        // a PARTIAL reading (the Deathpriest's Grave-sight) names only the crack and elite dead — say
        // "at least", because lesser ranks may lie beside them unseen.
        const det =
          g.detail && g.detail.length
            ? kcHtml`<span style="color:#46275f">The dead:</span> ${g.detailPartial ? 'at least ' : ''}${g.detail.map((d) => `${d.n}× ${d.k}`).join(', ')}${g.detailPartial ? kcHtml` <span style="color:#332c20">— Grave-sight names only the crack and elite; lesser dead may lie here unseen.</span>` : ''}${g.detailTurn && g.detailTurn !== g.turn ? kcHtml` <span style="color:#3a3224">(read turn ${g.detailTurn})</span>` : ''}`
            : kcHtml`<span style="color:#2f281c">Graves lie here — how many, and what they hold, is unknown.</span>`;
        return kcHtml`<div class="intel-entry" style="border-left-color:#4a4a4a;background:#f6f6f4">
        <strong>${g.name}</strong> <span style="color:#332c20;font-size:.78rem">(seen on turn ${g.turn != null ? g.turn : '?'})</span><br>
        <span style="font-size:.78rem">${det}</span><br>
        <span style="font-size:.72rem;color:#332c20">Older knowledge — these graves may since have been raised or rotted away.</span>
      </div>`;
      }),
    );
  }

  // Mercenary bands visible in accessible provinces → Other Armies & Heroes card
  if (mercs.length > 0) {
    otherForcesHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#701010;margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Mercenary Bands</div>`,
    );
    otherForcesHtml.push(
      mercs.map(
        (m) => kcHtml`<div class="intel-entry" style="border-left-color:#8a1c1c;background:#fff8f8">
      <strong>${m.unitName || m.type}</strong> (${m.quality} ${m.type}) — ${m.location}<br>
      <span style="font-size:.72rem;color:#6a3030">Available for hire — use Recruit Armies in ${m.location}.</span>
    </div>`,
      ),
    );
  }
  if (sightings.length > 0) {
    const wanderers = sightings.filter((s) => s.type === 'wandering');
    const chieftains = sightings.filter((s) => s.type === 'neutral_guard'); // neutral province defenders
    const enemies = sightings.filter((s) => s.type === 'enemy');
    if (wanderers.length > 0) {
      otherForcesHtml.push(
        kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--gold);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Wandering Heroes</div>`,
      );
      otherForcesHtml.push(
        wanderers.map((s) => {
          const topStr = s.topSkill
            ? kcHtml`<span style="color:var(--gold)">${SKILL_LABELS[s.topSkill.skill] || s.topSkill.skill}</span>`
            : 'no known skills';
          const skillLine =
            s.spiedSkills && Object.keys(s.spiedSkills).some((k) => s.spiedSkills[k] > 0)
              ? kcHtml`<span style="color:#1d5a1d">🔍 Skills (spied turn ${s.spiedTurn}):</span> ${Object.entries(
                  s.spiedSkills,
                )
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
                  .join(', ')}`
              : s.topSkill
                ? kcHtml`${skillFameLabel(s.topSkill.level)} ${topStr}`
                : 'No known skills';
          return kcHtml`<div class="intel-entry" style="border-left-color:#c8922a">
          ⚔ <strong>${s.name}</strong> (${s.race}, ${s.alignment}) — ${s.locationName}<br>
          <span style="font-size:.78rem">${skillLine}${spiedExtraP(s)}${s.armyBand ? kcHtml` · <span style="color:#2f281c">${s.armyBand}</span>` : ''} · ${s.pay != null ? kcHtml`Hire for <strong>${s.pay}g/turn</strong>` : kcHtml`<span style="color:#a33">Will not serve your crown (alignment gulf)</span>`}${s.inOwnedProvince ? kcHtml` · <span style="color:#8fbc5a">In your province</span>` : ''}</span>
        </div>`;
        }),
      );
    }
    if (chieftains.length > 0) {
      otherForcesHtml.push(
        kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#8a6a2a;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Local Chieftains</div>`,
      );
      otherForcesHtml.push(
        chieftains.map((s) => {
          const topStr = s.topSkill
            ? kcHtml`<span style="color:var(--gold)">${SKILL_LABELS[s.topSkill.skill] || s.topSkill.skill}</span>`
            : 'no known skills';
          const skillLine =
            s.spiedSkills && Object.keys(s.spiedSkills).some((k) => s.spiedSkills[k] > 0)
              ? kcHtml`<span style="color:#1d5a1d">🔍 Skills (spied turn ${s.spiedTurn}):</span> ${Object.entries(
                  s.spiedSkills,
                )
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
                  .join(', ')}`
              : s.topSkill
                ? kcHtml`${skillFameLabel(s.topSkill.level)} ${topStr}`
                : 'No known skills';
          return kcHtml`<div class="intel-entry" style="border-left-color:#8a6a2a">
          🛡 <strong style="color:${CHIEFTAIN_MARKER_COLOR}">${s.name}</strong> (local chieftain — ${s.race}, ${s.alignment}) — ${s.locationName}<br>
          <span style="font-size:.78rem">${skillLine}${spiedExtraP(s)}${s.armyBand ? kcHtml` · <span style="color:#2f281c">${s.armyBand}</span>` : ''}${s.inOwnedProvince ? kcHtml` · <span style="color:#8fbc5a">In your province</span>` : ''}</span>
        </div>`;
        }),
      );
    }
    if (enemies.length > 0) {
      otherForcesHtml.push(
        kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#7a1c1c;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Enemy Heroes</div>`,
      );
      otherForcesHtml.push(
        enemies.map((s) => {
          const topStr = s.topSkill
            ? kcHtml`<span style="color:var(--gold)">${SKILL_LABELS[s.topSkill.skill] || s.topSkill.skill}</span>`
            : 'no known skills';
          const skillLine =
            s.spiedSkills && Object.keys(s.spiedSkills).some((k) => s.spiedSkills[k] > 0)
              ? kcHtml`<span style="color:#1d5a1d">🔍 Skills (spied turn ${s.spiedTurn}):</span> ${Object.entries(
                  s.spiedSkills,
                )
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
                  .join(', ')}`
              : s.topSkill
                ? kcHtml`${skillFameLabel(s.topSkill.level)} ${topStr}`
                : 'No known skills';
          return kcHtml`<div class="intel-entry" style="border-left-color:#7a1c1c">
          👁 <strong>${s.name}</strong> of ${s.kingdom}${s.race || s.alignment ? ` (${[s.race, s.alignment].filter(Boolean).join(', ')})` : ''} — ${s.locationName}<br>
          <span style="font-size:.78rem">${skillLine}${spiedExtraP(s)}${s.armyBand ? kcHtml` · <span style="color:#2f281c">${s.armyBand}</span>` : ''}${s.inOwnedProvince ? kcHtml` · <span style="color:#e05050">In your territory</span>` : ''}</span>
        </div>`;
        }),
      );
    }
  }

  // Province reports: ONLY unusual or uncommon events that struck provinces you control or could
  // see this turn — earthquakes, blessings, plagues, part-seas, floods, consecrations and the like.
  // Events are grouped by province and ordered by the phase they happened in.
  const provinceEvents = report.provinceEvents || [];
  if (provinceEvents.length > 0) {
    intelHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--stone);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Province Reports</div>`,
    );
    const SEASONS_E = KC_SEASONS.slice();
    const _evByProv = new Map();
    provinceEvents.forEach((ev) => {
      const key = ev.provName || 'Unknown province';
      if (!_evByProv.has(key)) _evByProv.set(key, []);
      _evByProv.get(key).push(ev);
    });
    [..._evByProv.keys()]
      .sort((a, b) => a.localeCompare(b))
      .forEach((prov) => {
        const evs = _evByProv
          .get(prov)
          .slice()
          .sort((a, b) => (a.phase ?? 99) - (b.phase ?? 99));
        const rows = evs.map((ev) => {
          const phLbl = ev.phase != null && ev.phase >= 0 && ev.phase <= 4 ? SEASONS_E[ev.phase] : null;
          return kcHtml`<div style="padding:1px 0;font-size:.76rem">${phLbl ? kcHtml`<span style="color:var(--stone);font-size:.66rem">${phLbl}: </span>` : ''}${ev.text}</div>`;
        });
        intelHtml.push(kcHtml`<div class="intel-entry" style="border-left-color:#7a4fa0">
        <strong style="font-family:'Cinzel',serif;font-size:.76rem">${prov}</strong>
        ${rows}
      </div>`);
      });
  }

  // ── Spied Provinces — every province you SPIED this turn, and the characters standing there at
  // END of turn (even if your agent has since moved on). Only non-your characters shown.
  const spiedProvIntel = (report.provinceCharIntel || []).filter((p) => p.spied);
  if (spiedProvIntel.length > 0) {
    intelHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#1d5a1d;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">🔍 Spied Provinces</div>`,
    );
    spiedProvIntel.forEach((pc) => {
      const others = (pc.characters || []).filter((ch) => ch.category !== 'own');
      const roster =
        others.length > 0
          ? others.map((ch) => {
              const who =
                ch.category === 'enemy'
                  ? kcHtml`<strong${ch.color ? kcHtml` style="color:${reportColour(ch.color)}"` : ''}>${ch.name}</strong>${ch.isKing ? ' 👑' : ''} of ${ch.kingdom || 'an enemy realm'}`
                  : kcHtml`<strong${ch.isNeutralGuard ? kcHtml` style="color:${CHIEFTAIN_MARKER_COLOR}"` : ''}>${ch.name}</strong>${ch.isNeutralGuard ? ' (local chieftain)' : ' (wandering)'}`;
              const force =
                ch.armies && ch.armies.length > 0
                  ? ` — ${ch.armies.map((a) => armyLabel(a, { short: true })).join(', ')}`
                  : ch.armyBand
                    ? ch.armyBand === 'no armies'
                      ? ''
                      : ` — leads ${ch.armyBand}`
                    : ch.armyCount > 0
                      ? ` — leads ${ch.armyCount} unit${ch.armyCount !== 1 ? 's' : ''}`
                      : '';
              const sk =
                ch.spiedSkills && Object.keys(ch.spiedSkills).some((k) => ch.spiedSkills[k] > 0)
                  ? kcHtml`<br><span style="font-size:.72rem;color:#1d5a1d">🔍 Skills:</span> ${Object.entries(
                      ch.spiedSkills,
                    )
                      .filter(([, v]) => v > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
                      .join(', ')}`
                  : '';
              return kcHtml`<div style="padding:1px 0;font-size:.78rem">${who}${force}${sk}</div>`;
            })
          : kcHtml`<div style="padding:1px 0;font-size:.76rem;color:#2f281c">No other characters present at turn's end.</div>`;
      intelHtml.push(kcHtml`<div class="intel-entry" style="border-left-color:#2d7a2d;background:#f2faf2">
        <strong style="font-family:'Cinzel',serif;font-size:.76rem">${pc.provName}</strong>
        ${roster}
      </div>`);
    });
  }

  // ── Spy Activity Reports — what other realms' characters DID in a province you spied, in the
  // phases after your agent arrived (the spy's lingering line of sight).
  const spyActivity = report.spyActivity || [];
  if (spyActivity.length > 0) {
    const SEASONS_SA = KC_SEASONS.slice();
    intelHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#2d6a7a;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">🔍 Spy Activity Reports</div>`,
    );
    spyActivity.forEach((sa) => {
      const rows = (sa.lines || []).map((l) => {
        const phLbl = l.phase != null && l.phase >= 0 && l.phase <= 4 ? SEASONS_SA[l.phase] : null;
        return kcHtml`<div style="padding:1px 0;font-size:.76rem">${phLbl ? kcHtml`<span style="color:var(--stone);font-size:.66rem">${phLbl}: </span>` : ''}${l.text}</div>`;
      });
      intelHtml.push(kcHtml`<div class="intel-entry" style="border-left-color:#2d6a7a;background:#f2f8fa">
        <strong style="font-family:'Cinzel',serif;font-size:.76rem">${sa.provName}</strong>
        <div style="font-size:.68rem;color:#2f281c;margin-bottom:2px">Watched by your agent from ${SEASONS_SA[sa.sincePhase] || 'later that turn'} onward:</div>
        ${rows}
      </div>`);
    });
  }

  // (Removed) The "Turn Intelligence — by Phase" block duplicated the earlier Intelligence Reports
  // section, so it no longer renders here.

  // Known features
  if (knownFeatures.length > 0) {
    lairsHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--forest);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Known Lairs</div>`,
    );
    lairsHtml.push(kcHtml`<div style="font-size:.73rem;color:var(--stone);margin-bottom:6px;line-height:1.8">
      Guardian difficulty: 
      <span style="background:#4a8a4a;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">🐾 Weak</span> can be handled by a lone hero ·
      <span style="background:#c8922a;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">⚔ Moderate</span> needs skill or good tactics ·
      <span style="background:#8a1c1c;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">💀 Powerful</span> very dangerous, prepare carefully ·
      <span style="background:#5a0a9a;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">🔥 Legendary</span> near-impossible alone
    </div>`);
    const POWER_COLORS = { ...GUARD_POWER_COLORS_P };
    const POWER_ICONS = { Weak: '🐾', Moderate: '⚔', Powerful: '💀', Legendary: '🔥' };
    // Group features by the province they sit in, so a player can see at a glance which province
    // holds which feature. Provinces are listed alphabetically; each feature drops the redundant
    // inline province name now that it lives under a province heading. 2026-09-12: once your realm
    // has learned a guardian's weakness — by scouting it in an encounter, or by watching it bite —
    // it is yours for the rest of the game, and shows against every lair holding that kind of
    // creature. Keyed by guardian name, exactly as the engine records it.
    const _knownWeak = (report && report.knownGuardianWeaknesses) || {};
    const featureCard = (f) => {
      const pColor = POWER_COLORS[f.monsterPower] || '#7a5510';
      const pIcon = POWER_ICONS[f.monsterPower] || '?';
      const powerBadge =
        f.monsterPower && !f.cleared
          ? kcHtml`<span style="background:${pColor};color:#fff;font-size:.65rem;padding:1px 5px;border-radius:2px;margin-left:4px">${pIcon} ${f.monsterPower}</span>`
          : '';
      // Ritual sites have no guardian — they are sacred ground usable only by a Pagan realm's
      // Perform Rite. Show that instead of an empty "Guardian:" line.
      if (f.ritualSite) {
        return kcHtml`<div class="intel-entry" style="border-left-color:#5a0a9a">
          🌙 <strong>${f.name}</strong>
          <br><span style="font-size:.78rem;color:#5a0a9a">A sacred site of the old faith — only a Pagan realm may Perform Rites here.</span>
        </div>`;
      }
      return kcHtml`<div class="intel-entry" style="border-left-color:${f.cleared ? '#888' : f.isOwned ? '#2d7a2d' : '#c8922a'}">
        ${f.cleared ? '✓' : '⭐'} <strong${f.cleared ? '' : kcHtml` style="color:${pColor}"`}>${f.name}</strong>${powerBadge}
        ${f.cleared ? kcHtml`<span style="color:#332c20">(cleared — no guardian)</span>` : kcHtml`<br><span style="font-size:.78rem;color:${pColor}">Guardian: ${f.monster}${f.monsterCat ? kcHtml` <span style="opacity:.8">(${f.monsterCat.toLowerCase()})</span>` : ''}</span>${!f.cleared && _knownWeak[f.monster] ? kcHtml`<br><span style="font-size:.76rem;color:#7a1c7a">\u{1F4A5} Weakness known \u2014 <strong>${_knownWeak[f.monster].name}</strong>: ${_knownWeak[f.monster].desc}.</span>` : ''}${_rumourLine(f)}`}
      </div>`;
    };
    // what Hunting Rumours learned of the hoard, remembered on the realm and shipped as `f.rumour`
    // ({turn, gold, items, stolen, wields}). The ODDS are never shown here \u2014 they belonged to
    // one hero on one day. Stamped with the turn, because a thief may have been through since.
    const _rumourLine = (f) => {
      const r = f.rumour;
      if (!r || f.cleared) return '';
      const items = (r.items || []).length
        ? `, and ${(r.items || []).join(', ')}`
        : (r.stolen || []).length
          ? ` \u2014 its magic (${r.stolen.join(', ')}) was already lifted by a thief`
          : ' \u2014 no magic lies there';
      const wield = (r.wields || []).length
        ? kcHtml` <span style="color:#701010">It wields ${r.wields.join(', ')} against all comers.</span>`
        : '';
      return kcHtml`<br><span style="font-size:.76rem;color:#6b5a2a">\u{1F4B0} Hoard known (turn ${r.turn}) \u2014 exactly <strong>${r.gold}g</strong>${items}.${wield}</span>`;
    };
    const featuresByProvince = {};
    knownFeatures.forEach((f) => {
      const key = f.province || 'Unknown province';
      (featuresByProvince[key] = featuresByProvince[key] || []).push(f);
    });
    lairsHtml.push(
      Object.keys(featuresByProvince)
        .sort((a, b) => a.localeCompare(b))
        .map((prov) => {
          const feats = featuresByProvince[prov];
          const cards = feats.map(featureCard);
          // 2026-09-24 (Toby item 4): province headings bold and in a darker ink than the gold they wore.
          return kcHtml`<div style="font-family:'Cinzel',serif;font-size:.76rem;color:#3a2a10;font-weight:700;margin:8px 0 2px;letter-spacing:.03em">📍 ${prov} <span style="color:var(--stone);font-weight:normal;font-size:.68rem">(${feats.length} lair${feats.length !== 1 ? 's' : ''})</span></div>${cards}`;
        }),
    );
  }

  {
    const _ri = document.getElementById('report-intel');
    if (_ri) {
      const _sec = document.getElementById('intel-reports-section');
      const _other = _sec ? _sec.querySelectorAll('.log-entry').length : 0;
      _ri.innerHTML = intelHtml.length
        ? kcHtml`${intelHtml}`
        : _other
          ? ''
          : kcHtml`<em style="color:#3a3224;font-size:.85rem">No intelligence gathered yet. Visit or spy provinces to learn more.</em>`;
    }
  }
  const _ofEl = document.getElementById('report-other-forces');
  if (_ofEl)
    _ofEl.innerHTML = otherForcesHtml.length
      ? kcHtml`${otherForcesHtml}`
      : kcHtml`<em style="color:#3a3224;font-size:.85rem">No mercenary bands or loose heroes sighted yet.</em>`;
  const _lrEl = document.getElementById('report-lairs');
  if (_lrEl)
    _lrEl.innerHTML = lairsHtml.length
      ? kcHtml`${lairsHtml}`
      : kcHtml`<em style="color:#3a3224;font-size:.85rem">No lairs discovered yet. Explore or scout provinces to find them.</em>`;

  // ── Sage Discoveries ──
  const discoveries = report.discoveries || [];
  const discEl = document.getElementById('report-discoveries');
  if (discEl) {
    if (discoveries.length === 0) {
      discEl.innerHTML = kcHtml`<em style="color:#3a3224;font-size:.85rem">No discoveries yet. Give Research orders to your scholars (Sage 1+).</em>`;
    } else {
      // Group by category
      const catMap = {};
      discoveries.forEach((d) => {
        if (!catMap[d.category]) catMap[d.category] = [];
        catMap[d.category].push(d);
      });
      const catColors = {
        Military: '#7a1c1c',
        Economy: '#2d7a2d',
        Espionage: '#1a4a6e',
        Scholarship: '#6a3a9a',
        Heroic: '#8a6a1a',
        Special: '#3a7a6a',
      };
      discEl.innerHTML = Object.entries(catMap).map(
        ([cat, discs]) => kcHtml`
        <div style="margin-bottom:12px">
          <div style="font-family:Cinzel,serif;font-size:.72rem;color:${catColors[cat] || '#555'};text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">
            ${cat}
          </div>
          ${discs.map(
            (d) => kcHtml`<div class="intel-entry" style="border-left-color:${catColors[cat] || '#555'}">
            <strong>${d.name}</strong> <span style="color:#3a3224;font-size:.72rem">(Turn ${d.turnDiscovered})</span><br>
            <span style="font-size:.8rem">${d.desc}</span>
          </div>`,
          )}
        </div>`,
      );
    }
  }

  renderDiplomacy(report);
  renderTitles(report);
  renderMastery(report);
  initReportCollapsers();
  renderPlayerMap(report);
  // guarantee the map paints fresh whenever a player opens their game to view the current turn.
  // openReport already fetches the latest turn_report from Supabase and renders once above, but
  // that first render can run before the just-shown report section has finished its layout, leaving
  // a blank/mis-sized map until the player interacts. Re-render after layout settles (double rAF)
  // so the current-turn map always appears immediately on click. Falls back to a timeout if rAF is
  // absent.
  const _repaintMap = () => {
    try {
      renderPlayerMap(report);
    } catch (e) {}
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(_repaintMap));
  } else {
    setTimeout(_repaintMap, 0);
  }
  try {
    ensureProvinceLinking();
  } catch (e) {} // every province name in the report becomes a map link
}

// ── DIPLOMACY PANEL (alliance system) ────
// Renders the realms this player has encountered with the current relation and the declarations
// available. A pending choice is stored in diploChoices and submitted with the turn's orders. Item
// 9: the report card keeps the INFORMATION (relations, pending declarations); the Declare War /
// Propose Peace / Propose Alliance BUTTONS now live at the top of the Orders column
// (#orders-diplomacy), beside the dispatch composer and the Concede control.
export function renderDiplomacy(report) {
  _renderDiplomacyInto(document.getElementById('report-diplomacy'), report, false);
  _renderDiplomacyInto(document.getElementById('orders-diplomacy'), report, true);
}
export function _renderDiplomacyInto(el, report, withControls) {
  if (!el) return;
  const known = (report && report.diplomacy && report.diplomacy.known) || [];
  const alliancesAllowed = !report || !report.diplomacy || report.diplomacy.alliancesAllowed !== false;
  // 2026-09-29 (Toby): SAFE START — no Treat or declaration of war until the orders for Turn N
  // (safeStartUntil, 6). The engine discards any sent earlier; here the controls are withdrawn.
  const _ssUntil = Number(report && report.diplomacy && report.diplomacy.safeStartUntil) || 0;
  const _ssLive = Number(report && (report._liveTurn || report.turn)) || 1;
  const safeLocked = _ssUntil > 0 && _ssLive < _ssUntil;
  if (!known.length) {
    el.innerHTML = kcHtml`<em style="color:#3a3224;font-size:.85rem">You have not yet encountered another realm. Once you see a rival's province or one of their characters, you may treat with them here.</em>`;
    return;
  }
  const relBadge = (r) =>
    r === 'allied'
      ? kcHtml`<span class="pill" style="background:#dff0d8;color:#1d541d">🤝 Allied</span>`
      : r === 'enemy'
        ? kcHtml`<span class="pill" style="background:#f7d7d7;color:#701010">⚔ At war</span>`
        : kcHtml`<span class="pill" style="background:#efe6cc;color:#3a2e18">🕊 Neutral</span>`;
  const btn = (idx, val, label, bg) =>
    kcHtml`<button onclick="setDiploChoice(${kcArg(idx)},${kcArg(val)})" style="font-family:'Cinzel',serif;font-size:.68rem;padding:5px 10px;border:1px solid ${bg};background:transparent;color:${bg};border-radius:2px;cursor:pointer">${label}</button>`;
  const pendingLabel = (k) => {
    const p = diploChoices[k.index];
    if (p === 'enemy') return k.relation === 'allied' ? 'Break Alliance' : 'Declare War';
    if (p === 'treat') return k.relation === 'enemy' ? 'Propose Peace' : 'Propose Alliance';
    return '';
  };
  el.innerHTML = kcHtml`${known.map((k) => {
    const pending = diploChoices[k.index];
    let controls;
    // 2026-09-27 (Toby item 7): a realm that has CONCEDED (or been extinguished) has left the game.
    // There is nobody left to treat with, so the entry says so and every control is withdrawn — and
    // any declaration already pending against them this turn is dropped rather than sent into the
    // void.
    if (k.conceded || k.eliminated) {
      if (pending != null) delete diploChoices[k.index];
      controls = kcHtml`<div style="font-size:.78rem;color:#3a3224"><em>${k.eliminated && !k.conceded ? 'This dynasty is extinguished' : 'This realm has withdrawn from the game'} — there is no court left to treat with, and no declaration can be made against it.</em></div>`;
    } else if (safeLocked) {
      if (pending != null) delete diploChoices[k.index];
      controls = withControls
        ? kcHtml`<div style="font-size:.78rem;color:#3a3224"><em>🕊 Safe Start — no Treat or declaration of war may be made until the orders for Turn ${_ssUntil}.</em></div>`
        : '';
    } else if (!withControls) {
      controls = pending
        ? kcHtml`<div style="font-size:.78rem;color:#7a1c1c">Pending this turn: <strong>${pendingLabel(k)}</strong> <span style="color:#3a3224">(change it at the top of your Orders)</span></div>`
        : '';
    } else if (pending) {
      controls = kcHtml`<div style="font-size:.8rem;color:#7a1c1c">Pending this turn: <strong>${pendingLabel(k)} — ${k.name}</strong> &nbsp;<button onclick="setDiploChoice(${kcArg(k.index)},null)" style="font-size:.66rem;padding:2px 8px;border:1px solid #999;background:#eee;border-radius:2px;cursor:pointer">cancel</button></div>`;
    } else if (k.relation === 'neutral') {
      controls = kcHtml`${alliancesAllowed ? kcHtml`${btn(k.index, 'treat', 'Propose Alliance', '#2d6a2d')} ` : ''}${btn(k.index, 'enemy', 'Declare War', '#8a1c1c')}`;
    } else if (k.relation === 'enemy') {
      controls = btn(k.index, 'treat', 'Propose Peace', '#2d6a2d');
    } else {
      // allied — 2026-09-24 (Toby item 6): breaking a pact drops the pair to Neutral, except
      // for an Evil or Undead crown, which goes straight to war.
      const _darkSelf = ['Evil', 'Undead'].includes((report.kingdom || {}).alignment);
      controls = btn(k.index, 'enemy', _darkSelf ? 'Break Alliance — War' : 'Break Alliance', '#8a1c1c');
    }
    return kcHtml`<div style="border:1px solid var(--parchment-dark);border-radius:2px;padding:8px 10px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <strong style="color:${reportColour(k.color) || '#333'}">${k.name}</strong>
        <span style="font-size:.72rem;color:#332c20">${k.alignment || ''}</span>
        ${k.conceded || k.eliminated ? kcHtml`<span class="pill" style="background:#e6ded0;color:#3a2e18">${k.eliminated && !k.conceded ? '\u2620 Extinguished' : '\u{1F3F3} Conceded'}${k.conceded && k.concededTurn ? ` (turn ${k.concededTurn})` : ''}</span>` : relBadge(k.relation)}
        ${!k.conceded && !k.eliminated && k.offeredUs ? kcHtml`<span class="pill" style="background:#e3eefa;color:#1c3e6a" title="They proposed this last turn. Propose it back this turn to seal it.">🕊 Offered ${k.offeredUs === 'peace' ? 'peace' : 'an alliance'} last turn</span>` : ''}
      </div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">${controls}</div>
    </div>`;
  })}${
    withControls && safeLocked
      ? kcHtml`<div style="font-size:.72rem;color:#3a3224;margin-top:6px">🕊 <strong>Safe Start:</strong> this is a Safe Start game — diplomacy opens with the orders for <strong>Turn ${_ssUntil}</strong> (this is Turn ${_ssLive}).</div>`
      : ''
  }${
    withControls && !safeLocked
      ? kcHtml`<div style="font-size:.72rem;color:#3a3224;margin-top:6px">${
          alliancesAllowed
            ? kcHtml`An <strong>alliance</strong> or <strong>peace</strong> is sealed only if <em>both</em> realms propose it in the same turn; a <strong>declaration of war</strong> takes effect on its own.`
            : kcHtml`In a realm of so few kings <strong>no alliances</strong> may be forged — you may make <strong>peace</strong> (both must propose it) or <strong>declare war</strong> (on its own).`
        } Changes apply at the start of next turn — except that an <strong>Evil</strong> or <strong>Undead</strong> realm's declaration of war takes effect at the <strong>start of this very turn</strong>: its armies may attack the moment the orders run. <strong>Breaking an alliance</strong> returns the two realms to <strong>Neutral</strong> — only an Evil or Undead crown goes straight from alliance to war. Submit your orders to lodge these declarations.</div>`
      : ''
  }`;
}
export function setDiploChoice(idx, val) {
  if (val == null || val === 'null') delete diploChoices[idx];
  else diploChoices[idx] = val;
  if (currentReport) renderDiplomacy(currentReport);
}

// ── COLLAPSIBLE SECTIONS ────
// Minimise/maximise the report-column cards and the per-hero order blocks so a player can navigate
// without scrolling. Purely presentational — no engine/data effect.
export function _setSecCollapsed(sec, collapse) {
  sec.classList.toggle('sec-collapsed', collapse);
  const b = sec.querySelector('.sec-toggle, .cc-toggle');
  if (b) {
    b.innerHTML = collapse ? '&#9656;' : '&#9662;';
    b.setAttribute('aria-expanded', collapse ? 'false' : 'true');
  }
}
// 2026-09-23d (Toby item 1): a battle in the Chronicle shows its SHORT account by default; the side
// button swaps it for the full report (and back). The two views sit side by side in one .battle-fold.
export function toggleBattleFold(btn) {
  const box = btn && btn.closest('.battle-fold');
  if (!box) return;
  const full = box.querySelector('.bf-full'),
    short = box.querySelector('.bf-short');
  if (!full || !short) return;
  const open = full.style.display === 'none';
  full.style.display = open ? 'block' : 'none';
  short.style.display = open ? 'none' : 'block';
  box.querySelectorAll('.bf-toggle').forEach((b) => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
}
export function toggleSection(btn) {
  const sec = btn.closest('.card, .orders-char-block, .char-chronicle');
  if (!sec) return;
  _setSecCollapsed(sec, !sec.classList.contains('sec-collapsed'));
}
export function collapseAllSections(scopeSel, collapse) {
  const scope = document.querySelector(scopeSel);
  if (!scope) return;
  scope.querySelectorAll('.card, .orders-char-block, .char-chronicle').forEach((sec) => {
    if (sec.id === 'orders-card') return; // the orders card wraps the per-hero blocks — collapse those, not it
    _setSecCollapsed(sec, collapse);
  });
}
// fold/unfold every Chronicle character & event block (scoped to the Chronicle log).
export function collapseAllChronicle(collapse) {
  document.querySelectorAll('#report-log .char-chronicle').forEach((sec) => _setSecCollapsed(sec, collapse));
}
// The report-column cards are static markup, so inject a toggle into each card's <h2> once.
export function initReportCollapsers() {
  const col = document.getElementById('rp-report-col');
  if (!col) return;
  col.querySelectorAll('.card').forEach((card) => {
    const h = card.querySelector('h2');
    if (!h || h.querySelector('.sec-toggle')) return;
    const b = document.createElement('button');
    b.className = 'sec-toggle';
    b.type = 'button';
    b.innerHTML = '&#9662;';
    b.setAttribute('aria-expanded', 'true');
    b.title = 'Minimise / maximise this section';
    b.addEventListener('click', () => toggleSection(b));
    h.appendChild(b);
  });
}
