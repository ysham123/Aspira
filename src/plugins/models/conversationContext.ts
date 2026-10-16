import type { ConversationTurn } from './manifest';
import type { ConversationMessageContext } from './synergyEngine';

export function modelConversationContext(turns: ConversationTurn[]): ConversationMessageContext[] {
  return turns.slice(-5).flatMap((turn) => {
    const actions = Array.isArray(turn.result.executedActions) ? turn.result.executedActions : [];
    const receipts = actions.slice(0, 3).map((action) => {
      const output = String(action.output || '');
      return `- ${action.title} [${action.status}]:${action.fileRead ? `\n[File page metadata] ${JSON.stringify(action.fileRead)}\n` : ' '}${output.slice(0, 2000)}${output.length > 2000 ? '\n[Output excerpt shortened for conversation context; the full received output remains in its action receipt.]' : ''}`;
    });
    return [
      { role: 'user' as const, text: turn.userText },
      {
        role: 'assistant' as const,
        speaker: turn.result.modelStreams?.[0]?.codeName || 'Aspira',
        text: `${turn.result.synthesizedOutput}${receipts.length ? `\n\n[Recorded action receipts for this turn]\n${receipts.join('\n')}` : ''}`,
      },
    ];
  });
}
