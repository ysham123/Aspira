import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './typeScriptTestUtils.js';
const { deriveAttentionItems } = await loadTypeScript('../src/plugins/models/workspaceAttention.ts');
const turn = (id, overrides = {}) => ({id, userText:'Plan a weekend', result: {executedActions:[],modelStreams:[],synthesizedOutput:'Ready',...overrides}});
const conversation = (turns, id='chat-1') => ({id,title:'Weekend plans',turns});
const action = (id,state) => ({id,status:'success',editProposal:{id:'proposal-1',path:'note.md',state}});

test('ordinary answers and applied/discarded edits do not create attention items', () => {
  const current=conversation([turn('a'),turn('b',{executedActions:[action('p','applied')]}),turn('c',{executedActions:[{...action('q','discarded'),editProposal:{id:'proposal-2',path:'other.md',state:'discarded'}}]})]);
  assert.deepEqual(deriveAttentionItems([],current),[]);
});
test('the current snapshot replaces saved proposal state and duplicate turns do not multiply notices',()=>{
  const saved=conversation([turn('a',{executedActions:[action('p','proposed')]})]);
  const applied=turn('a',{executedActions:[action('p','applied')]});
  assert.deepEqual(deriveAttentionItems([saved],conversation([applied,applied])),[]);
  const pending=turn('a',{executedActions:[action('p','proposed')]});
  const items=deriveAttentionItems([saved],conversation([pending,pending]));
  assert.equal(items.length,1);assert.equal(items[0].kind,'review');assert.equal(items[0].turnId,'a');
});
test('a later conflict for the same proposal takes precedence and links to its conversation',()=>{
  const items=deriveAttentionItems([],conversation([turn('a',{executedActions:[action('p','proposed')]}),turn('b',{executedActions:[action('p','conflict')]})]));
  assert.equal(items.length,1);assert.match(items[0].detail,/changed/);assert.equal(items[0].turnId,'b');assert.equal(items[0].conversationId,'chat-1');
});
test('failed tools and unavailable agents are grouped per turn, with interruptions kept distinct',()=>{
  const current=conversation([turn('a',{completionState:'interrupted',executedActions:[{id:'fail',title:'Search',status:'error'}],modelStreams:[{codeName:'Claude',source:'UNAVAILABLE'}]})]);
  const items=deriveAttentionItems([],current);assert.equal(items.length,2);assert.deepEqual(items.map(x=>x.kind),['interrupted','blocked']);assert.match(items[1].detail,/Search: failed/);assert.match(items[1].detail,/Claude was unavailable/);
});
test('saved attention from another conversation remains reachable while a new conversation is open',()=>{
  const saved=conversation([turn('a',{completionState:'stopped'})]);
  const items=deriveAttentionItems([saved],conversation([],'new'));assert.equal(items.length,1);assert.equal(items[0].conversationId,'chat-1');assert.equal(items[0].kind,'interrupted');
});
