// Config check helpers for v2 config-check endpoint
import "server-only"
import { query } from '@/lib/database/pg-helpers'
import nodemailer from 'nodemailer'

export async function checkDatabase() {
  try {
    await query('SELECT 1')
    return { status: 'ok' }
  } catch (e: any) {
    return { status: 'error', error: e.message }
  }
}

export async function checkAD() {
  // Skip during build to prevent LDAP connection attempts
  if (process.env.BUILDING === 'true' || process.env.NEXT_BUILD_MODE === 'true') {
    return { status: 'skipped', error: 'Build time - skipping LDAP check' }
  }

  try {
    // Dynamically import ldapjs to prevent build-time connection attempts
    const ldap = await import('ldapjs')
    const ldapUrl = process.env.LDAP_URL || process.env.AD_URL
    if (!ldapUrl) {
      return { status: 'error', error: 'LDAP_URL or AD_URL not configured' }
    }
    const client = ldap.createClient({
      url: ldapUrl,
      tlsOptions: {
        rejectUnauthorized: process.env.LDAP_REJECT_UNAUTHORIZED !== 'false'
      }
    })
    await new Promise((resolve, reject) => {
      client.bind('', '', err => {
        if (err) {
          reject(new Error(err instanceof Error ? err.message : String(err)))
        } else {
          resolve(true)
        }
      })
    })
    client.unbind()
    return { status: 'ok' }
  } catch (e: any) {
    return { status: 'error', error: e.message }
  }
}

export async function checkSMTP() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false
    })
    await transporter.verify()
    return { status: 'ok' }
  } catch (e: any) {
    return { status: 'error', error: e.message }
  }
}
