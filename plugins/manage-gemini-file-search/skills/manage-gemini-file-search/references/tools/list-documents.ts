#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to list documents in a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node list-documents.ts <store-name-or-display-name>
 *   npx ts-node list-documents.ts <store-name-or-display-name> --json
 *
 * Arguments:
 *   store-name-or-display-name - The store's API name (fileSearchStores/xxx)
 *                                 or display name (e.g., "my-knowledge-base")
 *
 * Environment:
 *   GEMINI_API_KEY - Required. Your Gemini API key.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';

// Get directory of this script for .env loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
config({ path: path.join(__dirname, '.env') });
config(); // Also try current directory

interface DocumentInfo {
    name: string;
    displayName: string | undefined;
    state: string | undefined;
    sizeBytes: number | undefined;
    mimeType: string | undefined;
    createTime: string | undefined;
}

interface StoreInfo {
    name: string;
    displayName: string | undefined;
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

// Initialize client with explicit GEMINI_API_KEY
// Temporarily remove GOOGLE_API_KEY to prevent library warning
validateEnvironment();
const _googleKeyBackup = process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
if (_googleKeyBackup) process.env.GOOGLE_API_KEY = _googleKeyBackup;

async function findStoreByDisplayName(displayName: string): Promise<string | null> {
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    let page = pager.page;

    while (true) {
        for (const store of page) {
            if (store.displayName === displayName) {
                return store.name || null;
            }
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }

    return null;
}

async function listDocuments(storeIdentifier: string, outputJson: boolean = false): Promise<void> {
    try {

        // Resolve store name - check if it's already an API name or a display name
        let storeName: string;
        let storeDisplayName: string | undefined;

        if (storeIdentifier.startsWith('fileSearchStores/')) {
            // Already an API name
            storeName = storeIdentifier;
        } else {
            // Try to find by display name
            const found = await findStoreByDisplayName(storeIdentifier);
            if (!found) {
                if (outputJson) {
                    console.log(JSON.stringify({ error: `Store not found: ${storeIdentifier}` }, null, 2));
                } else {
                    console.error(`Error: Store not found: "${storeIdentifier}"`);
                    console.error('');
                    console.error('Use "npx ts-node list-stores.ts" to see available stores.');
                }
                process.exit(1);
            }
            storeName = found;
            storeDisplayName = storeIdentifier;
        }

        // List documents
        const pager = await ai.fileSearchStores.documents.list({ parent: storeName });
        const documents: DocumentInfo[] = [];

        for await (const doc of pager) {
            documents.push({
                name: doc.name || '',
                displayName: doc.displayName,
                state: doc.state,
                sizeBytes: doc.sizeBytes,
                mimeType: doc.mimeType,
                createTime: doc.createTime
            });
        }

        // Output results
        if (outputJson) {
            console.log(JSON.stringify({
                storeName,
                storeDisplayName,
                documents
            }, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            console.log(`DOCUMENTS IN STORE: ${storeDisplayName || storeName}`);
            console.log('='.repeat(60));
            console.log('');

            if (documents.length === 0) {
                console.log('  No documents found in this store.');
                console.log('');
                console.log('  Upload documents using the manage-gemini-file-search skill.');
            } else {
                console.log(`  Found ${documents.length} document(s):`);
                console.log('');

                for (let i = 0; i < documents.length; i++) {
                    const doc = documents[i];
                    const stateIcon = doc.state === 'ACTIVE' ? '[OK]' :
                                      doc.state === 'PENDING' ? '[...]' :
                                      doc.state === 'FAILED' ? '[X]' : '[?]';

                    console.log(`  ${stateIcon} [${i + 1}] ${doc.displayName || '(unnamed)'}`);
                    console.log(`        State: ${doc.state || 'Unknown'}`);
                    if (doc.sizeBytes) {
                        const sizeKB = (doc.sizeBytes / 1024).toFixed(1);
                        console.log(`        Size:  ${sizeKB} KB`);
                    }
                    if (doc.mimeType) {
                        console.log(`        Type:  ${doc.mimeType}`);
                    }
                    console.log(`        Name:  ${doc.name}`);
                    console.log('');
                }
            }

            console.log('='.repeat(60));
            console.log('');
            console.log('Legend: [OK] Active  [...] Pending  [X] Failed');
        }

    } catch (error: any) {
        if (outputJson) {
            console.log(JSON.stringify({ error: error.message }, null, 2));
        } else {
            console.error(`Error: ${error.message}`);
        }
        process.exit(1);
    }
}

// Parse arguments
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json') || args.includes('-j');
const storeArg = args.find(arg => !arg.startsWith('-'));

if (!storeArg) {
    console.error('Usage: npx ts-node list-documents.ts <store-name-or-display-name> [--json]');
    console.error('');
    console.error('Examples:');
    console.error('  npx ts-node list-documents.ts my-knowledge-base');
    console.error('  npx ts-node list-documents.ts "fileSearchStores/abc123..." --json');
    console.error('');
    console.error('Use "npx ts-node list-stores.ts" to see available stores.');
    process.exit(1);
}

listDocuments(storeArg, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
