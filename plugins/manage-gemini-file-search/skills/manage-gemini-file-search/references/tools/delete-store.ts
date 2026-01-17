#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to delete a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node delete-store.ts <store-name>           # Delete by display name
 *   npx ts-node delete-store.ts <store-name> --force   # Skip confirmation
 *   npx ts-node delete-store.ts <store-name> --json    # JSON output
 *
 * Examples:
 *   npx ts-node delete-store.ts my-knowledge-base
 *   npx ts-node delete-store.ts "fileSearchStores/abc..." --force
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

interface DeleteStoreResult {
    success: boolean;
    storeName: string;
    apiName: string;
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
    console.log('Usage: npx ts-node delete-store.ts <store-name> [--force] [--json]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the store to delete');
    console.log('');
    console.log('Options:');
    console.log('  --force, -f     Skip confirmation prompt');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node delete-store.ts my-knowledge-base');
    console.log('  npx ts-node delete-store.ts "fileSearchStores/abc..." --force');
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

async function deleteStore(storeName: string, force: boolean, outputJson: boolean): Promise<void> {
    try {
        let apiName: string;
        let displayName: string;

        // Check if it's an API name or display name
        if (storeName.startsWith('fileSearchStores/')) {
            apiName = storeName;
            displayName = storeName;
        } else {
            // Find store by display name
            const store = await findStoreByDisplayName(storeName);
            if (!store) {
                const errorResult: DeleteStoreResult = {
                    success: false,
                    storeName: storeName,
                    apiName: '',
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
            apiName = store.name;
            displayName = store.displayName;
        }

        // Confirm deletion unless --force is used
        if (!force && !outputJson) {
            console.log('');
            console.log('='.repeat(60));
            console.log('DELETE STORE CONFIRMATION');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Display Name: ${displayName}`);
            console.log(`  API Name:     ${apiName}`);
            console.log('');
            console.log('  WARNING: This will permanently delete the store');
            console.log('           and ALL documents within it!');
            console.log('');

            const confirmed = await askConfirmation('  Are you sure? (y/N): ');
            if (!confirmed) {
                console.log('');
                console.log('  Deletion cancelled.');
                console.log('');
                process.exit(0);
            }
        }

        // Delete the store
        await ai.fileSearchStores.delete({
            name: apiName,
            config: { force: true }
        });

        const result: DeleteStoreResult = {
            success: true,
            storeName: displayName,
            apiName: apiName
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            console.log('STORE DELETED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Display Name: ${displayName}`);
            console.log(`  API Name:     ${apiName}`);
            console.log('');
            console.log('='.repeat(60));
        }

    } catch (error: any) {
        const errorResult: DeleteStoreResult = {
            success: false,
            storeName: storeName,
            apiName: '',
            error: error.message
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(60));
            console.error('STORE DELETION FAILED');
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

// Filter out flags to get the store name
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));

if (nonFlagArgs.length === 0) {
    console.error('Error: Store name is required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];

deleteStore(storeName, forceFlag, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
