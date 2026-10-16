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
| Google models | Antigravity CLI (`agy`) | Sign in through the CLI. Aspira sends prompts over stdin and uses a fresh working directory, sandboxing, plan mode, and disabled slash-command expansion. |
| Anthropic | Claude Code (`claude`) | Sign in through Claude Code. Aspira starts a safe-mode print session with the CLI's own tools, MCP connectors, hooks, skills, project instructions, and transcript persistence disabled. Aspira sends the prompt over stdin and provides its own bounded tool actions. |
| OpenAI | Codex CLI (`codex`) | Sign in with ChatGPT. Aspira ignores user/project config and rules, starts an ephemeral read-only session in a private temporary directory, and restricts its filesystem profile to that directory plus minimal runtime paths. |
| xAI | Grok Build (`grok`) | Sign in through Grok Build. Aspira uses a single headless turn in a private temporary directory, with an empty built-in tool list, MCP calls denied, strict sandboxing, web search disabled, and no subagents. |

The **Connections** screen distinguishes an available CLI from a verified sign-in. Claude Code and Codex report their signed-in status through their own local status commands; Antigravity and Grok show CLI availability because Aspira does not have a separate local sign-in check for them. A successful reply is labeled **Provider CLI**. Aspira does not read credential files, expose account details, or verify plan tier. A desktop or web-app login is not treated as an active model connection. When it finds a signed-in provider, Aspira selects that one provider for the first conversation; you can switch or add models from the composer.

You can also add an OpenAI-compatible endpoint in **Settings → Agents & Hot-Plug**. For example, an Ollama server can run locally at `http://127.0.0.1:11434/v1`. API keys entered in Aspira are separate from subscription CLIs. Aspira does not silently substitute a different model or use an API key from the shell environment when the selected provider is unavailable.

Provider CLIs run from a fresh, private temporary working directory so repository instructions and files are not inherited as their workspace. Aspira passes prompts over stdin or through a mode-0600 temporary prompt file and removes temporary files after the response. Provider-native tool access is disabled where the CLI exposes that control; the Codex read-only profile was verified to block access to a sibling directory. Grok Build still uses its installed account configuration for sign-in; Aspira blocks its MCP tool calls and built-in tools for these turns. Per-reply badges identify the path as a provider CLI, direct API, local Ollama, or unavailable; they do not imply a particular account plan.

## What works today

The selected lead model can request tools from Aspira's server-validated action set, then use each real result in its next response. Try `Read README.md and explain how to start the app`, `Run git status and tell me whether there are changes`, `Check my Mac memory and battery`, `Open Calculator`, or `Create a file called notes.md with ...`. Tools can list, search, and read workspace text/source files; create a new file; inspect Git status or basic system status; open an allowlisted Mac app or a URL; search the public web; and save a memory when you explicitly ask. Aspira allows up to three tool actions per provider turn. With no model selected, a small intent parser still handles supported local requests.

This is a bounded text-based tool protocol, not arbitrary computer control. Aspira does not run arbitrary shell commands, overwrite existing files, or run playbooks on a schedule. Workspace reads exclude hidden, generated, dependency, local-data, and likely credential paths. File creation is limited to new files of at most 200 KB in an existing workspace folder. Terminal execution remains an exact read-only command allowlist. While a provider is responding, **Stop** cancels the request and terminates the provider CLI; a local action that already started may still finish.

## Local data

Saved memories and user-created playbooks live in `server/data/` and are ignored by Git. They remain on this Mac. Memories are added only when you ask Aspira to save one. Aspira keeps up to 24 conversations in this browser's local storage so you can search, reopen, and delete them; this data is not synced or encrypted. When you use a provider, Aspira sends your prompt, a small recent conversation window, and up to eight saved memory notes as context. If the model reads a workspace file or runs another tool, Aspira sends that tool's bounded result to the same provider so it can answer.

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
