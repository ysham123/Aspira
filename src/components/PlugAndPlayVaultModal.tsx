import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
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
  onSubscriptionsUpdated: (subscriptions: Record<string, SubscriptionStatus>) => void;
  onAddCustomModel: (plugin: ModelPluginManifest) => void;
  passkeyProfiles: PasskeyProfile[];
  passkeyLockEnabled: boolean;
  onTogglePasskeyLock: (enabled: boolean) => void;
  onUpdatePasskeyPhrase: (id: string, newPhrase: string) => void;
  apiKeys: Record<string, string>;
  onSaveApiKeys: (keys: Record<string, string>) => void;
}

type VaultTab = 'subscriptions' | 'models' | 'voice' | 'passkeys';

const OSS_MODEL_PRESETS = [
  {
    codeName: 'Llama-3.2-Local',
    family: 'Ollama · llama3.2:latest',
    superpower: 'Text chat through a local Ollama model.',
    color: '#10B981',
    glowRgb: '16, 185, 129',
    baseUrl: 'http://localhost:11434/v1',
    apiModelId: 'llama3.2:latest',
  },
  {
    codeName: 'DeepSeek-R1-Local',
    family: 'Ollama · deepseek-r1:latest',
    superpower: 'Text chat through a local Ollama model.',
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
  onSubscriptionsUpdated,
  onAddCustomModel,
  passkeyProfiles,
  passkeyLockEnabled,
  onTogglePasskeyLock,
  onUpdatePasskeyPhrase,
  apiKeys,
  onSaveApiKeys,
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
    soundEngine.getLocalTtsEndpoint() || 'http://127.0.0.1:8000/v1/audio/speech'
  );
  const [localTtsModel, setLocalTtsModel] = useState(soundEngine.getLocalTtsModel());
  const [localTtsVoice, setLocalTtsVoice] = useState(soundEngine.getLocalTtsVoice());
  const [ttsSavedBanner, setTtsSavedBanner] = useState(false);
  const [ttsStatus, setTtsStatus] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const refreshSubscriptions = () => {
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((data) => {
        if (data?.subscriptions) {
          setSubscriptions(data.subscriptions);
          onSubscriptionsUpdated(data.subscriptions);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (open) {
      refreshSubscriptions();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => {
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (first || dialog)?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusFrame = window.requestAnimationFrame(focusFirst);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleSubscriptionLogin = async (modelId: string) => {
    setLoginStatusMsg(`Opening ${modelId.toUpperCase()} CLI sign-in...`);
    try {
      const res = await fetch('/api/subscriptions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (data?.subscriptions) {
        setSubscriptions(data.subscriptions);
        onSubscriptionsUpdated(data.subscriptions);
      }
      setLoginStatusMsg(data?.message || 'Provider CLI sign-in launched.');
    } catch {
      setLoginStatusMsg('Could not launch terminal sign-in.');
    }
  };

  const handleAddPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeName.trim()) return;

    const id = codeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newPlugin: ModelPluginManifest = {
      id,
      codeName: codeName.trim(),
      family: family.trim() || `${codeName.trim()} Custom`,
      vendor: 'Plug-and-Play Registry',
      tagline: superpower.trim() || `OpenAI-compatible endpoint at ${baseUrl}`,
      color: 'emerald',
      accentHex,
      glowRgb: '16, 185, 129',
      awakeByDefault: true,
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
    setCodeName(preset.codeName);
    setFamily(preset.family);
    setSuperpower(preset.superpower);
    setAccentHex(preset.color);
    setBaseUrl(preset.baseUrl);
    setApiModelId(preset.apiModelId);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKeys(localKeys);
    setKeysSavedBanner(true);
    setTimeout(() => setKeysSavedBanner(false), 2600);
  };

  const handleSaveTtsEndpoint = async () => {
    soundEngine.setLocalTtsEndpoint(localTtsUrl.trim());
    soundEngine.setLocalTtsModel(localTtsModel.trim());
    soundEngine.setLocalTtsVoice(localTtsVoice.trim());
    setTtsStatus('Generating a short sample with the local voice model…');
    const ready = await soundEngine.speak('Aspira is ready to work with you.');
    setTtsSavedBanner(ready);
    setTtsStatus(ready ? 'Local voice is ready.' : 'Could not reach the local voice model. Start it with npm run voice:local.');
    setTimeout(() => setTtsSavedBanner(false), 2600);
  };

  const sessionPhrase = passkeyProfiles[0]?.phrase || '';

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connections-dialog-title"
      tabIndex={-1}
    >
      <div className="aspira-vault-dialog w-full max-w-4xl aspira-glass-elevated rounded-3xl overflow-hidden flex flex-col max-h-[88vh] shadow-2xl border border-white/[0.1]">
        {/* TOP HEADER */}
        <div className="aspira-vault-header flex items-center justify-between px-7 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h2 id="connections-dialog-title" className="text-base font-semibold text-white tracking-tight">
                Models & settings
              </h2>
              <p className="text-xs text-slate-400">
                Connect provider CLIs, local models, and optional voice
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
            }}
            aria-label="Close models and settings"
            className="aspira-vault-close flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4-TAB SEGMENTED NAVIGATION */}
        <div className="aspira-vault-tabs-shell border-b border-white/[0.06]">
          <div className="aspira-vault-tabs flex items-center gap-2 overflow-x-auto px-7 pt-4 pb-2" role="group" aria-label="Settings sections">
            {[
            { id: 'subscriptions', label: 'Connections', icon: CheckCircle2 },
            { id: 'models', label: 'Agents & Hot-Plug', icon: Layers },
            { id: 'voice', label: 'Voice', icon: Volume2 },
            { id: 'passkeys', label: 'Passkey lock', icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as VaultTab);
                }}
                aria-label={tab.label}
                aria-pressed={active}
                className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white/[0.1] text-white border border-white/[0.14] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="aspira-vault-tab-label-full">{tab.label}</span>
                <span className="aspira-vault-tab-label-short" aria-hidden="true">
                  {tab.id === 'models' ? 'Agents' : tab.id === 'passkeys' ? 'Passkeys' : tab.label}
                </span>
              </button>
            );
          })}
          </div>
          <p className="aspira-vault-tabs-hint" aria-hidden="true">More sections →</p>
        </div>

        {/* MODAL BODY */}
        <div className="aspira-vault-body p-7 overflow-y-auto custom-scrollbar space-y-6 flex-1 min-h-0">
          {/* TAB 1: PROVIDER CLI CONNECTIONS AND OPTIONAL API ENDPOINTS */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Provider connections</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aspira connects through provider CLIs and reports sign-in only when the CLI exposes it. Plan tier is not checked; a desktop app alone does not connect a model here.
                  </p>
                </div>
                <button
                  onClick={() => {
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

              {/* Supported provider CLI connections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(['claude', 'gpt', 'grok', 'argon'] as const).map((id) => {
                  const sub = subscriptions[id];
                  const model = models.find((m) => m.id === id);
                  const cliAvailable = Boolean(sub?.cliPath);
                  const connectionLabel = !sub
                    ? 'CHECKING'
                    : !cliAvailable
                    ? 'NO CLI BRIDGE'
                    : sub.authStatus === 'signed_in'
                    ? 'SIGNED IN'
                    : sub.authStatus === 'signed_out'
                    ? 'SIGN-IN REQUIRED'
                    : 'CLI AVAILABLE';
                  const connectionColor = connectionLabel === 'SIGNED IN'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                    : connectionLabel === 'SIGN-IN REQUIRED'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                    : 'bg-white/[0.04] text-slate-300 border-white/[0.1]';

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
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${connectionColor}`}
                          >
                            {connectionLabel}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 font-mono bg-black/30 rounded-xl px-3 py-2 border border-white/[0.05]">
                          {sub?.methodLabel || 'Checking for a supported CLI…'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSubscriptionLogin(id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {sub?.cliPath ? 'Open CLI sign-in' : 'Connection help'}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                          Use an API-compatible provider when a CLI connection is unavailable.
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
                  Configured model connections ({models.length})
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
                        <p className="text-xs text-slate-300 leading-relaxed">{m.tagline}</p>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/[0.05] text-slate-300 shrink-0">
                        {m.vendor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Add an OpenAI-compatible endpoint
                    </h4>
                    <p className="text-xs text-slate-400">
                      Presets fill example values. Start the server and install the model before adding it.
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
                    placeholder="Connection note (optional)"
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

          {activeTab === 'voice' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Private voice, on your Mac</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                  Aspira sends speech to a local MLX-Audio server. The Qwen3-TTS voice model is open source and runs on Apple Silicon; weights download on the first sample request.
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1.5 text-xs text-slate-400">
                    <span>Local speech endpoint</span>
                    <input
                      type="url"
                      value={localTtsUrl}
                      onChange={(event) => setLocalTtsUrl(event.target.value)}
                      placeholder="http://127.0.0.1:8000/v1/audio/speech"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-white/25"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs text-slate-400">
                    <span>Voice model</span>
                    <input
                      value={localTtsModel}
                      onChange={(event) => setLocalTtsModel(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-white/25"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs text-slate-400">
                    <span>Speaker preset</span>
                    <input
                      value={localTtsVoice}
                      onChange={(event) => setLocalTtsVoice(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none focus:border-white/25"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-300">Start the local service in Terminal:</p>
                    <code className="mt-1 block text-xs text-indigo-200">npm run voice:local</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTtsEndpoint}
                    className="rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-slate-950 transition hover:bg-slate-200"
                  >
                    {ttsSavedBanner ? 'Sample played' : 'Save and play sample'}
                  </button>
                </div>
                {ttsStatus && <p role="status" className="text-xs text-slate-400">{ttsStatus}</p>}
                <p className="text-[11px] leading-5 text-slate-500">Voice playback stays off unless you start a voice conversation or choose Speak on a reply. Aspira does not fall back to the browser’s synthetic voice.</p>
              </div>
            </div>
          )}

          {/* TAB 3: SPOKEN PASSKEYS */}
          {activeTab === 'passkeys' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div>
                  <p className="text-sm font-medium text-white">Passphrase lock</p>
                  <p className="mt-1 text-xs text-slate-400">Optional convenience gate for this browser session.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={passkeyLockEnabled}
                  aria-label="Enable session passphrase lock"
                  disabled={!sessionPhrase.trim()}
                  onClick={() => onTogglePasskeyLock(!passkeyLockEnabled)}
                  className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${passkeyLockEnabled ? 'bg-indigo-400' : 'bg-white/15'}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${passkeyLockEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <p className="text-xs leading-5 text-slate-500">This passphrase only hides the workspace in the current browser. It is not an account password or device security.</p>
              {passkeyProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-sm font-semibold text-white">{profile.name}</span>
                    <p className="text-xs text-slate-400">{profile.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">Passphrase</span>
                    <input
                      type="password"
                      value={profile.phrase}
                      onChange={(e) => onUpdatePasskeyPhrase(profile.id, e.target.value)}
                      placeholder="Set a phrase"
                      aria-label="Session passphrase"
                      className="bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-400 w-48"
                    />
                  </div>
                </div>
              ))}
              {!sessionPhrase.trim() && <p className="text-xs text-amber-200/80">Set a passphrase above to enable the lock.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
