import { getSession } from "@/lib/auth/local-auth"
import { NextResponse } from "next/server"
import { APICache, withCache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db } from "@/lib/database/pg-client"

const ADMIN_EMAILS = ["chrisdoran63@outlook.com"]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublic = searchParams.get("public") === "true"
    const isAdmin = searchParams.get("admin") === "true"
    const isPrivate = searchParams.get("private") === "true"

    const session = await getSession()
    const user = session?.user
    const orgContext = user ? await getOrgContext(user.id) : null

    if (isPublic) {
      const cacheKey = APICache.getCacheKey("social-pads", { public: true })

      return withCache(
        cacheKey,
        async () => {
          const result = await db.query(
            `SELECT * FROM social_pads 
             WHERE is_public = true 
             ORDER BY created_at DESC`,
          )
          return { pads: result.rows || [] }
        },
        { ttl: 60, staleWhileRevalidate: 300 },
      )
    }

    if (isPrivate) {
      if (!user || !orgContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const cacheKey = APICache.getCacheKey("social-pads", { private: true, userId: user.id, orgId: orgContext.orgId })

      return withCache(
        cacheKey,
        async () => {
          // Get owned private pads
          const ownedResult = await db.query(
            `SELECT * FROM social_pads 
             WHERE owner_id = $1 AND org_id = $2 AND is_public = false 
             ORDER BY created_at DESC`,
            [user.id, orgContext.orgId],
          )

          // Get member private pads
          const memberResult = await db.query(
            `SELECT sp.* FROM social_pads sp
             INNER JOIN social_pad_members spm ON sp.id = spm.social_pad_id
             WHERE spm.user_id = $1 AND spm.accepted = true 
               AND sp.org_id = $2 AND sp.is_public = false 
               AND sp.owner_id != $1
             ORDER BY sp.created_at DESC`,
            [user.id, orgContext.orgId],
          )

          const allPrivatePads = [...ownedResult.rows, ...memberResult.rows]

          return { pads: allPrivatePads }
        },
        { ttl: 30, staleWhileRevalidate: 60, tags: [`social-pads-${user.id}-${orgContext.orgId}`] },
      )
    }

    if (isAdmin) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const isUserAdmin = user.email && ADMIN_EMAILS.includes(user.email)

      if (!isUserAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const result = await db.query(
        `SELECT * FROM social_pads ORDER BY created_at DESC`,
      )
      return NextResponse.json({ pads: result.rows || [] })
    }

    if (!user || !orgContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cacheKey = APICache.getCacheKey("social-pads", { userId: user.id, orgId: orgContext.orgId })

    return withCache(
      cacheKey,
      async () => {
        // Get owned pads
        const ownedResult = await db.query(
          `SELECT * FROM social_pads 
           WHERE owner_id = $1 AND org_id = $2 
           ORDER BY created_at DESC`,
          [user.id, orgContext.orgId],
        )

        // Get member pads
        const memberResult = await db.query(
          `SELECT sp.* FROM social_pads sp
           INNER JOIN social_pad_members spm ON sp.id = spm.social_pad_id
           WHERE spm.user_id = $1 AND spm.accepted = true 
             AND sp.org_id = $2 AND sp.owner_id != $1
           ORDER BY sp.created_at DESC`,
          [user.id, orgContext.orgId],
        )

        const allPads = [...ownedResult.rows, ...memberResult.rows]
        const uniquePads = Array.from(new Map(allPads.map((pad) => [pad.id, pad])).values())

        return { pads: uniquePads }
      },
      { ttl: 30, staleWhileRevalidate: 60, tags: [`social-pads-${user.id}-${orgContext.orgId}`] },
    )
  } catch (error) {
    console.error("Error fetching social pads:", error)
    return NextResponse.json({ error: "Failed to fetch social pads" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { name, description, is_public, category_id, hub_type, hub_email, access_mode, home_code } =
      await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Pad name is required" }, { status: 400 })
    }

    // Start transaction
    await db.query("BEGIN")

    try {
      // Insert pad
      const padResult = await db.query(
        `INSERT INTO social_pads 
         (name, description, owner_id, org_id, is_public, category_id, hub_type, hub_email, access_mode, home_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name.trim(),
          description?.trim() || null,
          user.id,
          orgContext.orgId,
          is_public || false,
          category_id || null,
          hub_type || null,
          hub_email || null,
          access_mode || null,
          home_code?.trim() || null,
        ],
      )

      const pad = padResult.rows[0]

      if (!pad) {
        throw new Error("Failed to create pad")
      }

      // Add owner as member
      await db.query(
        `INSERT INTO social_pad_members 
         (social_pad_id, user_id, org_id, role, accepted, invited_by, admin_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pad.id, user.id, orgContext.orgId, "editor", true, user.id, "owner"],
      )

      await db.query("COMMIT")

      await APICache.invalidate(`social-pads:userId=${user.id}:orgId=${orgContext.orgId}`)
      await APICache.invalidate(`social-pads:public=true`)

      return NextResponse.json({ pad })
    } catch (error) {
      await db.query("ROLLBACK")
      throw error
    }
  } catch (error: any) {
    console.error("[v0] Error creating social pad:", error)
    return NextResponse.json({ error: error?.message || "Failed to create social pad" }, { status: 500 })
  }
}
