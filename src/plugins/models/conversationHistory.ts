import { ConversationTurn } from './manifest';

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

const isConversationTurn = (value: unknown): value is ConversationTurn => {
  if (!value || typeof value !== 'object') return false;
  const turn = value as Partial<ConversationTurn>;
  return typeof turn.id === 'string' && typeof turn.userText === 'string' &&
    Boolean(turn.result && typeof turn.result.synthesizedOutput === 'string');
};

export function readConversationHistory(): ConversationHistoryState {
  try {
    const stored = localStorage.getItem(CONVERSATION_HISTORY_STORAGE_KEY);
    if (!stored) return { activeId: null, conversations: [] };

    const parsed = JSON.parse(stored) as Partial<ConversationHistoryState>;
    if (!Array.isArray(parsed.conversations)) return { activeId: null, conversations: [] };

    const conversations = parsed.conversations
      .filter((item): item is SavedConversation =>
        Boolean(item && typeof item.id === 'string' && typeof item.title === 'string' &&
          typeof item.updatedAt === 'string' && Array.isArray(item.turns) &&
          item.turns.length > 0 && item.turns.every(isConversationTurn))
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SAVED_CONVERSATIONS);
    const activeId = conversations.some((conversation) => conversation.id === parsed.activeId)
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
