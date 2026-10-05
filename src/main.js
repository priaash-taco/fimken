import { SHOWCASE_MOVES } from './engine/showcase-director.js';
import { installPaletteVariables } from './engine/palette.js';
import './style.css';
import { AudioEngine } from './audio.js';
import { TrainingScene } from './cinematic-scene.js';
import { describeRendering } from './engine/render-diagnostics.js';
import { CHARACTER } from './engine/assets.js';

installPaletteVariables(document.documentElement);

const paths = {
  settings: '<path d="m9 3-.6 2-2 .9-1.9-.5L2 9l1.5 1.5v3L2 15l2.5 3.6 1.9-.5 2 .9.6 2h6l.6-2 2-.9 1.9.5L22 15l-1.5-1.5v-3L22 9l-2.5-3.6-1.9.5-2-.9-.6-2Z"/><circle cx="12" cy="12" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  pc: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  play: '<path d="m8 5 10 7-10 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const $ = selector => document.querySelector(selector);
const debugUI=new URLSearchParams(location.search).has('debug');

document.querySelector('#app').innerHTML = `
  <main class="universe" aria-label="Fimken music universe">
    <canvas id="battle" aria-label="An authored anime character in a cinematic scene. Drag to orbit, scroll to zoom."></canvas>
    <div class="vignette" aria-hidden="true"></div>
    <header class="topbar">
      <div class="identity"><a class="wordmark" href="/" aria-label="Fimken"><img class="logo" src="/logos/fimken-mark-256.png" alt="" width="40" height="40"><img class="wordmark-image" src="/logos/fimken-wordmark-120.png" alt="fimken" height="34"></a><span class="divider"></span><button class="icon-button" id="settings" aria-label="Open settings">${icon('settings')}</button></div>
    </header>
    <div id="loading" class="loading-orbit" role="status" aria-label="Loading cinematic assets"></div>
    <div id="render-error" class="render-error" role="alert" hidden></div>
  </main>
  <dialog id="settings-modal" aria-labelledby="settings-title">
    <div class="modal-head"><h2 id="settings-title">Settings</h2><button id="close-settings" class="icon-button" aria-label="Close settings">${icon('close')}</button></div>
    <div class="modal-toolbar"><button id="motion" class="playback-button" aria-label="Pause animation">${icon('pause')}<span>Pause</span></button><div class="toolbar-right"><span id="source-label" class="live-status">AMBIENT</span><button id="fullscreen" class="icon-button" aria-label="Enter fullscreen" title="Fullscreen">${icon('expand')}</button></div></div>
    <section class="settings-section"><h3>Audio</h3><div class="audio-grid">
      <button id="pc-audio" class="source-button">${icon('pc')}<span>PC audio</span></button>
      <button id="microphone" class="source-button">${icon('mic')}<span>Microphone</span></button>
      <button id="open-track" class="source-button">${icon('play')}<span>Music file</span></button><input id="track-file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" hidden>
    </div><p id="source-status" role="status" aria-live="polite">Choose music to react to.</p><button id="modal-stop" class="text-button" hidden>Stop audio</button></section>
    <section class="settings-section"><h3>Showcase</h3><div class="training-actions showcase-actions"><button class="secondary action-sequence" data-practice="sequence">Action sequence</button><button class="secondary" data-practice="powerup">Power up</button><button class="secondary" data-practice="charge">Energy charge</button><button class="secondary" data-practice="blast">Beam release</button><button class="secondary" data-practice="hover">Hover idle</button></div><label class="select-label" for="hero-pose">Hero pose<select id="hero-pose"><option value="stance">Power stance</option><option value="airborne">Airborne combat</option><option value="charge-pose">Charging</option><option value="beam-pose">Beam release</option></select></label><button class="text-button" id="show-pose">Show pose</button></section>
    <section class="settings-section"><h3>Scene</h3>
      <label class="toggle-row" for="asset-inspection"><span>Neutral view<small>Plain lighting, effects off</small></span><input id="asset-inspection" aria-label="Inspect without effects" type="checkbox"></label>
      <label class="range-label" for="effects">Energy & effects<output id="effects-value">65%</output></label><input id="effects" type="range" min="0" max="100" value="65">
      <label class="select-label" for="view">Camera view<select id="view"><option value="training">Full body</option><option value="portrait">Close-up</option></select></label>
      <label class="toggle-row" for="auto-camera"><span>Cinematic camera</span><input id="auto-camera" type="checkbox" checked></label>
    </section>
    <details id="quality-debug" class="settings-disclosure"><summary>Quality / debug</summary>
      <p class="helper">Freeze this pose and camera to compare the current render with original materials, neutral light and no effects.</p>
      <div class="quality-compare"><button class="secondary" data-render-mode="cinematic">Cinematic</button><button class="secondary" data-render-mode="sharp">Sharp / original</button></div>
      <button id="end-comparison" class="text-button" hidden>Finish comparison</button>
      <button id="read-renderer" class="text-button">Refresh readings</button>
      <pre id="render-readings" aria-label="Renderer diagnostics">Open readings after the character loads.</pre>
    </details>
    <details id="advanced-settings" class="settings-disclosure"><summary>Advanced</summary><div class="advanced-content">
      <label class="range-label" for="action-position">Review action pose<output id="action-position-value">0.00s</output></label><input id="action-position" type="range" min="0" max="9.8" step="0.01" value="0">
      <label class="select-label" for="motion-speed">Playback speed<select id="motion-speed"><option value="0.25">Quarter speed</option><option value="0.5">Half speed</option><option value="1" selected>Normal</option></select></label>
      <label class="select-label" for="quality">Render quality<select id="quality"><option value="low">Performance</option><option value="balanced">Balanced</option><option value="high" selected>High</option></select></label>
      <label class="select-label" for="environment">Environment<select id="environment"><option value="nebula">Violet</option><option value="eclipse">Blue</option></select></label>
      <label class="range-label" for="sensitivity">Sound sensitivity<output id="sensitivity-value">65%</output></label><input id="sensitivity" type="range" min="0" max="100" value="65">
      <label class="select-label" for="routine">Training routine<select id="routine"><option value="balanced">Full training</option><option value="melee">Martial arts</option><option value="energy">Energy practice</option></select></label>
      <button id="reset-training" class="text-button">Reset showcase</button>
      <label class="toggle-row" for="physics"><span>Training physics</span><input id="physics" type="checkbox" checked></label>
      <label class="range-label" for="impactStrength">Impact camera<output id="impactStrength-value">65%</output></label><input id="impactStrength" type="range" min="0" max="100" value="65">
      <label class="toggle-row" for="reduced-motion"><span>Reduced motion</span><input id="reduced-motion" type="checkbox"></label>
      <div id="material-controls">
        <label class="select-label" for="character-finish">Character finish<select id="character-finish" aria-label="Character finish"><option value="cinematic">Cinematic cel shading</option><option value="authored">Original materials</option></select></label>
        <label class="range-label" for="outline-width">Ink outline<output id="outline-width-value">100%</output></label><input id="outline-width" type="range" min="0" max="60" value="25">
      </div>
      <div class="sample-actions"><button id="demo" class="secondary">Demo</button><button id="score" class="secondary">First Light</button></div>
      <p class="helper">Demo runs silently. First Light plays a short sample track.</p>
      <p class="helper">For PC audio, choose Entire screen and enable system audio in the browser picker.</p>
    </div></details>
    <details class="settings-disclosure settings-about"><summary>About & credits</summary><p id="asset-status" class="helper"></p><p class="helper">Character: user-supplied Meshy model.<br>Animation: Quaternius · CC0.<br>Studio Small 09: Sergej Majboroda / Poly Haven · CC0.<br>Lunar maps: NASA Scientific Visualization Studio / LRO, via MoonExplorer.<br>First Light: original score.</p></details>
    <div class="modal-foot">Audio stays on your device.<span class="shortcuts">Space · play / pause &nbsp; F · fullscreen</span></div>
  </dialog>
`;

const audio = new AudioEngine();
let scene;
try {
  scene = new TrainingScene($('#battle'), audio);
  scene.onerror = message => { $('#render-error').hidden = false; $('#render-error').textContent = message; };
  scene.ready.finally(() => { $('#loading').hidden = true; });
  // Development-only handle for scripted motion review; absent from production builds.
  if (import.meta.env.DEV) window.__fimken = scene;
} catch (error) {
  $('#render-error').hidden = false;
  $('#render-error').textContent = 'This scene needs WebGL 2. Try desktop Chrome or Edge with hardware acceleration enabled.';
  console.error('3D scene initialization failed:', error);
  $('#loading').hidden = true;
}
const dialog = $('#settings-modal');
if(CHARACTER.id!=='meshy-hero'){
  $('.showcase-actions').innerHTML='<button class="secondary" data-practice="martial">Practice strikes</button><button class="secondary" data-practice="powerup">Power up</button><button class="secondary" data-practice="blast">Energy blast</button>';
  $('#hero-pose').closest('label').hidden=true;$('#show-pose').hidden=true;
}

function openSettings() { if (!dialog.open) dialog.showModal(); }
$('#asset-status').textContent = CHARACTER.status === 'pending'
  ? 'Awaiting the original hero’s rigged GLB. No procedural character is used in the production scene. Concept artwork and the specialist 3D handoff are prepared. Meshy is on hold.'
  : CHARACTER.status === 'debug' ? 'Procedural debug asset only. This is not the production hero.'
  : CHARACTER.status === 'reference' ? 'External reference rig only. Used to verify materials and animation, not the intended hero design.'
  : CHARACTER.defaultReview ? `${CHARACTER.name} / showcase. Your supplied GLB, with its textures and a local skeleton.` : `${CHARACTER.name} / ${CHARACTER.status}`;
$('#character-finish').value=CHARACTER.finish||'authored';
if(CHARACTER.id==='meshy-hero') { $('#character-finish').value='cinematic';$('#routine').closest('label').hidden=true;$('#physics').closest('label').hidden=true; }
$('#character-finish').addEventListener('change',event=>scene?.actor.setFinish(event.target.value));
$('#outline-width').addEventListener('input', event => { scene?.actor.setOutline(Number(event.target.value)/10000); $('#outline-width-value').textContent=event.target.value==='0'?'Off':`${Math.round(Number(event.target.value)*4)}%`; });
$('#asset-inspection').checked = Boolean(scene?.inspection);
$('#effects').disabled=Boolean(scene?.inspection);
$('#asset-inspection').addEventListener('change', event => { scene?.setInspection(event.target.checked);$('#effects').disabled=event.target.checked; });
if (CHARACTER.status === 'pending') {
  document.querySelectorAll('[data-practice], #reset-training, #routine').forEach(element => { element.disabled = true; });
  openSettings();
}
function refreshRenderReadings(){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!scene?.loaded)return;
    const data=scene.renderDiagnostics();$('#render-readings').textContent=describeRendering(data);$('#render-readings').dataset.report=JSON.stringify(data);
    $('#end-comparison').hidden=!scene.comparisonSaved;
    for(const b of document.querySelectorAll('[data-render-mode]'))b.setAttribute('aria-pressed',String(b.dataset.renderMode===scene.comparisonMode));
  }));
}
for(const b of document.querySelectorAll('[data-render-mode]'))b.addEventListener('click',()=>{scene?.compareRendering(b.dataset.renderMode);refreshRenderReadings();});
$('#end-comparison').addEventListener('click',()=>{scene?.compareRendering('exit');refreshRenderReadings();});
$('#read-renderer').addEventListener('click',refreshRenderReadings);
$('#quality-debug').addEventListener('toggle',()=>{if($('#quality-debug').open)refreshRenderReadings();});
$('#settings').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
let pending = false, action = 0;
const controls = [$('#pc-audio'), $('#microphone')];
const names = { idle: 'AMBIENT', mic: 'MICROPHONE LIVE', pc: 'PC AUDIO LIVE', demo: 'DEMO · SIMULATED', file: 'LOCAL MUSIC' };
function message(text, error = false) {
  for (const element of [$('#source-status')]) {
    element.textContent = text;
    element.classList.toggle('error', error);
  }
}
function sync() {
  $('#source-label').textContent = names[audio.mode];
  const chip = $('#sound-chip'); if (chip) { chip.querySelector('span').textContent = audio.mode === 'idle' ? 'Choose sound' : audio.mode === 'file' ? (audio.fileName || 'Music file') : names[audio.mode]; chip.classList.toggle('active', audio.mode !== 'idle'); }
  $('#source-label').classList.toggle('active', audio.mode !== 'idle');
  $('#modal-stop').hidden = audio.mode === 'idle' && !pending;
  $('#modal-stop').textContent = pending ? 'Cancel connection' : audio.mode === 'demo' ? 'Stop demo' : 'Stop audio';
  controls.forEach(button => { button.disabled = pending; });
  [['#pc-audio', 'pc'], ['#microphone', 'mic'], ['#demo', 'demo'], ['#open-track', 'file']].forEach(([selector, mode]) => {
    $(selector).classList.toggle('selected', audio.mode === mode);
    $(selector).setAttribute('aria-pressed', String(audio.mode === mode));
  });
  const messages = {
    idle: 'Choose music to react to.',
    mic: 'Listening to your room. Music shapes the action, shots and lighting.',
    pc: 'Listening to shared audio. Keep your music playing—even through headphones.',
    demo: 'A simulated rhythm is shaping the scene. No audio is playing or being captured.',
    file: `Playing ${audio.fileName || 'local music'}. This file stays on your device.`,
  };
  message(messages[audio.mode]);
}
audio.onchange = sync;
async function connect(mode) {
  const current = ++action;
  pending = true;
  sync();
  const connection = audio.connect(mode);
  message(mode === 'mic' ? 'Allow microphone access in your browser.' : 'Choose Entire screen and turn on system audio in the browser picker.');
  try {
    await connection;
    if (current === action && audio.mode !== 'idle') dialog.close();
  } catch (error) {
    if (current !== action) return;
    const errors = {
      NotAllowedError: mode === 'mic' ? 'Microphone access was not granted. Allow it in your browser’s site settings and try again.' : 'Audio sharing was cancelled or not allowed. Try again when you’re ready.',
      NotFoundError: 'No microphone was found. Connect one, or try PC audio.',
      NotReadableError: 'That audio source could not be opened. Check its availability and try again.',
    };
    message(errors[error.name] || error.message || 'Could not open the audio source.', true);
  } finally {
    if (current === action) {
      pending = false;
      controls.forEach(button => { button.disabled = false; });
      $('#modal-stop').hidden = audio.mode === 'idle';
      $('#modal-stop').textContent = 'Stop audio';
    }
  }
}
$('#pc-audio').addEventListener('click', () => connect('pc'));
$('#microphone').addEventListener('click', () => connect('mic'));
$('#open-track').addEventListener('click', () => $('#track-file').click());
$('#track-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const current = ++action;
  pending = true;
  sync();
  message('Opening local music…');
  try { await audio.file(file); if (current === action && audio.mode === 'file') dialog.close(); }
  catch (error) { if (current === action) message(error.message, true); }
  finally {
    if (current === action) { pending = false; controls.forEach(button => { button.disabled = false; }); $('#modal-stop').hidden = audio.mode === 'idle'; $('#modal-stop').textContent = 'Stop audio'; }
    event.target.value = '';
  }
});
function demo() { action++; pending = false; audio.demo(); dialog.close(); }
$('#demo').addEventListener('click', demo);
$('#score').addEventListener('click', async () => {
  const current = ++action;
  pending = true; sync();
  $('#score').disabled = true;
  try {
    await audio.init();
    const response = await fetch('/audio/first-light.wav');
    if (!response.ok) throw new Error('The preview score could not load.');
    const blob = await response.blob();
    if (current !== action) return;
    await audio.file(new File([blob], 'Fimken — First Light.wav', { type: 'audio/wav' }));
    if (current !== action) return;
    if (scene) { if (scene.director) scene.director.mode = 'balanced'; $('#routine').value = 'balanced'; scene.resetTraining(); scene.paused = false; scene.autoCamera = true; scene.view = 'training'; $('#view').value = 'training'; syncMotion(); }
    dialog.close();
  } catch (error) { if (current === action) message(error.message || 'The preview score could not play.', true); }
  finally { $('#score').disabled = false; if (current === action) { pending = false; controls.forEach(button => { button.disabled = false; }); $('#modal-stop').hidden = audio.mode === 'idle'; $('#modal-stop').textContent = 'Stop audio'; } }
});
function stop() { action++; pending = false; audio.stop(); }
$('#modal-stop').addEventListener('click', stop);
window.addEventListener('pagehide', stop);

