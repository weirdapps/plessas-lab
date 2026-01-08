# Google Drive Permissions Reference (TypeScript)

Complete guide to managing file and folder permissions in TypeScript.

## Permission Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `owner` | Full ownership | All operations, can delete, transfer ownership |
| `organizer` | Shared drive organizer | Manage members and content in shared drives |
| `fileOrganizer` | File organizer | Organize files in shared drive |
| `writer` | Editor | Edit content, add comments, share with others |
| `commenter` | Commenter | View and add comments only |
| `reader` | Viewer | View only, no editing or commenting |

## Permission Types

| Type | Description | Required Field |
|------|-------------|----------------|
| `user` | Specific user | `emailAddress` |
| `group` | Google Group | `emailAddress` |
| `domain` | Entire domain | `domain` |
| `anyone` | Anyone with link | None |

## Permission Operations

### List Permissions

```typescript
import { drive_v3 } from 'googleapis';

/**
 * List all permissions for a file.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file
 * @returns List of permission objects
 */
export async function listPermissions(
  service: drive_v3.Drive,
  fileId: string
): Promise<drive_v3.Schema$Permission[]> {
  const response = await service.permissions.list({
    fileId,
    fields: 'permissions(id, type, role, emailAddress, domain, displayName, deleted)',
  });

  return response.data.permissions || [];
}
```

### Share with User

```typescript
/**
 * Share a file with a specific user.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of file to share
 * @param email - User's email address
 * @param role - Permission level (reader, commenter, writer)
 * @param notify - Send email notification
 * @param message - Optional message in notification email
 * @returns Created permission object
 */
export async function shareWithUser(
  service: drive_v3.Drive,
  fileId: string,
  email: string,
  role: 'reader' | 'commenter' | 'writer' = 'reader',
  notify: boolean = true,
  message?: string
): Promise<drive_v3.Schema$Permission> {
  const permission: drive_v3.Schema$Permission = {
    type: 'user',
    role,
    emailAddress: email,
  };

  const response = await service.permissions.create({
    fileId,
    requestBody: permission,
    sendNotificationEmail: notify,
    emailMessage: message,
    fields: 'id, type, role, emailAddress',
  });

  return response.data;
}
```

### Share with Group

```typescript
/**
 * Share a file with a Google Group.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of file to share
 * @param groupEmail - Google Group email address
 * @param role - Permission level
 * @returns Created permission object
 */
export async function shareWithGroup(
  service: drive_v3.Drive,
  fileId: string,
  groupEmail: string,
  role: 'reader' | 'commenter' | 'writer' = 'reader'
): Promise<drive_v3.Schema$Permission> {
  const permission: drive_v3.Schema$Permission = {
    type: 'group',
    role,
    emailAddress: groupEmail,
  };

  const response = await service.permissions.create({
    fileId,
    requestBody: permission,
    fields: 'id, type, role, emailAddress',
  });

  return response.data;
}
```

### Share with Domain

```typescript
/**
 * Share a file with an entire domain.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of file to share
 * @param domain - Domain name (e.g., 'example.com')
 * @param role - Permission level
 * @returns Created permission object
 */
export async function shareWithDomain(
  service: drive_v3.Drive,
  fileId: string,
  domain: string,
  role: 'reader' | 'commenter' | 'writer' = 'reader'
): Promise<drive_v3.Schema$Permission> {
  const permission: drive_v3.Schema$Permission = {
    type: 'domain',
    role,
    domain,
  };

  const response = await service.permissions.create({
    fileId,
    requestBody: permission,
    fields: 'id, type, role, domain',
  });

  return response.data;
}
```

### Share with Anyone (Public Link)

```typescript
/**
 * Share a file with anyone who has the link.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of file to share
 * @param role - Permission level (reader or commenter only)
 * @returns Created permission object
 *
 * Note: This makes the file publicly accessible to anyone with the link.
 * Use with caution for sensitive content.
 */
export async function shareWithAnyone(
  service: drive_v3.Drive,
  fileId: string,
  role: 'reader' | 'commenter' = 'reader'
): Promise<drive_v3.Schema$Permission> {
  const permission: drive_v3.Schema$Permission = {
    type: 'anyone',
    role,
  };

  const response = await service.permissions.create({
    fileId,
    requestBody: permission,
    fields: 'id, type, role',
  });

  return response.data;
}
```

### Update Permission

