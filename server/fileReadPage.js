import { createHash } from 'node:crypto';

const MAX_PAGE_CHARS = 6000;
function positiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive whole number.`);
  return value;
}

export function createFileReadPage(rawContent, relativePath, options = {}, redact = (text) => text) {
  if (Buffer.byteLength(rawContent, 'utf8') > 1_000_000) throw new Error('This file is too large to read through Aspira.');
  const revision = createHash('sha256').update(rawContent).digest('hex');
  if (options.expectedRevision !== undefined && options.expectedRevision !== revision) {
    throw new Error('This file changed since the previous read. Ask for a fresh read before continuing; no page from the changed file was returned.');
  }
  const content = redact(rawContent);
  const lines = content ? content.split(/\r\n|\r|\n/) : [];
  if (lines.at(-1) === '' && /[\r\n]$/.test(content)) lines.pop();
  const totalLines = lines.length;
  const startLine = positiveInteger(options.startLine, 1, 'startLine');
  const startColumn = positiveInteger(options.startColumn, 1, 'startColumn');
  const maxLines = Math.min(positiveInteger(options.maxLines, 80, 'maxLines'), 200);
  const requestedEnd = positiveInteger(options.endLine, totalLines || 1, 'endLine');
  if (requestedEnd < startLine) throw new Error('endLine must not precede startLine.');
  if ((totalLines && startLine > totalLines) || (!totalLines && (startLine !== 1 || startColumn !== 1))) {
    throw new Error(`The file contains ${totalLines} lines; the requested start is outside it.`);
  }
  if (totalLines && startColumn > lines[startLine - 1].length + 1) throw new Error('startColumn is outside the requested line.');
  const initialLine = lines[startLine - 1] || '';
  if (startColumn > 1 && /[\uD800-\uDBFF]/.test(initialLine[startColumn - 2] || '') && /[\uDC00-\uDFFF]/.test(initialLine[startColumn - 1] || '')) {
    throw new Error('startColumn must not split a Unicode character.');
  }

  const lastRequested = Math.min(totalLines, requestedEnd, startLine + maxLines - 1);
  const outputLines = [];
  let remaining = MAX_PAGE_CHARS;
  let nextLine = totalLines ? startLine : null;
  let nextColumn = totalLines ? startColumn : null;
  let endLine = 0;
  let endColumn = 0;
  for (let number = startLine; number <= lastRequested; number += 1) {
    const line = lines[number - 1];
    const offset = number === startLine ? startColumn - 1 : 0;
    const prefix = offset ? `${number}:${offset + 1}: ` : `${number}: `;
    const available = remaining - prefix.length - 1;
    if (available < 1) break;
    let take = Math.min(line.length - offset, available);
    if (take > 0 && /[\uD800-\uDBFF]/.test(line[offset + take - 1]) && /[\uDC00-\uDFFF]/.test(line[offset + take] || '')) take -= 1;
    if (take === 0 && line.length > offset) break;
    const fragment = line.slice(offset, offset + take);
    outputLines.push(`${prefix}${fragment}`);
    remaining -= prefix.length + fragment.length + 1;
    endLine = number;
    endColumn = Math.max(1, offset + take);
    if (offset + take < line.length) {
      nextLine = number;
      nextColumn = offset + take + 1;
      break;
    }
    nextLine = number < totalLines ? number + 1 : null;
    nextColumn = nextLine === null ? null : 1;
  }
  const fileRead = { path: relativePath, revision, startLine, startColumn, endLine, endColumn, totalLines, hasMore: nextLine !== null, nextLine, nextColumn };
  const continuation = fileRead.hasMore
    ? `Next page: ${JSON.stringify({ path: relativePath, startLine: nextLine, startColumn: nextColumn, expectedRevision: revision })}`
    : 'End of file reached.';
  const range = totalLines ? `Returned line ${startLine}, column ${startColumn}, through line ${endLine}, column ${endColumn}, of ${totalLines} lines.` : 'Empty file.';
  return { fileRead, output: `File: ${relativePath}\nRevision: ${revision}\n${range}\n${continuation}\n\n${outputLines.join('\n')}` };
}
