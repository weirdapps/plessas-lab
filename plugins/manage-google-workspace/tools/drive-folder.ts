#!/usr/bin/env npx tsx
/**
 * Drive Folder CLI Tool
 *
 * Create and manage folders in Google Drive.
 *
 * Usage:
 *   npx tsx drive-folder.ts --action "create" --name "FolderName" [options]
 *
 * Actions:
 *   create        - Create a single folder
 *   create-path   - Create nested folder path
 *   tree          - Get hierarchical folder tree
 *   contents      - Get folder contents recursively
 *   add-shortcut  - Add file shortcut to a folder
 *   organize      - Organize files by MIME type
 *
 * Options:
 *   --action, -a     Action to perform (default: create)
 *   --name, -n       Folder name (for create)
 *   --path           Folder path (for create-path)
 *   --id, -i         Folder ID (for tree, contents, organize)
 *   --file-id        File ID (for add-shortcut)
 *   --folder-id      Target folder ID (for add-shortcut)
 *   --parent, -p     Parent folder ID (for create, create-path)
 *   --depth, -d      Max depth for tree/contents (default: 3)
 *   --json           Output as JSON
 */

import {
  DriveClient,
  parseArgs,
  printSeparator,
  type FolderTreeNode,
  type FolderContentsResult,
} from './google-drive-client.js';

type Action = 'create' | 'create-path' | 'tree' | 'contents' | 'add-shortcut' | 'organize';

function printFolderTree(node: FolderTreeNode, indent: string = ''): void {
  const isFolder = node.mimeType === 'application/vnd.google-apps.folder';
  const icon = isFolder ? '📁' : '📄';
  console.log(`${indent}${icon} ${node.name} (${node.id})`);

  if (node.children) {
    for (const child of node.children) {
      printFolderTree(child, indent + '  ');
    }
  }
}

function printFolderContents(contents: FolderContentsResult, indent: string = ''): void {
  console.log(`${indent}📁 ${contents.folderName} (${contents.folderId})`);
  console.log(`${indent}   Files: ${contents.files.length}`);

  for (const file of contents.files) {
    console.log(`${indent}   📄 ${file.name}`);
  }

  for (const subfolder of contents.subfolders) {
    printFolderContents(subfolder, indent + '  ');
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const action = (args.action || args.a || 'create') as Action;
  const name = args.name || args.n;
  const folderPath = args.path;
  const folderId = args.id || args.i;
  const fileId = args['file-id'];
  const targetFolderId = args['folder-id'];
  const parentId = args.parent || args.p;
  const depth = parseInt(args.depth || args.d || '3', 10);
  const jsonOutput = args.json === 'true';

  if (!['create', 'create-path', 'tree', 'contents', 'add-shortcut', 'organize'].includes(action)) {
    console.error(`[ERROR] Unknown action: ${action}`);
    printUsage();
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Folder Operations');
    printSeparator();
    console.log(`Action: ${action}`);
    printSeparator('-');
  }

  try {
    const client = new DriveClient();

    switch (action) {
      case 'create': {
        if (!name) {
          console.error('[ERROR] --name is required for create action');
          process.exit(1);
        }

        if (!jsonOutput) {
          console.log(`[...] Creating folder "${name}"...`);
          if (parentId) console.log(`Parent: ${parentId}`);
        }

        const result = await client.createFolder(name, parentId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Folder created');
          console.log(`  Name: ${result.name}`);
          console.log(`  ID: ${result.id}`);
          if (result.webViewLink) console.log(`  Link: ${result.webViewLink}`);
        }
        break;
      }

      case 'create-path': {
        if (!folderPath) {
          console.error('[ERROR] --path is required for create-path action');
          process.exit(1);
        }

        if (!jsonOutput) {
          console.log(`[...] Creating path "${folderPath}"...`);
          if (parentId) console.log(`Starting from: ${parentId}`);
        }

        const finalFolderId = await client.createFolderPath(folderPath, parentId);

        if (jsonOutput) {
          console.log(JSON.stringify({ id: finalFolderId, path: folderPath }, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Folder path created');
          console.log(`  Path: ${folderPath}`);
          console.log(`  Final folder ID: ${finalFolderId}`);
        }
        break;
      }

      case 'tree': {
        const targetId = folderId || 'root';

        if (!jsonOutput) {
          console.log(`[...] Getting folder tree (depth: ${depth})...`);
        }

        const tree = await client.getFolderTree(targetId, depth);

        if (jsonOutput) {
          console.log(JSON.stringify(tree, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Folder Tree');
          console.log('');
          printFolderTree(tree);
        }
        break;
      }

      case 'contents': {
        if (!folderId) {
          console.error('[ERROR] --id is required for contents action');
          process.exit(1);
        }

        if (!jsonOutput) {
          console.log(`[...] Getting folder contents (depth: ${depth})...`);
        }

        const contents = await client.getFolderContents(folderId, depth);

        if (jsonOutput) {
          console.log(JSON.stringify(contents, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Folder Contents');
          console.log(`Total Files: ${contents.totalFiles}`);
          console.log(`Total Folders: ${contents.totalFolders}`);
          console.log('');
          printFolderContents(contents);
        }
        break;
      }

      case 'add-shortcut': {
        if (!fileId) {
          console.error('[ERROR] --file-id is required for add-shortcut action');
          process.exit(1);
        }
        if (!targetFolderId) {
          console.error('[ERROR] --folder-id is required for add-shortcut action');
          process.exit(1);
        }

        if (!jsonOutput) {
          console.log(`[...] Creating shortcut for ${fileId} in ${targetFolderId}...`);
        }

        const result = await client.addToFolder(fileId, targetFolderId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Shortcut created');
          console.log(`  Name: ${result.name}`);
          console.log(`  Shortcut ID: ${result.id}`);
          if (result.webViewLink) console.log(`  Link: ${result.webViewLink}`);
        }
        break;
      }

      case 'organize': {
        if (!folderId) {
          console.error('[ERROR] --id is required for organize action');
          process.exit(1);
        }

        if (!jsonOutput) {
          console.log(`[...] Organizing files in folder by type...`);
        }

        const result = await client.organizeFilesByType(folderId);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Folder organized');
          console.log(`\n  Folders created: ${result.created.length}`);
          for (const folder of result.created) {
            console.log(`    - ${folder.folderName} (${folder.folderId})`);
          }
          console.log(`\n  Files moved: ${result.moved.length}`);
          for (const file of result.moved) {
            console.log(`    - ${file.fileName} -> ${file.toFolder}`);
          }
          if (result.errors.length > 0) {
            console.log(`\n  Errors: ${result.errors.length}`);
            for (const err of result.errors) {
              console.log(`    - ${err.fileId}: ${err.error}`);
            }
          }
        }
        break;
      }
    }

    if (!jsonOutput) {
      printSeparator();
      console.log('SUCCESS');
      printSeparator();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${errorMessage}`);
    process.exit(1);
  }
}

function printUsage(): void {
  console.error('\nUsage: npx tsx drive-folder.ts --action "create|create-path|tree|contents|add-shortcut|organize" [options]');
  console.error('\nExamples:');
  console.error('  Create folder:       --action create --name "MyFolder"');
  console.error('  Create path:         --action create-path --path "Projects/2024/Q1"');
  console.error('  Get folder tree:     --action tree --id "folder_id" --depth 5');
  console.error('  Get contents:        --action contents --id "folder_id" --depth 10');
  console.error('  Add shortcut:        --action add-shortcut --file-id "xxx" --folder-id "yyy"');
  console.error('  Organize by type:    --action organize --id "folder_id"');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
