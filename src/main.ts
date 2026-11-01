import { Capacitor } from '@capacitor/core';
import { createIcons, Shield, Gem, Heart, ChevronRight, ChevronDown, ArrowRight, Map, Swords, BookOpen, Settings, Volume2, VolumeX, Play, Pause, FastForward, Flag, LockKeyhole, Check, Sparkles, Snowflake, Flame, Plus, X, Leaf, Target, Crosshair, RotateCcw, CircleHelp, Maximize, Trophy, ArrowUp, Trash2, Mountain, TreePine, Castle, Sun, Crown } from 'lucide';
import { advanceRegion, buildTower, createGame, MAX_TOWER_LEVEL, REGIONS, sellTower, SLOTS, startWave, tickGame, TOWER_TYPES, upgradeCost, upgradeTower, useSpell, type GameState, type Spell, type TowerType } from './game';
import { GameRenderer, drawTower } from './render';
import { loadGame, saveGame, SPELL_NAMES } from './save';
import { defenseGuide, towerSummary } from './defense-guide';
import './style.css';

const isInstalled = () => Capacitor.isNativePlatform() || window.matchMedia('(display-mode: standalone)').matches;
if (isInstalled()) document.documentElement.classList.add('battle-focus');
document.addEventListener('fullscreenchange', () => document.documentElement.classList.toggle('battle-focus', isInstalled() || !!document.fullscreenElement));

