#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to batch upload documents from a folder to a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node upload-folder.ts <store-name> <folder-path>                    # Upload all files
 *   npx ts-node upload-folder.ts <store-name> <folder-path> --pattern "*.md"   # Upload matching files
 *   npx ts-node upload-folder.ts <store-name> <folder-path> --recursive        # Include subfolders
 *   npx ts-node upload-folder.ts <store-name> <folder-path> --json             # JSON output
 *
 * Examples:
 *   npx ts-node upload-folder.ts my-knowledge-base ./documents
 *   npx ts-node upload-folder.ts my-knowledge-base ./docs --pattern "*.pdf"
 *   npx ts-node upload-folder.ts my-knowledge-base ./project --recursive --pattern "*.md"
 *
 * Environment:
 *   GEMINI_API_KEY - Required. Your Gemini API key.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

// Get directory of this script for .env loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
config({ path: path.join(__dirname, '.env') });
config(); // Also try current directory

interface UploadedFile {
    filePath: string;
    displayName: string;
    documentName: string;
    state: string;
    sizeBytes: number;
    mimeType: string;
    success: boolean;
    error?: string;
}

interface UploadFolderResult {
    success: boolean;
    storeName: string;
    folderPath: string;
    pattern: string | null;
    recursive: boolean;
    totalFiles: number;
    successCount: number;
    failureCount: number;
    uploadedFiles: UploadedFile[];
    error?: string;
}

// Validate environment before initializing client
function validateEnvironment(): void {
    if (!process.env.GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY environment variable is not set');
        console.error('');
        console.error('Set it with:');
        console.error('  export GEMINI_API_KEY="your-api-key-here"');
        process.exit(1);
    }
}

function printUsage(): void {
    console.log('');
    console.log('Usage: npx ts-node upload-folder.ts <store-name> <folder-path> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the target store');
    console.log('  folder-path     Path to the folder containing documents to upload');
    console.log('');
    console.log('Options:');
    console.log('  --pattern, -p   Glob pattern to filter files (e.g., "*.md", "*.pdf")');
    console.log('  --recursive, -r Include files in subfolders');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node upload-folder.ts my-knowledge-base ./documents');
    console.log('  npx ts-node upload-folder.ts my-knowledge-base ./docs --pattern "*.pdf"');
    console.log('  npx ts-node upload-folder.ts my-knowledge-base ./project -r -p "*.md"');
    console.log('');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Simple glob pattern matching (supports * and ?)
function matchesPattern(filename: string, pattern: string): boolean {
    const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars except * and ?
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
}

// MIME type mapping for common file extensions
function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        // Documents
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.odt': 'application/vnd.oasis.opendocument.text',
        '.rtf': 'application/rtf',
        // Text
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.markdown': 'text/markdown',
        '.csv': 'text/csv',
        '.tsv': 'text/tab-separated-values',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.xml': 'application/xml',
        '.json': 'application/json',
        '.yaml': 'text/yaml',
        '.yml': 'text/yaml',
        // Code
        '.py': 'text/x-python',
        '.js': 'text/javascript',
        '.ts': 'text/typescript',
        '.java': 'text/x-java',
        '.c': 'text/x-c',
        '.cpp': 'text/x-c++',
        '.h': 'text/x-c',
        '.go': 'text/x-go',
        '.rs': 'text/x-rust',
        '.rb': 'text/x-ruby',
        '.php': 'text/x-php',
        '.sh': 'text/x-shellscript',
        '.bash': 'text/x-shellscript',
        '.sql': 'text/x-sql',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// Get files from folder
function getFiles(folderPath: string, pattern: string | null, recursive: boolean): string[] {
    const files: string[] = [];

    function scanDirectory(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (recursive) {
                    scanDirectory(fullPath);
                }
            } else if (entry.isFile()) {
                if (!pattern || matchesPattern(entry.name, pattern)) {
                    files.push(fullPath);
                }
            }
        }
    }

    scanDirectory(folderPath);
    return files.sort();
}

