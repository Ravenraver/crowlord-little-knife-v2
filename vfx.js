/* ==========================================================================
   Little Knife (v2.4.6) — VFX & Web Audio Procedural Engine
   - 猜拳平局改为「极速闪帧」（quick 模式，不震屏、不排队）
   - 默认播报节奏改为标准(2.4s)，并提供慢速 / 极速切换
   Global Namespace: window.VFX
   Zero-dependency native module aligned with index.html & style.css
   ========================================================================== */
(() => {
  'use strict';

  const SPEED_PRESETS = {
    slow:   { id: 'slow',   label: '慢速(3.8s)', bannerMs: 3800, actionPauseMs: 2200 },
    normal: { id: 'normal', label: '标准(2.4s)', bannerMs: 2400, actionPauseMs: 1500 },
    fast:   { id: 'fast',   label: '极速(1.2s)', bannerMs: 1200, actionPauseMs: 850 }
  };

  const state = {
    initialized: false,
    enabled: true,
    audioMuted: false,
    mood: 'p3r',
    weather: 'clear',
    fogImmune: false,
    speed: 'normal',
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    lastTime: 0,
    rafId: 0
  };

  const dom = {
    weatherCanvas: null,
    fxCanvas: null,
    halftone: null,
    bannerLayer: null,
    bannerBox: null,
    bannerKicker: null,
    bannerText: null,
    bannerSub: null,
    toastLayer: null,
    mapViewport: null,
    mapOverlay: null,
    rpsClashOverlay: null,
    tfeedBar: null,
    tfeedBadge: null,
    tfeedMain: null,
    tfeedSub: null
  };

  let wCtx = null;
  let fCtx = null;

  const weatherPool = {
    ambient: [],
    embers: [],
    fogBands: [],
    rain: [],
    bolts: [],
    groundArcs: [],
    moonRise: 0,
    lightningFlash: 0,
    nextLightningAt: 0,
    nextGroundArcAt: 0,
    glitchTimer: 0
  };

  const fxPool = {
    slashes: [],
    sparks: [],
    arcs: [],
    ripples: [],
    edgeFlashes: [],
    shake: { power: 0, duration: 0, elapsed: 0 }
  };

  const bannerQueue = [];
  let bannerBusy = false;
  let bannerTimerA = 0;
  let bannerTimerB = 0;
  let bannerEndAt = 0;

  const nodeFloatStack = new Map();

  // ========================================================================
  // Web Audio API Procedural Synthesizer
  // ========================================================================
  const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let compressor = null;
    let noiseBuffer = null;
    let unlocked = false;

    function ensureContext() {
      if (state.audioMuted || !state.enabled) return null;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      if (!ctx) {
        ctx = new AudioCtx();
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, ctx.currentTime);
        compressor.knee.setValueAtTime(18, ctx.currentTime);
        compressor.ratio.setValueAtTime(6, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.18, ctx.currentTime);

        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.42, ctx.currentTime);

        compressor.connect(masterGain);
        masterGain.connect(ctx.destination);
        noiseBuffer = createNoiseBuffer(ctx, 2.0);
      }

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    }

    function unlock() {
      if (unlocked) return;
      const c = ensureContext();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, c.currentTime);
        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.01);
        unlocked = true;
      } catch (_) {}
    }

    function createNoiseBuffer(audioCtx, seconds) {
      const length = Math.floor(audioCtx.sampleRate * seconds);
      const buf = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    function playTone(c, {
      type = 'sine',
      freq = 440,
      freqEnd = null,
      start = 0,
      dur = 0.12,
      vol = 0.25,
      attack = 0.004,
      filterFreq = null,
      filterType = 'lowpass',
      q = 1
    }) {
      const t0 = c.currentTime + start;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
      }

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      if (filterFreq) {
        const filter = c.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, t0);
        filter.Q.setValueAtTime(q, t0);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(compressor);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    function playNoise(c, {
      start = 0,
      dur = 0.15,
      vol = 0.2,
      filterType = 'bandpass',
      freq = 1600,
      freqEnd = null,
      q = 1.2,
      attack = 0.005
    }) {
      if (!noiseBuffer) return;
      const t0 = c.currentTime + start;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer;

      const filter = c.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(freq, t0);
      if (freqEnd !== null) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
      }
      filter.Q.setValueAtTime(q, t0);

      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);
      src.start(t0, Math.random() * 0.5, dur + 0.04);
    }

    function play(name) {
      const c = ensureContext();
      if (!c) return;

      switch (name) {
        case 'click':
          playTone(c, { type: 'triangle', freq: 1180, freqEnd: 520, dur: 0.055, vol: 0.22 });
          playTone(c, { type: 'square', freq: 2240, freqEnd: 1620, dur: 0.028, vol: 0.08, filterFreq: 3200 });
          playNoise(c, { dur: 0.024, vol: 0.1, filterType: 'highpass', freq: 3600 });
          break;
        case 'hover':
          playTone(c, { type: 'sine', freq: 1480, freqEnd: 1760, dur: 0.032, vol: 0.065 });
          break;
        case 'slide':
          playNoise(c, { dur: 0.16, vol: 0.24, filterType: 'bandpass', freq: 520, freqEnd: 3400, q: 2.2 });
          playTone(c, { type: 'sawtooth', freq: 210, freqEnd: 690, dur: 0.13, vol: 0.11, filterFreq: 1600 });
          break;
        case 'rps_lock':
          playTone(c, { type: 'square', freq: 660, dur: 0.05, vol: 0.14, filterFreq: 2000 });
          playTone(c, { type: 'square', freq: 990, start: 0.055, dur: 0.07, vol: 0.16, filterFreq: 2400 });
          break;
        case 'rps_clash':
          playTone(c, { type: 'sawtooth', freq: 160, freqEnd: 46, dur: 0.24, vol: 0.34, filterFreq: 680 });
          playNoise(c, { dur: 0.18, vol: 0.32, filterType: 'bandpass', freq: 2400, freqEnd: 420, q: 1.6 });
          playTone(c, { type: 'triangle', freq: 880, freqEnd: 1320, dur: 0.11, vol: 0.18 });
          break;
        case 'rps_win':
          [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((f, idx) => {
            playTone(c, { type: 'triangle', freq: f, start: idx * 0.048, dur: 0.18, vol: 0.19 });
          });
          break;
        case 'rps_lose':
          [370, 311.13, 246.94].forEach((f, idx) => {
            playTone(c, { type: 'sawtooth', freq: f, freqEnd: f * 0.92, start: idx * 0.075, dur: 0.17, vol: 0.15, filterFreq: 1100 });
          });
          break;
        case 'knife':
          playNoise(c, { dur: 0.22, vol: 0.3, filterType: 'bandpass', freq: 1400, freqEnd: 6200, q: 4.5 });
          playTone(c, { type: 'sine', freq: 2680, freqEnd: 3120, start: 0.03, dur: 0.26, vol: 0.15 });
          playTone(c, { type: 'triangle', freq: 4120, freqEnd: 3860, start: 0.04, dur: 0.22, vol: 0.1 });
          break;
        case 'pants':
          playNoise(c, { dur: 0.17, vol: 0.32, filterType: 'bandpass', freq: 2100, freqEnd: 780, q: 2.0 });
          playTone(c, { type: 'sawtooth', freq: 520, freqEnd: 130, dur: 0.19, vol: 0.2, filterFreq: 1400 });
          playTone(c, { type: 'triangle', freq: 280, freqEnd: 95, start: 0.05, dur: 0.14, vol: 0.18 });
          break;
        case 'slash':
          playNoise(c, { dur: 0.12, vol: 0.45, filterType: 'highpass', freq: 2800 });
          playNoise(c, { start: 0.03, dur: 0.32, vol: 0.38, filterType: 'bandpass', freq: 1800, freqEnd: 240, q: 1.4 });
          playTone(c, { type: 'sawtooth', freq: 170, freqEnd: 34, dur: 0.36, vol: 0.44, filterFreq: 480 });
          playTone(c, { type: 'square', freq: 920, freqEnd: 110, dur: 0.16, vol: 0.22, filterFreq: 2200 });
          playTone(c, { type: 'sine', freq: 3150, freqEnd: 2200, start: 0.02, dur: 0.24, vol: 0.14 });
          break;
        case 'miss':
          playNoise(c, { dur: 0.16, vol: 0.24, filterType: 'bandpass', freq: 3200, freqEnd: 720, q: 3.0 });
          playTone(c, { type: 'sine', freq: 1150, freqEnd: 620, dur: 0.12, vol: 0.12 });
          break;
        case 'alarm':
        case 'siren':
          for (let i = 0; i < 2; i++) {
            const base = i * 0.34;
            playTone(c, { type: 'sawtooth', freq: 640, freqEnd: 960, start: base, dur: 0.16, vol: 0.22, filterFreq: 1800 });
            playTone(c, { type: 'sawtooth', freq: 960, freqEnd: 640, start: base + 0.16, dur: 0.17, vol: 0.22, filterFreq: 1800 });
          }
          break;
        case 'shock':
          playTone(c, { type: 'sawtooth', freq: 120, freqEnd: 90, dur: 0.34, vol: 0.22, filterFreq: 900 });
          for (let i = 0; i < 6; i++) {
            playNoise(c, { start: i * 0.052, dur: 0.04, vol: 0.32, filterType: 'bandpass', freq: 2600 + Math.random() * 2600, q: 3.2 });
            playTone(c, { type: 'square', freq: 760 + Math.random() * 1400, freqEnd: 220, start: i * 0.052, dur: 0.045, vol: 0.14, filterFreq: 3200 });
          }
          break;
        case 'blackmarket':
          [146.83, 174.61, 207.65, 277.18, 349.23].forEach((f, idx) => {
            playTone(c, { type: idx < 2 ? 'sawtooth' : 'triangle', freq: f, freqEnd: f * 0.992, start: idx * 0.035, dur: 0.72, vol: 0.13, attack: 0.04, filterFreq: 1350 });
          });
          break;
        case 'skill':
          playTone(c, { type: 'sawtooth', freq: 220, freqEnd: 440, dur: 0.28, vol: 0.22, filterFreq: 2000 });
          playTone(c, { type: 'triangle', freq: 554.37, freqEnd: 880, start: 0.06, dur: 0.28, vol: 0.2 });
          playNoise(c, { dur: 0.22, vol: 0.22, filterType: 'bandpass', freq: 900, freqEnd: 4200, q: 2.4 });
          break;
        case 'collapse':
          playTone(c, { type: 'sawtooth', freq: 95, freqEnd: 28, dur: 0.65, vol: 0.38, filterFreq: 320 });
          playNoise(c, { dur: 0.58, vol: 0.35, filterType: 'lowpass', freq: 650, freqEnd: 120 });
          break;
        case 'revive':
          [329.63, 440, 554.37, 659.25, 880].forEach((f, i) => {
            playTone(c, { type: 'sine', freq: f, start: i * 0.065, dur: 0.45, vol: 0.16, attack: 0.02 });
          });
          break;
        case 'chat':
          playTone(c, { type: 'sine', freq: 880, dur: 0.06, vol: 0.14 });
          playTone(c, { type: 'sine', freq: 1320, start: 0.065, dur: 0.08, vol: 0.14 });
          break;
        case 'emoji':
          playTone(c, { type: 'sine', freq: 420, freqEnd: 1080, dur: 0.11, vol: 0.22 });
          playTone(c, { type: 'triangle', freq: 960, freqEnd: 1460, start: 0.055, dur: 0.08, vol: 0.12 });
          break;
        case 'bell':
          [110, 221.5, 329, 468].forEach((f, i) => {
            playTone(c, { type: i === 0 ? 'triangle' : 'sine', freq: f, freqEnd: f * 0.985, dur: 1.65 - i * 0.2, vol: 0.22 / (i + 1), attack: 0.012 });
          });
          break;
        case 'thunder':
          playNoise(c, { dur: 0.14, vol: 0.38, filterType: 'highpass', freq: 1200 });
          playNoise(c, { start: 0.05, dur: 1.05, vol: 0.36, filterType: 'lowpass', freq: 380, freqEnd: 70 });
          playTone(c, { type: 'sawtooth', freq: 78, freqEnd: 26, start: 0.04, dur: 0.85, vol: 0.25, filterFreq: 180 });
          break;
        case 'win':
          [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5].forEach((f, i) => {
            const start = i < 4 ? i * 0.09 : 0.42 + (i - 4) * 0.11;
            const dur = i === 5 ? 0.65 : 0.2;
            playTone(c, { type: 'triangle', freq: f, start, dur, vol: 0.22 });
            playTone(c, { type: 'sawtooth', freq: f * 0.5, start, dur, vol: 0.09, filterFreq: 1400 });
          });
          break;
        default:
          playTone(c, { type: 'triangle', freq: 720, freqEnd: 440, dur: 0.06, vol: 0.14 });
          break;
      }
    }

    return { unlock, play };
  })();

  function injectDynamicStyles() {
    if (document.getElementById('lk-vfx-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'lk-vfx-dynamic-style';
    style.textContent = `
      .vfx-rps-overlay {
        position: fixed;
        inset: 0;
        z-index: 88;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle, rgba(230, 0, 35, 0.24), rgba(3, 6, 16, 0.78));
        opacity: 0;
        transition: opacity 0.16s ease;
      }
      .vfx-rps-overlay.is-active { opacity: 1; }
      .vfx-rps-ribbon {
        width: 112%;
        padding: 18px 24px 22px;
        background: #070a14;
        border-top: 4px solid #ffe600;
        border-bottom: 4px solid #e60023;
        transform: skewY(-3deg);
        box-shadow: 0 22px 0 rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .vfx-rps-head { display: flex; align-items: center; gap: 10px; transform: skewX(-10deg); }
      .vfx-rps-kicker { padding: 2px 10px; background: #e60023; color: #ffffff; font-family: var(--font-display); font-weight: 900; font-size: 13px; letter-spacing: 0.16em; }
      .vfx-rps-title { font-family: var(--font-display); font-weight: 900; font-style: italic; font-size: clamp(22px, 3vw, 34px); color: #ffffff; text-shadow: 3px 3px 0 #000; }
      .vfx-rps-cards { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; max-width: 92vw; }
      .vfx-rps-card {
        min-width: 112px;
        padding: 10px 14px;
        background: #0d1d3d;
        border: 3px solid #ffffff;
        color: #ffffff;
        text-align: center;
        transform: skewX(-10deg) scale(1.25);
        box-shadow: 5px 5px 0 #000;
        animation: vfx-rps-slam 0.24s cubic-bezier(0.18, 1.45, 0.36, 1) forwards;
      }
      .vfx-rps-card.is-win { background: #e60023; border-color: #ffe600; box-shadow: 6px 6px 0 #ffe600; }
      .vfx-rps-card.is-lose { opacity: 0.62; filter: grayscale(0.5); }
      .vfx-rps-card.is-draw { border-color: #00d4ff; }
      .vfx-rps-hand { font-size: 38px; line-height: 1.05; transform: skewX(10deg); }
      .vfx-rps-name { margin-top: 4px; font-family: var(--font-display); font-weight: 900; font-size: 13px; transform: skewX(10deg); }
      .vfx-rps-tag { margin-top: 3px; font-size: 11px; font-weight: 900; color: #ffe600; transform: skewX(10deg); }
      .vfx-rps-sub { font-size: 14px; font-weight: 800; color: #ffe600; letter-spacing: 0.08em; text-shadow: 2px 2px 0 #000; }
      /* 平局极速闪帧：小、快、不遮挡、不震屏 */
      .vfx-rps-overlay.is-quick {
        background: radial-gradient(circle, rgba(0, 212, 255, 0.16), rgba(3, 6, 16, 0.42));
        transition: opacity 0.08s linear;
      }
      .vfx-rps-overlay.is-quick .vfx-rps-ribbon {
        padding: 7px 14px 9px;
        gap: 5px;
        border-top-width: 3px;
        border-bottom-width: 3px;
        box-shadow: 0 10px 0 rgba(0, 0, 0, 0.7);
      }
      .vfx-rps-overlay.is-quick .vfx-rps-kicker { padding: 1px 7px; font-size: 11px; }
      .vfx-rps-overlay.is-quick .vfx-rps-title { font-size: clamp(16px, 2.1vw, 22px); text-shadow: 2px 2px 0 #000; }
      .vfx-rps-overlay.is-quick .vfx-rps-cards { gap: 6px; }
      .vfx-rps-overlay.is-quick .vfx-rps-card {
        min-width: 72px;
        padding: 4px 7px;
        border-width: 2px;
        transform: skewX(-8deg) scale(0.94);
        box-shadow: 3px 3px 0 #000;
        animation-duration: 0.14s;
      }
      .vfx-rps-overlay.is-quick .vfx-rps-hand { font-size: 22px; }
      .vfx-rps-overlay.is-quick .vfx-rps-name { font-size: 10.5px; }
      .vfx-rps-overlay.is-quick .vfx-rps-tag { font-size: 9.5px; }
      .vfx-rps-overlay.is-quick .vfx-rps-sub { font-size: 11.5px; }
      @keyframes vfx-rps-slam {
        0% { opacity: 0; transform: skewX(-18deg) scale(1.7) translateY(-18px); }
        100% { opacity: 1; transform: skewX(-10deg) scale(1) translateY(0); }
      }
      .map-viewport.weather-fog .map-node { animation: vfx-fog-glitch 2.4s infinite steps(2, end); }
      .map-viewport.weather-fog .map-node:not(.is-self-loc) .node-tokens { position: relative; }
      .map-viewport.weather-fog .map-node:not(.is-self-loc) .node-tokens::after {
        content: "???";
        position: absolute;
        inset: -2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
        font-weight: 900;
        font-size: 13px;
        letter-spacing: 0.16em;
        color: #00d4ff;
        background: rgba(6, 13, 28, 0.88);
        text-shadow: 2px 0 #e60023, -2px 0 #00d4ff;
        pointer-events: none;
      }
      @keyframes vfx-fog-glitch {
        0%, 92%, 100% { filter: none; }
        94% { filter: hue-rotate(45deg) contrast(1.4); }
        97% { filter: hue-rotate(-35deg) brightness(1.2); }
      }
      .map-float-item.float--miss {
        background: #ffe600;
        border-color: #000000;
        color: #000000;
        font-size: 18px;
        font-style: italic;
        letter-spacing: 0.08em;
        box-shadow: 4px 4px 0 #00d4ff;
      }
    `;
    document.head.appendChild(style);
  }

  function resizeCanvases() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);

    [dom.weatherCanvas, dom.fxCanvas].forEach((canvas) => {
      if (!canvas) return;
      canvas.width = Math.floor(state.width * state.dpr);
      canvas.height = Math.floor(state.height * state.dpr);
      canvas.style.width = state.width + 'px';
      canvas.style.height = state.height + 'px';
    });

    if (wCtx) wCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (fCtx) fCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function seedWeatherParticles() {
    const W = state.width;
    const H = state.height;

    weatherPool.ambient = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 4 + Math.random() * 10,
      vx: -8 - Math.random() * 14,
      vy: -12 - Math.random() * 20,
      alpha: 0.08 + Math.random() * 0.22
    }));

    weatherPool.embers = Array.from({ length: 58 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1.5 + Math.random() * 3.2,
      vy: -28 - Math.random() * 65,
      vx: (Math.random() - 0.5) * 34,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.65
    }));

    weatherPool.fogBands = Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * W,
      y: (H / 12) * i + (Math.random() - 0.5) * 60,
      w: 280 + Math.random() * 440,
      h: 70 + Math.random() * 110,
      vx: (i % 2 === 0 ? 1 : -1) * (18 + Math.random() * 32),
      alpha: 0.09 + Math.random() * 0.14
    }));

    weatherPool.rain = Array.from({ length: 130 }, () => ({
      x: Math.random() * (W + 300),
      y: Math.random() * H,
      len: 18 + Math.random() * 26,
      speed: 780 + Math.random() * 520,
      alpha: 0.2 + Math.random() * 0.42
    }));
  }

  function resolveNodeScreenPos(nodeId) {
    if (window.LK && window.LK.map3d && typeof window.LK.map3d.getNodeClientRect === 'function') {
      const rect = window.LK.map3d.getNodeClientRect(nodeId);
      if (rect && rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5, found: true };
      }
    }

    const el = document.querySelector(`[data-node-id="${CSS.escape(String(nodeId))}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5, found: true };
      }
    }

    if (dom.mapViewport) {
      const vp = dom.mapViewport.getBoundingClientRect();
      if (vp.width > 0 && vp.height > 0) {
        return { x: vp.left + vp.width * 0.5, y: vp.top + vp.height * 0.5, found: false };
      }
    }

    return { x: state.width * 0.5, y: state.height * 0.45, found: false };
  }

  function buildLightningPoints(x1, y1, x2, y2, displace, depth) {
    let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    let d = displace;
    for (let step = 0; step < depth; step++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const mx = (a.x + b.x) * 0.5 + (Math.random() - 0.5) * d;
        const my = (a.y + b.y) * 0.5 + (Math.random() - 0.5) * d;
        next.push({ x: mx, y: my }, b);
      }
      pts = next;
      d *= 0.54;
    }
    return pts;
  }

  function drawPolyline(ctx, pts, strokeStyle, lineWidth) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderWeather(dt, now) {
    if (!wCtx) return;
    const W = state.width;
    const H = state.height;
    wCtx.clearRect(0, 0, W, H);
    if (!state.enabled) return;

    if (state.weather === 'clear') {
      wCtx.save();
      const tint = state.mood === 'p5r' ? '230, 0, 35' : '0, 212, 255';
      for (const p of weatherPool.ambient) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -30) p.x = W + 20;
        if (p.y < -30) p.y = H + 20;
        wCtx.save();
        wCtx.translate(p.x, p.y);
        wCtx.rotate(-0.4);
        wCtx.strokeStyle = `rgba(${tint}, ${p.alpha})`;
        wCtx.lineWidth = 1.4;
        wCtx.strokeRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
        wCtx.restore();
      }
      wCtx.restore();
      return;
    }

    if (state.weather === 'bloodmoon') {
      weatherPool.moonRise = Math.min(1, weatherPool.moonRise + dt * 0.45);
      const easeRise = 1 - Math.pow(1 - weatherPool.moonRise, 3);
      const moonR = Math.min(W, H) * 0.17;
      const moonX = W * 0.78;
      const moonY = H * (0.48 - 0.25 * easeRise);

      const skyGrad = wCtx.createRadialGradient(moonX, moonY, moonR * 0.2, moonX, moonY, Math.max(W, H) * 0.85);
      skyGrad.addColorStop(0, 'rgba(255, 24, 60, 0.34)');
      skyGrad.addColorStop(0.35, 'rgba(155, 0, 26, 0.22)');
      skyGrad.addColorStop(1, 'rgba(10, 0, 4, 0.45)');
      wCtx.fillStyle = skyGrad;
      wCtx.fillRect(0, 0, W, H);

      const pulse = 1 + Math.sin(now * 0.0024) * 0.045;
      wCtx.save();
      const corona = wCtx.createRadialGradient(moonX, moonY, moonR * 0.78, moonX, moonY, moonR * 1.95 * pulse);
      corona.addColorStop(0, 'rgba(255, 30, 66, 0.65)');
      corona.addColorStop(0.45, 'rgba(230, 0, 35, 0.22)');
      corona.addColorStop(1, 'rgba(230, 0, 35, 0)');
      wCtx.fillStyle = corona;
      wCtx.beginPath();
      wCtx.arc(moonX, moonY, moonR * 1.95 * pulse, 0, Math.PI * 2);
      wCtx.fill();

      const bodyGrad = wCtx.createRadialGradient(moonX - moonR * 0.28, moonY - moonR * 0.24, moonR * 0.1, moonX, moonY, moonR);
      bodyGrad.addColorStop(0, '#ff5972');
      bodyGrad.addColorStop(0.55, '#c80021');
      bodyGrad.addColorStop(1, '#4b000d');
      wCtx.fillStyle = bodyGrad;
      wCtx.beginPath();
      wCtx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      wCtx.fill();

      wCtx.fillStyle = 'rgba(42, 0, 8, 0.32)';
      wCtx.beginPath();
      wCtx.arc(moonX - moonR * 0.22, moonY - moonR * 0.1, moonR * 0.26, 0, Math.PI * 2);
      wCtx.arc(moonX + moonR * 0.26, moonY + moonR * 0.2, moonR * 0.19, 0, Math.PI * 2);
      wCtx.arc(moonX + moonR * 0.06, moonY - moonR * 0.32, moonR * 0.14, 0, Math.PI * 2);
      wCtx.fill();
      wCtx.restore();

      for (const e of weatherPool.embers) {
        e.y += e.vy * dt;
        e.x += (e.vx + Math.sin(now * 0.003 + e.phase) * 20) * dt;
        if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
        wCtx.fillStyle = `rgba(255, 70, 96, ${e.alpha})`;
        wCtx.fillRect(e.x, e.y, e.r, e.r * 2.1);
      }
      return;
    }

    if (state.weather === 'fog') {
      wCtx.fillStyle = 'rgba(15, 23, 42, 0.32)';
      wCtx.fillRect(0, 0, W, H);

      for (const band of weatherPool.fogBands) {
        band.x += band.vx * dt;
        if (band.vx > 0 && band.x - band.w > W) band.x = -band.w;
        if (band.vx < 0 && band.x + band.w < 0) band.x = W + band.w;
        const g = wCtx.createRadialGradient(band.x + band.w * 0.5, band.y, 10, band.x + band.w * 0.5, band.y, band.w * 0.58);
        g.addColorStop(0, `rgba(186, 210, 238, ${band.alpha})`);
        g.addColorStop(1, 'rgba(148, 163, 184, 0)');
        wCtx.fillStyle = g;
        wCtx.fillRect(band.x - 40, band.y - band.h, band.w + 80, band.h * 2);
      }

      weatherPool.glitchTimer -= dt;
      if (weatherPool.glitchTimer <= 0) {
        weatherPool.glitchTimer = 0.08 + Math.random() * 0.22;
        const barCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < barCount; i++) {
          const gy = Math.random() * H;
          const gh = 2 + Math.random() * 8;
          wCtx.fillStyle = i % 2 === 0 ? 'rgba(0, 212, 255, 0.16)' : 'rgba(230, 0, 35, 0.14)';
          wCtx.fillRect(0, gy, W, gh);
        }
      }
      return;
    }

    if (state.weather === 'storm') {
      wCtx.fillStyle = 'rgba(4, 10, 26, 0.35)';
      wCtx.fillRect(0, 0, W, H);

      wCtx.save();
      wCtx.lineWidth = 1.3;
      for (const r of weatherPool.rain) {
        r.x -= r.speed * 0.28 * dt;
        r.y += r.speed * dt;
        if (r.y > H + 30 || r.x < -40) {
          r.x = Math.random() * (W + 260);
          r.y = -30 - Math.random() * 120;
        }
        wCtx.strokeStyle = `rgba(148, 224, 255, ${r.alpha})`;
        wCtx.beginPath();
        wCtx.moveTo(r.x, r.y);
        wCtx.lineTo(r.x + r.len * 0.28, r.y - r.len);
        wCtx.stroke();
      }
      wCtx.restore();

      if (now >= weatherPool.nextLightningAt) {
        weatherPool.nextLightningAt = now + 2600 + Math.random() * 4800;
        const startX = W * (0.15 + Math.random() * 0.7);
        const endX = startX + (Math.random() - 0.5) * 260;
        const mainBolt = buildLightningPoints(startX, 0, endX, H * (0.55 + Math.random() * 0.32), 115, 5);
        const origin = mainBolt[Math.floor(mainBolt.length * 0.45)] || mainBolt[0];
        const branch = buildLightningPoints(origin.x, origin.y, origin.x + (Math.random() - 0.5) * 220, origin.y + 180, 65, 4);

        weatherPool.bolts.push({ points: mainBolt, branch, life: 0.36, maxLife: 0.36 });
        weatherPool.lightningFlash = 0.62;
        AudioEngine.play('thunder');
      }

      if (now >= weatherPool.nextGroundArcAt) {
        weatherPool.nextGroundArcAt = now + 450 + Math.random() * 900;
        const landEl = document.getElementById('layer-land');
        if (landEl) {
          const rect = landEl.getBoundingClientRect();
          if (rect.width > 40 && rect.height > 40) {
            const x1 = rect.left + Math.random() * rect.width;
            const y1 = rect.top + Math.random() * rect.height;
            weatherPool.groundArcs.push({
              points: buildLightningPoints(x1, y1, x1 + (Math.random() - 0.5) * 140, y1 + (Math.random() - 0.5) * 70, 34, 3),
              life: 0.22,
              maxLife: 0.22
            });
          }
        }
      }

      for (let i = weatherPool.bolts.length - 1; i >= 0; i--) {
        const b = weatherPool.bolts[i];
        b.life -= dt;
        if (b.life <= 0) { weatherPool.bolts.splice(i, 1); continue; }
        const a = b.life / b.maxLife;
        drawPolyline(wCtx, b.points, `rgba(0, 212, 255, ${a * 0.85})`, 6);
        drawPolyline(wCtx, b.points, `rgba(255, 255, 255, ${a})`, 2.2);
        drawPolyline(wCtx, b.branch, `rgba(255, 230, 0, ${a * 0.8})`, 1.8);
      }

      for (let i = weatherPool.groundArcs.length - 1; i >= 0; i--) {
        const g = weatherPool.groundArcs[i];
        g.life -= dt;
        if (g.life <= 0) { weatherPool.groundArcs.splice(i, 1); continue; }
        const a = g.life / g.maxLife;
        drawPolyline(wCtx, g.points, `rgba(255, 230, 0, ${a})`, 2.2);
        drawPolyline(wCtx, g.points, `rgba(0, 212, 255, ${a * 0.7})`, 4.5);
      }

      if (weatherPool.lightningFlash > 0.005) {
        wCtx.fillStyle = `rgba(220, 245, 255, ${weatherPool.lightningFlash * 0.42})`;
        wCtx.fillRect(0, 0, W, H);
        weatherPool.lightningFlash *= Math.pow(0.06, dt);
      }
    }
  }

  function renderForegroundFX(dt) {
    if (!fCtx) return;
    const W = state.width;
    const H = state.height;
    fCtx.clearRect(0, 0, W, H);

    if (fxPool.shake.elapsed < fxPool.shake.duration) {
      fxPool.shake.elapsed += dt * 1000;
      const ratio = Math.max(0, 1 - fxPool.shake.elapsed / fxPool.shake.duration);
      const mag = fxPool.shake.power * ratio;
      applyScreenShake((Math.random() - 0.5) * 2 * mag, (Math.random() - 0.5) * 2 * mag, (Math.random() - 0.5) * 0.08 * mag);
    } else if (fxPool.shake.duration > 0) {
      fxPool.shake.duration = 0;
      applyScreenShake(0, 0, 0);
    }

    if (!state.enabled) return;

    for (let i = fxPool.edgeFlashes.length - 1; i >= 0; i--) {
      const fl = fxPool.edgeFlashes[i];
      fl.life -= dt;
      if (fl.life <= 0) { fxPool.edgeFlashes.splice(i, 1); continue; }
      const alpha = (fl.life / fl.maxLife) * fl.intensity;
      const grad = fCtx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.28, W * 0.5, H * 0.5, Math.max(W, H) * 0.68);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, hexToRgba(fl.color, alpha));
      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, W, H);
      fCtx.strokeStyle = hexToRgba(fl.color, alpha * 1.15);
      fCtx.lineWidth = 10;
      fCtx.strokeRect(5, 5, W - 10, H - 10);
    }

    for (let i = fxPool.ripples.length - 1; i >= 0; i--) {
      const rp = fxPool.ripples[i];
      rp.life -= dt;
      if (rp.life <= 0) { fxPool.ripples.splice(i, 1); continue; }
      const p = 1 - rp.life / rp.maxLife;
      const radius = rp.rStart + (rp.rEnd - rp.rStart) * (1 - Math.pow(1 - p, 3));
      const alpha = (1 - p) * 0.92;

      fCtx.save();
      fCtx.translate(rp.x, rp.y);
      fCtx.strokeStyle = hexToRgba(rp.color, alpha);
      fCtx.lineWidth = Math.max(1.5, 5 * (1 - p));
      fCtx.beginPath();
      fCtx.arc(0, 0, radius, 0, Math.PI * 2);
      fCtx.stroke();
      fCtx.rotate(Math.PI * 0.25 + p * 0.35);
      fCtx.strokeStyle = hexToRgba('#ffffff', alpha * 0.85);
      fCtx.lineWidth = 2;
      const s = radius * 0.72;
      fCtx.strokeRect(-s, -s, s * 2, s * 2);
      fCtx.restore();
    }

    for (let i = fxPool.slashes.length - 1; i >= 0; i--) {
      const sl = fxPool.slashes[i];
      sl.life -= dt;
      if (sl.life <= 0) { fxPool.slashes.splice(i, 1); continue; }
      const prog = 1 - sl.life / sl.maxLife;
      const grow = Math.min(1, prog / 0.22);
      const fade = prog < 0.35 ? 1 : Math.max(0, 1 - (prog - 0.35) / 0.65);
      const halfLen = sl.length * 0.5 * grow;
      const thick = sl.thickness * (1 - prog * 0.58);

      fCtx.save();
      fCtx.translate(sl.x, sl.y);
      fCtx.rotate(sl.angle);
      fCtx.globalAlpha = fade;

      fCtx.fillStyle = '#000000';
      drawBladePath(fCtx, halfLen * 1.08, thick * 1.45);
      fCtx.fill();

      fCtx.fillStyle = sl.color;
      drawBladePath(fCtx, halfLen, thick);
      fCtx.fill();

      fCtx.fillStyle = '#ffffff';
      drawBladePath(fCtx, halfLen * 0.92, thick * 0.36);
      fCtx.fill();

      fCtx.strokeStyle = '#ffe600';
      fCtx.lineWidth = 2;
      fCtx.beginPath();
      fCtx.moveTo(-halfLen * 0.85, -thick * 0.75);
      fCtx.lineTo(halfLen * 0.7, -thick * 0.9);
      fCtx.moveTo(-halfLen * 0.65, thick * 0.82);
      fCtx.lineTo(halfLen * 0.9, thick * 0.68);
      fCtx.stroke();
      fCtx.restore();
    }

    for (let i = fxPool.arcs.length - 1; i >= 0; i--) {
      const arc = fxPool.arcs[i];
      arc.life -= dt;
      if (arc.life <= 0) { fxPool.arcs.splice(i, 1); continue; }
      const a = Math.min(1, (arc.life / arc.maxLife) * 1.3);
      const ptsA = buildLightningPoints(arc.x1, arc.y1, arc.x2, arc.y2, 54, 4);
      const ptsB = buildLightningPoints(arc.x1, arc.y1, arc.x2, arc.y2, 36, 4);

      drawPolyline(fCtx, ptsA, `rgba(0, 212, 255, ${a * 0.85})`, 6);
      drawPolyline(fCtx, ptsA, `rgba(255, 255, 255, ${a})`, 2.2);
      drawPolyline(fCtx, ptsB, `rgba(255, 230, 0, ${a * 0.95})`, 2.8);

      fCtx.save();
      fCtx.fillStyle = `rgba(255, 230, 0, ${a * 0.55})`;
      fCtx.beginPath();
      fCtx.arc(arc.x2, arc.y2, 18 + Math.random() * 14, 0, Math.PI * 2);
      fCtx.fill();
      fCtx.restore();
    }

    for (let i = fxPool.sparks.length - 1; i >= 0; i--) {
      const sp = fxPool.sparks[i];
      sp.life -= dt;
      if (sp.life <= 0) { fxPool.sparks.splice(i, 1); continue; }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= 0.95;
      sp.vy *= 0.95;
      sp.vy += 180 * dt;
      const alpha = sp.life / sp.maxLife;

      fCtx.save();
      fCtx.translate(sp.x, sp.y);
      fCtx.rotate(Math.atan2(sp.vy, sp.vx));
      fCtx.fillStyle = hexToRgba(sp.color, alpha);
      fCtx.beginPath();
      fCtx.moveTo(sp.size * 1.8, 0);
      fCtx.lineTo(-sp.size, sp.size * 0.55);
      fCtx.lineTo(-sp.size, -sp.size * 0.55);
      fCtx.closePath();
      fCtx.fill();
      fCtx.restore();
    }
  }

  function drawBladePath(ctx, halfLen, thick) {
    ctx.beginPath();
    ctx.moveTo(-halfLen, 0);
    ctx.quadraticCurveTo(0, -thick, halfLen, 0);
    ctx.quadraticCurveTo(0, thick * 0.45, -halfLen, 0);
    ctx.closePath();
  }

  function applyScreenShake(dx, dy, rot) {
    if (dx === 0 && dy === 0 && rot === 0) {
      document.querySelectorAll('.screen').forEach((s) => { s.style.transform = ''; });
      return;
    }
    const activeScreen = document.querySelector('.screen.is-active');
    if (activeScreen) {
      activeScreen.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    }
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#e60023').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  function mainLoop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - (state.lastTime || now)) / 1000));
    state.lastTime = now;
    renderWeather(dt, now);
    renderForegroundFX(dt);
    state.rafId = window.requestAnimationFrame(mainLoop);
  }

  function getSpeedConfig() {
    return SPEED_PRESETS[state.speed] || SPEED_PRESETS.slow;
  }

  function setSpeed(mode) {
    if (!SPEED_PRESETS[mode]) return;
    state.speed = mode;
    const btn = document.getElementById('btn-toggle-speed');
    if (btn) {
      const lbl = btn.querySelector('.btn-label');
      if (lbl) lbl.textContent = `播报: ${SPEED_PRESETS[mode].label}`;
    }
  }

  function cycleSpeed() {
    const order = ['slow', 'normal', 'fast'];
    const next = order[(order.indexOf(state.speed) + 1) % order.length];
    setSpeed(next);
    return next;
  }

  function getRemainingBannerMs() {
    if (!bannerBusy && bannerQueue.length === 0) return 0;
    const currentRem = Math.max(0, bannerEndAt - performance.now());
    const queuedMs = bannerQueue.length * (getSpeedConfig().bannerMs + 220);
    return currentRem + queuedMs;
  }

  function dismissCurrentBanner() {
    if (!bannerBusy || !dom.bannerBox) return;
    window.clearTimeout(bannerTimerA);
    window.clearTimeout(bannerTimerB);
    bannerEndAt = performance.now() + 220;
    dom.bannerBox.classList.remove('is-showing');
    dom.bannerBox.classList.add('is-leaving');
    bannerTimerB = window.setTimeout(() => {
      dom.bannerBox.classList.remove('is-leaving');
      if (dom.bannerLayer) dom.bannerLayer.setAttribute('aria-hidden', 'true');
      bannerBusy = false;
      if (bannerQueue.length === 0) bannerEndAt = 0;
      processBannerQueue();
    }, 220);
  }

  function processBannerQueue() {
    if (bannerBusy || bannerQueue.length === 0) return;
    if (!dom.bannerBox) { bannerQueue.length = 0; bannerEndAt = 0; return; }

    if (bannerQueue.length > 3) {
      bannerQueue.splice(0, bannerQueue.length - 3);
    }

    bannerBusy = true;
    const item = bannerQueue.shift();

    dom.bannerBox.dataset.mood = item.mood || state.mood;
    if (dom.bannerKicker) dom.bannerKicker.textContent = item.kicker || 'ALERT';
    if (dom.bannerText) dom.bannerText.textContent = item.title || 'LITTLE KNIFE';
    if (dom.bannerSub) dom.bannerSub.textContent = item.sub || '';
    if (dom.bannerLayer) dom.bannerLayer.setAttribute('aria-hidden', 'false');

    dom.bannerBox.classList.remove('is-leaving', 'is-showing');
    void dom.bannerBox.offsetWidth;
    dom.bannerBox.classList.add('is-showing');

    if (item.playSlide !== false) AudioEngine.play('slide');

    const speedMs = getSpeedConfig().bannerMs;
    const holdMs = typeof item.durationMs === 'number'
      ? Math.max(900, Math.round(item.durationMs * (speedMs / 2400)))
      : speedMs;
    bannerEndAt = performance.now() + holdMs + 220;
    bannerTimerA = window.setTimeout(() => {
      dismissCurrentBanner();
    }, holdMs);
  }

  const HAND_ICON = { rock: '✊', paper: '✋', scissors: '✌️', stone: '✊', cloth: '✋' };

  function ensureRpsOverlay() {
    if (dom.rpsClashOverlay) return dom.rpsClashOverlay;
    const el = document.createElement('div');
    el.id = 'vfx-rps-clash';
    el.className = 'vfx-rps-overlay is-hidden';
    document.body.appendChild(el);
    dom.rpsClashOverlay = el;
    return el;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function rpsClash(options = {}) {
    const entries = Array.isArray(options.entries) ? options.entries : [];
    const title = options.title || 'RPS CLASH // 猜拳亮牌';
    const subtitle = options.subtitle || '';
    const kicker = options.kicker || 'SHOWDOWN';
    const quick = Boolean(options.quick);
    const durationMs = typeof options.durationMs === 'number' ? options.durationMs : 2200;
    const holdMs = quick ? clampMs(durationMs, 320, 900) : durationMs;

    return new Promise((resolve) => {
      const overlay = ensureRpsOverlay();
      const cardsHtml = entries.map((e) => {
        const icon = HAND_ICON[e.hand] || e.hand || '❔';
        const outcomeClass = e.outcome === 'win' ? 'is-win' : e.outcome === 'lose' ? 'is-lose' : 'is-draw';
        const outcomeLabel = e.outcome === 'win' ? 'WIN' : e.outcome === 'lose' ? 'LOSE' : 'DRAW';
        return `
          <div class="vfx-rps-card ${outcomeClass}">
            <div class="vfx-rps-hand">${escapeHtml(icon)}</div>
            <div class="vfx-rps-name">${escapeHtml(e.name || '特工')}</div>
            <div class="vfx-rps-tag">${escapeHtml(e.tag || outcomeLabel)}</div>
          </div>
        `;
      }).join('');

      overlay.innerHTML = `
        <div class="vfx-rps-ribbon">
          <div class="vfx-rps-head">
            <span class="vfx-rps-kicker">${escapeHtml(kicker)}</span>
            <span class="vfx-rps-title">${escapeHtml(title)}</span>
          </div>
          <div class="vfx-rps-cards">${cardsHtml}</div>
          ${subtitle ? `<div class="vfx-rps-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
      `;

      overlay.classList.toggle('is-quick', quick);
      overlay.classList.remove('is-hidden');
      void overlay.offsetWidth;
      overlay.classList.add('is-active');

      // 平局走「极速闪帧」：不震屏、不炸音，只留一记轻提示，立刻进入下一轮
      if (quick) {
        AudioEngine.play('click');
      } else {
        AudioEngine.play('rps_clash');
        shake(8, 220);
      }

      window.setTimeout(() => {
        overlay.classList.remove('is-active');
        window.setTimeout(() => {
          overlay.classList.add('is-hidden');
          resolve();
        }, quick ? 90 : 170);
      }, holdMs);
    });
  }

  function clampMs(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function setMood(mood) {
    const next = mood === 'p5r' ? 'p5r' : 'p3r';
    if (state.mood === next && document.body.dataset.mood === next) return;
    state.mood = next;
    document.body.dataset.mood = next;
  }

  function setWeather(weather, fogImmune = false) {
    const valid = ['clear', 'bloodmoon', 'fog', 'storm'].includes(weather) ? weather : 'clear';
    const changed = state.weather !== valid;
    state.weather = valid;
    state.fogImmune = Boolean(fogImmune);
    document.body.dataset.weather = valid;

    if (dom.mapViewport) {
      dom.mapViewport.classList.remove('weather-bloodmoon', 'weather-fog', 'weather-storm', 'is-fog-immune');
      if (valid !== 'clear') dom.mapViewport.classList.add(`weather-${valid}`);
      if (valid === 'fog' && state.fogImmune) dom.mapViewport.classList.add('is-fog-immune');
    }

    if (changed) {
      if (valid === 'bloodmoon') {
        weatherPool.moonRise = 0;
        setMood('p5r');
        AudioEngine.play('bell');
      } else if (valid === 'storm') {
        weatherPool.nextLightningAt = performance.now() + 500;
        weatherPool.nextGroundArcAt = performance.now() + 200;
        AudioEngine.play('thunder');
      } else if (valid === 'fog') {
        AudioEngine.play('slide');
      }
    }
  }

  function shake(intensity = 10, durationMs = 280) {
    if (!state.enabled) return;
    fxPool.shake.power = Math.max(fxPool.shake.power, intensity);
    fxPool.shake.duration = Math.max(fxPool.shake.duration, durationMs);
    fxPool.shake.elapsed = 0;
  }

  function edgeFlash(color = '#e60023', intensity = 0.65, durationSec = 0.42) {
    if (!state.enabled) return;
    fxPool.edgeFlashes.push({ color, intensity, life: durationSec, maxLife: durationSec });
  }

  function rippleOnNode(nodeId, color = '#00d4ff', rings = 2) {
    if (!state.enabled) return;
    const pos = resolveNodeScreenPos(nodeId);
    for (let i = 0; i < rings; i++) {
      window.setTimeout(() => {
        fxPool.ripples.push({ x: pos.x, y: pos.y, color, rStart: 12, rEnd: 78 + i * 28, life: 0.56, maxLife: 0.56 });
      }, i * 95);
    }
  }

  function slash(opts = {}) {
    const color = opts.color || '#e60023';
    const intensity = opts.intensity || 1;
    const count = Math.max(1, Math.min(5, opts.count || 2));

    let cx = typeof opts.x === 'number' ? opts.x : state.width * 0.5;
    let cy = typeof opts.y === 'number' ? opts.y : state.height * 0.46;
    if (opts.nodeId) {
      const pos = resolveNodeScreenPos(opts.nodeId);
      cx = pos.x;
      cy = pos.y;
      rippleOnNode(opts.nodeId, color, 2);
    }

    if (state.enabled) {
      for (let i = 0; i < count; i++) {
        window.setTimeout(() => {
          const baseAngle = typeof opts.angle === 'number' ? opts.angle : (i % 2 === 0 ? -0.44 : 0.46) + (Math.random() - 0.5) * 0.2;
          const ox = cx + (Math.random() - 0.5) * 44;
          const oy = cy + (Math.random() - 0.5) * 32;

          fxPool.slashes.push({
            x: ox,
            y: oy,
            angle: baseAngle,
            length: Math.max(state.width * 0.62, 460) * Math.min(1.4, 0.85 + intensity * 0.28),
            thickness: (26 + intensity * 12) * (i === 0 ? 1.15 : 0.85),
            color,
            life: 0.42,
            maxLife: 0.42
          });

          const sparkCount = Math.floor(14 * intensity);
          for (let s = 0; s < sparkCount; s++) {
            const spAngle = baseAngle + (Math.random() - 0.5) * 1.1;
            const speed = 220 + Math.random() * 560;
            fxPool.sparks.push({
              x: ox + (Math.random() - 0.5) * 60,
              y: oy + (Math.random() - 0.5) * 40,
              vx: Math.cos(spAngle) * speed,
              vy: Math.sin(spAngle) * speed - 60,
              size: 4 + Math.random() * 7,
              color: s % 3 === 0 ? '#ffe600' : s % 2 === 0 ? '#ffffff' : color,
              life: 0.28 + Math.random() * 0.24,
              maxLife: 0.52
            });
          }
        }, i * 85);
      }

      shake(11 * intensity, 320);
      if (opts.edgeFlash !== false) edgeFlash(color, Math.min(0.85, 0.55 * intensity), 0.44);
    }

    if (opts.sfx !== false) AudioEngine.play('slash');
  }

  function electricArc(opts = {}) {
    let p1 = { x: opts.x1, y: opts.y1 };
    let p2 = { x: opts.x2, y: opts.y2 };
    if (opts.fromNodeId) p1 = resolveNodeScreenPos(opts.fromNodeId);
    if (opts.toNodeId) p2 = resolveNodeScreenPos(opts.toNodeId);
    if (typeof p1.x !== 'number') p1 = { x: state.width * 0.5, y: 80 };
    if (typeof p2.x !== 'number') p2 = { x: state.width * 0.5, y: state.height * 0.48 };

    if (state.enabled) {
      const dur = (opts.durationMs || 460) / 1000;
      fxPool.arcs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, life: dur, maxLife: dur });
      if (opts.toNodeId) rippleOnNode(opts.toNodeId, '#ffe600', 2);

      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 120 + Math.random() * 320;
        fxPool.sparks.push({
          x: p2.x,
          y: p2.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3 + Math.random() * 5,
          color: i % 2 === 0 ? '#ffe600' : '#00d4ff',
          life: 0.24 + Math.random() * 0.2,
          maxLife: 0.44
        });
      }
      shake(7, 240);
      edgeFlash('#00d4ff', 0.42, 0.34);
    }

    if (opts.sfx !== false) AudioEngine.play('shock');
  }

  function floatOnNode(nodeId, text, type = 'info') {
    if (!dom.mapOverlay) return;
    const overlayRect = dom.mapOverlay.getBoundingClientRect();
    const pos = resolveNodeScreenPos(nodeId);

    const key = String(nodeId || 'center');
    const stackIndex = (nodeFloatStack.get(key) || 0) % 4;
    nodeFloatStack.set(key, stackIndex + 1);
    window.setTimeout(() => {
      const cur = nodeFloatStack.get(key) || 0;
      if (cur > 0) nodeFloatStack.set(key, cur - 1);
    }, 650);

    const jitterX = (stackIndex - 1.5) * 18;
    const jitterY = -stackIndex * 14;
    const relX = Math.max(36, Math.min(overlayRect.width - 36, pos.x - overlayRect.left + jitterX));
    const relY = Math.max(32, Math.min(overlayRect.height - 28, pos.y - overlayRect.top + jitterY));

    const el = document.createElement('div');
    const safeType = ['dmg', 'heal', 'pants', 'emoji', 'skill', 'miss', 'info'].includes(type) ? type : 'info';
    el.className = `map-float-item float--${safeType}`;
    el.style.left = `${relX}px`;
    el.style.top = `${relY}px`;
    el.textContent = text;
    dom.mapOverlay.appendChild(el);

    if (safeType === 'dmg') rippleOnNode(nodeId, '#e60023', 2);
    else if (safeType === 'pants') rippleOnNode(nodeId, '#3b82f6', 1);
    else if (safeType === 'skill') rippleOnNode(nodeId, '#b666ff', 2);
    else if (safeType === 'miss') rippleOnNode(nodeId, '#ffe600', 1);
    else if (safeType === 'emoji') rippleOnNode(nodeId, '#ffffff', 1);

    window.setTimeout(() => el.remove(), safeType === 'emoji' ? 2800 : 2500);
  }

  function tacticalFeed({ order = '', actor = '', action = '', target = '', result = '', highlight = false, text = '' } = {}) {
    if (!dom.tfeedBar) return;
    const mainStr = text || (target ? `${order ? order + ' ' : ''}${actor} ▸ ${action} ▸ ${target}` : `${order ? order + ' ' : ''}${actor} ▸ ${action}`);
    if (dom.tfeedBadge) dom.tfeedBadge.textContent = order || (highlight ? 'ALERT' : 'ACTION');
    if (dom.tfeedMain) dom.tfeedMain.textContent = mainStr;
    if (dom.tfeedSub) dom.tfeedSub.textContent = result || '';
    dom.tfeedBar.classList.toggle('is-highlight', Boolean(highlight));
    dom.tfeedBar.classList.remove('is-flash');
    void dom.tfeedBar.offsetWidth;
    dom.tfeedBar.classList.add('is-flash');
  }

  function banner(kicker, title, sub = '', mood = null, durationMs = null) {
    bannerQueue.push({
      kicker: String(kicker || 'ALERT'),
      title: String(title || ''),
      sub: String(sub || ''),
      mood: mood || state.mood,
      durationMs: typeof durationMs === 'number' ? durationMs : null
    });
    tacticalFeed({ text: `${title}`, result: sub, highlight: true });
    processBannerQueue();
  }

  function bannerAction({ order = '', actor = '', action = '', target = '', result = '', mood = null, durationMs = null, highlight = false } = {}) {
    tacticalFeed({ order, actor, action, target, result, highlight });
    if (highlight) {
      const kicker = order ? `ORDER ${order} // HIGHLIGHT` : 'TACTICAL HIGHLIGHT';
      const title = target ? `${actor} ▸ ${action} ▸ ${target}` : `${actor} ▸ ${action}`;
      banner(kicker, title, result, mood || state.mood, durationMs);
    }
  }

  function clearBannerQueue() {
    bannerQueue.length = 0;
    window.clearTimeout(bannerTimerA);
    window.clearTimeout(bannerTimerB);
    bannerBusy = false;
    bannerEndAt = 0;
    if (dom.bannerBox) dom.bannerBox.classList.remove('is-showing', 'is-leaving');
    if (dom.bannerLayer) dom.bannerLayer.setAttribute('aria-hidden', 'true');
  }

  function toast(msg, level = 'info', durationMs = 3600) {
    if (!dom.toastLayer || !msg) return;
    const item = document.createElement('div');
    const lv = ['info', 'warn', 'danger', 'success'].includes(level) ? level : 'info';
    item.className = `vfx-toast toast--${lv}`;
    item.textContent = String(msg);
    dom.toastLayer.appendChild(item);

    while (dom.toastLayer.children.length > 4) {
      dom.toastLayer.firstChild.remove();
    }

    const dur = Math.max(1200, Number(durationMs) || 3600);
    window.setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(-10px) skewX(-12deg)';
      item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      window.setTimeout(() => item.remove(), 220);
    }, dur);
  }

  function setEnabled(bool) {
    state.enabled = Boolean(bool);
    if (!state.enabled) {
      if (wCtx) wCtx.clearRect(0, 0, state.width, state.height);
      if (fCtx) fCtx.clearRect(0, 0, state.width, state.height);
      applyScreenShake(0, 0, 0);
    }
  }

  function setAudioMuted(bool) {
    state.audioMuted = Boolean(bool);
    const label = state.audioMuted ? '音效: OFF' : '音效: ON';
    const icon = state.audioMuted ? '🔇' : '🔊';

    const lobbyBtn = document.getElementById('btn-toggle-audio');
    if (lobbyBtn) {
      lobbyBtn.setAttribute('aria-pressed', String(!state.audioMuted));
      const span = lobbyBtn.querySelector('.btn-label');
      if (span) span.textContent = label;
    }

    const gameBtn = document.getElementById('btn-toggle-audio-ingame');
    if (gameBtn) {
      const span = gameBtn.querySelector('.btn-label');
      if (span) span.textContent = icon;
    }
  }

  function sfx(name) {
    AudioEngine.play(name);
  }

  function bindGlobalUiHooks() {
    const unlockOnce = () => AudioEngine.unlock();
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce, { passive: true });
    window.addEventListener('touchstart', unlockOnce, { passive: true });

    document.addEventListener('click', (ev) => {
      const target = ev.target.closest('.pk-btn, .role-tab, .role-card, .cam-btn, .phrase-chip, .contract-card, .icon-close-btn');
      if (!target || target.disabled) return;
      AudioEngine.play('click');
    });

    document.addEventListener('pointerenter', (ev) => {
      if (!(ev.target instanceof Element)) return;
      const target = ev.target.closest('.pk-btn, .role-card, .contract-card');
      if (!target || target.disabled) return;
      AudioEngine.play('hover');
    }, true);
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    dom.weatherCanvas = document.getElementById('vfx-weather-canvas');
    dom.fxCanvas = document.getElementById('vfx-fx-canvas');
    dom.halftone = document.getElementById('vfx-halftone-layer');
    dom.bannerLayer = document.getElementById('vfx-banner-layer');
    dom.bannerBox = document.getElementById('vfx-banner-box');
    dom.bannerKicker = document.getElementById('vfx-banner-kicker');
    dom.bannerText = document.getElementById('vfx-banner-text');
    dom.bannerSub = document.getElementById('vfx-banner-sub');
    dom.toastLayer = document.getElementById('vfx-toast-layer');
    dom.mapViewport = document.getElementById('map-viewport');
    dom.mapOverlay = document.getElementById('map-fx-overlay');
    dom.tfeedBar = document.getElementById('tactical-feed-bar');
    dom.tfeedBadge = document.getElementById('tfeed-badge');
    dom.tfeedMain = document.getElementById('tfeed-main');
    dom.tfeedSub = document.getElementById('tfeed-sub');
    setSpeed(state.speed);
    if (dom.bannerBox) dom.bannerBox.addEventListener('click', dismissCurrentBanner);

    if (dom.weatherCanvas) wCtx = dom.weatherCanvas.getContext('2d');
    if (dom.fxCanvas) fCtx = dom.fxCanvas.getContext('2d');

    injectDynamicStyles();
    resizeCanvases();
    seedWeatherParticles();
    bindGlobalUiHooks();

    window.addEventListener('resize', () => {
      resizeCanvases();
      seedWeatherParticles();
    });

    state.lastTime = performance.now();
    state.rafId = window.requestAnimationFrame(mainLoop);
  }

  window.VFX = {
    init,
    setEnabled,
    isEnabled: () => state.enabled,
    setAudioMuted,
    isAudioMuted: () => state.audioMuted,
    setMood,
    getMood: () => state.mood,
    setWeather,
    getWeather: () => state.weather,
    slash,
    electricArc,
    rippleOnNode,
    shake,
    edgeFlash,
    tacticalFeed,
    banner,
    bannerAction,
    clearBannerQueue,
    setSpeed,
    cycleSpeed,
    getSpeed: () => state.speed,
    getSpeedConfig,
    getRemainingBannerMs,
    rpsClash,
    floatOnNode,
    toast,
    sfx
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
