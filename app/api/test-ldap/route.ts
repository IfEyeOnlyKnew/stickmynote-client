import { NextResponse } from "next/server"
import { testLDAPConnection } from "@/lib/auth/ldap-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await testLDAPConnection()
    
    return NextResponse.json({
      ...result,
      config: {
        ldap_url: process.env.LDAP_URL,
        ldap_domain: process.env.LDAP_DOMAIN,
        ldap_base_dn: process.env.LDAP_BASE_DN,
        ldap_bind_dn: process.env.LDAP_BIND_DN,
        ldap_user_base_dn: process.env.LDAP_USER_BASE_DN,
      }
    })
  } catch (error) {
    console.error("[LDAP Test] Error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
