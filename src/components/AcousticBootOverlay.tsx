import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Mic,
  ShieldAlert,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { AcousticTelemetry } from '../audio/acousticSentinel';
import { soundEngine } from '../audio/soundEngine';
import { PasskeyProfile } from '../plugins/models/manifest';

interface AcousticBootOverlayProps {
  bootState: 'sentinel' | 'amber_challenge' | 'intruder';
  telemetry: AcousticTelemetry;
  transcript: string;
  passkeyProfiles: PasskeyProfile[];
  onTriggerWakeChallenge: () => void;
  onVerifyPasskey: (phrase: string) => void;
  onTriggerIntruderDemo: () => void;
  onResetToSentinel: () => void;
  onStartMic: () => void;
  onCalibrateVoice?: () => void;
}

export const AcousticBootOverlay: React.FC<AcousticBootOverlayProps> = ({
  bootState,
  telemetry,
  transcript,
  passkeyProfiles,
  onTriggerWakeChallenge,
  onVerifyPasskey,
  onTriggerIntruderDemo,
  onResetToSentinel,
  onStartMic,
  onCalibrateVoice,
}) => {
  const [manualPasskeyInput, setManualPasskeyInput] = useState('');
  const [simStep, setSimStep] = useState<0 | 1 | 2 | 3>(0);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPasskeyInput.trim()) return;
    onVerifyPasskey(manualPasskeyInput.trim());
    setManualPasskeyInput('');
  };

  // Smooth multi-step acoustic simulation ("Clap 1 -> Clap 2 -> Wake up, I'm back")
  const runSimulatedHandshake = () => {
    setSimStep(1);
    soundEngine.playClapImpulse(1);
    setTimeout(() => {
      setSimStep(2);
      soundEngine.playClapImpulse(2);
    }, 190);
    setTimeout(() => {
      setSimStep(3);
      onTriggerWakeChallenge();
      setTimeout(() => setSimStep(0), 400);
    }, 520);
  };

  const activeClapCount = Math.max(telemetry.clapCount, simStep);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between py-10 px-6 bg-[#06070A]/65 backdrop-blur-xl transition-all duration-700">
      {/* TOP AMBIENT STATUS PILL */}
      <div className="flex items-center gap-3 px-4 py-1.5 rounded-full aspira-glass text-xs">
        <span
          className={`w-2 h-2 rounded-full ${
            bootState === 'intruder'
              ? 'bg-rose-500'
              : bootState === 'amber_challenge'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-[#6E8EFB] animate-pulse'
          }`}
        />
        <span className="font-medium text-slate-200 tracking-tight">
          {bootState === 'sentinel' && 'Aspira · Ambient Acoustic Standby'}
          {bootState === 'amber_challenge' && 'Aspira · Voiceprint & Passkey Resonance'}
          {bootState === 'intruder' && 'Aspira · Acoustic Signature Unverified'}
        </span>
        <span className="text-white/15">|</span>
        <button
          onClick={() => {
            soundEngine.playGlassTick();
            onStartMic();
          }}
          className="flex items-center gap-1.5 font-mono-tech text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
        >
          <Mic className="w-3.5 h-3.5 text-[#6E8EFB]" />
          <span>{telemetry.micActive ? 'Mic Active · 0 Cloud Tokens' : 'Enable Microphone'}</span>
        </button>
      </div>

      {/* CENTER STAGE: COMPLETELY OPEN FOR THE 3D BIOLUMINESCENT FLUID AURORA ORB */}
      <div className="flex-1 w-full flex items-center justify-center pointer-events-none">
        {/* Subtle radial halo ring around the central 3D orb */}
        <div
          className={`w-64 h-64 rounded-full border transition-all duration-700 ${
            bootState === 'intruder'
              ? 'border-rose-500/20 scale-90'
              : bootState === 'amber_challenge'
              ? 'border-amber-400/25 scale-110'
              : 'border-white/[0.06] scale-100'
          }`}
        />
      </div>

      {/* BOTTOM EDITORIAL & INTERACTION STAGE */}
      <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-5">
        {/* STATE 0: AMBIENT ACOUSTIC STANDBY */}
        {bootState === 'sentinel' && (
          <>
            {/* 3-Step Acoustic Handshake Pill Bar */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full aspira-glass text-[11px] font-medium">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition ${
                  activeClapCount >= 1
                    ? 'bg-[#6E8EFB]/25 text-white border border-[#6E8EFB]/50'
                    : 'text-slate-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Clap 1
              </span>
              <span className="text-white/20">·</span>
              <span
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition ${
                  activeClapCount >= 2
                    ? 'bg-[#A777E3]/25 text-white border border-[#A777E3]/50'
                    : 'text-slate-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Clap 2
              </span>
              <span className="text-white/20">·</span>
              <span
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition ${
                  simStep === 3 || transcript.includes('wake up')
                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                    : 'text-slate-400'
                }`}
              >
                "Wake up, I'm back"
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-white">
                Clap twice and say{' '}
                <span className="font-serif-editorial italic font-normal text-[#93ADFF]">
                  “Wake up, I’m back”
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                {transcript
                  ? `Heard: “${transcript}”`
                  : `Listening locally across 1.2–5.2 kHz · Vocal pitch ${telemetry.dominantPitchHz} Hz`}
              </p>
            </div>

            {/* Centered Symmetrical 24-Node Harmonic Waveform Ribbon */}
            <div className="flex items-center justify-center gap-1.5 h-8 px-6">
              {telemetry.spectrumBins.map((val, idx) => (
                <div
                  key={idx}
                  style={{
                    height: `${Math.max(4, Math.min(28, Math.round(val * 0.28)))}px`,
                  }}
                  className="w-1 rounded-full bg-gradient-to-b from-[#6E8EFB]/80 via-[#A777E3]/70 to-white/30 transition-all duration-100"
                />
              ))}
            </div>

            {/* Tactile Glass Trigger Pill */}
            <div className="pt-1">
              <button
                onClick={runSimulatedHandshake}
                className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full aspira-glass-elevated hover:bg-white/[0.12] text-xs font-medium text-white transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#6E8EFB] group-hover:scale-110 transition" />
                <span>Simulate Clap-Clap + “Wake up, I’m back”</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </>
        )}

        {/* STATE 1: PASSKEY RESONANCE CHALLENGE */}
        {bootState === 'amber_challenge' && (
          <div className="w-full space-y-4">
            {/* Sleek Vocal Harmonic Match Pill */}
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/25 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <Fingerprint className="w-3.5 h-3.5" />
                Voiceprint {telemetry.voiceBiometricMatch}% Match
              </span>
              <span className="text-white/15">·</span>
              <span className="font-mono-tech text-[11px] text-amber-200/90">
                {telemetry.dominantPitchHz} Hz F0 · {telemetry.spectralCentroidHz} Hz Centroid
              </span>
              {onCalibrateVoice && (
                <>
                  <span className="text-white/15">·</span>
                  <button
                    onClick={() => {
                      soundEngine.playGlassTick(1.2);
                      onCalibrateVoice();
                    }}
                    className="text-[11px] text-amber-300 hover:text-white underline underline-offset-2 cursor-pointer"
                  >
                    Calibrate Voice
                  </button>
                </>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-white">
                Welcome back.{' '}
                <span className="font-serif-editorial italic font-normal text-amber-200">
                  State your passkey.
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Speak your custom passkey phrase aloud or select an awakening protocol below.
              </p>
            </div>

            {/* Minimalist Glass Passkey Input Pill */}
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2 max-w-lg mx-auto">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-300/80 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualPasskeyInput}
                  onChange={(e) => setManualPasskeyInput(e.target.value)}
                  placeholder={
                    transcript
                      ? `Heard: “${transcript}” — or type passkey...`
                      : 'Speak passkey or type (e.g. Protocol Lazarus)...'
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-full aspira-glass text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-white/25"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer"
              >
                Unlock
              </button>
            </form>

            {/* 4 Sleek Horizontal Glass Protocol Cards */}
            <div className="grid grid-cols-2 gap-2.5 text-left pt-1">
              {passkeyProfiles.map((prof) => (
                <div
                  key={prof.id}
                  onClick={() => {
                    soundEngine.playGlassTick();
                    onVerifyPasskey(prof.phrase);
                  }}
                  className="p-3.5 rounded-2xl aspira-card-interactive cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        style={{ backgroundColor: prof.badgeColor }}
                        className="w-2 h-2 rounded-full"
                      />
                      <span className="text-xs font-medium text-white">{prof.name}</span>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
                  </div>
                  <div className="font-mono-tech text-[11px] text-slate-300 mb-1">
                    Say: <span className="text-white font-medium">“{prof.phrase}”</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{prof.description}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 pt-1 text-xs text-slate-400">
              <button
                onClick={onResetToSentinel}
                className="hover:text-white transition cursor-pointer"
              >
                ← Return to standby
              </button>
              <button
                onClick={onTriggerIntruderDemo}
                className="text-rose-400/80 hover:text-rose-300 transition cursor-pointer"
              >
                Simulate voiceprint mismatch
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: GRACEFUL MISMATCH RECOVERY */}
        {bootState === 'intruder' && (
          <div className="space-y-4 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Voiceprint or passkey unverified</span>
            </div>
            <h2 className="font-display text-2xl font-medium text-white">
              Studio remains locked
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The spoken phrase or vocal harmonic signature did not match your enrolled profile. All agent cores remain in low-power sleep.
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={onTriggerWakeChallenge}
                className="px-5 py-2 rounded-full bg-white text-black hover:bg-white/90 text-xs font-semibold transition cursor-pointer"
              >
                Try Passkey Again
              </button>
              <button
                onClick={onResetToSentinel}
                className="px-5 py-2 rounded-full aspira-glass text-xs text-slate-200 hover:text-white transition cursor-pointer"
              >
                Return to Standby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
