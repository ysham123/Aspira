function describeClaudeError(result) {
  const detail = typeof result?.result === 'string' ? result.result : '';
  const errorText = `${result?.api_error || ''} ${detail}`.toLowerCase();
  const status = Number(result?.api_error_status);

  if (status === 429 || /rate.?limit|usage limit|weekly limit/.test(errorText)) {
    return 'Claude has reached its current usage limit. Wait for the reset or use an API key.';
  }
  if ([401, 403].includes(status) || /not logged in|authentication required|unauthorized/.test(errorText)) {
    return 'Claude Code is not signed in. Finish sign-in, then retry.';
  }
  return 'Claude Code could not complete the request. Check its sign-in and connection, then retry.';
}

export function parseClaudeStream(output) {
  const events = [];
  for (const line of String(output || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Ignore non-event lines; Claude Code sends diagnostics to stderr.
    }
  }

  const result = events.filter((event) => event?.type === 'result').at(-1);
  if (!result) return { text: '', error: 'Claude Code did not complete the request.' };
  if (result.is_error) return { text: '', error: describeClaudeError(result) };

  const text = typeof result.result === 'string' ? result.result.trim() : '';
  return text
    ? { text, error: '' }
    : { text: '', error: 'Claude Code completed without a text response.' };
}
