import React, { useEffect, useRef, useState } from 'react';
import { Check, FileDiff, RefreshCw, RotateCcw, X } from 'lucide-react';
import type { AgentActionExecution, FileEditProposal } from '../plugins/models/manifest';
import { normalizeFileEditProposal } from '../plugins/models/fileEditProposals';
import type { FileEditApproval, FileEditOperation, FileEditOperationResult } from '../plugins/models/fileEditProposals';
import './FileEditProposalCard.css';

interface Props {
  proposal: FileEditProposal;
  disabled: boolean;
  onUpdate: (proposal: FileEditProposal, action?: AgentActionExecution | null) => void;
  onOperate: (id: string, operation: FileEditOperation, approval: FileEditApproval) => Promise<FileEditOperationResult>;
}

export function FileEditProposalCard({ proposal, disabled, onUpdate, onOperate }: Props) {
  const [current, setCurrent] = useState(proposal);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<FileEditOperation | null>(null);
  const [error, setError] = useState('');
  const updateRef = useRef(onUpdate); updateRef.current = onUpdate;
  useEffect(() => setCurrent(proposal), [proposal]);

  const receive = (data: FileEditOperationResult) => {
    const next = normalizeFileEditProposal(data.proposal);
    if (!next || next.id !== proposal.id) throw new Error('Aspira could not verify this edit proposal.');
    setCurrent(next); setVerified(true); updateRef.current(next, data.action);
  };

  useEffect(() => {
    const controller = new AbortController();
    setChecking(true); setVerified(false);
    fetch(`/api/file-edits/${proposal.id}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load this proposal.'); return data; })
      .then((data) => { if (!controller.signal.aborted) receive(data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || 'Could not load this proposal.'); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [proposal.id]);

  const refresh = async () => {
    setChecking(true);
    try {
      const response = await fetch(`/api/file-edits/${proposal.id}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check this proposal.'); receive(data); return data as FileEditOperationResult;
    } catch (failure) { setVerified(false); throw failure; }
    finally { setChecking(false); }
  };

  const operate = async (operation: FileEditOperation) => {
    setBusy(operation); setError('');
    try {
      receive(await onOperate(current.id, operation, {
        expectedRevision: operation === 'undo' ? current.afterRevision : current.beforeRevision,
        expectedAfterRevision: operation === 'undo' ? current.beforeRevision : current.afterRevision,
      }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The edit operation could not finish.');
      const refreshed = await refresh().catch(() => undefined);
      if (refreshed && ((operation === 'apply' && refreshed.proposal.state === 'applied') || (operation === 'undo' && refreshed.proposal.state === 'reverted') || (operation === 'discard' && refreshed.proposal.state === 'discarded'))) setError('');
    } finally { setBusy(null); }
  };

  const stateLabel = { proposed: 'Ready to review', applied: 'Applied', discarded: 'Discarded', conflict: 'File changed', reverted: 'Undone' }[current.state];
  const locked = disabled || checking || Boolean(busy) || !verified;
  return (
    <section className={`aspira-edit-card is-${current.state}`} aria-label={`Edit proposal for ${current.path}`}>
      <div className="aspira-edit-heading">
        <FileDiff aria-hidden="true" />
        <div className="aspira-edit-name"><span>File change</span><strong>{current.path}</strong></div>
        <span className="aspira-edit-state">{checking ? 'Checking file…' : stateLabel}</span>
      </div>
      <div className="aspira-edit-summary"><span>+{current.addedLines} added</span><span>−{current.removedLines} removed</span></div>
      <details className="aspira-edit-diff" open={current.state === 'proposed' || current.state === 'conflict'}>
        <summary>Review diff</summary>
        <pre aria-label={`Diff for ${current.path}`}><code>{current.patch.split('\n').map((line, index) => (
          <span key={index} className={line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') ? 'is-header' : line.startsWith('+') ? 'is-added' : line.startsWith('-') ? 'is-removed' : ''}>{line || ' '}{'\n'}</span>
        ))}</code></pre>
      </details>
      {current.previewRedacted && <p className="aspira-edit-note">Credential-like text is redacted in this preview.</p>}
      {current.state === 'proposed' && <p className="aspira-edit-note">The file is unchanged. Apply writes exactly this reviewed replacement.</p>}
      {current.state === 'conflict' && <p className="aspira-edit-note">The file changed after this proposal. Ask for a new proposal from its current contents.</p>}
      {current.state === 'applied' && !current.canUndo && <p className="aspira-edit-note">The file has newer changes. Undo is unavailable.</p>}
      {error && <p className="aspira-edit-error" role="alert">{error}</p>}
      <div className="aspira-edit-controls">
        <button type="button" className="aspira-edit-refresh" disabled={checking || Boolean(busy)} aria-label={`Check edit status for ${current.path}`}
          onClick={() => { setError(''); void refresh().catch((failure) => setError(failure.message)); }}><RefreshCw aria-hidden="true" /> Check status</button>
        {['proposed','conflict'].includes(current.state) && <button type="button" disabled={locked} onClick={() => void operate('discard')}><X aria-hidden="true" />{busy === 'discard' ? 'Discarding…' : 'Discard'}</button>}
        {current.state === 'proposed' && <button type="button" className="aspira-edit-apply" disabled={locked || !current.canApply} onClick={() => void operate('apply')}><Check aria-hidden="true" />{busy === 'apply' ? 'Applying…' : 'Apply change'}</button>}
        {current.state === 'applied' && <button type="button" disabled={locked || !current.canUndo} onClick={() => void operate('undo')}><RotateCcw aria-hidden="true" />{busy === 'undo' ? 'Undoing…' : 'Undo this edit'}</button>}
      </div>
    </section>
  );
}
