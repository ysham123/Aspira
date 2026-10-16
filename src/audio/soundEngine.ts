class AspiraVoiceService {
  public localTtsEndpoint = 'http://127.0.0.1:8000/v1/audio/speech';
  public localTtsModel = 'mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit';
  public localTtsVoice = 'Ryan';
  public localTtsInstruct = 'Speak naturally and conversationally, with a warm, relaxed cadence, subtle pitch variation, clear articulation, and restrained emphasis. Sound like a thoughtful person speaking to one person, not an announcer.';
  public onSpeakingStateChange?: (speaking: boolean) => void;

  private currentlySpeaking = false;
  private activeTtsController: AbortController | null = null;
  private activeAudioContext: AudioContext | null = null;
  private activeAudioSources = new Set<AudioBufferSourceNode>();
  private speechRequestId = 0;
  private lastVoiceError = '';

  constructor() {
    try {
      if (typeof window === 'undefined') return;
      this.localTtsEndpoint = localStorage.getItem('aspira_local_tts_url') || this.localTtsEndpoint;
      this.localTtsModel = localStorage.getItem('aspira_local_tts_model') || this.localTtsModel;
      this.localTtsVoice = localStorage.getItem('aspira_local_tts_voice') || this.localTtsVoice;
      this.localTtsInstruct = localStorage.getItem('aspira_local_tts_instruct') || this.localTtsInstruct;
    } catch {
      // Keep the defaults when browser storage is unavailable.
    }
  }

  public getLocalTtsEndpoint() { return this.localTtsEndpoint; }
  public getLocalTtsModel() { return this.localTtsModel; }
  public getLocalTtsVoice() { return this.localTtsVoice; }
  public getLocalTtsInstruct() { return this.localTtsInstruct; }
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

  public setLocalTtsInstruct(value: string) {
    this.localTtsInstruct = value;
    this.persist('aspira_local_tts_instruct', value);
  }

  private persist(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* Keep this session usable. */ }
  }

  public stopSpeaking() {
    this.speechRequestId += 1;
    this.activeTtsController?.abort();
    this.activeTtsController = null;
    for (const source of this.activeAudioSources) {
      try { source.stop(); } catch { /* A source may already have ended. */ }
    }
    this.activeAudioSources.clear();
    const audioContext = this.activeAudioContext;
    this.activeAudioContext = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined);
    }
    if (this.currentlySpeaking) {
      this.currentlySpeaking = false;
      this.onSpeakingStateChange?.(false);
    }
  }

  private async playWavStream(response: Response, signal: AbortSignal, requestId: number): Promise<void> {
    if (!response.body) throw new Error('Local voice stream was empty');

    const audioContext = new AudioContext();
    this.activeAudioContext = audioContext;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const requestSources = new Set<AudioBufferSourceNode>();
    let pending = new Uint8Array(0);
    let scheduledUntil = 0;
    let decodedChunkCount = 0;
    let streamFinished = false;
    let resolvePlayback: (() => void) | undefined;
    const playbackDrained = new Promise<void>((resolve) => { resolvePlayback = resolve; });
    let resolveAbort: (() => void) | undefined;
    const aborted = new Promise<void>((resolve) => { resolveAbort = resolve; });
    const onAbort = () => resolveAbort?.();
    signal.addEventListener('abort', onAbort, { once: true });

    const finishIfDrained = () => {
      if (streamFinished && requestSources.size === 0) resolvePlayback?.();
    };

    const appendBytes = (current: Uint8Array, next: Uint8Array) => {
      const combined = new Uint8Array(current.length + next.length);
      combined.set(current);
      combined.set(next, current.length);
      return combined;
    };

    try {
      if (signal.aborted || requestId !== this.speechRequestId) throw new DOMException('Speech stopped', 'AbortError');
      if (audioContext.state === 'suspended') await audioContext.resume();
      scheduledUntil = audioContext.currentTime + 0.03;
      reader = response.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value?.length) continue;
        pending = appendBytes(pending, value);

        while (pending.length >= 12) {
          const header = new DataView(pending.buffer, pending.byteOffset, pending.byteLength);
          const isRiff = pending[0] === 0x52 && pending[1] === 0x49 && pending[2] === 0x46 && pending[3] === 0x46;
          const isWave = pending[8] === 0x57 && pending[9] === 0x41 && pending[10] === 0x56 && pending[11] === 0x45;
          if (!isRiff || !isWave) throw new Error('Local voice returned an invalid WAV chunk');

          const wavLength = header.getUint32(4, true) + 8;
          if (wavLength < 44 || wavLength > 32 * 1024 * 1024) {
            throw new Error('Local voice returned an invalid WAV chunk size');
          }
          if (pending.length < wavLength) break;

          const wavBytes = pending.slice(0, wavLength);
          pending = pending.slice(wavLength);
          const audioBuffer = await audioContext.decodeAudioData(wavBytes.buffer.slice(
            wavBytes.byteOffset,
            wavBytes.byteOffset + wavBytes.byteLength
          ));
          if (signal.aborted || requestId !== this.speechRequestId) return;

          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          this.activeAudioSources.add(source);
          requestSources.add(source);
          source.onended = () => {
            this.activeAudioSources.delete(source);
            requestSources.delete(source);
            finishIfDrained();
          };
          const startsAt = Math.max(audioContext.currentTime + 0.02, scheduledUntil);
          source.start(startsAt);
          scheduledUntil = startsAt + audioBuffer.duration;
          decodedChunkCount += 1;
        }
      }

      if (pending.length > 0) throw new Error('Local voice stream ended mid-chunk');
      if (decodedChunkCount === 0) throw new Error('Local voice stream contained no audio');
      streamFinished = true;
      finishIfDrained();
      await Promise.race([playbackDrained, aborted]);
      if (signal.aborted || requestId !== this.speechRequestId) throw new DOMException('Speech stopped', 'AbortError');
    } finally {
      signal.removeEventListener('abort', onAbort);
      try { await reader?.cancel(); } catch { /* The stream may already be closed. */ }
      for (const source of requestSources) {
        try { source.stop(); } catch { /* A source may already have ended. */ }
        this.activeAudioSources.delete(source);
      }
      requestSources.clear();
      if (this.activeAudioContext === audioContext) this.activeAudioContext = null;
      if (audioContext.state !== 'closed') await audioContext.close().catch(() => undefined);
    }
  }

  public async speak(text: string, onEnd?: () => void): Promise<boolean> {
    if (typeof window === 'undefined' || !text.trim()) {
      onEnd?.();
      return false;
    }

    this.stopSpeaking();
    const requestId = ++this.speechRequestId;
    const controller = new AbortController();
    this.activeTtsController = controller;
    this.currentlySpeaking = true;
    this.onSpeakingStateChange?.(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (requestId !== this.speechRequestId) return;
      this.currentlySpeaking = false;
      this.activeTtsController = null;
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
          instruct: this.localTtsInstruct,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('audio')) {
        this.lastVoiceError = 'Local voice service unavailable';
        finish();
        return false;
      }
      if (requestId !== this.speechRequestId || controller.signal.aborted) return false;
      await this.playWavStream(response, controller.signal, requestId);
      if (requestId !== this.speechRequestId || controller.signal.aborted) return false;
      this.lastVoiceError = '';
      finish();
      return true;
    } catch (error) {
      if (controller.signal.aborted || requestId !== this.speechRequestId) return false;
      this.lastVoiceError = error instanceof Error && error.message.includes('Local voice')
        ? error.message
        : 'Local voice audio could not be played';
      finish();
      return false;
    }
  }
}

export const soundEngine = new AspiraVoiceService();
