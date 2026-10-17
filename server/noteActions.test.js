import test from 'node:test';
import assert from 'node:assert/strict';
import { extractNoteRequest, noteAppleScriptRequest } from './noteActions.js';
import { toolAuthorizationError } from './toolAuthorization.js';

test('explicitly named note requests extract a title and body', () => {
  assert.deepEqual(extractNoteRequest('Create a note called Shopping with apples and eggs.'), {
    title: 'Shopping', body: 'apples and eggs',
  });
  assert.equal(extractNoteRequest('How do I create a note called Shopping with apples?'), null);
  assert.equal(extractNoteRequest('Remember that I like apples.'), null);
});

test('note text is escaped as HTML and passed as an AppleScript argument', () => {
  const title = 'Recipe "one"';
  const body = 'Line one\n<script>do not run</script> & more';
  const request = noteAppleScriptRequest({ title, body });
  assert.deepEqual(request.args, [title, '<div>Line one<br>&lt;script&gt;do not run&lt;/script&gt; &amp; more</div>']);
  assert.equal(request.script.includes(title), false);
  assert.equal(request.script.includes('<script>'), false);
  assert.match(request.script, /make new note at targetFolder/);
  assert.throws(() => noteAppleScriptRequest({ title: 'Empty', body: '' }), /content is required/);
});

test('model note actions require an explicit create, write, or save request', () => {
  assert.equal(toolAuthorizationError('notes.create', 'Create a note about the trip.'), null);
  assert.match(toolAuthorizationError('notes.create', 'How do I create a note?'), /explicit request/);
  assert.match(toolAuthorizationError('notes.create', 'Summarize what a Notes app can do.'), /explicit request/);
});
