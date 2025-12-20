import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
});

// Migration files from migrations folder (these should run first)
const migrationFiles = [
  '../migrations/add_hub_mode_to_users.sql',
  '../migrations/add_domain_to_organizations.sql',
];

// List of SQL files in order (numbered ones first, then alphabetically)
const sqlFiles = [
  // Numbered migrations in order
  '001_create_organizations_schema.sql',
  '002_enable_rls_and_policies.sql',
  '002_update_rls_policies_for_orgs.sql',
  '005_fix_user_creation_flow.sql',
  '006_fix_user_signup_trigger.sql',
  '007_auto_set_hub_mode.sql',
  '007_disable_supabase_email_confirmation.sql',
  '008_add_org_id_column.sql',
  '009_drop_organization_id_column.sql',
  '010_fix_org_id_rls_policies.sql',
  '010_fix_org_members_rls_recursion.sql',
  '011_create_organization_invites.sql',
  '012_add_invite_token.sql',
  '050_add_organization_preregistration.sql',
  '051_fix_organization_members_triggers.sql',
  '052_fix_all_organization_id_references.sql',
  '053_fix_rls_recursion.sql',
  '054_restore_organization_rls.sql',
  '054_restore_org_member_access.sql',
  '055_find_and_fix_all_triggers.sql',
  '056_apply_rls_policies.sql',
  '057_fix_organizations_rls.sql',
  '058_cleanup_duplicate_policies.sql',
  '059_break_rls_recursion.sql',
  '060_migrate_domain_magna_to_mangoint.sql',
  '065_fix_notifications_reference_id_column.sql',
  '066_drop_all_reply_notification_triggers.sql',
  '08-add-search-indexes.sql',
  '09-add-search-analytics.sql',
  '10-add-note-reactions.sql',
  '11-add-reply-reactions.sql',
  
  // Alphabetical migrations
  'add-ai-answer-sessions.sql',
  'add-ai-features-columns.sql',
  'add-announcement-pad-template.sql',
  'add-automation-workflow.sql',
  'add-calstick-archive-feature.sql',
  'add-calstick-attachments.sql',
  'add-calstick-custom-fields.sql',
  'add-calstick-dependencies-rls.sql',
  'add-calstick-fields.sql',
  'add-calstick-intake-forms.sql',
  'add-calstick-okr-system.sql',
  'add-calstick-phase1-fields.sql',
  'add-calstick-phase2-fields.sql',
  'add-calstick-social-reference.sql',
  'add-checklist-support.sql',
  'add-deep-integrations.sql',
  'add-granular-permissions.sql',
  'add-is-shared-column.sql',
  'add-lockout-settings-to-organizations.sql',
  'add-missing-foreign-key-indexes.sql',
  'add-notes-updated-at-index.sql',
  'add-notification-enhancements-complete.sql',
  'add-notification-subscriptions.sql',
  'add-organization-access-control.sql',
  'add-organization-domains.sql',
  'add-pad-access-mode.sql',
  'add-pinned-to-social-sticks.sql',
  'add-quicksticks-field.sql',
  'add-realtime-policies.sql',
  'add-reply-categories.sql',
  'add-saved-emails-unique-constraint.sql',
  'add-social-hub-types-and-accounts.sql',
  'add-social-reply-calstick-reference.sql',
  'add-social-stick-ai-enhancements.sql',
  'add-social-stick-members-rls-policies.sql',
  'add-social-stick-workflow-state.sql',
  'add-tab-data-to-social-stick-tabs.sql',
  'add-tab-order-to-social-stick-tabs.sql',
  'add-user-id-validation-system.sql',
  'add-user-organization-fields.sql',
  'add-videos-images-columns.sql',
  'add_home_code_to_social_pads.sql',
  'add_social_notification_reads.sql',
  'allow-standalone-pads.sql',
  'cleanup-organizations-domain-column.sql',
  'consolidate-all-policies.sql',
  'create-login-attempts-table.sql',
  'create-notification-preferences.sql',
  'create-notifications-table.sql',
  'create-pad-access-requests-table.sql',
  'create-pad-cleanup-policies.sql',
  'create-pad-templates.sql',
  'create-rate-limits-table.sql',
  'create-reply-reactions-table.sql',
  'create-saved-emails-table.sql',
  'create-saved-search-filters-table.sql',
  'create-saved-searches-table.sql',
  'create-search-filters-table.sql',
  'create-social-collaboration-enhancements.sql',
  'create-social-hub-admins.sql',
  'create-social-pad-categories.sql',
  'create-social-pad-knowledge-base.sql',
  'create-social-pad-pending-invites.sql',
  'create-social-stick-tabs.sql',
  'create-stick-replies-table.sql',
  'create-stick-templates-table.sql',
  'create-video-rooms-table.sql',
  'disable-activity-logging-trigger.sql',
  'enhance-activities-table.sql',
  'ensure-users-exist.sql',
  'fix-log-note-activity-trigger.sql',
  'fix-personal-sticks-activities-access.sql',
  'fix-rls-infinite-recursion-v1.sql',
  'fix_social_pad_members_role_constraint.sql',
  'implement-permission-system.sql',
  'implement-upsert-solution.sql',
  'production-constraints.sql',
  'production-final-optimizations.sql',
  'production-grants.sql',
  'production-indexes.sql',
  'production-monitoring.sql',
  'production-rls-policies.sql',
  'remove-url-column-from-social-stick-tabs.sql',
  'update-pad-role-constraints.sql',
  'update-seed-notes-to-shared.sql',
];

