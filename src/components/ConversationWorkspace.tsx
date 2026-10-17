import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, CheckCircle2, ChevronDown, Globe, Lightbulb, ListChecks, MessageCirclePlus, PanelRightOpen, ShieldCheck, Volume2, X } from 'lucide-react';
import type { AgentActionExecution, FileEditProposal, ConversationTurn, ModelPluginManifest } from '../plugins/models/manifest';
import { soundEngine } from '../audio/soundEngine';
import { MarkdownMessage } from './MarkdownMessage';
import { PendingConversationTurn as PendingTurnView } from './PendingConversationTurn';
import type { PendingConversationTurn } from '../plugins/models/turnProgress';
import { latestWorkspaceFileRead } from '../plugins/models/fileReadContext';
import { FileEditProposalCard } from './FileEditProposalCard';
import type { FileEditApproval, FileEditOperation, FileEditOperationResult } from '../plugins/models/fileEditProposals';
import './ConversationSurface.css';

interface ConversationWorkspaceProps {
  models: ModelPluginManifest[];
  awakeModelIds: string[];
  conversationTurns: ConversationTurn[];
  pendingTurn: PendingConversationTurn | null;
  onEditProposalUpdate: (proposal: FileEditProposal, action?: AgentActionExecution | null) => void;
  onEditOperation: (id: string, operation: FileEditOperation, approval: FileEditApproval) => Promise<FileEditOperationResult>;
  isExecuting: boolean;
  activeTaskLabel: string;
  onRunPrompt: (prompt: string) => void;
  onOpenConnections: () => void;
  welcomeComposer?: React.ReactNode;
  onPreviewResult?: (title: string, content: string) => void;
  onRequestAgentReview?: (reply: string) => void;
}


