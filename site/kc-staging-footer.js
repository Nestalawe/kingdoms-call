// Kingdoms Call: on the staging site, says which pull request and commit this copy is (P0-33), as
// "Staging · PR #21 · abcdef1", linking to the pull request. Reads KC_CONFIG.deployed, which only the
// staging kc-config.js has (.github/scripts/staging.js writes it), so the live site shows nothing.
// Loaded at the end of <body>, after kc-config.js. Adds no global names (every page's top-level names
// share one scope).
(function(){
  var d=typeof KC_CONFIG!=='undefined'&&KC_CONFIG&&KC_CONFIG.deployed;
  if(!d||!Number.isInteger(d.pr)||d.pr<1||!/^[0-9a-f]{40}$/.test(String(d.sha))) return;
  var a=document.createElement('a');
  a.id='kc-staging-footer';
  a.href='https://github.com/Nestalawe/kingdoms-call/pull/'+d.pr;
  a.title='Commit '+d.sha;
  a.textContent='Staging · PR #'+d.pr+' · '+d.sha.slice(0,7);
  var foot=document.querySelector('footer');
  if(foot){
    a.style.color='inherit';
    a.style.textTransform='none';   // a footer styled in capitals would show the commit as E3F17F2
    foot.appendChild(document.createElement('br'));
    foot.appendChild(a);
  } else {
    a.style.cssText='position:fixed;bottom:8px;left:12px;z-index:1000;font-size:.68rem;color:#c0ab88;font-family:monospace;opacity:.95';
    document.body.appendChild(a);
  }
})();