// Initialize client with explicit GEMINI_API_KEY
// Temporarily remove GOOGLE_API_KEY to prevent library warning
validateEnvironment();
const _googleKeyBackup = process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
if (_googleKeyBackup) process.env.GOOGLE_API_KEY = _googleKeyBackup;

async function findStoreByDisplayName(displayName: string): Promise<{ name: string; displayName: string } | null> {
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    let page = pager.page;

    while (true) {
        for (const store of page) {
            if (store.displayName === displayName) {
                return { name: store.name || '', displayName: store.displayName || '' };
            }
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return null;
}

async function uploadFolder(
    storeName: string,
    folderPath: string,
    pattern: string | null,
    recursive: boolean,
    outputJson: boolean
): Promise<void> {
    try {
        // Validate folder exists
        const absoluteFolderPath = path.resolve(folderPath);
        if (!fs.existsSync(absoluteFolderPath)) {
            const errorResult: UploadFolderResult = {
                success: false,
                storeName: storeName,
                folderPath: folderPath,
                pattern: pattern,
                recursive: recursive,
                totalFiles: 0,
                successCount: 0,
                failureCount: 0,
                uploadedFiles: [],
                error: `Folder not found: ${absoluteFolderPath}`
            };
            if (outputJson) {
                console.log(JSON.stringify(errorResult, null, 2));
            } else {
                console.error(`Error: Folder not found: ${absoluteFolderPath}`);
            }
            process.exit(1);
        }

        if (!fs.statSync(absoluteFolderPath).isDirectory()) {
            const errorResult: UploadFolderResult = {
                success: false,
                storeName: storeName,
                folderPath: folderPath,
                pattern: pattern,
                recursive: recursive,
                totalFiles: 0,
                successCount: 0,
                failureCount: 0,
                uploadedFiles: [],
                error: `Path is not a directory: ${absoluteFolderPath}`
            };
            if (outputJson) {
                console.log(JSON.stringify(errorResult, null, 2));
            } else {
                console.error(`Error: Path is not a directory: ${absoluteFolderPath}`);
            }
            process.exit(1);
        }

        let storeApiName: string;
        let storeDisplayName: string;

        // Check if it's an API name or display name
        if (storeName.startsWith('fileSearchStores/')) {
            storeApiName = storeName;
            storeDisplayName = storeName;
        } else {
            // Find store by display name
            const store = await findStoreByDisplayName(storeName);
            if (!store) {
                const errorResult: UploadFolderResult = {
                    success: false,
                    storeName: storeName,
                    folderPath: folderPath,
                    pattern: pattern,
                    recursive: recursive,
                    totalFiles: 0,
                    successCount: 0,
                    failureCount: 0,
                    uploadedFiles: [],
                    error: `Store not found: ${storeName}`
                };
                if (outputJson) {
                    console.log(JSON.stringify(errorResult, null, 2));
                } else {
                    console.error(`Error: Store not found: ${storeName}`);
                    console.error('');
                    console.error('Use "npx ts-node list-stores.ts" to see available stores.');
                }
                process.exit(1);
            }
            storeApiName = store.name;
            storeDisplayName = store.displayName;
        }

        // Get files to upload
        const files = getFiles(absoluteFolderPath, pattern, recursive);

        if (files.length === 0) {
            const result: UploadFolderResult = {
                success: true,
                storeName: storeDisplayName,
                folderPath: absoluteFolderPath,
                pattern: pattern,
                recursive: recursive,
                totalFiles: 0,
                successCount: 0,
                failureCount: 0,
                uploadedFiles: []
            };
            if (outputJson) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log('');
                console.log('No files found matching the criteria.');
                console.log('');
            }
            return;
        }

        if (!outputJson) {
            console.log('');
            console.log('='.repeat(60));
            console.log('UPLOADING FOLDER');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store:     ${storeDisplayName}`);
            console.log(`  Folder:    ${absoluteFolderPath}`);
            console.log(`  Pattern:   ${pattern || '(all files)'}`);
            console.log(`  Recursive: ${recursive ? 'Yes' : 'No'}`);
            console.log(`  Files:     ${files.length}`);
            console.log('');
            console.log('-'.repeat(60));
        }

        const uploadedFiles: UploadedFile[] = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            const fileName = path.basename(filePath);
            const relativePath = path.relative(absoluteFolderPath, filePath);
            const displayName = recursive ? relativePath : fileName;

            if (!outputJson) {
                process.stdout.write(`  [${i + 1}/${files.length}] ${displayName}... `);
            }

            try {
                const stats = fs.statSync(filePath);
                const mimeType = getMimeType(filePath);

                const operation = await ai.fileSearchStores.uploadToFileSearchStore({
                    file: filePath,
                    fileSearchStoreName: storeApiName,
                    config: {
                        displayName: displayName,
                        mimeType: mimeType
                    }
                });

                // Poll for completion
                let currentOp = operation;
                while (!currentOp.done) {
                    await sleep(2000);
                    currentOp = await ai.operations.get({ operation: currentOp });
                }

                const docResult = currentOp.result as any;
                const uploadedFile: UploadedFile = {
                    filePath: filePath,
                    displayName: displayName,
                    documentName: docResult?.name || '',
                    state: docResult?.state || 'UNKNOWN',
                    sizeBytes: docResult?.sizeBytes || stats.size,
                    mimeType: docResult?.mimeType || mimeType,
                    success: true
                };
                uploadedFiles.push(uploadedFile);
                successCount++;

                if (!outputJson) {
                    console.log('OK');
                }
            } catch (err: any) {
                const uploadedFile: UploadedFile = {
                    filePath: filePath,
                    displayName: displayName,
                    documentName: '',
                    state: 'FAILED',
                    sizeBytes: 0,
                    mimeType: '',
                    success: false,
                    error: err.message
                };
                uploadedFiles.push(uploadedFile);
                failureCount++;

                if (!outputJson) {
                    console.log(`FAILED: ${err.message}`);
                }
            }
        }

        const result: UploadFolderResult = {
            success: failureCount === 0,
            storeName: storeDisplayName,
            folderPath: absoluteFolderPath,
            pattern: pattern,
            recursive: recursive,
            totalFiles: files.length,
            successCount: successCount,
            failureCount: failureCount,
            uploadedFiles: uploadedFiles
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            if (failureCount === 0) {
                console.log('FOLDER UPLOAD COMPLETED SUCCESSFULLY');
            } else {
                console.log('FOLDER UPLOAD COMPLETED WITH ERRORS');
            }
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store:      ${storeDisplayName}`);
            console.log(`  Total:      ${files.length} files`);
            console.log(`  Success:    ${successCount}`);
            console.log(`  Failed:     ${failureCount}`);
            console.log('');
            console.log('='.repeat(60));
        }

        if (failureCount > 0) {
            process.exit(1);
        }

    } catch (error: any) {
        const errorResult: UploadFolderResult = {
            success: false,
            storeName: storeName,
            folderPath: folderPath,
            pattern: pattern,
            recursive: recursive,
            totalFiles: 0,
            successCount: 0,
            failureCount: 0,
            uploadedFiles: [],
            error: error.message
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(60));
            console.error('FOLDER UPLOAD FAILED');
            console.error('='.repeat(60));
            console.error('');
            console.error(`  Store:  ${storeName}`);
            console.error(`  Folder: ${folderPath}`);
            console.error(`  Error:  ${error.message}`);
            console.error('');
            console.error('='.repeat(60));
        }
        process.exit(1);
    }
}

// Parse arguments and run
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json') || args.includes('-j');
const recursiveFlag = args.includes('--recursive') || args.includes('-r');

// Find --pattern or -p flag and its value
let pattern: string | null = null;
for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--pattern' || args[i] === '-p') && i + 1 < args.length) {
        pattern = args[i + 1];
        break;
    }
}

// Filter out flags and their values to get positional arguments
const nonFlagArgs: string[] = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pattern' || args[i] === '-p') {
        i++; // Skip the next argument (the pattern value)
    } else if (!args[i].startsWith('-')) {
        nonFlagArgs.push(args[i]);
    }
}

if (nonFlagArgs.length < 2) {
    console.error('Error: Store name and folder path are required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];
const folderPath = nonFlagArgs[1];

uploadFolder(storeName, folderPath, pattern, recursiveFlag, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
