(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  // --- Fonctions de transfert sans branchement ---
  
  // Remplace le switch/case de zoneColor
  const ZONE_PALETTE = [
    [0, 0, 0], [16, 16, 16], [48, 48, 0], [112, 96, 0], 
    [176, 128, 0], [208, 64, 0], [255, 0, 0], [255, 255, 255]
  ];

  function zoneColorPure(v) {
    // Conversion de rang (O=0, U=1... H=7)
    const rank = OV.rankIndexFromVariation(v); // Assure-toi que cette fonction renvoie l'index 0-7
    const c = ZONE_PALETTE[rank] || [0, 0, 0];
    return OV.rgba(c[0], c[1], c[2]);
  }

  // --- Rendu optimisé ---

  OV.drawZones = (ctx, img) => {
    const out = img.data;
    out.fill(0);

    for (let zi = 0; zi < S.ZONE_COUNT; zi++) {
      const c = zoneColorPure(S.zonesDelta[zi]);
      const zx = zi % S.ZONE_COLS;
      const zy = Math.floor(zi / S.ZONE_COLS);
      
      const x0 = Math.floor(zx * S.W / S.ZONE_COLS);
      const x1 = Math.floor((zx + 1) * S.W / S.ZONE_COLS);
      const y0 = Math.floor(zy * S.H / S.ZONE_ROWS);
      const y1 = Math.floor((zy + 1) * S.H / S.ZONE_ROWS);

      for (let y = y0; y < y1; y++) {
        const row = y * S.W;
        for (let x = x0; x < x1; x++) {
          OV.putPixel(out, row + x, c);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  OV.drawContrasteOrganique = (ctx, img) => {
    const data = img.data;
    const flashReduce = S.antiFlashActive ? 0.45 : 1.0;

    for (let p = 0; p < S.N; p++) {
      const i = p * 4;
      const x = p % S.W;
      const y = Math.floor(p / S.W);
      
      // Calcul du gain sans "if" (masquage scalaire)
      const dist = Math.hypot(x - S.foyerX, y - S.foyerY);
      const foyerGain = OV.clamp(1 - dist / Math.max(24, Math.min(S.W, S.H) * 0.2), 0, 1) * S.foyerStrength;
      
      const organic = OV.clamp(localEdgeAt(x, y) / 42, 0, 1) * 0.55 +
                      OV.clamp(S.diffPixels[p] / 28, 0, 1) * 0.30 +
                      foyerGain * 0.22;

      const contrast = 1.0 + organic * flashReduce * 0.55;
      
      // Application linéaire
      data[i]     = OV.clamp(128 + (data[i] - 128) * contrast, 0, 255);
      data[i + 1] = OV.clamp(128 + (data[i + 1] - 128) * contrast, 0, 255);
      data[i + 2] = OV.clamp(128 + (data[i + 2] - 128) * contrast, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
  };

  // ... (Appliquer le même principe de suppression de conditionnel à drawParallaxeVivante)
})();
