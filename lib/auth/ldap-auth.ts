import "server-only"
// ldapjs is imported dynamically to prevent connection during build
import { db } from "@/lib/database/pg-client"

// ============================================================================
// Types
// ============================================================================

interface LDAPConfig {
  url: string
  bindDN: string
  bindPassword: string
  baseDN: string
  userBaseDN: string
  searchFilter: string
  domain: string
}

interface LDAPUser {
  dn: string
  sAMAccountName: string
  userPrincipalName: string
  mail: string
  displayName: string
  givenName: string
  sn: string
  memberOf: string[]
}

interface AuthResult {
  success: boolean
  user?: {
    id: string
    email: string
    full_name: string
    distinguished_name: string
  }
  error?: string
}

interface ProvisionedUser {
  id: string
  email: string
  full_name: string
  distinguished_name: string
}

interface LDAPSearchEntry {
  pojo: {
    objectName: string
    attributes: Array<{ type: string; values: string[] }>
  }
}

// ============================================================================
// Constants
// ============================================================================

const LDAP_TIMEOUT = 10000
const LDAP_CONNECT_TIMEOUT = 10000
const LDAP_IDLE_TIMEOUT = 30000

const LDAP_SEARCH_ATTRIBUTES = [
  "dn",
  "sAMAccountName",
  "userPrincipalName",
  "mail",
  "displayName",
  "givenName",
  "sn",
  "memberOf",
  "distinguishedName",
] as const

const DEFAULT_LDAP_CONFIG: LDAPConfig = {
  url: "ldaps://192.168.50.11:636",
  bindDN: "svc_ldap@stickmynote.com",
  bindPassword: "",
  baseDN: "DC=stickmynote,DC=com",
  userBaseDN: "DC=stickmynote,DC=com",
  searchFilter: "(sAMAccountName={username})",
  domain: "stickmynote.com",
}

// ============================================================================
// Module State
// ============================================================================

// Skip LDAP during build to prevent connection errors
const isBuildTime = process.env.BUILDING === "true" || process.env.NEXT_BUILD_MODE === "true"

let ldapModule: typeof import("ldapjs") | null = null

async function getLdapModule() {
  if (isBuildTime) {
    throw new Error("LDAP not available during build")
  }
  if (!ldapModule) {
    ldapModule = await import("ldapjs")
  }
  return ldapModule
}

// ============================================================================
// Config Helpers
// ============================================================================

function getLDAPConfig(): LDAPConfig {
  return {
    url: process.env.LDAP_URL || DEFAULT_LDAP_CONFIG.url,
    bindDN: process.env.LDAP_BIND_DN || DEFAULT_LDAP_CONFIG.bindDN,
    bindPassword: process.env.LDAP_BIND_PASSWORD || DEFAULT_LDAP_CONFIG.bindPassword,
    baseDN: process.env.LDAP_BASE_DN || DEFAULT_LDAP_CONFIG.baseDN,
    userBaseDN: process.env.LDAP_USER_BASE_DN || DEFAULT_LDAP_CONFIG.userBaseDN,
    searchFilter: process.env.LDAP_USER_SEARCH_FILTER || DEFAULT_LDAP_CONFIG.searchFilter,
    domain: process.env.LDAP_DOMAIN || DEFAULT_LDAP_CONFIG.domain,
  }
}

function extractUsername(email: string): string {
  return email.includes("@") ? email.split("@")[0] : email
}

// ============================================================================
// LDAP Entry Parsing
// ============================================================================

function getAttributeValue(attributes: LDAPSearchEntry["pojo"]["attributes"], type: string): string {
  return attributes.find((a) => a.type === type)?.values[0] || ""
}

function getAttributeValues(attributes: LDAPSearchEntry["pojo"]["attributes"], type: string): string[] {
  return attributes.find((a) => a.type === type)?.values || []
}

