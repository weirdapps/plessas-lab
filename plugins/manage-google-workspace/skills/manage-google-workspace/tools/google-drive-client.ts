/**
 * Google Drive Client Library
 *
 * Shared TypeScript library for Google Drive, Docs, Sheets, and Slides operations.
 * Follows the nano-banana-images pattern for CLI tools.
 */

import { google, drive_v3, docs_v1, sheets_v4, slides_v1 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { URL } from 'node:url';

// ==================== CONSTANTS ====================

const CREDENTIALS_DIR = path.join(process.env.HOME || '', '.google-skills', 'drive');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'DriveSkill-Credentials.json');
const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
];

// ==================== INTERFACES ====================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  owners?: DriveOwner[];
  size?: string;
  webViewLink?: string;
  description?: string;
  trashed?: boolean;
}

export interface DriveOwner {
  displayName?: string;
  emailAddress?: string;
  kind?: string;
  me?: boolean;
  permissionId?: string;
  photoLink?: string;
}

export interface ListFilesOptions {
  query?: string;
  pageSize?: number;
  orderBy?: string;
}

export interface UploadOptions {
  name?: string;
  parentId?: string;
  mimeType?: string;
}

export type PermissionRole = 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
export type PermissionType = 'user' | 'group' | 'domain' | 'anyone';

export interface DrivePermission {
  id: string;
  type: PermissionType;
  role: PermissionRole;
  emailAddress?: string;
  domain?: string;
  displayName?: string;
  deleted?: boolean;
}

export interface ShareOptions {
  notify?: boolean;
  message?: string;
}

export interface SharingSummary {
  owner: string | null;
  writers: string[];
  commenters: string[];
  readers: string[];
  anyoneWithLink: boolean;
  domainShared: string[];
}

export interface PermissionDetails {
  id: string;
  type: PermissionType;
  role: PermissionRole;
  emailAddress?: string;
  domain?: string;
  displayName?: string;
  photoLink?: string;
  expirationTime?: string;
  permissionDetails?: {
    permissionType: string;
    role: string;
    inheritedFrom?: string;
    inherited: boolean;
  }[];
  deleted?: boolean;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  mimeType: string;
  children?: FolderTreeNode[];
}

export interface FolderContentsResult {
  folderId: string;
  folderName: string;
  files: DriveFile[];
  subfolders: FolderContentsResult[];
  totalFiles: number;
  totalFolders: number;
}

export interface OrganizeResult {
  moved: { fileId: string; fileName: string; toFolder: string }[];
  created: { folderId: string; folderName: string }[];
  errors: { fileId: string; error: string }[];
}

export interface GoogleDocument {
  documentId: string;
  title: string;
  body?: docs_v1.Schema$Body;
  revisionId?: string;
}

export interface DocumentStructure {
  headings: { level: number; text: string; startIndex: number }[];
  paragraphCount: number;
  tableCount: number;
  listCount: number;
  imageCount: number;
  characterCount: number;
}

export interface TextSearchResult {
  text: string;
  startIndex: number;
  endIndex: number;
  context: string;
}

export type HeadingLevel = 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'HEADING_5' | 'HEADING_6';

export interface Spreadsheet {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  properties?: sheets_v4.Schema$SpreadsheetProperties;
  sheets?: sheets_v4.Schema$Sheet[];
}

export type CellValue = string | number | boolean | null;
export type RowValues = CellValue[];
export type SheetValues = RowValues[];

export interface UpdateValuesResult {
  updatedRange?: string;
  updatedRows?: number;
  updatedColumns?: number;
  updatedCells?: number;
}

export interface CellMatch {
  cell: string;
  row: number;
  column: number;
  value: CellValue;
}

export interface SheetSummary {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetSummary {
  title: string | null;
  spreadsheetId: string;
  url: string | null;
  sheets: SheetSummary[];
}

export interface Presentation {
  presentationId: string;
  title?: string;
  slides?: slides_v1.Schema$Page[];
  pageSize?: slides_v1.Schema$Size;
}

export interface SlideTextMap {
  [slideNumber: number]: string;
}

export interface PresentationSummary {
  presentationId: string;
  title: string | null;
  slideCount: number;
  slides: {
    slideNumber: number;
    objectId: string;
    text: string;
  }[];
}

export type PredefinedLayout =
  | 'BLANK'
  | 'CAPTION_ONLY'
  | 'TITLE'
  | 'TITLE_AND_BODY'
  | 'TITLE_AND_TWO_COLUMNS'
  | 'TITLE_ONLY'
  | 'SECTION_HEADER'
  | 'SECTION_TITLE_AND_DESCRIPTION'
  | 'ONE_COLUMN_TEXT'
  | 'MAIN_POINT'
  | 'BIG_NUMBER';

export interface TextBoxOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ImageOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== AUTHENTICATION ====================

/**
 * Get credential paths - throws if credentials file doesn't exist
 */
function getCredentialPaths(): { credentialsPath: string; tokenPath: string } {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Credentials file not found at ${CREDENTIALS_PATH}. ` +
      `Download OAuth credentials from Google Cloud Console and place at the expected location.`
    );
  }
  return {
    credentialsPath: CREDENTIALS_PATH,
    tokenPath: TOKEN_PATH,
  };
}

/**
 * Load stored token from file
 */
function loadToken(): Credentials | null {
  const { tokenPath } = getCredentialPaths();
  if (fs.existsSync(tokenPath)) {
    const tokenContent = fs.readFileSync(tokenPath, 'utf-8');
    return JSON.parse(tokenContent);
  }
  return null;
}

/**
 * Save token to file
 */
function saveToken(tokens: Credentials): void {
  const { tokenPath } = getCredentialPaths();
  // Ensure directory exists
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
}

/**
 * Get authorization code via local server callback
 */
async function getAuthCodeViaServer(authUrl: string): Promise<string> {
  // Dynamically import 'open' package
  const open = (await import('open')).default;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://localhost`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Authorization Error</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`Authorization error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authorization Successful</title></head>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1>Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          server.close();
          resolve(code);
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    // Listen on port 8080 (must be registered in Google Cloud Console)
    const fixedPort = 8080;
    server.listen(fixedPort, 'localhost', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = fixedPort;
        const redirectUri = `http://localhost:${port}`;

        // Update the auth URL with the correct redirect URI
        const url = new URL(authUrl);
        url.searchParams.set('redirect_uri', redirectUri);

        console.log('[INFO] Opening browser for authorization...');
        console.log(`[INFO] If browser doesn't open, visit: ${url.toString()}`);

        open(url.toString()).catch(() => {
          console.log('[WARN] Could not open browser automatically.');
        });
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout - no response received within 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Create OAuth2 client and authenticate
 */
export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const { credentialsPath } = getCredentialPaths();

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:8080' // Must match Google Cloud Console redirect URI
  );

  // Try to load existing token
  const storedToken = loadToken();

  if (storedToken) {
    oauth2Client.setCredentials(storedToken);

    // Check if token needs refresh
    if (storedToken.expiry_date && storedToken.expiry_date < Date.now()) {
      if (storedToken.refresh_token) {
        console.log('[INFO] Refreshing expired token...');
        const { credentials: newTokens } = await oauth2Client.refreshAccessToken();
        // Preserve refresh_token if not returned
        if (!newTokens.refresh_token && storedToken.refresh_token) {
          newTokens.refresh_token = storedToken.refresh_token;
        }
        saveToken(newTokens);
        oauth2Client.setCredentials(newTokens);
        console.log('[OK] Token refreshed successfully');
      }
    }

    return oauth2Client;
  }

  // No token - need to authenticate
  console.log('[INFO] No existing token found. Starting authentication...');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });

  const code = await getAuthCodeViaServer(authUrl);

  // Update redirect URI for token exchange
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: oauth2Client.redirectUri,
  });

  saveToken(tokens);
  oauth2Client.setCredentials(tokens);
  console.log('[OK] Authentication successful');

  return oauth2Client;
}

/**
 * Get Drive API v3 service
 */
