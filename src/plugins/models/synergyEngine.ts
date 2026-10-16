import {
  AgentActionExecution,
  AttributionPill,
  CAPABILITY_MATRIX,
  LivingMemoryItem,
  ModelId,
  ModelPluginManifest,
  SynergyExecutionResult,
  SynergyMode,
} from './manifest';

interface DispatchModelResponse {
  source: 'SUBSCRIPTION_OAUTH' | 'LIVE_API' | 'LOCAL_OLLAMA' | 'UNAVAILABLE';
  subscriptionBadge?: string;
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
  executeActions: boolean
): Promise<{
  source: 'SUBSCRIPTION_OAUTH' | 'LIVE_API' | 'LOCAL_OLLAMA' | 'UNAVAILABLE';
  text: string;
  executedActions: AgentActionExecution[];
  memories?: LivingMemoryItem[];
  latencyMs: number;
  responseMs: number;
}> {
  const startedAt = performance.now();
  const baseSystem =
    MODEL_SYSTEM_PROMPTS[model.id] ||
    `You are ${model.codeName} (${model.family}), operating as ${roleDesc} inside Aspira.`;

  let executedActions: AgentActionExecution[] = [];
  let updatedMemories: LivingMemoryItem[] | undefined;

  try {
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: model.id,
        prompt,
        systemPrompt: `${baseSystem} Capability focus: ${capabilityName} (${roleDesc}).`,
        apiKeys,
        endpointConfig: model.endpointConfig,
        conversationHistory,
        executeActions,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as DispatchModelResponse;
      if (Array.isArray(data.executedActions)) {
        executedActions = data.executedActions;
      }
      if (Array.isArray(data.memories)) {
        updatedMemories = data.memories;
      }
      const responseMs = Math.round(performance.now() - startedAt);
      if (data.text && data.source !== 'UNAVAILABLE') {
        return {
          source: data.source,
          text: data.text.trim(),
          executedActions,
          memories: updatedMemories,
          latencyMs: responseMs,
          responseMs,
        };
      }
      return {
        source: 'UNAVAILABLE',
        text: data.error || 'No response was returned by this provider.',
        executedActions,
        memories: updatedMemories,
        latencyMs: responseMs,
        responseMs,
      };
    }
    const data = (await res.json().catch(() => ({}))) as DispatchModelResponse;
    return {
      source: 'UNAVAILABLE',
      text: data.error || `The local agent service returned ${res.status}. Check the service and try again.`,
      executedActions,
      memories: data.memories,
      latencyMs: Math.round(performance.now() - startedAt),
      responseMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    const responseMs = Math.round(performance.now() - startedAt);
    return {
      source: 'UNAVAILABLE',
      text: 'Could not reach the local agent service. Start Aspira’s server and try again.',
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
  onMemoriesUpdated?: (memories: LivingMemoryItem[]) => void;
}): Promise<SynergyExecutionResult> {
  const {
    prompt,
    capabilityId,
    synergyMode,
    awakeModels,
    apiKeys,
    conversationHistory = [],
    onMemoriesUpdated,
  } = params;

  const capability =
    CAPABILITY_MATRIX.find((c) => c.id === capabilityId) || CAPABILITY_MATRIX[0];

  if (awakeModels.length === 0) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: 'local', prompt, executeActions: true }),
      });
      data = await response.json();
    } catch {
      data.error = 'Could not reach Aspira’s local action service.';
    }
    const executedActions = Array.isArray(data.executedActions) ? data.executedActions : [];
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

    const result = await fetchModelStream(
      model,
      prompt,
      capability.name,
      role,
      apiKeys,
      conversationHistory,
      idx === 0 // Lead agent executes macOS/web/file/memory actions
    );

    if (idx === 0 && result.memories && onMemoriesUpdated) {
      onMemoriesUpdated(result.memories);
    }

    return {
      modelId: model.id as ModelId,
      codeName: model.codeName,
      accentHex: model.accentHex,
      role,
      badgeLabel,
      latencyMs: result.latencyMs,
      ttftMs: result.responseMs,
      tokensPerSec: 0,
      source: result.source,
      keyInsight: result.text,
      uniqueNuance,
      executedActions: result.executedActions,
      confidence: 0,
    };
  });

  const allStreams = await Promise.all(streamPromises);
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
    ? 'Local action completed · model unavailable'
    : awakeModels.length
    ? 'No selected model responded'
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
