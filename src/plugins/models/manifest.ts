export type ModelId = 'argon' | 'claude' | 'grok' | 'gpt' | string;

export type SpatialMode = 'nexus' | 'forge' | 'overwatch' | 'warroom';

export type SynergyMode = 'fusion' | 'adversarial' | 'sprint' | 'relay';

export interface CapabilityDefinition {
  id: string;
  name: string;
  category: 'apex_unique' | 'overlapping';
  description: string;
  preferredSpatialMode: SpatialMode;
  supportedModels: {
    modelId: ModelId;
    proficiency: number; // 0-100
    roleInOverlap: string;
    nativeProtocol: string;
  }[];
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
    name: 'PRIMARY // PROTOCOL LAZARUS',
    phrase: 'protocol lazarus',
    badgeColor: '#00f0ff',
    description: 'Unlocks full Exocortex, wakes ARGON + CLAUDE core team, and delivers Away-Mission Briefing.',
    wakeModels: ['argon', 'claude'],
    targetMode: 'nexus',
    greetingSpeech:
      'Voiceprint confirmed. Protocol Lazarus accepted. Waking Argon and Claude cores. All spatial subsystems nominal.',
  },
  {
    id: 'house_party',
    name: 'FULL PANTHEON // HOUSE PARTY PROTOCOL',
    phrase: 'house party protocol',
    badgeColor: '#ffaa00',
    description: 'Ignites all 4 orbital cores simultaneously (ARGON, CLAUDE, GROK, GPT) in maximum Fusion Synergy.',
    wakeModels: ['argon', 'claude', 'grok', 'gpt'],
    targetMode: 'nexus',
    greetingSpeech:
      'House Party Protocol engaged. Igniting all four Pantheon cores: Argon, Claude, Grok, and GPT are online and synchronized.',
  },
  {
    id: 'stealth_demo',
    name: 'RECON // OVERWATCH ALPHA',
    phrase: 'overwatch alpha',
    badgeColor: '#10b981',
    description: 'Wakes ARGON + GROK and boots directly into Tactical Overwatch & Live Recon Visor.',
    wakeModels: ['argon', 'grok'],
    targetMode: 'overwatch',
    greetingSpeech:
      'Overwatch Alpha verified. Engaging Argon live optical stream and Grok real-time telemetry visor.',
  },
  {
    id: 'ghost',
    name: 'EMERGENCY // GHOST PROTOCOL',
    phrase: 'ghost protocol',
    badgeColor: '#ff2a5f',
    description: 'Purges active hologram buffers, seals API vaults, and returns all models to zero-token Cryo-Sleep.',
    wakeModels: [],
    targetMode: 'nexus',
    isLockdown: true,
    greetingSpeech:
      'Ghost Protocol initiated. Purging holographic memory buffers and returning all cores to cryo-sleep.',
  },
];

export const BUILTIN_MODEL_PLUGINS: ModelPluginManifest[] = [
  {
    id: 'argon',
    codeName: 'ARGON',
    family: 'Gemini 4 Argon (High)',
    vendor: 'Google DeepMind',
    tagline: 'Omniscient Sensor, 1M+ Context Vault & Spatial Architect',
    color: 'cyan',
    accentHex: '#00f0ff',
    glowRgb: '0, 240, 255',
    awakeByDefault: true,
    contextWindow: '2,000,000 tok',
    avgLatencyMs: 210,
    tokensPerSec: 168,
    harmonicFreqHz: 432,
    apexSuperpower: 'Full-Duplex Live Video/Audio Stream & Whole-Repo 2M Context Vault',
    apexProtocol: 'Gemini Multimodal Live API + Spatial Grounding',
    mcpTools: ['spatial_camera_stream', 'whole_repo_memory_vault', 'google_search_grounding', 'diagram_synthesizer'],
    capabilities: [
      'multimodal_live_stream',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
      'image_synthesis',
      'voice_dialogue',
    ],
  },
  {
    id: 'claude',
    codeName: 'CLAUDE',
    family: 'Claude Opus / Sonnet',
    vendor: 'Anthropic',
    tagline: 'Master Forgemaster, Autonomous OS Operator & MCP Host',
    color: 'amber',
    accentHex: '#ff9e00',
    glowRgb: '255, 158, 0',
    awakeByDefault: true,
    contextWindow: '500,000 tok',
    avgLatencyMs: 260,
    tokensPerSec: 135,
    harmonicFreqHz: 528,
    apexSuperpower: 'Native OS Computer Use (Cursor/Keyboard Control) & Multi-File AST Refactoring',
    apexProtocol: 'Anthropic Computer Use + Model Context Protocol (MCP)',
    mcpTools: ['desktop_cursor_operator', 'fs_ast_refactor', 'terminal_sandbox', 'mcp_universal_bridge'],
    capabilities: [
      'computer_use_os',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
    ],
  },
  {
    id: 'grok',
    codeName: 'GROK',
    family: 'Grok 4 Realtime',
    vendor: 'xAI',
    tagline: 'Live X Firehose, Breaking Global Pulse & Adversarial Red-Teamer',
    color: 'crimson',
    accentHex: '#ff2a6d',
    glowRgb: '255, 42, 109',
    awakeByDefault: false,
    contextWindow: '1,000,000 tok',
    avgLatencyMs: 185,
    tokensPerSec: 192,
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
  },
  {
    id: 'gpt',
    codeName: 'GPT',
    family: 'GPT-5 / 4o Realtime',
    vendor: 'OpenAI',
    tagline: 'Sub-Second WebRTC Voice Conductor & Parallel Tool Sprinter',
    color: 'emerald',
    accentHex: '#00ff9d',
    glowRgb: '0, 255, 157',
    awakeByDefault: false,
    contextWindow: '400,000 tok',
    avgLatencyMs: 145,
    tokensPerSec: 215,
    harmonicFreqHz: 639,
    apexSuperpower: 'WebRTC Sub-Second Full-Duplex Voice Interruption & Mid-Sentence Function Calling',
    apexProtocol: 'OpenAI WebRTC Realtime API + Parallel Tool Swarm',
    mcpTools: ['webrtc_voice_duplex', 'mid_stream_function_caller', 'gpt_image_forge', 'python_code_interpreter'],
    capabilities: [
      'realtime_webrtc_voice',
      'deep_reasoning',
      'code_architecture',
      'vision_spatial',
      'web_recon',
      'image_synthesis',
      'voice_dialogue',
    ],
  },
];

