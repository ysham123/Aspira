import type { AgentActionExecution } from './manifest';

export type DispatchActivityEvent =
  | { type: 'status'; phase: 'thinking' | 'acting'; title: string; actionId?: string }
  | { type: 'delta'; modelId: string; delta: string }
  | { type: 'action'; action: AgentActionExecution };

export async function readDispatchResponse<T>(
  response: Response,
  onActivity?: (event: DispatchActivityEvent) => void,
  signal?: AbortSignal,
): Promise<T> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    return response.json() as Promise<T>;
  }
  if (!response.body) throw new Error('Aspira received an empty response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const stopReading = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', stopReading, { once: true });
  try {
    if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 4_000_000) throw new Error('Aspira received an oversized response event.');
      if (done && buffer.trim()) buffer += '\n';
      let boundary: number;
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); }
        catch { throw new Error('Aspira received an incomplete response event. Completed action receipts are kept below.'); }
        if (event.type === 'result' && event.data && typeof event.data === 'object') {
          return event.data as T;
        }
        if (event.type === 'delta' && typeof event.modelId === 'string' && typeof event.delta === 'string') {
          onActivity?.(event as DispatchActivityEvent);
        } else if (event.type === 'status' && ['thinking', 'acting'].includes(event.phase) && typeof event.title === 'string') {
          onActivity?.(event as DispatchActivityEvent);
        } else if (event.type === 'action' && event.action && typeof event.action.id === 'string') {
          onActivity?.(event as DispatchActivityEvent);
        }
      }
      if (done) break;
    }
    if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
    throw new Error('The connection ended before Aspira received a final response. Completed actions are kept below.');
  } finally {
    signal?.removeEventListener('abort', stopReading);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
