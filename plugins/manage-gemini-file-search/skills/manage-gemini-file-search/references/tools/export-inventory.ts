#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to export a complete inventory of all Gemini File Search stores and documents.
 *
 * Usage:
 *   npx ts-node export-inventory.ts                           # Output to console
 *   npx ts-node export-inventory.ts --output inventory.json   # Save to file
 *   npx ts-node export-inventory.ts -o ./backup/stores.json   # Save to specific path
 *
 * Examples:
 *   npx ts-node export-inventory.ts
 *   npx ts-node export-inventory.ts --output ~/backups/gemini-inventory.json
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

interface DocumentInfo {
    displayName: string;
    apiName: string;
    state: string;
    sizeBytes: number;
    mimeType: string;
    createTime?: string;
    updateTime?: string;
}

interface StoreInfo {
    displayName: string;
    apiName: string;
    createTime?: string;
    documentCount: number;
    totalSizeBytes: number;
    documents: DocumentInfo[];
}

interface Inventory {
    exportDate: string;
    storeCount: number;
    totalDocuments: number;
    totalSizeBytes: number;
    stores: StoreInfo[];
}

interface ExportResult {
    success: boolean;
    outputPath?: string;
    inventory?: Inventory;
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
    console.log('Usage: npx ts-node export-inventory.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --output, -o    Path to save the inventory JSON file');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node export-inventory.ts');
    console.log('  npx ts-node export-inventory.ts --output inventory.json');
    console.log('  npx ts-node export-inventory.ts -o ~/backups/gemini-stores.json');
    console.log('');
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Initialize client with explicit GEMINI_API_KEY
// Temporarily remove GOOGLE_API_KEY to prevent library warning
validateEnvironment();
const _googleKeyBackup = process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
if (_googleKeyBackup) process.env.GOOGLE_API_KEY = _googleKeyBackup;

async function listAllStores(): Promise<any[]> {
    const stores: any[] = [];
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    let page = pager.page;

    while (true) {
        for (const store of page) {
            stores.push(store);
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return stores;
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
                displayName: doc.displayName || '',
                apiName: doc.name || '',
                state: doc.state || 'UNKNOWN',
                sizeBytes: doc.sizeBytes || 0,
                mimeType: doc.mimeType || '',
                createTime: doc.createTime || undefined,
                updateTime: doc.updateTime || undefined
            });
        }
        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
    }
    return documents;
}

async function exportInventory(outputPath: string | null): Promise<void> {
    try {
        const toConsole = !outputPath;

        if (!toConsole) {
            process.stderr.write('Fetching stores...');
        }

        // Get all stores
        const rawStores = await listAllStores();

        if (!toConsole) {
            process.stderr.write(` found ${rawStores.length}\n`);
        }

        const stores: StoreInfo[] = [];
        let totalDocuments = 0;
        let totalSizeBytes = 0;

        for (let i = 0; i < rawStores.length; i++) {
            const rawStore = rawStores[i];

            if (!toConsole) {
                process.stderr.write(`  [${i + 1}/${rawStores.length}] ${rawStore.displayName || rawStore.name}...`);
            }

            const documents = await listDocuments(rawStore.name);
            const storeTotalSize = documents.reduce((sum, doc) => sum + doc.sizeBytes, 0);

            const storeInfo: StoreInfo = {
                displayName: rawStore.displayName || '',
                apiName: rawStore.name || '',
                createTime: rawStore.createTime || undefined,
                documentCount: documents.length,
                totalSizeBytes: storeTotalSize,
                documents: documents
            };

            stores.push(storeInfo);
            totalDocuments += documents.length;
            totalSizeBytes += storeTotalSize;

            if (!toConsole) {
                process.stderr.write(` ${documents.length} docs\n`);
            }
        }

        const inventory: Inventory = {
            exportDate: new Date().toISOString(),
            storeCount: stores.length,
            totalDocuments: totalDocuments,
            totalSizeBytes: totalSizeBytes,
            stores: stores
        };

        const jsonOutput = JSON.stringify(inventory, null, 2);

        if (outputPath) {
            // Ensure directory exists
            const dir = path.dirname(path.resolve(outputPath));
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to file
            fs.writeFileSync(path.resolve(outputPath), jsonOutput);

            console.log('');
            console.log('='.repeat(60));
            console.log('INVENTORY EXPORTED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Output File:      ${path.resolve(outputPath)}`);
            console.log(`  Export Date:      ${new Date().toLocaleString()}`);
            console.log('');
            console.log(`  Total Stores:     ${stores.length}`);
            console.log(`  Total Documents:  ${totalDocuments}`);
            console.log(`  Total Size:       ${formatBytes(totalSizeBytes)}`);
            console.log('');

            if (stores.length > 0) {
                console.log('-'.repeat(60));
                console.log('STORES SUMMARY');
                console.log('-'.repeat(60));
                console.log('');
                for (const store of stores) {
                    console.log(`  ${store.displayName}`);
                    console.log(`    Documents: ${store.documentCount}`);
                    console.log(`    Size:      ${formatBytes(store.totalSizeBytes)}`);
                    console.log('');
                }
            }

            console.log('='.repeat(60));
        } else {
            // Output to console
            console.log(jsonOutput);
        }

    } catch (error: any) {
        const errorResult: ExportResult = {
            success: false,
            error: error.message
        };

        if (outputPath) {
            console.error('');
            console.error('='.repeat(60));
            console.error('INVENTORY EXPORT FAILED');
            console.error('='.repeat(60));
            console.error('');
            console.error(`  Error:  ${error.message}`);
            console.error('');
            console.error('='.repeat(60));
        } else {
            console.log(JSON.stringify(errorResult, null, 2));
        }
        process.exit(1);
    }
}

// Parse arguments and run
const args = process.argv.slice(2);

// Check for help flag
if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
}

// Find --output or -o flag and its value
let outputPath: string | null = null;
for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--output' || args[i] === '-o') && i + 1 < args.length) {
        outputPath = args[i + 1];
        break;
    }
}

exportInventory(outputPath).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