function syncMotion() {
  if (!scene) return;
  $('#motion').innerHTML = icon(scene.paused ? 'play' : 'pause') + `<span>${scene.paused ? 'Play' : 'Pause'}</span>`;
  $('#motion').setAttribute('aria-label', scene.paused ? 'Resume animation' : 'Pause animation');
  $('#reduced-motion').checked = scene.reducedMotion;
  for(const b of document.querySelectorAll('[data-practice]'))b.setAttribute('aria-pressed',String(b.dataset.practice==='freestyle'?Boolean(scene.director.auto):!scene.director.auto&&b.dataset.practice===scene.director.moveId));
  $('#auto-camera').checked = scene.autoCamera;
  $('#asset-inspection').checked=scene.inspection;$('#effects').disabled=scene.inspection;$('#character-finish').value=scene.actor.finish||'authored';
  for(const id of ['motion','auto-camera','asset-inspection','effects','quality','character-finish','outline-width','reduced-motion','view','reset-training'])$('#'+id).disabled=Boolean(scene.comparisonSaved)||(id==='effects'&&scene.inspection);
}
syncMotion();
$('#motion').addEventListener('click', () => { if (scene) { scene.paused = !scene.paused; syncMotion(); } });
$('#reduced-motion').addEventListener('change', event => {
  if (scene) { scene.paused = event.target.checked; scene.reducedMotion=event.target.checked; if (scene.paused) scene.autoCamera = false; syncMotion(); }
});
$('#auto-camera').addEventListener('change', event => { if (scene) scene.autoCamera = event.target.checked; });
if (scene) scene.oninteraction = syncMotion;
for (const name of ['sensitivity', 'effects', 'impactStrength']) {
  $(`#${name}`).addEventListener('input', event => {
    if (scene) scene[name] = Number(event.target.value) / 100;
    $(`#${name}-value`).textContent = `${event.target.value}%`;
  });
}
$('#view').addEventListener('change', event => {
  if (scene) { scene.view = event.target.value; scene.resetCamera(); }
});
$('#fullscreen').hidden = !document.fullscreenEnabled;
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { message('Fullscreen is unavailable in this window.', true); }
});
document.addEventListener('fullscreenchange', () => $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
sync();

// Persist visual preferences only. Audio capture always requires a fresh gesture.
const storageKey = 'fimken.v1.settings';
const selectBindings = {
  environment: value => scene?.setEnvironment(value),
  quality: value => scene?.setQuality(value),
  routine: value => { if (scene?.director) { scene.director.mode = value; scene.resetTraining(); } },
};
for (const [id, apply] of Object.entries(selectBindings)) $(`#${id}`).addEventListener('change', event => apply(event.target.value));
$('#physics').addEventListener('change', event => { if (scene?.physics) { scene.physicsEnabled = event.target.checked; scene.physics.reset(); } });
$('#action-position').addEventListener('input',event=>{const t=Number(event.target.value);scene?.reviewAction(t);$('#action-position-value').textContent=t.toFixed(2)+'s';});
$('#motion-speed').addEventListener('change',event=>{if(scene)scene.playbackSpeed=Number(event.target.value);});
$('#show-pose').addEventListener('click',()=>{scene?.practice($('#hero-pose').value);dialog.close();});
$('#reset-training').addEventListener('click', () => { scene?.resetTraining(); dialog.close(); });
for (const button of document.querySelectorAll('[data-practice]')) button.addEventListener('click', () => {
  scene?.practice?.(button.dataset.practice);
  dialog.close();
});

function savePreferences() {
  const ids = ['sensitivity', 'effects', 'impactStrength', 'view', 'environment', 'quality', 'routine', 'physics', 'auto-camera'];
  const values = Object.fromEntries(ids.map(id => [id, $(`#${id}`).type === 'checkbox' ? $(`#${id}`).checked : $(`#${id}`).value]));
  try { localStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* Storage may be unavailable. */ }
}
dialog.addEventListener('change', savePreferences);
async function restorePreferences() {
  if (!scene) return;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return; }
  if (!saved || typeof saved !== 'object') return;
  for (const id of ['sensitivity', 'effects', 'impactStrength']) {
    const value = Number(saved[id]);
    if (saved[id] != null && Number.isFinite(value) && value >= 0 && value <= 100) {
      $(`#${id}`).value = value; $(`#${id}`).dispatchEvent(new Event('input'));
    }
  }
  for (const id of ['view', 'environment', 'quality', 'routine']) {
    const select = $(`#${id}`);
    if (!(CHARACTER.defaultReview && (id==='view' || id==='routine')) && [...select.options].some(option => option.value === saved[id])) {
      select.value = saved[id]; select.dispatchEvent(new Event('change'));
    }
  }
  if (typeof saved.physics === 'boolean') { $('#physics').checked = saved.physics; scene.physicsEnabled = saved.physics; }
  if (!scene.paused && typeof saved['auto-camera'] === 'boolean') { $('#auto-camera').checked = saved['auto-camera']; scene.autoCamera = saved['auto-camera']; }

}
restorePreferences();
// Keep option text out of nested labels' accessible names.
for (const [id, label] of Object.entries({ view: 'Camera view', environment: 'Environment', quality: 'Render quality', routine: 'Training routine' })) $(`#${id}`).setAttribute('aria-label', label);
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
  if (event.code === 'KeyS') { event.preventDefault(); dialog.open ? dialog.close() : openSettings(); }
  if (dialog.open) return;
  if (event.code === 'Space') { event.preventDefault(); $('#motion').click(); }
  if (event.code === 'KeyF') { event.preventDefault(); $('#fullscreen').click(); }
  if (event.code === 'KeyP') { event.preventDefault(); scene?.performance.toggle(); }
});

