/* Saviors sheets: online saving through Firebase.
   The sheets were written against a small `window.claude.use('db')` store (doc().get/set/onSnapshot).
   This file provides that same surface backed by Cloud Firestore, so the sheets themselves barely change.
   Each device joins once with the campaign passcode; Firestore rules only let joined devices read or write. */
(function(){
  'use strict';
  var FB=window.FIREBASE_SDK_BASE||'https://www.gstatic.com/firebasejs/10.12.2/';
  var cfg=window.FIREBASE_CONFIG||{};
  var configured=!!(cfg.apiKey&&cfg.projectId&&!/^PASTE/.test(cfg.apiKey));
  var ready=null, ctx=null;

  /* Documents are stored as one JSON string: Firestore can't hold nested arrays or undefined values, the sheets use both. */
  function pack(data){return {json:JSON.stringify(data),updated:Date.now()}}
  function unpack(raw){if(!raw)return undefined;try{return typeof raw.json==='string'?JSON.parse(raw.json):raw}catch(e){return undefined}}
  function freeze(snap){
    var d=snap.exists()?unpack(snap.data()):undefined;
    return {id:snap.id,exists:d!==undefined,data:function(){return d===undefined?undefined:JSON.parse(JSON.stringify(d))},
      metadata:{fromCache:snap.metadata.fromCache,hasPendingWrites:snap.metadata.hasPendingWrites}};
  }
  /* The sheets branch on these codes: permission problems mean "view only", everything else is transient. */
  function err(e){var c=e&&e.code||'';return {code:/permission-denied|unauthenticated/.test(c)?'invalid_argument':/resource-exhausted/.test(c)?'resource_exhausted':'unavailable',message:String(e&&e.message||e)}}

  function adapter(F,fs){
    function docRef(path){
      var r=F.doc(fs,path);
      return {id:r.id,path:path,
        get:function(){return F.getDoc(r).then(freeze,function(e){throw err(e)})},
        set:function(d){return F.setDoc(r,pack(d)).catch(function(e){throw err(e)})},
        update:function(d){return F.getDoc(r).then(function(s){var cur=s.exists()?unpack(s.data())||{}:{};return F.setDoc(r,pack(Object.assign(cur,d)))}).catch(function(e){throw err(e)})},
        delete:function(){return F.deleteDoc(r).catch(function(e){throw err(e)})},
        onSnapshot:function(next,onErr){return F.onSnapshot(r,function(s){next(freeze(s))},function(e){if(onErr)onErr(err(e))})}
      };
    }
    function collRef(path){
      var q=F.collection(fs,path);
      function wrap(qs){var docs=qs.docs.map(freeze);return {docs:docs,size:docs.length,empty:!docs.length,metadata:qs.metadata,
        docChanges:function(){return qs.docChanges().map(function(c){return {type:c.type,doc:freeze(c.doc),oldIndex:c.oldIndex,newIndex:c.newIndex}})}}}
      return {path:path,doc:function(id){return docRef(path+'/'+id)},
        get:function(){return F.getDocs(q).then(wrap,function(e){throw err(e)})},
        onSnapshot:function(next,onErr){return F.onSnapshot(q,function(s){next(wrap(s))},function(e){if(onErr)onErr(err(e))})}};
    }
    return {doc:docRef,collection:collRef};
  }

  /* ---- passcode prompt, shown once per device ---- */
  function askPasscode(tryCode){
    return new Promise(function(resolve){
      var css=document.createElement('style');
      css.textContent='.cl-veil{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(10,8,16,.55)}'+
        '.cl-box{max-width:380px;width:100%;background:#f8f7fb;color:#1c1a24;border-radius:10px;padding:20px 22px;display:grid;gap:12px;font:16px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35)}'+
        '.cl-box h2{margin:0;font-size:1.25rem}.cl-box p{margin:0;color:#4d4860;font-size:.92rem}'+
        '.cl-box input{font:inherit;padding:8px 10px;border:1px solid #c9c4d6;border-radius:6px;width:100%;box-sizing:border-box}'+
        '.cl-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.cl-box button{font:inherit;border-radius:6px;padding:7px 14px;cursor:pointer;border:1px solid #c9c4d6;background:#fff;color:#1c1a24}'+
        '.cl-box button.pri{background:#5a3fa0;border-color:#5a3fa0;color:#fff}.cl-msg{color:#b3261e;font-size:.9rem;min-height:1.2em}'+
        '@media (prefers-color-scheme:dark){.cl-box{background:#1b1824;color:#e9e6f2}.cl-box p{color:#a49eb6}.cl-box input,.cl-box button{background:#16131f;color:#e9e6f2;border-color:#2e2a3b}.cl-box button.pri{background:#b49cf0;border-color:#b49cf0;color:#17121f}.cl-msg{color:#f2867c}}';
      document.head.appendChild(css);
      var v=document.createElement('div');v.className='cl-veil';
      v.innerHTML='<form class="cl-box" role="dialog" aria-modal="true" aria-labelledby="cl-t"><h2 id="cl-t">Campaign passcode</h2>'+
        '<p>Enter the passcode from your DM to load and save sheets online. You only need to do this once on each device.</p>'+
        '<input id="cl-code" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Passcode"><div class="cl-msg" id="cl-msg" role="status"></div>'+
        '<div class="cl-row"><button type="button" id="cl-skip">Continue offline</button><button class="pri" type="submit">Join</button></div></form>';
      function open(){document.body.appendChild(v);document.getElementById('cl-code').focus()}
      if(document.body)open();else document.addEventListener('DOMContentLoaded',open);
      v.addEventListener('click',function(e){if(e.target.id==='cl-skip'){v.remove();resolve(false)}});
      v.addEventListener('submit',function(e){
        e.preventDefault();var code=document.getElementById('cl-code').value.trim(),msg=document.getElementById('cl-msg');
        if(!code){msg.textContent='Type the passcode first.';return}
        msg.textContent='Checking…';
        tryCode(code).then(function(ok){if(ok){v.remove();resolve(true)}else msg.textContent='That passcode didn’t work. Check it with your DM.'},
          function(){msg.textContent='Couldn’t reach the server. Check the internet connection and try again.'});
      });
    });
  }

  function start(){
    if(ready)return ready;
    if(!configured){ready=Promise.resolve(null);return ready}
    ready=Promise.all([import(FB+'firebase-app.js'),import(FB+'firebase-auth.js'),import(FB+'firebase-firestore.js')]).then(function(m){
      var A=m[0],U=m[1],F=m[2];
      var app=A.initializeApp(cfg);
      var fs;try{fs=F.initializeFirestore(app,{localCache:F.persistentLocalCache({tabManager:F.persistentMultipleTabManager()})})}catch(e){fs=F.getFirestore(app)}
      var auth=U.getAuth(app);
      return new Promise(function(res,rej){var off=U.onAuthStateChanged(auth,function(u){if(u){off();res(u)}},rej);U.signInAnonymously(auth).catch(rej)})
        .then(function(user){
          ctx={F:F,fs:fs,user:user};
          var mine=F.doc(fs,'members/'+user.uid);
          return F.getDoc(mine).then(function(s){return s.exists()},function(){return false}).then(function(joined){
            if(joined)return true;
            return askPasscode(function(code){
              return F.setDoc(mine,{code:code,at:Date.now()}).then(function(){return true},function(e){if(/permission-denied/.test(e&&e.code||''))return false;throw e});
            });
          }).then(function(ok){return ok?adapter(F,fs):null});
        });
    }).catch(function(e){console.warn('Online saving unavailable:',e);warn(e);return null});
    return ready;
  }
  /* Say so on the page when online saving can't start, instead of quietly saving only in this browser. */
  function warn(e){
    var c=String(e&&e.code||''), offline=navigator.onLine===false||/network-request-failed/.test(c);
    var txt=offline?'You’re offline, so changes save only on this device for now. Reload once you’re back online.'
      :'Online saving isn’t working right now, so changes save only on this device. Tell your DM'+(c?' (error: '+c+')':'')+'.';
    function show(){
      var b=document.createElement('div');b.setAttribute('role','alert');
      b.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:999;max-width:min(560px,calc(100% - 32px));background:#b3261e;color:#fff;border-radius:8px;padding:10px 40px 10px 14px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3)';
      b.textContent=txt;
      var x=document.createElement('button');x.textContent='×';x.setAttribute('aria-label','Dismiss');
      x.style.cssText='position:absolute;top:4px;right:6px;background:none;border:0;color:#fff;font-size:20px;cursor:pointer;padding:2px 8px';
      x.onclick=function(){b.remove()};b.appendChild(x);document.body.appendChild(b);
    }
    if(document.body)show();else document.addEventListener('DOMContentLoaded',show);
  }

  /* Character sheets hand their DM report here; the party sheet watches the `reports` collection. */
  var repTimer={},repLast={};
  window.sheetsReport=function(id,rep){
    clearTimeout(repTimer[id]);
    repTimer[id]=setTimeout(function(){
      var key=JSON.stringify(Object.assign({},rep,{at:0}));if(key===repLast[id])return;
      start().then(function(db){if(!db)return;return db.doc('reports/'+id).set(rep).then(function(){repLast[id]=key})}).catch(function(){});
    },1500);
  };

  /* ---- DM lock: the Party Sheet and the Bestiary. A device unlocks once by entering the DM password, which is checked by the
     rule on dms/<uid>; the rules only let unlocked devices read party/main and party/bestiary. The password is never in this code. ---- */
  var DMKEY='saviors-dm', dmReady=null;
  function dmFlag(set){try{if(set)localStorage.setItem(DMKEY,'1');return localStorage.getItem(DMKEY)==='1'}catch(e){return !!set}}
  var SIGN='<svg viewBox="0 0 260 190" width="220" role="img" aria-label="A wooden sign that says No peeking, with a pair of eyes peeking over the top">'+
    '<rect x="52" y="70" width="16" height="120" rx="3" fill="#7a4e27"/><rect x="192" y="70" width="16" height="120" rx="3" fill="#7a4e27"/>'+
    '<g transform="rotate(-3 130 80)">'+
      '<ellipse cx="108" cy="38" rx="17" ry="15" fill="#fff" stroke="#2a1a0e" stroke-width="3"/><ellipse cx="152" cy="38" rx="17" ry="15" fill="#fff" stroke="#2a1a0e" stroke-width="3"/>'+
      '<circle cx="113" cy="34" r="7" fill="#1c1208"/><circle cx="157" cy="34" r="7" fill="#1c1208"/><circle cx="115" cy="31" r="2.2" fill="#fff"/><circle cx="159" cy="31" r="2.2" fill="#fff"/>'+
      '<rect x="18" y="42" width="224" height="100" rx="10" fill="#c08a52" stroke="#5c3a1c" stroke-width="5"/>'+
      '<path d="M30 66 C80 60 120 72 230 64 M30 118 C90 124 150 112 230 120 M40 92 C70 88 90 96 120 92" stroke="#a5713d" stroke-width="2.5" fill="none" stroke-linecap="round"/>'+
      '<g fill="#d9a066" stroke="#5c3a1c" stroke-width="2.5"><rect x="84" y="34" width="11" height="16" rx="5"/><rect x="96" y="33" width="11" height="17" rx="5"/><rect x="153" y="33" width="11" height="17" rx="5"/><rect x="165" y="34" width="11" height="16" rx="5"/></g>'+
      '<g fill="#5c3a1c"><circle cx="32" cy="56" r="3.5"/><circle cx="228" cy="56" r="3.5"/><circle cx="32" cy="128" r="3.5"/><circle cx="228" cy="128" r="3.5"/></g>'+
      '<text x="130" y="88" text-anchor="middle" font-family="Impact,\'Arial Black\',sans-serif" font-size="30" fill="#fff8e8" stroke="#3b2412" stroke-width="1.2" letter-spacing="2">NO</text>'+
      '<text x="130" y="126" text-anchor="middle" font-family="Impact,\'Arial Black\',sans-serif" font-size="36" fill="#b3261e" stroke="#3b2412" stroke-width="1.2" letter-spacing="1">PEEKING!</text>'+
    '</g></svg>';
  function askDm(tryCode){
    return new Promise(function(resolve){
      var css=document.createElement('style');
      css.textContent='.dm-veil{position:fixed;inset:0;z-index:1002;display:grid;place-items:center;padding:16px;overflow:auto;background:#0f0b07}'+
        '.dm-box{max-width:380px;width:100%;background:#f8f2e6;color:#2a1a0e;border-radius:12px;padding:20px 22px;display:grid;gap:12px;justify-items:center;text-align:center;font:16px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)}'+
        '.dm-box h2{margin:0;font-size:1.3rem}.dm-box p{margin:0;color:#5c4a3a;font-size:.92rem}'+
        '.dm-box input{font:inherit;padding:8px 10px;border:1px solid #c9b79e;border-radius:6px;width:100%;box-sizing:border-box;background:#fff;color:#2a1a0e}'+
        '.dm-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;width:100%}.dm-box button,.dm-box a.b{font:inherit;border-radius:6px;padding:7px 14px;cursor:pointer;border:1px solid #c9b79e;background:#fff;color:#2a1a0e;text-decoration:none}'+
        '.dm-box button.pri{background:#7a4e27;border-color:#7a4e27;color:#fff}.dm-msg{color:#b3261e;font-size:.9rem;min-height:1.2em}'+
        '.dm-box :focus-visible{outline:2px solid #7a4e27;outline-offset:2px}';
      document.head.appendChild(css);
      var v=document.createElement('div');v.className='dm-veil';
      v.innerHTML='<form class="dm-box" role="dialog" aria-modal="true" aria-labelledby="dm-t">'+SIGN+'<h2 id="dm-t">DM only</h2>'+
        (tryCode?'<p>This page holds the DM’s prepared fights. Enter the DM password to open it on this device.</p>'+
          '<input id="dm-code" type="password" autocomplete="off" spellcheck="false" aria-label="DM password"><div class="dm-msg" id="dm-msg" role="status"></div>'+
          '<div class="dm-row"><a class="b" href="index.html">Back to the sheets</a><button class="pri" type="submit">Unlock</button></div>'
        :'<p>This page holds the DM’s prepared fights. Unlocking it needs the internet connection and the campaign passcode. Reload once you’re online.</p>'+
          '<div class="dm-row"><a class="b" href="index.html">Back to the sheets</a><button class="pri" type="button" id="dm-reload">Reload</button></div>')+'</form>';
      function open(){document.body.appendChild(v);var c=document.getElementById('dm-code');if(c)c.focus()}
      if(document.body)open();else document.addEventListener('DOMContentLoaded',open);
      v.addEventListener('click',function(e){if(e.target.id==='dm-reload')location.reload()});
      v.addEventListener('submit',function(e){
        e.preventDefault();if(!tryCode)return;
        var code=document.getElementById('dm-code').value,msg=document.getElementById('dm-msg');
        if(!code){msg.textContent='Type the DM password first.';return}
        msg.textContent='Checking…';
        tryCode(code).then(function(ok){if(ok){v.remove();resolve(true)}else{msg.textContent='Nice try. That’s not the DM password.';document.getElementById('dm-code').select()}},
          function(){msg.textContent='Couldn’t reach the server. Check the internet connection and try again.'});
      });
    });
  }
  function startDm(){
    if(dmReady)return dmReady;
    dmReady=start().then(function(db){
      if(!db||!ctx)return dmFlag()?true:askDm(null);
      var F=ctx.F, mine=F.doc(ctx.fs,'dms/'+ctx.user.uid);
      return F.getDoc(mine).then(function(s){return s.exists()},function(){return null}).then(function(ok){
        if(ok){dmFlag(true);return true}
        if(ok===null&&dmFlag())return true;   // couldn't check (offline) on a device that unlocked before
        return askDm(function(code){
          return F.setDoc(mine,{code:code,at:Date.now()}).then(function(){dmFlag(true);return true},function(e){if(/permission-denied/.test(e&&e.code||''))return false;throw e});
        });
      });
    }).then(function(ok){if(ok)document.documentElement.classList.remove('dm-locked');return ok});
    return dmReady;
  }

  window.claude={use:function(name){
    if(name==='dm')return startDm();
    if(name==='db')return start();
    return Promise.resolve(null);   // assets, downloads, etc. aren't offered here; the sheets fall back on their own
  }};
})();
