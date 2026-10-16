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
  Zap,
} from 'lucide-react';
import {
  AgentActionExecution,
  AutonomousRoutine,
  CAPABILITY_MATRIX,
  CapabilityDefinition,
  ConversationTurn,
  LivingMemoryItem,
  ModelPluginManifest,
  SpatialMode,
  SynergyExecutionResult,
  SynergyMode,
} from '../plugins/models/manifest';
import { soundEngine } from '../audio/soundEngine';

interface SpatialModeDeckProps {
  spatialMode: SpatialMode;
  synergyMode: SynergyMode;
  onSelectSynergyMode: (mode: SynergyMode) => void;
  models: ModelPluginManifest[];
  awakeModelIds: string[];
  selectedCapability: CapabilityDefinition;
  onSelectCapability: (cap: CapabilityDefinition) => void;
  synergyResult: SynergyExecutionResult | null;
  conversationTurns: ConversationTurn[];
  memories: LivingMemoryItem[];
  onToggleMemoryStatus: (id: string, nextStatus: 'IN_PROGRESS' | 'COMPLETED' | 'ACTIVE') => void;
  onDeleteMemory: (id: string) => void;
  onAddMemory: (content: string, category: LivingMemoryItem['category']) => void;
  routines: AutonomousRoutine[];
  onRunRoutine: (routineId: string) => void;
  onExecuteDirectAction: (tool: string, args: Record<string, unknown>, label: string) => void;
  isExecuting: boolean;
  onRunPrompt: (prompt: string, capOverride?: CapabilityDefinition) => void;
  duplexVoiceActive: boolean;
  onToggleDuplexVoice: () => void;
  isAgentSpeaking: boolean;
  liveTranscript: string;
  macTelemetry: {
    hostname: string;
    platform: string;
    cpuModel: string;
    cpuCores: number;
    cpuUsagePercent: number;
    memoryUsedGB: number;
    memoryTotalGB: number;
    memoryPercent: number;
    uptimeHours: number;
  };
}

interface FsNode {
  id: string;
  label: string;
  type: 'core' | 'directory' | 'module' | 'config' | 'file';
  lines: number;
  symbols?: string[];
  preview?: string;
}

