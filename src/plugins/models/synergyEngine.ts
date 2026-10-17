import { readDispatchResponse } from './dispatchStream';
import type { TurnProgressEvent } from './turnProgress';
import {
  AgentActionExecution,
  AttributionPill,
  CAPABILITY_MATRIX,
  LivingMemoryItem,
  ModelId,
  ModelPluginManifest,
  SynergyExecutionResult,
  SynergyMode,
  WorkspaceFileRead,
} from './manifest';

interface DispatchModelResponse {
  source: 'PROVIDER_CLI' | 'LIVE_API' | 'LOCAL_OLLAMA' | 'UNAVAILABLE';
  providerBadge?: string;
  modelId: string;
  text: string | null;
  error?: string;
  executedActions?: AgentActionExecution[];
  memories?: LivingMemoryItem[];
  latencyMs: number;
}

export interface ConversationMessageContext {
  role: 'user' | 'assistant';
  speaker?: string;
  text: string;
}

const MODEL_SYSTEM_PROMPTS: Record<string, string> = {
  argon: 'You are the Google model selected through Aspira. Be conversational, direct, and clear about what you have and have not done.',
  claude: 'You are Claude responding through Aspira. Be conversational, direct, and clear about what you have and have not done.',
  grok: 'You are Grok responding through Aspira. Be conversational, direct, and clear about what you have and have not done.',
  gpt: 'You are the OpenAI model selected through Aspira. Be conversational, direct, and clear about what you have and have not done.',
};

async function fetchModelStream(
  model: ModelPluginManifest,
  prompt: string,
  capabilityName: string,
  roleDesc: string,
  apiKeys: Record<string, string>,
  conversationHistory: ConversationMessageContext[],
  executeActions: boolean,
  conversationId: string,
  signal?: AbortSignal,
  onProgress?: (event: TurnProgressEvent) => void,
  fileReadContext?: WorkspaceFileRead,
): Promise<{
  source: 'PROVIDER_CLI' | 'LIVE_API' | 'LOCAL_OLLAMA' | 'UNAVAILABLE';
  text: string;
  executedActions: AgentActionExecution[];
  memories?: LivingMemoryItem[];
  latencyMs: number;
  responseMs: number;
  providerBadge?: string;
}> {
  const startedAt = performance.now();
  const baseSystem =
    MODEL_SYSTEM_PROMPTS[model.id] ||
    `You are ${model.codeName} (${model.family}), operating as ${roleDesc} inside Aspira.`;

  let executedActions: AgentActionExecution[] = [];
  let updatedMemories: LivingMemoryItem[] | undefined;
  let unfinishedAction = '';

  try {
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({
        modelId: model.id,
        conversationId,
        prompt,
        systemPrompt: `${baseSystem} Capability focus: ${capabilityName} (${roleDesc}).`,
        apiKeys,
        endpointConfig: model.endpointConfig,
        conversationHistory,
        executeActions,
        fileReadContext,
      }),
      signal,
    });

    const data = await readDispatchResponse<DispatchModelResponse>(res, (event) => {
      if (event.type === 'action') {
        unfinishedAction = '';
        executedActions = [...executedActions.filter((action) => action.id !== event.action.id), event.action];
        onProgress?.({ kind: 'action', modelId: model.id, action: event.action });
      } else if (event.type === 'delta') {
        onProgress?.({ kind: 'delta', modelId: model.id, delta: event.delta });
      } else {
        if (event.phase === 'acting') unfinishedAction = event.title;
        onProgress?.({ kind: 'status', modelId: model.id, phase: event.phase, message: event.title, actionId: event.actionId });
      }
    }, signal);
    if (Array.isArray(data.executedActions)) executedActions = data.executedActions;
    if (Array.isArray(data.memories)) updatedMemories = data.memories;
    const responseMs = Math.round(performance.now() - startedAt);
    const available = res.ok && data.text && data.source !== 'UNAVAILABLE';
    return {
      source: available ? data.source : 'UNAVAILABLE',
      text: available ? data.text.trim() : data.error || `Aspira could not finish the ${model.codeName} response.`,
      providerBadge: data.providerBadge,
      executedActions,
      memories: updatedMemories,
      latencyMs: responseMs,
      responseMs,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException('The request was stopped.', 'AbortError');
    }
    const responseMs = Math.round(performance.now() - startedAt);
    return {
      source: 'UNAVAILABLE',
      text: `${error instanceof Error && !(error instanceof TypeError) ? error.message : 'Could not reach the local agent service. Start Aspira’s server and try again.'}${unfinishedAction ? ` A local action started (${unfinishedAction}) but no completion receipt arrived. It may still finish.` : ''}`,
      executedActions,
      latencyMs: responseMs,
      responseMs,
    };
  }
}

