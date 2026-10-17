export function parseAntigravityStream(output) {
  const events = [];
  for (const line of String(output || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Ignore non-event lines; the CLI sends diagnostics to stderr.
    }
  }

  const result = events.filter((event) => event?.event === 'result').at(-1)?.result;
  if (!result || result.status !== 'SUCCESS') {
    return { text: '', error: 'Antigravity did not complete the request.' };
  }
  const text = typeof result.response === 'string' ? result.response.trim() : '';
  return text
    ? { text, error: '' }
    : { text: '', error: 'Antigravity completed without a text response.' };
}
