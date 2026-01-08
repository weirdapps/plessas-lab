# Gmail API Error Handling Reference

## Common HTTP Error Codes

| Error Code | Name | Description | Solution |
|------------|------|-------------|----------|
| 400 | Bad Request | Invalid request parameters or format | Check request parameters, validate email addresses, verify JSON format |
| 401 | Unauthorized | Authentication failed or token expired | Delete `gmail_token.json` and re-authenticate |
| 403 | Forbidden | Insufficient permissions or API not enabled | Verify scopes in OAuth Consent Screen, check API is enabled |
| 404 | Not Found | Resource doesn't exist | Verify message/thread ID is valid |
| 429 | Too Many Requests | Rate limit exceeded | Implement exponential backoff, wait before retrying |
| 500 | Internal Server Error | Google server error | Retry with exponential backoff |
| 503 | Service Unavailable | Service temporarily unavailable | Retry with exponential backoff |

## Authentication Errors

### Token Expired
**Symptom**: 401 error after previously working

**Solution**:
1. Delete the token file: `rm ~/.google-skills/gmail/gmail_token.json`
2. Run any Gmail operation again
3. Complete the OAuth flow in the browser

### Scope Mismatch
**Symptom**: 403 error when trying to send email

**Solution**:
1. Verify scopes are declared in OAuth Consent Screen (Data Access section)
2. Delete token file and re-authenticate to request updated scopes
3. Ensure the scope in code matches the declared scopes

### Unverified App Warning
**Symptom**: "This app isn't verified" screen during OAuth

**Solution**:
1. For testing: Click "Advanced" > "Go to [app name] (unsafe)"
2. For production: Submit app for Google verification
3. Ensure you're using a test user account added in OAuth Consent Screen

## Rate Limiting

### Default Quotas
- **Per-user rate limit**: 250 quota units per user per second
- **Daily limit**: 1 billion quota units per day

### Quota Costs by Operation
| Operation | Quota Units |
|-----------|-------------|
| messages.list | 5 |
| messages.get | 5 |
| messages.send | 100 |
| threads.list | 10 |
| threads.get | 10 |
| drafts.create | 10 |
| drafts.send | 100 |

### Exponential Backoff Pattern

```typescript
import { GaxiosError } from 'googleapis-common';

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const gaxiosError = error as GaxiosError;
      const status = gaxiosError.response?.status;

      if ([429, 500, 503].includes(status || 0) && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000 + 1000;
        console.log(`Retrying in ${waitTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`);
}

// Usage example
const messages = await withRetry(() =>
  gmail.users.messages.list({ userId: 'me', maxResults: 10 })
);
```

## Common Issues and Solutions

### "Credentials file not found"
**Cause**: Missing `GMailSkill-Credentials.json` file

**Solution**:
1. Download OAuth credentials from Google Cloud Console
2. Save to `~/.google-skills/gmail/GMailSkill-Credentials.json`

### "Access blocked: This app's request is invalid"
**Cause**: Redirect URI mismatch or invalid client configuration

**Solution**:
1. Verify the credentials.json is for a "Desktop app" type
2. Ensure redirect URIs include `http://localhost`

### "Request had insufficient authentication scopes"
**Cause**: Token was created with fewer scopes than needed

**Solution**:
1. Delete the token file
2. Update the SCOPES array in the code
3. Re-authenticate to get a new token with the required scopes

### Empty message body
**Cause**: Message format not set to 'full' or body encoded differently

**Solution**:
1. Use `format: 'full'` when getting messages
2. Check for both `text/plain` and `text/html` MIME types
3. Handle multipart messages recursively

### Thread ID vs Message ID confusion
**Note**:
- `messageId`: Unique identifier for a single message
- `threadId`: Identifier for a conversation (shared by all messages in thread)

Always verify you're using the correct ID type for each operation.

## Attachment Errors

### "Attachment file not found"
**Cause**: The specified file path does not exist

**Solution**:
1. Verify the file path is correct
2. Use absolute paths or `~` for home directory
3. Check file permissions

**Example**:
```bash
# These path formats are supported:
--attachments "/absolute/path/to/file.pdf"
--attachments "~/Documents/file.pdf"
--attachments "./relative/path/file.pdf"
```

### "Attachment too large"
**Cause**: File exceeds Gmail's 25MB attachment limit

**Solution**:
1. Compress the file before attaching
2. Use Google Drive and share a link instead
3. Split large files into smaller parts

**Note**: The 25MB limit applies to each individual file, not the total message size.

### "Permission denied" reading attachment
**Cause**: Insufficient permissions to read the file

**Solution**:
1. Check file permissions: `ls -la /path/to/file`
2. Ensure the file is readable by the current user
3. Run `chmod +r /path/to/file` if needed

### Unsupported file type warning
**Note**: Files with unrecognized extensions are sent with `application/octet-stream` MIME type. This is not an error - the file will still be attached successfully.

**Supported MIME types** (automatically detected):
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, MD
- Images: PNG, JPG, JPEG, GIF, SVG, WEBP
- Archives: ZIP, GZ, TAR, RAR, 7Z
- Code: JSON, XML, HTML, CSS, JS, TS
- Media: MP3, MP4, WAV, AVI, MOV

### Multiple attachment issues
**Cause**: Incorrect format for multiple attachments

**Solution**: Use comma-separated paths without spaces after commas:
```bash
# Correct
--attachments "/path/file1.pdf,/path/file2.docx"

# Incorrect (spaces after commas can cause issues)
--attachments "/path/file1.pdf, /path/file2.docx"
```