const icons = { Shield, Gem, Heart, ChevronRight, ChevronDown, ArrowRight, Map, Swords, BookOpen, Settings, Volume2, VolumeX, Play, Pause, FastForward, Flag, LockKeyhole, Check, Sparkles, Snowflake, Flame, Plus, X, Leaf, Target, Crosshair, RotateCcw, CircleHelp, Maximize, Trophy, ArrowUp, Trash2, Mountain, TreePine, Castle, Sun, Crown };
const icon = (name: string, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.7 } });
let state: GameState = loadGame() || createGame();
let selectedType: TowerType = 'archer';
let selectedSlot: number | null = null;
let paused = false;
let speed = 1;
let soundEnabled = false;
let audio: AudioContext | null = null;
let toastTimer: ReturnType<typeof setTimeout>;
let storageWarningShown = false;
let checkpoint = state;
const app = document.querySelector<HTMLDivElement>('#app')!;
const regionIcons = ['sun', 'tree-pine', 'mountain', 'snowflake', 'castle'];
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Wilderguard home"><span class="brand-emblem">${icon('shield')}${icon('leaf')}</span><span>Wilderguard<small>DEFEND THE WILD</small></span></a>
    <nav class="main-nav" aria-label="Game navigation">
      <button class="nav-link active" data-dialog="campaign">${icon('map')}<span>Campaign</span></button>
      <button class="nav-link" data-dialog="defenses">${icon('swords')}<span>Defenses</span></button>
      <button class="nav-link" data-dialog="guide">${icon('book-open')}<span>Field guide</span></button>
    </nav>
    <div class="header-right"><div class="wallet" title="Diamonds earned in battle">${icon('gem')}<strong id="diamond-count">120</strong><span>diamonds</span></div><span class="header-divider"></span><button class="icon-button" id="settings" aria-label="Settings">${icon('settings')}</button><button class="player-avatar" data-dialog="guide" aria-label="Eric's field guide">E<span></span></button></div>
  </header>
  <main class="game-layout">
    <aside class="campaign-sidebar">
      <div class="campaign-heading"><span class="eyebrow">YOUR ADVENTURE</span><h2>The kingdom<br>needs you.</h2><p>One little tower.<br>One brave stand at a time.</p></div>
      <div class="kingdom-map" aria-hidden="true"><svg viewBox="0 0 240 145"><path class="island-shadow" d="M36 70 57 45 52 26 84 23 99 9 128 20 148 12 174 34 196 31 211 54 195 72 208 95 184 111 157 106 140 128 111 121 90 133 72 108 45 111 26 89Z"/><path class="island" d="M36 65 57 40 52 21 84 18 99 4 128 15 148 7 174 29 196 26 211 49 195 67 208 90 184 106 157 101 140 123 111 116 90 128 72 103 45 106 26 84Z"/><path class="map-route" d="M62 87Q87 74 101 91T143 76T169 52T141 33"/><path class="map-river" d="M113 19Q96 42 123 55T138 106"/><path class="mountains" d="m138 42 13-22 16 23-8-7-8 3-5-5Zm-62 4 10-18 13 20-8-6-6 4Z"/><circle cx="62" cy="87" r="10" class="map-halo"/><circle cx="62" cy="87" r="5" class="map-dot"/><circle cx="101" cy="91" r="3"/><circle cx="143" cy="76" r="3"/><circle cx="169" cy="52" r="3"/><circle cx="141" cy="33" r="3"/><path class="map-tree" d="m49 57 5-10 5 10Zm126 29 5-10 5 10Zm-97 19 5-10 5 10Z"/></svg><span>ELDERGLEN</span></div>
      <div class="campaign-progress"><div><span>Kingdom liberated</span><strong id="campaign-percent">0%</strong></div><div class="progress-track"><span id="campaign-progress"></span></div></div>
      <div class="region-list" id="region-list"></div>
      <div class="sidebar-bottom">${icon('flag')}<p>Every place is worth<br><strong>protecting.</strong></p></div>
      <div class="eric-credit">A little world made by Eric, age 7</div>
    </aside>
    <section class="battle-section" aria-label="Tower defense game">
      <div class="section-heading"><div><div class="eyebrow"><span class="small-leaf">${icon('leaf')}</span> THE ELDERGLEN CAMPAIGN</div><h1>Stand your ground<span>.</span></h1><p>Build your defenses. Brave the waves. Bring the wild back home.</p></div><button class="how-to" data-dialog="guide">${icon('circle-help')} How to play</button></div>
      <div class="battle-board">
        <div class="board-top"><div class="location-label"><span class="location-icon">${icon('flag')}</span><div><h2 id="location-name">The Greenfields</h2><span id="location-subtitle">Where your story begins</span></div></div><div class="board-hud"><span class="focus-wallet" title="Available diamonds">${icon('gem')}<strong id="battle-diamond-count">120</strong></span><span class="lives" title="Kingdom health">${icon('heart')}<strong id="lives-count">20</strong></span><span class="hud-divider"></span><span class="wave-label">WAVE <strong id="wave-count">01 <span>/ 05</span></strong></span><button class="icon-button pause-button" id="pause" aria-label="Pause game">${icon('pause')}</button><button class="speed-button" id="speed" aria-label="Set game speed to 2x">1×</button><button class="icon-button focus-menu" id="battle-menu" aria-label="Open game menu">${icon('settings')}</button></div></div>
        <div class="map-container"><canvas id="game-canvas" aria-label="Battlefield. Choose a defense below and tap an empty circular pad to build." tabindex="0"></canvas>
          <div class="map-caption"><span class="live-dot"></span><span id="map-status">A quiet meadow. For now.</span></div>
          <button class="fullscreen-button" id="fullscreen" aria-label="Toggle full screen">${icon('maximize')}</button>
          <div class="map-hint" id="map-hint">${icon('crosshair')}<span>Choose a tower, then tap a <strong>+ build spot</strong></span></div>
          <div class="tower-popover" id="tower-popover" hidden></div>
          <div class="pause-overlay" id="pause-overlay" hidden><span>${icon('pause')}</span><h2>A moment to breathe.</h2><p>Your kingdom can wait.</p><button class="primary-button" id="resume">Resume adventure ${icon('play')}</button></div>
          <div class="result-overlay" id="result-overlay" hidden></div>
        </div>
        <div class="battle-bottom"><div class="wave-dots" id="wave-dots"></div><span id="wave-instruction">The first wave is on its way. Get ready.</span><span class="biome-label">${icon('tree-pine')}<span id="biome">Meadow</span></span></div>
      </div>
      <div class="defense-heading"><h3>Your line of defense <span>Choose wisely. Build bravely.</span></h3><span>${icon('gem')} Build with diamonds</span></div>
      <div class="defense-controls"><div class="tower-cards">${(Object.keys(TOWER_TYPES) as TowerType[]).map((type, index) => `<button class="tower-card ${type === selectedType ? 'selected' : ''}" data-tower="${type}" aria-pressed="${type === selectedType}"><div class="tower-art ${type}"><canvas data-tower-art="${type}" width="120" height="110"></canvas></div><div class="tower-info"><span class="tower-role">${['RANGED', 'SPLASH DAMAGE', 'CROWD CONTROL'][index]}</span><strong>${TOWER_TYPES[type].name}</strong><p>${TOWER_TYPES[type].description}</p><span class="tower-price">${icon('gem')} ${TOWER_TYPES[type].cost}</span></div><span class="tower-check">${icon('check')}</span></button>`).join('')}</div>
      <button class="start-wave" id="start-wave"><span class="start-icon">${icon('swords')}</span><span><strong>Bring on the wave</strong><small>Ready when you are</small></span>${icon('arrow-right')}</button></div>
      <div class="supply-row"><div class="supplies-intro"><span class="supply-emblem">${icon('sparkles')}</span><div><h3>A little help from the wild</h3><p>Special items. For the not-so-quiet moments.</p></div></div><button class="defense-help" data-dialog="defenses" aria-label="Tower and ability details">${icon('circle-help')}<span>Tower &amp; spell guide</span></button><div class="spell-buttons">${(['meteor', 'freeze', 'heal'] as Spell[]).map((spell, i) => `<button class="spell-button ${spell}" data-spell="${spell}" title="${['Deal heavy damage to every visible monster', 'Slow the entire wave for 6 seconds', 'Restore 6 kingdom health'][i]}">${icon(['flame', 'snowflake', 'heart'][i])}<span>${SPELL_NAMES[spell]}</span><strong id="spell-${spell}">${state.inventory[spell]}</strong></button>`).join('')}</div></div>
      <footer class="game-footer"><span>${icon('shield')} Small towers. Big hearts.</span><span id="save-status">Progress saves between waves ${icon('check')}</span></footer>
    </section>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="game-dialog"><button class="dialog-close icon-button" aria-label="Close dialog">${icon('x')}</button><div id="dialog-content"></div></dialog>
