import type { ConversationTurn, WorkspaceFileRead } from './manifest';

export function normalizeWorkspaceFileRead(value: unknown): WorkspaceFileRead | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const read = value as WorkspaceFileRead;
  if (typeof read.path !== 'string' || !read.path || read.path.startsWith('/') || read.path.includes('\\') || read.path.split('/').includes('..') ||
    typeof read.revision !== 'string' || !/^[a-f0-9]{64}$/.test(read.revision) || typeof read.hasMore !== 'boolean') return undefined;
  if (![read.startLine, read.startColumn, read.endLine, read.endColumn, read.totalLines].every(Number.isSafeInteger) ||
    read.startLine < 1 || read.startColumn < 1 || read.endLine < 0 || read.endColumn < 0 || read.totalLines < read.endLine) return undefined;
  if (read.totalLines > 0 && read.endLine < read.startLine) return undefined;
  if (read.hasMore && (!Number.isSafeInteger(read.nextLine) || read.nextLine < 1 || read.nextLine < read.endLine || read.nextLine > read.endLine + 1 || read.nextLine > read.totalLines ||
    !Number.isSafeInteger(read.nextColumn) || read.nextColumn < 1 || (read.nextLine === read.endLine && read.nextColumn <= read.endColumn))) return undefined;
  if (!read.hasMore && (read.nextLine !== null || read.nextColumn !== null)) return undefined;
  return { path: read.path, revision: read.revision, startLine: read.startLine, startColumn: read.startColumn,
    endLine: read.endLine, endColumn: read.endColumn, totalLines: read.totalLines,
    hasMore: read.hasMore, nextLine: read.nextLine, nextColumn: read.nextColumn };
}

export function latestWorkspaceFileRead(turns: ConversationTurn[]): { actionId: string; fileRead: WorkspaceFileRead } | undefined {
  for (const turn of [...turns].reverse()) {
    for (const action of [...(turn.result.executedActions || [])].reverse()) {
      const fileRead = normalizeWorkspaceFileRead(action.fileRead);
      if (action.status === 'success' && fileRead) return { actionId: action.id, fileRead };
    }
  }
  return undefined;
}
