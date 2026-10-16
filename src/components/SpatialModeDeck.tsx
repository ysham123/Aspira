import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AppWindow,
  Bell,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  Code2,
  Cpu,
  Eye,
  FileCode2,
  FolderGit2,
  Globe,
  Layers,
  MessageSquare,
  Mic,
  Play,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  AgentActionExecution,
  LocalPlaybook,
  ConversationTurn,
  LivingMemoryItem,
  ModelPluginManifest,
  SpatialMode,
  SynergyExecutionResult,
} from '../plugins/models/manifest';
import { soundEngine } from '../audio/soundEngine';
import { MarkdownMessage } from './MarkdownMessage';
import { PendingConversationTurn as PendingTurnView } from './PendingConversationTurn';
import type { PendingConversationTurn } from '../plugins/models/turnProgress';

interface SpatialModeDeckProps {
  spatialMode: SpatialMode;
  models: ModelPluginManifest[];
  awakeModelIds: string[];
  synergyResult: SynergyExecutionResult | null;
  conversationTurns: ConversationTurn[];
  pendingTurn: PendingConversationTurn | null;
  memories: LivingMemoryItem[];
  onToggleMemoryStatus: (id: string, nextStatus: 'IN_PROGRESS' | 'COMPLETED' | 'ACTIVE') => void;
  onDeleteMemory: (id: string) => void;
  onAddMemory: (content: string, category: LivingMemoryItem['category']) => void;
  routines: LocalPlaybook[];
  onRunRoutine: (routineId: string) => void;
  onExecuteDirectAction: (tool: string, args: Record<string, unknown>, label: string) => void;
  isExecuting: boolean;
  activeTaskLabel: string;
  onRunPrompt: (prompt: string) => void;
  onOpenConnections: () => void;
  duplexVoiceActive: boolean;
  onToggleDuplexVoice: () => void;
  isAgentSpeaking: boolean;
  liveTranscript: string;
  voiceStatus: string;
}

interface FsNode {
  id: string;
  label: string;
  type: 'core' | 'directory' | 'module' | 'config' | 'file';
  lines: number;
  preview?: string;
  previewTruncated?: boolean;
}

