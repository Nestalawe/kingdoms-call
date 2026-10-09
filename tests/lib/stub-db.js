// tests/lib/stub-db.js: the one place tests get a Supabase stand-in. Nothing here talks to a network.
//
// The harnesses were written over several sessions with five different stubs. Each is kept here
// exactly as it behaved in its harness (merging them would change what those tests see):
//
//   makeStub()            in-memory database rich enough for the GM portal's runTurn
//                         (from claude_stub_db_0927.js). Used by the turn fuzz.
//   cannedStub(o)         answers every read with fixed rows and records every write
//                         (the `sbStub` pasted into six engine harnesses).
//   nullStub()            every read is empty; enough for a page to boot
//                         (from claude_jsdomboot_0927.js).
//   leaderboardStub(o)    serves Hall-of-Fame rows and records edits (from claude_lb_render_0927.js).
//   messagingStubInstall  in-memory database for the dispatch tests in Chromium, including a
//                         mirror of the player-side read and insert rules (from stub_supabase_0927.js).
//   pagedEventsStub(o)    serves one game's turn_events in pages the way Postgres may: rows that tie
//                         on every ORDER BY key come back in a different order on each query
//                         (leaderboard-events-paging, 2026-10-09).
//
// For Chromium, `browserSource.*` gives each browser-side stub as script text, served in place of
// the Supabase CDN bundle.