```typescript
/**
 * Update an existing permission's role.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file
 * @param permissionId - ID of the permission to update
 * @param newRole - New role (reader, commenter, writer)
 * @returns Updated permission object
 */
export async function updatePermission(
  service: drive_v3.Drive,
  fileId: string,
  permissionId: string,
  newRole: 'reader' | 'commenter' | 'writer'
): Promise<drive_v3.Schema$Permission> {
  const response = await service.permissions.update({
    fileId,
    permissionId,
    requestBody: { role: newRole },
    fields: 'id, type, role, emailAddress',
  });

  return response.data;
}
```

### Revoke Permission

```typescript
/**
 * Remove a permission (revoke access).
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file
 * @param permissionId - ID of the permission to remove
 */
export async function revokePermission(
  service: drive_v3.Drive,
  fileId: string,
  permissionId: string
): Promise<void> {
  await service.permissions.delete({
    fileId,
    permissionId,
  });
}
```

### Revoke Access by Email

```typescript
/**
 * Remove access for a specific user by email.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file
 * @param email - Email address of user to remove
 * @returns True if access was removed, false if user had no access
 */
export async function revokeAccessByEmail(
  service: drive_v3.Drive,
  fileId: string,
  email: string
): Promise<boolean> {
  const permissions = await listPermissions(service, fileId);

  for (const perm of permissions) {
    if ((perm.emailAddress || '').toLowerCase() === email.toLowerCase()) {
      await revokePermission(service, fileId, perm.id!);
      return true;
    }
  }

  return false;
}
```

### Transfer Ownership

```typescript
/**
 * Transfer ownership of a file to another user.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file
 * @param newOwnerEmail - Email of the new owner
 * @returns Updated permission object
 *
 * Notes:
 *   - New owner must be in same domain for Google Workspace
 *   - For personal accounts, ownership transfer may be restricted
 *   - Original owner becomes a writer
 */
export async function transferOwnership(
  service: drive_v3.Drive,
  fileId: string,
  newOwnerEmail: string
): Promise<drive_v3.Schema$Permission> {
  const permission: drive_v3.Schema$Permission = {
    type: 'user',
    role: 'owner',
    emailAddress: newOwnerEmail,
  };

  const response = await service.permissions.create({
    fileId,
    requestBody: permission,
    transferOwnership: true,
    fields: 'id, type, role, emailAddress',
  });

  return response.data;
}
```

### Get Sharing Summary

```typescript
export interface DomainAccess {
  domain: string;
  role: 'editor' | 'viewer';
}

export interface SharingSummary {
  owner: string | null;
  editors: string[];
  commenters: string[];
  viewers: string[];
  anyoneWithLink: false | 'view' | 'edit';
  domainAccess: DomainAccess[];
}

/**
 * Get a human-readable summary of file sharing.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file
 * @returns Dictionary with sharing summary
 */
export async function getSharingSummary(
  service: drive_v3.Drive,
  fileId: string
): Promise<SharingSummary> {
  const permissions = await listPermissions(service, fileId);

  const summary: SharingSummary = {
    owner: null,
    editors: [],
    commenters: [],
    viewers: [],
    anyoneWithLink: false,
    domainAccess: [],
  };

  for (const perm of permissions) {
    const role = perm.role;
    const permType = perm.type;
    const email = perm.emailAddress || '';

    if (role === 'owner') {
      summary.owner = email;
    } else if (role === 'writer') {
      if (permType === 'anyone') {
        summary.anyoneWithLink = 'edit';
      } else if (permType === 'domain') {
        summary.domainAccess.push({ domain: perm.domain || '', role: 'editor' });
      } else {
        summary.editors.push(email);
      }
    } else if (role === 'commenter') {
      summary.commenters.push(email);
    } else if (role === 'reader') {
      if (permType === 'anyone') {
        summary.anyoneWithLink = 'view';
      } else if (permType === 'domain') {
        summary.domainAccess.push({ domain: perm.domain || '', role: 'viewer' });
      } else {
        summary.viewers.push(email);
      }
    }
  }

  return summary;
}
```

## Usage Examples

### Make File Public

```typescript
import { drive_v3 } from 'googleapis';

async function makeFilePublic(
  service: drive_v3.Drive,
  fileId: string
): Promise<string> {
  await shareWithAnyone(service, fileId, 'reader');

  const file = await service.files.get({
    fileId,
    fields: 'webViewLink',
  });

  console.log(`Public link: ${file.data.webViewLink}`);
  return file.data.webViewLink || '';
}
```

### Share with Team