function parseSearchEntry(entry: LDAPSearchEntry): LDAPUser {
  const { objectName, attributes } = entry.pojo

  return {
    dn: objectName || "",
    sAMAccountName: getAttributeValue(attributes, "sAMAccountName"),
    userPrincipalName: getAttributeValue(attributes, "userPrincipalName"),
    mail: getAttributeValue(attributes, "mail"),
    displayName: getAttributeValue(attributes, "displayName"),
    givenName: getAttributeValue(attributes, "givenName"),
    sn: getAttributeValue(attributes, "sn"),
    memberOf: getAttributeValues(attributes, "memberOf"),
  }
}

function parseDN(dn: string): string[] {
  return dn
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.toUpperCase().startsWith("OU="))
    .map((part) => part.substring(3))
}

// ============================================================================
// LDAP Client Operations
// ============================================================================

async function createLDAPClient(url: string) {
  const ldap = await getLdapModule()
  return ldap.createClient({
    url,
    timeout: LDAP_TIMEOUT,
    connectTimeout: LDAP_CONNECT_TIMEOUT,
    idleTimeout: LDAP_IDLE_TIMEOUT,
    tlsOptions: {
      rejectUnauthorized: process.env.LDAP_REJECT_UNAUTHORIZED !== "false",
    },
  })
}

async function bindLDAP(client: any, dn: string, password: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err: Error | null) => {
      if (err) {
        console.error("[LDAP] Bind error:", err.message)
        reject(err)
      } else {
        resolve(true)
      }
    })
  })
}

async function searchUser(client: any, config: LDAPConfig, username: string): Promise<LDAPUser | null> {
  return new Promise((resolve, reject) => {
    const searchFilter = config.searchFilter.replace("{username}", username)
    const opts = {
      filter: searchFilter,
      scope: "sub" as const,
      attributes: [...LDAP_SEARCH_ATTRIBUTES],
    }

    // Use process.stderr.write to ensure logs are not stripped by minifier
    process.stderr.write(`[LDAP] Searching with filter: ${searchFilter} in base: ${config.userBaseDN}\n`)

    client.search(config.userBaseDN, opts, (err: Error | null, res: any) => {
      if (err) {
        process.stderr.write(`[LDAP] Search error: ${err.message}\n`)
        reject(err)
        return
      }

      let user: LDAPUser | null = null
      let entryCount = 0

      res.on("searchEntry", (entry: LDAPSearchEntry) => {
        entryCount++
        process.stderr.write(`[LDAP] Found entry #${entryCount}: ${JSON.stringify(entry?.pojo?.objectName || "unknown")}\n`)
        try {
          user = parseSearchEntry(entry)
          process.stderr.write(`[LDAP] Parsed user DN: ${user?.dn || "null"}\n`)
        } catch (parseErr) {
          process.stderr.write(`[LDAP] Parse error: ${parseErr}\n`)
        }
      })

      res.on("searchReference", (referral: any) => {
        process.stderr.write(`[LDAP] Search referral: ${JSON.stringify(referral)}\n`)
      })

      res.on("error", (searchErr: Error) => {
        process.stderr.write(`[LDAP] Search result error: ${searchErr.message}\n`)
        reject(searchErr)
      })

      res.on("end", (result: any) => {
        process.stderr.write(`[LDAP] Search ended, status: ${result?.status}, entries: ${entryCount}, user found: ${!!user}\n`)
        resolve(user)
      })
    })
  })

}

function safeUnbind(client: any): void {
  try {
    client.unbind()
  } catch (err) {
    console.warn("[LDAP] Error during unbind:", err)
  }
}

// ============================================================================
// User Provisioning
// ============================================================================

async function isFirstUser(): Promise<boolean> {
  const result = await db.query(`SELECT COUNT(*) as count FROM users`)
  return parseInt(result.rows[0].count, 10) === 0
}

async function getOrCreateDefaultOrganization(userId: string, userEmail: string): Promise<string | null> {
  // Check if any organization exists
  const orgResult = await db.query(`SELECT id FROM organizations LIMIT 1`)
  
  if (orgResult.rows.length > 0) {
    return orgResult.rows[0].id
  }

  // No organization exists - create one and make this user the owner
  const domain = userEmail.split("@")[1] || "Default"
  const orgName = domain.charAt(0).toUpperCase() + domain.slice(1).replace(/\.[^.]+$/, "")
  
  const createOrgResult = await db.query(
    `INSERT INTO organizations (name, type, created_at, updated_at)
     VALUES ($1, 'enterprise', NOW(), NOW())
     RETURNING id`,
    [orgName]
  )
  
  const orgId = createOrgResult.rows[0].id
  console.log(`[LDAP] Created default organization: ${orgName} (${orgId})`)
  
  // Add user as owner
  await db.query(
    `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW())`,
    [orgId, userId]
  )
  console.log(`[LDAP] Added first user as organization owner`)
  
  return orgId
}

