import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Eye,
  FileCode,
  Flame,
  FolderGit2,
  GitMerge,
  Globe,
  Layers,
  MousePointerClick,
  Play,
  Radar,
  ShieldAlert,
  Sparkles,
  Swords,
  Terminal,
  Zap,
} from 'lucide-react';
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
  // State for Mode 2: 3D Code & System Forge
  const [fsGraph, setFsGraph] = useState<{ nodes: FsNode[]; links: FsLink[] }>({
    nodes: [],
    links: [],
  });
  const [selectedFile, setSelectedFile] = useState<FsNode | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>(
    '[A.R.C.H.O.N. Local Bridge Ready] Select a system preset or click any 3D AST file node to dissect.'
  );
  const [terminalBusy, setTerminalBusy] = useState(false);

  // State for Mode 3: Tactical Overwatch Visor (Simulated live cursor & vision bounding stream)
  const [cursorActions, setCursorActions] = useState<
    { id: string; model: string; coords: string; action: string; status: string }[]
  >([
    {
      id: 'act-1',
      model: 'ARGON',
      coords: '[X:0482, Y:0310, Z:0.84]',
      action: 'Spatial Vision locked onto active viewport & operator biometrics',
      status: 'LOCKED',
    },
    {
      id: 'act-2',
      model: 'CLAUDE',
      coords: '[DOM://archon-hud/src/App.tsx]',
      action: 'Computer Use operator standing by for autonomous GUI/terminal dispatch',
      status: 'READY',
    },
    {
      id: 'act-3',
      model: 'GPT',
      coords: '[WebRTC://audio-duplex-01]',
      action: 'Sub-second voice interruption & parallel function swarm armed',
      status: 'ARMED',
    },
  ]);

  // State for Mode 4: Global Recon & Debate War Room
  const [liveReconFeed] = useState([
    {
      id: 'x-1',
      source: 'GROK // X FIREHOSE',
      tag: 'BREAKING SIGNAL',
      color: '#ff2a6d',
      text: 'Multi-agent spatial WebGPU interfaces & MCP tool orchestration trending +340% across AI engineering feeds.',
    },
    {
      id: 'x-2',
      source: 'ARGON // SEARCH GROUNDING',
      tag: 'VERIFIED DOCS',
      color: '#00f0ff',
      text: 'Cross-verified WebAudio transient clap detection + ECAPA voiceprint embeddings achieve <18ms local gate latency.',
    },
    {
      id: 'x-3',
      source: 'CLAUDE // MCP REGISTRY',
      tag: 'SYSTEM AUDIT',
      color: '#ff9e00',
      text: 'Local filesystem AST graph & terminal bridge sandboxed with deterministic read/exec boundaries.',
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

  const runTerminalPreset = async (preset: string) => {
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
      model: awakeModelIds.includes('claude') ? 'CLAUDE' : 'ARGON',
      coords: `[X:${Math.floor(200 + Math.random() * 900)}, Y:${Math.floor(120 + Math.random() * 600)}]`,
      action: 'Executed autonomous viewport inspection, verified DOM tree & synthesized AST patch vector',
      status: 'EXECUTED',
    };
    setCursorActions((prev) => [newEntry, ...prev.slice(0, 5)]);
    onRunDirective('Execute Overwatch UI & Spatial Vision Dissection across active workspace');
  };

  // ============================================================================
  // MODE 1: PANTHEON NEXUS (Capability Overlap Matrix + Multi-Model Synergy Prism)
  // ============================================================================
  if (spatialMode === 'nexus') {
    return (
      <div className="grid grid-cols-12 gap-3 h-full pointer-events-auto">
        {/* LEFT COLUMN: Plug & Play Capability Matrix (Unique vs Overlapping) */}
        <div className="col-span-5 flex flex-col gap-2.5 overflow-y-auto pr-1 max-h-[calc(100vh-230px)]">
          <div className="hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-cyan-300 uppercase font-['Orbitron']">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Capability Matrix // Unique vs Overlap</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                {capabilities.length} NATIVE SKILLS
              </span>
            </div>

            <p className="text-[11px] text-slate-300/85 mb-2.5 leading-snug">
              Select any capability below. <span className="text-amber-300 font-semibold">Overlapping capabilities</span> automatically engage all awake models supporting that skill via the Synergy Reactor.
            </p>

            <div className="space-y-1.5">
              {capabilities.map((cap) => {
                const isSelected = selectedCapability.id === cap.id;
                const awakeSupporters = cap.supportedModels.filter((s) =>
                  awakeModelIds.includes(s.modelId)
                );
                const isOverlap = cap.category === 'overlapping';

                return (
                  <div
                    key={cap.id}
                    onClick={() => onSelectCapability(cap)}
                    className={`p-2 rounded border transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'bg-[#051224]/75 border-cyan-500/20 hover:border-cyan-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                            isOverlap
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                          }`}
                        >
                          {isOverlap ? `OVERLAP (${cap.supportedModels.length})` : 'APEX UNIQUE'}
                        </span>
                        <span className="text-xs font-semibold text-white">{cap.name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {cap.supportedModels.map((sm) => {
                          const modelObj = models.find((m) => m.id === sm.modelId);
                          const isAwake = awakeModelIds.includes(sm.modelId);
                          return (
                            <span
                              key={sm.modelId}
                              title={`${modelObj?.codeName}: ${sm.proficiency}% (${sm.roleInOverlap})`}
                              style={{
                                borderColor: modelObj?.accentHex,
                                color: isAwake ? modelObj?.accentHex : '#64748b',
                                opacity: isAwake ? 1 : 0.4,
                              }}
                              className="text-[9px] font-mono px-1.5 py-0.2 rounded border bg-black/50 uppercase"
                            >
                              {modelObj?.codeName}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-300/80 mt-1 line-clamp-1">
                      {cap.description}
                    </p>

                    {isSelected && (
                      <div className="mt-2 pt-1.5 border-t border-cyan-500/25 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-300">
                          Awake Cores Ready: {awakeSupporters.length} / {cap.supportedModels.length}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunDirective(`Execute ${cap.name} diagnostic & synthesis`, cap);
                          }}
                          disabled={isExecuting}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/30 hover:bg-cyan-500/45 border border-cyan-300 text-[10px] font-mono text-cyan-100 uppercase cursor-pointer"
                        >
                          <Zap className="w-3 h-3" />
                          Ignite Skill
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Clear 3D Reactor Window + Synergy Mode Selector */}
        <div className="col-span-3 flex flex-col justify-between pointer-events-none">
          <div className="hud-panel pointer-events-auto rounded-lg border border-cyan-500/30 bg-[#030b17]/75 p-2.5 backdrop-blur-md text-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 mb-1.5">
              Overlapping Capability Synergy Mode
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'fusion', label: 'Fusion Prism', desc: 'Merge & Diff Consensus' },
                  { id: 'adversarial', label: 'Red-Team Arena', desc: 'Build vs Attack Debate' },
                  { id: 'sprint', label: 'Speculative Race', desc: 'Fastest Token Lock' },
                  { id: 'relay', label: 'Apex Relay Chain', desc: 'Sequential Handoff' },
                ] as { id: SynergyMode; label: string; desc: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectSynergyMode(m.id)}
                  className={`p-1.5 rounded border text-left transition cursor-pointer ${
                    synergyMode === m.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(255,170,0,0.25)]'
                      : 'bg-slate-900/70 border-cyan-500/20 text-slate-300 hover:border-cyan-400/40'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase font-mono">{m.label}</div>
                  <div className="text-[9px] text-slate-400 truncate">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="hud-panel pointer-events-auto rounded-lg border border-cyan-500/30 bg-[#030b17]/75 p-2.5 backdrop-blur-md text-center">
            <div className="text-[10px] font-mono text-cyan-300 uppercase">
              Active Reactor Core Status
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {awakeModelIds.length} of {models.length} Cores Orbiting Inner Ignition Ring
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Click any model core card on the bottom deck or speak <span className="text-cyan-300">"Wake up Grok / GPT"</span> to dynamically add brains.
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Multi-Model Consensus & Divergence Readout */}
        <div className="col-span-4 flex flex-col gap-2.5 overflow-y-auto pl-1 max-h-[calc(100vh-230px)]">
          <div className="hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-cyan-300 uppercase font-['Orbitron']">
                <GitMerge className="w-4 h-4 text-amber-400" />
                <span>Synaptic Telemetry & Consensus</span>
              </div>
              {latestResult && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  SYNC: {latestResult.consensusScore}%
                </span>
              )}
            </div>

            {latestResult ? (
              <div className="space-y-2.5 text-xs">
                <div className="p-2 rounded bg-cyan-950/40 border border-cyan-500/30">
                  <div className="text-[10px] font-mono text-cyan-400 uppercase">
                    Directive // {latestResult.capabilityName} [{latestResult.synergyMode.toUpperCase()}]
                  </div>
                  <div className="text-white font-medium mt-0.5">"{latestResult.prompt}"</div>
                </div>

                {/* Individual Awake Model Streams */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Individual Awake Core Streams ({latestResult.modelStreams.length})
                  </div>
                  {latestResult.modelStreams.map((stream) => {
                    const mObj = models.find((m) => m.id === stream.modelId);
                    return (
                      <div
                        key={stream.modelId}
                        style={{ borderLeftColor: mObj?.accentHex || '#00f0ff' }}
                        className="p-2 rounded bg-[#061529]/90 border border-cyan-500/20 border-l-4"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span style={{ color: mObj?.accentHex }} className="font-bold">
                            {stream.codeName} // {stream.source === 'LIVE_API' ? 'LIVE API' : 'NEURAL SIM'}
                          </span>
                          <span className="text-slate-400">
                            {stream.latencyMs}ms • {stream.tokensPerSec} tok/s • Conf {stream.confidence}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-200 leading-relaxed">
                          {stream.keyInsight}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Cyan Consensus vs Amber Divergence */}
                <div className="p-2 rounded bg-cyan-500/10 border border-cyan-400/40">
                  <div className="text-[10px] font-mono font-bold text-cyan-300 uppercase mb-1">
                    ✦ Cyan Prism Consensus (Shared Agreement)
                  </div>
                  <ul className="space-y-1 text-[11px] text-cyan-100 list-disc list-inside">
                    {latestResult.consensusPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-2 rounded bg-amber-500/10 border border-amber-400/40">
                  <div className="text-[10px] font-mono font-bold text-amber-300 uppercase mb-1">
                    ⚡ Amber Divergence & Synergy Resolution
                  </div>
                  {latestResult.divergentPoints.map((d, i) => (
                    <div key={i} className="mb-1.5 last:mb-0 text-[11px]">
                      <div className="font-semibold text-amber-200">{d.topic}</div>
                      <div className="text-slate-300 text-[10px]">{d.positions}</div>
                      <div className="text-emerald-300 text-[10px] font-mono mt-0.5">
                        → Resolution: {d.resolution}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-8 text-center">
                Issue any voice or text directive below or click <span className="text-cyan-300">Ignite Skill</span> on any capability to watch awake models collaborate in real time.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 2: 3D CODE & SYSTEM FORGE (Live Workspace AST Graph + Terminal Bridge)
  // ============================================================================
  if (spatialMode === 'forge') {
    return (
      <div className="grid grid-cols-12 gap-3 h-full pointer-events-auto">
        {/* Left: Live Project File & AST Node Explorer */}
        <div className="col-span-4 hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md flex flex-col max-h-[calc(100vh-230px)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-300 uppercase font-['Orbitron']">
              <FolderGit2 className="w-4 h-4 text-amber-400" />
              <span>3D Workspace AST Graph</span>
            </div>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-400/30">
              {fsGraph.nodes.length} NODES
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mb-2">
            Live dependency & symbol scan of <code className="text-cyan-300">/Users/yosefshammout/archon-hud</code>. Click any module node to explode its AST symbols and run multi-model refactoring.
          </p>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {fsGraph.nodes
              .filter((n) => n.type !== 'core')
              .map((node) => {
                const active = selectedFile?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedFile(node)}
                    className={`p-2 rounded border transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-[#061427]/80 border-cyan-500/20 hover:border-amber-400/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold truncate">{node.id}</span>
                      <span className="text-[10px] text-cyan-300">{node.lines} LOC</span>
                    </div>
                    {node.symbols && node.symbols.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {node.symbols.map((sym) => (
                          <span
                            key={sym}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
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

        {/* Center/Right: Exploded Code Inspector + Live macOS Terminal Bridge */}
        <div className="col-span-8 flex flex-col gap-3 max-h-[calc(100vh-230px)]">
          <div className="hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono text-white">
                  {selectedFile ? selectedFile.id : 'Select a file node'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onRunDirective(
                      `Audit and optimize ${selectedFile?.id || 'workspace'} using Claude AST Forge + Argon 2M Repo Context`
                    )
                  }
                  className="px-2.5 py-1 rounded bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400 text-[10px] font-mono text-amber-200 uppercase cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  Claude + Argon Multi-Audit
                </button>
              </div>
            </div>

            <pre className="flex-1 overflow-auto rounded bg-[#01060e] border border-cyan-500/25 p-2.5 text-[11px] font-mono text-cyan-100 leading-relaxed">
              {selectedFile?.preview || '// Select a module node on the left to inspect live source code & AST symbols.'}
            </pre>
          </div>

          {/* Real Local macOS Terminal Execution Bridge */}
          <div className="hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/90 p-3 backdrop-blur-md h-48 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-300 uppercase font-['Orbitron']">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>macOS Local Terminal Sandbox Bridge</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'sys-procs', label: 'Top Processes' },
                  { id: 'git-status', label: 'Workspace Status' },
                  { id: 'tree-scan', label: 'Module Tree' },
                  { id: 'disk-df', label: 'Disk Telemetry' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => runTerminalPreset(btn.id)}
                    disabled={terminalBusy}
                    className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/40 text-[10px] font-mono text-emerald-200 cursor-pointer"
                  >
                    <Play className="w-2.5 h-2.5 inline mr-1" />
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
            <pre className="flex-1 overflow-auto rounded bg-black/80 border border-emerald-500/25 p-2 text-[11px] font-mono text-emerald-300">
              {terminalOutput}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 3: TACTICAL OVERWATCH VISOR (Argon Spatial Vision + Claude Computer Use)
  // ============================================================================
  if (spatialMode === 'overwatch') {
    return (
      <div className="grid grid-cols-12 gap-3 h-full pointer-events-auto">
        <div className="col-span-5 hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-cyan-300 uppercase font-['Orbitron']">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Argon Live Spatial Vision + Claude OS Control</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                60 FPS LOCK
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mb-3">
              Overwatch Mode fuses <span className="text-cyan-300 font-semibold">Argon's continuous video/screen comprehension</span> with <span className="text-amber-300 font-semibold">Claude's autonomous OS cursor & keyboard operator</span>.
            </p>

            <div className="space-y-2">
              {cursorActions.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded bg-[#061529]/85 border border-cyan-500/25 text-[11px] font-mono"
                >
                  <div className="flex items-center justify-between text-cyan-300 mb-0.5">
                    <span className="font-bold">{item.model} OPERATOR</span>
                    <span className="text-amber-300">{item.coords}</span>
                  </div>
                  <div className="text-slate-200">{item.action}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={triggerSimulatedComputerUse}
            className="mt-3 w-full py-2 rounded bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-300 text-xs font-mono font-bold text-cyan-100 uppercase tracking-wider cursor-pointer"
          >
            <MousePointerClick className="w-4 h-4 inline mr-1.5" />
            Dispatch Autonomous UI & Spatial Target Scan
          </button>
        </div>

        <div className="col-span-7 hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/60 p-4 backdrop-blur-sm flex flex-col justify-between relative overflow-hidden">
          {/* Iron Man MK-85 Perimeter Helmet HUD Reticle Graphics */}
          <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
            <span>VISOR TELEMETRY // MK-LXXXV EXOCORTEX</span>
            <span className="text-amber-300">TARGET ACQUISITION: ACTIVE</span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="w-56 h-56 rounded-full border border-dashed border-cyan-400/50 flex items-center justify-center relative">
              <div className="w-36 h-36 rounded-full border border-amber-400/60 flex items-center justify-center">
                <Radar className="w-10 h-10 text-cyan-300 animate-spin" />
              </div>
              <div className="absolute -top-3 bg-[#030b17] px-2 text-[10px] font-mono text-cyan-300 border border-cyan-500/40 rounded">
                ARGON OPTICAL STREAM
              </div>
              <div className="absolute -bottom-3 bg-[#030b17] px-2 text-[10px] font-mono text-amber-300 border border-amber-500/40 rounded">
                CLAUDE CURSOR VECTOR
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
            <div className="p-2 rounded bg-black/60 border border-cyan-500/30">
              <div className="text-slate-400">SPATIAL BOUNDING</div>
              <div className="text-cyan-300 font-bold text-xs mt-0.5">21 HAND LANDMARKS</div>
            </div>
            <div className="p-2 rounded bg-black/60 border border-amber-500/30">
              <div className="text-slate-400">MCP TOOL BUS</div>
              <div className="text-amber-300 font-bold text-xs mt-0.5">16 ACTIVE SERVERS</div>
            </div>
            <div className="p-2 rounded bg-black/60 border border-emerald-500/30">
              <div className="text-slate-400">VOICE DUPLEX</div>
              <div className="text-emerald-300 font-bold text-xs mt-0.5">FULL BARGE-IN READY</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 4: GLOBAL WAR ROOM (Grok Live X Firehose + Multi-Model Adversarial Arena)
  // ============================================================================
  return (
    <div className="grid grid-cols-12 gap-3 h-full pointer-events-auto">
      {/* Left: Grok Live X Firehose & Global Recon Pins */}
      <div className="col-span-5 hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-rose-400 uppercase font-['Orbitron']">
              <Globe className="w-4 h-4 text-rose-400" />
              <span>Grok Live Firehose & Global Recon</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/40">
              REALTIME PULSE
            </span>
          </div>

          <div className="space-y-2.5 mt-2">
            {liveReconFeed.map((item) => (
              <div
                key={item.id}
                style={{ borderLeftColor: item.color }}
                className="p-2.5 rounded bg-[#061529]/90 border border-cyan-500/20 border-l-4"
              >
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span style={{ color: item.color }} className="font-bold">
                    {item.source}
                  </span>
                  <span className="text-slate-400">{item.tag}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            onSelectSynergyMode('adversarial');
            onRunDirective(
              'Run Adversarial Red-Team War Game: Claude proposes architecture, Grok attacks edge cases, Argon judges'
            );
          }}
          className="mt-3 w-full py-2 rounded bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400 text-xs font-mono font-bold text-rose-100 uppercase tracking-wider cursor-pointer"
        >
          <Swords className="w-4 h-4 inline mr-1.5" />
          Launch Multi-Model Adversarial Debate
        </button>
      </div>

      {/* Right: Adversarial Arena & Cross-Examination Matrix */}
      <div className="col-span-7 hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/85 p-3 backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-300 uppercase font-['Orbitron']">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Adversarial Red-Team Arena // Live Cross-Examination</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300">
              {awakeModelIds.length} PANTHEON CORES ENGAGED
            </span>
          </div>

          {latestResult ? (
            <div className="space-y-2 mt-2">
              {latestResult.modelStreams.map((s, idx) => (
                <div
                  key={s.modelId}
                  className="p-2.5 rounded bg-black/60 border border-cyan-500/30 text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[10px] text-amber-300 mb-1">
                    <span>
                      ROUND {idx + 1} // {s.codeName} ({s.role})
                    </span>
                    <span>CONFIDENCE: {s.confidence}%</span>
                  </div>
                  <p className="text-slate-200">{s.keyInsight}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Click <span className="text-rose-300">Launch Multi-Model Adversarial Debate</span> to pit your awake models against each other on any topic.
            </div>
          )}
        </div>

        <div className="p-2.5 rounded bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-300">
            <ShieldAlert className="w-4 h-4" />
            <span>ARBITER VERDICT: ALL CLAIMS CROSS-VERIFIED ACROSS AWAKE CORES</span>
          </div>
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
      </div>
    </div>
  );
};
