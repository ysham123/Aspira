import React from 'react';
import { CheckCircle2, ChevronDown, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { PendingConversationTurn as PendingTurn } from '../plugins/models/turnProgress';
import { MarkdownMessage } from './MarkdownMessage';
import './PendingConversationTurn.css';

export function PendingConversationTurn({ turn }: { turn: PendingTurn }) {
  const readyResponses = turn.responses.filter((response) => response.source !== 'UNAVAILABLE');
  return (
    <article className="aspira-turn aspira-live-turn" aria-label="Conversation turn in progress">
      <div className="aspira-user-turn">
        <div className="aspira-user-message">
          <div className="aspira-user-meta">
            <span className="aspira-user-author">You</span>
            <span>{turn.inputModality === 'voice' ? 'Voice' : 'Message'}</span>
            <time>{turn.timestamp}</time>
          </div>
          <p className="aspira-user-copy">{turn.userText}</p>
        </div>
      </div>
      <div className="aspira-response-card aspira-live-activity">
        <div className="aspira-response-byline">
          <span className="aspira-assistant-mark" aria-hidden="true"><Sparkles /></span>
          <span className="aspira-assistant-name">Aspira</span>
          <span className="aspira-answer-summary">{readyResponses.length ? `${readyResponses.length} ${readyResponses.length === 1 ? 'reply' : 'replies'} ready` : 'Working on your request'}</span>
        </div>
        <div className="aspira-live-agents" role="status" aria-live="polite" aria-atomic="true">
          {turn.agents.map((agent) => (
            <div className={`aspira-live-agent is-${agent.phase}`} key={agent.modelId}>
              {agent.phase === 'responded' ? <CheckCircle2 aria-hidden="true" /> : agent.phase === 'unavailable' ? <X aria-hidden="true" /> : <LoaderCircle className="aspira-live-spinner" aria-hidden="true" />}
              <span className="aspira-live-agent-name">{agent.name}</span>
              <span className="aspira-live-agent-message">{agent.message}</span>
            </div>
          ))}
        </div>
        {(turn.actions.length > 0 || turn.runningActions.length > 0) && (
          <div className="aspira-live-actions" aria-label="Action activity">
            {turn.actions.map((action) => (
              <details key={action.id} className={`aspira-live-receipt is-${action.status}`}>
                <summary>
                  {action.status === 'success' ? <CheckCircle2 aria-hidden="true" /> : <X aria-hidden="true" />}
                  <span>{action.title}</span>
                  <span className="aspira-live-receipt-state">{action.status === 'success' ? 'Completed' : action.status === 'blocked' ? 'Blocked' : 'Needs attention'}</span>
                  <ChevronDown aria-hidden="true" />
                </summary>
                <pre>{action.output || 'No output was returned.'}</pre>
              </details>
            ))}
            {turn.runningActions.map((action) => (
              <div className="aspira-live-running-action" key={action.id}>
                <LoaderCircle className="aspira-live-spinner" aria-hidden="true" />
                <span>{action.title}</span>
                <span className="aspira-live-receipt-state">In progress</span>
              </div>
            ))}
          </div>
        )}
        {readyResponses.map((response) => (
          <section key={response.modelId} className="aspira-live-reply" aria-label={`${response.codeName} response`}>
            <p className="aspira-live-reply-name">{response.codeName}</p>
            <MarkdownMessage content={response.keyInsight} className="aspira-answer-markdown" />
          </section>
        ))}
      </div>
    </article>
  );
}
