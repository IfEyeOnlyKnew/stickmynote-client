// v2 Calsticks Upload Attachment API: production-quality, upload attachments
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

let put: any

const initializeBlobModule = async () => {
  try {
    const blobModule = await import('@vercel/blob')
    put = blobModule.put
  } catch (error) {
    put = async () => ({ url: '', pathname: '' })
  }
}

// POST /api/v2/calsticks/upload-attachment - Upload file attachment
export async function POST(request: NextRequest) {
  await initializeBlobModule()

  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
    ]

    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'File type not supported' }), { status: 400 })
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File size must be less than 25MB' }), {
        status: 400,
      })
    }

    // Get file type from extension
    const getFileType = (): string => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension) {
        if (['pdf'].includes(extension)) return 'pdf'
        if (['doc', 'docx'].includes(extension)) return 'doc'
        if (['xls', 'xlsx'].includes(extension)) return 'xls'
        if (['ppt', 'pptx'].includes(extension)) return 'ppt'
        if (['txt'].includes(extension)) return 'txt'
        if (['csv'].includes(extension)) return 'csv'
        if (['zip'].includes(extension)) return 'zip'
      }
      return 'pdf'
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop() || 'bin'
    const filename = `calstick-attachments/${user.id}/${timestamp}-${randomId}.${extension}`

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: file.type,
    })

    return new Response(
      JSON.stringify({
        url: blob.url,
        filename: blob.pathname,
        name: file.name,
        size: file.size,
        type: getFileType(),
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
