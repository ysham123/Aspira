import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { FileEditStore } from './fileEdits.js';
import { toolAuthorizationError } from './toolAuthorization.js';
import { loadTypeScript } from './typeScriptTestUtils.js';

const { updateFileEditResult, normalizeFileEditProposal } = await loadTypeScript('../src/plugins/models/fileEditProposals.ts');
const { normalizeConversationTurn } = await loadTypeScript('../src/plugins/models/conversationHistory.ts');
const { modelConversationContext } = await loadTypeScript('../src/plugins/models/conversationContext.ts');

const hash = (text) => createHash('sha256').update(text).digest('hex');
function fixture(run, redact) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'aspira-edit-test-'));
  const root = path.join(temporary, 'workspace'); fs.mkdirSync(root);
  const storeDir = path.join(root, 'server', 'data', 'edit-proposals');
  const location = path.join(root, 'note.md');
  const original = '# Notes\nOriginal passage.\nEnd.\n'; fs.writeFileSync(location, original);
  const store = new FileEditStore(root, storeDir, redact);
  try { run({ temporary, root, storeDir, location, original, store }); }
  finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
const approval = (proposal, undo = false) => ({ expectedRevision: undo ? proposal.afterRevision : proposal.beforeRevision, expectedAfterRevision: undo ? proposal.beforeRevision : proposal.afterRevision });
const propose = (store) => store.propose({ path: 'note.md', oldText: 'Original passage.', newText: 'Updated passage.' }).proposal;

test('preparing an edit persists a private exact diff without writing the workspace file', () => fixture(({store,location,original,storeDir}) => {
  const proposal = propose(store);
  assert.equal(fs.readFileSync(location,'utf8'),original);
  assert.equal(proposal.state,'proposed'); assert.equal(proposal.canApply,true);
  assert.match(proposal.patch, /-Original passage\./); assert.match(proposal.patch, /\+Updated passage\./);
  assert.deepEqual([proposal.addedLines,proposal.removedLines],[1,1]);
  assert.equal(Object.hasOwn(proposal,'before'),false); assert.equal(Object.hasOwn(proposal,'after'),false);
  assert.equal(fs.statSync(path.join(storeDir,`${proposal.id}.json`)).mode & 0o777,0o600);
}));

test('reviewed Apply and Undo survive server restart and are idempotent', () => fixture(({store,root,storeDir,location,original}) => {
  const proposal = propose(store);
  const applied = store.operate(proposal.id,'apply',approval(proposal));
  assert.equal(applied.proposal.state,'applied'); assert.equal(applied.proposal.canUndo,true);
  assert.equal(applied.action.tool,'workspace.apply_edit');
  assert.equal(fs.readFileSync(location,'utf8'),original.replace('Original','Updated'));
  const restarted = new FileEditStore(root,storeDir);
  assert.equal(restarted.operate(proposal.id,'apply',approval(proposal)).action.id,applied.action.id);
  const undone = restarted.operate(proposal.id,'undo',approval(proposal,true));
  assert.equal(undone.proposal.state,'reverted'); assert.equal(fs.readFileSync(location,'utf8'),original);
  assert.equal(restarted.operate(proposal.id,'undo',approval(proposal,true)).action.id,undone.action.id);
}));

test('Apply refuses changed files and Discard never writes them', () => fixture(({store,location}) => {
  const proposal = propose(store); fs.writeFileSync(location,'Newer work\n');
  assert.throws(()=>store.operate(proposal.id,'apply',approval(proposal)),/file changed/);
  assert.equal(fs.readFileSync(location,'utf8'),'Newer work\n');
  assert.equal(store.get(proposal.id).proposal.state,'conflict');
  const discarded = store.operate(proposal.id,'discard');
  assert.equal(discarded.proposal.state,'discarded'); assert.equal(fs.readFileSync(location,'utf8'),'Newer work\n');
}));

