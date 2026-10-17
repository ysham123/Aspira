import type { AgentActionExecution, FileEditProposal, SynergyExecutionResult } from './manifest';

export interface FileEditOperationResult { proposal: FileEditProposal; action: AgentActionExecution | null }
export type FileEditOperation = 'apply' | 'undo' | 'discard';
export interface FileEditApproval { expectedRevision?: string; expectedAfterRevision?: string }

export function normalizeFileEditProposal(value: unknown): FileEditProposal | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const proposal = value as FileEditProposal;
  if (typeof proposal.id !== 'string' || !/^[a-f0-9-]{36}$/.test(proposal.id) || typeof proposal.path !== 'string' ||
    !proposal.path || typeof proposal.patch !== 'string' || proposal.patch.length > 60_000 ||
    !['proposed','applied','discarded','conflict','reverted'].includes(proposal.state) ||
    typeof proposal.beforeRevision !== 'string' || !/^[a-f0-9]{64}$/.test(proposal.beforeRevision) ||
    typeof proposal.afterRevision !== 'string' || !/^[a-f0-9]{64}$/.test(proposal.afterRevision) ||
    !Number.isSafeInteger(proposal.addedLines) || !Number.isSafeInteger(proposal.removedLines)) return undefined;
  return { id: proposal.id, path: proposal.path, state: proposal.state, patch: proposal.patch,
    createdAt: typeof proposal.createdAt === 'string' ? proposal.createdAt : '',
    beforeRevision: proposal.beforeRevision, afterRevision: proposal.afterRevision,
    addedLines: proposal.addedLines, removedLines: proposal.removedLines,
    previewRedacted: proposal.previewRedacted === true,
    canApply: proposal.state === 'proposed' && proposal.canApply === true,
    canUndo: proposal.state === 'applied' && proposal.canUndo === true,
    currentMatchesExpected: proposal.currentMatchesExpected === true,
  };
}

export function updateFileEditResult(result: SynergyExecutionResult, proposal: FileEditProposal, operationAction?: AgentActionExecution | null): SynergyExecutionResult {
  if (!result.executedActions.some((action) => action.editProposal?.id === proposal.id)) return result;
  let changed = false;
  const actions = result.executedActions.map((action) => {
    if (action.editProposal?.id !== proposal.id || JSON.stringify(action.editProposal) === JSON.stringify(proposal)) return action;
    changed = true;
    return { ...action, editProposal: proposal };
  });
  if (operationAction && !actions.some((action) => action.id === operationAction.id)) { actions.push(operationAction); changed = true; }
  return changed ? { ...result, executedActions: actions } : result;
}
