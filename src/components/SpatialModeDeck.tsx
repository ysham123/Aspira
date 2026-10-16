import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileCode,
  Flame,
  FolderGit2,
  Gauge,
  GitMerge,
  Globe,
  Layers,
  MousePointerClick,
  Play,
  Search,
  Sparkles,
  Swords,
  Terminal,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  CapabilityDefinition,
  ModelPluginManifest,
  SpatialMode,
  SynergyExecutionResult,
  SynergyMode,
} from '../plugins/models/manifest';

interface FsNode {
  id: string;
  label: string;
  type: string;
  lines: number;
  symbols?: string[];
  size: number;
  depth: number;
  preview?: string;
}

interface FsLink {
  source: string;
  target: string;
  kind: string;
}

interface SpatialModeDeckProps {
  spatialMode: SpatialMode;
  synergyMode: SynergyMode;
  onSelectSynergyMode: (m: SynergyMode) => void;
  capabilities: CapabilityDefinition[];
  selectedCapability: CapabilityDefinition;
  onSelectCapability: (cap: CapabilityDefinition) => void;
  models: ModelPluginManifest[];
  awakeModelIds: string[];
  latestResult: SynergyExecutionResult | null;
  onRunDirective: (prompt: string, capOverride?: CapabilityDefinition) => void;
  isExecuting: boolean;
}

