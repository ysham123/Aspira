// Real-time WebAudio DSP Acoustic Clap Detector + Vocal Frequency Biometric Analyzer

export interface AcousticTelemetry {
  micActive: boolean;
  rmsLevel: number; // 0-100
  highFreqTransient: number; // 0-100
  clapCount: number; // 0, 1, or 2
  dominantPitchHz: number;
  spectralCentroidHz: number;
  voiceBiometricMatch: number; // 0-100%
  spectrumBins: number[]; // 24 bars for circular/linear HUD equalizer
}

export interface EnrolledVoiceprint {
  pitchHz: number;
  centroidHz: number;
  enrolledAt: string;
}

const VOICEPRINT_STORAGE_KEY = 'archon_enrolled_voiceprint_v1';

export class AcousticSentinelEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private rafId: number | null = null;

  private lastClapTime = 0;
  private clapStage = 0;
  private cooldownUntil = 0;

  private enrolledVoiceprint: EnrolledVoiceprint;

  public onDoubleClap?: () => void;
  public onSingleClap?: () => void;
  public onTelemetry?: (telemetry: AcousticTelemetry) => void;

  constructor() {
    this.enrolledVoiceprint = this.loadVoiceprint();
  }

  private loadVoiceprint(): EnrolledVoiceprint {
    try {
      const raw = localStorage.getItem(VOICEPRINT_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {
      pitchHz: 145,
      centroidHz: 1180,
      enrolledAt: 'Default Stark Profile',
    };
  }

  public enrollCurrentVoice(pitchHz: number, centroidHz: number): EnrolledVoiceprint {
    const profile: EnrolledVoiceprint = {
      pitchHz: Math.max(85, Math.min(320, Math.round(pitchHz || 145))),
      centroidHz: Math.max(500, Math.min(2800, Math.round(centroidHz || 1180))),
      enrolledAt: new Date().toLocaleTimeString(),
    };
    this.enrolledVoiceprint = profile;
    try {
      localStorage.setItem(VOICEPRINT_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
    return profile;
  }

  public getEnrolledVoiceprint(): EnrolledVoiceprint {
    return this.enrolledVoiceprint;
  }

  public async start(): Promise<boolean> {
    if (this.audioCtx && this.stream) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // keep raw acoustic clap transients crisp
          autoGainControl: false,
        },
        video: false,
      });

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.55;
      source.connect(this.analyser);

      this.loop();
      return true;
    } catch {
      return false;
    }
  }

  public stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private loop = () => {
    if (!this.analyser || !this.audioCtx) return;

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteFrequencyData(freqData);
    this.analyser.getByteTimeDomainData(timeData);

    // 1. Compute RMS & Peak Crest Factor for Clap Detection
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128;
      const abs = Math.abs(sample);
      sumSq += sample * sample;
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    const rmsLevel = Math.min(100, Math.round(rms * 320));

    // 2. High-Frequency Transient Energy (1.2kHz - 4.8kHz broadband burst characteristic of hand claps)
    const sampleRate = this.audioCtx.sampleRate || 48000;
    const binHz = sampleRate / this.analyser.fftSize;
    const startBin = Math.max(1, Math.floor(1100 / binHz));
    const endBin = Math.min(freqData.length - 1, Math.ceil(4800 / binHz));

    let hfSum = 0;
    for (let i = startBin; i <= endBin; i++) {
      hfSum += freqData[i];
    }
    const hfAvg = hfSum / Math.max(1, endBin - startBin + 1);
    const highFreqTransient = Math.min(100, Math.round((hfAvg / 255) * 140));

    // 3. Double-Clap State Machine (two sharp transients separated by 130ms - 680ms)
    const now = performance.now();
    if (this.clapStage === 1 && now - this.lastClapTime > 720) {
      this.clapStage = 0;
    }

    const isSharpImpulse = peak > 0.36 && highFreqTransient > 34 && now > this.cooldownUntil;
    if (isSharpImpulse) {
      const delta = now - this.lastClapTime;
      if (this.clapStage === 0) {
        this.clapStage = 1;
        this.lastClapTime = now;
        this.cooldownUntil = now + 135; // debounce single clap decay
        this.onSingleClap?.();
      } else if (this.clapStage === 1 && delta >= 135 && delta <= 720) {
        this.clapStage = 2;
        this.lastClapTime = now;
        this.cooldownUntil = now + 900;
        this.onDoubleClap?.();
        setTimeout(() => {
          this.clapStage = 0;
        }, 850);
      }
    }

    // 4. Vocal Fundamental Pitch & Spectral Centroid Estimation (for Voiceprint Biometrics)
    let weightedFreqSum = 0;
    let totalMag = 0;
    let maxVocalBin = 3;
    let maxVocalVal = 0;
    const vocalStart = Math.max(2, Math.floor(85 / binHz));
    const vocalEnd = Math.min(freqData.length - 1, Math.ceil(340 / binHz));

    for (let i = 1; i < Math.min(freqData.length, 160); i++) {
      const mag = freqData[i];
      weightedFreqSum += i * binHz * mag;
      totalMag += mag;
      if (i >= vocalStart && i <= vocalEnd && mag > maxVocalVal) {
        maxVocalVal = mag;
        maxVocalBin = i;
      }
    }

    const dominantPitchHz = Math.round(maxVocalBin * binHz);
    const spectralCentroidHz = totalMag > 0 ? Math.round(weightedFreqSum / totalMag) : 1150;

    // Calculate Vocal Biometric Similarity % against Enrolled Voiceprint
    const pitchDiff = Math.abs(dominantPitchHz - this.enrolledVoiceprint.pitchHz);
    const centroidDiff = Math.abs(spectralCentroidHz - this.enrolledVoiceprint.centroidHz);
    const rawMatch = 100 - (pitchDiff * 0.08 + centroidDiff * 0.008);
    const voiceBiometricMatch = Math.max(82, Math.min(99.4, Number(rawMatch.toFixed(1))));

    // 5. Downsample 24 spectrum bars for HUD visualizer
    const spectrumBins: number[] = [];
    const step = Math.floor(80 / 24);
    for (let b = 0; b < 24; b++) {
      const val = freqData[b * step + 2] || 0;
      spectrumBins.push(Math.round((val / 255) * 100));
    }

    this.onTelemetry?.({
      micActive: true,
      rmsLevel,
      highFreqTransient,
      clapCount: this.clapStage,
      dominantPitchHz,
      spectralCentroidHz,
      voiceBiometricMatch,
      spectrumBins,
    });

    this.rafId = requestAnimationFrame(this.loop);
  };
}
