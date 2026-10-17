import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { structuredPatch, formatPatch } from 'diff';
import { createWorkspaceResolver, assertReadableWorkspacePath, WORKSPACE_TEXT_EXTENSIONS } from './workspacePaths.js';

const MAX_FILE_BYTES = 200_000;
const revision = (text) => createHash('sha256').update(text).digest('hex');
export class FileEditError extends Error {
  constructor(message, statusCode = 409) { super(message); this.statusCode = statusCode; }
}

export class FileEditStore {
  constructor(rootDir, storeDir, redact = (text) => text) {
    this.root = fs.realpathSync(rootDir);
    this.storeDir = storeDir;
    this.resolve = createWorkspaceResolver(this.root);
    this.redact = redact;
    fs.mkdirSync(storeDir, { recursive: true, mode: 0o700 });
  }

  target(relativePath) {
    const resolved = this.resolve(relativePath);
    assertReadableWorkspacePath(resolved.relPath);
    assertReadableWorkspacePath(resolved.safeRelPath);
    if (!WORKSPACE_TEXT_EXTENSIONS.has(path.extname(resolved.safeRelPath).toLowerCase())) throw new FileEditError('Only workspace text and source files can be edited.', 400);
    return { path: resolved.safeRelPath.replaceAll(path.sep, '/'), fullPath: path.join(this.root, resolved.safeRelPath) };
  }

  read(relativePath, requireCanonical = false) {
    const target = this.target(relativePath);
    if (requireCanonical && target.path !== relativePath) throw new FileEditError('The file target changed after this proposal was prepared.');
    const descriptor = fs.openSync(target.fullPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new FileEditError('Reviewed edits are limited to existing text files of at most 200 KB.', 400);
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let count = 0;
      while (count < buffer.length) {
        const read = fs.readSync(descriptor, buffer, count, buffer.length - count, null);
        if (!read) break;
        count += read;
      }
      if (count > MAX_FILE_BYTES) throw new FileEditError('The file grew beyond the 200 KB edit limit.', 400);
      const bytes = buffer.subarray(0, count);
      const content = bytes.toString('utf8');
      if (content.includes('\0') || !Buffer.from(content).equals(bytes)) throw new FileEditError('Reviewed edits support valid UTF-8 text files only.', 400);
      return { ...target, content, revision: revision(content), mode: stat.mode & 0o777 };
    } finally { fs.closeSync(descriptor); }
  }

