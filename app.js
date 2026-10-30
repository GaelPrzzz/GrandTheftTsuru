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

  // Dirección y posición en carril
  steer: 0,             // grados del volante (-180..180)
  steerDrag: false,
  steerHold: 0,         // -1 | 0 | 1 (A / D o botones)
  playerX: 0.25,        // Inicia en el carril derecho interior
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
      { icon: "🏎️", title: "Acelerar y Frenar", desc: "Usa <span class='tut-keys'>W</span> o <span class='tut-keys'>↑</span> para acelerar. Usa <span class='tut-keys'>S</span>, <span class='tut-keys'>↓</span> o <span class='tut-keys'>ESPACIO</span> para frenar con fuerza." },
      { icon: "🕹️", title: "Palanca de Cambios Real", desc: "Puedes arrastrar la palanca de cambios directamente con el ratón de <span class='tut-keys'>P</span> a <span class='tut-keys'>D</span> o usar <span class='tut-keys'>F</span> (Drive) y <span class='tut-keys'>R</span> (Reversa)." },
      { icon: "🔄", title: "Dirección y Volante", desc: "Usa <span class='tut-keys'>A</span> / <span class='tut-keys'>D</span> o <span class='tut-keys'>←</span> / <span class='tut-keys'>→</span> para cambiar de carril ágilmente. También puedes sujetar y girar el volante con el ratón." },
      { icon: "🎮", title: "Atajos del Salpicadero", desc: "<span class='tut-keys'>H</span> Bocina · <span class='tut-keys'>L</span> Luces · <span class='tut-keys'>Q</span>/<span class='tut-keys'>E</span> Direccionales · <span class='tut-keys'>X</span> Hazard · <span class='tut-keys'>P</span> Freno de Mano · <span class='tut-keys'>C</span> Limpiaparabrisas · <span class='tut-keys'>M</span> Música." },
      { icon: "🛣️", title: "4 Carriles de Autopista", desc: "Los 2 carriles derechos van en tu dirección (tráfico más lento). Los 2 carriles izquierdos vienen en sentido contrario (¡altísima velocidad frontal!)." },
      { icon: "⚡", title: "Near Miss (+250 PTS)", desc: "Pasa rozando a otros vehículos a más de 40 km/h sin chocar para ganar bonificaciones épicas de puntuación." }
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
      { icon: "🕹️", title: "Realistic Gear Shifter", desc: "You can drag the gear knob directly with your mouse from <span class='tut-keys'>P</span> to <span class='tut-keys'>D</span>, or press <span class='tut-keys'>F</span> (Drive) and <span class='tut-keys'>R</span> (Reverse)." },
      { icon: "🔄", title: "Steering Wheel", desc: "Use <span class='tut-keys'>A</span> / <span class='tut-keys'>D</span> or <span class='tut-keys'>←</span> / <span class='tut-keys'>→</span> for rapid lane changes, or grab and drag the steering wheel with your mouse." },
      { icon: "🎮", title: "Dashboard Shortcuts", desc: "<span class='tut-keys'>H</span> Horn · <span class='tut-keys'>L</span> Lights · <span class='tut-keys'>Q</span>/<span class='tut-keys'>E</span> Blinkers · <span class='tut-keys'>X</span> Hazards · <span class='tut-keys'>P</span> E-Brake · <span class='tut-keys'>C</span> Wipers · <span class='tut-keys'>M</span> Radio." },
      { icon: "🛣️", title: "4 Highway Lanes", desc: "The 2 right lanes move forward with your traffic. The 2 left lanes feature oncoming traffic at extreme relative velocity." },
      { icon: "⚡", title: "Near Miss (+250 PTS)", desc: "Graze by vehicles at speeds over 40 km/h without crashing to rack up combo bonus points." }
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
    inOurPath: false, // Se activa si el auto estuvo en nuestra trayectoria directa
    dodged: false,    // Evita contar doble esquive
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
   4. Radio con Canciones MP3 de la Carpeta musica/
   --------------------------------------------------------- */
