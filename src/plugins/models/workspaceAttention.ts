import type { ConversationTurn } from './manifest';

export interface AttentionConversation {
  id: string;
  title: string;
  turns: ConversationTurn[];
}
export interface AttentionItem {
  id: string;
  conversationId: string;
  turnId: string;
  title: string;
  detail: string;
  kind: 'review' | 'blocked' | 'interrupted';
}

/** Derive attention from recorded outcomes, never speculative background work. */
export function deriveAttentionItems(
  conversations: AttentionConversation[],
  current: AttentionConversation,
): AttentionItem[] {
  const all = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  all.set(current.id, current);
  const items: AttentionItem[] = [];

  for (const conversation of all.values()) {
    const turns = [...new Map(conversation.turns.map((turn) => [turn.id, turn])).values()];
    const proposals = new Map<string, { turn: ConversationTurn; action: ConversationTurn['result']['executedActions'][number] }>();
    for (const turn of turns) {
      for (const action of turn.result.executedActions) {
        if (action.editProposal) proposals.set(action.editProposal.id, { turn, action });
      }
    }
    for (const [proposalId, { turn, action }] of proposals) {
      const proposal = action.editProposal!;
      if (proposal.state !== 'proposed' && proposal.state !== 'conflict') continue;
      items.push({
        id: `${conversation.id}:proposal:${proposalId}`,
        conversationId: conversation.id,
        turnId: turn.id,
        title: proposal.state === 'conflict' ? 'A proposed change needs another look' : 'A change is ready to review',
        detail: proposal.state === 'conflict'
          ? `${proposal.path} changed since this proposal was prepared. Open the conversation to review it.`
          : `${proposal.path} · ${conversation.title}`,
        kind: 'review',
      });
    }
    for (const turn of turns) {
      const result = turn.result;
      if (result.completionState === 'interrupted' || result.completionState === 'stopped') {
        items.push({
          id: `${conversation.id}:turn:${turn.id}:interrupted`,
          conversationId: conversation.id,
          turnId: turn.id,
          title: result.completionState === 'interrupted' ? 'A conversation was interrupted' : 'A response was stopped',
          detail: conversation.title,
          kind: 'interrupted',
        });
      }
      const failedActions = result.executedActions.filter((action) => action.status === 'error' || action.status === 'blocked');
      const unavailable = result.modelStreams.filter((stream) => stream.source === 'UNAVAILABLE');
      if (!failedActions.length && !unavailable.length) continue;
      const details = [
        ...failedActions.map((action) => `${action.title}: ${action.status === 'blocked' ? 'blocked' : 'failed'}`),
        ...unavailable.map((stream) => `${stream.codeName} was unavailable`),
      ];
      items.push({
        id: `${conversation.id}:turn:${turn.id}:blocked`,
        conversationId: conversation.id,
        turnId: turn.id,
        title: failedActions.length ? 'An action could not finish' : 'An agent could not respond',
        detail: `${conversation.title} · ${[...new Set(details)].join(' · ')}`,
        kind: 'blocked',
      });
    }
  }
  return items;
}