async function runMigration(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Running: ${fileName}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Skip empty files
    if (!sql.trim()) {
      console.log(`   ⚠️  Skipped (empty file)`);
      return;
    }
    
    // Try to run the entire file first
    try {
      await client.query(sql);
      console.log(`   ✅ Success`);
    } catch (error: any) {
      // If full file fails, try to run statement by statement
      console.log(`   ⚙️  Running statement by statement...`);
      
      // Split SQL into statements (basic splitting on semicolons outside of functions)
      const statements = sql
        .split(/;[\s]*(?=(?:[^']*'[^']*')*[^']*$)/) // Split on ; but not inside strings
        .filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('--'));
      
      let successCount = 0;
      let skipCount = 0;
      
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        
        try {
          await client.query(trimmed + ';');
          successCount++;
        } catch (stmtError: any) {
          if (
            stmtError.message?.includes('already exists') ||
            stmtError.message?.includes('duplicate key') ||
            (stmtError.message?.includes('does not exist') && trimmed.toUpperCase().includes('DROP'))
          ) {
            skipCount++;
          } else {
            // Log error but continue
            console.log(`   ⚠️  Skipped statement: ${stmtError.message.substring(0, 100)}`);
            skipCount++;
          }
        }
      }
      
      console.log(`   ✅ Completed (${successCount} executed, ${skipCount} skipped)`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    
    // Log more details for debugging
    if (error.position) {
      console.error(`   📍 Error position: ${error.position}`);
    }
    
    throw error; // Re-throw to stop execution
  }
}

async function main() {
  console.log('🚀 Starting database migration...\n');
  console.log(`📦 Database: ${process.env.POSTGRES_DATABASE}`);
  console.log(`🖥️  Host: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`);
  console.log(`👤 User: ${process.env.POSTGRES_USER}\n`);
  console.log('━'.repeat(60));
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // First run migration folder files
    console.log('\n📁 Running migrations from /migrations folder...\n');
    for (const sqlFile of migrationFiles) {
      const filePath = path.join(__dirname, sqlFile);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`\n📄 ${sqlFile}`);
        console.log(`   ⚠️  File not found (skipped)`);
        skippedCount++;
        continue;
      }
      
      try {
        await runMigration(filePath);
        successCount++;
      } catch (error) {
        errorCount++;
        console.log(`\n❌ Migration failed. Stopping execution.`);
        break; // Stop on first error
      }
    }
    
    if (errorCount > 0) {
      console.log('\n' + '━'.repeat(60));
      console.log('\n📊 Migration Summary:');
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ⚠️  Skipped: ${skippedCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      return;
    }
    
    // Then run scripts folder files
    console.log('\n📁 Running migrations from /scripts folder...\n');
    for (const sqlFile of sqlFiles) {
      const filePath = path.join(__dirname, sqlFile);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`\n📄 ${sqlFile}`);
        console.log(`   ⚠️  File not found (skipped)`);
        skippedCount++;
        continue;
      }
      
      try {
        await runMigration(filePath);
        successCount++;
      } catch (error) {
        errorCount++;
        console.log(`\n❌ Migration failed. Stopping execution.`);
        break; // Stop on first error
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 All migrations completed successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

main();
