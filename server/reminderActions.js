const CREATE_REMINDER_SCRIPT = `on run argv
  set reminderTitle to item 1 of argv
  set reminderNotes to item 2 of argv
  tell application "Reminders"
    set targetList to default list
    set reminderProperties to {name:reminderTitle}
    if reminderNotes is not "" then set reminderProperties to reminderProperties & {body:reminderNotes}
    if (count of argv) > 3 and item 4 of argv is "all-day" then
      set reminderDueDate to date (item 3 of argv)
      set createdReminder to make new reminder at targetList with properties reminderProperties
      set allday due date of createdReminder to reminderDueDate
    else if (count of argv) > 3 and item 4 of argv is "timed" then
      set reminderDueDate to date (item 3 of argv)
      set reminderProperties to reminderProperties & {due date:reminderDueDate}
      set createdReminder to make new reminder at targetList with properties reminderProperties
    else
      set createdReminder to make new reminder at targetList with properties reminderProperties
    end if
    return name of createdReminder
  end tell
end run`;

const formatAppleScriptDate = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('The reminder due date is invalid. Use an ISO-8601 timestamp with a timezone.');
  return date.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
};

export function extractReminderRequest(prompt, now = new Date()) {
  const request = String(prompt || '').trim();
  if (/^(?:how (?:do|can|would) i|what (?:is|does|should)|why (?:should|would|does)|should i|explain how)\b/i.test(request)) return null;
  const match = request.match(/\b(?:remind me to|remind me about|remember to|add (?:a )?(?:reminder|task|to-?do) (?:to|for)|create (?:a )?(?:reminder|task) (?:to|for))\s+([\s\S]+)/i);
  if (!match) return null;
  let title = match[1].trim().replace(/[.!?]+$/, '');
  const timed = title.match(/\s+(today|tomorrow|tonight)\s+at\s+(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\s*$/i);
  const allDay = title.match(/\s+(today|tomorrow)\s*$/i);
  const tonight = title.match(/\s+tonight\s*$/i);
  if (timed || allDay || tonight) {
    const suffix = timed || allDay || tonight;
    title = title.slice(0, suffix.index).trim().replace(/[.!?]+$/, '');
    if (!title) return null;
    const date = new Date(now);
    const dayLabel = timed?.[1] || allDay?.[1] || 'tonight';
    date.setDate(date.getDate() + (dayLabel.toLowerCase() === 'tomorrow' ? 1 : 0));
    if (timed) {
      let hour = Number(timed[2]) % 12;
      if (timed[4].toLowerCase().startsWith('p')) hour += 12;
      date.setHours(hour, Number(timed[3] || 0), 0, 0);
      return { title, dueAt: date.toISOString() };
    }
    if (tonight) {
      date.setHours(21, 0, 0, 0);
      return { title, dueAt: date.toISOString(), assumedDueTime: '9:00 PM' };
    }
    const dueOn = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { title, dueOn };
  }
  return title ? { title } : null;
}

export function reminderAppleScriptRequest({ title, notes = '', dueAt = '', dueOn = '' }) {
  const cleanTitle = String(title || '').trim();
  const cleanNotes = String(notes || '').trim();
  if (!cleanTitle) throw new Error('A reminder title is required.');
  if (cleanTitle.length > 300) throw new Error('Reminder titles are limited to 300 characters.');
  if (cleanNotes.length > 2000) throw new Error('Reminder notes are limited to 2,000 characters.');
  if (dueAt && dueOn) throw new Error('Choose either a timed reminder or an all-day due date.');
  if (dueAt && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(String(dueAt))) {
    throw new Error('Reminder due dates need an ISO-8601 timezone, such as 2026-10-17T09:00:00-04:00.');
  }
  let dueDateText = '';
  let dueKind = '';
  if (dueAt) {
    dueDateText = formatAppleScriptDate(dueAt);
    dueKind = 'timed';
  } else if (dueOn) {
    const match = String(dueOn).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error('All-day reminder dates need the YYYY-MM-DD format.');
    const [, yearText, monthText, dayText] = match;
    const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
    if (date.getFullYear() !== Number(yearText) || date.getMonth() !== Number(monthText) - 1 || date.getDate() !== Number(dayText)) {
      throw new Error('The all-day reminder date is invalid.');
    }
    dueDateText = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    dueKind = 'all-day';
  }
  return {
    script: CREATE_REMINDER_SCRIPT,
    args: [cleanTitle, cleanNotes, dueDateText, dueKind],
  };
}
