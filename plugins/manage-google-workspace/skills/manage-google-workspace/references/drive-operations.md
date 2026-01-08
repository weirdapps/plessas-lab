# Google Drive API Operations Reference (TypeScript)

Complete reference for Google Drive API v3 operations in TypeScript.

## File Operations

### List Files

```typescript
import { drive_v3 } from 'googleapis';

/**
 * List files in Google Drive.
 *
 * @param service - Drive API service instance
 * @param pageSize - Maximum files per page (max 1000)
 * @param query - Optional search query string
 * @param maxResults - Maximum total results to return (default 100, 0 for unlimited)
 * @returns List of file metadata objects
 */
export async function listFiles(
  service: drive_v3.Drive,
  pageSize: number = 100,
  query?: string,
  maxResults: number = 100
): Promise<drive_v3.Schema$File[]> {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  const effectivePageSize = maxResults > 0 ? Math.min(pageSize, maxResults) : pageSize;

  while (true) {
    const params: drive_v3.Params$Resource$Files$List = {
      pageSize: effectivePageSize,
      fields: 'nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, owners, permissions)',
      supportsAllDrives: true,
    };

    if (query) params.q = query;
    if (pageToken) params.pageToken = pageToken;

    const response = await service.files.list(params);
    files.push(...(response.data.files || []));

    if (maxResults > 0 && files.length >= maxResults) {
      return files.slice(0, maxResults);
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return files;
}
```

### Get File Metadata

```typescript
/**
 * Get complete metadata for a specific file.
 *
 * @param service - Drive API service instance
 * @param fileId - The file's unique identifier
 * @returns Complete file metadata
 */
export async function getFile(
  service: drive_v3.Drive,
  fileId: string
): Promise<drive_v3.Schema$File> {
  const response = await service.files.get({
    fileId,
    fields: '*',
    supportsAllDrives: true,
  });
  return response.data;
}
```

### Create Folder

```typescript
/**
 * Create a folder in Google Drive.
 *
 * @param service - Drive API service instance
 * @param name - Folder name
 * @param parentId - Optional parent folder ID
 * @returns Created folder metadata
 */
export async function createFolder(
  service: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<drive_v3.Schema$File> {
  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const response = await service.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}
```

### Upload File

```typescript
import * as fs from 'fs';
import * as path from 'path';

/**
 * Upload a file to Google Drive.
 *
 * @param service - Drive API service instance
 * @param filePath - Local path to the file
 * @param name - Optional name (defaults to filename)
 * @param parentId - Optional parent folder ID
 * @param mimeType - Optional MIME type
 * @returns Uploaded file metadata
 */
export async function uploadFile(
  service: drive_v3.Drive,
  filePath: string,
  name?: string,
  parentId?: string,
  mimeType?: string
): Promise<drive_v3.Schema$File> {
  const fileName = name ?? path.basename(filePath);

  const fileMetadata: drive_v3.Schema$File = { name: fileName };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath),
  };

  const response = await service.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}
```

### Download File

```typescript
/**
 * Download a binary file from Google Drive.
 *
 * NOTE: This only works for non-Google files (PDFs, images, etc.)
 * For Google Docs/Sheets/Slides, use exportGoogleFile() instead.
 *
 * @param service - Drive API service instance
 * @param fileId - The file's unique identifier
 * @param outputPath - Local path to save the file
 * @returns The output path on success
 */
export async function downloadFile(
  service: drive_v3.Drive,
  fileId: string,
  outputPath: string
): Promise<string> {
  const response = await service.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outputPath);
    (response.data as NodeJS.ReadableStream)
      .pipe(dest)
      .on('finish', () => resolve(outputPath))
      .on('error', reject);
  });
}
```

### Export Google File

```typescript
/**
 * Export a Google Docs/Sheets/Slides file to another format.
 *
 * @param service - Drive API service instance
 * @param fileId - The Google file's unique identifier
 * @param mimeType - Target MIME type for export
 * @param outputPath - Local path to save the exported file
 * @returns The output path on success
 *
 * Export MIME types for Google Docs:
 *   - application/pdf
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *   - text/plain
 *   - text/html
 *
 * Export MIME types for Google Sheets:
 *   - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   - application/pdf
 *   - text/csv
 *
 * Export MIME types for Google Slides:
 *   - application/vnd.openxmlformats-officedocument.presentationml.presentation
 *   - application/pdf
 */
export async function exportGoogleFile(
  service: drive_v3.Drive,
  fileId: string,
  mimeType: string,
  outputPath: string
): Promise<string> {
  const response = await service.files.export(
    { fileId, mimeType },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outputPath);
    (response.data as NodeJS.ReadableStream)
      .pipe(dest)
      .on('finish', () => resolve(outputPath))
      .on('error', reject);
  });
}
```

