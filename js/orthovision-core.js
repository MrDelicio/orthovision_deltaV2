(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  // --- REGISTRY DES MODES (Configuration Pure) ---
  OV.Registry = {
    FIXE:   { fastAlpha: 0.15, sensitivity: 1.0, threshold: 4.0 },
    MOBILE: { fastAlpha: 0.40, sensitivity: 2.2, threshold: 6.5 },
    SIGNAL: { fastAlpha: 0.70, sensitivity: 4.0, threshold: 2.0 }
  };

  OV.CurrentMode = 'FIXE';

  OV.setMode = (modeKey) => {
    const config = OV.Registry[modeKey];
    if (!config) return;
    OV.CurrentMode = modeKey;
    S.fastAlpha = config.fastAlpha;
    S.sensitivity = config.sensitivity;
    S.threshold = config.threshold;
    console.log("Mode actif :", OV.CurrentMode);
  };

  // --- LOGIQUE PURIFIÉE ---

  OV.computeDiffAndInstant = () => {
    S.meanPrevLight = OV.meanLuma(S.prevLuma);
    S.meanCurrLight = OV.meanLuma(S.currLuma);
    S.globalLightShift = S.meanCurrLight - S.meanPrevLight;

    let rawTotal = 0;
    
    // Boucle de calcul linéaire (déterministe)
    for (let i = 0; i < S.N; i++) {
      const delta = S.currLuma[i] - S.prevLuma[i];
      const raw = Math.abs(delta);
      
      S.rawDiffPixels[i] = raw;
      rawTotal += raw;
      
      // Correction par masquage scalaire (supprime le if/else)
      const corrected = Math.abs(delta - S.globalLightShift);
      S.tracePixels[i] = (corrected > 2.2) ? corrected : 0;
    }

    S.rawInstant = rawTotal / S.N;
    S.diffPixels = S.tracePixels;
    return S.rawInstant;
  };

  OV.updateParallaxeVivante = () => {
    const config = OV.Registry[OV.CurrentMode];
    
    // Boucle de parallaxe purifiée
    for (let zi = 0; zi < S.ZONE_COUNT; zi++) {
      const activity = S.zonesDelta ? S.zonesDelta[zi] : 0;
      
      // Calcul du support par masquage arithmétique (sans conditionnel)
      const sup = Math.max(0, activity - config.threshold) * 0.45;
      const weight = (sup > 0.15) ? 1 : 0;

      // Application directe du poids
      S.parallaxDx[zi] *= weight;
      S.parallaxDy[zi] *= weight;
    }
  };

  // --- Initialisation ---
  OV.setMode('FIXE');

})();
