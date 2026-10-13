/* What each class (and archetype) gains at each level, for the level-up window.
   Every entry was taken from the class and archetype pages on d20pfsrd.com (checked 2026-10-12/13):
   the "Special" column of each class table, the spells-per-day tables, and the class feature text,
   summarised in plain words. gains(cls, arch, L) lists what a character gets on reaching class level L. */
(function(){
  'use strict';
  const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
  const sp=(...v)=>v;   // spells per day by spell level, from the class table (— = none)

  /* ---------- Warpriest (Advanced Class Guide) ---------- */
  const WARPRIEST={
    table:{1:'Aura, blessings (minor), focus weapon, orisons, sacred weapon',2:'Fervor 1d6',3:'Bonus feat',4:'Channel energy, sacred weapon +1',5:'Fervor 2d6',6:'Bonus feat',7:'Sacred armor +1',8:'Fervor 3d6, sacred weapon +2',9:'Bonus feat',10:'Blessings (major), sacred armor +2',11:'Fervor 4d6',12:'Bonus feat, sacred weapon +3',13:'Sacred armor +3',14:'Fervor 5d6',15:'Bonus feat',16:'Sacred armor +4, sacred weapon +4',17:'Fervor 6d6',18:'Bonus feat',19:'Sacred armor +5',20:'Aspect of war, fervor 7d6, sacred weapon +5'},
    spells:{17:sp(5,5,5,5,4,4,2),18:sp(5,5,5,5,5,4,3),19:sp(5,5,5,5,5,5,4),20:sp(5,5,5,5,5,5,5)},spellFrom:0,
    feats:{
      fervor:L=>({name:`Fervor ${Math.min(7,1+Math.floor((L-2)/3))}d6`,text:`Fervor now heals (or harms undead) ${Math.min(7,1+Math.floor((L-2)/3))}d6. Uses per day: ½ warpriest level + Wis modifier. A swift action on themselves, a standard action by touch on someone else; or spend a use to cast a warpriest spell on themselves as a swift action.`}),
      bonus:()=>({name:'Bonus combat feat',text:'Choose a combat feat. Their warpriest level counts as their base attack bonus, and as their fighter level, for meeting its prerequisites.',choose:true}),
      armor:L=>({name:`Sacred armor +${(L-4)/3}`,text:'As a swift action, their armor gains an enhancement bonus (or armor special abilities) for minutes equal to their warpriest level each day.'}),
      weapon:L=>({name:`Sacred weapon +${L/4}`,text:'As a swift action, their sacred weapon gains an enhancement bonus (or weapon special abilities) for rounds equal to their warpriest level each day.'}),
      war:()=>({name:'Aspect of War',text:'Once per day, as a swift action for 1 minute: their warpriest level counts as their base attack bonus, they gain DR 10/—, move at full speed in any armor or load, and their blessings don’t use up daily uses.'}),
    },
    gains(L){const T=this.table[L]||'',out=[];
      if(/Fervor/.test(T))out.push(this.feats.fervor(L));
      if(/Bonus feat/.test(T))out.push(this.feats.bonus());
      if(/Sacred armor/.test(T))out.push(this.feats.armor(L));
      if(/sacred weapon \+/.test(T))out.push(this.feats.weapon(L));
      if(/Aspect of war/.test(T))out.push(this.feats.war());
      return out}
  };
  /* Sacred Fist archetype: no armor; flurry replaces sacred weapon, ki pool replaces sacred armor,
     style feats replace the 6th/12th/18th bonus feats, AC bonus as the monk's */
  const SACRED_FIST=(L,items)=>{
    const out=items.filter(x=>!/^Sacred (weapon|armor)/.test(x.name)&&!(x.name==='Bonus combat feat'&&[3,6,9,12,18].includes(L)));
    if(L===3)out.push({name:'Blessed fortitude',text:'On a successful Fortitude save against an effect that is reduced on a save, they avoid it entirely (not while helpless).'});
    if(L===9)out.push({name:'Miraculous fortitude',text:'On a failed Fortitude save against a damaging spell or effect (including ability damage and drain), they take only half (not while helpless).'});
    if(L===6)out.push({name:'Bonus style feat',text:'Choose a style feat (replaces this level’s bonus feat). Warpriest levels count as monk levels for its prerequisites.',choose:true});
    if([12,18].includes(L))out.push({name:'Bonus style feat',text:'Choose a style feat, or a feat that has a style feat as a prerequisite (replaces this level’s bonus feat). Warpriest levels count as monk levels for its prerequisites.',choose:true});
    if(L===7)out.push({name:'Ki pool',text:'Gains a ki pool as a monk of their warpriest level − 3 (½ that + Wis modifier points). They can also spend 1 ki as a swift action for a +1 insight bonus to AC for 1 minute.'});
    if(L%4===0)out.push({name:`AC bonus: dodge +${L/4}`,text:`Their dodge bonus to AC and CMD (on top of their Wisdom modifier) rises to +${L/4} while unarmored and unencumbered.`});
    if(L>=10&&(L-7)%3===0)out.push({name:`Ki pool: insight AC +${1+(L-7)/3}`,text:`Spending 1 ki as a swift action now grants a +${1+(L-7)/3} insight bonus to AC for 1 minute.`});
    if(L>=7){const m=L-3,kp=Math.floor(m/2),kp0=Math.floor((m-1)/2);
      if(L>7&&kp!==kp0)out.push({name:'Ki pool +1 point',text:`Their ki pool uses warpriest level − 3 as their monk level (now monk ${m}): ½ that + Wis modifier points.`});
      const strike={4:'magic',7:'cold iron and silver',10:'lawful',16:'adamantine'}[m];
      if(strike)out.push({name:`Ki strike: ${strike}`,text:`With at least 1 ki point, their unarmed strikes count as ${strike} weapons for overcoming damage reduction${m===16?' and bypassing hardness':''}.`});}
    const dmg={4:'1d8',8:'1d10',12:'2d6',16:'2d8',20:'2d10'}[L];
    if(dmg)out.push({name:`Unarmed strike ${dmg}`,text:`Their warpriest level counts as their monk level for unarmed damage: ${dmg} for a Medium creature.`});
    return out};

  /* ---------- Druid (Core Rulebook) ---------- */
  const DRUID={
    table:{1:'Nature bond, nature sense, orisons, wild empathy',2:'Woodland stride',3:'Trackless step',4:'Resist nature’s lure, wild shape (1/day)',6:'Wild shape (2/day)',8:'Wild shape (3/day)',9:'Venom immunity',10:'Wild shape (4/day)',12:'Wild shape (5/day)',13:'A thousand faces',14:'Wild shape (6/day)',15:'Timeless body',16:'Wild shape (7/day)',18:'Wild shape (8/day)',20:'Wild shape (at will)'},
    spells:{17:sp(4,4,4,4,4,4,4,3,2,1),18:sp(4,4,4,4,4,4,4,3,3,2),19:sp(4,4,4,4,4,4,4,4,3,3),20:sp(4,4,4,4,4,4,4,4,4,4)},spellFrom:0,
    gains(L){const T=this.table[L]||'';const m=T.match(/Wild shape \((\d+)\/day\)/);
      if(m)return [{name:`Wild shape ${m[1]}/day`,text:`One more use of wild shape per day (${m[1]} in all). Each form uses one, whatever the form.`}];
      if(/at will/.test(T))return [{name:'Wild shape at will',text:'Can use wild shape at will.'}];
      return []}
  };

  /* ---------- Rogue (Core Rulebook) ---------- */
  const ROGUE={
    table:{1:'Sneak attack +1d6, trapfinding',2:'Evasion, rogue talent',3:'Sneak attack +2d6, trap sense +1',4:'Rogue talent, uncanny dodge',5:'Sneak attack +3d6',6:'Rogue talent, trap sense +2',7:'Sneak attack +4d6',8:'Improved uncanny dodge, rogue talent',9:'Sneak attack +5d6, trap sense +3',10:'Advanced talents, rogue talent',11:'Sneak attack +6d6',12:'Rogue talent, trap sense +4',13:'Sneak attack +7d6',14:'Rogue talent',15:'Sneak attack +8d6, trap sense +5',16:'Rogue talent',17:'Sneak attack +9d6',18:'Rogue talent, trap sense +6',19:'Sneak attack +10d6',20:'Master strike, rogue talent'},
    gains(L){const T=this.table[L]||'',out=[],sa=T.match(/Sneak attack \+(\d+)d6/),ts=T.match(/trap sense \+(\d)/);
      if(sa)out.push({name:`Sneak attack +${sa[1]}d6`,text:`Sneak attack now deals +${sa[1]}d6 when the target is flanked or denied its Dex bonus to AC (ranged only within 30 ft.).`});
      if(ts)out.push({name:`Trap sense +${ts[1]}`,text:`+${ts[1]} on Reflex saves against traps and a +${ts[1]} dodge bonus to AC against attacks by traps.`});
      if(/Improved uncanny dodge/.test(T))out.push({name:'Improved uncanny dodge',text:'Can no longer be flanked, except by a rogue with at least four more rogue levels. Uncanny dodge levels from other classes stack for this.'});
      if(/Advanced talents/.test(T))out.push({name:'Advanced talents',text:'From now on, any rogue talent can be swapped for an advanced rogue talent.'});
      if(/rogue talent/i.test(T))out.push({name:'Rogue talent',text:'Choose a rogue talent'+(L>=10?' or an advanced talent':'')+'.',choose:true});
      if(/Master strike/.test(T))out.push({name:'Master strike',text:'Each sneak attack can also put the target to sleep for 1d4 hours, paralyze it for 2d6 rounds, or slay it. Fortitude negates (DC 10 + ½ rogue level + Int modifier); a creature can be targeted once per 24 hours.'});
      return out}
  };

  /* ---------- Shadowdancer (prestige, 10 levels) ---------- */
  const SHADOWDANCER={max:10,table:{},gains(){return []}};

  /* ---------- Bard (Core Rulebook) ---------- */
  const BARD={
    table:{17:'Inspire courage +4, lore master 3/day',18:'Mass suggestion, versatile performance',19:'Inspire competence +6',20:'Deadly performance'},
    spells:{17:sp(5,5,5,4,4,2),18:sp(5,5,5,5,4,3),19:sp(5,5,5,5,5,4),20:sp(5,5,5,5,5,5)},spellFrom:1,
    known:{17:sp(6,6,6,6,5,4,3),18:sp(6,6,6,6,5,4,4),19:sp(6,6,6,6,5,5,4),20:sp(6,6,6,6,6,5,5)},
    gains(L){const T=this.table[L]||'',out=[];
      if(/Mass suggestion/.test(T))out.push({name:'Mass suggestion',text:'Can make a suggestion (as the spell) to any number of creatures already fascinated by the performance, all at once. Enchantment (compulsion), mind-affecting, language-dependent, audible.'});
      if(/versatile performance/.test(T))out.push({name:'Versatile performance',text:'Choose another Perform type; its bonus can be used in place of its associated skills (e.g. Act: Bluff and Disguise).',choose:true});
      if(/Inspire competence \+6/.test(T))out.push({name:'Inspire competence +6',text:'Allies within 30 ft. who see and hear the bard get a +6 competence bonus on checks with one chosen skill.'});
      if(/Deadly performance/.test(T))out.push({name:'Deadly performance',text:'One enemy within 30 ft. that sees and hears the bard perform for a full round must make a Will save (DC 10 + ½ bard level + Cha modifier) or die of joy or sorrow; on a success it is staggered 1d4 rounds and immune for 24 hours. Mind-affecting death effect.'});
      return out}
  };

  /* ---------- Ranger (Core Rulebook) ---------- */
  const RANGER={
    table:{17:'Hide in plain sight',18:'4th favored terrain, combat style feat',19:'Improved quarry',20:'5th favored enemy, master hunter'},
    spells:{17:sp(4,3,2,1),18:sp(4,3,2,2),19:sp(4,3,3,2),20:sp(4,4,3,3)},spellFrom:1,
    gains(L){const T=this.table[L]||'',out=[];
      if(/favored terrain/.test(T))out.push({name:'4th favored terrain',text:'Choose another favored terrain (+2 initiative and Knowledge (geography), Perception, Stealth and Survival there). Also raise one favored terrain’s bonus by +2.',choose:true});
      if(/combat style feat/.test(T))out.push({name:'Combat style feat',text:'Choose a feat from the ranger’s combat style, even without its normal prerequisites. Works only in light, medium or no armor.',choose:true});
      if(/Improved quarry/.test(T))out.push({name:'Improved quarry',text:'Picks a quarry as a free action, can take 20 on Survival to track it while moving at normal speed, and the insight bonus to attack it rises to +4. A new quarry after 10 minutes if it dies.'});
      if(/favored enemy/.test(T))out.push({name:'5th favored enemy',text:'Choose another favored enemy type (+2 on attacks, damage and the listed skills against it). Also raise one favored enemy’s bonus by +2.',choose:true});
      if(/master hunter/.test(T))out.push({name:'Master hunter',text:'Tracks at full speed. As a standard action, one attack at full bonus against a favored enemy: on a hit it must make a Fortitude save (DC 10 + ½ ranger level + Wis modifier) or die (or the ranger can deal nonlethal damage equal to its current HP).'});
      return out}
  };

  /* ---------- Brawler (Advanced Class Guide) ---------- */
  const BRAWLER={
    table:{1:'Brawler’s cunning, martial flexibility, martial training, unarmed strike',2:'Bonus combat feat, brawler’s flurry (Two-Weapon Fighting)',3:'Maneuver training 1',4:'AC bonus +1, knockout 1/day',5:'Bonus combat feat, brawler’s strike (magic), close weapon mastery',6:'Martial flexibility (swift action)',7:'Maneuver training 2',8:'Bonus combat feat, brawler’s flurry (Improved Two-Weapon Fighting)',9:'AC Bonus +2, brawler’s strike (cold iron and silver)',10:'Martial flexibility (free action), knockout 2/day',11:'Bonus combat feat, Maneuver training 3',12:'Brawler’s strike (alignment), martial flexibility (immediate action)',13:'AC bonus +3',14:'Bonus combat feat',15:'Brawler’s flurry (Greater Two-Weapon Fighting), Maneuver training 4',16:'Awesome blow, knockout 3/day',17:'Bonus combat feat, brawler’s strike (adamantine)',18:'AC bonus +4',19:'Maneuver training 5',20:'Bonus combat feat, improved awesome blow, martial flexibility (any number)'},
    gains(L){const T=this.table[L]||'',out=[];
      if(/Bonus combat feat/.test(T))out.push({name:'Bonus combat feat',text:'Choose a combat feat that improves the brawler’s defenses or melee attacks. From 5th level the brawler can also swap an earlier bonus combat feat for a new one.',choose:true});
      const mt=T.match(/Maneuver training (\d)/i);if(mt)out.push({name:`Maneuver training ${mt[1]}`,text:'Choose another combat maneuver for +1 on its checks and CMD; every earlier maneuver training bonus also goes up by 1.',choose:true});
      const ac=T.match(/AC bonus \+(\d)/i);if(ac)out.push({name:`AC bonus +${ac[1]}`,text:`+${ac[1]} dodge bonus to AC in light or no armor.`});
      const ko=T.match(/knockout (\d)\/day/);if(ko)out.push({name:`Knockout ${ko[1]}/day`,text:'Announce before an attack: if it hits and deals damage, the target makes a Fortitude save (DC 10 + ½ brawler level + higher of Str or Dex modifier) or falls unconscious for 1d6 rounds.'});
      if(/Martial flexibility \(free action\)/.test(T))out.push({name:'Martial flexibility: three feats',text:'Can gain three combat feats at once: one as a free action, two as a swift action, or three as a move action.'});
      if(/martial flexibility \(immediate action\)/.test(T))out.push({name:'Martial flexibility: immediate',text:'Can gain one combat feat as an immediate action, or three as a swift action.'});
      if(/martial flexibility \(any number\)/.test(T))out.push({name:'Martial flexibility: any number',text:'Can gain any number of combat feats as a swift action (each counts against daily uses).'});
      if(/Martial flexibility \(swift action\)/.test(T))out.push({name:'Martial flexibility: two feats',text:'Can gain two combat feats at once: one as a swift action or two as a move action.'});
      const bs=T.match(/brawler’s strike \(([^)]+)\)/i);if(bs)out.push({name:`Brawler’s strike: ${bs[1]}`,text:bs[1]==='alignment'?'Choose chaotic, evil, good or lawful (not opposite the brawler’s own): unarmed strikes count as that alignment against DR.':`Unarmed strikes count as ${bs[1]} for overcoming damage reduction${bs[1]==='adamantine'?' and bypassing hardness':''}.`,choose:bs[1]==='alignment'});
      if(/close weapon mastery/i.test(T))out.push({name:'Close weapon mastery',text:'Close weapons deal the unarmed damage of a brawler 4 levels lower, if that is more.'});
      const fl=T.match(/brawler’s flurry \(([^)]+)\)/i);if(fl)out.push({name:`Brawler’s flurry: ${fl[1]}`,text:`The brawler’s flurry now works as ${fl[1]}.`});
      if(/Awesome blow/.test(T))out.push({name:'Awesome blow',text:'Gains Awesome Blow as a bonus feat.'});
      if(/improved awesome blow/.test(T))out.push({name:'Improved awesome blow',text:'Gains Improved Awesome Blow (see the brawler class feature).'});
      return out}
  };
  /* Strangler archetype: strangle replaces unarmed strike and brawler’s flurry; practiced strangler replaces AC bonus;
     sleeper hold alters knockout; neckbreaker replaces awesome blow and improved awesome blow */
  const STRANGLER=(L,items)=>{
    const out=items.filter(x=>!/^(AC bonus|Brawler’s flurry|Knockout|Awesome blow|Improved awesome blow)/.test(x.name));
    if([2,8,15].includes(L))out.push({name:`Strangle +${{2:2,8:3,15:4}[L]}d6`,text:'Successful grapple checks to damage or pin deal this much sneak attack damage; the strangler always counts as flanking the target for it.'});
    if(L===9)out.push({name:'Practiced strangler (improved)',text:'While grappling or grappled, the strangler still threatens and can make attacks of opportunity; when pinned, the strangler keeps the Dex bonus and takes no −4 to AC.'});
    if(L===4||L===10||L===16)out.push({name:`Sleeper hold ${L===4?1:L===10?2:3}/day`,text:'A successful grapple check against a pinned opponent knocks it unconscious, as knockout (no damage needed). Creatures that don’t breathe or are immune to crits or nonlethal damage are immune.'});
    if(L===16)out.push({name:'Neckbreaker',text:'As a standard action, try to kill a pinned opponent: like sleeper hold but at −5 on the grapple check. If it fails its Fortitude save it dies; if it succeeds, the strangler deals grapple damage. Immune if immune to crits.'});
    if(L===20)out.push({name:'Neckbreaker as a move action',text:'Neckbreaker now takes a move action.'});
    return out};

  /* ---------- Alchemist (Advanced Player’s Guide) ---------- */
  const ALCHEMIST={
    table:{11:'Bomb 6d6',12:'Discovery',13:'Bomb 7d6',14:'Discovery, persistent mutagen',15:'Bomb 8d6',16:'Discovery',17:'Bomb 9d6',18:'Discovery, instant alchemy',19:'Bomb 10d6',20:'Grand Discovery'},
    spells:{11:sp(5,4,4,2),12:sp(5,5,4,3),13:sp(5,5,4,3,1),14:sp(5,5,4,4,2),15:sp(5,5,5,4,3),16:sp(5,5,5,4,3,1),17:sp(5,5,5,4,4,2),18:sp(5,5,5,5,4,3),19:sp(5,5,5,5,5,4),20:sp(5,5,5,5,5,5)},spellFrom:1,spellWord:'Extracts',
    gains(L){const T=this.table[L]||'',out=[];
      const b=T.match(/Bomb (\d+)d6/);if(b)out.push({name:`Bomb ${b[1]}d6`,text:`Bombs deal ${b[1]}d6 fire (+ Int modifier) on a direct hit.`});
      if(/^Discovery/.test(T))out.push({name:'Discovery',text:'Choose an alchemist discovery.',choose:true});
      if(/persistent mutagen/.test(T))out.push({name:'Persistent mutagen',text:'Mutagens now last 1 hour per alchemist level.'});
      if(/instant alchemy/.test(T))out.push({name:'Instant alchemy',text:'Creates any alchemical item as a full-round action (with the Craft check and materials), and applies poison to a weapon as an immediate action.'});
      if(/Grand Discovery/.test(T))out.push({name:'Grand discovery',text:'Learns two normal discoveries plus one grand discovery.',choose:true});
      return out}
  };
  /* Vivisectionist archetype: sneak attack replaces bomb; extra formulae at 7th, 9th and 15th */
  const VIVISECTIONIST=(L,items)=>{
    const out=items.filter(x=>!/^Bomb/.test(x.name));
    if(L%2===1)out.push({name:`Sneak attack +${(L+1)/2}d6`,text:`Sneak attack as a rogue of the same alchemist level: +${(L+1)/2}d6 (levels in other classes with sneak attack stack).`});
    if(L===15)out.push({name:'Torturous transformation: regenerate',text:'Adds regenerate to the formula book as a 5th-level extract.'});
    if(out.some(x=>x.name==='Discovery')&&L>=10)out.find(x=>x.name==='Discovery').text='Choose an alchemist discovery, or the bleeding attack or crippling strike rogue talent in its place.';
    return out};

  const CLASSES={Warpriest:WARPRIEST,Druid:DRUID,Rogue:ROGUE,Shadowdancer:SHADOWDANCER,Bard:BARD,Ranger:RANGER,Brawler:BRAWLER,Alchemist:ALCHEMIST};
  const ARCH={'sacred fist':SACRED_FIST,strangler:STRANGLER,vivisectionist:VIVISECTIONIST};
  const SOURCES={Warpriest:'warpriest',Druid:'druid',Rogue:'rogue',Shadowdancer:'shadowdancer',Bard:'bard',Ranger:'ranger',Brawler:'brawler',Alchemist:'alchemist'};

  /* What reaching class level L brings: class features (archetype-adjusted) and spells per day. */
  function gains(cls,arch,L){
    const C=CLASSES[cls];if(!C)return {known:false,items:[]};
    if(C.max&&L>C.max)return {known:true,items:[],maxed:true};
    let items=C.gains(L);const a=ARCH[String(arch||'').toLowerCase()];if(a)items=a(L,items);
    let spells=null;const now=C.spells&&C.spells[L],before=C.spells&&C.spells[L-1];
    if(now){const fmt=a=>a.map((v,i)=>`${ord(i+(C.spellFrom||0))} ${v}`).join(', ');
      const ch=now.map((v,i)=>({lvl:i+(C.spellFrom||0),v,was:before?before[i]||0:null})).filter(x=>x.was===null||x.v!==x.was);
      spells={word:C.spellWord||'Spells',now:fmt(now),changes:ch.map(x=>`${ord(x.lvl)}-level ${x.was===null?'':x.was+' → '}${x.v}`)};
      if(before&&now.length>before.length)spells.newLevel=ord(now.length-1+(C.spellFrom||0));
      if(C.known&&C.known[L]){const k=C.known[L],kb=C.known[L-1]||[];spells.known=k.map((v,i)=>({lvl:i,v,was:kb[i]})).filter(x=>x.v!==x.was).map(x=>`${ord(x.lvl)} ${x.was!=null?x.was+' → ':''}${x.v}`)}}
    return {known:true,items,spells,table:C.table[L]||'',source:SOURCES[cls]};
  }
  window.SAVIORS_LEVELS={gains,classes:Object.keys(CLASSES),ord};
})();
