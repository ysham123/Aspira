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

interface SpatialModeDeckProps {
  spatialMode: SpatialMode;
  models: ModelPluginManifest[];
  awakeModelIds: string[];
  synergyResult: SynergyExecutionResult | null;
  conversationTurns: ConversationTurn[];
  memories: LivingMemoryItem[];
  onToggleMemoryStatus: (id: string, nextStatus: 'IN_PROGRESS' | 'COMPLETED' | 'ACTIVE') => void;
  onDeleteMemory: (id: string) => void;
  onAddMemory: (content: string, category: LivingMemoryItem['category']) => void;
  routines: LocalPlaybook[];
  onRunRoutine: (routineId: string) => void;
  onExecuteDirectAction: (tool: string, args: Record<string, unknown>, label: string) => void;
  isExecuting: boolean;
  onRunPrompt: (prompt: string) => void;
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
  memories,
  onToggleMemoryStatus,
  onDeleteMemory,
  onAddMemory,
  routines,
  onRunRoutine,
  onExecuteDirectAction,
  isExecuting,
  onRunPrompt,
  duplexVoiceActive,
  onToggleDuplexVoice,
  isAgentSpeaking,
  liveTranscript,
  voiceStatus,
}) => {
  const [rightRailTab, setRightRailTab] = useState<'memory' | 'routines' | 'tools'>('memory');
  const [contextExpanded, setContextExpanded] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1280
  );
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<LivingMemoryItem['category']>('goal');
  const selectedModelNames = models
    .filter((model) => awakeModelIds.includes(model.id))
    .map((model) => model.codeName);
  const emptyConversationIntro = selectedModelNames.length > 0
    ? `${selectedModelNames.join(' + ')} ${selectedModelNames.length === 1 ? 'is' : 'are'} ready. Ask a question or choose a starter below. Local actions also work without a model.`
    : 'Choose a model in the composer to chat. Local actions work without one.';

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
  }>({
    command: 'git status -s',
    output: 'Ready. Choose a preset or run one of the listed read-only commands.',
    timestamp: new Date().toLocaleTimeString(),
  });
  const [runningTerminal, setRunningTerminal] = useState(false);

  useEffect(() => {
    const wideLayout = window.matchMedia('(min-width: 1280px)');
    const collapseOnNarrowLayout = () => {
      if (!wideLayout.matches) setContextExpanded(false);
    };
    collapseOnNarrowLayout();
    wideLayout.addEventListener('change', collapseOnNarrowLayout);
    return () => wideLayout.removeEventListener('change', collapseOnNarrowLayout);
  }, []);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollContainer = chatEndRef.current?.parentElement;
    if (conversationTurns.length === 0 && !isExecuting) {
      if (scrollContainer) scrollContainer.scrollTop = 0;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversationTurns.length, isExecuting]);

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
    setRunningTerminal(true);
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customCommand ? { customCommand } : { preset }),
      });
      if (res.ok) {
        const data = await res.json();
        setTerminalLog(data);
      }
    } catch {
      // ignore
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
      <div className="flex h-full w-full min-w-0 gap-4 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex shrink-0 items-end justify-between gap-4 px-1">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Personal workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Studio</h1>
              <p className="mt-1 text-xs text-slate-400">Conversation, connected models, and local actions in one place.</p>
            </div>
            <div className="flex items-center gap-2 text-right">
              {voiceStatus !== 'Voice input is off' && <span className={`h-2 w-2 rounded-full ${isAgentSpeaking ? 'bg-indigo-300 animate-pulse' : duplexVoiceActive ? 'bg-emerald-300 animate-pulse' : 'bg-slate-500'}`} />}
              <div>
                {voiceStatus !== 'Voice input is off' && <p role="status" className="text-[11px] text-slate-300">{voiceStatus}</p>}
                {liveTranscript && <p className="mt-0.5 max-w-[300px] truncate text-[10px] text-slate-500">“{liveTranscript}”</p>}
              </div>
              {isAgentSpeaking && <button onClick={() => soundEngine.stopSpeaking()} className="ml-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.06]">Stop voice</button>}
              <button
                type="button"
                onClick={() => setContextExpanded((expanded) => !expanded)}
                aria-controls="workspace-context-rail"
                aria-expanded={contextExpanded}
                aria-label={contextExpanded ? 'Hide workspace context' : 'Show workspace context'}
                className="aspira-context-toggle flex min-h-11 min-w-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{contextExpanded ? 'Hide context' : 'Show context'}</span>
                <span className="sm:hidden">Context</span>
              </button>
            </div>
          </div>

          {/* Multi-Turn Conversational Timeline */}
          <div className="aspira-conversation-surface flex flex-1 flex-col gap-5 overflow-y-auto p-6 custom-scrollbar">
            {conversationTurns.length === 0 && (
              <div className="aspira-empty-state mx-auto flex w-full max-w-2xl flex-col justify-start py-4">
                <p className="aspira-empty-eyebrow text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">Aspira Studio</p>
                <h2 className="aspira-empty-title mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">What can I help you move forward?</h2>
                <p className="aspira-empty-intro mt-3 max-w-lg text-sm leading-6 text-slate-400">{emptyConversationIntro}</p>
                <div className="aspira-empty-prompts mt-5 grid gap-2 sm:grid-cols-2">
                  {[
                    { title: 'Get oriented', detail: 'Review this project and suggest a next step.', prompt: 'Summarize this workspace and tell me what I should work on next.' },
                    { title: 'Check my Mac', detail: 'Review CPU, memory, and battery status.', prompt: 'Check my Mac CPU, memory, and battery status.' },
                    { title: 'Review changes', detail: 'Inspect the current Git working tree.', prompt: 'Run git status' },
                    { title: 'Explore the web', detail: 'Find current stories from Hacker News.', prompt: 'Show me the Hacker News top stories.' },
                  ].map((item) => (
                    <button key={item.title} onClick={() => onRunPrompt(item.prompt)} className="aspira-empty-prompt group px-3 py-2.5 text-left transition">
                      <span className="block text-[13px] font-semibold text-slate-200">{item.title}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-slate-500">{item.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {conversationTurns.map((turn, idx) => {
              const isLatest = idx === conversationTurns.length - 1;
              const showDetails = expandedTurnId === turn.id;

              return (
                <div
                  key={turn.id}
                  className="flex flex-col gap-3 pb-5 border-b border-white/[0.06] last:border-b-0 last:pb-1"
                >
                  {/* 1. User Conversational Turn Bubble */}
                  <div className="flex items-start justify-end gap-3">
                    <div className="aspira-user-message max-w-[82%] px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2 mb-1 text-[10px] text-indigo-300/80 font-mono">
                        <span>
                          {turn.inputModality === 'voice'
                            ? 'Voice'
                            : turn.inputModality === 'routine'
                            ? 'Routine'
                            : 'Message'}
                        </span>
                        {turn.vocalEmotion && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                            {turn.vocalEmotion}
                          </span>
                        )}
                        <span>{turn.timestamp}</span>
                      </div>
                      <p className="text-[14px] leading-relaxed">{turn.userText}</p>
                    </div>
                  </div>

                  {/* Local actions executed during this turn */}
                  {turn.result.executedActions && turn.result.executedActions.length > 0 && (
                    <div className="flex flex-col gap-2 pl-2">
                      {turn.result.executedActions.map((act: AgentActionExecution) => (
                        <div
                          key={act.id}
                          className="aspira-action-card flex flex-col gap-1.5 rounded-2xl px-4 py-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="text-[12px] font-semibold text-emerald-200">
                                {act.title}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                                {act.tool}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-300/80">
                              {act.durationMs}ms · {act.status.toUpperCase()}
                            </span>
                          </div>
                          {act.output && (
                            <pre className="aspira-code text-[11px] font-mono text-slate-300 bg-black/40 rounded-xl p-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/[0.05]">
                              {act.output}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Multi-Agent Conversational Reply Card */}
                  <div className="aspira-response-card flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {turn.result.modelStreams.map((stream) => {
                          const m = models.find((mod) => mod.id === stream.modelId);
                          return (
                            <span
                              key={stream.modelId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] border border-white/[0.08] text-slate-200"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: m?.accentHex || '#6E8EFB' }}
                              />
                              {stream.codeName}
                              <span
                                className={`text-[10px] font-mono ${
                                  stream.source === 'PROVIDER_CLI' || stream.source === 'SUBSCRIPTION_OAUTH'
                                    ? 'text-emerald-300'
                                    : 'text-slate-400'
                                }`}
                              >
                                {stream.source === 'PROVIDER_CLI' || stream.source === 'SUBSCRIPTION_OAUTH'
                                  ? '· Provider CLI'
                                  : stream.source === 'LOCAL_OLLAMA'
                                  ? '· Ollama Local'
                                  : stream.source === 'LIVE_API'
                                  ? '· API'
                                  : stream.source === 'UNAVAILABLE'
                                  ? '· Unavailable'
                                  : `· Local · ${stream.latencyMs}ms`}
                              </span>
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        {turn.result.modelStreams.some((stream) => stream.source !== 'UNAVAILABLE') && <button
                          onClick={() => {
                            onExecuteDirectAction(
                              'subscription_desktop_handoff',
                              {
                                modelId: turn.result.modelStreams[0]?.modelId || 'claude',
                                prompt: turn.userText,
                              },
                              `Hand off "${turn.userText.slice(0, 32)}..." to Desktop App`
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all"
                          title="Send this prompt directly into your native macOS Desktop App (Claude.app / ChatGPT.app / Gemini.app)"
                        >
                          <AppWindow className="w-3.5 h-3.5 text-emerald-400" />
                          Open in App
                        </button>}

                        {turn.result.spokenReply && <button
                          onClick={() => {
                            soundEngine.speak(turn.result.spokenReply);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all"
                          title="Speak this response aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          Speak
                        </button>}

                        {turn.result.modelStreams.length > 1 && (
                          <button
                            onClick={() => {
                              setExpandedTurnId(expandedTurnId === turn.id ? null : turn.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-slate-300 flex items-center gap-1 transition-all"
                          >
                            {showDetails ? (
                              <>
                                Hide Perspectives <ChevronUp className="w-3 h-3" />
                              </>
                            ) : (
                              <>
                                {turn.result.modelStreams.length} Perspectives{' '}
                                <ChevronDown className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Primary Conversational Output */}
                    <MarkdownMessage
                      content={turn.result.synthesizedOutput}
                      className="text-[14px] text-slate-100 leading-relaxed"
                    />

                    {/* Expandable Individual Agent Perspectives / Debate / Race / Relay */}
                    {showDetails && (
                      <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {turn.result.modelStreams.map((stream) => {
                          const m = models.find((mod) => mod.id === stream.modelId);
                          return (
                            <div
                              key={stream.modelId}
                              className="aspira-perspective-card rounded-xl p-3"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-white">
                                  {stream.codeName}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">
                                    · {stream.badgeLabel}
                                  </span>
                                </span>
                                <span
                                  className="text-[10px] font-mono"
                                  style={{ color: m?.accentHex }}
                                >
                          {stream.latencyMs}ms response
                                </span>
                              </div>
                              <MarkdownMessage
                                content={stream.keyInsight}
                                className="text-xs text-slate-300 leading-relaxed"
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
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-1">
                            Next Actions:
                          </span>
                          {turn.result.followUpSuggestions.map((suggestion, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => onRunPrompt(suggestion)}
                              className="px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/25 text-[11px] text-indigo-200 transition-all"
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

            {isExecuting && (
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-400/25 p-4 flex items-center gap-3 text-indigo-200 text-xs animate-pulse">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>{awakeModelIds.length ? `Contacting ${awakeModelIds.map((id) => id.toUpperCase()).join(' + ')}…` : 'Running your request…'}</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Workspace context, on-demand playbooks, and local tools */}
        <aside
          id="workspace-context-rail"
          aria-label="Workspace context, routines, and local tools"
          className={contextExpanded
            ? 'aspira-context-rail fixed inset-x-3 bottom-28 z-40 flex max-h-[58vh] flex-col gap-3 overflow-hidden rounded-[24px] border border-white/10 bg-white p-3 shadow-2xl xl:relative xl:inset-auto xl:z-10 xl:h-full xl:w-[330px] xl:max-h-none xl:shrink-0 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none'
            : 'hidden'}
        >
          {/* Segmented Switcher */}
          <div className="aspira-glass aspira-context-tabs rounded-2xl p-1.5 flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setRightRailTab('memory');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'memory'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              Saved context ({memories.length})
            </button>
            <button
              onClick={() => {
                setRightRailTab('routines');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'routines'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Routines ({routines.length})
            </button>
            <button
              onClick={() => {
                setRightRailTab('tools');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'tools'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Local tools
            </button>
            <button
              onClick={() => setContextExpanded(false)}
              className="aspira-context-close rounded-lg p-2 text-slate-500 hover:text-slate-800 xl:hidden"
              aria-label="Close workspace context"
            ><X className="h-4 w-4" /></button>
          </div>

          {/* TAB 1: Saved local context */}
          {rightRailTab === 'memory' && (
            <div className="aspira-glass rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-hidden">
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
                className="flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-2.5"
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
                    className="rounded-2xl p-3.5 bg-white/[0.025] border border-white/[0.07] hover:border-white/[0.14] transition-all flex flex-col gap-2"
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
            <div className="aspira-glass rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
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
            <div className="aspira-glass rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
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
      <div className="w-full h-full grid grid-cols-12 gap-5 overflow-hidden">
        <div className="col-span-12 lg:col-span-4 aspira-glass rounded-3xl p-4 flex flex-col gap-3 h-full overflow-hidden">
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
                  key={node.id}
                  onClick={() => {
                    setSelectedFile(node);
                  }}
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

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 h-full overflow-hidden">
          <div className="aspira-glass-elevated rounded-3xl p-5 flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div className="flex items-center gap-3">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {selectedFile?.id || 'src/App.tsx'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedFile ? `${selectedFile.lines} lines · read-only preview` : 'Choose a file'}
                    {selectedFile?.previewTruncated ? ' · preview shortened' : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.07]">
                  <button
                    onClick={() => setWorkbenchTab('source')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      workbenchTab === 'source' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Source
                  </button>
                  <button
                    onClick={() => setWorkbenchTab('diff')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      workbenchTab === 'diff' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Git diff
                  </button>
                </div>

                <button
                  onClick={() => setTerminalOpen((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Terminal (⌘J)
                </button>
              </div>
            </div>

            {workbenchTab === 'source' ? (
              <div className="aspira-code flex-1 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed bg-black/30 rounded-2xl p-4 border border-white/[0.05]">
                {codeLines.slice(0, 120).map((line, idx) => (
                  <div key={idx} className="flex gap-4 hover:bg-white/[0.02] px-1 rounded">
                    <span className="w-8 text-right text-slate-600 select-none">{idx + 1}</span>
                    <span className="text-slate-200 whitespace-pre-wrap break-all">{line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspira-code flex-1 overflow-y-auto custom-scrollbar rounded-2xl bg-black/30 p-4 font-mono text-xs leading-relaxed">
                {diffLoading ? (
                  <p className="text-slate-500">Loading Git diff…</p>
                ) : fileDiffError ? (
                  <p className="text-rose-300">Could not load Git diff: {fileDiffError}</p>
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
            <div className="aspira-glass rounded-3xl p-4 h-56 flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Read-only local commands
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'git-status', label: 'git status' },
                    { id: 'sys-procs', label: 'top processes' },
                    { id: 'disk-df', label: 'disk free' },
                    { id: 'tree-scan', label: 'src tree' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => runTerminalPreset(p.id)}
                      disabled={runningTerminal}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] font-mono text-slate-300 transition-all"
                    >
                      {p.label}
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
                  placeholder="Try: git status -s, git diff --stat, ls -la src/components, df -h ."
                  className="aspira-code-input flex-1 bg-black/30 border border-white/[0.07] rounded-xl px-3 py-1 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/40"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-mono"
                >
                  Run
                </button>
              </form>

              <div className="aspira-code flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-2xl p-3 font-mono text-[11px] text-slate-300 border border-white/[0.05]">
                <div className="text-emerald-400 mb-1">$ {terminalLog.command}</div>
                <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                  {terminalLog.output}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
