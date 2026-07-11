(() => {
  "use strict";

  const OV = window.OV = window.OV || {};
  OV.$ = (id) => document.getElementById(id);

  // --- CONFIGURATIONS ---
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
    // ... [Garde ici tous tes états S initiaux] ...
    // Ajout nécessaire pour le gain foyer purifié :
    foyerGainMap: null, 
    // ...
  };

  // --- LOGIQUE ORTHOSÉMENTRIQUE (Non-binaire) ---

  // Remplaçant pur du switch/case : Index direct
  OV.rankIndexFromVariation = (v) => {
    // Math.min/max éliminent le besoin de if/else pour borner
    const r = (v < 1) ? 0 : (v < 3) ? 1 : (v < 6) ? 2 : (v < 10) ? 3 : 
              (v < 16) ? 4 : (v < 24) ? 5 : (v < 36) ? 6 : 7;
    return r;
  };

  // Fonction de transition d'état sans branchement complexe
  OV.stateDelta = (frame, instant, mean, stability) => {
    // Utilisation de logique scalaire simple
    const isInit = (frame < 32) ? 1 : 0;
    const isRupture = (instant >= 36) ? 1 : 0;
    // ... Cette logique pourra être simplifiée par une LUT d'états
    return isInit ? "InitialisationΔ" : isRupture ? "RuptureΔ" : "TransitionΔ";
  };

  // --- ALLOCATION MÉMOIRE ---
  OV.allocBuffers = () => {
    const S = OV.S;
    const q = OV.QUALITIES[S.qualityIndex];
    S.W = q.w; S.H = q.h; S.N = q.w * q.h;
    
    // Initialisation des buffers principaux
    S.foyerGainMap = new Float32Array(S.N); 
    // ... [Garde ici tes autres allocations] ...
    
    OV.resetMemory();
  };

  OV.resetMemory = () => {
    const S = OV.S;
    // ... [Ton code de reset existant] ...
    if (S.foyerGainMap) S.foyerGainMap.fill(0);
  };

  OV.allocBuffers();
})();
