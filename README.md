# Aspira

Aspira is an open-source personal agent workspace for macOS. It brings a conversational interface, supported provider CLIs, local tools, saved memories, and optional on-device voice into one window.

Aspira is an early-stage personal project. Provider access depends on the provider's own CLI, sign-in, plan, and current terms. Installing a provider's desktop app by itself does not connect its model to Aspira.

## Start Aspira

Requirements: macOS, Node.js 20 or later, and npm.

```sh
git clone https://github.com/ysham123/Aspira.git
cd Aspira
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local Express server listens on `127.0.0.1:3001`. Aspira does not listen to the microphone on startup. Choose a model, connect it in **Settings**, then type a prompt. Voice recording is opt-in.

## Connect a model

Aspira can call these command-line tools when they are installed and signed in on the same Mac:

| Provider | CLI | Connection notes |
| --- | --- | --- |
| Google models | Antigravity CLI (`agy`) | Sign in through the CLI. Aspira calls its documented headless prompt mode with sandboxing and plan mode. |
| Anthropic | Claude Code (`claude`) | Sign in through Claude Code. Aspira uses print mode with plan permissions. |
| OpenAI | Codex CLI (`codex`) | Sign in with ChatGPT. Aspira invokes `codex exec` in read-only mode. |
| xAI | Grok Build (`grok`) | Sign in through Grok Build. Aspira uses its headless prompt mode. |

The **Connections** screen shows which CLI binaries it can find. For Claude Code, Aspira asks the CLI for a signed-in status without reading credential files. Other providers are confirmed only when a real request succeeds. A desktop or web-app login is not treated as an active model connection.

You can also add an OpenAI-compatible endpoint in **Settings → Agents & Hot-Plug**. For example, an Ollama server can run locally at `http://127.0.0.1:11434/v1`. Aspira does not silently substitute a different model when the selected provider is unavailable.

## What works today

The chat supports provider responses and a small set of explicit local actions. Try `Run git status`, `Check my Mac memory and battery`, `Read README.md`, `Open Calculator`, or `Create a file called notes.md with ...`. The local tool registry also supports opening a URL, a local notification, public quick lookups, and saving context when you explicitly ask Aspira to remember something. Workspace files stay inside the project directory, and terminal actions use an exact read-only allowlist.

The action layer is still an explicit intent parser, not a general model tool-calling loop. It does not run arbitrary shell commands, edit arbitrary existing files, or run playbooks on a schedule. Requests outside the supported action set need a connected model for a conversational answer.

## Local data

Saved memories and user-created playbooks live in `server/data/` and are ignored by Git. They remain on this Mac. Memories are added only when you ask Aspira to save one. Conversation turns are currently held in the open browser tab and clear when the page reloads.

## Optional local voice

The local voice service uses MLX-Audio on Apple Silicon. It can download model weights on first use.

```sh
npm run voice:local
```

Then open **Settings → Voice** and play a sample. Voice output is opt-in; there is no browser robot-voice fallback. Voice input records only after the microphone button is pressed, then sends the recording to the local MLX-Audio transcription endpoint.

## Optional passphrase lock

The passphrase lock is off by default. It only hides the workspace in the current browser and is not device authentication or a security boundary. Passkey phrases are stored in browser local storage.

## Development

```sh
npm run build
npx tsc --noEmit
npm run server
npm run client
```

Aspira's local tools and the web interface communicate through the Express API. Provider conversations use the selected provider CLI or a configured API endpoint. API keys entered for optional direct endpoints are stored in this browser's local storage. Do not use the passphrase lock or browser storage as a secrets vault.

## License

MIT. See [LICENSE](LICENSE).
