export type ModelId = 'argon' | 'claude' | 'grok' | 'gpt' | string;

export type SpatialMode = 'nexus' | 'forge' | 'overwatch' | 'warroom';

export type SynergyMode = 'fusion' | 'adversarial' | 'sprint' | 'relay';

export interface ModelEndpointConfig {
  providerType: 'gemini' | 'anthropic' | 'xai' | 'openai' | 'openai_compatible' | 'ollama';
  baseUrl?: string;
  apiModelId: string;
}

export interface CapabilityRoleSpec {
  modelId: ModelId;
  proficiency: number; // 0-100
  badgeLabel: string;
  roleInOverlap: string;
  nativeProtocol: string;
  uniqueContribution: string;
}

export interface CapabilityDefinition {
  id: string;
  name: string;
  category: 'apex_unique' | 'overlapping';
  description: string;
  preferredSpatialMode: SpatialMode;
  supportedModels: CapabilityRoleSpec[];
}

export interface ModelPluginManifest {
  id: ModelId;
  codeName: string;
  family: string;
  vendor: string;
  tagline: string;
  color: string;
  accentHex: string;
  glowRgb: string;
  awakeByDefault: boolean;
  contextWindow: string;
  avgLatencyMs: number;
  tokensPerSec: number;
  harmonicFreqHz: number;
  apexSuperpower: string;
  apexProtocol: string;
  mcpTools: string[];
  capabilities: string[];
  endpointConfig?: ModelEndpointConfig;
}

export interface PasskeyProfile {
  id: string;
  name: string;
  phrase: string;
  badgeColor: string;
  description: string;
  wakeModels: ModelId[];
  targetMode: SpatialMode;
  isLockdown?: boolean;
  greetingSpeech: string;
}

export const DEFAULT_PASSKEY_PROFILES: PasskeyProfile[] = [
  {
    id: 'lazarus',
    name: 'Primary · Protocol Lazarus',
    phrase: 'protocol lazarus',
    badgeColor: '#6E8EFB',
    description: 'Unlocks Studio, wakes Argon + Claude core team, and prepares synthesis workspace.',
    wakeModels: ['argon', 'claude'],
    targetMode: 'nexus',
    greetingSpeech:
      'Voiceprint confirmed. Protocol Lazarus accepted. Argon and Claude are awake and ready.',
  },
  {
    id: 'house_party',
    name: 'Full Ensemble · House Party Protocol',
    phrase: 'house party protocol',
    badgeColor: '#D97757',
    description: 'Awakens all four models simultaneously (Argon, Claude, Grok, GPT) in full Fusion mode.',
    wakeModels: ['argon', 'claude', 'grok', 'gpt'],
    targetMode: 'nexus',
    greetingSpeech:
      'House Party Protocol engaged. Argon, Claude, Grok, and GPT are online and synchronized.',
  },
  {
    id: 'stealth_demo',
    name: 'Vision & Pulse · Overwatch Alpha',
    phrase: 'overwatch alpha',
    badgeColor: '#10A37F',
    description: 'Wakes Argon + Grok and opens Live Vision & Spatial Companion.',
    wakeModels: ['argon', 'grok'],
    targetMode: 'overwatch',
    greetingSpeech:
      'Overwatch Alpha verified. Engaging Argon spatial vision and Grok live telemetry.',
  },
  {
    id: 'ghost',
    name: 'Lockdown · Ghost Protocol',
    phrase: 'ghost protocol',
    badgeColor: '#F43F5E',
    description: 'Clears active synthesis buffers and returns all models to zero-token sleep.',
    wakeModels: [],
    targetMode: 'nexus',
    isLockdown: true,
    greetingSpeech:
      'Ghost Protocol initiated. Clearing studio buffers and returning all models to sleep.',
  },
];

