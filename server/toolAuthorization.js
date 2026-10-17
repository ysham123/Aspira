export function toolAuthorizationError(tool, prompt, readContinuation) {
  const rawText = String(prompt || '').trim();
  const text = rawText.toLowerCase();
  const informationalQuestion = /^(?:how (?:do|can|would) i|what (?:is|does|should)|why (?:should|would|does)|should i|explain how)\b/.test(text);
  const directPageQuestion = tool === 'browser.read_page' && /^what(?:'s| is)\s+(?:on|in|shown|written|displayed)\s+(?:the\s+)?(?:page|website|site|browser|tab|article|inbox)\b/.test(text);
  const namesWorkspaceFile = /(?:^|[\s`'"(])(?:[\w.-]+\/)*[\w.-]+\.(?:md|mdx|txt|json|ts|tsx|js|jsx|css|html|py|yml|yaml|toml|xml|sh|sql|swift|go|rs)\b/i.test(text);
  const hasWorkspaceIntent = namesWorkspaceFile || /\b(workspace|repository|repo|codebase|project|folder|file|files|source|git|branch|diff|code)\b/.test(text) || (tool === 'workspace.read_file' && Boolean(readContinuation));
  if (tool.startsWith('workspace.') && !hasWorkspaceIntent) {
    return 'Aspira can inspect workspace files only when the user asks about the project, code, files, or repository.';
  }
  if (tool === 'workspace.git_status' && !/\b(git|repository|repo|branch|working tree|changes|diff|status)\b/.test(text)) {
    return 'The user did not ask to inspect Git or repository changes.';
  }
  if (tool === 'workspace.create_file' && !/\b(create|write|save|generate|make)\b/.test(text)) {
    return 'Creating a file requires an explicit request to create or write one.';
  }
  if (tool === 'workspace.propose_edit' && !/\b(edit|update|change|fix|replace|rewrite|add|remove|improve|correct)\b/.test(text)) {
    return 'Preparing a file edit requires a request to change the workspace file.';
  }
  if (tool === 'system.status' && !/\b(system|mac|macos|cpu|memory|ram|battery|power|hardware)\b/.test(text)) {
    return 'The user did not ask for local system information.';
  }
  if (tool === 'app.open' && !/\b(open|launch|start)\b/.test(text)) {
    return 'Opening an app requires an explicit request to open or launch it.';
  }
  if (tool === 'browser.open_url' && (informationalQuestion || !/\b(open|visit|go to|browse to|navigate to)\b/.test(text))) {
    return 'Opening a URL requires an explicit request to open or visit it.';
  }
  if (tool === 'browser.read_page' && ((informationalQuestion && !directPageQuestion) || !/\b(read|inspect|summari[sz]e|analy[sz]e|describe|extract|find|check|what(?:'s| is))\b/.test(text) || !/\b(page|website|site|browser|tab|article|inbox)\b/.test(text))) {
    return 'Reading a browser page requires an explicit request to inspect or read a page, site, tab, article, or inbox.';
  }
  if (tool === 'browser.click' && (informationalQuestion || !/\b(click|select|follow|choose)\b/.test(text))) {
    return 'Clicking a browser control requires an explicit request to click, select, or follow a named page control.';
  }
  if (tool === 'browser.fill' && (informationalQuestion || /^what can i\b/.test(text) || !/\b(fill|type|enter|write)\b/.test(text) || !/\b(field|input|form|search|box|browser|page|site|website)\b/.test(text))) {
    return 'Filling a browser field requires an explicit request to type, enter, or fill a value into a page field.';
  }
  if (tool === 'browser.close' && (informationalQuestion || !/\b(close|quit|shut)\b/.test(text))) {
    return 'Closing Aspira Browser requires an explicit request to close it.';
  }
  if (tool === 'web.search' && !/\b(search|look up|latest|current|news|research|browse)\b/.test(text)) {
    return 'Public web search requires an explicit search, research, or current-information request.';
  }
  if (tool === 'memory.save' && !/\b(remember|save to memory|don't forget|do not forget)\b/.test(text)) {
    return 'Saving a memory requires an explicit request to remember or save it.';
  }
  if (tool === 'reminders.create' && (informationalQuestion || !/\b(?:remind me to|remind me about|remember to|add (?:a )?(?:reminder|task|to-?do) (?:to|for)|create (?:a )?(?:reminder|task) (?:to|for))\b/.test(text))) {
    return 'Creating a reminder requires an explicit request to add a reminder, task, or to-do.';
  }
  if (tool === 'notes.create' && (informationalQuestion || !/\b(?:create|write|save)\s+(?:a\s+)?note\b/.test(text))) {
    return 'Creating a note requires an explicit request to create, write, or save one.';
  }
  if (tool === 'mail.draft' && (informationalQuestion || !/\b(?:draft|compose|write)\s+(?:me\s+)?(?:an?\s+)?email\b/.test(text))) {
    return 'Opening an email draft requires an explicit request to draft, compose, or write an email.';
  }
  return null;
}