const TRACKS = [
  { name: 'Chalino Sanchez', song: 'Alma Enamorada', file: 'Alma Enamorada - Chalino Sanchez.mp3' },
  { name: 'Los tucanes de Tijuana', song: 'El centenario', file: 'El centenario - Los tucanes de Tijuana.mp3' },
  { name: 'Junior H x Peso Pluma', song: 'El Tsurito', file: 'El Tsurito - Junior H x Peso Pluma x Gabito Ballesteros.mp3' },
  { name: 'Victor Cibrian', song: 'En El Radio Un Cochinero', file: 'En El Radio Un Cochinero - Victor Cibrian.mp3' },
  { name: 'Peso Pluma', song: 'Gavilán II', file: 'Gavilán II - Peso Pluma.mp3' },
  { name: 'Los Tigres del Norte', song: 'Jefe de Jefes', file: 'jefe de jefes - los tigres del norte.mp3' },
  { name: 'Los Tigres del Norte', song: 'La Granja', file: 'La Granja - Los Tigres del Norte.mp3' },
  { name: 'Peso Pluma', song: 'La People', file: 'La People-PesoPluma.mp3' },
  { name: 'Bad Bunny', song: 'Neverita', file: 'neverita - bad bunny.mp3' },
];

const radio = {
  playing: false,
  idx: 0,
  vol: 75,
  audioEl: null,

  initAudio() {
    if (this.audioEl) return;
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';

    this.audioEl.addEventListener('ended', () => {
      this.change(1);
    });

    this.audioEl.addEventListener('play', () => {
      this.playing = true;
      this.ui();
    });

    this.audioEl.addEventListener('pause', () => {
      this.playing = false;
      this.ui();
    });

    this.audioEl.addEventListener('error', (e) => {
      console.error('Error al reproducir audio:', this.audioEl.src, this.audioEl.error);
    });
  },

  loadTrack(autoPlay = true) {
    this.initAudio();
    const track = TRACKS[this.idx];
    const encodedFile = encodeURIComponent(track.file);
    this.audioEl.src = 'musica/' + encodedFile;
    this.applyVolume();

    if (autoPlay) {
      this.audioEl.play().then(() => {
        this.playing = true;
        this.ui();
      }).catch((err) => {
        console.warn('Autoplay bloqueado o pendiente de interacción:', err);
        this.ui();
      });
    } else {
      this.ui();
    }
  },

  toggle() {
    AudioSys.init();
    this.initAudio();
    if (this.playing && !this.audioEl.paused) {
      this.pause();
    } else {
      this.play();
    }
  },

  play() {
    AudioSys.init();
    this.initAudio();

    const currentSrc = this.audioEl.getAttribute('src');
    if (!currentSrc) {
      this.loadTrack(true);
      return;
    }

    this.applyVolume();
    this.audioEl.play().then(() => {
      this.playing = true;
      this.ui();
    }).catch((err) => {
      console.warn('Error al reproducir, recargando pista:', err);
      this.loadTrack(true);
    });
  },

  pause() {
    this.playing = false;
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.ui();
  },

  change(d) {
    AudioSys.init();
    this.idx = (this.idx + d + TRACKS.length) % TRACKS.length;
    if (this.playing) {
      this.static();
    }
    const lcd = $('lcd');
    if (lcd) {
      lcd.classList.remove('tuning');
      void lcd.offsetWidth;
      lcd.classList.add('tuning');
    }
    this.loadTrack(this.playing);
  },

  setVol(d) {
    this.vol = clamp(this.vol + d, 0, 100);
    this.applyVolume();
    this.ui();
  },

  applyVolume() {
    const normVol = clamp(this.vol / 100, 0, 1);
    if (this.audioEl) {
      this.audioEl.volume = normVol;
    }
  },

  static() {
    if (!AudioSys.ctx) return;
    try {
      const c = AudioSys.ctx, t = c.currentTime;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = AudioSys.noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      s.connect(f).connect(g).connect(AudioSys.master || c.destination);
      s.start(t, Math.random(), 0.22);
    } catch (_) {}
  },

  ui() {
    const track = TRACKS[this.idx];
    if (!track) return;
    const elName = $('stName');
    const elSong = $('stSong');
    const elState = $('stState');
    const btnPlay = $('btnPlay');
    const disc = $('disc');
    const volFill = $('volFill');
    const volTxt = $('volTxt');

    if (elName) elName.textContent = track.name;
    if (elSong) elSong.textContent = track.song;
    if (elState) elState.textContent = this.playing ? '▶ Reproduciendo' : '⏸ En pausa';
    if (btnPlay) {
      btnPlay.textContent = this.playing ? '❚❚' : '▶';
      btnPlay.classList.toggle('on', this.playing);
    }
    if (disc) disc.classList.toggle('spin', this.playing);
    if (volFill) volFill.style.width = this.vol + '%';
    if (volTxt) volTxt.textContent = this.vol;
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

// Teclado interactivo y ágil
window.addEventListener('keydown', (e) => {
  if (state.isGameOver) return;
  // Acelerador y Freno
  if (['ArrowUp', 'KeyW'].includes(e.code)) state.gas = true;
  if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) state.brake = true;
  // Dirección
  if (['ArrowLeft', 'KeyA'].includes(e.code)) state.steerHold = -1;
  if (['ArrowRight', 'KeyD'].includes(e.code)) state.steerHold = 1;

  // Bocina (H)
  if (e.code === 'KeyH' && !e.repeat) {
    AudioSys.hornStart();
    $('hub').classList.add('pressed');
  }

  // Luces (L)
  if (e.code === 'KeyL' && !e.repeat) {
    $('btnLights').click();
  }

  // Direccionales (Q = izquierda, E = derecha)
  if (e.code === 'KeyQ' && !e.repeat) {
    $('btnTurnL').click();
  }
  if (e.code === 'KeyE' && !e.repeat) {
    $('btnTurnR').click();
  }

  // Luces de emergencia / Hazard (X)
  if (e.code === 'KeyX' && !e.repeat) {
    $('btnHazard').click();
  }

  // Freno de mano (P)
  if (e.code === 'KeyP' && !e.repeat) {
    $('btnHandbrake').click();
  }

  // Limpiaparabrisas (C)
  if (e.code === 'KeyC' && !e.repeat) {
    $('btnWiper').click();
  }

  // Marcha R (Reversa) o D (Drive / Avance)
  if (e.code === 'KeyR' && !e.repeat) {
    setGear('R');
  }
  if (e.code === 'KeyF' && !e.repeat) {
    setGear('D');
  }

  // Radio / Música (M)
  if (e.code === 'KeyM' && !e.repeat) {
    $('btnPlay').click();
  }
});

window.addEventListener('keyup', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) state.gas = false;
  if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) state.brake = false;
  if (['ArrowLeft', 'KeyA'].includes(e.code) && state.steerHold === -1) state.steerHold = 0;
  if (['ArrowRight', 'KeyD'].includes(e.code) && state.steerHold === 1) state.steerHold = 0;

  // Soltar bocina (H)
  if (e.code === 'KeyH') {
    AudioSys.hornStop();
    $('hub').classList.remove('pressed');
  }
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