async function provisionUser(ldapUser: LDAPUser): Promise<ProvisionedUser> {
  const email = ldapUser.mail || ldapUser.userPrincipalName
  const fullName = ldapUser.displayName || `${ldapUser.givenName} ${ldapUser.sn}`.trim()
  
  // Check if this will be the first user
  const firstUser = await isFirstUser()

  // Check if user exists
  const existingUser = await db.query(
    `SELECT id, email, full_name, distinguished_name
     FROM users
     WHERE email = $1 OR distinguished_name = $2
     LIMIT 1`,
    [email, ldapUser.dn]
  )

  if (existingUser.rows.length > 0) {
    // Update existing user
    const result = await db.query(
      `UPDATE users
       SET full_name = $1,
           distinguished_name = $2,
           email_verified = true,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, full_name, distinguished_name`,
      [fullName, ldapUser.dn, existingUser.rows[0].id]
    )
    console.log(`[LDAP] Updated existing user: ${email}`)
    return result.rows[0]
  }

  // Create new user
  const result = await db.query(
    `INSERT INTO users (email, full_name, distinguished_name, email_verified, hub_mode, created_at, updated_at)
     VALUES ($1, $2, $3, true, 'full_access', NOW(), NOW())
     RETURNING id, email, full_name, distinguished_name`,
    [email, fullName, ldapUser.dn]
  )
  console.log(`[LDAP] Created new user: ${email}`)
  
  const newUser = result.rows[0]
  
  // If this is the first user, create organization and make them owner
  if (firstUser) {
    await getOrCreateDefaultOrganization(newUser.id, email)
  }
  
  return newUser
}

// ============================================================================
// Organization Membership
// ============================================================================

