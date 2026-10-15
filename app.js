/* =========================================================
   Simulador de Cabina & 4-Lane Arcade Traffic Runner
   - Carretera de 4 carriles (2 mismo sentido, 2 sentido contrario)
   - Centrado frontal equilibrado de la cabina
   - Controles ágiles de viraje para esquivar tráfico rápido
   - Tráfico de autos vectorizados dinámicos en perspectiva 3D
   - Sistema de colisiones, Score, High Score y Near-Misses
   - Audio sintetizado completo (Web Audio API)
   ========================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------
   0. Escalado del escenario (1600 x 1000) a la ventana
   --------------------------------------------------------- */
const stage = $('stage');
function fit() {
  const s = Math.min(innerWidth / 1600, innerHeight / 1000);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

/* ---------------------------------------------------------
   1. Estado del vehículo y del Juego Arcade
   --------------------------------------------------------- */
const state = {
  // Motor y transmisión
  engine: false,
  starting: false,
  handbrake: true,
  gear: 'P',            // P | R | N | D
  autoGear: 1,
  speed: 0,             // km/h (negativo = reversa)
  accel: 0,
  rpm: 0,
  throttle: 0,
  gas: false,
  brake: false,

  // Dirección ágil centrada
  steer: 0,             // grados del volante (-180..180)
  steerDrag: false,
  steerHold: 0,         // -1 | 0 | 1 (A / D o botones)
  playerX: 0.25,        // Inicia en carril derecho interior (carriles de 4: -0.75, -0.25 || 0.25, 0.75)
  dist: 0,
  odo: 42.8,

  // Luces y funciones
  lights: 0,            // 0 off | 1 bajas | 2 altas
  hazard: false,
  turn: 'none',
  turnArmed: false,
  blinkOn: false,
  blinkT: 0,
  wiperMode: 0,
  sweep: -1,
  offroad: false,
  bg: 0,
  time: 0,

  // Idioma
  lang: 'es',

  // Sistema de Juego Arcade
  gameActive: false,
  isGameOver: false,
  score: 0,
  highScore: parseInt(localStorage.getItem('arcade_high_score') || '0', 10),
  dodges: 0,
  stoppedTimer: 0,      // Tiempo detenido en D antes de Game Over
};

/* ---------------------------------------------------------
   1.1. Diccionario de Idiomas (i18n: Español e Inglés)
   --------------------------------------------------------- */
const I18N = {
  es: {
    menu: "MENÚ",
    hud_score: "SCORE",
    hud_high: "RÉCORD",
    hud_dodges: "ESQUIVES",
    menu_play: "JUGAR",
    menu_tutorial: "TUTORIAL",
    menu_credits: "CRÉDITOS",
    menu_hint: "Presiona JUGAR para entrar a la pista a toda velocidad",
    slogan: "Si mi madre me dio la vida, la velocidad me la quita",
    tut_title: "📖 Cómo Jugar",
    btn_understand: "¡Entendido! Volver",
    credits_title: "👥 Créditos del Proyecto",
    dev_team: "DESARROLLADORES",
    subject: "MATERIA",
    subject_val: "Inglés",
    group: "GRUPO",
    teacher: "PROFESORA",
    btn_back: "Volver al Menú",
    go_title: "💥 GAME OVER",
    go_reason_crash_front: "¡Choque frontal a toda velocidad!",
    go_reason_crash_rear: "¡Impactaste por detrás a otro auto!",
    go_reason_stopped: "¡Te detuviste por completo en la autopista!",
    btn_restart: "🔄 JUGAR DE NUEVO",
    btn_menu_return: "🏠 Menú Principal",
    pedal_brake: "FRENO",
    pedal_gas: "ACEL.",
    btn_start: "START",
    btn_lights: "LUCES",
    btn_hazard: "HAZARD",
    btn_wiper: "LIMPIA",
    btn_handbrake: "F. MANO",
    toast_engine_on: "✅ ¡Motor encendido! Acelera con W o Flecha Arriba",
    toast_engine_off: "Motor apagado",
    toast_stop_first: "⚠️ Detén el auto antes de apagar el motor",
    toast_offroad: "🌿 ¡Fuera de la carretera! Vuelve al asfalto",
    toast_handbrake_warn: "⚠️ ¡Freno de mano en movimiento!",
    toast_restart: "🚦 ¡Partida reiniciada! ¡Acelera!",
    tut_steps: [
      { icon: "🏎️", title: "Acelerar y Frenar", desc: "Usa <span class='tut-keys'>W</span> o <span class='tut-keys'>↑</span> para acelerar a fondo. Usa <span class='tut-keys'>S</span>, <span class='tut-keys'>↓</span> o <span class='tut-keys'>ESPACIO</span> para frenar con fuerza." },
      { icon: "🔄", title: "Dirección Ágil", desc: "Usa <span class='tut-keys'>A</span> / <span class='tut-keys'>D</span> o <span class='tut-keys'>←</span> / <span class='tut-keys'>→</span> para cambiar de carril ágilmente. También puedes arrastrar el volante con el ratón." },
      { icon: "🛣️", title: "4 Carriles de Autopista", desc: "Los 2 carriles derechos van en tu dirección (tráfico más lento). Los 2 carriles izquierdos vienen en sentido contrario (¡altísima velocidad frontal!)." },
      { icon: "⚡", title: "Near Miss (+250 PTS)", desc: "Pasa rozando a otros vehículos a más de 40 km/h sin chocar para ganar bonificaciones épicas de puntuación." },
      { icon: "⚠️", title: "¡No te Detengas!", desc: "Si te detienes más de 5 segundos en medio de la autopista o colisionas de frente o por alcance, la partida terminará." }
    ]
  },
  en: {
    menu: "MENU",
    hud_score: "SCORE",
    hud_high: "HIGH SCORE",
    hud_dodges: "DODGES",
    menu_play: "PLAY",
    menu_tutorial: "TUTORIAL",
    menu_credits: "CREDITS",
    menu_hint: "Press PLAY to enter the highway at full speed",
    slogan: "If my mother gave me life, speed takes it away",
    tut_title: "📖 How to Play",
    btn_understand: "Got it! Go Back",
    credits_title: "👥 Project Credits",
    dev_team: "DEVELOPERS",
    subject: "SUBJECT",
    subject_val: "English",
    group: "GROUP",
    teacher: "TEACHER",
    btn_back: "Back to Menu",
    go_title: "💥 GAME OVER",
    go_reason_crash_front: "Head-on collision at high speed!",
    go_reason_crash_rear: "You rear-ended another vehicle!",
    go_reason_stopped: "You came to a full stop on the highway!",
    btn_restart: "🔄 PLAY AGAIN",
    btn_menu_return: "🏠 Main Menu",
    pedal_brake: "BRAKE",
    pedal_gas: "GAS",
    btn_start: "START",
    btn_lights: "LIGHTS",
    btn_hazard: "HAZARD",
    btn_wiper: "WIPER",
    btn_handbrake: "E-BRAKE",
    toast_engine_on: "✅ Engine started! Accelerate with W or Up Arrow",
    toast_engine_off: "Engine stopped",
    toast_stop_first: "⚠️ Bring car to a stop before shutting engine off",
    toast_offroad: "🌿 Off-road! Steer back onto asphalt",
    toast_handbrake_warn: "⚠️ Handbrake engaged while moving!",
    toast_restart: "🚦 Game restarted! Floor it!",
    tut_steps: [
      { icon: "🏎️", title: "Accelerate & Brake", desc: "Press <span class='tut-keys'>W</span> or <span class='tut-keys'>↑</span> to accelerate. Press <span class='tut-keys'>S</span>, <span class='tut-keys'>↓</span> or <span class='tut-keys'>SPACE</span> to brake hard." },
      { icon: "🔄", title: "Agile Steering", desc: "Use <span class='tut-keys'>A</span> / <span class='tut-keys'>D</span> or <span class='tut-keys'>←</span> / <span class='tut-keys'>→</span> for rapid lane changes. You can also drag the steering wheel with the mouse." },
      { icon: "🛣️", title: "4 Highway Lanes", desc: "The 2 right lanes move forward with your traffic. The 2 left lanes feature oncoming traffic at extreme relative velocity." },
      { icon: "⚡", title: "Near Miss (+250 PTS)", desc: "Graze by vehicles at speeds over 40 km/h without crashing to rack up combo bonus points." },
      { icon: "⚠️", title: "Never Stop!", desc: "Stopping for over 5 seconds on the active highway or colliding into any vehicle will trigger Game Over." }
    ]
  }
};

function setLanguage(lang) {
  if (!I18N[lang]) return;
  state.lang = lang;

  // Actualizar botones de banderas
  $('btnLangEs').classList.toggle('active', lang === 'es');
  $('btnLangEn').classList.toggle('active', lang === 'en');

  const dict = I18N[lang];

  // Actualizar todos los elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Eslogan
  const sloganTxt = dict.slogan;
  const menuSlogan = $('menuSlogan');
  if (menuSlogan) menuSlogan.textContent = `"${sloganTxt}"`;
  const creditSloganTxt = $('creditSloganTxt');
  if (creditSloganTxt) creditSloganTxt.textContent = sloganTxt;

  // Materia en créditos
  const subjEl = document.querySelector('.credit-item:nth-child(2) .credit-name');
  if (subjEl) subjEl.textContent = dict.subject_val;

  // Inyectar pasos del tutorial
  const tutBox = $('tutorialContent');
  if (tutBox) {
    tutBox.innerHTML = dict.tut_steps.map((st) => `
      <div class="tut-step">
        <div class="tut-icon">${st.icon}</div>
        <div>
          <b>${st.title}:</b> ${st.desc}
        </div>
      </div>
    `).join('');
  }
}

/* ---------------------------------------------------------
   2. Sistema de Tráfico de 4 Carriles
   --------------------------------------------------------- */
// Carriles: 
// [-0.75]: Sentido contrario rápido (viene de frente a 100 km/h)
// [-0.25]: Sentido contrario medio (viene de frente a 80 km/h)
// [ 0.25]: Mismo sentido rápido (va hacia adelante a 70 km/h)
// [ 0.75]: Mismo sentido lento / camiones (va hacia adelante a 55 km/h)
const LANES = [-0.75, -0.25, 0.25, 0.75];
const CAR_COLORS = ['#d8352a', '#2a7fd8', '#f0f0f4', '#f5b025', '#249e52', '#8338ec', '#e63946'];

let traffic = [];
let nextSpawnDist = 400;

function resetTraffic() {
  traffic = [];
  nextSpawnDist = state.dist + 300;
}

function spawnTrafficCar() {
  const laneIdx = Math.floor(Math.random() * 4);
  const laneX = LANES[laneIdx];
  const isIncoming = laneIdx < 2; // Carriles izquierdos vienen en contra

  // Velocidad relativa
  let speedKmH = isIncoming ? (75 + Math.random() * 35) : (50 + Math.random() * 30);
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const isTruck = !isIncoming && laneIdx === 3 && Math.random() > 0.45;

  traffic.push({
    z: state.dist + 1600 + Math.random() * 500, // distancia por delante
    laneX: laneX,
    targetLaneX: laneX,
    speed: speedKmH,
    isIncoming: isIncoming,
    color: color,
    isTruck: isTruck,
    passed: false,
    nearMissed: false,
    w: isTruck ? 0.38 : 0.32, // ancho de colisión
    l: isTruck ? 140 : 80,
  });
}

/* ---------------------------------------------------------
   3. Audio (Web Audio API)
   --------------------------------------------------------- */
const AudioSys = {
  ctx: null, master: null, sfx: null, musicBus: null, analyser: null, noise: null,
  engine: null, horn: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.75; this.sfx.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 64; this.analyser.smoothingTimeConstant = 0.7;
    this.musicBus.connect(this.analyser); this.analyser.connect(this.master);

    const len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    radio.applyVolume();
  },

  env(g, t, peak, a, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },

  tick(high) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'square'; o.frequency.value = high ? 1900 : 1400;
    f.type = 'bandpass'; f.frequency.value = high ? 2400 : 1800; f.Q.value = 4;
    this.env(g, t, 0.35, 0.002, 0.035);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.05);
  },

  click() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 3000;
    this.env(g, t, 0.18, 0.001, 0.03);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random() * 0.5, 0.05);
  },

  clunk() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    this.env(g, t, 0.4, 0.003, 0.12);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.15);
    this.click();
  },

  swish() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random() * 0.2, 0.75);
  },

  spray() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 2500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, 0, 0.5);
  },

  crash() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    // Gran explosión metálica de choque
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = 800;
    this.env(g, t, 0.9, 0.005, 0.9);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, 0, 1.2);

    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.6);
    this.env(og, t, 0.7, 0.01, 0.7);
    o.connect(og).connect(this.sfx);
    o.start(t); o.stop(t + 0.8);
  },

  nearMissSound() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.15);
    this.env(g, t, 0.35, 0.01, 0.2);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.25);
  },

  hornStart() {
    if (!this.ctx || this.horn) return;
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    const oscs = [415, 523].map((fr) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
      o.connect(f); o.start(t); return o;
    });
    f.connect(g).connect(this.sfx);
    this.horn = { g, oscs };
  },
  hornStop() {
    if (!this.horn) return;
    const t = this.ctx.currentTime, h = this.horn;
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setTargetAtTime(0.0001, t, 0.03);
    h.oscs.forEach((o) => o.stop(t + 0.2));
    this.horn = null;
  },

  starter() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 70;
    lfo.type = 'square'; lfo.frequency.value = 11; lg.gain.value = 0.12;
    f.type = 'lowpass'; f.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.05);
    g.gain.setValueAtTime(0.14, t + 0.65);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.8);
    lfo.connect(lg).connect(g.gain);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); lfo.start(t); o.stop(t + 0.85); lfo.stop(t + 0.85);
  },

  engineStart() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx, t = c.currentTime;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    f.type = 'lowpass'; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.3);
    const g2 = c.createGain(); g2.gain.value = 0.4;
    o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(this.sfx);
    o1.start(t); o2.start(t);
    this.engine = { o1, o2, f, g };
  },
  engineStop() {
    if (!this.engine) return;
    const t = this.ctx.currentTime, e = this.engine;
    e.g.gain.setTargetAtTime(0.0001, t, 0.15);
    e.o1.frequency.setTargetAtTime(15, t, 0.3);
    e.o1.stop(t + 1); e.o2.stop(t + 1);
    this.engine = null;
  },
  engineUpdate(rpm, throttle) {
    if (!this.engine) return;
    const t = this.ctx.currentTime, e = this.engine;
    const f = Math.max(20, rpm / 30 * 1.5);
    e.o1.frequency.setTargetAtTime(f, t, 0.05);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(250 + rpm * 0.22 + throttle * 700, t, 0.05);
    e.g.gain.setTargetAtTime(0.05 + throttle * 0.05 + rpm / 7000 * 0.03, t, 0.08);
  },
};