// Selector de marchas (Botones y Arrastre realista con el Mouse)
const KNOB_TOP = { P: -5, R: 25, N: 55, D: 85 };
const GEAR_NAMES = { P: 'Parking', R: 'Reversa', N: 'Neutral', D: 'Drive' };
const GEAR_ORDER = ['P', 'R', 'N', 'D'];

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

// Interacción directa arrastrando la palanca de cambios con el mouse
const knobEl = $('knob');
let knobDragging = false;
let knobStartY = 0;
let knobInitialTop = 0;

knobEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  knobDragging = true;
  knobEl.classList.add('dragging');
  knobStartY = e.clientY;
  knobInitialTop = KNOB_TOP[state.gear];
  try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}
});

window.addEventListener('pointermove', (e) => {
  if (!knobDragging) return;
  const deltaY = e.clientY - knobStartY;
  // Posición visual arrastrada
  const currentTop = clamp(knobInitialTop + deltaY, -10, 92);
  knobEl.style.top = currentTop + 'px';

  // Determinar la marcha más cercana según la posición Y
  let closestGear = 'P';
  let minDist = 999;
  for (const g of GEAR_ORDER) {
    const dist = Math.abs(currentTop - KNOB_TOP[g]);
    if (dist < minDist) {
      minDist = dist;
      closestGear = g;
    }
  }

  // Previsualizar la letra en la palanca mientras se arrastra
  if (knobEl.textContent !== closestGear) {
    knobEl.textContent = closestGear;
    AudioSys.click();
  }
});