async function checkDnPatternsColumnExists(): Promise<boolean> {
  const result = await db.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'organizations' AND column_name = 'dn_patterns'`
  )
  return result.rows.length > 0
}

async function getOrganizationsWithDnPatterns(): Promise<Array<{ id: string; name: string; dn_patterns: string[] }>> {
  const result = await db.query(
    `SELECT id, name, dn_patterns
     FROM organizations
     WHERE dn_patterns IS NOT NULL AND dn_patterns != '[]'::jsonb`
  )
  return result.rows
}

function userMatchesOrgPatterns(userDN: string, patterns: string[]): boolean {
  const normalizedDN = userDN.toLowerCase()
  return patterns.some((pattern) => normalizedDN.includes(pattern.toLowerCase()))
}

async function ensureOrganizationMembership(orgId: string, userId: string, orgName: string): Promise<void> {
  const membershipResult = await db.query(
    `SELECT id FROM organization_members
     WHERE org_id = $1 AND user_id = $2
     LIMIT 1`,
    [orgId, userId]
  )

  if (membershipResult.rows.length === 0) {
    await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW())`,
      [orgId, userId]
    )
    console.log(`[LDAP] Added user to organization: ${orgName}`)
  } else {
    await db.query(
      `UPDATE organization_members
       SET status = 'active', updated_at = NOW()
       WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    )
  }
}

async function updateOrganizationMemberships(userId: string, userDN: string): Promise<void> {
  try {
    const hasDnPatterns = await checkDnPatternsColumnExists()
    if (!hasDnPatterns) {
      console.log("[LDAP] dn_patterns column does not exist, skipping organization membership update")
      return
    }

    const organizations = await getOrganizationsWithDnPatterns()
    const userOUs = parseDN(userDN)
    console.log(`[LDAP] User OUs: ${JSON.stringify(userOUs)}`)

    for (const org of organizations) {
      try {
        const patterns = Array.isArray(org.dn_patterns) ? org.dn_patterns : []

        if (userMatchesOrgPatterns(userDN, patterns)) {
          await ensureOrganizationMembership(org.id, userId, org.name)
        }
      } catch (parseErr) {
        console.error(`[LDAP] Error processing organization ${org.name}:`, parseErr)
      }
    }
  } catch (error) {
    console.error("[LDAP] Error updating organization memberships:", error)
  }
}

// ============================================================================
// Public API
// ============================================================================

export async function authenticateWithAD(email: string, password: string): Promise<AuthResult> {
  const config = getLDAPConfig()
  const client = await createLDAPClient(config.url)

  try {
    const username = extractUsername(email)

    // Bind with service account to search for user
    await bindLDAP(client, config.bindDN, config.bindPassword)
    console.log("[LDAP] Service account bind successful")

    // Search for user
    const ldapUser = await searchUser(client, config, username)
    if (!ldapUser) {
      safeUnbind(client)
      return { success: false, error: "User not found in Active Directory" }
    }

    console.log(`[LDAP] Found user: ${ldapUser.dn}`)
    safeUnbind(client)

    // Authenticate with user's credentials
    const userClient = await createLDAPClient(config.url)

    try {
      await bindLDAP(userClient, ldapUser.dn, password)
      console.log("[LDAP] User authentication successful")
    } catch {
      safeUnbind(userClient)
      return { success: false, error: "Invalid password" }
    }

    safeUnbind(userClient)

    // Auto-provision or update user in database
    const dbUser = await provisionUser(ldapUser)

    // Update organization memberships based on DN
    await updateOrganizationMemberships(dbUser.id, ldapUser.dn)

    return { success: true, user: dbUser }
  } catch (error) {
    console.error("[LDAP] Authentication error:", error)
    safeUnbind(client)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Authentication failed",
    }
  }
}

export async function testLDAPConnection(): Promise<{ success: boolean; message: string }> {
  const config = getLDAPConfig()
  const client = await createLDAPClient(config.url)

  try {
    await bindLDAP(client, config.bindDN, config.bindPassword)
    safeUnbind(client)
    return { success: true, message: "LDAP connection successful" }
  } catch (error) {
    safeUnbind(client)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    }
  }
}

// ============================================================================
// LDAP User Search (for invites, etc.)
// ============================================================================

export interface LDAPSearchResult {
  dn: string
  sAMAccountName: string
  email: string
  displayName: string
  givenName: string
  surname: string
}

/**
 * Search Active Directory for users matching a query string.
 * Searches by displayName, sAMAccountName, mail, givenName, and sn.
 */
export async function searchLDAPUsers(
  query: string,
  limit: number = 10
): Promise<{ success: boolean; users?: LDAPSearchResult[]; error?: string }> {
  if (isBuildTime) {
    return { success: false, error: "LDAP not available during build" }
  }

  if (!query || query.length < 2) {
    return { success: true, users: [] }
  }

  const config = getLDAPConfig()
  const client = await createLDAPClient(config.url)

  try {
    // Bind with service account
    await bindLDAP(client, config.bindDN, config.bindPassword)

    // Build search filter for partial matching
    // Search by displayName, sAMAccountName, mail, givenName, or sn
    const escapedQuery = query.replace(/[\\*()]/g, (char) => `\\${char}`)
    const searchFilter = `(&(objectClass=user)(objectCategory=person)(|(displayName=*${escapedQuery}*)(sAMAccountName=*${escapedQuery}*)(mail=*${escapedQuery}*)(givenName=*${escapedQuery}*)(sn=*${escapedQuery}*)))`

    const users = await searchLDAPUsersInternal(client, config, searchFilter, limit)

    safeUnbind(client)
    return { success: true, users }
  } catch (error) {
    console.error("[LDAP] User search error:", error)
    safeUnbind(client)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    }
  }
}

async function searchLDAPUsersInternal(
  client: any,
  config: LDAPConfig,
  searchFilter: string,
  limit: number
): Promise<LDAPSearchResult[]> {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: searchFilter,
      scope: "sub" as const,
      attributes: [...LDAP_SEARCH_ATTRIBUTES],
      sizeLimit: limit,
    }

    console.log(`[LDAP] Searching users with filter: ${searchFilter}`)

    client.search(config.userBaseDN, opts, (err: Error | null, res: any) => {
      if (err) {
        console.error("[LDAP] Search error:", err.message)
        reject(err)
        return
      }

      const users: LDAPSearchResult[] = []

      res.on("searchEntry", (entry: LDAPSearchEntry) => {
        try {
          const ldapUser = parseSearchEntry(entry)
          users.push({
            dn: ldapUser.dn,
            sAMAccountName: ldapUser.sAMAccountName,
            email: ldapUser.mail || ldapUser.userPrincipalName,
            displayName: ldapUser.displayName,
            givenName: ldapUser.givenName,
            surname: ldapUser.sn,
          })
        } catch (parseErr) {
          console.warn("[LDAP] Error parsing search entry:", parseErr)
        }
      })

      res.on("error", (searchErr: Error) => {
        // Size limit exceeded is not a fatal error - we still have results
        if (searchErr.message?.includes("Size Limit Exceeded")) {
          console.log("[LDAP] Size limit reached, returning partial results")
          resolve(users)
        } else {
          reject(searchErr)
        }
      })

      res.on("end", () => {
        console.log(`[LDAP] Search complete, found ${users.length} users`)
        resolve(users)
      })
    })
  })
}

// ============================================================================
// Bulk AD User Sync
// ============================================================================

export interface SyncResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  errors: string[]
  totalFromAD: number
}

/**
 * Sync all users from Active Directory to the database.
 * Creates new users and updates existing ones.
 */
export async function syncAllADUsers(): Promise<SyncResult> {
  if (isBuildTime) {
    return { success: false, created: 0, updated: 0, skipped: 0, errors: ["LDAP not available during build"], totalFromAD: 0 }
  }

  const config = getLDAPConfig()
  const client = await createLDAPClient(config.url)
  const result: SyncResult = { success: true, created: 0, updated: 0, skipped: 0, errors: [], totalFromAD: 0 }

  try {
    // Bind with service account
    await bindLDAP(client, config.bindDN, config.bindPassword)
    console.log("[LDAP Sync] Service account bind successful")

    // Search for all user objects
    const searchFilter = "(&(objectClass=user)(objectCategory=person)(mail=*))"
    const users = await searchAllLDAPUsers(client, config, searchFilter)
    result.totalFromAD = users.length
    console.log(`[LDAP Sync] Found ${users.length} users in Active Directory`)

    safeUnbind(client)

    // Process each user
    for (const ldapUser of users) {
      try {
        if (!ldapUser.email) {
          result.skipped++
          continue
        }

        const fullName = ldapUser.displayName || `${ldapUser.givenName} ${ldapUser.surname}`.trim()

        // Check if user already exists
        const existingUser = await db.query(
          `SELECT id, email, full_name, distinguished_name FROM users
           WHERE email = $1 OR distinguished_name = $2
           LIMIT 1`,
          [ldapUser.email, ldapUser.dn]
        )

        if (existingUser.rows.length > 0) {
          // Update existing user
          await db.query(
            `UPDATE users
             SET full_name = $1,
                 username = $2,
                 distinguished_name = $3,
                 email_verified = true,
                 updated_at = NOW()
             WHERE id = $4`,
            [fullName, ldapUser.sAMAccountName, ldapUser.dn, existingUser.rows[0].id]
          )
          result.updated++
        } else {
          // Create new user
          await db.query(
            `INSERT INTO users (email, full_name, username, distinguished_name, email_verified, hub_mode, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, 'full_access', NOW(), NOW())`,
            [ldapUser.email, fullName, ldapUser.sAMAccountName, ldapUser.dn]
          )
          result.created++
        }
      } catch (userErr) {
        const errMsg = userErr instanceof Error ? userErr.message : String(userErr)
        result.errors.push(`Error processing ${ldapUser.email}: ${errMsg}`)
        console.error(`[LDAP Sync] Error processing user ${ldapUser.email}:`, userErr)
      }
    }

    console.log(`[LDAP Sync] Complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`)
    return result
  } catch (error) {
    console.error("[LDAP Sync] Error:", error)
    safeUnbind(client)
    return {
      ...result,
      success: false,
      errors: [...result.errors, error instanceof Error ? error.message : "Sync failed"],
    }
  }
}

async function searchAllLDAPUsers(
  client: any,
  config: LDAPConfig,
  searchFilter: string
): Promise<LDAPSearchResult[]> {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: searchFilter,
      scope: "sub" as const,
      attributes: [...LDAP_SEARCH_ATTRIBUTES],
      paged: true, // Enable paging for large directories
    }

    console.log(`[LDAP Sync] Searching with filter: ${searchFilter}`)

    client.search(config.userBaseDN, opts, (err: Error | null, res: any) => {
      if (err) {
        console.error("[LDAP Sync] Search error:", err.message)
        reject(err)
        return
      }

      const users: LDAPSearchResult[] = []

      res.on("searchEntry", (entry: LDAPSearchEntry) => {
        try {
          const ldapUser = parseSearchEntry(entry)
          if (ldapUser.mail || ldapUser.userPrincipalName) {
            users.push({
              dn: ldapUser.dn,
              sAMAccountName: ldapUser.sAMAccountName,
              email: ldapUser.mail || ldapUser.userPrincipalName,
              displayName: ldapUser.displayName,
              givenName: ldapUser.givenName,
              surname: ldapUser.sn,
            })
          }
        } catch (parseErr) {
          console.warn("[LDAP Sync] Error parsing entry:", parseErr)
        }
      })

      res.on("error", (searchErr: Error) => {
        if (searchErr.message?.includes("Size Limit Exceeded")) {
          console.log("[LDAP Sync] Size limit reached, returning partial results")
          resolve(users)
        } else {
          reject(searchErr)
        }
      })

      res.on("end", () => {
        resolve(users)
      })
    })
  })
}

// ============================================================================
// AD Group Search
// ============================================================================

export interface ADGroup {
  dn: string
  name: string
  description: string
  memberCount: number
}

interface ADGroupSearchEntry {
  pojo: {
    objectName: string
    attributes: Array<{ type: string; values: string[] }>
  }
}

/**
 * Search Active Directory for groups matching a query string.
 * Searches by group name (cn) and description.
 */
export async function searchADGroups(
  query: string,
  limit: number = 10
): Promise<{ success: boolean; groups?: ADGroup[]; error?: string }> {
  if (isBuildTime) {
    return { success: false, error: "LDAP not available during build" }
  }

  if (!query || query.length < 2) {
    return { success: true, groups: [] }
  }

  const config = getLDAPConfig()
  const client = await createLDAPClient(config.url)

  try {
    // Bind with service account
    await bindLDAP(client, config.bindDN, config.bindPassword)

    // Build search filter for groups
    // Search by cn (common name) and description
    const escapedQuery = query.replace(/[\\*()]/g, (char) => `\\${char}`)
    const searchFilter = `(&(objectClass=group)(|(cn=*${escapedQuery}*)(description=*${escapedQuery}*)))`

    const groups = await searchADGroupsInternal(client, config, searchFilter, limit)

    safeUnbind(client)
    return { success: true, groups }
  } catch (error) {
    console.error("[LDAP] Group search error:", error)
    safeUnbind(client)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    }
  }
}

async function searchADGroupsInternal(
  client: any,
  config: LDAPConfig,
  searchFilter: string,
  limit: number
): Promise<ADGroup[]> {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: searchFilter,
      scope: "sub" as const,
      attributes: ["dn", "cn", "description", "member"],
      sizeLimit: limit,
    }

    console.log(`[LDAP] Searching groups with filter: ${searchFilter}`)

    client.search(config.baseDN, opts, (err: Error | null, res: any) => {
      if (err) {
        console.error("[LDAP] Group search error:", err.message)
        reject(err)
        return
      }

      const groups: ADGroup[] = []

      res.on("searchEntry", (entry: ADGroupSearchEntry) => {
        try {
          const { objectName, attributes } = entry.pojo
          const cn = attributes.find((a) => a.type === "cn")?.values[0] || ""
          const description = attributes.find((a) => a.type === "description")?.values[0] || ""
          const members = attributes.find((a) => a.type === "member")?.values || []

          groups.push({
            dn: objectName || "",
            name: cn,
            description,
            memberCount: members.length,
          })
        } catch (parseErr) {
          console.warn("[LDAP] Error parsing group entry:", parseErr)
        }
      })

      res.on("error", (searchErr: Error) => {
        // Size limit exceeded is not a fatal error - we still have results
        if (searchErr.message?.includes("Size Limit Exceeded")) {
          console.log("[LDAP] Group search size limit reached, returning partial results")
          resolve(groups)
        } else {
          reject(searchErr)
        }
      })

      res.on("end", () => {
        console.log(`[LDAP] Group search complete, found ${groups.length} groups`)
        resolve(groups)
      })
    })
  })
}

/**
 * Get all members of an AD group by group DN.
 * Returns user objects with email addresses.
 */
export async function getADGroupMembers(
  groupDn: string
): Promise<{ success: boolean; members?: LDAPSearchResult[]; error?: string }> {
  if (isBuildTime) {
    return { success: false, error: "LDAP not available during build" }
  }

  if (!groupDn) {
    return { success: false, error: "Group DN is required" }
  }

  const config = getLDAPConfig()
  const client = await createLDAPClient(config.url)

  try {
    // Bind with service account
    await bindLDAP(client, config.bindDN, config.bindPassword)

    // First, get the group's member attribute
    const groupMembers = await getGroupMemberDNs(client, groupDn)

    if (groupMembers.length === 0) {
      safeUnbind(client)
      return { success: true, members: [] }
    }

    // For each member DN, look up the user details
    const members: LDAPSearchResult[] = []

    for (const memberDn of groupMembers) {
      try {
        const user = await getUserByDn(client, config, memberDn)
        if (user && user.email) {
          members.push(user)
        }
      } catch (err) {
        console.warn(`[LDAP] Could not fetch user ${memberDn}:`, err)
      }
    }

    safeUnbind(client)
    return { success: true, members }
  } catch (error) {
    console.error("[LDAP] Get group members error:", error)
    safeUnbind(client)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get group members",
    }
  }
}

async function getGroupMemberDNs(client: any, groupDn: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: "(objectClass=*)",
      scope: "base" as const,
      attributes: ["member"],
    }

    client.search(groupDn, opts, (err: Error | null, res: any) => {
      if (err) {
        reject(err)
        return
      }

      let memberDns: string[] = []

      res.on("searchEntry", (entry: ADGroupSearchEntry) => {
        const members = entry.pojo.attributes.find((a) => a.type === "member")?.values || []
        memberDns = members
      })

      res.on("error", (searchErr: Error) => {
        reject(searchErr)
      })

      res.on("end", () => {
        console.log(`[LDAP] Found ${memberDns.length} members in group`)
        resolve(memberDns)
      })
    })
  })
}

async function getUserByDn(
  client: any,
  config: LDAPConfig,
  userDn: string
): Promise<LDAPSearchResult | null> {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: "(objectClass=user)",
      scope: "base" as const,
      attributes: [...LDAP_SEARCH_ATTRIBUTES],
    }

    client.search(userDn, opts, (err: Error | null, res: any) => {
      if (err) {
        reject(err)
        return
      }

      let user: LDAPSearchResult | null = null

      res.on("searchEntry", (entry: LDAPSearchEntry) => {
        try {
          const ldapUser = parseSearchEntry(entry)
          if (ldapUser.mail || ldapUser.userPrincipalName) {
            user = {
              dn: ldapUser.dn,
              sAMAccountName: ldapUser.sAMAccountName,
              email: ldapUser.mail || ldapUser.userPrincipalName,
              displayName: ldapUser.displayName,
              givenName: ldapUser.givenName,
              surname: ldapUser.sn,
            }
          }
        } catch (parseErr) {
          console.warn("[LDAP] Error parsing user entry:", parseErr)
        }
      })

      res.on("error", () => {
        // Ignore errors for individual user lookups
        resolve(null)
      })

      res.on("end", () => {
        resolve(user)
      })
    })
  })
}