export const BUILTIN_MODEL_PLUGINS: ModelPluginManifest[] = [
  {
    id: 'argon',
    codeName: 'Argon',
    family: 'Gemini 4 Argon',
    vendor: 'Google DeepMind',
    tagline: '2M Context Vault, Native Live Video & Spatial Architect',
    color: 'indigo',
    accentHex: '#6E8EFB',
    glowRgb: '110, 142, 251',
    awakeByDefault: true,
    contextWindow: '2M tokens',
    avgLatencyMs: 210,
    tokensPerSec: 168,
    harmonicFreqHz: 432,
    apexSuperpower: 'Full-Duplex Live Video/Audio Stream & Whole-Repo 2M Context Vault',
    apexProtocol: 'Gemini Multimodal Live API + Search Grounding',
    mcpTools: ['spatial_camera_stream', 'whole_repo_memory_vault', 'google_search_grounding', 'diagram_synthesizer'],
    capabilities: [
      'multimodal_live_stream',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
      'image_synthesis',
    ],
    endpointConfig: {
      providerType: 'gemini',
      apiModelId: 'gemini-2.5-flash',
    },
  },
  {
    id: 'claude',
    codeName: 'Claude',
    family: 'Claude Opus / Sonnet',
    vendor: 'Anthropic',
    tagline: 'Code Forgemaster, Autonomous OS Operator & MCP Host',
    color: 'terracotta',
    accentHex: '#D97757',
    glowRgb: '217, 119, 87',
    awakeByDefault: true,
    contextWindow: '500K tokens',
    avgLatencyMs: 255,
    tokensPerSec: 138,
    harmonicFreqHz: 528,
    apexSuperpower: 'Native OS Computer Use (Cursor/Keyboard) & Multi-File AST Refactoring',
    apexProtocol: 'Anthropic Computer Use + Model Context Protocol (MCP)',
    mcpTools: ['desktop_cursor_operator', 'fs_ast_refactor', 'terminal_sandbox', 'mcp_universal_bridge'],
    capabilities: [
      'computer_use_os',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
    ],
    endpointConfig: {
      providerType: 'anthropic',
      apiModelId: 'claude-3-7-sonnet-latest',
    },
  },
  {
    id: 'grok',
    codeName: 'Grok',
    family: 'Grok 4 Realtime',
    vendor: 'xAI',
    tagline: 'Live X Firehose, Breaking Global Pulse & Red-Team Challenger',
    color: 'rose',
    accentHex: '#F43F5E',
    glowRgb: '244, 63, 94',
    awakeByDefault: false,
    contextWindow: '1M tokens',
    avgLatencyMs: 180,
    tokensPerSec: 194,
    harmonicFreqHz: 396,
    apexSuperpower: 'Zero-Latency Global X Social Firehose & Unfiltered Red-Team Stress Testing',
    apexProtocol: 'xAI Live Firehose + Adversarial Critic Engine',
    mcpTools: ['x_firehose_stream', 'sentiment_radar', 'red_team_exploit_scanner', 'aurora_visual_gen'],
    capabilities: [
      'live_x_firehose',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
      'image_synthesis',
    ],
    endpointConfig: {
      providerType: 'xai',
      apiModelId: 'grok-3-latest',
    },
  },
  {
    id: 'gpt',
    codeName: 'GPT',
    family: 'GPT-5 / 4o Realtime',
    vendor: 'OpenAI',
    tagline: 'Sub-Second WebRTC Voice Conductor & Parallel Tool Sprinter',
    color: 'jade',
    accentHex: '#10A37F',
    glowRgb: '16, 163, 127',
    awakeByDefault: false,
    contextWindow: '400K tokens',
    avgLatencyMs: 142,
    tokensPerSec: 218,
    harmonicFreqHz: 639,
    apexSuperpower: 'WebRTC Sub-Second Full-Duplex Voice & Mid-Sentence Function Calling',
    apexProtocol: 'OpenAI WebRTC Realtime API + Parallel Tool Swarm',
    mcpTools: ['webrtc_voice_duplex', 'mid_stream_function_caller', 'gpt_image_forge', 'python_code_interpreter'],
    capabilities: [
      'realtime_webrtc_voice',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
      'image_synthesis',
    ],
    endpointConfig: {
      providerType: 'openai',
      apiModelId: 'gpt-4o',
    },
  },
];

