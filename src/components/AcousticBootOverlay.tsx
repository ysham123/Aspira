import React, { useState } from 'react';
import {
  AlertOctagon,
  Fingerprint,
  KeyRound,
  Mic,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { AcousticTelemetry } from '../audio/acousticSentinel';
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
}) => {
  const [manualPasskeyInput, setManualPasskeyInput] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPasskeyInput.trim()) return;
    onVerifyPasskey(manualPasskeyInput.trim());
    setManualPasskeyInput('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#01050c]/80 backdrop-blur-md p-6">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl transition-all duration-500 ${
          bootState === 'intruder'
            ? 'border-rose-500 bg-[#160409]/95 shadow-[0_0_60px_rgba(255,30,66,0.45)]'
            : bootState === 'amber_challenge'
            ? 'border-amber-400 bg-[#140d02]/95 shadow-[0_0_60px_rgba(255,170,0,0.35)]'
            : 'border-cyan-500/50 bg-[#030c1a]/95 shadow-[0_0_60px_rgba(0,240,255,0.25)]'
        }`}
      >
        {/* Top Header Status Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full animate-ping ${
                bootState === 'intruder'
                  ? 'bg-rose-500'
                  : bootState === 'amber_challenge'
                  ? 'bg-amber-400'
                  : 'bg-cyan-400'
              }`}
            />
            <span className="font-['Orbitron'] text-sm font-bold tracking-widest uppercase">
              {bootState === 'sentinel' && 'A.R.C.H.O.N. // ACOUSTIC SENTINEL STANDBY (0 TOKENS)'}
              {bootState === 'amber_challenge' && 'AMBER LOCKDOWN // BIOMETRIC PASSKEY CHALLENGE'}
              {bootState === 'intruder' && 'CRIMSON ALERT // VOICEPRINT OR PASSKEY MISMATCH'}
            </span>
          </div>

          <button
            onClick={onStartMic}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
              telemetry.micActive
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-cyan-500/20 border-cyan-400 text-cyan-200 hover:bg-cyan-500/35'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            {telemetry.micActive ? 'MIC DSP ARMED' : 'ARM MICROPHONE'}
          </button>
        </div>

        {/* STAGE 0: SENTINEL STANDBY (Clap-Clap + "Wake up, I'm back") */}
        {bootState === 'sentinel' && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono text-cyan-300">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>LISTENING FOR DOUBLE-CLAP + "WAKE UP, I'M BACK"</span>
              </div>
              <h2 className="font-['Orbitron'] text-2xl font-extrabold tracking-wider text-white">
                CLAP TWICE & SAY <span className="text-cyan-400">"WAKE UP, I'M BACK"</span>
              </h2>
              <p className="text-xs text-slate-300 max-w-lg mx-auto">
                The local WebAudio transient filter monitors room acoustics for a sharp double-clap impulse (<code className="text-cyan-300">1.2kHz–4.8kHz</code>) followed by your wake phrase.
              </p>
            </div>

            {/* Live Acoustic Spectrum & Clap Impulse Progress */}
            <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-300">
                  TRANSIENT ENERGY: {telemetry.highFreqTransient}% | RMS: {telemetry.rmsLevel}%
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      telemetry.clapCount >= 1
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}
                  >
                    CLAP 1
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      telemetry.clapCount >= 2
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}
                  >
                    CLAP 2 (WAKE)
                  </span>
                </div>
              </div>

              {/* 24-Bar Live Equalizer */}
              <div className="flex items-end justify-between h-14 gap-1 pt-2">
                {telemetry.spectrumBins.map((val, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(10, val)}%` }}
                    className="flex-1 rounded-t bg-gradient-to-t from-cyan-600 via-cyan-400 to-amber-300 transition-all duration-75"
                  />
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>
                  LIVE SPEECH BUFFER:{' '}
                  <strong className="text-cyan-200">
                    {transcript ? `"${transcript}"` : 'Waiting for acoustic trigger...'}
                  </strong>
                </span>
                <span>PITCH: {telemetry.dominantPitchHz} Hz</span>
              </div>
            </div>

            {/* Instant Simulation / Handshake Controls */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={onTriggerWakeChallenge}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-300 text-xs font-['Orbitron'] font-bold tracking-wider text-cyan-100 shadow-[0_0_25px_rgba(0,240,255,0.3)] cursor-pointer transition"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                👏 SIMULATE CLAP-CLAP + "WAKE UP, I'M BACK"
              </button>
            </div>
          </div>
        )}

        {/* STAGE 1: AMBER BIOMETRIC CHALLENGE ("Welcome back. State your passkey.") */}
        {bootState === 'amber_challenge' && (
          <div className="space-y-4">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-mono text-amber-200">
                <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                <span>A.R.C.H.O.N.: "WELCOME BACK, SIR. BIOMETRIC LOCK ACTIVE. STATE YOUR PASSKEY."</span>
              </div>
              <h2 className="font-['Orbitron'] text-xl font-bold tracking-wider text-amber-300">
                SPEAK OR SELECT YOUR PASSKEY PROTOCOL
              </h2>
            </div>

            {/* Live Vocal Biometric Telemetry */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-black/65 border border-amber-500/40 text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400">VOCAL TRACT PITCH</div>
                <div className="text-amber-300 font-bold text-sm">{telemetry.dominantPitchHz} Hz</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">SPECTRAL CENTROID</div>
                <div className="text-amber-300 font-bold text-sm">
                  {telemetry.spectralCentroidHz} Hz
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">VOICEPRINT SIMILARITY</div>
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                  <Fingerprint className="w-4 h-4" />
                  {telemetry.voiceBiometricMatch}% MATCH
                </div>
              </div>
            </div>

            {/* Spoken / Typed Passkey Input */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualPasskeyInput}
                  onChange={(e) => setManualPasskeyInput(e.target.value)}
                  placeholder={
                    transcript
                      ? `Heard: "${transcript}" — or type custom passkey...`
                      : 'Speak your passkey into mic or type here (e.g. "Protocol Lazarus")...'
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/80 border border-amber-400/50 text-xs font-mono text-white focus:outline-none focus:border-amber-300"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-500/30 hover:bg-amber-500/45 border border-amber-300 text-xs font-mono font-bold text-amber-100 uppercase cursor-pointer"
              >
                Verify Passkey
              </button>
            </form>

            {/* Multi-Tier Passkey Protocol Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {passkeyProfiles.map((prof) => (
                <div
                  key={prof.id}
                  onClick={() => onVerifyPasskey(prof.phrase)}
                  style={{ borderColor: `${prof.badgeColor}66` }}
                  className="p-3 rounded-xl bg-black/65 hover:bg-white/5 border transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      style={{ color: prof.badgeColor }}
                      className="text-[10px] font-mono font-bold uppercase"
                    >
                      {prof.name}
                    </span>
                    <ShieldCheck
                      style={{ color: prof.badgeColor }}
                      className="w-4 h-4 opacity-75 group-hover:opacity-100"
                    />
                  </div>
                  <div className="text-xs font-mono font-bold text-white mb-1">
                    Say: <span style={{ color: prof.badgeColor }}>"{prof.phrase.toUpperCase()}"</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-snug">{prof.description}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
              <button
                onClick={onResetToSentinel}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ← Return to Sentinel Standby
              </button>
              <button
                onClick={onTriggerIntruderDemo}
                className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-300 cursor-pointer"
              >
                Test Intruder / Wrong Voiceprint
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: CRIMSON INTRUDER LOCKDOWN */}
        {bootState === 'intruder' && (
          <div className="space-y-4 text-center py-3">
            <AlertOctagon className="w-14 h-14 text-rose-500 mx-auto animate-bounce" />
            <h2 className="font-['Orbitron'] text-2xl font-extrabold text-rose-400 tracking-wider">
              VOICEPRINT OR PASSKEY REJECTED // EXOCORTEX LOCKED
            </h2>
            <p className="text-xs font-mono text-rose-200 max-w-md mx-auto">
              Unauthorized vocal tract harmonic signature or invalid passkey phrase detected. All cloud model cores remain sealed in Cryo-Sleep.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={onTriggerWakeChallenge}
                className="px-4 py-2 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400 text-xs font-mono text-amber-200 uppercase cursor-pointer"
              >
                Retry Passkey Challenge
              </button>
              <button
                onClick={onResetToSentinel}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono text-slate-200 uppercase cursor-pointer"
              >
                Reset Sentinel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
