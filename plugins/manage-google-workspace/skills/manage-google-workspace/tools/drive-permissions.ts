#!/usr/bin/env npx tsx
/**
 * Drive Permissions CLI Tool
 *
 * Manage file sharing and permissions.
 *
 * Usage:
 *   npx tsx drive-permissions.ts --id "file_id" --action "list"
 *
 * Actions:
 *   list              - List all permissions
 *   summary           - Get sharing summary
 *   details           - Get detailed permission info
 *   share             - Share with user/group/domain/anyone
 *   update            - Update permission role
 *   remove            - Remove permission
 *   transfer-owner    - Transfer file ownership to another user
 *
 * Options:
 *   --id, -i           File ID (required)
 *   --action, -a       Action to perform (required)
 *   --email, -e        User email (for share/remove/transfer-owner)
 *   --group            Group email (for share)
 *   --domain           Domain name (for share)
 *   --anyone           Share with anyone (flag)
 *   --role, -r         Permission role: reader, commenter, writer
 *   --permission-id    Permission ID (for update/remove/details)
 *   --notify           Send notification email (for share)
 *   --message          Notification message (for share)
 *   --json             Output as JSON
 */

import {
  DriveClient,
  parseArgs,
  printSeparator,
  type PermissionRole,
} from './google-drive-client.js';

