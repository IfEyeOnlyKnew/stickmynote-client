const { Pool } = require('pg');

const pool = new Pool({
  host: 'HOL-DC3-PGSQL.stickmynote.com',
  port: 5432,
  database: 'stickmynote',
  user: 'stickmynote_user',
  password: 'CpSiZ6142G/OdukjS7P0Kei2tbv7NDyn0ScAPatDwOY=',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // List all users
    const allUsers = await pool.query(
      "SELECT id, email, full_name FROM users ORDER BY email"
    );
    console.log('All users:', allUsers.rows);

    // Find user
    const userResult = await pool.query(
      "SELECT id, email, full_name FROM users WHERE email = $1",
      ['chris.doran@mangoint.com']
    );
    console.log('User:', userResult.rows);

    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }

    const userId = userResult.rows[0].id;
    const orgId = 'ed63eddd-1530-4b2d-8679-a455fb80d1ee';

    // Update organization owner
    await pool.query(
      "UPDATE organizations SET owner_id = $1, updated_at = NOW() WHERE id = $2",
      [userId, orgId]
    );
    console.log('Updated organization owner_id');

    // Check if user is already a member
    const memberCheck = await pool.query(
      "SELECT id, role FROM organization_members WHERE org_id = $1 AND user_id = $2",
      [orgId, userId]
    );

    if (memberCheck.rows.length === 0) {
      // Add as owner member
      await pool.query(
        "INSERT INTO organization_members (org_id, user_id, role, joined_at) VALUES ($1, $2, 'owner', NOW())",
        [orgId, userId]
      );
      console.log('Added user as owner member');
    } else if (memberCheck.rows[0].role !== 'owner') {
      // Update role to owner
      await pool.query(
        "UPDATE organization_members SET role = 'owner' WHERE org_id = $1 AND user_id = $2",
        [orgId, userId]
      );
      console.log('Updated member role to owner');
    } else {
      console.log('User is already owner');
    }

    console.log('Done! chris.doran@stickmynote.com is now owner of Stick My Note');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
