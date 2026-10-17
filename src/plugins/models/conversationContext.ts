import type { ConversationTurn } from './manifest';
import type { ConversationMessageContext } from './synergyEngine';

export function modelConversationContext(turns: ConversationTurn[]): ConversationMessageContext[] {
  return turns.slice(-5).flatMap((turn) => {
    const actions = Array.isArray(turn.result.executedActions) ? turn.result.executedActions : [];
    const receipts = actions.slice(-6).map((action) => {
      const output = String(action.output || '');
      const proposal = action.editProposal;
      const editContext = proposal ? `\n[Edit proposal state] ${JSON.stringify({ id: proposal.id, path: proposal.path, state: proposal.state, currentMatchesExpected: proposal.currentMatchesExpected, beforeRevision: proposal.beforeRevision, afterRevision: proposal.afterRevision })}\n[This state is refreshed after the original assistant reply. Apply or Undo receipts may have arrived later. The original reply describes the state when it was written; a later operation is not a contradiction.]\n` : '';
      return `- ${action.title} [${action.status}]:${editContext}${action.fileRead ? `\n[File page metadata] ${JSON.stringify(action.fileRead)}\n` : ' '}${output.slice(0, 2000)}${output.length > 2000 ? '\n[Output excerpt shortened for conversation context; the full received output remains in its action receipt.]' : ''}`;
    });
    return [
      { role: 'user' as const, text: turn.userText },
      {
        role: 'assistant' as const,
        speaker: turn.result.synthesisProviderId
          ? turn.result.modelStreams?.find((stream) => stream.modelId === turn.result.synthesisProviderId)?.codeName || 'Aspira'
          : turn.result.modelStreams?.[0]?.codeName || 'Aspira',
        text: `${turn.result.synthesizedOutput}${receipts.length ? `\n\n[Recorded action receipts for this turn]\n${receipts.join('\n')}` : ''}`,
      },
    ];
  });
}
