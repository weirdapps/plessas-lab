#!/usr/bin/env node
/**
 * Gmail API Operations CLI
 *
 * A unified CLI tool for Gmail operations supporting:
 * - Authentication
 * - Listing messages
 * - Reading messages and threads
 * - Sending emails
 * - Replying to messages
 * - Forwarding messages
 * - Creating drafts
 * - Managing labels
 * - Getting user profile
 *
 * Credentials: ~/.google-skills/gmail/GMailSkill-Credentials.json
 * Token: ~/.google-skills/gmail/gmail_token.json
 */

import { Command } from 'commander';
import { google, gmail_v1 } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import * as fs from 'fs';
import * as path from 'path';
import { OAuth2Client } from 'google-auth-library';
import {
  listAllContacts,
  searchContacts,
  addContact,
  updateContact,
  removeContact,
} from './contacts-registry';

// Paths for credentials and token
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
const CREDENTIALS_DIR = path.join(HOME_DIR, '.google-skills', 'gmail');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'GMailSkill-Credentials.json');
const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'gmail_token.json');

/**
 * Render an absolute $HOME path with `~` for user-facing error messages so we
 * don't leak the OS username when stderr is captured into logs.
 */
function displayPath(p: string): string {
  return HOME_DIR && p.startsWith(HOME_DIR) ? '~' + p.slice(HOME_DIR.length) : p;
}

// OAuth scope. `gmail.modify` is a superset of readonly + send + compose for
// this tool's operations, so we request only the single minimum scope rather
// than triggering an oversized consent screen with redundant entries.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
];

interface MessageDetails {
  id: string;
  threadId: string;
  messageId?: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  snippet: string;
  labelIds: string[];
  internalDate?: string;
  body_plain?: string;
  body_html?: string;
}

interface MessageBody {
  plain: string;
  html: string;
}

/**
 * Loads saved credentials from the token file.
 */
async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch {
    return null;
  }
}

/**
 * Saves credentials to the token file.
 */
async function saveCredentials(client: OAuth2Client): Promise<void> {
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });

  // Ensure directory exists with owner-only permissions so other local users
  // cannot read the directory listing.
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }

  // 0600 keeps the long-lived refresh token unreadable to any other local user
  // or process running under a different UID.
  fs.writeFileSync(TOKEN_PATH, payload, { mode: 0o600 });
}

/**
 * Authenticates and returns Gmail API service.
 */
