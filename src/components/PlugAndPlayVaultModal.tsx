import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
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
  Terminal,
  Volume2,
  X,
} from 'lucide-react';
import './PlugAndPlayVaultModal.css';
import {
  ModelPluginManifest,
  PasskeyProfile,
  SubscriptionStatus,
} from '../plugins/models/manifest';

interface PlugAndPlayVaultModalProps {
  open: boolean;
  initialModelId?: string;
  onClose: () => void;
  models: ModelPluginManifest[];
  initialSubscriptions: Record<string, SubscriptionStatus>;
  onSubscriptionsUpdated: (subscriptions: Record<string, SubscriptionStatus>) => void;
  awakeModelIds: string[];
  onUseModel: (modelId: string) => void;
  onAddCustomModel: (plugin: ModelPluginManifest) => void;
  passkeyProfiles: PasskeyProfile[];
  passkeyLockEnabled: boolean;
  onTogglePasskeyLock: (enabled: boolean) => void;
  onUpdatePasskeyPhrase: (id: string, newPhrase: string) => void;
  apiKeys: Record<string, string>;
  onSaveApiKeys: (keys: Record<string, string>) => boolean;
  voiceStatus: string;
  isVoicePlaying: boolean;
  onPreviewVoice: () => void;
}

type VaultTab = 'subscriptions' | 'models' | 'voice' | 'passkeys';
type SubscriptionScanState = 'idle' | 'checking' | 'ready' | 'error';

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
  initialModelId,
  onClose,
  models,
  initialSubscriptions,
  onSubscriptionsUpdated,
  awakeModelIds,
  onUseModel,
  onAddCustomModel,
  passkeyProfiles,
  passkeyLockEnabled,
  onTogglePasskeyLock,
  onUpdatePasskeyPhrase,
  apiKeys,
  onSaveApiKeys,
  voiceStatus,
  isVoicePlaying,
  onPreviewVoice,
}) => {
  const [activeTab, setActiveTab] = useState<VaultTab>('subscriptions');
  const [subscriptions, setSubscriptions] = useState<Record<string, SubscriptionStatus>>({});
  const [subscriptionScanState, setSubscriptionScanState] = useState<SubscriptionScanState>('idle');
  const [hasVerifiedSubscriptionStatus, setHasVerifiedSubscriptionStatus] = useState(false);
  const [loginStatusMsg, setLoginStatusMsg] = useState<string | null>(null);
  const [showByokSection, setShowByokSection] = useState(false);
  const [keysSaveError, setKeysSaveError] = useState('');

  // Hot-plug custom agent state
  const [codeName, setCodeName] = useState('');
  const [family, setFamily] = useState('');
  const [superpower, setSuperpower] = useState('');
  const [accentHex, setAccentHex] = useState('#10B981');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [apiModelId, setApiModelId] = useState('llama3.2:latest');

  // Local API key state
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(apiKeys);
  const [keysSavedBanner, setKeysSavedBanner] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const subscriptionRequestIdRef = useRef(0);

  useEffect(() => {
    if (Object.keys(initialSubscriptions).length === 0) return;
    setSubscriptions(initialSubscriptions);
    setHasVerifiedSubscriptionStatus(true);
  }, [initialSubscriptions]);

  const refreshSubscriptions = async () => {
    const requestId = ++subscriptionRequestIdRef.current;
    setSubscriptionScanState('checking');

    try {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) throw new Error(`Provider status request failed (${response.status}).`);
      const data = await response.json();
      if (!data?.subscriptions || typeof data.subscriptions !== 'object' || Array.isArray(data.subscriptions)) {
        throw new Error('Provider status response was invalid.');
      }
      if (requestId !== subscriptionRequestIdRef.current) return;

      setSubscriptions(data.subscriptions);
      setHasVerifiedSubscriptionStatus(true);
      setSubscriptionScanState('ready');
      onSubscriptionsUpdated(data.subscriptions);
    } catch {
      if (requestId !== subscriptionRequestIdRef.current) return;
      // Keep any earlier result visible, but never present it as a fresh check.
      setSubscriptionScanState('error');
    }
  };

  useEffect(() => {
    if (open) {
      refreshSubscriptions();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialModelId) return;
    setActiveTab('subscriptions');
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`aspira-provider-${initialModelId}`)?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialModelId]);

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
        setHasVerifiedSubscriptionStatus(true);
        setSubscriptionScanState('ready');
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
    const saved = onSaveApiKeys(localKeys);
    setKeysSavedBanner(saved);
    setKeysSaveError(saved ? '' : 'Keys are active for this session, but browser storage could not save them.');
  };

  const sessionPhrase = passkeyProfiles[0]?.phrase || '';
  const providerIds = ['claude', 'gpt', 'grok', 'argon'] as const;
  const signedInProviderCount = providerIds.filter((id) =>
    Boolean(subscriptions[id]?.cliPath) && subscriptions[id]?.authStatus === 'signed_in'
  ).length;
  const savedApiKeyCount = providerIds.filter((id) => Boolean(apiKeys[id])).length;
  const configuredProviderCount = providerIds.filter((id) =>
    Boolean(apiKeys[id]) || (Boolean(subscriptions[id]?.cliPath) && subscriptions[id]?.authStatus === 'signed_in')
  ).length;
  const connectionSummary = subscriptionScanState === 'checking'
    ? 'Checking local sign-ins'
    : subscriptionScanState === 'error' && !hasVerifiedSubscriptionStatus
    ? 'Status unavailable'
    : signedInProviderCount || savedApiKeyCount
    ? `${signedInProviderCount} signed in · ${savedApiKeyCount} API key${savedApiKeyCount === 1 ? '' : 's'} saved`
    : 'No verified sign-in or saved API key';

  const openApiKeyEditor = (id: string) => {
    setShowByokSection(true);
    setLoginStatusMsg(`${models.find((model) => model.id === id)?.codeName || subscriptions[id]?.providerName || 'This provider'} has no supported CLI. Add an API key below to use it in Aspira.`);
    window.requestAnimationFrame(() => document.getElementById(`api-key-${id}`)?.focus());
  };

  const handleTabNavigation = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || []);
    if (tabs.length === 0) return;
    event.preventDefault();
    const currentIndex = tabs.indexOf(event.currentTarget);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
      ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div
      ref={dialogRef}
      className="aspira-vault-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connections-dialog-title"
      tabIndex={-1}
    >
      <div className="aspira-vault-dialog w-full max-w-5xl aspira-glass-elevated rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-white/[0.1]">
        {/* TOP HEADER */}
        <div className="aspira-vault-header flex items-center justify-between px-7 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="aspira-vault-brand-mark w-10 h-10 rounded-xl flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="aspira-vault-eyebrow">ASPIRA</p>
              <h2 id="connections-dialog-title" className="text-lg font-semibold text-white tracking-tight">
                Your agents & settings
              </h2>
              <p className="text-xs text-slate-400">
                Choose your agents and make Aspira feel like yours.
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

        <div className="aspira-vault-content-layout">
          <aside className="aspira-vault-sidebar" aria-label="Settings navigation">
            <p className="aspira-vault-sidebar-heading">SETTINGS</p>
            <nav className="aspira-vault-tabs" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
            {[
              { id: 'subscriptions', label: 'Your agents', icon: CheckCircle2 },
              { id: 'models', label: 'Advanced', icon: Layers },
              { id: 'voice', label: 'Voice', icon: Volume2 },
              { id: 'passkeys', label: 'Privacy', icon: Lock },
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
                  role="tab"
                  id={`aspira-vault-tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls="aspira-vault-panel"
                  tabIndex={active ? 0 : -1}
                  onKeyDown={handleTabNavigation}
                  className={`aspira-vault-tab ${active ? 'is-active' : ''}`}
                >
                  <Icon className="aspira-vault-tab-icon w-4 h-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.id === 'subscriptions' && configuredProviderCount > 0 && (
                    <span className="aspira-vault-nav-count" aria-label={`${configuredProviderCount} providers configured`}>
                      {configuredProviderCount}
                    </span>
                  )}
                </button>
              );
            })}
            </nav>
            <div className="aspira-vault-sidebar-note">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>API keys are stored in this browser.</span>
            </div>
          </aside>

        {/* MODAL BODY */}
        <main
          className="aspira-vault-body p-7 overflow-y-auto custom-scrollbar space-y-6 flex-1 min-h-0"
          id="aspira-vault-panel"
          role="tabpanel"
          aria-labelledby={`aspira-vault-tab-${activeTab}`}
          tabIndex={0}
        >
          {/* TAB 1: PROVIDER CLI CONNECTIONS AND OPTIONAL API ENDPOINTS */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="aspira-vault-section-kicker">YOUR AGENTS</p>
                  <h3 className="text-xl font-semibold text-white">Bring your agents together</h3>
                  <p className="aspira-vault-intro-copy text-xs text-slate-400 mt-0.5">
                    Connect a supported provider sign-in or add an API key. Aspira uses each provider’s own CLI where available; account limits and included tools remain provider-controlled.
                  </p>
                </div>
                <div className="aspira-vault-header-actions">
                  <span className={`aspira-vault-connection-summary ${subscriptionScanState === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">
                    <span className={`aspira-vault-summary-dot ${signedInProviderCount > 0 ? 'is-ready' : savedApiKeyCount > 0 ? 'is-configured' : ''} ${subscriptionScanState === 'checking' ? 'is-checking' : ''}`} />
                    {connectionSummary}
                  </span>
                  <button
                    type="button"
                    disabled={subscriptionScanState === 'checking'}
                    onClick={() => {
                      void refreshSubscriptions();
                    }}
                    aria-label={subscriptionScanState === 'checking' ? 'Checking provider status' : 'Refresh provider status'}
                    className="aspira-vault-refresh-button px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${subscriptionScanState === 'checking' ? 'animate-spin' : ''}`} />
                    {subscriptionScanState === 'checking' ? 'Checking…' : 'Refresh'}
                  </button>
                </div>
              </div>

              {subscriptionScanState === 'checking' && (
                <p className="aspira-vault-scan-progress text-xs text-slate-400" role="status" aria-live="polite">
                  Checking supported provider sign-ins. This may take a moment.
                </p>
              )}

              {subscriptionScanState === 'error' && (
                <div className="aspira-connection-scan-error" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {hasVerifiedSubscriptionStatus
                      ? 'Could not refresh provider status. Showing the last checked results.'
                      : 'Could not check provider status. Sign-in state is unknown until a refresh succeeds.'}
                  </span>
                </div>
              )}

              {loginStatusMsg && (
                <div className="aspira-vault-feedback p-3 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-xs text-indigo-200 flex items-center justify-between" role="status" aria-live="polite">
                  <span>{loginStatusMsg}</span>
                  <button
                    onClick={() => setLoginStatusMsg(null)}
                    className="text-[11px] text-indigo-300 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {subscriptionScanState === 'ready' && configuredProviderCount === 0 && (
                <div className="aspira-vault-empty-state" role="note">
                  <div className="aspira-vault-empty-icon"><KeyRound className="h-4 w-4" aria-hidden="true" /></div>
                  <div>
                    <p className="aspira-vault-empty-title">No verified connection yet</p>
                    <p className="aspira-vault-empty-copy">Choose an agent below to connect. A desktop app sign-in alone does not grant Aspira access. API keys are checked when you request your first reply.</p>
                  </div>
                </div>
              )}

              {/* Supported provider CLI connections */}
              <div className="aspira-provider-grid grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {providerIds.map((id) => {
                  const sub = subscriptions[id];
                  const model = models.find((m) => m.id === id);
                  const cliAvailable = Boolean(sub?.cliPath);
                  const hasSavedApiKey = Boolean(apiKeys[id]);
                  const canUseInConversation = hasSavedApiKey || (cliAvailable && sub?.authStatus === 'signed_in');
                  const connectionLabel = hasSavedApiKey
                    ? 'API key saved'
                    : !sub
                    ? subscriptionScanState === 'checking'
                      ? 'Checking'
                      : subscriptionScanState === 'error'
                      ? 'Status unknown'
                      : subscriptionScanState === 'ready'
                      ? 'Not detected'
                      : 'Not checked'
                    : !cliAvailable
                    ? 'CLI not found'
                    : sub.authStatus === 'signed_in'
                    ? 'Signed in'
                    : sub.authStatus === 'signed_out'
                    ? 'Sign-in required'
                    : 'CLI found';
                  const connectionDetail = hasSavedApiKey
                    ? 'Saved in this browser. Aspira checks it when you request a response.'
                    : sub?.methodLabel || (
                    subscriptionScanState === 'checking'
                      ? 'Checking local CLI status…'
                      : subscriptionScanState === 'error'
                      ? 'This provider status could not be verified.'
                      : subscriptionScanState === 'ready'
                      ? 'No provider status was returned.'
                      : 'Status has not been checked yet.'
                  );
                  const connectionColor = connectionLabel === 'Signed in'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                    : connectionLabel === 'Sign-in required'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                    : 'bg-white/[0.04] text-slate-300 border-white/[0.1]';
                  const connectionState = connectionLabel === 'Signed in'
                    ? 'connected'
                    : hasSavedApiKey
                    ? 'configured'
                    : connectionLabel === 'Sign-in required'
                    ? 'attention'
                    : connectionLabel === 'Checking'
                    ? 'checking'
                    : connectionLabel === 'Status unknown'
                    ? 'unknown'
                    : connectionLabel === 'Not detected' || connectionLabel === 'CLI not found'
                    ? 'not-detected'
                    : 'available';
                  const StatusIcon = hasSavedApiKey
                    ? KeyRound
                    : connectionLabel === 'Signed in'
                    ? Check
                    : connectionLabel === 'Status unknown'
                    ? AlertTriangle
                    : cliAvailable
                    ? Terminal
                    : KeyRound;
                  const AccessIcon = hasSavedApiKey ? KeyRound : cliAvailable ? Terminal : KeyRound;

                  return (
                    <div
                      key={id}
                      id={`aspira-provider-${id}`}
                      className={`aspira-provider-card ${initialModelId === id ? 'is-selected-agent' : ''} p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between gap-3`}
                      data-state={connectionState}
                    >
                      <div>
                        <div className="aspira-provider-card-heading">
                          <div className="aspira-provider-identity">
                            <span className="aspira-provider-mark" style={{ '--provider-accent': model?.accentHex || '#6E8EFB' } as React.CSSProperties} aria-hidden="true">
                              {(model?.codeName || id).slice(0, 1)}
                            </span>
                            <div className="aspira-provider-names">
                              <span className="aspira-provider-name">{id === 'argon' ? 'Gemini' : model?.codeName || id}</span>
                              <span className="aspira-provider-family">{sub?.providerName || model?.family || 'Provider connection'}</span>
                            </div>
                          </div>
                          <span
                            className={`aspira-connection-badge text-[10px] font-medium px-2.5 py-1 rounded-full border ${connectionColor}`}
                            data-state={connectionState}
                          >
                            <StatusIcon className="aspira-connection-status-icon" aria-hidden="true" />
                            {connectionLabel}
                          </span>
                        </div>

                        <div className="aspira-provider-detail text-xs leading-5 text-slate-300">
                          <AccessIcon className="aspira-provider-access-icon" aria-hidden="true" />
                          {connectionDetail}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {canUseInConversation ? (
                          <button
                            type="button"
                            onClick={() => {
                              onUseModel(id);
                              onClose();
                            }}
                            className="aspira-connection-action is-primary flex-1 py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {awakeModelIds.includes(id) ? 'Return to conversation' : 'Use in conversation'}
                          </button>
                        ) : cliAvailable ? (
                          <button
                            type="button"
                            onClick={() => handleSubscriptionLogin(id)}
                            className="aspira-connection-action is-primary flex-1 py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {id === 'claude' ? 'Open Claude Code' : connectionLabel === 'Sign-in required' ? 'Sign in' : 'Open sign-in'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openApiKeyEditor(id)}
                            className="aspira-connection-action is-secondary flex-1 py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Add API key
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Collapsible optional API key fallback */}
              <div className={`aspira-byok-card rounded-2xl bg-white/[0.02] border border-white/[0.07] p-4 ${showByokSection ? 'is-open' : ''}`}>
                <button
                  type="button"
                  aria-expanded={showByokSection}
                  aria-controls="aspira-byok-fields"
                  onClick={() => setShowByokSection((v) => !v)}
                  className="aspira-byok-toggle w-full flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-300">
                      Optional API keys
                    </div>
                    <div className="text-xs text-slate-500">
                      Add an API key if you want direct API access or a CLI is unavailable.
                    </div>
                  </div>
                  {showByokSection ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showByokSection && (
                  <form id="aspira-byok-fields" onSubmit={handleSaveKeys} className="aspira-byok-form space-y-3 pt-4 mt-3 border-t border-white/[0.06]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { id: 'argon', label: 'Gemini · Google API Key', placeholder: 'AIzaSy...' },
                        { id: 'claude', label: 'Claude · Anthropic API Key', placeholder: 'sk-ant-...' },
                        { id: 'grok', label: 'Grok · xAI API Key', placeholder: 'xai-...' },
                        { id: 'gpt', label: 'GPT · OpenAI API Key', placeholder: 'sk-proj-...' },
                      ].map((item) => (
                        <div
                          key={item.id}
                          className="aspira-key-field p-3 rounded-xl bg-black/30 border border-white/[0.06] space-y-1.5"
                        >
                          <label htmlFor={`api-key-${item.id}`} className="text-[11px] font-medium text-slate-300 block">
                            {item.label}
                          </label>
                          <input
                            id={`api-key-${item.id}`}
                            type="password"
                            autoComplete="off"
                            value={localKeys[item.id] || ''}
                            onChange={(e) => {
                              setKeysSavedBanner(false);
                              setKeysSaveError('');
                              setLocalKeys((prev) => ({ ...prev, [item.id]: e.target.value }));
                            }}
                            placeholder={item.placeholder}
                            aria-describedby={`api-key-hint-${item.id}`}
                            className="aspira-vault-field w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                          />
                          <p id={`api-key-hint-${item.id}`} className="aspira-vault-field-hint text-[10px] leading-4 text-slate-500">
                            Saved locally. Aspira checks this key when you request a response.
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {keysSavedBanner && (
                        <p className="aspira-vault-save-success text-xs" role="status" aria-live="polite">
                          API keys saved in this browser.
                        </p>
                      )}
                      {keysSaveError && (
                        <p className="aspira-vault-save-error text-xs" role="alert">
                          {keysSaveError}
                        </p>
                      )}
                      <button
                        type="submit"
                        className="aspira-vault-save-button px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-100 transition-all flex items-center gap-1.5"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Save optional API keys
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
                  Agent connections ({models.length})
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
                        <p className="text-xs text-slate-300 leading-relaxed">{m.endpointConfig ? `Custom model · ${m.endpointConfig.apiModelId}` : 'Connection status and sign-in are available in Your agents.'}</p>
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

                <form onSubmit={handleAddPlugin} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1.5 text-xs text-slate-400">
                      <span>Model name</span>
                      <input
                        type="text"
                        value={codeName}
                        onChange={(e) => setCodeName(e.target.value)}
                        placeholder="e.g. Llama-3.2"
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs text-slate-400">
                      <span>Model family (optional)</span>
                      <input
                        type="text"
                        value={family}
                        onChange={(e) => setFamily(e.target.value)}
                        placeholder="e.g. Llama 3.2"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs text-slate-400">
                      <span>OpenAI-compatible endpoint</span>
                      <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-400"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs text-slate-400">
                      <span>Model ID</span>
                      <input
                        type="text"
                        value={apiModelId}
                        onChange={(e) => setApiModelId(e.target.value)}
                        placeholder="e.g. llama3.2:latest"
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-400"
                      />
                    </label>
                    <label className="md:col-span-2 space-y-1.5 text-xs text-slate-400">
                      <span>Connection note (optional)</span>
                      <input
                        type="text"
                        value={superpower}
                        onChange={(e) => setSuperpower(e.target.value)}
                        placeholder="Short note to help you recognize this model"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                      />
                    </label>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-100 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add model
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="aspira-vault-voice-panel">
              <div className="aspira-vault-voice-heading">
                <div className="aspira-vault-voice-mark" aria-hidden="true">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="aspira-vault-section-kicker">BUILT INTO ASPIRA</p>
                  <h3>Voice is part of the conversation</h3>
                  <p className="aspira-vault-voice-copy">
                    Aspira handles speech in the browser. There is no separate service, account, or endpoint to connect. Voice models download automatically on first use and stay cached in your browser.
                  </p>
                </div>
              </div>
              <div className="aspira-vault-voice-status" role="status">
                <span className="aspira-vault-voice-status-label">{voiceStatus === 'Voice input is off' ? 'Included with Aspira' : voiceStatus || 'Ready when you are'}</span>
                <p>English speech and transcription run in your browser after the voice models are ready. Audio stays in your browser; the transcript is sent to your selected model for a reply.</p>
                <button
                  type="button"
                  onClick={onPreviewVoice}
                  className="aspira-vault-voice-preview"
                  aria-label={isVoicePlaying ? 'Stop Aspira voice playback' : 'Preview Aspira voice'}
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  {isVoicePlaying ? 'Stop speaking' : 'Preview voice'}
                </button>
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
              <p className="text-xs leading-5 text-slate-500">This passphrase only hides your conversations in the current browser. It is not an account password or device security.</p>
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
        </main>
        </div>
      </div>
    </div>
  );
};
