(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  function lerp(a, b, t) {
    return a + (b - a) * OV.clamp(t, 0, 1);
  }

  function lerpColor(c1, c2, t) {
    return OV.rgba(lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t));
  }

  function spectralColor(v) {
    if (v < 1) return OV.rgba(0, 0, 0);
    if (v < 3) return lerpColor([0, 0, 20], [0, 40, 120], (v - 1) / 2);
    if (v < 6) return lerpColor([0, 40, 120], [0, 180, 255], (v - 3) / 3);
    if (v < 10) return lerpColor([0, 180, 255], [0, 255, 120], (v - 6) / 4);
    if (v < 16) return lerpColor([0, 255, 120], [255, 255, 0], (v - 10) / 6);
    if (v < 24) return lerpColor([255, 255, 0], [255, 140, 0], (v - 16) / 8);
    if (v < 36) return lerpColor([255, 140, 0], [255, 0, 0], (v - 24) / 12);
    return lerpColor([255, 0, 0], [255, 255, 255], (v - 36) / 24);
  }

  function smoothColor(v) {
    if (v < 2) return OV.rgba(0, 0, 0);
    if (v < 6) {
      const k = (v - 2) / 4;
      return OV.rgba(80 + 120 * k, 80 + 90 * k, 0);
    }
    if (v < 16) {
      const k = (v - 6) / 10;
      return OV.rgba(200 + 55 * k, 170 - 100 * k, 0);
    }
    if (v < 36) {
      const k = (v - 16) / 20;
      return OV.rgba(255, 70 - 70 * k, 0);
    }
    return OV.rgba(255, 255, 255);
  }

  function zoneColor(v) {
    switch (OV.rankFromVariation(v)) {
      case "O": return OV.rgba(0, 0, 0);
      case "U": return OV.rgba(16, 16, 16);
      case "B": return OV.rgba(48, 48, 0);
      case "T": return OV.rgba(112, 96, 0);
      case "Q": return OV.rgba(176, 128, 0);
      case "P": return OV.rgba(208, 64, 0);
      case "S": return OV.rgba(255, 0, 0);
      case "H": return OV.rgba(255, 255, 255);
      default: return OV.rgba(0, 0, 0);
    }
  }

  function avgDiffAt(x, y, radius = 1) {
    let sum = 0, count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= S.H) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= S.W) continue;
        sum += S.diffPixels[ny * S.W + nx];
        count++;
      }
    }
    return count ? sum / count : 0;
  }

  OV.drawImage = (ctx, img) => {
    ctx.putImageData(img, 0, 0);
  };

  OV.drawImageTrace = (ctx, img) => {
    const out = img.data;

    for (let p = 0, i = 0; p < S.N; p++, i += 4) {
      const d = S.diffPixels[p];

      if (d > 24) {
        out[i] = 255;
        out[i + 1] = Math.floor(out[i + 1] * 0.35);
        out[i + 2] = Math.floor(out[i + 2] * 0.25);
      } else if (d > 10) {
        out[i] = 255;
        out[i + 1] = Math.max(out[i + 1], 190);
        out[i + 2] = Math.floor(out[i + 2] * 0.55);
      }
    }

    ctx.putImageData(img, 0, 0);
  };

  OV.drawTraceOnly = (ctx, img) => {
    const out = img.data;
    out.fill(0);

    for (let p = 0; p < S.N; p++) {
      const d = S.diffPixels[p];
      let c = [0, 0, 0, 255];
      if (d > 24) c = [255, 0, 0, 255];
      else if (d > 10) c = [255, 190, 0, 255];
      OV.putPixel(out, p, c);
    }

    ctx.putImageData(img, 0, 0);
  };

  OV.drawZones = (ctx, img) => {
    const out = img.data;
    out.fill(0);

    for (let zy = 0; zy < S.ZONE_ROWS; zy++) {
      for (let zx = 0; zx < S.ZONE_COLS; zx++) {
        const zi = zy * S.ZONE_COLS + zx;
        const c = zoneColor(S.zonesDelta[zi]);

        const x0 = Math.floor(zx * S.W / S.ZONE_COLS);
        const x1 = Math.floor((zx + 1) * S.W / S.ZONE_COLS);
        const y0 = Math.floor(zy * S.H / S.ZONE_ROWS);
        const y1 = Math.floor((zy + 1) * S.H / S.ZONE_ROWS);

        for (let y = y0 + 1; y < y1; y++) {
          for (let x = x0 + 1; x < x1; x++) {
            OV.putPixel(out, y * S.W + x, c);
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);
  };

  OV.drawMembraneFine = (ctx, img, spectral = false) => {
    const out = img.data;
    const radius = S.W <= 320 ? 0 : 1;

    for (let y = 0; y < S.H; y++) {
      for (let x = 0; x < S.W; x++) {
        const v = radius === 0 ? S.diffPixels[y * S.W + x] : avgDiffAt(x, y, radius);
        const c = spectral ? spectralColor(v) : smoothColor(v);
        OV.putPixel(out, y * S.W + x, c);
      }
    }

    ctx.putImageData(img, 0, 0);
  };

  OV.drawMultiEchelle = (ctx, img) => {
    const out = img.data;

    for (let p = 0; p < S.N; p++) {
      const c = S.currLuma[p];

      const high = S.diffPixels[p];
      const mid = Math.abs(c - S.temporalFast[p]);
      const low = Math.abs(S.temporalFast[p] - S.temporalSlow[p]);

      let r = OV.clamp(high / 28, 0, 1) * 255;
      let g = OV.clamp(mid / 16, 0, 1) * 255;
      let b = OV.clamp(low / 10, 0, 1) * 255;

      if (r < 12 && g < 12 && b < 12) r = g = b = 0;
      OV.putPixel(out, p, [r, g, b, 255]);
    }

    ctx.putImageData(img, 0, 0);
  };

  OV.drawCarteCalme = (ctx, img) => {
    const out = img.data;

    for (let p = 0; p < S.N; p++) {
      const immediate = S.diffPixels[p];
      const drift = Math.abs(S.temporalFast[p] - S.temporalSlow[p]);
      const calm = OV.clamp(1 - (immediate * 0.12 + drift * 0.08), 0, 1);
      OV.putPixel(out, p, [10 + calm * 70, 20 + calm * 160, 40 + calm * 215, 255]);
    }

    ctx.putImageData(img, 0, 0);
  };

  OV.drawFoyerOverlay = (ctx, alpha = 0.42, living = false) => {
    ctx.save();

    const baseR = Math.max(10, Math.min(S.W, S.H) * (0.028 + S.foyerStrength * 0.035));

    ctx.lineWidth = Math.max(1, S.W / 520);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(S.foyerX, S.foyerY, baseR, 0, Math.PI * 2);
    ctx.stroke();

    if (S.foyerLocked || living) {
      ctx.strokeStyle = `rgba(0,255,210,${Math.min(0.80, alpha + 0.22)})`;
      ctx.beginPath();
      ctx.arc(S.foyerX, S.foyerY, baseR * 0.58, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.65, alpha + 0.10)})`;
    ctx.beginPath();
    ctx.moveTo(S.foyerX - baseR * 0.45, S.foyerY);
    ctx.lineTo(S.foyerX + baseR * 0.45, S.foyerY);
    ctx.moveTo(S.foyerX, S.foyerY - baseR * 0.45);
    ctx.lineTo(S.foyerX, S.foyerY + baseR * 0.45);
    ctx.stroke();

    if (living) {
      for (const sec of S.foyerSecondary) {
        ctx.strokeStyle = "rgba(255,210,80,0.55)";
        ctx.beginPath();
        ctx.arc(sec.x, sec.y, baseR * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  OV.drawFoyerDelta = (ctx, img) => {
    OV.drawImageTrace(ctx, img);
    OV.drawFoyerOverlay(ctx, 0.55, false);
  };

  OV.drawFoyerVivant = (ctx, img) => {
    // Vue biologique légère : image directe + trace très discrète + foyer vivant.
    const out = img.data;

    for (let p = 0, i = 0; p < S.N; p++, i += 4) {
      const d = S.diffPixels[p];
      const t = OV.clamp((d - 8) / 38, 0, 1) * 0.18;

      if (t > 0) {
        out[i] = OV.clamp(out[i] * (1 - t) + 255 * t, 0, 255);
        out[i + 1] = OV.clamp(out[i + 1] * (1 - t) + 225 * t, 0, 255);
        out[i + 2] = OV.clamp(out[i + 2] * (1 - t) + 50 * t, 0, 255);
      }
    }

    ctx.putImageData(img, 0, 0);
    OV.drawFoyerOverlay(ctx, 0.70, true);
  };

  OV.drawPresenceDelta = (ctx, img) => {
    OV.drawImageTrace(ctx, img);

    ctx.save();
    ctx.font = `${Math.max(10, S.W / 64)}px ui-monospace, Menlo, monospace`;
    ctx.lineWidth = Math.max(2, S.W / 320);

    for (const p of S.stablePresences) {
      const alpha = OV.clamp(0.30 + p.avg / 40, 0.30, 0.82);
      ctx.strokeStyle = `rgba(0, 255, 170, ${alpha})`;
      ctx.fillStyle = `rgba(0, 255, 170, 0.10)`;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.fillRect(p.x, p.y, p.w, p.h);

      ctx.beginPath();
      ctx.arc(p.cx, p.cy, Math.max(3, S.W / 180), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.70)";
      ctx.fillRect(p.x, Math.max(0, p.y - 18), 120, 16);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(`P${p.id} ${p.rank} ${p.avg.toFixed(1)} t${p.seen}`, p.x + 4, Math.max(12, p.y - 5));
    }

    ctx.restore();
  };

  OV.drawMemoireVive = (ctx, img) => {
    const data = img.data;

    if (!S.memReady) {
      for (let p = 0, i = 0; p < S.N; p++, i += 4) {
        S.memR[p] = data[i];
        S.memG[p] = data[i + 1];
        S.memB[p] = data[i + 2];
      }
      S.memReady = true;
    }

    for (let p = 0, i = 0; p < S.N; p++, i += 4) {
      const d = S.diffPixels[p];

      let a;
      if (d < 3) a = 0.16;
      else if (d < 12) a = 0.24;
      else if (d < 28) a = 0.34;
      else a = 0.46;

      if (S.traceRegime.includes("FlashGlobal") || S.traceRegime.includes("AntiFlash")) {
        a *= 0.70;
      }

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      S.memR[p] = S.memR[p] * (1 - a) + r * a;
      S.memG[p] = S.memG[p] * (1 - a) + g * a;
      S.memB[p] = S.memB[p] * (1 - a) + b * a;

      const trace = OV.clamp((d - 10) / 42, 0, 1);

      let presentMix = trace > 0 ? 0.80 : 0.86;
      let memoryMix = 1 - presentMix;

      let outR = r * presentMix + S.memR[p] * memoryMix;
      let outG = g * presentMix + S.memG[p] * memoryMix;
      let outB = b * presentMix + S.memB[p] * memoryMix;

      if (trace > 0) {
        const t = trace * 0.22;
        outR = outR * (1 - t) + 255 * t;
        outG = outG * (1 - t) + 215 * t;
        outB = outB * (1 - t) + 40 * t;
      }

      data[i] = OV.clamp(outR, 0, 255);
      data[i + 1] = OV.clamp(outG, 0, 255);
      data[i + 2] = OV.clamp(outB, 0, 255);
      data[i + 3] = 255;
    }

    ctx.putImageData(img, 0, 0);
    OV.drawFoyerOverlay(ctx, 0.26, true);
  };

  function pulseColor(amp, sat) {
    if (sat > 0.20) return OV.rgba(255, 255, 255);
    if (sat > 0.06) return OV.rgba(255, 70, 20);

    if (amp < 1.0) return OV.rgba(0, 0, 10);
    if (amp < 2.5) return OV.rgba(0, 20, 80);
    if (amp < 5.0) return OV.rgba(0, 120, 210);
    if (amp < 8.0) return OV.rgba(0, 220, 130);
    if (amp < 13.0) return OV.rgba(255, 230, 0);
    if (amp < 22.0) return OV.rgba(255, 120, 0);
    return OV.rgba(255, 0, 0);
  }

  OV.drawPulsationLumineuse = (ctx, img) => {
    const out = img.data;
    out.fill(0);

    for (let zy = 0; zy < S.ZONE_ROWS; zy++) {
      for (let zx = 0; zx < S.ZONE_COLS; zx++) {
        const zi = zy * S.ZONE_COLS + zx;
        const c = pulseColor(S.pulseAmp[zi], S.pulseSat[zi]);

        const x0 = Math.floor(zx * S.W / S.ZONE_COLS);
        const x1 = Math.floor((zx + 1) * S.W / S.ZONE_COLS);
        const y0 = Math.floor(zy * S.H / S.ZONE_ROWS);
        const y1 = Math.floor((zy + 1) * S.H / S.ZONE_ROWS);

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            OV.putPixel(out, y * S.W + x, c);
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    const zx = S.pulseMaxZone % S.ZONE_COLS;
    const zy = Math.floor(S.pulseMaxZone / S.ZONE_COLS);
    const cx = (zx + 0.5) * S.W / S.ZONE_COLS;
    const cy = (zy + 0.5) * S.H / S.ZONE_ROWS;

    ctx.save();
    ctx.lineWidth = Math.max(1, S.W / 520);
    ctx.strokeStyle = "rgba(255,255,255,0.70)";
    const r = Math.max(10, Math.min(S.W, S.H) * 0.045);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  function zoneIndexForPixel(x, y) {
    const zx = Math.floor(x * S.ZONE_COLS / S.W);
    const zy = Math.floor(y * S.ZONE_ROWS / S.H);
    return zy * S.ZONE_COLS + zx;
  }

  function localEdgeAt(x, y) {
    // Petit gradient 4-voisins sur luminance. Léger et suffisant.
    const p = y * S.W + x;
    const c = S.currLuma[p];

    const l = x > 0 ? S.currLuma[p - 1] : c;
    const r = x < S.W - 1 ? S.currLuma[p + 1] : c;
    const u = y > 0 ? S.currLuma[p - S.W] : c;
    const d = y < S.H - 1 ? S.currLuma[p + S.W] : c;

    return Math.abs(r - l) * 0.5 + Math.abs(d - u) * 0.5;
  }

  OV.drawContrasteOrganique = (ctx, img) => {
    const data = img.data;

    // Contraste organique :
    // présent dominant, renforcement local guidé par bord + trace + pulsation + foyer.
    // On traite chaque pixel, mais opérations simples seulement.
    const flashReduce = S.antiFlashActive ? 0.45 : 1.0;

    for (let y = 1; y < S.H - 1; y++) {
      for (let x = 1; x < S.W - 1; x++) {
        const p = y * S.W + x;
        const i = p * 4;

        const r0 = data[i];
        const g0 = data[i + 1];
        const b0 = data[i + 2];

        const luma = S.currLuma[p];
        const edge = localEdgeAt(x, y);
        const trace = S.diffPixels[p];

        const zi = zoneIndexForPixel(x, y);
        const pulse = S.pulseAmp ? S.pulseAmp[zi] : 0;
        const sat = S.pulseSat ? S.pulseSat[zi] : 0;

        const dx = x - S.foyerX;
        const dy = y - S.foyerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const foyerR = Math.max(24, Math.min(S.W, S.H) * (0.10 + S.foyerStrength * 0.08));
        const foyerGain = OV.clamp(1 - dist / foyerR, 0, 1) * S.foyerStrength;

        // Signifiance locale : ne pas amplifier le bruit seul.
        let organic =
          OV.clamp(edge / 42, 0, 1) * 0.55 +
          OV.clamp(trace / 28, 0, 1) * 0.30 +
          OV.clamp(pulse / 14, 0, 1) * 0.22 +
          foyerGain * 0.22;

        organic *= flashReduce;
        organic = OV.clamp(organic, 0, 1);

        // Renforcement du contraste autour de la luminance locale.
        const contrast = 1.0 + organic * 0.55;
        let r = 128 + (r0 - 128) * contrast;
        let g = 128 + (g0 - 128) * contrast;
        let b = 128 + (b0 - 128) * contrast;

        // Légère accentuation des bords par luminance, pas trop agressive.
        const edgeBoost = organic * OV.clamp(edge / 32, 0, 1) * 22;
        if (luma >= 128) {
          r += edgeBoost;
          g += edgeBoost;
          b += edgeBoost;
        } else {
          r -= edgeBoost * 0.65;
          g -= edgeBoost * 0.65;
          b -= edgeBoost * 0.65;
        }

        // Pulsation visible mais discrète : bleu/cyan pour faible, chaud pour forte.
        const pGain = OV.clamp(pulse / 18, 0, 1) * 0.16 * flashReduce;
        if (pGain > 0) {
          if (pulse < 8) {
            r = r * (1 - pGain) + 40 * pGain;
            g = g * (1 - pGain) + 210 * pGain;
            b = b * (1 - pGain) + 255 * pGain;
          } else {
            r = r * (1 - pGain) + 255 * pGain;
            g = g * (1 - pGain) + 210 * pGain;
            b = b * (1 - pGain) + 50 * pGain;
          }
        }

        // Saturation/halo : signaler légèrement, sans brûler toute l'image.
        if (sat > 0.05) {
          const s = OV.clamp(sat * 1.8, 0, 0.35);
          r = r * (1 - s) + 255 * s;
          g = g * (1 - s) + 245 * s;
          b = b * (1 - s) + 220 * s;
        }

        data[i] = OV.clamp(r, 0, 255);
        data[i + 1] = OV.clamp(g, 0, 255);
        data[i + 2] = OV.clamp(b, 0, 255);
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    // Foyer vivant discret sur cette vue.
    OV.drawFoyerOverlay(ctx, 0.34, true);
  };

  function drawReliefBase(ctx, img, variant) {
    const data = img.data;

    // variant:
    // "mixte" = garde un peu de l'image réelle
    // "pur"   = relief seul sur fond neutre
    // "noir"  = relief seul sur fond noir
    const lightX = -0.55;
    const lightY = -0.65;
    const lightZ = 0.75;

    const flashReduce = S.antiFlashActive ? 0.55 : 1.0;

    for (let y = 1; y < S.H - 1; y++) {
      for (let x = 1; x < S.W - 1; x++) {
        const p = y * S.W + x;
        const i = p * 4;

        const left = S.currLuma[p - 1];
        const right = S.currLuma[p + 1];
        const up = S.currLuma[p - S.W];
        const down = S.currLuma[p + S.W];

        const gx = (right - left) / 255;
        const gy = (down - up) / 255;

        let nx = -gx * 1.85;
        let ny = -gy * 1.85;
        let nz = 1.0;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;

        const shade = OV.clamp(nx * lightX + ny * lightY + nz * lightZ, -1, 1);
        const relief = (shade + 1) * 0.5;

        const edge = OV.clamp((Math.abs(right - left) + Math.abs(down - up)) / 76, 0, 1);
        const trace = OV.clamp(S.diffPixels[p] / 32, 0, 1) * flashReduce;

        const zx = Math.floor(x * S.ZONE_COLS / S.W);
        const zy = Math.floor(y * S.ZONE_ROWS / S.H);
        const zi = zy * S.ZONE_COLS + zx;
        const pulse = S.pulseAmp ? OV.clamp(S.pulseAmp[zi] / 18, 0, 1) * flashReduce : 0;

        const dx = x - S.foyerX;
        const dy = y - S.foyerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const foyerR = Math.max(24, Math.min(S.W, S.H) * (0.13 + S.foyerStrength * 0.08));
        const foyer = OV.clamp(1 - dist / foyerR, 0, 1) * S.foyerStrength;

        let base;
        if (variant === "noir") {
          // Fond noir : seules les structures émergent.
          base = relief * 130 * edge + edge * 75 + trace * 45 + pulse * 36 + foyer * 26;
        } else if (variant === "pur") {
          // Relief pur sur fond neutre, sans image réelle.
          base = 24 + relief * 210 + edge * 34 + foyer * 14;
        } else {
          // Mixte comme v0.8.
          base = 34 + relief * 205 + edge * 28 + foyer * 18;
        }

        let r = base;
        let g = base;
        let b = base;

        // Foyer vivant : cyan discret.
        if (foyer > 0.05) {
          const f = OV.clamp(foyer * (variant === "noir" ? 0.38 : 0.22), 0, 0.38);
          r = r * (1 - f) + 60 * f;
          g = g * (1 - f) + 235 * f;
          b = b * (1 - f) + 220 * f;
        }

        // Trace/pulsation : or discret.
        const live = OV.clamp(trace * 0.18 + pulse * 0.14, 0, variant === "noir" ? 0.38 : 0.24);
        if (live > 0) {
          r = r * (1 - live) + 255 * live;
          g = g * (1 - live) + 210 * live;
          b = b * (1 - live) + 70 * live;
        }

        // Seulement en mode mixte : conserver un peu de l'image normale.
        if (variant === "mixte") {
          const keep = 0.18;
          r = r * (1 - keep) + data[i] * keep;
          g = g * (1 - keep) + data[i + 1] * keep;
          b = b * (1 - keep) + data[i + 2] * keep;
        }

        data[i] = OV.clamp(r, 0, 255);
        data[i + 1] = OV.clamp(g, 0, 255);
        data[i + 2] = OV.clamp(b, 0, 255);
        data[i + 3] = 255;
      }
    }

    // Nettoyage bordure non traitée pour les modes purs.
    if (variant !== "mixte") {
      for (let x = 0; x < S.W; x++) {
        let top = x * 4;
        let bot = ((S.H - 1) * S.W + x) * 4;
        data[top] = data[top + 1] = data[top + 2] = variant === "noir" ? 0 : 24;
        data[bot] = data[bot + 1] = data[bot + 2] = variant === "noir" ? 0 : 24;
        data[top + 3] = data[bot + 3] = 255;
      }
      for (let y = 0; y < S.H; y++) {
        let leftI = (y * S.W) * 4;
        let rightI = (y * S.W + (S.W - 1)) * 4;
        data[leftI] = data[leftI + 1] = data[leftI + 2] = variant === "noir" ? 0 : 24;
        data[rightI] = data[rightI + 1] = data[rightI + 2] = variant === "noir" ? 0 : 24;
        data[leftI + 3] = data[rightI + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    OV.drawFoyerOverlay(ctx, variant === "noir" ? 0.42 : 0.28, true);
  }

  OV.drawReliefOptique = (ctx, img) => {
    drawReliefBase(ctx, img, "mixte");
  };

  OV.drawReliefPur = (ctx, img) => {
    drawReliefBase(ctx, img, "pur");
  };

  OV.drawReliefNoir = (ctx, img) => {
    drawReliefBase(ctx, img, "noir");
  };

  function parallaxColor(v) {
    if (v < 1.0) return OV.rgba(0, 0, 0);
    if (v < 2.5) return OV.rgba(0, 15, 60);
    if (v < 4.5) return OV.rgba(0, 55, 150);
    if (v < 7.5) return OV.rgba(0, 190, 120);
    if (v < 12.0) return OV.rgba(255, 210, 0);
    if (v < 20.0) return OV.rgba(255, 105, 0);
    return OV.rgba(255, 0, 0);
  }

  OV.drawParallaxeVivante = (ctx, img) => {
    const out = img.data;
    out.fill(0);

    // Fond très noir : seules les zones tenues apparaissent.
    for (let zy = 0; zy < S.ZONE_ROWS; zy++) {
      for (let zx = 0; zx < S.ZONE_COLS; zx++) {
        const zi = zy * S.ZONE_COLS + zx;
        const v = S.parallaxDepth[zi];
        const c = parallaxColor(v);

        const x0 = Math.floor(zx * S.W / S.ZONE_COLS);
        const x1 = Math.floor((zx + 1) * S.W / S.ZONE_COLS);
        const y0 = Math.floor(zy * S.H / S.ZONE_ROWS);
        const y1 = Math.floor((zy + 1) * S.H / S.ZONE_ROWS);

        // En dessous du seuil : fond noir complet.
        if (v < 1.0) continue;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            OV.putPixel(out, y * S.W + x, c);
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    ctx.save();

    // Si pas assez de mouvement/tenue, message discret.
    if (!S.parallaxMotionOk) {
      ctx.font = `${Math.max(12, S.W / 42)}px ui-monospace, Menlo, monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText("PARALLAXE : BOUGE DOUCEMENT", S.W * 0.06, S.H * 0.10);
      ctx.fillStyle = "rgba(0,255,210,0.55)";
      ctx.fillText("besoin de tenue + petit mouvement", S.W * 0.06, S.H * 0.15);
      ctx.restore();
      return;
    }

    // Foyer de parallaxe maximum.
    const zx = S.parallaxMaxZone % S.ZONE_COLS;
    const zy = Math.floor(S.parallaxMaxZone / S.ZONE_COLS);
    const cx = (zx + 0.5) * S.W / S.ZONE_COLS;
    const cy = (zy + 0.5) * S.H / S.ZONE_ROWS;

    ctx.lineWidth = Math.max(1, S.W / 520);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    const r = Math.max(10, Math.min(S.W, S.H) * 0.045);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Vecteur global approximatif.
    const scale = Math.min(S.W, S.H) * 0.070;
    const gx = S.W * 0.50;
    const gy = S.H * 0.90;
    ctx.strokeStyle = "rgba(0,255,210,0.75)";
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + S.parallaxGlobalDx * scale, gy + S.parallaxGlobalDy * scale);
    ctx.stroke();

    ctx.restore();
  };

  OV.drawAudioPulse = (ctx, img) => {
    const out = img.data;
    out.fill(0);

    const centerX = S.W / 2;
    const centerY = S.H / 2;
    const base = Math.min(S.W, S.H) * 0.06 + S.audioLevel * Math.min(S.W, S.H) * 0.38;
    const ringCount = 8;

    for (let y = 0; y < S.H; y++) {
      for (let x = 0; x < S.W; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const d = Math.sqrt(dx * dx + dy * dy);

        let intensity = 0;
        for (let k = 0; k < ringCount; k++) {
          const ring = base + k * (Math.min(S.W, S.H) * 0.045 + S.audioMid * 18);
          const dist = Math.abs(d - ring);
          intensity += Math.max(0, 1 - dist / (4 + S.audioHigh * 12));
        }

        OV.putPixel(out, y * S.W + x, [
          OV.clamp(intensity * 80 + S.audioHigh * 180, 0, 255),
          OV.clamp(intensity * 160 + S.audioMid * 120, 0, 255),
          OV.clamp(intensity * 255 + S.audioLow * 120, 0, 255),
          255
        ]);
      }
    }

    ctx.putImageData(img, 0, 0);
  };
})();