const endKnobDrag = () => {
  if (!knobDragging) return;
  knobDragging = false;
  knobEl.classList.remove('dragging');

  // Ajustar a la marcha definitiva
  let closestGear = 'P';
  let minDist = 999;
  const currentTop = parseFloat(knobEl.style.top) || KNOB_TOP[state.gear];
  for (const g of GEAR_ORDER) {
    const dist = Math.abs(currentTop - KNOB_TOP[g]);
    if (dist < minDist) {
      minDist = dist;
      closestGear = g;
    }
  }
  setGear(closestGear);
  knobEl.style.top = KNOB_TOP[state.gear] + 'px';
  knobEl.textContent = state.gear;
};

['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => window.addEventListener(ev, endKnobDrag));

// =========================================================
// GESTIÓN DE MENÚ PRINCIPAL, MODALES E IDIOMA
// =========================================================
const mainMenuEl = $('mainMenu');
const tutorialModalEl = $('tutorialModal');
const creditsModalEl = $('creditsModal');
const gameOverModalEl = $('gameOverModal');

// Iniciar Juego desde el Menú Principal
// Restablece completamente el vehículo al estado inicial de fábrica (apagado, Parking, freno de mano)
function resetVehicleState() {
  state.engine = false;
  state.starting = false;
  state.handbrake = true;
  state.speed = 0;
  state.accel = 0;
  state.rpm = 0;
  state.throttle = 0;
  state.gas = false;
  state.brake = false;
  state.steer = 0;
  state.steerHold = 0;
  state.playerX = 0.25; // Carril derecho
  state.dist = 0;
  state.offroad = false;
  state.stoppedTimer = 0;
  state.isGameOver = false;

  // Botón Engine Start apagado
  const btnStart = $('btnStart');
  if (btnStart) {
    btnStart.classList.remove('on', 'starting');
  }

  // Tablero apagado
  const cluster = $('cluster');
  if (cluster) {
    cluster.classList.remove('lit');
  }

  // Freno de mano Puesto (ON)
  const btnHb = $('btnHandbrake');
  if (btnHb) btnHb.classList.add('on');
  const ledHb = $('ledHandbrake');
  if (ledHb) ledHb.className = 'led red';
  const hbSub = $('hbSub');
  if (hbSub) hbSub.textContent = 'ON';
  const icoBrake = $('icoBrake');
  if (icoBrake) icoBrake.classList.add('on');

  // Palanca en Parking (P)
  setGear('P', true);

  // Detener sonido de motor si estuviera activo
  AudioSys.engineStop();

  // Resetear contadores y HUD
  state.score = 0;
  state.dodges = 0;
  const hudScore = $('hudScore');
  if (hudScore) hudScore.textContent = '00000';
  const hudDodges = $('hudDodges');
  if (hudDodges) hudDodges.textContent = '0';
  cache['hudScore'] = '00000';
  cache['hudDodges'] = '0';

  // Generar tráfico cercano y fresco
  resetTraffic();
}

// Iniciar Juego desde el Menú Principal
function startGameFromMenu() {
  AudioSys.init();
  mainMenuEl.classList.add('hide');
  tutorialModalEl.classList.remove('show');
  creditsModalEl.classList.remove('show');
  gameOverModalEl.classList.remove('show');
  state.gameActive = true;

  resetVehicleState();
  toast('🔑 Presiona ENGINE START para encender el Tsuru');
}

// Volver al Menú Principal
function returnToMainMenu() {
  mainMenuEl.classList.remove('hide');
  tutorialModalEl.classList.remove('show');
  creditsModalEl.classList.remove('show');
  gameOverModalEl.classList.remove('show');
  state.gameActive = false;

  resetVehicleState();
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
  if (flash) flash.classList.add('active');
  stage.classList.add('crash-shake');
  setTimeout(() => {
    if (flash) flash.classList.remove('active');
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
  state.gameActive = true;
  gameOverModalEl.classList.remove('show');
  resetVehicleState();
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

  // Volante (respuesta suave, ágil y autocentrado natural)
  if (state.steerHold) {
    state.steer = clamp(state.steer + state.steerHold * 320 * dt, -160, 160);
  } else if (!state.steerDrag) {
    // Retorno suave del volante al centro
    state.steer *= Math.exp(-dt * 5.5);
    if (Math.abs(state.steer) < 0.2) state.steer = 0;
  }

  // Desplazamiento lateral proporcional entre carriles
  const sN = state.steer / 160;
  const vN = nv / 100;

  // El auto responde de forma controlada a la velocidad y ángulo de giro, recto y centrado
  state.playerX += (sN * 1.5 * Math.max(0.3, vN)) * dt;
  state.playerX = clamp(state.playerX, -1.25, 1.25);

  const wasOff = state.offroad;
  state.offroad = Math.abs(state.playerX) > 1.05;
  if (state.offroad && !wasOff && Math.abs(nv) > 10) {
    toast(I18N[state.lang].toast_offroad);
  }

  state.bg += sN * 0.4 * vN * dt * 200;
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

    // 1. Detección de peligro anticipado (el auto está en nuestro mismo carril por delante)
    if (!state.isGameOver && car.z > 70 && car.z < 280) {
      if (Math.abs(state.playerX - car.laneX) < 0.26) {
        car.inOurPath = true; // Estaba en curso directo de colisión
      }
    }

    // 2. Detectar Colisión y Esquives activos a nivel de capó (z entre -10 y 75)
    if (!state.isGameOver && car.z > -10 && car.z < 75) {
      const lateralDist = Math.abs(state.playerX - car.laneX);

      // Colisión directa (tolerancia ajustada al ancho del carro dentro del carril)
      if (lateralDist < 0.22) {
        triggerGameOver(car.isIncoming ? 'go_reason_crash_front' : 'go_reason_crash_rear');
      }
      // Esquive al filo / Rebase ajustado (Near Miss)
      else if (lateralDist < 0.40 && !car.dodged && playerSpeed > 35) {
        car.dodged = true;
        car.nearMissed = true;
        state.score += 250;
        state.dodges++;
        showNearMiss();
      }
      // Esquive por cambio de carril (estaba en tu camino y te moviste a otro carril para esquivarlo)
      else if (car.inOurPath && lateralDist >= 0.35 && !car.dodged && playerSpeed > 25) {
        car.dodged = true;
        state.dodges++;
        state.score += 150;
      }
    }

    // El auto nos rebasó por detrás y ya no es visible
    if (car.z < -200) {
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

// Dibujar vehículo de tráfico con perspectiva frontal recta y proporciones exactas al carril
function drawTrafficVehicle(car, HZ, curv) {
  if (car.z <= 6) return; // Fuera del campo visual
  const p = D / car.z;
  const y = HZ + p * (H - HZ);
  if (y > 680 || y < HZ) return;

  // Autopista con escala half = 2300 * p (ancho de cada carril = 0.5 * half = 1150 * p)
  const half = 2300 * p;
  const cx = W / 2 - state.playerX * half;
  const carX = cx + car.laneX * half;

  // Proporción del auto: cabe con holgura dentro del carril (ancho de carril = 1150*p, auto = 480*p o 560*p)
  // Deja más del 50% de espacio libre en el carril para que se vea holgado y no apretado
  const carW = p * (car.isTruck ? 540 : 440);
  const carH = p * (car.isTruck ? 420 : 250);
  const depth = p * (car.isTruck ? 160 : 100);

  ctx.save();
  ctx.translate(carX, y);

  // 1. Sombra suave sobre el asfalto debajo del auto
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 2, carW * 0.56, carH * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Ruedas visibles en la base
  ctx.fillStyle = '#16161a';
  const tireW = carW * 0.16;
  const tireH = carH * 0.22;
  ctx.fillRect(-carW * 0.46, -tireH * 0.8, tireW, tireH);
  ctx.fillRect(carW * 0.46 - tireW, -tireH * 0.8, tireW, tireH);

  // 3. Perspectiva 3D lateral sutil según el ángulo relativo
  const relX = carX - W / 2;
  if (Math.abs(relX) > 60 && p > 0.08) {
    const sideDir = relX > 0 ? -1 : 1;
    const sideW = Math.min(carW * 0.28, Math.abs(relX) * 0.04 * p * 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    const sideEdgeX = sideDir < 0 ? -carW / 2 : carW / 2;
    ctx.moveTo(sideEdgeX, 0);
    ctx.lineTo(sideEdgeX + sideDir * sideW, -depth * 0.35);
    ctx.lineTo(sideEdgeX + sideDir * sideW, -carH - depth * 0.35);
    ctx.lineTo(sideEdgeX, -carH);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Carrocería principal
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-carW / 2, -carH, carW, carH * 0.88, [carW * 0.1, carW * 0.1, 4, 4]);
  ctx.fill();

  // Relieve de iluminación en la carrocería
  const bodyGrad = ctx.createLinearGradient(0, -carH, 0, 0);
  bodyGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
  bodyGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-carW / 2, -carH, carW, carH * 0.88, [carW * 0.1, carW * 0.1, 4, 4]);
  ctx.fill();

  // 5. Cabina y Cristales
  ctx.fillStyle = 'rgba(16, 24, 32, 0.95)';
  ctx.beginPath();
  ctx.roundRect(-carW * 0.38, -carH * 0.96, carW * 0.76, carH * 0.44, [carW * 0.08, carW * 0.08, 2, 2]);
  ctx.fill();

  // Brillo en el cristal
  ctx.fillStyle = 'rgba(180, 220, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(-carW * 0.32, -carH * 0.92);
  ctx.lineTo(-carW * 0.12, -carH * 0.92);
  ctx.lineTo(-carW * 0.22, -carH * 0.56);
  ctx.lineTo(-carW * 0.34, -carH * 0.56);
  ctx.closePath();
  ctx.fill();

  // 6. Moldura / Parachoques
  ctx.fillStyle = '#1c1d22';
  ctx.fillRect(-carW * 0.48, -carH * 0.2, carW * 0.96, carH * 0.18);

  // 7. Luces e iluminación activa
  if (car.isIncoming) {
    // Luces delanteras blancas brillantes (faros)
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffd0';
    ctx.shadowBlur = Math.min(24, 180 * p);
    ctx.fillRect(-carW * 0.44, -carH * 0.38, carW * 0.22, carH * 0.16);
    ctx.fillRect(carW * 0.22, -carH * 0.38, carW * 0.22, carH * 0.16);
    ctx.shadowBlur = 0;

    // Parrilla delantera
    ctx.fillStyle = '#111';
    ctx.fillRect(-carW * 0.18, -carH * 0.36, carW * 0.36, carH * 0.14);
  } else {
    // Luces traseras rojas
    ctx.fillStyle = '#ff2b2b';
    ctx.shadowColor = '#ff2020';
    ctx.shadowBlur = Math.min(20, 160 * p);
    ctx.fillRect(-carW * 0.45, -carH * 0.42, carW * 0.22, carH * 0.16);
    ctx.fillRect(carW * 0.23, -carH * 0.42, carW * 0.22, carH * 0.16);
    ctx.shadowBlur = 0;

    // Matrícula
    ctx.fillStyle = '#e5e9f0';
    ctx.fillRect(-carW * 0.15, -carH * 0.3, carW * 0.3, carH * 0.11);
  }

  ctx.restore();
}

function render() {
  const speedAbs = Math.abs(state.speed);
  // Cámara completamente fija y centrada (sin cabeceos, sin inclinaciones raras)
  const HZ = HZ0;
  const curv = 0; // Carretera recta y despejada hacia el horizonte

  // Vibración sutil sólo si va fuera de la carretera a alta velocidad
  let sx = 0, sy = 0;
  if (state.offroad && speedAbs > 15) {
    sx = (Math.random() - 0.5) * 4;
    sy = (Math.random() - 0.5) * 4;
  }

  ctx.save();
  ctx.translate(W / 2 + sx, H * 0.45 + sy);
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
    drawCloud(x, c.y, c.s);
  }

  // Montañas
  drawMountains(mFar, HZ, state.bg * 0.25, '#9db9cf');
  drawMountains(mNear, HZ, state.bg * 0.5, '#6f9f6a');

  // Pasto base
  ctx.fillStyle = '#6cae4a';
  ctx.fillRect(-200, HZ, W + 400, H - HZ + 200);

  // ==========================================
  // CARRETERA DE 4 CARRILES AMPLIOS (PERSPECTIVA FRONTAL RECTA)
  // ==========================================
  // Punto de fuga centrado recto como simulador de cabina (imagen de referencia)
  const BOTTOM = 660;

  for (let y = Math.floor(HZ) + 1; y < BOTTOM; y += 2) {
    const p = (y - HZ) / (H - HZ);
    const z = D / p;
    // Autopista espaciosa donde cada carril mide más de 550px al frente
    const half = 2300 * p;
    // Perspectiva frontal recta con curvatura sutil y suave
    const cx = W / 2 - state.playerX * half;
    const seg = Math.floor((z + state.dist) / 60) & 1;
    const rumble = half * 0.055;

    // Pasto exterior
    ctx.fillStyle = seg ? '#74b64f' : '#68a944';
    ctx.fillRect(-200, y, W + 400, 2);

    // Bordo / Arcén exterior (rojo y blanco)
    ctx.fillStyle = seg ? '#d8352a' : '#f2f2f2';
    ctx.fillRect(cx - half - rumble, y, (half + rumble) * 2, 2);

    // Asfalto principal espacioso
    ctx.fillStyle = seg ? '#585960' : '#4f5056';
    ctx.fillRect(cx - half, y, half * 2, 2);

    // Líneas laterales exteriores continuas (blancas)
    ctx.fillStyle = '#f4f4f4';
    const edgeW = Math.max(2, half * 0.012);
    ctx.fillRect(cx - half * 0.98 - edgeW, y, edgeW * 2, 2);
    ctx.fillRect(cx + half * 0.98 - edgeW, y, edgeW * 2, 2);

    // 1. Línea Central Doble Amarilla (separa los 2 sentidos: carriles izquierdos y derechos)
    const midW = Math.max(2, half * 0.010);
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(cx - midW * 2.2, y, midW * 1.5, 2);
    ctx.fillRect(cx + midW * 0.7, y, midW * 1.5, 2);

    // 2. Líneas divisoras discontinuas entre carriles del mismo sentido (blancas)
    if (seg) {
      const dashW = Math.max(2, half * 0.009);
      ctx.fillStyle = '#ffffff';
      // Divisoria entre los 2 carriles izquierdos (-0.5)
      ctx.fillRect(cx - half * 0.5 - dashW, y, dashW * 2, 2);
      // Divisoria entre los 2 carriles derechos (+0.5)
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

  // Espejos retrovisores animados (Central y Laterales)
  const mirrorShift = `${(-state.dist * 0.4) % 14}px`;
  const mCenter = $('mirrorRoad');
  const mL = $('mirrorRoadL');
  const mR = $('mirrorRoadR');
  if (mCenter) mCenter.style.setProperty('--mpos', mirrorShift);
  if (mL) mL.style.setProperty('--mpos', mirrorShift);
  if (mR) mR.style.setProperty('--mpos', mirrorShift);

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
