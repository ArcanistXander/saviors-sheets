/* Opening flourish for each character sheet: a ~5 s canvas overlay played once per page load.
   <script src="js/intro.js" data-intro="drax|ensley|sinafey"></script>
   The canvas ignores the pointer, so the sheet stays usable underneath; any click or key fades it out early. */
(function(){
  'use strict';
  var theme=(document.currentScript&&document.currentScript.dataset.intro)||'';
  if(!theme)return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;

  var FADE_AT=4100, FADE_LEN=900;   // about 5 seconds in all
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
    /* a clenched fist seen knuckles-first, as if punched into the page */
    var hand=sprite(200,240,function(g){
      g.translate(100,140);
      function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();g.fill()}
      var fingers=[[-44,-50],[-22,-58],[0,-56],[22,-46]];   // [left x, knuckle top]
      function shape(){
        rr(-38,4,76,58,20);                                               // heel of the hand
        fingers.forEach(function(f){rr(f[0],f[1],22,66,11)});             // curled fingers, knuckles on top
        g.save();g.translate(-50,26);g.rotate(-.18);rr(0,-11,66,22,11);g.restore();   // thumb folded across
      }
      g.shadowColor='rgba(110,180,255,1)';g.shadowBlur=28;g.fillStyle='rgba(120,190,255,.9)';shape();
      g.shadowBlur=0;var gr=g.createRadialGradient(0,-10,4,0,0,95);gr.addColorStop(0,'rgba(255,255,255,.97)');gr.addColorStop(.5,'rgba(195,228,255,.88)');gr.addColorStop(1,'rgba(90,150,255,.75)');
      g.fillStyle=gr;shape();
      /* creases: gaps between fingers, the knuckle joints, and the thumb's edge */
      g.globalCompositeOperation='destination-out';g.strokeStyle='#000';g.lineCap='round';g.lineWidth=3;
      [-22,0,22].forEach(function(x){g.beginPath();g.moveTo(x,-44);g.lineTo(x,12);g.stroke()});
      fingers.forEach(function(f){g.beginPath();g.moveTo(f[0]+5,f[1]+26);g.quadraticCurveTo(f[0]+11,f[1]+30,f[0]+17,f[1]+26);g.stroke()});
      g.save();g.translate(-50,26);g.rotate(-.18);g.lineWidth=2.5;g.beginPath();g.moveTo(4,-11);g.lineTo(62,-11);g.stroke();g.restore();
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
    [150,650,1150,1700,2300,2900,3500].forEach(function(at,i){plan.push({at:at,fn:function(t){strike(t,null,null,i===0||i===3)}})});
    [400,650,900,1150,1750,2150,2550,3050].forEach(function(at,i){plan.push({at:at,fn:function(t){palm(t,i)}})});

    return {plan:plan,dim:'rgba(6,10,28,0.42)',draw:function(t,dt){
      /* palm prints: slam in, crackle, fade */
      palms.forEach(function(p){
        var age=t-p.born;if(age<0)return;var life=2400;if(age>life)return;
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
     ENSLEY — pixie druid: vines climbing the sheet
     ===================================================================== */
  function ensley(){
    var vines=[];
    var leafCols=['#2f7a34','#3f9440','#58ad4a','#6fc15a'];
    function makeVine(i,n){
      var side=i%4, x,y,ang;
      if(side===3&&i%8===3){x=-10;y=rnd(.45,.95)*H;ang=-.55}else if(side===2&&i%8===6){x=W+10;y=rnd(.45,.95)*H;ang=-Math.PI+.55}
      else{x=(i+.5)/n*W+rnd(-.04,.04)*W;y=H+10;ang=-Math.PI/2+rnd(-.25,.25)}
      var pts=[[x,y]],step=13*S,len=rnd(.55,.95)*H/step,sway=rnd(.6,1.4),ph=rnd(0,6);
      for(var k=0;k<len;k++){ang+=Math.sin(k*.18*sway+ph)*.07+rnd(-.05,.05);ang=clamp(ang,-Math.PI+.25,-.25);x+=Math.cos(ang)*step;y+=Math.sin(ang)*step;pts.push([x,y])}
      var leaves=[],flowers=[];
      for(var j=4;j<pts.length-1;j+=rnd(3,5)|0){leaves.push({i:j,side:leaves.length%2?1:-1,size:rnd(.8,1.25),col:leafCols[(Math.random()*leafCols.length)|0]});if(Math.random()<.12)flowers.push({i:j,col:Math.random()<.5?'#f6c2df':'#fff4c2'})}
      return {pts:pts,leaves:leaves,flowers:flowers,start:60+i*70,grow:rnd(1600,2200),w:rnd(6,10)*S,curl:Math.random()<.6};
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

    return {plan:[],dim:'rgba(8,22,10,0.38)',draw:function(t){
      vines.forEach(function(v){drawVine(v,t,1)});
    }};
  }

  /* =====================================================================
     SINAFEY — shadowdancer: three daggers thrown into the sheet, then a shadowy hand
     pulls each one out and both dissolve in a plume of shadow smoke
     ===================================================================== */
  function sinafey(){
    var daggers=[];
    var smoke=sprite(128,128,function(g){var gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(16,6,30,.85)');gr.addColorStop(.45,'rgba(58,24,104,.45)');gr.addColorStop(1,'rgba(10,4,20,0)');g.fillStyle=gr;g.fillRect(0,0,128,128)});
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
    var GRIP=-201;   // grip centre, in sprite units back from the tip
    var REACH=340,CLOSE=150,PULL=380;

    function fling(t,i){
      /* thrown downward from above, so the hilt, the pull and the smoke all stay on screen */
      var tx=[.6,.4,.6][i]*W+rnd(-.05,.05)*W,ty=[.4,.57,.76][i]*H+rnd(-.04,.04)*H,sx,sy;
      if(i===0){sx=-140;sy=rnd(-.15,.1)*H}else if(i===1){sx=W+140;sy=rnd(-.15,.15)*H}else{sx=rnd(.35,.6)*W;sy=-140}
      daggers.push({tx:tx,ty:ty,sx:sx,sy:sy,born:t,fly:380,ang:Math.atan2(ty-sy,tx-sx),spin:Math.random()<.5?1:-1,sc:rnd(.8,.95)*S,hand:null,gone:false});
    }
    function pullOut(t,d){if(d)d.hand={born:t,side:Math.random()<.5?1:-1}}
    var plumeSmoke=sprite(128,128,function(g){var gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(150,95,235,.75)');gr.addColorStop(.35,'rgba(85,40,150,.6)');gr.addColorStop(.7,'rgba(30,10,55,.35)');gr.addColorStop(1,'rgba(10,4,20,0)');g.fillStyle=gr;g.fillRect(0,0,128,128)});
    function plume(x,y){
      emit({x:x,y:y,vx:0,vy:0,age:0,life:450,draw:function(p,k){cx.globalCompositeOperation='lighter';cx.globalAlpha=(1-k)*.9;var s=(70+120*k)*S;cx.drawImage(glow,p.x-s/2,p.y-s/2,s,s);cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}});
      for(var i=0;i<48;i++){var a=rnd(-Math.PI*.9,-Math.PI*.1),v=rnd(50,230)*S,dark=i%3===0;emit({x:x+rnd(-14,14)*S,y:y+rnd(-10,10)*S,vx:Math.cos(a)*v*.55,vy:Math.sin(a)*v,drag:.96,age:0,life:rnd(800,1300),sz:rnd(50,110)*S,dark:dark,
        draw:function(p,k){cx.globalAlpha=Math.min(1,(1-k)*1.4);var s=p.sz*(.5+k*1.6);cx.drawImage(p.dark?smoke:plumeSmoke,p.x-s/2,p.y-s/2,s,s);cx.globalAlpha=1}})}
      for(var j=0;j<14;j++){var b=rnd(0,Math.PI*2),u=rnd(50,220)*S;emit({x:x,y:y,vx:Math.cos(b)*u,vy:Math.sin(b)*u-40,drag:.93,age:0,life:rnd(400,900),
        draw:function(p,k){cx.globalCompositeOperation='lighter';cx.globalAlpha=1-k;cx.drawImage(glow,p.x-6,p.y-6,12,12);cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}})}
    }

    /* A hand of living shadow, fingers along +x, trailing a wisp of an arm back along -x. curl 0 = open, 1 = gripping. */
    function shadowHand(x,y,ang,curl,alpha,s,t){
      cx.save();cx.translate(x,y);cx.rotate(ang);cx.scale(s,s);cx.globalAlpha=alpha;
      cx.shadowColor='rgba(150,90,255,.95)';cx.shadowBlur=16;cx.fillStyle='#120a1e';cx.strokeStyle='#120a1e';
      cx.beginPath();cx.ellipse(2,0,22,21,0,0,7);cx.fill();
      cx.beginPath();cx.moveTo(-16,-14);cx.quadraticCurveTo(-30,0,-16,14);cx.lineTo(-6,10);cx.lineTo(-6,-10);cx.closePath();cx.fill();   // heel of the hand, no arm
      cx.lineCap='round';cx.lineJoin='round';
      [[-15,30,9],[-5,36,10],[5,34,10],[15,26,8]].forEach(function(f){
        var l1=f[1]*.55,l2=f[1]*.45,s1=curl*.95,s2=curl*2.4;
        var x1=16+Math.cos(s1)*l1,y1=f[0]+Math.sin(s1)*l1;
        cx.lineWidth=f[2];cx.beginPath();cx.moveTo(14,f[0]);cx.lineTo(x1,y1);cx.lineTo(x1+Math.cos(s2)*l2,y1+Math.sin(s2)*l2);cx.stroke();
      });
      var ta=-1.05+curl*1.5;cx.lineWidth=10;cx.beginPath();cx.moveTo(6,-14);cx.lineTo(6+Math.cos(ta)*24,-14+Math.sin(ta)*24);cx.stroke();
      cx.restore();
    }

    var plan=[];
    [250,600,950].forEach(function(at,i){plan.push({at:at,fn:function(t){fling(t,i)}})});
    [1550,2150,2750].forEach(function(at,i){plan.push({at:at,fn:function(t){pullOut(t,daggers[i])}})});

    return {plan:plan,dim:'rgba(10,4,22,0.45)',draw:function(t){
      daggers.forEach(function(d){
        if(d.gone)return;
        var age=t-d.born;if(age<0)return;
        var p=age/d.fly,x,y,a,dx=Math.cos(d.ang),dy=Math.sin(d.ang);
        if(p<1){var e=easeOut(p);x=d.sx+(d.tx-d.sx)*e;y=d.sy+(d.ty-d.sy)*e;a=d.ang+d.spin*(1-e)*Math.PI*4;
          cx.globalCompositeOperation='lighter';for(var tr=1;tr<=6;tr++){var e2=easeOut(Math.max(0,p-tr*.05)),qx=d.sx+(d.tx-d.sx)*e2,qy=d.sy+(d.ty-d.sy)*e2,s2=(22-tr*2.5)*S;
            cx.globalAlpha=.5*(1-tr/7);cx.drawImage(glow,qx-s2/2,qy-s2/2,s2,s2)}cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}
        else{x=d.tx;y=d.ty;var q=age-d.fly;a=d.ang+(q<450?Math.sin(q/22)*.12*(1-q/450):0);
          if(!d.hit){d.hit=true;shake(4,150,t);for(var i=0;i<12;i++){var b=d.ang+Math.PI+rnd(-1,1),u=rnd(80,300)*S;emit({x:x,y:y,vx:Math.cos(b)*u,vy:Math.sin(b)*u,drag:.92,age:0,life:rnd(250,550),
            draw:function(pp,k){cx.globalCompositeOperation='lighter';cx.globalAlpha=1-k;cx.drawImage(glow,pp.x-5,pp.y-5,10,10);cx.globalAlpha=1;cx.globalCompositeOperation='source-over'}})}}}
        /* the shadow hand: reach in from the side, close on the grip, draw the blade back out */
        var H2=d.hand,h=H2?t-H2.born:-1,pull=0,curl=0;
        if(h>=REACH+CLOSE){var pp=clamp((h-REACH-CLOSE)/PULL,0,1);pull=pp*pp*100*S;a=d.ang+Math.sin(h/40)*.04*(1-pp)}
        x-=dx*pull;y-=dy*pull;
        if(H2&&h>=REACH+CLOSE+PULL){d.gone=true;shake(3,140,t);plume(x+dx*GRIP*d.sc,y+dy*GRIP*d.sc);return}
        cx.save();cx.translate(x,y);cx.rotate(a);cx.scale(d.sc,d.sc);cx.drawImage(blade,-248,-35);cx.restore();
        if(H2&&h>=0){
          var px=-dy*H2.side,py=dx*H2.side,gx=x+Math.cos(a)*GRIP*d.sc,gy=y+Math.sin(a)*GRIP*d.sc,off=(1-easeOut(h/REACH))*190*S;
          curl=clamp((h-REACH)/CLOSE,0,1);
          shadowHand(gx+px*off,gy+py*off,Math.atan2(-py,-px),curl,clamp(h/260,0,1),1.35*S,t);
        }
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
    var scene=scenes[theme](),plan=scene.plan.slice().sort(function(a,b){return a.at-b.at}),t0=null,last=0,fadeAt=scene.fadeAt||FADE_AT,fadeLen=FADE_LEN;
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