export async function getDriveService(): Promise<drive_v3.Drive> {
  const auth = await getAuthenticatedClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Get Docs API v1 service
 */
export async function getDocsService(): Promise<docs_v1.Docs> {
  const auth = await getAuthenticatedClient();
  return google.docs({ version: 'v1', auth });
}

/**
 * Get Sheets API v4 service
 */
export async function getSheetsService(): Promise<sheets_v4.Sheets> {
  const auth = await getAuthenticatedClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Get Slides API v1 service
 */
export async function getSlidesService(): Promise<slides_v1.Slides> {
  const auth = await getAuthenticatedClient();
  return google.slides({ version: 'v1', auth });
}

// ==================== DRIVE CLIENT ====================

export class DriveClient {
  private service: drive_v3.Drive | null = null;

  private async getService(): Promise<drive_v3.Drive> {
    if (!this.service) {
      this.service = await getDriveService();
    }
    return this.service;
  }

  // ==================== FILE OPERATIONS ====================

  async listFiles(options: ListFilesOptions = {}): Promise<DriveFile[]> {
    const service = await this.getService();
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    const pageSize = options.pageSize || 100;

    do {
      const params: drive_v3.Params$Resource$Files$List = {
        pageSize: Math.min(pageSize, 1000),
        fields: 'nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, owners, size, webViewLink, description, trashed)',
        orderBy: options.orderBy || 'modifiedTime desc',
        supportsAllDrives: true,
        pageToken,
      };

      if (options.query) {
        params.q = options.query;
      }

      const response = await service.files.list(params);

      if (response.data.files) {
        files.push(...response.data.files.map(f => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType!,
          parents: f.parents || undefined,
          createdTime: f.createdTime || undefined,
          modifiedTime: f.modifiedTime || undefined,
          owners: f.owners?.map(o => ({
            displayName: o.displayName || undefined,
            emailAddress: o.emailAddress || undefined,
            kind: o.kind || undefined,
            me: o.me || undefined,
            permissionId: o.permissionId || undefined,
            photoLink: o.photoLink || undefined,
          })),
          size: f.size || undefined,
          webViewLink: f.webViewLink || undefined,
          description: f.description || undefined,
          trashed: f.trashed || undefined,
        })));
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken && files.length < pageSize);

    return files.slice(0, pageSize);
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const service = await this.getService();
    const response = await service.files.get({
      fileId,
      fields: '*',
      supportsAllDrives: true,
    });

    const f = response.data;
    return {
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      parents: f.parents || undefined,
      createdTime: f.createdTime || undefined,
      modifiedTime: f.modifiedTime || undefined,
      owners: f.owners?.map(o => ({
        displayName: o.displayName || undefined,
        emailAddress: o.emailAddress || undefined,
      })),
      size: f.size || undefined,
      webViewLink: f.webViewLink || undefined,
      description: f.description || undefined,
      trashed: f.trashed || undefined,
    };
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFile> {
    const service = await this.getService();

    const metadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await service.files.create({
      requestBody: metadata,
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: response.data.webViewLink || undefined,
    };
  }

  async uploadFile(filePath: string, options: UploadOptions = {}): Promise<DriveFile> {
    const service = await this.getService();

    const fileName = options.name || path.basename(filePath);
    const metadata: drive_v3.Schema$File = { name: fileName };

    if (options.parentId) {
      metadata.parents = [options.parentId];
    }

    const media = {
      mimeType: options.mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await service.files.create({
      requestBody: metadata,
      media,
      fields: 'id, name, webViewLink, mimeType',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      webViewLink: response.data.webViewLink || undefined,
    };
  }

  async downloadFile(fileId: string, outputPath: string): Promise<string> {
    const service = await this.getService();

    const dest = fs.createWriteStream(outputPath);
    const response = await service.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      (response.data as NodeJS.ReadableStream)
        .pipe(dest)
        .on('finish', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  async exportGoogleFile(fileId: string, mimeType: string, outputPath: string): Promise<string> {
    const service = await this.getService();

    const dest = fs.createWriteStream(outputPath);
    const response = await service.files.export(
      { fileId, mimeType },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      (response.data as NodeJS.ReadableStream)
        .pipe(dest)
        .on('finish', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  async updateFile(fileId: string, updates: { name?: string; description?: string }): Promise<DriveFile> {
    const service = await this.getService();

    const response = await service.files.update({
      fileId,
      requestBody: updates,
      fields: 'id, name, description',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: '',
      description: response.data.description || undefined,
    };
  }

  async deleteFile(fileId: string, permanent = false): Promise<void> {
    const service = await this.getService();

    if (permanent) {
      await service.files.delete({ fileId });
    } else {
      await service.files.update({
        fileId,
        requestBody: { trashed: true },
      });
    }
  }

  async restoreFile(fileId: string): Promise<void> {
    const service = await this.getService();
    await service.files.update({
      fileId,
      requestBody: { trashed: false },
    });
  }

  // ==================== SEARCH OPERATIONS ====================

  async search(query: string): Promise<DriveFile[]> {
    return this.listFiles({ query });
  }

  async findByName(name: string, exact = false): Promise<DriveFile[]> {
    const query = exact
      ? `name = '${name}' and trashed = false`
      : `name contains '${name}' and trashed = false`;
    return this.search(query);
  }

  async findDocs(nameContains?: string): Promise<DriveFile[]> {
    let query = "mimeType = 'application/vnd.google-apps.document' and trashed = false";
    if (nameContains) {
      query = `name contains '${nameContains}' and ${query}`;
    }
    return this.search(query);
  }

  async findSheets(nameContains?: string): Promise<DriveFile[]> {
    let query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
    if (nameContains) {
      query = `name contains '${nameContains}' and ${query}`;
    }
    return this.search(query);
  }

  async findSlides(nameContains?: string): Promise<DriveFile[]> {
    let query = "mimeType = 'application/vnd.google-apps.presentation' and trashed = false";
    if (nameContains) {
      query = `name contains '${nameContains}' and ${query}`;
    }
    return this.search(query);
  }

  async findFolders(nameContains?: string): Promise<DriveFile[]> {
    let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    if (nameContains) {
      query = `name contains '${nameContains}' and ${query}`;
    }
    return this.search(query);
  }

  async findInFolder(folderId: string): Promise<DriveFile[]> {
    return this.search(`'${folderId}' in parents and trashed = false`);
  }

  async findSharedWithMe(): Promise<DriveFile[]> {
    return this.search('sharedWithMe = true and trashed = false');
  }

  async findRecent(days = 7): Promise<DriveFile[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return this.search(`modifiedTime > '${cutoff}' and trashed = false`);
  }

  async fullTextSearch(text: string): Promise<DriveFile[]> {
    return this.search(`fullText contains '${text}' and trashed = false`);
  }

  // ==================== ORGANIZATION OPERATIONS ====================

  async moveFile(fileId: string, newParentId: string): Promise<DriveFile> {
    const service = await this.getService();

    // Get current parents
    const file = await service.files.get({
      fileId,
      fields: 'parents',
    });

    const previousParents = (file.data.parents || []).join(',');

    const response = await service.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields: 'id, name, parents',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: '',
      parents: response.data.parents || undefined,
    };
  }

  async copyFile(fileId: string, newName?: string, destinationFolderId?: string): Promise<DriveFile> {
    const service = await this.getService();

    const metadata: drive_v3.Schema$File = {};
    if (newName) metadata.name = newName;
    if (destinationFolderId) metadata.parents = [destinationFolderId];

    const response = await service.files.copy({
      fileId,
      requestBody: metadata,
      fields: 'id, name, webViewLink, mimeType',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      webViewLink: response.data.webViewLink || undefined,
    };
  }

  async createFolderPath(folderPath: string, rootId?: string): Promise<string> {
    const folders = folderPath.replace(/^\/+|\/+$/g, '').split('/');
    let parentId = rootId;

    for (const folderName of folders) {
      let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      const results = await this.search(query);

      if (results.length > 0) {
        parentId = results[0].id;
      } else {
        const newFolder = await this.createFolder(folderName, parentId);
        parentId = newFolder.id;
      }
    }

    return parentId!;
  }

  // ==================== PERMISSION OPERATIONS ====================

  async listPermissions(fileId: string): Promise<DrivePermission[]> {
    const service = await this.getService();

    const response = await service.permissions.list({
      fileId,
      fields: 'permissions(id, type, role, emailAddress, domain, displayName, deleted)',
    });

    return (response.data.permissions || []).map(p => ({
      id: p.id!,
      type: p.type as PermissionType,
      role: p.role as PermissionRole,
      emailAddress: p.emailAddress || undefined,
      domain: p.domain || undefined,
      displayName: p.displayName || undefined,
      deleted: p.deleted || undefined,
    }));
  }

  async shareWithUser(
    fileId: string,
    email: string,
    role: PermissionRole = 'reader',
    options: ShareOptions = {}
  ): Promise<DrivePermission> {
    const service = await this.getService();

    const response = await service.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email,
      },
      sendNotificationEmail: options.notify ?? true,
      emailMessage: options.message,
      fields: 'id, type, role, emailAddress',
    });

    return {
      id: response.data.id!,
      type: 'user',
      role: response.data.role as PermissionRole,
      emailAddress: response.data.emailAddress || undefined,
    };
  }

  async shareWithGroup(
    fileId: string,
    groupEmail: string,
    role: PermissionRole = 'reader'
  ): Promise<DrivePermission> {
    const service = await this.getService();

    const response = await service.permissions.create({
      fileId,
      requestBody: {
        type: 'group',
        role,
        emailAddress: groupEmail,
      },
      fields: 'id, type, role, emailAddress',
    });

    return {
      id: response.data.id!,
      type: 'group',
      role: response.data.role as PermissionRole,
      emailAddress: response.data.emailAddress || undefined,
    };
  }

  async shareWithDomain(
    fileId: string,
    domain: string,
    role: PermissionRole = 'reader'
  ): Promise<DrivePermission> {
    const service = await this.getService();

    const response = await service.permissions.create({
      fileId,
      requestBody: {
        type: 'domain',
        role,
        domain,
      },
      fields: 'id, type, role, domain',
    });

    return {
      id: response.data.id!,
      type: 'domain',
      role: response.data.role as PermissionRole,
      domain: response.data.domain || undefined,
    };
  }

  async shareWithAnyone(
    fileId: string,
    role: PermissionRole = 'reader'
  ): Promise<DrivePermission> {
    const service = await this.getService();

    const response = await service.permissions.create({
      fileId,
      requestBody: {
        type: 'anyone',
        role,
      },
      fields: 'id, type, role',
    });

    return {
      id: response.data.id!,
      type: 'anyone',
      role: response.data.role as PermissionRole,
    };
  }

  async updatePermission(
    fileId: string,
    permissionId: string,
    newRole: PermissionRole
  ): Promise<DrivePermission> {
    const service = await this.getService();

    const response = await service.permissions.update({
      fileId,
      permissionId,
      requestBody: { role: newRole },
      fields: 'id, type, role, emailAddress',
    });

    return {
      id: response.data.id!,
      type: response.data.type as PermissionType,
      role: response.data.role as PermissionRole,
      emailAddress: response.data.emailAddress || undefined,
    };
  }

  async removePermission(fileId: string, permissionId: string): Promise<void> {
    const service = await this.getService();
    await service.permissions.delete({ fileId, permissionId });
  }

  async removeAccessByEmail(fileId: string, email: string): Promise<boolean> {
    const permissions = await this.listPermissions(fileId);

    for (const perm of permissions) {
      if (perm.emailAddress?.toLowerCase() === email.toLowerCase()) {
        await this.removePermission(fileId, perm.id);
        return true;
      }
    }

    return false;
  }

  async getSharingSummary(fileId: string): Promise<SharingSummary> {
    const permissions = await this.listPermissions(fileId);

    const summary: SharingSummary = {
      owner: null,
      writers: [],
      commenters: [],
      readers: [],
      anyoneWithLink: false,
      domainShared: [],
    };

    for (const perm of permissions) {
      if (perm.role === 'owner') {
        summary.owner = perm.emailAddress || null;
      } else if (perm.role === 'writer') {
        if (perm.type === 'user') {
          summary.writers.push(perm.emailAddress!);
        } else if (perm.type === 'group') {
          summary.writers.push(`group:${perm.emailAddress}`);
        }
      } else if (perm.role === 'commenter') {
        summary.commenters.push(perm.emailAddress!);
      } else if (perm.role === 'reader') {
        if (perm.type === 'anyone') {
          summary.anyoneWithLink = true;
        } else if (perm.type === 'domain') {
          summary.domainShared.push(perm.domain!);
        } else if (perm.type === 'user') {
          summary.readers.push(perm.emailAddress!);
        }
      }
    }

    return summary;
  }

  // ==================== NEW DRIVE OPERATIONS ====================

  /**
   * Transfer ownership of a file to another user.
   * Note: The new owner must be in the same domain or have a Google account.
   */
  async transferOwnership(fileId: string, newOwnerEmail: string): Promise<DrivePermission> {
    const service = await this.getService();

    const response = await service.permissions.create({
      fileId,
      transferOwnership: true,
      requestBody: {
        type: 'user',
        role: 'owner',
        emailAddress: newOwnerEmail,
      },
      fields: 'id, type, role, emailAddress',
    });

    return {
      id: response.data.id!,
      type: 'user',
      role: 'owner',
      emailAddress: response.data.emailAddress || undefined,
    };
  }

  /**
   * Get detailed permission information for a file.
   */
  async getPermissionDetails(fileId: string, permissionId: string): Promise<PermissionDetails> {
    const service = await this.getService();

    const response = await service.permissions.get({
      fileId,
      permissionId,
      fields: 'id, type, role, emailAddress, domain, displayName, photoLink, expirationTime, permissionDetails, deleted',
    });

    return {
      id: response.data.id!,
      type: response.data.type as PermissionType,
      role: response.data.role as PermissionRole,
      emailAddress: response.data.emailAddress || undefined,
      domain: response.data.domain || undefined,
      displayName: response.data.displayName || undefined,
      photoLink: response.data.photoLink || undefined,
      expirationTime: response.data.expirationTime || undefined,
      permissionDetails: response.data.permissionDetails?.map(pd => ({
        permissionType: pd.permissionType || '',
        role: pd.role || '',
        inheritedFrom: pd.inheritedFrom || undefined,
        inherited: pd.inherited || false,
      })),
      deleted: response.data.deleted || undefined,
    };
  }

  /**
   * Find files by owner email.
   */
  async findFilesByOwner(ownerEmail: string): Promise<DriveFile[]> {
    const query = `'${ownerEmail}' in owners and trashed = false`;
    return this.search(query);
  }

  /**
   * Get hierarchical folder tree starting from a folder.
   * @param folderId - The folder ID to start from (use 'root' for My Drive root)
   * @param maxDepth - Maximum depth to traverse (default: 3)
   */
  async getFolderTree(folderId: string = 'root', maxDepth: number = 3): Promise<FolderTreeNode> {
    const service = await this.getService();

    // Get folder info
    const folderResponse = await service.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
    });

    const rootNode: FolderTreeNode = {
      id: folderResponse.data.id!,
      name: folderId === 'root' ? 'My Drive' : folderResponse.data.name!,
      mimeType: folderResponse.data.mimeType!,
      children: [],
    };

    if (maxDepth > 0) {
      rootNode.children = await this.getFolderChildrenRecursive(folderId, maxDepth - 1);
    }

    return rootNode;
  }

  private async getFolderChildrenRecursive(folderId: string, remainingDepth: number): Promise<FolderTreeNode[]> {
    const children = await this.findInFolder(folderId);
    const result: FolderTreeNode[] = [];

    for (const child of children) {
      const node: FolderTreeNode = {
        id: child.id,
        name: child.name,
        mimeType: child.mimeType,
      };

      // Only recurse into folders
      if (child.mimeType === 'application/vnd.google-apps.folder' && remainingDepth > 0) {
        node.children = await this.getFolderChildrenRecursive(child.id, remainingDepth - 1);
      }

      result.push(node);
    }

    return result;
  }

  /**
   * Get folder contents recursively, including all files and subfolders.
   * @param folderId - The folder ID to start from
   * @param maxDepth - Maximum depth to traverse (default: 10)
   */
  async getFolderContents(folderId: string, maxDepth: number = 10): Promise<FolderContentsResult> {
    const service = await this.getService();

    // Get folder info
    const folderResponse = await service.files.get({
      fileId: folderId,
      fields: 'id, name',
    });

    const result: FolderContentsResult = {
      folderId: folderResponse.data.id!,
      folderName: folderResponse.data.name!,
      files: [],
      subfolders: [],
      totalFiles: 0,
      totalFolders: 0,
    };

    const children = await this.findInFolder(folderId);

    for (const child of children) {
      if (child.mimeType === 'application/vnd.google-apps.folder') {
        result.totalFolders++;

        if (maxDepth > 0) {
          const subfolderContents = await this.getFolderContents(child.id, maxDepth - 1);
          result.subfolders.push(subfolderContents);
          result.totalFiles += subfolderContents.totalFiles;
          result.totalFolders += subfolderContents.totalFolders;
        }
      } else {
        result.files.push(child);
        result.totalFiles++;
      }
    }

    return result;
  }

  /**
   * Create a shortcut to a file in a folder.
   * This allows a file to appear in multiple folders without copying.
   */
  async addToFolder(fileId: string, folderId: string): Promise<DriveFile> {
    const service = await this.getService();

    // Get the original file info
    const originalFile = await service.files.get({
      fileId,
      fields: 'name, mimeType',
    });

    // Create a shortcut
    const response = await service.files.create({
      requestBody: {
        name: originalFile.data.name,
        mimeType: 'application/vnd.google-apps.shortcut',
        shortcutDetails: {
          targetId: fileId,
        },
        parents: [folderId],
      },
      fields: 'id, name, webViewLink, mimeType, shortcutDetails',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      webViewLink: response.data.webViewLink || undefined,
    };
  }

  /**
   * Organize files in a folder by their MIME type.
   * Creates subfolders for each type and moves files into them.
   * @param folderId - The folder to organize
   * @param createSubfolders - Whether to create subfolders (default: true)
   */
  async organizeFilesByType(folderId: string, createSubfolders: boolean = true): Promise<OrganizeResult> {
    const result: OrganizeResult = {
      moved: [],
      created: [],
      errors: [],
    };

    const files = await this.findInFolder(folderId);

    // Group files by type category
    const typeCategories: Record<string, string> = {
      'application/vnd.google-apps.document': 'Documents',
      'application/vnd.google-apps.spreadsheet': 'Spreadsheets',
      'application/vnd.google-apps.presentation': 'Presentations',
      'application/vnd.google-apps.folder': '', // Skip folders
      'application/vnd.google-apps.shortcut': '', // Skip shortcuts
      'application/pdf': 'PDFs',
      'image/': 'Images',
      'video/': 'Videos',
      'audio/': 'Audio',
      'text/': 'Text Files',
      'application/zip': 'Archives',
      'application/x-zip': 'Archives',
      'application/x-rar': 'Archives',
      'application/x-7z-compressed': 'Archives',
    };

    const filesByCategory: Record<string, DriveFile[]> = {};

    for (const file of files) {
      // Skip folders and shortcuts
      if (file.mimeType === 'application/vnd.google-apps.folder' ||
          file.mimeType === 'application/vnd.google-apps.shortcut') {
        continue;
      }

      // Determine category
      let category = 'Other';
      for (const [mimePrefix, categoryName] of Object.entries(typeCategories)) {
        if (categoryName && file.mimeType.startsWith(mimePrefix)) {
          category = categoryName;
          break;
        }
      }

      if (!filesByCategory[category]) {
        filesByCategory[category] = [];
      }
      filesByCategory[category].push(file);
    }

    // Create folders and move files
    const createdFolders: Record<string, string> = {};

    for (const [category, categoryFiles] of Object.entries(filesByCategory)) {
      if (categoryFiles.length === 0) continue;

      let targetFolderId = folderId;

      if (createSubfolders && category !== 'Other') {
        // Check if folder already exists
        const existingFolders = await this.search(
          `name = '${category}' and mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents and trashed = false`
        );

        if (existingFolders.length > 0) {
          targetFolderId = existingFolders[0].id;
        } else {
          // Create the category folder
          const newFolder = await this.createFolder(category, folderId);
          targetFolderId = newFolder.id;
          createdFolders[category] = newFolder.id;
          result.created.push({ folderId: newFolder.id, folderName: category });
        }
      }

      // Move files to the target folder
      for (const file of categoryFiles) {
        try {
          if (targetFolderId !== folderId) {
            await this.moveFile(file.id, targetFolderId);
            result.moved.push({
              fileId: file.id,
              fileName: file.name,
              toFolder: category,
            });
          }
        } catch (error) {
          result.errors.push({
            fileId: file.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }
}

// ==================== DOCS CLIENT ====================

export class DocsClient {
  private service: docs_v1.Docs | null = null;

  private async getService(): Promise<docs_v1.Docs> {
    if (!this.service) {
      this.service = await getDocsService();
    }
    return this.service;
  }

  async createDocument(title: string): Promise<GoogleDocument> {
    const service = await this.getService();

    const response = await service.documents.create({
      requestBody: { title },
    });

    return {
      documentId: response.data.documentId!,
      title: response.data.title!,
    };
  }

  async getDocument(documentId: string): Promise<docs_v1.Schema$Document> {
    const service = await this.getService();
    const response = await service.documents.get({ documentId });
    return response.data;
  }

  async getDocumentText(documentId: string): Promise<string> {
    const document = await this.getDocument(documentId);
    const textContent: string[] = [];

    const extractText = (elements: docs_v1.Schema$StructuralElement[] | undefined) => {
      if (!elements) return;

      for (const element of elements) {
        if (element.paragraph?.elements) {
          for (const paraElement of element.paragraph.elements) {
            if (paraElement.textRun?.content) {
              textContent.push(paraElement.textRun.content);
            }
          }
        } else if (element.table?.tableRows) {
          for (const row of element.table.tableRows) {
            for (const cell of row.tableCells || []) {
              extractText(cell.content);
            }
          }
        }
      }
    };

    extractText(document.body?.content);
    return textContent.join('');
  }

  async appendText(documentId: string, text: string): Promise<void> {
    const service = await this.getService();
    const document = await this.getDocument(documentId);

    const content = document.body?.content || [];
    const endIndex = content[content.length - 1]?.endIndex || 1;

    await service.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: endIndex - 1 },
              text,
            },
          },
        ],
      },
    });
  }

  async replaceText(documentId: string, oldText: string, newText: string): Promise<number> {
    const service = await this.getService();

    const response = await service.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            replaceAllText: {
              containsText: {
                text: oldText,
                matchCase: true,
              },
              replaceText: newText,
            },
          },
        ],
      },
    });

    const replies = response.data.replies || [];
    return replies[0]?.replaceAllText?.occurrencesChanged || 0;
  }

  // ==================== NEW DOCS OPERATIONS ====================

  /**
   * Insert text at a specific position in the document.
   */
  async insertTextAtPosition(documentId: string, text: string, index: number): Promise<void> {
    const service = await this.getService();

    await service.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index },
              text,
            },
          },
        ],
      },
    });
  }

  /**
   * Delete content in a specific range.
   */
  async deleteContentRange(documentId: string, startIndex: number, endIndex: number): Promise<void> {
    const service = await this.getService();

    await service.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: {
                startIndex,
                endIndex,
              },
            },
          },
        ],
      },
    });
  }

  /**
   * Search for text in a document and return matches with context.
   */
  async searchInDocument(
    documentId: string,
    searchText: string,
    contextChars: number = 50
  ): Promise<TextSearchResult[]> {
    const fullText = await this.getDocumentText(documentId);
    const results: TextSearchResult[] = [];
    const searchLower = searchText.toLowerCase();
    const textLower = fullText.toLowerCase();

    let searchIndex = 0;
    while (true) {
      const foundIndex = textLower.indexOf(searchLower, searchIndex);
      if (foundIndex === -1) break;

      const contextStart = Math.max(0, foundIndex - contextChars);
      const contextEnd = Math.min(fullText.length, foundIndex + searchText.length + contextChars);

      results.push({
        text: fullText.substring(foundIndex, foundIndex + searchText.length),
        startIndex: foundIndex + 1, // Document indices are 1-based
        endIndex: foundIndex + searchText.length + 1,
        context: (contextStart > 0 ? '...' : '') +
                 fullText.substring(contextStart, contextEnd) +
                 (contextEnd < fullText.length ? '...' : ''),
      });

      searchIndex = foundIndex + 1;
    }

    return results;
  }

  /**
   * Get document structure information (headings, counts).
   */
  async getDocumentStructure(documentId: string): Promise<DocumentStructure> {
    const document = await this.getDocument(documentId);
    const structure: DocumentStructure = {
      headings: [],
      paragraphCount: 0,
      tableCount: 0,
      listCount: 0,
      imageCount: 0,
      characterCount: 0,
    };

    const processElements = (elements: docs_v1.Schema$StructuralElement[] | undefined) => {
      if (!elements) return;

      for (const element of elements) {
        if (element.paragraph) {
          structure.paragraphCount++;

          // Check for headings
          const style = element.paragraph.paragraphStyle?.namedStyleType;
          if (style && style.startsWith('HEADING_')) {
            const level = parseInt(style.replace('HEADING_', ''));
            let headingText = '';
            for (const paraElement of element.paragraph.elements || []) {
              if (paraElement.textRun?.content) {
                headingText += paraElement.textRun.content;
              }
            }
            structure.headings.push({
              level,
              text: headingText.trim(),
              startIndex: element.startIndex || 0,
            });
          }

          // Count characters and check for images
          for (const paraElement of element.paragraph.elements || []) {
            if (paraElement.textRun?.content) {
              structure.characterCount += paraElement.textRun.content.length;
            }
            if (paraElement.inlineObjectElement) {
              structure.imageCount++;
            }
          }

          // Check if paragraph is part of a list
          if (element.paragraph.bullet) {
            structure.listCount++;
          }
        } else if (element.table) {
          structure.tableCount++;
          for (const row of element.table.tableRows || []) {
            for (const cell of row.tableCells || []) {
              processElements(cell.content);
            }
          }
        }
      }
    };

    processElements(document.body?.content);
    return structure;
  }

  /**
   * Get a summary of the document (first N characters).
   */
  async getDocumentSummary(documentId: string, maxChars: number = 500): Promise<string> {
    const text = await this.getDocumentText(documentId);
    if (text.length <= maxChars) {
      return text;
    }

    // Try to break at a word boundary
    let breakIndex = text.lastIndexOf(' ', maxChars);
    if (breakIndex === -1 || breakIndex < maxChars * 0.7) {
      breakIndex = maxChars;
    }

    return text.substring(0, breakIndex) + '...';
  }

  /**
   * Add a heading to the document.
   */
  async addHeading(
    documentId: string,
    text: string,
    level: HeadingLevel = 'HEADING_1',
    index?: number
  ): Promise<void> {
    const service = await this.getService();

    // Get document to find insert position if not specified
    let insertIndex = index;
    if (insertIndex === undefined) {
      const document = await this.getDocument(documentId);
      const content = document.body?.content || [];
      insertIndex = (content[content.length - 1]?.endIndex || 1) - 1;
    }

    // Ensure text ends with newline
    const headingText = text.endsWith('\n') ? text : text + '\n';

    await service.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: headingText,
            },
          },
          {
            updateParagraphStyle: {
              range: {
                startIndex: insertIndex,
                endIndex: insertIndex + headingText.length,
              },
              paragraphStyle: {
                namedStyleType: level,
              },
              fields: 'namedStyleType',
            },
          },
        ],
      },
    });
  }

  /**
   * Create a document with initial content.
   */
  async createDocumentWithContent(title: string, content: string): Promise<GoogleDocument> {
    const doc = await this.createDocument(title);

    if (content && content.length > 0) {
      await this.appendText(doc.documentId, content);
    }

    return doc;
  }

  /**
   * Create a document in a specific folder.
   * Note: This creates the document and then moves it to the folder using Drive API.
   */
  async createDocumentInFolder(
    title: string,
    folderId: string,
    content?: string
  ): Promise<GoogleDocument> {
    // Create the document
    const doc = content
      ? await this.createDocumentWithContent(title, content)
      : await this.createDocument(title);

    // Move to folder using Drive API
    const driveService = await getDriveService();
    const file = await driveService.files.get({
      fileId: doc.documentId,
      fields: 'parents',
    });

    const previousParents = (file.data.parents || []).join(',');

    await driveService.files.update({
      fileId: doc.documentId,
      addParents: folderId,
      removeParents: previousParents,
      fields: 'id, parents',
    });

    return doc;
  }

  /**
   * Search for text across multiple documents.
   * Returns documents that contain the search text.
   */
  async searchDocumentsForText(
    documentIds: string[],
    searchText: string
  ): Promise<{ documentId: string; title: string; matches: TextSearchResult[] }[]> {
    const results: { documentId: string; title: string; matches: TextSearchResult[] }[] = [];

    for (const documentId of documentIds) {
      try {
        const document = await this.getDocument(documentId);
        const matches = await this.searchInDocument(documentId, searchText);

        if (matches.length > 0) {
          results.push({
            documentId,
            title: document.title || 'Untitled',
            matches,
          });
        }
      } catch (error) {
        // Skip documents that can't be accessed
        console.error(`[WARN] Could not search document ${documentId}: ${error}`);
      }
    }

    return results;
  }
}

