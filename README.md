# Aspira

Aspira is an open-source personal agent workspace for macOS. It brings a conversational interface, supported provider CLIs, local tools, saved memories, and built-in private voice into one window.

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

## One conversation, your agents together

Aspira opens to a conversation, with recent conversations and **Your agents** in the sidebar. Choose who replies from the composer; your choice is remembered in this browser. On mobile, the navigation button opens the same conversations and agents.

- **Ask another agent** prepares a review or continuation of an existing answer. Review the shared answer, choose the responding agents, and send when ready. This uses the existing provider conversations; it does not imply autonomous delegation or background jobs.
- When you select multiple agents, Aspira gives you one combined conversational answer and keeps each original reply under **View contributions**. It sends those replies to the first available selected agent for one additional synthesis request. The composer discloses this because API usage may incur credits and subscription usage may count against your plan. If synthesis is unavailable, Aspira shows the individual replies instead.
- **Open result** displays a received answer alongside the conversation on wide screens, or in a full-screen preview on smaller screens. It is a reading view of the response, not a file explorer or document editor.
- **Needs you** collects recorded edit proposals, interruptions, failed actions, and unavailable-agent replies across saved conversations. Historical notices can be dismissed without deleting their conversations; pending changes remain until resolved.
- **Voice** opens a compact recording panel at the composer. Recording begins only after **Record a message**. Close or cancel recording to discard it; **Stop & send** transcribes and submits it.
- When a provider cannot reply inside Aspira, **Open in [provider]** copies that turn's prompt and opens the provider's official app or site. Aspira may paste it into the app; review it there and submit it yourself. Aspira never presses Send.

There is no Workbench, source browser, terminal panel, or telemetry dashboard in the interface. Existing bounded local tools still work through explicit conversation requests. Agent settings are available from a sidebar agent or **Settings**.

## Connect a model

Aspira uses each provider through the integration it supports. A CLI being installed does not mean every feature from that provider's own app is available inside Aspira.

| Provider | Integration | What Aspira can use |
| --- | --- | --- |
| Google models | Antigravity CLI (`agy`) | A headless, sandboxed plan-mode reply. The CLI's own account handles sign-in. |
| Anthropic | Claude Code (`claude`) | Subscription conversations open in Claude Code. Add an Anthropic API key to receive Claude replies inside Aspira. |
| OpenAI | Codex CLI app-server (`codex`) | Uses the signed-in Codex session, a resumable thread for each Aspira conversation, streamed replies, and structured Aspira actions. Codex runs read-only; file changes still go through Aspira's review card. |
| xAI | Grok Build (`grok`) | A single headless plan-mode reply in a temporary directory, with provider-native tools disabled. |

The **Connections** screen distinguishes provider sign-in from API keys. Codex reports its local sign-in status; Antigravity and Grok show CLI availability because Aspira does not have a separate local sign-in check for them. Claude Code is shown as an app handoff, not an in-Aspira subscription connection. Aspira does not read credential files, expose account details, or verify plan tier. When it finds a signed-in provider, Aspira selects that provider for the first conversation; you can switch or add models from the composer.

You can also add an OpenAI-compatible endpoint in **Settings → Advanced**. For example, an Ollama server can run locally at `http://127.0.0.1:11434/v1`. API keys entered in Aspira are separate from subscription CLIs. Aspira does not silently substitute a different model or use an API key from the shell environment when the selected provider is unavailable.

Antigravity and Grok run in fresh temporary workspaces with their provider-native tools disabled. Codex is different: its app-server runs a persistent thread from the Aspira workspace in a read-only sandbox. Aspira registers structured tools on that thread and checks each request against the user's message and its action rules; unsupported approval requests are declined. API-key and compatible-endpoint requests are separate integrations. Per-reply badges identify the path as a provider CLI, Codex app-server, direct API, local Ollama, or unavailable; they do not imply a particular account plan.

## What works today

