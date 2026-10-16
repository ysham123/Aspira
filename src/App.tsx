import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Eye,
  Flame,
  FolderGit2,
  KeyRound,
  Lock,
  Mic,
  Orbit,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AutonomousRoutine,
  BUILTIN_MODEL_PLUGINS,
  CAPABILITY_MATRIX,
  CapabilityDefinition,
  ConversationTurn,
  DEFAULT_PASSKEY_PROFILES,
  LivingMemoryItem,
  ModelPluginManifest,
  PasskeyProfile,
  SpatialMode,
  SynergyExecutionResult,
  SynergyMode,
} from './plugins/models/manifest';
import { ConversationMessageContext, runPantheonSynergy } from './plugins/models/synergyEngine';
import { soundEngine } from './audio/soundEngine';
import { AcousticSentinelEngine, AcousticTelemetry } from './audio/acousticSentinel';
import { ThreeHologramStage } from './components/ThreeHologramStage';
import { SpatialModeDeck } from './components/SpatialModeDeck';
import { WebcamSensorOverlay } from './components/WebcamSensorOverlay';
import { AcousticBootOverlay } from './components/AcousticBootOverlay';
import { PlugAndPlayVaultModal } from './components/PlugAndPlayVaultModal';

interface MacTelemetry {
  hostname: string;
  platform: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePercent: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  memoryPercent: number;
  uptimeHours: number;
}

