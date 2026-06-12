(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  const video = OV.$("video");
  const canvas = OV.$("view");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const hud = OV.$("hud");
  const hudLines = OV.$("hud-lines");

  function drawHud(info) {
    if (hud.classList.contains("hidden")) return;

    const topPresence = S.stablePresences[0];
    const presenceTxt = topPresence
      ? `P${topPresence.id} ${topPresence.rank} ${topPresence.avg.toFixed(1)} tenue ${topPresence.seen}`
      : "aucune";

    hudLines.innerHTML = [
      `Mode : ${OV.MODES[S.modeIndex]}`,
      `QualitéΔ : ${OV.QUALITIES[S.qualityIndex].name} ${S.W}×${S.H}`,
      `Frame : ${S.frameId} | FPS : ${S.fps.toFixed(1)} | ${S.paused ? "PAUSE" : "LIVE"}`,
      `Instant : ${info.instant.toFixed(2)} RangΔ=${OV.rankFromVariation(info.instant)}`,
      `Tenu : ${info.mean.toFixed(2)} RangTenuΔ=${OV.rankFromVariation(info.mean)}`,
      `Stabilité : ${info.stability.toFixed(2)} | ${info.state}`,
      `TraceΔ : ${S.traceRegime} | raw ${S.rawInstant.toFixed(2)} / valide ${S.validInstant.toFixed(2)}`,
      `AntiFlashΔ : ${S.antiFlashActive ? "ON" : "OFF"} | sens ${(S.sameDirectionRatio * 100).toFixed(0)}% | score ${S.flashGlobalScore.toFixed(2)}`,
      `FoyerVivantΔ : ${S.foyerX.toFixed(0)},${S.foyerY.toFixed(0)} force ${S.foyerStrength.toFixed(2)} ${S.foyerLocked ? "verrouillé" : "souple"}`,
      `PulsationLumineuseΔ : G${S.pulseGlobal.toFixed(2)} / max ${S.pulseMaxValue.toFixed(2)} / sat ${(S.pulseSaturation*100).toFixed(1)}%`,
      `ParallaxeVivanteΔ : ${S.parallaxMotionOk ? "OK" : "attente"} | max ${S.parallaxMaxValue.toFixed(2)} | zones ${S.parallaxUsableZones} | global (${S.parallaxGlobalDx.toFixed(2)},${S.parallaxGlobalDy.toFixed(2)})`,
      `PrésencesΔ : ${S.stablePresences.length}/${S.presences.length} | ${presenceTxt}`,
      `Multi : H${info.multi[0].toFixed(2)} / M${info.multi[1].toFixed(2)} / L${info.multi[2].toFixed(2)}`,
      `AudioPulseΔ : ${S.audioEnabled ? "ON" : "OFF"} L${S.audioLevel.toFixed(2)}`
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
    const [zoneI, zoneV, zoneRank] = OV.computeZonesAndFoyer();

    OV.computePresences();
    OV.updatePresenceTenue();
    OV.updatePulsationLumineuse();
    OV.updateParallaxeVivante();

    OV.pushHist(instant);
    const mean = OV.meanHist();
    const stability = OV.stabilityHist(mean);
    const state = OV.stateDelta(S.frameId, instant, mean, stability);

    OV.updateAudio();

    const mode = OV.MODES[S.modeIndex];

    if (mode === "IMAGE") OV.drawImage(ctx, img);
    else if (mode === "IMAGE+TRACE") OV.drawImageTrace(ctx, img);
    else if (mode === "TRACE SEULE") OV.drawTraceOnly(ctx, img);
    else if (mode === "ZONES DELTA") OV.drawZones(ctx, img);
    else if (mode === "MEMBRANE FINE") OV.drawMembraneFine(ctx, img, false);
    else if (mode === "SPECTRE DELTA") OV.drawMembraneFine(ctx, img, true);
    else if (mode === "MULTI ECHELLE") OV.drawMultiEchelle(ctx, img);
    else if (mode === "CARTE CALME") OV.drawCarteCalme(ctx, img);
    else if (mode === "FOYER DELTA") OV.drawFoyerDelta(ctx, img);
    else if (mode === "FOYER VIVANT") OV.drawFoyerVivant(ctx, img);
    else if (mode === "PRESENCE DELTA") OV.drawPresenceDelta(ctx, img);
    else if (mode === "MEMOIRE VIVE") OV.drawMemoireVive(ctx, img);
    else if (mode === "PULSATION LUMINEUSE") OV.drawPulsationLumineuse(ctx, img);
    else if (mode === "CONTRASTE ORGANIQUE") OV.drawContrasteOrganique(ctx, img);
    else if (mode === "RELIEF OPTIQUE") OV.drawReliefOptique(ctx, img);
    else if (mode === "RELIEF PUR") OV.drawReliefPur(ctx, img);
    else if (mode === "RELIEF NOIR") OV.drawReliefNoir(ctx, img);
    else if (mode === "PARALLAXE VIVANTE") OV.drawParallaxeVivante(ctx, img);
    else if (mode === "AUDIOPULSE") OV.drawAudioPulse(ctx, img);

    drawHud({ instant, mean, stability, state, zoneI, zoneV, zoneRank, multi });

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
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Ce navigateur ne supporte pas getUserMedia.");
      return;
    }

    if (S.stream) {
      S.stream.getTracks().forEach(t => t.stop());
      S.stream = null;
    }

    const q = OV.QUALITIES[S.qualityIndex];

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: S.facingMode },
        width: { ideal: q.w },
        height: { ideal: q.h },
        frameRate: { ideal: 30 }
      }
    };

    S.stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = S.stream;
    await video.play();

    OV.resetMemory();

    if (!S.running) {
      S.running = true;
      requestAnimationFrame(loop);
    }
  };

  OV.$("startBtn").addEventListener("click", async () => {
    try {
      await OV.startCamera();
    } catch (err) {
      alert("Impossible d’ouvrir la caméra : " + err.message);
      console.error(err);
    }
  });

  OV.$("modeBtn").addEventListener("click", () => {
    S.modeIndex = (S.modeIndex + 1) % OV.MODES.length;
  });

  OV.$("qualityBtn").addEventListener("click", async () => {
    S.qualityIndex = (S.qualityIndex + 1) % OV.QUALITIES.length;
    OV.$("qualityBtn").textContent = `QualitéΔ : ${OV.QUALITIES[S.qualityIndex].name}`;

    OV.allocBuffers();

    if (S.stream) {
      try {
        await OV.startCamera();
      } catch (err) {
        alert("Impossible de changer la qualité : " + err.message);
        console.error(err);
      }
    }
  });

  OV.$("pauseBtn").addEventListener("click", () => {
    S.paused = !S.paused;
    OV.$("pauseBtn").textContent = S.paused ? "Reprendre" : "Pause";
    OV.$("pauseBtn").classList.toggle("active", S.paused);
  });

  OV.$("hudBtn").addEventListener("click", () => {
    hud.classList.toggle("hidden");
  });

  OV.$("fullscreenBtn").addEventListener("click", async () => {
    const stage = OV.$("stage");
    try {
      if (!document.fullscreenElement) await stage.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.warn(err);
    }
  });

  OV.$("captureBtn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `orthovision_delta_${Date.now()}.png`;
    a.click();
  });

  OV.$("resetBtn").addEventListener("click", () => OV.resetMemory());

  OV.$("cameraBtn").addEventListener("click", async () => {
    S.facingMode = S.facingMode === "environment" ? "user" : "environment";
    if (!S.stream) return;

    try {
      await OV.startCamera();
    } catch (err) {
      alert("Impossible de changer de caméra : " + err.message);
      console.error(err);
    }
  });

  OV.$("audioBtn").addEventListener("click", async () => {
    try {
      await OV.startAudio();
    } catch (err) {
      alert("Impossible d’ouvrir le micro : " + err.message);
      console.error(err);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      S.modeIndex = (S.modeIndex + 1) % OV.MODES.length;
    }

    if (e.key.toLowerCase() === "r") OV.resetMemory();
    if (e.key.toLowerCase() === "h") hud.classList.toggle("hidden");
    if (e.key.toLowerCase() === "p") OV.$("pauseBtn").click();
  });

  drawHud({
    instant: 0,
    mean: 0,
    stability: 0,
    state: "En attente caméra",
    zoneI: 0,
    zoneV: 0,
    zoneRank: "O",
    multi: [0, 0, 0]
  });
})();
