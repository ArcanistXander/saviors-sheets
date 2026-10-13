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

  var round=null, latest=null, db=null, sent='', msg='', call=null, rolledTxt='', callBox=null;
  function turnKey(){return round?round.cid+':'+round.round+':'+round.turn:''}
  function myTurn(){return !!(round&&round.active&&round.turn===ID)}
  function holding(){return !!(round&&round.active&&(round.held||[]).indexOf(ID)>=0)}
  function shown(k){try{if(localStorage.getItem(KEY)===k)return true;localStorage.setItem(KEY,k)}catch(e){}return false}
  /* the same for the other pop-ups, each kind remembered on its own (save calls, fight recaps) */
  function once(kind,k){var key=KEY+'-'+kind;try{if(localStorage.getItem(key)===String(k))return true;localStorage.setItem(key,String(k))}catch(e){}return false}
  var save=null, saveBox=null, saveSent='';
  var SAVE_N={fort:'Fortitude',ref:'Reflex',will:'Will'};
  /* this hero's own save bonus, from the report the sheet keeps in this browser */
  function myBonus(k){try{var r=JSON.parse(localStorage.getItem('saviors-link-'+ID)||'null'),v=r&&r.live?r.live[k]:null;return v==null||v===''||isNaN(+v)?null:+v}catch(e){return null}}

  /* ---- talking to the DM's tracker ---- */
  function reply(act){
    if(!db||!round)return;
    sent=act; draw();
    db.doc('party/turn-'+ID).set({cid:round.cid,round:round.round,turn:round.turn,act:act,at:new Date().toISOString()})
      .catch(function(){sent='';msg='Couldn’t reach the DM’s tracker. Tell the DM.';draw()});
  }
  function onRound(d){
    var was=turnKey();
    latest=d||null; round=d&&d.active?d:null;
    if(turnKey()!==was){sent='';msg=''}
    if(myTurn()&&!shown(turnKey()))popup();
    /* the DM asked everyone to roll initiative */
    call=d&&!d.active&&d.call&&(d.callFor||[]).indexOf(ID)>=0?d.call:null;
    if(!call&&callBox){callBox.close();callBox=null}
    if(!(d&&d.call))rolledTxt='';
    if(call&&!callBox&&!shown('init:'+call))rollPopup();
    /* the DM called for a saving throw (the DC stays on the DM's side) */
    save=d&&d.save&&(d.save.for||[]).indexOf(ID)>=0?d.save:null;
    if(!save&&saveBox){saveBox.close();saveBox=null}
    if(save&&!saveBox&&saveSent!==save.id&&!once('save',save.id))savePopup();
    /* the fight's recap, once per fight */
    if(d&&!d.active&&d.recap&&d.recap.cid&&!once('recap',d.recap.cid))recapPopup(d.recap);
    draw();
  }
  function sendSave(x){
    var id=save&&save.id; if(!db||!id)return;
    db.doc('party/turn-'+ID).set({act:'save',save:id,value:x,at:new Date().toISOString()})
      .then(function(){saveSent=id;msg='';draw()},function(){msg='Couldn’t reach the DM’s tracker. Tell the DM your total.';draw()});
  }
  /* initiative bonus from this sheet's own report (it keeps a copy in this browser) */
  function initBonus(){try{var r=JSON.parse(localStorage.getItem('saviors-link-'+ID)||'null'),m=String(r&&r.live&&r.live.init||'').match(/[+−-]?\d+/);return m?+m[0].replace('−','-'):null}catch(e){return null}}
  function sendInit(v,txt){
    if(!db||!call)return;
    db.doc('party/turn-'+ID).set({act:'init',call:call,value:v,at:new Date().toISOString()}).then(function(){rolledTxt=txt;draw()},function(){msg='Couldn’t reach the DM’s tracker. Tell the DM your roll.';draw()});
  }
  window.claude.use('db').then(function(d){
    if(!d)return; db=d;
    db.doc('party/round').onSnapshot(function(s){onRound(s.exists?s.data():null)},function(){});
  }).catch(function(){});

  /* ---- what the player sees ---- */
  var css=document.createElement('style');
  css.textContent=
    '.tt-root{--tt-bg:#fbfaf7;--tt-ink:#1c1a24;--tt-muted:#5d5869;--tt-rule:#d6d1c4;--tt-acc:#5a3fa0;--tt-acc-ink:#fff;--tt-soft:#ece6f8;--tt-warn:#a3322a;font:15px/1.4 system-ui,sans-serif;color:var(--tt-ink)}'+
    '@media (prefers-color-scheme:dark){.tt-root{--tt-bg:#1b1824;--tt-ink:#e9e6f2;--tt-muted:#a49eb6;--tt-rule:#3a3548;--tt-acc:#b49cf0;--tt-acc-ink:#17121f;--tt-soft:#2c2540;--tt-warn:#f08a7f}}'+
    '.tt-root button{font:inherit;font-size:.9rem;border-radius:6px;padding:6px 12px;cursor:pointer;border:1px solid var(--tt-rule);background:var(--tt-bg);color:var(--tt-ink)}'+
    '.tt-root button:hover{border-color:var(--tt-acc)}.tt-root button:focus-visible{outline:2px solid var(--tt-acc);outline-offset:2px}'+
    '.tt-root button.pri{background:var(--tt-acc);border-color:var(--tt-acc);color:var(--tt-acc-ink)}.tt-root button:disabled{opacity:.45;cursor:not-allowed}'+
    '.tt-dock{position:fixed;right:12px;bottom:12px;z-index:900;max-width:calc(100% - 24px);display:flex;flex-direction:column;align-items:flex-end;gap:8px}'+
    /* the Initiative tab, drawn inside the sheet with the sheet's own colours */
    '#tt-tab .tt-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px 24px}'+
    '#tt-tab h3{margin:0 0 6px;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}'+
    '#tt-tab .tt-ord,#tt-tab .tt-fx{list-style:none;margin:0;padding:0;display:grid;gap:4px}'+
    '#tt-tab .tt-ord li{display:grid;grid-template-columns:1.2em 2.4em minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 10px;border-radius:6px;border:1px solid var(--line)}'+
    '#tt-tab .tt-ord li.cur{background:var(--accent-soft);border-color:var(--accent);font-weight:700}'+
    '#tt-tab .tt-ord li.me .tt-n{color:var(--accent);font-weight:700}#tt-tab .tt-ord li.foe .tt-n{color:var(--muted)}'+
    '#tt-tab .tt-i{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}#tt-tab .tt-mk{color:var(--accent)}'+
    '#tt-tab .tt-tag{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}'+
    '#tt-tab .tt-fx li{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;justify-content:space-between;padding:7px 10px;border-radius:6px;background:var(--sunk);border:1px solid var(--line)}'+
    '#tt-tab .tt-on{color:var(--muted);font-size:.88rem}#tt-tab .tt-left{font-weight:700;color:var(--accent);white-space:nowrap;font-variant-numeric:tabular-nums}'+
    '#tt-tab .tt-none{margin:0;color:var(--muted)}#tt-tab .note{margin-top:12px}'+
    '.tt-pill{max-width:100%;box-sizing:border-box;background:var(--tt-bg);border:1px solid var(--tt-rule);border-radius:999px;padding:6px 8px 6px 14px;box-shadow:0 4px 18px rgba(0,0,0,.2);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:.88rem}'+
    '.tt-pill.mine,.tt-pill.next{border:2px solid var(--tt-acc)}.tt-pill b{color:var(--tt-acc)}.tt-pill .tt-btns{display:flex;gap:6px}'+
    '.tt-pill .tt-msg{flex-basis:100%;color:var(--tt-warn);font-size:.8rem}'+
    '.tt-veil{position:fixed;inset:0;z-index:1001;display:grid;place-items:center;padding:16px;background:rgba(10,8,16,.55)}'+
    '.tt-box{max-width:400px;width:100%;box-sizing:border-box;background:var(--tt-bg);border-radius:12px;padding:20px 22px;display:grid;gap:12px;box-shadow:0 10px 40px rgba(0,0,0,.4)}'+
    '.tt-box h2{margin:0;font-size:1.4rem}.tt-box p{margin:0;color:var(--tt-muted)}.tt-box .tt-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}'+
    '.tt-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 12px}.tt-picks label{display:flex;gap:8px;align-items:center;cursor:pointer}.tt-picks input{width:18px;height:18px;accent-color:var(--tt-acc)}'+
    '.tt-awards{list-style:none;margin:0;padding:0;display:grid;gap:6px}.tt-awards li{display:grid;gap:1px;padding:8px 10px;border-radius:8px;background:var(--tt-soft)}.tt-aw{font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tt-acc)}'+
    '.tt-notes{margin:0;padding-left:20px;display:grid;gap:2px}.tt-box .tt-msg{color:var(--tt-acc);min-height:1.2em;font-weight:700}'+
    '.tt-init{font:inherit;font-size:1.3rem;padding:8px 10px;border:1px solid var(--tt-rule);border-radius:6px;background:var(--tt-bg);color:var(--tt-ink);width:100%;box-sizing:border-box}';
  document.head.appendChild(css);
  var root=document.createElement('div'); root.className='tt-root';
  var layer=document.createElement('div'); layer.className='tt-root';   // the pop-up, kept apart so redrawing the bar never removes it
  function mount(){if(!root.parentNode)document.body.appendChild(root);if(!layer.parentNode)document.body.appendChild(layer)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  /* ---- the Initiative tab on the sheet (only during a fight): turn order, with enemies as "Enemy 1, 2…", and the timed effects ----
     The sheet asks window.ttTab() for its contents when it draws the tab; between redraws this fills #tt-tab in place. */
  // the tab shows during a fight, and outside one while any timer is running (then it's just the timers)
  window.ttActive=function(){return !!round||fxNow().length>0};
  window.ttLabel=function(){return (round?'Initiative':'Timers')+(myTurn()?' ●':'')};
  window.ttTab=function(){return '<div id="tt-tab">'+tabBody()+'</div>'};
  function fxNow(){return (latest&&latest.fx)||[]}
  function tabBody(){
    if(!window.ttActive())return '';
    var fx=fxNow();
    var fxCol='<div><h3>Timed effects</h3>'+(fx.length?'<ul class="tt-fx">'+fx.map(function(f){
        return '<li><span><b>'+esc(f.n)+'</b> <span class="tt-on">'+esc([f.on?'on '+f.on:'',f.by?'cast by '+f.by:''].filter(Boolean).join(' · '))+'</span></span><span class="tt-left">'+(f.left==null?'until ended':f.left+' round'+(f.left===1?'':'s')+' left')+'</span></li>'}).join('')+'</ul>'
        :'<p class="tt-none">No timed effects running.</p>')+'</div>';
    if(!round)return '<section class="panel"><header><h2>Timers</h2><span class="muted">Spells and effects still running</span></header><div class="tt-cols">'+fxCol+'</div>'+
      '<p class="note">Updates live from the DM’s tracker. Outside a fight, the DM moves time on.</p></section>';
    var ord=round.order||[];
    var who=myTurn()?'<b>Your turn</b>':holding()?'You’re holding · '+esc(round.turnName||'someone')+' is acting':esc(round.turnName||'someone')+'’s turn'+(round.next===ID?' · <b>you’re next</b>':'');
    return '<section class="panel"><header><h2>Initiative</h2><span class="muted">Round '+round.round+' · '+who+'</span></header>'+
      '<div class="tt-cols"><div><h3>Turn order</h3><ol class="tt-ord">'+ord.map(function(o){
        return '<li class="'+(o.cur?'cur ':'')+(o.id===ID?'me ':'')+(o.foe?'foe':'')+'"'+(o.cur?' aria-current="true"':'')+'><span class="tt-mk" aria-hidden="true">'+(o.cur?'▶':'')+'</span><span class="tt-i">'+esc(isNaN(o.i)?'':o.i)+'</span>'+
          '<span class="tt-n">'+esc(o.n)+(o.id===ID?' (you)':'')+'</span><span class="tt-tag">'+(o.held?'Holding':o.cur?'Acting':'')+'</span></li>'}).join('')+'</ol></div>'+fxCol+'</div>'+
      '<p class="note">Updates live from the DM’s tracker. Enemies are listed by their place in the order. On your turn, Hold and End turn are at the bottom of the screen.</p></section>';
  }
  /* ---- a buff spell cast on this sheet: who is it on? Resolves to the hero ids ticked ([] = nobody in the party) ---- */
  window.ttAskTargets=function(spell,opt){
    return new Promise(function(res){
      var hs=((latest&&latest.heroes)||[]).slice(); if(!hs.some(function(h){return h.id===ID}))hs.unshift({id:ID,n:NAME});
      var all=!!(opt&&opt.all), ok=false;
      var box=modal('<div class="tt-box" role="dialog" aria-modal="true" aria-labelledby="tt-at"><h2 id="tt-at">Who is '+esc(spell)+' on?</h2>'+
        '<p>Tick everyone it affects. It switches on on their sheets and comes off by itself when it runs out.</p>'+
        '<div class="tt-picks">'+hs.map(function(h){return '<label><input type="checkbox" value="'+esc(h.id)+'"'+(all?' checked':'')+'> '+esc(h.n)+(h.id===ID?' (yourself)':'')+'</label>'}).join('')+'</div>'+
        '<div class="tt-row"><button data-a="none">Not on the party</button><button class="pri" data-a="ok">Done</button></div></div>',
        function(a,v,close){var on=a==='ok'?[].slice.call(v.querySelectorAll('input:checked')).map(function(i){return i.value}):[];ok=true;close();res(on)});
      box.onEsc=function(){if(!ok)res([])};
    });
  };
  var wasActive=false;
  function syncTab(){
    var act=window.ttActive();
    if(act!==wasActive){wasActive=act;if(window.ttRefresh)window.ttRefresh();return}   // a fight started or ended: the sheet redraws its tab row
    var t=document.getElementById('tt-tab'); if(t)t.innerHTML=tabBody();
    var b=document.querySelector('[data-act="tab"][data-t="initiative"]'); if(b&&b.textContent!==window.ttLabel())b.textContent=window.ttLabel();
  }
  function openTab(){var b=document.querySelector('[data-act="tab"][data-t="initiative"]');if(b){b.click();var t=document.getElementById('tt-tab');if(t)t.scrollIntoView({block:'nearest'})}}
  function draw(){
    mount();syncTab();
    var h='', wait=sent?' disabled':'';
    var tog=round?'<button data-tt="tab" title="Open the Initiative tab: turn order and timed effects">Initiative</button>':'';
    if(myTurn())
      h='<div class="tt-pill mine" role="region" aria-label="Your turn"><span><b>Your turn</b> · round '+round.round+(round.nextName?' · then '+esc(round.nextName):'')+'</span>'+
        '<span class="tt-btns">'+tog+'<button data-tt="hold"'+wait+' title="Delay or ready: step out of the order and act later">Hold</button><button class="pri" data-tt="end"'+wait+'>'+(sent==='end'?'Ending…':'End turn')+'</button></span>'+
        (msg?'<span class="tt-msg" role="status">'+esc(msg)+'</span>':'')+'</div>';
    else if(holding())
      h='<div class="tt-pill next"><span><b>Holding</b> · round '+round.round+' · '+esc(round.turnName||'someone')+' is acting</span><span class="tt-btns">'+tog+'<button class="pri" data-tt="act"'+wait+'>'+(sent==='act'?'Sending…':'Act now')+'</button></span></div>';
    else if(round)
      h='<div class="tt-pill'+(round.next===ID?' next':'')+'"><span>Round '+round.round+' · '+esc(round.turnName||'someone')+'’s turn'+(round.next===ID?' · <b>you’re next</b>':'')+'</span>'+tog+'</div>';
    else if(call&&!callBox)
      h='<div class="tt-pill next"><span><b>Roll initiative</b> for the DM</span><button class="pri" data-tt="roll">Roll</button></div>';
    else if(rolledTxt)
      h='<div class="tt-pill"><span>'+esc(rolledTxt)+' · waiting for the fight to start</span></div>';
    /* a saving throw the DM called for, above the rest */
    var sv='';
    if(save&&saveSent!==save.id&&!saveBox)sv='<div class="tt-pill next"><span><b>'+SAVE_N[save.kind]+' save</b> for the DM'+(save.label?' · '+esc(save.label):'')+'</span><button class="pri" data-tt="save">Save</button></div>';
    else if(save&&saveSent===save.id)sv='<div class="tt-pill"><span>'+SAVE_N[save.kind]+' save sent · waiting for the DM</span></div>';
    root.innerHTML=h||sv?'<div class="tt-dock">'+sv+h+'</div>':'';
  }
  root.addEventListener('click',function(ev){var b=ev.target.closest('button[data-tt]');if(!b)return;
    if(b.dataset.tt==='roll')rollPopup();
    else if(b.dataset.tt==='tab')openTab();
    else if(b.dataset.tt==='save')savePopup();
    else reply(b.dataset.tt)});

  /* ---- pop-ups ---- */
  function buzz(){try{if(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.hasBeenActive)navigator.vibrate([120,80,120])}catch(e){}}
  function modal(html,onClick){
    mount();
    var v=document.createElement('div'); v.className='tt-veil'; v.innerHTML=html; layer.appendChild(v);
    var back=document.activeElement, box={close:close,el:v};
    function close(){if(!v.parentNode)return;v.remove();document.removeEventListener('keydown',key,true);if(back&&back.focus)try{back.focus()}catch(e){}}
    function key(e){if(e.key==='Escape'){e.stopPropagation();close();if(box.onEsc)box.onEsc()}}
    document.addEventListener('keydown',key,true);
    v.addEventListener('click',function(e){var b=e.target.closest('button[data-a]');if(b)onClick(b.dataset.a,v,close)});
    var f=v.querySelector('input')||v.querySelector('button.pri'); if(f)f.focus();
    return box;
  }
  function popup(){
    buzz();
    var notes=(round.notes||[]).map(function(t){return '<li>'+esc(t)+'</li>'}).join('');
    modal('<div class="tt-box" role="alertdialog" aria-modal="true" aria-labelledby="tt-yt"><h2 id="tt-yt">Your turn, '+esc(NAME)+'!</h2>'+
      '<p>Round '+round.round+(round.nextName?'. '+esc(round.nextName)+' is up after you.':'.')+'</p>'+
      (notes?'<ul class="tt-notes">'+notes+'</ul>':'')+
      '<div class="tt-row"><button data-a="end">End turn (pass)</button><button data-a="hold">Hold</button><button class="pri" data-a="go">Take my turn</button></div></div>',
      function(a,v,close){close();if(a!=='go')reply(a)});
  }
  function savePopup(){
    if(!save||saveBox)return;
    buzz(); var k=save.kind, b=myBonus(k), nm=SAVE_N[k]||'saving';
    saveBox=modal('<div class="tt-box" role="dialog" aria-modal="true" aria-labelledby="tt-sv"><h2 id="tt-sv">Make a '+nm+' save!</h2>'+
      (save.label?'<p><b>'+esc(save.label)+'</b></p>':'')+
      '<p>Roll it at the table and type your total'+(b!=null?'. Your '+nm+' save is '+(b<0?'− '+(-b):'+ '+b):'')+'.</p>'+
      '<input class="tt-init" type="number" inputmode="numeric" aria-label="'+nm+' save total" placeholder="Total">'+
      '<p class="tt-msg" role="status"></p>'+
      '<div class="tt-row"><button data-a="later">Later</button><button class="pri" data-a="send">Send</button></div></div>',
      function(a,v,close){
        if(a==='later'){close();saveBox=null;draw();return}
        var x=parseInt(v.querySelector('.tt-init').value,10);
        if(isNaN(x)){v.querySelector('.tt-msg').textContent='Type your total first.';v.querySelector('.tt-init').focus();return}
        sendSave(x);close();saveBox=null;draw();
      });
    saveBox.onEsc=function(){saveBox=null;draw()};
    var inp=saveBox.el.querySelector('.tt-init');inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();saveBox.el.querySelector('[data-a="send"]').click()}});
    draw();
  }
  function recapPopup(r){
    var aw=(r.awards||[]).map(function(a){return '<li><span class="tt-aw">'+esc(a.t)+'</span><span><b>'+esc(a.who)+'</b>'+(a.v?' · '+esc(a.v):'')+'</span></li>'}).join('');
    modal('<div class="tt-box" role="dialog" aria-modal="true" aria-labelledby="tt-rc"><h2 id="tt-rc">Fight recap</h2><p>'+esc(r.summary||'')+'</p>'+
      (aw?'<ul class="tt-awards">'+aw+'</ul>':'')+'<div class="tt-row"><button class="pri" data-a="ok">Nice</button></div></div>',function(a,v,close){close()});
  }
  /* a short message from the DM's side (loot that arrived, …); the sheets call this */
  window.ttNotice=function(title,lines,foot){
    modal('<div class="tt-box" role="dialog" aria-modal="true" aria-labelledby="tt-nt"><h2 id="tt-nt">'+esc(title)+'</h2>'+
      '<ul class="tt-notes">'+(lines||[]).map(function(l){return '<li>'+esc(l)+'</li>'}).join('')+'</ul>'+(foot?'<p>'+esc(foot)+'</p>':'')+
      '<div class="tt-row"><button class="pri" data-a="ok">Got it</button></div></div>',function(a,v,close){close()});
  };
  function rollPopup(){
    if(!call||callBox)return;
    buzz(); var bonus=initBonus();
    callBox=modal('<div class="tt-box" role="dialog" aria-modal="true" aria-labelledby="tt-ri"><h2 id="tt-ri">Roll initiative!</h2>'+
      '<p>Type your total'+(bonus!=null?' (d20 '+(bonus<0?'− '+(-bonus):'+ '+bonus)+')':'')+', or let the sheet roll for you.</p>'+
      '<input class="tt-init" type="number" inputmode="numeric" aria-label="Initiative total" placeholder="Total">'+
      '<p class="tt-msg" role="status"></p>'+
      '<div class="tt-row"><button data-a="later">Later</button><button data-a="auto">Roll for me'+(bonus!=null?' (d20 '+(bonus<0?'−':'+')+' '+Math.abs(bonus)+')':' (d20)')+'</button><button class="pri" data-a="send">Send</button></div></div>',
      function(a,v,close){
        var box=v.querySelector('.tt-init'), m=v.querySelector('.tt-msg');
        if(a==='later'){close();callBox=null;draw();return}
        if(a==='auto'){var d=1+Math.floor(Math.random()*20),t=d+(bonus||0);box.value=t;m.textContent='Rolled '+d+(bonus?(bonus<0?' − ':' + ')+Math.abs(bonus):'')+' = '+t;
          sendInit(t,'You rolled '+t);shown('init:'+call);setTimeout(function(){close();callBox=null;draw()},1400);return}
        var x=parseInt(box.value,10);
        if(isNaN(x)){m.textContent='Type your initiative total first.';box.focus();return}
        sendInit(x,'You rolled '+x);shown('init:'+call);close();callBox=null;draw();
      });
    callBox.onEsc=function(){callBox=null;draw()};
    var inp=layer.querySelector('.tt-init'); if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var s=layer.querySelector('[data-a="send"]');if(s)s.click()}});
    draw();
  }
  if(document.body)draw();else document.addEventListener('DOMContentLoaded',draw);
})();
