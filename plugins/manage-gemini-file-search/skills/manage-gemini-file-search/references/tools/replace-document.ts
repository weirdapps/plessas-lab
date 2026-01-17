#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to replace a document in a Gemini File Search store.
 * Since documents are immutable, this deletes the existing document and uploads the new one.
 *
 * Usage:
 *   npx ts-node replace-document.ts <store-name> <doc-name> <file-path>           # Replace by display name
 *   npx ts-node replace-document.ts <store-name> <doc-name> <file-path> --force   # Skip confirmation
 *   npx ts-node replace-document.ts <store-name> <doc-name> <file-path> --json    # JSON output
 *
 * Examples:
 *   npx ts-node replace-document.ts my-knowledge-base "Product Manual" ./manual-v2.pdf
 *   npx ts-node replace-document.ts my-knowledge-base "Guide" ./guide-updated.md --force
 *
 * Environment:
 *   GEMINI_API_KEY - Required. Your Gemini API key.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

// Get directory of this script for .env loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
config({ path: path.join(__dirname, '.env') });
config(); // Also try current directory

interface ReplaceResult {
    success: boolean;
    storeName: string;
    documentName: string;
    oldDocumentApiName: string;
    newDocumentApiName: string;
    filePath: string;
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
    console.log('Usage: npx ts-node replace-document.ts <store-name> <doc-name> <file-path> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the store');
    console.log('  doc-name        Display name of the document to replace');
    console.log('  file-path       Path to the new file');
    console.log('');
    console.log('Options:');
    console.log('  --force, -f     Skip confirmation prompt');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node replace-document.ts my-knowledge-base "Product Manual" ./manual-v2.pdf');
    console.log('  npx ts-node replace-document.ts my-knowledge-base "Guide" ./guide.md --force');
    console.log('');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function askConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
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

interface DocumentInfo {
    name: string;
    displayName: string;
    sizeBytes: number;
    mimeType: string;
}

async function findDocumentByDisplayName(storeApiName: string, displayName: string): Promise<DocumentInfo | null> {
    const pager = await ai.fileSearchStores.documents.list({
        parent: storeApiName,
        config: { pageSize: 20 }
    });
    let page = pager.page;

    while (true) {
        for (const doc of page) {
            if (doc.displayName === displayName) {
                return {
                    name: doc.name || '',
                    displayName: doc.displayName || '',
                    sizeBytes: doc.sizeBytes || 0,
                    mimeType: doc.mimeType || ''
                };
            }
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return null;
}

async function replaceDocument(
    storeName: string,
    docName: string,
    filePath: string,
    force: boolean,
    outputJson: boolean
): Promise<void> {
    try {
        // Validate file exists
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            const errorResult: ReplaceResult = {
                success: false,
                storeName: storeName,
                documentName: docName,
                oldDocumentApiName: '',
                newDocumentApiName: '',
                filePath: filePath,
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
                const errorResult: ReplaceResult = {
                    success: false,
                    storeName: storeName,
                    documentName: docName,
                    oldDocumentApiName: '',
                    newDocumentApiName: '',
                    filePath: filePath,
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

        // Find existing document
        const existingDoc = await findDocumentByDisplayName(storeApiName, docName);
        if (!existingDoc) {
            const errorResult: ReplaceResult = {
                success: false,
                storeName: storeDisplayName,
                documentName: docName,
                oldDocumentApiName: '',
                newDocumentApiName: '',
                filePath: filePath,
                state: '',
                sizeBytes: 0,
                mimeType: '',
                error: `Document not found: ${docName}`
            };
            if (outputJson) {
                console.log(JSON.stringify(errorResult, null, 2));
            } else {
                console.error(`Error: Document not found: ${docName}`);
                console.error('');
                console.error(`Use "npx ts-node list-documents.ts ${storeName}" to see available documents.`);
            }
            process.exit(1);
        }

        const stats = fs.statSync(absolutePath);
        const mimeType = getMimeType(absolutePath);

        // Confirm replacement unless --force is used
        if (!force && !outputJson) {
            console.log('');
            console.log('='.repeat(60));
            console.log('REPLACE DOCUMENT CONFIRMATION');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store:            ${storeDisplayName}`);
            console.log(`  Document:         ${docName}`);
            console.log('');
            console.log('  Current version:');
            console.log(`    Size:           ${(existingDoc.sizeBytes / 1024).toFixed(1)} KB`);
            console.log(`    MIME Type:      ${existingDoc.mimeType}`);
            console.log('');
            console.log('  New version:');
            console.log(`    File:           ${absolutePath}`);
            console.log(`    Size:           ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`    MIME Type:      ${mimeType}`);
            console.log('');
            console.log('  WARNING: The current document will be deleted!');
            console.log('');

            const confirmed = await askConfirmation('  Are you sure? (y/N): ');
            if (!confirmed) {
                console.log('');
                console.log('  Replacement cancelled.');
                console.log('');
                process.exit(0);
            }
        }

        if (!outputJson) {
            console.log('');
            console.log('  Step 1: Deleting existing document...');
        }

        // Delete existing document
        await ai.fileSearchStores.documents.delete({
            name: existingDoc.name,
            config: { force: true }
        });

        if (!outputJson) {
            console.log('  Step 2: Uploading new document...');
        }

        // Upload new document
        const operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: absolutePath,
            fileSearchStoreName: storeApiName,
            config: {
                displayName: docName,
                mimeType: mimeType
            }
        });

        // Poll for completion
        let currentOp = operation;
        while (!currentOp.done) {
            await sleep(2000);
            currentOp = await ai.operations.get({ operation: currentOp });
            if (!outputJson) {
                process.stdout.write('.');
            }
        }

        if (!outputJson) {
            console.log(' done');
        }

        // Get document details from the result
        const docResult = currentOp.result as any;
        const newDocumentName = docResult?.name || '';
        const state = docResult?.state || 'UNKNOWN';
        const resultMimeType = docResult?.mimeType || mimeType;
        const sizeBytes = docResult?.sizeBytes || stats.size;

        const result: ReplaceResult = {
            success: true,
            storeName: storeDisplayName,
            documentName: docName,
            oldDocumentApiName: existingDoc.name,
            newDocumentApiName: newDocumentName,
            filePath: absolutePath,
            state: state,
            sizeBytes: sizeBytes,
            mimeType: resultMimeType
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            console.log('DOCUMENT REPLACED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store:            ${storeDisplayName}`);
            console.log(`  Document:         ${docName}`);
            console.log(`  New API Name:     ${newDocumentName}`);
            console.log(`  State:            ${state}`);
            console.log(`  Size:             ${(sizeBytes / 1024).toFixed(1)} KB`);
            console.log(`  MIME Type:        ${resultMimeType}`);
            console.log('');
            console.log('='.repeat(60));
        }

    } catch (error: any) {
        const errorResult: ReplaceResult = {
            success: false,
            storeName: storeName,
            documentName: docName,
            oldDocumentApiName: '',
            newDocumentApiName: '',
            filePath: filePath,
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
            console.error('DOCUMENT REPLACEMENT FAILED');
            console.error('='.repeat(60));
            console.error('');
            console.error(`  Store:     ${storeName}`);
            console.error(`  Document:  ${docName}`);
            console.error(`  File:      ${filePath}`);
            console.error(`  Error:     ${error.message}`);
            console.error('');
            console.error('='.repeat(60));
        }
        process.exit(1);
    }
}

// Parse arguments and run
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json') || args.includes('-j');
const forceFlag = args.includes('--force') || args.includes('-f');

// Filter out flags to get positional arguments
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));

if (nonFlagArgs.length < 3) {
    console.error('Error: Store name, document name, and file path are required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];
const docName = nonFlagArgs[1];
const filePath = nonFlagArgs[2];

replaceDocument(storeName, docName, filePath, forceFlag, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
