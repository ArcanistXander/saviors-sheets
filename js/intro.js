/* Opening flourish for each character sheet: a ~10 s canvas overlay played once per page load.
   <script src="js/intro.js" data-intro="drax|ensley|sinafey"></script>
   The canvas ignores the pointer, so the sheet stays usable underneath; any click or key fades it out early. */
(function(){
  'use strict';
  var theme=(document.currentScript&&document.currentScript.dataset.intro)||'';
  if(!theme)return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;

  var FADE_AT=8600, FADE_LEN=1300;
  var cv=document.createElement('canvas'), cx=cv.getContext('2d');
  cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:900';
  var W=0,H=0,DPR=1,S=1;   // S scales effect sizes to the screen
  function size(){DPR=Math.min(window.devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);S=Math.max(.6,Math.min(1.3,Math.min(W,H)/800))}

  var rnd=function(a,b){return a+Math.random()*(b-a)}, clamp=function(v,a,b){return v<a?a:v>b?b:v};
  var easeOut=function(p){p=clamp(p,0,1);return 1-Math.pow(1-p,3)};
  function sprite(w,h,draw){var c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return c}

  /* ---------- shared: screen shake on the sheet itself ---------- */
  var shakeEl=null,shakeAmp=0,shakeEnd=0,shakeLen=1;
  function shake(amp,ms,t){if(amp>=shakeAmp*clamp((shakeEnd-t)/shakeLen,0,1)){shakeAmp=amp;shakeEnd=t+ms;shakeLen=ms}}
  function applyShake(t){
    if(!shakeEl)return;
    var k=clamp((shakeEnd-t)/shakeLen,0,1);
    shakeEl.style.transform=k>0?'translate('+(rnd(-1,1)*shakeAmp*k).toFixed(1)+'px,'+(rnd(-1,1)*shakeAmp*k).toFixed(1)+'px)':'';
  }

  /* ---------- shared: particles ---------- */
  var parts=[];
  function emit(p){parts.push(p)}
  function drawParts(dt,t){
    for(var i=parts.length-1;i>=0;i--){
      var p=parts[i];p.age+=dt;
      if(p.age>=p.life){parts.splice(i,1);continue}
      var k=p.age/p.life;
      p.vx*=p.drag||1;p.vy=p.vy*(p.drag||1)+(p.g||0)*dt/1000;
      p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;
      p.draw(p,k,t);
    }
  }

  /* =====================================================================
     DRAX — storm lord monk: lightning strikes and crackling ki palm prints
     ===================================================================== */
  function drax(){
    var bolts=[],palms=[],rings=[],flash=0;
    var hand=sprite(200,240,function(g){
      g.translate(100,150);
      function cap(x,y,ang,len,w){g.save();g.translate(x,y);g.rotate(ang);g.beginPath();g.moveTo(-w/2,0);g.lineTo(-w/2,-len+w/2);g.arc(0,-len+w/2,w/2,Math.PI,0);g.lineTo(w/2,0);g.closePath();g.fill();g.restore()}
      function shape(){
        g.beginPath();g.moveTo(-30,-18);g.quadraticCurveTo(-36,30,-14,52);g.quadraticCurveTo(4,62,22,50);g.quadraticCurveTo(38,26,32,-18);g.closePath();g.fill();
        cap(-24,-12,-.14,50,15);cap(-8,-16,-.05,60,16);cap(9,-16,.04,56,16);cap(24,-10,.13,44,14);cap(-28,18,-1.05,44,17);
      }
      g.shadowColor='rgba(110,180,255,1)';g.shadowBlur=28;g.fillStyle='rgba(120,190,255,.9)';shape();
      g.shadowBlur=0;var gr=g.createRadialGradient(0,10,4,0,10,90);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(.5,'rgba(190,225,255,.85)');gr.addColorStop(1,'rgba(90,150,255,.7)');
      g.fillStyle=gr;g.scale(.9,.9);g.translate(0,3);shape();
    });

    function makeBolt(x0,y0,x1,y1,depth){
      var pts=[[x0,y0],[x1,y1]],disp=Math.hypot(x1-x0,y1-y0)*.22;
      for(var n=0;n<6;n++){var next=[pts[0]];for(var i=1;i<pts.length;i++){var a=pts[i-1],b=pts[i];next.push([(a[0]+b[0])/2+rnd(-disp,disp),(a[1]+b[1])/2+rnd(-disp,disp)*.4]);next.push(b)}pts=next;disp*=.55}
      var out=[pts];
      if(depth<2)for(var k=0;k<3;k++){var s=pts[Math.floor(rnd(.2,.75)*pts.length)],len=rnd(60,160)*S,ang=Math.atan2(y1-y0,x1-x0)+rnd(-.9,.9);out=out.concat(makeBolt(s[0],s[1],s[0]+Math.cos(ang)*len,s[1]+Math.sin(ang)*len,depth+1).map(function(b){b.branch=true;return b}))}
      return out;
    }
    function strike(t,tx,ty,big){
      tx=tx==null?rnd(.1,.9)*W:tx;ty=ty==null?rnd(.3,.85)*H:ty;
      bolts.push({paths:makeBolt(tx+rnd(-.25,.25)*W,-20,tx,ty,0),born:t,life:big?520:380,w:big?1.4:1});
      flash=Math.max(flash,big?.42:.28);shake(big?9:5,big?380:220,t);
      for(var i=0;i<16;i++){var a=rnd(0,Math.PI*2),v=rnd(80,420);emit({x:tx,y:ty,vx:Math.cos(a)*v,vy:Math.sin(a)*v-120,g:700,drag:.97,age:0,life:rnd(300,700),
        draw:function(p,k){cx.globalCompositeOperation='lighter';cx.fillStyle='rgba(190,225,255,'+(1-k)+')';cx.fillRect(p.x-1.5,p.y-1.5,3,3);cx.globalCompositeOperation='source-over'}})}
      rings.push({x:tx,y:ty,born:t,life:600,max:120*S,col:'160,210,255'});
    }
    function palm(t,i){
      var x=rnd(.12,.88)*W,y=rnd(.2,.85)*H;
      palms.push({x:x,y:y,born:t,rot:rnd(-.5,.5),flip:i%2?-1:1,sc:rnd(.75,1.05)*S});
      rings.push({x:x,y:y,born:t,life:500,max:95*S,col:'200,230,255'});
      shake(6,200,t);
      for(var k=0;k<3;k++){var a=rnd(0,Math.PI*2),l=rnd(50,110)*S;bolts.push({paths:makeBolt(x,y,x+Math.cos(a)*l,y+Math.sin(a)*l,2),born:t+k*60,life:260,w:.55})}
    }
    var plan=[];
    [250,1050,1850,2700,3500,4500,5800,7200].forEach(function(at,i){plan.push({at:at,fn:function(t){strike(t,null,null,i===0||i===4)}})});
    [700,1150,1550,1950,2950,3800,4300,5200,6300,6700].forEach(function(at,i){plan.push({at:at,fn:function(t){palm(t,i)}})});

    return {plan:plan,dim:'rgba(6,10,28,0.42)',draw:function(t,dt){
      /* palm prints: slam in, crackle, fade */
      palms.forEach(function(p){
        var age=t-p.born;if(age<0)return;var life=3600;if(age>life)return;
        var k=age/life,pop=age<120?1.35-.35*(age/120):1,a=age<120?age/120:1-Math.pow(k,2);
        cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.scale(p.flip*p.sc*pop*.85,p.sc*pop*.85);
        cx.globalAlpha=a*.95;cx.globalCompositeOperation='lighter';cx.drawImage(hand,-100,-150);
        if(age<700&&Math.random()<.5){cx.globalAlpha=a*.6;cx.drawImage(hand,-100+rnd(-4,4),-150+rnd(-4,4))}
        cx.restore();
      });
      /* lightning */
      cx.save();cx.lineJoin='round';cx.lineCap='round';
      bolts.forEach(function(b){
        var age=t-b.born;if(age<0||age>b.life)return;
        var a=age<160?rnd(.55,1):1-(age-160)/(b.life-160);
        b.paths.forEach(function(pts){
          cx.beginPath();cx.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)cx.lineTo(pts[i][0],pts[i][1]);
          var w=(pts.branch?1.6:3.4)*b.w*S;
          cx.globalAlpha=a;cx.shadowColor='rgba(100,170,255,1)';cx.shadowBlur=22*S;cx.strokeStyle='rgba(120,185,255,.9)';cx.lineWidth=w*2.6;cx.stroke();
          cx.shadowBlur=0;cx.strokeStyle='rgba(255,255,255,1)';cx.lineWidth=w;cx.stroke();
        });
      });
      cx.restore();
      bolts=bolts.filter(function(b){return t-b.born<=b.life});
      drawRings(rings,t);
      /* sky flash */
      if(flash>.005){cx.fillStyle='rgba(205,228,255,'+flash+')';cx.fillRect(0,0,W,H);flash*=Math.pow(.86,dt/16)}
    }};
  }

  /* =====================================================================
     ENSLEY — pixie druid: a beast's roar, vines climbing the sheet, elemental bursts
     ===================================================================== */
  function ensley(){
    var vines=[],effects=[],rings=[];
    var leafCols=['#2f7a34','#3f9440','#58ad4a','#6fc15a'];
    function makeVine(i,n){
      var side=i%4, x,y,ang;
      if(side===3&&i%8===3){x=-10;y=rnd(.45,.95)*H;ang=-.55}else if(side===2&&i%8===6){x=W+10;y=rnd(.45,.95)*H;ang=-Math.PI+.55}
      else{x=(i+.5)/n*W+rnd(-.04,.04)*W;y=H+10;ang=-Math.PI/2+rnd(-.25,.25)}
      var pts=[[x,y]],step=13*S,len=rnd(.55,.95)*H/step,sway=rnd(.6,1.4),ph=rnd(0,6);
      for(var k=0;k<len;k++){ang+=Math.sin(k*.18*sway+ph)*.07+rnd(-.05,.05);ang=clamp(ang,-Math.PI+.25,-.25);x+=Math.cos(ang)*step;y+=Math.sin(ang)*step;pts.push([x,y])}
      var leaves=[],flowers=[];
      for(var j=4;j<pts.length-1;j+=rnd(3,5)|0){leaves.push({i:j,side:leaves.length%2?1:-1,size:rnd(.8,1.25),col:leafCols[(Math.random()*leafCols.length)|0]});if(Math.random()<.12)flowers.push({i:j,col:Math.random()<.5?'#f6c2df':'#fff4c2'})}
      return {pts:pts,leaves:leaves,flowers:flowers,start:200+i*140,grow:rnd(2800,3800),w:rnd(6,10)*S,curl:Math.random()<.6};
    }
    var n=Math.max(6,Math.round(W/170));for(var i=0;i<n+2;i++)vines.push(makeVine(i,n));

    function leaf(x,y,ang,sz,col){
      cx.save();cx.translate(x,y);cx.rotate(ang);cx.scale(sz,sz);
      cx.beginPath();cx.moveTo(0,0);cx.quadraticCurveTo(10,-11,24,0);cx.quadraticCurveTo(10,11,0,0);cx.fillStyle=col;cx.fill();
      cx.strokeStyle='rgba(20,60,20,.6)';cx.lineWidth=1;cx.beginPath();cx.moveTo(1,0);cx.lineTo(21,0);cx.stroke();cx.restore();
    }
    function drawVine(v,t,fadeK){
      var p=easeOut((t-v.start)/v.grow);if(p<=0)return;
      var upto=Math.max(1,Math.floor(p*(v.pts.length-1)));
      cx.save();cx.lineCap='round';cx.lineJoin='round';cx.globalAlpha=fadeK;
      for(var i=1;i<=upto;i++){var a=v.pts[i-1],b=v.pts[i],w=v.w*(1-.82*i/v.pts.length);
        cx.strokeStyle='#245b26';cx.lineWidth=w+2;cx.beginPath();cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1]);cx.stroke();
        cx.strokeStyle='#4f9a3f';cx.lineWidth=w*.55;cx.beginPath();cx.moveTo(a[0]-w*.12,a[1]);cx.lineTo(b[0]-w*.12,b[1]);cx.stroke()}
      v.leaves.forEach(function(l){if(l.i>upto)return;var q=v.pts[l.i],r=v.pts[l.i+1]||q,ang=Math.atan2(r[1]-q[1],r[0]-q[0])+l.side*1.05,grow=clamp((upto-l.i)/5,0,1);
        leaf(q[0],q[1],ang,l.size*S*easeOut(grow)*1.15,l.col)});
      v.flowers.forEach(function(f){if(f.i>upto-3)return;var q=v.pts[f.i];cx.fillStyle=f.col;for(var k=0;k<5;k++){var a=k/5*Math.PI*2;cx.beginPath();cx.arc(q[0]+Math.cos(a)*5*S,q[1]+Math.sin(a)*5*S,3.6*S,0,7);cx.fill()}cx.fillStyle='#e8a33b';cx.beginPath();cx.arc(q[0],q[1],2.6*S,0,7);cx.fill()});
      if(v.curl&&p>.97){var e=v.pts[v.pts.length-1],d=v.pts[v.pts.length-2],a0=Math.atan2(e[1]-d[1],e[0]-d[0]);cx.strokeStyle='#4f9a3f';cx.lineWidth=2*S;cx.beginPath();
        for(var s=0;s<28;s++){var r=14*S*(1-s/28),a=a0+s*.32;var px=e[0]+Math.cos(a0)*r*.2+Math.cos(a+1.57)*r,py=e[1]+Math.sin(a0)*r*.2+Math.sin(a+1.57)*r;s?cx.lineTo(px,py):cx.moveTo(e[0],e[1])}cx.stroke()}
      cx.restore();
    }

    /* elemental bursts */
    function splash(t,x,y){
      rings.push({x:x,y:y,born:t,life:900,max:110*S,col:'110,190,255'});rings.push({x:x,y:y,born:t+150,life:900,max:70*S,col:'170,220,255'});
      for(var i=0;i<34;i++){var a=rnd(-Math.PI*.95,-Math.PI*.05),v=rnd(180,520)*S;emit({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:1100,age:0,life:rnd(700,1300),r:rnd(2,5)*S,
        draw:function(p,k){cx.fillStyle='rgba(150,205,255,'+(1-k)+')';cx.beginPath();cx.ellipse(p.x,p.y,p.r*.75,p.r,Math.atan2(p.vy,p.vx)+1.57,0,7);cx.fill();cx.fillStyle='rgba(255,255,255,'+(.8*(1-k))+')';cx.beginPath();cx.arc(p.x-p.r*.25,p.y-p.r*.3,p.r*.3,0,7);cx.fill()}})}
      shake(5,250,t);
    }
    function fire(t,x,y){
      for(var i=0;i<46;i++){var a=rnd(-Math.PI*.8,-Math.PI*.2),v=rnd(90,330)*S;emit({x:x+rnd(-14,14),y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:-180,drag:.985,age:0,life:rnd(600,1200),r:rnd(5,13)*S,
        draw:function(p,k){cx.globalCompositeOperation='lighter';var g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*(1-k*.5));g.addColorStop(0,'rgba(255,240,170,'+(1-k)+')');g.addColorStop(.45,'rgba(255,140,30,'+(.8*(1-k))+')');g.addColorStop(1,'rgba(200,40,0,0)');cx.fillStyle=g;cx.beginPath();cx.arc(p.x,p.y,p.r,0,7);cx.fill();cx.globalCompositeOperation='source-over'}})}
      rings.push({x:x,y:y,born:t,life:500,max:80*S,col:'255,170,60'});shake(6,250,t);
    }
    function crack(t,x,y){
      var br=[];
      function grow(x0,y0,ang,len,depth){var pts=[[x0,y0]],seg=10*S;for(var d=0;d<len;d+=seg){ang+=rnd(-.45,.45);x0+=Math.cos(ang)*seg;y0+=Math.sin(ang)*seg;pts.push([x0,y0]);
        if(depth<2&&Math.random()<.13)grow(x0,y0,ang+rnd(-1,1),len*rnd(.3,.55),depth+1)}br.push({pts:pts,depth:depth})}
      var k=(rnd(5,8))|0;for(var i=0;i<k;i++)grow(x,y,i/k*Math.PI*2+rnd(-.3,.3),rnd(90,220)*S,0);
      effects.push({born:t,draw:function(t2,fk){var p=easeOut((t2-t)/450);cx.save();cx.lineCap='round';cx.lineJoin='round';
        br.forEach(function(b){var n2=Math.max(1,Math.floor(p*b.pts.length));cx.beginPath();cx.moveTo(b.pts[0][0],b.pts[0][1]);for(var i=1;i<n2;i++)cx.lineTo(b.pts[i][0],b.pts[i][1]);
          var w=(3.2-b.depth)*S;cx.globalAlpha=fk;cx.strokeStyle='rgba(30,20,12,.9)';cx.lineWidth=w*2.2;cx.stroke();
          cx.globalCompositeOperation='lighter';cx.strokeStyle='rgba(255,150,50,'+(.55+.35*Math.sin(t2/90))+')';cx.lineWidth=w*.8;cx.stroke();cx.globalCompositeOperation='source-over'});
        cx.restore()}});
      for(var i=0;i<26;i++){var a=rnd(0,Math.PI*2),v=rnd(40,200)*S;emit({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,g:300,drag:.96,age:0,life:rnd(500,1100),r:rnd(2,4)*S,
        draw:function(p,k){cx.fillStyle='rgba(120,92,60,'+(1-k)+')';cx.fillRect(p.x,p.y,p.r,p.r)}})}
      shake(10,420,t);
    }
    function gust(t,y){
      var arcs=[];for(var i=0;i<6;i++)arcs.push({y:y+rnd(-60,60)*S,r:rnd(40,90)*S,len:rnd(.35,.6)*W,d:i*70});
      effects.push({born:t,draw:function(t2,fk){cx.save();cx.lineCap='round';arcs.forEach(function(a){var p=(t2-t-a.d)/900;if(p<0||p>1)return;var x=-a.len+p*(W+a.len*2);
        cx.globalAlpha=fk*Math.sin(p*Math.PI)*.8;cx.strokeStyle='rgba(220,250,240,1)';cx.lineWidth=2.5*S;cx.beginPath();cx.moveTo(x,a.y);cx.quadraticCurveTo(x+a.len*.5,a.y-a.r*.4,x+a.len*.8,a.y);cx.arc(x+a.len*.8,a.y-a.r*.35,a.r*.35,1.57,-1.2,true);cx.stroke()});cx.restore()}});
    }
    var spots=function(){return [rnd(.18,.82)*W,rnd(.3,.75)*H]};
    var plan=[
      {at:0,fn:function(t){roar();shake(12,1100,t)}},
      {at:3900,fn:function(t){var s=spots();splash(t,s[0],s[1])}},
      {at:4700,fn:function(t){var s=spots();fire(t,s[0],s[1])}},
      {at:5400,fn:function(t){var s=spots();crack(t,s[0],s[1])}},
      {at:6100,fn:function(t){gust(t,rnd(.3,.7)*H)}},
      {at:6600,fn:function(t){var s=spots();splash(t,s[0],s[1])}},
      {at:7100,fn:function(t){var s=spots();crack(t,s[0],s[1])}},
      {at:7500,fn:function(t){var s=spots();fire(t,s[0],s[1])}}
    ];
    return {plan:plan,dim:'rgba(8,22,10,0.38)',draw:function(t,dt,fadeK){
      vines.forEach(function(v){drawVine(v,t,1)});
      effects.forEach(function(e){if(t>=e.born)e.draw(t,1)});
      drawRings(rings,t);
    }};
  }

  /* A beast's roar, synthesized: filtered noise for breath plus a distorted low growl. */
  function roar(){
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    var ctx,done=false,openedAt=Date.now();
    try{ctx=new AC()}catch(e){return}
    function play(){
      if(done||Date.now()-openedAt>9000)return;done=true;
      var t0=ctx.currentTime+.02,dur=2.5,sr=ctx.sampleRate;
      var comp=ctx.createDynamicsCompressor();comp.connect(ctx.destination);
      var master=ctx.createGain();master.gain.value=.85;master.connect(comp);
      var buf=ctx.createBuffer(1,Math.floor(sr*dur),sr),d=buf.getChannelData(0),last=0;
      for(var i=0;i<d.length;i++){last=(last+.06*(Math.random()*2-1))/1.06;d[i]=last*3.5}
      var noise=ctx.createBufferSource();noise.buffer=buf;
      var bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=.8;bp.frequency.setValueAtTime(260,t0);bp.frequency.linearRampToValueAtTime(700,t0+.55);bp.frequency.exponentialRampToValueAtTime(240,t0+dur);
      var ng=ctx.createGain();ng.gain.setValueAtTime(0,t0);ng.gain.linearRampToValueAtTime(1,t0+.18);ng.gain.linearRampToValueAtTime(.75,t0+1.5);ng.gain.linearRampToValueAtTime(0,t0+dur);
      noise.connect(bp);bp.connect(ng);ng.connect(master);
      var shaper=ctx.createWaveShaper(),curve=new Float32Array(1024);for(var j=0;j<1024;j++){var x=j/511.5-1;curve[j]=Math.tanh(x*5)}shaper.curve=curve;
      var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(500,t0);lp.frequency.linearRampToValueAtTime(1300,t0+.5);lp.frequency.exponentialRampToValueAtTime(350,t0+dur);
      var og=ctx.createGain();og.gain.setValueAtTime(0,t0);og.gain.linearRampToValueAtTime(.55,t0+.22);og.gain.linearRampToValueAtTime(.4,t0+1.6);og.gain.linearRampToValueAtTime(0,t0+dur);
      var lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=9;lg.gain.value=7;lfo.connect(lg);
      [1,1.49,.5].forEach(function(m){var o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(58*m,t0);o.frequency.linearRampToValueAtTime(88*m,t0+.45);o.frequency.exponentialRampToValueAtTime(50*m,t0+dur);
        lg.connect(o.frequency);o.connect(shaper);o.start(t0);o.stop(t0+dur)});
      shaper.connect(lp);lp.connect(og);og.connect(master);
      noise.start(t0);noise.stop(t0+dur);lfo.start(t0);lfo.stop(t0+dur);
      setTimeout(function(){try{ctx.close()}catch(e){}},(dur+.5)*1000);
    }
    /* Browsers only allow sound after the visitor interacts with the page; if it's blocked now, roar on their first tap. */
    function onGesture(){removeEventListener('pointerdown',onGesture,true);removeEventListener('keydown',onGesture,true);ctx.resume().then(play)}
    var p=ctx.resume();
    setTimeout(function(){if(ctx.state==='running')play();else{addEventListener('pointerdown',onGesture,true);addEventListener('keydown',onGesture,true)}},250);
    if(p&&p.then)p.then(function(){if(ctx.state==='running')play()});
  }

  /* =====================================================================
     SINAFEY — shadowdancer: a swirl of shadow and violet magic, flung daggers that vanish in smoke
     ===================================================================== */
  function sinafey(){
    var motes=[],daggers=[];
    var smoke=sprite(128,128,function(g){var gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(70,30,120,.55)');gr.addColorStop(.5,'rgba(35,12,60,.35)');gr.addColorStop(1,'rgba(10,4,20,0)');g.fillStyle=gr;g.fillRect(0,0,128,128)});
    var glow=sprite(64,64,function(g){var gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(240,215,255,1)');gr.addColorStop(.35,'rgba(170,110,255,.7)');gr.addColorStop(1,'rgba(110,40,200,0)');g.fillStyle=gr;g.fillRect(0,0,64,64)});
    var blade=sprite(260,70,function(g){
      g.translate(10,35);g.shadowColor='rgba(170,110,255,.95)';g.shadowBlur=14;
      g.fillStyle='#d9ccf2';g.beginPath();g.arc(6,0,8,0,7);g.fill();                         // pommel
      g.fillStyle='#b26bff';g.beginPath();g.arc(6,0,3.5,0,7);g.fill();                       // gem
      g.fillStyle='#7b62a8';g.fillRect(12,-6,50,12);                                          // grip
      g.strokeStyle='#d9ccf2';g.lineWidth=2;for(var i=16;i<60;i+=8){g.beginPath();g.moveTo(i,-6);g.lineTo(i+5,6);g.stroke()}
      g.fillStyle='#e6dcf7';g.beginPath();g.moveTo(60,-19);g.quadraticCurveTo(70,-8,68,0);g.quadraticCurveTo(70,8,60,19);g.lineTo(75,0);g.closePath();g.fill(); // guard
      var bg=g.createLinearGradient(0,-12,0,12);bg.addColorStop(0,'#f2ecff');bg.addColorStop(.5,'#b6a8cf');bg.addColorStop(1,'#6e5f8c');
      g.fillStyle=bg;g.beginPath();g.moveTo(72,-11);g.lineTo(200,-4);g.lineTo(238,0);g.lineTo(200,4);g.lineTo(72,11);g.closePath();g.fill();
      g.shadowBlur=0;g.strokeStyle='rgba(120,70,200,.8)';g.lineWidth=1.5;g.beginPath();g.moveTo(78,0);g.lineTo(196,0);g.stroke();
    });
    var cxp=function(){return [W/2,H*.45]};
    for(var i=0;i<150;i++)motes.push({a:rnd(0,Math.PI*2),r:rnd(30,Math.max(W,H)*.62),w:rnd(.9,2.2),ph:rnd(0,6),sz:rnd(40,130),spark:Math.random()<.35});

    function fling(t,i){
      var tx=rnd(.15,.85)*W,ty=rnd(.22,.8)*H,side=i%4,sx,sy;
      if(side===0){sx=-120;sy=rnd(0,H)}else if(side===1){sx=W+120;sy=rnd(0,H)}else if(side===2){sx=rnd(0,W);sy=-120}else{sx=rnd(0,W);sy=H+120}
      daggers.push({sx:sx,sy:sy,tx:tx,ty:ty,born:t,fly:360,ang:Math.atan2(ty-sy,tx-sx),spin:Math.random()<.5?1:-1,poof:null,sc:rnd(.75,.9)*S});
    }
    function poof(t,d){
      d.poof=t;
      for(var i=0;i<22;i++){var a=rnd(0,Math.PI*2),v=rnd(30,160)*S;emit({x:d.tx,y:d.ty,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,drag:.95,age:0,life:rnd(700,1300),sz:rnd(40,90)*S,
        draw:function(p,k){cx.globalAlpha=(1-k)*.9;var s=p.sz*(.5+k);cx.drawImage(smoke,p.x-s/2,p.y-s/2,s,s);cx.globalAlpha=1}})}
      for(var j=0;j<14;j++){var b=rnd(0,Math.PI*2),u=rnd(60,260)*S;emit({x:d.tx,y:d.ty,vx:Math.cos(b)*u,vy:Math.sin(b)*u,drag:.93,age:0,life:rnd(400,800),
        draw:function(p,k){cx.globalCompositeOperation='lighter';cx.globalAlpha=1-k;cx.drawImage(glow,p.x-7,p.y-7,14,14);cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}})}
    }
    var plan=[];
    for(var k=0;k<7;k++)(function(k){plan.push({at:2000+k*430,fn:function(t){fling(t,k)}})})(k);
    for(var m=0;m<7;m++)(function(m){plan.push({at:5900+m*260,fn:function(t){poof(t,daggers[m])}})})(m);

    return {plan:plan,dim:'rgba(10,4,22,0.5)',draw:function(t,dt){
      /* the swirl: smoke and violet sparks orbiting a point, tightening then loosening */
      var c=cxp(),env=clamp(t/700,0,1)*(t<4800?1:clamp(1-(t-4800)/2600,.25,1));
      motes.forEach(function(m){
        var ang=m.a+t/1000*m.w*(1+60/m.r),rr=m.r*(.45+.55*Math.abs(Math.cos(t/2200+m.ph)));
        var x=c[0]+Math.cos(ang)*rr,y=c[1]+Math.sin(ang)*rr*.75;
        if(m.spark){cx.globalCompositeOperation='lighter';cx.globalAlpha=env*.85;cx.drawImage(glow,x-6,y-6,12,12);cx.globalCompositeOperation='source-over'}
        else{cx.globalAlpha=env*.75;var s=m.sz*S;cx.drawImage(smoke,x-s/2,y-s/2,s,s)}
      });
      cx.globalAlpha=1;
      /* spiral arms streaking inward */
      cx.save();cx.globalCompositeOperation='lighter';cx.lineCap='round';
      for(var arm=0;arm<5;arm++){
        var base=arm/5*Math.PI*2+t/650;cx.beginPath();
        for(var s=0;s<=40;s++){var u=s/40,rr2=(1-u)*Math.max(W,H)*.55+18*S,aa=base+u*3.4;var px=c[0]+Math.cos(aa)*rr2,py=c[1]+Math.sin(aa)*rr2*.75;s?cx.lineTo(px,py):cx.moveTo(px,py)}
        cx.strokeStyle='rgba(150,90,240,'+(.22*env)+')';cx.lineWidth=10*S;cx.stroke();
        cx.strokeStyle='rgba(215,180,255,'+(.35*env)+')';cx.lineWidth=2*S;cx.stroke();
      }
      cx.restore();
      if(t<5200){cx.globalCompositeOperation='lighter';var pulse=env*(.35+.15*Math.sin(t/180));cx.globalAlpha=pulse;var R=120*S;cx.drawImage(glow,c[0]-R,c[1]-R,R*2,R*2);cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}
      /* daggers */
      daggers.forEach(function(d){
        var age=t-d.born;if(age<0||d.poof&&t>d.poof)return;
        var p=age/d.fly,x,y,a;
        if(p<1){var e=easeOut(p);x=d.sx+(d.tx-d.sx)*e;y=d.sy+(d.ty-d.sy)*e;a=d.ang+d.spin*(1-e)*Math.PI*4;
          /* violet trail behind it */
          cx.globalCompositeOperation='lighter';for(var tr=1;tr<=6;tr++){var e2=easeOut(Math.max(0,p-tr*.05)),qx=d.sx+(d.tx-d.sx)*e2,qy=d.sy+(d.ty-d.sy)*e2,s2=(22-tr*2.5)*S;
            cx.globalAlpha=.5*(1-tr/7);cx.drawImage(glow,qx-s2/2,qy-s2/2,s2,s2)}cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}
        else{x=d.tx;y=d.ty;var q=age-d.fly;a=d.ang+(q<450?Math.sin(q/22)*.12*(1-q/450):0);
          if(!d.hit){d.hit=true;shake(5,160,t);for(var i=0;i<12;i++){var b=d.ang+Math.PI+rnd(-1,1),u=rnd(80,300)*S;emit({x:x,y:y,vx:Math.cos(b)*u,vy:Math.sin(b)*u,drag:.92,age:0,life:rnd(250,550),
            draw:function(pp,k){cx.globalCompositeOperation='lighter';cx.globalAlpha=1-k;cx.drawImage(glow,pp.x-5,pp.y-5,10,10);cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}})}}}
        cx.save();cx.translate(x,y);cx.rotate(a);cx.scale(d.sc,d.sc);cx.drawImage(blade,-248,-35);cx.restore();
      });
    }};
  }

  /* shared: expanding shockwave rings */
  function drawRings(rings,t){
    for(var i=rings.length-1;i>=0;i--){var r=rings[i],age=t-r.born;if(age<0)continue;if(age>r.life){rings.splice(i,1);continue}
      var k=age/r.life;cx.strokeStyle='rgba('+r.col+','+(1-k)*.8+')';cx.lineWidth=(1-k)*6*S+1;cx.beginPath();cx.arc(r.x,r.y,easeOut(k)*r.max,0,7);cx.stroke()}
  }

  /* ---------- run ---------- */
  var scenes={drax:drax,ensley:ensley,sinafey:sinafey};
  if(!scenes[theme])return;
  function start(){
    size();document.body.appendChild(cv);
    shakeEl=document.querySelector('.wrap')||document.body;
    var scene=scenes[theme](),plan=scene.plan.slice().sort(function(a,b){return a.at-b.at}),t0=null,last=0,fadeAt=FADE_AT,fadeLen=FADE_LEN;
    function skip(){var now=last;if(now<fadeAt){fadeAt=now;fadeLen=450}}
    addEventListener('pointerdown',skip,true);addEventListener('keydown',skip,true);addEventListener('resize',size);
    function frame(now){
      if(t0===null)t0=now;var t=now-t0,dt=Math.min(50,t-last);last=t;
      while(plan.length&&plan[0].at<=t)plan.shift().fn(t);
      var fk=t<fadeAt?1:clamp(1-(t-fadeAt)/fadeLen,0,1);
      cx.setTransform(DPR,0,0,DPR,0,0);cx.clearRect(0,0,W,H);
      cx.globalAlpha=fk;
      cx.fillStyle=scene.dim;cx.globalAlpha=fk*clamp(t/500,0,1);cx.fillRect(0,0,W,H);cx.globalAlpha=1;
      /* draw the scene at full strength, then fade the whole layer as one */
      scene.draw(t,dt,fk);drawParts(dt,t);
      if(fk<1){cx.globalCompositeOperation='destination-in';cx.fillStyle='rgba(0,0,0,'+fk+')';cx.fillRect(0,0,W,H);cx.globalCompositeOperation='source-over'}
      applyShake(t);
      if(fk>0)requestAnimationFrame(frame);
      else{cv.remove();if(shakeEl)shakeEl.style.transform='';removeEventListener('pointerdown',skip,true);removeEventListener('keydown',skip,true);removeEventListener('resize',size)}
    }
    requestAnimationFrame(frame);
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