export const SpatialModeDeck: React.FC<SpatialModeDeckProps> = ({
  spatialMode,
  models,
  awakeModelIds,
  synergyResult,
  conversationTurns,
  pendingTurn,
  memories,
  onToggleMemoryStatus,
  onDeleteMemory,
  onAddMemory,
  routines,
  onRunRoutine,
  onExecuteDirectAction,
  isExecuting,
  activeTaskLabel,
  onRunPrompt,
  onOpenConnections,
  duplexVoiceActive,
  onToggleDuplexVoice,
  isAgentSpeaking,
  liveTranscript,
  voiceStatus,
}) => {
  const [rightRailTab, setRightRailTab] = useState<'memory' | 'routines' | 'tools'>('memory');
  const [contextExpanded, setContextExpanded] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1536
  );
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<LivingMemoryItem['category']>('goal');
  const selectedModelNames = models
    .filter((model) => awakeModelIds.includes(model.id))
    .map((model) => model.codeName);
  // Workbench state
  const [fsNodes, setFsNodes] = useState<FsNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FsNode | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<'source' | 'diff'>('source');
  const [fileDiff, setFileDiff] = useState<{ workingDiff: string; stagedDiff: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [fileDiffError, setFileDiffError] = useState('');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [customShellCmd, setCustomShellCmd] = useState('');
  const [terminalLog, setTerminalLog] = useState<{
    command: string;
    output: string;
    timestamp: string;
  } | null>(null);
  const [terminalError, setTerminalError] = useState('');
  const [activeTerminalCommand, setActiveTerminalCommand] = useState('');
  const [runningTerminal, setRunningTerminal] = useState(false);

  useEffect(() => {
    const wideLayout = window.matchMedia('(min-width: 1536px)');
    const collapseOnLaptopLayout = () => {
      if (!wideLayout.matches) setContextExpanded(false);
    };
    collapseOnLaptopLayout();
    wideLayout.addEventListener('change', collapseOnLaptopLayout);
    return () => wideLayout.removeEventListener('change', collapseOnLaptopLayout);
  }, []);

  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const followLatestRef = useRef(true);
  const previousConversationFirstTurnRef = useRef<string | undefined>(conversationTurns[0]?.id);

  const handleConversationScroll = () => {
    const scrollContainer = conversationScrollRef.current;
    if (!scrollContainer) return;
    const isAtLatest = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 96;
    setShowJumpToLatest(!isAtLatest);
    // Only user scrolling changes the follow preference. Content growing while
    // a reply streams should not make an already-following conversation detach.
    followLatestRef.current = isAtLatest;
  };

  const jumpToLatest = () => {
    const scrollContainer = conversationScrollRef.current;
    if (!scrollContainer) return;
    followLatestRef.current = true;
    setShowJumpToLatest(false);
    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    const scrollContainer = conversationScrollRef.current;
    const firstTurnId = conversationTurns[0]?.id;
    if (previousConversationFirstTurnRef.current !== firstTurnId) {
      previousConversationFirstTurnRef.current = firstTurnId;
      followLatestRef.current = true;
      setShowJumpToLatest(false);
    }
    if (conversationTurns.length === 0 && !isExecuting) {
      if (scrollContainer) scrollContainer.scrollTop = 0;
      followLatestRef.current = true;
      setShowJumpToLatest(false);
      return;
    }
    if (followLatestRef.current) {
      scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      setShowJumpToLatest(false);
    }
  }, [conversationTurns.length, conversationTurns[0]?.id, isExecuting, pendingTurn]);

  useEffect(() => {
    if (spatialMode === 'forge' && fsNodes.length === 0) {
      fetch('/api/fs-graph')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data?.nodes)) {
            const files = data.nodes.filter(
              (n: FsNode) => n.type === 'module' || n.type === 'file' || n.type === 'config'
            );
            setFsNodes(files);
            if (files.length > 0 && !selectedFile) {
              setSelectedFile(
                files.find((f: FsNode) => f.id.includes('App.tsx')) || files[0]
              );
            }
          }
        })
        .catch(() => {});
    }
  }, [spatialMode, fsNodes.length, selectedFile]);

  useEffect(() => {
    if (spatialMode !== 'forge' || workbenchTab !== 'diff' || !selectedFile?.id) return;
    let current = true;
    setDiffLoading(true);
    setFileDiff(null);
    setFileDiffError('');
    fetch(`/api/git/diff?path=${encodeURIComponent(selectedFile.id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || `Git diff returned ${response.status}.`);
        return data;
      })
      .then((data) => {
        if (current) setFileDiff({
          workingDiff: data?.workingDiff || '',
          stagedDiff: data?.stagedDiff || '',
        });
      })
      .catch((error: unknown) => {
        if (current) setFileDiffError(error instanceof Error ? error.message : 'Could not read this Git diff.');
      })
      .finally(() => {
        if (current) setDiffLoading(false);
      });
    return () => { current = false; };
  }, [spatialMode, workbenchTab, selectedFile?.id]);

  const runTerminalPreset = async (preset: string, customCommand?: string) => {
    const presetLabels: Record<string, string> = {
      'git-status': 'git status and recent commits',
      'sys-procs': 'top processes',
      'disk-df': 'disk free',
      'net-stat': 'network interfaces',
      'tree-scan': 'source tree',
    };
    setActiveTerminalCommand(customCommand?.trim() || presetLabels[preset] || preset);
    setTerminalError('');
    setTerminalLog(null);
    setRunningTerminal(true);
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customCommand ? { customCommand } : { preset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.output || data?.error || `The command returned ${res.status}.`);
      setTerminalLog({
        command: data?.command || customCommand?.trim() || presetLabels[preset] || preset,
        output: data?.output || '(No output)',
        timestamp: data?.timestamp || new Date().toISOString(),
      });
    } catch (error) {
      setTerminalError(error instanceof Error ? error.message : 'Could not run this local command.');
    } finally {
      setRunningTerminal(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ==========================================================================
  // VIEW 1: CONVERSATIONAL PERSONAL AGENT STUDIO
  // ==========================================================================
  if (spatialMode === 'nexus') {
    return (
      <div className="aspira-studio-layout flex h-full w-full min-w-0 gap-4 overflow-hidden">
        <div className="aspira-conversation-column flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="aspira-conversation-heading">
            <div className="aspira-conversation-heading-copy">
              <p className="aspira-conversation-kicker">PERSONAL WORKSPACE</p>
              <h1 className="aspira-conversation-title">Conversation</h1>
              <p className="aspira-conversation-subtitle">Ask naturally. Think together. Get useful work done.</p>
            </div>
            <div className="aspira-conversation-controls">
              {selectedModelNames.length > 0 ? (
                <div className="aspira-conversation-model-state" aria-label={`${selectedModelNames.join(', ')} selected for replies`}>
                  <span className="aspira-conversation-presence-dot" aria-hidden="true" />
                  <span className="aspira-conversation-model-state-label">Selected</span>
                  <span className="aspira-conversation-model-divider" aria-hidden="true" />
                  <span className="aspira-conversation-model-names">{selectedModelNames.join(' · ')}</span>
                </div>
              ) : (
                <div className="aspira-conversation-model-state is-local" aria-label="Local actions available; no model selected">
                  <span className="aspira-conversation-presence-dot" aria-hidden="true" />
                  <span className="aspira-conversation-model-state-label">Local actions ready</span>
                </div>
              )}
              {voiceStatus !== 'Voice input is off' && (
                <div className={`aspira-voice-presence${isAgentSpeaking ? ' is-speaking' : duplexVoiceActive ? ' is-listening' : ''}`} role="status" aria-live="polite">
                  <span className="aspira-voice-presence-dot" aria-hidden="true" />
                  <span className="aspira-voice-presence-copy">
                    <span>{voiceStatus}</span>
                    {liveTranscript && <span className="aspira-voice-transcript">“{liveTranscript}”</span>}
                  </span>
                </div>
              )}
              {isAgentSpeaking && <button type="button" onClick={() => soundEngine.stopSpeaking()} className="aspira-voice-stop">Stop voice</button>}
              <button
                type="button"
                onClick={() => setContextExpanded((expanded) => !expanded)}
                aria-controls="workspace-context-rail"
                aria-expanded={contextExpanded}
                aria-label={contextExpanded ? 'Hide workspace context' : 'Show workspace context'}
                className="aspira-context-toggle aspira-conversation-context-toggle flex min-h-11 min-w-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{contextExpanded ? 'Hide context' : 'Show context'}</span>
                <span className="sm:hidden">Context</span>
              </button>
            </div>
          </div>

          {/* Multi-Turn Conversational Timeline */}
          <div
            ref={conversationScrollRef}
            onScroll={handleConversationScroll}
            className="aspira-conversation-surface aspira-conversation-feed flex flex-1 flex-col overflow-y-auto custom-scrollbar"
          >
            {conversationTurns.length === 0 && !isExecuting && (
              <section className="aspira-empty-state" aria-labelledby="aspira-empty-title">
                <div className="aspira-empty-copy">
                  <p className="aspira-empty-eyebrow">A GOOD PLACE TO BEGIN</p>
                  <h2 id="aspira-empty-title" className="aspira-empty-title">What would you like to work through?</h2>
                  <p className="aspira-empty-intro">
                    Start with a question, an idea, or something you want done on this Mac.
                    {selectedModelNames.length > 0
                      ? ' Your selected models will respond in this conversation.'
                      : ' Connect a model for a conversation, or start with a local action.'}
                  </p>
                  {selectedModelNames.length > 0 && (
                    <div className="aspira-empty-agents" aria-label={`Models selected for this chat: ${selectedModelNames.join(', ')}`}>
                      <span className="aspira-empty-agents-label">SELECTED FOR THIS CHAT</span>
                      {selectedModelNames.map((name) => <span className="aspira-empty-agent" key={name}>{name}</span>)}
                    </div>
                  )}
                </div>
                {selectedModelNames.length === 0 && (
                  <button type="button" className="aspira-empty-connect" onClick={onOpenConnections}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Connect a model
                  </button>
                )}
                <div className="aspira-empty-prompts" aria-label="Suggested things to try">
                  {[
                    { icon: Brain, title: 'Get oriented', detail: 'Understand this project and find a useful next step.', prompt: 'Summarize this workspace and tell me what I should work on next.' },
                    { icon: Cpu, title: 'Check this Mac', detail: 'See current CPU, memory, and battery status.', prompt: 'Check my Mac CPU, memory, and battery status.' },
                    { icon: FolderGit2, title: 'Review my changes', detail: 'See what changed in the current Git worktree.', prompt: 'Run git status' },
                    { icon: Globe, title: 'Explore what’s new', detail: 'Catch up on the latest Hacker News stories.', prompt: 'Show me the Hacker News top stories.' },
                  ].map((item) => (
                    <button key={item.title} type="button" onClick={() => onRunPrompt(item.prompt)} className="aspira-empty-prompt">
                      <span className="aspira-suggestion-icon"><item.icon aria-hidden="true" /></span>
                      <span className="aspira-suggestion-copy">
                        <span className="aspira-suggestion-title">{item.title}</span>
                        <span className="aspira-suggestion-detail">{item.detail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {conversationTurns.map((turn, idx) => {
              const isLatest = idx === conversationTurns.length - 1;
              const showDetails = expandedTurnId === turn.id;
              const answeredByCount = turn.result.modelStreams.filter((stream) => stream.source !== 'UNAVAILABLE').length;
              const hasLocalActions = (turn.result.executedActions?.length || 0) > 0;

              return (
                <div
                  key={turn.id}
                  className="aspira-turn"
                  role="article"
                  aria-label={`Conversation turn ${idx + 1}`}
                >
                  {/* 1. User Conversational Turn Bubble */}
                  <div className="aspira-user-turn">
                    <div className="aspira-user-message">
                      <div className="aspira-user-meta">
                        <span className="aspira-user-author">You</span>
                        <span>
                          {turn.inputModality === 'voice'
                            ? 'Voice'
                            : turn.inputModality === 'routine'
                            ? 'Routine'
                            : 'Message'}
                        </span>
                        {turn.vocalEmotion && (
                          <span className="aspira-emotion-label">
                            {turn.vocalEmotion}
                          </span>
                        )}
                        <time>{turn.timestamp}</time>
                      </div>
                      <p className="aspira-user-copy">{turn.userText}</p>
                    </div>
                  </div>

                  {/* Local actions executed during this turn */}
                  {turn.result.executedActions && turn.result.executedActions.length > 0 && (
                    <div
                      className="aspira-action-receipts"
                      role="group"
                      aria-label={`${turn.result.executedActions.length} local action ${turn.result.executedActions.length === 1 ? 'receipt' : 'receipts'}`}
                    >
                      <p className="aspira-action-section-label">
                        {turn.result.executedActions.length === 1 ? 'Local action' : `${turn.result.executedActions.length} local actions`}
                      </p>
                      {turn.result.executedActions.map((act: AgentActionExecution) => {
                        const StatusIcon = act.status === 'success'
                          ? CheckCircle2
                          : act.status === 'blocked'
                          ? ShieldCheck
                          : X;
                        const statusLabel = act.status === 'success'
                          ? 'Completed'
                          : act.status === 'blocked'
                          ? 'Blocked'
                          : 'Needs attention';
                        return (
                          <div
                            key={act.id}
                            role="group"
                            aria-label={`${act.title}. ${statusLabel} in ${act.durationMs} milliseconds.`}
                            className={`aspira-action-card aspira-action-card--${act.status}`}
                          >
                            <div className="aspira-action-card-heading">
                              <div className="aspira-action-card-title-row">
                                <StatusIcon className="aspira-action-status-icon" aria-hidden="true" />
                                <span className="aspira-action-title">
                                  {act.title}
                                </span>
                              </div>
                              <span className="aspira-action-state text-[10px] font-medium">
                                {statusLabel} · {act.durationMs}ms
                              </span>
                            </div>
                            {act.output && (
                              <details className="aspira-action-details" open={act.status !== 'success'}>
                                <summary className="aspira-action-details-summary">
                                  <span>{act.status === 'success' ? 'View output' : act.status === 'blocked' ? 'Why it was blocked' : 'What went wrong'}</span>
                                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                </summary>
                                <pre aria-label={`Output from ${act.title}`} className="aspira-code mt-2 text-[11px] font-mono text-slate-300 bg-black/40 rounded-xl p-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/[0.05]">
                                  {act.output}
                                </pre>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Multi-Agent Conversational Reply Card */}
                  <div className="aspira-response-card">
                    <div className="aspira-response-byline">
                      <span className="aspira-assistant-mark" aria-hidden="true"><Sparkles /></span>
                      <span className="aspira-assistant-name">Aspira</span>
                      <span className="aspira-answer-summary">
                        {turn.result.completionState === 'stopped'
                          ? 'Response stopped'
                          : turn.result.completionState === 'interrupted'
                          ? 'Response interrupted'
                          : answeredByCount > 0
                          ? `Answered with ${answeredByCount} ${answeredByCount === 1 ? 'model' : 'models'}`
                          : hasLocalActions
                          ? 'Local action'
                          : 'Response'}
                      </span>
                    </div>
                    <div className="aspira-answer-toolbar">
                      <div className="aspira-model-provenance" role="group" aria-label="Models and connections used for this response">
                        {turn.result.modelStreams.map((stream) => {
                          const m = models.find((mod) => mod.id === stream.modelId);
                          return (
                            <span
                              key={stream.modelId}
                              className="aspira-model-provenance-chip"
                            >
                              <span
                                className="aspira-model-provenance-dot"
                                style={{ backgroundColor: m?.accentHex || '#6E8EFB' }}
                              />
                              <span className="aspira-model-provenance-name">{stream.codeName}</span>
                              <span className={`aspira-model-provenance-source ${
                                  stream.source === 'PROVIDER_CLI' || stream.source === 'SUBSCRIPTION_OAUTH'
                                    ? 'is-connected'
                                    : ''
                                }`}
                              >
                                {stream.source === 'PROVIDER_CLI' || stream.source === 'SUBSCRIPTION_OAUTH'
                                  ? 'Provider CLI'
                                  : stream.source === 'LOCAL_OLLAMA'
                                  ? 'Local'
                                  : stream.source === 'LIVE_API'
                                  ? 'API'
                                  : stream.source === 'UNAVAILABLE'
                                  ? 'Unavailable'
                                  : `Local · ${stream.latencyMs}ms`}
                              </span>
                            </span>
                          );
                        })}
                      </div>

                      <div className="aspira-answer-actions">
                        {turn.result.modelStreams.some((stream) => stream.source !== 'UNAVAILABLE') && <button
                          onClick={() => {
                            onExecuteDirectAction(
                              'subscription_desktop_handoff',
                              {
                                modelId: turn.result.modelStreams[0]?.modelId || 'claude',
                                prompt: turn.userText,
                              },
                              `Continue "${turn.userText.slice(0, 32)}..." in provider app`
                            );
                          }}
                          className="aspira-answer-action"
                          title="Copy this prompt and open the provider app. Review it there before sending."
                        >
                          <AppWindow aria-hidden="true" />
                          Continue in App
                        </button>}

                        {turn.result.spokenReply && <button
                          onClick={() => {
                            soundEngine.speak(turn.result.spokenReply);
                          }}
                          className="aspira-answer-action"
                          title="Speak this response aloud"
                        >
                          <Volume2 aria-hidden="true" />
                          Speak
                        </button>}

                        {turn.result.modelStreams.length > 1 && (
                          <button
                            onClick={() => {
                              setExpandedTurnId(expandedTurnId === turn.id ? null : turn.id);
                            }}
                            aria-expanded={showDetails}
                            className="aspira-answer-action"
                          >
                            {showDetails ? (
                              <>
                                Hide perspectives <ChevronUp aria-hidden="true" />
                              </>
                            ) : (
                              <>
                                Compare {turn.result.modelStreams.length} perspectives{' '}
                                <ChevronDown aria-hidden="true" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Primary Conversational Output */}
                    <MarkdownMessage
                      content={turn.result.synthesizedOutput}
                      className="aspira-answer-markdown"
                    />

                    {/* Expandable Individual Agent Perspectives / Debate / Race / Relay */}
                    {showDetails && (
                      <div className="aspira-perspective-grid">
                        {turn.result.modelStreams.map((stream) => {
                          const m = models.find((mod) => mod.id === stream.modelId);
                          return (
                            <div
                              key={stream.modelId}
                              className="aspira-perspective-card"
                            >
                              <div className="aspira-perspective-heading">
                                <span className="aspira-perspective-name">
                                  {stream.codeName}{' '}
                                  <span className="aspira-perspective-badge">
                                    {stream.badgeLabel}
                                  </span>
                                </span>
                                <span className="aspira-perspective-latency"
                                  style={{ color: m?.accentHex }}
                                >
                                  {stream.latencyMs}ms
                                </span>
                              </div>
                              <MarkdownMessage
                                content={stream.keyInsight}
                                className="aspira-perspective-markdown"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Follow-up Action Chips on Latest Turn */}
                    {isLatest &&
                      turn.result.followUpSuggestions &&
                      turn.result.followUpSuggestions.length > 0 && (
                        <div className="aspira-follow-up">
                          <span className="aspira-follow-up-label">
                            Keep going
                          </span>
                          {turn.result.followUpSuggestions.map((suggestion, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => onRunPrompt(suggestion)}
                              className="aspira-follow-up-chip"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}

            {pendingTurn && <PendingTurnView turn={pendingTurn} />}

            {isExecuting && !pendingTurn && (
              <div className="aspira-progress-state mx-auto w-full max-w-3xl" role="status" aria-live="polite" aria-atomic="true">
                <span className="aspira-progress-indicator" aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="break-words font-medium text-slate-700">
                    {activeTaskLabel || (awakeModelIds.length
                      ? `Thinking with ${awakeModelIds.map((id) => models.find((model) => model.id === id)?.codeName || id).join(' and ')}…`
                      : 'Working on your request…')}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {awakeModelIds.length > 1
                      ? `${awakeModelIds.length} selected models · their answer will appear here`
                      : awakeModelIds.length === 1
                      ? 'Your model is working · the answer will appear here'
                      : 'Running locally · the result will appear here'}
                  </span>
                </span>
              </div>
            )}

            {showJumpToLatest && (conversationTurns.length > 0 || pendingTurn) && (
              <button
                type="button"
                className="aspira-jump-to-latest"
                onClick={jumpToLatest}
                aria-label="Jump to the latest message"
              >
                Jump to latest <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Workspace context, on-demand playbooks, and local tools */}
        <aside
          id="workspace-context-rail"
          aria-label="Workspace context, routines, and local tools"
          className={contextExpanded
            ? 'aspira-context-rail fixed inset-x-3 bottom-28 z-40 flex max-h-[58vh] flex-col gap-3 overflow-hidden rounded-[24px] border border-white/10 bg-white p-3 shadow-2xl 2xl:relative 2xl:inset-auto 2xl:z-10 2xl:h-full 2xl:w-[330px] 2xl:max-h-none 2xl:shrink-0 2xl:rounded-none 2xl:border-0 2xl:bg-transparent 2xl:p-0 2xl:shadow-none'
            : 'hidden'}
        >
          {/* Segmented Switcher */}
          <div className="aspira-glass aspira-context-tabs rounded-2xl p-1.5 flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRightRailTab('memory');
              }}
              aria-pressed={rightRailTab === 'memory'}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'memory'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span className="aspira-context-tab-label">Memory</span><span className="aspira-context-tab-count">{memories.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRightRailTab('routines');
              }}
              aria-pressed={rightRailTab === 'routines'}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'routines'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="aspira-context-tab-label">Routines</span><span className="aspira-context-tab-count">{routines.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRightRailTab('tools');
              }}
              aria-pressed={rightRailTab === 'tools'}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'tools'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="aspira-context-tab-label">Tools</span>
            </button>
            <button
              onClick={() => setContextExpanded(false)}
              className="aspira-context-close rounded-lg p-2 text-slate-500 hover:text-slate-800 xl:hidden"
              aria-label="Close workspace context"
            ><X className="h-4 w-4" /></button>
          </div>

          {/* TAB 1: Saved local context */}
          {rightRailTab === 'memory' && (
            <div className="aspira-glass aspira-context-panel rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                    Saved context
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Saved items are included with provider prompts. Add one here or say “remember that…” in chat.
                  </p>
                </div>
              </div>

              {/* Quick Add Memory Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMemoryInput.trim()) return;
                  onAddMemory(newMemoryInput.trim(), newMemoryCategory);
                  setNewMemoryInput('');
                }}
                className="aspira-memory-form flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-2.5"
              >
                <div className="aspira-memory-category-row flex items-center gap-1.5">
                  {(['goal', 'task', 'preference', 'project', 'insight'] as const).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setNewMemoryCategory(cat)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase transition-all ${
                        newMemoryCategory === cat
                          ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="aspira-memory-form-row flex items-center gap-2">
                  <input
                    type="text"
                    value={newMemoryInput}
                    onChange={(e) => setNewMemoryInput(e.target.value)}
                    placeholder="Add a goal, task, or preference..."
                    className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none px-1"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </form>

              {/* Memory Items List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-1">
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="aspira-memory-card rounded-2xl p-3.5 bg-white/[0.025] border border-white/[0.07] hover:border-white/[0.14] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/20">
                          {mem.category}
                        </span>
                        <button
                          onClick={() => {
                            const next =
                              mem.status === 'IN_PROGRESS'
                                ? 'COMPLETED'
                                : mem.status === 'COMPLETED'
                                ? 'ACTIVE'
                                : 'IN_PROGRESS';
                            onToggleMemoryStatus(mem.id, next);
                          }}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                            mem.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                              : mem.status === 'IN_PROGRESS'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                              : 'bg-white/[0.05] text-slate-300 border-white/[0.1]'
                          }`}
                          title="Click to cycle status (IN_PROGRESS / COMPLETED / ACTIVE)"
                        >
                          {mem.status}
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          onDeleteMemory(mem.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        mem.status === 'COMPLETED' ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {mem.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: User-triggered local playbooks */}
          {rightRailTab === 'routines' && (
            <div className="aspira-glass aspira-context-panel rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                  Local playbooks
                </div>
                <p className="text-[11px] text-slate-400">
                  Run these predefined steps on demand. They do not run on a schedule or ask a model to decide what to do.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {routines.map((routine) => (
                  <div
                    key={routine.id}
                    className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{routine.title}</div>
                        <div className="text-[10px] font-mono text-amber-300/90 mt-0.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> On demand · {routine.steps.length} steps
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onRunRoutine(routine.id);
                        }}
                        disabled={isExecuting}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/35 text-amber-200 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" /> Run playbook
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{routine.description}</p>

                    <div className="flex flex-col gap-1 pt-1 border-t border-white/[0.06]">
                      {routine.steps.map((s, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] text-slate-400 flex items-center justify-between"
                        >
                          <span>
                            {idx + 1}. {s.label}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{s.tool}</span>
                        </div>
                      ))}
                    </div>

                    {routine.lastRunAt && (
                      <div className="text-[10px] font-mono text-emerald-400">
                        ✓ Last executed at {new Date(routine.lastRunAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIONS AVAILABLE THROUGH ASPIRA'S LOCAL BRIDGE */}
          {rightRailTab === 'tools' && (
            <div className="aspira-glass aspira-context-panel rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Local actions</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">Aspira runs these directly on this Mac when your request matches. Provider CLIs currently receive text prompts in a restricted planning mode.</p>
              </div>
              {[
                ['Apps and links', 'Open a supported macOS app or an HTTP/HTTPS address in your browser.'],
                ['Workspace files', 'Read or create files under the Aspira project directory.'],
                ['Git and system', 'Read Git status, recent commits, disk, memory, power, and provider CLI availability.'],
                ['Memory', 'Save a note, preference, task, or goal and include it in later provider prompts.'],
                ['Quick lookup', 'Try DuckDuckGo instant answers, then Hacker News top stories when the first lookup is thin.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="text-xs font-medium text-slate-200">{title}</div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: READ-ONLY WORKSPACE AND GIT REVIEW
  // ==========================================================================
  if (spatialMode === 'forge') {
    const codeLines = (selectedFile?.preview || '// Select a file to inspect source').split('\n');

    return (
      <div className="aspira-workbench-layout flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto custom-scrollbar lg:grid lg:grid-cols-12 lg:gap-5 lg:overflow-hidden">
        <div className="col-span-12 lg:col-span-4 aspira-glass rounded-3xl p-4 flex flex-col gap-3 h-32 min-[361px]:h-40 shrink-0 overflow-hidden lg:h-full lg:shrink">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Workspace Files
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{fsNodes.length} modules</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
            {fsNodes.map((node) => {
              const active = selectedFile?.id === node.id;
              return (
                <button
                  type="button"
                  key={node.id}
                  onClick={() => {
                    setSelectedFile(node);
                  }}
                  aria-pressed={active}
                  aria-label={`${node.label}, ${node.id}, ${node.lines} lines${node.previewTruncated ? ', preview shortened' : ''}`}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-all ${
                    active
                      ? 'bg-indigo-500/15 border border-indigo-400/35 text-white'
                      : 'hover:bg-white/[0.04] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCode2
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-indigo-400' : 'text-slate-500'
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-xs font-medium truncate">{node.label}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">{node.id}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                    {node.lines}L
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 flex h-[420px] min-h-0 shrink-0 flex-col gap-3 overflow-hidden lg:h-full lg:min-h-0 lg:shrink lg:gap-4">
          <div className="aspira-glass-elevated rounded-3xl p-4 lg:p-5 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {selectedFile?.id || 'src/App.tsx'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedFile ? `${selectedFile.lines} lines · read-only preview` : 'Choose a file'}
                    {selectedFile?.previewTruncated ? ' · preview shortened' : ''}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Workbench preview mode" className="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => setWorkbenchTab('source')}
                    aria-pressed={workbenchTab === 'source'}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      workbenchTab === 'source' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Source
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkbenchTab('diff')}
                    aria-pressed={workbenchTab === 'diff'}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      workbenchTab === 'diff' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Git diff
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setTerminalOpen((prev) => !prev)}
                  aria-expanded={terminalOpen}
                  aria-controls="workbench-terminal-panel"
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Terminal (⌘J)
                </button>
              </div>
            </div>

            {workbenchTab === 'source' ? (
              <div className="aspira-code min-h-0 flex-1 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed bg-black/30 rounded-2xl p-4 border border-white/[0.05]">
                {codeLines.slice(0, 120).map((line, idx) => (
                  <div key={idx} className="flex gap-4 hover:bg-white/[0.02] px-1 rounded">
                    <span className="w-8 text-right text-slate-600 select-none">{idx + 1}</span>
                    <span className="text-slate-200 whitespace-pre-wrap break-all">{line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspira-code min-h-0 flex-1 overflow-y-auto custom-scrollbar rounded-2xl bg-black/30 p-4 font-mono text-xs leading-relaxed">
                {diffLoading ? (
                  <p role="status" aria-live="polite" className="text-slate-500">Loading Git diff…</p>
                ) : fileDiffError ? (
                  <p role="alert" className="text-rose-300">Could not load Git diff: {fileDiffError}</p>
                ) : !fileDiff?.workingDiff && !fileDiff?.stagedDiff ? (
                  <div>
                    <p className="font-sans text-sm text-slate-200">No Git changes for this file.</p>
                    <p className="mt-1 font-sans text-xs text-slate-500">The diff view reads staged and unstaged changes from this workspace.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {[
                      ['Unstaged changes', fileDiff.workingDiff],
                      ['Staged changes', fileDiff.stagedDiff],
                    ].filter(([, diff]) => diff).map(([title, diff]) => (
                      <section key={title}>
                        <h3 className="mb-2 font-sans text-xs font-medium text-slate-400">{title}</h3>
                        {(diff as string).split('\n').map((line, index) => (
                          <div key={`${title}-${index}`} className={line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-300' : line.startsWith('-') && !line.startsWith('---') ? 'text-rose-300' : 'text-slate-400'}>{line || ' '}</div>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {terminalOpen && (
            <section id="workbench-terminal-panel" aria-label="Read-only local commands and results" className="aspira-glass rounded-3xl p-4 h-48 lg:h-56 flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Read-only local commands
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'git-status', label: 'Git status', compactLabel: 'Git', fullLabel: 'Git status and recent commits' },
                    { id: 'sys-procs', label: 'Processes', compactLabel: 'Top', fullLabel: 'Top processes' },
                    { id: 'disk-df', label: 'Disk', compactLabel: 'Disk', fullLabel: 'Disk free' },
                    { id: 'tree-scan', label: 'Source tree', compactLabel: 'Tree', fullLabel: 'Source tree' },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => runTerminalPreset(p.id)}
                      disabled={runningTerminal}
                      aria-busy={runningTerminal}
                      aria-label={`Run ${p.fullLabel}`}
                      title={p.fullLabel}
                      className="min-h-9 whitespace-nowrap rounded-lg border border-white/[0.07] bg-white/[0.04] px-1 py-1 font-mono text-[10px] text-slate-300 transition-all hover:bg-white/[0.09]"
                    >
                      <span className="hidden min-[361px]:inline">{p.label}</span>
                      <span className="min-[361px]:hidden">{p.compactLabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customShellCmd.trim()) return;
                  runTerminalPreset('custom', customShellCmd.trim());
                  setCustomShellCmd('');
                }}
                className="flex items-center gap-2"
              >
                <span className="text-xs font-mono text-emerald-400">$</span>
                <input
                  type="text"
                  value={customShellCmd}
                  onChange={(e) => setCustomShellCmd(e.target.value)}
                  aria-label="Custom read-only command"
                  placeholder="Try: git status -s, git diff --stat, ls -la src/components, df -h ."
                  className="aspira-code-input flex-1 bg-black/30 border border-white/[0.07] rounded-xl px-3 py-1 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/40"
                />
                <button
                  type="submit"
                  disabled={runningTerminal || !customShellCmd.trim()}
                  aria-busy={runningTerminal}
                  className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-mono"
                >
                  {runningTerminal ? 'Running…' : 'Run'}
                </button>
              </form>

              <div id="workbench-terminal-output" aria-busy={runningTerminal} className="aspira-code flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-2xl p-3 max-[360px]:p-2 font-mono text-[11px] text-slate-300 border border-white/[0.05]">
                {runningTerminal ? (
                  <div role="status" aria-live="polite">
                    <div className="text-emerald-400 mb-1">Running command</div>
                    <p className="break-all text-slate-300">{activeTerminalCommand}</p>
                  </div>
                ) : terminalError ? (
                  <div role="alert" aria-live="assertive">
                    <div className="mb-1 font-sans text-xs font-medium text-rose-300">Command could not be completed</div>
                    <pre className="whitespace-pre-wrap break-words text-slate-300 leading-relaxed">{terminalError}</pre>
                  </div>
                ) : terminalLog ? (
                  <div>
                    <div className="text-emerald-400 mb-1 break-all">$ {terminalLog.command}</div>
                    <pre className="whitespace-pre-wrap break-words text-slate-300 leading-relaxed">{terminalLog.output}</pre>
                    <p role="status" aria-live="polite" className="mt-2 border-t border-white/[0.06] pt-2 font-sans text-[10px] text-slate-500">
                      Command completed · {new Date(terminalLog.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <p className="font-sans text-xs leading-relaxed text-slate-400">
                    Choose a command above or enter one.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return null;
};
