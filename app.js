(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 293, H = 164;
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const artLayer = $('artLayer');
  const defs = $('svgDefs');
  const selectionLayer = $('selectionLayer');
  const gridLayer = $('gridLayer');
  const guideLayer = $('guideLayer');
  const stampPreviewLayer = $('stampPreviewLayer');

  const SHAPES = [
    ['rounded','둥근 네모'],['softrect','말랑 네모'],['arch','둥근 윗면'],['topsoft','윗면 살짝 둥근'],
    ['wideheart','가로 하트'],['oval','타원'],['pill','캡슐'],['cloud','구름'],
    ['wavetop','윗 파도'],['wavebottom','아랫 파도'],['blob','몽글 블롭'],['scallop','물결 테두리'],
    ['ticket','티켓'],['shield','배지'],['brush','파스텔 붓'],['ribbonpanel','리본 패널'],
    ['handblob','손그림 블롭'],['wobblyrect','손그림 네모'],['paintcloud','붓 구름'],['roughoval','삐뚤 타원'],
    ['wavybadge','물결 배지'],['softheart','손그림 하트'],['tornlabel','찢은 라벨'],['bubblepanel','말랑 패널']
  ];

  const STAMPS = [
    ['heart','하트'],['heartline','선 하트'],['star','별'],['sparkle','반짝이'],
    ['circle','동그라미'],['ring','링'],['dots','세 점'],['flower','꽃'],
    ['squiggle','꼬불선'],['ray','빛살'],['diamond','마름별'],['bubble','말풍선'],
    ['bow','리본'],['tinyheart','미니 하트'],['crosssparkle','십자 반짝'],['wave','물결선'],
    ['leaf','잎사귀'],['spiral','빙글선'],['drop','물방울'],['petal','꽃잎']
  ];

  const LINE_STAMPS = new Set(['heartline','ring','squiggle','ray','wave','spiral']);

  const PRESETS = [
    {name:'하늘 스티치', colors:['#e9f7ff','#a8def6','#5e8fb0'], shape:'softrect', pattern:'dots', inner:true},
    {name:'딸기 하트', colors:['#fff0f5','#f5b8cc','#b76883'], shape:'wideheart', pattern:'tinyhearts', inner:true},
    {name:'레몬 물결', colors:['#fff9d8','#f0d778','#9f8540'], shape:'wavybadge', pattern:'sparkles', inner:true},
    {name:'라벤더 버블', colors:['#f3efff','#cdc3f3','#776ca7'], shape:'bubblepanel', pattern:'dots', inner:false},
    {name:'민트 피크닉', colors:['#eff9df','#bcdf91','#6e9667'], shape:'roughoval', pattern:'grid', inner:true},
    {name:'체리 낙서', colors:['#ffe5e2','#ef918d','#a8454d'], shape:'handblob', pattern:'confetti', inner:false},
    {name:'블루 아치', colors:['#e7f3ff','#aecfec','#5f7f9e'], shape:'arch', pattern:'sparkles', inner:true},
    {name:'피치 파스텔', colors:['#fff0e7','#f2b8a3','#ad715f'], shape:'brush', pattern:'none', inner:false},
    {name:'네이비 리본', colors:['#eef0fb','#a9b3dd','#58658c'], shape:'ribbonpanel', pattern:'dots', inner:true},
    {name:'크림 별빛', colors:['#fff8df','#f3dda0','#9d8249'], shape:'topsoft', pattern:'sparkles', inner:true},
    {name:'핑크 구름', colors:['#fff0f7','#f2c0d5','#aa6d88'], shape:'paintcloud', pattern:'tinyhearts', inner:false},
    {name:'스카이 파도', colors:['#eef9ff','#b6e1ef','#648aa1'], shape:'wavetop', pattern:'stripes', inner:true}
  ];

  const DEFAULT_STROKES = () => [
    {color:'#ffffff', width:4.5},
    {color:'#80758b', width:1.7}
  ];

  let state = {
    bg:'#ffffff', transparent:false, zoom:2,
    grid:false, safe:false, snap:false, tool:'select',
    stampBrush:{type:'heart',fill:'#fff7fb',stroke:'#8f7894',strokeWidth:2,size:26,rotation:0},
    items:[], selectedId:null
  };

  let history = [], historyIndex = -1, restoring = false;
  let gesture = null, pen = null, toastTimer = null, lastPointer = null;

  function uid(){ return 'i_' + Math.random().toString(36).slice(2,10); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function snap(v){ return state.snap ? Math.round(v/2)*2 : v; }
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function svgEl(tag, attrs={}){ const el=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v))); return el; }
  function selected(){ return state.items.find(x=>x.id===state.selectedId) || null; }
  function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1700); }
  function setStatus(msg){ $('statusText').textContent=msg; }

  function pushHistory(){
    if(restoring) return;
    const snapshot=JSON.stringify({bg:state.bg,transparent:state.transparent,items:state.items,selectedId:state.selectedId});
    if(history[historyIndex]===snapshot) return;
    history=history.slice(0,historyIndex+1);
    history.push(snapshot);
    if(history.length>80){ history.shift(); historyIndex=79; }
    else historyIndex++;
    updateUndoRedo();
  }
  function restoreHistory(idx){
    if(idx<0||idx>=history.length) return;
    restoring=true;
    const s=JSON.parse(history[idx]);
    state.bg=s.bg; state.transparent=s.transparent; state.items=s.items.map(normalizeItem); state.selectedId=s.selectedId;
    historyIndex=idx; restoring=false; syncAll(); updateUndoRedo();
  }
  function updateUndoRedo(){ $('undoBtn').disabled=historyIndex<=0; $('redoBtn').disabled=historyIndex>=history.length-1; }

  function makeBase(type, kind='shape'){
    return {
      id:uid(), kind, type, x:35, y:22, w:223, h:120, rotation:0,
      fillMode:'solid', fillA:'#dff4ff', fillB:'#a7dff4', gradAngle:20, gradStart:0, gradEnd:100,
      lineWidth:3,
      strokes:DEFAULT_STROKES(),
      shade:{enabled:false,color:'#655c76',opacity:18,angle:135},
      pattern:{mode:'none',color:'#5f5a70',opacity:18,scale:10},
      innerLine:{enabled:false,color:'#ffffff',width:1.5,dash:5,gap:4,inset:6},
      shadow:{enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:2}
    };
  }

  function normalizeItem(it){
    const out={...it};
    out.rotation=Number(out.rotation)||0;
    out.w=Math.max(1,Number(out.w)||32); out.h=Math.max(1,Number(out.h)||32);
    if(out.kind!=='pen'){
      out.fillMode=out.fillMode||'solid'; out.fillA=out.fillA||'#dff4ff'; out.fillB=out.fillB||out.fillA;
      out.gradAngle=Number(out.gradAngle)||0; out.gradStart=Number.isFinite(+out.gradStart)?+out.gradStart:0; out.gradEnd=Number.isFinite(+out.gradEnd)?+out.gradEnd:100;
      out.lineWidth=Number(out.lineWidth)||3;
      out.strokes=Array.isArray(out.strokes)?out.strokes.map(s=>({color:s.color||'#ffffff',width:Math.max(0,+s.width||0)})):DEFAULT_STROKES();
      out.shade={enabled:false,color:'#655c76',opacity:18,angle:135,...out.shade};
      out.pattern={mode:'none',color:'#5f5a70',opacity:18,scale:10,...out.pattern};
      out.innerLine={enabled:false,color:'#ffffff',width:1.5,dash:5,gap:4,inset:6,...out.innerLine};
      out.shadow={enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:2,...out.shadow};
    }
    return out;
  }

  function addShape(type){
    const it=makeBase(type,'shape');
    if(type==='wideheart'||type==='softheart'){it.y=28;it.h=114;}
    if(type==='oval'||type==='roughoval'){it.x=43;it.y=27;it.w=207;it.h=110;}
    if(type==='brush'||type==='paintcloud'){it.x=24;it.y=29;it.w=245;it.h=108;it.fillMode='pastel';it.strokes=[{color:'#ffffff',width:3}];}
    if(type==='handblob'||type==='wobblyrect'||type==='tornlabel'){it.fillMode='pastel';it.fillA='#f2eeff';it.fillB='#cfc8ef';}
    state.items.push(it); state.selectedId=it.id; state.tool='select'; pushHistory(); syncAll(); setStatus('도형을 선택했습니다. 손잡이를 끌어 크기를 조절하세요.');
  }

  function createStampItem(type,x,y,brush=state.stampBrush){
    const it=makeBase(type,'stamp');
    let w=brush.size, h=brush.size;
    if(type==='squiggle'||type==='wave'){w=brush.size*1.65;h=brush.size*.72;}
    if(type==='ray'){w=brush.size*1.15;h=brush.size*1.15;}
    if(type==='bubble'){w=brush.size*1.35;h=brush.size;}
    it.x=x-w/2; it.y=y-h/2; it.w=w; it.h=h; it.rotation=brush.rotation;
    it.fillA=brush.fill; it.fillB=brush.fill; it.fillMode='solid'; it.lineWidth=Math.max(1.2,brush.strokeWidth+1.3);
    it.strokes=brush.strokeWidth>0?[{color:brush.stroke,width:brush.strokeWidth}]:[];
    it.shade.enabled=false; it.pattern.mode='none'; it.innerLine.enabled=false; it.shadow.enabled=false;
    return it;
  }

  function stampAt(x,y){
    if(!state.stampBrush.type) return;
    const it=createStampItem(state.stampBrush.type,x,y);
    state.items.push(it); state.selectedId=it.id; pushHistory(); render(); syncInspector(); updateStampGhost(lastPointer); setStatus('스탬프를 찍었습니다. 계속 클릭하면 같은 설정으로 반복됩니다.');
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
      ribbonpanel:'M0,15 L10,3 L18,14 H82 L90,3 L100,15 L94,28 V100 H6 V28 Z',
      handblob:'M7,23 C13,6 30,10 40,4 C53,-3 67,5 76,8 C92,9 99,22 94,35 C103,47 96,59 99,72 C101,85 90,97 74,94 C63,103 50,94 39,98 C23,102 14,92 16,82 C1,77 -3,63 5,52 C-2,40 1,30 7,23 Z',
      wobblyrect:'M10,4 C25,0 36,5 48,2 C64,-1 77,4 91,2 C98,8 96,18 99,30 C102,45 96,55 99,68 C101,81 97,92 89,98 C75,96 62,101 50,98 C35,96 22,102 8,96 C3,87 6,76 2,66 C-2,52 5,42 2,29 C0,18 2,9 10,4 Z',
      paintcloud:'M7,41 C-1,28 8,16 22,20 C22,7 39,1 48,12 C60,-2 78,4 80,18 C96,15 104,28 97,41 C107,49 100,65 87,64 C91,78 76,88 64,82 C56,96 38,95 31,82 C17,89 4,80 9,67 C-3,62 -3,47 7,41 Z',
      roughoval:'M49,2 C71,-2 94,12 98,35 C103,58 91,84 70,95 C49,105 19,98 7,79 C-6,60 2,31 17,15 C26,6 38,3 49,2 Z',
      wavybadge:'M8,5 C16,-1 23,7 30,4 C39,0 46,7 54,3 C63,-1 71,8 79,4 C89,0 97,8 95,18 C102,25 96,34 99,42 C102,52 95,59 99,68 C102,78 95,86 91,94 C82,101 74,94 66,97 C57,101 49,95 41,98 C31,101 24,94 16,97 C6,99 0,91 4,82 C-2,74 5,65 2,57 C-2,47 6,40 2,31 C-1,21 3,12 8,5 Z',
      softheart:'M50,96 C43,86 14,72 8,48 C3,29 12,13 29,12 C40,11 47,17 51,27 C56,16 64,11 75,13 C93,16 100,34 92,51 C82,72 61,86 50,96 Z',
      tornlabel:'M3,11 L13,5 L22,9 L31,3 L42,8 L51,4 L60,9 L70,3 L80,8 L91,4 L98,11 L95,22 L99,31 L95,42 L99,52 L95,63 L99,74 L95,85 L98,96 L87,92 L77,98 L66,93 L56,98 L45,93 L34,98 L24,93 L13,98 L3,93 L6,82 L2,72 L6,61 L2,51 L6,40 L2,29 L6,20 Z',
      bubblepanel:'M16,4 C30,-1 42,4 50,2 C61,0 72,4 84,3 C96,4 100,14 98,25 C102,37 97,48 100,59 C103,72 96,82 98,91 C89,99 78,96 68,99 C57,102 48,97 39,100 C27,102 18,97 8,98 C1,90 4,80 2,70 C-1,58 4,50 2,39 C0,28 2,15 8,8 C10,6 13,5 16,4 Z'
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
      bubble:'M8,14 Q8,5 18,5 H82 Q92,5 92,14 V66 Q92,75 82,75 H54 L36,94 L39,75 H18 Q8,75 8,66 Z',
      bow:'M49,43 C34,20 13,20 13,39 C13,56 33,58 49,48 L49,43 Z M51,43 C66,20 87,20 87,39 C87,56 67,58 51,48 Z M44,42 Q50,37 56,42 L55,55 Q50,60 45,55 Z M45,54 L32,86 L50,72 L68,86 L55,54 Z',
      tinyheart:'M50,84 C39,71 19,58 19,39 C19,24 29,17 39,18 C46,18 49,23 50,30 C51,23 54,18 61,18 C71,17 81,24 81,39 C81,58 61,71 50,84 Z',
      crosssparkle:'M50,5 C53,32 60,41 86,50 C60,59 53,68 50,95 C47,68 40,59 14,50 C40,41 47,32 50,5 Z M17,16 C18,25 22,29 31,31 C22,33 18,37 17,46 C16,37 12,33 3,31 C12,29 16,25 17,16 Z',
      wave:'M3,55 C15,35 26,72 39,50 C52,28 64,69 78,47 C87,34 93,38 98,48',
      leaf:'M50,91 C22,77 13,51 26,30 C38,11 63,8 83,13 C82,35 77,62 50,91 Z M49,88 C51,62 59,40 77,19',
      spiral:'M54,50 C54,40 41,40 40,50 C39,64 57,69 69,58 C84,44 73,22 51,20 C25,17 9,38 14,62 C20,89 51,98 76,84',
      drop:'M50,6 C65,30 82,49 82,67 C82,84 68,96 50,96 C32,96 18,84 18,67 C18,49 35,30 50,6 Z',
      petal:'M50,5 C72,18 89,38 84,59 C80,78 64,90 50,96 C35,89 19,78 16,59 C12,38 28,18 50,5 Z'
    };
    return p[type]||p.heart;
  }

  function iconSvg(kind,type){
    const d=kind==='shape'?pathFor(type):stampPath(type);
    const line=kind==='stamp'&&LINE_STAMPS.has(type);
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" fill="${line?'none':'#efeafd'}" stroke="#776a91" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function buildAssetLists(){
    $('shapeList').innerHTML=SHAPES.map(([id,name])=>`<button class="asset-btn" data-shape="${id}">${iconSvg('shape',id)}<span>${esc(name)}</span></button>`).join('');
    $('stampList').innerHTML=STAMPS.map(([id,name])=>`<button class="asset-btn" data-stamp="${id}">${iconSvg('stamp',id)}<span>${esc(name)}</span></button>`).join('');
    $('presetList').innerHTML=PRESETS.map((p,i)=>`<button class="preset-card" data-preset="${i}"><span class="preset-preview" style="background:linear-gradient(135deg,${p.colors[0]},${p.colors[1]})"></span><span class="preset-name">${esc(p.name)}</span></button>`).join('');

    $('shapeList').addEventListener('click',e=>{const b=e.target.closest('[data-shape]');if(b)addShape(b.dataset.shape);});
    $('stampList').addEventListener('click',e=>{const b=e.target.closest('[data-stamp]');if(b)activateStamp(b.dataset.stamp);});
    $('presetList').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)applyPreset(+b.dataset.preset);});
  }

  function activateStamp(type){
    state.stampBrush.type=type; state.tool='stamp';
    const name=STAMPS.find(x=>x[0]===type)?.[1]||'스탬프';
    $('activeStampName').textContent=name;
    syncStampUI(); updateToolButtons(); updateStampGhost(lastPointer);
    setStatus(`${name} 찍기 모드: 미리보기에서 원하는 위치를 클릭하세요.`);
  }

  function applyPreset(index){
    const p=PRESETS[index]; state.bg='#ffffff'; state.transparent=false; state.items=[]; state.tool='select';
    const base=makeBase(p.shape,'shape'); base.x=21;base.y=17;base.w=251;base.h=133;base.fillMode=p.shape==='brush'?'pastel':'linear';base.fillA=p.colors[0];base.fillB=p.colors[1];base.gradAngle=25;base.strokes=[{color:'#ffffff',width:4.8},{color:p.colors[2],width:1.8}];base.pattern={mode:p.pattern,color:p.colors[2],opacity:17,scale:12};base.innerLine.enabled=!!p.inner;base.innerLine.color='#ffffff';base.innerLine.width=1.25;base.innerLine.dash=5;base.innerLine.gap=4;base.shadow={enabled:true,color:p.colors[2],opacity:12,x:1.5,y:2.2,blur:1.8};state.items.push(base);
    const stamps=[['sparkle',30,27,15],['heartline',260,31,17],['circle',25,131,9],['star',268,128,13],['dots',73,23,12],['crosssparkle',246,126,10]];
    stamps.forEach(([t,cx,cy,s],k)=>{const it=createStampItem(t,cx,cy,{type:t,fill:k%2?p.colors[1]:'#fffefe',stroke:p.colors[2],strokeWidth:1.2,size:s,rotation:k%2?10:-8});state.items.push(it);});
    state.selectedId=base.id; pushHistory(); syncAll(); showToast(`${p.name} 프리셋 적용`); setStatus('프리셋을 적용했습니다. 선택된 배경 도형을 손잡이로 바로 조절할 수 있어요.');
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
      const g=svgEl('radialGradient',{id,cx:'50%',cy:'45%',r:'70%'});
      g.append(svgEl('stop',{offset:(item.gradStart??0)+'%','stop-color':item.fillA}));
      g.append(svgEl('stop',{offset:(item.gradEnd??100)+'%','stop-color':item.fillB})); addDef(g);
    }
    return `url(#${id})`;
  }

  function createPastelFilter(item){
    if(item.fillMode!=='pastel') return null;
    const id='pastel_'+item.id;
    const f=svgEl('filter',{id,x:'-15%',y:'-15%',width:'130%',height:'130%'});
    const turb=svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:'0.032',numOctaves:'3',seed:String((item.id.charCodeAt(2)||3)%19+1),result:'noise'});
    const disp=svgEl('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:'1.4',xChannelSelector:'R',yChannelSelector:'G',result:'disp'});
    const blur=svgEl('feGaussianBlur',{in:'disp',stdDeviation:'0.12',result:'soft'});
    f.append(turb,disp,blur); addDef(f); return `url(#${id})`;
  }

  function createPatternDef(item){
    if(!item.pattern||item.pattern.mode==='none') return null;
    const id='pat_'+item.id, s=+item.pattern.scale||10, color=item.pattern.color, op=(+item.pattern.opacity||20)/100;
    const p=svgEl('pattern',{id,patternUnits:'userSpaceOnUse',width:s,height:s});
    if(item.pattern.mode==='dots') p.append(svgEl('circle',{cx:s/2,cy:s/2,r:Math.max(1,s*.12),fill:color,opacity:op}));
    if(item.pattern.mode==='stripes'){ p.setAttribute('patternTransform','rotate(35)'); p.append(svgEl('line',{x1:0,y1:0,x2:0,y2:s,stroke:color,'stroke-width':Math.max(1,s*.16),opacity:op})); }
    if(item.pattern.mode==='grid') p.append(svgEl('path',{d:`M0 0 H${s} M0 0 V${s}`,stroke:color,'stroke-width':Math.max(.5,s*.08),opacity:op,fill:'none'}));
    if(item.pattern.mode==='sparkles') p.append(svgEl('path',{d:`M${s/2} ${s*.15} C${s*.53} ${s*.4} ${s*.62} ${s*.47} ${s*.85} ${s*.5} C${s*.62} ${s*.53} ${s*.53} ${s*.6} ${s/2} ${s*.85} C${s*.47} ${s*.6} ${s*.38} ${s*.53} ${s*.15} ${s*.5} C${s*.38} ${s*.47} ${s*.47} ${s*.4} ${s/2} ${s*.15} Z`,fill:color,opacity:op}));
    if(item.pattern.mode==='tinyhearts') p.append(svgEl('path',{d:`M${s*.5} ${s*.78} C${s*.42} ${s*.67} ${s*.2} ${s*.55} ${s*.24} ${s*.34} C${s*.27} ${s*.2} ${s*.44} ${s*.2} ${s*.5} ${s*.35} C${s*.56} ${s*.2} ${s*.73} ${s*.2} ${s*.76} ${s*.34} C${s*.8} ${s*.55} ${s*.58} ${s*.67} ${s*.5} ${s*.78} Z`,fill:color,opacity:op}));
    if(item.pattern.mode==='confetti'){
      p.append(svgEl('line',{x1:s*.18,y1:s*.24,x2:s*.42,y2:s*.42,stroke:color,'stroke-width':Math.max(1,s*.09),opacity:op,'stroke-linecap':'round'}));
      p.append(svgEl('line',{x1:s*.68,y1:s*.6,x2:s*.86,y2:s*.38,stroke:color,'stroke-width':Math.max(1,s*.09),opacity:op,'stroke-linecap':'round'}));
    }
    addDef(p); return `url(#${id})`;
  }

  function createShadeDef(item){
    if(!item.shade?.enabled) return null;
    const id='shade_'+item.id; const rad=(item.shade.angle||0)*Math.PI/180,x=Math.cos(rad),y=Math.sin(rad);
    const g=svgEl('linearGradient',{id,x1:(50-50*x)+'%',y1:(50-50*y)+'%',x2:(50+50*x)+'%',y2:(50+50*y)+'%'});
    g.append(svgEl('stop',{offset:'0%','stop-color':item.shade.color,'stop-opacity':'0'}));
    g.append(svgEl('stop',{offset:'100%','stop-color':item.shade.color,'stop-opacity':(+item.shade.opacity||0)/100})); addDef(g); return `url(#${id})`;
  }

  function createBlurFilter(item){
    if(!item.shadow?.enabled || +item.shadow.blur<=0) return null;
    const id='blur_'+item.id;
    const f=svgEl('filter',{id,x:'-30%',y:'-30%',width:'160%',height:'160%'});
    f.append(svgEl('feGaussianBlur',{stdDeviation:+item.shadow.blur||0})); addDef(f); return `url(#${id})`;
  }

  function itemPath(item){ return item.kind==='shape'?pathFor(item.type):item.kind==='stamp'?stampPath(item.type):item.d; }

  function appendOutlineBands(g,d,item,lineMode=false){
    const strokes=item.strokes||[];
    const base=lineMode?(+item.lineWidth||3):0;
    for(let i=0;i<strokes.length;i++){
      let cumulative=0;
      for(let j=i;j<strokes.length;j++) cumulative+=Math.max(0,+strokes[j].width||0);
      const sw=lineMode ? base + cumulative*2 : cumulative*2;
      if(sw<=0) continue;
      g.append(svgEl('path',{d,fill:'none',stroke:strokes[i].color,'stroke-width':sw,'stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke'}));
    }
  }

  function render(){
    clearDefs(); artLayer.innerHTML=''; selectionLayer.innerHTML=''; stampPreviewLayer.innerHTML='';
    $('canvasBackground').setAttribute('fill',state.transparent?'none':state.bg);
    renderGridGuides();

    for(const item of state.items){
      const g=svgEl('g',{'data-id':item.id,transform:`translate(${item.x} ${item.y}) rotate(${item.rotation||0} ${item.w/2} ${item.h/2}) scale(${item.w/100} ${item.h/100})`});
      g.style.cursor=state.tool==='select'?'move':'crosshair';
      if(item.kind==='pen'){
        const p=svgEl('path',{d:item.d,fill:'none',stroke:item.color,'stroke-width':item.width,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':`${item.dash} ${item.gap}`,'vector-effect':'non-scaling-stroke'}); g.append(p);
      } else {
        const d=itemPath(item), lineMode=item.kind==='stamp'&&LINE_STAMPS.has(item.type);
        const fill=createFillDef(item), pastel=createPastelFilter(item), patt=createPatternDef(item), shade=createShadeDef(item), blur=createBlurFilter(item);

        if(item.shadow?.enabled){
          const sh=svgEl('path',{d,fill:lineMode?'none':item.shadow.color,stroke:lineMode?item.shadow.color:'none','stroke-width':lineMode?(item.lineWidth||3):0,opacity:(+item.shadow.opacity||0)/100,transform:`translate(${+item.shadow.x||0} ${+item.shadow.y||0})`,'stroke-linecap':'round','stroke-linejoin':'round'});
          if(blur) sh.setAttribute('filter',blur); g.append(sh);
        }

        appendOutlineBands(g,d,item,lineMode);

        if(lineMode){
          const baseLine=svgEl('path',{d,fill:'none',stroke:item.fillA,'stroke-width':item.lineWidth||3,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}); g.append(baseLine);
        } else {
          const base=svgEl('path',{d,fill,stroke:'none'}); if(pastel) base.setAttribute('filter',pastel); g.append(base);
          if(patt) g.append(svgEl('path',{d,fill:patt,stroke:'none'}));
          if(shade){ const sh=svgEl('path',{d,fill:shade,stroke:'none'}); sh.style.mixBlendMode='multiply'; g.append(sh); }
          if(item.innerLine?.enabled){
            const ins=clamp(+item.innerLine.inset||6,1,28), sc=(100-ins*2)/100;
            const inner=svgEl('path',{d,fill:'none',stroke:item.innerLine.color,'stroke-width':item.innerLine.width,'stroke-dasharray':`${item.innerLine.dash} ${item.innerLine.gap}`,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke',transform:`translate(${ins} ${ins}) scale(${sc} ${sc})`}); g.append(inner);
          }
        }
      }
      artLayer.append(g);
    }

    renderSelection();
    updateStampGhost(lastPointer);
  }

  function renderGridGuides(){
    gridLayer.innerHTML=''; guideLayer.innerHTML='';
    if(state.grid){
      for(let x=0;x<=W;x+=10) gridLayer.append(svgEl('line',{x1:x,y1:0,x2:x,y2:H,class:'grid-line'}));
      for(let y=0;y<=H;y+=10) gridLayer.append(svgEl('line',{x1:0,y1:y,x2:W,y2:y,class:'grid-line'}));
    }
    if(state.safe) guideLayer.append(svgEl('rect',{x:8,y:8,width:W-16,height:H-16,rx:6,class:'safe-guide'}));
  }

  function renderSelection(){
    const it=selected(); if(!it || state.tool!=='select') return;
    const g=svgEl('g',{transform:`translate(${it.x} ${it.y}) rotate(${it.rotation||0} ${it.w/2} ${it.h/2})`});
    g.append(svgEl('rect',{x:0,y:0,width:it.w,height:it.h,class:'select-box'}));
    const handles=[['nw',0,0],['n',it.w/2,0],['ne',it.w,0],['e',it.w,it.h/2],['se',it.w,it.h],['s',it.w/2,it.h],['sw',0,it.h],['w',0,it.h/2]];
    handles.forEach(([h,x,y])=>g.append(svgEl('circle',{cx:x,cy:y,r:2.7,class:'resize-handle','data-handle':h,'data-id':it.id})));
    g.append(svgEl('line',{x1:it.w/2,y1:0,x2:it.w/2,y2:-11,class:'rotate-stem'}));
    g.append(svgEl('circle',{cx:it.w/2,cy:-13,r:3.1,class:'rotate-handle','data-handle':'rotate','data-id':it.id}));
    selectionLayer.append(g);
  }

  function updateStampGhost(p){
    stampPreviewLayer.innerHTML='';
    if(state.tool!=='stamp'||!state.stampBrush.type||!p) return;
    const it=createStampItem(state.stampBrush.type,p.x,p.y);
    const lineMode=LINE_STAMPS.has(it.type);
    const g=svgEl('g',{class:'stamp-ghost',transform:`translate(${it.x} ${it.y}) rotate(${it.rotation||0} ${it.w/2} ${it.h/2}) scale(${it.w/100} ${it.h/100})`});
    const d=stampPath(it.type); appendOutlineBands(g,d,it,lineMode);
    if(lineMode) g.append(svgEl('path',{d,fill:'none',stroke:it.fillA,'stroke-width':it.lineWidth,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}));
    else g.append(svgEl('path',{d,fill:it.fillA,stroke:'none'}));
    stampPreviewLayer.append(g);
  }

  function applyZoom(){
    $('stageWrap').style.width=(W*state.zoom)+'px'; $('stageWrap').style.height=(H*state.zoom)+'px';
    stage.style.width=(W*state.zoom)+'px'; stage.style.height=(H*state.zoom)+'px';
    $('zoomRange').value=Math.round(state.zoom*100); $('zoomLabel').textContent=Math.round(state.zoom*100)+'%';
  }
  function fitStage(){
    const vp=$('stageViewport'); const z=Math.min((vp.clientWidth-70)/W,(vp.clientHeight-70)/H,3);
    state.zoom=clamp(Math.floor(z*4)/4,.75,3); applyZoom();
  }
  function clientToStage(e){ const r=stage.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}; }

  function syncAll(){
    $('canvasBgColor').value=state.bg; $('transparentBg').checked=state.transparent; $('gridToggle').checked=state.grid; $('safeToggle').checked=state.safe; $('snapToggle').checked=state.snap;
    applyZoom(); render(); syncInspector(); syncStampUI(); updateToolButtons();
  }

  function syncStampUI(){
    const b=state.stampBrush;
    $('stampFillColor').value=b.fill; $('stampStrokeColor').value=b.stroke; $('stampStrokeWidth').value=b.strokeWidth; $('stampSize').value=b.size; $('stampRotation').value=b.rotation; $('stampRotationValue').textContent=b.rotation+'°';
    $('stampSettings').classList.toggle('hidden',state.tool!=='stamp'); $('stampToolBadge').classList.toggle('hidden',state.tool!=='stamp');
    document.querySelectorAll('#stampList [data-stamp]').forEach(btn=>btn.classList.toggle('active',state.tool==='stamp'&&btn.dataset.stamp===b.type));
  }

  function syncInspector(){
    const it=selected();
    $('emptyInspector').classList.toggle('hidden',!!it); $('inspector').classList.toggle('hidden',!it); if(!it) return;
    $('selectedTypeBadge').textContent=it.kind==='shape'?'도형':it.kind==='stamp'?'스탬프':'점선 펜';
    $('posX').value=(+it.x).toFixed(1).replace('.0',''); $('posY').value=(+it.y).toFixed(1).replace('.0','');
    $('sizeReadout').textContent=`크기 ${(+it.w).toFixed(1).replace('.0','')} × ${(+it.h).toFixed(1).replace('.0','')}`;
    $('rotation').value=it.rotation||0; $('rotationValue').textContent=Math.round((it.rotation||0)*10)/10+'°';

    const normal=it.kind!=='pen';
    $('fillSection').classList.toggle('hidden',!normal); $('strokeSection').classList.toggle('hidden',!normal); $('effectsSection').classList.toggle('hidden',!normal);
    $('penInspectorSection').classList.toggle('hidden',it.kind!=='pen');
    $('lineStampSection').classList.toggle('hidden',!(it.kind==='stamp'&&LINE_STAMPS.has(it.type)));

    if(it.kind==='pen'){
      $('selectedPenColor').value=it.color; $('selectedPenWidth').value=it.width; $('selectedPenDash').value=it.dash; $('selectedPenGap').value=it.gap; return;
    }

    $('fillMode').value=it.fillMode; $('fillA').value=it.fillA; $('fillB').value=it.fillB;
    $('gradientAngle').value=it.gradAngle; $('gradientAngleValue').textContent=it.gradAngle+'°'; $('gradientStart').value=it.gradStart; $('gradientEnd').value=it.gradEnd;
    $('gradientAngleRow').classList.toggle('hidden',it.fillMode==='solid'||it.fillMode==='radial'); $('gradientRangeRow').classList.toggle('hidden',it.fillMode==='solid');

    $('shadeEnabled').checked=it.shade.enabled; $('shadeControls').classList.toggle('hidden',!it.shade.enabled); $('shadeColor').value=it.shade.color; $('shadeOpacity').value=it.shade.opacity; $('shadeAngle').value=it.shade.angle; $('shadeAngleValue').textContent=it.shade.angle+'°';
    $('patternMode').value=it.pattern.mode; $('patternControls').classList.toggle('hidden',it.pattern.mode==='none'); $('patternColor').value=it.pattern.color; $('patternOpacity').value=it.pattern.opacity; $('patternScale').value=it.pattern.scale; $('patternScaleValue').textContent=it.pattern.scale;
    $('innerLineEnabled').checked=it.innerLine.enabled; $('innerLineControls').classList.toggle('hidden',!it.innerLine.enabled); $('innerLineColor').value=it.innerLine.color; $('innerLineWidth').value=it.innerLine.width; $('innerLineDash').value=it.innerLine.dash; $('innerLineGap').value=it.innerLine.gap; $('innerLineInset').value=it.innerLine.inset;
    $('shadowEnabled').checked=it.shadow.enabled; $('shadowControls').classList.toggle('hidden',!it.shadow.enabled); $('shadowColor').value=it.shadow.color; $('shadowOpacity').value=it.shadow.opacity; $('shadowX').value=it.shadow.x; $('shadowY').value=it.shadow.y; $('shadowBlur').value=it.shadow.blur;
    if(it.kind==='stamp'&&LINE_STAMPS.has(it.type)){ $('lineColor').value=it.fillA; $('lineWidth').value=it.lineWidth; }
    renderStrokeList(it);
  }

  function renderStrokeList(it){
    const list=$('strokeList');
    list.innerHTML=(it.strokes||[]).map((s,i)=>`<div class="stroke-row" data-i="${i}"><span class="stroke-index">${i+1}</span><input class="stroke-color" aria-label="${i+1}번 획 색상" type="color" value="${s.color}"><input class="stroke-width" aria-label="${i+1}번 획 두께" type="number" min="0" max="30" step="0.5" value="${s.width}"><button class="stroke-up" title="바깥쪽으로">▲</button><button class="stroke-down" title="안쪽으로">▼</button><button class="stroke-del" title="삭제">×</button></div>`).join('') || '<div class="small-copy">획이 없습니다.</div>';

    list.querySelectorAll('.stroke-row').forEach(row=>{
      const index=()=>+row.dataset.i;
      const color=row.querySelector('.stroke-color'); const width=row.querySelector('.stroke-width');
      color.addEventListener('input',e=>{const cur=selected(); if(!cur||!cur.strokes[index()])return; cur.strokes[index()].color=e.target.value; render();});
      color.addEventListener('change',()=>pushHistory());
      width.addEventListener('input',e=>{const cur=selected(); if(!cur||!cur.strokes[index()])return; cur.strokes[index()].width=Math.max(0,+e.target.value||0); render();});
      width.addEventListener('change',()=>pushHistory());
    });
  }

  function updateToolButtons(){
    document.querySelectorAll('#toolModeGroup button').forEach(b=>b.classList.toggle('active',b.dataset.tool===state.tool));
    $('penSettings').classList.toggle('hidden',state.tool!=='pen'); $('stageWrap').classList.toggle('pen-cursor',state.tool==='pen'); $('stageWrap').classList.toggle('stamp-cursor',state.tool==='stamp');
    syncStampUI();
    if(state.tool!=='select') selectionLayer.innerHTML='';
  }

  function updateSelected(k,v,doHistory=false){ const it=selected(); if(!it)return; it[k]=v; if(doHistory)pushHistory(); render(); syncInspector(); }
  function nestedUpdate(obj,k,v){ const it=selected(); if(!it)return; it[obj][k]=v; render(); }

  function bindInspector(){
    ['posX','posY'].forEach(id=>$(id).addEventListener('change',()=>{const it=selected();if(!it)return;it.x=snap(+$('posX').value);it.y=snap(+$('posY').value);pushHistory();render();syncInspector();}));
    $('rotation').addEventListener('input',()=>{const it=selected();if(!it)return;it.rotation=+$('rotation').value;$('rotationValue').textContent=it.rotation+'°';render();}); $('rotation').addEventListener('change',pushHistory);
    $('fillMode').addEventListener('change',()=>updateSelected('fillMode',$('fillMode').value,true));
    $('fillA').addEventListener('input',()=>updateSelected('fillA',$('fillA').value)); $('fillA').addEventListener('change',pushHistory);
    $('fillB').addEventListener('input',()=>updateSelected('fillB',$('fillB').value)); $('fillB').addEventListener('change',pushHistory);
    $('gradientAngle').addEventListener('input',()=>{const it=selected();if(!it)return;it.gradAngle=+$('gradientAngle').value;$('gradientAngleValue').textContent=it.gradAngle+'°';render();}); $('gradientAngle').addEventListener('change',pushHistory);
    ['gradientStart','gradientEnd'].forEach(id=>$(id).addEventListener('change',()=>{const it=selected();if(!it)return;it.gradStart=clamp(+$('gradientStart').value,0,100);it.gradEnd=clamp(+$('gradientEnd').value,0,100);if(it.gradEnd<it.gradStart)[it.gradStart,it.gradEnd]=[it.gradEnd,it.gradStart];pushHistory();render();syncInspector();}));

    $('shadeEnabled').addEventListener('change',()=>{const it=selected();if(!it)return;it.shade.enabled=$('shadeEnabled').checked;pushHistory();render();syncInspector();});
    $('shadeColor').addEventListener('input',()=>nestedUpdate('shade','color',$('shadeColor').value)); $('shadeColor').addEventListener('change',pushHistory);
    $('shadeOpacity').addEventListener('input',()=>nestedUpdate('shade','opacity',clamp(+$('shadeOpacity').value,0,100))); $('shadeOpacity').addEventListener('change',pushHistory);
    $('shadeAngle').addEventListener('input',()=>{const it=selected();if(!it)return;it.shade.angle=+$('shadeAngle').value;$('shadeAngleValue').textContent=it.shade.angle+'°';render();}); $('shadeAngle').addEventListener('change',pushHistory);

    $('patternMode').addEventListener('change',()=>{nestedUpdate('pattern','mode',$('patternMode').value);pushHistory();syncInspector();});
    $('patternColor').addEventListener('input',()=>nestedUpdate('pattern','color',$('patternColor').value)); $('patternColor').addEventListener('change',pushHistory);
    $('patternOpacity').addEventListener('input',()=>nestedUpdate('pattern','opacity',clamp(+$('patternOpacity').value,0,100))); $('patternOpacity').addEventListener('change',pushHistory);
    $('patternScale').addEventListener('input',()=>{const it=selected();if(!it)return;it.pattern.scale=+$('patternScale').value;$('patternScaleValue').textContent=it.pattern.scale;render();}); $('patternScale').addEventListener('change',pushHistory);

    $('innerLineEnabled').addEventListener('change',()=>{const it=selected();if(!it)return;it.innerLine.enabled=$('innerLineEnabled').checked;pushHistory();render();syncInspector();});
    ['innerLineColor','innerLineWidth','innerLineDash','innerLineGap','innerLineInset'].forEach(id=>{
      const event=id==='innerLineColor'?'input':'input';
      $(id).addEventListener(event,()=>{const it=selected();if(!it)return;const map={innerLineColor:'color',innerLineWidth:'width',innerLineDash:'dash',innerLineGap:'gap',innerLineInset:'inset'};it.innerLine[map[id]]=id==='innerLineColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('shadowEnabled').addEventListener('change',()=>{const it=selected();if(!it)return;it.shadow.enabled=$('shadowEnabled').checked;pushHistory();render();syncInspector();});
    ['shadowColor','shadowOpacity','shadowX','shadowY','shadowBlur'].forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it)return;const map={shadowColor:'color',shadowOpacity:'opacity',shadowX:'x',shadowY:'y',shadowBlur:'blur'};it.shadow[map[id]]=id==='shadowColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('lineColor').addEventListener('input',()=>{const it=selected();if(!it)return;it.fillA=$('lineColor').value;render();}); $('lineColor').addEventListener('change',pushHistory);
    $('lineWidth').addEventListener('input',()=>{const it=selected();if(!it)return;it.lineWidth=Math.max(.5,+$('lineWidth').value||.5);render();}); $('lineWidth').addEventListener('change',pushHistory);

    const penMap={selectedPenColor:'color',selectedPenWidth:'width',selectedPenDash:'dash',selectedPenGap:'gap'};
    Object.keys(penMap).forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it||it.kind!=='pen')return;it[penMap[id]]=id==='selectedPenColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('addStrokeBtn').addEventListener('click',()=>{const it=selected();if(!it)return;it.strokes=it.strokes||[];it.strokes.unshift({color:'#ffffff',width:3});pushHistory();render();syncInspector();});
    $('strokeList').addEventListener('click',e=>{const row=e.target.closest('.stroke-row'),it=selected();if(!row||!it)return;const i=+row.dataset.i;if(e.target.classList.contains('stroke-up')&&i>0)[it.strokes[i-1],it.strokes[i]]=[it.strokes[i],it.strokes[i-1]];else if(e.target.classList.contains('stroke-down')&&i<it.strokes.length-1)[it.strokes[i+1],it.strokes[i]]=[it.strokes[i],it.strokes[i+1]];else if(e.target.classList.contains('stroke-del'))it.strokes.splice(i,1);else return;pushHistory();render();syncInspector();});
  }

  function addPenFromPoints(points){
    if(points.length<2)return; const mode=$('penCorrection').value; let pts=points;
    if(mode==='straight') pts=[points[0],points[points.length-1]];
    else {pts=rdp(points,mode==='curve'?2.5:1.25);pts=chaikin(pts,mode==='curve'?3:2);}
    const minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxX=Math.max(...pts.map(p=>p.x)),maxY=Math.max(...pts.map(p=>p.y));
    const w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY),local=pts.map(p=>({x:(p.x-minX)/w*100,y:(p.y-minY)/h*100}));
    const d=mode==='straight'?`M${local[0].x},${local[0].y} L${local[1].x},${local[1].y}`:catmullPath(local);
    const it={id:uid(),kind:'pen',type:'dashedPen',x:minX,y:minY,w,h,rotation:0,d,color:$('penColor').value,width:+$('penWidth').value,dash:+$('penDash').value,gap:+$('penGap').value};
    state.items.push(it);state.selectedId=it.id;pushHistory();render();syncInspector();
  }
  function rdp(points,eps){if(points.length<3)return points;let max=0,index=0;for(let i=1;i<points.length-1;i++){const d=perp(points[i],points[0],points[points.length-1]);if(d>max){max=d;index=i;}}if(max>eps){const a=rdp(points.slice(0,index+1),eps),b=rdp(points.slice(index),eps);return a.slice(0,-1).concat(b);}return [points[0],points[points.length-1]];}
  function perp(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;if(dx===0&&dy===0)return Math.hypot(p.x-a.x,p.y-a.y);return Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/Math.hypot(dx,dy);}
  function chaikin(points,n){let pts=points;for(let k=0;k<n;k++){const out=[pts[0]];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];out.push({x:.75*a.x+.25*b.x,y:.75*a.y+.25*b.y},{x:.25*a.x+.75*b.x,y:.25*a.y+.75*b.y});}out.push(pts[pts.length-1]);pts=out;}return pts;}
  function catmullPath(pts){if(pts.length<2)return '';if(pts.length===2)return`M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;let d=`M${pts[0].x},${pts[0].y}`;for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6},c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};d+=` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;}return d;}

  function rotatePoint(p,c,deg){const a=deg*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),dx=p.x-c.x,dy=p.y-c.y;return{x:c.x+dx*cos-dy*sin,y:c.y+dx*sin+dy*cos};}
  function localToGlobal(it,x,y){const c={x:it.x+it.w/2,y:it.y+it.h/2};return rotatePoint({x:it.x+x,y:it.y+y},c,it.rotation||0);}

  function beginResize(handle,p,it){
    const init=clone(it), angle=(init.rotation||0)*Math.PI/180, u={x:Math.cos(angle),y:Math.sin(angle)}, v={x:-Math.sin(angle),y:Math.cos(angle)};
    const cfg={
      nw:{sx:-1,sy:-1,ax:init.w,ay:init.h},n:{sx:0,sy:-1,ax:init.w/2,ay:init.h},ne:{sx:1,sy:-1,ax:0,ay:init.h},
      e:{sx:1,sy:0,ax:0,ay:init.h/2},se:{sx:1,sy:1,ax:0,ay:0},s:{sx:0,sy:1,ax:init.w/2,ay:0},
      sw:{sx:-1,sy:1,ax:init.w,ay:0},w:{sx:-1,sy:0,ax:init.w,ay:init.h/2}
    }[handle];
    const anchor=localToGlobal(init,cfg.ax,cfg.ay);
    gesture={type:'resize',id:it.id,handle,init,u,v,cfg,anchor,start:p,ratio:init.w/init.h};
  }

  function resizeGesture(p,keepRatio){
    const g=gesture,it=selected();if(!g||!it)return;
    const d={x:p.x-g.anchor.x,y:p.y-g.anchor.y};
    let nw=g.init.w, nh=g.init.h;
    if(g.cfg.sx) nw=Math.max(4,g.cfg.sx*(d.x*g.u.x+d.y*g.u.y));
    if(g.cfg.sy) nh=Math.max(4,g.cfg.sy*(d.x*g.v.x+d.y*g.v.y));
    if(keepRatio&&g.cfg.sx&&g.cfg.sy){
      if(nw/nh>g.ratio) nh=nw/g.ratio; else nw=nh*g.ratio;
    }
    if(state.snap){nw=Math.max(4,snap(nw));nh=Math.max(4,snap(nh));}
    let c;
    if(g.cfg.sx&&g.cfg.sy){c={x:g.anchor.x+g.u.x*g.cfg.sx*nw/2+g.v.x*g.cfg.sy*nh/2,y:g.anchor.y+g.u.y*g.cfg.sx*nw/2+g.v.y*g.cfg.sy*nh/2};}
    else if(g.cfg.sx){c={x:g.anchor.x+g.u.x*g.cfg.sx*nw/2,y:g.anchor.y+g.u.y*g.cfg.sx*nw/2};}
    else {c={x:g.anchor.x+g.v.x*g.cfg.sy*nh/2,y:g.anchor.y+g.v.y*g.cfg.sy*nh/2};}
    it.w=nw;it.h=nh;it.x=c.x-nw/2;it.y=c.y-nh/2;render();syncInspector();
  }

  function bindStage(){
    stage.addEventListener('pointerdown',e=>{
      const p=clientToStage(e); lastPointer=p;
      if(state.tool==='stamp'){stampAt(p.x,p.y);return;}
      if(state.tool==='pen'){pen={points:[p]};$('livePenPath').setAttribute('opacity','1');$('livePenPath').setAttribute('d',`M${p.x},${p.y}`);$('livePenPath').setAttribute('stroke',$('penColor').value);$('livePenPath').setAttribute('stroke-width',$('penWidth').value);$('livePenPath').setAttribute('stroke-dasharray',`${$('penDash').value} ${$('penGap').value}`);stage.setPointerCapture(e.pointerId);return;}

      const handle=e.target.closest?.('[data-handle]');
      if(handle&&handle.getAttribute('data-id')===state.selectedId){
        const it=selected(); const kind=handle.getAttribute('data-handle');
        if(kind==='rotate'){
          const c={x:it.x+it.w/2,y:it.y+it.h/2};gesture={type:'rotate',id:it.id,init:clone(it),center:c,startAngle:Math.atan2(p.y-c.y,p.x-c.x)};
        } else beginResize(kind,p,it);
        stage.setPointerCapture(e.pointerId);e.preventDefault();return;
      }

      const target=e.target.closest?.('[data-id]');
      if(target){
        state.selectedId=target.getAttribute('data-id');const it=selected();gesture={type:'move',id:it.id,start:p,x:it.x,y:it.y};$('stageWrap').classList.add('drag-cursor');stage.setPointerCapture(e.pointerId);render();syncInspector();
      } else {state.selectedId=null;render();syncInspector();}
    });

    stage.addEventListener('pointermove',e=>{
      const p=clientToStage(e);lastPointer=p;
      if(state.tool==='stamp'){updateStampGhost(p);return;}
      if(pen){pen.points.push(p);$('livePenPath').setAttribute('d',catmullPath(pen.points));return;}
      if(!gesture)return;
      const it=selected();if(!it)return;
      if(gesture.type==='move'){it.x=snap(gesture.x+p.x-gesture.start.x);it.y=snap(gesture.y+p.y-gesture.start.y);render();syncInspector();}
      if(gesture.type==='resize') resizeGesture(p,e.shiftKey);
      if(gesture.type==='rotate'){
        const a=Math.atan2(p.y-gesture.center.y,p.x-gesture.center.x);let deg=gesture.init.rotation+(a-gesture.startAngle)*180/Math.PI;if(e.shiftKey)deg=Math.round(deg/15)*15;it.rotation=Math.round(deg*10)/10;render();syncInspector();
      }
    });

    stage.addEventListener('pointerleave',()=>{if(state.tool==='stamp'){lastPointer=null;stampPreviewLayer.innerHTML='';}});
    stage.addEventListener('pointerenter',e=>{if(state.tool==='stamp'){lastPointer=clientToStage(e);updateStampGhost(lastPointer);}});

    stage.addEventListener('pointerup',e=>{
      if(pen){const pts=pen.points;pen=null;$('livePenPath').setAttribute('opacity','0');addPenFromPoints(pts);}
      if(gesture){gesture=null;$('stageWrap').classList.remove('drag-cursor');pushHistory();}
      try{stage.releasePointerCapture(e.pointerId);}catch{}
    });
  }

  function deleteSelected(){const i=state.items.findIndex(x=>x.id===state.selectedId);if(i<0)return;state.items.splice(i,1);state.selectedId=null;pushHistory();render();syncInspector();}
  function duplicateSelected(){const it=selected();if(!it)return;const c=clone(it);c.id=uid();c.x+=8;c.y+=8;state.items.push(c);state.selectedId=c.id;pushHistory();render();syncInspector();}
  function moveLayer(dir){const i=state.items.findIndex(x=>x.id===state.selectedId);if(i<0)return;const j=clamp(i+dir,0,state.items.length-1);if(i===j)return;const [it]=state.items.splice(i,1);state.items.splice(j,0,it);pushHistory();render();}
  function align(action){const it=selected();if(!it)return;if(action==='centerX')it.x=(W-it.w)/2;if(action==='centerY')it.y=(H-it.h)/2;if(action==='cover'){const r=Math.max(W/it.w,H/it.h);it.w*=r;it.h*=r;it.x=(W-it.w)/2;it.y=(H-it.h)/2;}pushHistory();render();syncInspector();}

  function cleanSvgForExport(){const cloneSvg=stage.cloneNode(true);cloneSvg.querySelector('#selectionLayer')?.remove();cloneSvg.querySelector('#guideLayer')?.remove();cloneSvg.querySelector('#gridLayer')?.remove();cloneSvg.querySelector('#stampPreviewLayer')?.remove();cloneSvg.querySelector('#livePenPath')?.remove();cloneSvg.setAttribute('width',W);cloneSvg.setAttribute('height',H);cloneSvg.style.width='';cloneSvg.style.height='';cloneSvg.removeAttribute('aria-label');return cloneSvg;}
  function svgString(){const s=cleanSvgForExport();return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(s);}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},600);}
  function exportSvg(){downloadBlob(new Blob([svgString()],{type:'image/svg+xml;charset=utf-8'}),'cute-badge-293x164-v1.1.svg');showToast('SVG를 저장했어요.');}
  function exportPng(){const src=svgString(),blob=new Blob([src],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);URL.revokeObjectURL(url);c.toBlob(b=>{downloadBlob(b,'cute-badge-293x164-v1.1.png');showToast('293×164 PNG로 저장했어요.');},'image/png');};img.onerror=()=>{URL.revokeObjectURL(url);showToast('PNG 변환 중 오류가 발생했어요.');};img.src=url;}
  function saveProject(){const data={app:'Cute Badge Background Studio',version:'1.1',canvas:{width:W,height:H},state:{bg:state.bg,transparent:state.transparent,items:state.items}};downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),'cute-badge-project-v1.1.json');}
  function openProject(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.state||!Array.isArray(d.state.items))throw 0;state.bg=d.state.bg||'#ffffff';state.transparent=!!d.state.transparent;state.items=d.state.items.map(normalizeItem);state.selectedId=state.items[0]?.id||null;state.tool='select';history=[];historyIndex=-1;pushHistory();syncAll();showToast('프로젝트를 불러왔어요.');}catch{showToast('올바른 프로젝트 파일이 아니에요.');}};r.readAsText(file,'utf-8');}

  function bindUI(){
    $('undoBtn').onclick=()=>restoreHistory(historyIndex-1); $('redoBtn').onclick=()=>restoreHistory(historyIndex+1);
    $('exportSvgBtn').onclick=exportSvg; $('exportPngBtn').onclick=exportPng; $('saveProjectBtn').onclick=saveProject; $('openProjectInput').onchange=e=>{if(e.target.files[0])openProject(e.target.files[0]);e.target.value='';};
    $('canvasBgColor').oninput=e=>{state.bg=e.target.value;render();}; $('canvasBgColor').onchange=pushHistory; $('transparentBg').onchange=e=>{state.transparent=e.target.checked;pushHistory();render();};
    $('gridToggle').onchange=e=>{state.grid=e.target.checked;render();}; $('safeToggle').onchange=e=>{state.safe=e.target.checked;render();}; $('snapToggle').onchange=e=>{state.snap=e.target.checked;};
    $('zoomRange').oninput=e=>{state.zoom=+e.target.value/100;applyZoom();}; $('zoomOutBtn').onclick=()=>{state.zoom=clamp(state.zoom-.25,.75,3);applyZoom();}; $('zoomInBtn').onclick=()=>{state.zoom=clamp(state.zoom+.25,.75,3);applyZoom();}; $('fitBtn').onclick=fitStage;
    $('toolModeGroup').onclick=e=>{const b=e.target.closest('[data-tool]');if(!b)return;state.tool=b.dataset.tool;updateToolButtons();render();setStatus(state.tool==='pen'?'미리보기에서 드래그해 점선을 그리세요.':'오브젝트를 클릭해 이동하거나 손잡이로 크기를 조절하세요.');};
    $('exitStampToolBtn').onclick=()=>{state.tool='select';updateToolButtons();render();setStatus('선택 모드로 돌아왔습니다.');};

    const stampInputs={stampFillColor:'fill',stampStrokeColor:'stroke',stampStrokeWidth:'strokeWidth',stampSize:'size',stampRotation:'rotation'};
    Object.keys(stampInputs).forEach(id=>$(id).addEventListener('input',()=>{const key=stampInputs[id];state.stampBrush[key]=(id==='stampFillColor'||id==='stampStrokeColor')?$(id).value:+$(id).value;if(id==='stampRotation')$('stampRotationValue').textContent=state.stampBrush.rotation+'°';updateStampGhost(lastPointer);}));

    $('deleteBtn').onclick=deleteSelected; $('duplicateBtn').onclick=duplicateSelected; $('layerUpBtn').onclick=()=>moveLayer(1); $('layerDownBtn').onclick=()=>moveLayer(-1); document.querySelector('.quick-align').onclick=e=>{const b=e.target.closest('[data-align]');if(b)align(b.dataset.align);};
    window.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;if(e.key==='Escape'&&state.tool!=='select'){state.tool='select';updateToolButtons();render();setStatus('선택 모드로 돌아왔습니다.');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?restoreHistory(historyIndex+1):restoreHistory(historyIndex-1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restoreHistory(historyIndex+1);}if(e.key==='Delete'||e.key==='Backspace')deleteSelected();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();}});
  }

  function init(){buildAssetLists();bindInspector();bindStage();bindUI();pushHistory();syncAll();setTimeout(fitStage,50);}
  init();
})();
