# Aspira — Flagship Open-Source Personal Agent OS & Spatial Studio

**Aspira** is a 100% open-source, plug-and-play Personal Agent OS & spatial studio for macOS that connects **Argon (Gemini)**, **Claude**, **Grok**, and **GPT** using your **existing personal LLM subscriptions (Zero API Keys Required!)** alongside local Apple Silicon models.

Co-designed around the flagship craft of **Google Gemini Live, OpenAI Realtime, Anthropic Workbench, xAI, and Linear/Raycast**, and engineered with the personal-agent breakthroughs of **Dot (by New Computer)**, **Meta Muse**, **OpenClaw (Clawdbot)**, **Grok Bot**, and **MacOS-Use**, Aspira combines:
1. **Universal LLM Subscription Bridge (Zero API Keys Required)**
2. **Continuous Hands-Free Duplex Voice Conversation + Acoustic Double-Clap & Spoken Passkey Gate**
3. **Real macOS, Filesystem, Terminal & Live Web Action Execution**
4. **Dot-Style Agentic Living Memory Graph & Grokbot/OpenClaw Autonomous Routines**

Repository: [`https://github.com/ysham123/Aspira`](https://github.com/ysham123/Aspira)

---

## 1. Zero API Keys Required — Personal LLM Subscription Bridge

Most people already have personal subscriptions (**Claude Pro/Max**, **ChatGPT Plus/Pro**, **SuperGrok / X Premium+**, **Google AI Pro / Gemini**, or local **Apple Silicon Ollama**)—not separate per-token developer API keys. Aspira auto-discovers and bridges your active subscriptions out of the box (`GET /api/subscriptions` in `server/index.js`):

| Agent Core | Subscription Source Auto-Detected on macOS | Desktop App Handoff |
| :--- | :--- | :--- |
| **Claude (`#D97757`)** | **Claude Pro / Max** OAuth via `claude` CLI (`~/.claude`) | `/Applications/Claude.app` |
| **GPT (`#10A37F`)** | **ChatGPT Plus / Pro** OAuth via `codex` CLI (`~/.codex/auth.json`) | `/Applications/ChatGPT.app` |
| **Grok (`#F43F5E`)** | **Grok / X Premium+** OAuth via `grok` CLI (`~/.grok/auth.json`) | `grok.com` / Native Browser |
| **Argon (`#6E8EFB`)** | **Google Gemini** (`Gemini.app` / `gemini` CLI) + **Ollama Apple Silicon** (`llama3.2`, `qwen2.5vl`) | `/Applications/Gemini.app` |

- **1-Click Subscription Sign-In / Re-Auth**: Open **Subscriptions & Models** in the top bar to view live green `SUBSCRIPTION ACTIVE` badges, launch 1-click OAuth sign-in (`claude login`, `codex login`, `grok login`), or connect a local `CLIProxyAPI` router (`http://localhost:8317/v1`).
- **1-Click Native Desktop App Handoff**: Click **Open in App** on any conversation turn (or say *"Send to Claude app"* / *"Send to ChatGPT app"*) to copy and paste your prompt directly into your native macOS `Claude.app`, `ChatGPT.app`, or `Gemini.app` window.

---

## 2. Real Host Actions, Dot Living Memory & Autonomous Routines

- **Native macOS & Workspace Action Engine (`OpenClaw` / `Muse` / `MacOS-Use` style)**:
  - `macos_app`: Launch any macOS application (`"Open Safari"`, `"Open Calculator"`, `"Open Notes"`, `"Open Claude"`).
  - `macos_notify`: Trigger native macOS Notification Center banners (`osascript`).
  - `system_status`: Real-time Apple Silicon CPU, Unified Memory, `pmset -g batt` battery telemetry, and active subscription audit.
  - `fs_write` / `fs_read` & `shell_exec`: Create or inspect workspace files and run safe shell commands (`git status`, `ls`, `df`, `ps`, `cat`) with inline **Action Execution Cards**.
  - `web_search` & `open_url`: Live DuckDuckGo + HackerNews Firebase API recon and direct browser launching.
- **Dot-Style Agentic Living Memory Graph (`server/data/memory.json`)**:
  - Automatically extracts and persists your `Goals`, `In-Progress Tasks`, `Preferences`, `Projects`, and `Insights` with status tags (`IN_PROGRESS`, `COMPLETED`, `ACTIVE`) and vocal pitch/emotion telemetry (`Focused`, `Energetic`, `Reflective`), injecting them into every future turn.
- **Grokbot / OpenClaw Autonomous Routines (`server/data/routines.json`)**:
  - Multi-step automated playbooks (*Executive Morning & System Briefing*, *Deep Focus Workspace Launch*, *Grok Live Web Recon Sweep*) that execute sequential host actions and speak the synthesized briefing aloud.

---

## 3. Acoustic Double-Clap $\rightarrow$ `"Wake up, I'm back"` $\rightarrow$ Spoken Passkey Gate

- **2048-FFT 4-Feature Clap Discriminator (`src/audio/acousticSentinel.ts`)**: Distinguishes real physical hand claps from speech sibilants and desk taps.
- **3-Point Parabolic `F0` Pitch & Formant Biometric Matching**: Verifies your vocal frequency signature alongside multi-tier spoken passkey protocols (`"Protocol Lazarus"`, `"House Party Protocol"`, `"Overwatch Alpha"`, `"Ghost Protocol"`).
- **Hands-Free Duplex Voice Conversation + Local Neural TTS (`src/audio/soundEngine.ts`)**: Once unlocked, talk naturally at any time—Aspira listens, executes actions on your Mac, and speaks back via local **Kokoro-82M / mlx-audio** (`/api/tts`) or pre-warmed macOS Neural Voices with instant barge-in interruption.

---

## Quick Start

```bash
git clone https://github.com/ysham123/Aspira.git
cd Aspira
npm install

# Start the Subscription-First Personal Agent OS Server (:3001) & Vite Spatial Studio (:5173)
npm run dev
```
