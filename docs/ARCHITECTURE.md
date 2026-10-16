# Aspira architecture

Aspira is a local-first personal-agent workspace. The browser interface runs on Vite at `127.0.0.1:5173`; an Express service at `127.0.0.1:3001` handles provider CLI calls and local tools. The API binds to loopback and Vite proxies `/api` requests to it.

## Conversation and providers

`src/App.tsx` owns the selected providers, current conversation, saved context, and voice state. `src/plugins/models/synergyEngine.ts` sends each turn to the selected providers through `/api/dispatch` and renders their separate responses. The app does not invent model output, agreement scores, token rates, or latency estimates. If no provider is selected, the local action parser can still handle a supported request; other prompts explain that a provider is needed.

The server detects whether supported CLI programs are installed. It checks Claude Code's signed-in status through its own status command; it does not read credential files or return account details. Other providers are confirmed only when a real request succeeds:

- Google: Antigravity CLI (`agy`), sandbox and plan mode.
- Anthropic: Claude Code (`claude`), print and plan mode.
- OpenAI: Codex CLI (`codex`), read-only mode.
- xAI: Grok Build CLI (`grok`), plan mode.

The provider's subscription, CLI support, account state, and terms determine whether a request succeeds. Optional API-compatible endpoints and explicit API keys are separate settings. A desktop app being installed does not connect its model to Aspira.

## Local action boundary

`server/index.js` maps a small set of explicit user requests to local tools: read system status, run exact allowlisted read-only commands, read or create files inside the workspace, open a named macOS app or public URL, show a local notification, search a small set of public sources, and save a memory when the user asks. Paths are checked against the workspace root, including symlinks. Commands run with argument arrays, not a shell.

This is a deterministic intent parser and tool registry. Models do not yet receive a general tool-calling loop, edit arbitrary files, run arbitrary shell commands, or operate on a schedule. The listed routines are user-triggered local playbooks. Source preview and Git diff in Workbench are read-only; the file list is not an AST index.

## Local data and voice

Memories and user-edited playbooks are stored in `server/data/` on this Mac and excluded from Git. Memories are saved only after an explicit request; Aspira does not automatically extract them from conversation. Conversation turns currently remain in the open browser tab and are cleared on reload.

Voice starts only after pressing the microphone button. The browser records a short message and sends it to the local MLX-Audio transcription endpoint. Speech output uses the local MLX-Audio service when configured. Neither path has a synthetic browser voice fallback. The optional passphrase is a browser convenience lock, not device authentication.

## Main code paths

- `src/App.tsx`: top-level state, chat flow, provider selection, optional voice and lock.
- `src/components/SpatialModeDeck.tsx`: Studio, Workbench, saved context, local playbooks, and tool results.
- `src/components/PlugAndPlayVaultModal.tsx`: provider, endpoint, voice, and passphrase settings.
- `src/plugins/models/manifest.ts`: provider and conversation data types.
- `src/plugins/models/synergyEngine.ts`: provider dispatch and truthful result aggregation.
- `server/index.js`: local API, CLI invocation, local actions, memory, routines, file graph, Git diff, and voice proxy.

Run `npm run dev` for local development, `npm run build` for the production bundle, and `npx tsc --noEmit` for the TypeScript check. `npm run voice:local` starts the optional on-device voice service on Apple Silicon.
