#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to list all Gemini File Search stores.
 *
 * Usage:
 *   npx ts-node list-stores.ts           # Human-readable output
 *   npx ts-node list-stores.ts --json    # JSON output for programmatic use
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

interface StoreInfo {
    name: string;
    displayName: string | undefined;
    createTime: string | undefined;
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

async function listStores(outputJson: boolean = false): Promise<void> {
    try {
        const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });

        const stores: StoreInfo[] = [];
        let page = pager.page;

        // Collect all stores from all pages
        while (true) {
            for (const store of page) {
                stores.push({
                    name: store.name || '',
                    displayName: store.displayName,
                    createTime: store.createTime
                });
            }
            if (!pager.hasNextPage()) break;
            page = await pager.nextPage();
        }

        // Output results
        if (outputJson) {
            console.log(JSON.stringify(stores, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            console.log('GEMINI FILE SEARCH STORES');
            console.log('='.repeat(60));
            console.log('');

            if (stores.length === 0) {
                console.log('  No stores found.');
                console.log('');
                console.log('  Create a store using the manage-gemini-file-search skill');
                console.log('  or the Gemini API directly.');
            } else {
                console.log(`  Found ${stores.length} store(s):`);
                console.log('');

                for (let i = 0; i < stores.length; i++) {
                    const store = stores[i];
                    console.log(`  [${i + 1}] ${store.displayName || '(unnamed)'}`);
                    console.log(`      API Name: ${store.name}`);
                    if (store.createTime) {
                        const created = new Date(store.createTime);
                        console.log(`      Created:  ${created.toLocaleString()}`);
                    }
                    console.log('');
                }
            }

            console.log('='.repeat(60));
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

// Parse arguments and run
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json') || args.includes('-j');

listStores(jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
