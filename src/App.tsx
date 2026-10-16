import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  FolderGit2,
  History,
  KeyRound,
  Lock,
  Mic,
  MessageSquare,
  Sliders,
  Square,
  Sparkles,
  Volume2,
  X,
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
import { ConversationHistoryPanel } from './components/ConversationHistoryPanel';
import { PlugAndPlayVaultModal } from './components/PlugAndPlayVaultModal';
import {
  CONVERSATION_HISTORY_STORAGE_KEY,
  createConversationId,
  MAX_SAVED_CONVERSATIONS,
  readConversationHistory,
  SavedConversation,
  titleForConversation,
} from './plugins/models/conversationHistory';

export const App: React.FC = () => {
  const [initialConversationHistory] = useState(readConversationHistory);
  const [savedConversations, setSavedConversations] = useState(initialConversationHistory.conversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationHistory.activeId);
  const initialConversationTurns = initialConversationHistory.conversations
    .find((conversation) => conversation.id === initialConversationHistory.activeId)?.turns ?? [];

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
  const [latestResult, setLatestResult] = useState<SynergyExecutionResult | null>(
    initialConversationTurns[initialConversationTurns.length - 1]?.result ?? null
  );
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>(initialConversationTurns);
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
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyPersistenceError, setHistoryPersistenceError] = useState(false);

  const duplexVoiceRef = useRef(duplexVoiceActive);
  duplexVoiceRef.current = duplexVoiceActive;
  const conversationTurnsRef = useRef(conversationTurns);
  conversationTurnsRef.current = conversationTurns;
  const savedConversationsRef = useRef(savedConversations);
  savedConversationsRef.current = savedConversations;
  const abortControllerRef = useRef<AbortController | null>(null);
  const defaultModelSelectionAppliedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileHistoryDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileHistoryTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const input = commandInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, 128);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 128 ? 'auto' : 'hidden';
  }, [commandInput]);

  useEffect(() => {
    if (conversationTurns.length === 0) return;

    const id = activeConversationId || createConversationId();
    const existing = savedConversationsRef.current.find((conversation) => conversation.id === id);
    if (existing?.turns === conversationTurns) return;

    if (!activeConversationId) setActiveConversationId(id);
    const nextConversation: SavedConversation = {
      id,
      title: existing?.title || titleForConversation(conversationTurns),
      updatedAt: new Date().toISOString(),
      turns: conversationTurns,
    };
    setSavedConversations((previous) => [
      nextConversation,
      ...previous.filter((conversation) => conversation.id !== id),
    ].slice(0, MAX_SAVED_CONVERSATIONS));
  }, [conversationTurns, activeConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATION_HISTORY_STORAGE_KEY, JSON.stringify({
        version: 1,
        activeId: activeConversationId,
        conversations: savedConversations,
      }));
      setHistoryPersistenceError(false);
    } catch {
      setHistoryPersistenceError(true);
    }
  }, [activeConversationId, savedConversations]);

  useEffect(() => {
    if (!mobileHistoryOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = mobileHistoryDialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (first || dialog)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileHistoryOpen(false);
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
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [mobileHistoryOpen]);

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

  const startNewConversation = () => {
    if (isExecuting) return;
    setActiveConversationId(null);
    setConversationTurns([]);
    setLatestResult(null);
    setCommandInput('');
    setHistorySearchTerm('');
    setSpatialMode('nexus');
    setMobileHistoryOpen(false);
    window.requestAnimationFrame(() => commandInputRef.current?.focus());
  };

  const selectConversation = (id: string) => {
    if (isExecuting) return;
    const conversation = savedConversations.find((item) => item.id === id);
    if (!conversation) return;
    setActiveConversationId(conversation.id);
    setConversationTurns(conversation.turns);
    setLatestResult(conversation.turns[conversation.turns.length - 1]?.result ?? null);
    setCommandInput('');
    setSpatialMode('nexus');
    setHistorySearchTerm('');
    setMobileHistoryOpen(false);
  };

  const deleteConversation = (id: string) => {
    if (isExecuting) return;
    const conversation = savedConversations.find((item) => item.id === id);
    if (!conversation) return;
    const confirmed = window.confirm(`Delete “${conversation.title}” from this browser?`);
    if (!confirmed) return;
    setSavedConversations((previous) => previous.filter((item) => item.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setConversationTurns([]);
      setLatestResult(null);
    }
  };

  const providerStatusLabel = (modelId: string) => {
    if (apiKeys[modelId]) return 'API key saved';
    if (subscriptionStatuses[modelId]?.authStatus === 'signed_in') return 'Signed in';
    if (subscriptionStatuses[modelId]?.authStatus === 'signed_out') return 'Sign-in required';
    if (subscriptionStatuses[modelId]?.cliPath) return 'CLI found';
    if (models.find((model) => model.id === modelId)?.endpointConfig?.providerType === 'openai_compatible') return 'Local endpoint';
    if (subscriptionStatuses[modelId]) return 'Connect provider';
    return 'Checking status';
  };

  const primaryViews: { id: SpatialMode; label: string; icon: typeof MessageSquare }[] = [
    { id: 'nexus', label: 'Studio', icon: MessageSquare },
    { id: 'forge', label: 'Workbench', icon: FolderGit2 },
  ];

  return (
    <div className="aspira-shell relative flex h-screen w-screen overflow-hidden p-3 aspira-canvas-bg">
      {bootState === 'locked' && (
        <div className="aspira-lock-backdrop fixed inset-0 z-50 grid place-items-center bg-[#090b10]/90 p-6 backdrop-blur-xl">
          <form
            className="aspira-lock-card w-full max-w-sm rounded-3xl border border-white/10 bg-[#11141b] p-7 shadow-2xl"
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
        initialSubscriptions={subscriptionStatuses}
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

      {mobileHistoryOpen && (
        <div
          className="aspira-mobile-history-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileHistoryOpen(false);
          }}
        >
          <div
            ref={mobileHistoryDialogRef}
            className="aspira-mobile-history-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aspira-mobile-history-title"
            tabIndex={-1}
          >
            <div className="aspira-mobile-history-header">
              <div>
                <h2 id="aspira-mobile-history-title">Your conversations</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(false)}
                aria-label="Close conversations"
                className="aspira-mobile-history-close"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <ConversationHistoryPanel
              conversations={savedConversations}
              activeId={activeConversationId}
              searchTerm={historySearchTerm}
              isExecuting={isExecuting}
              persistenceError={historyPersistenceError}
              onSearchChange={setHistorySearchTerm}
              onNewChat={startNewConversation}
              onSelect={selectConversation}
              onDelete={deleteConversation}
            />
          </div>
        </div>
      )}

      <aside className="aspira-sidebar hidden lg:flex">
        <div className="aspira-sidebar-brand">
          <div className="aspira-brand-mark"><Sparkles className="h-4 w-4" /></div>
          <div>
            <div className="font-display text-sm font-semibold tracking-tight">Aspira</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Personal AI workspace</div>
          </div>
        </div>

        <nav className="aspira-sidebar-nav" aria-label="Workspace navigation">
          <p className="aspira-sidebar-label">Workspace</p>
          {primaryViews.map((view) => {
            const Icon = view.icon;
            const active = spatialMode === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => switchSpatialMode(view.id)}
                aria-current={active ? 'page' : undefined}
                className={`aspira-sidebar-link ${active ? 'is-active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                <span>{view.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setVaultModalOpen(true)}
            aria-haspopup="dialog"
            className="aspira-sidebar-link"
          >
            <Sliders className="h-4 w-4" />
            <span>Connections</span>
          </button>
        </nav>

        <ConversationHistoryPanel
          conversations={savedConversations}
          activeId={activeConversationId}
          searchTerm={historySearchTerm}
          isExecuting={isExecuting}
          persistenceError={historyPersistenceError}
          onSearchChange={setHistorySearchTerm}
          onNewChat={startNewConversation}
          onSelect={selectConversation}
          onDelete={deleteConversation}
        />

        <div className="aspira-sidebar-footer">
          <span className="aspira-sidebar-label">Saved context</span>
          <span className="text-xs font-medium text-slate-700">
            {memoriesLoaded ? `${memories.length} items` : 'Loading…'}
          </span>
          <span className="mt-1 text-[10px] leading-4 text-slate-500">Included with provider prompts when available.</span>
        </div>
      </aside>

      <div className="aspira-app-content flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="aspira-topbar relative z-20 flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Personal workspace</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700">This Mac</p>
            </div>
            <nav className="aspira-mobile-nav flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 lg:hidden" aria-label="Workspace navigation">
              {primaryViews.map((view) => {
                const Icon = view.icon;
                const active = spatialMode === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => switchSpatialMode(view.id)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={view.label}
                    title={view.label}
                    className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      active ? 'border-white/[0.12] bg-white/[0.12] text-white' : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="aspira-mobile-nav-label">{view.label}</span>
                  </button>
                );
              })}
              <button
                ref={mobileHistoryTriggerRef}
                type="button"
                onClick={() => setMobileHistoryOpen(true)}
                aria-label="Recent conversations"
                aria-haspopup="dialog"
                title="Recent conversations"
                className="aspira-history-trigger flex min-h-11 items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
              >
                <History className="h-3.5 w-3.5" />
                <span className="aspira-mobile-nav-label">Chats</span>
              </button>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="aspira-model-count hidden lg:flex" aria-live="polite">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {awakeModelIds.length === 0
                  ? 'No model selected'
                  : `${awakeModelIds.length} ${awakeModelIds.length === 1 ? 'model' : 'models'} selected`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setVaultModalOpen(true)}
              aria-haspopup="dialog"
              aria-label="Connections"
              title="Connections"
              className="aspira-card-interactive flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 lg:hidden"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="aspira-connect-label hidden min-[430px]:inline">Connections</span>
              <span className="aspira-connect-label min-[430px]:hidden">Connect</span>
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
                aria-label="Lock this browser session"
                className="aspira-card-interactive flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-slate-700"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="aspira-lock-label">Lock</span>
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
          onOpenConnections={() => setVaultModalOpen(true)}
          duplexVoiceActive={duplexVoiceActive}
          onToggleDuplexVoice={toggleVoiceInput}
          isAgentSpeaking={isAgentSpeaking}
          liveTranscript={liveTranscript}
          voiceStatus={voiceStatus}
        />
      </main>

      <footer className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-col">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!commandInput.trim()) return;
            handleRunDirective(commandInput, 'text', true);
            setCommandInput('');
          }}
          className="aspira-composer flex w-full max-w-[955px] flex-col gap-2 px-3 py-2.5"
        >
          <div className="aspira-composer-toolbar">
            <details
              className="aspira-provider-picker"
              aria-label="Choose models for this reply"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && event.currentTarget.open) {
                  event.preventDefault();
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
            >
              <summary className="aspira-provider-summary">
                <span className="flex min-w-0 flex-col text-left">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Responding with</span>
                  <span className="max-w-[240px] truncate text-xs font-semibold text-slate-800">
                    {awakeModelIds.length === 0
                      ? 'No model selected'
                      : awakeModelIds.length === 1
                      ? models.find((model) => model.id === awakeModelIds[0])?.codeName || '1 model'
                      : `${awakeModelIds.length} models selected`}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
              </summary>
              <div className="aspira-provider-options" role="group" aria-label="Models included in replies">
                <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Choose models</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Choose providers for chat. Local actions remain available without one.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      defaultModelSelectionAppliedRef.current = true;
                      setAwakeModelIds(models.map((model) => model.id));
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    Select all
                  </button>
                </div>
                {models.map((model) => {
                  const isAwake = awakeModelIds.includes(model.id);
                  const status = providerStatusLabel(model.id);
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModelAwake(model)}
                      aria-pressed={isAwake}
                      aria-label={`${model.codeName}, ${status}, ${isAwake ? 'selected' : 'not selected'}`}
                      className={`aspira-provider-option ${isAwake ? 'is-selected' : ''}`}
                      style={{ '--provider-accent': model.accentHex } as React.CSSProperties}
                    >
                      <span className="aspira-provider-indicator" aria-hidden="true">
                        {isAwake && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="text-xs font-semibold text-slate-800">{model.codeName}</span>
                        <span className="text-[10px] text-slate-500">{status}</span>
                      </span>
                      <span className="text-[10px] text-slate-500">{isAwake ? 'On' : 'Off'}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setVaultModalOpen(true)}
                  aria-haspopup="dialog"
                  className="mt-2 w-full border-t border-slate-200 pt-2 text-left text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Manage connections
                </button>
              </div>
            </details>
            <span className="hidden text-[10px] text-slate-500 sm:inline">Enter to send · Shift+Enter for a new line</span>
          </div>

          <div className="aspira-composer-inputrow">
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-pressed={duplexVoiceActive}
              className="aspira-voice-control flex shrink-0 items-center gap-2 text-xs text-slate-600"
              title="Record a voice message locally"
            >
              <Mic className={`h-4 w-4 ${duplexVoiceActive ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline text-[11px] font-medium">
                {duplexVoiceActive ? 'Stop recording' : 'Voice'}
              </span>
            </button>

            <textarea
              ref={commandInputRef}
              rows={1}
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                liveTranscript
                  ? `Heard: “${liveTranscript}”`
                  : 'Message Aspira…'
              }
              aria-label="Message Aspira"
              className="aspira-message-input max-h-32 min-h-10 flex-1 resize-none py-2 text-sm leading-6 placeholder:text-slate-400 focus:outline-none"
            />

            {isExecuting && canCancelRequest ? (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                title="Stop the agent response. A local action already started may still finish."
                className="aspira-stop-button flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isExecuting}
                className="aspira-send-button flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                <span>{isExecuting ? 'Acting...' : 'Send'}</span>
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
      </footer>
      </div>
    </div>
  );
};

export default App;
