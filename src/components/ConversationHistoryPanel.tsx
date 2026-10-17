import React from 'react';
import { Database, MessageSquare, Plus, Search, Trash2, X } from 'lucide-react';
import { formatConversationDate, SavedConversation } from '../plugins/models/conversationHistory';
import './ConversationHistoryPanel.css';

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

type HistoryGroup = 'Today' | 'Previous 7 days' | 'Earlier';

const historyGroupFor = (updatedAt: string, now = new Date()): HistoryGroup => {
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return 'Earlier';

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (updated >= today) return 'Today';

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return updated >= weekAgo ? 'Previous 7 days' : 'Earlier';
};

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

  const groups: { label: HistoryGroup; conversations: SavedConversation[] }[] = [];
  for (const conversation of filteredConversations) {
    const label = historyGroupFor(conversation.updatedAt);
    let group = groups.find((candidate) => candidate.label === label);
    if (!group) {
      group = { label, conversations: [] };
      groups.push(group);
    }
    group.conversations.push(conversation);
  }

  const changeSearch = (value: string) => {
    onSearchChange(value);
  };

  const visibleCount = query ? filteredConversations.length : conversations.length;

  return (
    <section className="aspira-history-content" aria-label="Conversation history">
      <div className="aspira-history-heading">
        <button
          type="button"
          className="aspira-new-chat-button"
          onClick={onNewChat}
          disabled={isExecuting}
        >
          <Plus aria-hidden="true" />
          <span>New conversation</span>
        </button>
      </div>

      <label className="aspira-history-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => changeSearch(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          autoComplete="off"
          spellCheck={false}
        />
        {searchTerm && (
          <button
            type="button"
            className="aspira-history-search-clear"
            onClick={() => changeSearch('')}
            aria-label="Clear conversation search"
            title="Clear search"
          >
            <X aria-hidden="true" />
          </button>
        )}
      </label>

        <div className="aspira-history-heading-label">
          <h2>Recent</h2>
          <span className="aspira-history-count" aria-label={`${visibleCount} ${query ? 'matches' : 'saved conversations'}`}>
            {visibleCount}
          </span>
        </div>

      <ul className="aspira-history-list" aria-label={query ? 'Matching conversations' : 'Recent conversations'}>
        {filteredConversations.length === 0 ? (
          <li className="aspira-history-empty" aria-live="polite" aria-atomic="true">
            <span className="aspira-history-empty-icon">
              {query ? <Search aria-hidden="true" /> : <MessageSquare aria-hidden="true" />}
            </span>
            <span className="aspira-history-empty-copy">
              <strong>{query ? 'No matches' : 'No conversations yet'}</strong>
              <span>
                {query
                  ? `Nothing found for “${searchTerm.trim()}”. Clear the search field to see all conversations.`
                  : 'Your conversations will appear here as you go.'}
              </span>
            </span>
          </li>
        ) : groups.map((group) => (
          <React.Fragment key={group.label}>
            <li className="aspira-history-group-label"><h3>{group.label}</h3></li>
            {group.conversations.map((conversation) => {
              const active = conversation.id === activeId;

              return (
                <li key={conversation.id} className={`aspira-history-entry ${active ? 'is-active' : ''}`}>
                  <div className="aspira-history-entry-main">
                    <button
                      type="button"
                      className="aspira-history-select"
                      onClick={() => onSelect(conversation.id)}
                      disabled={isExecuting}
                      aria-current={active ? 'page' : undefined}
                      title={conversation.title}
                    >
                      <span className="aspira-history-title">
                        <span className="aspira-history-active-dot" aria-hidden="true" />
                        <span className="aspira-history-title-text">{conversation.title}</span>
                      </span>
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
                  </div>
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ul>

      <p className={`aspira-history-storage-note ${persistenceError ? 'has-error' : ''}`} role={persistenceError ? 'alert' : undefined}>
        <Database aria-hidden="true" />
        <span>
          {persistenceError
            ? 'Couldn’t save this conversation. Delete an older conversation to free space.'
            : 'Saved in this browser'}
        </span>
      </p>
    </section>
  );
};