export async function runPantheonSynergy(params: {
  prompt: string;
  capabilityId: string;
  synergyMode: SynergyMode;
  awakeModels: ModelPluginManifest[];
  apiKeys: Record<string, string>;
  conversationHistory?: ConversationMessageContext[];
  conversationId?: string;
  signal?: AbortSignal;
  onMemoriesUpdated?: (memories: LivingMemoryItem[]) => void;
  onProgress?: (event: TurnProgressEvent) => void;
  fileReadContext?: WorkspaceFileRead;
}): Promise<SynergyExecutionResult> {
  const {
    prompt,
    capabilityId,
    synergyMode,
    awakeModels,
    apiKeys,
    conversationHistory = [],
    conversationId = '',
    signal,
    onMemoriesUpdated,
    onProgress,
    fileReadContext,
  } = params;

  const capability =
    CAPABILITY_MATRIX.find((c) => c.id === capabilityId) || CAPABILITY_MATRIX[0];

  if (awakeModels.length === 0) {
    const partialActions: AgentActionExecution[] = [];
    let data: {
      source?: string;
      text?: string;
      error?: string;
      executedActions?: AgentActionExecution[];
      memories?: LivingMemoryItem[];
      latencyMs?: number;
    } = {};
    try {
      const response = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ modelId: 'local', prompt, executeActions: true, fileReadContext }),
        signal,
      });
      data = await readDispatchResponse<typeof data>(response, (event) => {
        if (event.type === 'action') {
          partialActions.push(event.action);
          onProgress?.({ kind: 'action', modelId: 'local', action: event.action });
        } else if (event.type === 'status') {
          onProgress?.({ kind: 'status', modelId: 'local', phase: event.phase, message: event.title, actionId: event.actionId });
        }
      }, signal);
    } catch {
      data.error = 'Could not reach Aspira’s local action service.';
    }
    if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
    const executedActions = Array.isArray(data.executedActions) ? data.executedActions : partialActions;
    if (Array.isArray(data.memories) && onMemoriesUpdated) onMemoriesUpdated(data.memories);
    const localActionCompleted = data.source === 'LOCAL_ACTIONS' &&
      executedActions.some((action) => action.status === 'success');
    const synthesizedOutput = data.text || data.error || 'Connect and select a model to start a conversation.';
    return {
      id: `syn-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      prompt,
      capabilityId: capability.id,
      capabilityName: capability.name,
      synergyMode,
      participatingModels: [],
      consensusScore: null,
      executiveHeadline: localActionCompleted
        ? 'Local action'
        : executedActions.length
        ? 'Local action needs attention'
        : 'Select a connected model',
      synthesizedOutput,
      spokenReply: localActionCompleted ? synthesizedOutput : '',
      executedActions,
      followUpSuggestions: [],
      attributionPills: [],
      modelStreams: [],
      consensusPoints: [],
      divergentPoints: [],
    };
  }

  // The first selected model handles deterministic local actions. Other selected
  // models receive the same conversation but cannot execute those actions twice.
  const streamPromises = awakeModels.map(async (model, idx) => {
    const spec = capability.supportedModels.find((s) => s.modelId === model.id);
    const role = spec?.roleInOverlap || model.tagline;
    const badgeLabel = spec?.badgeLabel || model.vendor;
    const uniqueNuance = spec?.uniqueContribution || model.tagline;

    onProgress?.({ kind: 'status', modelId: model.id, phase: 'connecting', message: 'Connecting…' });
    const result = await fetchModelStream(
      model,
      prompt,
      capability.name,
      role,
      apiKeys,
      conversationHistory,
      idx === 0, // Lead agent executes macOS/web/file/memory actions
      conversationId,
      signal,
      onProgress,
      fileReadContext,
    );

    if (idx === 0 && result.memories && onMemoriesUpdated) {
      onMemoriesUpdated(result.memories);
    }

    const stream = {
      modelId: model.id as ModelId,
      codeName: model.codeName,
      accentHex: model.accentHex,
      role,
      badgeLabel,
      latencyMs: result.latencyMs,
      ttftMs: result.responseMs,
      tokensPerSec: 0,
      source: result.source,
      providerBadge: result.providerBadge,
      keyInsight: result.text,
      uniqueNuance,
      executedActions: result.executedActions,
      confidence: 0,
    };
    onProgress?.({ kind: 'response', modelId: model.id, response: stream });
    return stream;
  });

  const allStreams = await Promise.all(streamPromises);
  if (signal?.aborted) throw new DOMException('The request was stopped.', 'AbortError');
  const responseStreams = allStreams.filter((stream) => stream.source !== 'UNAVAILABLE');
  const executedActions = allStreams.flatMap((stream) => stream.executedActions || []);
  const failedStreams = allStreams.filter((stream) => stream.source === 'UNAVAILABLE');
  const attributionPills: AttributionPill[] = responseStreams.map((stream) => ({
    id: `pill-response-${stream.modelId}`,
    type: 'unique_nuance',
    label: `${stream.codeName} response`,
    models: [stream.modelId],
    accentHex: stream.accentHex,
    detail: stream.uniqueNuance,
  }));
  const executiveHeadline = responseStreams.length
    ? `${responseStreams.length} model response${responseStreams.length === 1 ? '' : 's'}`
    : executedActions.length
    ? executedActions.some((action) => action.status === 'success')
      ? 'Local action completed · no final model reply'
      : 'Action needs attention · no final model reply'
    : awakeModels.length
    ? 'No selected model returned a final reply'
    : 'Connect and select a model';
  const synthesizedOutput = responseStreams.length
    ? responseStreams
        .map((stream) => responseStreams.length === 1 ? stream.keyInsight : `**${stream.codeName}**\n${stream.keyInsight}`)
        .join('\n\n')
    : failedStreams[0]?.keyInsight || 'Connect a model in Settings, then select it below to start a conversation.';
  const spokenReply = responseStreams[0]?.keyInsight
    ?.replace(/```[\s\S]*?```/g, 'I have generated the code block in the studio.')
    .replace(/[*_`#>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320) || '';

  return {
    id: `syn-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    prompt,
    capabilityId: capability.id,
    capabilityName: capability.name,
    synergyMode,
    participatingModels: responseStreams.map((s) => s.modelId),
    consensusScore: null,
    executiveHeadline,
    synthesizedOutput,
    spokenReply,
    executedActions,
    followUpSuggestions: [],
    attributionPills,
    modelStreams: allStreams.map(({ accentHex: _a, executedActions: _e, ...rest }) => rest),
    consensusPoints: [],
    divergentPoints: [],
  };
}
