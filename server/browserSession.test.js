import test from 'node:test';
import assert from 'node:assert/strict';
import { isHighImpactBrowserAction, isPublicAddress, safeDisplayUrl, validatePublicBrowserSocket, validatePublicBrowserUrl } from './browserSession.js';
import { toolAuthorizationError } from './toolAuthorization.js';

test('browser address checks reject private, local, reserved and documentation networks', () => {
  for (const address of ['127.0.0.1', '10.4.3.2', '172.20.0.1', '192.168.1.1', '169.254.2.2', '192.0.2.1', '224.0.0.1', '::1', 'fe80::1', 'fd00::1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, `${address} must be blocked`);
  }
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) {
    assert.equal(isPublicAddress(address), true, `${address} must be accepted`);
  }
});

test('browser URLs allow public HTTP(S) only and reject credentials or private DNS answers', async () => {
  await assert.rejects(validatePublicBrowserUrl('http://127.0.0.1:5173'), /local or private/);
  await assert.rejects(validatePublicBrowserUrl('http://[::1]'), /local or private/);
  await assert.rejects(validatePublicBrowserUrl('http://localhost'), /local or private/);
  await assert.rejects(validatePublicBrowserUrl('file:///etc/passwd'), /valid public HTTP/);
  await assert.rejects(validatePublicBrowserUrl('https://user:pass@example.com'), /embedded credentials/);
  await assert.rejects(validatePublicBrowserUrl('https://example.test', async () => ['8.8.8.8', '192.168.1.5']), /local or private/);
  const url = await validatePublicBrowserUrl('example.test/docs', async () => ['8.8.8.8']);
  assert.equal(url.href, 'https://example.test/docs');
});

test('display URLs remove query strings and fragments', () => {
  assert.equal(safeDisplayUrl('https://example.com/path?q=private#section'), 'https://example.com/path');
  assert.equal(safeDisplayUrl('not a url'), '');
});

test('WebSocket connections are limited to public ws and wss hosts', async () => {
  await assert.rejects(validatePublicBrowserSocket('ws://127.0.0.1:9222/devtools'), /local or private/);
  await assert.rejects(validatePublicBrowserSocket('file:///tmp/socket'), /public WebSocket/);
  await validatePublicBrowserSocket('wss://example.test/socket', async () => ['1.1.1.1']);
});

test('high-impact browser buttons are blocked independently of model intent', () => {
  for (const name of ['Send', 'Publish post', 'Delete account', 'Add to cart', 'Accept invitation', 'Submit']) {
    assert.equal(isHighImpactBrowserAction(name), true, `${name} must be blocked`);
  }
  assert.equal(isHighImpactBrowserAction('Pricing'), false);
});

test('browser tool calls require explicit page intent and disallow question-shaped action requests', () => {
  assert.equal(toolAuthorizationError('browser.open_url', 'Open example.com'), null);
  assert.match(toolAuthorizationError('browser.open_url', 'How do I open example.com?'), /explicit request/);
  assert.equal(toolAuthorizationError('browser.read_page', 'Summarize the article in the page'), null);
  assert.equal(toolAuthorizationError('browser.read_page', "What's on the page?"), null);
  assert.match(toolAuthorizationError('browser.read_page', 'What is browser automation?'), /explicit request/);
  assert.equal(toolAuthorizationError('browser.click', 'Click the Pricing link on this page'), null);
  assert.match(toolAuthorizationError('browser.click', 'How do I click the Pricing link on this page?'), /explicit request/);
  assert.equal(toolAuthorizationError('browser.fill', 'Type shoes in the search field on this page'), null);
  assert.match(toolAuthorizationError('browser.fill', 'How do I fill a search box?'), /explicit request/);
  assert.match(toolAuthorizationError('browser.fill', 'What can I enter in the search field?'), /explicit request/);
  assert.equal(toolAuthorizationError('browser.close', 'Close Aspira Browser'), null);
  assert.match(toolAuthorizationError('browser.close', 'How do I close the browser?'), /explicit request/);
});
