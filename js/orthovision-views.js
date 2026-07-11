(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  // --- LUTs (Tables de correspondances) ---
  // Pré-calculé pour couvrir 0 à 60 (valeurs d'intensité courantes)
  const LUT_SPECTRAL = new Uint8Array(64 * 3); // 64 indices, 3 composantes RGB
  
  // Initialisation unique au démarrage
  function initLUTs() {
    for (let v = 0; v < 64; v++) {
      let r, g, b;
      // Logique continue sans branchement
      r = Math.min(255, Math.max(0, (v - 24) * 10));
      g = Math.min(255, Math.max(0, (v - 10) * 15));
      b = Math.min(255, Math.max(0, v * 4));
      
      LUT_SPECTRAL[v * 3]     = r;
      LUT_SPECTRAL[v * 3 + 1] = g;
      LUT_SPECTRAL[v * 3 + 2] = b;
    }
  }
  initLUTs();

  // --- Fonctions de Rendu Purifiées ---

  // Remplaçant de spectralColor : accès mémoire O(1) sans condition
  function spectralColorPure(v) {
    const idx = Math.min(63, Math.floor(v)) * 3;
    return OV.rgba(LUT_SPECTRAL[idx], LUT_SPECTRAL[idx+1], LUT_SPECTRAL[idx+2]);
  }

  // Remplaçant de zoneColor (Palette fixe)
  const ZONE_LUT = [
    [0, 0, 0], [16, 16, 16], [48, 48, 0], [112, 96, 0], 
    [176, 128, 0], [208, 64, 0], [255, 0, 0], [255, 255, 255]
  ];

  function zoneColorPure(v) {
    // Supposons que rankIndexFromVariation renvoie 0-7
    const rank = OV.rankIndexFromVariation(v);
    const c = ZONE_LUT[rank];
    return OV.rgba(c[0], c[1], c[2]);
  }

  // --- Intégration dans drawMembraneFine ---
  OV.drawMembraneFine = (ctx, img, spectral = false) => {
    const out = img.data;
    for (let p = 0; p < S.N; p++) {
      const v = S.diffPixels[p]; // Valeur brute
      
      // Accès direct sans if
      const idx = Math.min(63, Math.floor(v)) * 3;
      const r = LUT_SPECTRAL[idx];
      const g = LUT_SPECTRAL[idx+1];
      const b = LUT_SPECTRAL[idx+2];
      
      const i = p * 4;
      out[i] = r; out[i+1] = g; out[i+2] = b; out[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
})();