/* ---------------------------------------------------------
   4. Radio
   --------------------------------------------------------- */
const STATIONS = [
  { name: 'Synthwave FM 98.5', song: 'Neon Highway', bpm: 104, style: 'synth',
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },
  { name: 'Lo-Fi Chill 102.3', song: 'Sunday Drive', bpm: 80, style: 'lofi',
    chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]] },
  { name: 'Funk Drive 105.7', song: 'Groove Machine', bpm: 112, style: 'funk',
    chords: [[52, 55, 59, 62], [57, 61, 64, 67], [52, 55, 59, 62], [54, 57, 61, 64]] },
];
const PATTERNS = {
  synth: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
           bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0], bassWave: 'sawtooth',
           pad: 'sawtooth', arp: true },
  lofi:  { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
           bass: [0, null, null, null, null, null, null, 7, null, null, 0, null, null, null, null, null], bassWave: 'sine',
           pad: 'triangle', keys: true },
  funk:  { kick: 'x..x..x...x..x..', snare: '....x..x....x...', hat: 'xxxxxxxxxxxxxxxx',
           bass: [0, null, 12, 0, null, 0, 10, null, 0, null, 12, null, 7, null, 10, 12], bassWave: 'square',
           pad: null, stabs: '..x...x...x..x..' },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const radio = {
  playing: false, idx: 0, vol: 60, step: 0, nextTime: 0, timer: null,

  toggle() {
    AudioSys.init();
    if (!AudioSys.ctx) return;
    this.playing ? this.pause() : this.play();
  },
  play() {
    this.playing = true;
    this.step = 0;
    this.nextTime = AudioSys.ctx.currentTime + 0.08;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    this.applyVolume();
    this.ui();
  },
  pause() {
    this.playing = false;
    clearInterval(this.timer);
    this.applyVolume();
    this.ui();
  },
  change(d) {
    this.idx = (this.idx + d + STATIONS.length) % STATIONS.length;
    this.step = 0;
    if (this.playing && AudioSys.ctx) { this.nextTime = AudioSys.ctx.currentTime + 0.25; this.static(); }
    const lcd = $('lcd');
    lcd.classList.remove('tuning'); void lcd.offsetWidth; lcd.classList.add('tuning');
    this.ui();
  },
  setVol(d) {
    this.vol = clamp(this.vol + d, 0, 100);
    this.applyVolume();
    this.ui();
  },
  applyVolume() {
    if (!AudioSys.ctx) return;
    const g = this.playing ? Math.pow(this.vol / 100, 1.6) * 0.6 : 0;
    AudioSys.musicBus.gain.setTargetAtTime(g, AudioSys.ctx.currentTime, 0.05);
  },
  static() {
    const c = AudioSys.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AudioSys.noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    s.connect(f).connect(g).connect(AudioSys.musicBus);
    s.start(t, Math.random(), 0.3);
  },
  ui() {
    const st = STATIONS[this.idx];
    $('stName').textContent = st.name;
    $('stSong').textContent = st.song;
    $('stState').textContent = this.playing ? '▶ Reproduciendo' : '⏸ En pausa';
    $('btnPlay').textContent = this.playing ? '❚❚' : '▶';
    $('btnPlay').classList.toggle('on', this.playing);
    $('disc').classList.toggle('spin', this.playing);
    $('volFill').style.width = this.vol + '%';
    $('volTxt').textContent = this.vol;
  },

  schedule() {
    const c = AudioSys.ctx;
    const st = STATIONS[this.idx], p = PATTERNS[st.style];
    const spb = 60 / st.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, st, p, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64;
    }
  },
  playStep(s, t, st, p, spb) {
    const i = s % 16;
    const chord = st.chords[Math.floor(s / 16)];
    if (p.kick[i] === 'x') this.kick(t);
    if (p.snare[i] === 'x') this.snare(t);
    if (p.hat[i] === 'x') this.hat(t, st.style === 'funk' ? (i % 2 ? 0.035 : 0.07) : 0.06);
    const b = p.bass[i];
    if (b != null) this.note(t, chord[0] - 24 + b, spb * 1.7, p.bassWave, 0.2, 700);
    if (p.pad && i === 0) chord.forEach((n) => this.note(t, n, spb * 15.5, p.pad, 0.045, 1300, 0.25));
    if (p.arp && i % 2 === 0) this.note(t, chord[(i / 2) % chord.length] + 12, spb * 1.4, 'square', 0.045, 2600);
    if (p.keys && (i === 0 || i === 6 || i === 10)) chord.forEach((n) => this.note(t, n + 12, spb * 3, 'sine', 0.05, 3000, 0.01));
    if (p.stabs && p.stabs[i] === 'x') chord.forEach((n) => this.note(t, n + 12, spb * 0.7, 'square', 0.035, 1800));
  },

  note(t, midi, dur, type, vol, cutoff, attack = 0.006) {
    const c = AudioSys.ctx;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = mtof(midi);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.2);
    o.connect(f).connect(g).connect(AudioSys.musicBus);
    o.start(t); o.stop(t + dur + 0.4);
  },
  kick(t) {
    const c = AudioSys.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g).connect(AudioSys.musicBus); o.start(t); o.stop(t + 0.35);
  },
  snare(t) {
    const c = AudioSys.ctx;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AudioSys.noise; f.type = 'highpass'; f.frequency.value = 1500;
    g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    s.connect(f).connect(g).connect(AudioSys.musicBus); s.start(t, Math.random() * 0.5, 0.2);
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(og).connect(AudioSys.musicBus); o.start(t); o.stop(t + 0.1);
  },
  hat(t, vol) {
    const c = AudioSys.ctx;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AudioSys.noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    s.connect(f).connect(g).connect(AudioSys.musicBus); s.start(t, Math.random() * 0.5, 0.06);
  },
};

