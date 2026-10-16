import type { ConversationTurn } from './manifest';
import type { ConversationHistoryState, SavedConversation } from './conversationHistory';
import { CONVERSATION_HISTORY_STORAGE_KEY, MAX_SAVED_CONVERSATIONS, normalizeConversationTurn } from './conversationHistory';
import type { PendingConversationTurn } from './turnProgress';
import { interruptedTurnResult } from './turnProgress';

export const TURN_RECOVERY_STORAGE_KEY = 'aspira_turn_recovery_v1';
export const CONVERSATION_DRAFTS_STORAGE_KEY = 'aspira_conversation_drafts_v1';
export const RELOADED_TURN_NOTICE = 'Aspira reloaded before this response finished. Your message, received replies, and action receipts have been restored. The task has not been rerun. An action without a completion receipt has an unconfirmed outcome.';
type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface TurnCheckpoint {
  conversationId: string;
  title: string;
  updatedAt: string;
  capability: { id: string; name: string };
  completedTurns: ConversationTurn[];
  pending: PendingConversationTurn;
  finalTurn?: ConversationTurn;
}

function normalizeCheckpoint(value: unknown): TurnCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as TurnCheckpoint;
  const pending = item.pending;
  if (typeof item.conversationId !== 'string' || !item.conversationId || typeof item.title !== 'string' ||
    typeof item.updatedAt !== 'string' || !item.capability || typeof item.capability.id !== 'string' ||
    typeof item.capability.name !== 'string' || !pending || typeof pending.id !== 'string' ||
    typeof pending.userText !== 'string' || !Array.isArray(item.completedTurns)) return null;
  const normalized = normalizeConversationTurn({
    id: pending.id, userText: pending.userText, timestamp: pending.timestamp,
    inputModality: pending.inputModality,
    result: { synthesizedOutput: '', executedActions: pending.actions, modelStreams: pending.responses },
  });
  if (!normalized) return null;
  const finalTurn = normalizeConversationTurn(item.finalTurn);
  return {
    ...item,
    completedTurns: item.completedTurns.map(normalizeConversationTurn).filter((turn): turn is ConversationTurn => Boolean(turn)),
    finalTurn: finalTurn?.id === pending.id ? finalTurn : undefined,
    pending: {
      ...pending, timestamp: normalized.timestamp, inputModality: normalized.inputModality,
      agents: [], actions: normalized.result.executedActions, responses: normalized.result.modelStreams,
      runningActions: (Array.isArray(pending.runningActions) ? pending.runningActions : [])
        .filter((action) => action && typeof action.id === 'string' && typeof action.modelId === 'string' && typeof action.title === 'string'),
    },
  };
}

export function readTurnCheckpoints(storage?: TabStorage): TurnCheckpoint[] {
  try {
    const parsed = JSON.parse((storage ?? sessionStorage).getItem(TURN_RECOVERY_STORAGE_KEY) || 'null');
    if (parsed?.version !== 1 || !Array.isArray(parsed.records)) return [];
    return parsed.records.map(normalizeCheckpoint).filter((item: TurnCheckpoint | null): item is TurnCheckpoint => Boolean(item));
  } catch { return []; }
}

export function writeTurnCheckpoint(checkpoint: TurnCheckpoint, storage?: TabStorage): boolean {
  try {
    const target = storage ?? sessionStorage;
    const records = readTurnCheckpoints(target).filter((item) => item.conversationId !== checkpoint.conversationId || item.pending.id !== checkpoint.pending.id);
    target.setItem(TURN_RECOVERY_STORAGE_KEY, JSON.stringify({ version: 1, records: [...records, checkpoint] }));
    return true;
  } catch { return false; }
}

// A checkpoint is removed only after the completed/recovered turn has been
// successfully written to ordinary chat history. Reloading in between is safe.
export function acknowledgeSavedCheckpoints(history: ConversationHistoryState, storage?: TabStorage): boolean {
  try {
    const target = storage ?? sessionStorage;
    const savedIds = new Map(history.conversations.map((conversation) => [conversation.id, new Set(conversation.turns.map((turn) => turn.id))]));
    const records = readTurnCheckpoints(target).filter((record) => !savedIds.get(record.conversationId)?.has(record.pending.id));
    if (records.length) target.setItem(TURN_RECOVERY_STORAGE_KEY, JSON.stringify({ version: 1, records }));
    else target.removeItem(TURN_RECOVERY_STORAGE_KEY);
    return true;
  } catch { return false; }
}

export function persistConversationHistory(history: ConversationHistoryState, historyStorage?: TabStorage, tabStorage?: TabStorage): boolean {
  try {
    (historyStorage ?? localStorage).setItem(CONVERSATION_HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, ...history }));
    // Cleanup is best effort: a stale checkpoint is deduplicated on recovery.
    // Failure to save history must leave all recovery records intact.
    acknowledgeSavedCheckpoints(history, tabStorage);
    return true;
  } catch { return false; }
}

export function recoverConversationHistory(history: ConversationHistoryState, checkpoints: TurnCheckpoint[]): ConversationHistoryState {
  let conversations = [...history.conversations];
  let activeId = history.activeId;
  for (const checkpoint of [...checkpoints].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
    const existing = conversations.find((conversation) => conversation.id === checkpoint.conversationId);
    if (existing?.turns.some((turn) => turn.id === checkpoint.pending.id)) continue;
    const turns = new Map((existing?.turns || []).map((turn) => [turn.id, turn]));
    for (const turn of checkpoint.completedTurns) if (!turns.has(turn.id)) turns.set(turn.id, turn);
    const pending = checkpoint.pending;
    const turn: ConversationTurn = checkpoint.finalTurn || {
      id: pending.id, timestamp: pending.timestamp, userText: pending.userText, inputModality: pending.inputModality,
      result: interruptedTurnResult(pending, checkpoint.capability, false, RELOADED_TURN_NOTICE),
    };
    turns.set(turn.id, turn);
    const recovered: SavedConversation = {
      id: checkpoint.conversationId, title: existing?.title || checkpoint.title,
      updatedAt: checkpoint.updatedAt, turns: [...turns.values()],
    };
    conversations = [recovered, ...conversations.filter((conversation) => conversation.id !== recovered.id)].slice(0, MAX_SAVED_CONVERSATIONS);
    activeId = recovered.id;
  }
  return { activeId, conversations };
}

function readDrafts(storage: TabStorage): Record<string, string> {
  const parsed = JSON.parse(storage.getItem(CONVERSATION_DRAFTS_STORAGE_KEY) || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([key, text]) => typeof key === 'string' && typeof text === 'string')) as Record<string, string>;
}

export function readConversationDraft(conversationId: string | null, storage?: TabStorage): string {
  try { return readDrafts(storage ?? sessionStorage)[conversationId || '__new_conversation__'] || ''; }
  catch { return ''; }
}

export function writeConversationDraft(conversationId: string | null, text: string, storage?: TabStorage): boolean {
  try {
    const target = storage ?? sessionStorage;
    let drafts: Record<string, string>;
    try { drafts = readDrafts(target); } catch { drafts = {}; }
    const key = conversationId || '__new_conversation__';
    if (text) drafts[key] = text;
    else delete drafts[key];
    if (Object.keys(drafts).length) target.setItem(CONVERSATION_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    else target.removeItem(CONVERSATION_DRAFTS_STORAGE_KEY);
    return true;
  } catch { return false; }
}
