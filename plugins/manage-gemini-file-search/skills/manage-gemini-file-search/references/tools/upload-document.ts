#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to upload a document to a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node upload-document.ts <store-name> <file-path>                    # Upload with auto display name
 *   npx ts-node upload-document.ts <store-name> <file-path> --name "Doc Name"  # Upload with custom display name
 *   npx ts-node upload-document.ts <store-name> <file-path> --json             # JSON output
 *
 * Examples:
 *   npx ts-node upload-document.ts my-knowledge-base ./manual.pdf
 *   npx ts-node upload-document.ts my-knowledge-base ./guide.md --name "User Guide"
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

interface UploadResult {
    success: boolean;
    storeName: string;
    filePath: string;
    displayName: string;
    documentName: string;
    state: string;
    sizeBytes: number;
    mimeType: string;
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
    console.log('Usage: npx ts-node upload-document.ts <store-name> <file-path> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the target store');
    console.log('  file-path       Path to the file to upload');
    console.log('');
    console.log('Options:');
    console.log('  --name, -n      Custom display name for the document');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node upload-document.ts my-knowledge-base ./manual.pdf');
    console.log('  npx ts-node upload-document.ts my-knowledge-base ./guide.md --name "User Guide"');
    console.log('');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

async function uploadDocument(
    storeName: string,
    filePath: string,
    customDisplayName: string | null,
    outputJson: boolean
): Promise<void> {
    try {
        // Validate file exists
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            const errorResult: UploadResult = {
                success: false,
                storeName: storeName,
                filePath: filePath,
                displayName: '',
                documentName: '',
                state: '',
                sizeBytes: 0,
                mimeType: '',
                error: `File not found: ${absolutePath}`
            };
            if (outputJson) {
                console.log(JSON.stringify(errorResult, null, 2));
            } else {
                console.error(`Error: File not found: ${absolutePath}`);
            }
            process.exit(1);
        }

        // Get file stats
        const stats = fs.statSync(absolutePath);
        const fileName = path.basename(absolutePath);
        const displayName = customDisplayName || fileName;

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
                const errorResult: UploadResult = {
                    success: false,
                    storeName: storeName,
                    filePath: filePath,
                    displayName: displayName,
                    documentName: '',
                    state: '',
                    sizeBytes: 0,
                    mimeType: '',
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

        if (!outputJson) {
            console.log('');
            console.log('='.repeat(60));
            console.log('UPLOADING DOCUMENT');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store:        ${storeDisplayName}`);
            console.log(`  File:         ${fileName}`);
            console.log(`  Display Name: ${displayName}`);
            console.log(`  Size:         ${(stats.size / 1024).toFixed(1)} KB`);
            console.log('');
            console.log('  Uploading...');
        }

        // Determine MIME type
        const mimeType = getMimeType(absolutePath);

        // Upload the document
        const operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: absolutePath,
            fileSearchStoreName: storeApiName,
            config: {
                displayName: displayName,
                mimeType: mimeType
            }
        });

        // Poll for completion
        let currentOp = operation;
        let dots = 0;
        while (!currentOp.done) {
            await sleep(2000);
            currentOp = await ai.operations.get({ operation: currentOp });
            if (!outputJson) {
                dots++;
                process.stdout.write('.');
                if (dots % 30 === 0) process.stdout.write('\n');
            }
        }

        if (!outputJson && dots > 0) {
            console.log('');
        }

        // Get document details from the result
        const docResult = currentOp.result as any;
        const documentName = docResult?.name || '';
        const state = docResult?.state || 'UNKNOWN';
        const resultMimeType = docResult?.mimeType || mimeType;
        const sizeBytes = docResult?.sizeBytes || stats.size;

        const result: UploadResult = {
            success: true,
            storeName: storeDisplayName,
            filePath: absolutePath,
            displayName: displayName,
            documentName: documentName,
            state: state,
            sizeBytes: sizeBytes,
            mimeType: resultMimeType
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            console.log('DOCUMENT UPLOADED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Display Name:   ${displayName}`);
            console.log(`  Document Name:  ${documentName}`);
            console.log(`  State:          ${state}`);
            console.log(`  Size:           ${(sizeBytes / 1024).toFixed(1)} KB`);
            console.log(`  MIME Type:      ${resultMimeType}`);
            console.log('');
            console.log('='.repeat(60));
        }

    } catch (error: any) {
        const errorResult: UploadResult = {
            success: false,
            storeName: storeName,
            filePath: filePath,
            displayName: customDisplayName || '',
            documentName: '',
            state: '',
            sizeBytes: 0,
            mimeType: '',
            error: error.message
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(60));
            console.error('DOCUMENT UPLOAD FAILED');
            console.error('='.repeat(60));
            console.error('');
            console.error(`  Store:  ${storeName}`);
            console.error(`  File:   ${filePath}`);
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

// Find --name or -n flag and its value
let customName: string | null = null;
for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--name' || args[i] === '-n') && i + 1 < args.length) {
        customName = args[i + 1];
        break;
    }
}

// Filter out flags and their values to get positional arguments
const nonFlagArgs: string[] = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' || args[i] === '-n') {
        i++; // Skip the next argument (the name value)
    } else if (!args[i].startsWith('-')) {
        nonFlagArgs.push(args[i]);
    }
}

if (nonFlagArgs.length < 2) {
    console.error('Error: Store name and file path are required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];
const filePath = nonFlagArgs[1];

uploadDocument(storeName, filePath, customName, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
