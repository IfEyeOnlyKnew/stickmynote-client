import path from "node:path"

/**
 * Returns the root directory for public uploads (user-images, avatars, branding).
 *
 * Defaults to `<cwd>/uploads` which lives OUTSIDE the git repo's `public/` folder,
 * so deploys never wipe uploaded files.
 *
 * Override with the UPLOAD_DIR environment variable for custom paths,
 * e.g. UPLOAD_DIR=C:\stick-my-note-prod\uploads
 */
export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
}