// Keep the production surface small. The existing diagnostics are available at
// ?debug=1 for visual QA, rather than exposing development controls to viewers.
if(!debugUI&&CHARACTER.id==='meshy-hero'){
  $('#settings-title').textContent='Audio & display';
  $('#settings').setAttribute('aria-label','Audio and display');$('#settings').title='Audio & display';
  $('#close-settings').setAttribute('aria-label','Close controls');
  const dock=document.createElement('nav');dock.className='action-dock';dock.setAttribute('aria-label','Hero actions');
  const auto=document.createElement('button');auto.className='secondary';auto.dataset.practice='freestyle';auto.textContent='Auto';auto.title='Varied automatic training';auto.setAttribute('aria-label','Automatic training');
  auto.addEventListener('click',()=>{scene?.practice(scene.director.auto?'stance':'freestyle');});dock.append(auto);
  for(const id of ['powerup','charge','blast'])dock.append(document.querySelector(`[data-practice="${id}"]`));
  const moves=document.createElement('select');moves.className='move-picker';moves.setAttribute('aria-label','Movement sequence');
  moves.add(new Option('More moves…',''));
  for(const id of ['dash','strikes','heavy','flying','spin','flip','flight','hover','airborne','reaction','transformation','relaxedIdle','alert','stretch','neckRoll','wristWarmup','bounce','combatIdle','stepForward','stepBack','shuffle','vanish','frontKick','backKick','highKick','heavyKick','airCombo','hardLanding','threePoint','reset'])moves.add(new Option(SHOWCASE_MOVES[id].label,id));
  moves.addEventListener('change',()=>{if(moves.value){scene?.practice(moves.value);moves.value='';}});dock.append(moves);
  dock.append($('#motion'),$('#fullscreen'));$('.universe').append(dock);
  // The dock was for review. The normal page shows the wordmark, a sound chip and settings;
  // ?controls=1 (or inspection) brings the dock back for tests and reviews.
  const params=new URLSearchParams(location.search);dock.hidden=!(params.has('controls')||params.get('inspection')==='1');
  const chip=document.createElement('button');chip.id='sound-chip';chip.className='sound-chip';chip.setAttribute('aria-label','Choose sound');chip.innerHTML='<i></i><span>Choose sound</span>';
  chip.addEventListener('click',openSettings);$('.identity').append(chip);sync();
  for(const el of document.querySelectorAll('.settings-section, #quality-debug, #advanced-settings, .modal-toolbar'))el.hidden=true;
  // Audio is the first original section and remains available.
  $('.settings-section').hidden=false;
  const display=document.createElement('section');display.className='essential-display';
  for(const id of ['quality','auto-camera','asset-inspection','reduced-motion'])display.append($('#'+id).closest('label'));
  display.append(document.querySelector('label[for="effects"]'),$('#effects'));
  dialog.insertBefore(display,$('.settings-about'));
  $('#source-status').textContent='Connect PC audio, your microphone or a music file.';
  scene?.ready.then(()=>{if(scene.isShowcase&&!scene.inspection&&!scene.reducedMotion)scene.practice('freestyle');});
}