/* ---------------------------------------------------------
   5. Construcción de los Relojes e Instrumentos
   --------------------------------------------------------- */
function buildGauge(id, max, major, minor, labelEvery, redFrom) {
  const g = $(id).querySelector('.ticks');
  const ang = (v) => ((-135 + (v / max) * 270) - 90) * Math.PI / 180;
  const isMul = (v, m) => Math.abs(v / m - Math.round(v / m)) < 1e-6;
  let html = '';
  if (redFrom != null) {
    const a1 = ang(redFrom), a2 = ang(max), r = 44;
    html += `<path class="redarc" d="M${(Math.cos(a1) * r).toFixed(2)},${(Math.sin(a1) * r).toFixed(2)} A${r},${r} 0 0 1 ${(Math.cos(a2) * r).toFixed(2)},${(Math.sin(a2) * r).toFixed(2)}"/>`;
  }
  for (let v = 0; v <= max + 1e-6; v += minor) {
    const a = ang(v), maj = isMul(v, major);
    const r1 = maj ? 36 : 40, r2 = 44;
    const cls = 'tick' + (maj ? ' major' : '') + (redFrom != null && v >= redFrom ? ' red' : '');
    html += `<line class="${cls}" x1="${(Math.cos(a) * r1).toFixed(2)}" y1="${(Math.sin(a) * r1).toFixed(2)}" x2="${(Math.cos(a) * r2).toFixed(2)}" y2="${(Math.sin(a) * r2).toFixed(2)}"/>`;
    if (isMul(v, labelEvery)) {
      html += `<text class="num" x="${(Math.cos(a) * 28).toFixed(2)}" y="${(Math.sin(a) * 28).toFixed(2)}">${v}</text>`;
    }
  }
  g.innerHTML = html;
}
buildGauge('tach', 8, 1, 0.5, 1, 6.5);
buildGauge('speedo', 240, 20, 10, 40, null);
const tachNeedle = $('tach').querySelector('.needle');
const speedNeedle = $('speedo').querySelector('.needle');

