#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to get detailed information about a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node get-store-info.ts <store-name>           # Human-readable output
 *   npx ts-node get-store-info.ts <store-name> --json    # JSON output
 *
 * Examples:
 *   npx ts-node get-store-info.ts my-knowledge-base
 *   npx ts-node get-store-info.ts "fileSearchStores/abc..." --json
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

interface DocumentSummary {
    displayName: string;
    apiName: string;
    state: string;
    sizeBytes: number;
    mimeType: string;
}

interface StoreInfo {
    success: boolean;
    displayName: string;
    apiName: string;
    createTime: string;
    documentCount: number;
    totalSizeBytes: number;
    activeDocuments: number;
    pendingDocuments: number;
    failedDocuments: number;
    documents: DocumentSummary[];
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
    console.log('Usage: npx ts-node get-store-info.ts <store-name> [--json]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the store');
    console.log('');
    console.log('Options:');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node get-store-info.ts my-knowledge-base');
    console.log('  npx ts-node get-store-info.ts "fileSearchStores/abc..." --json');
    console.log('');
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    try {
        return new Date(dateString).toLocaleString();
    } catch {
        return dateString;
    }
}

// Initialize client with explicit GEMINI_API_KEY
// Temporarily remove GOOGLE_API_KEY to prevent library warning
validateEnvironment();
const _googleKeyBackup = process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
if (_googleKeyBackup) process.env.GOOGLE_API_KEY = _googleKeyBackup;

async function findStoreByDisplayName(displayName: string): Promise<any | null> {
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    let page = pager.page;

    while (true) {
        for (const store of page) {
            if (store.displayName === displayName) {
                return store;
            }
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return null;
}

async function getStoreByApiName(apiName: string): Promise<any | null> {
    try {
        const store = await ai.fileSearchStores.get({ name: apiName });
        return store;
    } catch {
        return null;
    }
}

async function listDocuments(storeApiName: string): Promise<DocumentSummary[]> {
    const documents: DocumentSummary[] = [];
    const pager = await ai.fileSearchStores.documents.list({
        parent: storeApiName,
        config: { pageSize: 20 }
    });
    let page = pager.page;

    while (true) {
        for (const doc of page) {
            documents.push({
                displayName: doc.displayName || '',
                apiName: doc.name || '',
                state: doc.state || 'UNKNOWN',
                sizeBytes: doc.sizeBytes || 0,
                mimeType: doc.mimeType || ''
            });
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return documents;
}

async function getStoreInfo(storeName: string, outputJson: boolean): Promise<void> {
    try {
        let store: any;

        // Check if it's an API name or display name
        if (storeName.startsWith('fileSearchStores/')) {
            store = await getStoreByApiName(storeName);
        } else {
            store = await findStoreByDisplayName(storeName);
        }

        if (!store) {
            const errorResult: StoreInfo = {
                success: false,
                displayName: '',
                apiName: '',
                createTime: '',
                documentCount: 0,
                totalSizeBytes: 0,
                activeDocuments: 0,
                pendingDocuments: 0,
                failedDocuments: 0,
                documents: [],
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

        // Get documents
        const documents = await listDocuments(store.name);

        // Calculate statistics
        const totalSizeBytes = documents.reduce((sum, doc) => sum + doc.sizeBytes, 0);
        const activeDocuments = documents.filter(d => d.state === 'ACTIVE' || d.state === 'STATE_ACTIVE').length;
        const pendingDocuments = documents.filter(d => d.state === 'PENDING' || d.state === 'PROCESSING' || d.state === 'STATE_PENDING' || d.state === 'STATE_PROCESSING').length;
        const failedDocuments = documents.filter(d => d.state === 'FAILED' || d.state === 'STATE_FAILED').length;

        const result: StoreInfo = {
            success: true,
            displayName: store.displayName || '',
            apiName: store.name || '',
            createTime: store.createTime || '',
            documentCount: documents.length,
            totalSizeBytes: totalSizeBytes,
            activeDocuments: activeDocuments,
            pendingDocuments: pendingDocuments,
            failedDocuments: failedDocuments,
            documents: documents
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(70));
            console.log('STORE INFORMATION');
            console.log('='.repeat(70));
            console.log('');
            console.log(`  Display Name:      ${result.displayName}`);
            console.log(`  API Name:          ${result.apiName}`);
            console.log(`  Created:           ${formatDate(result.createTime)}`);
            console.log('');
            console.log('-'.repeat(70));
            console.log('STATISTICS');
            console.log('-'.repeat(70));
            console.log('');
            console.log(`  Total Documents:   ${result.documentCount}`);
            console.log(`  Total Size:        ${formatBytes(result.totalSizeBytes)}`);
            console.log('');
            console.log(`  Active:            ${activeDocuments}`);
            console.log(`  Pending:           ${pendingDocuments}`);
            console.log(`  Failed:            ${failedDocuments}`);
            console.log('');

            if (documents.length > 0) {
                console.log('-'.repeat(70));
                console.log('DOCUMENTS');
                console.log('-'.repeat(70));
                console.log('');

                // Group by state
                const stateIcon: Record<string, string> = {
                    'ACTIVE': '[OK]',
                    'STATE_ACTIVE': '[OK]',
                    'PENDING': '[...]',
                    'STATE_PENDING': '[...]',
                    'PROCESSING': '[...]',
                    'STATE_PROCESSING': '[...]',
                    'FAILED': '[X]',
                    'STATE_FAILED': '[X]'
                };

                for (let i = 0; i < documents.length; i++) {
                    const doc = documents[i];
                    const icon = stateIcon[doc.state] || '[?]';
                    console.log(`  ${icon} [${i + 1}] ${doc.displayName}`);
                    console.log(`        State:     ${doc.state}`);
                    console.log(`        Size:      ${formatBytes(doc.sizeBytes)}`);
                    console.log(`        MIME Type: ${doc.mimeType}`);
                    console.log('');
                }

                console.log('  Legend: [OK] Active  [...] Pending  [X] Failed');
                console.log('');
            }

            console.log('='.repeat(70));
        }

    } catch (error: any) {
        const errorResult: StoreInfo = {
            success: false,
            displayName: '',
            apiName: '',
            createTime: '',
            documentCount: 0,
            totalSizeBytes: 0,
            activeDocuments: 0,
            pendingDocuments: 0,
            failedDocuments: 0,
            documents: [],
            error: error.message
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(70));
            console.error('GET STORE INFO FAILED');
            console.error('='.repeat(70));
            console.error('');
            console.error(`  Store:  ${storeName}`);
            console.error(`  Error:  ${error.message}`);
            console.error('');
            console.error('='.repeat(70));
        }
        process.exit(1);
    }
}

// Parse arguments and run
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json') || args.includes('-j');

// Filter out flags to get the store name
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));

if (nonFlagArgs.length === 0) {
    console.error('Error: Store name is required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];

getStoreInfo(storeName, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