test('Undo cannot overwrite edits made after Apply', () => fixture(({store,location}) => {
  const proposal=propose(store); store.operate(proposal.id,'apply',approval(proposal));
  fs.writeFileSync(location,'New work after applying\n');
  assert.throws(()=>store.operate(proposal.id,'undo',approval(proposal,true)),/newer changes/);
  assert.equal(fs.readFileSync(location,'utf8'),'New work after applying\n');
  assert.equal(store.get(proposal.id).proposal.canUndo,false);
}));

test('an exact preview version is required and ambiguous, missing, or unchanged replacements are rejected', () => fixture(({store,location,original}) => {
  const proposal=propose(store);
  assert.throws(()=>store.operate(proposal.id,'apply',{expectedRevision:'wrong',expectedAfterRevision:proposal.afterRevision}),/Refresh and review/);
  assert.equal(fs.readFileSync(location,'utf8'),original);
  assert.throws(()=>store.propose({path:'note.md',oldText:'absent',newText:'new'}),/not found/);
  assert.throws(()=>store.propose({path:'note.md',oldText:'Original',newText:'Original'}),/does not change/);
  assert.throws(()=>store.propose({path:'note.md',oldText:'',newText:'new'}),/unique existing passage/);
  fs.writeFileSync(location,'repeat repeat');
  assert.throws(()=>store.propose({path:'note.md',oldText:'repeat',newText:'new'}),/more than once/);
  assert.throws(()=>store.propose({path:'note.md',oldText:'repeat',newText:'new',expectedRevision:hash(original)}),/changed since it was read/);
}));

test('CRLFs and file permissions are preserved, and an empty file can receive its first content', () => fixture(({store,location}) => {
  fs.writeFileSync(location,'one\r\ntwo\r\n'); fs.chmodSync(location,0o664);
  const proposal=store.propose({path:'note.md',oldText:'one\ntwo',newText:'one\nupdated'}).proposal;
  store.operate(proposal.id,'apply',approval(proposal));
  assert.equal(fs.readFileSync(location,'utf8'),'one\r\nupdated\r\n');
  assert.equal(fs.statSync(location).mode & 0o777,0o664);
  fs.writeFileSync(location,'');
  const empty=store.propose({path:'note.md',oldText:'',newText:'# First note\n'}).proposal;
  store.operate(empty.id,'apply',approval(empty)); assert.equal(fs.readFileSync(location,'utf8'),'# First note\n');
}));

test('traversal, hidden paths, private data, outside symlinks, binary data, and oversized files are excluded', () => fixture(({store,root,temporary,location}) => {
  const outside=path.join(temporary,'outside.md'); fs.writeFileSync(outside,'Outside text');
  fs.writeFileSync(path.join(root,'.env'),'secret'); fs.writeFileSync(path.join(root,'server','data','private.json'),'private');
  fs.symlinkSync(outside,path.join(root,'outside-link.md'));
  for (const target of ['../outside.md','.env','server/data/private.json','outside-link.md']) {
    assert.throws(()=>store.propose({path:target,oldText:'text',newText:'changed'}));
  }
  fs.writeFileSync(location,'binary\0text'); assert.throws(()=>propose(store),/UTF-8 text/);
  fs.writeFileSync(location,'x'.repeat(200_001)); assert.throws(()=>propose(store),/200 KB/);
  assert.equal(fs.readFileSync(outside,'utf8'),'Outside text');
}));

test('an internal alias is canonicalized and retargeting a reviewed path cannot edit another file', () => fixture(({store,root,location,temporary,original}) => {
  fs.symlinkSync(location,path.join(root,'alias.md'));
  const proposal=store.propose({path:'alias.md',oldText:'Original',newText:'Updated'}).proposal;
  assert.equal(proposal.path,'note.md');
  const outside=path.join(temporary,'outside.md'); fs.writeFileSync(outside,original);
  fs.unlinkSync(location); fs.symlinkSync(outside,location);
  assert.throws(()=>store.operate(proposal.id,'apply',approval(proposal)));
  assert.equal(fs.readFileSync(outside,'utf8'),original);
}));

