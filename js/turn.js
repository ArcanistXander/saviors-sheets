/* Saviors sheets: turns from the DM's initiative tracker.
   The party sheet posts party/round {cid, round, active, turn, turnName, next, nextName, held}. On this hero's turn the sheet
   pops up "Your turn" (Take my turn / Hold / End turn), and a small bar stays at the bottom with Hold and End turn.
   Hold, End turn and Act now go to party/turn-<hero>; the party sheet moves the tracker.
   Load after cloud.js:  <script src="js/turn.js" data-hero="drax" data-name="Drax"></script> */
(function(){
  'use strict';
  var me=document.currentScript, ID=me&&me.dataset.hero, NAME=(me&&me.dataset.name)||ID;
  if(!ID||!window.claude||!window.claude.use)return;
  var KEY='saviors-turn-'+ID;   // the last turn the pop-up was shown for, so a reload doesn't show it again

  var round=null, db=null, sent='', msg='';
  function turnKey(){return round?round.cid+':'+round.round+':'+round.turn:''}
  function myTurn(){return !!(round&&round.active&&round.turn===ID)}
  function holding(){return !!(round&&round.active&&(round.held||[]).indexOf(ID)>=0)}
  function shown(k){try{if(localStorage.getItem(KEY)===k)return true;localStorage.setItem(KEY,k)}catch(e){}return false}

  /* ---- talking to the DM's tracker ---- */
  function reply(act){
    if(!db||!round)return;
    sent=act; draw();
    db.doc('party/turn-'+ID).set({cid:round.cid,round:round.round,turn:round.turn,act:act,at:new Date().toISOString()})
      .catch(function(){sent='';msg='Couldn’t reach the DM’s tracker. Tell the DM.';draw()});
  }
  function onRound(d){
    var was=turnKey();
    round=d&&d.active?d:null;
    if(turnKey()!==was){sent='';msg=''}
    if(myTurn()&&!shown(turnKey()))popup();
    draw();
  }
  window.claude.use('db').then(function(d){
    if(!d)return; db=d;
    db.doc('party/round').onSnapshot(function(s){onRound(s.exists?s.data():null)},function(){});
  }).catch(function(){});

  /* ---- what the player sees ---- */
  var css=document.createElement('style');
  css.textContent=
    '.tt-root{--tt-bg:#fbfaf7;--tt-ink:#1c1a24;--tt-muted:#5d5869;--tt-rule:#d6d1c4;--tt-acc:#5a3fa0;--tt-acc-ink:#fff;--tt-warn:#a3322a;font:15px/1.4 system-ui,sans-serif;color:var(--tt-ink)}'+
    '@media (prefers-color-scheme:dark){.tt-root{--tt-bg:#1b1824;--tt-ink:#e9e6f2;--tt-muted:#a49eb6;--tt-rule:#3a3548;--tt-acc:#b49cf0;--tt-acc-ink:#17121f;--tt-warn:#f08a7f}}'+
    '.tt-root button{font:inherit;font-size:.9rem;border-radius:6px;padding:6px 12px;cursor:pointer;border:1px solid var(--tt-rule);background:var(--tt-bg);color:var(--tt-ink)}'+
    '.tt-root button:hover{border-color:var(--tt-acc)}.tt-root button:focus-visible{outline:2px solid var(--tt-acc);outline-offset:2px}'+
    '.tt-root button.pri{background:var(--tt-acc);border-color:var(--tt-acc);color:var(--tt-acc-ink)}.tt-root button:disabled{opacity:.45;cursor:not-allowed}'+
    '.tt-pill{position:fixed;right:12px;bottom:12px;z-index:900;max-width:calc(100% - 24px);box-sizing:border-box;background:var(--tt-bg);border:1px solid var(--tt-rule);border-radius:999px;padding:6px 8px 6px 14px;box-shadow:0 4px 18px rgba(0,0,0,.2);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:.88rem}'+
    '.tt-pill.mine,.tt-pill.next{border:2px solid var(--tt-acc)}.tt-pill b{color:var(--tt-acc)}.tt-pill .tt-btns{display:flex;gap:6px}'+
    '.tt-pill .tt-msg{flex-basis:100%;color:var(--tt-warn);font-size:.8rem}'+
    '.tt-veil{position:fixed;inset:0;z-index:1001;display:grid;place-items:center;padding:16px;background:rgba(10,8,16,.55)}'+
    '.tt-box{max-width:400px;width:100%;box-sizing:border-box;background:var(--tt-bg);border-radius:12px;padding:20px 22px;display:grid;gap:12px;box-shadow:0 10px 40px rgba(0,0,0,.4)}'+
    '.tt-box h2{margin:0;font-size:1.4rem}.tt-box p{margin:0;color:var(--tt-muted)}.tt-box .tt-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}';
  document.head.appendChild(css);
  var root=document.createElement('div'); root.className='tt-root';
  var layer=document.createElement('div'); layer.className='tt-root';   // the pop-up, kept apart so redrawing the bar never removes it
  function mount(){if(!root.parentNode)document.body.appendChild(root);if(!layer.parentNode)document.body.appendChild(layer)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function draw(){
    mount();
    var h='', wait=sent?' disabled':'';
    if(myTurn())
      h='<div class="tt-pill mine" role="region" aria-label="Your turn"><span><b>Your turn</b> · round '+round.round+(round.nextName?' · then '+esc(round.nextName):'')+'</span>'+
        '<span class="tt-btns"><button data-tt="hold"'+wait+' title="Delay or ready: step out of the order and act later">Hold</button><button class="pri" data-tt="end"'+wait+'>'+(sent==='end'?'Ending…':'End turn')+'</button></span>'+
        (msg?'<span class="tt-msg" role="status">'+esc(msg)+'</span>':'')+'</div>';
    else if(holding())
      h='<div class="tt-pill next"><span><b>Holding</b> · round '+round.round+' · '+esc(round.turnName||'someone')+' is acting</span><button class="pri" data-tt="act"'+wait+'>'+(sent==='act'?'Sending…':'Act now')+'</button></div>';
    else if(round)
      h='<div class="tt-pill'+(round.next===ID?' next':'')+'"><span>Round '+round.round+' · '+esc(round.turnName||'someone')+'’s turn'+(round.next===ID?' · <b>you’re next</b>':'')+'</span></div>';
    root.innerHTML=h;
  }
  root.addEventListener('click',function(ev){var b=ev.target.closest('button[data-tt]');if(b)reply(b.dataset.tt)});

  /* ---- the pop-up ---- */
  function popup(){
    mount();
    try{if(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.hasBeenActive)navigator.vibrate([120,80,120])}catch(e){}
    var v=document.createElement('div'); v.className='tt-veil';
    v.innerHTML='<div class="tt-box" role="alertdialog" aria-modal="true" aria-labelledby="tt-yt"><h2 id="tt-yt">Your turn, '+esc(NAME)+'!</h2>'+
      '<p>Round '+round.round+(round.nextName?'. '+esc(round.nextName)+' is up after you.':'.')+'</p>'+
      '<div class="tt-row"><button data-a="end">End turn (pass)</button><button data-a="hold">Hold</button><button class="pri" data-a="go">Take my turn</button></div></div>';
    layer.appendChild(v);
    var back=document.activeElement;
    function close(){v.remove();document.removeEventListener('keydown',key,true);if(back&&back.focus)try{back.focus()}catch(e){}}
    function key(e){if(e.key==='Escape'){e.stopPropagation();close()}}
    document.addEventListener('keydown',key,true);
    v.addEventListener('click',function(e){var b=e.target.closest('button[data-a]');if(!b)return;close();if(b.dataset.a!=='go')reply(b.dataset.a)});
    v.querySelector('button.pri').focus();
  }
  if(document.body)draw();else document.addEventListener('DOMContentLoaded',draw);
})();
