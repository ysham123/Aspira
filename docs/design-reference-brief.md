# Aspira design reference brief

**Research date:** 2026-10-16
**Scope:** Public design guidance from Checklist Design and Mobbin, mapped to the current Aspira frontend. This brief is for a premium, conversational personal-agent workspace. Keep the calm light palette and familiar app conventions; remove any remaining cockpit, arcade, or sci-fi HUD language and decoration. Use interaction principles, not copied branding, icons, or screen layouts.

## What I inspected

Checklist Design’s public pages provided detailed checklists for chat, inputs, settings, empty states, loading, errors, and success feedback. I inspected Mobbin’s public homepage/gallery and its public MCP showcase. I did not access Mobbin’s full app-specific screen collections, so this brief makes no claims about screens that were not publicly visible in that pass.

The current Aspira frontend was checked at desktop and 390 × 844. It already has a warm neutral surface, a `Studio` chat view, a `Workbench`, recent chats, a fixed composer, and a `Connections` dialog. On desktop, the saved-context rail can occupy a large part of the first screen. On mobile, the main navigation becomes mostly icon-led and the composer stays at the bottom. Relevant code lives in [App.tsx](../src/App.tsx), [SpatialModeDeck.tsx](../src/components/SpatialModeDeck.tsx), [ConversationHistoryPanel.tsx](../src/components/ConversationHistoryPanel.tsx), [PlugAndPlayVaultModal.tsx](../src/components/PlugAndPlayVaultModal.tsx), and [styles.css](../src/styles.css).

## Observed patterns and how Aspira should use them