// ==================== SHEETS CLIENT ====================

export class SheetsClient {
  private service: sheets_v4.Sheets | null = null;

  private async getService(): Promise<sheets_v4.Sheets> {
    if (!this.service) {
      this.service = await getSheetsService();
    }
    return this.service;
  }

  async createSpreadsheet(title: string): Promise<Spreadsheet> {
    const service = await this.getService();

    const response = await service.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
      fields: 'spreadsheetId,spreadsheetUrl',
    });

    return {
      spreadsheetId: response.data.spreadsheetId!,
      spreadsheetUrl: response.data.spreadsheetUrl || undefined,
    };
  }

  async getSpreadsheet(spreadsheetId: string): Promise<Spreadsheet> {
    const service = await this.getService();

    const response = await service.spreadsheets.get({ spreadsheetId });

    return {
      spreadsheetId: response.data.spreadsheetId!,
      spreadsheetUrl: response.data.spreadsheetUrl || undefined,
      properties: response.data.properties || undefined,
      sheets: response.data.sheets || undefined,
    };
  }

  async readValues(spreadsheetId: string, range: string): Promise<SheetValues> {
    const service = await this.getService();

    const response = await service.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return (response.data.values || []) as SheetValues;
  }

  async writeValues(
    spreadsheetId: string,
    range: string,
    values: SheetValues
  ): Promise<UpdateValuesResult> {
    const service = await this.getService();

    const response = await service.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return {
      updatedRange: response.data.updatedRange || undefined,
      updatedRows: response.data.updatedRows || undefined,
      updatedColumns: response.data.updatedColumns || undefined,
      updatedCells: response.data.updatedCells || undefined,
    };
  }

  async appendValues(
    spreadsheetId: string,
    range: string,
    values: SheetValues
  ): Promise<UpdateValuesResult> {
    const service = await this.getService();

    const response = await service.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    return {
      updatedRange: response.data.updates?.updatedRange || undefined,
      updatedRows: response.data.updates?.updatedRows || undefined,
      updatedColumns: response.data.updates?.updatedColumns || undefined,
      updatedCells: response.data.updates?.updatedCells || undefined,
    };
  }

  // ==================== NEW SHEETS OPERATIONS ====================

  /**
   * Clear values from a range.
   */
  async clearValues(spreadsheetId: string, range: string): Promise<void> {
    const service = await this.getService();
    await service.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
  }

  /**
   * Read all values from a sheet.
   */
  async readAllValues(spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<SheetValues> {
    return this.readValues(spreadsheetId, sheetName);
  }

  /**
   * Read multiple ranges at once (batch read).
   */
  async readMultipleRanges(
    spreadsheetId: string,
    ranges: string[]
  ): Promise<Record<string, SheetValues>> {
    const service = await this.getService();

    const response = await service.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });

    const result: Record<string, SheetValues> = {};
    for (const vr of response.data.valueRanges || []) {
      if (vr.range) {
        result[vr.range] = (vr.values || []) as SheetValues;
      }
    }

    return result;
  }

  /**
   * Update multiple ranges at once (batch update).
   */
  async updateMultipleRanges(
    spreadsheetId: string,
    data: Record<string, SheetValues>
  ): Promise<{ totalUpdatedCells: number }> {
    const service = await this.getService();

    const valueRanges = Object.entries(data).map(([range, values]) => ({
      range,
      values,
    }));

    const response = await service.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      },
    });

    return {
      totalUpdatedCells: response.data.totalUpdatedCells || 0,
    };
  }

  /**
   * Find cells containing specific text.
   */
  async findInSheet(
    spreadsheetId: string,
    searchText: string,
    sheetName: string = 'Sheet1'
  ): Promise<CellMatch[]> {
    const values = await this.readAllValues(spreadsheetId, sheetName);
    const matches: CellMatch[] = [];
    const searchLower = searchText.toLowerCase();

    for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
      const row = values[rowIdx];
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = row[colIdx];
        if (cell !== null && String(cell).toLowerCase().includes(searchLower)) {
          // Convert column index to letter(s)
          let colLetter: string;
          if (colIdx < 26) {
            colLetter = String.fromCharCode('A'.charCodeAt(0) + colIdx);
          } else {
            colLetter = String.fromCharCode('A'.charCodeAt(0) + Math.floor(colIdx / 26) - 1) +
                        String.fromCharCode('A'.charCodeAt(0) + (colIdx % 26));
          }

          matches.push({
            cell: `${colLetter}${rowIdx + 1}`,
            row: rowIdx + 1,
            column: colIdx + 1,
            value: cell,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Query sheet data with column filters.
   */
  async querySheet(
    spreadsheetId: string,
    columnFilters: Record<number, string>,
    sheetName: string = 'Sheet1'
  ): Promise<Record<string, CellValue>[]> {
    const values = await this.readAllValues(spreadsheetId, sheetName);

    if (values.length === 0) {
      return [];
    }

    const headers = values[0] || [];
    const results: Record<string, CellValue>[] = [];

    for (const row of values.slice(1)) {
      let match = true;
      for (const [colIdxStr, filterValue] of Object.entries(columnFilters)) {
        const colIdx = parseInt(colIdxStr);
        if (colIdx >= row.length) {
          match = false;
          break;
        }
        if (!String(row[colIdx] ?? '').toLowerCase().includes(filterValue.toLowerCase())) {
          match = false;
          break;
        }
      }

      if (match) {
        const rowObj: Record<string, CellValue> = {};
        headers.forEach((header, i) => {
          rowObj[String(header)] = row[i] ?? null;
        });
        results.push(rowObj);
      }
    }

    return results;
  }

  /**
   * Find a row by a value in a specific column.
   */
  async findRowByValue(
    spreadsheetId: string,
    column: string | number,
    value: CellValue,
    sheetName: string = 'Sheet1'
  ): Promise<Record<string, CellValue> | null> {
    const values = await this.readAllValues(spreadsheetId, sheetName);

    if (values.length < 2) {
      return null;
    }

    const headers = values[0];

    let colIdx: number;
    if (typeof column === 'string') {
      colIdx = column.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    } else {
      colIdx = column;
    }

    for (const row of values.slice(1)) {
      if (colIdx < row.length && String(row[colIdx]) === String(value)) {
        const rowObj: Record<string, CellValue> = {};
        headers.forEach((header, i) => {
          rowObj[String(header)] = row[i] ?? null;
        });
        return rowObj;
      }
    }

    return null;
  }

  /**
   * Get all values from a specific column.
   */
  async getColumnValues(
    spreadsheetId: string,
    column: string | number,
    sheetName: string = 'Sheet1'
  ): Promise<CellValue[]> {
    let colLetter: string;
    if (typeof column === 'number') {
      colLetter = String.fromCharCode('A'.charCodeAt(0) + column);
    } else {
      colLetter = column.toUpperCase();
    }

    const rangeName = `${sheetName}!${colLetter}:${colLetter}`;
    const values = await this.readValues(spreadsheetId, rangeName);

    return values.map(row => row[0] ?? null);
  }

  /**
   * Add a new sheet to a spreadsheet.
   */
  async addSheet(
    spreadsheetId: string,
    sheetName: string
  ): Promise<{ sheetId: number; title: string }> {
    const service = await this.getService();

    const response = await service.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });

    const addedSheet = response.data.replies?.[0]?.addSheet?.properties;
    return {
      sheetId: addedSheet?.sheetId || 0,
      title: addedSheet?.title || sheetName,
    };
  }

  /**
   * Delete a sheet from a spreadsheet.
   */
  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
    const service = await this.getService();

    await service.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId,
            },
          },
        ],
      },
    });
  }

  /**
   * Get a summary of the spreadsheet.
   */
  async getSheetSummary(spreadsheetId: string): Promise<SpreadsheetSummary> {
    const spreadsheet = await this.getSpreadsheet(spreadsheetId);

    const summary: SpreadsheetSummary = {
      title: spreadsheet.properties?.title || null,
      spreadsheetId,
      url: spreadsheet.spreadsheetUrl || null,
      sheets: [],
    };

    for (const sheet of spreadsheet.sheets || []) {
      const props = sheet.properties;
      const gridProps = props?.gridProperties;

      summary.sheets.push({
        sheetId: props?.sheetId || 0,
        title: props?.title || '',
        rowCount: gridProps?.rowCount || 0,
        columnCount: gridProps?.columnCount || 0,
      });
    }

    return summary;
  }

  /**
   * Create a spreadsheet with multiple named sheets.
   */
  async createSpreadsheetWithSheets(
    title: string,
    sheetNames: string[]
  ): Promise<Spreadsheet> {
    const service = await this.getService();

    const sheets = sheetNames.map(name => ({
      properties: { title: name },
    }));

    const response = await service.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets,
      },
      fields: 'spreadsheetId,spreadsheetUrl,sheets.properties',
    });

    return {
      spreadsheetId: response.data.spreadsheetId!,
      spreadsheetUrl: response.data.spreadsheetUrl || undefined,
      sheets: response.data.sheets || undefined,
    };
  }

  /**
   * Create a spreadsheet and populate it with data.
   */
  async createSpreadsheetWithData(
    title: string,
    data: SheetValues,
    sheetName: string = 'Sheet1'
  ): Promise<Spreadsheet> {
    const spreadsheet = await this.createSpreadsheet(title);
    await this.writeValues(spreadsheet.spreadsheetId, `${sheetName}!A1`, data);
    return spreadsheet;
  }
}

