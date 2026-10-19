import { makeExperiment, countErrors, binaryCapacity, capacityThreshold } from './codec.js';
import { TannerScene } from './graph.js';
import { drawSignal, drawBeliefs, drawConvergence, drawBER, drawCapacity } from './charts.js';
import { slides } from './slides.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const state = { n:24, ebn0:2, iterations:12, seed:7, algorithm:'sum-product', experiment:null, iteration:0, playing:false, tab:'channel', data:[], frames:160 };
let timer, worker, requestId = 0, simulationTimer, resizeTimer, beliefAnimation, labScene;
const scene = new TannerScene($('#network'), $('#node-tooltip'), () => state);
const card = (title, tag, subtitle, id, note, extra = '') => `<div class="plot-card ${extra}"><div class="plot-title">${title}<span class="tag">${tag}</span></div><p class="plot-subtitle">${subtitle}</p><canvas id="${id}" role="img" aria-label="${title}"></canvas><div class="plot-note">${note}</div></div>`;
function renderPlots() {
  const area = $('#lab-plots'), { experiment: e } = state;
  if (state.tab === 'channel') {
    area.innerHTML = card('A signal, with a little interference.', 'BPSK + AWGN', 'Same bits. Different levels of certainty.', 'signal-chart', '<i class="legend-line green-line"></i> Transmitted <i class="legend-line copper-line"></i> Received') + card('What does each bit believe?', 'SOFT DECISIONS', 'Positive favors 0. Negative favors 1. Height is confidence.', 'belief-chart', '<i class="dot green-dot"></i> Correct estimate <i class="dot error-dot"></i> Incorrect estimate · clipped at ±24');
    area.firstElementChild.querySelector('.plot-title .tag').outerHTML='<button class="tag plot-view-toggle" id="toggle-lab-graph">View 3D graph ↗</button>';
    $('#toggle-lab-graph').addEventListener('click',()=>{
      const showingGraph=!!$('#lab-network');
      if(showingGraph){cancelAnimationFrame(labScene?.frame);labScene?.observer?.disconnect();labScene=null;renderPlots();return;}
      const old=$('#signal-chart');old.id='lab-network';old.setAttribute('aria-label','Live orbitable Tanner graph during decoding');
      old.parentElement.querySelector('.plot-subtitle').textContent='Drag to orbit. Watch messages travel between parity checks.';
      $('#toggle-lab-graph').textContent='View signal ↗';
      labScene=new TannerScene(old,$('#node-tooltip'),()=>state);
      labScene.selected=null;
    });
  } else if (state.tab === 'performance') {
    area.innerHTML = card('Does the code earn its keep?', 'MONTE CARLO', 'Coded-bit BER · 160 frames per SNR · same channel before / after decoding', 'ber-chart', '<i class="legend-line green-line"></i> Decoded <i class="legend-line copper-line"></i> Raw · ↓ zero errors at 1/N <span id="ber-progress"></span>') + card('A conversation that converges.', 'THIS SAMPLE', 'Iteration by iteration. Fewer violations, stronger evidence.', 'convergence-chart', '<i class="legend-line green-line"></i> Failed checks <i class="legend-line copper-line"></i> Bit errors');
    area.firstElementChild.insertAdjacentHTML('beforeend','<div class="loading-line" id="ber-loading"></div>');
  } else {
    const capacity = binaryCapacity(state.ebn0,e.code.rate), threshold = capacityThreshold(e.code.rate);
    area.innerHTML = card('There is a limit to what noise allows.', 'BPSK CAPACITY', 'Binary-input AWGN · mutual information per real channel use', 'capacity-chart', '<i class="legend-line green-line"></i> Capacity C <i class="legend-line copper-line"></i> Code rate R') + `<div class="plot-card"><div class="plot-title">Room for reliable communication?<span class="tag">THEORY</span></div><p class="plot-subtitle">At your current channel setting</p><div class="capacity-number">${capacity.toFixed(3)} <small>bits / use</small></div><div class="capacity-scale">${Array.from({length:30},(_,i)=>`<i class="${i/30<capacity?'on':''} ${i===Math.round(e.code.rate*30)-1?'rate-marker':''}"></i>`).join('')}</div><div class="capacity-summary"><span>0</span><span>R = ${e.code.rate.toFixed(2)}</span><span>1</span></div><div class="capacity-caption">${capacity>e.code.rate ? 'Your rate is below capacity. A suitable long code could communicate reliably.' : 'Your rate exceeds capacity. No code can make errors arbitrarily rare here.'}<br><span class="math">C = R</span> at about <b>${threshold.toFixed(2)} dB</b>. This is an asymptotic threshold, not this code’s decoding threshold.</div></div>`;
  }
  area.setAttribute('aria-labelledby', 'tab-' + state.tab);
  drawPlots(); updateProgress();
}
function drawPlots(beliefFrame) {
  const { experiment:e, iteration } = state; if (!e) return; const frame = e.history[iteration];
  if ($('#signal-chart')) drawSignal($('#signal-chart'), e);
  if ($('#belief-chart')) drawBeliefs($('#belief-chart'), e, beliefFrame || frame);
  if ($('#ber-chart')) drawBER($('#ber-chart'), e, state.data);
  if ($('#convergence-chart')) drawConvergence($('#convergence-chart'), e, iteration);
  if ($('#capacity-chart')) drawCapacity($('#capacity-chart'), e);
}
function updateMetrics() {
  const { experiment:e, iteration } = state, { code, history, word } = e, frame = history[iteration];
  const raw = countErrors(word, history[0].bits), remaining = countErrors(word, frame.bits), failed = frame.syndrome.reduce((a,b)=>a+b,0);
  $('#metric-rate').textContent = code.rate === .5 ? '1/2' : code.k + '/' + code.n;
  $('#metric-rate-detail').textContent = `${code.k} information / ${code.n} transmitted bits`;
  $('#metric-raw').innerHTML = `${raw} <small>/ ${code.n}</small>`;
  $('#metric-decoded').innerHTML = `${remaining} <small>/ ${code.n}</small>`;
  $('#metric-decoded').style.color = remaining ? 'var(--copper)' : 'var(--green)';
  $('#metric-checks').innerHTML = `${code.m - failed} <small>/ ${code.m}</small>`;
  $('#decode-status').textContent = iteration === 0 ? 'Initial hard decisions' : remaining === 0 ? 'Original codeword recovered' : failed === 0 ? 'Valid, but wrong codeword' : 'Still working on it';
  $('#parity-status').textContent = failed === 0 ? 'All rules satisfied' : `${failed} rules still violated`;
  $('#iteration-counter').textContent = `ITERATION ${String(iteration).padStart(2,'0')} / ${String(state.iterations).padStart(2,'0')}`;
  const finished = iteration === history.length - 1;
  $('#play-state').textContent = state.playing ? 'BITS ARE TALKING…' : finished ? failed === 0 ? remaining === 0 ? 'CODEWORD RECOVERED' : 'VALID, BUT WRONG' : 'ITERATION LIMIT REACHED' : iteration ? 'DECODER PAUSED' : 'READY TO DECODE';
  $('#iteration-scrub').max = history.length - 1; $('#iteration-scrub').value = iteration;
  $('#play-decoder use').setAttribute('href',state.playing?'#i-pause':'#i-play');
  $('#play-decoder').setAttribute('aria-label',state.playing?'Pause decoder':'Play decoder');
  $('#step-decoder').disabled = finished;
  $('.scene-counter').textContent = `${code.n} bits · ${code.m} checks`;
  scene.inspect();
}
function setIteration(i) {
  cancelAnimationFrame(beliefAnimation);
  const e=state.experiment, before=e.history[state.iteration];
  state.iteration = Math.max(0,Math.min(i,e.history.length-1));
  const after=e.history[state.iteration];updateMetrics();drawPlots();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||before===after)return;
  const start=performance.now(), duration=Math.min(650,Number($('#speed').value)*.8);
  const tween=time=>{if(state.experiment!==e)return;const t=Math.min(1,(time-start)/duration),ease=1-(1-t)**3;
    if($('#belief-chart'))drawBeliefs($('#belief-chart'),e,{...after,llr:before.llr.map((v,j)=>v+(after.llr[j]-v)*ease)});
    if(t<1)beliefAnimation=requestAnimationFrame(tween);
  };beliefAnimation=requestAnimationFrame(tween);
}
function stop() { state.playing = false; clearTimeout(timer); updateMetrics(); }
function play() {
  if (state.playing) { stop(); return; }
  if (state.experiment.history.length === 1) { toast('The initial decisions already satisfy every check. Try a new noise sample or lower SNR.'); return; }
  if (state.iteration === state.experiment.history.length-1) state.iteration = 0;
  state.playing = true; updateMetrics(); drawPlots();
  const tick = () => { setIteration(state.iteration+1); if(state.iteration === state.experiment.history.length-1) { stop(); return; } timer=setTimeout(tick,Number($('#speed').value)); };
  timer = setTimeout(tick,Number($('#speed').value));
}
function runExperiment({ resimulate = false }={}) {
  clearTimeout(timer); cancelAnimationFrame(beliefAnimation); state.playing = false; state.iteration = 0;
  state.experiment = makeExperiment(state);
  $('#snr-value').innerHTML = state.ebn0.toFixed(2).replace(/0$/,'')+' <small>dB</small>';
  $('#iterations-value').textContent = state.iterations;
  $('#seed-value').textContent = '#' + String(state.seed).padStart(4,'0');
  updateMetrics(); renderPlots();
  if (resimulate) { state.data=[]; clearTimeout(simulationTimer); worker?.terminate(); simulationTimer=setTimeout(startSimulation,180); }
}
function startSimulation() {
  worker?.terminate(); state.data=[]; const id=++requestId;
  try {
    worker=new Worker('./simulation-worker.js',{type:'module'});
    worker.onmessage=({data})=>{if(data.id!==requestId)return; state.data.push(data); updateProgress(); if(state.tab==='performance')drawPlots();};
    worker.onerror=()=>{toast('The background simulation could not start. Serve the demo over HTTP and reload.'); const p=$('#ber-progress'); if(p)p.textContent='unavailable';};
    worker.postMessage({...state,experiment:undefined,data:undefined,id});
  } catch { toast('Background plots need an HTTP server. Run npm run dev.'); }
}
function updateProgress() {
  if($('#ber-loading')) $('#ber-loading').style.width=(state.data.length/17*100)+'%';
  if($('#ber-progress')) $('#ber-progress').textContent=state.data.length===17?'17/17 points':state.data.length+'/17';
}
let toastTimer;
function toast(text) { $('#toast').textContent=text; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,5000); }
function setTab(tab) { state.tab=tab; $$('[data-tab]').forEach(b=>{ const selected=b.dataset.tab===tab; b.classList.toggle('active',selected); b.setAttribute('aria-selected',String(selected)); b.tabIndex=selected?0:-1; }); renderPlots(); }
$('#snr').addEventListener('input',e=>{state.ebn0=Number(e.target.value);runExperiment();});
$('#iterations').addEventListener('input',e=>{state.iterations=Number(e.target.value);runExperiment({resimulate:true});});
$('#block-length').addEventListener('change',e=>{state.n=Number(e.target.value);scene.selected=null;runExperiment({resimulate:true});});
$('#algorithm').addEventListener('change',e=>{state.algorithm=e.target.value;runExperiment({resimulate:true});});
$('#new-noise').addEventListener('click',()=>{state.seed++;runExperiment();});
$('#reset-all').addEventListener('click',()=>{Object.assign(state,{n:24,ebn0:2,iterations:12,seed:7,algorithm:'sum-product'}); $('#snr').value=2;$('#iterations').value=12;$('#block-length').value=24;$('#algorithm').value='sum-product';runExperiment({resimulate:true});});
$$('[data-tab]').forEach(button=>{button.addEventListener('click',()=>setTab(button.dataset.tab));button.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return; e.preventDefault();const tabs=$$('[data-tab]');let i=tabs.indexOf(button);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setTab(tabs[i].dataset.tab);tabs[i].focus();});});
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>{scene.view=button.dataset.view;$$('[data-view]').forEach(b=>b.classList.toggle('active',b===button));$('.scene-formula').hidden=scene.view==='matrix';}));
$('#expand-graph').addEventListener('click',()=>{const expanded=$('#graph-panel').classList.toggle('expanded');$('#expand-graph').setAttribute('aria-label',expanded?'Close expanded graph':'Expand graph');});
$('#play-decoder').addEventListener('click',play);
$('#step-decoder').addEventListener('click',()=>{stop();setIteration(state.iteration+1);});
$('#reset-decoder').addEventListener('click',()=>{stop();setIteration(0);});
$('#iteration-scrub').addEventListener('input',e=>{stop();setIteration(Number(e.target.value));});
$('#export-data').addEventListener('click',()=>{
  const e=state.experiment, header=`# LDPC single-frame sample: n=${e.code.n},k=${e.code.k},EbN0_dB=${state.ebn0},seed=${state.seed},algorithm=${state.algorithm},max_iterations=${state.iterations}\n`;
  let csv=header+'bit,sent,received,channel_llr'+e.history.map(h=>`,iteration_${h.iteration}_bit,iteration_${h.iteration}_llr`).join('')+'\n';
  e.word.forEach((bit,i)=>{csv += [i+1,bit,e.channel.received[i],e.channel.llr[i],...e.history.flatMap(h=>[h.bits[i],h.llr[i]])].join(',')+'\n';});
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})), a=document.createElement('a');a.href=url;a.download=`ldpc-n${state.n}-seed${state.seed}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const explanations=['A positive LLR favors 0. A negative LLR favors 1. A value near zero means the decoder is unsure.','A check-to-bit message excludes that bit’s own input. New evidence comes from the other neighbors, not an echo.','All checks passing means the estimate is a valid codeword. Only comparison with the transmitted word confirms recovery.'];
function explain(index){$$('[data-explain]').forEach((c,i)=>c.classList.toggle('active',i===index));$('#explanation-detail').textContent=explanations[index];}
$$('[data-explain]').forEach(c=>{c.addEventListener('click',()=>explain(Number(c.dataset.explain)));c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();explain(Number(c.dataset.explain));}});});
let explainTimers=[];
$('#explain-play').addEventListener('click',()=>{explainTimers.forEach(clearTimeout);for(let i=0;i<3;i++)explainTimers.push(setTimeout(()=>explain(i),i*2500));});
let tourTimers=[];
$('#tour-button').addEventListener('click',()=>{
  tourTimers.forEach(clearTimeout);$('#reset-all').click();setTab('channel');
  toast('01 · A noisy sample. The receiver sees amplitudes, not perfect bits.');
  $('#explore').scrollIntoView({behavior:'smooth',block:'start'});
  tourTimers.push(setTimeout(()=>{toast('02 · Checks exchange evidence. Watch the beliefs change.');play();},2800));
  tourTimers.push(setTimeout(()=>{setTab('performance');toast('03 · One sample is a story. Many samples make a BER curve.');},10500));
  tourTimers.push(setTimeout(()=>{setTab('capacity');toast('04 · Capacity is a channel limit. This small code cannot establish near-limit performance.');},16500));
});
const presentation=$('#presentation');let slideIndex=0;
function renderSlide(){
  const s=slides[slideIndex];
  $('#slide-content').innerHTML=`<div class="slide-graphic"></div><span class="slide-eyebrow">${s.tag}</span><h2 class="slide-title">${s.title.replace('\n','<br>')}</h2><p class="slide-subtitle">${s.subtitle}</p>${s.formula?`<div class="slide-formula">${s.formula}</div>`:''}${s.columns?`<div class="slide-columns">${s.columns.map(([title,body],i)=>`<div class="slide-column"><span>0${i+1}</span><h3>${title}</h3><p>${body}</p></div>`).join('')}</div>`:''}${s.note?`<p class="slide-note">${s.note}</p>`:''}${s.action?`<button class="button green slide-cta" id="slide-lab">${s.action} <svg><use href="#i-arrow"/></svg></button>`:''}`;
  if($('#slide-lab'))$('#slide-lab').addEventListener('click',()=>{presentation.close();$('#explore').scrollIntoView({behavior:'smooth'});setTab('channel');});
  $('#slide-count').textContent=String(slideIndex+1).padStart(2,'0')+' / '+slides.length;
  $('#slide-progress').innerHTML=slides.map((s,i)=>`<button class="${i===slideIndex?'active':''}" data-slide="${i}" aria-label="Slide ${i+1}: ${s.title.replace('\n',' ')}"></button>`).join('');
  $$('[data-slide]').forEach(b=>b.addEventListener('click',()=>{slideIndex=Number(b.dataset.slide);renderSlide();}));
  $('#slide-prev').disabled=slideIndex===0;$('#slide-next').disabled=slideIndex===slides.length-1;
}
$$('[data-present]').forEach(b=>b.addEventListener('click',()=>{stop();renderSlide();presentation.showModal();}));
$('#close-presentation').addEventListener('click',()=>presentation.close());
$('#slide-prev').addEventListener('click',()=>{if(slideIndex>0){slideIndex--;renderSlide();}});
$('#slide-next').addEventListener('click',()=>{if(slideIndex<slides.length-1){slideIndex++;renderSlide();}});
$('#fullscreen-slide').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await presentation.requestFullscreen();}catch{toast('Use your browser’s fullscreen command for a larger presentation.');}});
presentation.addEventListener('close',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});});
document.addEventListener('keydown',e=>{
  if(presentation.open){if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();$('#slide-next').click();}if(e.key==='ArrowLeft'){e.preventDefault();$('#slide-prev').click();}return;}
  if(e.key==='Escape'){$('#graph-panel').classList.remove('expanded');scene.selected=null;scene.inspect();}
  if(['INPUT','SELECT','BUTTON','A','SUMMARY'].includes(document.activeElement?.tagName))return;
  if(e.code==='Space'){e.preventDefault();play();}
});
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawPlots,120);});
document.fonts.ready.then(()=>drawPlots());
runExperiment();startSimulation();
// Read-only hooks for reproducible browser checks and seminar inspection.
window.ldpcLab={getState:()=>({...state,playing:state.playing}),setTab};
