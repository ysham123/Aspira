const CREATE_MAIL_DRAFT_SCRIPT = `on run argv
  set recipientAddress to item 1 of argv
  set messageSubject to item 2 of argv
  set messageBody to item 3 of argv
  tell application "Mail"
    set draftMessage to make new outgoing message with properties {subject:messageSubject, content:messageBody, visible:true}
    if recipientAddress is not "" then
      tell draftMessage
        make new to recipient at end of to recipients with properties {address:recipientAddress}
      end tell
    end if
    activate
    return subject of draftMessage
  end tell
end run`;

export function mailDraftAppleScriptRequest({ to = '', subject, body }) {
  const recipient = String(to || '').trim();
  const cleanSubject = String(subject || '').trim();
  const cleanBody = String(body || '').trim();
  if (recipient && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(recipient)) {
    throw new Error('Use a valid email address for the draft recipient, or leave it blank.');
  }
  if (!cleanSubject) throw new Error('An email subject is required.');
  if (cleanSubject.length > 300) throw new Error('Email subjects are limited to 300 characters.');
  if (!cleanBody) throw new Error('Email body text is required.');
  if (cleanBody.length > 20_000) throw new Error('Email body text is limited to 20,000 characters.');
  return { script: CREATE_MAIL_DRAFT_SCRIPT, args: [recipient, cleanSubject, cleanBody] };
}