type Action = 'list' | 'summary' | 'details' | 'share' | 'update' | 'remove' | 'transfer-owner';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const fileId = args.id || args.i;
  const action = (args.action || args.a || 'list') as Action;
  const email = args.email || args.e;
  const group = args.group;
  const domain = args.domain;
  const anyone = args.anyone === 'true';
  const role = (args.role || args.r || 'reader') as PermissionRole;
  const permissionId = args['permission-id'];
  const notify = args.notify !== 'false';
  const message = args.message;
  const jsonOutput = args.json === 'true';

  if (!fileId) {
    console.error('[ERROR] --id is required');
    printUsage();
    process.exit(1);
  }

  if (!['list', 'summary', 'details', 'share', 'update', 'remove', 'transfer-owner'].includes(action)) {
    console.error(`[ERROR] Unknown action: ${action}`);
    printUsage();
    process.exit(1);
  }

  if (!jsonOutput) {
    printSeparator();
    console.log('Google Drive - Permissions');
    printSeparator();
    console.log(`File ID: ${fileId}`);
    console.log(`Action: ${action}`);
    printSeparator('-');
  }

  try {
    const client = new DriveClient();

    switch (action) {
      case 'list': {
        if (!jsonOutput) console.log('[...] Listing permissions...');
        const permissions = await client.listPermissions(fileId);

        if (jsonOutput) {
          console.log(JSON.stringify(permissions, null, 2));
        } else {
          printSeparator('-');
          console.log(`[OK] Found ${permissions.length} permission(s)`);

          for (const perm of permissions) {
            console.log(`\n  ID: ${perm.id}`);
            console.log(`  Type: ${perm.type}`);
            console.log(`  Role: ${perm.role}`);
            if (perm.emailAddress) console.log(`  Email: ${perm.emailAddress}`);
            if (perm.domain) console.log(`  Domain: ${perm.domain}`);
            if (perm.displayName) console.log(`  Name: ${perm.displayName}`);
          }
        }
        break;
      }

      case 'summary': {
        if (!jsonOutput) console.log('[...] Getting sharing summary...');
        const summary = await client.getSharingSummary(fileId);

        if (jsonOutput) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Sharing Summary');
          console.log(`\n  Owner: ${summary.owner || 'N/A'}`);
          console.log(`  Writers: ${summary.writers.length > 0 ? summary.writers.join(', ') : 'None'}`);
          console.log(`  Commenters: ${summary.commenters.length > 0 ? summary.commenters.join(', ') : 'None'}`);
          console.log(`  Readers: ${summary.readers.length > 0 ? summary.readers.join(', ') : 'None'}`);
          console.log(`  Anyone with link: ${summary.anyoneWithLink ? 'Yes' : 'No'}`);
          console.log(`  Domain shared: ${summary.domainShared.length > 0 ? summary.domainShared.join(', ') : 'None'}`);
        }
        break;
      }

      case 'details': {
        if (!permissionId) {
          console.error('[ERROR] --permission-id is required for details action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Getting permission details for ${permissionId}...`);
        const details = await client.getPermissionDetails(fileId, permissionId);

        if (jsonOutput) {
          console.log(JSON.stringify(details, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Permission Details');
          console.log(`\n  ID: ${details.id}`);
          console.log(`  Type: ${details.type}`);
          console.log(`  Role: ${details.role}`);
          if (details.emailAddress) console.log(`  Email: ${details.emailAddress}`);
          if (details.domain) console.log(`  Domain: ${details.domain}`);
          if (details.displayName) console.log(`  Display Name: ${details.displayName}`);
          if (details.photoLink) console.log(`  Photo: ${details.photoLink}`);
          if (details.expirationTime) console.log(`  Expires: ${details.expirationTime}`);
          if (details.deleted) console.log(`  Deleted: ${details.deleted}`);
          if (details.permissionDetails && details.permissionDetails.length > 0) {
            console.log(`  Permission Details:`);
            for (const pd of details.permissionDetails) {
              console.log(`    - Type: ${pd.permissionType}, Role: ${pd.role}, Inherited: ${pd.inherited}`);
              if (pd.inheritedFrom) console.log(`      Inherited from: ${pd.inheritedFrom}`);
            }
          }
        }
        break;
      }

      case 'transfer-owner': {
        if (!email) {
          console.error('[ERROR] --email is required for transfer-owner action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Transferring ownership to ${email}...`);
        const result = await client.transferOwnership(fileId, email);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Ownership transferred');
          console.log(`  New owner: ${result.emailAddress}`);
          console.log(`  Permission ID: ${result.id}`);
        }
        break;
      }

      case 'share': {
        let result;

        if (anyone) {
          if (!jsonOutput) console.log(`[...] Sharing with anyone as ${role}...`);
          result = await client.shareWithAnyone(fileId, role);
        } else if (domain) {
          if (!jsonOutput) console.log(`[...] Sharing with domain ${domain} as ${role}...`);
          result = await client.shareWithDomain(fileId, domain, role);
        } else if (group) {
          if (!jsonOutput) console.log(`[...] Sharing with group ${group} as ${role}...`);
          result = await client.shareWithGroup(fileId, group, role);
        } else if (email) {
          if (!jsonOutput) console.log(`[...] Sharing with ${email} as ${role}...`);
          result = await client.shareWithUser(fileId, email, role, { notify, message });
        } else {
          console.error('[ERROR] For share action, specify: --email, --group, --domain, or --anyone');
          process.exit(1);
        }

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Permission created');
          console.log(`  ID: ${result.id}`);
          console.log(`  Type: ${result.type}`);
          console.log(`  Role: ${result.role}`);
        }
        break;
      }

      case 'update': {
        if (!permissionId) {
          console.error('[ERROR] --permission-id is required for update action');
          process.exit(1);
        }

        if (!jsonOutput) console.log(`[...] Updating permission ${permissionId} to ${role}...`);
        const result = await client.updatePermission(fileId, permissionId, role);

        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSeparator('-');
          console.log('[OK] Permission updated');
          console.log(`  ID: ${result.id}`);
          console.log(`  New role: ${result.role}`);
        }
        break;
      }

      case 'remove': {
        if (email) {
          if (!jsonOutput) console.log(`[...] Removing access for ${email}...`);
          const removed = await client.removeAccessByEmail(fileId, email);

          if (removed) {
            if (!jsonOutput) {
              printSeparator('-');
              console.log(`[OK] Access removed for ${email}`);
            } else {
              console.log(JSON.stringify({ removed: true, email }));
            }
          } else {
            if (!jsonOutput) {
              console.log(`[WARN] No permission found for ${email}`);
            } else {
              console.log(JSON.stringify({ removed: false, email }));
            }
          }
        } else if (permissionId) {
          if (!jsonOutput) console.log(`[...] Removing permission ${permissionId}...`);
          await client.removePermission(fileId, permissionId);

          if (jsonOutput) {
            console.log(JSON.stringify({ removed: true, permissionId }));
          } else {
            printSeparator('-');
            console.log(`[OK] Permission ${permissionId} removed`);
          }
        } else {
          console.error('[ERROR] For remove action, specify: --email or --permission-id');
          process.exit(1);
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
  console.error('\nUsage: npx tsx drive-permissions.ts --id "file_id" --action "list|summary|details|share|update|remove|transfer-owner"');
  console.error('\nExamples:');
  console.error('  List permissions:      --action list');
  console.error('  Get sharing summary:   --action summary');
  console.error('  Get permission detail: --action details --permission-id "xxx"');
  console.error('  Share with user:       --action share --email "user@example.com" --role writer');
  console.error('  Share with anyone:     --action share --anyone --role reader');
  console.error('  Update permission:     --action update --permission-id "xxx" --role commenter');
  console.error('  Remove by email:       --action remove --email "user@example.com"');
  console.error('  Transfer ownership:    --action transfer-owner --email "newowner@example.com"');
}

main().catch((error) => {
  console.error(`[ERROR] Unexpected error: ${error.message}`);
  process.exit(1);
});
