/* Saviors sheets: monster stat blocks, shared by the Bestiary and the Party Sheet's initiative tracker.
   SavStat.parse(text)  → an array of monsters from pasted Pathfinder stat blocks (Archives of Nethys / d20pfsrd layout)
   SavStat.render(m)    → the stat block as HTML (uses the page's --ink, --muted, --rule, --accent, --weak, --display tokens)
   SavStat.blank()      → an empty monster
   A monster is a flat object of strings, so every field stays editable by hand. `raw` keeps the text it was parsed from. */
(function(){
  'use strict';
  var FIELDS=['name','cr','xp','type','tags','init','perception','senses','aura','ac','touch','ff','acNote','hp','hpDice','hpNote',
    'fort','ref','will','saveNote','da','dr','immune','resist','sr','weak','speed','melee','ranged','space','specAtk','spells',
    'abilities','bab','cmb','cmd','feats','skills','languages','sq','gear','tactics','special','notes','raw'];
  function blank(){var m={};FIELDS.forEach(function(k){m[k]=''});m.id=newId();return m}
  function newId(){return 'm'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function sgn(v){var s=String(v==null?'':v).trim();if(s==='')return '';return /^[+-]/.test(s)?s:(/^\d/.test(s)?'+'+s:s)}

  /* ---- parsing ---- */
  // Labels that start a field. Order matters where one label is a prefix of another.
  var LABELS=[
    ['Defensive Abilities','da'],['Special Attacks','specAtk'],['Spell-Like Abilities','spells'],['Base Atk','bab'],
    ['Combat Gear','gear'],['Other Gear','gear'],['Gear','gear'],['Racial Modifiers','skills'],['Init','init'],['Senses','senses'],
    ['Perception','perception'],['Aura','aura'],['AC','ac'],['hp','hp'],['Fort','fort'],['DR','dr'],['Immune','immune'],
    ['Resist','resist'],['SR','sr'],['Weaknesses','weak'],['Weakness','weak'],['Speed','speed'],['Melee','melee'],['Ranged','ranged'],
    ['Space','space'],['Reach','space'],['Str','abilities'],['CMB','cmb'],['CMD','cmd'],['Feats','feats'],['Skills','skills'],
    ['Languages','languages'],['SQ','sq'],['XP','xp']];
  var SECTIONS=/^(DEFENSE|OFFENSE|TACTICS|STATISTICS|ECOLOGY|SPECIAL ABILITIES|DESCRIPTION)\b/;
  var MULTI={spells:1,special:1,tactics:1};
  // "… Spells Known (CL 12th)", "Spells Prepared", "Sorcerer Spells Known", "Domain spell-like abilities"
  var SPELLHEAD=/^([A-Z][\w' ]*\s)?(Spells (Known|Prepared)|Spell-Like Abilities|Spells)\b/i;
  var SPELLLINE=/^(At will|Constant|\d+(st|nd|rd|th)?(\s*\(|\/|—|-|\s)|0\s*\(|\d+\/day|\d+\/week|\d+\/month|D Domain|S\s|Bloodline|Domain|Mystery|Patron|Opposition|Prohibited)/i;

  function splitTop(line){   // split on ";" outside parentheses
    var out=[],d=0,s='';
    for(var i=0;i<line.length;i++){var c=line[i];if(c==='('||c==='[')d++;else if((c===')'||c===']')&&d>0)d--;
      if(c===';'&&d===0){out.push(s);s=''}else s+=c}
    out.push(s);return out.map(function(x){return x.trim()}).filter(Boolean);
  }
  function labelOf(part){
    for(var i=0;i<LABELS.length;i++){var L=LABELS[i][0];
      if(part.slice(0,L.length)===L&&(part.length===L.length||/[\s:]/.test(part[L.length])))return {k:LABELS[i][1],label:L,v:part.slice(L.length).replace(/^[:\s]+/,'')};
    }
    return null;
  }
  function norm(t){
    return String(t||'').replace(/\r/g,'').replace(/[‒–−]/g,'-').replace(/ /g,' ').replace(/[ \t]+/g,' ')
      .split('\n').map(function(l){return l.trim()}).join('\n');
  }
  // Split a paste holding several stat blocks at each "Name CR n" heading.
  function chunks(text){
    var lines=norm(text).split('\n'), out=[], cur=[];
    lines.forEach(function(l){
      if(/^\S.{0,80}\sCR\s*[\d\/]+\s*(\(MR\s*\d+\))?$/.test(l)&&cur.some(function(x){return /\bhp\s+\d/.test(x)})){out.push(cur);cur=[]}
      cur.push(l);
    });
    out.push(cur);
    return out.map(function(c){return c.join('\n').trim()}).filter(Boolean);
  }
  function parseOne(text){
    var m=blank(), lines=text.split('\n').filter(function(l){return l!==''}), sec='', last=null;
    m.raw=text;
    function put(k,v,sep){
      v=String(v||'').trim();if(!v)return;
      if(k==='gear'&&m.gear)sep='; ';
      m[k]=m[k]?m[k]+(sep||(MULTI[k]?'\n':' '))+v:v;last=k;
    }
    // heading: "Balor CR 20" or just a name on the first line
    var h=lines.length&&lines[0].match(/^(.+?)\s+CR\s*([\d\/]+)/);
    if(h){m.name=h[1].trim();m.cr=h[2];lines.shift()}
    else if(lines.length&&!labelOf(lines[0])&&!SECTIONS.test(lines[0])){m.name=lines.shift()}
    lines.forEach(function(l){
      var s=l.match(SECTIONS);
      if(s){sec=s[1];last=null;var rest=l.slice(s[0].length).trim();if(rest&&sec==='SPECIAL ABILITIES')put('special',rest);return}
      if(sec==='SPECIAL ABILITIES'){put('special',l);return}
      if(sec==='TACTICS'){put('tactics',l);return}
      if(sec==='ECOLOGY'||sec==='DESCRIPTION'){var e=labelOf(l);if(!e)return;}
      if(/^(LG|NG|CG|LN|N|CN|LE|NE|CE|Any|Always|Usually|Often)\b.*\b(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)\b/.test(l)){m.type=m.type?m.type+' '+l:l;last='type';return}
      if(SPELLHEAD.test(l)&&!labelOf(l)||/^Spell-Like Abilities/.test(l)){put('spells',l,'\n');return}
      if(last==='spells'&&SPELLLINE.test(l)){put('spells',l,'\n');return}
      var parts=splitTop(l), first=labelOf(parts[0]);
      if(!first){if(last)put(last,l);return}   // wrapped line: belongs to the field before it
      parts.forEach(function(p){
        var f=labelOf(p);
        if(!f){if(last)put(last,p,'; ');return}
        if(f.label==='Reach'){put('space','Reach '+f.v,'; ');return}
        if(f.k==='skills'&&f.label==='Racial Modifiers'){put('skills','Racial Modifiers '+f.v,'; ');return}
        if(f.k==='gear'&&f.label!=='Gear'){put('gear',f.label+' '+f.v);return}
        put(f.k,f.k==='abilities'?'Str '+f.v:f.v);
      });
    });
    // pull numbers out of the lines that hold several
    var a=m.ac.match(/^(\d+)\s*,?\s*touch\s+(\d+)\s*,?\s*flat-?footed\s+(\d+)\s*(.*)$/i);
    if(a){m.ac=a[1];m.touch=a[2];m.ff=a[3];m.acNote=a[4].replace(/^[;,]\s*/,'').trim()}
    var hp=m.hp.match(/^(\d+)\s*(?:\(([^)]*)\))?\s*[;,]?\s*(.*)$/);
    if(hp){m.hp=hp[1];m.hpDice=hp[2]||'';m.hpNote=hp[3]||''}
    var sv=m.fort.match(/^([+-]?\d+)\s*,\s*Ref\s+([+-]?\d+)\s*,\s*Will\s+([+-]?\d+)\s*(.*)$/i);
    if(sv){m.fort=sv[1];m.ref=sv[2];m.will=sv[3];m.saveNote=sv[4].replace(/^[;,]\s*/,'').trim()}
    m.init=(m.init.match(/[+-]?\d+/)||[m.init])[0];
    var pc=m.perception.match(/^([+-]?\d+)/);if(pc)m.perception=pc[1];
    var sr=m.sr.match(/^(\d+)/);if(sr&&m.sr===sr[1])m.sr=sr[1];
    m.bab=m.bab.replace(/[,;]\s*$/,'');m.cmb=m.cmb.replace(/[,;]\s*$/,'');m.cmd=m.cmd.replace(/[,;]\s*$/,'');
    var x=m.xp.match(/^[\d,]+/);if(x)m.xp=x[0];
    return m;
  }
  function parse(text){return chunks(text).map(parseOne).filter(function(m){return m.name||m.hp||m.ac})}

  /* ---- display ---- */
  var CSS='.sb{display:grid;gap:10px;font-size:.95rem;line-height:1.4}'+
    '.sb-top{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;border-bottom:2px solid var(--weak);padding-bottom:4px}'+
    '.sb-top h3{margin:0;font-family:var(--display);font-size:1.5rem;line-height:1.1}.sb-top .cr{font-family:var(--display);font-size:1.15rem;color:var(--weak);white-space:nowrap}'+
    '.sb-type{color:var(--muted);font-style:italic;margin-top:-6px}'+
    '.sb-keys{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}'+
    '.sb-k{background:var(--bg);border:1px solid var(--rule);border-radius:6px;padding:5px 8px;display:grid;gap:0;align-content:start}'+
    '.sb-k .l{font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}'+
    '.sb-k .v{font-family:var(--display);font-size:1.3rem;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}'+
    '.sb-k .s{font-size:.78rem;color:var(--muted);font-variant-numeric:tabular-nums}'+
    '.sb-sec{display:grid;gap:2px}.sb-sec h4{margin:4px 0 2px;font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--weak);border-bottom:1px solid var(--rule);padding-bottom:2px}'+
    '.sb-sec p{margin:0}.sb-sec b{font-weight:700}.sb-pre{white-space:pre-wrap}'+
    '.sb-def{color:var(--weak);font-weight:700}';
  function injectCss(){if(document.getElementById('sb-css'))return;var s=document.createElement('style');s.id='sb-css';s.textContent=CSS;document.head.appendChild(s)}
  function key(l,v,s){return v===''||v==null?'':'<div class="sb-k"><span class="l">'+l+'</span><span class="v">'+esc(v)+'</span>'+(s?'<span class="s">'+esc(s)+'</span>':'')+'</div>'}
  function line(l,v,cls){return v?'<p><b>'+l+'</b> <span'+(cls?' class="'+cls+'"':'')+'>'+esc(v)+'</span></p>':''}
  function pre(l,v){return v?'<p class="sb-pre">'+(l?'<b>'+l+'</b> ':'')+esc(v)+'</p>':''}
  function sec(t,body){return body?'<div class="sb-sec"><h4>'+t+'</h4>'+body+'</div>':''}
  // opts.hp: current HP to show in place of max (the tracker passes it); opts.keys:false hides the number tiles.
  function render(m,opts){
    injectCss();opts=opts||{};m=m||{};
    var ac=m.ac?(m.touch||m.ff?'T '+(m.touch||'—')+' · FF '+(m.ff||'—'):''):'';
    var keys=opts.keys===false?'':'<div class="sb-keys">'+
      key('AC',m.ac,ac)+key('HP',opts.hp!=null?opts.hp+' / '+(m.hp||'?'):m.hp,m.hpDice)+key('Fort',sgn(m.fort))+key('Ref',sgn(m.ref))+key('Will',sgn(m.will))+
      key('Init',sgn(m.init))+key('Perception',sgn(m.perception))+key('CMD',m.cmd)+key('SR',m.sr)+'</div>';
    var def=[m.da&&'Defensive Abilities '+m.da,m.dr&&'DR '+m.dr,m.immune&&'Immune '+m.immune,m.resist&&'Resist '+m.resist,m.weak&&'Weaknesses '+m.weak].filter(Boolean);
    return '<div class="sb">'+
      '<div class="sb-top"><h3>'+esc(m.name||'Unnamed')+'</h3>'+(m.cr?'<span class="cr">CR '+esc(m.cr)+(m.xp?' · '+esc(m.xp)+' XP':'')+'</span>':'')+'</div>'+
      (m.type?'<div class="sb-type">'+esc(m.type)+'</div>':'')+keys+
      sec('Senses',line('Senses',m.senses)+line('Aura',m.aura))+
      sec('Defense',(m.acNote?'<p><b>AC</b> '+esc(m.ac)+(ac?', '+esc(ac.replace('T ','touch ').replace(' · FF ',', flat-footed '))+' ':'')+esc(m.acNote)+'</p>':'')+
        line('hp',(m.hpNote?m.hp+(m.hpDice?' ('+m.hpDice+')':'')+'; '+m.hpNote:''))+line('Saves',m.saveNote?'Fort '+sgn(m.fort)+', Ref '+sgn(m.ref)+', Will '+sgn(m.will)+'; '+m.saveNote:'')+
        (def.length?'<p class="sb-def">'+esc(def.join('; '))+'</p>':''))+
      sec('Offense',line('Speed',m.speed)+line('Melee',m.melee)+line('Ranged',m.ranged)+line('Space',m.space)+line('Special Attacks',m.specAtk)+pre('',m.spells))+
      sec('Tactics',pre('',m.tactics))+
      sec('Statistics',line('',m.abilities)+line('Base Atk',[m.bab,m.cmb&&'CMB '+m.cmb,m.cmd&&'CMD '+m.cmd].filter(Boolean).join('; '))+line('Feats',m.feats)+line('Skills',m.skills)+line('Languages',m.languages)+line('SQ',m.sq)+line('Gear',m.gear))+
      sec('Special abilities',pre('',m.special))+
      sec('DM notes',pre('',m.notes))+
      '</div>';
  }
  // CR as a number for sorting ("1/2" → 0.5)
  function crNum(cr){var s=String(cr||'').trim(),f=s.match(/^(\d+)\/(\d+)$/);if(f)return +f[1]/+f[2];var n=parseFloat(s);return isNaN(n)?-1:n}

  window.SavStat={FIELDS:FIELDS,blank:blank,newId:newId,parse:parse,render:render,crNum:crNum,sgn:sgn,esc:esc};
})();
