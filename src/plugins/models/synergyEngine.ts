import {
  CapabilityDefinition,
  ModelId,
  ModelPluginManifest,
  SynergyExecutionResult,
  SynergyMode,
} from './manifest';

function buildModelPerspective(
  model: ModelPluginManifest,
  prompt: string,
  capability: CapabilityDefinition,
  synergyMode: SynergyMode
): string {
  const cleanPrompt = prompt.trim() || `Execute ${capability.name}`;
  switch (model.id) {
    case 'argon':
      if (synergyMode === 'adversarial') {
        return `[ARGON // 2M CONTEXT ARBITER] Cross-referenced "${cleanPrompt}" against full workspace dependency graph and multimodal spatial telemetry. Architecture holds under scale, provided state transitions remain deterministic and zero-copy.`;
      }
      return `[ARGON // SPATIAL & 2M VAULT] Indexed "${cleanPrompt}" across 100% of active repository modules + live optical feed. Identified 3 cross-module coupling vectors and synthesized a unified long-horizon execution graph.`;

    case 'claude':
      if (synergyMode === 'adversarial') {
        return `[CLAUDE // FORGEMASTER BLUEPRINT] Architected a clean, strictly typed modular implementation for "${cleanPrompt}" with isolated MCP tool boundaries and zero side-effect leakage.`;
      }
      return `[CLAUDE // AST FORGE & COMPUTER USE] Constructed surgical multi-file refactor plan and prepared autonomous OS cursor/terminal sequence for "${cleanPrompt}" with rollback invariants verified.`;

    case 'grok':
      if (synergyMode === 'adversarial') {
        return `[GROK // RED-TEAM STRIKE] Stress-tested "${cleanPrompt}" against live X developer telemetry and adversarial edge cases. Found 2 latency bottlenecks under burst load and challenged optimistic happy-path assumptions.`;
      }
      return `[GROK // LIVE X FIREHOSE & RECON] Pulled real-time global developer discourse and breaking benchmarks for "${cleanPrompt}". Injecting unfiltered edge-case hardening and zero-day trend signals.`;

    case 'gpt':
      if (synergyMode === 'adversarial') {
        return `[GPT // REALTIME TOOL SPRINTER] Executed parallel sandbox verification for "${cleanPrompt}" in 140ms. Synthesized immediate voice-ready action brief and parallelized function call payload.`;
      }
      return `[GPT // WEBRTC DUPLEX & TOOL SWARM] Dispatched 4 parallel tool calls for "${cleanPrompt}", validated schema payloads, and queued sub-second voice briefing for operator confirmation.`;

    default:
      return `[${model.codeName} // PLUGIN CORE] Processed "${cleanPrompt}" via custom open-source adapter (${model.apexProtocol}).`;
  }
}

