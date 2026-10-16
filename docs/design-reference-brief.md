# Aspira design and frontend brief

**Reviewed:** 2026-10-16
**Goal:** A premium personal-agent workspace where conversation is the main way to work. Keep the current warm, restrained visual base and familiar app controls. Avoid cockpit language, floating HUD decoration, and branded screen or asset imitation.

## Evidence and scope

I reviewed the public interaction checklists on [Checklist Design](https://www.checklist.design/) and the public [Mobbin homepage/gallery](https://mobbin.com/) and [Mobbin MCP showcase](https://mobbin.com/mcp). Mobbin’s public pages show the library categories and an example of an agent request, visible search progress, result count, and synthesis. I did not inspect full app-specific screen collections, so recommendations below do not depend on unseen Mobbin screens.

I inspected Aspira at 1280 × 720 and 390 × 844, and read the current frontend in [App.tsx](../src/App.tsx), [SpatialModeDeck.tsx](../src/components/SpatialModeDeck.tsx), [ConversationHistoryPanel.tsx](../src/components/ConversationHistoryPanel.tsx), [PlugAndPlayVaultModal.tsx](../src/components/PlugAndPlayVaultModal.tsx), and [styles.css](../src/styles.css). At 390 px, the document width is 390 px and the composer is visible at the bottom. I did not test with a real phone keyboard.

## Current UI critique

Aspira has a good foundation: a warm neutral palette, a central Studio conversation, starter prompts, recent chats, a persistent composer, and a separate Workbench. The context rail now starts closed on ordinary laptop widths. The chat has a progress indicator, preserves scroll position when the user has moved away from the bottom, and offers “Jump to latest.” Action receipts distinguish completed, blocked, and failed work, with raw output tucked behind disclosure.

The next pass should fix hierarchy and state clarity before adding more surfaces:

- Model selection appears in both the top bar and the composer. Keep one clear selector that names active models; show provider connection health separately.
- Progress currently says which model is thinking, but not what the agent is doing. Add a short task phase in the same conversation, then show the result there.
- On the mobile view, destination labels are hidden and navigation depends on icons. Keep the selected destination identifiable at a glance, with accessible names and touch-sized controls.
- Connection cards distinguish “Signed in,” “Sign-in required,” “CLI found,” and “Status unknown,” which is useful. Match each card’s primary button to its state; a signed-in card should not lead with a sign-in action unless that action is explicitly a reconnect.
- The empty conversation is already useful: it explains readiness and offers concrete starting tasks. Preserve this instead of replacing it with a decorative dashboard.

## Design principles from the public references

1. **Make the conversation the home surface.** [Checklist’s web chat checklist](https://www.checklist.design/web-app/chat) emphasizes ordered messages, a multiline composer, and keeping the latest message at the bottom without interrupting someone reading older turns. Keep prompts, action receipts, model attribution, and results in one timeline. Only auto-scroll when the user is following the latest turn.

2. **Keep mobile chat reachable.** [Checklist’s mobile chat checklist](https://www.checklist.design/mobile/chat) calls out keyboard-aware bottom composition and a clear route back to the newest message. Keep the composer visible above the mobile keyboard, and keep conversation scrolling independent from navigation and context panels.

3. **Use task-based navigation and grouping.** Mobbin’s [public library](https://mobbin.com/) organizes examples by product type and by screens, flows, animations, and UI elements, with platform and filter controls. Aspira should keep a small, stable navigation set: Studio, Workbench, Connections. Organize model and settings choices by what the user wants to do, not by internal architecture.

4. **Show the agent’s work in plain language.** Mobbin’s [public MCP showcase](https://mobbin.com/mcp) depicts a prompt, a visible search step, a result count, and then a short synthesis. For Aspira, show a concise activity phase such as “Checking the workspace” or “Waiting for Claude Code,” followed by the useful result in chat. Keep internal tool IDs and raw output secondary.

5. **Make connection state actionable.** [Checklist’s settings checklist](https://www.checklist.design/web-app/settings) recommends logical categories and elevating common controls. Put provider status and its next action first, then group local models and optional voice/passkey settings. Keep “not checked,” “not detected,” “CLI available,” “signed in,” and “sign-in required” visually and verbally distinct.

6. **Label fields and explain failures where they happen.** [Checklist’s input-field guidance](https://www.checklist.design/design-system/input-field) favors readable text, persistent labels, differentiated example placeholders, and useful hints. [Its input-error flow](https://www.checklist.design/flows/showing-input-error) advises letting people finish typing before validation. Use this in model, voice, and optional passkey forms; place specific errors and corrective actions beside the relevant field.

7. **Give empty, loading, success, and failure states different jobs.** [Empty-state guidance](https://www.checklist.design/web-app/empty-state) separates new/empty data, no search results, and load failure. [Loading](https://www.checklist.design/design-system/loading) and [form submission](https://www.checklist.design/flows/submitting-a-form) call for visible progress and a clear completion or failure outcome. [Alerts](https://www.checklist.design/design-system/alert) and [toasts](https://www.checklist.design/design-system/toast) favor descriptive copy, semantic color plus an icon, and feedback near the affected control. Give each Aspira state a recovery action; do not use a generic spinner or success label for all cases.

8. **Let restraint create the premium feel.** Retain the soft neutral canvas, generous spacing, strong readable type, and restrained accent color. Reserve status color for state. Avoid layering glass, glows, tiny technical labels, faux telemetry, and decorative motion over the conversation.

## Acceptance criteria

### P0: Conversation and agent feedback

- A new user sees the conversation, a clear model selector, and useful starter tasks without opening a secondary panel.
- There is one model-selection control. Provider health and whether a model is selected are separate states.
- Agent progress names the current task or phase, appears in the conversation, and has an understandable stop state when cancellation is available.
- Action receipts show a plain-language action, status, and useful result. Raw diagnostics stay collapsed after success and open by default only when they help explain a failure or block.
- Reading older turns is never interrupted by incoming output; a jump-to-latest control appears when needed.

### P1: Connections, states, and responsive layout

- Every provider card’s status and primary action agree. Refresh failures say whether the status is unknown or last-known, and provide a retry.
- Empty chat, no model, empty history, no search match, loading, save success, and request failure have distinct copy and next steps.
- At 390 px and 320 px, there is no horizontal page overflow; chat text, provider cards, and action details wrap without clipping.
- With a mobile keyboard open, the composer and its send/model controls remain reachable. The active destination is visually discoverable, including when navigation labels are compacted.

### P2: Visual finish

- Use a consistent type scale, spacing, border, and status system across Studio, Workbench, and Connections. Keep important supporting text readable; avoid relying on 9–10 px labels for meaning.
- Keep the UI calm and familiar. Do not reintroduce clap-to-start, floating model orbs, reactor/overwatch terminology, or ornamental telemetry.

**Source boundary:** Only Checklist Design and Mobbin were used for online inspiration. Mobbin’s app-specific screen collections were not accessed. The recommendations abstract visible patterns; they do not reproduce a product’s exact screen, copy, icon, or visual identity.
