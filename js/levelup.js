/* Milestone levelling for the Saviors sheets, after the Dragon Riders sheets:
   - each character sheet has a Level up button at the top, locked until the DM unlocks a level from the Party Sheet
   - the unlock arrives through party/levelup ({unlock:{id:{n,at}}, take:{id:{n,at}}}); every unlock adds one to
     S.levelGrant, adding a level uses one, and undoing a level gives it back
   - when an unlock arrives the player sees "Congratulations Saviors, you leveled up!"
   - the level-up panel previews what the chosen class (and archetype) gains, from js/levelup-data.js
   The sheet passes its state and redraw functions to attach(); everything else lives here. */
(function(){
  'use strict';
  const D=window.SAVIORS_LEVELS;
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let H=null, milestone=false;   // the sheet's hooks; milestone = the online party link is up

  const css=`
.lu-top{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--accent);color:var(--accent);background:transparent;border-radius:999px;padding:4px 14px;font-weight:700;font-size:.9rem;cursor:pointer}
.lu-top.ready{background:var(--accent);color:var(--accent-ink);animation:lu-glow 1.6s ease-in-out infinite}
.lu-top.locked{opacity:.7;border-style:dashed}
.lu-prev{display:grid;gap:8px;border:1px solid var(--line);border-radius:var(--r,6px);padding:10px 12px;background:var(--sunk)}
.lu-prev h3{margin:0;font-size:1rem}
.lu-prev ul{margin:0;padding-left:1.1em;display:grid;gap:4px}
.lu-prev .ch{font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--accent);border:1px solid var(--accent);border-radius:4px;padding:0 4px;margin-left:4px;vertical-align:1px}
.lu-prev .src{font-size:.78rem;color:var(--muted)}
.lu-lock{border-left:3px solid var(--accent);padding:6px 10px;background:var(--accent-soft);border-radius:4px;font-size:.92rem}
.lu-flash{box-shadow:0 0 0 3px var(--accent);transition:box-shadow .3s}
.lp-veil{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(0,0,0,.55);padding:16px}
.lp-veil canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.lp-card{position:relative;max-width:440px;width:100%;text-align:center;background:var(--surface);color:var(--ink);border:3px solid var(--accent);border-radius:16px;padding:22px 20px 18px;box-shadow:0 20px 60px rgba(0,0,0,.45);animation:lp-pop .55s cubic-bezier(.2,1.6,.4,1)}
.lp-horns{font-size:2.6rem;line-height:1;display:flex;justify-content:center;gap:18px}
.lp-horns span{display:inline-block;animation:lp-toot .5s ease-in-out 3 alternate}
.lp-horns span:last-child{transform:scaleX(-1);animation-name:lp-toot2}
.lp-card h2{font-size:1.6rem;margin:10px 0 6px;color:var(--accent);line-height:1.2}
.lp-card p{margin:0 0 14px;color:var(--muted)}
.lp-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
@keyframes lp-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes lp-toot{from{transform:rotate(-12deg)}to{transform:rotate(8deg) scale(1.25)}}
@keyframes lp-toot2{from{transform:scaleX(-1) rotate(-12deg)}to{transform:scaleX(-1) rotate(8deg) scale(1.25)}}
@keyframes lu-glow{50%{box-shadow:0 0 0 4px var(--accent-soft)}}
@media (prefers-reduced-motion:reduce){.lp-card,.lp-horns span,.lu-top.ready{animation:none}}`;
  function addCss(){if(document.getElementById('lu-css'))return;const s=document.createElement('style');s.id='lu-css';s.textContent=css;document.head.appendChild(s)}

  const S=()=>H.S();
  function locked(){return milestone&&!((S().levelGrant||0)>0)}

  /* ---------- the button at the top of the sheet ---------- */
  function paintTop(){
    const head=document.querySelector('.head .ident');if(!head)return;
    let el=document.getElementById('lu-top');
    if(!el){el=document.createElement('div');el.id='lu-top';const after=document.getElementById('subline');(after&&after.parentNode===head)?after.after(el):head.prepend(el)}
    const g=S().levelGrant||0,lk=locked();
    el.innerHTML=`<button class="lu-top${lk?' locked':g?' ready':''}" data-lu="open" title="${lk?'Milestone levelling: your DM unlocks this from the Party Sheet':'Add a level'}">${lk?'🔒 Level up':g?`⬆ Level up!${g>1?` (${g})`:''}`:'Level up'}</button>`;
  }
  function openPanel(){
    if(locked()){H.status('Level up is locked. Your DM unlocks it from the Party Sheet.');return}
    H.goPanel();
    setTimeout(()=>{const p=document.getElementById('levelup');if(!p)return;p.scrollIntoView({behavior:'smooth',block:'start'});p.classList.add('lu-flash');setTimeout(()=>p.classList.remove('lu-flash'),1600)},60);
  }

  /* ---------- preview of the chosen class level ---------- */
  function archOf(c){return c.archetype||((String(c.name||'').match(/\(([^)]+)\)/)||[])[1]||'')}
  function gainsHtml(cls,arch,to,charLvl,title){
    const g=D.gains(cls,arch,to),li=[];
    if(!g.known)return `<div class="lu-prev"><h3>${esc(title)}</h3><p class="muted" style="margin:0">This class isn’t in the level-up guide yet. Check its class table for level ${to}.</p></div>`;
    if(g.maxed)return `<div class="lu-prev"><h3>${esc(title)}</h3><p class="muted" style="margin:0">${esc(cls)} stops at level ${to-1}. Choose another class for the next level.</p></div>`;
    g.items.forEach(x=>li.push(`<li><b>${esc(x.name)}</b>${x.choose?'<span class="ch">choose</span>':''}: ${esc(x.text)}</li>`));
    if(g.spells){li.push(`<li><b>${g.spells.word} per day</b>: ${g.spells.changes.length?esc(g.spells.changes.join(', ')):'no change'}${g.spells.newLevel?` · <b>first ${esc(g.spells.newLevel)}-level ${g.spells.word.toLowerCase()}</b>`:''}</li>`);
      if(g.spells.known&&g.spells.known.length)li.push(`<li><b>Spells known</b>: ${esc(g.spells.known.join(', '))}<span class="ch">choose</span></li>`)}
    if(!g.items.length&&!g.spells)li.push('<li>No new class features at this level.</li>');
    if(charLvl%2===1)li.push(`<li><b>Feat</b><span class="ch">choose</span>: a feat for reaching character level ${charLvl}.</li>`);
    if(charLvl%4===0)li.push(`<li><b>+1 ability score</b><span class="ch">choose</span>: every 4th character level.</li>`);
    li.push('<li>Hit points, base attack, saves and skill ranks are worked out when you add the level.</li>');
    return `<div class="lu-prev"><h3>${esc(title)}</h3><ul>${li.join('')}</ul><span class="src">From the ${esc(cls.toLowerCase())}${arch?` and ${esc(arch.toLowerCase())} archetype`:''} rules on d20pfsrd.com.</span></div>`;
  }
  function paintPreview(){
    const sel=document.getElementById('lu-cls'),box=document.getElementById('lu-prev');if(!sel||!box)return;
    const o=sel.selectedOptions[0];if(!o)return;
    const charLvl=+sel.dataset.char||0,cls=o.dataset.cls||'',to=+o.dataset.to||1,arch=o.dataset.arch||'';
    box.innerHTML=cls?gainsHtml(cls,arch,to,charLvl,`What ${H.name} gains: ${o.textContent.replace(/\s+\d+\s*→\s*/,' ')} (character level ${charLvl})`):'';
    const btn=document.querySelector('[data-act="levelUp"]');
    if(btn){btn.disabled=locked();btn.title=locked()?'Your DM unlocks levelling up from the Party Sheet':''}
    let lk=document.getElementById('lu-lockmsg');
    if(locked()){if(!lk){lk=document.createElement('p');lk.id='lu-lockmsg';lk.className='lu-lock';box.before(lk)}lk.textContent='🔒 Level up unlocks when your DM grants a new level from the Party Sheet.'}
    else if(lk)lk.remove();
  }
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='lu-cls')paintPreview()});
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-lu="open"]');if(b){e.preventDefault();openPanel()}});

  /* ---------- the celebration ---------- */
  function celebrate(){
    addCss();const old=document.getElementById('lvl-party');if(old)old.remove();
    const s=S(),next=H.level()+1,w=document.createElement('div');w.id='lvl-party';w.className='lp-veil';
    w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-labelledby','lp-title');
    w.innerHTML=`<canvas aria-hidden="true"></canvas><div class="lp-card"><div class="lp-horns" aria-hidden="true"><span>📯</span><span>🎉</span><span>📯</span></div>
      <h2 id="lp-title">Congratulations Saviors, you leveled up!</h2>
      <p>Your DM unlocked level ${next} for ${esc(H.name)}.</p>
      <div class="lp-btns"><button class="btn pri" data-lp="go">Level up now</button><button class="btn" data-lp="later">Later</button></div></div>`;
    document.body.appendChild(w);
    let stop=false;const close=()=>{stop=true;w.remove();document.removeEventListener('keydown',key,true)};
    const key=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};document.addEventListener('keydown',key,true);
    w.addEventListener('click',e=>{const b=e.target.closest('[data-lp]');if(!b)return;close();if(b.dataset.lp==='go')openPanel()});
    w.querySelector('[data-lp="go"]').focus();fanfare(w);
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const cv=w.querySelector('canvas'),cx=cv.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1);
    const size=()=>{cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;cx.setTransform(dpr,0,0,dpr,0,0)};size();addEventListener('resize',size);
    const cols=['#e8b04a','#b49cf0','#6db6ff','#e05a7a','#62c370','#5a3fa0','#fff1c1'],W=()=>innerWidth,Hh=()=>innerHeight,bits=[],t0=performance.now();
    for(let i=0;i<160;i++)bits.push({k:'c',x:Math.random()*W(),y:-Math.random()*Hh(),vx:(Math.random()-.5)*2,vy:2+Math.random()*3,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,w:6+Math.random()*6,h:4+Math.random()*6,c:cols[i%cols.length]});
    for(let i=0;i<18;i++)bits.push({k:'s',x:Math.random()*W(),y:-Math.random()*Hh()*.3-20,vy:1.6+Math.random()*1.6,ph:Math.random()*6.28,len:80+Math.random()*90,c:cols[i%cols.length]});
    let last=t0;
    (function frame(now){
      if(stop||!cv.isConnected){removeEventListener('resize',size);return}
      const el=now-t0,k=Math.min(4,(now-last)/16.7);last=now;cx.clearRect(0,0,W(),Hh());
      bits.forEach(b=>{b.y+=b.vy*k;if(el<4500&&b.y>Hh()+20)b.y=-20-Math.random()*80;
        if(b.k==='c'){b.x+=(b.vx+Math.sin(el/400+b.r)*.6)*k;b.r+=b.vr*k;cx.save();cx.translate(b.x,b.y);cx.rotate(b.r);cx.fillStyle=b.c;cx.fillRect(-b.w/2,-b.h/2,b.w,b.h*Math.abs(Math.cos(b.r*2)));cx.restore()}
        else{cx.beginPath();cx.strokeStyle=b.c;cx.lineWidth=3;cx.lineCap='round';for(let j=0;j<=24;j++){const yy=b.y-(j/24)*b.len,xx=b.x+Math.sin(b.ph+el/300+j/3)*10;j?cx.lineTo(xx,yy):cx.moveTo(xx,yy)}cx.stroke()}});
      if(el<9000)requestAnimationFrame(frame);else cx.clearRect(0,0,W(),Hh());
    })(t0);
  }
  /* two brassy horns and a party-blower; browsers may hold sound until the page is touched, then it plays on the first tap */
  function fanfare(wrap){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;let ac;try{ac=new AC()}catch(e){return}
    const play=()=>{const t=ac.currentTime+.05,out=ac.createGain();out.gain.value=.22;out.connect(ac.destination);
      const horn=(f,at,dur)=>[0,7].forEach(det=>{const o=ac.createOscillator(),g=ac.createGain(),lp=ac.createBiquadFilter();
        o.type='sawtooth';o.frequency.value=f;o.detune.value=det;lp.type='lowpass';lp.frequency.setValueAtTime(600,at);lp.frequency.linearRampToValueAtTime(2600,at+.06);
        g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.5,at+.04);g.gain.setValueAtTime(.5,at+dur-.06);g.gain.linearRampToValueAtTime(0,at+dur);
        o.connect(lp);lp.connect(g);g.connect(out);o.start(at);o.stop(at+dur+.02)});
      [[392,0,.14],[392,.16,.14],[392,.32,.14],[523,.48,.5],[466,1,.16],[523,1.18,.7]].forEach(([f,a,d])=>horn(f,t+a,d));
      [[659,.48,.5],[587,1,.16],[659,1.18,.7]].forEach(([f,a,d])=>horn(f,t+a,d));
      setTimeout(()=>{try{ac.close()}catch(e){}},3000)};
    let played=false;const go=()=>{if(!played&&ac.state==='running'){played=true;play()}};
    if(ac.state==='suspended'){ac.resume().then(go,()=>{});const once=()=>{wrap.removeEventListener('pointerdown',once,true);ac.resume().then(go,()=>{})};wrap.addEventListener('pointerdown',once,true)}else go();
  }

  /* ---------- unlocks from the Party Sheet ---------- */
  function watch(db){
    milestone=true;paintTop();paintPreview();
    db.doc('party/levelup').onSnapshot(snap=>{
      const d=(snap.exists&&snap.data())||{},id=H.id,s=S();
      const un=+(((d.unlock||{})[id]||{}).n)||0,tn=+(((d.take||{})[id]||{}).n)||0,seen=s.lvlSeen||{u:0,t:0};
      const du=Math.max(0,un-(seen.u||0)),dt=Math.max(0,tn-(seen.t||0));
      if(!du&&!dt){paintTop();paintPreview();return}
      s.lvlSeen={u:un,t:tn};s.levelGrant=(s.levelGrant||0)+du;let msg='';
      if(dt){const back=Math.min(dt,s.levelGrant);s.levelGrant-=back;if(dt>back)msg='The DM took back a level you have already added. Use “Undo last level” in the Level Up panel.';else if(!du)msg='The DM locked level up again.'}
      if(du)s.lvlParty=true;
      H.save();H.redraw();if(msg)H.status(msg);
      showPending();
    },()=>{});
  }
  /* sheets opened out of sight (a long rest or refresh from the Party Sheet) keep the celebration for the player */
  function showPending(){const s=S();let top=true;try{top=window.top===window}catch(e){}
    if(!(top&&s.lvlParty&&(s.levelGrant||0)>0))return;
    s.lvlParty=false;H.save();
    /* let the sheet's opening animation (js/intro.js) finish first */
    const t0=Date.now();(function wait(){const intro=document.querySelector('body > canvas[aria-hidden="true"]');
      if(intro&&Date.now()-t0<8000)return setTimeout(wait,300);celebrate()})();}

  function attach(hooks){H=hooks;addCss();paintTop()}
  function paint(){if(!H)return;paintTop();paintPreview()}
  /* used by the sheet's levelUp()/undoLevel() */
  function spend(){if(!milestone)return;const s=S();s.levelGrant=Math.max(0,(s.levelGrant||0)-1)}
  function giveBack(){if(!milestone)return;const s=S();s.levelGrant=(s.levelGrant||0)+1}
  function summary(c,charLvl){return gainsHtml(c.preset,archOf(c),Math.floor(+c.level||0),charLvl,'New at this level')}

  window.SaviorsLevel={attach,watch,paint,locked,spend,giveBack,summary,archOf,open:openPanel};
})();