const viz = $('viz');
for (let i = 0; i < 18; i++) { const b = document.createElement('div'); b.className = 'bar'; viz.appendChild(b); }
const vizBars = [...viz.children];
const freqData = new Uint8Array(32);

/* ---------------------------------------------------------
   6. Avisos y Feedback Flotante
   --------------------------------------------------------- */
const toastEl = $('toast');
let toastTimer = null, lastToast = '', lastToastAt = 0;
function toast(msg, ms = 2000) {
  const now = performance.now();
  if (msg === lastToast && now - lastToastAt < 1200) return;
  lastToast = msg; lastToastAt = now;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function showNearMiss() {
  AudioSys.nearMissSound();
  const banner = $('nearMissBanner');
  banner.classList.remove('pop');
  void banner.offsetWidth;
  banner.classList.add('pop');
  setTimeout(() => banner.classList.remove('pop'), 1100);
}

/* ---------------------------------------------------------
   7. Controles Ágiles (Mouse + Teclas W / A / S / D)
   --------------------------------------------------------- */
document.addEventListener('pointerdown', () => AudioSys.init(), { capture: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function hold(el, onDown, onUp) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    el.classList.add('pressed');
    onDown();
  });
  const end = () => {
    if (!el.classList.contains('pressed')) return;
    el.classList.remove('pressed');
    onUp();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, end));
}

// Pedales
hold($('pedalGas'), () => {
  state.gas = true;
  if (state.isGameOver) return;
  if (!state.engine) toast('🔑 Enciende el motor con ENGINE START');
  else if (state.handbrake) toast('🅿️ ¡Quita el freno de mano para avanzar!');
  else if (state.gear === 'P' || state.gear === 'N') toast('⚙️ Cambia la palanca a D para moverte');
}, () => { state.gas = false; });

hold($('pedalBrake'), () => { state.brake = true; }, () => { state.brake = false; });

// Volante: arrastre con mouse sensible y ágil
const wheel = $('wheel');
let lastAng = 0;
const pointerAngle = (e) => {
  const r = wheel.getBoundingClientRect();
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
};
wheel.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.hub, .wbtn')) return;
  e.preventDefault();
  try { wheel.setPointerCapture(e.pointerId); } catch (_) {}
  state.steerDrag = true;
  wheel.classList.add('dragging');
  lastAng = pointerAngle(e);
});
const onPointerMove = (e) => {
  if (!state.steerDrag) return;
  const a = pointerAngle(e);
  let d = a - lastAng;
  if (d > 180) d -= 360; if (d < -180) d += 360;
  // Multiplicador ágil 1.4x para viraje veloz
  state.steer = clamp(state.steer + d * 1.4, -180, 180);
  lastAng = a;
};
window.addEventListener('pointermove', onPointerMove);
const endDrag = () => { state.steerDrag = false; wheel.classList.remove('dragging'); };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => window.addEventListener(ev, endDrag));

// Teclado ágil (W, A, S, D y Flechas)
window.addEventListener('keydown', (e) => {
  if (state.isGameOver) return;
  if (['ArrowUp', 'KeyW'].includes(e.code)) state.gas = true;
  if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) state.brake = true;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) state.steerHold = -1;
  if (['ArrowRight', 'KeyD'].includes(e.code)) state.steerHold = 1;
});
window.addEventListener('keyup', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) state.gas = false;
  if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) state.brake = false;
  if (['ArrowLeft', 'KeyA'].includes(e.code) && state.steerHold === -1) state.steerHold = 0;
  if (['ArrowRight', 'KeyD'].includes(e.code) && state.steerHold === 1) state.steerHold = 0;
});

// Botones de giro rápido en salpicadero
hold($('btnSteerL'), () => { state.steerHold = -1; }, () => { state.steerHold = 0; });
hold($('btnSteerR'), () => { state.steerHold = 1; }, () => { state.steerHold = 0; });

// Bocina
hold($('hub'), () => AudioSys.hornStart(), () => AudioSys.hornStop());

// Mandos del volante
const actions = {
  play: () => radio.toggle(),
  next: () => radio.change(1),
  prev: () => radio.change(-1),
  volUp: () => radio.setVol(10),
  volDown: () => radio.setVol(-10),
};
document.querySelectorAll('.wbtn').forEach((el) => {
  hold(el, () => { AudioSys.click(); actions[el.dataset.act](); }, () => {});
});

// Radio
$('btnPlay').addEventListener('click', () => { AudioSys.click(); radio.toggle(); });
$('btnNext').addEventListener('click', () => { AudioSys.click(); radio.change(1); });
$('btnPrev').addEventListener('click', () => { AudioSys.click(); radio.change(-1); });
$('btnVolUp').addEventListener('click', () => { AudioSys.click(); radio.setVol(10); });
$('btnVolDown').addEventListener('click', () => { AudioSys.click(); radio.setVol(-10); });

// Encendido
const startBtn = $('btnStart');
startBtn.addEventListener('click', () => {
  if (state.starting || state.isGameOver) return;
  if (!state.engine) {
    state.starting = true;
    startBtn.classList.add('starting');
    AudioSys.starter();
    $('cluster').classList.add('lit');
    state.sweep = 0;
    setTimeout(() => {
      state.starting = false;
      state.engine = true;
      state.rpm = 1400;
      startBtn.classList.remove('starting');
      startBtn.classList.add('on');
      AudioSys.engineStart();
      toast('✅ Motor encendido · ¡Listo para correr!');
    }, 750);
  } else {
    if (Math.abs(state.speed) > 2) { toast('⚠️ Detén el auto antes de apagar el motor'); return; }
    state.engine = false;
    startBtn.classList.remove('on');
    AudioSys.engineStop();
    $('cluster').classList.remove('lit');
    toast('Motor apagado');
  }
});

// Luces
$('btnLights').addEventListener('click', () => {
  AudioSys.click();
  state.lights = (state.lights + 1) % 3;
  const b = $('btnLights');
  b.classList.toggle('low', state.lights === 1);
  b.classList.toggle('high', state.lights === 2);
  $('ledLights').className = 'led' + (state.lights === 1 ? ' green' : state.lights === 2 ? ' blue' : '');
  $('lightsSub').textContent = ['OFF', 'BAJAS', 'ALTAS'][state.lights];
  const ico = $('icoBeam');
  ico.classList.toggle('low', state.lights === 1);
  ico.classList.toggle('high', state.lights === 2);
});