test('a failed final record write is reconciled from the file after restart without reapplying', () => fixture(({store,root,storeDir,location,original}) => {
  const proposal=propose(store);
  const save=store.save.bind(store); let writes=0;
  store.save=(record)=>{writes+=1;if(writes===2)throw new Error('Simulated record-write failure');save(record);};
  assert.throws(()=>store.operate(proposal.id,'apply',approval(proposal)),/Simulated/);
  assert.equal(fs.readFileSync(location,'utf8'),original.replace('Original','Updated'));
  const restarted=new FileEditStore(root,storeDir); const recovered=restarted.get(proposal.id);
  assert.equal(recovered.proposal.state,'applied'); assert.equal(recovered.action.timingKnown,false);
  assert.equal(fs.readFileSync(location,'utf8'),original.replace('Original','Updated'));
}));

test('diff preview redaction does not change the exact replacement written on Apply', () => fixture(({store,location}) => {
  fs.writeFileSync(location,'secret-value\nOriginal passage.\n');
  const proposal=propose(store);
  assert.equal(proposal.previewRedacted,true); assert.doesNotMatch(proposal.patch,/secret-value/);
  store.operate(proposal.id,'apply',approval(proposal));
  assert.equal(fs.readFileSync(location,'utf8'),'secret-value\nUpdated passage.\n');
},(text)=>text.replaceAll('secret-value','[redacted]')));

test('read-only requests and file continuation cannot authorize preparing edits', () => {
  assert.equal(toolAuthorizationError('workspace.propose_edit','Update README.md'),null);
  assert.match(toolAuthorizationError('workspace.propose_edit','Explain README.md'),/requires a request to change/);
  assert.ok(toolAuthorizationError('workspace.propose_edit','Read the rest',{path:'README.md',mode:'next'}));
});

test('applied-edit receipts and current proposal state survive chat persistence without duplicate actions', () => fixture(({store}) => {
  const proposal = propose(store);
  const prepared = {id:'prepared-1',tool:'workspace.propose_edit',title:'Prepared edit',status:'success',output:'Prepared only; not applied.',durationMs:1,editProposal:proposal};
  const result = {executedActions:[prepared],synthesizedOutput:'Review the proposed edit.',modelStreams:[]};
  const applied = store.operate(proposal.id,'apply',approval(proposal));
  const updated = updateFileEditResult(result,applied.proposal,applied.action);
  assert.equal(updated.executedActions.length,2); assert.equal(updated.executedActions[0].editProposal.state,'applied');
  assert.equal(updateFileEditResult(updated,applied.proposal,applied.action),updated);
  const restored=normalizeConversationTurn(JSON.parse(JSON.stringify({id:'turn-1',userText:'Update note.md',result:updated})));
  assert.equal(restored.result.executedActions[0].editProposal.canUndo,true);
  const context=modelConversationContext([restored])[1].text;
  assert.match(context,/"state":"applied"/); assert.match(context,/Applied reviewed proposal/);
  assert.equal(normalizeFileEditProposal({...proposal,state:'applied',canApply:true}).canApply,false);
}));

test('an interrupted pre-write transaction returns to review and an interrupted undo is reconciled', () => fixture(({store,root,storeDir,location,original}) => {
  const proposal=propose(store);
  const record=store.load(proposal.id); record.state='applying'; store.save(record);
  const restarted=new FileEditStore(root,storeDir);
  assert.equal(restarted.get(proposal.id).proposal.state,'proposed');
  assert.equal(fs.readFileSync(location,'utf8'),original);
  restarted.operate(proposal.id,'apply',approval(proposal));
  const undoing=restarted.load(proposal.id); undoing.state='reverting'; restarted.save(undoing);
  fs.writeFileSync(location,original);
  const restored=new FileEditStore(root,storeDir).get(proposal.id);
  assert.equal(restored.proposal.state,'reverted'); assert.equal(restored.action.tool,'workspace.undo_edit');
}));