  recordPath(id) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new FileEditError('Edit proposal not found.', 404);
    return path.join(this.storeDir, `${id}.json`);
  }

  save(record) {
    const destination = this.recordPath(record.id);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, destination);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }

  load(id) {
    const location = this.recordPath(id);
    if (!fs.existsSync(location)) throw new FileEditError('This edit proposal is no longer available on this server.', 404);
    const record = JSON.parse(fs.readFileSync(location, 'utf8'));
    if (record.id !== id || typeof record.before !== 'string' || typeof record.after !== 'string' ||
      revision(record.before) !== record.beforeRevision || revision(record.after) !== record.afterRevision) {
      throw new FileEditError('This saved proposal is invalid and cannot be applied.', 400);
    }
    if (record.state === 'applying' || record.state === 'reverting') {
      let current;
      try { current = this.read(record.path, true).revision; } catch { current = null; }
      if (record.state === 'applying') {
        if (current === record.afterRevision) { record.state = 'applied'; record.latestAction = this.action(record, 'apply'); }
        else if (current === record.beforeRevision) record.state = 'proposed';
        else record.state = 'conflict';
      } else if (current === record.beforeRevision) { record.state = 'reverted'; record.latestAction = this.action(record, 'undo'); }
      else record.state = 'applied';
      this.save(record);
    }
    return record;
  }

  action(record, operation, durationMs) {
    return {
      id: `${record.id}-${operation}`, tool: `workspace.${operation}_edit`,
      title: `${operation === 'apply' ? 'Applied edit to' : operation === 'undo' ? 'Undid edit to' : 'Discarded edit for'} ${record.path}`,
      status: 'success', durationMs: durationMs ?? 0, timingKnown: durationMs !== undefined,
      output: operation === 'discard' ? `Discarded proposal ${record.id}. No file was changed.`
        : `${operation === 'apply' ? 'Applied' : 'Undid'} reviewed proposal ${record.id} in ${record.path}. Resulting revision: ${operation === 'apply' ? record.afterRevision : record.beforeRevision}.`,
    };
  }

  response(record) {
    let current;
    try { current = this.read(record.path, true).revision; } catch { current = null; }
    if (record.state === 'proposed' && current !== record.beforeRevision) {
      record.state = 'conflict';
      this.save(record);
    }
    return {
      proposal: { id: record.id, path: record.path, state: record.state, createdAt: record.createdAt,
        beforeRevision: record.beforeRevision, afterRevision: record.afterRevision,
        patch: record.patch, addedLines: record.addedLines, removedLines: record.removedLines,
        previewRedacted: record.previewRedacted,
        canApply: record.state === 'proposed' && current === record.beforeRevision,
        canUndo: record.state === 'applied' && current === record.afterRevision,
        currentMatchesExpected: current === (record.state === 'applied' ? record.afterRevision : record.beforeRevision),
      },
      action: record.latestAction || null,
    };
  }

  get(id) { return this.response(this.load(id)); }

  propose({ path: filePath, oldText, newText, expectedRevision }) {
    if (typeof oldText !== 'string' || typeof newText !== 'string') throw new FileEditError('Supply exact oldText and newText for the replacement.', 400);
    if (Buffer.byteLength(oldText) > 100_000 || Buffer.byteLength(newText) > 100_000) throw new FileEditError('Use a smaller exact replacement (at most 100 KB per text block).', 400);
    const before = this.read(filePath);
    if (expectedRevision !== undefined && expectedRevision !== before.revision) throw new FileEditError('The file changed since it was read. Read its current contents before proposing an edit.');
    const crlf = before.content.includes('\r\n') && !before.content.replaceAll('\r\n', '').includes('\n');
    if (crlf) { oldText = oldText.replace(/\r?\n/g, '\r\n'); newText = newText.replace(/\r?\n/g, '\r\n'); }
    if (!oldText && before.content) throw new FileEditError('oldText must include a unique existing passage. Empty oldText is allowed only for an empty file.', 400);
    const start = before.content.indexOf(oldText);
    if (start < 0) throw new FileEditError('The exact oldText was not found. Read the current file and include its original spacing and surrounding text.');
    if (oldText && before.content.indexOf(oldText, start + 1) !== -1) throw new FileEditError('oldText occurs more than once. Include more surrounding text to identify one replacement.');
    const after = before.content.slice(0, start) + newText + before.content.slice(start + oldText.length);
    if (after === before.content) throw new FileEditError('The replacement does not change the file.', 400);
    if (Buffer.byteLength(after) > MAX_FILE_BYTES) throw new FileEditError('The edited file would exceed the 200 KB limit.', 400);
    const patch = structuredPatch(before.path, before.path, before.content, after, 'current', 'proposed', { context: 3, timeout: 1000 });
    if (!patch) throw new FileEditError('This edit is too large to preview. Propose a smaller replacement.', 400);
    const rawPatch = formatPatch(patch);
    if (rawPatch.length > 60_000) throw new FileEditError('This diff is too large to review here. Propose a smaller replacement.', 400);
    const displayPatch = this.redact(rawPatch);
    const changes = patch.hunks.flatMap((hunk) => hunk.lines);
    const record = { id: randomUUID(), path: before.path, createdAt: new Date().toISOString(), state: 'proposed',
      before: before.content, after, beforeRevision: before.revision, afterRevision: revision(after),
      patch: displayPatch, previewRedacted: displayPatch !== rawPatch,
      addedLines: changes.filter((line) => line.startsWith('+')).length,
      removedLines: changes.filter((line) => line.startsWith('-')).length,
    };
    this.save(record);
    return this.response(record);
  }

  replaceFile(record, content, expectedRevision) {
    const current = this.read(record.path, true);
    if (current.revision !== expectedRevision) throw new FileEditError('The file has newer changes. Nothing was overwritten. Prepare a new proposal from the current file.');
    const temporary = path.join(path.dirname(current.fullPath), `.aspira-edit-${randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, 'wx', current.mode);
      fs.fchmodSync(descriptor, current.mode);
      fs.writeFileSync(descriptor, content, 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor); descriptor = undefined;
      if (this.read(record.path, true).revision !== expectedRevision) throw new FileEditError('The file changed while preparing the write. Nothing was overwritten.');
      fs.renameSync(temporary, current.fullPath);
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  operate(id, operation, approval = {}) {
    const startedAt = Date.now();
    const record = this.load(id);
    if (operation === 'discard') {
      if (!['proposed', 'conflict', 'discarded'].includes(record.state)) throw new FileEditError('An applied edit cannot be discarded. Use Undo if the file is unchanged.');
      record.state = 'discarded'; record.latestAction = this.action(record, 'discard', Date.now() - startedAt); this.save(record);
      return this.response(record);
    }
    if (!['apply', 'undo'].includes(operation)) throw new FileEditError('Unknown edit operation.', 400);
    if ((operation === 'apply' && record.state === 'applied') || (operation === 'undo' && record.state === 'reverted')) return this.response(record);
    if ((operation === 'apply' && record.state !== 'proposed') || (operation === 'undo' && record.state !== 'applied')) throw new FileEditError('This proposal is no longer in a state that supports that operation.');
    const before = operation === 'apply' ? record.beforeRevision : record.afterRevision;
    const after = operation === 'apply' ? record.afterRevision : record.beforeRevision;
    if (approval.expectedRevision !== before || approval.expectedAfterRevision !== after) throw new FileEditError('Refresh and review this proposal before applying its exact change.');
    if (this.read(record.path, true).revision !== before) {
      if (operation === 'apply') { record.state = 'conflict'; this.save(record); }
      throw new FileEditError(operation === 'undo' ? 'Undo was not run because this file has newer changes.' : 'The file changed after this proposal was prepared. No edit was applied.');
    }
    record.state = operation === 'apply' ? 'applying' : 'reverting'; this.save(record);
    this.replaceFile(record, operation === 'apply' ? record.after : record.before, before);
    record.state = operation === 'apply' ? 'applied' : 'reverted';
    record.latestAction = this.action(record, operation, Date.now() - startedAt); this.save(record);
    return this.response(record);
  }
}