// ==================== SLIDES CLIENT ====================

export class SlidesClient {
  private service: slides_v1.Slides | null = null;

  private async getService(): Promise<slides_v1.Slides> {
    if (!this.service) {
      this.service = await getSlidesService();
    }
    return this.service;
  }

  async createPresentation(title: string): Promise<Presentation> {
    const service = await this.getService();

    const response = await service.presentations.create({
      requestBody: { title },
    });

    return {
      presentationId: response.data.presentationId!,
      title: response.data.title || undefined,
    };
  }

  async getPresentation(presentationId: string): Promise<Presentation> {
    const service = await this.getService();

    const response = await service.presentations.get({ presentationId });

    return {
      presentationId: response.data.presentationId!,
      title: response.data.title || undefined,
      slides: response.data.slides || undefined,
      pageSize: response.data.pageSize || undefined,
    };
  }

  async getSlideCount(presentationId: string): Promise<number> {
    const presentation = await this.getPresentation(presentationId);
    return presentation.slides?.length || 0;
  }

  async getSlideText(presentationId: string): Promise<SlideTextMap> {
    const presentation = await this.getPresentation(presentationId);
    const slideTexts: SlideTextMap = {};

    for (let idx = 0; idx < (presentation.slides?.length || 0); idx++) {
      const slide = presentation.slides![idx];
      const texts: string[] = [];

      for (const element of slide.pageElements || []) {
        if (element.shape?.text?.textElements) {
          for (const textElement of element.shape.text.textElements) {
            if (textElement.textRun?.content) {
              texts.push(textElement.textRun.content);
            }
          }
        }
      }

      slideTexts[idx + 1] = texts.join('');
    }

    return slideTexts;
  }