// Hazard
$('btnHazard').addEventListener('click', () => {
  AudioSys.click();
  state.hazard = !state.hazard;
  $('ledHazard').className = 'led' + (state.hazard ? ' amber' : '');
  $('hazardSub').textContent = state.hazard ? 'ON' : 'OFF';
  restartBlink();
});

// Direccionales
function setTurn(dir) {
  AudioSys.click();
  state.turn = state.turn === dir ? 'none' : dir;
  state.turnArmed = false;
  $('btnTurnL').classList.toggle('armed', state.turn === 'left');
  $('btnTurnR').classList.toggle('armed', state.turn === 'right');
  restartBlink();
}
$('btnTurnL').addEventListener('click', () => setTurn('left'));
$('btnTurnR').addEventListener('click', () => setTurn('right'));
function restartBlink() {
  const active = state.hazard || state.turn !== 'none';
  if (active && !state.blinkOn) { state.blinkT = 0; state.blinkOn = true; AudioSys.tick(true); }
  if (!active) state.blinkOn = false;
}

// Freno de mano
$('btnHandbrake').addEventListener('click', () => {
  AudioSys.clunk();
  state.handbrake = !state.handbrake;
  $('btnHandbrake').classList.toggle('on', state.handbrake);
  $('ledHandbrake').className = 'led' + (state.handbrake ? ' red' : '');
  $('hbSub').textContent = state.handbrake ? 'ON' : 'OFF';
  $('icoBrake').classList.toggle('on', state.handbrake);
  if (state.handbrake && Math.abs(state.speed) > 20) toast('⚠️ ¡Freno de mano en movimiento!');
});
$('btnHandbrake').classList.add('on');

// Limpiaparabrisas
const wiperL = $('wiperL'), wiperR = $('wiperR');
const WIPER_DUR = [0, 1.6, 0.9];
function setWiperDur(s) { [wiperL, wiperR].forEach((w) => w.style.setProperty('--wdur', s + 's')); }
$('btnWiper').addEventListener('click', () => {
  AudioSys.click();
  const prev = state.wiperMode;
  state.wiperMode = (state.wiperMode + 1) % 3;
  $('wiperSub').textContent = ['OFF', 'LENTO', 'RÁPIDO'][state.wiperMode];
  $('ledWiper').className = 'led' + (state.wiperMode ? ' green' : '');
  $('btnWiper').classList.toggle('on', state.wiperMode > 0);
  if (prev === 0 && state.wiperMode > 0) {
    setWiperDur(WIPER_DUR[state.wiperMode]);
    wiperL.classList.add('active'); wiperR.classList.add('active');
    sprayWasher();
    AudioSys.swish();
  }
});
wiperL.addEventListener('animationiteration', () => {
  if (state.wiperMode === 0) {
    wiperL.classList.remove('active'); wiperR.classList.remove('active');
  } else {
    setWiperDur(WIPER_DUR[state.wiperMode]);
    AudioSys.swish();
  }
});