### Update File Metadata

```typescript
/**
 * Update a file's metadata.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file to update
 * @param newName - Optional new name
 * @param description - Optional description
 * @returns Updated file metadata
 */
export async function updateFileMetadata(
  service: drive_v3.Drive,
  fileId: string,
  newName?: string,
  description?: string
): Promise<drive_v3.Schema$File> {
  const fileMetadata: drive_v3.Schema$File = {};
  if (newName) fileMetadata.name = newName;
  if (description) fileMetadata.description = description;

  const response = await service.files.update({
    fileId,
    requestBody: fileMetadata,
    fields: 'id, name, description',
  });

  return response.data;
}
```

### Delete File

```typescript
/**
 * Delete a file from Google Drive.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file to delete
 * @param permanent - If true, permanently delete; otherwise move to trash
 */
export async function deleteFile(
  service: drive_v3.Drive,
  fileId: string,
  permanent: boolean = false
): Promise<void> {
  if (permanent) {
    await service.files.delete({ fileId });
  } else {
    await service.files.update({
      fileId,
      requestBody: { trashed: true },
    });
  }
}

/**
 * Restore a file from trash.
 */
export async function restoreFromTrash(
  service: drive_v3.Drive,
  fileId: string
): Promise<void> {
  await service.files.update({
    fileId,
    requestBody: { trashed: false },
  });
}
```

## Search Operations

### Custom Search

```typescript
/**
 * Search for files using a query string.
 *
 * @param service - Drive API service instance
 * @param query - Search query string
 * @param maxResults - Maximum total results to return (default: 100)
 * @returns List of matching files
 */
export async function searchFiles(
  service: drive_v3.Drive,
  query: string,
  maxResults: number = 100
): Promise<drive_v3.Schema$File[]> {
  return listFiles(service, maxResults, query, maxResults);
}
```

### Find by Name

```typescript
/**
 * Find files by name.
 *
 * @param service - Drive API service instance
 * @param name - Name to search for
 * @param exact - If true, exact match; if false, contains match
 * @returns List of matching files
 */
export async function findByName(
  service: drive_v3.Drive,
  name: string,
  exact: boolean = false
): Promise<drive_v3.Schema$File[]> {
  const query = exact
    ? `name = '${name}' and trashed = false`
    : `name contains '${name}' and trashed = false`;
  return searchFiles(service, query);
}
```

### Find by Type

```typescript
/**
 * Find Google Docs containing a specific name.
 */
export async function findDocsByName(
  service: drive_v3.Drive,
  nameContains?: string
): Promise<drive_v3.Schema$File[]> {
  let query = "mimeType = 'application/vnd.google-apps.document' and trashed = false";
  if (nameContains) {
    query = `name contains '${nameContains}' and ${query}`;
  }
  return searchFiles(service, query);
}

/**
 * Find Google Sheets containing a specific name.
 */
export async function findSheetsByName(
  service: drive_v3.Drive,
  nameContains?: string
): Promise<drive_v3.Schema$File[]> {
  let query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  if (nameContains) {
    query = `name contains '${nameContains}' and ${query}`;
  }
  return searchFiles(service, query);
}

/**
 * Find Google Slides containing a specific name.
 */
export async function findSlidesByName(
  service: drive_v3.Drive,
  nameContains?: string
): Promise<drive_v3.Schema$File[]> {
  let query = "mimeType = 'application/vnd.google-apps.presentation' and trashed = false";
  if (nameContains) {
    query = `name contains '${nameContains}' and ${query}`;
  }
  return searchFiles(service, query);
}

/**
 * Find all folders.
 */
export async function findAllFolders(
  service: drive_v3.Drive,
  nameContains?: string
): Promise<drive_v3.Schema$File[]> {
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (nameContains) {
    query = `name contains '${nameContains}' and ${query}`;
  }
  return searchFiles(service, query);
}
```

