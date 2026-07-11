(() => {
  "use strict";

  // Initialisation sécurisée de l'espace de nom
  window.OV = window.OV || {};
  const OV = window.OV;

  OV.$ = (id) => document.getElementById(id);

  OV.QUALITIES = [
    { name: "Rapide", w: 320, h: 240 },
    { name: "Normal", w: 640, h: 480 },
    { name: "Qualité", w: 960, h: 540 }
  ];

  OV.MODES = [
    "IMAGE", "IMAGE+TRACE", "TRACE SEULE", "ZONES DELTA", "MEMBRANE FINE",
    "SPECTRE DELTA", "MULTI ECHELLE", "CARTE CALME", "FOYER DELTA", 
    "FOYER VIVANT", "PRESENCE DELTA", "MEMOIRE VIVE", "PULSATION LUMINEUSE",
    "CONTRASTE ORGANIQUE", "RELIEF OPTIQUE", "RELIEF PUR", "RELIEF NOIR",
    "PARALLAXE VIVANTE", "AUDIOPULSE"
  ];

  OV.S = {
    qualityIndex: 1,
    modeIndex: 0,
    facingMode: "environment",
    stream: null,
    running: false,
    paused: false,
    frameId: 0,
    W: 640, H: 480, N: 640 * 480,
    ZONE_COLS: 64, ZONE_ROWS: 48, ZONE_COUNT: 3072,
    foyerGainMap: null,
    prevLuma: null, currLuma: null, rawDiffPixels: null, tracePixels: null, diffPixels: null,
    temporalFast: null, temporalSlow: null, zonesDelta: null, presenceGrid: null,
    pulseFast: null, pulseSlow: null, pulseAmp: null, pulseSat: null, pulseMean: null,
    parallaxPrevMean: null, parallaxCurrMean: null, parallaxDepth: null, parallaxDx: null, parallaxDy: null,
    memR: null, memG: null, memB: null,
    first: true, hist: [], HIST_LEN: 32, INIT_FRAMES: 32,
    fps: 0, fpsFrames: 0, lastFpsTime: 0,
    meanPrevLight: 0, meanCurrLight: 0, globalLightShift: 0, rawInstant: 0, validInstant: 0,
    traceMotionScore: 0, traceRegime: "InitialisationΔ", flashGlobalScore: 0,
    sameDirectionRatio: 0, risingRatio: 0, fallingRatio: 0, antiFlashActive: false,
    foyerX: 320, foyerY: 240, foyerStrength: 0, foyerLocked: false, foyerStableAge: 0, foyerSecondary: [],
    presences: [], presenceMemory: [], stablePresences: [], presenceNextId: 1
  };

  OV.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  OV.rankIndexFromVariation = (v) => {
    return (v < 1) ? 0 : (v < 3) ? 1 : (v < 6) ? 2 : (v < 10) ? 3 : 
           (v < 16) ? 4 : (v < 24) ? 5 : (v < 36) ? 6 : 7;
  };

  OV.stateDelta = (frame, instant) => {
    return (frame < 32) ? "InitialisationΔ" : (instant >= 36) ? "RuptureΔ" : "TransitionΔ";
  };

  OV.rgba = (r, g, b) => [r | 0, g | 0, b | 0, 255];

  OV.putPixel = (out, p, c) => {
    const i = p * 4;
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
  };

  OV.allocBuffers = () => {
    const S = OV.S;
    const q = OV.QUALITIES[S.qualityIndex];
    S.W = q.w; S.H = q.h; S.N = q.w * q.h;
    S.ZONE_COUNT = S.ZONE_COLS * S.ZONE_ROWS;
    
    S.foyerGainMap = new Float32Array(S.N);
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
    S.first = true; S.frameId = 0;
    if (S.foyerGainMap) S.foyerGainMap.fill(0);
    if (S.temporalFast) S.temporalFast.fill(0);
    if (S.temporalSlow) S.temporalSlow.fill(0);
  };

  OV.allocBuffers();
})();
