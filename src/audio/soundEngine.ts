// Luxury Ambient Harmonic Sound Design Engine + Local Neural TTS Bridge (Kokoro-82M / MLX / macOS Neural)

class StarkSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private warmFilter: BiquadFilterNode | null = null;
  private cachedVoice: SpeechSynthesisVoice | null = null;

  public muted = false;
  public voiceEnabled = true;
  public localTtsEndpoint = ''; // Optional local Kokoro-82M / mlx-audio / Orpheus endpoint

  public getLocalTtsEndpoint(): string {
    return this.localTtsEndpoint;
  }

  public setLocalTtsEndpoint(url: string) {
    this.localTtsEndpoint = url;
    try {
      localStorage.setItem('aspira_local_tts_url', url);
    } catch {
      // ignore
    }
  }

  constructor() {
    try {
      const savedTts = typeof window !== 'undefined' ? localStorage.getItem('aspira_local_tts_url') : null;
      if (savedTts) this.localTtsEndpoint = savedTts;
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.cachedVoice =
            voices.find((v) =>
              /Ava \(Premium\)|Zoe \(Premium\)|Daniel|Oliver|Samantha|Arthur|Google UK English/i.test(
                v.name
              )
            ) ||
            voices.find((v) => v.lang.startsWith('en')) ||
            null;
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  private ensureContext(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Master Luxury Acoustic Bus: Warm 24dB/oct Low-Pass + Stereo Ambient Diffusion + Soft Limiter
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.85;

        this.warmFilter = this.ctx.createBiquadFilter();
        this.warmFilter.type = 'lowpass';
        this.warmFilter.frequency.value = 3800;
        this.warmFilter.Q.value = 0.707;

        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 18;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.18;

        // Subtle Stereo Ambient Diffusion Send
        const delayL = this.ctx.createDelay();
        const delayR = this.ctx.createDelay();
        delayL.delayTime.value = 0.023;
        delayR.delayTime.value = 0.037;

        const wetFilter = this.ctx.createBiquadFilter();
        wetFilter.type = 'lowpass';
        wetFilter.frequency.value = 1650;

        const wetGain = this.ctx.createGain();
        wetGain.gain.value = 0.16;

        this.masterGain.connect(this.warmFilter);
        this.warmFilter.connect(compressor);
        compressor.connect(this.ctx.destination);

        this.warmFilter.connect(delayL);
        delayL.connect(delayR);
        delayR.connect(wetFilter);
        wetFilter.connect(wetGain);
        wetGain.connect(compressor);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.ctx || !this.masterGain) return null;
    return { ctx: this.ctx, out: this.masterGain };
  }

  // Subtle VisionOS-style Frosted Glass Tactile UI Tick
  public playGlassTick(pitchMultiplier = 1) {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(640 * pitchMultiplier, now + 0.035);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.04);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // VisionOS Modal Glass Droplet when a Clap Impulse is detected
  public playClapImpulse(count: 1 | 2 = 1) {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const fundamentals = count === 1 ? [528, 1320] : [264, 792, 1584];

    fundamentals.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.14);

      const peakGain = idx === 0 ? 0.14 : 0.06;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.19);
    });
  }

  // OpenAI Realtime / Gemini Live Warm Suspended Ninth Awakening Swell
  public playAmberLockdown() {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const chord = [146.83, 220.0, 261.63, 329.63, 392.0]; // Dmin9 warm ambient chord

    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.setValueAtTime(280, now);
    swellFilter.frequency.exponentialRampToValueAtTime(1850, now + 0.28);
    swellFilter.frequency.exponentialRampToValueAtTime(640, now + 0.85);
    swellFilter.connect(out);

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.025);

      gain.gain.setValueAtTime(0.001, now + idx * 0.025);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.09 : 0.055, now + idx * 0.025 + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.85);

      osc.connect(gain);
      gain.connect(swellFilter);
      osc.start(now + idx * 0.025);
      osc.stop(now + 0.88);
    });
  }

  // Luxury Lydian Maj9 Studio Unlock Bloom on Passkey Verification
  public playPasskeyVerified() {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const freqs = [130.81, 261.63, 329.63, 392.0, 493.88, 587.33, 739.99]; // Cmaj9(#11)

    const bloomFilter = ctx.createBiquadFilter();
    bloomFilter.type = 'lowpass';
    bloomFilter.frequency.setValueAtTime(340, now);
    bloomFilter.frequency.exponentialRampToValueAtTime(3400, now + 0.55);
    bloomFilter.frequency.exponentialRampToValueAtTime(1100, now + 1.35);
    bloomFilter.connect(out);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx < 2 ? 'triangle' : 'sine';
      const startOffset = idx * 0.022;

      osc.frequency.setValueAtTime(freq * 0.995, now + startOffset);
      osc.frequency.exponentialRampToValueAtTime(freq, now + startOffset + 0.22);

      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.11 : 0.055, now + startOffset + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0006, now + 1.35);

      osc.connect(gain);
      gain.connect(bloomFilter);
      osc.start(now + startOffset);
      osc.stop(now + 1.4);
    });
  }

  // Deep Sub-Bass Muted Security Pulse (Calm, authoritative — no harsh klaxon)
  public playIntruderAlert() {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const darkFilter = ctx.createBiquadFilter();
    darkFilter.type = 'lowpass';
    darkFilter.frequency.setValueAtTime(420, now);
    darkFilter.connect(out);

    for (let i = 0; i < 2; i++) {
      const offset = i * 0.2;
      [110, 116.54].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.86, now + offset + 0.16);

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.11, now + offset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);

        osc.connect(gain);
        gain.connect(darkFilter);
        osc.start(now + offset);
        osc.stop(now + offset + 0.19);
      });
    }
  }

  // Agent Core Awakening (Warm Harmonic Fifth Bloom)
  public playCoreWake(harmonicHz = 432) {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    [harmonicHz * 0.5, harmonicHz, harmonicHz * 1.498].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.98, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.18);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 1 ? 0.08 : 0.045, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  // Agent Core Sleep (Gentle Downward Octave Filter Dim)
  public playCoreSleep() {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(392, now);
    osc.frequency.exponentialRampToValueAtTime(196, now + 0.26);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Silky Pentatonic Glass Cascade when switching Studio Views
  public playModeMorph() {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    [392.0, 587.33, 880.0].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.035);

      gain.gain.setValueAtTime(0.001, now + idx * 0.035);
      gain.gain.linearRampToValueAtTime(0.05, now + idx * 0.035 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.035 + 0.16);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.17);
    });
  }

  // Soft Harmonic Shimmer Pulse during Multi-Agent Synthesis
  public playSynergyBeam() {
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    [440, 659.25].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.125, now + 0.28);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.065 : 0.04, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }

  private currentlySpeaking = false;
  private activeAudioElement: HTMLAudioElement | null = null;
  public onSpeakingStateChange?: (speaking: boolean) => void;

  public isSpeaking(): boolean {
    return this.currentlySpeaking;
  }

  public stopSpeaking() {
    if (this.activeAudioElement) {
      this.activeAudioElement.pause();
      this.activeAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentlySpeaking) {
      this.currentlySpeaking = false;
      this.onSpeakingStateChange?.(false);
    }
  }

  // Natural Voice Synthesis: tries Local Neural TTS Bridge (/api/tts -> Kokoro-82M / mlx-audio) first,
  // and falls back seamlessly to pre-warmed macOS Neural Voices.
  public async speak(text: string, onEnd?: () => void) {
    if (!this.voiceEnabled || this.muted || typeof window === 'undefined' || !text.trim()) {
      onEnd?.();
      return;
    }

    this.stopSpeaking();
    this.currentlySpeaking = true;
    this.onSpeakingStateChange?.(true);

    const finish = () => {
      this.currentlySpeaking = false;
      this.activeAudioElement = null;
      this.onSpeakingStateChange?.(false);
      onEnd?.();
    };

    if (this.localTtsEndpoint) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            endpoint: this.localTtsEndpoint,
          }),
        });
        if (res.ok && res.headers.get('content-type')?.includes('audio')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          this.activeAudioElement = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            finish();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            finish();
          };
          await audio.play();
          return;
        }
      } catch {
        // Fallback to native neural speechSynthesis
      }
    }

    if (!('speechSynthesis' in window)) {
      finish();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const selected =
        this.cachedVoice ||
        voices.find((v) =>
          /Ava|Zoe|Daniel|Oliver|Samantha|Arthur|Google UK English/i.test(v.name)
        ) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (selected) utterance.voice = selected;
      utterance.pitch = 0.98;
      utterance.rate = 1.03;
      utterance.volume = 0.9;
      utterance.onend = () => finish();
      utterance.onerror = () => finish();
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  }
}

export const soundEngine = new StarkSoundEngine();
