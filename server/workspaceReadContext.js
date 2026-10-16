import path from 'node:path';

const normalizePath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.isAbsolute(value)) return null;
  const normalized = path.posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../')) return null;
  return normalized;
};

export function readContinuationForPrompt(prompt, context) {
  if (!context || !/^[a-f0-9]{64}$/.test(context.revision || '') || !normalizePath(context.path)) return null;
  const text = String(prompt || '').trim();
  if (/\b(?:do not|don't|stop|never)\s+(?:(?:keep|continue)\s+)?(?:re-?)?read(?:ing)?\b|\bwithout reading\b/i.test(text)) return null;
  const filePath = normalizePath(context.path);
  const namedFiles = [...text.matchAll(/(?:[\w.-]+\/)*[\w.-]+\.(?:md|mdx|txt|json|ts|tsx|js|jsx|css|html|py|yml|yaml|toml|xml|sh|sql|swift|go|rs)\b/gi)].map((match) => normalizePath(match[0]));
  if (namedFiles.some((name) => name !== filePath && name !== path.posix.basename(filePath))) return null;
  const range = text.match(/\blines?\s+(\d+)(?:\s*(?:-|–|through|to)\s*(\d+))?/i);
  if (range && /\b(read|show|inspect|summari[sz]e|explain)\b/i.test(text)) {
    const startLine = Number(range[1]);
    const endLine = range[2] ? Number(range[2]) : undefined;
    const startColumn = Number(text.match(/\bcolumn\s+(\d+)/i)?.[1] || 1);
    if (![startLine, startColumn, ...(endLine === undefined ? [] : [endLine])].every((value) => Number.isSafeInteger(value) && value > 0) || (endLine !== undefined && endLine < startLine)) return null;
    return { path: filePath, mode: 'range', startLine, startColumn, endLine,
      revision: /\b(current|fresh|again)\b/i.test(text) ? undefined : context.revision };
  }
  const next = /\b(?:read|show)\b[\s\S]*\b(?:rest|remaining|remainder|more|next (?:part|page|section|lines))\b|\b(?:summari[sz]e|explain)\b[\s\S]*\b(?:rest|remaining|remainder|next (?:part|section))\b|\b(?:continue|keep) reading\b|\bnext (?:part|page|section)\b/i.test(text);
  const restart = /\b(?:read|show|inspect)\s+(?:it|that|this)(?:\s+(?:file|again))?\b|\bread\b[\s\S]*\b(?:again|from the (?:start|beginning))\b/i.test(text);
  if (!next && !restart) return null;
  if (next && (typeof context.hasMore !== 'boolean' || (context.hasMore && (!Number.isSafeInteger(context.nextLine) || context.nextLine < 1 || !Number.isSafeInteger(context.nextColumn) || context.nextColumn < 1)))) return null;
  return { path: filePath, mode: next ? 'next' : 'restart', revision: context.revision, hasMore: context.hasMore, nextLine: context.nextLine, nextColumn: context.nextColumn };
}

export function contextualReadArguments(args, continuation) {
  if (!continuation) return { arguments: args };
  if (args.path && normalizePath(args.path) !== continuation.path) {
    return { error: `This follow-up refers to ${continuation.path}; it does not authorize reading a different file.` };
  }
  if (continuation.mode === 'range') {
    return { arguments: { path: continuation.path, startLine: continuation.startLine, startColumn: continuation.startColumn,
      endLine: continuation.endLine, maxLines: continuation.endLine ? Math.min(200, continuation.endLine - continuation.startLine + 1) : undefined,
      expectedRevision: continuation.revision } };
  }
  if (continuation.mode === 'next') {
    if (!continuation.hasMore) return { error: `The last read already reached the end of ${continuation.path}. Ask for a fresh read if needed.` };
    return { arguments: { ...args, path: continuation.path, startLine: continuation.nextLine, startColumn: continuation.nextColumn, expectedRevision: continuation.revision } };
  }
  return { arguments: { ...args, path: continuation.path, startLine: 1, startColumn: 1, expectedRevision: undefined } };
}
