import React, { useState } from 'react';
import {
  Cpu,
  Fingerprint,
  KeyRound,
  PlusCircle,
  Save,
  Shield,
  Sliders,
  X,
} from 'lucide-react';
import { EnrolledVoiceprint } from '../audio/acousticSentinel';
import { ModelPluginManifest, PasskeyProfile } from '../plugins/models/manifest';

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
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(apiKeys);
  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginFamily, setNewPluginFamily] = useState('DeepSeek R1 / Local Ollama');
  const [newPluginSuperpower, setNewPluginSuperpower] = useState(
    'Zero-Cloud Local Weights Execution & Verifiable Math Chain'
  );
  const [newPluginColor, setNewPluginColor] = useState('#a855f7');

  if (!open) return null;

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKeys(localKeys);
  };

  const handleAddPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPluginName.trim()) return;
    const id = newPluginName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const plugin: ModelPluginManifest = {
      id,
      codeName: newPluginName.trim().toUpperCase(),
      family: newPluginFamily,
      vendor: 'Open-Source Community Plugin',
      tagline: newPluginSuperpower,
      color: 'violet',
      accentHex: newPluginColor,
      glowRgb: '168, 85, 247',
      awakeByDefault: true,
      contextWindow: '256,000 tok',
      avgLatencyMs: 165,
      tokensPerSec: 175,
      harmonicFreqHz: 480,
      apexSuperpower: newPluginSuperpower,
      apexProtocol: 'OpenAI-Compatible / Local Ollama Adapter',
      mcpTools: ['local_weights_runner', 'custom_mcp_extension'],
      capabilities: ['deep_reasoning', 'code_architecture', 'web_recon'],
    };
    onAddCustomModel(plugin);
    setNewPluginName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-cyan-400/50 bg-[#030c1a]/95 p-6 shadow-[0_0_60px_rgba(0,240,255,0.25)]">
        <div className="flex items-center justify-between border-b border-cyan-500/25 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="font-['Orbitron'] text-lg font-bold tracking-wider text-white uppercase">
              Plug & Play Exocortex Vault // Passkeys, Voiceprint & Model Plugins
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* LEFT: Custom Passkey Editor + Live Voiceprint Enrollment */}
          <div className="col-span-6 space-y-4">
            <div className="p-4 rounded-xl bg-black/60 border border-amber-500/35 space-y-3">
              <div className="flex items-center gap-2 text-xs font-['Orbitron'] font-bold text-amber-300 uppercase">
                <KeyRound className="w-4 h-4" />
                <span>Custom Spoken Passkeys</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Customize the exact phrase you speak after clapping and saying <span className="text-cyan-300">"Wake up, I'm back"</span>.
              </p>

              <div className="space-y-2.5">
                {passkeyProfiles.map((prof) => (
                  <div key={prof.id} className="space-y-1">
                    <label className="text-[10px] font-mono uppercase" style={{ color: prof.badgeColor }}>
                      {prof.name}
                    </label>
                    <input
                      type="text"
                      value={prof.phrase}
                      onChange={(e) => onUpdatePasskeyPhrase(prof.id, e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#051326] border border-cyan-500/30 text-xs font-mono text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Biometric Vocal Tract Enrollment */}
            <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/35 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-['Orbitron'] font-bold text-emerald-300 uppercase">
                  <Fingerprint className="w-4 h-4" />
                  <span>Vocal Tract Biometric Profile</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">
                  Calibrated: {voiceprint.enrolledAt}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-[#051326] border border-white/10">
                  <div className="text-[10px] text-slate-400">ENROLLED VOICEPRINT</div>
                  <div className="text-emerald-300 font-bold">
                    {voiceprint.pitchHz} Hz / {voiceprint.centroidHz} Hz
                  </div>
                </div>
                <div className="p-2 rounded bg-[#051326] border border-white/10">
                  <div className="text-[10px] text-slate-400">LIVE MIC HARMONICS</div>
                  <div className="text-cyan-300 font-bold">
                    {currentPitchHz} Hz / {currentCentroidHz} Hz
                  </div>
                </div>
              </div>
              <button
                onClick={onEnrollVoiceprint}
                className="w-full py-2 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400 text-xs font-mono font-bold text-emerald-100 uppercase cursor-pointer"
              >
                Speak & Calibrate My Voiceprint Now
              </button>
            </div>
          </div>

          {/* RIGHT: Plug-and-Play API Keys + Drop-In Open-Source Model Plugin Loader */}
          <div className="col-span-6 space-y-4">
            <form
              onSubmit={handleSaveKeys}
              className="p-4 rounded-xl bg-black/60 border border-cyan-500/35 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-['Orbitron'] font-bold text-cyan-300 uppercase">
                  <Shield className="w-4 h-4" />
                  <span>Live Provider API Keys (Optional)</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-300">
                  Auto-Sim Fallback Active
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Any model with a key calls its live cloud API; any model left blank automatically runs on the built-in <span className="text-cyan-300">Live Neural Simulator</span>.
              </p>

              <div className="space-y-2">
                {[
                  { id: 'argon', label: 'ARGON // Google Gemini API Key', placeholder: 'AIzaSy...' },
                  { id: 'claude', label: 'CLAUDE // Anthropic API Key', placeholder: 'sk-ant-...' },
                  { id: 'grok', label: 'GROK // xAI API Key', placeholder: 'xai-...' },
                  { id: 'gpt', label: 'GPT // OpenAI API Key', placeholder: 'sk-proj-...' },
                ].map((item) => (
                  <div key={item.id}>
                    <label className="text-[10px] font-mono text-slate-300 block mb-0.5">
                      {item.label}
                    </label>
                    <input
                      type="password"
                      value={localKeys[item.id] || ''}
                      onChange={(e) =>
                        setLocalKeys((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder={item.placeholder}
                      className="w-full px-3 py-1.5 rounded bg-[#051326] border border-cyan-500/30 text-xs font-mono text-white"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-300 text-xs font-mono font-bold text-cyan-100 uppercase cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save API Keys to Local Vault
              </button>
            </form>

            {/* Hot-Plug New Open-Source Model Core */}
            <form
              onSubmit={handleAddPlugin}
              className="p-4 rounded-xl bg-black/60 border border-purple-500/40 space-y-2.5"
            >
              <div className="flex items-center gap-2 text-xs font-['Orbitron'] font-bold text-purple-300 uppercase">
                <PlusCircle className="w-4 h-4" />
                <span>Hot-Plug Custom Open-Source Model Core</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newPluginName}
                  onChange={(e) => setNewPluginName(e.target.value)}
                  placeholder="Codename (e.g. DEEPSEEK)"
                  className="px-2.5 py-1.5 rounded bg-[#051326] border border-purple-500/30 text-xs font-mono text-white"
                />
                <input
                  type="text"
                  value={newPluginFamily}
                  onChange={(e) => setNewPluginFamily(e.target.value)}
                  placeholder="Model Family / Ollama Tag"
                  className="px-2.5 py-1.5 rounded bg-[#051326] border border-purple-500/30 text-xs font-mono text-white"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPluginSuperpower}
                  onChange={(e) => setNewPluginSuperpower(e.target.value)}
                  placeholder="Unique Apex Superpower..."
                  className="flex-1 px-2.5 py-1.5 rounded bg-[#051326] border border-purple-500/30 text-xs font-mono text-white"
                />
                <input
                  type="color"
                  value={newPluginColor}
                  onChange={(e) => setNewPluginColor(e.target.value)}
                  className="w-10 h-8 rounded bg-transparent border border-purple-500/30 cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400 text-xs font-mono font-bold text-purple-100 uppercase cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                Inject Model Core into 3D Reactor ({models.length} Active)
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
