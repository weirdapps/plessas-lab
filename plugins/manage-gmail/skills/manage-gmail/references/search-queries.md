# Gmail Search Query Reference

## Basic Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `from:` | Messages from a specific sender | `from:user@example.com` |
| `to:` | Messages sent to a recipient | `to:me@example.com` |
| `cc:` | Messages CC'd to someone | `cc:team@example.com` |
| `bcc:` | Messages BCC'd to someone | `bcc:manager@example.com` |
| `subject:` | Words in the subject line | `subject:meeting` |

## Status Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `is:unread` | Unread messages | `is:unread` |
| `is:read` | Read messages | `is:read` |
| `is:starred` | Starred messages | `is:starred` |
| `is:important` | Important messages | `is:important` |
| `is:snoozed` | Snoozed messages | `is:snoozed` |

## Location Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `in:inbox` | Messages in inbox | `in:inbox` |
| `in:sent` | Sent messages | `in:sent` |
| `in:drafts` | Draft messages | `in:drafts` |
| `in:trash` | Trashed messages | `in:trash` |
| `in:spam` | Spam messages | `in:spam` |
| `in:anywhere` | All messages including spam/trash | `in:anywhere` |

## Content Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `has:attachment` | Messages with attachments | `has:attachment` |
| `has:drive` | Messages with Google Drive links | `has:drive` |
| `has:document` | Messages with Google Docs | `has:document` |
| `has:spreadsheet` | Messages with Google Sheets | `has:spreadsheet` |
| `has:presentation` | Messages with Google Slides | `has:presentation` |
| `has:youtube` | Messages with YouTube links | `has:youtube` |
| `filename:` | Attachment filename | `filename:report.pdf` |

## Date Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `after:` | Messages after a date | `after:2024/01/01` |
| `before:` | Messages before a date | `before:2024/12/31` |
| `newer_than:` | Messages newer than relative time | `newer_than:7d` |
| `older_than:` | Messages older than relative time | `older_than:30d` |

**Relative time units:**
- `d` = days (e.g., `7d` = 7 days)
- `m` = months (e.g., `1m` = 1 month)
- `y` = years (e.g., `1y` = 1 year)

## Size Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `larger:` | Messages larger than size | `larger:5M` |
| `smaller:` | Messages smaller than size | `smaller:1M` |
| `size:` | Messages of exact size | `size:102400` |

**Size units:**
- No unit = bytes
- `K` = kilobytes
- `M` = megabytes

## Label Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `label:` | Messages with a label | `label:work` |
| `has:userlabels` | Messages with any user label | `has:userlabels` |
| `has:nouserlabels` | Messages without user labels | `has:nouserlabels` |

## Boolean Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `OR` | Match either condition | `from:alice OR from:bob` |
| `-` | Exclude (NOT) | `-is:spam` |
| `""` | Exact phrase match | `"project update"` |
| `()` | Group conditions | `(from:alice OR from:bob) subject:meeting` |

## Combined Examples

**Unread emails from boss in last week:**
```
from:boss@company.com is:unread newer_than:7d
```

**PDF attachments larger than 2MB:**
```
has:attachment filename:pdf larger:2M
```

**Important emails not in inbox (archived):**
```
is:important -in:inbox
```

**Meeting emails from last month:**
```
subject:meeting newer_than:30d older_than:7d
```

**Emails from specific domain with attachments:**
```
from:@company.com has:attachment
```

**Unread starred emails in inbox:**
```
is:unread is:starred in:inbox
```

**Emails to me or CC'd to me:**
```
to:me OR cc:me
```

**Exclude newsletters and promotions:**
```
-label:promotions -label:social -from:noreply
```

## Attachment-Specific Searches

**Find emails with specific file types:**
```
# PDF files
has:attachment filename:pdf

# Excel files
has:attachment filename:xlsx OR has:attachment filename:xls

# Word documents
has:attachment filename:docx OR has:attachment filename:doc

# Images
has:attachment filename:png OR has:attachment filename:jpg OR has:attachment filename:jpeg

# Archives
has:attachment filename:zip OR has:attachment filename:rar
```

**Find large attachments:**
```
# Files larger than 10MB
has:attachment larger:10M

# Files between 5MB and 25MB (Gmail max)
has:attachment larger:5M smaller:25M
```

**Find recent emails with attachments:**
```
# Attachments from last week
has:attachment newer_than:7d

# Attachments from specific sender
from:colleague@company.com has:attachment newer_than:30d
```