async function getGmailService(): Promise<gmail_v1.Gmail> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Credentials file not found at ${displayPath(CREDENTIALS_PATH)}. ` +
      'Download OAuth credentials from Google Cloud Console.'
    );
  }

  let client = await loadSavedCredentialsIfExist();

  if (!client) {
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });

    if (client.credentials) {
      await saveCredentials(client);
    }
  }

  return google.gmail({ version: 'v1', auth: client });
}

/**
 * Get authenticated user's profile.
 */
async function getProfile(): Promise<object> {
  const gmail = await getGmailService();
  const response = await gmail.users.getProfile({ userId: 'me' });
  const profile = response.data;

  return {
    email: profile.emailAddress,
    messagesTotal: profile.messagesTotal,
    threadsTotal: profile.threadsTotal,
    historyId: profile.historyId,
  };
}

/**
 * Extract body content from a message payload.
 */
function getMessageBody(message: gmail_v1.Schema$Message): MessageBody {
  const body: MessageBody = { plain: '', html: '' };

  function extractParts(payload: gmail_v1.Schema$MessagePart | undefined): void {
    if (!payload) return;

    if (payload.body?.data) {
      const data = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      const mimeType = payload.mimeType || '';

      if (mimeType.includes('text/plain')) {
        body.plain = data;
      } else if (mimeType.includes('text/html')) {
        body.html = data;
      }
    }

    if (payload.parts) {
      payload.parts.forEach(part => extractParts(part));
    }
  }

  extractParts(message.payload);
  return body;
}

/**
 * Extract headers from a message as key-value pairs.
 */
function getMessageHeaders(message: gmail_v1.Schema$Message): Record<string, string> {
  const headers: Record<string, string> = {};
  if (message.payload?.headers) {
    message.payload.headers.forEach(h => {
      if (h.name && h.value) {
        headers[h.name] = h.value;
      }
    });
  }
  return headers;
}

/**
 * Get MIME type for a file based on its extension.
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
    '.tar': 'application/x-tar',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'text/typescript',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.wav': 'audio/wav',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Resolve an attachment path supplied by the operator. Rejects '..' segments to
 * prevent prompt-injection from making the tool exfiltrate files outside the
 * working directory or home dir; full path resolution is the legitimate behavior
 * since this CLI is meant to attach any file the operator owns.
 */
function resolveAttachmentPath(filePath: string): string {
  if (filePath.split(/[\/\\]/).some((seg) => seg === '..')) {
    throw new Error(`Attachment path contains '..' segment, refused: ${filePath}`);
  }
  if (filePath.startsWith('~')) {
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return path.join(process.env.HOME || '', filePath.slice(1));
  }
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  return path.resolve(filePath);
}

/**
 * Validate and read attachment files.
 * Returns array of attachment objects with filename, mimeType, and base64 content.
 */
function readAttachments(attachmentPaths: string[]): Array<{
  filename: string;
  mimeType: string;
  content: string;
}> {
  const attachments: Array<{ filename: string; mimeType: string; content: string }> = [];
  const GMAIL_MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB

  for (const filePath of attachmentPaths) {
    const resolvedPath = resolveAttachmentPath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Attachment file not found: ${filePath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.size > GMAIL_MAX_ATTACHMENT_SIZE) {
      throw new Error(
        `Attachment too large: ${filePath} (${Math.round(stats.size / 1024 / 1024)}MB). ` +
        `Gmail limit is 25MB.`
      );
    }

    const fileContent = fs.readFileSync(resolvedPath);
    const base64Content = fileContent.toString('base64');
    const filename = path.basename(resolvedPath);
    const mimeType = getMimeType(filename);

    attachments.push({
      filename,
      mimeType,
      content: base64Content,
    });
  }

  return attachments;
}

/**
 * List messages matching criteria.
 */
async function listMessages(
  query: string = '',
  maxResults: number = 10,
  labelIds?: string[]
): Promise<MessageDetails[]> {
  const gmail = await getGmailService();
  const messages: gmail_v1.Schema$Message[] = [];
  let pageToken: string | undefined;

  while (true) {
    const params: gmail_v1.Params$Resource$Users$Messages$List = {
      userId: 'me',
      maxResults: Math.min(maxResults - messages.length, 500),
    };

    if (query) params.q = query;
    if (labelIds) params.labelIds = labelIds;
    if (pageToken) params.pageToken = pageToken;

    const response = await gmail.users.messages.list(params);

    if (response.data.messages) {
      messages.push(...response.data.messages);
    }

    pageToken = response.data.nextPageToken || undefined;
    if (!pageToken || messages.length >= maxResults) break;
  }

  // Get details for each message
  const detailedMessages: MessageDetails[] = [];
  for (const msg of messages.slice(0, maxResults)) {
    const fullMsg = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Message-ID'],
    });

    const headers = getMessageHeaders(fullMsg.data);

    detailedMessages.push({
      id: fullMsg.data.id!,
      threadId: fullMsg.data.threadId!,
      messageId: headers['Message-ID'] || '',
      subject: headers['Subject'] || '(No Subject)',
      from: headers['From'] || '',
      to: headers['To'] || '',
      date: headers['Date'] || '',
      snippet: fullMsg.data.snippet || '',
      labelIds: fullMsg.data.labelIds || [],
      internalDate: fullMsg.data.internalDate || '',
    });
  }

  return detailedMessages;
}

/**
 * Read a specific message by ID.
 */
async function readMessage(messageId: string, format: string = 'full'): Promise<MessageDetails> {
  const gmail = await getGmailService();
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: format as 'full' | 'metadata' | 'minimal' | 'raw',
  });

  const message = response.data;
  const headers = getMessageHeaders(message);
  const body = getMessageBody(message);

  return {
    id: message.id!,
    threadId: message.threadId!,
    subject: headers['Subject'] || '',
    from: headers['From'] || '',
    to: headers['To'] || '',
    cc: headers['Cc'] || '',
    date: headers['Date'] || '',
    messageId: headers['Message-ID'] || '',
    snippet: message.snippet || '',
    labelIds: message.labelIds || [],
    body_plain: body.plain,
    body_html: body.html,
  };
}

/**
 * Read all messages in a thread.
 */
async function readThread(threadId: string): Promise<MessageDetails[]> {
  const gmail = await getGmailService();
  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const thread = response.data;
  const parsedMessages: MessageDetails[] = [];

  for (const message of thread.messages || []) {
    const headers = getMessageHeaders(message);
    const body = getMessageBody(message);

    parsedMessages.push({
      id: message.id!,
      threadId: message.threadId!,
      subject: headers['Subject'] || '',
      from: headers['From'] || '',
      to: headers['To'] || '',
      date: headers['Date'] || '',
      snippet: message.snippet || '',
      labelIds: message.labelIds || [],
      body_plain: body.plain,
      body_html: body.html,
    });
  }

  return parsedMessages;
}

/**
 * Create an email message in RFC 2822 format.
 * Supports plain text, HTML, and file attachments.
 */
function createMessage(options: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  htmlBody?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: string[];
}): { raw: string; threadId?: string } {
  const mixedBoundary = `mixed_boundary_${Date.now()}`;
  const altBoundary = `alt_boundary_${Date.now()}`;
  let email = '';

  // Common headers
  email += `To: ${options.to}\r\n`;
  email += `Subject: ${options.subject}\r\n`;
  if (options.cc) email += `Cc: ${options.cc}\r\n`;
  if (options.bcc) email += `Bcc: ${options.bcc}\r\n`;
  if (options.inReplyTo) email += `In-Reply-To: ${options.inReplyTo}\r\n`;
  if (options.references) email += `References: ${options.references}\r\n`;
  email += `MIME-Version: 1.0\r\n`;

  // Read attachments if provided
  const attachmentData = options.attachments && options.attachments.length > 0
    ? readAttachments(options.attachments)
    : [];

  if (attachmentData.length > 0) {
    // Multipart/mixed for attachments
    email += `Content-Type: multipart/mixed; boundary="${mixedBoundary}"\r\n\r\n`;

    // Body part (can be multipart/alternative if HTML is provided)
    email += `--${mixedBoundary}\r\n`;

    if (options.htmlBody) {
      // Multipart/alternative for text + HTML
      email += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
      email += `--${altBoundary}\r\n`;
      email += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      email += `${options.body}\r\n\r\n`;
      email += `--${altBoundary}\r\n`;
      email += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
      email += `${options.htmlBody}\r\n\r\n`;
      email += `--${altBoundary}--\r\n`;
    } else {
      email += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      email += `${options.body}\r\n`;
    }

    // Attachment parts
    for (const attachment of attachmentData) {
      email += `\r\n--${mixedBoundary}\r\n`;
      email += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
      email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      email += `Content-Transfer-Encoding: base64\r\n\r\n`;
      // Split base64 into 76-character lines for RFC compliance
      const base64Lines = attachment.content.match(/.{1,76}/g) || [];
      email += base64Lines.join('\r\n');
      email += '\r\n';
    }

    email += `--${mixedBoundary}--`;
  } else if (options.htmlBody) {
    // No attachments, but has HTML - use multipart/alternative
    email += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    email += `--${altBoundary}\r\n`;
    email += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    email += `${options.body}\r\n\r\n`;
    email += `--${altBoundary}\r\n`;
    email += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    email += `${options.htmlBody}\r\n\r\n`;
    email += `--${altBoundary}--`;
  } else {
    // Plain text only
    email += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    email += options.body;
  }

  const encodedMessage = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result: { raw: string; threadId?: string } = { raw: encodedMessage };
  if (options.threadId) result.threadId = options.threadId;

  return result;
}

/**
 * Send an email message.
 */
async function sendMessage(message: { raw: string; threadId?: string }): Promise<object> {
  const gmail = await getGmailService();
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: message,
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds || [],
  };
}

/**
 * Send an email.
 */
async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  htmlBody?: string;
  attachments?: string[];
}): Promise<object> {
  const message = createMessage(options);
  return sendMessage(message);
}

/**
 * Reply to an existing message.
 */
async function replyToMessage(
  originalMessageId: string,
  body: string,
  replyAll: boolean = false,
  htmlBody?: string,
  attachments?: string[]
): Promise<object> {
  const gmail = await getGmailService();

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: originalMessageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'To', 'Cc', 'Message-ID', 'References'],
  });

  const original = response.data;
  const headers = getMessageHeaders(original);

  const originalFrom = headers['From'] || '';
  const originalTo = headers['To'] || '';
  const originalCc = headers['Cc'] || '';
  const originalSubject = headers['Subject'] || '';
  const messageId = headers['Message-ID'] || '';
  const references = headers['References'] || '';

  let to = originalFrom;
  let cc: string | undefined;

  if (replyAll) {
    cc = [originalTo, originalCc].filter(Boolean).join(', ');
  }

  let subject = originalSubject;
  if (!originalSubject.toLowerCase().startsWith('re:')) {
    subject = `Re: ${originalSubject}`;
  }

  const newReferences = references ? `${references} ${messageId}` : messageId;

  const message = createMessage({
    to,
    subject,
    body,
    cc,
    htmlBody,
    threadId: original.threadId!,
    inReplyTo: messageId,
    references: newReferences,
    attachments,
  });

  return sendMessage(message);
}

/**
 * Forward a message to new recipients.
 */
async function forwardMessage(
  originalMessageId: string,
  to: string,
  additionalText?: string,
  cc?: string,
  bcc?: string,
  attachments?: string[]
): Promise<object> {
  const gmail = await getGmailService();

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: originalMessageId,
    format: 'full',
  });

  const original = response.data;
  const headers = getMessageHeaders(original);
  const originalBody = getMessageBody(original);

  const forwardHeader =
    `\n\n---------- Forwarded message ----------\n` +
    `From: ${headers['From'] || ''}\n` +
    `Date: ${headers['Date'] || ''}\n` +
    `Subject: ${headers['Subject'] || ''}\n` +
    `To: ${headers['To'] || ''}\n\n`;

  let body: string;
  if (additionalText) {
    body = `${additionalText}${forwardHeader}${originalBody.plain}`;
  } else {
    body = `${forwardHeader}${originalBody.plain}`;
  }

  let subject = headers['Subject'] || '';
  if (!subject.toLowerCase().startsWith('fwd:')) {
    subject = `Fwd: ${subject}`;
  }

  const message = createMessage({
    to,
    subject,
    body,
    cc,
    bcc,
    attachments,
  });

  return sendMessage(message);
}

/**
 * Create a draft email.
 */
async function createDraft(options: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  htmlBody?: string;
  attachments?: string[];
}): Promise<object> {
  const gmail = await getGmailService();
  const message = createMessage(options);

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message,
    },
  });

  return {
    id: response.data.id,
    message: response.data.message || {},
  };
}

/**
 * Move a message to trash.
 */
async function trashMessage(messageId: string): Promise<object> {
  const gmail = await getGmailService();
  const response = await gmail.users.messages.trash({
    userId: 'me',
    id: messageId,
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds || [],
    status: 'trashed',
  };
}

/**
 * Move multiple messages to trash in a batch.
 */
async function trashMessagesBulk(messageIds: string[]): Promise<object> {
  const gmail = await getGmailService();
  const results: object[] = [];
  const errors: object[] = [];

  const batchSize = 100;

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);

    try {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX', 'UNREAD'],
        },
      });

      for (const msgId of batch) {
        results.push({
          id: msgId,
          status: 'trashed',
        });
      }
    } catch {
      // Fallback to individual operations
      for (const msgId of batch) {
        try {
          const response = await gmail.users.messages.trash({
            userId: 'me',
            id: msgId,
          });
          results.push({
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds || [],
            status: 'trashed',
          });
        } catch (individualError) {
          errors.push({
            id: msgId,
            status: 'error',
            error: String(individualError),
          });
        }
      }
    }
  }

  return {
    results,
    errors,
    summary: {
      total: messageIds.length,
      trashed: results.length,
      failed: errors.length,
    },
  };
}

/**
 * Restore a message from trash.
 */
async function untrashMessage(messageId: string): Promise<object> {
  const gmail = await getGmailService();
  const response = await gmail.users.messages.untrash({
    userId: 'me',
    id: messageId,
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds || [],
    status: 'restored',
  };
}

/**
 * Permanently delete a message.
 */
async function deleteMessage(messageId: string): Promise<object> {
  const gmail = await getGmailService();
  await gmail.users.messages.delete({
    userId: 'me',
    id: messageId,
  });

  return {
    id: messageId,
    status: 'permanently_deleted',
  };
}

/**
 * List all labels.
 */
async function listLabels(): Promise<object[]> {
  const gmail = await getGmailService();
  const response = await gmail.users.labels.list({ userId: 'me' });
  const labels = response.data.labels || [];

  return labels.map(label => ({
    id: label.id,
    name: label.name,
    type: label.type || 'user',
  }));
}

/**
 * Create a new label.
 */
async function createLabel(
  name: string,
  backgroundColor?: string,
  textColor?: string
): Promise<object> {
  const gmail = await getGmailService();

  const labelBody: gmail_v1.Schema$Label = {
    name,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
  };

  if (backgroundColor || textColor) {
    labelBody.color = {};
    if (backgroundColor) labelBody.color.backgroundColor = backgroundColor;
    if (textColor) labelBody.color.textColor = textColor;
  }

  const response = await gmail.users.labels.create({
    userId: 'me',
    requestBody: labelBody,
  });

  return {
    id: response.data.id,
    name: response.data.name,
    type: response.data.type || 'user',
  };
}

/**
 * Apply or remove labels from a message.
 */
async function applyLabel(
  messageId: string,
  addLabelIds: string[],
  removeLabelIds?: string[]
): Promise<object> {
  const gmail = await getGmailService();

  const body: gmail_v1.Schema$ModifyMessageRequest = {
    addLabelIds,
  };

  if (removeLabelIds) {
    body.removeLabelIds = removeLabelIds;
  }

  const response = await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: body,
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds || [],
  };
}

/**
 * Output result as JSON and exit.
 */
function outputResult(result: unknown): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Handle errors and output as JSON.
 */
function handleError(error: unknown): never {
  // Whitelist a small set of safe fields. We never serialise the full error
  // object because Google API errors can carry the original request payload and
  // (rarely) a token hint in nested fields like `error.response.data` — those
  // would leak into stderr/logs if blindly stringified.
  const errorObj: Record<string, unknown> = {};

  if (error instanceof Error) {
    errorObj.error = error.message;
    if ('code' in error) {
      errorObj.status = (error as { code: number | string }).code;
    }
  } else if (typeof error === 'string') {
    errorObj.error = error;
  } else {
    errorObj.error = 'Unknown error';
  }

  console.error(JSON.stringify(errorObj, null, 2));
  process.exit(1);
}

// CLI Setup
const program = new Command();

program
  .name('gmail-operations')
  .description('Gmail API Operations CLI')
  .version('1.0.0');

program
  .command('profile')
  .description('Get authenticated user profile')
  .action(async () => {
    try {
      const result = await getProfile();
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('list')
  .description('List messages')
  .option('-q, --query <query>', 'Gmail search query', '')
  .option('-n, --max-results <number>', 'Max messages', '10')
  .option('--label-ids <labels>', 'Comma-separated label IDs')
  .action(async (options) => {
    try {
      const labelIds = options.labelIds ? options.labelIds.split(',') : undefined;
      const result = await listMessages(
        options.query,
        parseInt(options.maxResults),
        labelIds
      );
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('search')
  .description('Search messages')
  .requiredOption('-q, --query <query>', 'Gmail search query')
  .option('-n, --max-results <number>', 'Max messages', '10')
  .action(async (options) => {
    try {
      const result = await listMessages(options.query, parseInt(options.maxResults));
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('read')
  .description('Read a specific message')
  .requiredOption('-m, --message-id <id>', 'Message ID')
  .option('-f, --format <format>', 'Output format (full, metadata, minimal)', 'full')
  .action(async (options) => {
    try {
      const result = await readMessage(options.messageId, options.format);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('thread')
  .description('Read a thread')
  .requiredOption('-t, --thread-id <id>', 'Thread ID')
  .action(async (options) => {
    try {
      const result = await readThread(options.threadId);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('send')
  .description('Send an email')
  .requiredOption('--to <recipient>', 'Recipient(s)')
  .requiredOption('-s, --subject <subject>', 'Subject')
  .requiredOption('-b, --body <body>', 'Body text')
  .option('--cc <cc>', 'CC recipients')
  .option('--bcc <bcc>', 'BCC recipients')
  .option('--html <html>', 'HTML body')
  .option('-a, --attachments <files>', 'Comma-separated file paths to attach')
  .action(async (options) => {
    try {
      const attachments = options.attachments
        ? options.attachments.split(',').map((f: string) => f.trim())
        : undefined;
      const result = await sendEmail({
        to: options.to,
        subject: options.subject,
        body: options.body,
        cc: options.cc,
        bcc: options.bcc,
        htmlBody: options.html,
        attachments,
      });
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('reply')
  .description('Reply to a message')
  .requiredOption('-m, --message-id <id>', 'Message ID to reply to')
  .requiredOption('-b, --body <body>', 'Reply body')
  .option('--reply-all', 'Reply to all')
  .option('--html <html>', 'HTML body')
  .option('-a, --attachments <files>', 'Comma-separated file paths to attach')
  .action(async (options) => {
    try {
      const attachments = options.attachments
        ? options.attachments.split(',').map((f: string) => f.trim())
        : undefined;
      const result = await replyToMessage(
        options.messageId,
        options.body,
        options.replyAll || false,
        options.html,
        attachments
      );
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('forward')
  .description('Forward a message')
  .requiredOption('-m, --message-id <id>', 'Message ID to forward')
  .requiredOption('--to <recipient>', 'Recipient(s)')
  .option('--text <text>', 'Additional text')
  .option('--cc <cc>', 'CC recipients')
  .option('--bcc <bcc>', 'BCC recipients')
  .option('-a, --attachments <files>', 'Comma-separated file paths to attach')
  .action(async (options) => {
    try {
      const attachments = options.attachments
        ? options.attachments.split(',').map((f: string) => f.trim())
        : undefined;
      const result = await forwardMessage(
        options.messageId,
        options.to,
        options.text,
        options.cc,
        options.bcc,
        attachments
      );
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('draft')
  .description('Create a draft')
  .requiredOption('--to <recipient>', 'Recipient(s)')
  .requiredOption('-s, --subject <subject>', 'Subject')
  .requiredOption('-b, --body <body>', 'Body text')
  .option('--cc <cc>', 'CC recipients')
  .option('--html <html>', 'HTML body')
  .option('-a, --attachments <files>', 'Comma-separated file paths to attach')
  .action(async (options) => {
    try {
      const attachments = options.attachments
        ? options.attachments.split(',').map((f: string) => f.trim())
        : undefined;
      const result = await createDraft({
        to: options.to,
        subject: options.subject,
        body: options.body,
        cc: options.cc,
        htmlBody: options.html,
        attachments,
      });
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('trash')
  .description('Move a message to trash')
  .requiredOption('-m, --message-id <id>', 'Message ID to trash')
  .action(async (options) => {
    try {
      const result = await trashMessage(options.messageId);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('trash-bulk')
  .description('Move multiple messages to trash')
  .requiredOption('-m, --message-ids <ids>', 'Comma-separated message IDs')
  .action(async (options) => {
    try {
      const messageIds = options.messageIds.split(',').map((id: string) => id.trim());
      const result = await trashMessagesBulk(messageIds);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('untrash')
  .description('Restore a message from trash')
  .requiredOption('-m, --message-id <id>', 'Message ID to restore')
  .action(async (options) => {
    try {
      const result = await untrashMessage(options.messageId);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('delete')
  .description('Permanently delete a message (CANNOT BE UNDONE)')
  .requiredOption('-m, --message-id <id>', 'Message ID to delete')
  .action(async (options) => {
    try {
      const result = await deleteMessage(options.messageId);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('labels-list')
  .description('List all labels')
  .action(async () => {
    try {
      const result = await listLabels();
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('label-create')
  .description('Create a new label')
  .requiredOption('-n, --name <name>', 'Label name')
  .option('--background-color <color>', 'Background color (hex)')
  .option('--text-color <color>', 'Text color (hex)')
  .action(async (options) => {
    try {
      const result = await createLabel(
        options.name,
        options.backgroundColor,
        options.textColor
      );
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('label-apply')
  .description('Apply labels to a message')
  .requiredOption('-m, --message-id <id>', 'Message ID')
  .option('--add-labels <labels>', 'Comma-separated label IDs to add')
  .option('--remove-labels <labels>', 'Comma-separated label IDs to remove')
  .action(async (options) => {
    try {
      const addLabels = options.addLabels ? options.addLabels.split(',') : [];
      const removeLabels = options.removeLabels ? options.removeLabels.split(',') : undefined;
      const result = await applyLabel(options.messageId, addLabels, removeLabels);
      outputResult(result);
    } catch (error) {
      handleError(error);
    }
  });

// Contacts Registry Commands
const contactsCmd = program
  .command('contacts')
  .description('Manage email contacts registry');

contactsCmd
  .command('list')
  .description('List all contacts in the registry')
  .action(async () => {
    try {
      const contacts = listAllContacts();
      outputResult({
        count: contacts.length,
        contacts: contacts.map((c, i) => ({
          index: i + 1,
          name: c.name,
          email: c.email,
          formatted: `${c.name} <${c.email}>`,
        })),
      });
    } catch (error) {
      handleError(error);
    }
  });

contactsCmd
  .command('search')
  .description('Search contacts by name (case-insensitive partial match)')
  .requiredOption('-n, --name <query>', 'Name to search for')
  .action(async (options) => {
    try {
      const contacts = searchContacts(options.name);
      outputResult({
        query: options.name,
        count: contacts.length,
        contacts: contacts.map((c, i) => ({
          index: i + 1,
          name: c.name,
          email: c.email,
          formatted: `${c.name} <${c.email}>`,
        })),
      });
    } catch (error) {
      handleError(error);
    }
  });

contactsCmd
  .command('add')
  .description('Add a new contact to the registry')
  .requiredOption('-n, --name <name>', 'Full name of the contact')
  .requiredOption('-e, --email <email>', 'Email address')
  .action(async (options) => {
    try {
      const contact = addContact(options.name, options.email);
      outputResult({
        status: 'added',
        contact: {
          name: contact.name,
          email: contact.email,
          formatted: `${contact.name} <${contact.email}>`,
        },
      });
    } catch (error) {
      handleError(error);
    }
  });

contactsCmd
  .command('update')
  .description('Update an existing contact\'s email (exact name match)')
  .requiredOption('-n, --name <name>', 'Full name of the contact')
  .requiredOption('-e, --email <email>', 'New email address')
  .action(async (options) => {
    try {
      const contact = updateContact(options.name, options.email);
      outputResult({
        status: 'updated',
        contact: {
          name: contact.name,
          email: contact.email,
          formatted: `${contact.name} <${contact.email}>`,
        },
      });
    } catch (error) {
      handleError(error);
    }
  });

contactsCmd
  .command('remove')
  .description('Remove a contact from the registry (exact name match)')
  .requiredOption('-n, --name <name>', 'Full name of the contact to remove')
  .action(async (options) => {
    try {
      const contact = removeContact(options.name);
      outputResult({
        status: 'removed',
        contact: {
          name: contact.name,
          email: contact.email,
          formatted: `${contact.name} <${contact.email}>`,
        },
      });
    } catch (error) {
      handleError(error);
    }
  });

program.parse(process.argv);
