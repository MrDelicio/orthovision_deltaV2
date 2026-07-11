(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  const video = OV.$("video");
  const canvas = OV.$("view");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const hud = OV.$("hud");
  const hudLines = OV.$("hud-lines");

  // --- Dispatcher dynamique (Remplace les if/else) ---
  const RENDER_DISPATCH = {
    "IMAGE": OV.drawImage,
    "IMAGE+TRACE": OV.drawImageTrace,
    "TRACE SEULE": OV.drawTraceOnly,
    "ZONES DELTA": OV.drawZones,
    "MEMBRANE FINE": (c, i) => OV.drawMembraneFine(c, i, false),
    "SPECTRE DELTA": (c, i) => OV.drawMembraneFine(c, i, true),
    "MULTI ECHELLE": OV.drawMultiEchelle,
    "CARTE CALME": OV.drawCarteCalme,
    "FOYER DELTA": OV.drawFoyerDelta,
    "FOYER VIVANT": OV.drawFoyerVivant,
    "PRESENCE DELTA": OV.drawPresenceDelta,
    "MEMOIRE VIVE": OV.drawMemoireVive,
    "PULSATION LUMINEUSE": OV.drawPulsationLumineuse,
    "CONTRASTE ORGANIQUE": OV.drawContrasteOrganique,
    "RELIEF OPTIQUE": OV.drawReliefOptique,
    "RELIEF PUR": OV.drawReliefPur,
    "RELIEF NOIR": OV.drawReliefNoir,
    "PARALLAXE VIVANTE": OV.drawParallaxeVivante,
    "AUDIOPULSE": OV.drawAudioPulse
  };

  function renderFrame() {
    ctx.drawImage(video, 0, 0, S.W, S.H);
    const img = ctx.getImageData(0, 0, S.W, S.H);

    OV.extractLuma(img.data);

    if (S.first) {
      S.prevLuma.set(S.currLuma);
      OV.initTemporalAndMemory(img.data);
      S.first = false;
      return;
    }

    const instant = OV.computeDiffAndInstant();
    const multi = OV.updateTemporal();
    const [zoneI, zoneV, zoneRank] = OV.computeZonesAndFoyer();

    OV.computePresences();
    OV.updatePresenceTenue();
    OV.updatePulsationLumineuse();
    OV.updateParallaxeVivante();

    // Rendu dynamique via Dispatch
    const modeName = OV.MODES[S.modeIndex];
    const renderFn = RENDER_DISPATCH[modeName];
    if (renderFn) renderFn(ctx, img);

    drawHud({ instant, multi });
    S.prevLuma.set(S.currLuma);
    S.frameId++;
  }

  // --- Initialisation UI ---
  // On attache les événements de manière propre
  document.addEventListener('DOMContentLoaded', () => {
    // Si tu as gardé un sélecteur dans le HTML
    const modeSel = document.getElementById("modeSelector");
    if(modeSel) {
      modeSel.addEventListener('change', (e) => {
        const idx = OV.MODES.indexOf(e.target.value);
        if(idx !== -1) S.modeIndex = idx;
      });
    }
  });

  // ... (Garde tes fonctions startCamera et autres eventListeners ici)
  // Remarque : Le reste de la logique reste identique pour la compatibilité.
})();
