/* Saviors sheets: online saving through Firebase.
   The sheets were written against a small `window.claude.use('db')` store (doc().get/set/onSnapshot).
   This file provides that same surface backed by Cloud Firestore, so the sheets themselves barely change.
   Each device joins once with the campaign passcode; Firestore rules only let joined devices read or write. */
(function(){
  'use strict';
  var FB=window.FIREBASE_SDK_BASE||'https://www.gstatic.com/firebasejs/10.12.2/';
  var cfg=window.FIREBASE_CONFIG||{};
  var configured=!!(cfg.apiKey&&cfg.projectId&&!/^PASTE/.test(cfg.apiKey));
  var ready=null;

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
          var mine=F.doc(fs,'members/'+user.uid);
          return F.getDoc(mine).then(function(s){return s.exists()},function(){return false}).then(function(joined){
            if(joined)return true;
            return askPasscode(function(code){
              return F.setDoc(mine,{code:code,at:Date.now()}).then(function(){return true},function(e){if(/permission-denied/.test(e&&e.code||''))return false;throw e});
            });
          }).then(function(ok){return ok?adapter(F,fs):null});
        });
    }).catch(function(e){console.warn('Online saving unavailable:',e);return null});
    return ready;
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

  window.claude={use:function(name){
    if(name==='db')return start();
    return Promise.resolve(null);   // assets, downloads, etc. aren't offered here; the sheets fall back on their own
  }};
})();