export const CAPABILITY_MATRIX: CapabilityDefinition[] = [
  // 5 OVERLAPPING MULTI-MODEL CAPABILITIES (Default front-and-center)
  {
    id: 'code_architecture',
    name: 'Code Architecture & AST Refactoring',
    category: 'overlapping',
    description: 'Full-stack synthesis, cross-file AST refactoring, and automated verification across awake models.',
    preferredSpatialMode: 'forge',
    supportedModels: [
      {
        modelId: 'claude',
        proficiency: 98,
        badgeLabel: 'AST Forgemaster',
        roleInOverlap: 'Surgical multi-file code synthesis & clean type boundaries',
        nativeProtocol: 'Artifacts + AST Patch',
        uniqueContribution: 'Deterministic MCP rollback & zero-leakage module interfaces',
      },
      {
        modelId: 'argon',
        proficiency: 97,
        badgeLabel: '2M Repo Auditor',
        roleInOverlap: 'Verifies whole-repository imports & long-range dependency impacts',
        nativeProtocol: '2M Context Code Graph',
        uniqueContribution: 'Full-repo cross-file coupling & circular dependency check',
      },
      {
        modelId: 'gpt',
        proficiency: 95,
        badgeLabel: 'Test Sprinter',
        roleInOverlap: 'Generates rapid unit test harnesses & edge-case assertions',
        nativeProtocol: 'Code Interpreter Sandbox',
        uniqueContribution: 'Sub-second parallel test suite & schema validation',
      },
      {
        modelId: 'grok',
        proficiency: 92,
        badgeLabel: 'Chaos Red-Team',
        roleInOverlap: 'Probes race conditions, concurrency bottlenecks & exploit surfaces',
        nativeProtocol: 'Adversarial Fuzzing',
        uniqueContribution: 'Burst-load concurrency & adversarial payload stress-test',
      },
    ],
  },
  {
    id: 'deep_reasoning',
    name: 'Strategic Multi-Step Reasoning',
    category: 'overlapping',
    description: 'First-principles systems design, formal logic proofs, and multi-agent hypothesis synthesis.',
    preferredSpatialMode: 'nexus',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 98,
        badgeLabel: 'Systems Architect',
        roleInOverlap: 'Connects long-horizon architecture across massive context',
        nativeProtocol: 'Gemini Deep Think',
        uniqueContribution: 'Cross-domain synthesis across 2M tokens of prior context',
      },
      {
        modelId: 'claude',
        proficiency: 98,
        badgeLabel: 'Logical Formalist',
        roleInOverlap: 'Structures rigorous step-by-step proofs & invariant bounds',
        nativeProtocol: 'Extended Thinking',
        uniqueContribution: 'Formal epistemic calibration & edge-case boundary proofs',
      },
      {
        modelId: 'grok',
        proficiency: 95,
        badgeLabel: 'Contrarian Critic',
        roleInOverlap: 'Challenges hidden assumptions & optimistic groupthink',
        nativeProtocol: 'Unfiltered Critique',
        uniqueContribution: 'First-principles stress-test of unstated premises',
      },
      {
        modelId: 'gpt',
        proficiency: 95,
        badgeLabel: 'Task Decomposer',
        roleInOverlap: 'Decomposes complex goals into parallel executable sub-graphs',
        nativeProtocol: 'o-Series Planner',
        uniqueContribution: 'Parallel execution DAG & immediate action sequencing',
      },
    ],
  },
  {
    id: 'vision_spatial',
    name: 'Spatial Vision & UI Dissection',
    category: 'overlapping',
    description: 'Live camera object comprehension, UI coordinate extraction, and schematic analysis.',
    preferredSpatialMode: 'overwatch',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 98,
        badgeLabel: 'Spatial Mapper',
        roleInOverlap: 'Continuous 60fps video comprehension & 3D trajectory tracking',
        nativeProtocol: 'Gemini Spatial Vision',
        uniqueContribution: 'Temporal video frame memory & 3D spatial bounding boxes',
      },
      {
        modelId: 'claude',
        proficiency: 96,
        badgeLabel: 'UI Inspector',
        roleInOverlap: 'Pixel-exact desktop/DOM coordinate & interactive element targeting',
        nativeProtocol: 'Computer Use Vision',
        uniqueContribution: 'Direct GUI action coordinates for autonomous cursor clicks',
      },
      {
        modelId: 'gpt',
        proficiency: 94,
        badgeLabel: 'Scene Narrator',
        roleInOverlap: 'High-speed OCR & instant multimodal voice description',
        nativeProtocol: 'Omni Realtime Vision',
        uniqueContribution: 'Sub-200ms visual-to-voice narration & diagram OCR',
      },
      {
        modelId: 'grok',
        proficiency: 91,
        badgeLabel: 'Context Scout',
        roleInOverlap: 'Identifies real-world hardware, cultural signals & live visual context',
        nativeProtocol: 'Grok Vision',
        uniqueContribution: 'Real-time cultural & hardware component identification',
      },
    ],
  },
  {
    id: 'web_recon',
    name: 'Live Global Recon & Fact Grounding',
    category: 'overlapping',
    description: 'Cross-verifying live social discourse, primary technical documentation, and breaking signals.',
    preferredSpatialMode: 'warroom',
    supportedModels: [
      {
        modelId: 'grok',
        proficiency: 99,
        badgeLabel: 'Zero-Hour Scout',
        roleInOverlap: 'Captures breaking developer & market signals on X in real time',
        nativeProtocol: 'X + Web Live Search',
        uniqueContribution: 'Zero-latency global X firehose & sentiment velocity',
      },
      {
        modelId: 'argon',
        proficiency: 98,
        badgeLabel: 'Search Grounder',
        roleInOverlap: 'Cross-checks claims against Google Search & primary documentation',
        nativeProtocol: 'Google Search Grounding',
        uniqueContribution: 'Verified citation grounding against authoritative web index',
      },
      {
        modelId: 'gpt',
        proficiency: 94,
        badgeLabel: 'Brief Compiler',
        roleInOverlap: 'Synthesizes multi-source findings into structured executive briefs',
        nativeProtocol: 'Web Search Tool',
        uniqueContribution: 'Executive decision matrix & structured source synthesis',
      },
      {
        modelId: 'claude',
        proficiency: 93,
        badgeLabel: 'Source Auditor',
        roleInOverlap: 'Audits methodological rigor, bias, and primary source consistency',
        nativeProtocol: 'MCP Fetch & Cite',
        uniqueContribution: 'Contradiction detection across conflicting primary sources',
      },
    ],
  },
  {
    id: 'image_synthesis',
    name: 'Visual Concept & Schematic Generation',
    category: 'overlapping',
    description: 'Parallel generation of UI concepts, architectural diagrams, and high-contrast renders.',
    preferredSpatialMode: 'nexus',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 96,
        badgeLabel: 'Imagen Precision',
        roleInOverlap: 'Crisp typography & technical product renders via Imagen',
        nativeProtocol: 'Imagen 4 Engine',
        uniqueContribution: 'Photorealistic material rendering & embedded UI typography',
      },
      {
        modelId: 'gpt',
        proficiency: 96,
        badgeLabel: 'Scene Composer',
        roleInOverlap: 'Complex multi-object spatial instruction adherence',
        nativeProtocol: 'GPT-Image Engine',
        uniqueContribution: 'Exact spatial layout & multi-element prompt fidelity',
      },
      {
        modelId: 'grok',
        proficiency: 93,
        badgeLabel: 'Aurora Cinema',
        roleInOverlap: 'High-contrast atmospheric lighting & conceptual art',
        nativeProtocol: 'Aurora Diffusion',
        uniqueContribution: 'Bold cinematic lighting & unfiltered concept exploration',
      },
    ],
  },

  // 4 UNIQUE APEX SUPERPOWERS (1:1 Native Protocol Exclusives)
  {
    id: 'multimodal_live_stream',
    name: '2M Context Vault & Live Video Stream',
    category: 'apex_unique',
    description: 'Continuous camera/screen video stream ingestion paired with a 2-million-token repository memory vault.',
    preferredSpatialMode: 'overwatch',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 99,
        badgeLabel: 'Sole Apex Core',
        roleInOverlap: 'Continuous spatial video & 2M whole-workspace recall',
        nativeProtocol: 'Gemini Live Multimodal Stream',
        uniqueContribution: 'Native full-duplex audio/video + 2M token context window',
      },
    ],
  },
  {
    id: 'computer_use_os',
    name: 'Autonomous OS Computer Use & MCP Host',
    category: 'apex_unique',
    description: 'Direct desktop cursor/keyboard control, local filesystem AST patching, and MCP server orchestration.',
    preferredSpatialMode: 'overwatch',
    supportedModels: [
      {
        modelId: 'claude',
        proficiency: 99,
        badgeLabel: 'Sole Apex Core',
        roleInOverlap: 'Direct GUI cursor vectors & local MCP tool execution',
        nativeProtocol: 'Anthropic Computer Use + MCP',
        uniqueContribution: 'Native desktop GUI manipulation & universal MCP bridge',
      },
    ],
  },
  {
    id: 'live_x_firehose',
    name: 'Live X Firehose & Adversarial Pulse',
    category: 'apex_unique',
    description: 'Direct zero-latency access to global X real-time social streams and unfiltered red-team stress testing.',
    preferredSpatialMode: 'warroom',
    supportedModels: [
      {
        modelId: 'grok',
        proficiency: 99,
        badgeLabel: 'Sole Apex Core',
        roleInOverlap: 'Zero-latency X firehose & contrarian red-team critique',
        nativeProtocol: 'xAI Firehose Stream',
        uniqueContribution: 'Exclusive real-time X firehose & unfiltered red-teaming',
      },
    ],
  },
  {
    id: 'realtime_webrtc_voice',
    name: 'WebRTC Sub-Second Voice & Tool Swarm',
    category: 'apex_unique',
    description: 'Ultra-low-latency conversational voice turn-taking with mid-sentence parallel function calls.',
    preferredSpatialMode: 'nexus',
    supportedModels: [
      {
        modelId: 'gpt',
        proficiency: 99,
        badgeLabel: 'Sole Apex Core',
        roleInOverlap: 'Sub-150ms acoustic turn-taking & parallel function dispatch',
        nativeProtocol: 'OpenAI Realtime WebRTC',
        uniqueContribution: 'Sub-second WebRTC voice interruption & mid-stream tool calls',
      },
    ],
  },
];

