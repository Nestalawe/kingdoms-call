// Screen tours (P0-19). A tour boots one page with a staged world whose player-chosen strings all come from N(field, i)
// (lib/hostile.js: hostile or ordinary names), then visits each of its screens in turn and hands every one to visit().
// The same tour runs in jsdom and in Chromium, and against any copy of the site, so it serves both
//   - the hostile-name tests (hostile names: nothing may become markup or code), and
//   - tests/tools/same-dom.js (ordinary names, main's site against a branch's: nothing may look different).
//
// A tour: {page, modes: {name: {url, ...}}, world(N) → plain data, jsdomSupabase(world, mode), browserSupabase(world, mode)
// → script text, steps(world, mode) → [[label, code run in the page]], shown(world) → strings that must appear as text}.
// A new page's slice of P0-19 adds its tour here.
const path=require('path');
const {readPage,bootJsdom,serve,routeExternal,SITE}=require('./boot');
const {makeStub,leaderboardStub}=require('./stub-db');

const wait=ms=>new Promise(r=>setTimeout(r,ms));

// ── Hall of Fame ─────────────────────────────────────────────────────────────────────────────────────────────────
// Three recorded games: one with humans and bots (the GM's own), one hidden, one an older row. Every value a player or a
// GM can store in a recorded game comes from N (with hostile names, numbers too), and so do the profile names.
const leaderboard={
  page:'kingdoms-call-leaderboard.html',
  modes:{
    public:{url:''},
    gm:{url:'?gm=1',signedIn:true,isGm:true},
    overlord:{url:'?gm=1',signedIn:true,isGm:true,isOverlord:true},
    failing:{url:'?gm=1',signedIn:true,isGm:true,isOverlord:true,error:true},
    unreadable:{url:'',readError:true},
  },
  world(N){
    const num=(field,v)=>N.hostile?N(field,v):v;
    const st=(g,pi,o)=>({pi,realm:N('realm',g*10+pi),player:N('player',g*10+pi),uid:o.bot?null:(g===1&&pi===1?num('uid','u11'):'u'+(g*10+pi)),
      race:N('race',pi),al:N('creed',pi),bot:!!o.bot,winner:!!o.winner,rank:num('rank',pi+1),score:num('score',300-pi*40),prov:num('prov',9-pi),gold:num('gold',120+pi),str:num('str',400-pi*30),titles:o.winner?['t']:[],
      outHow:o.out?N('fate',g*10+pi):null,outTurn:o.out?num('outTurn',7):null});
    const rec=(g,pi,v,extra)=>({v:num('value',v),pi,t:num('turn',3),who:N('hero',g*10+pi),det:N('detail',g*10+pi),...(extra||{})});
    const row=(g,o)=>({game_id:'g'+g,game_name:N('game',g),gm_user_id:o.gm||'gm-1',note:o.note?N('note',g):null,hidden:!!o.hidden,
      build:o.legacy?'lb1':'lb3 '+N('build',g),finished_at:`2026-09-1${g}T10:00:00Z`,started_at:`2026-08-1${g}T10:00:00Z`,
      victory:N('victory',g),turns:num('turns',12+g),winner_realm:N('realm',g*10),winner_player:N('player',g*10),winner_is_bot:!!o.botWin,
      setup:{mapSize:N('map',g),realms:num('realms',3),bots:num('bots',1),humans:num('humans',2),diplomacy:g===1?'hostile':'normal',seaPct:num('sea',30)},
      standings:[st(g,0,{winner:true}),st(g,1,{out:true}),st(g,2,{bot:true,out:true})],
      records:{most_provinces:[rec(g,0,9),rec(g,1,7)],greatest_upset:[rec(g,1,0.5)],[`title_${N('key',g)}`]:[rec(g,0,2,{lbl:N('label',g)})],
        biggest_world:{v:60,pi:null}},
      totals:{battles:num('battles',4),casualties:num('casualties',9),captures:num('captures',3),lairs:num('lairs',2),spells:num('spells',5),deaths:num('deaths',1)}});
    return {rows:[row(1,{note:true}),row(2,{hidden:true,note:true}),row(3,{legacy:true,gm:'gm-2',botWin:true})],
      profiles:[0,1].flatMap(pi=>[1,2,3].map(g=>({id:'u'+(g*10+pi),name:N('profile',g*10+pi)}))),
      renameTo:N('rename',0), search:N('realm',10), error:N('error',0)};
  },
  stubOptions:(W,m)=>({signedIn:!!m.signedIn,isGm:!!m.isGm,isOverlord:!!m.isOverlord,profiles:W.profiles,
    error:m.error?W.error:undefined,readError:m.readError?W.error:undefined}),
  jsdomSupabase(W,m){ const o=this.stubOptions(W,m); return {createClient:()=>leaderboardStub({...o,rows:()=>W.rows,calls:[]})}; },
  browserSupabase(W,m){
    return `(function(){var R=${JSON.stringify(W.rows)},O=${JSON.stringify(this.stubOptions(W,m))};`
      +`window.supabase={createClient:function(){return (${leaderboardStub.toString()})(Object.assign({},O,{rows:function(){return R;},calls:[]}));}};})();`;
  },
  steps(W,m){
    if(m.readError) return [['the board, unreadable','']];
    const s=[['champions',"setTab('champions')"],['achievements',"setTab('achievements')"],
      ['achievements, searched for a realm',`$('f-q').value=${JSON.stringify(W.search)};render()`],
      ['races and creeds',"resetFilters();setTab('peoples')"],['games',"setTab('games')"],
      ['games, every one opened',"document.querySelectorAll('tr.gamerow').forEach(r=>r.click())"]];
    if(m.isGm) s.push(['games, hidden ones shown and opened',"$('f-hidden').checked=true;render();document.querySelectorAll('tr.gamerow').forEach(r=>r.click())"],
      ['games, editing every one',"document.querySelectorAll('tr.gamerow button').forEach(b=>b.click())"]);
    if(m.error) s.push(['games, a save that fails',"document.querySelector('.gmbox .btn-gold').click()"]);
    if(m.isOverlord) s.push(['champions, renaming a player',`setTab('champions');window.prompt=()=>${JSON.stringify(W.renameTo)};document.querySelector('#champ-table button').click()`]);
    return s;
  },
  shown:W=>[W.rows[0].game_name,W.rows[0].note,W.rows[0].standings[0].race,W.rows[0].standings[1].al,W.rows[0].standings[1].outHow,
    W.rows[0].standings[0].realm,W.rows[0].records.most_provinces[0].who,W.rows[0].records.most_provinces[0].det,
    W.rows[0].setup.mapSize,W.rows[0].victory,W.profiles[0].name,W.renameTo,W.error,W.rows[0].standings[1].rank,W.rows[0].setup.realms].filter(s=>typeof s==='string'),
};

