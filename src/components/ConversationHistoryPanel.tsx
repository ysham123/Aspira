import React from 'react';
import { MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import { formatConversationDate, SavedConversation } from '../plugins/models/conversationHistory';

interface ConversationHistoryPanelProps {
  conversations: SavedConversation[];
  activeId: string | null;
  searchTerm: string;
  isExecuting: boolean;
  persistenceError: boolean;
  onSearchChange: (value: string) => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ConversationHistoryPanel: React.FC<ConversationHistoryPanelProps> = ({
  conversations,
  activeId,
  searchTerm,
  isExecuting,
  persistenceError,
  onSearchChange,
  onNewChat,
  onSelect,
  onDelete,
}) => {
  const query = searchTerm.trim().toLocaleLowerCase();
  const filteredConversations = query
    ? conversations.filter((conversation) =>
        `${conversation.title} ${conversation.turns.map((turn) =>
          `${turn.userText} ${turn.result.synthesizedOutput}`
        ).join(' ')}`.toLocaleLowerCase().includes(query)
      )
    : conversations;

  return (
    <section className="aspira-history-content" aria-label="Conversation history">
      <div className="aspira-history-heading">
        <h2>Recent chats</h2>
        <button
          type="button"
          className="aspira-new-chat-button"
          onClick={onNewChat}
          disabled={isExecuting}
        >
          <Plus aria-hidden="true" />
          <span>New chat</span>
        </button>
      </div>

      <label className="aspira-history-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search chats"
          aria-label="Search conversations"
        />
      </label>

      <ul className="aspira-history-list" aria-label="Recent conversations">
        {filteredConversations.length === 0 ? (
          <li className="aspira-history-empty">
            <MessageSquare aria-hidden="true" />
            <span>{query ? 'No chats match that search.' : 'Your conversations will appear here.'}</span>
          </li>
        ) : filteredConversations.map((conversation) => {
          const active = conversation.id === activeId;
          return (
            <li key={conversation.id} className={`aspira-history-entry ${active ? 'is-active' : ''}`}>
              <button
                type="button"
                className="aspira-history-select"
                onClick={() => onSelect(conversation.id)}
                disabled={isExecuting}
                aria-current={active ? 'page' : undefined}
                title={conversation.title}
              >
                <span className="aspira-history-title">{conversation.title}</span>
                <span className="aspira-history-date">{formatConversationDate(conversation.updatedAt)}</span>
              </button>
              <button
                type="button"
                className="aspira-history-delete"
                onClick={() => onDelete(conversation.id)}
                disabled={isExecuting}
                aria-label={`Delete conversation: ${conversation.title}`}
                title="Delete conversation"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="aspira-history-storage-note">
        {persistenceError ? 'Could not save. Delete an old chat and try again.' : 'Saved only in this browser'}
      </p>
    </section>
  );
};
