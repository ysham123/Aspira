export type ModelId = 'argon' | 'claude' | 'grok' | 'gpt' | string;

export type SpatialMode = 'nexus' | 'forge';
export type SynergyMode = 'fusion';

export interface ModelEndpointConfig {
  providerType: 'gemini' | 'anthropic' | 'xai' | 'openai' | 'openai_compatible' | 'ollama';
  baseUrl?: string;
  apiModelId: string;
}

export interface CapabilityRoleSpec {
  modelId: ModelId;
  proficiency: number;
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
  endpointConfig?: ModelEndpointConfig;
}

export interface PasskeyProfile {
  id: string;
  name: string;
  phrase: string;
  badgeColor: string;
  description: string;
}

export const DEFAULT_PASSKEY_PROFILES: PasskeyProfile[] = [
  {
    id: 'workspace',
    name: 'Workspace passphrase',
    phrase: '',
    badgeColor: '#9AA4B2',
    description: 'Optional convenience lock for this browser session.',
  },
];

export const BUILTIN_MODEL_PLUGINS: ModelPluginManifest[] = [
  {
    id: 'argon',
    codeName: 'Gemini',
    family: 'Antigravity CLI',
    vendor: 'Google',
    tagline: 'Google account inference through Antigravity CLI.',
    color: 'indigo',
    accentHex: '#6E8EFB',
    glowRgb: '110, 142, 251',
    awakeByDefault: false,
    endpointConfig: { providerType: 'gemini', apiModelId: 'gemini-2.5-flash' },
  },
  {
    id: 'claude',
    codeName: 'Claude',
    family: 'Anthropic Claude',
    vendor: 'Anthropic',
    tagline: 'Use an Anthropic API key in Aspira, or open Claude in its official app.',
    color: 'terracotta',
    accentHex: '#D97757',
    glowRgb: '217, 119, 87',
    awakeByDefault: false,
    endpointConfig: { providerType: 'anthropic', apiModelId: 'claude-3-7-sonnet-latest' },
  },
  {
    id: 'grok',
    codeName: 'Grok',
    family: 'Grok Build CLI',
    vendor: 'xAI',
    tagline: 'Grok subscription through Grok Build in planning mode.',
    color: 'rose',
    accentHex: '#F43F5E',
    glowRgb: '244, 63, 94',
    awakeByDefault: false,
    endpointConfig: { providerType: 'xai', apiModelId: 'grok-4' },
  },
  {
    id: 'gpt',
    codeName: 'GPT',
    family: 'Codex CLI',
    vendor: 'OpenAI',
    tagline: 'ChatGPT subscription through Codex CLI in read-only mode.',
    color: 'emerald',
    accentHex: '#10A37F',
    glowRgb: '16, 163, 127',
    awakeByDefault: false,
    endpointConfig: { providerType: 'openai', apiModelId: 'gpt-4o' },
  },
];

export const CAPABILITY_MATRIX: CapabilityDefinition[] = [
  {
    id: 'general_conversation',
    name: 'General conversation',
    category: 'overlapping',
    description: 'A selected provider receives your prompt and saved context. Local actions run through Aspira.',
    preferredSpatialMode: 'nexus',
    supportedModels: [],
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
  timingKnown?: boolean;
  memoryItem?: LivingMemoryItem;
  fileRead?: WorkspaceFileRead;
  editProposal?: FileEditProposal;
  stepLabel?: string;
}

export interface FileEditProposal {
  id: string;
  path: string;
  state: 'proposed' | 'applied' | 'discarded' | 'conflict' | 'reverted';
  createdAt: string;
  beforeRevision: string;
  afterRevision: string;
  patch: string;
  addedLines: number;
  removedLines: number;
  previewRedacted: boolean;
  canApply: boolean;
  canUndo: boolean;
  currentMatchesExpected: boolean;
}

export interface WorkspaceFileRead {
  path: string;
  revision: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  totalLines: number;
  hasMore: boolean;
  nextLine: number | null;
  nextColumn: number | null;
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

export interface LocalPlaybook {
  id: string;
  title: string;
  description: string;
  steps: {
    tool: string;
    args?: Record<string, unknown>;
    label: string;
  }[];
  lastRunAt: string | null;
}

export interface SubscriptionStatus {
  modelId: string;
  providerName: string;
  cliPath: string | null;
  desktopAppPath: string | null;
  methodLabel: string;
  loginCommand: string;
  authStatus?: 'signed_in' | 'signed_out' | 'unknown';
}

export interface SynergyExecutionResult {
  completionState?: 'stopped' | 'interrupted';
  id: string;
  timestamp: string;
  prompt: string;
  capabilityId: string;
  capabilityName: string;
  synergyMode: SynergyMode;
  participatingModels: ModelId[];
  consensusScore: number | null;
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
    source: 'PROVIDER_CLI' | 'SUBSCRIPTION_OAUTH' | 'LIVE_API' | 'LOCAL_OLLAMA' | 'UNAVAILABLE'; // Keep the former label readable in saved chats.
    providerBadge?: string;
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


