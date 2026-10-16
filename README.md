# A.S.P.I.R.A. (A.R.C.H.O.N. Core) — Open-Source Multi-Model Spatial Exocortex HUD

**A.S.P.I.R.A.** (*Autonomous Spatial Pantheon & Interactive Reactive Architecture*) is a 100% open-source, plug-and-play Tony Stark-style spatial interface for orchestrating **ARGON (Gemini)**, **CLAUDE**, **GROK**, and **GPT** (plus any custom or local Ollama model).

Repository: [`https://github.com/ysham123/Aspira`](https://github.com/ysham123/Aspira)

---

## Signature Capabilities

1. **Acoustic Double-Clap $\rightarrow$ `"Wake up, I'm back"` $\rightarrow$ Biometric Voice Passkey Gate:**
   - **Sentinel Standby (0 Cloud Tokens):** Uses a local WebAudio DSP high-frequency transient detector (`1.1kHz–4.8kHz`) + continuous speech recognizer.
   - **Amber Biometric Challenge:** Responds with synthesized voice (*"Welcome back, Sir. Biometric lock active. State your passkey."*) and verifies both your **custom spoken passkey phrase** and **vocal frequency signature** (`Pitch Hz` + `Spectral Centroid Hz`).
   - **Multi-Tier Passkey Protocols:**
     - `"Protocol Lazarus"` (Primary): Unlocks the HUD and wakes **ARGON + CLAUDE**.
     - `"House Party Protocol"`: Ignites all 4 Pantheon models simultaneously (**ARGON, CLAUDE, GROK, GPT**).
     - `"Overwatch Alpha"`: Wakes **ARGON + GROK** directly in Tactical Overwatch Visor mode.
     - `"Ghost Protocol"`: Emergency purge & return to zero-token Cryo-Sleep.

2. **Unique vs. Overlapping Capability Matrix & Synergy Engine:**
   - Exposes every model's **Unique Apex Superpower** (*Argon 2M Vault & Live Video Stream*, *Claude OS Computer Use & MCP*, *Grok Live X Firehose*, *GPT Sub-Second WebRTC Voice*).
   - Turns **Overlapping Capabilities** (*Code Synthesis, Deep Reasoning, Spatial Vision, Global Recon, Image Synthesis*) into 4 visual reactor modes:
     - **Fusion Prism:** Merges parallel outputs, highlighting shared agreement in **Cyan** and model disagreements in **Amber**.
     - **Adversarial Red-Team Arena:** One model builds, another red-teams/attacks, and a third judges.
     - **Speculative Sprint:** Races all awake models and locks onto the fastest token stream.
     - **Apex Relay Chain:** Sequential handoffs across unique capabilities.

3. **4 Transformative Spatial UI Modes:**
   - **Mode 1 — Pantheon Nexus:** 3D Arc Reactor + 4 orbital model cores + Capability Venn Matrix.
   - **Mode 2 — 3D Code & System Forge:** Live 3D AST/file dependency explorer for your local workspace + real macOS Terminal Sandbox Bridge.
   - **Mode 3 — Tactical Overwatch Visor:** Iron Man perimeter helmet HUD + Argon Spatial Vision + Claude Computer Use cursor telemetry + live webcam optical hand-gesture rig.
   - **Mode 4 — Global War Room:** 3D Holographic Recon Globe + Grok Live X Firehose + Multi-Model Debate Arena.

---

## Quick Start

```bash
git clone https://github.com/ysham123/Aspira.git
cd Aspira
npm install

# 1. Start both the Local macOS Telemetry/Model Bridge Server & Vite Spatial HUD
npm run dev

# 2. (Optional) Launch in Frameless Native macOS Desktop Visor Mode
npm run desktop
```

## Plug-and-Play Custom Models
Click **Passkeys & Plugins** in the top-right of the HUD (or edit `src/plugins/models/manifest.ts`) to hot-plug any OpenAI-compatible or local Ollama model core directly into the 3D reactor.