### Find in Folder

```typescript
/**
 * Find all files in a specific folder.
 */
export async function findFilesInFolder(
  service: drive_v3.Drive,
  folderId: string
): Promise<drive_v3.Schema$File[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  return searchFiles(service, query);
}
```

### Find Shared Files

```typescript
/**
 * Find files shared with the current user.
 */
export async function findSharedWithMe(
  service: drive_v3.Drive
): Promise<drive_v3.Schema$File[]> {
  const query = "sharedWithMe = true and trashed = false";
  return searchFiles(service, query);
}
```

### Find Recent Files

```typescript
/**
 * Find files modified in the last N days.
 */
export async function findRecentFiles(
  service: drive_v3.Drive,
  days: number = 7
): Promise<drive_v3.Schema$File[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const query = `modifiedTime > '${cutoff}' and trashed = false`;
  return searchFiles(service, query);
}
```

### Full Text Search

```typescript
/**
 * Search file contents for specific text.
 */
export async function fullTextSearch(
  service: drive_v3.Drive,
  searchText: string
): Promise<drive_v3.Schema$File[]> {
  const query = `fullText contains '${searchText}' and trashed = false`;
  return searchFiles(service, query);
}
```

### Find by Owner

```typescript
/**
 * Find files owned by a specific user.
 */
export async function findFilesByOwner(
  service: drive_v3.Drive,
  ownerEmail: string
): Promise<drive_v3.Schema$File[]> {
  const query = `'${ownerEmail}' in owners and trashed = false`;
  return searchFiles(service, query);
}
```

## Organization Operations

### Move File

```typescript
/**
 * Move a file to a different folder.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file to move
 * @param newParentId - ID of the destination folder
 * @param removeFromCurrent - If true, remove from current parent(s)
 * @returns Updated file metadata
 */
export async function moveFile(
  service: drive_v3.Drive,
  fileId: string,
  newParentId: string,
  removeFromCurrent: boolean = true
): Promise<drive_v3.Schema$File> {
  const file = await service.files.get({
    fileId,
    fields: 'parents',
  });

  const previousParents = (file.data.parents || []).join(',');

  const response = await service.files.update({
    fileId,
    addParents: newParentId,
    removeParents: removeFromCurrent ? previousParents : undefined,
    fields: 'id, name, parents',
  });

  return response.data;
}
```

### Copy File

```typescript
/**
 * Copy a file.
 *
 * @param service - Drive API service instance
 * @param fileId - ID of the file to copy
 * @param newName - Optional new name for the copy
 * @param destinationFolderId - Optional destination folder
 * @returns Copied file metadata
 */
export async function copyFile(
  service: drive_v3.Drive,
  fileId: string,
  newName?: string,
  destinationFolderId?: string
): Promise<drive_v3.Schema$File> {
  const copyMetadata: drive_v3.Schema$File = {};
  if (newName) copyMetadata.name = newName;
  if (destinationFolderId) copyMetadata.parents = [destinationFolderId];

  const response = await service.files.copy({
    fileId,
    requestBody: copyMetadata,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}
```

### Create Folder Path

```typescript
/**
 * Create a folder path, creating intermediate folders as needed.
 *
 * @param service - Drive API service instance
 * @param folderPath - Folder path like 'Projects/2024/Q1'
 * @param rootId - Optional root folder ID
 * @returns ID of the final folder in the path
 */
export async function createFolderPath(
  service: drive_v3.Drive,
  folderPath: string,
  rootId?: string
): Promise<string> {
  const folders = folderPath.replace(/^\/|\/$/g, '').split('/');
  let parentId = rootId;

  for (const folderName of folders) {
    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const results = await searchFiles(service, query, 1);

    if (results.length > 0) {
      parentId = results[0].id!;
    } else {
      const newFolder = await createFolder(service, folderName, parentId);
      parentId = newFolder.id!;
    }
  }

  return parentId!;
}
```

### Get Folder Contents

