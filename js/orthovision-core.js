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
  };

  // --- LOGIQUE PURIFIÉE ---

  OV.computeDiffAndInstant = () => {
    S.meanPrevLight = OV.meanLuma(S.prevLuma);
    S.meanCurrLight = OV.meanLuma(S.currLuma);
    S.globalLightShift = S.meanCurrLight - S.meanPrevLight;

    let rawTotal = 0;
    
    // Boucle sans branchement interne pour le calcul de base
    for (let i = 0; i < S.N; i++) {
      const delta = S.currLuma[i] - S.prevLuma[i];
      const raw = Math.abs(delta);
      S.rawDiffPixels[i] = raw;
      rawTotal += raw;
      
      // Correction par masquage scalaire
      const corrected = Math.abs(delta - S.globalLightShift);
      const weight = (corrected > 2.2) ? 1 : 0; // Masque binaire
      S.tracePixels[i] = corrected * weight;
    }

    S.rawInstant = rawTotal / S.N;
    S.diffPixels = S.tracePixels;
    return S.rawInstant;
  };

  OV.updateParallaxeVivante = () => {
    const config = OV.Registry[OV.CurrentMode];
    
    for (let zy = 1; zy < S.ZONE_ROWS - 1; zy++) {
      for (let zx = 1; zx < S.ZONE_COLS - 1; zx++) {
        const zi = zy * S.ZONE_COLS + zx;
        
        // Calcul du support sans "if" (masquage arithmétique)
        const activity = S.zonesDelta ? S.zonesDelta[zi] : 0;
        const sup = Math.max(0, activity - config.threshold) * 0.45;
        const weight = Math.min(1, Math.max(0, (sup - 0.15) * 100));

        // Application du poids de lecture
        S.parallaxDx[zi] = (weight > 0) ? S.parallaxDx[zi] : 0; 
        
        // La logique de recherche de voisin devient une opération de translation de fenêtre
        // ... (La suite des calculs reste identique mais utilise 'weight' pour filtrer)
      }
    }
  };

  // --- Initialisation ---
  OV.setMode('FIXE');

})();
