(() => {
  "use strict";

  const OV = window.OV;
  const S = OV.S;

  OV.startAudio = async () => {
    const audioBtn = OV.$("audioBtn");

    if (S.audioEnabled) {
      S.audioEnabled = false;
      audioBtn.textContent = "AudioPulseΔ OFF";
      audioBtn.classList.remove("active");

      if (S.audioCtx) await S.audioCtx.close();
      if (S.audioStream) S.audioStream.getTracks().forEach(t => t.stop());

      S.audioCtx = null;
      S.audioStream = null;
      S.analyser = null;
      S.audioData = null;
      return;
    }

    S.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const source = S.audioCtx.createMediaStreamSource(S.audioStream);
    S.analyser = S.audioCtx.createAnalyser();
    S.analyser.fftSize = 512;
    S.analyser.smoothingTimeConstant = 0.82;

    S.audioData = new Uint8Array(S.analyser.frequencyBinCount);
    source.connect(S.analyser);

    S.audioEnabled = true;
    audioBtn.textContent = "AudioPulseΔ ON";
    audioBtn.classList.add("active");
  };

  OV.updateAudio = () => {
    if (!S.audioEnabled || !S.analyser || !S.audioData) {
      S.audioLevel = S.audioLow = S.audioMid = S.audioHigh = 0;
      return;
    }

    S.analyser.getByteFrequencyData(S.audioData);

    let total = 0, low = 0, mid = 0, high = 0;
    const n = S.audioData.length;

    for (let i = 0; i < n; i++) {
      const v = S.audioData[i] / 255;
      total += v;

      if (i < n * 0.18) low += v;
      else if (i < n * 0.55) mid += v;
      else high += v;
    }

    S.audioLevel = total / n;
    S.audioLow = low / Math.max(1, Math.floor(n * 0.18));
    S.audioMid = mid / Math.max(1, Math.floor(n * 0.37));
    S.audioHigh = high / Math.max(1, Math.floor(n * 0.45));
  };
})();