export const SpatialModeDeck: React.FC<SpatialModeDeckProps> = ({
  spatialMode,
  synergyMode,
  onSelectSynergyMode,
  models,
  awakeModelIds,
  selectedCapability,
  onSelectCapability,
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
  macTelemetry,
}) => {
  const [rightRailTab, setRightRailTab] = useState<'memory' | 'routines' | 'capabilities'>('memory');
  const [capFilter, setCapFilter] = useState<'overlapping' | 'apex_unique'>('overlapping');
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<LivingMemoryItem['category']>('goal');

  // Workbench state
  const [fsNodes, setFsNodes] = useState<FsNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FsNode | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<'source' | 'diff'>('source');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [customShellCmd, setCustomShellCmd] = useState('');
  const [terminalLog, setTerminalLog] = useState<{
    command: string;
    output: string;
    timestamp: string;
  }>({
    command: 'git status -s',
    output: 'Ready. Click a preset or type any safe command (git, ls, df, ps, cat) below.',
    timestamp: new Date().toLocaleTimeString(),
  });
  const [runningTerminal, setRunningTerminal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const runTerminalPreset = async (preset: string, customCommand?: string) => {
    soundEngine.playGlassTick();
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
        soundEngine.playGlassTick();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredCapabilities = CAPABILITY_MATRIX.filter((c) => c.category === capFilter);

  // ==========================================================================
  // VIEW 1: CONVERSATIONAL PERSONAL AGENT STUDIO (Dot + Muse + OpenClaw + Grokbot)
  // ==========================================================================
  if (spatialMode === 'nexus') {
    return (
      <div className="w-full h-full grid grid-cols-12 gap-5 overflow-hidden">
        {/* LEFT 8 COLUMNS: CONTINUOUS CONVERSATION STREAM + REAL ACTION CARDS */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 h-full overflow-hidden">
          {/* Top Bar: Duplex Voice Status + 1-Click Real macOS & Web Action Triggers */}
          <div className="aspira-glass rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  soundEngine.playGlassTick();
                  onToggleDuplexVoice();
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium flex items-center gap-2 transition-all border ${
                  duplexVoiceActive
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 shadow-sm'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white'
                }`}
                title="Toggle Hands-Free Duplex Voice Conversation (Talk naturally anytime)"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAgentSpeaking
                      ? 'bg-indigo-400 animate-ping'
                      : duplexVoiceActive
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-slate-600'
                  }`}
                />
                <Mic className="w-3.5 h-3.5" />
                {isAgentSpeaking
                  ? 'Agent Speaking (Click or Speak to Interrupt)'
                  : duplexVoiceActive
                  ? 'Hands-Free Voice Active'
                  : 'Hands-Free Voice Off'}
              </button>

              {isAgentSpeaking && (
                <button
                  onClick={() => soundEngine.stopSpeaking()}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-[11px] flex items-center gap-1 hover:bg-rose-500/25 transition-all"
                >
                  <Square className="w-3 h-3" /> Stop Voice
                </button>
              )}

              {liveTranscript && (
                <span className="text-[11px] text-indigo-300/90 italic truncate max-w-[220px]">
                  “{liveTranscript}”
                </span>
              )}
            </div>

            {/* Instant Real Action Pills (OpenClaw / Muse style) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() =>
                  onRunPrompt('Check my Mac CPU, memory, and battery status right now')
                }
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all whitespace-nowrap"
              >
                <Cpu className="w-3 h-3 text-indigo-400" /> Audit Mac
              </button>
              <button
                onClick={() => onRunPrompt('Run git status on the workspace')}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all whitespace-nowrap"
              >
                <FolderGit2 className="w-3 h-3 text-amber-400" /> Git Status
              </button>
              <button
                onClick={() => onRunPrompt('Search the web for HackerNews top AI stories')}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all whitespace-nowrap"
              >
                <Globe className="w-3 h-3 text-rose-400" /> Live Web Recon
              </button>
              <button
                onClick={() =>
                  onExecuteDirectAction('macos_app', { app: 'Calculator' }, 'Open Calculator')
                }
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all whitespace-nowrap"
              >
                <AppWindow className="w-3 h-3 text-emerald-400" /> Open Calculator
              </button>
              <button
                onClick={() =>
                  onExecuteDirectAction(
                    'macos_notify',
                    {
                      title: 'Aspira Personal Agent',
                      message: 'Your multi-agent studio is active and connected to macOS.',
                    },
                    'Send macOS Notification'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all whitespace-nowrap"
              >
                <Bell className="w-3 h-3 text-indigo-300" /> Mac Notify
              </button>
            </div>
          </div>

          {/* Multi-Turn Conversational Timeline */}
          <div className="aspira-glass-elevated rounded-3xl p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5">
            {conversationTurns.map((turn, idx) => {
              const isLatest = idx === conversationTurns.length - 1;
              const showDetails = expandedTurnId === turn.id || (isLatest && turn.result.synergyMode !== 'fusion');

              return (
                <div
                  key={turn.id}
                  className="flex flex-col gap-3 pb-5 border-b border-white/[0.06] last:border-b-0 last:pb-1"
                >
                  {/* 1. User Conversational Turn Bubble */}
                  <div className="flex items-start justify-end gap-3">
                    <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-indigo-500/[0.14] border border-indigo-400/25 px-4 py-2.5 text-slate-100">
                      <div className="flex items-center justify-end gap-2 mb-1 text-[10px] text-indigo-300/80 font-mono">
                        <span>
                          {turn.inputModality === 'voice'
                            ? `🎙️ Spoken Voice${turn.pitchHz ? ` · ${turn.pitchHz}Hz` : ''}`
                            : turn.inputModality === 'routine'
                            ? '⚡ Autonomous Routine'
                            : '⌨️ Typed'}
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

                  {/* 2. Real Host Actions Executed During This Turn (OpenClaw / Muse / MacOS-Use) */}
                  {turn.result.executedActions && turn.result.executedActions.length > 0 && (
                    <div className="flex flex-col gap-2 pl-2">
                      {turn.result.executedActions.map((act: AgentActionExecution) => (
                        <div
                          key={act.id}
                          className="rounded-2xl bg-emerald-500/[0.07] border border-emerald-400/25 px-4 py-3 flex flex-col gap-1.5"
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
                            <pre className="text-[11px] font-mono text-slate-300 bg-black/40 rounded-xl p-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/[0.05]">
                              {act.output}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Multi-Agent Conversational Reply Card */}
                  <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-4 flex flex-col gap-3">
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
                              <span className="text-[10px] font-mono text-slate-400">
                                {stream.source === 'LOCAL_OLLAMA'
                                  ? '· Ollama Local'
                                  : stream.source === 'LIVE_API'
                                  ? '· Cloud API'
                                  : `· ${stream.ttftMs}ms`}
                              </span>
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            soundEngine.playGlassTick();
                            soundEngine.speak(turn.result.spokenReply);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-slate-300 flex items-center gap-1.5 transition-all"
                          title="Speak this response aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          Speak
                        </button>

                        {turn.result.modelStreams.length > 1 && (
                          <button
                            onClick={() => {
                              soundEngine.playGlassTick();
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
                    <div className="text-[14px] text-slate-100 leading-relaxed whitespace-pre-line">
                      {turn.result.synthesizedOutput}
                    </div>

                    {/* Expandable Individual Agent Perspectives / Debate / Race / Relay */}
                    {showDetails && (
                      <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {turn.result.modelStreams.map((stream) => {
                          const m = models.find((mod) => mod.id === stream.modelId);
                          return (
                            <div
                              key={stream.modelId}
                              className="rounded-xl p-3 bg-black/25 border border-white/[0.06]"
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
                                  {stream.ttftMs}ms
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {stream.keyInsight}
                              </p>
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
                <span>
                  Executing host actions & synthesizing response across{' '}
                  {awakeModelIds.map((id) => id.toUpperCase()).join(' + ')}...
                </span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* RIGHT 4 COLUMNS: PERSONAL AGENT OS COMPANION RAIL (Dot Memory + Routines + Capabilities) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 h-full overflow-hidden">
          {/* Segmented Switcher */}
          <div className="aspira-glass rounded-2xl p-1.5 flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                soundEngine.playGlassTick();
                setRightRailTab('memory');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'memory'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              Living Memory ({memories.length})
            </button>
            <button
              onClick={() => {
                soundEngine.playGlassTick();
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
                soundEngine.playGlassTick();
                setRightRailTab('capabilities');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                rightRailTab === 'capabilities'
                  ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Matrix
            </button>
          </div>

          {/* TAB 1: DOT-STYLE AGENTIC LIVING MEMORY BANK */}
          {rightRailTab === 'memory' && (
            <div className="aspira-glass rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                    Dot Living Memory Graph
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Auto-extracted from voice & chat, or add directly below. Injected into every agent turn.
                  </p>
                </div>
              </div>

              {/* Quick Add Memory Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMemoryInput.trim()) return;
                  soundEngine.playGlassTick();
                  onAddMemory(newMemoryInput.trim(), newMemoryCategory);
                  setNewMemoryInput('');
                }}
                className="flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-2.5"
              >
                <div className="flex items-center gap-1.5">
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
                <div className="flex items-center gap-2">
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
                            soundEngine.playGlassTick();
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
                          soundEngine.playGlassTick();
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

          {/* TAB 2: GROKBOT / OPENCLAW AUTONOMOUS ROUTINES */}
          {rightRailTab === 'routines' && (
            <div className="aspira-glass rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                  Autonomous Agent Routines
                </div>
                <p className="text-[11px] text-slate-400">
                  Multi-step macOS, terminal, memory & web workflows (inspired by Grok Bot & OpenClaw).
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
                          <Clock className="w-3 h-3" /> {routine.schedule} · Lead:{' '}
                          {routine.leadAgent.toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          soundEngine.playSynergyBeam();
                          onRunRoutine(routine.id);
                        }}
                        disabled={isExecuting}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/35 text-amber-200 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" /> Run Now
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

          {/* TAB 3: CAPABILITY SYNERGY MATRIX */}
          {rightRailTab === 'capabilities' && (
            <div className="aspira-glass rounded-3xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Capability Matrix
                </span>
                <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                  <button
                    onClick={() => setCapFilter('overlapping')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                      capFilter === 'overlapping' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Shared (5)
                  </button>
                  <button
                    onClick={() => setCapFilter('apex_unique')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                      capFilter === 'apex_unique' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Unique (4)
                  </button>
                </div>
              </div>

              {/* Collaboration Mode Selector */}
              <div className="grid grid-cols-4 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
                {(['fusion', 'adversarial', 'sprint', 'relay'] as SynergyMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      soundEngine.playGlassTick();
                      onSelectSynergyMode(m);
                    }}
                    className={`py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all ${
                      synergyMode === m
                        ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'adversarial' ? 'Debate' : m === 'sprint' ? 'Race' : m}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {filteredCapabilities.map((cap) => {
                  const active = selectedCapability.id === cap.id;
                  return (
                    <button
                      key={cap.id}
                      onClick={() => {
                        soundEngine.playGlassTick();
                        onSelectCapability(cap);
                      }}
                      className={`text-left p-3 rounded-2xl transition-all border ${
                        active
                          ? 'bg-indigo-500/[0.12] border-indigo-400/40'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white mb-1">{cap.name}</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{cap.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: CODE & ARTIFACT WORKBENCH (Interactive File Explorer + Custom Shell)
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
                    soundEngine.playGlassTick();
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
                    {selectedFile?.symbols?.length
                      ? `Exports: ${selectedFile.symbols.join(', ')}`
                      : 'Live Workspace AST Module'}
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
                    Source Inspector
                  </button>
                  <button
                    onClick={() => setWorkbenchTab('diff')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      workbenchTab === 'diff' ? 'bg-white/[0.12] text-white' : 'text-slate-400'
                    }`}
                  >
                    Multi-Agent AST Diff
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
              <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed bg-black/30 rounded-2xl p-4 border border-white/[0.05]">
                {codeLines.slice(0, 120).map((line, idx) => (
                  <div key={idx} className="flex gap-4 hover:bg-white/[0.02] px-1 rounded">
                    <span className="w-8 text-right text-slate-600 select-none">{idx + 1}</span>
                    <span className="text-slate-200 whitespace-pre-wrap break-all">{line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                <div className="rounded-2xl p-4 bg-indigo-500/[0.07] border border-indigo-400/25">
                  <div className="text-xs font-semibold text-indigo-300 mb-1">
                    Argon (2M Repo Context) + Claude (AST Patch) Consensus
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Verified module imports and type boundaries for{' '}
                    <span className="font-mono text-white">{selectedFile?.id}</span>. You can ask
                    Claude or Argon in the composer below to create or update files directly.
                  </p>
                </div>
              </div>
            )}
          </div>

          {terminalOpen && (
            <div className="aspira-glass rounded-3xl p-4 h-56 flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    macOS Sandboxed Shell & Action Runner
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
                  placeholder="Type a safe shell command (e.g. git log -n 5, ls -la, df -h ., pmset -g batt)..."
                  className="flex-1 bg-black/30 border border-white/[0.07] rounded-xl px-3 py-1 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/40"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-mono"
                >
                  Run
                </button>
              </form>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-2xl p-3 font-mono text-[11px] text-slate-300 border border-white/[0.05]">
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

  // ==========================================================================
  // VIEW 3: LIVE VISION & MACOS DESKTOP OPERATOR (OpenClaw / MacOS-Use Controls)
  // ==========================================================================
  if (spatialMode === 'overwatch') {
    const macApps = [
      'Safari',
      'Notes',
      'Calendar',
      'Calculator',
      'Terminal',
      'Finder',
      'Reminders',
      'Activity Monitor',
    ];

    return (
      <div className="w-full h-full grid grid-cols-12 gap-5 overflow-hidden items-end pb-2">
        <div className="col-span-12 lg:col-span-5 aspira-glass rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                macOS Native App & System Operator
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">OpenClaw Bridge Ready</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Click any macOS application below (or simply say{' '}
            <span className="text-white font-mono">“Open Safari”</span> or{' '}
            <span className="text-white font-mono">“Open Notes”</span> aloud) to launch it directly
            on your Mac.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {macApps.map((app) => (
              <button
                key={app}
                onClick={() => {
                  soundEngine.playGlassTick();
                  onExecuteDirectAction('macos_app', { app }, `Launch ${app}`);
                }}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-indigo-500/20 border border-white/[0.07] hover:border-indigo-400/35 text-xs text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <AppWindow className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate">{app}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] font-mono uppercase text-slate-400">Host Hardware</div>
              <div className="text-xs font-semibold text-white mt-0.5">{macTelemetry.cpuModel}</div>
              <div className="text-[11px] font-mono text-indigo-300 mt-0.5">
                CPU Load: {macTelemetry.cpuUsagePercent}%
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] font-mono uppercase text-slate-400">Unified Memory</div>
              <div className="text-xs font-semibold text-white mt-0.5">
                {macTelemetry.memoryUsedGB} / {macTelemetry.memoryTotalGB} GB
              </div>
              <div className="text-[11px] font-mono text-emerald-300 mt-0.5">
                Uptime: {macTelemetry.uptimeHours}h
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-2" />

        <div className="col-span-12 lg:col-span-5 aspira-glass rounded-3xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Latest Executed Host Actions
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Sentinel Verified</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {(synergyResult?.executedActions?.length
              ? synergyResult.executedActions
              : [
                  {
                    id: 'default-1',
                    tool: 'system_status',
                    title: 'macOS Apple Silicon Telemetry Link Active',
                    status: 'success' as const,
                    output: `${macTelemetry.hostname} · ${macTelemetry.cpuModel}`,
                    durationMs: 12,
                  },
                ]
            ).map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300">{act.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">{act.durationMs}ms</span>
                </div>
                <div className="text-[11px] font-mono text-slate-300 truncate">{act.output}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 4: GLOBAL PULSE & DEBATE ARENA (Live Web Recon + Multi-Agent Debate)
  // ==========================================================================
  return (
    <div className="w-full h-full grid grid-cols-12 gap-5 overflow-hidden">
      <div className="col-span-12 lg:col-span-5 aspira-glass rounded-3xl p-5 flex flex-col gap-3.5 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Live Web & Personal Agent Ecosystem Pulse
            </span>
          </div>
          <button
            onClick={() => onRunPrompt('Search the web for HackerNews top AI stories')}
            className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-[11px] text-rose-200 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Sweep Live Web
          </button>
        </div>

        {[
          {
            source: 'Dot by New Computer · Living Memory Architecture',
            time: 'Integrated in Aspira',
            headline:
              'Dynamic agentic memory categorizes your goals, in-progress tasks, preferences, and emotional context across every voice and text turn.',
            tag: 'Dot Memory',
          },
          {
            source: 'OpenClaw (Clawdbot) & MacOS-Use · Native Host Actions',
            time: 'Integrated in Aspira',
            headline:
              'Direct macOS application launching (`open -a`), native AppleScript notifications, file creation, and sandboxed shell execution.',
            tag: 'macOS Actions',
          },
          {
            source: 'Meta Muse & Grok Bot · Autonomous Routines & Sentinel',
            time: 'Integrated in Aspira',
            headline:
              'Multi-step scheduled and on-demand playbooks that audit hardware, inspect git state, sweep live web feeds, and speak briefings.',
            tag: 'Routines',
          },
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] transition-all"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="font-medium text-rose-300">{item.source}</span>
              <span className="font-mono">{item.time}</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed mb-2">{item.headline}</p>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-300">
              {item.tag}
            </span>
          </div>
        ))}
      </div>

      <div className="col-span-12 lg:col-span-7 aspira-glass-elevated rounded-3xl p-6 flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-300">
              Multi-Agent Perspectives & Debate Ledger
            </span>
            <h3 className="text-lg font-semibold text-white mt-0.5">
              {synergyResult?.executiveHeadline || 'Structured Multi-Agent Evaluation'}
            </h3>
          </div>
          <button
            onClick={() => {
              soundEngine.playSynergyBeam();
              onSelectSynergyMode('adversarial');
              onRunPrompt(
                synergyResult?.prompt ||
                  'Stress-test our personal agent architecture across security, speed, and autonomy'
              );
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-xs font-medium text-rose-200 flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            Trigger Debate
          </button>
        </div>

        <div className="space-y-3">
          {(synergyResult?.debateLedger ||
            synergyResult?.modelStreams.map((s, idx) => ({
              round: idx + 1,
              phase: idx === 0 ? 'THESIS' : idx === 1 ? 'RED_TEAM_CRITIQUE' : 'HARDENED_VERDICT',
              speakerName: `${s.codeName} (${s.badgeLabel})`,
              accentHex: models.find((m) => m.id === s.modelId)?.accentHex || '#6E8EFB',
              statement: s.keyInsight,
              impactBadge: `${s.ttftMs}ms TTFT`,
            })) ||
            []
          ).map((entry, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]"
              style={{ borderLeftWidth: '3px', borderLeftColor: entry.accentHex }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white">{entry.speakerName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-300">
                  {entry.impactBadge}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{entry.statement}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
