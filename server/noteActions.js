const CREATE_NOTE_SCRIPT = `on run argv
  set noteTitle to item 1 of argv
  set noteBody to item 2 of argv
  tell application "Notes"
    set targetFolder to default folder
    set createdNote to make new note at targetFolder with properties {name:noteTitle, body:noteBody}
    return name of createdNote
  end tell
end run`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br>');
}

export function extractNoteRequest(prompt) {
  const request = String(prompt || '').trim();
  if (/^(?:how (?:do|can|would) i|what (?:is|does|should)|why (?:should|would|does)|should i|explain how)\b/i.test(request)) return null;
  const match = request.match(/\b(?:create|write|save)\s+(?:a\s+)?note\s+(?:called|named)\s+["'“]?(.+?)["'”]?\s+(?:with|containing)\s+([\s\S]+)/i);
  if (!match) return null;
  const title = match[1].trim().replace(/[.!?]+$/, '');
  const body = match[2].trim().replace(/[.!?]+$/, '');
  return title && body ? { title, body } : null;
}

export function noteAppleScriptRequest({ title, body }) {
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanTitle) throw new Error('A note title is required.');
  if (cleanTitle.length > 200) throw new Error('Note titles are limited to 200 characters.');
  if (!cleanBody) throw new Error('Note content is required.');
  if (cleanBody.length > 20_000) throw new Error('Note content is limited to 20,000 characters.');
  return { script: CREATE_NOTE_SCRIPT, args: [cleanTitle, `<div>${escapeHtml(cleanBody)}</div>`] };
}
