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
    ['leaf','잎사귀'],['spiral','빙글선'],['drop','물방울'],['petal','꽃잎'],['party','축하 컨페티']
  ];

  const LINE_STAMPS = new Set(['heartline','ring','squiggle','ray','wave','spiral']);

  const PRESETS = [
    {name:'레몬 물결', colors:['#fff9d8','#f0d778','#9f8540'], shape:'wavybadge', pattern:'sparkles', inner:true},
    {name:'크림 별빛', colors:['#fff8df','#f3dda0','#9d8249'], shape:'topsoft', pattern:'sparkles', inner:true},
    {name:'스카이 파도', colors:['#eef9ff','#b6e1ef','#648aa1'], shape:'wavetop', pattern:'stripes', inner:true},
    {name:'민트 피크닉', colors:['#eff9df','#bcdf91','#6e9667'], shape:'roughoval', pattern:'grid', inner:true},
    {name:'체리 손그림', colors:['#ffe9ed','#f4b2c0','#a65a75'], shape:'softheart', pattern:'tinyhearts', inner:true},
    {name:'복숭아 낙서', colors:['#fff1ea','#f7c0a7','#b47b66'], shape:'handblob', pattern:'confetti', inner:false},
    {name:'라벤더 메모', colors:['#f4efff','#d0c1f3','#7b6aa8'], shape:'wobblyrect', pattern:'dots', inner:true},
    {name:'하늘 리본', colors:['#eef6ff','#c4dcf8','#6f8dab'], shape:'ribbonpanel', pattern:'sparkles', inner:true},
    {name:'딸기 솜구름', colors:['#fff2f7','#f1bfd4','#aa6f88'], shape:'paintcloud', pattern:'tinyhearts', inner:false},
    {name:'오트 배지', colors:['#fff6e9','#e8cfab','#9a8060'], shape:'shield', pattern:'dots', inner:true},
    {name:'바다 둥실', colors:['#eaf9ff','#b8e3f0','#5c92a4'], shape:'bubblepanel', pattern:'sparkles', inner:false},
    {name:'포도 스티치', colors:['#f4efff','#d2c3f0','#75679a'], shape:'softrect', pattern:'dots', inner:true}
  ];

  const DEFAULT_STROKES = () => [{color:'#ffffff', width:4.5},{color:'#80758b', width:1.7}];

  let state = {
    bg:'#ffffff', transparent:false, zoom:2,
    grid:false, safe:false, snap:false, tool:'select',
    stampBrush:{type:'heart',fill:'#fff7fb',stroke:'#8f7894',strokeWidth:2,size:26,rotation:0},
    items:[], selectedId:null, currentPresetIndex:null
  };

  let pages = [{name:'페이지 1', snapshot:null}];
  let activePageIndex = 0;

  let history = [], historyIndex = -1, restoring = false;
  let gesture = null, pen = null, paintStroke = null, toastTimer = null, lastPointer = null;

  function uid(){ return 'i_' + Math.random().toString(36).slice(2,10); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function snap(v){ return state.snap ? Math.round(v/2)*2 : v; }
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function svgEl(tag, attrs={}){ const el=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v))); return el; }
  function selected(){ return state.items.find(x=>x.id===state.selectedId) || null; }
  function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1700); }
  function setStatus(msg){ $('statusText').textContent=msg; }
  function fileSafe(s){ return s.replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim() || 'page'; }

  function pageSnapshot(){
    return { bg:state.bg, transparent:state.transparent, items:clone(state.items), selectedId:state.selectedId, currentPresetIndex:state.currentPresetIndex };
  }
  function blankSnapshot(){ return { bg:'#ffffff', transparent:false, items:[], selectedId:null, currentPresetIndex:null }; }
  function captureCurrentPage(){ pages[activePageIndex].snapshot = pageSnapshot(); }
  function applySnapshot(s){
    const snap = s || blankSnapshot();
    state.bg = snap.bg || '#ffffff';
    state.transparent = !!snap.transparent;
    state.items = (snap.items || []).map(normalizeItem);
    state.selectedId = snap.selectedId || null;
    state.currentPresetIndex = Number.isInteger(snap.currentPresetIndex) ? snap.currentPresetIndex : null;
  }
  function renderPageList(){
    $('pageList').innerHTML = pages.map((p,i)=>`<button class="page-item ${i===activePageIndex?'active':''}" data-page="${i}"><span class="page-name">${esc(p.name)}</span><span class="page-thumb">${(p.snapshot?.items?.length ?? (i===activePageIndex?state.items.length:0))}개</span></button>`).join('');
  }
  function switchPage(index){
    if(index<0 || index>=pages.length || index===activePageIndex) return;
    captureCurrentPage();
    activePageIndex = index;
    applySnapshot(clone(pages[index].snapshot || blankSnapshot()));
    history=[]; historyIndex=-1; pushHistory(); syncAll(); renderPageList();
    setStatus(`${pages[index].name}로 이동했습니다.`);
  }
  function addPage(){
    captureCurrentPage();
    const idx = pages.length + 1;
    pages.push({name:`페이지 ${idx}`, snapshot:blankSnapshot()});
    switchPage(pages.length-1);
  }
  function duplicatePage(){
    captureCurrentPage();
    const base = clone(pages[activePageIndex].snapshot || blankSnapshot());
    pages.splice(activePageIndex+1,0,{name:`${pages[activePageIndex].name} 복제`, snapshot:base});
    switchPage(activePageIndex+1);
  }
  function deletePage(){
    if(pages.length<=1){
      pages[0]={name:'페이지 1', snapshot:blankSnapshot()};
      activePageIndex=0; applySnapshot(blankSnapshot()); history=[]; historyIndex=-1; pushHistory(); syncAll(); renderPageList();
      return;
    }
    pages.splice(activePageIndex,1);
    activePageIndex = Math.max(0, activePageIndex-1);
    applySnapshot(clone(pages[activePageIndex].snapshot || blankSnapshot()));
    history=[]; historyIndex=-1; pushHistory(); syncAll(); renderPageList();
  }

  function pushHistory(){
    if(restoring) return;
    const snapshot=JSON.stringify(pageSnapshot());
    if(history[historyIndex]===snapshot) return;
    history=history.slice(0,historyIndex+1);
    history.push(snapshot);
    if(history.length>80){ history.shift(); historyIndex=79; }
    else historyIndex++;
    updateUndoRedo();
    captureCurrentPage();
    renderPageList();
  }
  function restoreHistory(idx){
    if(idx<0||idx>=history.length) return;
    restoring=true;
    applySnapshot(JSON.parse(history[idx]));
    historyIndex=idx; restoring=false; captureCurrentPage(); syncAll(); updateUndoRedo(); renderPageList();
  }
  function updateUndoRedo(){ $('undoBtn').disabled=historyIndex<=0; $('redoBtn').disabled=historyIndex>=history.length-1; }

  function makeBase(type, kind='shape'){
    return {
      id:uid(), kind, type, x:35, y:22, w:223, h:120, rotation:0,
      fillMode:'solid', fillA:'#dff4ff', fillB:'#a7dff4', gradAngle:20, gradStart:0, gradEnd:100,
      lineWidth:3,
      strokes:DEFAULT_STROKES(),
      strokeFx:{softness:0, texture:0},
      shade:{enabled:false,color:'#655c76',opacity:18,angle:135},
      pattern:{mode:'none',color:'#5f5a70',opacity:18,size:8,gap:8,x:10,y:10,w:80,h:80,blur:0,blurDir:'none',blurSpan:12},
      innerLine:{enabled:false,color:'#ffffff',width:1.5,dash:5,gap:4,inset:6,offsetX:0,offsetY:0,scaleX:1,scaleY:1},
      shadow:{enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:2},
      glow:{enabled:false,color:'#ffffff',opacity:38,spread:1.6,blur:4},
      accentPaint:{strokes:[],erasers:[]}
    };
  }

  function normalizeItem(it){
    const out={...it};
    out.rotation=Number(out.rotation)||0;
    out.w=Math.max(1,Number(out.w)||32); out.h=Math.max(1,Number(out.h)||32);
    if(out.kind==='image'){
      out.src=out.src||'';
      out.shadow={enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:2,...out.shadow};
      return out;
    }
    if(out.kind!=='pen'){
      out.fillMode=out.fillMode||'solid'; out.fillA=out.fillA||'#dff4ff'; out.fillB=out.fillB||out.fillA;
      out.gradAngle=Number(out.gradAngle)||0; out.gradStart=Number.isFinite(+out.gradStart)?+out.gradStart:0; out.gradEnd=Number.isFinite(+out.gradEnd)?+out.gradEnd:100;
      out.lineWidth=Number(out.lineWidth)||3;
      out.strokes=Array.isArray(out.strokes)?out.strokes.map(s=>({color:s.color||'#ffffff',width:Math.max(0,+s.width||0)})):DEFAULT_STROKES();
      out.strokeFx={softness:0, texture:0, ...out.strokeFx};
      out.shade={enabled:false,color:'#655c76',opacity:18,angle:135,...out.shade};
      out.pattern={mode:'none',color:'#5f5a70',opacity:18,size:8,gap:8,x:10,y:10,w:80,h:80,blur:0,blurDir:'none',blurSpan:12,...out.pattern};
      out.innerLine={enabled:false,color:'#ffffff',width:1.5,dash:5,gap:4,inset:6,offsetX:0,offsetY:0,scaleX:1,scaleY:1,...out.innerLine};
      out.shadow={enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:2,...out.shadow};
      out.glow={enabled:false,color:'#ffffff',opacity:38,spread:1.6,blur:4,...out.glow};
      out.accentPaint={strokes:[],erasers:[],...out.accentPaint};
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
    if(type==='squiggle'||type==='wave'){w=brush.size*2.1;h=brush.size*.78;}
    if(type==='ray'||type==='party'){w=brush.size*1.2;h=brush.size*1.2;}
    if(type==='bubble'){w=brush.size*1.35;h=brush.size;}
    it.x=x-w/2; it.y=y-h/2; it.w=w; it.h=h; it.rotation=brush.rotation;
    it.fillA=brush.fill; it.fillB=brush.fill; it.fillMode='solid'; it.lineWidth=Math.max(1.2,brush.strokeWidth+1.3);
    it.strokes=brush.strokeWidth>0?[{color:brush.stroke,width:brush.strokeWidth}]:[];
    it.strokeFx={softness:0,texture:0};
    it.shade.enabled=false; it.pattern.mode='none'; it.innerLine.enabled=false; it.shadow.enabled=false;
    return it;
  }

  function stampAt(x,y){
    if(!state.stampBrush.type) return;
    const it=createStampItem(state.stampBrush.type,x,y);
    state.items.push(it); state.selectedId=it.id; pushHistory(); render(); syncInspector(); updateStampGhost(lastPointer); setStatus('스탬프를 찍었습니다. 계속 클릭하면 같은 설정으로 반복됩니다.');
  }

  function addImageFromFile(file){
    if(!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const it = {id:uid(), kind:'image', type:'image', x:66, y:28, w:120, h:90, rotation:0, src:fr.result, shadow:{enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:2}};
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth/img.naturalHeight : 1;
        if(ratio>=1){ it.w=120; it.h=Math.max(20, 120/ratio); }
        else { it.h=90; it.w=Math.max(20, 90*ratio); }
        state.items.push(it); state.selectedId=it.id; pushHistory(); render(); syncInspector(); showToast('이미지를 추가했어요.');
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
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
      squiggle:'M6,58 C15,26 24,77 34,49 C42,26 51,77 61,48 C70,25 80,67 94,36 M18,69 C23,61 30,61 36,68 M62,67 C68,60 77,60 84,66',
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
      petal:'M50,5 C72,18 89,38 84,59 C80,78 64,90 50,96 C35,89 19,78 16,59 C12,38 28,18 50,5 Z',
      party:'M12,64 L25,46 M26,70 L41,56 M58,38 L73,22 M72,50 L88,42 M50,52 L52,22 M14,26 L22,30 L19,38 L11,34 Z M31,18 L39,23 L34,32 L26,27 Z M79,72 L88,62 L97,69 L89,79 Z M44,75 L51,65 L59,74 L51,83 Z M66,77 L72,69 L80,74 L74,82 Z'
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
    $('pageList').addEventListener('click',e=>{const b=e.target.closest('[data-page]'); if(b) switchPage(+b.dataset.page);});
  }

  function activateStamp(type){
    state.stampBrush.type=type; state.tool='stamp';
    const name=STAMPS.find(x=>x[0]===type)?.[1]||'스탬프';
    $('activeStampName').textContent=name;
    syncStampUI(); updateToolButtons(); updateStampGhost(lastPointer);
    setStatus(`${name} 찍기 모드: 미리보기에서 원하는 위치를 클릭하세요.`);
  }

  function applyPreset(index){
    if(state.currentPresetIndex===index){
      state.items=[]; state.selectedId=null; state.currentPresetIndex=null; pushHistory(); syncAll(); showToast('프리셋을 해제했어요.'); return;
    }
    const p=PRESETS[index]; state.bg='#ffffff'; state.transparent=false; state.items=[]; state.tool='select'; state.currentPresetIndex=index;
    const base=makeBase(p.shape,'shape');
    base.x=21;base.y=17;base.w=251;base.h=133;base.fillMode=(p.shape==='brush'||p.shape==='paintcloud'||p.shape==='handblob'||p.shape==='wobblyrect')?'pastel':'linear';
    base.fillA=p.colors[0];base.fillB=p.colors[1];base.gradAngle=25;
    base.strokes=[{color:'#ffffff',width:4.8},{color:p.colors[2],width:1.8}];
    base.pattern={mode:p.pattern,color:p.colors[2],opacity:17,size:7,gap:8,x:10,y:10,w:80,h:80,blur:0,blurDir:'none',blurSpan:12};
    base.innerLine.enabled=!!p.inner;base.innerLine.color='#ffffff';base.innerLine.width=1.25;base.innerLine.dash=5;base.innerLine.gap=4;base.innerLine.inset=6;
    base.shadow={enabled:true,color:p.colors[2],opacity:12,x:1.5,y:2.2,blur:1.8};
    state.items.push(base);
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
    f.append(svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:'0.032',numOctaves:'3',seed:String((item.id.charCodeAt(2)||3)%19+1),result:'noise'}));
    f.append(svgEl('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:'1.4',xChannelSelector:'R',yChannelSelector:'G',result:'disp'}));
    f.append(svgEl('feGaussianBlur',{in:'disp',stdDeviation:'0.12',result:'soft'}));
    addDef(f); return `url(#${id})`;
  }

  function createPatternDef(item){
    if(!item.pattern||item.pattern.mode==='none') return null;
    const id='pat_'+item.id;
    const size=Math.max(.5,+item.pattern.size||8), gap=Math.max(0,+item.pattern.gap||8), step=size+gap;
    const color=item.pattern.color, op=(+item.pattern.opacity||20)/100;
    const aspectFix = item.w && item.h ? (item.w / item.h) : 1;
    const p=svgEl('pattern',{id,patternUnits:'userSpaceOnUse',width:step,height:step,patternTransform:`scale(1 ${aspectFix})`});
    if(item.pattern.mode==='dots') p.append(svgEl('circle',{cx:step/2,cy:step/2,r:Math.max(.35,size*.22),fill:color,opacity:op}));
    if(item.pattern.mode==='stripes'){ p.setAttribute('patternTransform',`scale(1 ${aspectFix}) rotate(35)`); p.append(svgEl('line',{x1:0,y1:0,x2:0,y2:step*1.5,stroke:color,'stroke-width':Math.max(.35,size*.24),opacity:op})); }
    if(item.pattern.mode==='grid') p.append(svgEl('path',{d:`M0 0 H${step} M0 0 V${step}`,stroke:color,'stroke-width':Math.max(.25,size*.08),opacity:op,fill:'none'}));
    if(item.pattern.mode==='sparkles') p.append(svgEl('path',{d:`M${step/2} ${step*.15} C${step*.53} ${step*.4} ${step*.62} ${step*.47} ${step*.85} ${step*.5} C${step*.62} ${step*.53} ${step*.53} ${step*.6} ${step/2} ${step*.85} C${step*.47} ${step*.6} ${step*.38} ${step*.53} ${step*.15} ${step*.5} C${step*.38} ${step*.47} ${step*.47} ${step*.4} ${step/2} ${step*.15} Z`,fill:color,opacity:op}));
    if(item.pattern.mode==='tinyhearts') p.append(svgEl('path',{d:`M${step*.5} ${step*.78} C${step*.42} ${step*.67} ${step*.2} ${step*.55} ${step*.24} ${step*.34} C${step*.27} ${step*.2} ${step*.44} ${step*.2} ${step*.5} ${step*.35} C${step*.56} ${step*.2} ${step*.73} ${step*.2} ${step*.76} ${step*.34} C${step*.8} ${step*.55} ${step*.58} ${step*.67} ${step*.5} ${step*.78} Z`,fill:color,opacity:op}));
    if(item.pattern.mode==='confetti'){
      p.append(svgEl('line',{x1:step*.18,y1:step*.24,x2:step*.42,y2:step*.42,stroke:color,'stroke-width':Math.max(.45,size*.14),opacity:op,'stroke-linecap':'round'}));
      p.append(svgEl('line',{x1:step*.68,y1:step*.6,x2:step*.86,y2:step*.38,stroke:color,'stroke-width':Math.max(.45,size*.14),opacity:op,'stroke-linecap':'round'}));
      p.append(svgEl('circle',{cx:step*.5,cy:step*.8,r:Math.max(.35,size*.08),fill:color,opacity:op}));
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

  function createBlurFilter(item,prefix='blur'){
    if(!item.shadow?.enabled || +item.shadow.blur<=0) return null;
    const id=`${prefix}_${item.id}`;
    const f=svgEl('filter',{id,x:'-30%',y:'-30%',width:'160%',height:'160%'});
    f.append(svgEl('feGaussianBlur',{stdDeviation:+item.shadow.blur||0})); addDef(f); return `url(#${id})`;
  }
  function createSimpleBlur(id, value){
    if(!(+value>0)) return null;
    const f=svgEl('filter',{id,x:'-30%',y:'-30%',width:'160%',height:'160%'});
    f.append(svgEl('feGaussianBlur',{stdDeviation:+value||0})); addDef(f); return `url(#${id})`;
  }
  function createImageShadowFilter(item){
    if(!item.shadow?.enabled) return null;
    const id='imgshadow_'+item.id;
    const f=svgEl('filter',{id,x:'-30%',y:'-30%',width:'180%',height:'180%'});
    f.append(svgEl('feDropShadow',{dx:(+item.shadow.x||0).toFixed(2),dy:(+item.shadow.y||0).toFixed(2),stdDeviation:(+item.shadow.blur||0).toFixed(2),'flood-color':item.shadow.color||'#6c6175','flood-opacity':((+item.shadow.opacity||0)/100).toFixed(3)}));
    addDef(f); return `url(#${id})`;
  }
  function createOuterGlowFilter(item){
    if(!item.glow?.enabled || !(+item.glow.blur>0)) return null;
    const id='oglow_'+item.id;
    const f=svgEl('filter',{id,x:'-60%',y:'-60%',width:'220%',height:'220%'});
    f.append(svgEl('feGaussianBlur',{in:'SourceGraphic',stdDeviation:(+item.glow.blur||0).toFixed(2),result:'blur'}));
    addDef(f); return `url(#${id})`;
  }
  function createPatternEdgeMask(item){
    const dir=item.pattern?.blurDir||'none', span=+item.pattern?.blurSpan||0;
    if(dir==='none' || !(+item.pattern?.blur>0) || span<=0) return null;
    const id='pmask_'+item.id;
    const frac=v=>Math.max(0,Math.min(1,v));
    const m=svgEl('mask',{id,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
    m.append(svgEl('rect',{x:item.pattern.x,y:item.pattern.y,width:item.pattern.w,height:item.pattern.h,fill:'black'}));
    const g=svgEl('linearGradient',{id:id+'_g'});
    let rectArgs={x:item.pattern.x,y:item.pattern.y,width:item.pattern.w,height:item.pattern.h,fill:`url(#${id}_g)`};
    if(dir==='left'){ g.setAttribute('x1','0%'); g.setAttribute('y1','0%'); g.setAttribute('x2','100%'); g.setAttribute('y2','0%'); const s=frac(span/Math.max(1,item.pattern.w)); g.append(svgEl('stop',{offset:'0%','stop-color':'white'})); g.append(svgEl('stop',{offset:(s*100)+'%','stop-color':'black'})); g.append(svgEl('stop',{offset:'100%','stop-color':'black'})); }
    if(dir==='right'){ g.setAttribute('x1','100%'); g.setAttribute('y1','0%'); g.setAttribute('x2','0%'); g.setAttribute('y2','0%'); const s=frac(span/Math.max(1,item.pattern.w)); g.append(svgEl('stop',{offset:'0%','stop-color':'white'})); g.append(svgEl('stop',{offset:(s*100)+'%','stop-color':'black'})); g.append(svgEl('stop',{offset:'100%','stop-color':'black'})); }
    if(dir==='top'){ g.setAttribute('x1','0%'); g.setAttribute('y1','0%'); g.setAttribute('x2','0%'); g.setAttribute('y2','100%'); const s=frac(span/Math.max(1,item.pattern.h)); g.append(svgEl('stop',{offset:'0%','stop-color':'white'})); g.append(svgEl('stop',{offset:(s*100)+'%','stop-color':'black'})); g.append(svgEl('stop',{offset:'100%','stop-color':'black'})); }
    if(dir==='bottom'){ g.setAttribute('x1','0%'); g.setAttribute('y1','100%'); g.setAttribute('x2','0%'); g.setAttribute('y2','0%'); const s=frac(span/Math.max(1,item.pattern.h)); g.append(svgEl('stop',{offset:'0%','stop-color':'white'})); g.append(svgEl('stop',{offset:(s*100)+'%','stop-color':'black'})); g.append(svgEl('stop',{offset:'100%','stop-color':'black'})); }
    addDef(g); m.append(svgEl('rect',rectArgs)); addDef(m); return `url(#${id})`;
  }
  function createStrokeFxFilter(item){
    const soft = +item.strokeFx?.softness || 0;
    const tex = +item.strokeFx?.texture || 0;
    if(soft<=0 && tex<=0) return null;
    const id='sfx_'+item.id;
    const f=svgEl('filter',{id,x:'-20%',y:'-20%',width:'150%',height:'150%'});
    if(tex>0){
      f.append(svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:(0.07+tex*0.01).toFixed(3),numOctaves:'1',seed:String((item.id.charCodeAt(1)||3)%11+1),result:'noise'}));
      f.append(svgEl('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:(tex*0.9).toFixed(2),xChannelSelector:'R',yChannelSelector:'G',result:'warped'}));
      if(soft>0) f.append(svgEl('feGaussianBlur',{in:'warped',stdDeviation:soft/2.2,result:'out'}));
    } else {
      f.append(svgEl('feGaussianBlur',{in:'SourceGraphic',stdDeviation:soft/2.2,result:'out'}));
    }
    addDef(f); return `url(#${id})`;
  }
  function createEdgeBleedFilter(item){
    const soft = +item.strokeFx?.softness || 0;
    const tex = +item.strokeFx?.texture || 0;
    if(soft<=0 && tex<=0) return null;
    const id='ebleed_'+item.id;
    const f=svgEl('filter',{id,x:'-25%',y:'-25%',width:'160%',height:'160%'});
    if(tex>0){
      f.append(svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:(0.045+tex*0.008).toFixed(3),numOctaves:'2',seed:String((item.id.charCodeAt(3)||3)%13+1),result:'noise'}));
      f.append(svgEl('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:(tex*1.6).toFixed(2),xChannelSelector:'R',yChannelSelector:'G',result:'warp'}));
      f.append(svgEl('feGaussianBlur',{in:'warp',stdDeviation:Math.max(.2,soft/1.2),result:'out'}));
    } else {
      f.append(svgEl('feGaussianBlur',{in:'SourceGraphic',stdDeviation:Math.max(.2,soft/1.2),result:'out'}));
    }
    addDef(f); return `url(#${id})`;
  }

  function itemPath(item){ return item.kind==='shape'?pathFor(item.type):item.kind==='stamp'?stampPath(item.type):item.d; }

  function appendOutlineBands(g,d,item,lineMode=false){
    const strokes=item.strokes||[];
    const base=lineMode?(+item.lineWidth||3):0;
    const strokeFilter=createStrokeFxFilter(item);
    for(let i=0;i<strokes.length;i++){
      let cumulative=0;
      for(let j=i;j<strokes.length;j++) cumulative+=Math.max(0,+strokes[j].width||0);
      const sw=lineMode ? base + cumulative*2 : cumulative*2;
      if(sw<=0) continue;
      const path=svgEl('path',{d,fill:'none',stroke:strokes[i].color,'stroke-width':sw,'stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke'});
      if(strokeFilter) path.setAttribute('filter',strokeFilter);
      g.append(path);
    }
  }


  function renderAccentPaint(g,item,d){
    const paint=item.accentPaint;
    if(!paint || (!(paint.strokes||[]).length && !(paint.erasers||[]).length)) return;
    const clipId='apclip_'+item.id;
    const cp=svgEl('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
    cp.append(svgEl('path',{d})); addDef(cp);
    const wrap=svgEl('g',{'clip-path':`url(#${clipId})`});
    if((paint.erasers||[]).length){
      const maskId='apmask_'+item.id;
      const mask=svgEl('mask',{id:maskId,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
      mask.append(svgEl('rect',{x:0,y:0,width:100,height:100,fill:'white'}));
      paint.erasers.forEach((er,idx)=>{
        const blurId='aperase_'+item.id+'_'+idx;
        const blur=createSimpleBlur(blurId, er.softness||0);
        const samples=samplePolyline(er.points||[], Math.max(.4,(er.size||8)*0.35));
        const eg=svgEl('g',{});
        if(blur) eg.setAttribute('filter',blur);
        samples.forEach(pt=>eg.append(svgEl('circle',{cx:pt.x,cy:pt.y,r:Math.max(.3,(er.size||8)/2),fill:'black'})));
        mask.append(eg);
      });
      addDef(mask); wrap.setAttribute('mask',`url(#${maskId})`);
    }
    (paint.strokes||[]).forEach(st=>{
      const samples=samplePolyline(st.points||[], Math.max(.18,st.spacing||4));
      samples.forEach(pt=>drawAccentSymbol(wrap, st.brush||'dots', pt.x, pt.y, st.size||3, st.color||'#6a5d7a', (st.opacity||20)/100));
    });
    g.append(wrap);
  }

  function render(){
    clearDefs(); artLayer.innerHTML=''; selectionLayer.innerHTML=''; stampPreviewLayer.innerHTML='';
    $('canvasBackground').setAttribute('fill',state.transparent?'none':state.bg);
    renderGridGuides();

    for(const item of state.items){
      if(item.kind==='image'){
        const g=svgEl('g',{'data-id':item.id,transform:`translate(${item.x} ${item.y}) rotate(${item.rotation||0} ${item.w/2} ${item.h/2})`});
        const img=svgEl('image',{href:item.src,x:0,y:0,width:item.w,height:item.h,preserveAspectRatio:'none'});
        const imgShadow=createImageShadowFilter(item); if(imgShadow) img.setAttribute('filter',imgShadow);
        g.append(img); artLayer.append(g); continue;
      }

      const g=svgEl('g',{'data-id':item.id,transform:`translate(${item.x} ${item.y}) rotate(${item.rotation||0} ${item.w/2} ${item.h/2}) scale(${item.w/100} ${item.h/100})`});
      g.style.cursor=state.tool==='select'?'move':'crosshair';
      if(item.kind==='pen'){
        const p=svgEl('path',{d:item.d,fill:'none',stroke:item.color,'stroke-width':item.width,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':`${item.dash} ${item.gap}`,'vector-effect':'non-scaling-stroke'}); g.append(p);
      } else {
        const d=itemPath(item), lineMode=item.kind==='stamp'&&LINE_STAMPS.has(item.type);
        const fill=createFillDef(item), pastel=createPastelFilter(item), patt=createPatternDef(item), shade=createShadeDef(item), blur=createBlurFilter(item), bleed=createEdgeBleedFilter(item), glowFilter=createOuterGlowFilter(item);

        if(!lineMode && bleed){
          const edge=svgEl('path',{d,fill:item.fillA,stroke:'none',opacity:Math.min(.92,.18+(+item.strokeFx?.softness||0)*.09)});
          edge.setAttribute('filter',bleed); g.append(edge);
        }
        if(item.glow?.enabled){
          const glowWidth=Math.max(0.8, (lineMode?(+item.lineWidth||3):0) + ((+item.glow.spread||0)*2));
          const glow=svgEl('path',{d,fill:'none',stroke:item.glow.color,'stroke-width':glowWidth,opacity:(+item.glow.opacity||0)/100,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'});
          if(glowFilter) glow.setAttribute('filter',glowFilter);
          g.append(glow);
        }
        if(item.shadow?.enabled){
          const sh=svgEl('path',{d,fill:lineMode?'none':item.shadow.color,stroke:lineMode?item.shadow.color:'none','stroke-width':lineMode?(item.lineWidth||3):0,opacity:(+item.shadow.opacity||0)/100,transform:`translate(${+item.shadow.x||0} ${+item.shadow.y||0})`,'stroke-linecap':'round','stroke-linejoin':'round'});
          if(blur) sh.setAttribute('filter',blur); g.append(sh);
        }

        appendOutlineBands(g,d,item,lineMode);

        if(lineMode){
          const baseLine=svgEl('path',{d,fill:'none',stroke:item.fillA,'stroke-width':item.lineWidth||3,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}); g.append(baseLine);
        } else {
          const base=svgEl('path',{d,fill,stroke:'none'}); if(pastel) base.setAttribute('filter',pastel); g.append(base);
          if(patt){
            const clipId='clip_'+item.id;
            const cp=svgEl('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'}); cp.append(svgEl('path',{d})); addDef(cp);
            const pg=svgEl('g',{'clip-path':`url(#${clipId})`});
            const rect=svgEl('rect',{x:item.pattern.x,y:item.pattern.y,width:item.pattern.w,height:item.pattern.h,fill:patt});
            pg.append(rect);
            if(+item.pattern.blur>0 && item.pattern.blurDir!=='none'){
              const blurCopy=svgEl('rect',{x:item.pattern.x,y:item.pattern.y,width:item.pattern.w,height:item.pattern.h,fill:patt});
              const patBlur = createSimpleBlur('pblur_'+item.id, item.pattern.blur);
              const mask = createPatternEdgeMask(item);
              if(patBlur) blurCopy.setAttribute('filter',patBlur);
              if(mask) blurCopy.setAttribute('mask',mask);
              pg.append(blurCopy);
            }
            g.append(pg);
          }
          renderAccentPaint(g,item,d);
          if(shade){ const sh=svgEl('path',{d,fill:shade,stroke:'none'}); sh.style.mixBlendMode='multiply'; g.append(sh); }
          if(item.innerLine?.enabled){
            const ins=clamp(+item.innerLine.inset||6,1,28);
            const sx=((100-ins*2)/100) * (+item.innerLine.scaleX||1);
            const sy=((100-ins*2)/100) * (+item.innerLine.scaleY||1);
            const tx=ins + (+item.innerLine.offsetX||0);
            const ty=ins + (+item.innerLine.offsetY||0);
            const inner=svgEl('path',{d,fill:'none',stroke:item.innerLine.color,'stroke-width':item.innerLine.width,'stroke-dasharray':`${item.innerLine.dash} ${item.innerLine.gap}`,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke',transform:`translate(${tx} ${ty}) scale(${sx} ${sy})`}); g.append(inner);
          }
        }
      }
      artLayer.append(g);
    }

    renderSelection();
    updateStampGhost(lastPointer);
    renderPageList();
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
    if(it.kind!=='pen' && it.kind!=='image' && it.innerLine?.enabled){
      const ir=getInnerRectPixels(it);
      g.append(svgEl('rect',{x:ir.x,y:ir.y,width:ir.w,height:ir.h,class:'inner-select-box','data-inner-box':'move','data-id':it.id}));
      [['nw',ir.x,ir.y],['ne',ir.x+ir.w,ir.y],['se',ir.x+ir.w,ir.y+ir.h],['sw',ir.x,ir.y+ir.h]].forEach(([h,x,y])=>g.append(svgEl('circle',{cx:x,cy:y,r:2.3,class:'inner-resize-handle','data-inner-handle':h,'data-id':it.id})));
    }
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
    applyZoom(); render(); syncInspector(); syncStampUI(); updateToolButtons(); syncPresetUI();
  }
  function syncPresetUI(){
    document.querySelectorAll('#presetList [data-preset]').forEach(btn=>btn.classList.toggle('active', +btn.dataset.preset===state.currentPresetIndex));
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
    $('selectedTypeBadge').textContent=it.kind==='shape'?'도형':it.kind==='stamp'?'스탬프':it.kind==='image'?'이미지':'점선 펜';
    $('posX').value=(+it.x).toFixed(1).replace('.0',''); $('posY').value=(+it.y).toFixed(1).replace('.0','');
    $('sizeReadout').textContent=`크기 ${(+it.w).toFixed(1).replace('.0','')} × ${(+it.h).toFixed(1).replace('.0','')}`;
    $('rotation').value=it.rotation||0; $('rotationValue').textContent=Math.round((it.rotation||0)*10)/10+'°';

    const shapeLike=it.kind==='shape'||it.kind==='stamp';
    $('fillSection').classList.toggle('hidden',!shapeLike); $('strokeSection').classList.toggle('hidden',!shapeLike); $('effectsSection').classList.toggle('hidden',!shapeLike);
    $('penInspectorSection').classList.toggle('hidden',it.kind!=='pen');
    $('lineStampSection').classList.toggle('hidden',!(it.kind==='stamp'&&LINE_STAMPS.has(it.type)));
    $('imageShadowSection').classList.toggle('hidden',it.kind!=='image');

    if(it.kind==='pen'){
      $('selectedPenColor').value=it.color; $('selectedPenWidth').value=it.width; $('selectedPenDash').value=it.dash; $('selectedPenGap').value=it.gap; return;
    }
    if(it.kind==='image'){
      $('imageShadowEnabled').checked=!!it.shadow?.enabled;
      $('imageShadowControls').classList.toggle('hidden',!it.shadow?.enabled);
      $('imageShadowColor').value=it.shadow?.color || '#6c6175';
      $('imageShadowOpacity').value=it.shadow?.opacity ?? 18;
      const ang=((Math.atan2(it.shadow?.y||0,it.shadow?.x||0)*180/Math.PI)+360)%360;
      const dist=Math.hypot(it.shadow?.x||0,it.shadow?.y||0);
      $('imageShadowAngle').value=Number.isFinite(ang)?ang:56;
      $('imageShadowDistance').value=dist.toFixed(1);
      $('imageShadowBlur').value=it.shadow?.blur ?? 4;
      return;
    }

    $('fillMode').value=it.fillMode; $('fillA').value=it.fillA; $('fillB').value=it.fillB;
    $('gradientAngle').value=it.gradAngle; $('gradientAngleValue').textContent=it.gradAngle+'°'; $('gradientStart').value=it.gradStart; $('gradientEnd').value=it.gradEnd;
    $('gradientAngleRow').classList.toggle('hidden',it.fillMode==='solid'||it.fillMode==='radial'); $('gradientRangeRow').classList.toggle('hidden',it.fillMode==='solid');

    $('shadeEnabled').checked=it.shade.enabled; $('shadeControls').classList.toggle('hidden',!it.shade.enabled); $('shadeColor').value=it.shade.color; $('shadeOpacity').value=it.shade.opacity; $('shadeAngle').value=it.shade.angle; $('shadeAngleValue').textContent=it.shade.angle+'°';
    $('patternMode').value=it.pattern.mode; $('patternControls').classList.toggle('hidden',it.pattern.mode==='none'); $('patternColor').value=it.pattern.color; $('patternOpacity').value=it.pattern.opacity;
    $('patternSize').value=it.pattern.size; $('patternGap').value=it.pattern.gap; $('patternX').value=it.pattern.x; $('patternY').value=it.pattern.y; $('patternW').value=it.pattern.w; $('patternH').value=it.pattern.h; $('patternBlur').value=it.pattern.blur; $('patternBlurDir').value=it.pattern.blurDir||'none'; $('patternBlurSpan').value=it.pattern.blurSpan||12;
    $('innerLineEnabled').checked=it.innerLine.enabled; $('innerLineControls').classList.toggle('hidden',!it.innerLine.enabled); $('innerLineColor').value=it.innerLine.color; $('innerLineWidth').value=it.innerLine.width; $('innerLineDash').value=it.innerLine.dash; $('innerLineGap').value=it.innerLine.gap; $('innerLineInset').value=it.innerLine.inset; $('innerLineOffsetX').value=it.innerLine.offsetX; $('innerLineOffsetY').value=it.innerLine.offsetY; $('innerLineScaleX').value=it.innerLine.scaleX; $('innerLineScaleY').value=it.innerLine.scaleY;
    $('shadowEnabled').checked=it.shadow.enabled; $('shadowControls').classList.toggle('hidden',!it.shadow.enabled); $('shadowColor').value=it.shadow.color; $('shadowOpacity').value=it.shadow.opacity; $('shadowX').value=it.shadow.x; $('shadowY').value=it.shadow.y; $('shadowBlur').value=it.shadow.blur;
    $('glowEnabled').checked=it.glow?.enabled; $('glowControls').classList.toggle('hidden',!it.glow?.enabled); $('glowColor').value=it.glow?.color || '#ffffff'; $('glowOpacity').value=it.glow?.opacity ?? 38; $('glowSpread').value=it.glow?.spread ?? 1.6; $('glowBlur').value=it.glow?.blur ?? 4;
    $('strokeSoftness').value=it.strokeFx?.softness || 0; $('strokeTexture').value=it.strokeFx?.texture || 0;
    if(it.kind==='stamp'&&LINE_STAMPS.has(it.type)){ $('lineColor').value=it.fillA; $('lineWidth').value=it.lineWidth; }
    renderStrokeList(it);
  }

  function renderStrokeList(it){
    const list=$('strokeList');
    list.innerHTML=(it.strokes||[]).map((s,i)=>`<div class="stroke-row" data-i="${i}"><span class="stroke-index">${i+1}</span><input class="stroke-color" aria-label="${i+1}번 획 색상" type="color" value="${s.color}"><input class="stroke-width-range" aria-label="${i+1}번 획 두께 슬라이더" type="range" min="0" max="30" step="0.1" value="${s.width}"><input class="stroke-width-num" aria-label="${i+1}번 획 두께 숫자" type="number" min="0" max="30" step="0.1" value="${s.width}"><button class="stroke-up" title="바깥쪽으로">▲</button><button class="stroke-down" title="안쪽으로">▼</button><button class="stroke-del" title="삭제">×</button></div>`).join('') || '<div class="small-copy">획이 없습니다.</div>';

    list.querySelectorAll('.stroke-row').forEach(row=>{
      const index=()=>+row.dataset.i;
      const color=row.querySelector('.stroke-color'); const range=row.querySelector('.stroke-width-range'); const num=row.querySelector('.stroke-width-num');
      color.addEventListener('input',e=>{const cur=selected(); if(!cur||!cur.strokes[index()])return; cur.strokes[index()].color=e.target.value; render();});
      color.addEventListener('change',()=>pushHistory());
      const applyWidth=(v)=>{const cur=selected(); if(!cur||!cur.strokes[index()])return; const n=Math.max(0,+v||0); cur.strokes[index()].width=n; range.value=n; num.value=n; render();};
      range.addEventListener('input',e=>applyWidth(e.target.value));
      num.addEventListener('input',e=>applyWidth(e.target.value));
      range.addEventListener('change',()=>pushHistory());
      num.addEventListener('change',()=>pushHistory());
    });
  }

  function updateToolButtons(){
    document.querySelectorAll('#toolModeGroup button').forEach(b=>b.classList.toggle('active',b.dataset.tool===state.tool));
    $('penSettings').classList.toggle('hidden',state.tool!=='pen'); $('pointPenSettings').classList.toggle('hidden',state.tool!=='pointpen'); $('fadeEraseSettings').classList.toggle('hidden',state.tool!=='fadeerase'); $('stageWrap').classList.toggle('pen-cursor',state.tool==='pen'||state.tool==='pointpen'||state.tool==='fadeerase'); $('stageWrap').classList.toggle('stamp-cursor',state.tool==='stamp');
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
    ['patternColor','patternOpacity','patternSize','patternGap','patternX','patternY','patternW','patternH','patternBlur','patternBlurSpan'].forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it||!it.pattern)return;const map={patternColor:'color',patternOpacity:'opacity',patternSize:'size',patternGap:'gap',patternX:'x',patternY:'y',patternW:'w',patternH:'h',patternBlur:'blur',patternBlurSpan:'blurSpan'};it.pattern[map[id]]=id==='patternColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });
    $('patternBlurDir').addEventListener('change',()=>{const it=selected();if(!it||!it.pattern)return;it.pattern.blurDir=$('patternBlurDir').value;pushHistory();render();syncInspector();});

    $('innerLineEnabled').addEventListener('change',()=>{const it=selected();if(!it)return;it.innerLine.enabled=$('innerLineEnabled').checked;pushHistory();render();syncInspector();});
    ['innerLineColor','innerLineWidth','innerLineDash','innerLineGap','innerLineInset','innerLineOffsetX','innerLineOffsetY','innerLineScaleX','innerLineScaleY'].forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it)return;const map={innerLineColor:'color',innerLineWidth:'width',innerLineDash:'dash',innerLineGap:'gap',innerLineInset:'inset',innerLineOffsetX:'offsetX',innerLineOffsetY:'offsetY',innerLineScaleX:'scaleX',innerLineScaleY:'scaleY'};it.innerLine[map[id]]=id==='innerLineColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('shadowEnabled').addEventListener('change',()=>{const it=selected();if(!it)return;it.shadow.enabled=$('shadowEnabled').checked;pushHistory();render();syncInspector();});
    ['shadowColor','shadowOpacity','shadowX','shadowY','shadowBlur'].forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it)return;const map={shadowColor:'color',shadowOpacity:'opacity',shadowX:'x',shadowY:'y',shadowBlur:'blur'};it.shadow[map[id]]=id==='shadowColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('glowEnabled').addEventListener('change',()=>{const it=selected();if(!it||it.kind==='image'||it.kind==='pen')return;it.glow.enabled=$('glowEnabled').checked;pushHistory();render();syncInspector();});
    ['glowColor','glowOpacity','glowSpread','glowBlur'].forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it||it.kind==='image'||it.kind==='pen')return;const map={glowColor:'color',glowOpacity:'opacity',glowSpread:'spread',glowBlur:'blur'};it.glow[map[id]]=id==='glowColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('imageShadowEnabled').addEventListener('change',()=>{const it=selected();if(!it||it.kind!=='image')return;it.shadow=it.shadow||{enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:4};it.shadow.enabled=$('imageShadowEnabled').checked;pushHistory();render();syncInspector();});
    const syncImageShadow=()=>{const it=selected();if(!it||it.kind!=='image')return;it.shadow=it.shadow||{enabled:false,color:'#6c6175',opacity:18,x:2,y:3,blur:4};it.shadow.color=$('imageShadowColor').value;it.shadow.opacity=+$('imageShadowOpacity').value;it.shadow.blur=+$('imageShadowBlur').value; const ang=(+$('imageShadowAngle').value||0)*Math.PI/180; const dist=(+$('imageShadowDistance').value||0); it.shadow.x=Math.cos(ang)*dist; it.shadow.y=Math.sin(ang)*dist; render();};
    ['imageShadowColor','imageShadowOpacity','imageShadowAngle','imageShadowDistance','imageShadowBlur'].forEach(id=>{ $(id).addEventListener('input',syncImageShadow); $(id).addEventListener('change',pushHistory); });

    $('lineColor').addEventListener('input',()=>{const it=selected();if(!it)return;it.fillA=$('lineColor').value;render();}); $('lineColor').addEventListener('change',pushHistory);
    $('lineWidth').addEventListener('input',()=>{const it=selected();if(!it)return;it.lineWidth=Math.max(.5,+$('lineWidth').value||.5);render();}); $('lineWidth').addEventListener('change',pushHistory);

    ['strokeSoftness','strokeTexture'].forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected(); if(!it||!it.strokeFx)return; const key=id==='strokeSoftness'?'softness':'texture'; it.strokeFx[key]=Math.max(0,+$(id).value||0); render();});
      $(id).addEventListener('change',pushHistory);
    });

    const penMap={selectedPenColor:'color',selectedPenWidth:'width',selectedPenDash:'dash',selectedPenGap:'gap'};
    Object.keys(penMap).forEach(id=>{
      $(id).addEventListener('input',()=>{const it=selected();if(!it||it.kind!=='pen')return;it[penMap[id]]=id==='selectedPenColor'?$(id).value:+$(id).value;render();});
      $(id).addEventListener('change',pushHistory);
    });

    $('addStrokeBtn').addEventListener('click',()=>{const it=selected();if(!it)return;it.strokes=it.strokes||[];it.strokes.unshift({color:'#ffffff',width:3});pushHistory();render();syncInspector();});
    $('strokeList').addEventListener('click',e=>{const row=e.target.closest('.stroke-row'),it=selected();if(!row||!it)return;const i=+row.dataset.i;if(e.target.classList.contains('stroke-up')&&i>0)[it.strokes[i-1],it.strokes[i]]=[it.strokes[i],it.strokes[i-1]];else if(e.target.classList.contains('stroke-down')&&i<it.strokes.length-1)[it.strokes[i+1],it.strokes[i]]=[it.strokes[i],it.strokes[i+1]];else if(e.target.classList.contains('stroke-del'))it.strokes.splice(i,1);else return;pushHistory();render();syncInspector();});
    $('clearPointBrushBtn').addEventListener('click',()=>{const it=selected(); if(!it||it.kind==='image'||it.kind==='pen') return; it.accentPaint=it.accentPaint||{strokes:[],erasers:[]}; it.accentPaint.strokes=[]; pushHistory(); render(); showToast('포인트 펜 흔적을 지웠습니다.');});
    $('clearFadeEraseBtn').addEventListener('click',()=>{const it=selected(); if(!it||it.kind==='image'||it.kind==='pen') return; it.accentPaint=it.accentPaint||{strokes:[],erasers:[]}; it.accentPaint.erasers=[]; pushHistory(); render(); showToast('페이드 지우개 흔적을 지웠습니다.');});
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
  function addPointOrEraseFromPoints(points, mode){
    const host=selected();
    if(!host || host.kind==='pen' || host.kind==='image') return;
    if(points.length<2) return;
    const local=points.map(p=>globalToLocal(host,p)).map(p=>({x:clamp(p.x/Math.max(1,host.w)*100,-40,140),y:clamp(p.y/Math.max(1,host.h)*100,-40,140)}));
    host.accentPaint=host.accentPaint||{strokes:[],erasers:[]};
    if(mode==='pointpen'){
      host.accentPaint.strokes.push({brush:$('pointBrush').value,color:$('pointColor').value,opacity:+$('pointOpacity').value,size:+$('pointSize').value,spacing:+$('pointSpacing').value,points:local});
    } else {
      host.accentPaint.erasers.push({size:+$('eraserSize').value,softness:+$('eraserSoftness').value,points:local});
    }
    pushHistory(); render(); syncInspector();
  }
  function samplePolyline(points, spacing){
    if(!points || points.length===0) return [];
    if(points.length===1) return [points[0]];
    const out=[points[0]]; let remain=Math.max(.15,spacing||1);
    for(let i=1;i<points.length;i++){
      const a=points[i-1], b=points[i];
      let dx=b.x-a.x, dy=b.y-a.y, seg=Math.hypot(dx,dy), start=a;
      while(seg>=remain){
        const t=remain/seg;
        const p={x:start.x+dx*t,y:start.y+dy*t};
        out.push(p); start=p; dx=b.x-start.x; dy=b.y-start.y; seg=Math.hypot(dx,dy); remain=Math.max(.15,spacing||1);
      }
      remain-=seg;
      if(remain<=0) remain=Math.max(.15,spacing||1);
    }
    return out;
  }
  function drawAccentSymbol(group, brush, x, y, size, color, opacity){
    const g=svgEl('g',{transform:`translate(${x} ${y}) scale(${Math.max(.05,size)/100})`});
    const common={fill:color,opacity};
    if(brush==='dots') g.append(svgEl('circle',{cx:0,cy:0,r:22,...common}));
    else if(brush==='sparkles') g.append(svgEl('path',{d:'M0,-34 C3,-12 10,-5 34,0 C10,5 3,12 0,34 C-3,12 -10,5 -34,0 C-10,-5 -3,-12 0,-34 Z M-22,-20 C-21,-11 -17,-7 -9,-5 C-17,-3 -21,1 -22,10 C-23,1 -27,-3 -35,-5 C-27,-7 -23,-11 -22,-20 Z',...common}));
    else if(brush==='tinyhearts') g.append(svgEl('path',{d:'M0,28 C-8,18 -22,10 -22,-4 C-22,-14 -15,-20 -8,-20 C-3,-20 -1,-16 0,-12 C1,-16 3,-20 8,-20 C15,-20 22,-14 22,-4 C22,10 8,18 0,28 Z',...common}));
    else if(brush==='confetti'){
      g.append(svgEl('line',{x1:-22,y1:-10,x2:-6,y2:6,stroke:color,'stroke-width':8,opacity,'stroke-linecap':'round'}));
      g.append(svgEl('line',{x1:6,y1:10,x2:22,y2:-6,stroke:color,'stroke-width':8,opacity,'stroke-linecap':'round'}));
      g.append(svgEl('circle',{cx:0,cy:20,r:4,fill:color,opacity}));
    }
    group.append(g);
  }
  function rdp(points,eps){if(points.length<3)return points;let max=0,index=0;for(let i=1;i<points.length-1;i++){const d=perp(points[i],points[0],points[points.length-1]);if(d>max){max=d;index=i;}}if(max>eps){const a=rdp(points.slice(0,index+1),eps),b=rdp(points.slice(index),eps);return a.slice(0,-1).concat(b);}return [points[0],points[points.length-1]];}
  function perp(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;if(dx===0&&dy===0)return Math.hypot(p.x-a.x,p.y-a.y);return Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/Math.hypot(dx,dy);}
  function chaikin(points,n){let pts=points;for(let k=0;k<n;k++){const out=[pts[0]];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];out.push({x:.75*a.x+.25*b.x,y:.75*a.y+.25*b.y},{x:.25*a.x+.75*b.x,y:.25*a.y+.75*b.y});}out.push(pts[pts.length-1]);pts=out;}return pts;}
  function catmullPath(pts){if(pts.length<2)return '';if(pts.length===2)return`M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;let d=`M${pts[0].x},${pts[0].y}`;for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6},c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};d+=` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;}return d;}

  function rotatePoint(p,c,deg){const a=deg*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),dx=p.x-c.x,dy=p.y-c.y;return{x:c.x+dx*cos-dy*sin,y:c.y+dx*sin+dy*cos};}
  function localToGlobal(it,x,y){const c={x:it.x+it.w/2,y:it.y+it.h/2};return rotatePoint({x:it.x+x,y:it.y+y},c,it.rotation||0);}
  function globalToLocal(it,p){const c={x:it.x+it.w/2,y:it.y+it.h/2};const a=-(it.rotation||0)*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),dx=p.x-c.x,dy=p.y-c.y;const gx=c.x+dx*cos-dy*sin,gy=c.y+dx*sin+dy*cos;return {x:gx-it.x,y:gy-it.y};}
  function getInnerRectPixels(it){const ins=clamp(+it.innerLine?.inset||6,1,28);const sx=((100-ins*2)/100)*(+it.innerLine?.scaleX||1);const sy=((100-ins*2)/100)*(+it.innerLine?.scaleY||1);const tx=ins+(+it.innerLine?.offsetX||0);const ty=ins+(+it.innerLine?.offsetY||0);return {x:tx/100*it.w,y:ty/100*it.h,w:sx*it.w,h:sy*it.h};}

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
    if(keepRatio&&g.cfg.sx&&g.cfg.sy){ if(nw/nh>g.ratio) nh=nw/g.ratio; else nw=nh*g.ratio; }
    if(state.snap){nw=Math.max(4,snap(nw));nh=Math.max(4,snap(nh));}
    let c;
    if(g.cfg.sx&&g.cfg.sy){c={x:g.anchor.x+g.u.x*g.cfg.sx*nw/2+g.v.x*g.cfg.sy*nh/2,y:g.anchor.y+g.u.y*g.cfg.sx*nw/2+g.v.y*g.cfg.sy*nh/2};}
    else if(g.cfg.sx){c={x:g.anchor.x+g.u.x*g.cfg.sx*nw/2,y:g.anchor.y+g.u.y*g.cfg.sx*nw/2};}
    else {c={x:g.anchor.x+g.v.x*g.cfg.sy*nh/2,y:g.anchor.y+g.v.y*g.cfg.sy*nh/2};}
    it.w=nw;it.h=nh;it.x=c.x-nw/2;it.y=c.y-nh/2;render();syncInspector();
  }

  function beginInnerEdit(mode, handle, p, it){
    const rect=getInnerRectPixels(it);
    gesture={type:mode,id:it.id,handle,init:clone(it.innerLine),rect,startLocal:globalToLocal(it,p),startRect:rect};
  }
  function updateInnerGesture(p){
    const it=selected(), g=gesture; if(!it||!g||!it.innerLine) return;
    const cur=globalToLocal(it,p); const dx=cur.x-g.startLocal.x, dy=cur.y-g.startLocal.y;
    let rect={...g.startRect};
    if(g.type==='innerMove'){
      rect.x+=dx; rect.y+=dy;
    } else {
      const min=4;
      if(g.handle==='nw'){ rect.x+=dx; rect.y+=dy; rect.w-=dx; rect.h-=dy; }
      if(g.handle==='ne'){ rect.y+=dy; rect.w+=dx; rect.h-=dy; }
      if(g.handle==='se'){ rect.w+=dx; rect.h+=dy; }
      if(g.handle==='sw'){ rect.x+=dx; rect.w-=dx; rect.h+=dy; }
      rect.w=Math.max(min,rect.w); rect.h=Math.max(min,rect.h);
    }
    const inset=clamp(+it.innerLine.inset||6,1,28);
    const baseW=((100-inset*2)/100)*it.w, baseH=((100-inset*2)/100)*it.h;
    it.innerLine.offsetX=rect.x*100/it.w - inset;
    it.innerLine.offsetY=rect.y*100/it.h - inset;
    it.innerLine.scaleX=clamp(rect.w/Math.max(1,baseW),.2,3);
    it.innerLine.scaleY=clamp(rect.h/Math.max(1,baseH),.2,3);
    render(); syncInspector();
  }

  function bindStage(){
    stage.addEventListener('pointerdown',e=>{
      const p=clientToStage(e); lastPointer=p;
      if(state.tool==='stamp'){stampAt(p.x,p.y);return;}
      if(state.tool==='pen'){
        pen={points:[p]};$('livePenPath').setAttribute('opacity','1');$('livePenPath').setAttribute('d',`M${p.x},${p.y}`);$('livePenPath').setAttribute('stroke',$('penColor').value);$('livePenPath').setAttribute('stroke-width',$('penWidth').value);$('livePenPath').setAttribute('stroke-dasharray',`${$('penDash').value} ${$('penGap').value}`);stage.setPointerCapture(e.pointerId);return;
      }
      if(state.tool==='pointpen' || state.tool==='fadeerase'){
        const host=selected();
        if(!host || host.kind==='pen' || host.kind==='image'){ showToast('먼저 도형 또는 스탬프를 선택해 주세요.'); return; }
        paintStroke={mode:state.tool,points:[p]};
        $('livePenPath').setAttribute('opacity','1');
        $('livePenPath').setAttribute('d',`M${p.x},${p.y}`);
        $('livePenPath').setAttribute('stroke',state.tool==='pointpen' ? $('pointColor').value : '#8f80b3');
        $('livePenPath').setAttribute('stroke-width',state.tool==='pointpen' ? Math.max(1,+$('pointSize').value||1) : Math.max(2,+$('eraserSize').value/2||2));
        $('livePenPath').setAttribute('stroke-dasharray','');
        stage.setPointerCapture(e.pointerId); return;
      }

      const innerHandle=e.target.closest?.('[data-inner-handle]');
      if(innerHandle&&innerHandle.getAttribute('data-id')===state.selectedId){
        const it=selected(); beginInnerEdit('innerResize', innerHandle.getAttribute('data-inner-handle'), p, it); stage.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }
      const innerBox=e.target.closest?.('[data-inner-box]');
      if(innerBox&&innerBox.getAttribute('data-id')===state.selectedId){
        const it=selected(); beginInnerEdit('innerMove', 'move', p, it); $('stageWrap').classList.add('drag-cursor'); stage.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }

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
      if(paintStroke){paintStroke.points.push(p);$('livePenPath').setAttribute('d',catmullPath(paintStroke.points));return;}
      if(!gesture)return;
      const it=selected();if(!it)return;
      if(gesture.type==='move'){it.x=snap(gesture.x+p.x-gesture.start.x);it.y=snap(gesture.y+p.y-gesture.start.y);render();syncInspector();}
      if(gesture.type==='resize') resizeGesture(p,e.shiftKey);
      if(gesture.type==='rotate'){
        const a=Math.atan2(p.y-gesture.center.y,p.x-gesture.center.x);let deg=gesture.init.rotation+(a-gesture.startAngle)*180/Math.PI;if(e.shiftKey)deg=Math.round(deg/15)*15;it.rotation=Math.round(deg*10)/10;render();syncInspector();
      }
      if(gesture.type==='innerMove' || gesture.type==='innerResize') updateInnerGesture(p);
    });

    stage.addEventListener('pointerleave',()=>{if(state.tool==='stamp'){lastPointer=null;stampPreviewLayer.innerHTML='';}});
    stage.addEventListener('pointerenter',e=>{if(state.tool==='stamp'){lastPointer=clientToStage(e);updateStampGhost(lastPointer);}});

    stage.addEventListener('pointerup',e=>{
      if(pen){const pts=pen.points;pen=null;$('livePenPath').setAttribute('opacity','0');addPenFromPoints(pts);}
      if(paintStroke){const pts=paintStroke.points, mode=paintStroke.mode; paintStroke=null; $('livePenPath').setAttribute('opacity','0'); addPointOrEraseFromPoints(pts, mode);}
      if(gesture){gesture=null;$('stageWrap').classList.remove('drag-cursor');pushHistory();}
      try{stage.releasePointerCapture(e.pointerId);}catch{}
    });
  }

  function deleteSelected(){const i=state.items.findIndex(x=>x.id===state.selectedId);if(i<0)return;state.items.splice(i,1);state.selectedId=null;pushHistory();render();syncInspector();}
  function duplicateSelected(){const it=selected();if(!it)return;const c=clone(it);c.id=uid();c.x+=8;c.y+=8;state.items.push(c);state.selectedId=c.id;pushHistory();render();syncInspector();}
  function moveLayer(dir){const i=state.items.findIndex(x=>x.id===state.selectedId);if(i<0)return;const j=clamp(i+dir,0,state.items.length-1);if(i===j)return;const [it]=state.items.splice(i,1);state.items.splice(j,0,it);pushHistory();render();}
  function align(action){const it=selected();if(!it)return;if(action==='centerX')it.x=(W-it.w)/2;if(action==='centerY')it.y=(H-it.h)/2;if(action==='cover'){const r=Math.max(W/it.w,H/it.h);it.w*=r;it.h*=r;it.x=(W-it.w)/2;it.y=(H-it.h)/2;}pushHistory();render();syncInspector();}

  function cleanSvgForExport(){
    const cloneSvg=stage.cloneNode(true);
    cloneSvg.querySelector('#selectionLayer')?.remove(); cloneSvg.querySelector('#guideLayer')?.remove(); cloneSvg.querySelector('#gridLayer')?.remove(); cloneSvg.querySelector('#stampPreviewLayer')?.remove(); cloneSvg.querySelector('#livePenPath')?.remove();
    cloneSvg.setAttribute('width',W); cloneSvg.setAttribute('height',H); cloneSvg.style.width=''; cloneSvg.style.height=''; cloneSvg.removeAttribute('aria-label');
    return cloneSvg;
  }
  function svgString(){const s=cleanSvgForExport();return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(s);}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},600);}
  function renderCurrentPngBlob(){
    return new Promise((resolve,reject)=>{
      const src=svgString(), blob=new Blob([src],{type:'image/svg+xml;charset=utf-8'}), url=URL.createObjectURL(blob), img=new Image();
      img.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);URL.revokeObjectURL(url);c.toBlob(b=>{ if(b) resolve(b); else reject(new Error('png')); },'image/png');};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('png'));};
      img.src=url;
    });
  }
  function exportSvg(){downloadBlob(new Blob([svgString()],{type:'image/svg+xml;charset=utf-8'}),'cute-badge-293x164-v1.2.svg');showToast('SVG를 저장했어요.');}
  async function exportPng(){try{const b=await renderCurrentPngBlob();downloadBlob(b,`${fileSafe(pages[activePageIndex].name)}.png`);showToast('현재 페이지 PNG를 저장했어요.');}catch{showToast('PNG 변환 중 오류가 발생했어요.');}}
  async function exportAllZip(){
    captureCurrentPage();
    if(typeof JSZip==='undefined'){ showToast('ZIP 라이브러리를 불러오지 못했어요.'); return; }
    const zip = new JSZip();
    const originalIndex = activePageIndex;
    const originalSnapshot = clone(pageSnapshot());
    try{
      for(let i=0;i<pages.length;i++){
        activePageIndex=i;
        applySnapshot(clone(pages[i].snapshot || blankSnapshot()));
        render();
        const blob = await renderCurrentPngBlob();
        zip.file(`${String(i+1).padStart(2,'0')}_${fileSafe(pages[i].name)}.png`, blob);
      }
      activePageIndex = originalIndex; applySnapshot(originalSnapshot); render(); syncInspector(); renderPageList();
      const out = await zip.generateAsync({type:'blob'});
      downloadBlob(out,'cute_badge_background_pages_v1.2.zip');
      showToast('모든 페이지를 ZIP으로 저장했어요.');
    }catch(err){
      activePageIndex = originalIndex; applySnapshot(originalSnapshot); render(); syncInspector(); renderPageList();
      showToast('ZIP 저장 중 오류가 발생했어요.');
      console.error(err);
    }
  }
  function saveProject(){
    captureCurrentPage();
    const data={app:'Cute Badge Background Studio',version:'1.5',canvas:{width:W,height:H},pages,activePageIndex,ui:{grid:state.grid,safe:state.safe,snap:state.snap}};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),'cute-badge-project-v1.5.json');
  }
  function openProject(file){
    const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);
      if(Array.isArray(d.pages)){
        pages=d.pages.map((p,i)=>({name:p.name||`페이지 ${i+1}`, snapshot:(p.snapshot||p.state||blankSnapshot())}));
        activePageIndex=clamp(+d.activePageIndex||0,0,pages.length-1);
        applySnapshot(clone(pages[activePageIndex].snapshot || blankSnapshot()));
      } else if(d.state && Array.isArray(d.state.items)){
        pages=[{name:'페이지 1', snapshot:{bg:d.state.bg||'#ffffff', transparent:!!d.state.transparent, items:d.state.items, selectedId:d.state.items[0]?.id||null, currentPresetIndex:null}}];
        activePageIndex=0; applySnapshot(clone(pages[0].snapshot));
      } else throw 0;
      if(d.ui){ state.grid=!!d.ui.grid; state.safe=!!d.ui.safe; state.snap=!!d.ui.snap; }
      state.tool='select';history=[];historyIndex=-1;pushHistory();syncAll();renderPageList();showToast('프로젝트를 불러왔어요.');
    }catch{showToast('올바른 프로젝트 파일이 아니에요.');}};r.readAsText(file,'utf-8');
  }

  function bindUI(){
    $('undoBtn').onclick=()=>restoreHistory(historyIndex-1); $('redoBtn').onclick=()=>restoreHistory(historyIndex+1);
    $('exportSvgBtn').onclick=exportSvg; $('exportPngBtn').onclick=exportPng; $('exportAllZipBtn').onclick=exportAllZip; $('saveProjectBtn').onclick=saveProject;
    $('openProjectInput').onchange=e=>{if(e.target.files[0])openProject(e.target.files[0]);e.target.value='';};
    $('imageInput').onchange=e=>{if(e.target.files[0])addImageFromFile(e.target.files[0]); e.target.value='';};
    $('addPageBtn').onclick=addPage; $('duplicatePageBtn').onclick=duplicatePage; $('deletePageBtn').onclick=deletePage;

    $('canvasBgColor').oninput=e=>{state.bg=e.target.value;render();}; $('canvasBgColor').onchange=pushHistory; $('transparentBg').onchange=e=>{state.transparent=e.target.checked;pushHistory();render();};
    $('gridToggle').onchange=e=>{state.grid=e.target.checked;render();}; $('safeToggle').onchange=e=>{state.safe=e.target.checked;render();}; $('snapToggle').onchange=e=>{state.snap=e.target.checked;};
    $('zoomRange').oninput=e=>{state.zoom=+e.target.value/100;applyZoom();}; $('zoomOutBtn').onclick=()=>{state.zoom=clamp(state.zoom-.25,.75,3);applyZoom();}; $('zoomInBtn').onclick=()=>{state.zoom=clamp(state.zoom+.25,.75,3);applyZoom();}; $('fitBtn').onclick=fitStage;
    $('toolModeGroup').onclick=e=>{const b=e.target.closest('[data-tool]');if(!b)return;state.tool=b.dataset.tool;updateToolButtons();render();const msg=state.tool==='pen'?'미리보기에서 드래그해 점선을 그리세요.':state.tool==='pointpen'?'선택된 도형 안쪽에 포인트를 그리세요.':state.tool==='fadeerase'?'선택된 도형의 포인트를 부드럽게 지우세요.':'오브젝트를 클릭해 이동하거나 손잡이로 크기를 조절하세요.';setStatus(msg);};
    $('exitStampToolBtn').onclick=()=>{state.tool='select';updateToolButtons();render();setStatus('선택 모드로 돌아왔습니다.');};

    const stampInputs={stampFillColor:'fill',stampStrokeColor:'stroke',stampStrokeWidth:'strokeWidth',stampSize:'size',stampRotation:'rotation'};
    Object.keys(stampInputs).forEach(id=>$(id).addEventListener('input',()=>{const key=stampInputs[id];state.stampBrush[key]=(id==='stampFillColor'||id==='stampStrokeColor')?$(id).value:+$(id).value;if(id==='stampRotation')$('stampRotationValue').textContent=state.stampBrush.rotation+'°';updateStampGhost(lastPointer);}));

    $('deleteBtn').onclick=deleteSelected; $('duplicateBtn').onclick=duplicateSelected; $('layerUpBtn').onclick=()=>moveLayer(1); $('layerDownBtn').onclick=()=>moveLayer(-1); document.querySelector('.quick-align').onclick=e=>{const b=e.target.closest('[data-align]');if(b)align(b.dataset.align);};
    window.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;if(e.key==='Escape'&&state.tool!=='select'){state.tool='select';updateToolButtons();render();setStatus('선택 모드로 돌아왔습니다.');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?restoreHistory(historyIndex+1):restoreHistory(historyIndex-1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restoreHistory(historyIndex+1);}if(e.key==='Delete'||e.key==='Backspace')deleteSelected();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();}});
  }

  function init(){
    buildAssetLists(); bindInspector(); bindStage(); bindUI(); applySnapshot(blankSnapshot()); captureCurrentPage(); pushHistory(); renderPageList(); syncAll(); setTimeout(fitStage,50);
  }
  init();
})();