export const CAPABILITY_MATRIX: CapabilityDefinition[] = [
  // 4 UNIQUE APEX SUPERPOWERS
  {
    id: 'multimodal_live_stream',
    name: '2M Vault & Live Video Stream',
    category: 'apex_unique',
    description: 'Continuous webcam/screen video frame ingestion + 2-million-token whole-codebase memory.',
    preferredSpatialMode: 'overwatch',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 99,
        roleInOverlap: 'Sole Apex Operator — continuous spatial video & massive context recall',
        nativeProtocol: 'Gemini Live Multimodal Stream',
      },
    ],
  },
  {
    id: 'computer_use_os',
    name: 'OS Computer Use & MCP Control',
    category: 'apex_unique',
    description: 'Autonomous desktop mouse/keyboard manipulation, terminal execution, and local MCP tool orchestration.',
    preferredSpatialMode: 'overwatch',
    supportedModels: [
      {
        modelId: 'claude',
        proficiency: 99,
        roleInOverlap: 'Sole Apex Operator — direct GUI cursor vectors & MCP system execution',
        nativeProtocol: 'Anthropic Computer Use + MCP',
      },
    ],
  },
  {
    id: 'live_x_firehose',
    name: 'Live X Firehose & Red-Team Recon',
    category: 'apex_unique',
    description: 'Real-time global X discourse stream, breaking market/tech signals, and unfiltered contrarian critique.',
    preferredSpatialMode: 'warroom',
    supportedModels: [
      {
        modelId: 'grok',
        proficiency: 99,
        roleInOverlap: 'Sole Apex Operator — zero-latency social pulse & adversarial stress-test',
        nativeProtocol: 'xAI Firehose Stream',
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
        proficiency: 98,
        roleInOverlap: 'Sole Apex Operator — sub-150ms acoustic turn-taking & tool dispatch',
        nativeProtocol: 'OpenAI Realtime WebRTC',
      },
    ],
  },

  // 5 OVERLAPPING MULTI-MODEL CAPABILITIES
  {
    id: 'code_architecture',
    name: '3D Code Synthesis & AST Refactoring',
    category: 'overlapping',
    description: 'Full-stack code generation, dependency graph dissection, and automated bug hunting across models.',
    preferredSpatialMode: 'forge',
    supportedModels: [
      {
        modelId: 'claude',
        proficiency: 98,
        roleInOverlap: 'Lead Forgemaster — surgical multi-file code synthesis & clean abstractions',
        nativeProtocol: 'Artifacts + AST Patch',
      },
      {
        modelId: 'argon',
        proficiency: 96,
        roleInOverlap: 'Whole-Repo Auditor — verifies cross-repository imports & long-range side effects',
        nativeProtocol: '2M Context Code Graph',
      },
      {
        modelId: 'gpt',
        proficiency: 94,
        roleInOverlap: 'Rapid Test Runner — generates unit test harnesses & edge-case assertions',
        nativeProtocol: 'Code Interpreter Sandbox',
      },
      {
        modelId: 'grok',
        proficiency: 91,
        roleInOverlap: 'Chaos Red-Teamer — attempts injection, race conditions & performance bottlenecks',
        nativeProtocol: 'Adversarial Fuzzing',
      },
    ],
  },
  {
    id: 'deep_reasoning',
    name: 'Strategic Multi-Step Reasoning',
    category: 'overlapping',
    description: 'First-principles architectural planning, mathematical proofs, and multi-agent hypothesis verification.',
    preferredSpatialMode: 'nexus',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 98,
        roleInOverlap: 'Systems Synthesizer — connects high-level architecture across massive context',
        nativeProtocol: 'Deep Think Chain',
      },
      {
        modelId: 'claude',
        proficiency: 97,
        roleInOverlap: 'Logical Formalist — structures rigorous step-by-step proofs & safety bounds',
        nativeProtocol: 'Extended Thinking',
      },
      {
        modelId: 'grok',
        proficiency: 95,
        roleInOverlap: 'Contrarian Challenger — attacks hidden assumptions & groupthink',
        nativeProtocol: 'Unfiltered Critique',
      },
      {
        modelId: 'gpt',
        proficiency: 95,
        roleInOverlap: 'Executive Orchestrator — decomposes goals into parallel actionable sub-tasks',
        nativeProtocol: 'o-Series Reasoning',
      },
    ],
  },
  {
    id: 'vision_spatial',
    name: 'Spatial Vision & UI Dissection',
    category: 'overlapping',
    description: 'Webcam object recognition, schematic/blueprint parsing, and live screen bounding-box telemetry.',
    preferredSpatialMode: 'overwatch',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 98,
        roleInOverlap: '3D Spatial Mapper — real-time bounding boxes, trajectory tracking & temporal video',
        nativeProtocol: 'Gemini Spatial Vision',
      },
      {
        modelId: 'claude',
        proficiency: 95,
        roleInOverlap: 'UI Coordinate Inspector — pixel-exact DOM/desktop button & layout extraction',
        nativeProtocol: 'Computer Use Vision',
      },
      {
        modelId: 'gpt',
        proficiency: 94,
        roleInOverlap: 'Visual Narrator — instant OCR & high-speed scene summarization',
        nativeProtocol: 'Omni Vision',
      },
      {
        modelId: 'grok',
        proficiency: 90,
        roleInOverlap: 'Forensic Meme/Context Detector — identifies cultural & real-world visual references',
        nativeProtocol: 'Grok Vision',
      },
    ],
  },
  {
    id: 'web_recon',
    name: 'Live Global Recon & Fact Verification',
    category: 'overlapping',
    description: 'Cross-referencing live social signals, technical docs, academic papers, and breaking news.',
    preferredSpatialMode: 'warroom',
    supportedModels: [
      {
        modelId: 'grok',
        proficiency: 98,
        roleInOverlap: 'Zero-Hour Scout — catches breaking signals on X minutes before search indexers',
        nativeProtocol: 'X + Web Live Search',
      },
      {
        modelId: 'argon',
        proficiency: 97,
        roleInOverlap: 'Deep Grounding Verifier — cross-checks claims against Google Search & primary docs',
        nativeProtocol: 'Google Search Grounding',
      },
      {
        modelId: 'gpt',
        proficiency: 93,
        roleInOverlap: 'Structured Brief Compiler — synthesizes citations into executive dossiers',
        nativeProtocol: 'Web Search Tool',
      },
      {
        modelId: 'claude',
        proficiency: 92,
        roleInOverlap: 'Nuance & Source Auditor — detects bias, methodological flaws & dead links',
        nativeProtocol: 'MCP Fetch & Cite',
      },
    ],
  },
  {
    id: 'image_synthesis',
    name: 'Holographic Concept & Schematic Generation',
    category: 'overlapping',
    description: 'Generating UI mockups, 3D concept art, SVG schematics, and photorealistic renders in parallel.',
    preferredSpatialMode: 'nexus',
    supportedModels: [
      {
        modelId: 'argon',
        proficiency: 96,
        roleInOverlap: 'Photoreal & Typography Render — crisp technical renders via Imagen',
        nativeProtocol: 'Imagen 4 Engine',
      },
      {
        modelId: 'gpt',
        proficiency: 96,
        roleInOverlap: 'Instruction-Accurate Concept Art — complex multi-object scene composition',
        nativeProtocol: 'GPT-Image Engine',
      },
      {
        modelId: 'grok',
        proficiency: 93,
        roleInOverlap: 'Unfiltered Aesthetic Concepting — bold cinematic lighting via Aurora',
        nativeProtocol: 'Aurora Diffusion',
      },
    ],
  },
];

export interface SynergyExecutionResult {
  id: string;
  timestamp: string;
  prompt: string;
  capabilityName: string;
  synergyMode: SynergyMode;
  participatingModels: ModelId[];
  consensusScore: number;
  modelStreams: {
    modelId: ModelId;
    codeName: string;
    role: string;
    latencyMs: number;
    tokensPerSec: number;
    source: 'LIVE_API' | 'NEURAL_SIMULATOR';
    keyInsight: string;
    confidence: number;
  }[];
  consensusPoints: string[];
  divergentPoints: {
    topic: string;
    positions: string;
    resolution: string;
  }[];
  synthesizedOutput: string;
}