  // ==================== NEW SLIDES OPERATIONS ====================

  /**
   * Get text from a specific slide by number (1-based).
   */
  async getSlideTextByNumber(presentationId: string, slideNumber: number): Promise<string> {
    const allText = await this.getSlideText(presentationId);
    return allText[slideNumber] || '';
  }

  /**
   * Get detailed presentation summary with per-slide text.
   */
  async getPresentationSummary(presentationId: string): Promise<PresentationSummary> {
    const presentation = await this.getPresentation(presentationId);
    const slideText = await this.getSlideText(presentationId);

    const summary: PresentationSummary = {
      presentationId,
      title: presentation.title || null,
      slideCount: presentation.slides?.length || 0,
      slides: [],
    };

    for (let idx = 0; idx < (presentation.slides?.length || 0); idx++) {
      const slide = presentation.slides![idx];
      summary.slides.push({
        slideNumber: idx + 1,
        objectId: slide.objectId || '',
        text: slideText[idx + 1] || '',
      });
    }

    return summary;
  }

  /**
   * Add a new slide to the presentation.
   */
  async addSlide(
    presentationId: string,
    layout: PredefinedLayout = 'BLANK',
    insertionIndex?: number
  ): Promise<{ slideId: string }> {
    const service = await this.getService();

    const request: slides_v1.Schema$Request = {
      createSlide: {
        slideLayoutReference: {
          predefinedLayout: layout,
        },
      },
    };

    if (insertionIndex !== undefined) {
      request.createSlide!.insertionIndex = insertionIndex;
    }

    const response = await service.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: [request] },
    });

    const slideId = response.data.replies?.[0]?.createSlide?.objectId || '';
    return { slideId };
  }

  /**
   * Delete a slide from the presentation.
   */
  async deleteSlide(presentationId: string, slideObjectId: string): Promise<void> {
    const service = await this.getService();

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            deleteObject: {
              objectId: slideObjectId,
            },
          },
        ],
      },
    });
  }

  /**
   * Delete a slide by its number (1-based index).
   */
  async deleteSlideByNumber(presentationId: string, slideNumber: number): Promise<void> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slideObjectId = slides[slideNumber - 1].objectId;
    if (!slideObjectId) {
      throw new Error(`Could not find object ID for slide ${slideNumber}`);
    }

    await this.deleteSlide(presentationId, slideObjectId);
  }

  /**
   * Replace all occurrences of text in the presentation.
   */
  async replaceTextInPresentation(
    presentationId: string,
    oldText: string,
    newText: string,
    matchCase: boolean = true
  ): Promise<number> {
    const service = await this.getService();

    const response = await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            replaceAllText: {
              containsText: {
                text: oldText,
                matchCase,
              },
              replaceText: newText,
            },
          },
        ],
      },
    });

    return response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  }

  /**
   * Add a text box to a slide.
   */
  async addTextBox(
    presentationId: string,
    slideObjectId: string,
    text: string,
    options: TextBoxOptions = {}
  ): Promise<{ elementId: string }> {
    const service = await this.getService();

    const {
      x = 100,
      y = 100,
      width = 300,
      height = 50,
    } = options;

    // Generate a unique element ID
    const elementId = `textbox_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            createShape: {
              objectId: elementId,
              shapeType: 'TEXT_BOX',
              elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                  width: { magnitude: width, unit: 'PT' },
                  height: { magnitude: height, unit: 'PT' },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: x,
                  translateY: y,
                  unit: 'PT',
                },
              },
            },
          },
          {
            insertText: {
              objectId: elementId,
              text,
            },
          },
        ],
      },
    });

    return { elementId };
  }

  /**
   * Add a text box to a slide by slide number (1-based).
   */
  async addTextBoxBySlideNumber(
    presentationId: string,
    slideNumber: number,
    text: string,
    options: TextBoxOptions = {}
  ): Promise<{ elementId: string }> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slideObjectId = slides[slideNumber - 1].objectId;
    if (!slideObjectId) {
      throw new Error(`Could not find object ID for slide ${slideNumber}`);
    }

    return this.addTextBox(presentationId, slideObjectId, text, options);
  }

  /**
   * Create a presentation with multiple blank slides.
   */
  async createPresentationWithSlides(
    title: string,
    slideCount: number,
    layout: PredefinedLayout = 'BLANK'
  ): Promise<Presentation> {
    // Create the presentation
    const presentation = await this.createPresentation(title);

    // Add additional slides (presentation starts with 1 slide)
    for (let i = 1; i < slideCount; i++) {
      await this.addSlide(presentation.presentationId, layout);
    }

    // Return updated presentation info
    return this.getPresentation(presentation.presentationId);
  }

  /**
   * Add an image to a slide from a URL.
   * For Google Drive images, use: https://drive.google.com/uc?export=view&id=FILE_ID
   */
  async addImage(
    presentationId: string,
    slideObjectId: string,
    imageUrl: string,
    options: ImageOptions = {}
  ): Promise<{ elementId: string }> {
    const service = await this.getService();

    const {
      x = 0,
      y = 0,
      width = 720,
      height = 405,
    } = options;

    // Generate a unique element ID
    const elementId = `image_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            createImage: {
              objectId: elementId,
              url: imageUrl,
              elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                  width: { magnitude: width, unit: 'PT' },
                  height: { magnitude: height, unit: 'PT' },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: x,
                  translateY: y,
                  unit: 'PT',
                },
              },
            },
          },
        ],
      },
    });

    return { elementId };
  }

  /**
   * Add an image to a slide by slide number (1-based).
   */
  async addImageBySlideNumber(
    presentationId: string,
    slideNumber: number,
    imageUrl: string,
    options: ImageOptions = {}
  ): Promise<{ elementId: string }> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slideObjectId = slides[slideNumber - 1].objectId;
    if (!slideObjectId) {
      throw new Error(`Could not find object ID for slide ${slideNumber}`);
    }

    return this.addImage(presentationId, slideObjectId, imageUrl, options);
  }

  // ==================== SLIDE BACKGROUND OPERATIONS ====================

  /**
   * Set the background of a slide to an image.
   * Uses the proper Google Slides API pageBackgroundFill property.
   * @param presentationId - The presentation ID
   * @param slideObjectId - The slide object ID
   * @param imageUrl - URL of the image (must be publicly accessible or a Drive URL)
   */
  async setSlideBackground(
    presentationId: string,
    slideObjectId: string,
    imageUrl: string
  ): Promise<void> {
    const service = await this.getService();

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            updatePageProperties: {
              objectId: slideObjectId,
              pageProperties: {
                pageBackgroundFill: {
                  stretchedPictureFill: {
                    contentUrl: imageUrl,
                  },
                },
              },
              fields: 'pageBackgroundFill',
            },
          },
        ],
      },
    });
  }

  /**
   * Set the background of a slide by slide number (1-based).
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @param imageUrl - URL of the image (must be publicly accessible or a Drive URL)
   */
  async setSlideBackgroundByNumber(
    presentationId: string,
    slideNumber: number,
    imageUrl: string
  ): Promise<void> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slideObjectId = slides[slideNumber - 1].objectId;
    if (!slideObjectId) {
      throw new Error(`Could not find object ID for slide ${slideNumber}`);
    }

    await this.setSlideBackground(presentationId, slideObjectId, imageUrl);
  }

  /**
   * Set the background of a slide to a solid color.
   * @param presentationId - The presentation ID
   * @param slideObjectId - The slide object ID
   * @param color - RGB color object with red, green, blue values (0-1)
   */
  async setSlideBackgroundColor(
    presentationId: string,
    slideObjectId: string,
    color: { red: number; green: number; blue: number }
  ): Promise<void> {
    const service = await this.getService();

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            updatePageProperties: {
              objectId: slideObjectId,
              pageProperties: {
                pageBackgroundFill: {
                  solidFill: {
                    color: {
                      rgbColor: color,
                    },
                  },
                },
              },
              fields: 'pageBackgroundFill',
            },
          },
        ],
      },
    });
  }

  /**
   * Set the background of a slide to a solid color by slide number (1-based).
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @param color - RGB color object with red, green, blue values (0-1)
   */
  async setSlideBackgroundColorByNumber(
    presentationId: string,
    slideNumber: number,
    color: { red: number; green: number; blue: number }
  ): Promise<void> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slideObjectId = slides[slideNumber - 1].objectId;
    if (!slideObjectId) {
      throw new Error(`Could not find object ID for slide ${slideNumber}`);
    }

    await this.setSlideBackgroundColor(presentationId, slideObjectId, color);
  }

  // ==================== PLACEHOLDER OPERATIONS ====================

  /**
   * Check if a page element is an empty placeholder.
   * A placeholder is considered empty if it has no text content or only whitespace.
   */
  private isEmptyPlaceholder(element: slides_v1.Schema$PageElement): boolean {
    // Check if it's a shape with placeholder property
    if (!element.shape?.placeholder) {
      return false;
    }

    // Check text content
    const textElements = element.shape?.text?.textElements || [];
    let textContent = '';

    for (const textElement of textElements) {
      if (textElement.textRun?.content) {
        textContent += textElement.textRun.content;
      }
    }

    // Trim and check if empty (only whitespace or newlines)
    return textContent.trim() === '';
  }

  /**
   * Remove empty placeholders from a specific slide.
   * @param presentationId - The presentation ID
   * @param slideObjectId - The slide object ID
   * @returns Object with count of removed placeholders and their IDs
   */
  async removeEmptyPlaceholders(
    presentationId: string,
    slideObjectId: string
  ): Promise<{ removedCount: number; removedIds: string[] }> {
    const service = await this.getService();
    const presentation = await this.getPresentation(presentationId);

    // Find the slide
    const slide = presentation.slides?.find(s => s.objectId === slideObjectId);
    if (!slide) {
      throw new Error(`Slide with ID ${slideObjectId} not found`);
    }

    // Find empty placeholders
    const emptyPlaceholderIds: string[] = [];
    for (const element of slide.pageElements || []) {
      if (this.isEmptyPlaceholder(element) && element.objectId) {
        emptyPlaceholderIds.push(element.objectId);
      }
    }

    if (emptyPlaceholderIds.length === 0) {
      return { removedCount: 0, removedIds: [] };
    }

    // Create delete requests for each empty placeholder
    const requests: slides_v1.Schema$Request[] = emptyPlaceholderIds.map(objectId => ({
      deleteObject: { objectId },
    }));

    // Execute batch update
    await service.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });

    return { removedCount: emptyPlaceholderIds.length, removedIds: emptyPlaceholderIds };
  }

  /**
   * Remove empty placeholders from a slide by slide number (1-based).
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @returns Object with count of removed placeholders and their IDs
   */
  async removeEmptyPlaceholdersByNumber(
    presentationId: string,
    slideNumber: number
  ): Promise<{ removedCount: number; removedIds: string[] }> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slideObjectId = slides[slideNumber - 1].objectId;
    if (!slideObjectId) {
      throw new Error(`Could not find object ID for slide ${slideNumber}`);
    }

    return this.removeEmptyPlaceholders(presentationId, slideObjectId);
  }

  /**
   * Remove empty placeholders from all slides in a presentation.
   * @param presentationId - The presentation ID
   * @returns Object with total count and per-slide details
   */
  async removeAllEmptyPlaceholders(
    presentationId: string
  ): Promise<{ totalRemoved: number; slideDetails: Array<{ slideNumber: number; removedCount: number }> }> {
    const presentation = await this.getPresentation(presentationId);
    const slides = presentation.slides || [];
    const service = await this.getService();

    // Collect all empty placeholder IDs across all slides
    const allEmptyIds: string[] = [];
    const slideDetails: Array<{ slideNumber: number; removedCount: number; ids: string[] }> = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const emptyIds: string[] = [];

      for (const element of slide.pageElements || []) {
        if (this.isEmptyPlaceholder(element) && element.objectId) {
          emptyIds.push(element.objectId);
          allEmptyIds.push(element.objectId);
        }
      }

      if (emptyIds.length > 0) {
        slideDetails.push({
          slideNumber: i + 1,
          removedCount: emptyIds.length,
          ids: emptyIds,
        });
      }
    }

    if (allEmptyIds.length === 0) {
      return { totalRemoved: 0, slideDetails: [] };
    }

    // Create delete requests for all empty placeholders
    const requests: slides_v1.Schema$Request[] = allEmptyIds.map(objectId => ({
      deleteObject: { objectId },
    }));

    // Execute batch update
    await service.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });

    return {
      totalRemoved: allEmptyIds.length,
      slideDetails: slideDetails.map(d => ({ slideNumber: d.slideNumber, removedCount: d.removedCount })),
    };
  }

  // ==================== SPEAKER NOTES OPERATIONS ====================

  /**
   * Get speaker notes from a slide by slide number (1-based).
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @returns The speaker notes text, or empty string if none
   */
  async getSpeakerNotes(presentationId: string, slideNumber: number): Promise<string> {
    const service = await this.getService();

    const response = await service.presentations.get({ presentationId });
    const slides = response.data.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slide = slides[slideNumber - 1];
    const notesPage = slide.slideProperties?.notesPage;

    if (!notesPage?.pageElements) {
      return '';
    }

    // Find the BODY placeholder which contains the notes
    for (const element of notesPage.pageElements) {
      if (element.shape?.placeholder?.type === 'BODY' && element.shape?.text?.textElements) {
        const texts: string[] = [];
        for (const textElement of element.shape.text.textElements) {
          if (textElement.textRun?.content) {
            texts.push(textElement.textRun.content);
          }
        }
        return texts.join('').trim();
      }
    }

    return '';
  }

  /**
   * Set speaker notes for a slide by slide number (1-based).
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @param notesText - The text to set as speaker notes
   */
  async setSpeakerNotes(presentationId: string, slideNumber: number, notesText: string): Promise<void> {
    const service = await this.getService();

    const response = await service.presentations.get({ presentationId });
    const slides = response.data.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slide = slides[slideNumber - 1];
    const notesPage = slide.slideProperties?.notesPage;

    if (!notesPage?.pageElements) {
      throw new Error(`Could not find notes page for slide ${slideNumber}`);
    }

    // Find the BODY placeholder which contains the notes
    let notesShapeId: string | null = null;
    let hasExistingText = false;

    for (const element of notesPage.pageElements) {
      if (element.shape?.placeholder?.type === 'BODY' && element.objectId) {
        notesShapeId = element.objectId;
        // Check if there's existing text
        if (element.shape?.text?.textElements) {
          for (const textElement of element.shape.text.textElements) {
            if (textElement.textRun?.content && textElement.textRun.content.trim()) {
              hasExistingText = true;
              break;
            }
          }
        }
        break;
      }
    }

    if (!notesShapeId) {
      throw new Error(`Could not find notes shape for slide ${slideNumber}`);
    }

    const requests: slides_v1.Schema$Request[] = [];

    // Delete existing text if present
    if (hasExistingText) {
      requests.push({
        deleteText: {
          objectId: notesShapeId,
          textRange: { type: 'ALL' },
        },
      });
    }

    // Insert new text
    requests.push({
      insertText: {
        objectId: notesShapeId,
        insertionIndex: 0,
        text: notesText,
      },
    });

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
  }

  // ==================== SLIDE CONTENT OPERATIONS ====================

  /**
   * Clear all text boxes from a slide (keeps background and other elements).
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @returns Object with count of deleted elements and their IDs
   */
  async clearSlideTextBoxes(
    presentationId: string,
    slideNumber: number
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    const service = await this.getService();

    const response = await service.presentations.get({ presentationId });
    const slides = response.data.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slide = slides[slideNumber - 1];
    const textBoxIds: string[] = [];

    // Find all TEXT_BOX elements
    for (const element of slide.pageElements || []) {
      if (element.shape?.shapeType === 'TEXT_BOX' && element.objectId) {
        textBoxIds.push(element.objectId);
      }
    }

    if (textBoxIds.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }

    // Create delete requests
    const requests: slides_v1.Schema$Request[] = textBoxIds.map(objectId => ({
      deleteObject: { objectId },
    }));

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });

    return { deletedCount: textBoxIds.length, deletedIds: textBoxIds };
  }

  /**
   * Delete specific page elements from a slide.
   * @param presentationId - The presentation ID
   * @param elementIds - Array of element IDs to delete
   */
  async deletePageElements(presentationId: string, elementIds: string[]): Promise<void> {
    if (elementIds.length === 0) {
      return;
    }

    const service = await this.getService();

    const requests: slides_v1.Schema$Request[] = elementIds.map(objectId => ({
      deleteObject: { objectId },
    }));

    await service.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
  }

  /**
   * Get all page elements from a slide.
   * @param presentationId - The presentation ID
   * @param slideNumber - The slide number (1-based)
   * @returns Array of page elements with their IDs, types, and text content
   */
  async getSlideElements(
    presentationId: string,
    slideNumber: number
  ): Promise<Array<{ objectId: string; type: string; text?: string }>> {
    const service = await this.getService();

    const response = await service.presentations.get({ presentationId });
    const slides = response.data.slides || [];

    if (slideNumber < 1 || slideNumber > slides.length) {
      throw new Error(`Invalid slide number ${slideNumber}. Presentation has ${slides.length} slides.`);
    }

    const slide = slides[slideNumber - 1];
    const elements: Array<{ objectId: string; type: string; text?: string }> = [];

    for (const element of slide.pageElements || []) {
      if (!element.objectId) continue;

      let type = 'unknown';
      let text: string | undefined;

      if (element.shape) {
        type = element.shape.shapeType || 'SHAPE';
        // Extract text if present
        if (element.shape.text?.textElements) {
          const texts: string[] = [];
          for (const textElement of element.shape.text.textElements) {
            if (textElement.textRun?.content) {
              texts.push(textElement.textRun.content);
            }
          }
          text = texts.join('').trim() || undefined;
        }
      } else if (element.image) {
        type = 'IMAGE';
      } else if (element.table) {
        type = 'TABLE';
      } else if (element.line) {
        type = 'LINE';
      } else if (element.video) {
        type = 'VIDEO';
      } else if (element.sheetsChart) {
        type = 'SHEETS_CHART';
      } else if (element.wordArt) {
        type = 'WORD_ART';
      } else if (element.elementGroup) {
        type = 'GROUP';
      }

      elements.push({ objectId: element.objectId, type, text });
    }

    return elements;
  }
}

