type VoiceWorkerResponse =
  | { type: 'status'; requestId: number; message: string }
  | { type: 'progress'; requestId: number; task: 'speech' | 'transcription'; progress: number | null }
  | { type: 'audio'; requestId: number; wav: ArrayBuffer }
  | { type: 'transcription'; requestId: number; text: string }
  | { type: 'complete'; requestId: number }
  | { type: 'error'; requestId: number; task: 'speech' | 'transcription'; message: string };

type SpeechWorker = Worker & {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

type PendingSpeech = {
  requestId: number;
  resolve: (success: boolean) => void;
  queue: Promise<void>;
  done: boolean;
  activeSources: number;
  hadAudio: boolean;
  scheduledUntil: number;
};

class AspiraVoiceService {
  public onSpeakingStateChange?: (speaking: boolean) => void;
  public onStatusChange?: (message: string) => void;

  private currentlySpeaking = false;
  private activeAudioContext: AudioContext | null = null;
  private activeAudioSources = new Set<AudioBufferSourceNode>();
  private worker: SpeechWorker | null = null;
  private nextRequestId = 1;
  private pendingSpeech: PendingSpeech | null = null;
  private pendingTranscriptions = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
  private lastVoiceError = '';

  public getLastVoiceError() { return this.lastVoiceError; }
  public isSpeaking() { return this.currentlySpeaking; }

  private ensureWorker(): SpeechWorker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./speech.worker.ts', import.meta.url), { type: 'module' }) as SpeechWorker;
    worker.onmessage = (event: MessageEvent<VoiceWorkerResponse>) => this.handleWorkerMessage(event.data);
    worker.onerror = () => {
      this.lastVoiceError = 'Aspira could not start its built-in voice engine.';
      this.finishSpeech(false);
      for (const pending of this.pendingTranscriptions.values()) {
        pending.reject(new Error(this.lastVoiceError));
      }
      this.pendingTranscriptions.clear();
      this.onStatusChange?.(this.lastVoiceError);
    };
    this.worker = worker;
    return worker;
  }

  private handleWorkerMessage(message: VoiceWorkerResponse) {
    if (message.type === 'status') {
      if (message.requestId === this.pendingSpeech?.requestId || this.pendingTranscriptions.has(message.requestId)) {
        this.onStatusChange?.(message.message);
      }
      return;
    }

    if (message.type === 'progress') {
      const pending = message.task === 'speech'
        ? this.pendingSpeech?.requestId === message.requestId
        : this.pendingTranscriptions.has(message.requestId);
      if (!pending) return;
      const percent = message.progress === null ? '' : ` (${Math.round(message.progress)}%)`;
      this.onStatusChange?.(`${message.task === 'speech' ? 'Preparing voice' : 'Preparing voice input'}${percent}…`);
      return;
    }

    if (message.type === 'audio') {
      const pending = this.pendingSpeech;
      if (!pending || pending.requestId !== message.requestId) return;
      pending.hadAudio = true;
      pending.queue = pending.queue.then(() => this.playAudioChunk(message.wav, message.requestId));
      void pending.queue.then(() => this.finishSpeechIfDrained(message.requestId)).catch((error) => {
        this.lastVoiceError = error instanceof Error ? error.message : 'Aspira could not play this voice reply.';
        this.finishSpeech(false);
      });
      return;
    }

    if (message.type === 'transcription') {
      const pending = this.pendingTranscriptions.get(message.requestId);
      if (!pending) return;
      this.pendingTranscriptions.delete(message.requestId);
      pending.resolve(message.text.trim());
      return;
    }

    if (message.type === 'complete') {
      if (this.pendingSpeech?.requestId === message.requestId) {
        this.pendingSpeech.done = true;
        void this.pendingSpeech.queue.then(() => this.finishSpeechIfDrained(message.requestId));
      }
      return;
    }

    if (message.type === 'error') {
      this.lastVoiceError = message.message;
      if (message.task === 'speech' && this.pendingSpeech?.requestId === message.requestId) {
        this.finishSpeech(false);
      } else if (message.task === 'transcription') {
        const pending = this.pendingTranscriptions.get(message.requestId);
        if (pending) {
          this.pendingTranscriptions.delete(message.requestId);
          pending.reject(new Error(message.message));
        }
      }
      this.onStatusChange?.(message.message);
    }
  }

  private async playAudioChunk(wav: ArrayBuffer, requestId: number) {
    const pending = this.pendingSpeech;
    if (!pending || pending.requestId !== requestId) return;

    const audioContext = this.activeAudioContext || new AudioContext();
    this.activeAudioContext = audioContext;
    if (audioContext.state === 'suspended') await audioContext.resume();
    const audioBuffer = await audioContext.decodeAudioData(wav.slice(0));
    if (this.pendingSpeech?.requestId !== requestId) return;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    pending.activeSources += 1;
    this.activeAudioSources.add(source);
    source.onended = () => {
      pending.activeSources = Math.max(0, pending.activeSources - 1);
      this.activeAudioSources.delete(source);
      this.finishSpeechIfDrained(requestId);
    };
    const startsAt = Math.max(audioContext.currentTime + 0.02, pending.scheduledUntil);
    source.start(startsAt);
    pending.scheduledUntil = startsAt + audioBuffer.duration;
  }

  private finishSpeechIfDrained(requestId: number) {
    const pending = this.pendingSpeech;
    if (!pending || pending.requestId !== requestId || !pending.done || pending.activeSources > 0) return;
    if (!pending.hadAudio) {
      this.lastVoiceError = 'Aspira did not produce speech for this reply.';
      this.finishSpeech(false);
      return;
    }
    this.lastVoiceError = '';
    this.finishSpeech(true);
  }

  private finishSpeech(success: boolean) {
    const pending = this.pendingSpeech;
    if (!pending) return;
    if (!success) {
      for (const source of this.activeAudioSources) {
        try { source.stop(); } catch { /* The source may have ended already. */ }
      }
      this.activeAudioSources.clear();
    }
    this.pendingSpeech = null;
    this.currentlySpeaking = false;
    this.onSpeakingStateChange?.(false);
    if (success) this.onStatusChange?.('Voice input is off');
    pending.resolve(success);
    const context = this.activeAudioContext;
    this.activeAudioContext = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }

  public stopSpeaking() {
    const pending = this.pendingSpeech;
    if (!pending) return;
    this.ensureWorker().postMessage({ type: 'cancel', requestId: pending.requestId });
    for (const source of this.activeAudioSources) {
      try { source.stop(); } catch { /* The source may have ended already. */ }
    }
    this.activeAudioSources.clear();
    this.finishSpeech(false);
    this.onStatusChange?.('Voice input is off');
  }

  public async speak(text: string, onEnd?: () => void): Promise<boolean> {
    if (typeof window === 'undefined' || !text.trim()) {
      onEnd?.();
      return false;
    }

    this.stopSpeaking();
    const requestId = this.nextRequestId++;
    this.currentlySpeaking = true;
    this.onSpeakingStateChange?.(true);
    this.onStatusChange?.('Preparing Aspira voice…');
    const playback = new Promise<boolean>((resolve) => {
      this.pendingSpeech = {
        requestId,
        resolve,
        queue: Promise.resolve(),
        done: false,
        activeSources: 0,
        hadAudio: false,
        scheduledUntil: 0,
      };
    });
    this.ensureWorker().postMessage({
      type: 'speak',
      requestId,
      text: text.trim(),
      voice: 'af_heart',
    });
    const success = await playback;
    onEnd?.();
    return success;
  }

  private async toMono16k(audio: Blob): Promise<Float32Array> {
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await audio.arrayBuffer());
      const mono = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const samples = decoded.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) mono[index] += samples[index] / decoded.numberOfChannels;
      }

      const targetRate = 16000;
      if (decoded.sampleRate === targetRate) return mono;
      const ratio = decoded.sampleRate / targetRate;
      const targetLength = Math.floor(mono.length / ratio);
      const resampled = new Float32Array(targetLength);
      for (let index = 0; index < targetLength; index += 1) {
        const position = index * ratio;
        const left = Math.floor(position);
        const right = Math.min(left + 1, mono.length - 1);
        const fraction = position - left;
        resampled[index] = mono[left] * (1 - fraction) + mono[right] * fraction;
      }
      return resampled;
    } finally {
      if (context.state !== 'closed') await context.close().catch(() => undefined);
    }
  }

  public async transcribe(audio: Blob): Promise<string> {
    if (typeof window === 'undefined' || audio.size === 0) throw new Error('No voice message was captured.');
    const requestId = this.nextRequestId++;
    this.onStatusChange?.('Preparing voice input…');
    const samples = await this.toMono16k(audio);
    return new Promise<string>((resolve, reject) => {
      this.pendingTranscriptions.set(requestId, { resolve, reject });
      this.ensureWorker().postMessage({ type: 'transcribe', requestId, samples }, [samples.buffer]);
    });
  }
}

export const soundEngine = new AspiraVoiceService();