function makeStub(){
  const DB={ profiles:[{id:'gm1',name:'Test GM'}], games:[], game_players:[], turn_logs:[],
             turn_events:[], game_results:[], game_records:[], game_messages:[], game_message_reads:[] };
  const MISSING=new Set();
  let SESSION={user:{id:'gm1'}};
  let NEXT=1;
  const CALLS=[];
  const clone=o=>JSON.parse(JSON.stringify(o));
  function builder(table){
    const st={table,op:'select',filters:[],order:null,limit:null,payload:null,single:false,maybe:false,onConflict:null};
    function rows(){
      let r=(DB[table]||[]).slice();
      st.filters.forEach(([kind,k,v])=>{
        if(kind==='eq') r=r.filter(x=>String(x[k])===String(v));
        else if(kind==='neq') r=r.filter(x=>String(x[k])!==String(v));
        else if(kind==='in') r=r.filter(x=>v.map(String).includes(String(x[k])));
        else if(kind==='is') r=r.filter(x=>(v===null?x[k]==null:x[k]===v));
        else if(kind==='not_is') r=r.filter(x=>(v===null?x[k]!=null:x[k]!==v));
        else if(kind==='gt') r=r.filter(x=>Number(x[k])>Number(v));
        else if(kind==='lt') r=r.filter(x=>Number(x[k])<Number(v));
        else if(kind==='gte') r=r.filter(x=>Number(x[k])>=Number(v));
        else if(kind==='lte') r=r.filter(x=>Number(x[k])<=Number(v));
      });
      if(st.order){ const [k,asc]=st.order; r.sort((a,b)=>asc?(a[k]>b[k]?1:a[k]<b[k]?-1:0):(a[k]<b[k]?1:a[k]>b[k]?-1:0)); }
      if(st.limit!=null) r=r.slice(0,st.limit);
      return r;
    }
    // Embedded selects: "cols, game_players(cols)" — attach children by game_id.
    function project(list){
      const sel=st.selectStr||'*';
      const m=/game_players\s*\(([^)]*)\)/.exec(sel);
      if(!m) return clone(list);
      return list.map(g=>{
        const kids=DB.game_players.filter(p=>String(p.game_id)===String(g.id));
        const cols=m[1].split(',').map(s=>s.trim()).filter(Boolean);
        const slim=kids.map(k=>{ if(cols.length===1&&cols[0]==='*') return clone(k);
          const o={}; cols.forEach(c=>{ o[c]=k[c]; }); return o; });
        return {...clone(g), game_players:slim};
      });
    }
    function run(){
      CALLS.push(st.table+'.'+st.op);
      if(MISSING.has(table)) return {data:null,error:{message:`relation "public.${table}" does not exist`,code:'42P01'}};
      if(st.op==='select'){
        const r=project(rows());
        if(st.single) return r.length===1?{data:r[0],error:null}:{data:null,error:{message:'no rows / many rows'}};
        if(st.maybe) return {data:r[0]||null,error:null};
        return {data:r,error:null};
      }
      if(st.op==='insert'){
        const list=Array.isArray(st.payload)?st.payload:[st.payload];
        const made=list.map(p=>{ const row={id:p.id!=null?p.id:'row'+(NEXT++),...p}; DB[table].push(row); return row; });
        return {data:st.single?clone(made[0]):clone(made),error:null};
      }
      if(st.op==='upsert'){
        const list=Array.isArray(st.payload)?st.payload:[st.payload];
        const keys=(st.onConflict||'id').split(',').map(s=>s.trim());
        list.forEach(p=>{ const hit=(DB[table]||[]).find(x=>keys.every(k=>String(x[k])===String(p[k])));
          if(hit) Object.assign(hit,p); else DB[table].push({id:'row'+(NEXT++),...p}); });
        return {data:clone(list),error:null};
      }
      if(st.op==='update'){
        const hits=rows(); hits.forEach(r=>{ const h=DB[table].find(x=>x===r||(x.id!=null&&x.id===r.id)); if(h) Object.assign(h,st.payload); });
        const out=hits.map(r=>DB[table].find(x=>x.id===r.id)||r);
        if(st.single) return out.length===1?{data:clone(out[0]),error:null}:{data:null,error:{message:'no rows'}};
        if(st.maybe) return {data:out.length?clone(out[0]):null,error:null};
        return {data:clone(out),error:null};
      }
      if(st.op==='delete'){ const doomed=rows(); DB[table]=DB[table].filter(x=>!doomed.some(d=>d.id===x.id)); return {data:null,error:null}; }
      return {data:null,error:null};
    }
    const api={
      select(s){ if(st.op==='select') st.selectStr=s||'*'; return api; },
      insert(p){ st.op='insert'; st.payload=p; return api; },
      upsert(p,o){ st.op='upsert'; st.payload=p; st.onConflict=o&&o.onConflict; return api; },
      update(p){ st.op='update'; st.payload=p; return api; },
      delete(){ st.op='delete'; return api; },
      eq(k,v){ st.filters.push(['eq',k,v]); return api; },
      neq(k,v){ st.filters.push(['neq',k,v]); return api; },
      in(k,v){ st.filters.push(['in',k,v]); return api; },
      is(k,v){ st.filters.push(['is',k,v]); return api; },
      not(k,op,v){ st.filters.push(['not_is',k,v]); return api; },
      or(){ return api; },
      filter(){ return api; },
      contains(){ return api; },
      gt(k,v){ st.filters.push(['gt',k,v]); return api; },
      lt(k,v){ st.filters.push(['lt',k,v]); return api; },
      gte(k,v){ st.filters.push(['gte',k,v]); return api; },
      lte(k,v){ st.filters.push(['lte',k,v]); return api; },
      range(){ return api; },
      order(k,o){ st.order=[k,!o||o.ascending!==false]; return api; },
      limit(n){ st.limit=n; return api; },
      single(){ st.single=true; return api; },
      maybeSingle(){ st.maybe=true; return api; },
      then(res,rej){ let out; try{ out=run(); }catch(e){ out={data:null,error:{message:e.message||String(e)}}; }
        return Promise.resolve(out).then(res,rej); }
    };
    return api;
  }
  const client={ from:builder, rpc:()=>Promise.resolve({data:[],error:null}),
    auth:{ getSession:async()=>({data:{session:SESSION},error:null}),
           getUser:async()=>({data:{user:SESSION&&SESSION.user},error:null}),
           onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
           signOut:async()=>({error:null}), signInWithPassword:async()=>({data:{},error:null}) },
    channel:()=>({on(){return this;},subscribe(){return this;},unsubscribe(){}}), removeChannel(){},
    storage:{from:()=>({upload:async()=>({data:null,error:null}),download:async()=>({data:null,error:null}),getPublicUrl:()=>({data:{publicUrl:''}})})} };
  return { supabase:{createClient:()=>client}, DB, MISSING, CALLS,
           setUser(id){ SESSION=id?{user:{id}}:null; } };
}

