// __tests__/api/uploads.test.ts
// Jest tests for uploads handler

import { listUploads, createUpload, UploadSession } from '../../lib/handlers/uploads-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'upload-1', filename: 'test.txt', mimetype: 'text/plain', size: 123, created_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'upload-new',
    filename: 'newfile.pdf',
    mimetype: 'application/pdf',
    size: 9999,
    description: null,
    created_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Uploads Handler', () => {
  const mockSession: UploadSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list uploads', async () => {
    const result = await listUploads(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.uploads)).toBe(true)
    expect(result.body.uploads!.length).toBeGreaterThan(0)
  })

  it('should create an upload', async () => {
    const input = { filename: 'newfile.pdf', mimetype: 'application/pdf', size: 9999 }
    const result = await createUpload(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.upload).toBeDefined()
    expect(result.body.upload.filename).toBe('newfile.pdf')
  })

  it('should reject missing filename on upload', async () => {
    const input = { mimetype: 'application/pdf', size: 9999 } as any
    const result = await createUpload(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/filename/i)
  })
})
