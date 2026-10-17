import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReminderRequest, reminderAppleScriptRequest } from './reminderActions.js';
import { toolAuthorizationError } from './toolAuthorization.js';

test('natural reminder requests create tasks rather than memory notes and parse simple dates', () => {
  assert.deepEqual(extractReminderRequest('Remind me to pick up milk.'), { title: 'pick up milk' });
  assert.deepEqual(extractReminderRequest('Add a task to call the dentist'), { title: 'call the dentist' });
  assert.deepEqual(extractReminderRequest('Create a reminder for the appointment'), { title: 'the appointment' });
  assert.equal(extractReminderRequest('Remember that I prefer concise answers.'), null);
  assert.equal(extractReminderRequest('How do I create a reminder?'), null);
  const now = new Date(2026, 9, 16, 10, 0, 0);
  assert.deepEqual(extractReminderRequest('Remind me to pay rent tomorrow.', now), { title: 'pay rent', dueOn: '2026-10-17' });
  const timed = extractReminderRequest('Remind me to call the dentist tomorrow at 9:30 AM.', now);
  assert.equal(timed.title, 'call the dentist');
  assert.equal(new Date(timed.dueAt).getHours(), 9);
  assert.equal(new Date(timed.dueAt).getMinutes(), 30);
  const tonight = extractReminderRequest('Remind me to take my medicine tonight.', now);
  assert.equal(new Date(tonight.dueAt).getHours(), 21);
  assert.equal(tonight.assumedDueTime, '9:00 PM');
});

test('Reminders scripting keeps user content in argv rather than AppleScript source', () => {
  const title = 'Call "Mom"; tell application "Mail" to send it';
  const request = reminderAppleScriptRequest({ title, notes: 'Keep this private.' });
  assert.deepEqual(request.args, [title, 'Keep this private.', '', '']);
  assert.equal(request.script.includes(title), false);
  assert.match(request.script, /make new reminder at targetList/);
});

test('reminder due times require a timezone and are converted into the Mac local timezone', () => {
  const request = reminderAppleScriptRequest({ title: 'Call the dentist', dueAt: '2026-10-17T09:30:00-04:00' });
  assert.equal(request.args[0], 'Call the dentist');
  assert.equal(request.args[2], 'October 17, 2026 at 9:30:00 AM');
  assert.equal(request.args[3], 'timed');
  assert.throws(() => reminderAppleScriptRequest({ title: 'Call the dentist', dueAt: '2026-10-17T09:30:00' }), /timezone/);
  assert.throws(() => reminderAppleScriptRequest({ title: '' }), /title is required/);
  const allDay = reminderAppleScriptRequest({ title: 'Pay rent', dueOn: '2026-10-17' });
  assert.equal(allDay.args[2], 'October 17, 2026');
  assert.equal(allDay.args[3], 'all-day');
  assert.match(allDay.script, /set allday due date of createdReminder/);
  assert.throws(() => reminderAppleScriptRequest({ title: 'Pay rent', dueOn: '2026-02-30' }), /date is invalid/);
});

test('model reminder actions require explicit user intent', () => {
  assert.equal(toolAuthorizationError('reminders.create', 'Remind me to pick up milk.'), null);
  assert.match(toolAuthorizationError('reminders.create', 'How do I create a reminder?'), /explicit request/);
});
