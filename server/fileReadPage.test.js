import test from 'node:test';
import assert from 'node:assert/strict';
import { createFileReadPage } from './fileReadPage.js';
import { contextualReadArguments, readContinuationForPrompt } from './workspaceReadContext.js';
import { toolAuthorizationError } from './toolAuthorization.js';
import { loadTypeScript } from './typeScriptTestUtils.js';

const { normalizeWorkspaceFileRead, latestWorkspaceFileRead } = await loadTypeScript('../src/plugins/models/fileReadContext.ts');
const { modelConversationContext } = await loadTypeScript('../src/plugins/models/conversationContext.ts');
const source = Array.from({ length: 205 }, (_, index) => `source line ${index + 1}`).join('\n');
const pageText = (page) => page.output.slice(page.output.indexOf('\n\n') + 2).split('\n').map((line) => line.replace(/^\d+(?::\d+)?: /, '')).join('\n');

test('line pages cover the entire file in order without gaps or duplicate lines', () => {
  let page = createFileReadPage(source, 'README.md');
  const pages = [page];
  while (page.fileRead.hasMore) {
    const next = contextualReadArguments({}, readContinuationForPrompt('Read the rest', page.fileRead));
    page = createFileReadPage(source, 'README.md', next.arguments);
    pages.push(page);
  }
  assert.deepEqual(pages.map((item) => [item.fileRead.startLine, item.fileRead.endLine]), [[1,80],[81,160],[161,205]]);
  assert.equal(pages.map(pageText).join('\n'), source);
  assert.match(pages.at(-1).output, /End of file reached/);
  pages.forEach((item) => assert.deepEqual(normalizeWorkspaceFileRead(item.fileRead), item.fileRead));
});

test('explicit ranges, CRLFs, blank lines and empty files report accurate positions', () => {
  const range = createFileReadPage(source, 'README.md', { startLine: 30, endLine: 40 });
  assert.equal(range.fileRead.nextLine, 41);
  assert.equal(pageText(range), source.split('\n').slice(29, 40).join('\n'));
  const crlf = createFileReadPage('first\r\n\r\nlast\r\n', 'README.md');
  assert.equal(crlf.fileRead.totalLines, 3);
  assert.equal(pageText(crlf), 'first\n\nlast');
  const empty = createFileReadPage('', 'README.md');
  assert.equal(empty.fileRead.totalLines, 0);
  assert.equal(empty.fileRead.hasMore, false);
  assert.deepEqual(normalizeWorkspaceFileRead(empty.fileRead), empty.fileRead);
});

test('long single lines resume at an exact column without losing Unicode text', () => {
  const text = 'hello 😀'.repeat(2300);
  const fragments = [];
  let options = {};
  for (let count = 0; count < 10; count += 1) {
    const page = createFileReadPage(text, 'long.txt', options);
    const fragment = pageText(page);
    assert.doesNotMatch(fragment, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    assert.equal(page.fileRead.endLine, 1);
    assert.ok(page.output.length < 7000);
    fragments.push(fragment);
    if (!page.fileRead.hasMore) break;
    assert.ok(page.fileRead.nextColumn > page.fileRead.startColumn);
    options = contextualReadArguments({}, readContinuationForPrompt('Keep reading', page.fileRead)).arguments;
  }
  assert.equal(fragments.join(''), text);
});

test('changed files are refused before returning content from a different revision', () => {
  const page = createFileReadPage(source, 'README.md');
  const next = contextualReadArguments({}, readContinuationForPrompt('Read the rest', page.fileRead)).arguments;
  let redacted = false;
  assert.throws(() => createFileReadPage(`changed\n${source}`, 'README.md', next, () => { redacted = true; return ''; }), /file changed/);
  assert.equal(redacted, false);
  const restart = contextualReadArguments({}, readContinuationForPrompt('Read it again', page.fileRead)).arguments;
  const fresh = createFileReadPage(`changed\n${source}`, 'README.md', restart);
  assert.equal(fresh.fileRead.startLine, 1);
  assert.notEqual(fresh.fileRead.revision, page.fileRead.revision);
});

test('invalid ranges and oversized content cannot expand the bounded read', () => {
  for (const options of [{startLine:0},{startLine:1.5},{startLine:300},{startColumn:500},{startLine:20,endLine:10}]) {
    assert.throws(() => createFileReadPage(source, 'README.md', options));
  }
  assert.throws(() => createFileReadPage('x'.repeat(1_000_001), 'large.txt'), /too large/);
  const bounded = createFileReadPage(source, 'README.md', { maxLines: 1000 });
  assert.ok(bounded.fileRead.endLine <= 200);
});

test('continuation stays on the prior file and cannot grant unrelated tool access', () => {
  const context = createFileReadPage(source, 'docs/guide.md').fileRead;
  const continuation = readContinuationForPrompt('Read the rest', context);
  const args = contextualReadArguments({ path: './docs/guide.md', startLine: 1, maxLines: 20 }, continuation).arguments;
  assert.equal(args.startLine, context.nextLine);
  assert.equal(args.expectedRevision, context.revision);
  assert.equal(args.maxLines, 20);
  assert.match(contextualReadArguments({ path: 'package.json' }, continuation).error, /different file/);
  assert.equal(toolAuthorizationError('workspace.read_file', 'Read the rest', continuation), null);
  for (const tool of ['workspace.create_file','workspace.list_files','workspace.git_status','app.open','browser.open_url','memory.save','web.search']) {
    assert.ok(toolAuthorizationError(tool, 'Read the rest', continuation));
  }
  for (const prompt of ["Don't keep reading", 'Explain more about this idea', 'Open it', 'Save it', 'Read the rest of package.json']) {
    assert.equal(readContinuationForPrompt(prompt, context), null);
  }
  assert.equal(readContinuationForPrompt('Read the rest', {...context,path:'../secret.md'}),null);
  assert.equal(readContinuationForPrompt('Read the rest', null), null);
});

test('a contextual line-range request uses the user range and end-of-file continuation stays stopped', () => {
  const context = createFileReadPage(source, 'README.md').fileRead;
  const range = contextualReadArguments({}, readContinuationForPrompt('Show lines 90–95', context)).arguments;
  assert.deepEqual([range.startLine, range.endLine, range.expectedRevision], [90,95,context.revision]);
  const end = createFileReadPage('short', 'README.md').fileRead;
  assert.match(contextualReadArguments({}, readContinuationForPrompt('Read the rest',end)).error, /already reached the end/);
});

test('file metadata survives shortened conversation excerpts and latest-file selection', () => {
  const fileRead = createFileReadPage(source, 'README.md').fileRead;
  const action = {id:'read-1',tool:'workspace.read_file',title:'Read README.md',status:'success',output:'x'.repeat(6000),durationMs:2,fileRead};
  const turns = [{id:'turn-1',userText:'Read README.md',result:{synthesizedOutput:'Read a page.',executedActions:[action],modelStreams:[]}}];
  const messages = modelConversationContext(turns);
  assert.match(messages[1].text, /"nextLine":81/);
  assert.match(messages[1].text, /Output excerpt shortened/);
  assert.deepEqual(latestWorkspaceFileRead(turns), {actionId:'read-1',fileRead});
  assert.equal(normalizeWorkspaceFileRead({...fileRead,nextLine:'81'}),undefined);
  assert.equal(normalizeWorkspaceFileRead({...fileRead,nextLine:80,nextColumn:1}),undefined);
});
