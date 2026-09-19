(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 293, H = 164;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), artLayer = $('artLayer'), defs = $('svgDefs'), selectionLayer = $('selectionLayer'), gridLayer = $('gridLayer'), guideLayer = $('guideLayer');

  const SHAPES = [
    ['rounded','둥근 네모'],['softrect','말랑 네모'],['arch','둥근 윗면'],['topsoft','윗면 살짝 둥근'],
    ['wideheart','가로 하트'],['oval','타원'],['pill','캡슐'],['cloud','구름'],
    ['wavetop','윗 파도'],['wavebottom','아랫 파도'],['blob','몽글 블롭'],['scallop','물결 테두리'],
    ['ticket','티켓'],['shield','배지'],['brush','파스텔 붓'],['ribbonpanel','리본 패널']
  ];
  const STAMPS = [
    ['heart','하트'],['heartline','선 하트'],['star','별'],['sparkle','반짝이'],
    ['circle','동그라미'],['ring','링'],['dots','세 점'],['flower','꽃'],
    ['squiggle','꼬불선'],['ray','빛살'],['diamond','마름별'],['bubble','말풍선']
  ];
  const PRESETS = [
    {name:'하늘 소다', colors:['#dff4ff','#9edbf4','#5c8db0']},
    {name:'딸기 우유', colors:['#ffe8ef','#f6b8c9','#bd6f88']},
    {name:'레몬 크림', colors:['#fff6c9','#f2d16f','#9f843f']},
    {name:'라벤더 구름', colors:['#efeaff','#cfc5f5','#786da6']},
    {name:'민트 피크닉', colors:['#e8f7d7','#b9db8e','#6d9468']},
    {name:'체리 팝', colors:['#ffe2df','#ef8b86','#a44349']},
    {name:'피치 코랄', colors:['#ffe8dc','#f3b39b','#af6d5d']},
    {name:'블루베리', colors:['#e3e8ff','#a9b8e6','#596a9a']}
  ];

  const DEFAULT_STROKES = () => [
    {color:'#ffffff', width:8},
    {color:'#80758b', width:3}
  ];

  let state = {
    bg: '#ffffff', transparent: false, zoom: 2,
    grid:false, safe:true, snap:false, tool:'select',
    items: [], selectedId: null
  };
  let history = [], historyIndex = -1, restoring = false;
  let drag = null, pen = null, toastTimer = null;

  function uid(){ return 'i_' + Math.random().toString(36).slice(2,10); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function snap(v){ return state.snap ? Math.round(v/2)*2 : v; }
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function svgEl(tag, attrs={}){ const el=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v))); return el; }
  function selected(){ return state.items.find(x=>x.id===state.selectedId) || null; }
  function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1700); }

  function pushHistory(){
    if(restoring) return;
    const snapshot=JSON.stringify({bg:state.bg,transparent:state.transparent,items:state.items,selectedId:state.selectedId});
    if(history[historyIndex]===snapshot) return;
    history=history.slice(0,historyIndex+1); history.push(snapshot); if(history.length>80) history.shift(); else historyIndex++;
    if(history.length===80) historyIndex=79;
    updateUndoRedo();
  }
  function restoreHistory(idx){ if(idx<0||idx>=history.length) return; restoring=true; const s=JSON.parse(history[idx]); state.bg=s.bg;state.transparent=s.transparent;state.items=s.items;state.selectedId=s.selectedId;historyIndex=idx;restoring=false;syncAll();updateUndoRedo(); }
  function updateUndoRedo(){ $('undoBtn').disabled=historyIndex<=0; $('redoBtn').disabled=historyIndex>=history.length-1; }

  function makeBase(type, kind='shape'){
    return {
      id:uid(), kind, type, x:35, y:22, w:223, h:120, rotation:0,
      fillMode:'solid', fillA:'#dff4ff', fillB:'#a7dff4', gradAngle:20, gradStart:0, gradEnd:100,
      strokes:DEFAULT_STROKES(),
      shade:{enabled:false,color:'#655c76',opacity:18,angle:135},
      pattern:{mode:'none',color:'#5f5a70',opacity:18,scale:10}
    };
  }
  function addShape(type){ const it=makeBase(type,'shape'); if(type==='wideheart'){it.y=30;it.h=112;} if(type==='oval'){it.x=45;it.y=28;it.w=203;it.h=108;} if(type==='brush'){it.x=25;it.y=30;it.w=243;it.h=105;it.fillMode='pastel';it.strokes=[{color:'#ffffff',width:4}];} state.items.push(it);state.selectedId=it.id;pushHistory();render();syncInspector(); }
  function addStamp(type, x=146.5, y=82){
    const it=makeBase(type,'stamp'); it.x=x-16;it.y=y-16;it.w=32;it.h=32;it.fillMode=(type==='heartline'||type==='ring'||type==='squiggle'||type==='ray')?'solid':'solid';it.fillA='#fff7fb';it.fillB='#fff7fb';it.strokes=[{color:'#8f7894',width:2.2}];it.shade.enabled=false;it.pattern.mode='none';
    if(type==='squiggle'){it.w=52;it.h=22;it.x=x-26;it.y=y-11;}
    if(type==='ray'){it.w=42;it.h=42;it.x=x-21;it.y=y-21;}
    state.items.push(it);state.selectedId=it.id;pushHistory();render();syncInspector();
  }

  function pathFor(type){
    const p={
      rounded:'M14,0 H86 Q100,0 100,14 V86 Q100,100 86,100 H14 Q0,100 0,86 V14 Q0,0 14,0 Z',
      softrect:'M18,2 C8,2 2,9 2,18 L0,80 C0,92 8,98 20,98 L82,100 C93,100 100,91 98,79 L100,19 C100,8 91,0 80,2 Z',
      arch:'M0,100 V43 C0,13 21,0 50,0 C79,0 100,13 100,43 V100 Z',
      topsoft:'M0,100 V25 C0,8 13,0 30,0 H70 C87,0 100,8 100,25 V100 Z',
      wideheart:'M50,100 C38,86 4,67 2,37 C0,16 15,3 32,4 C42,5 48,11 50,21 C52,11 58,5 68,4 C85,3 100,16 98,37 C96,67 62,86 50,100 Z',
      oval:'M50,0 C80,0 100,18 100,50 C100,82 80,100 50,100 C20,100 0,82 0,50 C0,18 20,0 50,0 Z',
      pill:'M50,0 H50 C82,0 100,17 100,50 C100,83 82,100 50,100 H50 C18,100 0,83 0,50 C0,17 18,0 50,0 Z',
      cloud:'M18,82 C4,82 0,71 7,61 C-3,49 4,35 18,36 C17,18 32,9 45,18 C53,1 76,1 82,20 C98,18 106,34 96,46 C108,55 102,72 88,72 C86,91 63,97 51,86 C41,101 20,96 18,82 Z',
      wavetop:'M0,18 C16,4 30,31 48,16 C65,1 82,29 100,11 V100 H0 Z',
      wavebottom:'M0,0 H100 V79 C82,100 68,68 50,84 C30,101 16,72 0,92 Z',
      blob:'M11,20 C24,2 42,9 51,3 C70,-4 80,10 91,24 C102,38 92,53 98,68 C104,85 87,99 70,95 C55,103 44,92 28,98 C10,104 -2,89 4,73 C-4,58 6,45 3,34 C1,27 5,23 11,20 Z',
      scallop:'M12,7 C18,-2 28,-2 34,7 C42,-2 52,-2 58,7 C66,-2 76,-2 82,7 C94,5 100,12 96,24 C105,31 105,42 96,49 C105,57 105,68 96,75 C101,88 94,97 82,94 C76,103 66,103 58,94 C52,103 42,103 34,94 C28,103 18,103 12,94 C1,96 -5,86 3,76 C-5,68 -5,57 3,50 C-5,42 -5,31 3,24 C-2,14 2,6 12,7 Z',
      ticket:'M8,0 H92 V14 C80,14 80,28 92,28 V72 C80,72 80,86 92,86 V100 H8 V86 C20,86 20,72 8,72 V28 C20,28 20,14 8,14 Z',
      shield:'M50,0 C67,9 82,13 98,15 V51 C98,75 78,92 50,100 C22,92 2,75 2,51 V15 C18,13 33,9 50,0 Z',
      brush:'M2,20 C10,6 28,11 36,8 C55,2 69,11 84,6 C93,3 101,10 97,22 C94,31 103,40 98,49 C93,58 103,67 98,76 C92,88 78,88 67,91 C49,96 36,88 22,94 C9,99 1,89 4,78 C8,66 -1,59 4,49 C9,39 -3,31 2,20 Z',
      ribbonpanel:'M0,15 L10,3 L18,14 H82 L90,3 L100,15 L94,28 V100 H6 V28 Z'
    };
    return p[type]||p.rounded;
  }
  function stampPath(type){
    const p={
      heart:'M50,92 C38,78 8,60 8,34 C8,16 20,8 34,8 C43,8 49,14 50,24 C51,14 57,8 66,8 C80,8 92,16 92,34 C92,60 62,78 50,92 Z',
      heartline:'M50,88 C39,76 12,58 12,34 C12,18 23,11 35,11 C44,11 49,18 50,26 C51,18 56,11 65,11 C77,11 88,18 88,34 C88,58 61,76 50,88',
      star:'M50,3 L61,36 L96,36 L68,56 L79,91 L50,70 L21,91 L32,56 L4,36 L39,36 Z',
      sparkle:'M50,1 C54,31 61,42 91,50 C61,58 54,69 50,99 C46,69 39,58 9,50 C39,42 46,31 50,1 Z',
      circle:'M50,3 A47,47 0 1 0 50,97 A47,47 0 1 0 50,3 Z',
      ring:'M50,8 A42,42 0 1 0 50,92 A42,42 0 1 0 50,8 Z',
      dots:'M18,50 A10,10 0 1 0 18,49.9 M50,50 A10,10 0 1 0 50,49.9 M82,50 A10,10 0 1 0 82,49.9',
      flower:'M50,38 C32,10 9,31 31,50 C7,64 29,91 50,64 C67,92 93,67 69,50 C92,31 68,10 50,38 Z',
      squiggle:'M4,57 C16,20 29,82 43,46 C56,13 69,80 82,44 C88,27 93,30 97,42',
      ray:'M50,2 V26 M50,74 V98 M2,50 H26 M74,50 H98 M16,16 L33,33 M67,67 L84,84 M84,16 L67,33 M33,67 L16,84',
      diamond:'M50,4 L63,37 L96,50 L63,63 L50,96 L37,63 L4,50 L37,37 Z',
      bubble:'M8,14 Q8,5 18,5 H82 Q92,5 92,14 V66 Q92,75 82,75 H54 L36,94 L39,75 H18 Q8,75 8,66 Z'
    };
    return p[type]||p.heart;
  }
  function iconSvg(kind,type){
    const path = kind==='shape'?pathFor(type):stampPath(type);
    const fill = ['heartline','ring','squiggle','ray'].includes(type)?'none':'#efeafd';
    return `<svg viewBox="0 0 100 100"><path d="${path}" fill="${fill}" stroke="#776a91" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function buildAssetLists(){
    $('shapeList').innerHTML=SHAPES.map(([id,name])=>`<button class="asset-btn" data-shape="${id}">${iconSvg('shape',id)}<span>${esc(name)}</span></button>`).join('');
    $('stampList').innerHTML=STAMPS.map(([id,name])=>`<button class="asset-btn" data-stamp="${id}">${iconSvg('stamp',id)}<span>${esc(name)}</span></button>`).join('');
    $('shapeList').addEventListener('click',e=>{const b=e.target.closest('[data-shape]');if(b)addShape(b.dataset.shape)});
    $('stampList').addEventListener('click',e=>{const b=e.target.closest('[data-stamp]');if(b)addStamp(b.dataset.stamp)});
    $('presetList').innerHTML=PRESETS.map((p,i)=>`<button class="preset-card" data-preset="${i}"><span class="preset-preview" style="background:linear-gradient(135deg,${p.colors[0]},${p.colors[1]})"></span><span class="preset-name">${p.name}</span></button>`).join('');
    $('presetList').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)applyPreset(+b.dataset.preset)});
  }

  function applyPreset(index){
    const p=PRESETS[index]; state.bg='#ffffff'; state.transparent=false; state.items=[];
    const base=makeBase(index%3===0?'softrect':index%3===1?'wideheart':'arch','shape'); base.x=22;base.y=18;base.w=249;base.h=132;base.fillMode='linear';base.fillA=p.colors[0];base.fillB=p.colors[1];base.gradAngle=25;base.strokes=[{color:'#ffffff',width:9},{color:p.colors[2],width:3.2}];base.pattern={mode:index%2?'dots':'sparkles',color:p.colors[2],opacity:18,scale:12};state.items.push(base);
    [['sparkle',34,31,18],['heartline',258,36,20],['circle',26,125,10],['star',265,126,15]].forEach(([t,cx,cy,s],k)=>{ const it=makeBase(t,'stamp');it.x=cx-s/2;it.y=cy-s/2;it.w=s;it.h=s;it.fillA=k===2?p.colors[1]:'#fffdfd';it.strokes=[{color:p.colors[2],width:1.7}];it.pattern.mode='none';it.shade.enabled=false;state.items.push(it); });
    state.selectedId=base.id; pushHistory(); syncAll(); showToast(`${p.name} 프리셋 적용`);
  }

  function clearDefs(){ while(defs.firstChild) defs.removeChild(defs.firstChild); }
  function addDef(el){ defs.appendChild(el); }
  function createFillDef(item){
    if(item.fillMode==='solid') return item.fillA;
    const id='fill_'+item.id;
    if(item.fillMode==='linear'||item.fillMode==='pastel'){
      const rad=(item.gradAngle||0)*Math.PI/180, x=Math.cos(rad), y=Math.sin(rad);
      const g=svgEl('linearGradient',{id,x1:(50-50*x)+'%',y1:(50-50*y)+'%',x2:(50+50*x)+'%',y2:(50+50*y)+'%'});
      g.append(svgEl('stop',{offset:(item.gradStart??0)+'%','stop-color':item.fillA}));
      g.append(svgEl('stop',{offset:(item.gradEnd??100)+'%','stop-color':item.fillB})); addDef(g);
    } else {
      const g=svgEl('radialGradient',{id,cx:'50%',cy:'45%',r:'70%'});g.append(svgEl('stop',{offset:(item.gradStart??0)+'%','stop-color':item.fillA}));g.append(svgEl('stop',{offset:(item.gradEnd??100)+'%','stop-color':item.fillB}));addDef(g);
    }
    return `url(#${id})`;
  }
  function createPastelFilter(item){
    if(item.fillMode!=='pastel') return null; const id='pastel_'+item.id;
    const f=svgEl('filter',{id,x:'-10%',y:'-10%',width:'120%',height:'120%'});
    const turb=svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:'0.045',numOctaves:'2',seed:String((item.id.charCodeAt(2)||3)%17+1),result:'noise'});
    const disp=svgEl('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:'1.8',xChannelSelector:'R',yChannelSelector:'G',result:'disp'});
    const blur=svgEl('feGaussianBlur',{in:'disp',stdDeviation:'0.18'});f.append(turb,disp,blur);addDef(f);return `url(#${id})`;
  }
  function createPatternDef(item){
    if(!item.pattern||item.pattern.mode==='none') return null;
    const id='pat_'+item.id, s=+item.pattern.scale||10, color=item.pattern.color, op=(+item.pattern.opacity||20)/100;
    const p=svgEl('pattern',{id,patternUnits:'userSpaceOnUse',width:s,height:s,patternTransform:'rotate(0)'});
    if(item.pattern.mode==='dots') p.append(svgEl('circle',{cx:s/2,cy:s/2,r:Math.max(1,s*.12),fill:color,opacity:op}));
    if(item.pattern.mode==='stripes') { p.setAttribute('patternTransform','rotate(35)');p.append(svgEl('line',{x1:0,y1:0,x2:0,y2:s,stroke:color,'stroke-width':Math.max(1,s*.16),opacity:op})); }
    if(item.pattern.mode==='grid') { p.append(svgEl('path',{d:`M0 0 H${s} M0 0 V${s}`,stroke:color,'stroke-width':Math.max(.5,s*.08),opacity:op,fill:'none'})); }
    if(item.pattern.mode==='sparkles') { p.append(svgEl('path',{d:`M${s/2} ${s*.15} C${s*.53} ${s*.4} ${s*.62} ${s*.47} ${s*.85} ${s*.5} C${s*.62} ${s*.53} ${s*.53} ${s*.6} ${s/2} ${s*.85} C${s*.47} ${s*.6} ${s*.38} ${s*.53} ${s*.15} ${s*.5} C${s*.38} ${s*.47} ${s*.47} ${s*.4} ${s/2} ${s*.15} Z`,fill:color,opacity:op})); }
    addDef(p); return `url(#${id})`;
  }
  function createShadeDef(item){
    if(!item.shade?.enabled) return null; const id='shade_'+item.id; const rad=(item.shade.angle||0)*Math.PI/180,x=Math.cos(rad),y=Math.sin(rad);const g=svgEl('linearGradient',{id,x1:(50-50*x)+'%',y1:(50-50*y)+'%',x2:(50+50*x)+'%',y2:(50+50*y)+'%'});g.append(svgEl('stop',{offset:'0%','stop-color':item.shade.color,'stop-opacity':'0'}));g.append(svgEl('stop',{offset:'100%','stop-color':item.shade.color,'stop-opacity':(+item.shade.opacity||0)/100}));addDef(g);return `url(#${id})`;
  }

  function itemPath(item){ return item.kind==='shape'?pathFor(item.type):item.kind==='stamp'?stampPath(item.type):item.d; }
  function render(){
    clearDefs(); artLayer.innerHTML=''; selectionLayer.innerHTML='';
    $('canvasBackground').setAttribute('fill',state.transparent?'none':state.bg);
    renderGridGuides();
    for(const item of state.items){
      const g=svgEl('g',{'data-id':item.id,transform:`translate(${item.x} ${item.y}) rotate(${item.rotation||0} ${item.w/2} ${item.h/2}) scale(${item.w/100} ${item.h/100})`});
      g.style.cursor=state.tool==='select'?'move':'crosshair';
      if(item.kind==='pen'){
        const p=svgEl('path',{d:item.d,fill:'none',stroke:item.color,'stroke-width':item.width,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':`${item.dash} ${item.gap}`,'vector-effect':'non-scaling-stroke'}); g.append(p);
      } else {
        const d=itemPath(item), fill=createFillDef(item), filter=createPastelFilter(item), patt=createPatternDef(item), shade=createShadeDef(item);
        const strokes=[...(item.strokes||[])];
        for(const st of strokes){ g.append(svgEl('path',{d,fill:'none',stroke:st.color,'stroke-width':st.width,'stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke'})); }
        const base=svgEl('path',{d,fill,stroke:'none'}); if(filter) base.setAttribute('filter',filter); g.append(base);
        if(patt) g.append(svgEl('path',{d,fill:patt,stroke:'none'}));
        if(shade) { const sh=svgEl('path',{d,fill:shade,stroke:'none'}); sh.style.mixBlendMode='multiply'; g.append(sh); }
        if(item.kind==='stamp' && ['heartline','ring','squiggle','ray'].includes(item.type)){ base.setAttribute('fill','none'); base.setAttribute('stroke',item.fillA);base.setAttribute('stroke-width','5');base.setAttribute('stroke-linecap','round');base.setAttribute('stroke-linejoin','round'); }
      }
      artLayer.append(g);
    }
    renderSelection();
  }
  function renderGridGuides(){
    gridLayer.innerHTML=''; guideLayer.innerHTML='';
    if(state.grid){ for(let x=0;x<=W;x+=10)gridLayer.append(svgEl('line',{x1:x,y1:0,x2:x,y2:H,class:'grid-line'}));for(let y=0;y<=H;y+=10)gridLayer.append(svgEl('line',{x1:0,y1:y,x2:W,y2:y,class:'grid-line'})); }
    if(state.safe) guideLayer.append(svgEl('rect',{x:8,y:8,width:W-16,height:H-16,rx:6,class:'safe-guide'}));
  }
  function renderSelection(){
    const it=selected(); if(!it) return;
    const g=svgEl('g',{transform:`translate(${it.x} ${it.y}) rotate(${it.rotation||0} ${it.w/2} ${it.h/2})`});
    g.append(svgEl('rect',{x:0,y:0,width:it.w,height:it.h,class:'select-box'}));
    [[0,0],[it.w,0],[it.w,it.h],[0,it.h]].forEach(([x,y])=>g.append(svgEl('circle',{cx:x,cy:y,r:2.4,class:'handle'})));selectionLayer.append(g);
  }

  function applyZoom(){ $('stageWrap').style.width=(W*state.zoom)+'px'; $('stageWrap').style.height=(H*state.zoom)+'px'; stage.style.width=(W*state.zoom)+'px'; stage.style.height=(H*state.zoom)+'px'; $('zoomRange').value=Math.round(state.zoom*100);$('zoomLabel').textContent=Math.round(state.zoom*100)+'%'; }
  function fitStage(){ const vp=$('stageViewport'); const z=Math.min((vp.clientWidth-70)/W,(vp.clientHeight-70)/H,3); state.zoom=clamp(Math.floor(z*4)/4,.75,3);applyZoom(); }
  function clientToStage(e){ const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}; }

  function syncAll(){ $('canvasBgColor').value=state.bg; $('transparentBg').checked=state.transparent;$('gridToggle').checked=state.grid;$('safeToggle').checked=state.safe;$('snapToggle').checked=state.snap;applyZoom();render();syncInspector();updateToolButtons(); }
  function syncInspector(){
    const it=selected(); $('emptyInspector').classList.toggle('hidden',!!it);$('inspector').classList.toggle('hidden',!it);if(!it)return;
    $('selectedTypeBadge').textContent=it.kind==='shape'?'도형':it.kind==='stamp'?'스탬프':'점선 펜';
    ['posX','posY','sizeW','sizeH'].forEach((id,i)=>$(id).value=[it.x,it.y,it.w,it.h][i].toFixed(1).replace('.0',''));
    $('rotation').value=it.rotation||0;$('rotationValue').textContent=(it.rotation||0)+'°';
    const normal=it.kind!=='pen'; $('fillSection').classList.toggle('hidden',!normal);$('strokeSection').classList.toggle('hidden',!normal);$('effectsSection').classList.toggle('hidden',!normal);
    if(normal){
      $('fillMode').value=it.fillMode;$('fillA').value=it.fillA;$('fillB').value=it.fillB;$('gradientAngle').value=it.gradAngle;$('gradientAngleValue').textContent=it.gradAngle+'°';$('gradientStart').value=it.gradStart;$('gradientEnd').value=it.gradEnd;
      $('gradientAngleRow').classList.toggle('hidden',it.fillMode==='solid');$('gradientRangeRow').classList.toggle('hidden',it.fillMode==='solid');
      $('shadeEnabled').checked=it.shade.enabled;$('shadeControls').classList.toggle('hidden',!it.shade.enabled);$('shadeColor').value=it.shade.color;$('shadeOpacity').value=it.shade.opacity;$('shadeAngle').value=it.shade.angle;$('shadeAngleValue').textContent=it.shade.angle+'°';
      $('patternMode').value=it.pattern.mode;$('patternControls').classList.toggle('hidden',it.pattern.mode==='none');$('patternColor').value=it.pattern.color;$('patternOpacity').value=it.pattern.opacity;$('patternScale').value=it.pattern.scale;$('patternScaleValue').textContent=it.pattern.scale;
      renderStrokeList(it);
    }
  }
  function renderStrokeList(it){
    $('strokeList').innerHTML=(it.strokes||[]).map((s,i)=>`<div class="stroke-row" data-i="${i}"><span class="stroke-index">${i+1}</span><input class="stroke-color" type="color" value="${s.color}"><input class="stroke-width" type="number" min="0" max="30" step="0.5" value="${s.width}"><button class="stroke-up" title="위로">▲</button><button class="stroke-down" title="아래로">▼</button><button class="stroke-del" title="삭제">×</button></div>`).join('') || '<div class="small-copy">획이 없습니다.</div>';
  }
  function updateToolButtons(){ document.querySelectorAll('#toolModeGroup button').forEach(b=>b.classList.toggle('active',b.dataset.tool===state.tool));$('penSettings').classList.toggle('hidden',state.tool!=='pen');$('stageWrap').classList.toggle('pen-cursor',state.tool==='pen'); }

  function bindInspector(){
    ['posX','posY','sizeW','sizeH'].forEach(id=>$(id).addEventListener('change',()=>{const it=selected();if(!it)return;it.x=snap(+$('posX').value);it.y=snap(+$('posY').value);it.w=Math.max(1,+$('sizeW').value);it.h=Math.max(1,+$('sizeH').value);pushHistory();render();syncInspector();}));
    $('rotation').addEventListener('input',()=>{const it=selected();if(!it)return;it.rotation=+$('rotation').value;$('rotationValue').textContent=it.rotation+'°';render();});$('rotation').addEventListener('change',pushHistory);
    $('fillMode').addEventListener('change',()=>updateSelected('fillMode',$('fillMode').value,true));
    $('fillA').addEventListener('input',()=>updateSelected('fillA',$('fillA').value));$('fillA').addEventListener('change',pushHistory);
    $('fillB').addEventListener('input',()=>updateSelected('fillB',$('fillB').value));$('fillB').addEventListener('change',pushHistory);
    $('gradientAngle').addEventListener('input',()=>{const it=selected();if(!it)return;it.gradAngle=+$('gradientAngle').value;$('gradientAngleValue').textContent=it.gradAngle+'°';render();});$('gradientAngle').addEventListener('change',pushHistory);
    ['gradientStart','gradientEnd'].forEach(id=>$(id).addEventListener('change',()=>{const it=selected();if(!it)return;it.gradStart=clamp(+$('gradientStart').value,0,100);it.gradEnd=clamp(+$('gradientEnd').value,0,100); if(it.gradEnd<it.gradStart)[it.gradStart,it.gradEnd]=[it.gradEnd,it.gradStart];pushHistory();render();syncInspector();}));
    $('shadeEnabled').addEventListener('change',()=>{const it=selected();if(!it)return;it.shade.enabled=$('shadeEnabled').checked;pushHistory();render();syncInspector();});
    $('shadeColor').addEventListener('input',()=>nestedUpdate('shade','color',$('shadeColor').value));$('shadeColor').addEventListener('change',pushHistory);
    $('shadeOpacity').addEventListener('change',()=>{nestedUpdate('shade','opacity',clamp(+$('shadeOpacity').value,0,100));pushHistory();});
    $('shadeAngle').addEventListener('input',()=>{const it=selected();if(!it)return;it.shade.angle=+$('shadeAngle').value;$('shadeAngleValue').textContent=it.shade.angle+'°';render();});$('shadeAngle').addEventListener('change',pushHistory);
    $('patternMode').addEventListener('change',()=>{nestedUpdate('pattern','mode',$('patternMode').value);pushHistory();syncInspector();});
    $('patternColor').addEventListener('input',()=>nestedUpdate('pattern','color',$('patternColor').value));$('patternColor').addEventListener('change',pushHistory);
    $('patternOpacity').addEventListener('change',()=>{nestedUpdate('pattern','opacity',clamp(+$('patternOpacity').value,0,100));pushHistory();});
    $('patternScale').addEventListener('input',()=>{const it=selected();if(!it)return;it.pattern.scale=+$('patternScale').value;$('patternScaleValue').textContent=it.pattern.scale;render();});$('patternScale').addEventListener('change',pushHistory);

    $('addStrokeBtn').addEventListener('click',()=>{const it=selected();if(!it)return;it.strokes=it.strokes||[];it.strokes.unshift({color:'#ffffff',width:5});pushHistory();render();syncInspector();});
    $('strokeList').addEventListener('input',e=>{const row=e.target.closest('.stroke-row'),it=selected();if(!row||!it)return;const i=+row.dataset.i;if(e.target.classList.contains('stroke-color'))it.strokes[i].color=e.target.value;if(e.target.classList.contains('stroke-width'))it.strokes[i].width=+e.target.value;render();});
    $('strokeList').addEventListener('change',e=>{if(e.target.matches('.stroke-color,.stroke-width'))pushHistory();});
    $('strokeList').addEventListener('click',e=>{const row=e.target.closest('.stroke-row'),it=selected();if(!row||!it)return;const i=+row.dataset.i;if(e.target.classList.contains('stroke-up')&&i>0)[it.strokes[i-1],it.strokes[i]]=[it.strokes[i],it.strokes[i-1]];if(e.target.classList.contains('stroke-down')&&i<it.strokes.length-1)[it.strokes[i+1],it.strokes[i]]=[it.strokes[i],it.strokes[i+1]];if(e.target.classList.contains('stroke-del'))it.strokes.splice(i,1);pushHistory();render();syncInspector();});
  }
  function updateSelected(k,v,doHistory=false){const it=selected();if(!it)return;it[k]=v;if(doHistory)pushHistory();render();syncInspector();}
  function nestedUpdate(obj,k,v){const it=selected();if(!it)return;it[obj][k]=v;render();}

  function addPenFromPoints(points){
    if(points.length<2)return; const mode=$('penCorrection').value; let pts=points;
    if(mode==='straight'){pts=[points[0],points[points.length-1]];}
    else {pts=rdp(points,mode==='curve'?2.5:1.25);pts=chaikin(pts,mode==='curve'?3:2);}
    const minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxX=Math.max(...pts.map(p=>p.x)),maxY=Math.max(...pts.map(p=>p.y));
    const w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY);const local=pts.map(p=>({x:(p.x-minX)/w*100,y:(p.y-minY)/h*100}));
    let d=''; if(mode==='straight')d=`M${local[0].x},${local[0].y} L${local[1].x},${local[1].y}`; else d=catmullPath(local);
    const it={id:uid(),kind:'pen',type:'dashedPen',x:minX,y:minY,w,h,rotation:0,d,color:$('penColor').value,width:+$('penWidth').value,dash:+$('penDash').value,gap:+$('penGap').value};state.items.push(it);state.selectedId=it.id;pushHistory();render();syncInspector();
  }
  function rdp(points,eps){ if(points.length<3)return points;let max=0,index=0;for(let i=1;i<points.length-1;i++){const d=perp(points[i],points[0],points[points.length-1]);if(d>max){max=d;index=i;}}if(max>eps){const a=rdp(points.slice(0,index+1),eps),b=rdp(points.slice(index),eps);return a.slice(0,-1).concat(b);}return [points[0],points[points.length-1]]; }
  function perp(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;if(dx===0&&dy===0)return Math.hypot(p.x-a.x,p.y-a.y);return Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/Math.hypot(dx,dy);}
  function chaikin(points,n){let pts=points;for(let k=0;k<n;k++){const out=[pts[0]];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];out.push({x:.75*a.x+.25*b.x,y:.75*a.y+.25*b.y},{x:.25*a.x+.75*b.x,y:.25*a.y+.75*b.y});}out.push(pts[pts.length-1]);pts=out;}return pts;}
  function catmullPath(pts){if(pts.length<2)return '';if(pts.length===2)return`M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;let d=`M${pts[0].x},${pts[0].y}`;for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6},c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};d+=` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;}return d;}

  function bindStage(){
    stage.addEventListener('pointerdown',e=>{
      const p=clientToStage(e);
      if(state.tool==='pen'){pen={points:[p]};$('livePenPath').setAttribute('opacity','1');$('livePenPath').setAttribute('d',`M${p.x},${p.y}`);$('livePenPath').setAttribute('stroke',$('penColor').value);$('livePenPath').setAttribute('stroke-width',$('penWidth').value);$('livePenPath').setAttribute('stroke-dasharray',`${$('penDash').value} ${$('penGap').value}`);stage.setPointerCapture(e.pointerId);return;}
      const target=e.target.closest?.('[data-id]');if(target){state.selectedId=target.getAttribute('data-id');const it=selected();drag={id:it.id,start:p,x:it.x,y:it.y};$('stageWrap').classList.add('drag-cursor');stage.setPointerCapture(e.pointerId);render();syncInspector();}else{state.selectedId=null;render();syncInspector();}
    });
    stage.addEventListener('pointermove',e=>{
      const p=clientToStage(e);
      if(pen){pen.points.push(p);$('livePenPath').setAttribute('d',catmullPath(pen.points));return;}
      if(drag){const it=selected();if(!it)return;it.x=snap(drag.x+p.x-drag.start.x);it.y=snap(drag.y+p.y-drag.start.y);render();syncInspector();}
    });
    stage.addEventListener('pointerup',e=>{
      if(pen){const pts=pen.points;pen=null;$('livePenPath').setAttribute('opacity','0');addPenFromPoints(pts);}
      if(drag){drag=null;$('stageWrap').classList.remove('drag-cursor');pushHistory();}
      try{stage.releasePointerCapture(e.pointerId)}catch{}
    });
  }

  function deleteSelected(){const i=state.items.findIndex(x=>x.id===state.selectedId);if(i<0)return;state.items.splice(i,1);state.selectedId=null;pushHistory();render();syncInspector();}
  function duplicateSelected(){const it=selected();if(!it)return;const c=clone(it);c.id=uid();c.x+=8;c.y+=8;state.items.push(c);state.selectedId=c.id;pushHistory();render();syncInspector();}
  function moveLayer(dir){const i=state.items.findIndex(x=>x.id===state.selectedId);if(i<0)return;const j=clamp(i+dir,0,state.items.length-1);if(i===j)return;const [it]=state.items.splice(i,1);state.items.splice(j,0,it);pushHistory();render();}
  function align(action){const it=selected();if(!it)return;if(action==='centerX')it.x=(W-it.w)/2;if(action==='centerY')it.y=(H-it.h)/2;if(action==='cover'){const r=Math.max(W/it.w,H/it.h);it.w*=r;it.h*=r;it.x=(W-it.w)/2;it.y=(H-it.h)/2;}pushHistory();render();syncInspector();}

  function cleanSvgForExport(){
    const cloneSvg=stage.cloneNode(true);cloneSvg.querySelector('#selectionLayer')?.remove();cloneSvg.querySelector('#guideLayer')?.remove();cloneSvg.querySelector('#gridLayer')?.remove();cloneSvg.querySelector('#livePenPath')?.remove();cloneSvg.setAttribute('width',W);cloneSvg.setAttribute('height',H);cloneSvg.style.width='';cloneSvg.style.height='';cloneSvg.removeAttribute('aria-label');return cloneSvg;
  }
  function svgString(){const s=cleanSvgForExport();return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(s);}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},600);}
  function exportSvg(){downloadBlob(new Blob([svgString()],{type:'image/svg+xml;charset=utf-8'}),'cute-badge-293x164.svg');showToast('SVG를 저장했어요.');}
  function exportPng(){
    const src=svgString();const blob=new Blob([src],{type:'image/svg+xml'});const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);URL.revokeObjectURL(url);c.toBlob(b=>{downloadBlob(b,'cute-badge-293x164.png');showToast('293×164 PNG로 저장했어요.');},'image/png');};img.onerror=()=>{URL.revokeObjectURL(url);showToast('PNG 변환 중 오류가 발생했어요.');};img.src=url;
  }
  function saveProject(){const data={app:'Cute Badge Background Studio',version:'1.0',canvas:{width:W,height:H},state:{bg:state.bg,transparent:state.transparent,items:state.items}};downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'cute-badge-project.json');}
  function openProject(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.state||!Array.isArray(d.state.items))throw 0;state.bg=d.state.bg||'#ffffff';state.transparent=!!d.state.transparent;state.items=d.state.items;state.selectedId=state.items[0]?.id||null;history=[];historyIndex=-1;pushHistory();syncAll();showToast('프로젝트를 불러왔어요.');}catch{showToast('올바른 프로젝트 파일이 아니에요.');}};r.readAsText(file);}

  function bindUI(){
    $('undoBtn').onclick=()=>restoreHistory(historyIndex-1);$('redoBtn').onclick=()=>restoreHistory(historyIndex+1);
    $('exportSvgBtn').onclick=exportSvg;$('exportPngBtn').onclick=exportPng;$('saveProjectBtn').onclick=saveProject;$('openProjectInput').onchange=e=>{if(e.target.files[0])openProject(e.target.files[0]);e.target.value='';};
    $('canvasBgColor').oninput=e=>{state.bg=e.target.value;render();};$('canvasBgColor').onchange=pushHistory;$('transparentBg').onchange=e=>{state.transparent=e.target.checked;pushHistory();render();};
    $('gridToggle').onchange=e=>{state.grid=e.target.checked;render();};$('safeToggle').onchange=e=>{state.safe=e.target.checked;render();};$('snapToggle').onchange=e=>{state.snap=e.target.checked;};
    $('zoomRange').oninput=e=>{state.zoom=+e.target.value/100;applyZoom();};$('zoomOutBtn').onclick=()=>{state.zoom=clamp(state.zoom-.25,.75,3);applyZoom();};$('zoomInBtn').onclick=()=>{state.zoom=clamp(state.zoom+.25,.75,3);applyZoom();};$('fitBtn').onclick=fitStage;
    $('toolModeGroup').onclick=e=>{const b=e.target.closest('[data-tool]');if(!b)return;state.tool=b.dataset.tool;updateToolButtons();};
    $('deleteBtn').onclick=deleteSelected;$('duplicateBtn').onclick=duplicateSelected;$('layerUpBtn').onclick=()=>moveLayer(1);$('layerDownBtn').onclick=()=>moveLayer(-1);document.querySelector('.quick-align').onclick=e=>{const b=e.target.closest('[data-align]');if(b)align(b.dataset.align);};
    window.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?restoreHistory(historyIndex+1):restoreHistory(historyIndex-1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restoreHistory(historyIndex+1);}if(e.key==='Delete'||e.key==='Backspace')deleteSelected();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();}});
    window.addEventListener('resize',()=>{});
  }

  function init(){buildAssetLists();bindInspector();bindStage();bindUI();pushHistory();syncAll();setTimeout(fitStage,50);}
  init();
})();