// ── The Overlord page ────────────────────────────────────────────────────────────────────────────────────────────
// Accounts (names, emails), games, the realms' names in a game, a reported dispatch and the report's reason.
const overlord={
  page:'kingdoms-call-overlord.html',
  modes:{overlord:{url:''}},
  world(N){
    return {
      profiles:[['ov1','Test Overlord'],['gm1',N('gm',1)],['gm2',N('gm',2)],['p1',N('player',1)],['p2',N('player',2)]].map(([id,name])=>({id,name})),
      emails:{ov1:'overlord@example.test',gm1:N('email',1),gm2:N('email',2),p1:N('email',3),p2:N('email',4)},
      games:[['G1',N('game',1),'gm1','active'],['G2',N('game',2),'gm1','setup'],['G3',N('game',3),'gm2','complete']],
      realms:[['G1',0,'p1',N('realm',0)],['G1',1,'p2',N('realm',1)]],
      body:N('dispatch',0), reason:N('reason',0), search:N('player',1),
    };
  },
  // Self-contained: it also runs inside Chromium, as text.
  stage:function(S,W){
    S.DB.profiles.length=0; W.profiles.forEach(p=>S.DB.profiles.push(p));
    S.DB.accounts={}; Object.keys(W.emails).forEach(id=>{ S.DB.accounts[id]={email:W.emails[id]}; });
    S.DB.site_admins.push({user_id:'ov1'});
    S.DB.game_masters.push({user_id:'gm1',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'},
      {user_id:'gm2',offered_at:'2026-10-01T00:00:00Z',offered_by:'ov1',accepted_at:'2026-10-01T00:00:00Z'});
    W.games.forEach(([id,name,gm,status],i)=>S.DB.games.push({id,name,gm_user_id:gm,status,turn:i+1,max_turns:12,
      created_at:'2026-10-0'+(i+1)+'T00:00:00Z',meta:{v:1,turnMode:{mode:'manual'}},game_state:'{}'}));
    W.realms.forEach(([game_id,player_index,user_id,display_name],i)=>S.DB.game_players.push({id:'s'+i,game_id,user_id,player_index,display_name}));
    S.DB.game_messages.push({id:7,game_id:'G1',turn:3,from_index:1,to_indexes:[0],scope:'private',body:W.body});
    S.DB.message_reports.push({id:1,message_id:7,game_id:'G1',reporter_index:0,reason:W.reason,created_at:'2026-10-13T00:00:00Z'});
    S.setUser('ov1');
  },
  jsdomSupabase(W){ const S=makeStub(); this.stage(S,W); return S.supabase; },
  browserSupabase(W){
    return `(function(){var S=(${makeStub.toString()})();(${this.stage.toString()})(S,${JSON.stringify(W)});window.supabase=S.supabase;})();`;
  },
  steps(W){
    return [['accounts, games and reported dispatches',''],
      ['accounts, searched',`$('acct-q').value=${JSON.stringify(W.search)};renderAccounts()`],
      ['accounts, Revoke GM open',"$('acct-q').value='';renderAccounts();document.querySelector('[data-act=revoke]').click()"],
      ['accounts, Delete open',"document.querySelector('[data-act=delete]').click()"]];
  },
  shown:W=>[W.profiles[1].name,W.emails.gm1,W.games[0][1],W.realms[0][3],W.body,W.reason],
};

const TOURS={leaderboard,overlord};

// Runs a tour's mode in jsdom against the site in `site` (a folder). visit(label, document, window) after each step.
async function runJsdom(tour,mode,W,visit,{site=SITE}={}){
  const m=tour.modes[mode], errs=[];
  const dom=bootJsdom(readPage(path.join(site,tour.page)),{supabase:tour.jsdomSupabase(W,m),url:'https://example.test/'+tour.page+m.url,
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.onunhandledrejection=e=>errs.push(String(e.reason&&e.reason.stack||e.reason));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
      w.console.warn=()=>{}; w.console.log=()=>{};
    }});
  const w=dom.window;
  await wait(400);
  for(const [label,code] of tour.steps(W,m)){
    try{ if(code) w.eval(code); }catch(e){ errs.push(`${label}: ${e.message}`); }
    await wait(80);
    await visit(label,w.document,w);
  }
  w.close();
  return errs;
}

// The same in Chromium (Playwright `browser`), with the site served from one folder as deployed. visit(label, page).
async function runChromium(browser,tour,mode,W,visit,{site=SITE}={}){
  const m=tour.modes[mode], errs=[];
  const srv=await serve(site);
  const ctx=await browser.newContext();
  await routeExternal(ctx,tour.browserSupabase(W,m));
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(String(e.message||e)));
  p.on('console',x=>{ if(x.type()==='error'&&!/Failed to load resource/.test(x.text())) errs.push('console: '+x.text()); });
  await p.goto(srv.url+'/'+tour.page+m.url,{waitUntil:'load'});
  await p.waitForTimeout(600);
  for(const [label,code] of tour.steps(W,m)){
    try{ if(code) await p.evaluate(code); }catch(e){ errs.push(`${label}: ${e.message}`); }
    await p.waitForTimeout(300);   // long enough for a broken <img src=x> to fail and fire its onerror
    await visit(label,p);
  }
  await ctx.close(); srv.close();
  return errs;
}

module.exports={TOURS,runJsdom,runChromium};
