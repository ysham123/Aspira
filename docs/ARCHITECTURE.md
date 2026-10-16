# Aspira architecture

Aspira is a local-first personal-agent workspace. The browser interface runs on Vite at `127.0.0.1:5173`; an Express service at `127.0.0.1:3001` handles provider CLI calls and local tools. The API binds to loopback and Vite proxies `/api` requests to it.

## Conversation and providers

`src/App.tsx` owns the selected providers, current conversation, saved context, and voice state. If Aspira verifies a signed-in provider at startup, it selects that provider for the first conversation; the user can change the selection. `src/plugins/models/synergyEngine.ts` sends each turn to the selected providers through `/api/dispatch` and renders their separate responses. Only the lead model receives the tool protocol and may run local actions; other selected models receive the conversation and return their own responses. The app does not invent model output, agreement scores, token rates, or latency estimates. If no provider is selected, the local action parser can still handle a supported request; other prompts explain that a provider is needed.

The browser requests newline-delimited JSON from `/api/dispatch`; clients without that Accept header retain the ordinary JSON response contract. Activity events report provider waits, action starts, and actual action receipts, followed by one terminal result. The browser renders the user's turn immediately and can show each model's finished reply before the other providers finish. Cancellation preserves received replies and action receipts and names started actions whose completion was not reported. Follow-up model context includes up to three recorded action outputs per recent turn, with each excerpt capped at 2,000 characters and explicitly marked when shortened, so stopping a reply does not erase evidence of work that already ran. A shared execution guard prevents overlapping chat, playbook, and app-handoff requests from overwriting the current task state. This does not stream provider tokens.

The server detects whether supported CLI programs are installed. It checks Claude Code and Codex sign-in status through their own local status commands; it does not read credential files or return account details. Antigravity and Grok show CLI availability in Settings; successful replies identify the CLI as the response path:

- Google: Antigravity CLI (`agy`), sandbox and plan mode.
- Anthropic: Claude Code (`claude`), print and plan mode.
- OpenAI: Codex CLI (`codex`), read-only mode.
- xAI: Grok Build CLI (`grok`), plan mode.

The provider's CLI support, account state, plan, and terms determine whether a request succeeds. Aspira verifies only the CLI status information exposed by the provider and does not inspect or claim the account's plan tier. Optional API-compatible endpoints and explicit API keys are separate settings. A desktop app being installed does not connect its model to Aspira.

Each subscription request gets a fresh private temporary working directory; the prompt reaches the provider over stdin or a mode-0600 temporary file, never in command-line arguments. Claude runs in safe mode with its built-in tools, MCP connectors, hooks, skills, project instructions, and transcript persistence disabled. Grok runs one headless turn with built-in tools disabled, MCP calls denied, strict sandboxing, web search disabled, and no subagents. Codex ignores user/project config and rules, runs ephemerally, and uses a read-only filesystem profile limited to that temporary directory plus minimal runtime paths. Antigravity uses its headless sandbox and plan mode with slash-command expansion disabled. The selected provider's CLI performs subscription authentication; the server does not read its credential store. API-key, token, secret, password, and credential environment variables are removed from subscription CLI environments; direct API requests use only keys configured in Aspira. The composer can cancel a provider request; the server forwards the abort to the provider CLI or direct HTTP request. A local action that has already started may still finish.

## Local action boundary

`server/index.js` maps explicit requests to a bounded tool registry. Alongside the no-model intent parser, the selected lead model can return one exact JSON tool request at a time. The server parses the request, checks that the user asked for the corresponding action, maps it to a registered implementation, and returns the actual result to the model. A turn is limited to three tool calls before the model must answer. Available model tools are Git status; workspace listing, text search, file reads, and new-file creation; basic system status; allowlisted app launch; URL opening; public web search; and explicitly requested memory saves. Commands run with argument arrays and an exact read-only allowlist, not a shell.

Workspace reads are limited to text/source extensions and exclude hidden, generated, dependency, local-data, and likely credential paths. Path checks include resolved symlink targets. Reads are capped at 1 MB on disk and 5,000 characters returned; search is bounded by file count and result count. File creation is limited to a new file, at most 200 KB, under an existing workspace directory. Aspira does not expose arbitrary shell execution, overwrite existing files, or schedule routines. The listed routines remain user-triggered local playbooks. Source preview and Git diff in Workbench are read-only; the file list is not an AST index.

## Local data and voice

Memories and user-edited playbooks are stored in `server/data/` on this Mac and excluded from Git. Memories are saved only after an explicit request; Aspira does not automatically extract them from conversation. Up to 24 conversations are stored in browser local storage, where the user can search, reopen, and delete them; this data is not synced or encrypted. Provider prompts include the user's prompt, a small recent conversation window, and up to eight saved memory notes. Results from a requested tool call are sent to the same provider for the follow-up response.

Voice input and spoken replies run in a browser worker with Kokoro-82M and Whisper Tiny through Transformers.js. The browser downloads model files from Hugging Face on first use and caches them. Audio inference does not call a local or remote speech service; only the recognized transcript is sent to the selected model when the user submits a voice message. Microphone capture begins only after the user presses the voice control. The optional passphrase is a browser convenience lock, not device authentication.

## Main code paths

- `src/App.tsx`: top-level state, chat flow and local conversation-history persistence, provider selection, voice controls, and lock.
- `src/components/ConversationHistoryPanel.tsx`: searchable local chat history and thread controls.
- `src/plugins/models/conversationHistory.ts`: browser-local conversation validation, titles, dates, and retention cap.
- `src/components/SpatialModeDeck.tsx`: Studio, Workbench, saved context, local playbooks, and tool results.
- `src/components/PlugAndPlayVaultModal.tsx`: provider, endpoint, built-in voice, and passphrase settings.
- `src/audio/speech.worker.ts`: browser worker for speech generation and transcription.
- `src/audio/soundEngine.ts`: voice model status, browser audio playback, and microphone audio preparation.
- `src/plugins/models/manifest.ts`: provider and conversation data types.
- `src/plugins/models/synergyEngine.ts`: provider dispatch and truthful result aggregation.
- `server/index.js`: local API, CLI invocation, local actions, memory, routines, file graph, and Git diff.

Run `npm run dev` for local development, `npm run build` for the production bundle, and `npx tsc --noEmit` for the TypeScript check. Voice model files download automatically when voice is first used.
