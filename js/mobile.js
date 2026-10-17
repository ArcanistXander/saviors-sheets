/* Phone layout helper for every sheet: on narrow screens, a table that would need sideways scrolling is turned into
   one card per row (css/mobile.css styles .stack), each value labelled with its column heading. Runs after every redraw. */
(function(){
  'use strict';
  var mq=window.matchMedia('(max-width:640px)');
  /* column names, reading every header row so two-row headers (a group over Fort / Ref / Will) work */
  function heads(t){
    if(!t.tHead||!t.tHead.rows.length)return null;
    var grid=[],rows=t.tHead.rows;
    for(var r=0;r<rows.length;r++){
      grid[r]=grid[r]||[];var col=0;
      for(var i=0;i<rows[r].cells.length;i++){
        var c=rows[r].cells[i],cs=c.colSpan||1,rs=c.rowSpan||1,txt=c.textContent.trim();
        while(grid[r][col]!==undefined)col++;
        for(var y=0;y<rs;y++)for(var x=0;x<cs;x++){grid[r+y]=grid[r+y]||[];grid[r+y][col+x]=txt}
        col+=cs;
      }
    }
    return grid[grid.length-1];
  }
  function label(t,h){
    var rows=t.tBodies.length?t.tBodies[0].rows:[];
    for(var r=0;r<rows.length;r++){
      var col=0,cells=rows[r].cells;
      for(var i=0;i<cells.length;i++){
        var c=cells[i];
        if(h[col]&&(c.colSpan||1)<2)c.setAttribute('data-label',h[col]);else c.removeAttribute('data-label');
        if(c.querySelector('input:not([type=number]):not([type=checkbox]):not([type=radio]),textarea')||(c.colSpan||1)>1||c.textContent.trim().length>28)c.classList.add('wide');
        col+=c.colSpan||1;
      }
    }
  }
  /* a table that fits only by squeezing long text into a narrow column reads badly too */
  function squashed(t){
    var cs=t.querySelectorAll('tbody td');
    for(var i=0;i<cs.length;i++){var w=cs[i].getBoundingClientRect().width;if(w&&w<110&&cs[i].textContent.trim().length>40)return true}
    return false;
  }
  function numeric(t){
    var rs=t.tBodies.length?t.tBodies[0].rows:[];if(!rs.length)return false;
    for(var r=0;r<rs.length;r++){if(rs[r].cells.length<3)return false;if(rs[r].cells[0].querySelector('input,select,button'))return false}
    for(var r=0;r<rs.length;r++)for(var i=1;i<rs[r].cells.length;i++){var c=rs[r].cells[i];if(c.querySelector('input,select,button')||c.textContent.trim().length>8)return false}
    return true;
  }
  function fit(){
    var ts=document.querySelectorAll('.scroll>table,.wrap>table');
    for(var i=0;i<ts.length;i++){
      var t=ts[i];
      if(!mq.matches){t.classList.remove('stack','tight');continue}
      if(t.classList.contains('stack')||t.classList.contains('tight')||t.classList.contains('skilltbl')||t.classList.contains('nostack'))continue;
      var box=t.parentNode;if(!box.clientWidth||(box.scrollWidth<=box.clientWidth+2&&!squashed(t)))continue;
      /* a grid of short numbers (spell slots by level) is easier to read squeezed than split into cards */
      if(numeric(t)){t.classList.add('tight');continue}
      var h=heads(t);if(!h)continue;
      label(t,h);t.classList.add('stack');
    }
  }
  /* long attack strings like +22/+22/+17/+12 may wrap only after a slash, never inside a number */
  function slashes(){
    var vs=document.querySelectorAll('.ctile .v,.stat .v');
    for(var i=0;i<vs.length;i++){var v=vs[i];if(v.children.length||v.textContent.indexOf('/')<0)continue;
      var t=v.textContent;v.textContent='';t.split('/').forEach(function(p,k){if(k){v.appendChild(document.createTextNode('/'));v.appendChild(document.createElement('wbr'))}v.appendChild(document.createTextNode(p))})}
  }
  var queued=false;
  function soon(){if(queued)return;queued=true;setTimeout(function(){queued=false;fit();slashes()},30)}
  function start(){
    new MutationObserver(soon).observe(document.body,{childList:true,subtree:true});
    if(mq.addEventListener)mq.addEventListener('change',soon);else mq.addListener(soon);
    window.addEventListener('resize',soon);
    soon();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
