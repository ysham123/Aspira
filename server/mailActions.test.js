import test from 'node:test';
import assert from 'node:assert/strict';
import { mailDraftAppleScriptRequest } from './mailActions.js';
import { toolAuthorizationError } from './toolAuthorization.js';

test('Mail drafts accept a recipient or leave the recipient blank', () => {
  const addressed = mailDraftAppleScriptRequest({
    to: 'friend@example.com', subject: 'Weekend plans', body: 'Would Saturday work?',
  });
  assert.deepEqual(addressed.args, ['friend@example.com', 'Weekend plans', 'Would Saturday work?']);
  assert.match(addressed.script, /make new outgoing message/);
  assert.match(addressed.script, /make new to recipient/);
  assert.equal(/\bsend\b/i.test(addressed.script), false);
  assert.equal(addressed.script.includes('friend@example.com'), false);

  const blankRecipient = mailDraftAppleScriptRequest({ subject: 'Weekend plans', body: 'Draft text.' });
  assert.deepEqual(blankRecipient.args, ['', 'Weekend plans', 'Draft text.']);
});

test('Mail draft arguments are validated before launching Apple Mail', () => {
  assert.throws(() => mailDraftAppleScriptRequest({ to: 'Sam', subject: 'Hi', body: 'Hello.' }), /valid email address/);
  assert.throws(() => mailDraftAppleScriptRequest({ subject: '', body: 'Hello.' }), /subject is required/);
  assert.throws(() => mailDraftAppleScriptRequest({ subject: 'Hi', body: '' }), /body text is required/);
});

test('Mail draft tool requires an explicit request and blocks informational questions', () => {
  assert.equal(toolAuthorizationError('mail.draft', 'Draft an email to Sam about the trip.'), null);
  assert.equal(toolAuthorizationError('mail.draft', 'Write me an email about the trip.'), null);
  assert.match(toolAuthorizationError('mail.draft', 'How do I draft an email?'), /explicit request/);
});