```typescript
/**
 * Get all contents of a folder.
 *
 * @param service - Drive API service instance
 * @param folderId - ID of the folder
 * @param includeSubfolders - If true, recursively get subfolder contents
 * @returns List of files and folders
 */
export async function getFolderContents(
  service: drive_v3.Drive,
  folderId: string,
  includeSubfolders: boolean = false
): Promise<drive_v3.Schema$File[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const contents = await searchFiles(service, query);

  if (includeSubfolders) {
    const folders = contents.filter(
      f => f.mimeType === 'application/vnd.google-apps.folder'
    );
    for (const folder of folders) {
      if (folder.id) {
        const subfolderContents = await getFolderContents(service, folder.id, true);
        contents.push(...subfolderContents);
      }
    }
  }

  return contents;
}
```

### Get Folder Tree

```typescript
export interface FolderTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  children?: FolderTreeNode[];
}

/**
 * Get a hierarchical view of folder structure.
 *
 * @param service - Drive API service instance
 * @param folderId - ID of the root folder
 * @param depth - Current depth (for recursion)
 * @param maxDepth - Maximum recursion depth
 * @returns Folder tree structure
 */
export async function getFolderTree(
  service: drive_v3.Drive,
  folderId: string,
  depth: number = 0,
  maxDepth: number = 10
): Promise<FolderTreeNode | null> {
  if (depth > maxDepth) return null;

  const folderInfo = await service.files.get({
    fileId: folderId,
    fields: 'id, name',
  });

  const query = `'${folderId}' in parents and trashed = false`;
  const contents = await searchFiles(service, query);

  const tree: FolderTreeNode = {
    id: folderInfo.data.id!,
    name: folderInfo.data.name!,
    type: 'folder',
    children: [],
  };

  for (const item of contents) {
    if (item.mimeType === 'application/vnd.google-apps.folder' && item.id) {
      const subtree = await getFolderTree(service, item.id, depth + 1, maxDepth);
      if (subtree) tree.children!.push(subtree);
    } else {
      tree.children!.push({
        id: item.id!,
        name: item.name!,
        type: 'file',
        mimeType: item.mimeType ?? undefined,
      });
    }
  }

  return tree;
}
```

## Query Syntax Reference

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `name = 'Report.pdf'` |
| `!=` | Not equals | `mimeType != 'application/vnd.google-apps.folder'` |
| `contains` | Contains (prefix match for name) | `name contains 'Budget'` |
| `in` | Value in collection | `'user@example.com' in owners` |
| `and` | Logical AND | `name contains 'Q1' and mimeType = 'application/pdf'` |
| `or` | Logical OR | `name contains 'report' or name contains 'summary'` |
| `not` | Logical NOT | `not name contains 'draft'` |

### Query Fields

| Field | Description | Example |
|-------|-------------|---------|
| `name` | File name | `name = 'MyDocument'` |
| `fullText` | Full text content search | `fullText contains 'quarterly sales'` |
| `mimeType` | File MIME type | `mimeType = 'application/vnd.google-apps.document'` |
| `trashed` | In trash | `trashed = false` |
| `starred` | Starred files | `starred = true` |
| `parents` | Parent folder ID | `'folder_id' in parents` |
| `owners` | File owner | `'user@example.com' in owners` |
| `writers` | Users with write access | `'user@example.com' in writers` |
| `readers` | Users with read access | `'user@example.com' in readers` |
| `sharedWithMe` | Shared with current user | `sharedWithMe = true` |
| `createdTime` | Creation timestamp | `createdTime > '2024-01-01T00:00:00'` |
| `modifiedTime` | Last modified timestamp | `modifiedTime > '2024-06-01T00:00:00'` |

### Example Queries

```typescript
// Find PDFs modified this year
"mimeType = 'application/pdf' and modifiedTime > '2024-01-01' and trashed = false"

// Find documents owned by specific user
"'user@example.com' in owners and mimeType = 'application/vnd.google-apps.document'"

// Find files in a specific folder that contain 'report'
"'folder_id' in parents and name contains 'report' and trashed = false"

// Find starred spreadsheets
"starred = true and mimeType = 'application/vnd.google-apps.spreadsheet'"
```

## MIME Types Reference

| File Type | MIME Type |
|-----------|-----------|
| Google Doc | `application/vnd.google-apps.document` |
| Google Sheet | `application/vnd.google-apps.spreadsheet` |
| Google Slides | `application/vnd.google-apps.presentation` |
| Folder | `application/vnd.google-apps.folder` |
| PDF | `application/pdf` |
| Plain Text | `text/plain` |
| Microsoft Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Microsoft Excel | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| Microsoft PowerPoint | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