```typescript
async function shareWithTeam(
  service: drive_v3.Drive,
  fileId: string,
  teamEmails: string[],
  role: 'reader' | 'commenter' | 'writer' = 'writer',
  message?: string
): Promise<void> {
  for (const email of teamEmails) {
    await shareWithUser(service, fileId, email, role, true, message);
    console.log(`Shared with ${email} as ${role}`);
  }
}

// Usage
const team = ['alice@example.com', 'bob@example.com', 'carol@example.com'];
await shareWithTeam(service, fileId, team, 'writer', 'Sharing project files with you.');
```

### Check Who Has Access

```typescript
async function checkAccess(
  service: drive_v3.Drive,
  fileId: string
): Promise<void> {
  const summary = await getSharingSummary(service, fileId);

  console.log(`Owner: ${summary.owner}`);
  console.log(`Editors: ${summary.editors.join(', ') || 'None'}`);
  console.log(`Commenters: ${summary.commenters.join(', ') || 'None'}`);
  console.log(`Viewers: ${summary.viewers.join(', ') || 'None'}`);

  if (summary.anyoneWithLink) {
    console.log(`WARNING: File is publicly accessible (${summary.anyoneWithLink})!`);
  }

  if (summary.domainAccess.length > 0) {
    for (const domain of summary.domainAccess) {
      console.log(`Domain access: ${domain.domain} (${domain.role})`);
    }
  }
}
```

### Remove All External Access

```typescript
async function removeAllExternalAccess(
  service: drive_v3.Drive,
  fileId: string,
  myEmail: string
): Promise<void> {
  const permissions = await listPermissions(service, fileId);

  for (const perm of permissions) {
    // Skip owner permission
    if (perm.role === 'owner') {
      continue;
    }

    // Remove all other permissions
    await revokePermission(service, fileId, perm.id!);
    console.log(`Removed permission: ${perm.emailAddress || perm.type}`);
  }
}
```

### Batch Share with Multiple Users

```typescript
async function batchShare(
  service: drive_v3.Drive,
  fileIds: string[],
  emails: string[],
  role: 'reader' | 'commenter' | 'writer'
): Promise<void> {
  for (const fileId of fileIds) {
    for (const email of emails) {
      try {
        await shareWithUser(service, fileId, email, role, false);
        console.log(`Shared ${fileId} with ${email}`);
      } catch (error) {
        console.error(`Failed to share ${fileId} with ${email}:`, error);
      }
    }
  }
}
```

### Check and Repair Permissions

```typescript
interface PermissionRule {
  email: string;
  requiredRole: 'reader' | 'commenter' | 'writer';
}

async function ensurePermissions(
  service: drive_v3.Drive,
  fileId: string,
  rules: PermissionRule[]
): Promise<void> {
  const permissions = await listPermissions(service, fileId);

  for (const rule of rules) {
    const existing = permissions.find(
      p => (p.emailAddress || '').toLowerCase() === rule.email.toLowerCase()
    );

    if (!existing) {
      // Add missing permission
      await shareWithUser(service, fileId, rule.email, rule.requiredRole, false);
      console.log(`Added ${rule.email} as ${rule.requiredRole}`);
    } else if (existing.role !== rule.requiredRole) {
      // Update incorrect permission
      await updatePermission(service, fileId, existing.id!, rule.requiredRole);
      console.log(`Updated ${rule.email} from ${existing.role} to ${rule.requiredRole}`);
    }
  }
}
```

## Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary access
2. **Avoid "Anyone with Link"**: Use specific user/group sharing when possible
3. **Audit Regularly**: Check sharing summary periodically
4. **Use Groups**: Share with Google Groups instead of individuals for easier management
5. **Set Expiration**: Consider time-limited access for sensitive files
6. **Document Sharing**: Keep records of who has access to sensitive files
7. **Use Notifications Wisely**: Disable notifications for batch operations to avoid spam

## Error Handling

```typescript
import { GaxiosError } from 'gaxios';

async function safeShare(
  service: drive_v3.Drive,
  fileId: string,
  email: string,
  role: 'reader' | 'commenter' | 'writer'
): Promise<drive_v3.Schema$Permission | null> {
  try {
    return await shareWithUser(service, fileId, email, role, true);
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;

      if (status === 400) {
        console.error(`Invalid email address: ${email}`);
      } else if (status === 403) {
        console.error(`Permission denied - check sharing settings`);
      } else if (status === 404) {
        console.error(`File not found: ${fileId}`);
      } else {
        console.error(`Error sharing file:`, error.message);
      }
    }
    return null;
  }
}
```
