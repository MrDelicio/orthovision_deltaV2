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

  function drawHud(info) {
    if (hud.classList.contains("hidden")) return;
    const topPresence = S.stablePresences[0];
    const presenceTxt = topPresence ? `P${topPresence.id} ${topPresence.rank} ${topPresence.avg.toFixed(1)}` : "aucune";
    hudLines.innerHTML = [
      `Mode : ${OV.MODES[S.modeIndex]}`,
      `Frame : ${S.frameId} | FPS : ${S.fps.toFixed(1)}`,
      `Instant : ${info.instant.toFixed(2)}`,
      `Multi : H${info.multi[0].toFixed(2)} / M${info.multi[1].toFixed(2)} / L${info.multi[2].toFixed(2)}`,
      `Présences : ${presenceTxt}`
    ].join("<br>");
  }

  function updateFps() {
    S.fpsFrames++;
    const now = performance.now();
    if (now - S.lastFpsTime >= 500) {
      S.fps = S.fpsFrames * 1000 / (now - S.lastFpsTime);
      S.fpsFrames = 0;
      S.lastFpsTime = now;
    }
  }

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
    OV.computeZonesAndFoyer();
    OV.computePresences();
    OV.updatePresenceTenue();
    OV.updatePulsationLumineuse();
    OV.updateParallaxeVivante();

    // Rendu via Dispatch
    const modeName = OV.MODES[S.modeIndex];
    const renderFn = RENDER_DISPATCH[modeName];
    renderFn ? renderFn(ctx, img) : OV.drawImage(ctx, img);

    drawHud({ instant, multi });
    S.prevLuma.set(S.currLuma);
    S.frameId++;
  }

  function loop() {
    if (!S.running) return;
    if (!S.paused && video.readyState >= 2) {
      renderFrame();
      updateFps();
    }
    requestAnimationFrame(loop);
  }

  OV.startCamera = async () => {
    try {
      // Sécurisation de l'accès aux qualités
      if (!OV.QUALITIES || !OV.QUALITIES[S.qualityIndex]) S.qualityIndex = 1;
      const q = OV.QUALITIES[S.qualityIndex];
      
      if (S.stream) S.stream.getTracks().forEach(t => t.stop());
      
      S.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: S.facingMode }, 
          width: { ideal: q.w }, 
          height: { ideal: q.h } 
        } 
      });
      
      video.srcObject = S.stream;
      await video.play();
      OV.resetMemory();
      S.running = true;
      requestAnimationFrame(loop);
    } catch (e) { 
      alert("Caméra erreur : " + e.message); 
      console.error(e);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const modeSel = document.getElementById("modeSelector");
    if(modeSel) {
      modeSel.addEventListener('change', (e) => {
        const idx = OV.MODES.indexOf(e.target.value);
        if(idx !== -1) S.modeIndex = idx;
      });
    }

    OV.$("startBtn").addEventListener("click", OV.startCamera);
    OV.$("pauseBtn").addEventListener("click", () => { S.paused = !S.paused; });
    OV.$("hudBtn").addEventListener("click", () => hud.classList.toggle("hidden"));
    OV.$("fullscreenBtn").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : OV.$("stage").requestFullscreen());
    OV.$("captureBtn").addEventListener("click", () => {
      const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `ortho_${Date.now()}.png`; a.click();
    });
    OV.$("resetBtn").addEventListener("click", OV.resetMemory);
  });
})();