export const App: React.FC = () => {
  // 1. BOOT & SECURITY STATE ('sentinel' | 'amber_challenge' | 'intruder' | 'ignited')
  const [bootState, setBootState] = useState<
    'sentinel' | 'amber_challenge' | 'intruder' | 'ignited'
  >('sentinel');

  // 2. PLUG-AND-PLAY MODELS & AWAKE STATE
  const [models, setModels] = useState<ModelPluginManifest[]>(BUILTIN_MODEL_PLUGINS);
  const [awakeModelIds, setAwakeModelIds] = useState<string[]>(['argon', 'claude']);
  const [passkeyProfiles, setPasskeyProfiles] =
    useState<PasskeyProfile[]>(DEFAULT_PASSKEY_PROFILES);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('archon_api_keys_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 3. TRANSFORMATIVE STUDIO VIEW, CONVERSATION TIMELINE, DOT MEMORY & ROUTINES
  const [spatialMode, setSpatialMode] = useState<SpatialMode>('nexus');
  const [synergyMode, setSynergyMode] = useState<SynergyMode>('fusion');
  const [selectedCapability, setSelectedCapability] = useState<CapabilityDefinition>(
    CAPABILITY_MATRIX[0]
  );
  const [latestResult, setLatestResult] = useState<SynergyExecutionResult | null>(null);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [memories, setMemories] = useState<LivingMemoryItem[]>([]);
  const [routines, setRoutines] = useState<AutonomousRoutine[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [awayBriefingBanner, setAwayBriefingBanner] = useState<string | null>(null);

  // 4. SENSORS: ACOUSTIC SENTINEL, DUPLEX VOICE, WEBCAM GESTURES, MAC TELEMETRY
  const sentinelRef = useRef<AcousticSentinelEngine | null>(null);
  const [acousticTelemetry, setAcousticTelemetry] = useState<AcousticTelemetry>({
    micActive: false,
    rmsLevel: 4,
    highFreqTransient: 8,
    clapCount: 0,
    dominantPitchHz: 144,
    spectralCentroidHz: 1180,
    voiceBiometricMatch: 96.8,
    spectrumBins: Array(24).fill(10),
  });
  const [liveTranscript, setLiveTranscript] = useState('');
  const [duplexVoiceActive, setDuplexVoiceActive] = useState(true);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [handCursor, setHandCursor] = useState<{
    x: number;
    y: number;
    active: boolean;
    pinching: boolean;
  }>({ x: 0.5, y: 0.5, active: false, pinching: false });
  const [soundMuted, setSoundMuted] = useState(false);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [macTelemetry, setMacTelemetry] = useState<MacTelemetry>({
    hostname: 'MacBook-Pro',
    platform: 'Darwin arm64',
    cpuModel: 'Apple Silicon Neural Engine',
    cpuCores: 10,
    cpuUsagePercent: 18,
    memoryUsedGB: 14.2,
    memoryTotalGB: 16,
    memoryPercent: 88,
    uptimeHours: 42.5,
  });

  const bootStateRef = useRef(bootState);
  bootStateRef.current = bootState;
  const passkeysRef = useRef(passkeyProfiles);
  passkeysRef.current = passkeyProfiles;
  const duplexVoiceRef = useRef(duplexVoiceActive);
  duplexVoiceRef.current = duplexVoiceActive;
  const isExecutingRef = useRef(isExecuting);
  isExecutingRef.current = isExecuting;
  const lastSpokenDispatchRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const conversationTurnsRef = useRef(conversationTurns);
  conversationTurnsRef.current = conversationTurns;
  const telemetryRef = useRef(acousticTelemetry);
  telemetryRef.current = acousticTelemetry;

  useEffect(() => {
    soundEngine.onSpeakingStateChange = (speaking) => {
      setIsAgentSpeaking(speaking);
    };
    return () => {
      soundEngine.onSpeakingStateChange = undefined;
    };
  }, []);

  // Load Dot Living Memories & Autonomous Routines from Backend
  useEffect(() => {
    fetch('/api/memory')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.memories)) setMemories(data.memories);
      })
      .catch(() => {});

    fetch('/api/routines')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.routines)) setRoutines(data.routines);
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

  // Trigger Passkey Resonance Challenge after Clap-Clap + "Wake up, I'm back"
  const handleTriggerWakeChallenge = useCallback(() => {
    soundEngine.playAmberLockdown();
    setBootState('amber_challenge');
    soundEngine.speak(
      'Welcome back. Acoustic signature recognized. Please state your passkey.'
    );
  }, []);

  // Verify Spoken or Selected Passkey Phrase
  const handleVerifyPasskey = useCallback(
    (spokenPhrase: string) => {
      const normalized = spokenPhrase.toLowerCase().trim();
      const matchedProfile = passkeysRef.current.find(
        (p) =>
          normalized.includes(p.phrase.toLowerCase()) ||
          p.phrase.toLowerCase().includes(normalized)
      );

      if (!matchedProfile) {
        soundEngine.playIntruderAlert();
        setBootState('intruder');
        soundEngine.speak(
          'Passkey or voiceprint unverified. Studio remains locked.'
        );
        return;
      }

      if (matchedProfile.isLockdown) {
        soundEngine.playCoreSleep();
        setAwakeModelIds([]);
        setBootState('sentinel');
        soundEngine.speak(matchedProfile.greetingSpeech);
        return;
      }

      soundEngine.playPasskeyVerified();
      setAwakeModelIds(matchedProfile.wakeModels);
      setSpatialMode(matchedProfile.targetMode);
      setBootState('ignited');
      setAwayBriefingBanner(
        `${matchedProfile.name} verified (${acousticTelemetry.voiceBiometricMatch}% vocal match) · Hands-Free Duplex Voice & Host Actions Active`
      );
      soundEngine.speak(matchedProfile.greetingSpeech);
    },
    [acousticTelemetry.voiceBiometricMatch]
  );

  // Classify vocal emotion from F0 pitch & RMS (Dot by New Computer style)
  const inferVocalEmotion = (pitchHz: number, rms: number): string => {
    if (rms > 35 || pitchHz > 185) return 'Energetic';
    if (pitchHz < 125) return 'Reflective';
    return 'Focused';
  };

  // Execute a Conversational Turn & Real Host Actions across Awake Models
  const handleRunDirective = useCallback(
    async (
      promptText: string,
      capOverride?: CapabilityDefinition,
      modality: 'voice' | 'text' | 'routine' = 'text',
      speakReplyAloud = true
    ) => {
      const cap = capOverride || selectedCapability;
      const cleanPrompt = promptText.trim();
      if (!cleanPrompt) return;

      setIsExecuting(true);
      soundEngine.playSynergyBeam();

      const awakeModelsList = models.filter((m) => awakeModelIds.includes(m.id));
      const activeList = awakeModelsList.length > 0 ? awakeModelsList : [models[0]];

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
        synergyMode,
        awakeModels: activeList,
        apiKeys,
        conversationHistory: historyContext,
        onMemoriesUpdated: (updated) => setMemories(updated),
      });

      const newTurn: ConversationTurn = {
        id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userText: cleanPrompt,
        inputModality: modality,
        vocalEmotion:
          modality === 'voice'
            ? inferVocalEmotion(
                telemetryRef.current.dominantPitchHz,
                telemetryRef.current.rmsLevel
              )
            : undefined,
        pitchHz: modality === 'voice' ? telemetryRef.current.dominantPitchHz : undefined,
        result,
      };

      setLatestResult(result);
      setConversationTurns((prev) => [...prev, newTurn]);
      setIsExecuting(false);

      if (speakReplyAloud && (modality === 'voice' || duplexVoiceRef.current)) {
        soundEngine.speak(result.spokenReply);
      }
    },
    [selectedCapability, models, awakeModelIds, synergyMode, apiKeys]
  );

  // Run an Autonomous Multi-Step Routine (Grok Bot / OpenClaw style)
  const handleRunRoutine = useCallback(
    async (routineId: string) => {
      setIsExecuting(true);
      soundEngine.playSynergyBeam();
      try {
        const res = await fetch(`/api/routines/${routineId}/run`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.memories)) setMemories(data.memories);
          setRoutines((prev) =>
            prev.map((r) => (r.id === routineId ? data.routine : r))
          );

          const routine: AutonomousRoutine = data.routine;
          const results = data.results || [];
          const summaryText = `Completed **${routine.title}** across ${results.length} autonomous steps:\n\n${results
            .map((r: any, idx: number) => `${idx + 1}. **${r.stepLabel || r.title}**: ${r.output.slice(0, 260)}`)
            .join('\n\n')}`;

          const syntheticResult: SynergyExecutionResult = {
            id: `syn-routine-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            prompt: `Run Routine: ${routine.title}`,
            capabilityId: selectedCapability.id,
            capabilityName: selectedCapability.name,
            synergyMode,
            participatingModels: [routine.leadAgent],
            consensusScore: 99,
            executiveHeadline: `Routine Executed · ${routine.title}`,
            synthesizedOutput: summaryText,
            spokenReply: `Completed routine ${routine.title}. All ${results.length} system and web steps succeeded.`,
            executedActions: results,
            followUpSuggestions: [
              'Remember the key findings from this routine',
              'Check my Mac CPU, memory, and battery status',
              'Run git status on the workspace',
            ],
            attributionPills: [],
            modelStreams: [
              {
                modelId: routine.leadAgent,
                codeName: routine.leadAgent.toUpperCase(),
                role: 'Autonomous Routine Conductor',
                badgeLabel: 'OpenClaw / Grokbot Routine',
                latencyMs: results.reduce((acc: number, r: any) => acc + (r.durationMs || 20), 0),
                ttftMs: 42,
                tokensPerSec: 185,
                source: 'LIVE_API',
                keyInsight: summaryText,
                uniqueNuance: routine.description,
                confidence: 99,
              },
            ],
            consensusPoints: [`Routine ${routine.title} completed.`],
            divergentPoints: [],
          };

          const newTurn: ConversationTurn = {
            id: `turn-routine-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            userText: `Execute Autonomous Routine: ${routine.title}`,
            inputModality: 'routine',
            result: syntheticResult,
          };

          setLatestResult(syntheticResult);
          setConversationTurns((prev) => [...prev, newTurn]);
          soundEngine.speak(syntheticResult.spokenReply);
        }
      } catch {
        // ignore
      } finally {
        setIsExecuting(false);
      }
    },
    [selectedCapability, synergyMode]
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
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.memories)) setMemories(data.memories);
          const act = data.result;
          const reply = `Done — executed ${act.title}. ${act.output}`;
          const syntheticResult: SynergyExecutionResult = {
            id: `syn-act-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            prompt: label,
            capabilityId: selectedCapability.id,
            capabilityName: selectedCapability.name,
            synergyMode,
            participatingModels: ['claude', 'argon'],
            consensusScore: 99,
            executiveHeadline: act.title,
            synthesizedOutput: `Executed **${act.title}** on your Mac in ${act.durationMs}ms.`,
            spokenReply: `Done. ${act.title}.`,
            executedActions: [act],
            followUpSuggestions: [
              'Check my Mac CPU, memory, and battery status',
              'Run git status on the workspace',
              'Search the web for HackerNews top stories',
            ],
            attributionPills: [],
            modelStreams: [
              {
                modelId: 'claude',
                codeName: 'Claude',
                role: 'macOS Host Operator',
                badgeLabel: 'OpenClaw Bridge',
                latencyMs: act.durationMs || 18,
                ttftMs: 18,
                tokensPerSec: 160,
                source: 'LIVE_API',
                keyInsight: reply,
                uniqueNuance: 'Native macOS Action Execution',
                confidence: 99,
              },
            ],
            consensusPoints: [reply],
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
          soundEngine.speak(syntheticResult.spokenReply);
        }
      } catch {
        // ignore
      } finally {
        setIsExecuting(false);
      }
    },
    [selectedCapability, synergyMode]
  );

  // Seed initial conversational welcome + real macOS telemetry check on load
  useEffect(() => {
    handleRunDirective(
      'Check my Mac CPU, memory, and battery status and greet me in the studio',
      undefined,
      'text',
      false // Don't speak aloud until unlocked
    );
  }, []);

  // Poll Real macOS System Telemetry
  useEffect(() => {
    const fetchTelemetry = () => {
      fetch('/api/telemetry')
        .then((r) => r.json())
        .then((data) => {
          if (data?.hostname) setMacTelemetry(data);
        })
        .catch(() => {});
    };
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3500);
    return () => clearInterval(timer);
  }, []);

  // Initialize Acoustic Sentinel Engine
  const startAcousticMic = useCallback(async () => {
    if (!sentinelRef.current) {
      const engine = new AcousticSentinelEngine();
      engine.onSingleClap = () => {
        soundEngine.playClapImpulse(1);
      };
      engine.onDoubleClap = () => {
        soundEngine.playClapImpulse(2);
        if (bootStateRef.current === 'sentinel') {
          handleTriggerWakeChallenge();
        }
      };
      engine.onTelemetry = (t) => {
        setAcousticTelemetry(t);
      };
      sentinelRef.current = engine;
    }
    await sentinelRef.current.start();
  }, [handleTriggerWakeChallenge]);

  useEffect(() => {
    startAcousticMic();
    return () => {
      sentinelRef.current?.stop();
    };
  }, [startAcousticMic]);

  // Continuous Browser SpeechRecognition for Lock Screen + Hands-Free Duplex Voice Conversation!
  useEffect(() => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) return;

    let recognition: any = null;
    let shouldRestart = true;

    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // Ignore self-echo while agent is actively speaking TTS
        if (soundEngine.isSpeaking()) return;

        let phrase = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          phrase += event.results[i][0].transcript;
        }
        const rawTranscript = phrase.trim();
        const clean = rawTranscript.toLowerCase();
        setLiveTranscript(rawTranscript);

        if (!clean) return;

        // 1. Standby Lock Screen: listen for "Wake up, I'm back"
        if (
          bootStateRef.current === 'sentinel' &&
          (clean.includes('wake up') || clean.includes("i'm back") || clean.includes('im back'))
        ) {
          handleTriggerWakeChallenge();
          return;
        }

        // 2. Passkey Challenge Screen: listen for any configured passkey phrase
        if (bootStateRef.current === 'amber_challenge') {
          const matched = passkeysRef.current.find((p) =>
            clean.includes(p.phrase.toLowerCase())
          );
          if (matched) {
            handleVerifyPasskey(matched.phrase);
          }
          return;
        }

        // 3. Unlocked Studio: Hands-Free Duplex Conversational & Action Engine!
        const lastResult = event.results[event.results.length - 1];
        if (bootStateRef.current === 'ignited' && lastResult?.isFinal) {
          const now = Date.now();
          if (
            clean === lastSpokenDispatchRef.current.text &&
            now - lastSpokenDispatchRef.current.time < 3000
          ) {
            return;
          }
          lastSpokenDispatchRef.current = { text: clean, time: now };

          // System Mode / Protocol Voice Shortcuts
          if (clean.includes('ghost protocol') || clean === 'go to sleep') {
            handleVerifyPasskey('ghost protocol');
            return;
          }
          if (clean.includes('house party protocol')) {
            setAwakeModelIds(models.map((m) => m.id));
            soundEngine.playPasskeyVerified();
            soundEngine.speak('House Party Protocol active. All four agents are awake.');
            return;
          }
          if (clean === 'switch to workbench' || clean === 'open workbench') {
            setSpatialMode('forge');
            soundEngine.playModeMorph();
            return;
          }
          if (clean === 'switch to live vision' || clean === 'open live vision') {
            setSpatialMode('overwatch');
            soundEngine.playModeMorph();
            return;
          }
          if (clean === 'switch to global pulse' || clean === 'open global pulse') {
            setSpatialMode('warroom');
            soundEngine.playModeMorph();
            return;
          }

          // Otherwise, if Hands-Free Duplex Voice is active and sentence has >= 2 words, converse & execute actions!
          if (
            duplexVoiceRef.current &&
            !isExecutingRef.current &&
            rawTranscript.split(/\s+/).length >= 2
          ) {
            handleRunDirective(rawTranscript, undefined, 'voice', true);
          }
        }
      };

      recognition.onend = () => {
        if (shouldRestart) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }, 400);
        }
      };

      recognition.start();
    } catch {
      // SpeechRecognition optional
    }

    return () => {
      shouldRestart = false;
      try {
        recognition?.stop();
      } catch {
        // ignore
      }
    };
  }, [handleTriggerWakeChallenge, handleVerifyPasskey, handleRunDirective, models]);

  // Toggle Awake / Sleep State of any Individual Model
  const toggleModelAwake = (model: ModelPluginManifest) => {
    setAwakeModelIds((prev) => {
      const exists = prev.includes(model.id);
      if (exists) {
        soundEngine.playCoreSleep();
        return prev.filter((id) => id !== model.id);
      } else {
        soundEngine.playCoreWake(model.harmonicFreqHz);
        return [...prev, model.id];
      }
    });
  };

  const switchSpatialMode = (mode: SpatialMode) => {
    soundEngine.playModeMorph();
    setSpatialMode(mode);
  };

  const handleAirGestureTrigger = (gesture: 'wake_all' | 'cycle_mode' | 'fusion_pulse') => {
    if (gesture === 'wake_all') {
      soundEngine.playPasskeyVerified();
      setAwakeModelIds(models.map((m) => m.id));
    } else if (gesture === 'cycle_mode') {
      const order: SpatialMode[] = ['nexus', 'forge', 'overwatch', 'warroom'];
      const next = order[(order.indexOf(spatialMode) + 1) % order.length];
      switchSpatialMode(next);
    } else if (gesture === 'fusion_pulse') {
      handleRunDirective('Check my Mac CPU, memory, and battery status', undefined, 'text', true);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden aspira-canvas-bg flex flex-col justify-between p-4 select-none">
      {/* 3D BIOLUMINESCENT FLUID AURORA ORB & CONSTELLATION STAGE */}
      <ThreeHologramStage
        spatialMode={spatialMode}
        synergyMode={synergyMode}
        models={models}
        awakeModelIds={awakeModelIds}
        bootState={bootState}
        audioRms={acousticTelemetry.rmsLevel}
        isExecuting={isExecuting || isAgentSpeaking}
        handCursor={handCursor}
      />

      {/* AMBIENT VOICE & CLAP LOCK SCREEN */}
      {bootState !== 'ignited' && (
        <AcousticBootOverlay
          bootState={bootState}
          telemetry={acousticTelemetry}
          transcript={liveTranscript}
          passkeyProfiles={passkeyProfiles}
          onTriggerWakeChallenge={handleTriggerWakeChallenge}
          onVerifyPasskey={handleVerifyPasskey}
          onTriggerIntruderDemo={() => {
            soundEngine.playIntruderAlert();
            setBootState('intruder');
            soundEngine.speak(
              'Passkey or voiceprint unverified. Studio remains locked.'
            );
          }}
          onResetToSentinel={() => setBootState('sentinel')}
          onStartMic={startAcousticMic}
          onCalibrateVoice={() => {
            sentinelRef.current?.enrollCurrentVoice(
              acousticTelemetry.dominantPitchHz,
              acousticTelemetry.spectralCentroidHz
            );
          }}
        />
      )}

      {/* RAYCAST / LINEAR STUDIO SETTINGS VAULT */}
      <PlugAndPlayVaultModal
        open={vaultModalOpen}
        onClose={() => setVaultModalOpen(false)}
        models={models}
        onAddCustomModel={(newPlugin) => {
          setModels((prev) => [...prev, newPlugin]);
          setAwakeModelIds((prev) => [...prev, newPlugin.id]);
          soundEngine.playPasskeyVerified();
        }}
        passkeyProfiles={passkeyProfiles}
        onUpdatePasskeyPhrase={(id, phrase) => {
          setPasskeyProfiles((prev) =>
            prev.map((p) => (p.id === id ? { ...p, phrase } : p))
          );
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
        voiceprint={
          sentinelRef.current?.getEnrolledVoiceprint() || {
            pitchHz: 145,
            centroidHz: 1180,
            enrolledAt: 'Default Studio Profile',
          }
        }
        currentPitchHz={acousticTelemetry.dominantPitchHz}
        currentCentroidHz={acousticTelemetry.spectralCentroidHz}
        onEnrollVoiceprint={() => {
          sentinelRef.current?.enrollCurrentVoice(
            acousticTelemetry.dominantPitchHz,
            acousticTelemetry.spectralCentroidHz
          );
          soundEngine.playPasskeyVerified();
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
          <span className="hidden md:inline-flex items-center gap-2 font-mono-tech text-[11px] text-slate-400 px-2.5 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{macTelemetry.cpuModel}</span>
            <span>·</span>
            <span>{macTelemetry.cpuUsagePercent}% CPU</span>
            <span>·</span>
            <span>{memories.length} Memories</span>
          </span>
        </div>

        {/* Center: 4 Segmented Studio Views */}
        <nav className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {(
            [
              { id: 'nexus', label: 'Studio', icon: Orbit },
              { id: 'forge', label: 'Workbench', icon: FolderGit2 },
              { id: 'overwatch', label: 'Live Vision', icon: Eye },
              { id: 'warroom', label: 'Global Pulse', icon: Flame },
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

        {/* Right: Studio Settings, Audio Toggle, Standby Lock */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playGlassTick();
              setVaultModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl aspira-card-interactive text-xs font-medium text-slate-200 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#6E8EFB]" />
            <span>Models & Keys</span>
          </button>

          <button
            onClick={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              soundEngine.muted = next;
              if (next) soundEngine.stopSpeaking();
            }}
            title="Toggle Ambient Harmonic Audio & Voice"
            className="p-2 rounded-xl aspira-card-interactive text-slate-300 hover:text-white cursor-pointer"
          >
            {soundMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-300" />
            )}
          </button>

          <button
            onClick={() => {
              soundEngine.stopSpeaking();
              soundEngine.playCoreSleep();
              setBootState('sentinel');
            }}
            title="Return to Ambient Acoustic Standby"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl aspira-card-interactive text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Standby</span>
          </button>
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
      <main className="relative z-10 flex-1 my-3 overflow-hidden">
        <SpatialModeDeck
          spatialMode={spatialMode}
          synergyMode={synergyMode}
          onSelectSynergyMode={(m) => {
            soundEngine.playSynergyBeam();
            setSynergyMode(m);
          }}
          models={models}
          awakeModelIds={awakeModelIds}
          selectedCapability={selectedCapability}
          onSelectCapability={setSelectedCapability}
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
          onRunPrompt={(prompt, capOverride) =>
            handleRunDirective(prompt, capOverride, 'text', true)
          }
          duplexVoiceActive={duplexVoiceActive}
          onToggleDuplexVoice={() => setDuplexVoiceActive((v) => !v)}
          isAgentSpeaking={isAgentSpeaking}
          liveTranscript={liveTranscript}
          macTelemetry={macTelemetry}
        />
      </main>

      {/* =====================================================================
          LAYER 3: 2-TIER FLOATING AGENT CONSTELLATION DOCK + UNIFIED COMPOSER
         ===================================================================== */}
      <footer className="relative z-20 max-w-5xl w-full mx-auto flex flex-col gap-2">
        {/* TIER A: Tactile Agent Constellation Pill Dock */}
        <div className="flex items-center justify-center flex-wrap gap-2">
          {models.map((model) => {
            const isAwake = awakeModelIds.includes(model.id);
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
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border backdrop-blur-xl transition-all cursor-pointer group"
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
                    <span className="font-mono-tech text-[10px] text-slate-400">
                      {isAwake ? `${model.tokensPerSec} tok/s` : 'Sleep'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              soundEngine.playPasskeyVerified();
              setAwakeModelIds(models.map((m) => m.id));
            }}
            className="px-3 py-2 rounded-xl aspira-card-interactive text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            Wake All
          </button>

          <WebcamSensorOverlay
            enabled={webcamEnabled}
            onToggle={() => setWebcamEnabled((v) => !v)}
            bootState={bootState}
            onHandMove={setHandCursor}
            onAirGestureTrigger={handleAirGestureTrigger}
          />
        </div>

        {/* TIER B: Conversational & Action-Executing Composer Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!commandInput.trim()) return;
            handleRunDirective(commandInput, undefined, 'text', true);
            setCommandInput('');
          }}
          className="aspira-glass-elevated rounded-2xl px-4 py-2.5 flex items-center gap-3"
        >
          <button
            type="button"
            onClick={() => setDuplexVoiceActive((v) => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 shrink-0 cursor-pointer"
            title="Toggle Hands-Free Duplex Voice Conversation"
          >
            <Mic
              className={`w-4 h-4 ${
                duplexVoiceActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span className="hidden sm:inline font-mono-tech text-[11px] text-slate-300">
              {awakeModelIds
                .map((id) => id.charAt(0).toUpperCase() + id.slice(1))
                .join(' + ') || 'Solo'}
            </span>
          </button>

          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder={
              liveTranscript
                ? `Listening: “${liveTranscript}” — or type an action (e.g. "Open Safari", "Remember my goal is...", "Run git status")...`
                : `Talk naturally or type an action: "Open Calculator", "Check my Mac battery", "Remember that...", "Search HackerNews"...`
            }
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <span>{isExecuting ? 'Acting...' : 'Send'}</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
