// ── BOOT ────
kcDbGuard(sb,KC_DB_MIN).then(()=>init().catch(err=>{
  console.error('Init error:', err);
  document.getElementById('spinner').textContent='Error loading — please refresh. ('+err.message+')';
}));