export const ConversationWorkspace: React.FC<ConversationWorkspaceProps> = ({
  models, awakeModelIds, conversationTurns, pendingTurn,
  onEditProposalUpdate, onEditOperation, isExecuting, activeTaskLabel,
  onRunPrompt, onOpenConnections, onPreviewResult, onRequestAgentReview, welcomeComposer,
}) => {
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followLatestRef = useRef(true);
  const firstTurnRef = useRef(conversationTurns[0]?.id);
  const latestFileRead = latestWorkspaceFileRead(conversationTurns);

  const updateScrollPosition = () => {
    const element = scrollRef.current;
    if (!element) return;
    const atLatest = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    followLatestRef.current = atLatest;
    setShowJumpToLatest(!atLatest);
  };

  const jumpToLatest = () => {
    const element = scrollRef.current;
    if (!element) return;
    followLatestRef.current = true;
    setShowJumpToLatest(false);
    element.scrollTo({ top: element.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    const element = scrollRef.current;
    const firstTurnId = conversationTurns[0]?.id;
    if (firstTurnRef.current !== firstTurnId) {
      firstTurnRef.current = firstTurnId;
      followLatestRef.current = true;
      setShowJumpToLatest(false);
      setExpandedTurnId(null);
    }
    if (conversationTurns.length === 0 && !isExecuting) {
      if (element) element.scrollTop = 0;
      followLatestRef.current = true;
      setShowJumpToLatest(false);
    } else if (followLatestRef.current) {
      element?.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
    }
  }, [conversationTurns.length, conversationTurns[0]?.id, isExecuting, pendingTurn]);

  const renderAction = (action: AgentActionExecution) => {
    if (action.editProposal) return (
      <FileEditProposalCard key={action.editProposal.id} proposal={action.editProposal}
        disabled={isExecuting} onUpdate={onEditProposalUpdate}
        onOperate={(id, operation, approval) => {
          followLatestRef.current = false;
          return onEditOperation(id, operation, approval);
        }} />
    );
    const StatusIcon = action.status === 'success' ? CheckCircle2 : action.status === 'blocked' ? ShieldCheck : X;
    const status = action.status === 'success' ? 'Completed' : action.status === 'blocked' ? 'Blocked' : 'Needs attention';
    return (
      <div key={action.id} className={`conversation-activity-item is-${action.status}`} role="group" aria-label={`${action.title}. ${status}.`}>
        <div className="conversation-activity-label"><StatusIcon aria-hidden="true" /><span>{action.title}</span><span className="conversation-activity-status">{status}</span></div>
        {action.fileRead && (
          <div className="conversation-file-range">
            <span>{action.fileRead.totalLines === 0 ? 'Empty file' : `Lines ${action.fileRead.startLine}–${action.fileRead.endLine} of ${action.fileRead.totalLines}`}</span>
            {action.fileRead.hasMore && latestFileRead?.actionId === action.id && (
              <button type="button" disabled={isExecuting} aria-label={`Read ${action.fileRead.path} from line ${action.fileRead.nextLine}, column ${action.fileRead.nextColumn}`} onClick={() => onRunPrompt(`Read the next part of ${action.fileRead.path}.`)}>Read next part <ArrowUpRight aria-hidden="true" /></button>
            )}
          </div>
        )}
        {action.output && <details className="conversation-action-output" open={action.status !== 'success'}><summary>{action.status === 'success' ? 'Details' : 'What happened'}<ChevronDown aria-hidden="true" /></summary><pre aria-label={`Output from ${action.title}`}>{action.output}</pre></details>}
      </div>
    );
  };

  return (
    <div className="conversation-workspace">
      <div ref={scrollRef} onScroll={updateScrollPosition} className="conversation-scroll custom-scrollbar" aria-label="Conversation">
        <div className="conversation-content">
          {conversationTurns.length === 0 && !isExecuting && (
            <section className="conversation-welcome" aria-labelledby="conversation-welcome-title">
              <span className="conversation-welcome-symbol" aria-hidden="true">a<span>·</span></span>
              <h1 id="conversation-welcome-title">What would you like<br className="conversation-welcome-break" /> to take care of?</h1>
              <p>Bring a question, an idea, or something you want to move forward. Your agents are here to help.</p>
              {welcomeComposer}
              {awakeModelIds.length === 0 && <button type="button" className="conversation-connect" onClick={onOpenConnections}>Connect your first agent <ArrowUpRight aria-hidden="true" /></button>}
              <div className="conversation-starters" aria-label="Suggested things to try">
                {[
                  { icon: Lightbulb, title: 'Think something through', detail: 'Find a fresh perspective.', prompt: 'Help me think through an idea. Ask me a question to get started.' },
                  { icon: ListChecks, title: 'Make a plan', detail: 'Turn a goal into next steps.', prompt: 'Help me turn a goal into clear next steps. Ask me what I want to accomplish.' },
                  { icon: Globe, title: 'Catch up on the news', detail: 'Explore the latest in tech.', prompt: 'Search the web for the latest technology news and summarize the main stories with links.' },
                ].map((item) => <button key={item.title} type="button" onClick={() => onRunPrompt(item.prompt)} className="conversation-starter"><item.icon aria-hidden="true" /><span><strong>{item.title}</strong><span>{item.detail}</span></span><ArrowUpRight className="conversation-starter-arrow" aria-hidden="true" /></button>)}
              </div>
            </section>
          )}
          {conversationTurns.map((turn, index) => {
            const showPerspectives = expandedTurnId === turn.id;
            const replies = turn.result.modelStreams.filter((stream) => stream.source !== 'UNAVAILABLE');
            const actions = turn.result.executedActions || [];
            const proposals = actions.filter((action) => action.editProposal);
            const receipts = actions.filter((action) => !action.editProposal);
            const needsAttention = receipts.some((action) => action.status !== 'success');
            const finished = turn.result.completionState !== 'stopped' && turn.result.completionState !== 'interrupted';
            const hasResult = replies.length > 0 || receipts.some((action) => action.status === 'success');
            const reply = turn.result.synthesizedOutput;
            return (
              <article className="conversation-turn" id={`conversation-turn-${turn.id}`} key={turn.id} aria-label={`Conversation turn ${index + 1}`}>
                <div className="conversation-user"><div className="conversation-message-byline"><strong>You</strong>{turn.inputModality === 'voice' && <span>Voice message</span>}<time>{turn.timestamp}</time></div><p>{turn.userText}</p></div>
                {receipts.length > 0 && <details className="conversation-activity" open={needsAttention}><summary><CheckCircle2 aria-hidden="true" /><span>{needsAttention ? 'Activity needs your attention' : `${receipts.length} ${receipts.length === 1 ? 'action completed' : 'actions completed'}`}</span><ChevronDown aria-hidden="true" /></summary><div>{receipts.map(renderAction)}</div></details>}
                {proposals.map(renderAction)}
                <section className="conversation-assistant" aria-label="Aspira response">
                  <div className="conversation-message-byline conversation-assistant-byline"><span className="conversation-assistant-symbol" aria-hidden="true">a<span>·</span></span><strong>Aspira</strong><span>{!finished ? (turn.result.completionState === 'stopped' ? 'Response stopped' : 'Response interrupted') : replies.length ? replies.map((stream) => stream.codeName).join(' · ') : turn.result.modelStreams.length ? 'Could not respond' : 'Local action'}</span></div>
                  <MarkdownMessage content={reply} className="conversation-answer" />
                  <div className="conversation-response-tools" aria-label="Response controls">
                    {onPreviewResult && reply && finished && hasResult && <button type="button" onClick={() => onPreviewResult(turn.userText.length > 64 ? `${turn.userText.slice(0, 61)}…` : turn.userText, reply)}><PanelRightOpen aria-hidden="true" />Open result</button>}
                    {onRequestAgentReview && reply && finished && hasResult && <button type="button" disabled={isExecuting} onClick={() => onRequestAgentReview(reply)}><MessageCirclePlus aria-hidden="true" />Ask another agent</button>}
                    {turn.result.spokenReply && <button type="button" onClick={() => soundEngine.speak(turn.result.spokenReply)}><Volume2 aria-hidden="true" />Listen</button>}
                    {turn.result.modelStreams.length > 1 && <button type="button" onClick={() => setExpandedTurnId(showPerspectives ? null : turn.id)} aria-expanded={showPerspectives}><ChevronDown aria-hidden="true" />{showPerspectives ? 'Hide' : 'View'} contributions</button>}
                    {!hasResult && finished && <><button type="button" disabled={isExecuting} onClick={() => onRunPrompt(turn.userText)}>Try again</button><button type="button" onClick={onOpenConnections}>Choose another agent</button></>}
                  </div>
                  {showPerspectives && (
                    <div className="conversation-contributions">
                      {turn.result.modelStreams.map((stream) => (
                        <section key={stream.modelId}>
                          <h3>
                            {stream.codeName}
                            <span>
                              {stream.source === 'UNAVAILABLE'
                                ? 'No final reply'
                                : stream.providerBadge === 'CODEX_APP_SERVER'
                                ? 'Codex app-server'
                                : stream.source === 'PROVIDER_CLI' || stream.source === 'SUBSCRIPTION_OAUTH'
                                ? 'Provider CLI'
                                : stream.source === 'LIVE_API'
                                ? 'API'
                                : 'Local'}
                            </span>
                          </h3>
                          <MarkdownMessage content={stream.keyInsight} className="conversation-contribution" />
                        </section>
                      ))}
                    </div>
                  )}
                  {index === conversationTurns.length - 1 && !!turn.result.followUpSuggestions?.length && <div className="conversation-followups" aria-label="Continue this conversation">{turn.result.followUpSuggestions.map((suggestion, suggestionIndex) => <button key={suggestionIndex} type="button" disabled={isExecuting} onClick={() => onRunPrompt(suggestion)}>{suggestion}<ArrowUpRight aria-hidden="true" /></button>)}</div>}
                </section>
              </article>
            );
          })}
          {pendingTurn && <PendingTurnView turn={pendingTurn} />}
          {isExecuting && !pendingTurn && <div className="conversation-working" role="status" aria-live="polite"><span aria-hidden="true" />{activeTaskLabel || 'Working on your request…'}</div>}
        </div>
      </div>
      {showJumpToLatest && (conversationTurns.length > 0 || pendingTurn) && <button type="button" className="conversation-jump" onClick={jumpToLatest} aria-label="Jump to the latest message"><ArrowDown aria-hidden="true" />Latest message</button>}
    </div>
  );
};
