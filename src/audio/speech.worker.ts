import { KokoroTTS, TextSplitterStream } from 'kokoro-js';
import { env, pipeline } from '@huggingface/transformers';

const TTS_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const ASR_MODEL = 'onnx-community/whisper-tiny.en';

type WorkerRequest =
  | { type: 'speak'; requestId: number; text: string; voice: 'af_heart' }
  | { type: 'transcribe'; requestId: number; samples: Float32Array }
  | { type: 'cancel'; requestId: number };

type WorkerResponse =
  | { type: 'status'; requestId: number; message: string }
  | { type: 'progress'; requestId: number; task: 'speech' | 'transcription'; progress: number | null }
  | { type: 'audio'; requestId: number; wav: ArrayBuffer }
  | { type: 'transcription'; requestId: number; text: string }
  | { type: 'complete'; requestId: number }
  | { type: 'error'; requestId: number; task: 'speech' | 'transcription'; message: string };

const workerScope = globalThis as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void) => void;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

env.allowLocalModels = false;
env.allowRemoteModels = true;

let ttsPromise: Promise<KokoroTTS> | null = null;
let asrPromise: Promise<any> | null = null;
const canceledRequests = new Set<number>();
const queue: WorkerRequest[] = [];
let isRunning = false;

function sendStatus(requestId: number, message: string) {
  workerScope.postMessage({ type: 'status', requestId, message });
}

function sendProgress(requestId: number, task: 'speech' | 'transcription', details: any) {
  const progress = Number.isFinite(Number(details?.progress)) ? Number(details.progress) : null;
  workerScope.postMessage({ type: 'progress', requestId, task, progress });
}

function runtimeOptions() {
  const hasWebGpu = typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
  return hasWebGpu
    ? { device: 'webgpu' as const, dtype: 'fp32' as const }
    : { device: 'wasm' as const, dtype: 'q8' as const };
}

async function getTts(requestId: number) {
  if (!ttsPromise) {
    const preferred = runtimeOptions();
    ttsPromise = (async () => {
      try {
        sendStatus(requestId, 'Preparing Aspira voice…');
        return await KokoroTTS.from_pretrained(TTS_MODEL, {
          ...preferred,
          progress_callback: (details: unknown) => sendProgress(requestId, 'speech', details),
        });
      } catch (error) {
        if (preferred.device !== 'webgpu') throw error;
        sendStatus(requestId, 'Preparing a compatible voice mode…');
        return KokoroTTS.from_pretrained(TTS_MODEL, {
          device: 'wasm',
          dtype: 'q8',
          progress_callback: (details: unknown) => sendProgress(requestId, 'speech', details),
        });
      }
    })().catch((error) => {
      ttsPromise = null;
      throw error;
    });
  }
  return ttsPromise;
}

async function getAsr(requestId: number) {
  if (!asrPromise) {
    const preferred = runtimeOptions();
    const createPipeline = async (options: ReturnType<typeof runtimeOptions>) => pipeline(
      'automatic-speech-recognition',
      ASR_MODEL,
      {
        ...options,
        progress_callback: (details: unknown) => sendProgress(requestId, 'transcription', details),
      }
    );
    asrPromise = (async () => {
      try {
        sendStatus(requestId, 'Preparing Aspira voice input…');
        return await createPipeline(preferred);
      } catch (error) {
        if (preferred.device !== 'webgpu') throw error;
        sendStatus(requestId, 'Preparing a compatible voice-input mode…');
        return createPipeline({ device: 'wasm', dtype: 'q8' });
      }
    })().catch((error) => {
      asrPromise = null;
      throw error;
    });
  }
  return asrPromise;
}

function errorMessage(error: unknown, task: 'speech' | 'transcription') {
  const detail = error instanceof Error ? error.message : '';
  if (/fetch|network|download|connection/i.test(detail)) {
    return 'Aspira could not download its voice model. Check your internet connection and try again.';
  }
  return task === 'speech'
    ? 'Aspira could not prepare a voice reply. Try again.'
    : 'Aspira could not prepare voice input. Try again.';
}

async function runRequest(request: WorkerRequest) {
  if (request.type === 'cancel' || canceledRequests.has(request.requestId)) return;

  if (request.type === 'speak') {
    try {
      const tts = await getTts(request.requestId);
      if (canceledRequests.has(request.requestId)) return;
      const textStream = new TextSplitterStream();
      textStream.push(request.text);
      textStream.close();
      for await (const chunk of tts.stream(textStream, { voice: request.voice, speed: 1 })) {
        if (canceledRequests.has(request.requestId)) break;
        const wav = await chunk.audio.toBlob().arrayBuffer();
        workerScope.postMessage({ type: 'audio', requestId: request.requestId, wav }, [wav]);
      }
      workerScope.postMessage({ type: 'complete', requestId: request.requestId });
    } catch (error) {
      workerScope.postMessage({
        type: 'error',
        requestId: request.requestId,
        task: 'speech',
        message: errorMessage(error, 'speech'),
      });
    }
    return;
  }

  if (request.type === 'transcribe') {
    try {
      const transcriber = await getAsr(request.requestId);
      if (canceledRequests.has(request.requestId)) return;
      const result = await transcriber(request.samples, { chunk_length_s: 30, stride_length_s: 5 });
      if (canceledRequests.has(request.requestId)) return;
      workerScope.postMessage({
        type: 'transcription',
        requestId: request.requestId,
        text: typeof result?.text === 'string' ? result.text : '',
      });
    } catch (error) {
      workerScope.postMessage({
        type: 'error',
        requestId: request.requestId,
        task: 'transcription',
        message: errorMessage(error, 'transcription'),
      });
    }
  }
}

async function pumpQueue() {
  if (isRunning) return;
  isRunning = true;
  try {
    while (queue.length > 0) {
      const request = queue.shift();
      if (request) {
        await runRequest(request);
        canceledRequests.delete(request.requestId);
      }
    }
  } finally {
    isRunning = false;
    if (queue.length > 0) void pumpQueue();
  }
}

workerScope.addEventListener('message', (event) => {
  const request = event.data;
  if (request.type === 'cancel') {
    canceledRequests.add(request.requestId);
    return;
  }
  queue.push(request);
  void pumpQueue();
});
