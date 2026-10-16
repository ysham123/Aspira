import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  Eye,
  Flame,
  FolderGit2,
  KeyRound,
  Lock,
  Mic,
  Orbit,
  Power,
  Send,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  BUILTIN_MODEL_PLUGINS,
  CAPABILITY_MATRIX,
  CapabilityDefinition,
  DEFAULT_PASSKEY_PROFILES,
  ModelPluginManifest,
  PasskeyProfile,
  SpatialMode,
  SynergyExecutionResult,
  SynergyMode,
} from './plugins/models/manifest';
import { executeMultiModelSynergy } from './plugins/models/synergyEngine';
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

  // 3. TRANSFORMATIVE SPATIAL MODE & SYNERGY MODE
  const [spatialMode, setSpatialMode] = useState<SpatialMode>('nexus');
  const [synergyMode, setSynergyMode] = useState<SynergyMode>('fusion');
  const [selectedCapability, setSelectedCapability] = useState<CapabilityDefinition>(
    CAPABILITY_MATRIX[4] // 3D Code Synthesis & AST Refactoring (Overlapping)
  );
  const [latestResult, setLatestResult] = useState<SynergyExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [awayBriefingBanner, setAwayBriefingBanner] = useState<string | null>(null);

  // 4. SENSORS: ACOUSTIC SENTINEL, WEBCAM GESTURES, SPEECH RECOGNITION, MAC TELEMETRY
  const sentinelRef = useRef<AcousticSentinelEngine | null>(null);
  const [acousticTelemetry, setAcousticTelemetry] = useState<AcousticTelemetry>({
    micActive: false,
    rmsLevel: 4,
    highFreqTransient: 8,
    clapCount: 0,
    dominantPitchHz: 144,
    spectralCentroidHz: 1180,
    voiceBiometricMatch: 96.8,
    spectrumBins: Array(24).fill(14),
  });
  const [liveTranscript, setLiveTranscript] = useState('');
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
    hostname: 'STARK-MACOS-NODE',
    platform: 'Darwin arm64',
    cpuModel: 'Apple Silicon Neural Engine',
    cpuCores: 12,
    cpuUsagePercent: 18,
    memoryUsedGB: 14.2,
    memoryTotalGB: 32,
    memoryPercent: 44,
    uptimeHours: 42.5,
  });

  const bootStateRef = useRef(bootState);
  bootStateRef.current = bootState;
  const passkeysRef = useRef(passkeyProfiles);
  passkeysRef.current = passkeyProfiles;

  // Trigger Amber Biometric Passkey Challenge after Clap-Clap + "Wake up, I'm back"
  const handleTriggerWakeChallenge = useCallback(() => {
    soundEngine.playAmberLockdown();
    setBootState('amber_challenge');
    soundEngine.speak(
      'Welcome back, Sir. Biometric lock active. State your passkey.'
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
          'Access denied. Voiceprint or passkey phrase mismatch. Exocortex locked.'
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
        `[${matchedProfile.name}] Verified (${acousticTelemetry.voiceBiometricMatch}% Voiceprint Match). Woke ${matchedProfile.wakeModels
          .map((m) => m.toUpperCase())
          .join(' + ')}.`
      );
      soundEngine.speak(matchedProfile.greetingSpeech);
    },
    [acousticTelemetry.voiceBiometricMatch]
  );

  // Execute a Directive across Awake Models
  const handleRunDirective = useCallback(
    async (promptText: string, capOverride?: CapabilityDefinition) => {
      const cap = capOverride || selectedCapability;
      const cleanPrompt = promptText.trim() || `Execute ${cap.name} synthesis`;
      setIsExecuting(true);
      soundEngine.playSynergyBeam();

      const awakeModelsList = models.filter((m) => awakeModelIds.includes(m.id));
      const activeList = awakeModelsList.length > 0 ? awakeModelsList : [models[0]];

      const result = await executeMultiModelSynergy({
        prompt: cleanPrompt,
        capability: cap,
        awakeModels: activeList,
        synergyMode,
        apiKeys,
      });

      setLatestResult(result);
      setIsExecuting(false);
    },
    [selectedCapability, models, awakeModelIds, synergyMode, apiKeys]
  );

  // Initialize Initial Synergy Demo Result so the HUD has rich live telemetry immediately upon ignition
  useEffect(() => {
    handleRunDirective(
      'Synthesize multi-model spatial HUD architecture & verify real-time capability overlap'
    );
  }, []);

  // Poll Real macOS System Telemetry from Local Server
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

  // Initialize Acoustic Sentinel Engine (Double-Clap + Vocal Frequency Biometrics)
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

  // Continuous Browser SpeechRecognition for "Wake up, I'm back", Passkeys & Voice Directives
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
        let phrase = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          phrase += event.results[i][0].transcript;
        }
        const clean = phrase.trim().toLowerCase();
        setLiveTranscript(clean);

        if (!clean) return;

        // 1. In Sentinel State: check for "wake up" or "i'm back"
        if (
          bootStateRef.current === 'sentinel' &&
          (clean.includes('wake up') || clean.includes("i'm back") || clean.includes('im back'))
        ) {
          handleTriggerWakeChallenge();
          return;
        }

        // 2. In Amber Challenge State: check if phrase matches any Passkey
        if (bootStateRef.current === 'amber_challenge') {
          const matched = passkeysRef.current.find((p) =>
            clean.includes(p.phrase.toLowerCase())
          );
          if (matched) {
            handleVerifyPasskey(matched.phrase);
          }
          return;
        }

        // 3. In Ignited State: voice control for models & modes
        if (bootStateRef.current === 'ignited' && event.results[event.results.length - 1]?.isFinal) {
          if (clean.includes('ghost protocol') || clean.includes('go to sleep')) {
            handleVerifyPasskey('ghost protocol');
          } else if (clean.includes('house party')) {
            setAwakeModelIds(models.map((m) => m.id));
            soundEngine.playPasskeyVerified();
          } else if (clean.includes('wake up grok')) {
            setAwakeModelIds((prev) => Array.from(new Set([...prev, 'grok'])));
            soundEngine.playCoreWake(396);
          } else if (clean.includes('wake up gpt')) {
            setAwakeModelIds((prev) => Array.from(new Set([...prev, 'gpt'])));
            soundEngine.playCoreWake(639);
          } else if (clean.includes('forge mode')) {
            setSpatialMode('forge');
            soundEngine.playModeMorph();
          } else if (clean.includes('overwatch mode')) {
            setSpatialMode('overwatch');
            soundEngine.playModeMorph();
          } else if (clean.includes('war room')) {
            setSpatialMode('warroom');
            soundEngine.playModeMorph();
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
          }, 500);
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
  }, [handleTriggerWakeChallenge, handleVerifyPasskey, models]);

  // Toggle Awake / Cryo-Sleep State of any Individual Model Core
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

  // Switch Spatial Mode with mechanical HUD servo audio
  const switchSpatialMode = (mode: SpatialMode) => {
    soundEngine.playModeMorph();
    setSpatialMode(mode);
  };

  // Handle Webcam Air-Gesture Triggers
  const handleAirGestureTrigger = (gesture: 'wake_all' | 'cycle_mode' | 'fusion_pulse') => {
    if (gesture === 'wake_all') {
      soundEngine.playPasskeyVerified();
      setAwakeModelIds(models.map((m) => m.id));
    } else if (gesture === 'cycle_mode') {
      const order: SpatialMode[] = ['nexus', 'forge', 'overwatch', 'warroom'];
      const next = order[(order.indexOf(spatialMode) + 1) % order.length];
      switchSpatialMode(next);
    } else if (gesture === 'fusion_pulse') {
      handleRunDirective('Air-Gesture Triggered Multi-Model Fusion Scan');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden hud-grid-bg hud-scanlines flex flex-col justify-between p-3.5 select-none">
      {/* 3D HOLOGRAPHIC REACTOR & MORPHING GEOMETRY STAGE */}
      <ThreeHologramStage
        spatialMode={spatialMode}
        synergyMode={synergyMode}
        models={models}
        awakeModelIds={awakeModelIds}
        bootState={bootState}
        audioRms={acousticTelemetry.rmsLevel}
        isExecuting={isExecuting}
        handCursor={handCursor}
      />

      {/* SENTINEL STANDBY / AMBER PASSKEY CHALLENGE / CRIMSON INTRUDER OVERLAY */}
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
              'Intruder alert. Vocal harmonic mismatch detected. Locking all neural cores.'
            );
          }}
          onResetToSentinel={() => setBootState('sentinel')}
          onStartMic={startAcousticMic}
        />
      )}

      {/* PLUG & PLAY VAULT MODAL (Passkey Editor, Voiceprint Calibrator, API Keys, Hot-Plug Models) */}
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
            enrolledAt: 'Default Stark Profile',
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
          TOP TACTICAL VISOR HEADER (System Telemetry + 4 Morphing Mode Tabs)
         ===================================================================== */}
      <header className="relative z-20 flex items-center justify-between gap-3 hud-panel rounded-xl border border-cyan-500/35 bg-[#030b17]/85 px-4 py-2 backdrop-blur-md">
        {/* Brand & Host Telemetry */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-full border border-cyan-400 bg-cyan-500/15 shadow-[0_0_15px_rgba(0,240,255,0.35)]">
            <Orbit className="w-5 h-5 text-cyan-300 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Orbitron'] text-sm font-black tracking-widest text-white">
                A.R.C.H.O.N. <span className="text-cyan-400 font-normal">// EXOCORTEX OS</span>
              </h1>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                OPEN-SOURCE PLUG & PLAY
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-300">
              <span>HOST: {macTelemetry.hostname}</span>
              <span className="text-cyan-300">CPU: {macTelemetry.cpuUsagePercent}%</span>
              <span className="text-amber-300">
                RAM: {macTelemetry.memoryUsedGB}/{macTelemetry.memoryTotalGB} GB
              </span>
              <span className="text-emerald-300">
                VOICEPRINT: {acousticTelemetry.voiceBiometricMatch}%
              </span>
            </div>
          </div>
        </div>

        {/* 4 TRANSFORMATIVE SPATIAL MODE TABS */}
        <nav className="flex items-center gap-1.5 bg-black/50 p-1 rounded-lg border border-cyan-500/25">
          {(
            [
              { id: 'nexus', label: '1. Pantheon Nexus', icon: Orbit },
              { id: 'forge', label: '2. 3D Code Forge', icon: FolderGit2 },
              { id: 'overwatch', label: '3. Overwatch Visor', icon: Eye },
              { id: 'warroom', label: '4. Global War Room', icon: Flame },
            ] as { id: SpatialMode; label: string; icon: any }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = spatialMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchSpatialMode(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-['Orbitron'] font-bold tracking-wider uppercase transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Plug & Play Vault, Audio Toggle, Lock Sentinel */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVaultModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-xs font-mono text-amber-200 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Passkeys & Plugins</span>
          </button>

          <button
            onClick={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              soundEngine.muted = next;
            }}
            title="Toggle Sci-Fi Synth & JARVIS Voice"
            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 cursor-pointer"
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              soundEngine.playCoreSleep();
              setBootState('sentinel');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-xs font-mono text-rose-200 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sentinel Lock</span>
          </button>
        </div>
      </header>

      {/* Optional Away-Mission Briefing Toast after Passkey Unlock */}
      {awayBriefingBanner && (
        <div className="relative z-20 flex items-center justify-between px-4 py-1.5 rounded-lg bg-emerald-950/75 border border-emerald-400/50 text-xs font-mono text-emerald-200">
          <div className="flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>{awayBriefingBanner}</span>
          </div>
          <button
            onClick={() => setAwayBriefingBanner(null)}
            className="text-[10px] text-emerald-300 hover:underline cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* =====================================================================
          MAIN TRANSFORMATIVE WORKSPACE STAGE
         ===================================================================== */}
      <main className="relative z-10 flex-1 my-2.5 overflow-hidden">
        <SpatialModeDeck
          spatialMode={spatialMode}
          synergyMode={synergyMode}
          onSelectSynergyMode={(m) => {
            soundEngine.playSynergyBeam();
            setSynergyMode(m);
          }}
          capabilities={CAPABILITY_MATRIX}
          selectedCapability={selectedCapability}
          onSelectCapability={(cap) => {
            setSelectedCapability(cap);
            soundEngine.playClapImpulse(1);
          }}
          models={models}
          awakeModelIds={awakeModelIds}
          latestResult={latestResult}
          onRunDirective={handleRunDirective}
          isExecuting={isExecuting}
        />
      </main>

      {/* =====================================================================
          BOTTOM DECK: 4 ORBITAL MODEL CORES + WEBCAM RIG + COMMAND CONSOLE
         ===================================================================== */}
      <footer className="relative z-20 grid grid-cols-12 gap-3 items-stretch">
        {/* 4 Selective Wake / Cryo-Sleep Model Core Cards (ARGON, CLAUDE, GROK, GPT) */}
        <div className="col-span-6 grid grid-cols-4 gap-2">
          {models.slice(0, 4).map((model) => {
            const isAwake = awakeModelIds.includes(model.id);
            return (
              <div
                key={model.id}
                onClick={() => toggleModelAwake(model)}
                style={{
                  borderColor: isAwake ? model.accentHex : 'rgba(100,116,139,0.3)',
                  boxShadow: isAwake ? `0 0 20px rgba(${model.glowRgb}, 0.22)` : 'none',
                }}
                className={`hud-panel rounded-lg border p-2.5 transition cursor-pointer flex flex-col justify-between ${
                  isAwake ? 'bg-[#041122]/90' : 'bg-[#020710]/70 opacity-60 hover:opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      style={{ color: isAwake ? model.accentHex : '#94a3b8' }}
                      className="font-['Orbitron'] text-xs font-black tracking-wider"
                    >
                      {model.codeName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                        isAwake
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Power className="w-2.5 h-2.5" />
                      {isAwake ? 'AWAKE' : 'SLEEP'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-300 truncate">
                    {model.family}
                  </div>
                  <div className="text-[9px] text-slate-400 line-clamp-2 mt-1 leading-tight">
                    {model.apexSuperpower}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono">
                  <span style={{ color: model.accentHex }}>{model.contextWindow}</span>
                  <span className="text-slate-400">
                    {isAwake ? `${model.tokensPerSec} tok/s` : '0 tok/s'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center-Right: Universal Multi-Model Command & Voice Console */}
        <div className="col-span-3 hud-panel rounded-lg border border-cyan-500/35 bg-[#030b17]/90 p-2.5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-cyan-400 animate-pulse" />
              VOICE / DIRECTIVE BUS
            </span>
            <button
              onClick={() => {
                soundEngine.playPasskeyVerified();
                setAwakeModelIds(models.map((m) => m.id));
              }}
              className="text-amber-300 hover:underline cursor-pointer"
            >
              ⚡ Wake All 4 (House Party)
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!commandInput.trim()) return;
              handleRunDirective(commandInput);
              setCommandInput('');
            }}
            className="my-1.5 flex gap-1.5"
          >
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder={`Task ${awakeModelIds
                .map((id) => id.toUpperCase())
                .join(' + ')} (or speak)...`}
              className="flex-1 px-2.5 py-1.5 rounded bg-black/75 border border-cyan-500/40 text-xs font-mono text-white focus:outline-none focus:border-cyan-300"
            />
            <button
              type="submit"
              disabled={isExecuting}
              className="px-3 py-1.5 rounded bg-cyan-500/30 hover:bg-cyan-500/45 border border-cyan-300 text-cyan-100 text-xs font-mono font-bold uppercase cursor-pointer flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              Run
            </button>
          </form>

          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span className="truncate">
              MIC: {liveTranscript ? `"${liveTranscript}"` : 'Clap or speak any directive...'}
            </span>
            <span className="text-cyan-300">RMS:{acousticTelemetry.rmsLevel}%</span>
          </div>
        </div>

        {/* Right: Tri-Modal Webcam Optical Hand/Face Rig */}
        <div className="col-span-3">
          <WebcamSensorOverlay
            enabled={webcamEnabled}
            onToggle={() => setWebcamEnabled((v) => !v)}
            bootState={bootState}
            onHandMove={setHandCursor}
            onAirGestureTrigger={handleAirGestureTrigger}
          />
        </div>
      </footer>
    </div>
  );
};

export default App;
