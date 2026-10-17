# Aspira conversation-first design

The product is organized around a continuing conversation with chosen agents. The former Workbench, source browser, terminal, mode switcher, and permanent context rail have been removed from the interface. Tools and files appear only when relevant to an explicit request.

## References applied

- [Checklist Design: Chat](https://www.checklist.design/web-app/chat): chronological messages, identifiable contributors, multiline input, and preserving the reader's scroll position.
- [Mobbin](https://mobbin.com/): public references for sparse navigation, readable hierarchy, and coherent flow states. Authenticated screen collections were not inspected, and no proprietary assets were copied.
- [Linear for agents](https://linear.app/agents): agents participate in the work, with understandable activity and human accountability.
- [Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork): one place to converse, hand off a task, and follow its outcome. Aspira does not imply access to Cowork or reproduce its backend capabilities.

## Composition and interactions

A 224px stone sidebar contains conversations, agents, and settings. The ivory canvas gives priority to a readable conversation, with a 760px composer and a single participant picker. The new-conversation composer sits directly under the welcome message. Results open in a 420px contextual pane on wide screens and a modal on smaller screens.

Needs you contains actual recorded review items and failures. Historical notices can be dismissed; proposals require an actual review outcome. Agent review shows what will be shared before sending and stays in the same thread. Voice is included and opens at the composer, with recording off until explicitly started.

The visual system uses #FAF9F6 ivory, #F1F0EC stone, #242522 charcoal, and #A9412B terracotta. Conversation text is 16px with generous line spacing; supporting text remains readable. Motion reflects actual activity and respects reduced-motion preferences.

## Acceptance

Verify desktop and 390px/320px layouts, keyboard focus and Escape in sheets/settings, agent selection across reload, failure recovery, review sharing, result previews, and voice controls without granting microphone access during automated checks. Pending proposals and completed action receipts must remain truthful after reload. Existing user data stays private and Git-ignored.