`;
refreshIcons();
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const renderer = new GameRenderer(canvas);
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
for (const preview of document.querySelectorAll<HTMLCanvasElement>('[data-tower-art]')) {
  const ctx = preview.getContext('2d')!; drawTower(ctx, 60, 84, preview.dataset.towerArt as TowerType, 1, 1.06);
}
function toast(message: string) {
  get('toast').textContent = message; get('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => get('toast').classList.remove('visible'), 3300);
}
function playSound(kind: 'build' | 'win' | 'spell') {
  if (!soundEnabled) return;
  try {
    audio ||= new AudioContext(); void audio.resume().catch(() => { soundEnabled = false; });
    const oscillator = audio.createOscillator(); const gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(kind === 'win' ? 523 : kind === 'spell' ? 330 : 392, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'win' ? 1046 : 660, audio.currentTime + .15);
    gain.gain.setValueAtTime(.055, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .3);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .3);
  } catch (error) { soundEnabled = false; console.warn('Game audio is unavailable.', error); }
}
function persist() {
  if (state.phase !== 'wave' && state.phase !== 'defeat') checkpoint = state;
  if (!saveGame(state) && !storageWarningShown) { storageWarningShown = true; get('save-status').textContent = 'Storage unavailable · progress stays in this session'; toast('Progress cannot be saved on this browser. Keep this session open.'); }
}
function updateUI() {
  get('diamond-count').textContent = state.diamonds.toLocaleString();
  get('battle-diamond-count').textContent = state.diamonds.toLocaleString();
  get('lives-count').textContent = String(state.lives);
  get('wave-count').innerHTML = `${String(Math.max(1, state.wave)).padStart(2, '0')} <span>/ 05</span>`;
  get('location-name').textContent = REGIONS[state.regionIndex].name;
  get('location-subtitle').textContent = REGIONS[state.regionIndex].subtitle;
  get('biome').textContent = REGIONS[state.regionIndex].biome;
  const clearedWaves = state.phase === 'wave' || state.phase === 'defeat' ? Math.max(0, state.wave - 1) : state.wave;
  const liberated = state.regionIndex * 5 + clearedWaves;
  get('campaign-percent').textContent = `${Math.round(liberated / 25 * 100)}%`;
  get('campaign-progress').style.width = `${liberated / 25 * 100}%`;
  get('region-list').innerHTML = REGIONS.map((region, i) => `<button class="region-card ${i === state.regionIndex ? 'current' : ''} ${i < state.regionIndex ? 'liberated' : ''}" data-region="${i}" ${i === state.regionIndex ? 'aria-current="location"' : ''}><span class="region-number">${i < state.regionIndex ? icon('check') : `0${i + 1}`}</span><span><strong>${region.name}</strong><small>${i < state.regionIndex ? 'Liberated' : i === state.regionIndex ? `${clearedWaves} of 5 waves cleared` : 'Uncharted territory'}</small></span>${icon(i <= state.regionIndex ? 'chevron-right' : 'lock-keyhole')}</button>`).join('');
  get('wave-dots').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="wave-dot ${i < state.wave && (state.phase !== 'wave' || i < state.wave - 1) ? 'complete' : i === state.wave - 1 && state.phase === 'wave' ? 'in-progress' : ''}" title="Wave ${i + 1}">${i < state.wave && (state.phase !== 'wave' || i < state.wave - 1) ? icon('check') : i + 1}</span>`).join('');
  get('map-status').textContent = renderer.artworkStatus === 'error' ? 'Orc artwork could not load. Reload to try again.' : state.phase === 'wave' ? (paused ? 'Adventure paused' : `${state.enemies.length} monsters on the march`) : state.phase === 'reward' ? 'A brave stand. A well-earned breath.' : state.phase === 'victory' ? 'This land is free again.' : state.phase === 'defeat' ? 'Every adventure has another beginning.' : 'A quiet meadow. For now.';
  get('wave-instruction').textContent = state.phase === 'wave' ? 'Hold the line. Your towers have this.' : state.phase === 'reward' ? (state.reward ? `Wave cleared! +${state.reward.diamonds} diamonds${state.reward.item ? ` + ${SPELL_NAMES[state.reward.item]}` : ''}` : 'Wave cleared. Your next stand awaits.') : state.phase === 'victory' ? 'Five brave stands. One place brought home.' : state.phase === 'defeat' ? 'Regroup, rebuild, and try again.' : 'The first wave is on its way. Get ready.';
  get('map-hint').hidden = state.towers.length > 0 || state.phase !== 'preparing';
  const start = get<HTMLButtonElement>('start-wave'); const fighting = state.phase === 'wave';
  start.disabled = fighting || state.phase === 'defeat' || renderer.artworkStatus !== 'ready';
  start.innerHTML = `<span class="start-icon">${icon(fighting ? 'shield' : state.phase === 'victory' ? 'flag' : 'swords')}</span><span><strong>${fighting ? 'Defending the wild' : state.phase === 'victory' ? (state.regionIndex === 4 ? 'Kingdom liberated!' : 'On to new ground') : state.phase === 'reward' ? 'Ready for the next?' : 'Bring on the wave'}</strong><small>${fighting ? `Wave ${state.wave} is underway` : state.phase === 'victory' ? 'Your next adventure awaits' : `Wave ${Math.min(5, state.wave + 1)} of 5 · ${REGIONS[state.regionIndex].monster}`}</small></span>${icon(fighting ? 'swords' : 'arrow-right')}`;
  get('pause-overlay').hidden = !paused || get<HTMLDialogElement>('game-dialog').open;
  get('pause').innerHTML = icon(paused ? 'play' : 'pause');
  get('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  get('speed').textContent = `${speed}×`; get('speed').setAttribute('aria-label', `Set game speed to ${speed === 1 ? 2 : 1}x`);
  for (const spell of ['meteor', 'freeze', 'heal'] as Spell[]) {
    get(`spell-${spell}`).textContent = String(state.inventory[spell]);
    const button = document.querySelector<HTMLButtonElement>(`[data-spell="${spell}"]`)!;
    button.disabled = !fighting || paused || state.inventory[spell] === 0 || (spell === 'heal' && state.lives >= 20);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tower]')) {
    const type = button.dataset.tower as TowerType; button.classList.toggle('selected', selectedType === type);
    button.classList.toggle('unaffordable', state.diamonds < TOWER_TYPES[type].cost); button.setAttribute('aria-pressed', String(type === selectedType));
  }
  updatePopover(); updateResult(); refreshIcons();
}
function updatePopover() {
  const popover = get('tower-popover'); const tower = state.towers.find(candidate => candidate.slotId === selectedSlot);
  if (!tower || ['defeat', 'victory'].includes(state.phase)) { popover.hidden = true; return; }
  popover.hidden = false;
  const slot = SLOTS.find(candidate => candidate.id === selectedSlot)!;
  popover.style.left = `${Math.min(79, Math.max(15, slot.x / 1100 * 100))}%`;
  popover.style.top = `${Math.min(71, Math.max(18, slot.y / 600 * 100 - 19))}%`;
  popover.innerHTML = `<div><strong>${TOWER_TYPES[tower.type].name}</strong><button class="tiny-close" data-action="deselect" aria-label="Close tower details">${icon('x')}</button></div><small>LEVEL ${tower.level} / ${MAX_TOWER_LEVEL}</small><p class="popover-stats">${towerSummary(tower.type, tower.level)}</p><button class="popover-guide" data-dialog="defenses">Strengths &amp; abilities ${icon('circle-help')}</button><div><button data-action="upgrade" ${tower.level === MAX_TOWER_LEVEL || state.diamonds < upgradeCost(tower) ? 'disabled' : ''}>${icon('arrow-up')} ${tower.level === MAX_TOWER_LEVEL ? 'Max level' : `Upgrade · ${upgradeCost(tower)} ${icon('gem')}`}</button><button class="sell-button" data-action="sell" aria-label="Sell tower for 60 percent refund">${icon('trash-2')}</button></div>`;
}
function updateResult() {
  const overlay = get('result-overlay');
  overlay.hidden = !['defeat', 'victory'].includes(state.phase);
  if (overlay.hidden) return;
  const won = state.phase === 'victory'; const final = state.regionIndex === REGIONS.length - 1;
  overlay.innerHTML = `<span class="result-icon">${icon(won ? 'trophy' : 'shield')}</span><span class="eyebrow">${won ? 'A LITTLE BRAVERY GOES A LONG WAY' : 'THIS STORY ISN’T OVER'}</span><h2>${won ? final ? 'The wild is home again.' : 'A place worth protecting.' : 'Even heroes regroup.'}</h2><p>${won ? `${REGIONS[state.regionIndex].name} is free. ${final ? 'All 25 waves conquered. Eric’s kingdom is safe!' : 'Pack your courage. The next region needs you.'}` : 'The monsters got through. Try more towers, upgrades, or a well-timed spell.'}</p>${won && state.reward ? `<div class="result-rewards">${icon('gem')} +${state.reward.diamonds} diamonds <span>·</span> ${icon('sparkles')} +1 Starfall</div>` : ''}<button class="primary-button" data-action="${won ? final ? 'new-campaign' : 'advance' : 'retry'}">${won ? final ? 'Another adventure' : 'Explore the next region' : 'Try this wave again'} ${icon('arrow-right')}</button>`;
}
function nextRegion() {
  if (state.regionIndex === REGIONS.length - 1) { showDialog('completed'); return; }
  state = advanceRegion(state); selectedSlot = null; paused = false; persist(); updateUI(); toast(`Welcome to ${REGIONS[state.regionIndex].name}. Build a new line of defense.`);
}
function launchWave() {
  if (renderer.artworkStatus !== 'ready') return;
  if (paused) { toast('Resume your adventure before starting the next wave.'); return; }
  if (state.phase === 'victory') { nextRegion(); return; }
  if (!state.towers.length) { toast('Give your kingdom a chance! Tap a + spot to build your first tower.'); return; }
  persist(); state = startWave(state); selectedSlot = null; updateUI();
}
canvas.addEventListener('click', event => {
  if (paused || ['defeat', 'victory'].includes(state.phase)) return;
  const slotId = renderer.getSlot(event.clientX, event.clientY); selectedSlot = slotId;
  if (slotId && !state.towers.some(tower => tower.slotId === slotId)) {
    const next = buildTower(state, slotId, selectedType);
    if (next === state) toast(`You need ${TOWER_TYPES[selectedType].cost} diamonds for this tower.`);
    else { state = next; playSound('build'); persist(); toast(`${TOWER_TYPES[selectedType].name} ready. Tap it to upgrade.`); }
  }
  updateUI();
});
function setPaused(value: boolean) { paused = value; updateUI(); }
get('start-wave').addEventListener('click', launchWave);
get('pause').addEventListener('click', () => setPaused(!paused));
get('resume').addEventListener('click', () => setPaused(false));
get('speed').addEventListener('click', () => { speed = speed === 1 ? 2 : 1; updateUI(); });
get('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { toast('Full screen is unavailable here. Landscape mode gives the best view.'); }
});
app.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
  if (button.dataset.tower) { selectedType = button.dataset.tower as TowerType; selectedSlot = null; updateUI(); }
  if (button.dataset.spell) { const spell = button.dataset.spell as Spell; const next = useSpell(state, spell); if (next !== state) { state = next; playSound('spell'); toast(`${SPELL_NAMES[spell]} cast!`); updateUI(); } }
  if (button.dataset.region) { const index = Number(button.dataset.region); toast(index === state.regionIndex ? `You’re defending ${REGIONS[index].name}.` : index < state.regionIndex ? 'This region is safe. Keep going — the kingdom needs you!' : `Free ${REGIONS[index - 1].name} to unlock this region.`); }
  if (button.dataset.dialog) showDialog(button.dataset.dialog);
  const action = button.dataset.action;
  if (action === 'advance') nextRegion();
  if (action === 'retry') { state = { ...checkpoint, towers: checkpoint.towers.map(t => ({ ...t, cooldown: 0 })) }; paused = false; selectedSlot = null; updateUI(); }
  if (action === 'new-campaign') showDialog('restart');
  if (action === 'restart-confirm') { state = createGame(); checkpoint = state; selectedSlot = null; paused = false; wasPausedBeforeDialog = false; persist(); get<HTMLDialogElement>('game-dialog').close(); updateUI(); }
  if (action === 'deselect') { selectedSlot = null; updateUI(); }
  if (action === 'upgrade' || action === 'sell') {
    const tower = state.towers.find(t => t.slotId === selectedSlot); if (!tower || paused) return;
    const next = action === 'upgrade' ? upgradeTower(state, tower.id) : sellTower(state, tower.id);
    if (next !== state) { state = next; if (action === 'sell') selectedSlot = null; playSound('build'); persist(); updateUI(); }
  }
});
const dialog = get<HTMLDialogElement>('game-dialog');
let wasPausedBeforeDialog = false;
function showDialog(type: string) {
  if (!dialog.open) { wasPausedBeforeDialog = paused; paused = true; }
  const content = get('dialog-content');
  if (type === 'settings') content.innerHTML = `<span class="dialog-badge">${icon('settings')}</span><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>Camp settings</h2><p>Your progress saves between waves on this device.</p><button class="setting-row" id="toggle-sound">${icon(soundEnabled ? 'volume-2' : 'volume-x')}<span>Gentle game sounds</span><strong>${soundEnabled ? 'On' : 'Off'}</strong></button><button class="setting-row" data-dialog="guide">${icon('book-open')}<span>How to play</span>${icon('chevron-right')}</button><button class="setting-row" data-dialog="defenses">${icon('swords')}<span>Tower and ability details</span>${icon('chevron-right')}</button><button class="setting-row" data-dialog="campaign">${icon('map')}<span>Campaign map</span>${icon('chevron-right')}</button><button class="setting-row" data-action="new-campaign">${icon('rotate-ccw')}<span>Start a new adventure</span>${icon('chevron-right')}</button><div class="creator-note">Made by <strong>Eric, a 7-year-old boy.</strong><br>A big adventure from a little imagination.</div>`;
  else if (type === 'restart') content.innerHTML = `<span class="dialog-badge">${icon('rotate-ccw')}</span><h2>A fresh adventure?</h2><p>This replaces the campaign saved on this device and returns you to the Greenfields with 120 diamonds.</p><button class="primary-button" data-action="restart-confirm">Start from the beginning ${icon('arrow-right')}</button>`;
  else if (type === 'defenses') content.innerHTML = defenseGuide(state.regionIndex);
  else if (type === 'campaign' || type === 'completed') content.innerHTML = `<span class="dialog-badge">${icon('map')}</span><span class="eyebrow">EVERY PLACE IS WORTH PROTECTING</span><h2>The road through Elderglen</h2><p>Five regions. Five waves each. Clear a region to journey onward with your diamonds and spells. Each new place needs a fresh set of towers.</p>${REGIONS.map((region, index) => `<div class="guide-row"><span class="guide-symbol">${icon(regionIcons[index])}</span><div><strong>${index + 1}. ${region.name}</strong><p>${region.difficulty} · ${index < state.regionIndex || index === state.regionIndex && state.phase === 'victory' ? 'Liberated' : index === state.regionIndex ? 'Your current stand' : 'Waiting to be freed'}</p></div></div>`).join('')}`;
  else content.innerHTML = `<span class="dialog-badge">${icon('book-open')}</span><span class="eyebrow">A SMALL GUIDE TO A BIG ADVENTURE</span><h2>Welcome, Wilderguard.</h2><p>The kingdom of Elderglen needs a little courage. Yours will do nicely.</p><div class="guide-row"><span class="guide-step">1</span><div><strong>Build your line of defense</strong><p>Select a tower, then tap a + spot on the meadow. Towers attack automatically. Tap them to upgrade.</p></div></div><div class="guide-row"><span class="guide-step">2</span><div><strong>Hold back the horde</strong><p>Start a wave when you’re ready. Orcs grow stronger each wave. Upgrade your towers and mix their strengths. Each escaped orc costs health; an armored chieftain costs three. Lose all 20 and you’ll retry from before that wave.</p></div></div><div class="guide-row"><span class="guide-step">3</span><div><strong>Bring the wild back home</strong><p>Earn diamonds after every wave. Wave 3 gives a freeze spell; wave 5 gives Starfall. Clear 5 waves to free a region and move on.</p></div></div><div class="guide-row"><span class="guide-step">✦</span><div><strong>Save a little magic for a hard moment</strong><p>Starfall hits all visible monsters. Deep freeze slows the horde for 6 seconds. Mending light restores 6 health.</p></div></div><div class="creator-note">Made by <strong>Eric, a 7-year-old boy.</strong><br>Best played in landscape, with a brave heart.</div>`;
  if (!dialog.open) dialog.showModal(); updateUI(); refreshIcons();
  get('toggle-sound')?.addEventListener('click', () => { soundEnabled = !soundEnabled; if (soundEnabled) playSound('build'); showDialog('settings'); });
}
get('settings').addEventListener('click', () => showDialog('settings'));
get('battle-menu').addEventListener('click', () => showDialog('settings'));
dialog.querySelector('.dialog-close')!.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { paused = wasPausedBeforeDialog; updateUI(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'wave') setPaused(true); });
document.addEventListener('keydown', event => {
  if (dialog.open || (event.target as HTMLElement).tagName === 'BUTTON') return;
  if (event.code === 'Space') { event.preventDefault(); if (state.phase === 'wave') setPaused(!paused); else launchWave(); }
  if (event.key === 'Escape') { selectedSlot = null; updateUI(); }
});
let lastTime = 0;
let lastUiUpdate = 0;
function frame(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, .1); lastTime = timestamp;
  if (!paused && state.phase === 'wave') {
    const previousPhase = state.phase;
    for (let step = 0; step < speed; step += 1) state = tickGame(state, dt);
    if (state.phase !== previousPhase) { persist(); playSound(state.phase === 'defeat' ? 'build' : 'win'); updateUI(); }
    else if (timestamp - lastUiUpdate > 500) { updateUI(); lastUiUpdate = timestamp; }
  }
  renderer.draw(state, selectedSlot, selectedType, timestamp / 1000);
  requestAnimationFrame(frame);
}
void renderer.ready.then(() => updateUI()).catch(() => {
  updateUI(); toast('Orc artwork could not load. Reload to try again.');
});
updateUI(); persist(); requestAnimationFrame(frame);
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(error => { console.warn('Offline cache could not be installed.', error); });
