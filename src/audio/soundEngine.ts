class AspiraVoiceService {
  public localTtsEndpoint = 'http://127.0.0.1:8000/v1/audio/speech';
  public localTtsModel = 'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit';
  public localTtsVoice = 'Ryan';
  public onSpeakingStateChange?: (speaking: boolean) => void;

  private currentlySpeaking = false;
  private activeAudioElement: HTMLAudioElement | null = null;
  private activeAudioUrl: string | null = null;
  private lastVoiceError = '';

  constructor() {
    try {
      if (typeof window === 'undefined') return;
      this.localTtsEndpoint = localStorage.getItem('aspira_local_tts_url') || this.localTtsEndpoint;
      this.localTtsModel = localStorage.getItem('aspira_local_tts_model') || this.localTtsModel;
      this.localTtsVoice = localStorage.getItem('aspira_local_tts_voice') || this.localTtsVoice;
    } catch {
      // Keep the defaults when browser storage is unavailable.
    }
  }

  public getLocalTtsEndpoint() { return this.localTtsEndpoint; }
  public getLocalTtsModel() { return this.localTtsModel; }
  public getLocalTtsVoice() { return this.localTtsVoice; }
  public getLastVoiceError() { return this.lastVoiceError; }
  public isSpeaking() { return this.currentlySpeaking; }

  public setLocalTtsEndpoint(value: string) {
    this.localTtsEndpoint = value;
    this.persist('aspira_local_tts_url', value);
  }

  public setLocalTtsModel(value: string) {
    this.localTtsModel = value;
    this.persist('aspira_local_tts_model', value);
  }

  public setLocalTtsVoice(value: string) {
    this.localTtsVoice = value;
    this.persist('aspira_local_tts_voice', value);
  }

  private persist(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* Keep this session usable. */ }
  }

  public stopSpeaking() {
    this.activeAudioElement?.pause();
    this.activeAudioElement = null;
    if (this.activeAudioUrl) URL.revokeObjectURL(this.activeAudioUrl);
    this.activeAudioUrl = null;
    if (this.currentlySpeaking) {
      this.currentlySpeaking = false;
      this.onSpeakingStateChange?.(false);
    }
  }

  public async speak(text: string, onEnd?: () => void): Promise<boolean> {
    if (typeof window === 'undefined' || !text.trim()) {
      onEnd?.();
      return false;
    }

    this.stopSpeaking();
    this.currentlySpeaking = true;
    this.onSpeakingStateChange?.(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.currentlySpeaking = false;
      this.activeAudioElement = null;
      if (this.activeAudioUrl) URL.revokeObjectURL(this.activeAudioUrl);
      this.activeAudioUrl = null;
      this.onSpeakingStateChange?.(false);
      onEnd?.();
    };

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          endpoint: this.localTtsEndpoint,
          model: this.localTtsModel,
          voice: this.localTtsVoice,
        }),
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('audio')) {
        this.lastVoiceError = 'Local voice service unavailable';
        finish();
        return false;
      }

      this.activeAudioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(this.activeAudioUrl);
      this.activeAudioElement = audio;
      audio.onended = finish;
      audio.onerror = () => {
        this.lastVoiceError = 'Local voice audio could not be played';
        finish();
      };
      await audio.play();
      this.lastVoiceError = '';
      return true;
    } catch {
      this.lastVoiceError = 'Could not reach the local voice service';
      finish();
      return false;
    }
  }
}

export const soundEngine = new AspiraVoiceService();
