import type { AgentActionExecution, ConversationTurn, ModelPluginManifest, SynergyExecutionResult } from './manifest';

export type ModelResponse = SynergyExecutionResult['modelStreams'][number];
export type TurnProgressEvent =
  | { kind: 'status'; modelId: string; phase: 'connecting' | 'thinking' | 'acting'; message: string; actionId?: string }
  | { kind: 'action'; modelId: string; action: AgentActionExecution }
  | { kind: 'response'; modelId: string; response: ModelResponse };

export interface PendingConversationTurn {
  id: string;
  timestamp: string;
  userText: string;
  inputModality: ConversationTurn['inputModality'];
  agents: { modelId: string; name: string; phase: 'connecting' | 'thinking' | 'acting' | 'responded' | 'unavailable'; message: string }[];
  actions: AgentActionExecution[];
  runningActions: { id: string; modelId: string; title: string }[];
  responses: ModelResponse[];
}

export function createPendingTurn(prompt: string, modality: ConversationTurn['inputModality'], models: ModelPluginManifest[]): PendingConversationTurn {
  return {
    id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    userText: prompt,
    inputModality: modality,
    agents: (models.length ? models.map((model) => ({ modelId: model.id, name: model.codeName })) : [{ modelId: 'local', name: 'Aspira' }])
      .map((agent) => ({ ...agent, phase: 'connecting', message: 'Connecting…' })),
    actions: [],
    runningActions: [],
    responses: [],
  };
}

export function applyTurnProgress(turn: PendingConversationTurn, event: TurnProgressEvent): PendingConversationTurn {
  if (event.kind === 'action') {
    return {
      ...turn,
      actions: [...turn.actions.filter((action) => action.id !== event.action.id), event.action],
      runningActions: turn.runningActions.filter((action) => action.id !== event.action.id),
    };
  }
  if (event.kind === 'response') {
    const available = event.response.source !== 'UNAVAILABLE';
    return {
      ...turn,
      agents: turn.agents.map((agent) => agent.modelId === event.modelId
        ? { ...agent, phase: available ? 'responded' : 'unavailable', message: available ? 'Response ready' : event.response.keyInsight }
        : agent),
      responses: [...turn.responses.filter((response) => response.modelId !== event.modelId), event.response],
    };
  }
  return {
    ...turn,
    agents: turn.agents.map((agent) => agent.modelId === event.modelId
      ? { ...agent, phase: event.phase, message: event.message }
      : agent),
    runningActions: event.actionId
      ? [...turn.runningActions.filter((action) => action.id !== event.actionId), { id: event.actionId, modelId: event.modelId, title: event.message }]
      : turn.runningActions,
  };
}

export function interruptedTurnResult(
  turn: PendingConversationTurn,
  capability: { id: string; name: string },
  stopped: boolean,
  error?: string,
): SynergyExecutionResult {
  const available = turn.responses.filter((response) => response.source !== 'UNAVAILABLE');
  const unfinished = turn.runningActions.length
    ? `\n\nThese actions started but have no completion receipt: ${turn.runningActions.map((action) => action.title).join('; ')}. A local action already started may still finish.`
    : '';
  const notice = stopped
    ? 'You stopped this response. Any model replies and completed action receipts received before stopping are kept here.'
    : error || 'The connection ended before the response finished. Completed work is kept here.';
  const receivedText = available.map((response) => `**${response.codeName}**\n\n${response.keyInsight}`).join('\n\n');
  return {
    id: `result-${turn.id}`,
    timestamp: turn.timestamp,
    prompt: turn.userText,
    capabilityId: capability.id,
    capabilityName: capability.name,
    synergyMode: 'fusion',
    participatingModels: available.map((response) => response.modelId),
    consensusScore: null,
    executiveHeadline: stopped ? 'Response stopped' : 'Response interrupted',
    completionState: stopped ? 'stopped' : 'interrupted',
    synthesizedOutput: `${notice}${unfinished}${receivedText ? `\n\n${receivedText}` : ''}`,
    spokenReply: '',
    executedActions: turn.actions,
    followUpSuggestions: [],
    attributionPills: [],
    modelStreams: turn.responses,
    consensusPoints: [],
    divergentPoints: [],
  };
}