// rows(): the harness's current answer table, looked up on every call ({ <table>_one, <table>_list }).
// writes: an array; every update/insert/upsert/delete is pushed as {table, val}.
function cannedStub({rows,writes}){
  const res=d=>Promise.resolve({data:d,error:null});
  const chain=t=>{const o={};['select','eq','neq','in','order','limit','gte','lte','is','not','or','filter','contains','gt','lt','range'].forEach(m=>o[m]=()=>o);
    ['update','insert','upsert','delete'].forEach(m=>o[m]=v=>{writes.push({table:t,val:v});return o;});
    o.single=o.maybeSingle=()=>res(rows()[t+'_one']!==undefined?rows()[t+'_one']:null);
    o.then=(f,j)=>res(rows()[t+'_list']!==undefined?rows()[t+'_list']:[]).then(f,j);return o;};
  return{from:t=>chain(t),rpc:()=>res([]),auth:{getSession:()=>res({session:null}),getUser:()=>res({user:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:()=>res({})},
    channel:()=>({on(){return this;},subscribe(){return this;},unsubscribe(){}}),removeChannel(){},
    storage:{from:()=>({upload:()=>res(null),download:()=>res(null),getPublicUrl:()=>({data:{publicUrl:''}})})}};
}

// Self-contained (no outside references), so it can also be served to Chromium as text.
function nullStub(){ const res=d=>Promise.resolve({data:d,error:null});
  const chain=()=>{const o={};['select','eq','neq','in','order','limit','gte','lte','is','not','or','filter','contains','gt','lt','range','update','insert','upsert','delete'].forEach(m=>o[m]=()=>o);o.single=o.maybeSingle=()=>res(null);o.then=(f,j)=>res([]).then(f,j);return o;};
  return {from:()=>chain(),rpc:()=>res([]),auth:{getSession:()=>res({session:null}),getUser:()=>res({user:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:()=>res({}),signInWithPassword:()=>res({})},channel:()=>({on(){return this;},subscribe(){return this;},unsubscribe(){}}),removeChannel(){},storage:{from:()=>({upload:()=>res(null),download:()=>res(null),getPublicUrl:()=>({data:{publicUrl:''}})})}}; }

// rows(): the Hall-of-Fame rows to serve. calls: array; every non-select is pushed as {table,op,filters,payload}.
function leaderboardStub({rows,calls,signedIn,isGm}){
  const q=(table)=>{
    const st={table,op:'select',filters:[]};
    const res=()=>{
      if(st.op!=='select') { calls.push({table,op:st.op,filters:st.filters,payload:st.payload}); return {data:null,error:null}; }
      if(table==='game_records') return {data:st.range&&st.range[0]>0?[]:rows(),error:null};
      if(table==='games') return {data:isGm?[{id:'g0'}]:[],error:null};
      return {data:[],error:null};
    };
    const api={
      select(){ st.op='select'; return api; },
      update(p){ st.op='update'; st.payload=p; return api; },
      delete(){ st.op='delete'; return api; },
      eq(k,v){ st.filters.push([k,v]); return api; },
      limit(){ return api; },
      order(){ return api; },
      range(a,b){ st.range=[a,b]; return api; },
      then(r,j){ return Promise.resolve(res()).then(r,j); },
    };
    return api;
  };
  return {from:q, auth:{getSession:async()=>({data:{session:signedIn?{user:{id:'gm-1'}}:null}})}};
}

// Browser-only: installs window.supabase and the test's handle window.__DB. Self-contained.
function messagingStubInstall(window){
  const DB={
    profiles:[{id:'u0',name:'Test GM'}],
    games:[],
    game_players:[],
    game_messages:[],
    game_message_reads:[],
    turn_logs:[],
    turn_events:[], game_results:[], game_records:[]
  };
  let SESSION={user:{id:'u0'}};
  let NEXT_MSG_ID=1;
  const MISSING=new Set();          // table names that behave as "relation does not exist"

  function myIndexIn(gameId){
    const r=DB.game_players.find(p=>String(p.game_id)===String(gameId)&&p.user_id===(SESSION&&SESSION.user&&SESSION.user.id));
    return r?r.player_index:null;
  }
  // Mirror of the read rule as a player sees it: sender, addressee, anybody when public. (The stub
  // always signs in as a player.)
  function canRead(m){
    const mine=myIndexIn(m.game_id);
    if(mine==null) return false;
    if(m.scope==='public'||!(m.to_indexes||[]).length) return true;
    return m.from_index===mine||(m.to_indexes||[]).includes(mine);
  }

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  function builder(table){
    const st={table,op:'select',filters:[],order:null,limit:null,payload:null,single:false,maybe:false,onConflict:null};
    function rows(){
      let r=(DB[table]||[]).slice();
      if(table==='game_messages') r=r.filter(canRead);
      st.filters.forEach(([kind,k,v])=>{
        if(kind==='eq')   r=r.filter(x=>String(x[k])===String(v));
        else if(kind==='in')  r=r.filter(x=>v.map(String).includes(String(x[k])));
        else if(kind==='is')  r=r.filter(x=>(v===null?x[k]==null:x[k]===v));
        else if(kind==='gt')  r=r.filter(x=>Number(x[k])>Number(v));
        else if(kind==='lt')  r=r.filter(x=>Number(x[k])<Number(v));
      });
      if(st.order){ const [k,asc]=st.order; r.sort((a,b)=> asc?(a[k]>b[k]?1:a[k]<b[k]?-1:0):(a[k]<b[k]?1:a[k]>b[k]?-1:0)); }
      if(st.limit!=null) r=r.slice(0,st.limit);
      return r;
    }
    function run(){
      if(MISSING.has(table)) return {data:null,error:{message:'relation "public.'+table+'" does not exist',code:'42P01'}};
      if(st.op==='select'){
        const r=clone(rows());
        if(st.single)  return r.length===1?{data:r[0],error:null}:{data:null,error:{message:'no rows'}};
        if(st.maybe)   return {data:r[0]||null,error:null};
        return {data:r,error:null};
      }
      if(st.op==='insert'){
        const list=Array.isArray(st.payload)?st.payload:[st.payload];
        const made=list.map(p=>{
          const row={...p};
          if(table==='game_messages'){
            row.id=NEXT_MSG_ID++;
            row.created_at=new Date().toISOString();
            // the insert rule: you may only write as the realm you actually hold
            const mine=myIndexIn(row.game_id);
            if(mine==null||Number(row.from_index)!==Number(mine))
              throw {message:'new row violates row-level security policy for table "game_messages"'};
            if(row.from_user_id!==SESSION.user.id)
              throw {message:'new row violates row-level security policy for table "game_messages"'};
          }
          DB[table].push(row); return row;
        });
        return {data:clone(made),error:null};
      }
      if(st.op==='upsert'){
        const list=Array.isArray(st.payload)?st.payload:[st.payload];
        const keys=(st.onConflict||'id').split(',').map(s=>s.trim());
        list.forEach(p=>{
          const hit=(DB[table]||[]).find(x=>keys.every(k=>String(x[k])===String(p[k])));
          if(hit) Object.assign(hit,p); else DB[table].push({...p});
        });
        return {data:clone(list),error:null};
      }
      if(st.op==='update'){ rows().forEach(r=>{ const hit=DB[table].find(x=>x===r||x.id===r.id); if(hit) Object.assign(hit,st.payload); }); return {data:null,error:null}; }
      if(st.op==='delete'){ const doomed=rows(); DB[table]=DB[table].filter(x=>!doomed.includes(x)); return {data:null,error:null}; }
      return {data:null,error:null};
    }
    const api={
      select(){ st.op=st.op==='select'?'select':st.op; return api; },
      insert(p){ st.op='insert'; st.payload=p; return api; },
      upsert(p,o){ st.op='upsert'; st.payload=p; st.onConflict=o&&o.onConflict; return api; },
      update(p){ st.op='update'; st.payload=p; return api; },
      delete(){ st.op='delete'; return api; },
      eq(k,v){ st.filters.push(['eq',k,v]); return api; },
      in(k,v){ st.filters.push(['in',k,v]); return api; },
      is(k,v){ st.filters.push(['is',k,v]); return api; },
      gt(k,v){ st.filters.push(['gt',k,v]); return api; },
      lt(k,v){ st.filters.push(['lt',k,v]); return api; },
      order(k,o){ st.order=[k,!o||o.ascending!==false]; return api; },
      limit(n){ st.limit=n; return api; },
      single(){ st.single=true; return api; },
      maybeSingle(){ st.maybe=true; return api; },
      then(res,rej){
        let out; try{ out=run(); }catch(e){ out={data:null,error:{message:e.message||String(e)}}; }
        return Promise.resolve(out).then(res,rej);
      }
    };
    return api;
  }

  window.supabase={ createClient:()=>({
    from:builder,
    auth:{
      getSession:async()=>({data:{session:SESSION},error:null}),
      signOut:async()=>{ SESSION=null; return {error:null}; },
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    }
  })};

  // The test's hand on the database.
  window.__DB={
    db:DB,
    reset(){ Object.keys(DB).forEach(k=>DB[k].length=0); DB.profiles.push({id:'u0',name:'Test GM'}); NEXT_MSG_ID=1; MISSING.clear(); },
    missing(){ return [...MISSING]; },
    setSessionUser(id){ SESSION=id?{user:{id}}:null; },
    hide(t){ MISSING.add(t); },
    show(t){ MISSING.delete(t); },
    // A dispatch written by SOMEBODY ELSE, straight into the table, as their browser would.
    inject(m){ DB.game_messages.push({id:NEXT_MSG_ID++, created_at:new Date().toISOString(), scope:(m.to_indexes&&m.to_indexes.length)?'private':'public', turn:null, ...m}); return NEXT_MSG_ID-1; }
  };
}

// events: the turn_events rows; results: the game_results rows; errorFrom: a range start from which
// turn_events answers with an error; calls: array, every write is pushed as {table,op,payload}.
// Ties on the ORDER BY keys are broken by a scramble that changes with every query (fixed, not
// random), as separate queries against a real database are free to do.
function pagedEventsStub({events,results,errorFrom,calls}){
  let queryNo=0;
  const q=(table)=>{
    const st={table,op:'select',order:[],range:null,single:false};
    const res=()=>{
      if(st.op!=='select'){ calls.push({table,op:st.op,payload:st.payload}); return {data:null,error:null}; }
      if(table==='game_results') return {data:results.slice(),error:null};
      if(table==='turn_events'){
        if(errorFrom!=null&&st.range&&st.range[0]>=errorFrom) return {data:null,error:{message:'canceling statement due to statement timeout'}};
        const n=++queryNo;
        const tie=r=>((events.indexOf(r)+1)*7919+n*104729)%1009;
        const r=events.slice().sort((a,b)=>{ for(const k of st.order){ if(a[k]!==b[k]) return a[k]<b[k]?-1:1; } return tie(a)-tie(b); });
        return {data:st.range?r.slice(st.range[0],st.range[1]+1):r,error:null};
      }
      return {data:st.single?null:[],error:null};
    };
    const api={
      select(){ return api; }, eq(){ return api; }, limit(){ return api; },
      order(k){ st.order.push(k); return api; },
      range(a,b){ st.range=[a,b]; return api; },
      upsert(p){ st.op='upsert'; st.payload=p; return api; },
      update(p){ st.op='update'; st.payload=p; return api; },
      maybeSingle(){ st.single=true; return Promise.resolve(res()); },
      single(){ st.single=true; return Promise.resolve(res()); },
      then(r,j){ return Promise.resolve(res()).then(r,j); },
    };
    return api;
  };
  return {from:q, rpc:async()=>({data:null,error:null}),
    auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this;},subscribe(){return this;},unsubscribe(){}}),removeChannel(){}};
}

const browserSource={
  messaging:`(${messagingStubInstall.toString()})(window);`,
  null:`window.supabase={createClient:${nullStub.toString()}};`,
};

module.exports={makeStub,cannedStub,nullStub,leaderboardStub,messagingStubInstall,pagedEventsStub,browserSource};
