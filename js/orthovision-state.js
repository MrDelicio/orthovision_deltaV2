(() => {
  "use strict";

  const OV = window.OV = window.OV || {};

  OV.$ = (id) => document.getElementById(id);

  OV.QUALITIES = [
    { name: "Rapide", w: 320, h: 240 },
    { name: "Normal", w: 640, h: 480 },
    { name: "Qualité", w: 960, h: 540 }
  ];

  OV.MODES = [
    "IMAGE",
    "IMAGE+TRACE",
    "TRACE SEULE",
    "ZONES DELTA",
    "MEMBRANE FINE",
    "SPECTRE DELTA",
    "MULTI ECHELLE",
    "CARTE CALME",
    "FOYER DELTA",
    "FOYER VIVANT",
    "PRESENCE DELTA",
    "MEMOIRE VIVE",
    "PULSATION LUMINEUSE",
    "CONTRASTE ORGANIQUE",
    "RELIEF OPTIQUE",
    "RELIEF PUR",
    "RELIEF NOIR",
    "PARALLAXE VIVANTE",
    "AUDIOPULSE"
  ];

  OV.S = {
    qualityIndex: 1,
    modeIndex: 0,
    facingMode: "environment",
    stream: null,
    running: false,
    paused: false,
    frameId: 0,

    W: 640,
    H: 480,
    N: 640 * 480,

    ZONE_COLS: 64,
    ZONE_ROWS: 48,
    ZONE_COUNT: 64 * 48,

    prevLuma: null,
    currLuma: null,
    rawDiffPixels: null,
    tracePixels: null,
    diffPixels: null,

    temporalFast: null,
    temporalSlow: null,
    zonesDelta: null,
    presenceGrid: null,

    // PulsationLumineuseΔ : mémoire lumineuse par zones.
    pulseFast: null,
    pulseSlow: null,
    pulseAmp: null,
    pulseSat: null,
    pulseMean: null,
    pulseReady: false,
    pulseGlobal: 0,
    pulseSaturation: 0,
    pulseMaxZone: 0,
    pulseMaxValue: 0,

    // ParallaxeVivanteΔ : profondeur relative par mouvement de zones.
    parallaxPrevMean: null,
    parallaxCurrMean: null,
    parallaxDepth: null,
    parallaxDx: null,
    parallaxDy: null,
    parallaxReady: false,
    parallaxGlobalDx: 0,
    parallaxGlobalDy: 0,
    parallaxGlobalMotion: 0,
    parallaxMaxValue: 0,
    parallaxMaxZone: 0,
    parallaxUsableZones: 0,
    parallaxMotionOk: false,

    memR: null,
    memG: null,
    memB: null,
    memReady: false,

    first: true,
    hist: [],
    HIST_LEN: 32,
    INIT_FRAMES: 32,

    fps: 0,
    fpsFrames: 0,
    lastFpsTime: performance.now(),

    // AntiFlashRéelΔ
    meanPrevLight: 0,
    meanCurrLight: 0,
    globalLightShift: 0,
    rawInstant: 0,
    validInstant: 0,
    traceMotionScore: 0,
    traceRegime: "InitialisationΔ",
    flashGlobalScore: 0,
    sameDirectionRatio: 0,
    risingRatio: 0,
    fallingRatio: 0,
    antiFlashActive: false,

    // FoyerVivantΔ
    foyerX: 320,
    foyerY: 240,
    foyerStrength: 0,
    foyerLocked: false,
    foyerStableAge: 0,
    foyerSecondary: [],

    // PrésenceVisuelleΔ
    presences: [],
    presenceMemory: [],
    stablePresences: [],
    presenceNextId: 1,

    // AudioPulseΔ
    audioCtx: null,
    audioStream: null,
    analyser: null,
    audioData: null,
    audioEnabled: false,
    audioLevel: 0,
    audioLow: 0,
    audioMid: 0,
    audioHigh: 0
  };

  OV.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  OV.rankFromVariation = (v) => {
    if (v < 1) return "O";
    if (v < 3) return "U";
    if (v < 6) return "B";
    if (v < 10) return "T";
    if (v < 16) return "Q";
    if (v < 24) return "P";
    if (v < 36) return "S";
    return "H";
  };

  OV.stateDelta = (frame, instant, mean, stability) => {
    const S = OV.S;
    if (frame < S.INIT_FRAMES) return "InitialisationΔ";
    if (instant >= 36) return "RuptureΔ";
    if (mean < 2.5 && instant < 3.5 && stability < 1.5) return "CalmeΔ";
    if (instant > mean * 2.2 && instant > 8.0) return "ApparitionΔ";
    if (stability < 3.0 && mean >= 6.0 && mean < 24.0) return "TenueNouvelleΔ";
    if (mean < 5.0 && instant < mean + 1.5) return "RetourΔ";
    return "TransitionΔ";
  };

  OV.rgba = (r, g, b) => [r | 0, g | 0, b | 0, 255];

  OV.putPixel = (out, p, c) => {
    const i = p * 4;
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = 255;
  };

  OV.pushHist = (v) => {
    const S = OV.S;
    if (v >= 36) {
      S.hist = [Math.min(v, 24)];
      return;
    }
    S.hist.push(v);
    if (S.hist.length > S.HIST_LEN) S.hist.shift();
  };

  OV.meanHist = () => {
    const h = OV.S.hist;
    if (!h.length) return 0;
    let s = 0;
    for (const v of h) s += v;
    return s / h.length;
  };

  OV.stabilityHist = (mean) => {
    const h = OV.S.hist;
    if (h.length < 2) return 0;
    let s = 0;
    for (const v of h) {
      const d = v - mean;
      s += d * d;
    }
    return Math.sqrt(s / h.length);
  };

  OV.allocBuffers = () => {
    const S = OV.S;
    const q = OV.QUALITIES[S.qualityIndex];

    S.W = q.w;
    S.H = q.h;
    S.N = q.w * q.h;

    const canvas = OV.$("view");
    canvas.width = S.W;
    canvas.height = S.H;

    S.ZONE_COLS = S.W <= 320 ? 32 : 64;
    S.ZONE_ROWS = Math.round(S.ZONE_COLS * S.H / S.W);
    S.ZONE_COUNT = S.ZONE_COLS * S.ZONE_ROWS;

    S.prevLuma = new Uint8Array(S.N);
    S.currLuma = new Uint8Array(S.N);
    S.rawDiffPixels = new Uint8Array(S.N);
    S.tracePixels = new Uint8Array(S.N);
    S.diffPixels = S.tracePixels;

    S.temporalFast = new Float32Array(S.N);
    S.temporalSlow = new Float32Array(S.N);

    S.zonesDelta = new Float32Array(S.ZONE_COUNT);
    S.presenceGrid = new Uint8Array(S.ZONE_COUNT);

    S.pulseFast = new Float32Array(S.ZONE_COUNT);
    S.pulseSlow = new Float32Array(S.ZONE_COUNT);
    S.pulseAmp = new Float32Array(S.ZONE_COUNT);
    S.pulseSat = new Float32Array(S.ZONE_COUNT);
    S.pulseMean = new Float32Array(S.ZONE_COUNT);

    S.parallaxPrevMean = new Float32Array(S.ZONE_COUNT);
    S.parallaxCurrMean = new Float32Array(S.ZONE_COUNT);
    S.parallaxDepth = new Float32Array(S.ZONE_COUNT);
    S.parallaxDx = new Float32Array(S.ZONE_COUNT);
    S.parallaxDy = new Float32Array(S.ZONE_COUNT);

    S.memR = new Float32Array(S.N);
    S.memG = new Float32Array(S.N);
    S.memB = new Float32Array(S.N);

    OV.resetMemory();
  };

  OV.resetMemory = () => {
    const S = OV.S;

    S.first = true;
    S.frameId = 0;
    S.hist = [];

    if (S.temporalFast) S.temporalFast.fill(0);
    if (S.temporalSlow) S.temporalSlow.fill(0);
    if (S.rawDiffPixels) S.rawDiffPixels.fill(0);
    if (S.tracePixels) S.tracePixels.fill(0);
    if (S.pulseFast) S.pulseFast.fill(0);
    if (S.pulseSlow) S.pulseSlow.fill(0);
    if (S.pulseAmp) S.pulseAmp.fill(0);
    if (S.pulseSat) S.pulseSat.fill(0);
    if (S.pulseMean) S.pulseMean.fill(0);
    if (S.parallaxPrevMean) S.parallaxPrevMean.fill(0);
    if (S.parallaxCurrMean) S.parallaxCurrMean.fill(0);
    if (S.parallaxDepth) S.parallaxDepth.fill(0);
    if (S.parallaxDx) S.parallaxDx.fill(0);
    if (S.parallaxDy) S.parallaxDy.fill(0);
    S.parallaxReady = false;
    S.parallaxGlobalDx = 0;
    S.parallaxGlobalDy = 0;
    S.parallaxGlobalMotion = 0;
    S.parallaxMaxValue = 0;
    S.parallaxMaxZone = 0;
    S.parallaxUsableZones = 0;
    S.parallaxMotionOk = false;
    S.pulseReady = false;
    S.pulseGlobal = 0;
    S.pulseSaturation = 0;
    S.pulseMaxZone = 0;
    S.pulseMaxValue = 0;
    if (S.memR) S.memR.fill(0);
    if (S.memG) S.memG.fill(0);
    if (S.memB) S.memB.fill(0);

    S.memReady = false;

    S.meanPrevLight = 0;
    S.meanCurrLight = 0;
    S.globalLightShift = 0;
    S.rawInstant = 0;
    S.validInstant = 0;
    S.traceMotionScore = 0;
    S.traceRegime = "InitialisationΔ";
    S.flashGlobalScore = 0;
    S.sameDirectionRatio = 0;
    S.risingRatio = 0;
    S.fallingRatio = 0;
    S.antiFlashActive = false;

    S.foyerX = S.W / 2;
    S.foyerY = S.H / 2;
    S.foyerStrength = 0;
    S.foyerLocked = false;
    S.foyerStableAge = 0;
    S.foyerSecondary = [];

    S.presences = [];
    S.presenceMemory = [];
    S.stablePresences = [];
    S.presenceNextId = 1;
  };

  OV.allocBuffers();
})();