function sprayWasher() {
  AudioSys.spray();
  const box = $('washer');
  for (let i = 0; i < 46; i++) {
    const d = document.createElement('div');
    d.className = 'drop';
    const s = 5 + Math.random() * 12;
    const x = 220 + Math.random() * 1160;
    const y = 90 + Math.random() * 330;
    d.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s * (0.9 + Math.random() * 0.3)}px;animation-delay:${Math.random() * 0.15}s`;
    box.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
}

// Selector de marchas
const KNOB_TOP = { P: -5, R: 25, N: 55, D: 85 };
const GEAR_NAMES = { P: 'Parking', R: 'Reversa', N: 'Neutral', D: 'Drive' };
document.querySelectorAll('.gopt').forEach((b) => {
  b.addEventListener('click', () => setGear(b.dataset.gear));
});
function setGear(g) {
  if (g === state.gear) return;
  const moving = Math.abs(state.speed) > 3;
  if (moving && (g === 'P' || (g === 'R' && state.speed > 0) || (g === 'D' && state.speed < 0))) {
    toast(`⚠️ Detén el auto antes de cambiar a ${GEAR_NAMES[g]}`);
    return;
  }
  AudioSys.clunk();
  state.gear = g;
  document.querySelectorAll('.gopt').forEach((b) => b.classList.toggle('active', b.dataset.gear === g));
  const k = $('knob');
  k.textContent = g;
  k.style.top = KNOB_TOP[g] + 'px';
}

// =========================================================
// GESTIÓN DE MENÚ PRINCIPAL, MODALES E IDIOMA
// =========================================================
const mainMenuEl = $('mainMenu');
const tutorialModalEl = $('tutorialModal');
const creditsModalEl = $('creditsModal');
const gameOverModalEl = $('gameOverModal');

// Iniciar Juego desde el Menú Principal
function startGameFromMenu() {
  AudioSys.init();
  mainMenuEl.classList.add('hide');
  tutorialModalEl.classList.remove('show');
  creditsModalEl.classList.remove('show');
  gameOverModalEl.classList.remove('show');
  state.gameActive = true;
  state.isGameOver = false;

  // Si el motor estaba apagado o en Parking, prepararlo en modo Drive
  if (!state.engine) {
    state.engine = true;
    state.rpm = 1500;
    $('cluster').classList.add('lit');
    $('btnStart').classList.add('on');
    AudioSys.engineStart();
  }
  if (state.handbrake) {
    state.handbrake = false;
    $('btnHandbrake').classList.remove('on');
    $('ledHandbrake').className = 'led';
    $('hbSub').textContent = 'OFF';
    $('icoBrake').classList.remove('on');
  }
  setGear('D');
  resetTraffic();
  toast(I18N[state.lang].toast_engine_on);
}

// Volver al Menú Principal
function returnToMainMenu() {
  mainMenuEl.classList.remove('hide');
  tutorialModalEl.classList.remove('show');
  creditsModalEl.classList.remove('show');
  gameOverModalEl.classList.remove('show');
  state.gameActive = false;
  state.gas = false;
  state.brake = false;
  state.speed = 0;
}

// Botones del Menú Principal
$('btnMenuPlay').addEventListener('click', () => {
  AudioSys.click();
  startGameFromMenu();
});

$('btnMenuTutorial').addEventListener('click', () => {
  AudioSys.click();
  tutorialModalEl.classList.add('show');
});

$('btnMenuCredits').addEventListener('click', () => {
  AudioSys.click();
  creditsModalEl.classList.add('show');
});

// Botones para cerrar modales
$('btnCloseTutorial').addEventListener('click', () => {
  AudioSys.click();
  tutorialModalEl.classList.remove('show');
});

$('btnCloseCredits').addEventListener('click', () => {
  AudioSys.click();
  creditsModalEl.classList.remove('show');
});

// Botón Menú de la barra superior (in-game)
$('btnNavMenu').addEventListener('click', () => {
  AudioSys.click();
  returnToMainMenu();
});

// Botones de Selector de Idioma (Banderas)
$('btnLangEs').addEventListener('click', () => {
  AudioSys.click();
  setLanguage('es');
});
$('btnLangEn').addEventListener('click', () => {
  AudioSys.click();
  setLanguage('en');
});

// Botón de Volver al Menú desde Pantalla de Game Over
$('btnGoMenu').addEventListener('click', () => {
  AudioSys.click();
  returnToMainMenu();
});

$('btnRestart').addEventListener('click', () => {
  restartGame();
});

function triggerGameOver(reasonKey) {
  if (state.isGameOver) return;
  state.isGameOver = true;
  AudioSys.crash();

  // Flash y sacudida de choque
  const flash = $('crashFlash');
  flash.classList.add('active');
  stage.classList.add('crash-shake');
  setTimeout(() => {
    flash.classList.remove('active');
    stage.classList.remove('crash-shake');
  }, 400);

  state.speed = 0;
  state.gas = false;

  // Actualizar High Score
  if (state.score > state.highScore) {
    state.highScore = Math.floor(state.score);
    localStorage.setItem('arcade_high_score', state.highScore);
  }

  const dict = I18N[state.lang];
  const translatedReason = dict[reasonKey] || reasonKey;
  $('goReason').textContent = translatedReason;
  $('goScore').textContent = Math.floor(state.score).toLocaleString();
  $('goHighScore').textContent = state.highScore.toLocaleString();
  $('goDodges').textContent = state.dodges;
  gameOverModalEl.classList.add('show');
}

function restartGame() {
  state.isGameOver = false;
  state.score = 0;
  state.dodges = 0;
  state.stoppedTimer = 0;
  state.playerX = 0.25; // carril derecho centrado
  state.steer = 0;
  state.speed = 0;
  gameOverModalEl.classList.remove('show');
  resetTraffic();
  toast(I18N[state.lang].toast_restart);
}

// Inicializar idioma por defecto
setLanguage('es');

function tickClock() {
  const d = new Date();
  $('clock').textContent = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
tickClock(); setInterval(tickClock, 10000);
radio.ui();

/* ---------------------------------------------------------
   8. Física del Auto & Dinámica de 4 Carriles
   --------------------------------------------------------- */
const roadCurve = (d) => Math.sin(d / 4800) * 0.55 + Math.sin(d / 2100 + 1.2) * 0.25;
const GEARS = [0, 22, 45, 75, 110, 150, 210];

function update(dt) {
  state.time += dt;

  // Acelerador
  const tGoal = state.gas && state.engine && !state.isGameOver ? 1 : 0;
  state.throttle += (tGoal - state.throttle) * Math.min(1, dt * (tGoal ? 5 : 8));

  // Fuerzas
  const v = state.speed;
  const drive = state.engine && !state.handbrake && !state.isGameOver && (state.gear === 'D' || state.gear === 'R');
  let a = 0;
  if (drive) {
    if (state.gear === 'D') {
      a += state.throttle * 30 * (1 - Math.max(0, v) / 215);
      if (!state.brake && state.throttle < 0.05 && v < 8) a += 3.5;
    } else {
      a -= state.throttle * 16 * (1 - Math.max(0, -v) / 35);
      if (!state.brake && state.throttle < 0.05 && v > -4) a -= 3;
    }
  }
  let res = 1.5 + Math.abs(v) * 0.035;
  if (state.brake) res += 65;
  if (state.handbrake) res += 35;
  if (state.gear === 'P') res += 90;
  if (state.offroad && Math.abs(v) > 20) res += 28;

  let nv;
  if (Math.abs(v) < 0.05) {
    nv = Math.abs(a) <= res ? 0 : v + (a - Math.sign(a) * res) * dt;
  } else {
    nv = v + (a - Math.sign(v) * res) * dt;
    if (Math.sign(nv) !== Math.sign(v) && Math.abs(a) <= res) nv = 0;
  }
  nv = clamp(nv, -35, 210);
  state.accel += ((nv - v) / dt - state.accel) * Math.min(1, dt * 5);
  state.speed = nv;

  // RPM
  let target = 0;
  if (state.engine) {
    if (drive && state.gear === 'D') {
      const s = Math.max(0, nv);
      let g = 1;
      while (g < 6 && s > GEARS[g]) g++;
      state.autoGear = g;
      const f = (s - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1]);
      target = g === 1 ? 950 + f * 4200 + state.throttle * 1200 : 1600 + f * 4300 + state.throttle * 600;
    } else if (drive && state.gear === 'R') {
      target = 950 + Math.abs(nv) / 32 * 4000 + state.throttle * 800;
    } else {
      target = 800 + state.throttle * 5600;
    }
  }
  state.rpm += (target - state.rpm) * Math.min(1, dt * 6);
  AudioSys.engineUpdate(state.rpm, state.throttle);

  // Volante (respuesta ágil)
  if (state.steerHold) {
    state.steer = clamp(state.steer + state.steerHold * 400 * dt, -180, 180);
  } else if (!state.steerDrag) {
    state.steer *= Math.exp(-dt * 4.5);
    if (Math.abs(state.steer) < 0.2) state.steer = 0;
  }

  // Desplazamiento lateral rápido entre carriles (-1.0 a +1.0)
  const sN = state.steer / 180;
  const vN = nv / 100;
  const curv = roadCurve(state.dist + 400);

  // Dirección ágil con factor de 2.8 para esquives rápidos
  state.playerX += (sN * 2.8 * Math.max(0.25, vN) - curv * 0.45 * Math.abs(vN)) * dt;
  state.playerX = clamp(state.playerX, -1.35, 1.35);

  const wasOff = state.offroad;
  state.offroad = Math.abs(state.playerX) > 1.05;
  if (state.offroad && !wasOff && Math.abs(nv) > 10) {
    toast('🌿 ¡Fuera de la carretera! Vuelve al asfalto');
  }

  state.bg += (curv * 0.7 + sN * 0.6) * vN * dt * 260;
  state.dist += (nv / 3.6) * dt * 42;
  state.odo += Math.abs(nv) / 3600 * dt;

  // Condición de parada prolongada en marcha (Game Over)
  if (state.gameActive && !state.isGameOver && state.gear === 'D' && !state.handbrake && state.engine) {
    if (Math.abs(nv) < 2) {
      state.stoppedTimer += dt;
      if (state.stoppedTimer > 5.0) {
        triggerGameOver('go_reason_stopped');
      }
    } else {
      state.stoppedTimer = 0;
    }
  }

  // Puntuación continua según velocidad
  if (state.gameActive && !state.isGameOver && nv > 10) {
    state.score += (nv / 100) * 18 * dt * 10;
    if (state.score > state.highScore) {
      state.highScore = Math.floor(state.score);
    }
  }

  // Generar y actualizar tráfico de 4 carriles
  if (state.dist > nextSpawnDist) {
    spawnTrafficCar();
    nextSpawnDist = state.dist + 220 + Math.random() * 260;
  }

  updateTraffic(dt, nv);

  // Intermitentes
  if (state.hazard || state.turn !== 'none') {
    state.blinkT += dt;
    if (state.blinkT >= 0.38) {
      state.blinkT = 0;
      state.blinkOn = !state.blinkOn;
      AudioSys.tick(state.blinkOn);
    }
  } else state.blinkOn = false;

  // Barrido de agujas al encender
  if (state.sweep >= 0) {
    state.sweep += dt / 1.4;
    if (state.sweep >= 1) state.sweep = -1;
  }
}

/* ---------------------------------------------------------
   9. Lógica del Tráfico & Detección de Colisiones / Near-Miss
   --------------------------------------------------------- */
function updateTraffic(dt, playerSpeed) {
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];

    // Movimiento del auto respecto a la distancia de nuestro coche
    const relativeSpeed = car.isIncoming ? (playerSpeed + car.speed) : (playerSpeed - car.speed);
    car.z -= (relativeSpeed / 3.6) * dt * 42;

    // Detectar Colisión
    // Zona de peligro en Z: cuando el auto está a nivel frontal de nuestro capó (z entre 0 y 65)
    if (!state.isGameOver && car.z > -10 && car.z < 75) {
      const lateralDist = Math.abs(state.playerX - car.laneX);

      // Colisión directa
      if (lateralDist < 0.28) {
        triggerGameOver(car.isIncoming ? 'go_reason_crash_front' : 'go_reason_crash_rear');
      }
      // Rebase al filo (Near Miss)
      else if (lateralDist < 0.44 && !car.nearMissed && playerSpeed > 40) {
        car.nearMissed = true;
        state.score += 250;
        state.dodges++;
        showNearMiss();
      }
    }

    // El auto nos rebasó por detrás y ya no es visible
    if (car.z < -200) {
      if (!car.passed && !car.nearMissed && playerSpeed > 20) {
        state.dodges++;
        state.score += 50;
      }
      traffic.splice(i, 1);
    }
  }
}

/* ---------------------------------------------------------
   10. Render del Exterior y Tráfico Vectorial (Canvas 3D)
   --------------------------------------------------------- */
const cv = $('scene');
const ctx = cv.getContext('2d');
const W = 1600, H = 1000, HZ0 = 290, D = 110;

const mFar = [], mNear = [];
for (let x = 0; x <= 1600; x += 8) {
  const t = (x / 1600) * Math.PI * 2;
  mFar.push(78 + 34 * Math.sin(t * 3) + 20 * Math.sin(t * 7 + 1) + 9 * Math.sin(t * 13 + 2));
  mNear.push(34 + 16 * Math.sin(t * 5 + 0.5) + 10 * Math.sin(t * 11 + 2.2) + 5 * Math.sin(t * 19));
}
const clouds = Array.from({ length: 8 }, (_, i) => ({
  x: Math.random() * 2000, y: 50 + Math.random() * 170, s: 0.6 + Math.random() * 0.8, v: 4 + Math.random() * 10,
}));

function drawMountains(arr, hz, off, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const o = ((off % 1600) + 1600) % 1600;
  ctx.moveTo(-1600 - o, hz + 2);
  for (let rep = -1; rep < 2; rep++) {
    for (let i = 0; i < arr.length; i++) ctx.lineTo(rep * 1600 + i * 8 - o, hz - arr[i]);
  }
  ctx.lineTo(W + 400, hz + 2);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.ellipse(x, y, 60 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 38 * s, y + 4 * s, 34 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 40 * s, y + 3 * s, 38 * s, 17 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 6 * s, y - 16 * s, 34 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Dibujar vehículo de tráfico con perspectiva y luces
function drawTrafficVehicle(car, HZ, curv) {
  if (car.z <= 12) return; // Fuera del parabrisas
  const p = D / car.z;
  const y = HZ + p * (H - HZ);
  if (y > 660 || y < HZ) return;

  const half = 1450 * p; // ancho de autopista de 4 carriles
  // Centro horizontal alineado con la carretera y carril
  const cx = W / 2 + curv * (1 - p) * (1 - p) * 420 - state.playerX * half;
  const carX = cx + car.laneX * half;
  const carW = p * (car.isTruck ? 520 : 420);
  const carH = p * (car.isTruck ? 420 : 250);

  ctx.save();
  ctx.translate(carX, y);

  // Sombra proyectada en el asfalto
  ctx.fillStyle = 'rgba(10, 10, 15, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 0, carW * 0.55, carH * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Carrocería del auto
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-carW / 2, -carH, carW, carH * 0.85, [carW * 0.12, carW * 0.12, 4, 4]);
  ctx.fill();

  // Techo / Cabina
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(-carW * 0.38, -carH * 0.95, carW * 0.76, carH * 0.42, [carW * 0.1, carW * 0.1, 0, 0]);
  ctx.fill();

  // Cristal de parabrisas / luna trasera
  ctx.fillStyle = '#1c2833';
  ctx.fillRect(-carW * 0.32, -carH * 0.85, carW * 0.64, carH * 0.28);

  // Parachoques / Detalles
  ctx.fillStyle = '#1e1e24';
  ctx.fillRect(-carW * 0.48, -carH * 0.18, carW * 0.96, carH * 0.16);

  // Luces
  if (car.isIncoming) {
    // Luces delanteras blancas brillantes (viene de frente)
    ctx.fillStyle = '#fffdf0';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.fillRect(-carW * 0.44, -carH * 0.35, carW * 0.22, carH * 0.14);
    ctx.fillRect(carW * 0.22, -carH * 0.35, carW * 0.22, carH * 0.14);
  } else {
    // Luces traseras rojas (va en nuestro sentido)
    ctx.fillStyle = '#ff2020';
    ctx.shadowColor = '#ff2020';
    ctx.shadowBlur = 8;
    ctx.fillRect(-carW * 0.45, -carH * 0.4, carW * 0.22, carH * 0.14);
    ctx.fillRect(carW * 0.23, -carH * 0.4, carW * 0.22, carH * 0.14);

    // Matrícula
    ctx.fillStyle = '#e8e8e8';
    ctx.shadowBlur = 0;
    ctx.fillRect(-carW * 0.15, -carH * 0.28, carW * 0.3, carH * 0.1);
  }

  ctx.restore();
}

function render() {
  const speedAbs = Math.abs(state.speed);
  const pitch = clamp(state.accel * 0.25, -14, 14);
  const HZ = HZ0 + pitch;
  const curv = roadCurve(state.dist + 400);
  const roll = -(state.steer / 180) * clamp(state.speed / 200, -0.3, 1) * 0.035;

  let sx = 0, sy = 0;
  if (speedAbs > 120) {
    const k = (speedAbs - 120) / 90;
    sx = (Math.random() - 0.5) * k * 2.5;
    sy = (Math.random() - 0.5) * k * 2.5;
  }
  if (state.offroad && speedAbs > 5) {
    sx += (Math.random() - 0.5) * 6;
    sy += (Math.random() - 0.5) * 6;
  }

  ctx.save();
  ctx.translate(W / 2 + sx, H * 0.45 + sy);
  ctx.rotate(roll);
  ctx.translate(-W / 2, -H * 0.45);

  // Cielo
  const sky = ctx.createLinearGradient(0, -100, 0, HZ);
  sky.addColorStop(0, '#2f8fe0');
  sky.addColorStop(0.6, '#79c0f0');
  sky.addColorStop(1, '#d8eefa');
  ctx.fillStyle = sky;
  ctx.fillRect(-200, -200, W + 400, HZ + 202);

  // Sol
  const sunX = 1190 - ((state.bg * 0.06) % 400), sunY = 115;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 170);
  glow.addColorStop(0, 'rgba(255,250,215,1)');
  glow.addColorStop(0.2, 'rgba(255,240,180,0.55)');
  glow.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = glow; ctx.fillRect(sunX - 180, sunY - 180, 360, 360);
  ctx.fillStyle = '#fffbe6';
  ctx.beginPath(); ctx.arc(sunX, sunY, 36, 0, Math.PI * 2); ctx.fill();

  // Nubes
  for (const c of clouds) {
    const x = ((c.x + state.time * c.v - state.bg * 0.15) % 2000 + 2000) % 2000 - 200;
    drawCloud(x, c.y + pitch * 0.3, c.s);
  }

  // Montañas
  drawMountains(mFar, HZ, state.bg * 0.25, '#9db9cf');
  drawMountains(mNear, HZ, state.bg * 0.5, '#6f9f6a');

  // Pasto base
  ctx.fillStyle = '#6cae4a';
  ctx.fillRect(-200, HZ, W + 400, H - HZ + 200);

  // ==========================================
  // CARRETERA DE 4 CARRILES (2 y 2)
  // ==========================================
  const BOTTOM = 660;
  for (let y = Math.floor(HZ) + 1; y < BOTTOM; y += 2) {
    const p = (y - HZ) / (H - HZ);
    const z = D / p;
    // Autopista más ancha para 4 carriles cómodos (1450 * p)
    const half = 1450 * p;
    // Centrado de carretera
    const cx = W / 2 + curv * (1 - p) * (1 - p) * 420 - state.playerX * half;
    const seg = Math.floor((z + state.dist) / 60) & 1;
    const rumble = half * 0.08;

    // Pasto exterior
    ctx.fillStyle = seg ? '#74b64f' : '#68a944';
    ctx.fillRect(-200, y, W + 400, 2);

    // Bordillo / Arcén rojo y blanco
    ctx.fillStyle = seg ? '#d8352a' : '#f2f2f2';
    ctx.fillRect(cx - half - rumble, y, (half + rumble) * 2, 2);

    // Asfalto principal
    ctx.fillStyle = seg ? '#5f5f65' : '#57575d';
    ctx.fillRect(cx - half, y, half * 2, 2);

    // Líneas laterales exteriores (blancas continuas)
    ctx.fillStyle = '#f4f4f4';
    const edgeW = half * 0.016;
    ctx.fillRect(cx - half * 0.96 - edgeW, y, edgeW * 2, 2);
    ctx.fillRect(cx + half * 0.96 - edgeW, y, edgeW * 2, 2);

    // 1. Línea Central Doble Amarilla (separa los 2 sentidos: izquierda y derecha)
    const midW = half * 0.014;
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(cx - midW * 2.2, y, midW * 1.5, 2);
    ctx.fillRect(cx + midW * 0.7, y, midW * 1.5, 2);

    // 2. Líneas divisoras de carril discontinuas (blancas)
    // Carril izquierdo (-0.5) y carril derecho (+0.5)
    if (seg) {
      const dashW = half * 0.012;
      ctx.fillStyle = '#ffffff';
      // Divisoria entre carriles de sentido contrario
      ctx.fillRect(cx - half * 0.5 - dashW, y, dashW * 2, 2);
      // Divisoria entre carriles de nuestro sentido
      ctx.fillRect(cx + half * 0.5 - dashW, y, dashW * 2, 2);
    }
  }

  // Bruma del horizonte
  const haze = ctx.createLinearGradient(0, HZ - 30, 0, HZ + 40);
  haze.addColorStop(0, 'rgba(220,238,250,0)');
  haze.addColorStop(0.45, 'rgba(220,238,250,0.55)');
  haze.addColorStop(1, 'rgba(220,238,250,0)');
  ctx.fillStyle = haze; ctx.fillRect(-200, HZ - 30, W + 400, 70);

  // Dibujar Tráfico de Vehículos (ordenados por distancia Z descendente)
  const sortedTraffic = [...traffic].sort((a, b) => b.z - a.z);
  for (const car of sortedTraffic) {
    drawTrafficVehicle(car, HZ, curv);
  }

  ctx.restore();
}

/* ---------------------------------------------------------
   11. Actualización de Interfaz y Tablero
   --------------------------------------------------------- */
const cache = {};
function setText(id, txt) { if (cache[id] !== txt) { cache[id] = txt; $(id).textContent = txt; } }
function setClass(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }

const elIndL = $('indL'), elIndR = $('indR'), elExtL = $('extBlinkL'), elExtR = $('extBlinkR');
const elTurnL = $('btnTurnL'), elTurnR = $('btnTurnR'), elHaz = $('btnHazard');

function updateUI() {
  // Agujas
  let rpmK = state.rpm / 1000, spd = Math.abs(state.speed);
  if (state.sweep >= 0) {
    const s = Math.sin(state.sweep * Math.PI);
    rpmK = Math.max(rpmK, s * 8);
    spd = Math.max(spd, s * 240);
  }
  tachNeedle.setAttribute('transform', `rotate(${(-135 + clamp(rpmK / 8, 0, 1) * 270).toFixed(2)})`);
  speedNeedle.setAttribute('transform', `rotate(${(-135 + clamp(spd / 240, 0, 1) * 270).toFixed(2)})`);
  setText('rpmTxt', (state.rpm / 1000).toFixed(1));
  setText('spdTxt', String(Math.round(Math.abs(state.speed))));
  setText('gearTxt', state.gear === 'D' && state.engine ? 'D' + state.autoGear : state.gear);
  setText('odoTxt', state.odo.toFixed(1).padStart(7, '0'));

  // Volante
  wheel.style.transform = `rotate(${state.steer.toFixed(2)}deg)`;

  // HUD Arcade
  setText('hudScore', String(Math.floor(state.score)).padStart(5, '0'));
  setText('hudHighScore', String(Math.floor(state.highScore)).padStart(5, '0'));
  setText('hudDodges', String(state.dodges));

  // Intermitentes
  const L = state.blinkOn && (state.hazard || state.turn === 'left');
  const R = state.blinkOn && (state.hazard || state.turn === 'right');
  setClass(elIndL, 'on', L); setClass(elIndR, 'on', R);
  setClass(elExtL, 'on', L); setClass(elExtR, 'on', R);
  setClass(elTurnL, 'blink', L); setClass(elTurnR, 'blink', R);
  setClass(elHaz, 'blink', state.hazard && state.blinkOn);

  // Vibración
  setClass(stage, 'shake', state.offroad && Math.abs(state.speed) > 5);

  // Espejo retrovisor
  $('mirrorRoad').style.setProperty('--mpos', `${(-state.dist * 0.4) % 14}px`);

  // Visualizador
  if (radio.playing && AudioSys.analyser) {
    AudioSys.analyser.getByteFrequencyData(freqData);
    for (let i = 0; i < vizBars.length; i++) {
      const v = freqData[1 + Math.floor(i * 0.9)] / 255;
      vizBars[i].style.height = (3 + v * 23).toFixed(1) + 'px';
    }
  } else if (cache.vizIdle !== true) {
    vizBars.forEach((b) => (b.style.height = '3px'));
  }
  cache.vizIdle = !radio.playing;
}

/* ---------------------------------------------------------
   12. Bucle Principal
   --------------------------------------------------------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  updateUI();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