The selected lead model can request tools from Aspira's server-validated action set, then use each real result in its next response. Try `Read README.md and explain how to start the app`, `Run git status and tell me whether there are changes`, `Check my Mac memory and battery`, `Open Calculator`, `Remind me to pick up milk`, `Create a note called Shopping with apples and eggs`, or `Create a file called notes.md with ...`. Tools can list, search, and read workspace text/source files in numbered pages; create a new file; inspect Git status or basic system status; create an item in Reminders or Notes; open an allowlisted Mac app or a URL; search the public web; and save a memory when you explicitly ask. Aspira allows up to three tool actions per provider turn. With no model selected, a small intent parser still handles supported local requests.

For an existing file, try `In notes.md, replace "Status: draft" with "Status: ready" and prepare the edit for review`. The agent prepares an exact replacement and a diff without changing the file. Review the inline card, then choose **Apply change** or **Discard**. Apply checks that the file still matches the reviewed version; **Undo this edit** is available only while the file still matches the applied result. Each operation gets its own receipt, which is included in follow-up replies. Proposals survive app restarts and conversation reloads.

This is a bounded action set, not arbitrary computer control. Aspira does not run arbitrary shell commands, apply existing-file edits without review, or run playbooks on a schedule. Creating Notes or Reminders items requires macOS Automation permission. Workspace reads and edits exclude hidden, generated, dependency, local-data, and likely credential paths. File creation is limited to new files of at most 200 KB in an existing workspace folder; reviewed edits support existing UTF-8 text/source files of at most 200 KB. Terminal execution remains an exact read-only command allowlist. While a provider is responding, **Stop** cancels the request and terminates the provider CLI; a local action that already started may still finish.

Your message appears as soon as you send it. The live turn shows provider states, action starts, and completed receipts as they arrive. Codex app-server replies stream text as it is produced; other provider replies currently appear when complete. When multiple models are selected, an early reply is readable while the other models continue. **Stop** keeps your message, replies already received, and completed action receipts in the conversation; actions without a completion receipt are identified as unfinished. Follow-up prompts include bounded excerpts of completed receipts, so the next reply can reason about work that already ran. File-read receipts show exactly which lines were returned and offer **Read next part** for the latest read. You can also say “read the rest,” “read it again,” or “show lines 90–95” without repeating the filename. These follow-ups refer only to the last successfully read file; they do not enable other actions. Continuation checks the file revision and asks for a fresh read if it changed.

## Local data

Saved memories, user-created playbooks, reviewed edit proposals, and Codex conversation links live in `server/data/` and are ignored by Git. They remain on this Mac. Edit proposals retain the before/after file contents for Apply, restart recovery, and Undo in private local files; they are not encrypted. Codex conversation content is also retained by the signed-in Codex app-server according to its own local settings. Memories are added only when you ask Aspira to save one. Aspira keeps up to 24 conversations in this browser's local storage so you can search, reopen, and delete them; this data is not synced or encrypted. When you use a provider, Aspira sends your prompt, a small recent conversation window, and up to eight saved memory notes as context. If the model reads a workspace file or runs another tool, Aspira sends that tool's bounded result to the same provider so it can answer.

Active conversational turns and unsent drafts are also saved in this tab's session storage. Reloading the same tab restores received replies and action receipts and marks an unfinished response as interrupted. It does not rerun actions or continue the provider request in the background. Drafts are kept separately for each conversation, including a new chat with no sent message. Recovery checkpoints are cleared only after the corresponding turn is saved to chat history; they and drafts are scoped to this tab's browser session, rather than synced across tabs or devices. Storage failures appear beside the composer.

When you explicitly ask Aspira to search the web, it sends the search query to DuckDuckGo and returns up to five result titles, snippets, and links. If search returns no readable results or fails, Aspira reports that instead of substituting unrelated stories.

## Built-in voice

Voice input and spoken replies run in the browser using Kokoro-82M and Whisper Tiny through Transformers.js. The voice runtime is included with Aspira; there is no separate service, endpoint, or account to configure. Model files download from Hugging Face on first use and are cached by the browser. Speech audio stays in the browser, while the recognized transcript is sent to the provider you selected when you submit the voice message. Voice input starts only after you press the microphone button. Open **Settings → Voice** to preview the included voice.

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