export interface AttributionPill {
  id: string;
  type: 'consensus' | 'unique_nuance';
  label: string;
  models: ModelId[];
  accentHex: string;
  detail: string;
}

export interface DebateExchange {
  round: number;
  phase: 'THESIS' | 'RED_TEAM_CRITIQUE' | 'HARDENED_VERDICT';
  speakerId: ModelId;
  speakerName: string;
  accentHex: string;
  statement: string;
  impactBadge: string;
}

export interface SprintTelemetryEntry {
  rank: number;
  modelId: ModelId;
  codeName: string;
  accentHex: string;
  ttftMs: number;
  totalLatencyMs: number;
  tokensPerSec: number;
  deltaFromWinnerMs: number;
  status: 'SPECULATIVE_WINNER' | 'ASYNC_VERIFIER';
}

export interface RelayStageArtifact {
  stage: number;
  modelId: ModelId;
  codeName: string;
  accentHex: string;
  stageTitle: string;
  inputBaton: string;
  outputArtifact: string;
  latencyMs: number;
}

export interface AgentActionExecution {
  id: string;
  tool: string;
  title: string;
  status: 'success' | 'error' | 'blocked';
  output: string;
  durationMs: number;
  stepLabel?: string;
}

export interface LivingMemoryItem {
  id: string;
  content: string;
  category: 'goal' | 'task' | 'preference' | 'project' | 'insight';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ACTIVE';
  emotionalTone: string;
  sourceAgent: string;
  createdAt: string;
  tags: string[];
}

