import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  FolderGit2,
  KeyRound,
  Lock,
  Mic,
  Orbit,
  Sliders,
  Square,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  BUILTIN_MODEL_PLUGINS,
  CAPABILITY_MATRIX,
  ConversationTurn,
  DEFAULT_PASSKEY_PROFILES,
  LivingMemoryItem,
  LocalPlaybook,
  ModelPluginManifest,
  PasskeyProfile,
  SpatialMode,
  SynergyExecutionResult,
  SubscriptionStatus,
} from './plugins/models/manifest';
import { ConversationMessageContext, runPantheonSynergy } from './plugins/models/synergyEngine';
import { soundEngine } from './audio/soundEngine';
import { SpatialModeDeck } from './components/SpatialModeDeck';
import { PlugAndPlayVaultModal } from './components/PlugAndPlayVaultModal';

export const App: React.FC = () => {
  // Aspira opens directly into the workspace. Session locking is an optional setting.
  const [bootState, setBootState] = useState<'ignited' | 'locked'>('ignited');

  // 2. PLUG-AND-PLAY MODELS & AWAKE STATE
  const [models, setModels] = useState<ModelPluginManifest[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('aspira_custom_model_endpoints_v1') || '[]');
      const builtInIds = new Set(BUILTIN_MODEL_PLUGINS.map((model) => model.id));
      const customModels = Array.isArray(saved)
        ? saved.filter((model) =>
            model && typeof model.id === 'string' && !builtInIds.has(model.id) &&
            typeof model.endpointConfig?.baseUrl === 'string' &&
            typeof model.endpointConfig?.apiModelId === 'string'
          )
        : [];
      return [...BUILTIN_MODEL_PLUGINS, ...customModels];
    } catch {
      return BUILTIN_MODEL_PLUGINS;
    }
  });
  const [awakeModelIds, setAwakeModelIds] = useState<string[]>([]);
  const [passkeyProfiles, setPasskeyProfiles] = useState<PasskeyProfile[]>(() => {
    try {
      const stored = localStorage.getItem('aspira_passkey_profiles');
      const savedProfiles = stored ? JSON.parse(stored) : [];
      const priorPhrase = Array.isArray(savedProfiles)
        ? savedProfiles.find((profile) => profile.id === 'workspace')?.phrase ||
          savedProfiles.find((profile) => profile.id === 'lazarus')?.phrase || ''
        : '';
      const savedPhrase = String(priorPhrase).trim().toLocaleLowerCase() === 'protocol lazarus'
        ? ''
        : String(priorPhrase);
      return [{ ...DEFAULT_PASSKEY_PROFILES[0], phrase: savedPhrase }];
    } catch {
      return DEFAULT_PASSKEY_PROFILES;
    }
  });
  const [passkeyLockEnabled, setPasskeyLockEnabled] = useState(() => {
    try {
      return localStorage.getItem('aspira_passkey_lock_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('archon_api_keys_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 3. Studio view, current conversation, saved context, and playbooks
  const [spatialMode, setSpatialMode] = useState<SpatialMode>('nexus');
  const selectedCapability = CAPABILITY_MATRIX[0];
  const [latestResult, setLatestResult] = useState<SynergyExecutionResult | null>(null);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [memories, setMemories] = useState<LivingMemoryItem[]>([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [routines, setRoutines] = useState<LocalPlaybook[]>([]);
  const [subscriptionStatuses, setSubscriptionStatuses] = useState<Record<string, SubscriptionStatus>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [canCancelRequest, setCanCancelRequest] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [awayBriefingBanner, setAwayBriefingBanner] = useState<string | null>(null);
  const [unlockPhrase, setUnlockPhrase] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // Voice input is opt-in and only starts after the user presses the microphone control.
  const [liveTranscript, setLiveTranscript] = useState('');
  const [duplexVoiceActive, setDuplexVoiceActive] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Voice input is off');
  const [vaultModalOpen, setVaultModalOpen] = useState(false);

  const duplexVoiceRef = useRef(duplexVoiceActive);
  duplexVoiceRef.current = duplexVoiceActive;
  const conversationTurnsRef = useRef(conversationTurns);
  conversationTurnsRef.current = conversationTurns;
  const abortControllerRef = useRef<AbortController | null>(null);
  const defaultModelSelectionAppliedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    soundEngine.onSpeakingStateChange = (speaking) => {
      setIsAgentSpeaking(speaking);
    };
    return () => {
      soundEngine.onSpeakingStateChange = undefined;
    };
  }, []);

  // Start with one provider only after Aspira confirms a usable local connection.
  useEffect(() => {
    if (defaultModelSelectionAppliedRef.current) return;
    if (awakeModelIds.length > 0) {
      defaultModelSelectionAppliedRef.current = true;
      return;
    }

    const connectedModel = models.find((model) =>
      Boolean(apiKeys[model.id]) || subscriptionStatuses[model.id]?.authStatus === 'signed_in' ||
      model.endpointConfig?.providerType === 'openai_compatible'
    );
    if (!connectedModel) return;

    defaultModelSelectionAppliedRef.current = true;
    setAwakeModelIds([connectedModel.id]);
  }, [models, awakeModelIds, apiKeys, subscriptionStatuses]);

  useEffect(() => {
    try {
      localStorage.setItem('aspira_passkey_profiles', JSON.stringify(passkeyProfiles));
      localStorage.setItem('aspira_passkey_lock_enabled', String(passkeyLockEnabled));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [passkeyProfiles, passkeyLockEnabled]);

  // Load saved context, playbooks, and provider CLI availability.
  useEffect(() => {
    fetch('/api/memory')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.memories)) setMemories(data.memories);
      })
      .catch(() => {})
      .finally(() => setMemoriesLoaded(true));

    fetch('/api/routines')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.routines)) setRoutines(data.routines);
      })
      .catch(() => {});

    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((data) => {
        if (data?.subscriptions) setSubscriptionStatuses(data.subscriptions);
      })
      .catch(() => {});
  }, []);

  const handleToggleMemoryStatus = useCallback(
    async (id: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'ACTIVE') => {
      try {
        const res = await fetch(`/api/memory/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.memories)) setMemories(data.memories);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const handleDeleteMemory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/memory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.memories)) setMemories(data.memories);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAddMemory = useCallback(
    async (content: string, category: LivingMemoryItem['category']) => {
      try {
        const res = await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            category,
            status: category === 'preference' ? 'ACTIVE' : 'IN_PROGRESS',
            sourceAgent: awakeModelIds[0] || 'argon',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.memories)) setMemories(data.memories);
        }
      } catch {
        // ignore
      }
    },
    [awakeModelIds]
  );

  const handleUnlockPasskey = useCallback((spokenPhrase: string) => {
    const phrase = spokenPhrase.trim().toLocaleLowerCase();
    const matchedProfile = passkeyProfiles.find(
      (profile) => profile.phrase.trim().toLocaleLowerCase() === phrase
    );
    if (!matchedProfile || !matchedProfile.phrase.trim()) return false;
    setBootState('ignited');
    setAwayBriefingBanner('Workspace unlocked');
    return true;
  }, [passkeyProfiles]);

  const appendLocalNotice = useCallback((prompt: string, headline: string, message: string) => {
    const result: SynergyExecutionResult = {
      id: `syn-local-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      prompt,
      capabilityId: selectedCapability.id,
      capabilityName: selectedCapability.name,
      synergyMode: 'fusion',
      participatingModels: [],
      consensusScore: null,
      executiveHeadline: headline,
      synthesizedOutput: message,
      spokenReply: '',
      executedActions: [],
      followUpSuggestions: [],
      attributionPills: [],
      modelStreams: [],
      consensusPoints: [],
      divergentPoints: [],
    };
    setLatestResult(result);
    setConversationTurns((prev) => [...prev, {
      id: result.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userText: prompt,
      inputModality: 'routine',
      result,
    }]);
  }, [selectedCapability]);

  // Execute a Conversational Turn & Real Host Actions across Awake Models
  const handleRunDirective = useCallback(
    async (
      promptText: string,
      modality: 'voice' | 'text' | 'routine' = 'text',
      speakReplyAloud = true
    ) => {
      const cleanPrompt = promptText.trim();
      const cap = selectedCapability;
      if (!cleanPrompt) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setCanCancelRequest(true);
      setIsExecuting(true);
      try {
        const activeList = models.filter((m) => awakeModelIds.includes(m.id));

        // Build multi-turn conversation history for LLM context
        const historyContext: ConversationMessageContext[] = [];
        for (const t of conversationTurnsRef.current.slice(-5)) {
          historyContext.push({ role: 'user', text: t.userText });
          historyContext.push({
            role: 'assistant',
            speaker: t.result.modelStreams[0]?.codeName || 'Aspira',
            text: t.result.synthesizedOutput,
          });
        }

        const result = await runPantheonSynergy({
          prompt: cleanPrompt,
          capabilityId: cap.id,
          synergyMode: 'fusion',
          awakeModels: activeList,
          apiKeys,
          conversationHistory: historyContext,
          signal: controller.signal,
          onMemoriesUpdated: (updated) => setMemories(updated),
        });
        if (controller.signal.aborted) return;

        const newTurn: ConversationTurn = {
          id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userText: cleanPrompt,
          inputModality: modality,
          result,
        };

        setLatestResult(result);
        setConversationTurns((prev) => [...prev, newTurn]);

        if (result.spokenReply && speakReplyAloud && (modality === 'voice' || duplexVoiceRef.current)) {
          soundEngine.speak(result.spokenReply);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          appendLocalNotice(
            cleanPrompt,
            'Request failed',
            error instanceof Error ? error.message : 'Aspira could not complete this request.'
          );
        }
      } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setCanCancelRequest(false);
        setIsExecuting(false);
      }
    },
    [models, awakeModelIds, apiKeys, appendLocalNotice]
  );

  // Run a user-triggered local playbook.
  const handleRunRoutine = useCallback(
    async (routineId: string) => {
      setIsExecuting(true);
      try {
        const res = await fetch(`/api/routines/${routineId}/run`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `The playbook returned ${res.status}.`);
        {
          if (Array.isArray(data?.memories)) setMemories(data.memories);
          setRoutines((prev) =>
            prev.map((r) => (r.id === routineId ? data.routine : r))
          );

          const routine: LocalPlaybook = data.routine;
          const results = data.results || [];
          const summaryText = `Ran **${routine.title}** across ${results.length} local steps:\n\n${results
            .map((r: any, idx: number) => `${idx + 1}. **${r.stepLabel || r.title}**: ${r.output.slice(0, 260)}`)
            .join('\n\n')}`;

          const syntheticResult: SynergyExecutionResult = {
            id: `syn-routine-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            prompt: `Run Routine: ${routine.title}`,
            capabilityId: selectedCapability.id,
            capabilityName: selectedCapability.name,
            synergyMode: 'fusion',
            participatingModels: [],
            consensusScore: null,
            executiveHeadline: `Local routine · ${routine.title}`,
            synthesizedOutput: summaryText,
            spokenReply: `The routine finished with ${results.length} steps. Review the outcomes in the conversation.`,
            executedActions: results,
            followUpSuggestions: [],
            attributionPills: [],
            modelStreams: [],
            consensusPoints: [],
            divergentPoints: [],
          };

          const newTurn: ConversationTurn = {
            id: `turn-routine-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            userText: `Run local playbook: ${routine.title}`,
            inputModality: 'routine',
            result: syntheticResult,
          };

          setLatestResult(syntheticResult);
          setConversationTurns((prev) => [...prev, newTurn]);
        }
      } catch (error) {
        appendLocalNotice(
          'Run local playbook',
          'Playbook failed',
          error instanceof Error ? error.message : 'Aspira could not run that playbook.'
        );
      } finally {
        setIsExecuting(false);
      }
    },
    [appendLocalNotice]
  );

  // Execute a Direct Single Tool Action (e.g. clicking "Open Calculator" or "Send macOS Notification")
  const handleExecuteDirectAction = useCallback(
    async (tool: string, args: Record<string, unknown>, label: string) => {
      setIsExecuting(true);
      try {
        const res = await fetch('/api/execute-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool, args }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `The local action returned ${res.status}.`);
        {
          if (Array.isArray(data?.memories)) setMemories(data.memories);
          const act = data.result;
          const succeeded = act?.status === 'success';
          const syntheticResult: SynergyExecutionResult = {
            id: `syn-act-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            prompt: label,
            capabilityId: selectedCapability.id,
            capabilityName: selectedCapability.name,
            synergyMode: 'fusion',
            participatingModels: [],
            consensusScore: null,
            executiveHeadline: succeeded ? `Local action · ${act.title}` : `Action failed · ${act.title}`,
            synthesizedOutput: succeeded
              ? `Done. ${act.title}.\n\n${act.output}`
              : `Could not complete ${act?.title || label}.\n\n${act?.output || 'No result was returned.'}`,
            spokenReply: succeeded ? `Done. ${act.title}.` : '',
            executedActions: [act],
            followUpSuggestions: [],
            attributionPills: [],
            modelStreams: [],
            consensusPoints: [],
            divergentPoints: [],
          };

          setLatestResult(syntheticResult);
          setConversationTurns((prev) => [
            ...prev,
            {
              id: `turn-act-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              userText: label,
              inputModality: 'text',
              result: syntheticResult,
            },
          ]);
        }
      } catch (error) {
        appendLocalNotice(
          label,
          'Local action failed',
          error instanceof Error ? error.message : 'Aspira could not reach its local action service.'
        );
      } finally {
        setIsExecuting(false);
      }
    },
    [appendLocalNotice]
  );

  const toggleVoiceInput = useCallback(async () => {
    const currentRecorder = recorderRef.current;
    if (currentRecorder?.state === 'recording') {
      currentRecorder.stop();
      setDuplexVoiceActive(false);
      setVoiceStatus('Transcribing on this Mac…');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus('Voice recording is not available in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(voiceChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        recorderRef.current = null;
        if (!audioBlob.size) {
          setVoiceStatus('No audio captured. Try again.');
          return;
        }

        try {
          const response = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
            body: audioBlob,
          });
          const data = await response.json();
          if (!response.ok || !data?.text) {
            setVoiceStatus(data?.error || 'Local speech recognition is unavailable. Start the voice service in Settings.');
            return;
          }
          setLiveTranscript(data.text);
          setVoiceStatus('Voice input processed locally');
          await handleRunDirective(data.text, 'voice', true);
        } catch {
          setVoiceStatus('Could not reach the local speech service. Start it from Settings.');
        }
      };
      recorder.start();
      setDuplexVoiceActive(true);
      setVoiceStatus('Listening on this Mac · click again to send');
    } catch {
      setDuplexVoiceActive(false);
      setVoiceStatus('Microphone access was not granted. Voice input stays off.');
    }
  }, [handleRunDirective]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Toggle Awake / Sleep State of any Individual Model
  const toggleModelAwake = (model: ModelPluginManifest) => {
    defaultModelSelectionAppliedRef.current = true;
    setAwakeModelIds((prev) => {
      const exists = prev.includes(model.id);
      if (exists) {
        return prev.filter((id) => id !== model.id);
      } else {
        return [...prev, model.id];
      }
    });
  };

  const switchSpatialMode = (mode: SpatialMode) => {
    setSpatialMode(mode);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden aspira-canvas-bg flex flex-col p-5">
      {bootState === 'locked' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#090b10]/90 p-6 backdrop-blur-xl">
          <form
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#11141b] p-7 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (!handleUnlockPasskey(unlockPhrase)) setUnlockError('That passphrase did not match.');
              else {
                setUnlockPhrase('');
                setUnlockError('');
              }
            }}
          >
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-200">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Aspira workspace</p>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Enter your optional session passphrase to continue.</p>
            <input
              autoFocus
              type="password"
              value={unlockPhrase}
              onChange={(event) => setUnlockPhrase(event.target.value)}
              placeholder="Session passphrase"
              className="mt-6 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-white/25"
            />
            {unlockError && <p className="mt-2 text-xs text-rose-300">{unlockError}</p>}
            <button type="submit" className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200">
              Unlock workspace
            </button>
            <p className="mt-4 text-[11px] leading-5 text-slate-500">This is a convenience lock for this browser session, not device-level security.</p>
          </form>
        </div>
      )}

      {/* Provider and workspace settings */}
      <PlugAndPlayVaultModal
        open={vaultModalOpen}
        onClose={() => setVaultModalOpen(false)}
        models={models}
        onSubscriptionsUpdated={setSubscriptionStatuses}
        onAddCustomModel={(newPlugin) => {
          const id = models.some((model) => model.id === newPlugin.id)
            ? `${newPlugin.id}_${Date.now().toString(36)}`
            : newPlugin.id;
          const plugin = { ...newPlugin, id };
          setModels((prev) => {
            const next = [...prev.filter((model) => model.id !== id), plugin];
            const custom = next.filter((model) => !BUILTIN_MODEL_PLUGINS.some((builtin) => builtin.id === model.id));
            try {
              localStorage.setItem('aspira_custom_model_endpoints_v1', JSON.stringify(custom));
            } catch {
              // The current session remains usable if browser storage is unavailable.
            }
            return next;
          });
          setAwakeModelIds((prev) => [...prev, id]);
        }}
        passkeyProfiles={passkeyProfiles}
        passkeyLockEnabled={passkeyLockEnabled}
        onTogglePasskeyLock={setPasskeyLockEnabled}
        onUpdatePasskeyPhrase={(id, phrase) => {
          setPasskeyProfiles((prev) =>
            prev.map((p) => (p.id === id ? { ...p, phrase } : p))
          );
          if (!phrase.trim()) setPasskeyLockEnabled(false);
        }}
        apiKeys={apiKeys}
        onSaveApiKeys={(keys) => {
          setApiKeys(keys);
          try {
            localStorage.setItem('archon_api_keys_v1', JSON.stringify(keys));
          } catch {
            // ignore
          }
          setVaultModalOpen(false);
        }}
      />

      {/* =====================================================================
          LAYER 1: FLOATING TOP GLASS NAVIGATION BAR
         ===================================================================== */}
      <header className="relative z-20 flex items-center justify-between gap-4 aspira-glass rounded-2xl px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#6E8EFB] via-[#A777E3] to-[#D97757] p-[1px]">
            <div className="w-full h-full rounded-[11px] bg-[#090A0F] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[#93ADFF]" />
            </div>
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-white">
            Aspira
          </span>
          <span className="hidden md:inline-flex rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400">
            {memoriesLoaded ? `${memories.length} saved memories` : 'Loading saved context…'}
          </span>
        </div>

        {/* Primary workspace views */}
        <nav className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {(
            [
              { id: 'nexus', label: 'Studio', icon: Orbit },
              { id: 'forge', label: 'Workbench', icon: FolderGit2 },
            ] as { id: SpatialMode; label: string; icon: any }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = spatialMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchSpatialMode(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white/[0.12] text-white border border-white/[0.12] shadow-sm'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Workspace settings and optional session lock */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setVaultModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl aspira-card-interactive text-xs font-medium text-slate-200 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#6E8EFB]" />
            <span>Settings</span>
          </button>

          {passkeyLockEnabled && passkeyProfiles[0]?.phrase.trim() && (
            <button
              onClick={() => {
                soundEngine.stopSpeaking();
                if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
                setBootState('locked');
                setUnlockPhrase('');
                setUnlockError('');
              }}
              title="Lock this browser session"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl aspira-card-interactive text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          )}
        </div>
      </header>

      {/* Subtle Unlock Notification Pill */}
      {awayBriefingBanner && (
        <div className="relative z-20 mx-auto mt-2 flex items-center gap-3 px-4 py-1 rounded-full aspira-glass text-xs text-slate-200">
          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
          <span>{awayBriefingBanner}</span>
          <button
            onClick={() => setAwayBriefingBanner(null)}
            className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          LAYER 2: TRANSFORMATIVE STUDIO STAGE (Conversational + Action OS)
         ===================================================================== */}
      <main className="relative z-10 mx-auto my-4 w-full max-w-[1440px] flex-1 overflow-hidden">
        <SpatialModeDeck
          spatialMode={spatialMode}
          models={models}
          awakeModelIds={awakeModelIds}
          synergyResult={latestResult}
          conversationTurns={conversationTurns}
          memories={memories}
          onToggleMemoryStatus={handleToggleMemoryStatus}
          onDeleteMemory={handleDeleteMemory}
          onAddMemory={handleAddMemory}
          routines={routines}
          onRunRoutine={handleRunRoutine}
          onExecuteDirectAction={handleExecuteDirectAction}
          isExecuting={isExecuting}
          onRunPrompt={(prompt) => handleRunDirective(prompt, 'text', true)}
          duplexVoiceActive={duplexVoiceActive}
          onToggleDuplexVoice={toggleVoiceInput}
          isAgentSpeaking={isAgentSpeaking}
          liveTranscript={liveTranscript}
          voiceStatus={voiceStatus}
        />
      </main>

      {/* =====================================================================
          LAYER 3: 2-TIER FLOATING AGENT CONSTELLATION DOCK + UNIFIED COMPOSER
         ===================================================================== */}
      <footer className="relative z-20 mx-auto flex w-full max-w-[1120px] flex-col gap-3">
        {/* TIER A: Tactile Agent Constellation Pill Dock */}
        <div className="flex items-center justify-center flex-wrap gap-2">
          {models.map((model) => {
            const isAwake = awakeModelIds.includes(model.id);
            const providerStatus = apiKeys[model.id]
              ? 'API key'
              : subscriptionStatuses[model.id]?.authStatus === 'signed_in'
              ? 'Signed in'
              : subscriptionStatuses[model.id]?.authStatus === 'signed_out'
              ? 'Sign in'
              : subscriptionStatuses[model.id]?.cliPath
              ? 'CLI detected'
              : model.endpointConfig?.providerType === 'openai_compatible'
              ? 'Endpoint'
              : subscriptionStatuses[model.id]
              ? 'Connect'
              : 'Checking';
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => toggleModelAwake(model)}
                style={{
                  borderColor: isAwake ? `${model.accentHex}66` : 'rgba(255,255,255,0.07)',
                  backgroundColor: isAwake
                    ? 'rgba(22, 25, 34, 0.85)'
                    : 'rgba(15, 17, 23, 0.55)',
                }}
                className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all cursor-pointer group"
                title={`${model.tagline} · ${isAwake ? 'Selected for this conversation' : 'Not selected'}`}
              >
                <span
                  style={{
                    backgroundColor: isAwake ? model.accentHex : '#475569',
                    boxShadow: isAwake ? `0 0 10px ${model.accentHex}` : 'none',
                  }}
                  className="w-2 h-2 rounded-full transition"
                />
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-semibold ${
                        isAwake ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      {model.codeName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isAwake ? 'Selected' : 'Select'}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500">{providerStatus}</div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              defaultModelSelectionAppliedRef.current = true;
              setAwakeModelIds(models.map((m) => m.id));
            }}
            className="px-3 py-2 rounded-xl aspira-card-interactive text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            Select all
          </button>

        </div>

        {/* TIER B: Conversational & Action-Executing Composer Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!commandInput.trim()) return;
            handleRunDirective(commandInput, 'text', true);
            setCommandInput('');
          }}
          className="aspira-glass-elevated rounded-2xl px-4 py-2.5 flex items-center gap-3"
        >
          <button
            type="button"
            onClick={toggleVoiceInput}
            className="flex items-center gap-2 text-xs text-slate-400 shrink-0 cursor-pointer"
            title="Record a voice message locally"
          >
            <Mic
              className={`w-4 h-4 ${
                duplexVoiceActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span className="hidden sm:inline font-mono-tech text-[11px] text-slate-300">
              {duplexVoiceActive ? 'Stop recording' : 'Voice'}
            </span>
          </button>

          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder={
              liveTranscript
                ? `Heard: “${liveTranscript}”`
                : 'Ask a question, describe a task, or ask your agents to take an action…'
            }
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
          />

          {isExecuting && canCancelRequest ? (
            <button
              type="button"
              onClick={() => abortControllerRef.current?.abort()}
              title="Stop the agent response. A local action already started may still finish."
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20 text-xs font-semibold transition cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isExecuting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <span>{isExecuting ? 'Acting...' : 'Send'}</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </footer>
    </div>
  );
};

export default App;
