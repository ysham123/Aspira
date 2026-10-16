import type { ConversationTurn, SynergyExecutionResult } from './manifest';
import { normalizeWorkspaceFileRead } from './fileReadContext';

export const CONVERSATION_HISTORY_STORAGE_KEY = 'aspira_conversations_v1';
export const MAX_SAVED_CONVERSATIONS = 24;

export interface SavedConversation {
  id: string;
  title: string;
  updatedAt: string;
  turns: ConversationTurn[];
}

export interface ConversationHistoryState {
  activeId: string | null;
  conversations: SavedConversation[];
}

export function normalizeConversationTurn(value: unknown): ConversationTurn | null {
  if (!value || typeof value !== 'object') return null;
  const turn = value as ConversationTurn;
  const result = turn.result;
  if (typeof turn.id !== 'string' || typeof turn.userText !== 'string' || !result || typeof result.synthesizedOutput !== 'string') return null;
  const actions = Array.isArray(result.executedActions) ? result.executedActions.filter((action) => action &&
    typeof action.id === 'string' && typeof action.tool === 'string' && typeof action.title === 'string' &&
    typeof action.output === 'string' && ['success', 'error', 'blocked'].includes(action.status)) : [];
  const sources = ['PROVIDER_CLI', 'SUBSCRIPTION_OAUTH', 'LIVE_API', 'LOCAL_OLLAMA', 'UNAVAILABLE'];
  const streams = (Array.isArray(result.modelStreams) ? result.modelStreams : [])
    .filter((stream) => stream && typeof stream.modelId === 'string' && typeof stream.keyInsight === 'string')
    .map((stream) => ({
      ...stream,
      codeName: typeof stream.codeName === 'string' ? stream.codeName : stream.modelId,
      role: stream.role || '', badgeLabel: stream.badgeLabel || '', uniqueNuance: stream.uniqueNuance || '',
      source: sources.includes(stream.source) ? stream.source : 'UNAVAILABLE' as const,
      latencyMs: Number.isFinite(stream.latencyMs) ? stream.latencyMs : 0,
      ttftMs: Number.isFinite(stream.ttftMs) ? stream.ttftMs : 0,
      tokensPerSec: Number.isFinite(stream.tokensPerSec) ? stream.tokensPerSec : 0,
      confidence: Number.isFinite(stream.confidence) ? stream.confidence : 0,
    }));
  return {
    ...turn,
    timestamp: typeof turn.timestamp === 'string' ? turn.timestamp : '',
    inputModality: ['voice', 'text', 'routine'].includes(turn.inputModality) ? turn.inputModality : 'text',
    result: {
      ...result,
      id: result.id || `result-${turn.id}`, timestamp: result.timestamp || turn.timestamp || '',
      prompt: result.prompt || turn.userText, capabilityId: result.capabilityId || 'conversation',
      capabilityName: result.capabilityName || 'Conversation', synergyMode: result.synergyMode || 'fusion',
      executiveHeadline: result.executiveHeadline || 'Response', spokenReply: result.spokenReply || '',
      consensusScore: Number.isFinite(result.consensusScore) ? result.consensusScore : null,
      participatingModels: Array.isArray(result.participatingModels) ? result.participatingModels : [],
      executedActions: actions.map((action) => {
        const { fileRead: rawFileRead, ...base } = action;
        const fileRead = normalizeWorkspaceFileRead(rawFileRead);
        return { ...base, ...(fileRead ? { fileRead } : {}), durationMs: Number.isFinite(action.durationMs) ? action.durationMs : 0 };
      }),
      modelStreams: streams,
      followUpSuggestions: Array.isArray(result.followUpSuggestions) ? result.followUpSuggestions : [],
      attributionPills: Array.isArray(result.attributionPills) ? result.attributionPills : [],
      consensusPoints: Array.isArray(result.consensusPoints) ? result.consensusPoints : [],
      divergentPoints: Array.isArray(result.divergentPoints) ? result.divergentPoints : [],
    } as SynergyExecutionResult,
  };
}

export function readConversationHistory(storage?: Pick<Storage, 'getItem'>): ConversationHistoryState {
  try {
    const stored = (storage ?? localStorage).getItem(CONVERSATION_HISTORY_STORAGE_KEY);
    if (!stored) return { activeId: null, conversations: [] };

    const parsed = JSON.parse(stored) as Partial<ConversationHistoryState>;
    if (!Array.isArray(parsed.conversations)) return { activeId: null, conversations: [] };

    const conversations = parsed.conversations
      .filter((item): item is SavedConversation =>
        Boolean(item && typeof item.id === 'string' && typeof item.title === 'string' &&
          typeof item.updatedAt === 'string' && Array.isArray(item.turns))
      )
      .map((item) => ({ ...item, turns: item.turns.map(normalizeConversationTurn).filter((turn): turn is ConversationTurn => Boolean(turn)) }))
      .filter((item) => item.turns.length > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SAVED_CONVERSATIONS);
    const activeId = parsed.activeId === null ? null : conversations.some((conversation) => conversation.id === parsed.activeId)
      ? parsed.activeId as string
      : conversations[0]?.id ?? null;

    return { activeId, conversations };
  } catch {
    return { activeId: null, conversations: [] };
  }
}

export function createConversationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function titleForConversation(turns: ConversationTurn[]): string {
  const firstPrompt = turns[0]?.userText?.replace(/\s+/g, ' ').trim();
  if (!firstPrompt) return 'New conversation';
  return firstPrompt.length > 54 ? `${firstPrompt.slice(0, 53).trimEnd()}…` : firstPrompt;
}

export function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
