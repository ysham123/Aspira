import React, { useState } from 'react';
import {
  Check,
  Cpu,
  Fingerprint,
  KeyRound,
  Layers,
  Plus,
  Shield,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { EnrolledVoiceprint } from '../audio/acousticSentinel';
import { soundEngine } from '../audio/soundEngine';
import { ModelPluginManifest, PasskeyProfile } from '../plugins/models/manifest';

interface PlugAndPlayVaultModalProps {
  open: boolean;
  onClose: () => void;
  models: ModelPluginManifest[];
  onAddCustomModel: (plugin: ModelPluginManifest) => void;
  passkeyProfiles: PasskeyProfile[];
  onUpdatePasskeyPhrase: (id: string, newPhrase: string) => void;
  apiKeys: Record<string, string>;
  onSaveApiKeys: (keys: Record<string, string>) => void;
  voiceprint: EnrolledVoiceprint;
  currentPitchHz: number;
  currentCentroidHz: number;
  onEnrollVoiceprint: () => void;
}

type VaultTab = 'models' | 'keys' | 'passkeys' | 'biometrics';

const OSS_MODEL_PRESETS = [
  {
    codeName: 'DeepSeek-R1',
    family: 'DeepSeek R1 671B / Distill',
    superpower: 'Open-Weight Chain-of-Thought & Verifiable Math Proofs',
    color: '#A855F7',
    baseUrl: 'https://api.deepseek.com/v1',
    apiModelId: 'deepseek-reasoner',
  },
  {
    codeName: 'Qwen-Coder',
    family: 'Qwen 2.5 Coder 32B',
    superpower: 'Local Multi-Language Repo Synthesis & Patch Repair',
    color: '#38BDF8',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'qwen2.5-coder:32b',
  },
  {
    codeName: 'Llama-3.3',
    family: 'Llama 3.3 70B Instruct',
    superpower: 'Fast Local Weights Instruction & Tool Execution',
    color: '#F59E0B',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'llama3.3:70b',
  },
  {
    codeName: 'Local-Ollama',
    family: 'Ollama Local Runtime',
    superpower: '100% Offline Private Apple Silicon MLX / GGUF Execution',
    color: '#10B981',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'llama3.2:latest',
  },
];

export const PlugAndPlayVaultModal: React.FC<PlugAndPlayVaultModalProps> = ({
  open,
  onClose,
  models,
  onAddCustomModel,
  passkeyProfiles,
  onUpdatePasskeyPhrase,
  apiKeys,
  onSaveApiKeys,
  voiceprint,
  currentPitchHz,
  currentCentroidHz,
  onEnrollVoiceprint,
}) => {
  const [activeTab, setActiveTab] = useState<VaultTab>('models');
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(apiKeys);
  const [localTtsUrl, setLocalTtsUrl] = useState(soundEngine.localTtsEndpoint);
  const [savedNotice, setSavedNotice] = useState(false);

  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginFamily, setNewPluginFamily] = useState('DeepSeek R1 / Local Ollama');
  const [newPluginBaseUrl, setNewPluginBaseUrl] = useState('http://localhost:11434/v1');
  const [newPluginSuperpower, setNewPluginSuperpower] = useState(
    'Zero-Cloud Local Weights Execution & Verifiable Reasoning'
  );
  const [newPluginColor, setNewPluginColor] = useState('#A855F7');

  if (!open) return null;

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.localTtsEndpoint = localTtsUrl.trim();
    soundEngine.playGlassTick(1.15);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
    onSaveApiKeys(localKeys);
  };

  const injectModelPlugin = (params: {
    codeName: string;
    family: string;
    superpower: string;
    color: string;
    baseUrl?: string;
    apiModelId?: string;
  }) => {
    const id = params.codeName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!id || models.some((m) => m.id === id)) return;

    const plugin: ModelPluginManifest = {
      id,
      codeName: params.codeName.trim(),
      family: params.family,
      vendor: 'Open-Source Plugin',
      tagline: params.superpower,
      color: 'violet',
      accentHex: params.color,
      glowRgb: '168, 85, 247',
      awakeByDefault: true,
      contextWindow: '256K tokens',
      avgLatencyMs: 165,
      tokensPerSec: 175,
      harmonicFreqHz: 480,
      apexSuperpower: params.superpower,
      apexProtocol: params.baseUrl || 'OpenAI-Compatible / Ollama Adapter',
      mcpTools: ['local_weights_runner', 'custom_mcp_extension'],
      capabilities: ['deep_reasoning', 'code_architecture', 'web_recon'],
      endpointConfig: {
        providerType: 'openai_compatible',
        baseUrl: params.baseUrl || 'http://localhost:11434/v1',
        apiModelId: params.apiModelId || id,
      },
    };
    onAddCustomModel(plugin);
  };

  const handleAddPluginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPluginName.trim()) return;
    injectModelPlugin({
      codeName: newPluginName,
      family: newPluginFamily,
      superpower: newPluginSuperpower,
      color: newPluginColor,
      baseUrl: newPluginBaseUrl,
    });
    setNewPluginName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-6">
      <div className="w-full max-w-4xl h-[560px] rounded-2xl bg-[#11131A]/95 border border-white/[0.1] shadow-[0_28px_90px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* TOP RAYCAST / LINEAR COMMAND HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#6E8EFB]" />
            <span className="font-display text-sm font-semibold text-white">
              Aspira Studio Settings
            </span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-xs text-slate-400 capitalize">{activeTab}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-mono-tech text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-slate-300">
              {models.length} Agents Registered · Auto-Sim Active
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.07] text-slate-300 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-PANE BODY: LEFT SIDEBAR NAV + RIGHT WORKSPACE */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Sidebar */}
          <aside className="w-56 border-r border-white/[0.07] p-3 flex flex-col justify-between bg-[#0B0D13]/60">
            <div className="space-y-1">
              {(
                [
                  { id: 'models', label: 'Agents & Hot-Plug', icon: Layers },
                  { id: 'keys', label: 'API Keys & Voice AI', icon: Shield },
                  { id: 'passkeys', label: 'Spoken Passkeys', icon: KeyRound },
                  { id: 'biometrics', label: 'Vocal Biometrics', icon: Fingerprint },
                ] as { id: VaultTab; label: string; icon: any }[]
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      soundEngine.playGlassTick();
                      setActiveTab(tab.id);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      active
                        ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-400 leading-relaxed">
              <div className="font-medium text-slate-200 mb-0.5">Plug & Play Architecture</div>
              Drop in cloud API keys or local Ollama / MLX endpoints anytime. Unconfigured cores run on the built-in Neural Simulator.
            </div>
          </aside>

          {/* Right Workspace Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* TAB 1: AGENTS & HOT-PLUG */}
            {activeTab === 'models' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-sm font-semibold text-white mb-1">
                    Connected Agent Constellation ({models.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Each agent exposes its native protocol and participates automatically in overlapping capabilities when awake.
                  </p>
                </div>

                {/* Active Model Roster */}
                <div className="space-y-2">
                  {models.map((m) => {
                    const hasLiveKey = Boolean(localKeys[m.id]?.trim());
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.025] border border-white/[0.07]"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            style={{ backgroundColor: m.accentHex }}
                            className="w-2.5 h-2.5 rounded-full"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">
                                {m.codeName}
                              </span>
                              <span className="text-[11px] text-slate-400">{m.family}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">{m.apexSuperpower}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-mono-tech text-[10px]">
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                            {m.contextWindow}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border ${
                              hasLiveKey
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                                : 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
                            }`}
                          >
                            {hasLiveKey ? '● Live Cloud API' : '◐ Neural Simulator'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 1-Click Open-Source Model Presets */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-300">
                    One-Click Open-Source & Local Model Presets
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {OSS_MODEL_PRESETS.map((preset) => {
                      const alreadyAdded = models.some(
                        (m) =>
                          m.codeName.toLowerCase() === preset.codeName.toLowerCase()
                      );
                      return (
                        <button
                          key={preset.codeName}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => injectModelPlugin(preset)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            alreadyAdded
                              ? 'bg-white/[0.02] border-white/[0.05] opacity-50 cursor-default'
                              : 'aspira-card-interactive'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              style={{ backgroundColor: preset.color }}
                              className="w-2 h-2 rounded-full shrink-0"
                            />
                            <div className="truncate">
                              <div className="text-xs font-medium text-white">
                                {preset.codeName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {preset.family}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono-tech text-slate-300 px-2 py-0.5 rounded bg-white/[0.06] shrink-0">
                            {alreadyAdded ? 'Added' : '+ Connect'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Model Hot-Plug Form */}
                <form
                  onSubmit={handleAddPluginSubmit}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-3"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                    <Plus className="w-3.5 h-3.5 text-[#6E8EFB]" />
                    <span>Connect Custom OpenAI-Compatible or Local Model</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newPluginName}
                      onChange={(e) => setNewPluginName(e.target.value)}
                      placeholder="Agent Name (e.g. Mistral)"
                      className="px-3 py-1.5 rounded-lg bg-[#090A0F] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/25"
                    />
                    <input
                      type="text"
                      value={newPluginFamily}
                      onChange={(e) => setNewPluginFamily(e.target.value)}
                      placeholder="Model Tag (e.g. mistral-large)"
                      className="px-3 py-1.5 rounded-lg bg-[#090A0F] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/25"
                    />
                    <input
                      type="text"
                      value={newPluginBaseUrl}
                      onChange={(e) => setNewPluginBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="px-3 py-1.5 rounded-lg bg-[#090A0F] border border-white/[0.08] text-xs font-mono-tech text-slate-300 focus:outline-none focus:border-white/25"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPluginSuperpower}
                      onChange={(e) => setNewPluginSuperpower(e.target.value)}
                      placeholder="Specialized capability description..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#090A0F] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/25"
                    />
                    <input
                      type="color"
                      value={newPluginColor}
                      onChange={(e) => setNewPluginColor(e.target.value)}
                      className="w-9 h-8 rounded-lg bg-transparent border border-white/[0.1] cursor-pointer"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold cursor-pointer transition"
                    >
                      Add Agent
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: API KEYS & LOCAL VOICE AI */}
            {activeTab === 'keys' && (
              <form onSubmit={handleSaveKeys} className="space-y-5">
                <div>
                  <h3 className="font-display text-sm font-semibold text-white mb-1">
                    Provider Credentials & Local Neural Voice AI
                  </h3>
                  <p className="text-xs text-slate-400">
                    Keys are stored locally in your browser vault. Leave any key blank to use the instant Neural Simulator.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'argon', name: 'Argon · Google Gemini API Key', placeholder: 'AIzaSy...' },
                    { id: 'claude', name: 'Claude · Anthropic API Key', placeholder: 'sk-ant-...' },
                    { id: 'grok', name: 'Grok · xAI API Key', placeholder: 'xai-...' },
                    { id: 'gpt', name: 'GPT · OpenAI API Key', placeholder: 'sk-proj-...' },
                  ].map((item) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-slate-200 font-medium">{item.name}</label>
                        <span className="font-mono-tech text-[10px] text-slate-400">
                          {localKeys[item.id]?.trim() ? '● Key Set' : '◐ Using Simulator'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={localKeys[item.id] || ''}
                        onChange={(e) =>
                          setLocalKeys((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder={item.placeholder}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#090A0F] border border-white/[0.08] text-xs font-mono-tech text-white focus:outline-none focus:border-white/25"
                      />
                    </div>
                  ))}
                </div>

                {/* Local Neural Voice AI Bridge (Kokoro-82M / mlx-audio / Orpheus) */}
                <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-white">
                      <Volume2 className="w-4 h-4 text-[#6E8EFB]" />
                      <span>Local Neural Voice AI Endpoint (Kokoro-82M / mlx-audio / Orpheus)</span>
                    </div>
                    <span className="font-mono-tech text-[10px] text-emerald-300">
                      Apple Silicon MLX Compatible
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Optional local OpenAI-compatible TTS server URL (e.g., <code className="text-slate-200">http://localhost:8880/v1/audio/speech</code> via <code className="text-slate-200">mlx-audio</code> or <code className="text-slate-200">Kokoro-82M</code>). Falls back automatically to macOS Premium Neural Voices when blank.
                  </p>
                  <input
                    type="text"
                    value={localTtsUrl}
                    onChange={(e) => setLocalTtsUrl(e.target.value)}
                    placeholder="http://localhost:8880/v1/audio/speech (Optional)"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#090A0F] border border-white/[0.08] text-xs font-mono-tech text-white focus:outline-none focus:border-white/25"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  {savedNotice && (
                    <span className="flex items-center gap-1 text-xs text-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold cursor-pointer transition"
                  >
                    Save Credentials
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: SPOKEN PASSKEYS */}
            {activeTab === 'passkeys' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-white mb-1">
                    Multi-Tier Spoken Passkey Protocols
                  </h3>
                  <p className="text-xs text-slate-400">
                    Customize the exact spoken phrase that unlocks each agent combination after you clap twice and say “Wake up, I’m back”.
                  </p>
                </div>

                <div className="space-y-3">
                  {passkeyProfiles.map((prof) => (
                    <div
                      key={prof.id}
                      className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            style={{ backgroundColor: prof.badgeColor }}
                            className="w-2 h-2 rounded-full"
                          />
                          <span className="text-xs font-semibold text-white">{prof.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {prof.wakeModels.length > 0 ? (
                            prof.wakeModels.map((mId) => (
                              <span
                                key={mId}
                                className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 uppercase"
                              >
                                {mId}
                              </span>
                            ))
                          ) : (
                            <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">
                              Sleep All
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={prof.phrase}
                        onChange={(e) => onUpdatePasskeyPhrase(prof.id, e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg bg-[#090A0F] border border-white/[0.08] text-xs font-mono-tech text-white focus:outline-none focus:border-white/25"
                      />
                      <p className="text-[11px] text-slate-400">{prof.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: VOCAL BIOMETRICS */}
            {activeTab === 'biometrics' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-sm font-semibold text-white mb-1">
                    Vocal Tract Harmonic Calibration (F0 + Formant Centroid)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Aspira samples your fundamental vocal pitch (F0) and spectral formant centroid in real time via a 2048-point parabolic FFT.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-1">
                    <div className="text-[11px] text-slate-400">Enrolled Studio Profile</div>
                    <div className="font-mono-tech text-lg font-semibold text-white">
                      {voiceprint.pitchHz} Hz · {voiceprint.centroidHz} Hz
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      Calibrated: {voiceprint.enrolledAt}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-1">
                    <div className="text-[11px] text-slate-400">Live Microphone Harmonics</div>
                    <div className="font-mono-tech text-lg font-semibold text-[#6E8EFB]">
                      {currentPitchHz} Hz · {currentCentroidHz} Hz
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Speak naturally to sample vocal timbre
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onEnrollVoiceprint}
                  className="w-full py-2.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Calibrate Voiceprint from Live Microphone</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