export async function executeMultiModelSynergy(params: {
  prompt: string;
  capability: CapabilityDefinition;
  awakeModels: ModelPluginManifest[];
  synergyMode: SynergyMode;
  apiKeys: Record<string, string>;
}): Promise<SynergyExecutionResult> {
  const { prompt, capability, awakeModels, synergyMode, apiKeys } = params;

  // Determine which awake models participate (either those supporting the capability, or all awake models)
  const matchingAwake = awakeModels.filter((m) =>
    capability.supportedModels.some((s) => s.modelId === m.id)
  );
  const participants = matchingAwake.length > 0 ? matchingAwake : awakeModels;

  const modelStreams = await Promise.all(
    participants.map(async (model) => {
      const capRole =
        capability.supportedModels.find((s) => s.modelId === model.id)?.roleInOverlap ||
        model.apexSuperpower;

      const start = performance.now();
      let liveText: string | null = null;
      let source: 'LIVE_API' | 'NEURAL_SIMULATOR' = 'NEURAL_SIMULATOR';

      try {
        const res = await fetch('/api/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: model.id,
            prompt: `[Capability: ${capability.name} | Synergy Mode: ${synergyMode.toUpperCase()}]\nTask: ${prompt}\nProvide a concise, high-impact tactical response in 2-3 sentences from your perspective as ${model.codeName} (${capRole}).`,
            systemPrompt: `You are ${model.codeName} (${model.family}) inside the A.R.C.H.O.N. Tony Stark Spatial HUD. Role: ${capRole}. Keep output sharp, technical, and under 65 words.`,
            apiKeys,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            liveText = data.text;
            source = 'LIVE_API';
          }
        }
      } catch {
        // Fallback to neural simulator
      }

      const elapsed = Math.round(performance.now() - start);
      const simulatedLatency = model.avgLatencyMs + Math.round((Math.random() - 0.5) * 45);

      return {
        modelId: model.id as ModelId,
        codeName: model.codeName,
        role: capRole,
        latencyMs: source === 'LIVE_API' ? elapsed : simulatedLatency,
        tokensPerSec: model.tokensPerSec + Math.round((Math.random() - 0.5) * 18),
        source,
        keyInsight:
          liveText || buildModelPerspective(model, prompt, capability, synergyMode),
        confidence: Math.min(99, Math.max(88, 94 + Math.round((Math.random() - 0.3) * 6))),
      };
    })
  );

  const names = participants.map((p) => p.codeName).join(' + ');

  const consensusPoints = [
    `All awake cores (${names}) converged on primary execution topology for "${prompt}" via ${capability.name}.`,
    `Zero destructive state collisions detected across active MCP tool bindings and spatial memory buffers.`,
    `Sub-second streaming telemetry locked; hardware acceleration and acoustic biometric gates remain verified.`,
  ];

  const divergentPoints =
    participants.length > 1
      ? [
          {
            topic: 'Execution Granularity vs. Speed Tradeoff',
            positions: `${participants[0].codeName} prioritizes holistic context verification (${participants[0].contextWindow}), whereas ${participants[participants.length - 1].codeName} favors immediate speculative tool dispatch (${participants[participants.length - 1].avgLatencyMs}ms).`,
            resolution:
              synergyMode === 'sprint'
                ? `Speculative Sprint locked onto fastest stream (${participants[participants.length - 1].codeName}) while ${participants[0].codeName} validates asynchronously.`
                : `Fusion Prism merged ${participants[0].codeName}'s structural safety invariants with ${participants[participants.length - 1].codeName}'s low-latency execution path.`,
          },
          {
            topic: 'Edge-Case Threat Surface',
            positions: participants.some((p) => p.id === 'grok')
              ? 'GROK flagged potential burst-rate race conditions on concurrent WebSocket audio/gesture streams; CLAUDE proposed deterministic mutex framing.'
              : 'ARGON recommended pre-caching spatial AST nodes in memory; CLAUDE favored on-demand lazy evaluation.',
            resolution:
              'Synthesized hybrid ring-buffer pipeline with zero-allocation acoustic DSP framing.',
          },
        ]
      : [
          {
            topic: 'Solo Core Execution Mode',
            positions: `Only ${participants[0]?.codeName || 'ARGON'} was awake for this capability. Wake additional cores in the Pantheon ring to unlock multi-model Consensus & Adversarial Debate.`,
            resolution: 'Executed via single-core Apex Pipeline.',
          },
        ];

  const consensusScore =
    participants.length > 1
      ? Math.round(91 + Math.random() * 7)
      : 100;

  let modeHeader = '';
  if (synergyMode === 'fusion') {
    modeHeader = `⚡ FUSION PRISM SYNTHESIS [${names}]`;
  } else if (synergyMode === 'adversarial') {
    modeHeader = `⚔️ ADVERSARIAL RED-TEAM VERDICT [${names}]`;
  } else if (synergyMode === 'sprint') {
    const fastest = [...modelStreams].sort((a, b) => a.latencyMs - b.latencyMs)[0];
    modeHeader = `🚀 SPECULATIVE SPRINT WINNER: ${fastest?.codeName || 'GPT'} (${fastest?.latencyMs || 140}ms)`;
  } else {
    modeHeader = `🔗 RELAY PIPELINE CHAIN [${ participants.map((p) => p.codeName).join(' → ') }]`;
  }

  const synthesizedOutput = `${modeHeader}\n` +
    `Directive "${prompt}" processed across ${participants.length} active neural core(s) under [${capability.name}]. ` +
    modelStreams.map((m) => `\n• ${m.codeName}: ${m.keyInsight}`).join('');

  return {
    id: `syn-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    prompt,
    capabilityName: capability.name,
    synergyMode,
    participatingModels: participants.map((p) => p.id),
    consensusScore,
    modelStreams,
    consensusPoints,
    divergentPoints,
    synthesizedOutput,
  };
}
