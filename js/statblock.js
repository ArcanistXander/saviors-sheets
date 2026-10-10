/* Saviors sheets: monster stat blocks, shared by the Bestiary and the Party Sheet's initiative tracker.
   SavStat.parse(text)       → an array of monsters from pasted Pathfinder stat blocks. Reads the Archives of Nethys / d20pfsrd
                               layout and the DM's own Word layout (name on its own line, then "CR 18 (XP 153,600) N Colossal
                               plant Init –1; …", several labels run together on one line, abilities like "Rider's Bond (Su).")
   SavStat.render(m, opts)   → the stat block as HTML (uses the page's --ink, --muted, --rule, --accent, --weak, --display tokens).
                               opts.hp: current HP to show; opts.track: {key: uses} turns every "N/day" into tick boxes and every
                               prepared spell into a button that crosses it off (the tracker keeps it per enemy).
   SavStat.docxText(buffer)  → Promise of the text in a Word .docx file.
   A monster is a flat object of strings, so every field stays editable by hand. `raw` keeps the text it was parsed from. */
(function(){
  'use strict';
  var FIELDS=['name','cr','xp','count','type','tags','init','perception','senses','aura','ac','touch','ff','acNote','hp','hpDice','hpNote',
    'fort','ref','will','saveNote','da','dr','immune','resist','sr','weak','speed','melee','ranged','space','specAtk','spells','spellNotes',
    'abilities','bab','cmb','cmd','feats','skills','languages','sq','gear','special','tactics','desc','notes','raw'];
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
  // Where a label can start partway along a line ("Fort +26, Ref +9, Will +14 Defensive Abilities …"), with what must follow it.
  var INLINE=[['Defensive Abilities','\\S'],['Special Attacks','\\S'],['Spell-Like Abilities','\\S'],['Base Atk','[+-]?\\d'],['Combat Gear','\\S'],
    ['Other Gear','\\S'],['Gear','[a-z+(]'],['hp','\\d'],['Fort','[+-]\\d'],['DR','\\d'],['SR','\\d'],['Immune','[a-z(]'],['Resist','[a-z]'],
    ['Weaknesses','\\S'],['Speed','\\d'],['Melee','\\S'],['Ranged','\\S'],['Space','\\d'],['Feats','[A-Z]'],['Skills','[A-Z]'],['Languages','[A-Z]'],
    ['SQ','\\S'],['Init','[+-]?\\d'],['Senses','\\S'],['Aura','\\S'],['Str','\\d']];
  var INLINE_RE=new RegExp('\\s(?=(?:'+INLINE.map(function(x){return x[0].replace(/ /g,'\\s')+'\\s+'+x[1]}).join('|')+'))','g');
  var SECTIONS=/^(DEFENSE|OFFENSE|TACTICS|STATISTICS|ECOLOGY|SPECIAL ABILITIES|DESCRIPTION)\b/;
  var SECTION_LINE=/^(defense|offense|tactics|statistics|ecology|special abilities|description)\s*$/i;
  var MULTI={spells:1,special:1,tactics:1,desc:1};
  var SPELLHEAD=/^([A-Z][\w' ]*\s)?(Spells (Known|Prepared)|Spell-Like Abilities)\b/;
  var SPELLLINE=/^(At will|Constant|\d+(st|nd|rd|th)?(\s*\(|\/|—|-|\s)|0\s*\(|\d+\/(day|week|month|year)|D Domain|S\s|Bloodline|Domain|Mystery|Patron|Opposition|Prohibited)/i;
  // A named ability on its own line: "Rider's Bond (Su). …", "Withering Flame (Weakness). …", "Hart-steed (mount, brief): …"
  var ABIL=/^[A-Z][A-Za-z'’\- ]{1,48}\s\((?:Ex|Su|Sp|Weakness)\b[^)]*\)\s*[.:]|^[A-Z][A-Za-z'’\- ]{1,48}\s\([^)]{1,40}\)\s*:/;
  var CRLINE=/^CR\s*([\d\/]+)\s*(?:\(\s*XP\s*([\d,]+)[^)]*\))?\s*(.*)$/i;

  function splitTop(line){   // split on ";" outside parentheses
    var out=[],d=0,s='';
    for(var i=0;i<line.length;i++){var c=line[i];if(c==='('||c==='[')d++;else if((c===')'||c===']')&&d>0)d--;
      if(c===';'&&d===0){out.push(s);s=''}else s+=c}
    out.push(s);return out.map(function(x){return x.trim()}).filter(Boolean);
  }
  // Break a stat line where another label starts partway along it (only outside parentheses).
  function splitInline(line){
    var cuts=[],m;INLINE_RE.lastIndex=0;
    while((m=INLINE_RE.exec(line))){var pre=line.slice(0,m.index),d=(pre.match(/[(\[]/g)||[]).length-(pre.match(/[)\]]/g)||[]).length;if(d<=0)cuts.push(m.index);INLINE_RE.lastIndex=m.index+1}
    if(!cuts.length)return [line];
    var out=[],from=0;cuts.forEach(function(c){out.push(line.slice(from,c).trim());from=c});out.push(line.slice(from).trim());
    return out.filter(Boolean);
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
  function isNameLine(l){return l.length<=90&&!/[.:;,]$/.test(l)&&!labelOf(l)&&!CRLINE.test(l)&&!SECTION_LINE.test(l)&&!SECTIONS.test(l)&&!ABIL.test(l)&&!/^(AC|XP)\s/.test(l)}
  // Split a paste holding several stat blocks: at each "Name CR n" line, or at the name line above a "CR n (XP …)" line.
  function chunks(text){
    var lines=norm(text).split('\n').filter(Boolean), starts=[];
    lines.forEach(function(l,i){
      if(/^\S.{0,80}\sCR\s*[\d\/]+\s*(\(MR\s*\d+\))?$/.test(l)&&!/^CR\s/i.test(l))starts.push(i);
      else if(CRLINE.test(l)){
        var s=i;for(var j=i-1;j>=0&&i-j<=4;j--){if(isNameLine(lines[j])){s=j;break}}
        starts.push(s);
      }
    });
    starts=starts.filter(function(s,k){return k===0||s>starts[k-1]});
    if(!starts.length)return [lines.join('\n')];
    starts[0]=0;   // anything before the first one goes with it
    return starts.map(function(s,k){return lines.slice(s,starts[k+1]).join('\n')});
  }
  function titleCase(s){
    if(s!==s.toUpperCase()||!/[A-Z]{2}/.test(s))return s;
    return s.toLowerCase().replace(/(^|[\s,(\-])([a-z])/g,function(a,b,c){return b+c.toUpperCase()}).replace(/\s(The|Of|And|In|A|An)\b/g,function(a){return a.toLowerCase()});
  }
  function parseOne(text){
    var m=blank(), lines=text.split('\n').filter(function(l){return l!==''}), sec='', last=null;
    m.raw=text;
    function put(k,v,sep){
      v=String(v||'').trim();if(!v){last=k;return}   // a label alone on its line: what follows belongs to it
      if(k==='gear'&&m.gear)sep='; ';
      m[k]=m[k]?m[k]+(sep||(MULTI[k]?'\n':' '))+v:v;last=k;
    }
    // heading: "Balor CR 20", or a name line (and maybe a description) above "CR 18 (XP 153,600) N Colossal plant Init -1; …"
    var h=lines.length&&lines[0].match(/^(.+?)\s+CR\s*([\d\/]+)\s*(?:\(MR\s*\d+\))?$/);
    if(h){m.name=h[1].trim();m.cr=h[2];lines.shift()}
    else if(lines.length&&isNameLine(lines[0])){
      m.name=lines.shift();
      var c=lines.findIndex(function(l){return CRLINE.test(l)});
      if(c>0&&c<=4&&lines.slice(0,c).every(function(l){return !labelOf(l)})){lines.splice(0,c).forEach(function(l){put('desc',l)});last=null}
    }
    if(lines.length&&CRLINE.test(lines[0])){
      var cr=lines.shift().match(CRLINE);m.cr=cr[1];m.xp=cr[2]||'';
      var rest=cr[3].trim(), at=rest.search(/(^|\s)Init\s/);
      if(at>=0){m.type=rest.slice(0,at).trim();lines.unshift(rest.slice(at).trim())}else if(rest)m.type=rest;
    }
    var cnt=m.name.match(/\s*,?\s*[×x]\s*(\d+)\s*$/);if(cnt){m.count=cnt[1];m.name=m.name.slice(0,cnt.index)}
    m.name=titleCase(m.name.trim());
    lines.forEach(function(l){
      var s=l.match(SECTIONS)||(SECTION_LINE.test(l)?[l,l.toUpperCase().trim()]:null);
      if(s){sec=s[1];last=null;var rest=l.slice(s[0].length).trim();if(rest&&sec==='SPECIAL ABILITIES')put('special',rest);return}
      if(sec==='SPECIAL ABILITIES'){put('special',l);return}
      if(sec==='TACTICS'){put('tactics',l);return}
      if(sec==='DESCRIPTION'){put('desc',l);return}
      if(sec==='ECOLOGY'&&!labelOf(l))return;
      if(ABIL.test(l)){sec='SPECIAL ABILITIES';put('special',l);return}
      if(/^(LG|NG|CG|LN|N|CN|LE|NE|CE|Any|Always|Usually|Often)\b.*\b(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)\b/.test(l)&&!labelOf(l)){m.type=m.type?m.type+' '+l:l;last='type';return}
      if(SPELLHEAD.test(l)&&!/^Spell-Like Abilities/.test(l)){put('spells',l,'\n');return}
      if(last==='spells'&&SPELLLINE.test(l)){put('spells',l,'\n');return}
      var pieces=labelOf(l)||/^AC\s/.test(l)?splitInline(l):[l];
      pieces.forEach(function(piece){
        var parts=splitTop(piece), first=labelOf(parts[0]);
        if(!first){if(last)put(last,piece);return}   // wrapped line: belongs to the field before it
        parts.forEach(function(p){
          var f=labelOf(p);
          if(!f){if(last)put(last,p,'; ');return}
          if(f.label==='Reach'){put('space','Reach '+f.v,'; ');return}
          if(f.k==='skills'&&f.label==='Racial Modifiers'){put('skills','Racial Modifiers '+f.v,'; ');return}
          if(f.k==='gear'&&f.label!=='Gear'){put('gear',f.label+' '+f.v);return}
          if(f.k==='spells'){put('spells','Spell-Like Abilities '+f.v,'\n');return}
          put(f.k,f.k==='abilities'?'Str '+f.v:f.v);
        });
      });
    });
    // pull numbers out of the lines that hold several
    var a=m.ac.match(/^(\d+)\s*,?\s*touch\s+(\d+)\s*,?\s*flat-?footed\s+(\d+)\s*(.*)$/i);
    if(a){m.ac=a[1];m.touch=a[2];m.ff=a[3];m.acNote=a[4].replace(/^[;,]\s*/,'').trim()}
    var hp=m.hp.match(/^(\d+)\s*(?:\(([^)]*)\))?\s*[;,]?\s*(.*)$/);
    if(hp){m.hp=hp[1];m.hpDice=hp[2]||'';m.hpNote=(hp[3]||'').replace(/\s+\d+$/,'')}
    var sv=m.fort.match(/^([+-]?\d+)\s*,\s*Ref\s+([+-]?\d+)\s*,\s*Will\s+([+-]?\d+)\s*(.*)$/i);
    if(sv){m.fort=sv[1];m.ref=sv[2];m.will=sv[3];m.saveNote=sv[4].replace(/^[;,]\s*/,'').trim()}
    m.init=(m.init.match(/[+-]?\d+/)||[m.init])[0];
    var pc=m.perception.match(/^([+-]?\d+)/);if(pc)m.perception=pc[1];
    ['bab','cmb','cmd','dr','sr','immune','resist','weak','da','speed','melee','ranged','specAtk','gear','feats','skills','sq','languages']
      .forEach(function(k){m[k]=m[k].replace(/[,;]\s*$/,'').trim()});
    var x=m.xp.match(/^[\d,]+/);if(x)m.xp=x[0];
    // one spell level or frequency per line: "Spell-Like Abilities (CL 15th) constant—nondetection; 3/day—mirror image, …"
    m.spells=m.spells.replace(/^((?:[A-Z][\w' ]*\s)?(?:Spells (?:Known|Prepared)|Spell-Like Abilities)\s*\([^)]*\))\s+(?=\S)/gm,'$1\n')
      .replace(/;\s*(?=(?:at will|constant|\d+\/(?:day|week|month|year)|\d+(?:st|nd|rd|th)(?:\s*\([^)]*\))?|0\s*\([^)]*\))\s*[—-])/gi,'\n');
    return m;
  }
  function parse(text){return chunks(text).map(parseOne).filter(function(m){return m.name&&(m.hp||m.ac||m.cr)})}

  /* ---- Word files: the text of word/document.xml, one paragraph per line ---- */
  function docxText(buf){
    var u=new Uint8Array(buf), dv=new DataView(buf), eocd=-1;
    for(var i=u.length-22;i>=Math.max(0,u.length-70000);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
    if(eocd<0)return Promise.reject(new Error('Not a Word file'));
    var n=dv.getUint16(eocd+10,true), p=dv.getUint32(eocd+16,true), hit=null;
    for(var k=0;k<n&&dv.getUint32(p,true)===0x02014b50;k++){
      var method=dv.getUint16(p+10,true), size=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), el=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), off=dv.getUint32(p+42,true);
      var name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));
      if(name==='word/document.xml'){hit={method:method,size:size,off:off};break}
      p+=46+nl+el+cl;
    }
    if(!hit)return Promise.reject(new Error('Not a Word file'));
    var start=hit.off+30+dv.getUint16(hit.off+26,true)+dv.getUint16(hit.off+28,true), data=u.subarray(start,start+hit.size);
    var xml=hit.method===0?Promise.resolve(new TextDecoder().decode(data))
      :new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    return xml.then(function(s){
      var doc=new DOMParser().parseFromString(s,'application/xml'), W='http://schemas.openxmlformats.org/wordprocessingml/2006/main', out=[];
      function walk(node){
        for(var c=node.firstChild;c;c=c.nextSibling){
          if(c.namespaceURI!==W){if(c.childNodes)walk(c);continue}
          if(c.localName==='p'){out.push(ptext(c))}
          else if(c.localName==='tbl'){[].forEach.call(c.getElementsByTagNameNS(W,'tr'),function(tr){
            out.push([].map.call(tr.getElementsByTagNameNS(W,'tc'),function(tc){return [].map.call(tc.getElementsByTagNameNS(W,'p'),ptext).join(' ')}).join(' ; '))})}
          else walk(c);
        }
      }
      function ptext(pn){var t='';(function rec(x){for(var c=x.firstChild;c;c=c.nextSibling){if(c.namespaceURI===W&&c.localName==='t')t+=c.textContent;
        else if(c.namespaceURI===W&&c.localName==='tab')t+=' ';else if(c.namespaceURI===W&&(c.localName==='br'||c.localName==='cr'))t+='\n';else if(c.childNodes&&c.childNodes.length)rec(c)}})(pn);return t}
      var body=doc.getElementsByTagNameNS(W,'body')[0];if(body)walk(body);
      return out.join('\n');
    });
  }

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
    '.sb-sec p{margin:0}.sb-sec b{font-weight:700}.sb-pre{white-space:pre-wrap}.sb-desc{color:var(--muted);font-style:italic}'+
    '.sb-def{color:var(--weak);font-weight:700}'+
    '.sb .sb-pips{display:inline-flex;gap:3px;vertical-align:middle;margin:0 4px}'+
    '.sb button.sb-pip{width:16px;height:16px;padding:0;border-radius:3px;border:2px solid var(--accent);background:transparent;cursor:pointer;min-width:0}'+
    '.sb button.sb-pip.on{background:var(--accent)}'+
    '.sb button.sb-spell{font:inherit;font-weight:inherit;color:inherit;background:none;border:0;border-radius:3px;padding:0 1px;cursor:pointer;text-decoration:underline dotted var(--muted);text-underline-offset:3px}'+
    '.sb button.sb-spell:hover{background:var(--accent-soft,rgba(0,0,0,.06))}'+
    '.sb button.sb-spell.cast{text-decoration:line-through;color:var(--muted)}'+
    '.sb button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}'+
    '.sb-spd{margin-top:6px;border:1px solid var(--rule);border-radius:6px;background:var(--panel,transparent)}'+
    '.sb-spd>summary{cursor:pointer;padding:6px 10px;font-weight:700;color:var(--accent)}'+
    '.sb-spd-l{display:grid;gap:0;padding:0 10px 8px}'+
    '.sb-spd-i{border-top:1px solid var(--rule)}.sb-spd-i>summary{cursor:pointer;padding:5px 0;list-style-position:inside}'+
    '.sb-spd-i .sb-lv{color:var(--muted);font-size:.82rem}.sb-spd-i p{margin:0 0 6px 18px;font-size:.9rem}'+
    '.sb summary:focus-visible{outline:2px solid var(--accent);outline-offset:1px}';
  function injectCss(){if(document.getElementById('sb-css'))return;var s=document.createElement('style');s.id='sb-css';s.textContent=CSS;document.head.appendChild(s)}
  function key(l,v,s){return v===''||v==null?'':'<div class="sb-k"><span class="l">'+l+'</span><span class="v">'+esc(v)+'</span>'+(s?'<span class="s">'+esc(s)+'</span>':'')+'</div>'}
  function render(m,opts){
    injectCss();opts=opts||{};m=m||{};
    var track=opts.track||null;
    function pips(k,n){
      var u=+(track[k]||0),h='<span class="sb-pips" role="group" aria-label="Uses">';
      for(var i=1;i<=n;i++)h+='<button type="button" class="sb-pip'+(i<=u?' on':'')+'" data-sbuse="'+esc(k)+'" data-n="'+i+'" aria-label="Use '+i+' of '+n+(i<=u?' (used)':'')+'" aria-pressed="'+(i<=u)+'"></button>';
      return h+'</span>';
    }
    // "3/day" → 3 tick boxes, keyed by field and place, so the tracker remembers them per enemy
    function T(v,f){
      if(!track)return esc(v);
      var s=String(v||''), out='', from=0, k=0, re=/(\d+)\s*\/\s*day/gi, x;
      while((x=re.exec(s))){out+=esc(s.slice(from,x.index+x[0].length));out+=pips(f+':'+(k++),Math.min(12,+x[1]));from=x.index+x[0].length}
      return out+esc(s.slice(from));
    }
    // prepared spells ("8th—horrid wilting, mind blank") become buttons that cross off when cast
    function spellsHtml(v){
      if(!v)return '';
      return '<p class="sb-pre">'+String(v).split('\n').map(function(l,i){
        var lv=track&&!/\/\s*day|at will/i.test(l)&&l.match(/^(\d(?:st|nd|rd|th)?(?:\s*\([^)]*\))?\s*[—-]\s*)(.+)$/);
        if(!lv)return T(l,'spells'+i);
        var names=[],d=0,cur='';for(var j=0;j<lv[2].length;j++){var c=lv[2][j];if(c==='(')d++;else if(c===')')d--;if(c===','&&d===0){names.push(cur);cur=''}else cur+=c}names.push(cur);
        return esc(lv[1])+names.map(function(nm,j){var k='cast'+i+':'+j,on=!!track[k];nm=nm.trim();
          return '<button type="button" class="sb-spell'+(on?' cast':'')+'" data-sbcast="'+k+'" aria-pressed="'+on+'" title="'+(on?'Cast. Click to undo':'Click when cast')+'">'+esc(nm)+'</button>'}).join(', ');
      }).join('\n')+'</p>';
    }
    // every spell in the block, each a dropdown with its description (js/spells.js, or the monster's own spell notes)
    function spellDescs(){
      var list=spellList(m.spells);if(!list.length||!window.SavSpells)return '';
      var open=opts.open||{}, own=SavSpells.notes(m.spellNotes), miss=0;
      var items=list.map(function(s){
        var f=SavSpells.find(s.name,own), k='spd:'+s.name.toLowerCase();if(!f)miss++;
        var nm=f&&!f.own?f.name:s.name.replace(/\s*\([^)]*\)/g,'').replace(/(^|\s)([a-z])/g,function(a,b,c){return b+c.toUpperCase()});
        return '<details class="sb-spd-i" data-sbd="'+esc(k)+'"'+(open[k]?' open':'')+'><summary><b>'+esc(nm)+'</b> <span class="sb-lv">'+esc(s.lv)+(f&&f.meta?' · '+esc(f.meta):'')+'</span></summary>'+
          '<p>'+(f?esc(f.desc):'<i>No description yet. Add one under “Your spell descriptions” when you edit this monster in the Bestiary.</i>')+'</p></details>';
      }).join('');
      return '<details class="sb-spd" data-sbd="spd"'+(open.spd?' open':'')+'><summary>Spell descriptions ('+list.length+(miss?', '+miss+' without one':'')+')</summary><div class="sb-spd-l">'+items+'</div></details>';
    }
    function line(l,v,f,cls){return v?'<p><b>'+l+'</b> <span'+(cls?' class="'+cls+'"':'')+'>'+T(v,f)+'</span></p>':''}
    function pre(v,f){return v?'<p class="sb-pre">'+T(v,f)+'</p>':''}
    function sec(t,body){return body?'<div class="sb-sec"><h4>'+t+'</h4>'+body+'</div>':''}
    var ac=m.ac&&(m.touch||m.ff)?'T '+(m.touch||'—')+' · FF '+(m.ff||'—'):'';
    var keys=opts.keys===false?'':'<div class="sb-keys">'+
      key('AC',m.ac,ac)+key('HP',opts.hp!=null?opts.hp+' / '+(m.hp||'?'):m.hp,m.hpDice)+key('Fort',sgn(m.fort))+key('Ref',sgn(m.ref))+key('Will',sgn(m.will))+
      key('Init',sgn(m.init))+key('Perception',sgn(m.perception))+key('CMD',m.cmd)+key('SR',m.sr)+'</div>';
    var def=[m.da&&'Defensive Abilities '+m.da,m.dr&&'DR '+m.dr,m.immune&&'Immune '+m.immune,m.resist&&'Resist '+m.resist,m.weak&&'Weaknesses '+m.weak].filter(Boolean);
    return '<div class="sb">'+
      '<div class="sb-top"><h3>'+esc(m.name||'Unnamed')+(m.count>1?' <span class="cr">×'+esc(m.count)+'</span>':'')+'</h3>'+(m.cr?'<span class="cr">CR '+esc(m.cr)+(m.xp?' · '+esc(m.xp)+' XP':'')+'</span>':'')+'</div>'+
      (m.type?'<div class="sb-type">'+esc(m.type)+'</div>':'')+keys+
      sec('Senses',line('Senses',m.senses,'senses')+line('Aura',m.aura,'aura'))+
      sec('Defense',(m.acNote?'<p><b>AC</b> '+esc(m.ac)+(ac?', touch '+esc(m.touch)+', flat-footed '+esc(m.ff):'')+' '+esc(m.acNote)+'</p>':'')+
        (m.hpNote?'<p><b>hp</b> '+esc(m.hp+(m.hpDice?' ('+m.hpDice+')':'')+'; '+m.hpNote)+'</p>':'')+
        (m.saveNote?'<p><b>Saves</b> '+esc('Fort '+sgn(m.fort)+', Ref '+sgn(m.ref)+', Will '+sgn(m.will)+' '+m.saveNote)+'</p>':'')+
        (def.length?'<p class="sb-def">'+T(def.join('; '),'def')+'</p>':''))+
      sec('Offense',line('Speed',m.speed,'speed')+line('Melee',m.melee,'melee')+line('Ranged',m.ranged,'ranged')+line('Space',m.space,'space')+line('Special Attacks',m.specAtk,'specAtk')+spellsHtml(m.spells)+spellDescs())+
      sec('Tactics',pre(m.tactics,'tactics'))+
      sec('Statistics',line('',m.abilities,'abil')+line('Base Atk',[m.bab,m.cmb&&'CMB '+m.cmb,m.cmd&&'CMD '+m.cmd].filter(Boolean).join('; '),'bab')+line('Feats',m.feats,'feats')+line('Skills',m.skills,'skills')+line('Languages',m.languages,'lang')+line('SQ',m.sq,'sq')+line('Gear',m.gear,'gear'))+
      sec('Special abilities',pre(m.special,'special'))+
      sec('Description',m.desc?'<p class="sb-pre sb-desc">'+esc(m.desc)+'</p>':'')+
      sec('DM notes',pre(m.notes,'notes'))+
      '</div>';
  }
  // The spells named in a spells field, with their level or frequency: "9th—meteor swarm, time stop" → 2 spells at "9th".
  var SPLHEAD=/^((?:\d+(?:st|nd|rd|th)?|at will|constant|\d+\s*\/\s*\w+)(?:\s*\([^)]*\))?)\s*[—-]\s*(.+)$/i;
  function spellList(v){
    var out=[], seen={};
    String(v||'').split('\n').forEach(function(l){
      var m=l.trim().match(SPLHEAD);if(!m)return;
      var names=[],d=0,cur='';for(var j=0;j<m[2].length;j++){var c=m[2][j];if(c==='(')d++;else if(c===')')d--;if(c===','&&d===0){names.push(cur);cur=''}else cur+=c}names.push(cur);
      names.forEach(function(n){n=n.trim().replace(/[.;]$/,'');var k=n.toLowerCase().replace(/\s*\([^)]*\)/g,'');if(!n||seen[k])return;seen[k]=1;out.push({name:n,lv:m[1].trim()})});
    });
    return out;
  }
  // CR as a number for sorting ("1/2" → 0.5)
  function crNum(cr){var s=String(cr||'').trim(),f=s.match(/^(\d+)\/(\d+)$/);if(f)return +f[1]/+f[2];var n=parseFloat(s);return isNaN(n)?-1:n}

  window.SavStat={FIELDS:FIELDS,blank:blank,newId:newId,parse:parse,render:render,docxText:docxText,crNum:crNum,sgn:sgn,esc:esc};
})();