| Pattern and public evidence | Aspira application |
|---|---|
| **Conversation thread:** [Checklist Design: Web app chat](https://www.checklist.design/web-app/chat) specifies a chronological thread, recent messages at the bottom, multiline composition, and grouping consecutive messages. It cautions that new arrivals should not interrupt someone reading older messages. | Keep one continuous conversation as the product’s main surface. Keep agent actions and their results attached to the user turn that caused them. Auto-scroll only when the user is already near the latest message; otherwise preserve their reading position and offer a clear jump-to-latest control. The current composer already supports Enter to send and Shift+Enter for a newline. |
| **Phone chat:** [Checklist Design: Mobile chat](https://www.checklist.design/mobile/chat) calls for a bottom input bar that remains reachable when the keyboard opens, inline media previews, and a way to return to the latest message while scrolled up. | Preserve the bottom composer on narrow screens. Verify the on-screen keyboard does not cover it or hide the send, model, or voice controls. Keep conversation scrolling independent from surrounding chrome. |
| **Navigation and visual hierarchy:** Mobbin’s [public library](https://mobbin.com/) groups references into Apps, Sites, Screens, Flows, Animations, and UI Elements; its public gallery shows platform and sort/filter controls above screen cards. | Keep the top-level Aspira map small and task-based: chat first, Workbench and Connections as supporting destinations. Group model choices by understandable source/type as the list grows instead of adding more named “modes.” Keep the selected destination visually clear on desktop and mobile. |
| **Agent progress and synthesis:** Mobbin’s [public MCP showcase](https://mobbin.com/mcp) demonstrates a natural-language request followed by a visible search, a result count, and a short synthesis of the strongest patterns. The complete design-library results shown there are part of Mobbin’s product, not a claim about publicly accessible app screens. | Use the same legible progress shape for Aspira actions: say what is happening in plain language, show whether it is still working, then place the useful result in the conversation. Avoid exposing internal tool names as the primary user-facing label. |
| **Settings:** [Checklist Design: Web app settings](https://www.checklist.design/web-app/settings) recommends logical categories, elevating commonly changed settings, separating security controls, and isolating destructive actions. | In `Connections`, put provider connection state and the next useful action first. Group provider CLIs, local/custom models, voice, and optional passkey controls with clear section names. Keep the optional passkey feature distinct from ordinary model connection. |
| **Input fields:** [Checklist Design: Input field](https://www.checklist.design/design-system/input-field) recommends readable text, a visible label, example placeholders that are visually distinct from entered values, and a hint when the expected format may be unclear. | Apply this to model endpoint, API key, voice endpoint, and passkey settings. Keep labels visible after typing; state which fields are optional, give examples for endpoint/model formats, and place validation beside the field it describes. |
| **Empty states:** [Checklist Design: Empty state](https://www.checklist.design/web-app/empty-state) calls for a contextual heading, a brief explanation, a useful next action, and separate treatments for genuinely empty data, no search results, and failed loading. | Keep the existing “What are you working on?” starter prompts in the new-chat state. Add a direct connect action when no model is available. Give empty history, unmatched chat search, and failed history/context loading different messages and recovery actions. |
| **Loading and completion:** [Checklist Design: Loading](https://www.checklist.design/design-system/loading) recommends specific progress text when a wait is meaningful. [Submitting a form](https://www.checklist.design/flows/submitting-a-form) calls for visible loading, success, and failure feedback. | Show concise task-specific activity in the conversation or connection card, such as “Connecting to Claude Code” or “Checking local voice,” with a stop/retry path when applicable. Confirm successful saves and connections in place; distinguish a provider that is unavailable from one that is simply not selected. |
| **Error and success language:** [Checklist Design: Showing input error](https://www.checklist.design/flows/showing-input-error), [Alert](https://www.checklist.design/design-system/alert), and [Toast](https://www.checklist.design/design-system/toast) recommend explaining what happened and how to fix it, using icon plus semantic color, placing feedback near the relevant control, and keeping transient toasts concise and dismissible. | Give blocked actions, provider sign-in failures, invalid fields, and network errors distinct plain-language states. Put the corrective action beside the message. Use color as reinforcement, never as the only signal; keep successful action details collapsed when they are raw/technical output. |

## Prioritized acceptance criteria for the next frontend pass

### P0 — Make conversation the clear primary experience

- The first screen gives the conversation and message composer the most space. Saved context stays collapsed until requested or directly relevant; opening it does not squeeze the thread on common laptop widths.
- The user can see which model or models will answer in one obvious place. Provider connection state is shown separately from selection state.
- New replies do not pull the viewport away from older messages. When the user is not at the bottom, show a jump-to-latest affordance.
- Each local action has a plain-language title, an in-progress/completed/blocked/failed state, and a readable result. Raw diagnostic output remains available on demand.

### P1 — Make setup and recovery understandable

- Connections are grouped by task, with the connection’s actual state and one clear next action per provider. Local models and optional voice/passkey controls are easy to find without crowding the chat.
- Every settings field has a persistent label, a short hint or example when needed, visible validation, and a clear saved/failed result.
- New chat, no model, no history, no search results, loading failure, and request failure each have distinct copy and recovery actions.
- Progress copy names the operation and target. Success and error messages explain what happened in text and iconography, not color alone.

### P1 — Preserve the experience on small screens

- At 390 × 844 and 320 × 720, there is no horizontal page overflow; chat text and action cards wrap without clipping.
- With a mobile keyboard open, the composer and its send/model controls remain visible and reachable. The latest-message control remains available after scrolling upward.
- Mobile navigation shows the active destination clearly. Icon-only controls have accessible names and sufficiently large targets.

### P2 — Finish the visual system

- Retain a restrained neutral canvas and a small accent palette. Use consistent type scale, spacing, border, and status treatments across chat, Workbench, and Connections.
- Raise low-contrast micro-labels and very small secondary text to comfortable reading sizes, especially in the chat history, model status, and settings cards.
- Remove remaining “reactor,” “overwatch,” “ignition,” “core,” orbital, scanner, and telemetry motifs from user-facing copy and visuals. The interface should feel like a carefully finished AI workspace, not a themed control panel.

## Source limits

Only Checklist Design and Mobbin were used for online design inspiration. Mobbin’s full app-specific screen/flow collections were not accessed; the public homepage/gallery and MCP showcase were the evidence used here. Checklist Design pages above are public and expose their checklist text directly.
