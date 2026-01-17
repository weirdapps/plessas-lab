#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to remove documents from a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node remove-documents.ts <store-name> <doc-name>           # Remove single document
 *   npx ts-node remove-documents.ts <store-name> --all                # Remove all documents
 *   npx ts-node remove-documents.ts <store-name> <doc-name> --force   # Skip confirmation
 *   npx ts-node remove-documents.ts <store-name> <doc-name> --json    # JSON output
 *
 * Examples:
 *   npx ts-node remove-documents.ts my-knowledge-base "Product Manual"
 *   npx ts-node remove-documents.ts my-knowledge-base --all --force
 *
 * Environment:
 *   GEMINI_API_KEY - Required. Your Gemini API key.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as readline from 'readline';

// Get directory of this script for .env loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
config({ path: path.join(__dirname, '.env') });
config(); // Also try current directory

interface RemoveResult {
    success: boolean;
    storeName: string;
    documentsRemoved: string[];
    totalRemoved: number;
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
    console.log('Usage: npx ts-node remove-documents.ts <store-name> <doc-name|--all> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the store');
    console.log('  doc-name        Display name or API name of the document to remove');
    console.log('');
    console.log('Options:');
    console.log('  --all, -a       Remove all documents from the store');
    console.log('  --force, -f     Skip confirmation prompt');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node remove-documents.ts my-knowledge-base "Product Manual"');
    console.log('  npx ts-node remove-documents.ts my-knowledge-base --all --force');
    console.log('');
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
}

async function listDocuments(storeApiName: string): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = [];
    const pager = await ai.fileSearchStores.documents.list({
        parent: storeApiName,
        config: { pageSize: 20 }
    });
    let page = pager.page;

    while (true) {
        for (const doc of page) {
            documents.push({
                name: doc.name || '',
                displayName: doc.displayName || ''
            });
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return documents;
}

async function findDocumentByDisplayName(storeApiName: string, displayName: string): Promise<DocumentInfo | null> {
    const documents = await listDocuments(storeApiName);
    for (const doc of documents) {
        if (doc.displayName === displayName) {
            return doc;
        }
    }
    return null;
}

async function removeDocuments(
    storeName: string,
    docName: string | null,
    removeAll: boolean,
    force: boolean,
    outputJson: boolean
): Promise<void> {
    try {
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
                const errorResult: RemoveResult = {
                    success: false,
                    storeName: storeName,
                    documentsRemoved: [],
                    totalRemoved: 0,
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

        // Get documents to remove
        let documentsToRemove: DocumentInfo[] = [];

        if (removeAll) {
            documentsToRemove = await listDocuments(storeApiName);
            if (documentsToRemove.length === 0) {
                const result: RemoveResult = {
                    success: true,
                    storeName: storeDisplayName,
                    documentsRemoved: [],
                    totalRemoved: 0
                };
                if (outputJson) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log('');
                    console.log('No documents found in store.');
                    console.log('');
                }
                return;
            }
        } else if (docName) {
            // Check if it's an API name
            if (docName.includes('/documents/')) {
                documentsToRemove = [{ name: docName, displayName: docName }];
            } else {
                // Find by display name
                const doc = await findDocumentByDisplayName(storeApiName, docName);
                if (!doc) {
                    const errorResult: RemoveResult = {
                        success: false,
                        storeName: storeDisplayName,
                        documentsRemoved: [],
                        totalRemoved: 0,
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
                documentsToRemove = [doc];
            }
        }

        // Confirm deletion unless --force is used
        if (!force && !outputJson) {
            console.log('');
            console.log('='.repeat(60));
            console.log('REMOVE DOCUMENTS CONFIRMATION');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store: ${storeDisplayName}`);
            console.log('');
            console.log(`  Documents to remove (${documentsToRemove.length}):`);
            for (const doc of documentsToRemove) {
                console.log(`    - ${doc.displayName || doc.name}`);
            }
            console.log('');
            console.log('  WARNING: This action cannot be undone!');
            console.log('');

            const confirmed = await askConfirmation('  Are you sure? (y/N): ');
            if (!confirmed) {
                console.log('');
                console.log('  Removal cancelled.');
                console.log('');
                process.exit(0);
            }
        }

        // Remove documents
        const removed: string[] = [];
        const errors: string[] = [];

        if (!outputJson) {
            console.log('');
            console.log('  Removing documents...');
        }

        for (const doc of documentsToRemove) {
            try {
                await ai.fileSearchStores.documents.delete({
                    name: doc.name,
                    config: { force: true }
                });
                removed.push(doc.displayName || doc.name);
                if (!outputJson) {
                    console.log(`    [OK] ${doc.displayName || doc.name}`);
                }
            } catch (err: any) {
                errors.push(`${doc.displayName}: ${err.message}`);
                if (!outputJson) {
                    console.log(`    [FAIL] ${doc.displayName || doc.name}: ${err.message}`);
                }
            }
        }

        const result: RemoveResult = {
            success: errors.length === 0,
            storeName: storeDisplayName,
            documentsRemoved: removed,
            totalRemoved: removed.length,
            error: errors.length > 0 ? errors.join('; ') : undefined
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            if (errors.length === 0) {
                console.log('DOCUMENTS REMOVED SUCCESSFULLY');
            } else {
                console.log('DOCUMENTS REMOVAL COMPLETED WITH ERRORS');
            }
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Store:           ${storeDisplayName}`);
            console.log(`  Total Removed:   ${removed.length}`);
            if (errors.length > 0) {
                console.log(`  Errors:          ${errors.length}`);
            }
            console.log('');
            console.log('='.repeat(60));
        }

        if (errors.length > 0) {
            process.exit(1);
        }

    } catch (error: any) {
        const errorResult: RemoveResult = {
            success: false,
            storeName: storeName,
            documentsRemoved: [],
            totalRemoved: 0,
            error: error.message
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(60));
            console.error('DOCUMENT REMOVAL FAILED');
            console.error('='.repeat(60));
            console.error('');
            console.error(`  Store:  ${storeName}`);
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
const forceFlag = args.includes('--force') || args.includes('-f');
const allFlag = args.includes('--all') || args.includes('-a');

// Filter out flags to get positional arguments
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));

if (nonFlagArgs.length === 0) {
    console.error('Error: Store name is required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];
const docName = nonFlagArgs.length > 1 ? nonFlagArgs[1] : null;

if (!allFlag && !docName) {
    console.error('Error: Document name or --all flag is required');
    printUsage();
    process.exit(1);
}

removeDocuments(storeName, docName, allFlag, forceFlag, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
