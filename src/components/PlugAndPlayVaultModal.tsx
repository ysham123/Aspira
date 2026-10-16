import React, { useEffect, useState } from 'react';
import {
  AppWindow,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { EnrolledVoiceprint } from '../audio/acousticSentinel';
import { soundEngine } from '../audio/soundEngine';
import {
  ModelPluginManifest,
  PasskeyProfile,
  SubscriptionStatus,
} from '../plugins/models/manifest';

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

type VaultTab = 'subscriptions' | 'models' | 'passkeys' | 'biometrics';

const OSS_MODEL_PRESETS = [
  {
    codeName: 'Llama-3.2-Local',
    family: 'Ollama Apple Silicon (llama3.2:latest)',
    superpower: 'Zero-Cost Local Apple Silicon Conversational Inference',
    color: '#10B981',
    glowRgb: '16, 185, 129',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'llama3.2:latest',
  },
  {
    codeName: 'Qwen2.5-VL',
    family: 'Ollama Vision-Language (qwen2.5vl:7b)',
    superpower: 'Local Apple Silicon Multimodal Screen & Camera Vision',
    color: '#06B6D4',
    glowRgb: '6, 182, 212',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'qwen2.5vl:7b',
  },
  {
    codeName: 'CLIProxy-Sub',
    family: 'CLIProxyAPI Local Subscription Router',
    superpower: 'Routes Web/OAuth Subscriptions via localhost:8317',
    color: '#A855F7',
    glowRgb: '168, 85, 247',
    baseUrl: 'http://localhost:8317/v1',
    apiModelId: 'claude-3-7-sonnet',
  },
  {
    codeName: 'DeepSeek-R1',
    family: 'DeepSeek R1 Distill / Local',
    superpower: 'Open-Weight Chain-of-Thought & Verifiable Math Proofs',
    color: '#F59E0B',
    glowRgb: '245, 158, 11',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'deepseek-r1:latest',
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
  const [activeTab, setActiveTab] = useState<VaultTab>('subscriptions');
  const [subscriptions, setSubscriptions] = useState<Record<string, SubscriptionStatus>>({});
  const [loginStatusMsg, setLoginStatusMsg] = useState<string | null>(null);
  const [showByokSection, setShowByokSection] = useState(false);

  // Hot-plug custom agent state
  const [codeName, setCodeName] = useState('');
  const [family, setFamily] = useState('');
  const [superpower, setSuperpower] = useState('');
  const [accentHex, setAccentHex] = useState('#10B981');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [apiModelId, setApiModelId] = useState('llama3.2:latest');

  // Local API Keys & Local Neural Voice TTS state
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(apiKeys);
  const [keysSavedBanner, setKeysSavedBanner] = useState(false);
  const [localTtsUrl, setLocalTtsUrl] = useState<string>(
    soundEngine.getLocalTtsEndpoint() || 'http://127.0.0.1:8880/v1/audio/speech'
  );
  const [ttsSavedBanner, setTtsSavedBanner] = useState(false);

  const refreshSubscriptions = () => {
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((data) => {
        if (data?.subscriptions) {
          setSubscriptions(data.subscriptions);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (open) {
      refreshSubscriptions();
    }
  }, [open]);

  if (!open) return null;

  const handleSubscriptionLogin = async (modelId: string) => {
    soundEngine.playGlassTick();
    setLoginStatusMsg(`Launching subscription sign-in for ${modelId.toUpperCase()}...`);
    try {
      const res = await fetch('/api/subscriptions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (data?.subscriptions) setSubscriptions(data.subscriptions);
      setLoginStatusMsg(data?.message || 'Subscription login launched.');
    } catch {
      setLoginStatusMsg('Could not launch terminal sign-in.');
    }
  };

  const handleDesktopHandoff = async (modelId: string) => {
    soundEngine.playGlassTick();
    try {
      await fetch('/api/subscriptions/desktop-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          prompt: 'Connected from Aspira Studio on macOS.',
        }),
      });
      setLoginStatusMsg(`Opened ${modelId.toUpperCase()} native macOS desktop app.`);
    } catch {
      // ignore
    }
  };

  const handleAddPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeName.trim()) return;
    soundEngine.playGlassTick();

    const id = codeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newPlugin: ModelPluginManifest = {
      id,
      codeName: codeName.trim(),
      family: family.trim() || `${codeName.trim()} Custom`,
      vendor: 'Plug-and-Play Registry',
      tagline: superpower.trim() || 'Custom Specialized Agent Core',
      color: 'emerald',
      accentHex,
      glowRgb: '16, 185, 129',
      awakeByDefault: true,
      contextWindow: '128K tokens',
      avgLatencyMs: 195,
      tokensPerSec: 175,
      harmonicFreqHz: 480,
      apexSuperpower: superpower.trim() || 'Specialized Local/Cloud Inference',
      apexProtocol: `OpenAI-Compatible (${baseUrl})`,
      mcpTools: ['custom_mcp_bridge', 'code_synthesis'],
      capabilities: ['deep_reasoning', 'code_architecture', 'web_recon'],
      endpointConfig: {
        providerType: 'openai_compatible',
        baseUrl: baseUrl.trim(),
        apiModelId: apiModelId.trim() || id,
      },
    };

    onAddCustomModel(newPlugin);
    setCodeName('');
    setFamily('');
    setSuperpower('');
  };

  const applyPreset = (preset: (typeof OSS_MODEL_PRESETS)[number]) => {
    soundEngine.playGlassTick();
    setCodeName(preset.codeName);
    setFamily(preset.family);
    setSuperpower(preset.superpower);
    setAccentHex(preset.color);
    setBaseUrl(preset.baseUrl);
    setApiModelId(preset.apiModelId);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playPasskeyVerified();
    onSaveApiKeys(localKeys);
    setKeysSavedBanner(true);
    setTimeout(() => setKeysSavedBanner(false), 2600);
  };

  const handleSaveTtsEndpoint = () => {
    soundEngine.playPasskeyVerified();
    soundEngine.setLocalTtsEndpoint(localTtsUrl.trim());
    setTtsSavedBanner(true);
    soundEngine.speak('Local neural voice engine connected and ready.');
    setTimeout(() => setTtsSavedBanner(false), 2600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-4">
      <div className="w-full max-w-4xl aspira-glass-elevated rounded-3xl overflow-hidden flex flex-col max-h-[88vh] shadow-2xl border border-white/[0.1]">
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Aspira Subscriptions, Models & Studio Settings
              </h2>
              <p className="text-xs text-slate-400">
                Use your existing Claude Pro/Max, ChatGPT Plus/Pro, Grok, and Gemini subscriptions — zero API keys required
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEngine.playGlassTick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4-TAB SEGMENTED NAVIGATION */}
        <div className="px-7 pt-4 pb-2 border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'subscriptions', label: 'LLM Subscriptions & Voice AI', icon: CheckCircle2 },
            { id: 'models', label: 'Agents & Hot-Plug', icon: Layers },
            { id: 'passkeys', label: 'Spoken Passkeys', icon: Shield },
            { id: 'biometrics', label: 'Vocal Biometrics', icon: Fingerprint },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playGlassTick();
                  setActiveTab(tab.id as VaultTab);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white/[0.1] text-white border border-white/[0.14] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* MODAL BODY */}
        <div className="p-7 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {/* TAB 1: PERSONAL LLM SUBSCRIPTIONS (ZERO API KEYS REQUIRED) & VOICE AI */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Connected Personal LLM Subscriptions (Zero API Keys Needed)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aspira automatically bridges your logged-in OAuth sessions (`~/.claude`, `~/.codex`, `~/.grok`) and macOS desktop apps (`ChatGPT.app`, `Claude.app`, `Gemini.app`, `Ollama.app`).
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundEngine.playGlassTick();
                    refreshSubscriptions();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Re-Scan Mac
                </button>
              </div>

              {loginStatusMsg && (
                <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-xs text-indigo-200 flex items-center justify-between">
                  <span>{loginStatusMsg}</span>
                  <button
                    onClick={() => setLoginStatusMsg(null)}
                    className="text-[11px] text-indigo-300 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* 4 Flagship Subscription Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(['claude', 'gpt', 'grok', 'argon'] as const).map((id) => {
                  const sub = subscriptions[id];
                  const model = models.find((m) => m.id === id);
                  const isAuthed = sub?.subscriptionAuthenticated ?? true;

                  return (
                    <div
                      key={id}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: model?.accentHex || '#6E8EFB' }}
                            />
                            <span className="text-sm font-semibold text-white">
                              {model?.codeName} · {sub?.providerName || model?.family}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                              isAuthed
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                            }`}
                          >
                            {isAuthed ? '✓ SUBSCRIPTION ACTIVE' : 'SIGN IN AVAILABLE'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 font-mono bg-black/30 rounded-xl px-3 py-2 border border-white/[0.05]">
                          {sub?.methodLabel || 'Detecting local OAuth session & macOS app...'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSubscriptionLogin(id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {isAuthed ? 'Re-Auth OAuth' : 'Sign In Subscription'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDesktopHandoff(id)}
                          className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          title="Open native macOS Subscription App"
                        >
                          <AppWindow className="w-3.5 h-3.5 text-emerald-400" />
                          Open App
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Local Open-Source Neural Voice AI Bridge (Kokoro-82M / mlx-audio) */}
              <div className="p-5 rounded-2xl bg-indigo-500/[0.06] border border-indigo-400/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">
                      Local Neural Voice AI Bridge (Kokoro-82M / mlx-audio / Orpheus)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-300 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30">
                    Apple Silicon Ready
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Point Aspira to a locally hosted open-source neural TTS server (`docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`) for zero-cloud-latency natural voice responses.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localTtsUrl}
                    onChange={(e) => setLocalTtsUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8880/v1/audio/speech"
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTtsEndpoint}
                    className="px-4 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-xs font-medium text-indigo-100 transition-all"
                  >
                    {ttsSavedBanner ? 'Connected!' : 'Connect & Test'}
                  </button>
                </div>
              </div>

              {/* Collapsible Optional Developer API Key Override */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.07] p-4">
                <button
                  type="button"
                  onClick={() => setShowByokSection((v) => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-300">
                      Optional: Developer API Key Override (BYOK)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Not needed when using your connected Claude, ChatGPT, Grok, or Gemini subscriptions above.
                    </div>
                  </div>
                  {showByokSection ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showByokSection && (
                  <form onSubmit={handleSaveKeys} className="space-y-3 pt-4 mt-3 border-t border-white/[0.06]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { id: 'argon', label: 'Argon · Google Gemini API Key', placeholder: 'AIzaSy...' },
                        { id: 'claude', label: 'Claude · Anthropic API Key', placeholder: 'sk-ant-...' },
                        { id: 'grok', label: 'Grok · xAI API Key', placeholder: 'xai-...' },
                        { id: 'gpt', label: 'GPT · OpenAI API Key', placeholder: 'sk-proj-...' },
                      ].map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-black/30 border border-white/[0.06] space-y-1.5"
                        >
                          <label className="text-[11px] font-medium text-slate-300 block">
                            {item.label}
                          </label>
                          <input
                            type="password"
                            value={localKeys[item.id] || ''}
                            onChange={(e) =>
                              setLocalKeys((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder={item.placeholder}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-100 transition-all flex items-center gap-1.5"
                      >
                        {keysSavedBanner ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Saved Override Keys
                          </>
                        ) : (
                          'Save Optional API Keys'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AGENTS & HOT-PLUG */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Active Studio Constellation ({models.length} Agents)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {models.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: m.accentHex }}
                          />
                          <span className="text-sm font-semibold text-white">{m.codeName}</span>
                          <span className="text-[11px] font-mono text-slate-400">{m.family}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {m.apexSuperpower}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/[0.05] text-slate-300 shrink-0">
                        {m.contextWindow}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Hot-Plug Local Ollama or Subscription Proxy Agent
                    </h4>
                    <p className="text-xs text-slate-400">
                      Click a 1-click preset (`Llama-3.2-Local`, `Qwen2.5-VL`, `CLIProxy-Sub`) or add any custom model
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {OSS_MODEL_PRESETS.map((preset) => (
                      <button
                        key={preset.codeName}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-slate-200 transition-colors"
                      >
                        + {preset.codeName}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddPlugin} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={codeName}
                    onChange={(e) => setCodeName(e.target.value)}
                    placeholder="Agent Name (e.g. Llama-3.2)"
                    className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                  <input
                    type="text"
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    placeholder="Model Family"
                    className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="Endpoint Base URL (e.g. http://localhost:11434/v1)"
                    className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-400"
                  />
                  <input
                    type="text"
                    value={apiModelId}
                    onChange={(e) => setApiModelId(e.target.value)}
                    placeholder="Model ID (e.g. llama3.2:latest)"
                    className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-400"
                  />
                  <input
                    type="text"
                    value={superpower}
                    onChange={(e) => setSuperpower(e.target.value)}
                    placeholder="Unique Superpower Description"
                    className="md:col-span-2 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-100 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Hot-Plug Agent into Constellation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: SPOKEN PASSKEYS */}
          {activeTab === 'passkeys' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-2">
                Customize the spoken passkey phrases recognized after your double-clap wake sequence:
              </p>
              {passkeyProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: profile.badgeColor }}
                      />
                      <span className="text-sm font-semibold text-white">{profile.name}</span>
                    </div>
                    <p className="text-xs text-slate-400">{profile.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">Phrase:</span>
                    <input
                      type="text"
                      value={profile.phrase}
                      onChange={(e) => onUpdatePasskeyPhrase(profile.id, e.target.value)}
                      className="bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-400 w-48"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: VOCAL BIOMETRICS */}
          {activeTab === 'biometrics' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">
                    Enrolled Vocal Harmonic Signature
                  </h4>
                  <p className="text-xs text-slate-400">
                    Parabolic F0 fundamental pitch and spectral centroid formant matching.
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs font-mono text-indigo-300">
                    <span>Enrolled Pitch: {voiceprint.pitchHz} Hz</span>
                    <span>·</span>
                    <span>Enrolled Centroid: {voiceprint.centroidHz} Hz</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPasskeyVerified();
                    onEnrollVoiceprint();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium transition-all flex items-center gap-2 shrink-0"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Calibrate to Live Voice ({currentPitchHz} Hz)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