export interface AutonomousRoutine {
  id: string;
  title: string;
  description: string;
  schedule: string;
  leadAgent: ModelId;
  steps: {
    tool: string;
    args?: Record<string, unknown>;
    label: string;
  }[];
  lastRunAt: string | null;
}

export interface SynergyExecutionResult {
  id: string;
  timestamp: string;
  prompt: string;
  capabilityId: string;
  capabilityName: string;
  synergyMode: SynergyMode;
  participatingModels: ModelId[];
  consensusScore: number;
  executiveHeadline: string;
  synthesizedOutput: string;
  spokenReply: string;
  executedActions: AgentActionExecution[];
  followUpSuggestions: string[];
  attributionPills: AttributionPill[];
  modelStreams: {
    modelId: ModelId;
    codeName: string;
    role: string;
    badgeLabel: string;
    latencyMs: number;
    ttftMs: number;
    tokensPerSec: number;
    source: 'LIVE_API' | 'LOCAL_OLLAMA' | 'NEURAL_SIMULATOR';
    keyInsight: string;
    uniqueNuance: string;
    confidence: number;
  }[];
  consensusPoints: string[];
  divergentPoints: {
    topic: string;
    positions: string;
    resolution: string;
  }[];
  debateLedger?: DebateExchange[];
  sprintLeaderboard?: SprintTelemetryEntry[];
  relayPipeline?: RelayStageArtifact[];
}

export interface ConversationTurn {
  id: string;
  timestamp: string;
  userText: string;
  inputModality: 'voice' | 'text' | 'routine';
  vocalEmotion?: string;
  pitchHz?: number;
  result: SynergyExecutionResult;
}

