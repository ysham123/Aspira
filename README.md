# Aspira — Flagship Open-Source Multi-Agent Spatial Studio

**Aspira** is a 100% open-source, plug-and-play spatial AI studio that connects **Argon (Gemini)**, **Claude**, **Grok**, and **GPT** (plus custom OpenAI-compatible or local Ollama models) in a single serene, transformative canvas.

Co-designed around the flagship craft of **Google Gemini Live, OpenAI Realtime, Anthropic Workbench, xAI, and Linear/Raycast**, Aspira pairs a custom **GLSL Bioluminescent Fluid Orb & Aurora Constellation** with a **Multi-Feature Acoustic Double-Clap + Spoken Passkey Gate** and a **Luxury WebAudio + Local Neural TTS Engine (`Kokoro-82M` / `mlx-audio`)**.

Repository: [`https://github.com/ysham123/Aspira`](https://github.com/ysham123/Aspira)

---

## Signature Capabilities

### 1. Acoustic Double-Clap $\rightarrow$ `"Wake up, I'm back"` $\rightarrow$ Vocal Biometric Passkey Gate
- **Ambient Lock Screen (Zero Cloud Tokens in Standby):** Uses a 2048-FFT local WebAudio DSP sentinel (`src/audio/acousticSentinel.ts`) with a 4-feature physical clap discriminator (adaptive noise floor, crest factor, onset rise derivative, and high-frequency spectral ratio) so speech sibilants and keyboard clicks never false-trigger.
- **Spoken Passkey & Vocal Frequency Verification:** Responds in a warm natural neural voice (*"Welcome back. State your passkey to unlock the studio."*) and verifies both your **custom spoken passkey phrase** and **vocal frequency signature** (3-point parabolic `F0` pitch interpolation + formant spectral centroid matching).
- **Multi-Tier Passkey Protocols:**
  - `"Protocol Lazarus"` (Primary): Unlocks the studio and wakes **Argon + Claude**.
  - `"House Party Protocol"`: Ignites all 4 flagship agents simultaneously (**Argon, Claude, Grok, GPT**).
  - `"Overwatch Alpha"`: Wakes **Argon + Grok** directly in **Live Vision** mode.
  - `"Ghost Protocol"`: Emergency purge & return to zero-token ambient lock.

### 2. Unique Superpowers vs. Overlapping Capability Synergy Engine
- **4 Unique Apex Superpowers:**
  - **Argon (`#6E8EFB`):** 2M Context Vault & Native Live Multimodal Stream
  - **Claude (`#D97757`):** Direct OS Computer Use & MCP Sandboxed Execution
  - **Grok (`#F43F5E`):** Unfiltered Live X Firehose & Cultural Pulse
  - **GPT (`#10A37F`):** Sub-Second Realtime Voice & Recursive O-Series Planner
- **5 Overlapping Shared Capabilities (`Code Synthesis`, `Deep Reasoning`, `Spatial Vision`, `Live Grounding`, `Creative Studio`) across 4 Collaboration Modes:**
  - **Fusion (`Consensus + Nuance`):** Synthesizes parallel agent outputs into an executive unified response with interactive `[Consensus]` and `[Agent Nuance]` attribution pills.
  - **Debate (`Adversarial`):** Structured 3-stage `Thesis -> Critique -> Verdict` executive review.
  - **Race (`Speculative Speed`):** Live sub-millisecond token velocity telemetry locking onto the fastest agent stream.
  - **Relay (`Apex Chain`):** Sequential handoffs across each model's unique superpower.

### 3. Custom GLSL Bioluminescent Fluid Orb & 4 Transformative Studio Views
- **Custom Shader Pipeline (`src/components/ThreeHologramStage.tsx`):** 3D Ashima Simplex Noise + Dual-Layer Fresnel Iridescence (`#4285F4`, `#9B72CB`, `#D96570`, `#F49C46`), Volumetric Back-Face Corona Halo, and 160-particle **Curved Cubic Bezier Aurora Ribbons** connecting awake agent cores.
- **4 Spacious Studio Views (`⌘1` – `⌘4`):**
  - **`⌘1` Studio:** Executive synthesized response canvas + side-by-side collapsible agent perspective cards + capability filter pills.
  - **`⌘2` Workbench:** Interactive workspace file/AST explorer with **Source Inspector**, **Multi-Agent AST Diff**, and a collapsible macOS terminal drawer (`⌘J`).
  - **`⌘3` Live Vision:** Minimalist floating Picture-in-Picture optical gesture sensor + multimodal vision & MCP action cards.
  - **`⌘4` Global Pulse:** Editorial live signal feed + structured multi-agent debate timeline.

### 4. Luxury Acoustic Bus & Local Neural Voice AI (`Kokoro-82M` / `mlx-audio`)
- **Master Luxury Acoustic Bus (`src/audio/soundEngine.ts`):** `24dB/oct` warm low-pass filter + stereo ambient diffusion + soft knee compressor generating VisionOS-style modal glass droplets, `Dmin9` wake swells, and `Cmaj9(#11)` unlock blooms.
- **Local Open-Source Neural Voice AI (`/api/tts`):** Out-of-the-box support for locally hosted **Kokoro-82M**, **mlx-audio**, or **Orpheus** (`http://127.0.0.1:8880/v1/audio/speech`) with automatic fallback to pre-warmed macOS Neural Voices.

---

## Quick Start

```bash
git clone https://github.com/ysham123/Aspira.git
cd Aspira
npm install

# 1. Start both the Local Express Bridge Server (:3001) & Vite Spatial Studio (:5173)
npm run dev

# 2. (Optional) Launch in Frameless Native macOS Desktop Mode
npm run desktop
```

### Optional: Local Open-Source Neural Voice AI (`Kokoro-82M` on Apple Silicon)
To run ultra-natural local neural voice synthesis on your Mac (`0` cloud tokens, `<120ms` latency):
```bash
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
```
Then open **Settings (`⌘,`) $\rightarrow$ API Keys & Voice AI** in Aspira to test or customize your voice profile (`af_heart`, `af_bella`, `am_adam`, `bf_emma`).
