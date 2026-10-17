import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Inbox,
  PanelLeft,
  Settings2,
  KeyRound,
  Lock,
  Mic,
  Sliders,
  Square,
  Sparkles,
  X,
} from 'lucide-react';
import {
  BUILTIN_MODEL_PLUGINS,
  AgentActionExecution,
  FileEditProposal,
  CAPABILITY_MATRIX,
  ConversationTurn,
  DEFAULT_PASSKEY_PROFILES,
  ModelPluginManifest,
  PasskeyProfile,
  SubscriptionStatus,
} from './plugins/models/manifest';
import { runPantheonSynergy } from './plugins/models/synergyEngine';
import { modelConversationContext } from './plugins/models/conversationContext';
import { latestWorkspaceFileRead } from './plugins/models/fileReadContext';
import { updateFileEditResult } from './plugins/models/fileEditProposals';
import type { FileEditOperation, FileEditApproval, FileEditOperationResult } from './plugins/models/fileEditProposals';
import { soundEngine } from './audio/soundEngine';
import { applyTurnProgress, createPendingTurn, interruptedTurnResult } from './plugins/models/turnProgress';
import type { PendingConversationTurn } from './plugins/models/turnProgress';
import {
  persistConversationHistory, readConversationDraft, readTurnCheckpoints,
  recoverConversationHistory, writeConversationDraft, writeTurnCheckpoint, RELOADED_TURN_NOTICE,
} from './plugins/models/conversationRecovery';
import type { TurnCheckpoint } from './plugins/models/conversationRecovery';
import { ConversationWorkspace } from './components/ConversationWorkspace';
import { ConversationHistoryPanel } from './components/ConversationHistoryPanel';
import { PlugAndPlayVaultModal } from './components/PlugAndPlayVaultModal';
import { AttentionDrawer, ResultPreview, deriveAttentionItems } from './components/WorkspaceSheets';
import type { AttentionItem } from './components/WorkspaceSheets';
import {
  createConversationId,
  MAX_SAVED_CONVERSATIONS,
  readConversationHistory,
  SavedConversation,
  titleForConversation,
} from './plugins/models/conversationHistory';