// ==================== CLI UTILITIES ====================

/**
 * Parse command line arguments
 * Supports: --key value, --flag, -k value
 */
export function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = 'true';
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = 'true';
      }
    }
  }

  return result;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: string | number | undefined): string {
  if (!bytes) return 'N/A';
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Print separator line
 */
export function printSeparator(char = '=', length = 60): void {
  console.log(char.repeat(length));
}

/**
 * Export format mappings
 */
export const EXPORT_FORMATS: Record<string, string> = {
  // Google Docs
  'pdf': 'application/pdf',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'txt': 'text/plain',
  'html': 'text/html',
  'odt': 'application/vnd.oasis.opendocument.text',
  'rtf': 'application/rtf',
  'epub': 'application/epub+zip',

  // Google Sheets
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'csv': 'text/csv',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'tsv': 'text/tab-separated-values',

  // Google Slides
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'odp': 'application/vnd.oasis.opendocument.presentation',
};

/**
 * Google file MIME types
 */
export const GOOGLE_MIME_TYPES = {
  DOC: 'application/vnd.google-apps.document',
  SHEET: 'application/vnd.google-apps.spreadsheet',
  SLIDES: 'application/vnd.google-apps.presentation',
  FOLDER: 'application/vnd.google-apps.folder',
};

/**
 * Check if a MIME type is a Google Workspace file
 */
export function isGoogleFile(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.');
}