export const SpatialModeDeck: React.FC<SpatialModeDeckProps> = ({
  spatialMode,
  synergyMode,
  onSelectSynergyMode,
  capabilities,
  selectedCapability,
  onSelectCapability,
  models,
  awakeModelIds,
  latestResult,
  onRunDirective,
  isExecuting,
}) => {
  // Capability Track Filter ('overlapping' | 'apex_unique' | 'all')
  const [capFilter, setCapFilter] = useState<'overlapping' | 'apex_unique' | 'all'>('overlapping');
  const [copiedArtifact, setCopiedArtifact] = useState(false);

  // Workbench State (Mode 2)
  const [fsGraph, setFsGraph] = useState<{ nodes: FsNode[]; links: FsLink[] }>({
    nodes: [],
    links: [],
  });
  const [selectedFile, setSelectedFile] = useState<FsNode | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [workbenchView, setWorkbenchView] = useState<'source' | 'diff'>('source');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>(
    '$ [Aspira macOS Bridge Ready] Select a preset command above to inspect local system state.'
  );
  const [terminalBusy, setTerminalBusy] = useState(false);

  // Live Vision & Operator State (Mode 3)
  const [cursorActions, setCursorActions] = useState<
    { id: string; model: string; accent: string; coords: string; action: string; status: string }[]
  >([
    {
      id: 'act-1',
      model: 'Argon',
      accent: '#6E8EFB',
      coords: 'Viewport · 60fps Stream',
      action: 'Spatial Vision locked onto active studio canvas & operator biometrics',
      status: 'Active',
    },
    {
      id: 'act-2',
      model: 'Claude',
      accent: '#D97757',
      coords: 'DOM · src/App.tsx',
      action: 'Computer Use operator standing by for autonomous GUI & terminal dispatch',
      status: 'Ready',
    },
    {
      id: 'act-3',
      model: 'GPT',
      accent: '#10A37F',
      coords: 'WebRTC · Audio Duplex',
      action: 'Sub-second voice interruption & parallel function swarm armed',
      status: 'Armed',
    },
  ]);

  // Global Pulse Signals (Mode 4)
  const [liveReconFeed] = useState([
    {
      id: 'x-1',
      source: 'Grok · Live X Stream',
      tag: 'Breaking Signal',
      color: '#F43F5E',
      text: 'Multi-agent spatial studios & unified MCP workbenches surging across AI engineering discussions (+340% velocity).',
    },
    {
      id: 'x-2',
      source: 'Argon · Search Grounding',
      tag: 'Verified Citation',
      color: '#6E8EFB',
      text: 'Apple Silicon MLX local voice synthesis (Kokoro-82M & Moshi) achieves <80ms first-packet audio latency with zero cloud overhead.',
    },
    {
      id: 'x-3',
      source: 'Claude · MCP Audit',
      tag: 'Architecture Check',
      color: '#D97757',
      text: 'Local filesystem AST graph & terminal bridge verified with deterministic read/exec sandbox boundaries.',
    },
  ]);

  useEffect(() => {
    if (spatialMode === 'forge' && fsGraph.nodes.length === 0) {
      fetch('/api/fs-graph')
        .then((r) => r.json())
        .then((data) => {
          if (data?.nodes) {
            setFsGraph(data);
            const firstModule = data.nodes.find((n: FsNode) => n.type === 'module');
            if (firstModule) setSelectedFile(firstModule);
          }
        })
        .catch(() => {});
    }
  }, [spatialMode, fsGraph.nodes.length]);

  const filteredCapabilities = useMemo(() => {
    if (capFilter === 'all') return capabilities;
    return capabilities.filter((c) => c.category === capFilter);
  }, [capabilities, capFilter]);

  const filteredFiles = useMemo(() => {
    return fsGraph.nodes.filter(
      (n) =>
        n.type !== 'core' &&
        n.type !== 'directory' &&
        (!fileSearch.trim() ||
          n.id.toLowerCase().includes(fileSearch.toLowerCase()) ||
          n.symbols?.some((s) => s.toLowerCase().includes(fileSearch.toLowerCase())))
    );
  }, [fsGraph.nodes, fileSearch]);

  const runTerminalPreset = async (preset: string) => {
    setTerminalOpen(true);
    setTerminalBusy(true);
    try {
      const r = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      const data = await r.json();
      setTerminalOutput(`$ ${data.command}\n${data.output}`);
    } catch {
      setTerminalOutput('$ [Offline Simulation] Local process telemetry nominal.');
    } finally {
      setTerminalBusy(false);
    }
  };

  const triggerSimulatedComputerUse = () => {
    const newEntry = {
      id: `act-${Date.now()}`,
      model: awakeModelIds.includes('claude') ? 'Claude' : 'Argon',
      accent: awakeModelIds.includes('claude') ? '#D97757' : '#6E8EFB',
      coords: `X:${Math.floor(220 + Math.random() * 880)} · Y:${Math.floor(140 + Math.random() * 520)}`,
      action: 'Inspected active viewport hierarchy, verified DOM layout & synthesized AST patch vector',
      status: 'Executed',
    };
    setCursorActions((prev) => [newEntry, ...prev.slice(0, 5)]);
    onRunDirective('Execute Live Vision & Autonomous UI Dissection across active workspace');
  };

  // ============================================================================
  // VIEW 1: UNIFIED AGENT STUDIO (Clean Capability Matrix + Executive Synthesis)
  // ============================================================================
  if (spatialMode === 'nexus') {
    return (
      <div className="grid grid-cols-12 gap-4 h-full pointer-events-auto">
        {/* LEFT COLUMN (4 cols): Progressive-Disclosure Capability Selector */}
        <div className="col-span-4 aspira-glass rounded-2xl p-4 flex flex-col max-h-[calc(100vh-195px)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#6E8EFB]" />
              <h2 className="font-display text-sm font-semibold text-white">
                Capabilities
              </h2>
            </div>

            {/* Segmented Filter Pill */}
            <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06] text-[11px]">
              {(
                [
                  { id: 'overlapping', label: 'Shared (5)' },
                  { id: 'apex_unique', label: 'Unique (4)' },
                  { id: 'all', label: 'All' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundEngine.playGlassTick();
                    setCapFilter(tab.id);
                  }}
                  className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                    capFilter === tab.id
                      ? 'bg-white/[0.12] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredCapabilities.map((cap) => {
              const isSelected = selectedCapability.id === cap.id;
              const isOverlap = cap.category === 'overlapping';

              return (
                <div
                  key={cap.id}
                  onClick={() => {
                    soundEngine.playGlassTick();
                    onSelectCapability(cap);
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.07] border-white/[0.18] shadow-lg'
                      : 'aspira-card-interactive'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white">{cap.name}</span>

                    {/* Model Color Dots & Proficiency Strip */}
                    <div className="flex items-center gap-1">
                      {cap.supportedModels.map((sm) => {
                        const modelObj = models.find((m) => m.id === sm.modelId);
                        const isAwake = awakeModelIds.includes(sm.modelId);
                        return (
                          <span
                            key={sm.modelId}
                            title={`${modelObj?.codeName}: ${sm.badgeLabel} (${sm.proficiency}%)`}
                            style={{
                              backgroundColor: isAwake
                                ? `${modelObj?.accentHex}22`
                                : 'rgba(255,255,255,0.03)',
                              borderColor: isAwake
                                ? `${modelObj?.accentHex}66`
                                : 'rgba(255,255,255,0.08)',
                              color: isAwake ? modelObj?.accentHex : '#64748b',
                            }}
                            className="font-mono-tech text-[10px] px-1.5 py-0.5 rounded-md border"
                          >
                            {modelObj?.codeName}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progressive Disclosure: Expand Details Only When Selected */}
                  {isSelected && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/[0.07] space-y-2">
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {cap.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cap.supportedModels.map((sm) => {
                          const mObj = models.find((m) => m.id === sm.modelId);
                          return (
                            <span
                              key={sm.modelId}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 border border-white/[0.06]"
                            >
                              <strong style={{ color: mObj?.accentHex }}>
                                {mObj?.codeName}:
                              </strong>{' '}
                              {sm.badgeLabel}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-mono-tech text-slate-400">
                          {isOverlap ? 'Multi-Agent Ensemble Skill' : '1:1 Native Protocol Exclusive'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunDirective(`Run ${cap.name} synthesis`, cap);
                          }}
                          disabled={isExecuting}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-black hover:bg-white/90 text-[11px] font-semibold transition cursor-pointer"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Run Synthesis</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER WINDOW (3 cols): Unobstructed 3D Fluid Aurora Orb + Floating Synergy Mode Pill */}
        <div className="col-span-3 flex flex-col justify-between items-center pointer-events-none">
          <div className="pointer-events-auto aspira-glass rounded-full p-1 flex items-center gap-1">
            {(
              [
                { id: 'fusion', label: 'Fusion' },
                { id: 'adversarial', label: 'Debate' },
                { id: 'sprint', label: 'Race' },
                { id: 'relay', label: 'Relay' },
              ] as { id: SynergyMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playGlassTick();
                  onSelectSynergyMode(m.id);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                  synergyMode === m.id
                    ? 'bg-white text-black shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="pointer-events-auto aspira-glass rounded-full px-4 py-1.5 text-[11px] text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {awakeModelIds.length} of {models.length} Agents Awake in Constellation
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Editorial Synthesis Canvas & Multi-Agent Perspectives */}
        <div className="col-span-5 aspira-glass rounded-2xl p-5 flex flex-col overflow-y-auto max-h-[calc(100vh-195px)]">
          {latestResult ? (
            <div className="space-y-4">
              {/* Executive Artifact Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-mono-tech text-slate-400 mb-1">
                    <span className="text-[#6E8EFB] font-medium">
                      {latestResult.capabilityName}
                    </span>
                    <span>·</span>
                    <span className="uppercase">{latestResult.synergyMode}</span>
                    <span>·</span>
                    <span>{latestResult.timestamp}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-white leading-snug">
                    {latestResult.executiveHeadline}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono-tech text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    {latestResult.consensusScore}% Sync
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(latestResult.synthesizedOutput);
                      setCopiedArtifact(true);
                      setTimeout(() => setCopiedArtifact(false), 1500);
                    }}
                    title="Copy Executive Synthesis"
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 cursor-pointer"
                  >
                    {copiedArtifact ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Hero Executive Synthesis Brief */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="text-xs text-slate-400">
                  Directive: <span className="text-slate-200">“{latestResult.prompt}”</span>
                </div>
                <p className="text-[13.5px] text-slate-100 leading-relaxed">
                  {latestResult.synthesizedOutput}
                </p>

                {/* Attribution Pills (Shared Consensus vs. Unique Model Nuance) */}
                {latestResult.attributionPills && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {latestResult.attributionPills.map((pill) => (
                      <span
                        key={pill.id}
                        title={pill.detail}
                        style={{
                          borderColor: `${pill.accentHex}55`,
                          backgroundColor: `${pill.accentHex}14`,
                          color: pill.accentHex,
                        }}
                        className="text-[10px] font-medium px-2.5 py-0.5 rounded-full border"
                      >
                        {pill.type === 'consensus' ? '✦ ' : '◆ '}
                        {pill.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mode-Specific Interactive Studio Views (Debate / Speed Race / Relay) */}
              {synergyMode === 'adversarial' && latestResult.debateLedger && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-400">
                    3-Stage Adversarial Red-Team Ledger
                  </div>
                  {latestResult.debateLedger.map((round) => (
                    <div
                      key={round.round}
                      style={{ borderLeftColor: round.accentHex }}
                      className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.07] border-l-2 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono-tech">
                        <span style={{ color: round.accentHex }} className="font-semibold">
                          Stage {round.round} · {round.speakerName} ({round.phase})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-300">
                          {round.impactBadge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {round.statement}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {synergyMode === 'sprint' && latestResult.sprintLeaderboard && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-[#10A37F]" />
                    <span>Speculative Speed Race Telemetry (TTFT & Velocity)</span>
                  </div>
                  {latestResult.sprintLeaderboard.map((entry) => (
                    <div
                      key={entry.modelId}
                      className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.07] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          style={{ backgroundColor: entry.accentHex }}
                          className="w-2 h-2 rounded-full"
                        />
                        <span className="font-semibold text-white">
                          #{entry.rank} {entry.codeName}
                        </span>
                        <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-slate-300">
                          {entry.status === 'SPECULATIVE_WINNER' ? '★ Winner' : 'Verifier'}
                        </span>
                      </div>
                      <div className="font-mono-tech text-[11px] text-slate-300">
                        TTFT {entry.ttftMs}ms · Total {entry.totalLatencyMs}ms · {entry.tokensPerSec} tok/s
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {synergyMode === 'relay' && latestResult.relayPipeline && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-400">
                    Sequential Relay Handoff Chain
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {latestResult.relayPipeline.map((stage) => (
                      <div
                        key={stage.stage}
                        className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono-tech">
                          <span style={{ color: stage.accentHex }} className="font-semibold">
                            {stage.codeName}
                          </span>
                          <span className="text-slate-400">{stage.latencyMs}ms</span>
                        </div>
                        <div className="text-xs font-medium text-white">{stage.stageTitle}</div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {stage.outputArtifact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Awake Agent Perspective Cards */}
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-slate-400">
                  Awake Agent Perspectives ({latestResult.modelStreams.length})
                </div>
                {latestResult.modelStreams.map((stream) => {
                  const mObj = models.find((m) => m.id === stream.modelId);
                  return (
                    <div
                      key={stream.modelId}
                      style={{ borderLeftColor: mObj?.accentHex || '#6E8EFB' }}
                      className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] border-l-2 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">
                            {stream.codeName}
                          </span>
                          <span
                            style={{
                              color: mObj?.accentHex,
                              backgroundColor: `${mObj?.accentHex}18`,
                            }}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                          >
                            {stream.badgeLabel}
                          </span>
                        </div>
                        <span className="font-mono-tech text-[10px] text-slate-400">
                          {stream.latencyMs}ms · {stream.tokensPerSec} tok/s ·{' '}
                          {stream.source === 'LIVE_API' ? 'Live API' : 'Sim'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {stream.keyInsight}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="my-auto text-center py-12 text-xs text-slate-400">
              Select any capability on the left or ask a question below to synthesize across your awake agents.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: CODE & ARTIFACT WORKBENCH (AST File Tree + Source/Diff + Terminal)
  // ============================================================================
  if (spatialMode === 'forge') {
    const codeLines = (
      selectedFile?.preview ||
      '// Select a file from the repository tree on the left to inspect its source code and AST symbols.'
    ).split('\n');

    return (
      <div className="grid grid-cols-12 gap-4 h-full pointer-events-auto">
        {/* Left (4 cols): Sleek Repository AST & Symbol Tree */}
        <div className="col-span-4 aspira-glass rounded-2xl p-4 flex flex-col max-h-[calc(100vh-195px)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#D97757]" />
              <h2 className="font-display text-sm font-semibold text-white">
                Workspace AST Graph
              </h2>
            </div>
            <span className="font-mono-tech text-[11px] text-slate-400">
              {filteredFiles.length} modules
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Filter files or AST symbols..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#07080C] border border-white/[0.08] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredFiles.map((node) => {
              const active = selectedFile?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => {
                    soundEngine.playGlassTick();
                    setSelectedFile(node);
                  }}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    active
                      ? 'bg-white/[0.08] border-white/[0.18] text-white'
                      : 'aspira-card-interactive text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono-tech">
                    <span className="font-medium truncate">{node.id}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                      {node.lines}L
                    </span>
                  </div>
                  {node.symbols && node.symbols.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {node.symbols.slice(0, 5).map((sym) => (
                        <span
                          key={sym}
                          className="font-mono-tech text-[9.5px] px-1.5 py-0.2 rounded bg-white/[0.05] text-slate-300 border border-white/[0.06]"
                        >
                          ƒ {sym}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right (8 cols): Cursor / Claude Artifacts Code & Diff Workbench + Collapsible Terminal */}
        <div className="col-span-8 flex flex-col gap-3 max-h-[calc(100vh-195px)]">
          <div className="aspira-glass rounded-2xl p-4 flex-1 flex flex-col overflow-hidden">
            {/* Workbench Header Bar */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#6E8EFB]" />
                <span className="font-mono-tech text-xs font-medium text-white">
                  {selectedFile ? selectedFile.id : 'Select module'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Source vs Multi-Agent AST Diff Toggle */}
                <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06] text-[11px]">
                  <button
                    onClick={() => setWorkbenchView('source')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      workbenchView === 'source'
                        ? 'bg-white/[0.12] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Source Inspector
                  </button>
                  <button
                    onClick={() => setWorkbenchView('diff')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      workbenchView === 'diff'
                        ? 'bg-white/[0.12] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Multi-Agent AST Diff
                  </button>
                </div>

                <button
                  onClick={() =>
                    onRunDirective(
                      `Refactor and audit ${selectedFile?.id || 'workspace'} with Claude AST Forgemaster + Argon 2M Repo Context`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Refactor with Claude + Argon</span>
                </button>
              </div>
            </div>

            {/* Code or Synthesized Diff Viewport */}
            {workbenchView === 'source' ? (
              <div className="flex-1 overflow-auto rounded-xl bg-[#07080C] border border-white/[0.07] p-3 font-mono-tech text-[11.5px] leading-relaxed">
                {codeLines.map((line, idx) => (
                  <div key={idx} className="flex gap-4 hover:bg-white/[0.02] px-1 rounded">
                    <span className="w-7 text-right text-slate-600 select-none shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-slate-200 whitespace-pre">{line || ' '}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded-xl bg-[#07080C] border border-white/[0.07] p-4 font-mono-tech text-xs space-y-2">
                <div className="text-slate-400 mb-2">
                  // Proposed Multi-Agent AST Optimization ({selectedFile?.id || 'src/App.tsx'})
                </div>
                <div className="p-2 rounded bg-rose-500/10 border-l-2 border-rose-400 text-rose-200">
                  - // Legacy synchronous state dispatch without memoized capability routing
                </div>
                <div className="p-2 rounded bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-200">
                  + // Claude + Argon Verified: Zero-copy parallel stream reducer with deterministic MCP rollback
                </div>
                <div className="p-2 rounded bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-200">
                  + export const verifiedPipeline = createDeterministicSynergyGraph(manifest, awakeCores);
                </div>
                <div className="pt-2 text-slate-300">
                  {latestResult?.synthesizedOutput}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible macOS Local Terminal Drawer */}
          <div className="aspira-glass rounded-2xl px-4 py-2.5 flex flex-col">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTerminalOpen((v) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-white cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-[#10A37F]" />
                <span>macOS Local Terminal Sandbox</span>
                {terminalOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'sys-procs', label: 'Top Processes' },
                  { id: 'git-status', label: 'Git Status' },
                  { id: 'tree-scan', label: 'Module Tree' },
                  { id: 'disk-df', label: 'Disk Usage' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => runTerminalPreset(btn.id)}
                    disabled={terminalBusy}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-[11px] text-slate-200 cursor-pointer transition"
                  >
                    <Play className="w-2.5 h-2.5 inline mr-1 text-[#10A37F]" />
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {terminalOpen && (
              <pre className="mt-2.5 h-32 overflow-auto rounded-xl bg-[#07080C] border border-white/[0.07] p-3 font-mono-tech text-[11px] text-emerald-300">
                {terminalOutput}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: LIVE VISION & OS OPERATOR (Gemini Live + Claude Computer Use)
  // ============================================================================
  if (spatialMode === 'overwatch') {
    return (
      <div className="grid grid-cols-12 gap-4 h-full pointer-events-auto">
        {/* Left (5 cols): Autonomous Operator Action Stream */}
        <div className="col-span-5 aspira-glass rounded-2xl p-5 flex flex-col justify-between max-h-[calc(100vh-195px)]">
          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#6E8EFB]" />
                <h2 className="font-display text-sm font-semibold text-white">
                  Live Vision & OS Operator
                </h2>
              </div>
              <span className="font-mono-tech text-[10px] px-2.5 py-0.5 rounded-full bg-[#6E8EFB]/15 text-[#93ADFF] border border-[#6E8EFB]/30">
                60 FPS Stream
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Combines <strong className="text-white">Argon’s continuous spatial video stream</strong> with <strong className="text-white">Claude’s autonomous Computer Use</strong> cursor and keyboard operator.
            </p>

            <div className="space-y-2 pt-1">
              {cursorActions.map((item) => (
                <div
                  key={item.id}
                  style={{ borderLeftColor: item.accent }}
                  className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.07] border-l-2 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white">{item.model}</span>
                    <span className="font-mono-tech text-[10px] text-slate-400">
                      {item.coords}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={triggerSimulatedComputerUse}
            className="mt-4 w-full py-2.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
          >
            <MousePointerClick className="w-4 h-4" />
            <span>Dispatch Autonomous UI & Spatial Scan</span>
          </button>
        </div>

        {/* Right (7 cols): Ambient Optical Stage (Allows Central 3D Orb to Shine Through) */}
        <div className="col-span-7 aspira-glass rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium text-white">Spatial Viewport Aperture</span>
            <span className="font-mono-tech text-[11px] text-emerald-300">
              ● Full-Duplex Audio & Vision Active
            </span>
          </div>

          {/* Refined Apple visionOS / Gemini Live Hairline Reticle */}
          <div className="my-auto flex flex-col items-center justify-center pointer-events-none">
            <div className="w-56 h-56 rounded-full border border-white/[0.09] flex items-center justify-center relative">
              <div className="w-36 h-36 rounded-full border border-white/[0.14]" />
              <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-[#11131A] border border-white/[0.1] text-[10px] text-slate-300">
                Argon 2M Spatial Stream
              </div>
              <div className="absolute -bottom-3 px-3 py-0.5 rounded-full bg-[#11131A] border border-white/[0.1] text-[10px] text-slate-300">
                Claude GUI Vector Lock
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-[10px] text-slate-400">Hand & Gesture Tracking</div>
              <div className="text-xs font-semibold text-white mt-0.5">21 Spatial Landmarks</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-[10px] text-slate-400">MCP Tool Servers</div>
              <div className="text-xs font-semibold text-white mt-0.5">Filesystem & Terminal</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="text-[10px] text-slate-400">Voice Interruption</div>
              <div className="text-xs font-semibold text-white mt-0.5">Zero-Lag Barge-In</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 4: GLOBAL PULSE & DEBATE ARENA (Grok Live Signals + Multi-Agent Debate)
  // ============================================================================
  return (
    <div className="grid grid-cols-12 gap-4 h-full pointer-events-auto">
      {/* Left (5 cols): Editorial Live Signal Cards */}
      <div className="col-span-5 aspira-glass rounded-2xl p-5 flex flex-col justify-between max-h-[calc(100vh-195px)]">
        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#F43F5E]" />
              <h2 className="font-display text-sm font-semibold text-white">
                Global Pulse & Grounding
              </h2>
            </div>
            <span className="font-mono-tech text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/30">
              Live Stream
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {liveReconFeed.map((item) => (
              <div
                key={item.id}
                style={{ borderLeftColor: item.color }}
                className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] border-l-2 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white">{item.source}</span>
                  <span className="font-mono-tech text-[10px] text-slate-400">{item.tag}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{item.text}</p>
                <button
                  onClick={() => {
                    onSelectSynergyMode('adversarial');
                    onRunDirective(`Debate and verify signal: ${item.text}`);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white pt-0.5 cursor-pointer"
                >
                  <span>Debate this signal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            onSelectSynergyMode('adversarial');
            onRunDirective(
              'Run Adversarial Debate: Claude proposes system architecture, Grok challenges edge cases, Argon verifies'
            );
          }}
          className="mt-4 w-full py-2.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
        >
          <Swords className="w-4 h-4" />
          <span>Launch Multi-Agent Debate</span>
        </button>
      </div>

      {/* Right (7 cols): Structured Multi-Agent Debate Timeline */}
      <div className="col-span-7 aspira-glass rounded-2xl p-5 flex flex-col justify-between max-h-[calc(100vh-195px)] overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#D97757]" />
              <h2 className="font-display text-sm font-semibold text-white">
                Multi-Agent Cross-Examination
              </h2>
            </div>
            <span className="font-mono-tech text-[11px] text-slate-400">
              {awakeModelIds.length} Agents Participating
            </span>
          </div>

          {latestResult?.debateLedger ? (
            <div className="space-y-2.5 pt-1">
              {latestResult.debateLedger.map((exchange) => (
                <div
                  key={exchange.round}
                  style={{ borderLeftColor: exchange.accentHex }}
                  className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] border-l-2 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white">
                      Stage {exchange.round} · {exchange.speakerName}
                    </span>
                    <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-slate-300">
                      {exchange.impactBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {exchange.statement}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Click <span className="text-white font-medium">Launch Multi-Agent Debate</span> to watch your awake models challenge and refine each other’s reasoning.
            </div>
          )}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <GitMerge className="w-4 h-4 text-emerald-400" />
            <span>
              Arbiter Verdict: {latestResult?.divergentPoints[0]?.resolution || 'All claims cross-verified across awake cores.'}
            </span>
          </div>
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>
      </div>
    </div>
  );
};
