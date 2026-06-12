(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  OV.extractLuma = (data) => {
    for (let p = 0, i = 0; p < S.N; p++, i += 4) {
      S.currLuma[p] = ((data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8);
    }
  };

  OV.meanLuma = (buf) => {
    let sum = 0;
    let count = 0;
    const step = S.W <= 320 ? 2 : 4;

    for (let y = 0; y < S.H; y += step) {
      const row = y * S.W;
      for (let x = 0; x < S.W; x += step) {
        sum += buf[row + x];
        count++;
      }
    }

    return count ? sum / count : 0;
  };

  OV.computeTraceMotionScore = () => {
    let border = 0, center = 0, borderCount = 0, centerCount = 0;
    const marginX = Math.max(8, Math.floor(S.W * 0.12));
    const marginY = Math.max(8, Math.floor(S.H * 0.12));
    const step = S.W <= 320 ? 2 : 4;

    for (let y = 0; y < S.H; y += step) {
      for (let x = 0; x < S.W; x += step) {
        const p = y * S.W + x;
        const d = S.diffPixels[p];

        if (x < marginX || x >= S.W - marginX || y < marginY || y >= S.H - marginY) {
          border += d;
          borderCount++;
        } else {
          center += d;
          centerCount++;
        }
      }
    }

    const b = borderCount ? border / borderCount : 0;
    const c = centerCount ? center / centerCount : 0;
    return Math.min(99, (b + c) * 0.5);
  };

  OV.updateTraceRegime = (instant) => {
    const absShift = Math.abs(S.globalLightShift);

    if (S.frameId < S.INIT_FRAMES) return "InitialisationΔ";
    if (S.antiFlashActive) return "AntiFlashRéelΔ actif";
    if (absShift > 10 && instant < S.rawInstant * 0.72) return "FlashGlobalΔ corrigé";
    if (S.traceMotionScore > 18 && instant > 10) return "TraceGlissanteΔ";
    if (S.rawInstant > 28 && instant < S.rawInstant * 0.65) return "CorrectionProjectionΔ active";
    if (instant < 3.5) return "TraceStableΔ";
    return "LectureActiveΔ";
  };

  OV.computeDiffAndInstant = () => {
    S.meanPrevLight = OV.meanLuma(S.prevLuma);
    S.meanCurrLight = OV.meanLuma(S.currLuma);
    S.globalLightShift = S.meanCurrLight - S.meanPrevLight;

    let rawTotal = 0;
    let validTotal = 0;
    let rising = 0;
    let falling = 0;
    let active = 0;
    const minActive = 3;

    for (let i = 0; i < S.N; i++) {
      const delta = S.currLuma[i] - S.prevLuma[i];
      const raw = Math.abs(delta);

      S.rawDiffPixels[i] = raw;
      rawTotal += raw;

      if (raw >= minActive) {
        active++;
        if (delta > 0) rising++;
        else if (delta < 0) falling++;
      }
    }

    S.rawInstant = rawTotal / S.N;
    S.risingRatio = active ? rising / active : 0;
    S.fallingRatio = active ? falling / active : 0;
    S.sameDirectionRatio = Math.max(S.risingRatio, S.fallingRatio);

    const activeRatio = active / S.N;
    S.flashGlobalScore = S.rawInstant * S.sameDirectionRatio * Math.min(1, activeRatio * 2.2);

    S.antiFlashActive =
      S.frameId >= S.INIT_FRAMES &&
      S.rawInstant > 3.0 &&
      activeRatio > 0.42 &&
      S.sameDirectionRatio > 0.68;

    for (let i = 0; i < S.N; i++) {
      const delta = S.currLuma[i] - S.prevLuma[i];

      // Correction instrumentale : stabilise la Trace, pas le réel.
      const corrected = Math.abs(delta - S.globalLightShift);

      let valid = corrected;

      if (S.antiFlashActive) {
        // Si toute l’image pompe, seule la rupture locale très excédentaire nourrit la trace.
        const localExcess = Math.max(0, corrected - S.rawInstant * 0.55);
        valid = localExcess * 0.55;
      }

      if (valid < 2.2) valid = 0;

      const d = OV.clamp(valid, 0, 255);
      S.tracePixels[i] = d;
      validTotal += d;
    }

    S.diffPixels = S.tracePixels;
    S.validInstant = validTotal / S.N;

    S.traceMotionScore = OV.computeTraceMotionScore();
    S.traceRegime = OV.updateTraceRegime(S.validInstant);

    return S.validInstant;
  };

  OV.initTemporalAndMemory = (data) => {
    for (let p = 0, i = 0; p < S.N; p++, i += 4) {
      S.temporalFast[p] = S.currLuma[p];
      S.temporalSlow[p] = S.currLuma[p];

      S.memR[p] = data[i];
      S.memG[p] = data[i + 1];
      S.memB[p] = data[i + 2];
    }
    S.memReady = true;
  };

  OV.updateTemporal = () => {
    let high = 0, mid = 0, low = 0;
    const fastAlpha = 0.30;
    const slowAlpha = 0.015;

    for (let i = 0; i < S.N; i++) {
      const c = S.currLuma[i];
      const pr = S.prevLuma[i];

      const h = S.diffPixels[i];
      S.temporalFast[i] = S.temporalFast[i] * (1 - fastAlpha) + c * fastAlpha;
      S.temporalSlow[i] = S.temporalSlow[i] * (1 - slowAlpha) + c * slowAlpha;

      const m = Math.abs(c - S.temporalFast[i]);
      const l = Math.abs(S.temporalFast[i] - S.temporalSlow[i]);

      high += h;
      mid += m;
      low += l;
    }

    return [high / S.N, mid / S.N, low / S.N];
  };

  OV.computeZonesAndFoyer = () => {
    S.zonesDelta.fill(0);
    const counts = new Uint16Array(S.ZONE_COUNT);

    for (let y = 0; y < S.H; y++) {
      const zy = Math.floor(y * S.ZONE_ROWS / S.H);
      const row = y * S.W;

      for (let x = 0; x < S.W; x++) {
        const zx = Math.floor(x * S.ZONE_COLS / S.W);
        const zi = zy * S.ZONE_COLS + zx;
        const p = row + x;

        S.zonesDelta[zi] += S.diffPixels[p];
        counts[zi]++;
      }
    }

    let bestI = 0, bestV = 0;
    let weightedX = 0, weightedY = 0, weightSum = 0;

    const candidates = [];

    for (let i = 0; i < S.ZONE_COUNT; i++) {
      S.zonesDelta[i] = counts[i] ? S.zonesDelta[i] / counts[i] : 0;

      if (S.zonesDelta[i] > bestV) {
        bestV = S.zonesDelta[i];
        bestI = i;
      }

      const active = Math.max(0, S.zonesDelta[i] - 5);
      if (active > 0) {
        const zx = i % S.ZONE_COLS;
        const zy = Math.floor(i / S.ZONE_COLS);
        const cx = (zx + 0.5) * S.W / S.ZONE_COLS;
        const cy = (zy + 0.5) * S.H / S.ZONE_ROWS;

        weightedX += cx * active;
        weightedY += cy * active;
        weightSum += active;

        candidates.push({ x: cx, y: cy, v: active, i });
      }
    }

    OV.updateFoyerVivant(weightedX, weightedY, weightSum, bestV, candidates);

    return [bestI, bestV, OV.rankFromVariation(bestV)];
  };

  OV.updateFoyerVivant = (weightedX, weightedY, weightSum, bestV, candidates) => {
    if (weightSum <= 0 || bestV < 4) {
      S.foyerStrength *= 0.94;
      S.foyerStableAge = Math.max(0, S.foyerStableAge - 1);
      if (S.foyerStrength < 0.04) S.foyerLocked = false;
      S.foyerSecondary = [];
      return;
    }

    const targetX = weightedX / weightSum;
    const targetY = weightedY / weightSum;

    const dx = targetX - S.foyerX;
    const dy = targetY - S.foyerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxJump = Math.max(S.W, S.H) * 0.18;

    let a = 0.12;
    if (!S.foyerLocked) a = 0.24;
    else if (dist < maxJump * 0.35) a = 0.20;
    else if (dist < maxJump) a = 0.075;
    else a = 0.028;

    if (S.traceRegime.includes("TraceGlissante")) a *= 0.45;

    S.foyerX = S.foyerX * (1 - a) + targetX * a;
    S.foyerY = S.foyerY * (1 - a) + targetY * a;

    const forceTarget = Math.min(1, weightSum / 1600);
    S.foyerStrength = S.foyerStrength * 0.82 + forceTarget * 0.18;

    S.foyerStableAge++;
    if (S.foyerStableAge > 6 && S.foyerStrength > 0.08) S.foyerLocked = true;

    // Foyers secondaires légers : pas de reconnaissance, seulement autres concentrations.
    candidates.sort((a, b) => b.v - a.v);
    const secondary = [];
    for (const c of candidates) {
      const dMain = Math.hypot(c.x - S.foyerX, c.y - S.foyerY);
      if (dMain < Math.min(S.W, S.H) * 0.12) continue;

      let ok = true;
      for (const s of secondary) {
        if (Math.hypot(c.x - s.x, c.y - s.y) < Math.min(S.W, S.H) * 0.16) {
          ok = false;
          break;
        }
      }

      if (ok) secondary.push(c);
      if (secondary.length >= 2) break;
    }
    S.foyerSecondary = secondary;
  };

  OV.updatePulsationLumineuse = () => {
    // PulsationLumineuseΔ : lecture par zones du comportement temporel lumineux.
    // Léger : on réutilise la grille existante, pas de gros calcul IA.
    const sums = new Float32Array(S.ZONE_COUNT);
    const sats = new Float32Array(S.ZONE_COUNT);
    const counts = new Uint16Array(S.ZONE_COUNT);

    const satThreshold = 244;

    for (let y = 0; y < S.H; y++) {
      const zy = Math.floor(y * S.ZONE_ROWS / S.H);
      const row = y * S.W;

      for (let x = 0; x < S.W; x++) {
        const zx = Math.floor(x * S.ZONE_COLS / S.W);
        const zi = zy * S.ZONE_COLS + zx;
        const p = row + x;
        const l = S.currLuma[p];

        sums[zi] += l;
        if (l >= satThreshold) sats[zi] += 1;
        counts[zi] += 1;
      }
    }

    let totalAmp = 0;
    let totalSat = 0;
    let bestI = 0;
    let bestV = 0;

    const fastA = 0.42;
    const slowA = 0.035;

    for (let i = 0; i < S.ZONE_COUNT; i++) {
      const mean = counts[i] ? sums[i] / counts[i] : 0;
      const sat = counts[i] ? sats[i] / counts[i] : 0;

      S.pulseMean[i] = mean;
      S.pulseSat[i] = sat;

      if (!S.pulseReady) {
        S.pulseFast[i] = mean;
        S.pulseSlow[i] = mean;
        S.pulseAmp[i] = 0;
      } else {
        S.pulseFast[i] = S.pulseFast[i] * (1 - fastA) + mean * fastA;
        S.pulseSlow[i] = S.pulseSlow[i] * (1 - slowA) + mean * slowA;

        // Amp = séparation rapide/lente + un peu de trace validée locale.
        let amp = Math.abs(S.pulseFast[i] - S.pulseSlow[i]) + S.zonesDelta[i] * 0.35;

        // Si AntiFlashRéelΔ est actif, on évite que le pompage global allume tout.
        if (S.antiFlashActive) amp *= 0.45;

        // Saturation/halo : marque spécifique.
        amp += sat * 38;

        // Mémoire courte de pulsation.
        S.pulseAmp[i] = S.pulseAmp[i] * 0.72 + amp * 0.28;
      }

      totalAmp += S.pulseAmp[i];
      totalSat += sat;

      if (S.pulseAmp[i] > bestV) {
        bestV = S.pulseAmp[i];
        bestI = i;
      }
    }

    S.pulseReady = true;
    S.pulseGlobal = totalAmp / S.ZONE_COUNT;
    S.pulseSaturation = totalSat / S.ZONE_COUNT;
    S.pulseMaxZone = bestI;
    S.pulseMaxValue = bestV;
  };

  OV.updateParallaxeVivante = () => {
    // ParallaxeVivanteΔ v0.9.1 :
    // ne lit plus partout. Lit seulement les zones avec tenue locale.
    // But : moins de mosaïque, plus de lecture proche/moyen/fond.
    const sums = new Float32Array(S.ZONE_COUNT);
    const counts = new Uint16Array(S.ZONE_COUNT);

    for (let y = 0; y < S.H; y++) {
      const zy = Math.floor(y * S.ZONE_ROWS / S.H);
      const row = y * S.W;

      for (let x = 0; x < S.W; x++) {
        const zx = Math.floor(x * S.ZONE_COLS / S.W);
        const zi = zy * S.ZONE_COLS + zx;
        const p = row + x;

        sums[zi] += S.currLuma[p];
        counts[zi] += 1;
      }
    }

    for (let i = 0; i < S.ZONE_COUNT; i++) {
      S.parallaxCurrMean[i] = counts[i] ? sums[i] / counts[i] : 0;
    }

    if (!S.parallaxReady) {
      S.parallaxPrevMean.set(S.parallaxCurrMean);
      S.parallaxDepth.fill(0);
      S.parallaxDx.fill(0);
      S.parallaxDy.fill(0);
      S.parallaxReady = true;
      S.parallaxGlobalDx = 0;
      S.parallaxGlobalDy = 0;
      S.parallaxGlobalMotion = 0;
      S.parallaxMaxValue = 0;
      S.parallaxMaxZone = 0;
      S.parallaxUsableZones = 0;
      S.parallaxMotionOk = false;
      return;
    }

    const support = new Float32Array(S.ZONE_COUNT);
    const rawDepth = new Float32Array(S.ZONE_COUNT);

    let sumDx = 0;
    let sumDy = 0;
    let sumW = 0;
    let usable = 0;

    // 1. Déplacement local, mais seulement si la zone possède une tenue/structure.
    for (let zy = 1; zy < S.ZONE_ROWS - 1; zy++) {
      for (let zx = 1; zx < S.ZONE_COLS - 1; zx++) {
        const zi = zy * S.ZONE_COLS + zx;
        const current = S.parallaxCurrMean[zi];

        const activity = S.zonesDelta ? S.zonesDelta[zi] : 0;
        const pulse = S.pulseAmp ? S.pulseAmp[zi] : 0;

        // Texture locale : différence avec voisins actuels.
        const left = zy * S.ZONE_COLS + (zx - 1);
        const right = zy * S.ZONE_COLS + (zx + 1);
        const up = (zy - 1) * S.ZONE_COLS + zx;
        const down = (zy + 1) * S.ZONE_COLS + zx;

        const texture =
          Math.abs(S.parallaxCurrMean[right] - S.parallaxCurrMean[left]) * 0.5 +
          Math.abs(S.parallaxCurrMean[down] - S.parallaxCurrMean[up]) * 0.5;

        // SupportΔ : la zone doit avoir une raison d'être lue.
        let sup =
          Math.max(0, activity - 4.0) * 0.45 +
          Math.max(0, texture - 2.5) * 0.08 +
          Math.max(0, pulse - 1.5) * 0.05;

        if (S.antiFlashActive) sup *= 0.50;

        support[zi] = sup;

        if (sup <= 0.15) {
          S.parallaxDx[zi] = 0;
          S.parallaxDy[zi] = 0;
          continue;
        }

        usable++;

        let bestErr = Infinity;
        let bestDx = 0;
        let bestDy = 0;

        // Cherche le voisin précédent le plus compatible.
        // Petite fenêtre seulement pour rester léger et éviter le délire.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ni = (zy + dy) * S.ZONE_COLS + (zx + dx);
            const err = Math.abs(current - S.parallaxPrevMean[ni]);

            // Pénalité légère pour éviter de choisir un déplacement sans preuve.
            const penalty = (dx === 0 && dy === 0) ? 0 : 0.85;
            const score = err + penalty;

            if (score < bestErr) {
              bestErr = score;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        S.parallaxDx[zi] = bestDx;
        S.parallaxDy[zi] = bestDy;

        const w = Math.min(1, sup);
        sumDx += bestDx * w;
        sumDy += bestDy * w;
        sumW += w;
      }
    }

    const gdx = sumW ? sumDx / sumW : 0;
    const gdy = sumW ? sumDy / sumW : 0;

    S.parallaxGlobalDx = S.parallaxGlobalDx * 0.72 + gdx * 0.28;
    S.parallaxGlobalDy = S.parallaxGlobalDy * 0.72 + gdy * 0.28;
    S.parallaxGlobalMotion = Math.hypot(S.parallaxGlobalDx, S.parallaxGlobalDy);
    S.parallaxUsableZones = usable;
    S.parallaxMotionOk = usable > Math.max(8, S.ZONE_COUNT * 0.006) && (S.parallaxGlobalMotion > 0.025 || S.rawInstant > 2.2);

    // 2. Profondeur relative : seulement les zones supportées.
    for (let zy = 1; zy < S.ZONE_ROWS - 1; zy++) {
      for (let zx = 1; zx < S.ZONE_COLS - 1; zx++) {
        const zi = zy * S.ZONE_COLS + zx;
        const sup = support[zi];

        if (sup <= 0.15 || !S.parallaxMotionOk) {
          rawDepth[zi] = 0;
          continue;
        }

        const rx = S.parallaxDx[zi] - S.parallaxGlobalDx;
        const ry = S.parallaxDy[zi] - S.parallaxGlobalDy;
        const rel = Math.hypot(rx, ry);

        const activity = S.zonesDelta ? S.zonesDelta[zi] : 0;
        const pulse = S.pulseAmp ? S.pulseAmp[zi] : 0;

        let depth =
          rel * 14.0 +
          Math.max(0, activity - 5.0) * 0.55 +
          Math.max(0, pulse - 2.0) * 0.10;

        depth *= Math.min(1, sup * 0.75);

        if (S.antiFlashActive) depth *= 0.45;

        rawDepth[zi] = depth;
      }
    }

    // 3. Lissage spatial léger : garder les masses cohérentes, tuer pixels isolés.
    let bestI = 0;
    let bestV = 0;

    for (let zy = 1; zy < S.ZONE_ROWS - 1; zy++) {
      for (let zx = 1; zx < S.ZONE_COLS - 1; zx++) {
        const zi = zy * S.ZONE_COLS + zx;

        let sum = 0;
        let cnt = 0;
        let strongN = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ni = (zy + dy) * S.ZONE_COLS + (zx + dx);
            const v = rawDepth[ni];
            sum += v;
            cnt++;
            if (v > 3.0) strongN++;
          }
        }

        let smoothed = cnt ? sum / cnt : 0;

        // Si isolé, on éteint.
        if (strongN < 2) smoothed *= 0.20;

        S.parallaxDepth[zi] = S.parallaxDepth[zi] * 0.82 + smoothed * 0.18;

        if (S.parallaxDepth[zi] < 0.85) S.parallaxDepth[zi] = 0;

        if (S.parallaxDepth[zi] > bestV) {
          bestV = S.parallaxDepth[zi];
          bestI = zi;
        }
      }
    }

    // Nettoyer les bords.
    for (let zx = 0; zx < S.ZONE_COLS; zx++) {
      S.parallaxDepth[zx] = 0;
      S.parallaxDepth[(S.ZONE_ROWS - 1) * S.ZONE_COLS + zx] = 0;
    }
    for (let zy = 0; zy < S.ZONE_ROWS; zy++) {
      S.parallaxDepth[zy * S.ZONE_COLS] = 0;
      S.parallaxDepth[zy * S.ZONE_COLS + (S.ZONE_COLS - 1)] = 0;
    }

    S.parallaxMaxValue = bestV;
    S.parallaxMaxZone = bestI;

    S.parallaxPrevMean.set(S.parallaxCurrMean);
  };

  OV.computePresences = () => {
    S.presenceGrid.fill(0);

    const threshold = 7.0;
    const minCells = S.W <= 320 ? 2 : 3;
    const maxPresences = 8;

    for (let i = 0; i < S.ZONE_COUNT; i++) {
      if (S.zonesDelta[i] >= threshold) S.presenceGrid[i] = 1;
    }

    const visited = new Uint8Array(S.ZONE_COUNT);
    const groups = [];
    const q = [];

    for (let i = 0; i < S.ZONE_COUNT; i++) {
      if (!S.presenceGrid[i] || visited[i]) continue;

      visited[i] = 1;
      q.length = 0;
      q.push(i);

      let minX = S.ZONE_COLS, minY = S.ZONE_ROWS, maxX = 0, maxY = 0;
      let cells = 0, sum = 0, wx = 0, wy = 0;

      while (q.length) {
        const cur = q.pop();
        const zx = cur % S.ZONE_COLS;
        const zy = Math.floor(cur / S.ZONE_COLS);
        const v = S.zonesDelta[cur];

        cells++;
        sum += v;
        wx += (zx + 0.5) * v;
        wy += (zy + 0.5) * v;

        if (zx < minX) minX = zx;
        if (zy < minY) minY = zy;
        if (zx > maxX) maxX = zx;
        if (zy > maxY) maxY = zy;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = zx + dx;
            const ny = zy + dy;
            if (nx < 0 || nx >= S.ZONE_COLS || ny < 0 || ny >= S.ZONE_ROWS) continue;

            const ni = ny * S.ZONE_COLS + nx;
            if (S.presenceGrid[ni] && !visited[ni]) {
              visited[ni] = 1;
              q.push(ni);
            }
          }
        }
      }

      if (cells >= minCells) {
        const avg = sum / cells;
        const cxZone = sum > 0 ? wx / sum : (minX + maxX + 1) / 2;
        const cyZone = sum > 0 ? wy / sum : (minY + maxY + 1) / 2;

        groups.push({
          cells,
          avg,
          strength: sum,
          rank: OV.rankFromVariation(avg),
          x: minX * S.W / S.ZONE_COLS,
          y: minY * S.H / S.ZONE_ROWS,
          w: (maxX - minX + 1) * S.W / S.ZONE_COLS,
          h: (maxY - minY + 1) * S.H / S.ZONE_ROWS,
          cx: cxZone * S.W / S.ZONE_COLS,
          cy: cyZone * S.H / S.ZONE_ROWS
        });
      }
    }

    groups.sort((a, b) => b.strength - a.strength);
    S.presences = groups.slice(0, maxPresences);
  };

  OV.updatePresenceTenue = () => {
    const maxDist = Math.max(S.W, S.H) * 0.10;
    const nextMemory = [];
    const used = new Uint8Array(S.presences.length);

    for (const mem of S.presenceMemory) {
      let bestI = -1;
      let bestD = Infinity;

      for (let i = 0; i < S.presences.length; i++) {
        if (used[i]) continue;
        const p = S.presences[i];
        const d = Math.hypot(p.cx - mem.cx, p.cy - mem.cy);

        if (d < bestD && d < maxDist) {
          bestD = d;
          bestI = i;
        }
      }

      if (bestI >= 0) {
        used[bestI] = 1;
        const p = S.presences[bestI];

        nextMemory.push({
          id: mem.id,
          cx: mem.cx * 0.70 + p.cx * 0.30,
          cy: mem.cy * 0.70 + p.cy * 0.30,
          x: mem.x * 0.70 + p.x * 0.30,
          y: mem.y * 0.70 + p.y * 0.30,
          w: mem.w * 0.70 + p.w * 0.30,
          h: mem.h * 0.70 + p.h * 0.30,
          avg: mem.avg * 0.70 + p.avg * 0.30,
          strength: mem.strength * 0.70 + p.strength * 0.30,
          cells: p.cells,
          rank: p.rank,
          age: mem.age + 1,
          seen: Math.min(99, mem.seen + 1),
          missing: 0
        });
      } else if (mem.missing < 4) {
        nextMemory.push({
          ...mem,
          missing: mem.missing + 1,
          age: mem.age + 1,
          seen: Math.max(0, mem.seen - 1)
        });
      }
    }

    for (let i = 0; i < S.presences.length; i++) {
      if (used[i]) continue;
      const p = S.presences[i];

      nextMemory.push({
        id: S.presenceNextId++,
        cx: p.cx,
        cy: p.cy,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        avg: p.avg,
        strength: p.strength,
        cells: p.cells,
        rank: p.rank,
        age: 1,
        seen: 1,
        missing: 0
      });
    }

    S.presenceMemory = nextMemory
      .filter(p => p.missing <= 4)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 12);

    S.stablePresences = S.presenceMemory
      .filter(p => p.seen >= 3 && p.missing === 0)
      .slice(0, 8);
  };
})();
