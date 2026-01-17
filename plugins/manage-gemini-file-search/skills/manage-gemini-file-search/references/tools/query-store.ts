#!/usr/bin/env npx ts-node
/**
 * Prebuilt tool to query a Gemini File Search store.
 *
 * Usage:
 *   npx ts-node query-store.ts <store-name> "<query>"           # Human-readable output
 *   npx ts-node query-store.ts <store-name> "<query>" --json    # JSON output
 *
 * Examples:
 *   npx ts-node query-store.ts my-knowledge-base "What is the return policy?"
 *   npx ts-node query-store.ts project-docs "How do I configure authentication?" --json
 *
 * Environment:
 *   GEMINI_API_KEY - Required. Your Gemini API key.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';

// Get directory of this script for .env loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
config({ path: path.join(__dirname, '.env') });
config(); // Also try current directory

interface QueryResult {
    success: boolean;
    query: string;
    storeName: string;
    answer: string;
    sources: string[];
    excerpts: Array<{ source: string; text: string }>;
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
    console.log('Usage: npx ts-node query-store.ts <store-name> "<query>" [--json]');
    console.log('');
    console.log('Arguments:');
    console.log('  store-name      Display name or API name of the store to query');
    console.log('  query           The question to ask (in quotes)');
    console.log('');
    console.log('Options:');
    console.log('  --json, -j      Output in JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node query-store.ts my-knowledge-base "What is the return policy?"');
    console.log('  npx ts-node query-store.ts project-docs "How to configure auth?" --json');
    console.log('');
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

async function queryStore(storeName: string, query: string, outputJson: boolean): Promise<void> {
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
                const errorResult: QueryResult = {
                    success: false,
                    query: query,
                    storeName: storeName,
                    answer: '',
                    sources: [],
                    excerpts: [],
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

        // Query the store
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                tools: [{
                    fileSearch: {
                        fileSearchStoreNames: [apiName]
                    }
                }]
            }
        });

        // Extract answer
        const answer = response.text || '';

        // Extract sources and excerpts from grounding metadata
        const sources: string[] = [];
        const excerpts: Array<{ source: string; text: string }> = [];

        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
            for (const chunk of groundingMetadata.groundingChunks) {
                if (chunk.retrievedContext) {
                    const source = chunk.retrievedContext.title || 'Unknown';
                    const text = chunk.retrievedContext.text || '';

                    if (!sources.includes(source)) {
                        sources.push(source);
                    }
                    if (text) {
                        excerpts.push({ source, text });
                    }
                }
            }
        }

        const result: QueryResult = {
            success: true,
            query: query,
            storeName: displayName,
            answer: answer,
            sources: sources,
            excerpts: excerpts
        };

        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('');
            console.log('='.repeat(70));
            console.log('QUERY RESULT');
            console.log('='.repeat(70));
            console.log('');
            console.log(`  Store: ${displayName}`);
            console.log(`  Query: ${query}`);
            console.log('');
            console.log('='.repeat(70));
            console.log('ANSWER');
            console.log('='.repeat(70));
            console.log('');
            console.log(answer);
            console.log('');

            if (sources.length > 0) {
                console.log('='.repeat(70));
                console.log('SOURCES');
                console.log('='.repeat(70));
                console.log('');
                for (const source of sources) {
                    console.log(`  - ${source}`);
                }
                console.log('');
            }

            if (excerpts.length > 0) {
                console.log('='.repeat(70));
                console.log('EXCERPTS');
                console.log('='.repeat(70));
                console.log('');
                for (let i = 0; i < excerpts.length; i++) {
                    const excerpt = excerpts[i];
                    console.log(`[${i + 1}] ${excerpt.source}`);
                    console.log('-'.repeat(70));
                    console.log(excerpt.text);
                    console.log('');
                }
            }

            console.log('='.repeat(70));
        }

    } catch (error: any) {
        const errorResult: QueryResult = {
            success: false,
            query: query,
            storeName: storeName,
            answer: '',
            sources: [],
            excerpts: [],
            error: error.message
        };

        if (outputJson) {
            console.log(JSON.stringify(errorResult, null, 2));
        } else {
            console.error('');
            console.error('='.repeat(70));
            console.error('QUERY FAILED');
            console.error('='.repeat(70));
            console.error('');
            console.error(`  Store:  ${storeName}`);
            console.error(`  Query:  ${query}`);
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

// Filter out flags to get positional arguments
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));

if (nonFlagArgs.length < 2) {
    console.error('Error: Store name and query are required');
    printUsage();
    process.exit(1);
}

const storeName = nonFlagArgs[0];
const query = nonFlagArgs[1];

queryStore(storeName, query, jsonFlag).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
});
