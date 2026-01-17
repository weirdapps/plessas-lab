#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to create a new Gemini File Search store.
 *
 * Usage:
 *   npx ts-node create-store.ts <display-name>           # Human-readable output
 *   npx ts-node create-store.ts <display-name> --json    # JSON output for programmatic use
 *
 * Examples:
 *   npx ts-node create-store.ts my-knowledge-base
 *   npx ts-node create-store.ts "Project Documentation" --json
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

interface CreateStoreResult {
    success: boolean;
    name: string;
    displayName: string;
    createTime: string | undefined;
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
    console.log('Usage: npx ts-node create-store.ts <display-name> [--json]');
    console.log('');
    console.log('Arguments:');
    console.log('  display-name    The display name for the new store');
    console.log('');
    console.log('Options:');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node create-store.ts my-knowledge-base');
    console.log('  npx ts-node create-store.ts "Project Documentation" --json');
    console.log('');
}

// Initialize client with explicit GEMINI_API_KEY
// Temporarily remove GOOGLE_API_KEY to prevent library warning
validateEnvironment();
const _googleKeyBackup = process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
if (_googleKeyBackup) process.env.GOOGLE_API_KEY = _googleKeyBackup;

async function createStore(displayName: string, outputJson: boolean = false): Promise<void> {
    try {
        // Create the store
        const store = await ai.fileSearchStores.create({
            config: {
                displayName: displayName
            }
        });

        const result: CreateStoreResult = {
            success: true,
            name: store.name || '',
            displayName: store.displayName || displayName,
            createTime: store.createTime
        };

        // Output results
        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(60));
            console.log('STORE CREATED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('');
            console.log(`  Display Name: ${result.displayName}`);
            console.log(`  API Name:     ${result.name}`);
            if (result.createTime) {
                const created = new Date(result.createTime);
                console.log(`  Created:      ${created.toLocaleString()}`);
            }
            console.log('');
            console.log('-'.repeat(60));
            console.log('  Next steps:');
            console.log('');
            console.log('  1. Upload documents to this store:');
            console.log(`     npx ts-node upload-document.ts "${result.displayName}" /path/to/file.pdf`);
            console.log('');
            console.log('  2. List documents in this store:');
            console.log(`     npx ts-node list-documents.ts "${result.displayName}"`);
            console.log('');
            console.log('='.repeat(60));
        }

    } catch (error: any) {
        const errorResult = {
            success: false,
            error: error.message,
            name: '',
            displayName: displayName,
            createTime: undefined
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(60));
            console.error('STORE CREATION FAILED');
            console.error('='.repeat(60));
            console.error('');
            console.error(`  Display Name: ${displayName}`);
            console.error(`  Error:        ${error.message}`);
            console.error('');
            console.error('='.repeat(60));
        }
        process.exit(1);
    }
}

// Parse arguments and run
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json') || args.includes('-j');

// Filter out flags to get the display name
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));

if (nonFlagArgs.length === 0) {
    console.error('Error: Store display name is required');
    printUsage();
    process.exit(1);
}

const displayName = nonFlagArgs[0];

createStore(displayName, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