export const App: React.FC = () => {
  const [initialConversationHistory] = useState(() => recoverConversationHistory(readConversationHistory(), readTurnCheckpoints()));
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
  const [initialAgentSelection] = useState<string[] | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('aspira_selected_agents_v1') || 'null');
      return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string' && models.some((model) => model.id === id)) : null;
    } catch { return null; }
  });
  const [awakeModelIds, setAwakeModelIds] = useState<string[]>(initialAgentSelection || []);
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

  // Conversation state is shared across agents; outputs open alongside it.
  const selectedCapability = CAPABILITY_MATRIX[0];
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>(initialConversationTurns);
  const [subscriptionStatuses, setSubscriptionStatuses] = useState<Record<string, SubscriptionStatus>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<PendingConversationTurn | null>(null);
  const executionInProgressRef = useRef(false);
  const [activeTaskLabel, setActiveTaskLabel] = useState('');
  const [canCancelRequest, setCanCancelRequest] = useState(false);
  const [commandInput, setCommandInput] = useState(() => readConversationDraft(initialConversationHistory.activeId));
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
  const [settingsAgentId, setSettingsAgentId] = useState<string | undefined>();
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [dismissedAttention, setDismissedAttention] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem('aspira_dismissed_notices_v1') || '[]'); return Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(-300) : []; } catch { return []; }
  });
  const [previewResult, setPreviewResult] = useState<{title: string; content: string} | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voicePreparing, setVoicePreparing] = useState(false);
  const voiceStartingRef = useRef(false);
  const [reviewDraft, setReviewDraft] = useState<{reply: string; mode: 'review' | 'continue'} | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyPersistenceError, setHistoryPersistenceError] = useState(false);
  const [recoveryPersistenceError, setRecoveryPersistenceError] = useState(false);
  const [draftPersistenceError, setDraftPersistenceError] = useState(false);

  const duplexVoiceRef = useRef(duplexVoiceActive);
  duplexVoiceRef.current = duplexVoiceActive;
  const conversationTurnsRef = useRef(conversationTurns);
  conversationTurnsRef.current = conversationTurns;
  const savedConversationsRef = useRef(savedConversations);
  savedConversationsRef.current = savedConversations;
  const abortControllerRef = useRef<AbortController | null>(null);
  const beforeNavigationRef = useRef<(() => void) | null>(null);
  const defaultModelSelectionAppliedRef = useRef(initialAgentSelection !== null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceRecordingCancelledRef = useRef(false);
  const voiceCaptureGenerationRef = useRef(0);
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileHistoryDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileHistoryTriggerRef = useRef<HTMLButtonElement | null>(null);

  const updateCommandInput = useCallback((value: string) => {
    setCommandInput(value);
    setDraftPersistenceError(!writeConversationDraft(activeConversationId, value));
  }, [activeConversationId]);

  useEffect(() => {
    const preserveBeforeLeaving = () => {
      beforeNavigationRef.current?.();
      abortControllerRef.current?.abort();
    };
    window.addEventListener('beforeunload', preserveBeforeLeaving);
    window.addEventListener('pagehide', preserveBeforeLeaving);
    return () => {
      window.removeEventListener('beforeunload', preserveBeforeLeaving);
      window.removeEventListener('pagehide', preserveBeforeLeaving);
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateHeight = () => {
      if (!viewport || viewport.scale !== 1) return;
      document.documentElement.style.setProperty('--aspira-visible-height', `${viewport.height}px`);
    };
    updateHeight();
    viewport?.addEventListener('resize', updateHeight);
    return () => { viewport?.removeEventListener('resize', updateHeight); document.documentElement.style.removeProperty('--aspira-visible-height'); };
  }, []);

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
    const saved = persistConversationHistory({ activeId: activeConversationId, conversations: savedConversations });
    setHistoryPersistenceError(!saved);
    if (saved && !executionInProgressRef.current) setRecoveryPersistenceError(false);
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
    soundEngine.onStatusChange = (message) => {
      setVoiceStatus(message);
    };
    return () => {
      soundEngine.onSpeakingStateChange = undefined;
      soundEngine.onStatusChange = undefined;
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
      Boolean(apiKeys[model.id]) || (model.id !== 'claude' && subscriptionStatuses[model.id]?.authStatus === 'signed_in') ||
      model.endpointConfig?.providerType === 'openai_compatible'
    );
    if (!connectedModel) return;

    defaultModelSelectionAppliedRef.current = true;
    setAwakeModelIds([connectedModel.id]);
  }, [models, awakeModelIds, apiKeys, subscriptionStatuses]);

  useEffect(() => {
    if (!defaultModelSelectionAppliedRef.current) return;
    try { localStorage.setItem('aspira_selected_agents_v1', JSON.stringify(awakeModelIds)); } catch { /* Current selection still works without storage. */ }
  }, [awakeModelIds]);

  useEffect(() => {
    try {
      localStorage.setItem('aspira_passkey_profiles', JSON.stringify(passkeyProfiles));
      localStorage.setItem('aspira_passkey_lock_enabled', String(passkeyLockEnabled));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [passkeyProfiles, passkeyLockEnabled]);

  // Provider availability is separate from selecting agents for a conversation.
  useEffect(() => {
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((data) => {
        if (data?.subscriptions) setSubscriptionStatuses(data.subscriptions);
      })
      .catch(() => {});
  }, []);

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

  // Execute a Conversational Turn & Real Host Actions across Awake Models
  const handleRunDirective = useCallback(
    async (
      promptText: string,
      modality: 'voice' | 'text' | 'routine' = 'text',
      speakReplyAloud = true,
      displayText?: string
    ) => {
      const cleanPrompt = promptText.trim();
      const displayedPrompt = displayText?.trim() || cleanPrompt;
      const cap = selectedCapability;
      if (!cleanPrompt || executionInProgressRef.current) return;
      executionInProgressRef.current = true;
      const activeList = models.filter((model) => awakeModelIds.includes(model.id));
      let progressTurn = createPendingTurn(displayedPrompt, modality, activeList);
      const conversationId = activeConversationId || createConversationId();
      if (!activeConversationId) {
        const draft = readConversationDraft(null);
        const saved = writeConversationDraft(conversationId, draft) && writeConversationDraft(null, '');
        setDraftPersistenceError(!saved);
        setActiveConversationId(conversationId);
      }
      let checkpoint: TurnCheckpoint = {
        conversationId,
        title: savedConversationsRef.current.find((conversation) => conversation.id === conversationId)?.title ||
          (conversationTurnsRef.current[0]?.userText || displayedPrompt).replace(/\s+/g, ' ').slice(0, 54),
        updatedAt: new Date().toISOString(), capability: { id: cap.id, name: cap.name },
        completedTurns: conversationTurnsRef.current, pending: progressTurn,
      };
      const saveCheckpoint = (finalTurn?: ConversationTurn) => {
        checkpoint = { ...checkpoint, updatedAt: new Date().toISOString(), pending: progressTurn, ...(finalTurn ? { finalTurn } : {}) };
        setRecoveryPersistenceError(!writeTurnCheckpoint(checkpoint));
      };
      saveCheckpoint();
      setPendingTurn(progressTurn);

      const concisePrompt = displayedPrompt.replace(/\s+/g, ' ');
      const taskLabel = concisePrompt.length > 88 ? `${concisePrompt.slice(0, 85)}…` : concisePrompt;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setCanCancelRequest(true);
      setActiveTaskLabel(`Working on: ${taskLabel}`);
      setIsExecuting(true);
      let navigationInterrupted = false;
      beforeNavigationRef.current = () => {
        if (navigationInterrupted) return;
        navigationInterrupted = true;
        const result = interruptedTurnResult(progressTurn, cap, false, RELOADED_TURN_NOTICE);
        const interrupted: ConversationTurn = {
          id: progressTurn.id, timestamp: progressTurn.timestamp, userText: displayedPrompt,
          inputModality: modality, result,
        };
        saveCheckpoint(interrupted);
        setConversationTurns((previous) => previous.some((turn) => turn.id === interrupted.id) ? previous : [...previous, interrupted]);
      };
      try {
        // Build multi-turn conversation history for LLM context
        const historyContext = modelConversationContext(conversationTurnsRef.current);

        const result = await runPantheonSynergy({
          prompt: cleanPrompt,
          capabilityId: cap.id,
          synergyMode: 'fusion',
          awakeModels: activeList,
          apiKeys,
          conversationHistory: historyContext,
          conversationId,
          fileReadContext: latestWorkspaceFileRead(conversationTurnsRef.current)?.fileRead,
          signal: controller.signal,
          onProgress: (event) => {
            if (controller.signal.aborted) return;
            progressTurn = applyTurnProgress(progressTurn, event);
            saveCheckpoint();
            setPendingTurn(progressTurn);

          },
        });
        if (navigationInterrupted) return;
        if (controller.signal.aborted) throw new DOMException('The request was stopped.', 'AbortError');

        const newTurn: ConversationTurn = {
          id: progressTurn.id,
          timestamp: progressTurn.timestamp,
          userText: displayedPrompt,
          inputModality: modality,
          result,
        };

        saveCheckpoint(newTurn);

        setConversationTurns((prev) => [...prev, newTurn]);

        if (result.spokenReply && speakReplyAloud && (modality === 'voice' || duplexVoiceRef.current)) {
          soundEngine.speak(result.spokenReply);
        }
      } catch (error) {
        if (navigationInterrupted) return;
        const result = interruptedTurnResult(progressTurn, cap, controller.signal.aborted,
          error instanceof Error ? error.message : 'Aspira could not complete this request.');
        const newTurn: ConversationTurn = {
          id: progressTurn.id, timestamp: progressTurn.timestamp, userText: displayedPrompt,
          inputModality: modality, result,
        };
        saveCheckpoint(newTurn);
        setConversationTurns((previous) => [...previous, newTurn]);
      } finally {
        beforeNavigationRef.current = null;
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        executionInProgressRef.current = false;
        setPendingTurn(null);
        setCanCancelRequest(false);
        setActiveTaskLabel('');
        setIsExecuting(false);
      }
    },
    [models, awakeModelIds, apiKeys, activeConversationId]
  );

  const handleEditProposalUpdate = useCallback((proposal: FileEditProposal, action?: AgentActionExecution | null) => {
    const updateTurns = (turns: ConversationTurn[]) => {
      let changed = false;
      const updated = turns.map((turn) => {
        const result = updateFileEditResult(turn.result, proposal, action);
        if (result === turn.result) return turn;
        changed = true; return { ...turn, result };
      });
      return changed ? updated : turns;
    };
    setConversationTurns(updateTurns);
    setSavedConversations((conversations) => {
      let changed = false;
      const updated = conversations.map((conversation) => {
        const turns = updateTurns(conversation.turns);
        if (turns === conversation.turns) return conversation;
        changed = true; return { ...conversation, turns, updatedAt: new Date().toISOString() };
      });
      return changed ? updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : conversations;
    });
  }, []);

  const handleEditOperation = useCallback(async (id: string, operation: FileEditOperation, approval: FileEditApproval): Promise<FileEditOperationResult> => {
    if (executionInProgressRef.current) throw new Error('Wait for the current response to finish before changing a file.');
    executionInProgressRef.current = true; setIsExecuting(true); setCanCancelRequest(false);
    setActiveTaskLabel(operation === 'apply' ? 'Applying reviewed file change' : operation === 'undo' ? 'Undoing reviewed file change' : 'Discarding edit proposal');
    try {
      const response = await fetch(`/api/file-edits/${id}/${operation}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(approval),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The edit operation could not finish.');
      handleEditProposalUpdate(data.proposal, data.action);
      return data;
    } finally {
      executionInProgressRef.current = false; setIsExecuting(false); setActiveTaskLabel('');
    }
  }, [handleEditProposalUpdate]);

  const toggleVoiceInput = useCallback(async () => {
    const currentRecorder = recorderRef.current;
    if (currentRecorder?.state === 'recording') {
      currentRecorder.stop();
      setDuplexVoiceActive(false);
      setVoiceStatus('Preparing your voice message…');
      return;
    }

    if (executionInProgressRef.current || voiceStartingRef.current || voicePreparing) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus('Voice recording is not available in this browser.');
      return;
    }

    voiceStartingRef.current = true;
    setVoicePreparing(true);
    voiceRecordingCancelledRef.current = false;
    const captureGeneration = ++voiceCaptureGenerationRef.current;
    try {
      soundEngine.stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (captureGeneration !== voiceCaptureGenerationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
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
        if (captureGeneration !== voiceCaptureGenerationRef.current) return;
        if (!audioBlob.size) {
          setVoiceStatus('No audio captured. Try again.');
          return;
        }

        try {
          setVoicePreparing(true);
          setVoiceStatus('Preparing Aspira voice input…');
          const transcript = await soundEngine.transcribe(audioBlob);
          if (captureGeneration !== voiceCaptureGenerationRef.current) return;
          if (!transcript) {
            setVoiceStatus('Aspira could not transcribe this voice message. Try again.');
            return;
          }
          setLiveTranscript(transcript);
          setVoiceStatus('Voice message received');
          await handleRunDirective(transcript, 'voice', true);
        } catch {
          if (captureGeneration === voiceCaptureGenerationRef.current) setVoiceStatus('Aspira could not process this voice message. Try again.');
        } finally { if (captureGeneration === voiceCaptureGenerationRef.current) setVoicePreparing(false); }
      };
      recorder.start();
      setDuplexVoiceActive(true);
      setVoiceStatus('Listening · click again to send');
    } catch {
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      recorderRef.current = null;
      setDuplexVoiceActive(false);
      if (!voiceRecordingCancelledRef.current) setVoiceStatus('Microphone access was not granted. Voice input stays off.');
    } finally { voiceStartingRef.current = false; setVoicePreparing(false); }
  }, [handleRunDirective, voicePreparing]);

  useEffect(() => () => {
    voiceRecordingCancelledRef.current = true;
    voiceCaptureGenerationRef.current += 1;
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

  const startNewConversation = () => {
    if (isExecuting) return;
    setReviewDraft(null); setPreviewResult(null);
    setActiveConversationId(null);
    setConversationTurns([]);
    setCommandInput(readConversationDraft(null));
    setHistorySearchTerm('');
    setMobileHistoryOpen(false);
    window.requestAnimationFrame(() => commandInputRef.current?.focus());
  };

  const selectConversation = (id: string) => {
    if (isExecuting) return;
    const conversation = savedConversations.find((item) => item.id === id);
    if (!conversation) return;
    setReviewDraft(null); setPreviewResult(null);
    setActiveConversationId(conversation.id);
    setConversationTurns(conversation.turns);
    setCommandInput(readConversationDraft(conversation.id));
    setHistorySearchTerm('');
    setMobileHistoryOpen(false);
  };

  const deleteConversation = (id: string) => {
    if (isExecuting) return;
    const conversation = savedConversations.find((item) => item.id === id);
    if (!conversation) return;
    const confirmed = window.confirm(`Delete “${conversation.title}” from this browser?`);
    if (!confirmed) return;
    setDraftPersistenceError(!writeConversationDraft(id, ''));
    setSavedConversations((previous) => previous.filter((item) => item.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setConversationTurns([]);
      setCommandInput(readConversationDraft(null));
    }
  };

  const providerStatusLabel = (modelId: string) => {
    if (apiKeys[modelId]) return 'API key saved';
    if (modelId === 'claude' && subscriptionStatuses[modelId]?.cliPath) return 'Use in Claude Code';
    if (subscriptionStatuses[modelId]?.authStatus === 'signed_in') return 'Signed in';
    if (subscriptionStatuses[modelId]?.authStatus === 'signed_out') return 'Sign-in required';
    if (subscriptionStatuses[modelId]?.cliPath) return 'CLI found';
    if (models.find((model) => model.id === modelId)?.endpointConfig?.providerType === 'openai_compatible') return 'Local endpoint';
    if (subscriptionStatuses[modelId]) return 'Connect provider';
    return 'Checking status';
  };

  const conversationLabel = conversationTurns.length ? titleForConversation(conversationTurns) : 'New conversation';
  const attentionItems = deriveAttentionItems(savedConversations, {
    id: activeConversationId || 'current', title: conversationLabel, turns: conversationTurns,
  }).filter((item) => item.kind === 'review' || !dismissedAttention.includes(item.id));
  const openAgentSettings = (id?: string) => {
    setSettingsAgentId(id);
    setMobileHistoryOpen(false);
    setVaultModalOpen(true);
  };
  const openAttentionItem = (item: AttentionItem) => {
    if (isExecuting) return;
    if (item.conversationId !== (activeConversationId || 'current')) selectConversation(item.conversationId);
    setAttentionOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`conversation-turn-${item.turnId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };
  const requestAgentReview = (reply: string) => {
    if (isExecuting) return;
    setReviewDraft({ reply, mode: 'review' });
    setPreviewResult(null);
    window.requestAnimationFrame(() => commandInputRef.current?.focus());
  };
  const handleProviderHandoff = useCallback(async (modelId: string, prompt: string) => {
    const response = await fetch('/api/subscriptions/desktop-handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, prompt }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || data?.message || 'The provider app could not be opened.');
    if (data?.result?.status !== 'success') throw new Error(data?.result?.output || 'The provider handoff did not complete.');
    return String(data.result.output || data.result.title || 'The provider app opened.');
  }, []);
  const cancelVoiceRecording = useCallback(() => {
    voiceRecordingCancelledRef.current = true;
    voiceCaptureGenerationRef.current += 1;
    recorderRef.current?.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    setDuplexVoiceActive(false);
    setVoiceStatus('Voice input is off');
    setVoicePreparing(false);
  }, []);
  useEffect(() => {
    if (!voicePanelOpen) return;
    const closeVoice = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || vaultModalOpen || attentionOpen || mobileHistoryOpen || previewResult) return;
      event.preventDefault(); cancelVoiceRecording(); soundEngine.stopSpeaking(); setVoicePanelOpen(false);
      document.querySelector<HTMLButtonElement>('.aspira-voice-control')?.focus();
    };
    window.addEventListener('keydown', closeVoice);
    return () => window.removeEventListener('keydown', closeVoice);
  }, [voicePanelOpen, vaultModalOpen, attentionOpen, mobileHistoryOpen, previewResult, cancelVoiceRecording]);

  const agentList = (mobile = false) => (
    <section className="aspira-agent-list" aria-label="Your agents">
      <div className="aspira-agent-list-heading"><h2>Your agents</h2><button type="button" aria-label="Manage your agents" onClick={() => openAgentSettings()}><Sliders aria-hidden="true" /></button></div>
      {models.map((model) => (
        <button type="button" key={model.id} className="aspira-agent-row" onClick={() => openAgentSettings(model.id)}>
          <span className="aspira-agent-avatar" aria-hidden="true">{model.codeName.slice(0, 1)}</span>
          <span><strong>{model.codeName}</strong><small>{providerStatusLabel(model.id)}</small></span>
          <span className={`aspira-agent-status-dot ${apiKeys[model.id] || (model.id !== 'claude' && subscriptionStatuses[model.id]?.authStatus === 'signed_in') ? 'is-connected' : ''}`} aria-hidden="true" />
        </button>
      ))}
      {mobile && <button type="button" className="aspira-settings-link" onClick={() => openAgentSettings()}><Settings2 aria-hidden="true" /> Settings</button>}
    </section>
  );

  const isNewConversation = conversationTurns.length === 0 && !isExecuting && !pendingTurn;
  const composer = (
      <footer className="aspira-composer-region">
        {(historyPersistenceError || recoveryPersistenceError || draftPersistenceError) && (
          <p className="aspira-persistence-notice" role="alert">
            {historyPersistenceError
              ? 'This conversation could not be saved in this browser. Free some browser storage before reloading.'
              : recoveryPersistenceError
              ? 'Live progress could not be saved in this tab. Keep it open until the response finishes.'
              : 'This draft could not be saved for reload.'}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if ((!commandInput.trim() && !reviewDraft) || executionInProgressRef.current || duplexVoiceActive) return;
            if (voicePreparing) return;
            if (reviewDraft && !awakeModelIds.length) return;
            const excerpt = reviewDraft?.reply.slice(0, 16000) || '';
            const prompt = reviewDraft
              ? `${reviewDraft.mode === 'review' ? 'Review the following prior answer. Check its reasoning and identify useful corrections.' : 'Continue from the following prior answer toward the original request.'}\n\n<prior_answer>\n${excerpt}${reviewDraft.reply.length > 16000 ? '\n[Excerpt: remaining answer omitted.]' : ''}\n</prior_answer>\n\n${commandInput.trim() ? `Additional direction: ${commandInput}` : ''}`
              : commandInput;
            const displayText = reviewDraft ? `${reviewDraft.mode === 'review' ? 'Review this answer' : 'Continue from this answer'}${commandInput.trim() ? `\n\n${commandInput.trim()}` : ''}` : undefined;
            setReviewDraft(null);
            updateCommandInput('');
            handleRunDirective(prompt, 'text', true, displayText);
          }}
          className="aspira-composer"
        >
          {reviewDraft && <section className="aspira-review-context" aria-label="Context shared with the selected agents">
            <div><strong>Bring another perspective</strong><button type="button" aria-label="Cancel agent handoff" onClick={() => setReviewDraft(null)}><X aria-hidden="true" /></button></div>
            <div className="aspira-review-mode"><button type="button" aria-pressed={reviewDraft.mode === 'review'} onClick={() => setReviewDraft({...reviewDraft, mode:'review'})}>Review this answer</button><button type="button" aria-pressed={reviewDraft.mode === 'continue'} onClick={() => setReviewDraft({...reviewDraft, mode:'continue'})}>Continue from here</button></div>
            <details><summary>Review what will be shared</summary><p>{reviewDraft.reply.slice(0,16000)}{reviewDraft.reply.length > 16000 ? '\n[Remaining answer omitted.]' : ''}</p></details>
            <small>Choose who replies below. This answer, recent conversation, and your saved context will be included when you send.</small>
          </section>}
          <div className="aspira-composer-toolbar">
            <details
              className="aspira-provider-picker"
              aria-label="Choose agents for this reply"
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
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">With</span>
                  <span className="max-w-[240px] truncate text-xs font-semibold text-slate-800">
                    {awakeModelIds.length === 0
                      ? 'Choose an agent'
                      : awakeModelIds.length === 1
                      ? models.find((model) => model.id === awakeModelIds[0])?.codeName || '1 model'
                      : `${awakeModelIds.length} agents`}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
              </summary>
              <div className="aspira-provider-options" role="group" aria-label="Agents included in replies">
                <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Choose your agents</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-500">The first selected agent can use tools; additional agents give their own perspective.</p>
                  </div>

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
                  onClick={() => openAgentSettings()}
                  aria-haspopup="dialog"
                  className="mt-2 w-full border-t border-slate-200 pt-2 text-left text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Manage your agents
                </button>
              </div>
            </details>
          </div>

          <div className="aspira-composer-inputrow">
            <button
              type="button"
              onClick={() => setVoicePanelOpen((open) => !open)}
              aria-expanded={voicePanelOpen}
              aria-controls="aspira-voice-panel"
              disabled={isExecuting && !duplexVoiceActive}
              aria-label="Aspira voice input"
              className="aspira-voice-control flex shrink-0 items-center gap-2 text-xs text-slate-600"
              title={duplexVoiceActive
                ? 'Open the voice panel to finish or cancel your message.'
                : 'Open built-in voice. Recording starts only when you choose Record a message.'}
            >
              <Mic className={`h-4 w-4 ${duplexVoiceActive ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline text-[11px] font-medium">
                Voice
              </span>
            </button>

            <textarea
              ref={commandInputRef}
              rows={1}
              value={commandInput}
              onChange={(e) => updateCommandInput(e.target.value)}
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
                key="stop-response"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  abortControllerRef.current?.abort();
                }}
                title="Stop the agent response. A local action already started may still finish."
                className="aspira-stop-button flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                key="send-message"
                type="submit"
                disabled={isExecuting || duplexVoiceActive || voicePreparing || (!commandInput.trim() && !reviewDraft) || Boolean(reviewDraft && !awakeModelIds.length)}
                className="aspira-send-button flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                <span>{isExecuting ? 'Acting...' : 'Send'}</span>
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
        {voicePanelOpen && <section className="aspira-voice-panel" id="aspira-voice-panel" aria-label="Voice conversation">
          <div><span><Mic aria-hidden="true" /><strong>{duplexVoiceActive ? 'Listening' : /prepar|download/i.test(voiceStatus) ? 'Preparing voice' : isAgentSpeaking ? 'Aspira is speaking' : 'Voice, built into Aspira'}</strong></span><button type="button" aria-label="Close voice panel" onClick={() => { cancelVoiceRecording(); soundEngine.stopSpeaking(); setVoicePanelOpen(false); }}><X aria-hidden="true" /></button></div>
          <p role="status">{voiceStatus === 'Voice input is off' ? 'Record a message and hear the reply. No separate service to connect.' : voiceStatus}</p>
          {liveTranscript && <blockquote>{liveTranscript}</blockquote>}
          <div className="aspira-voice-panel-actions"><button type="button" className="aspira-voice-record" disabled={(isExecuting || voicePreparing) && !duplexVoiceActive} onClick={toggleVoiceInput}>{duplexVoiceActive ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}{duplexVoiceActive ? 'Stop & send' : voicePreparing ? 'Preparing voice…' : 'Record a message'}</button>{duplexVoiceActive && <button type="button" onClick={cancelVoiceRecording}>Cancel recording</button>}{isAgentSpeaking && <button type="button" onClick={() => soundEngine.stopSpeaking()}><Square aria-hidden="true" /> Stop playback</button>}</div>
          <small>Audio is processed in this browser. Sending a voice message shares its transcript with your selected agents.</small>
        </section>}
        <p className="aspira-composer-note">{awakeModelIds.length ? 'Your agents, one conversation.' : 'Choose an agent to chat. Supported local actions are also available.'}</p>
      </footer>
  );

  return (
    <div className="aspira-shell aspira-workspace relative flex h-screen w-screen overflow-hidden aspira-canvas-bg">
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
        initialModelId={settingsAgentId}
        onClose={() => setVaultModalOpen(false)}
        models={models}
        initialSubscriptions={subscriptionStatuses}
        onSubscriptionsUpdated={setSubscriptionStatuses}
        awakeModelIds={awakeModelIds}
        onUseModel={(modelId) => {
          defaultModelSelectionAppliedRef.current = true;
          setAwakeModelIds((prev) => prev.includes(modelId) ? prev : [...prev, modelId]);
              setVaultModalOpen(false);
        }}
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
            return true;
          } catch {
            return false;
          }
        }}
        voiceStatus={voiceStatus}
        isVoicePlaying={isAgentSpeaking}
        onPreviewVoice={() => {
          if (isAgentSpeaking) {
            soundEngine.stopSpeaking();
            return;
          }
          void soundEngine.speak("Hi, I'm Aspira. I'm here to help you think things through and get useful work done.");
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
            {agentList(true)}
          </div>
        </div>
      )}

      <AttentionDrawer disabled={isExecuting} onDismiss={(id) => setDismissedAttention((previous) => { const next = [...new Set([...previous,id])].slice(-300); try { localStorage.setItem('aspira_dismissed_notices_v1',JSON.stringify(next)); } catch { /* Notices can still be dismissed for this session. */ } return next; })} open={attentionOpen} onClose={() => setAttentionOpen(false)} items={attentionItems} onSelect={openAttentionItem} />
      <aside className="aspira-sidebar hidden lg:flex">
        <div className="aspira-sidebar-brand">
          <div className="aspira-brand-mark"><Sparkles aria-hidden="true" /></div>
          <span>Aspira</span>
        </div>
        <ConversationHistoryPanel
          conversations={savedConversations} activeId={activeConversationId}
          searchTerm={historySearchTerm} isExecuting={isExecuting} persistenceError={historyPersistenceError}
          onSearchChange={setHistorySearchTerm} onNewChat={startNewConversation}
          onSelect={selectConversation} onDelete={deleteConversation}
        />
        {agentList()}
        <button type="button" className="aspira-settings-link" onClick={() => openAgentSettings()}><Settings2 aria-hidden="true" /> Settings</button>
      </aside>

      <div className="aspira-app-content flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="aspira-topbar">
          <div className="aspira-conversation-heading">
            <button ref={mobileHistoryTriggerRef} type="button" className="aspira-navigation-trigger" aria-label="Recent conversations" aria-haspopup="dialog" onClick={() => setMobileHistoryOpen(true)}><PanelLeft aria-hidden="true" /></button>
            <span className="aspira-mobile-wordmark">Aspira<span aria-hidden="true"> / </span></span>
            <h1>{conversationLabel}</h1>
          </div>
          <div className="aspira-topbar-actions">
            <button type="button" className={`aspira-attention-trigger ${attentionItems.length ? 'has-items' : ''}`} onClick={() => setAttentionOpen(true)} aria-haspopup="dialog"><Inbox aria-hidden="true" /><span>Needs you</span><span className="aspira-attention-count">{attentionItems.length}</span></button>
            {passkeyLockEnabled && passkeyProfiles[0]?.phrase.trim() && <button type="button" className="aspira-lock-trigger" aria-label="Lock this browser session" onClick={() => { soundEngine.stopSpeaking(); cancelVoiceRecording(); setBootState('locked'); setUnlockPhrase(''); setUnlockError(''); }}><Lock aria-hidden="true" /></button>}
          </div>
        </header>
        <div className={`aspira-workspace-body ${previewResult ? 'has-preview' : ''}`}>
          <div className={`aspira-conversation-column ${isNewConversation ? 'is-new-conversation' : ''}`}>
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

      <main className="aspira-main-conversation">
        <ConversationWorkspace
          models={models}
          awakeModelIds={awakeModelIds}
          conversationTurns={conversationTurns}
          pendingTurn={pendingTurn}
          onEditProposalUpdate={handleEditProposalUpdate}
          onEditOperation={handleEditOperation}
          isExecuting={isExecuting}
          activeTaskLabel={activeTaskLabel}
          onRunPrompt={(prompt) => handleRunDirective(prompt, 'text', true)}
          onOpenConnections={() => openAgentSettings()}
          onPreviewResult={(title, content) => setPreviewResult({title, content})}
          onRequestAgentReview={requestAgentReview}
          onProviderHandoff={handleProviderHandoff}
          handoffModelIds={models.filter((model) => ['gpt', 'claude', 'argon', 'grok'].includes(model.id)).map((model) => model.id)}
          welcomeComposer={isNewConversation ? composer : undefined}
        />
      </main>

      {!isNewConversation && composer}

          </div>
          <ResultPreview result={previewResult} onClose={() => setPreviewResult(null)} />
        </div>
      </div>
    </div>
  );
};

export default App;
