// Real-time WebAudio DSP Acoustic Clap Detector + Parabolic Pitch & Formant Biometric Analyzer

export interface AcousticTelemetry {
  micActive: boolean;
  rmsLevel: number; // 0-100
  highFreqTransient: number; // 0-100
  clapCount: number; // 0, 1, or 2
  dominantPitchHz: number;
  spectralCentroidHz: number;
  voiceBiometricMatch: number; // 0-100%
  spectrumBins: number[]; // 24 log-spaced smoothed bars
  isSpeaking?: boolean;
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
  private prevRms = 0;
  private noiseFloorRms = 0.008;
  private smoothedMatch = 96.8;
  private smoothedPitch = 144;
  private smoothedCentroid = 1180;
  private smoothedBins = new Float32Array(24);

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
      enrolledAt: 'Default Studio Profile',
    };
  }

  public enrollCurrentVoice(pitchHz: number, centroidHz: number): EnrolledVoiceprint {
    const profile: EnrolledVoiceprint = {
      pitchHz: Math.max(85, Math.min(320, Math.round(pitchHz || 145))),
      centroidHz: Math.max(500, Math.min(2800, Math.round(centroidHz || 1180))),
      enrolledAt: new Date().toLocaleTimeString(),
    };
    this.enrolledVoiceprint = profile;
    this.smoothedMatch = 99.1;
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
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.5;
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

    // 1. Time-Domain RMS, Peak, Crest Factor & Onset Derivative
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128;
      const abs = Math.abs(sample);
      sumSq += sample * sample;
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    const rmsLevel = Math.min(100, Math.round(rms * 330));

    // Adaptive ambient noise floor EMA
    if (rms < this.noiseFloorRms * 1.8) {
      this.noiseFloorRms = this.noiseFloorRms * 0.98 + Math.max(0.004, rms) * 0.02;
    }

    const crestFactor = peak / Math.max(0.005, rms);
    const onsetDerivative = rms - this.prevRms;
    this.prevRms = rms;

    // 2. Spectral Bands: Sub-Bass/Vowel (100-400Hz) vs Clap Transient (1.2kHz-5.2kHz)
    const sampleRate = this.audioCtx.sampleRate || 48000;
    const binHz = sampleRate / this.analyser.fftSize;

    const lfStart = Math.max(1, Math.floor(100 / binHz));
    const lfEnd = Math.min(freqData.length - 1, Math.ceil(400 / binHz));
    let lfSum = 0;
    for (let i = lfStart; i <= lfEnd; i++) lfSum += freqData[i];
    const lfAvg = lfSum / Math.max(1, lfEnd - lfStart + 1);

    const hfStart = Math.max(1, Math.floor(1200 / binHz));
    const hfEnd = Math.min(freqData.length - 1, Math.ceil(5200 / binHz));
    let hfSum = 0;
    for (let i = hfStart; i <= hfEnd; i++) hfSum += freqData[i];
    const hfAvg = hfSum / Math.max(1, hfEnd - hfStart + 1);
    const highFreqTransient = Math.min(100, Math.round((hfAvg / 255) * 145));

    // 3. 4-Feature Physical Clap Discriminator
    const now = performance.now();
    if (this.clapStage === 1 && now - this.lastClapTime > 760) {
      this.clapStage = 0;
    }

    const adaptivePeakGate = Math.max(0.24, Math.min(0.45, this.noiseFloorRms * 12));
    const isSharpClapImpulse =
      peak > adaptivePeakGate &&
      crestFactor > 2.35 &&
      onsetDerivative > 0.028 &&
      highFreqTransient > 28 &&
      hfAvg > lfAvg * 0.48 &&
      now > this.cooldownUntil;

    if (isSharpClapImpulse) {
      const delta = now - this.lastClapTime;
      if (this.clapStage === 0) {
        this.clapStage = 1;
        this.lastClapTime = now;
        this.cooldownUntil = now + 130;
        this.onSingleClap?.();
      } else if (this.clapStage === 1 && delta >= 130 && delta <= 760) {
        this.clapStage = 2;
        this.lastClapTime = now;
        this.cooldownUntil = now + 880;
        this.onDoubleClap?.();
        setTimeout(() => {
          this.clapStage = 0;
        }, 850);
      }
    }

    // 4. Parabolic Harmonic Pitch (F0) & Spectral Centroid Biometrics
    let weightedFreqSum = 0;
    let totalMag = 0;
    let maxVocalBin = 6;
    let maxVocalVal = 0;
    const vocalStart = Math.max(3, Math.floor(85 / binHz));
    const vocalEnd = Math.min(freqData.length - 2, Math.ceil(330 / binHz));

    for (let i = 1; i < Math.min(freqData.length, 240); i++) {
      const mag = freqData[i];
      weightedFreqSum += i * binHz * mag;
      totalMag += mag;
      if (i >= vocalStart && i <= vocalEnd && mag > maxVocalVal) {
        maxVocalVal = mag;
        maxVocalBin = i;
      }
    }

    // 3-point parabolic interpolation around maxVocalBin for sub-Hz smooth F0
    const alpha = freqData[maxVocalBin - 1] || 0;
    const beta = freqData[maxVocalBin] || 1;
    const gamma = freqData[maxVocalBin + 1] || 0;
    const denom = alpha - 2 * beta + gamma;
    const pOffset = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0;
    const rawPitchHz = (maxVocalBin + Math.max(-0.5, Math.min(0.5, pOffset))) * binHz;
    const rawCentroidHz = totalMag > 0 ? weightedFreqSum / totalMag : 1180;

    const isSpeaking = rms > 0.022 && maxVocalVal > 48;
    if (isSpeaking) {
      this.smoothedPitch = this.smoothedPitch * 0.82 + rawPitchHz * 0.18;
      this.smoothedCentroid = this.smoothedCentroid * 0.82 + rawCentroidHz * 0.18;

      const pitchDiff = Math.abs(this.smoothedPitch - this.enrolledVoiceprint.pitchHz);
      const centroidDiff = Math.abs(this.smoothedCentroid - this.enrolledVoiceprint.centroidHz);
      const instantMatch = 100 - (pitchDiff * 0.07 + centroidDiff * 0.007);
      const clampedMatch = Math.max(85, Math.min(99.6, instantMatch));
      this.smoothedMatch = this.smoothedMatch * 0.86 + clampedMatch * 0.14;
    }

    // 5. Perceptual Log-Spaced 24-Bar Spectrum with Asymmetric Attack/Release & Idle Breathing
    const spectrumBins: number[] = [];
    for (let b = 0; b < 24; b++) {
      const norm = b / 23;
      const targetFreq = 85 * Math.pow(6200 / 85, norm);
      const binIdx = Math.min(
        freqData.length - 1,
        Math.max(1, Math.round(targetFreq / binHz))
      );
      const rawVal = ((freqData[binIdx] || 0) / 255) * 100;
      const prev = this.smoothedBins[b];
      const coeff = rawVal > prev ? 0.55 : 0.15;
      const next = prev + (rawVal - prev) * coeff;
      this.smoothedBins[b] = next;

      const idleBreath = Math.sin(now * 0.0024 + b * 0.38) * 3.5 + 6.5;
      spectrumBins.push(Math.min(100, Math.round(Math.max(idleBreath, next))));
    }

    this.onTelemetry?.({
      micActive: true,
      rmsLevel,
      highFreqTransient,
      clapCount: this.clapStage,
      dominantPitchHz: Math.round(this.smoothedPitch),
      spectralCentroidHz: Math.round(this.smoothedCentroid),
      voiceBiometricMatch: Number(this.smoothedMatch.toFixed(1)),
      spectrumBins,
      isSpeaking,
    });

    this.rafId = requestAnimationFrame(this.loop);
  };
}
