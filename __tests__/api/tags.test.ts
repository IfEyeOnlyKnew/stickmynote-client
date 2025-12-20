// __tests__/api/tags.test.ts
// Jest tests for tags handler

import { listTags, createTag, TagsSession } from '../../lib/handlers/tags-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'tag-1', name: 'Sample Tag', description: 'A sample tag', created_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'tag-new',
    name: 'New Tag',
    description: 'New tag description',
    created_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Tags Handler', () => {
  const mockSession: TagsSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list tags', async () => {
    const result = await listTags(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.tags)).toBe(true)
    expect(result.body.tags!.length).toBeGreaterThan(0)
  })

  it('should create a tag', async () => {
    const input = { name: 'New Tag', description: 'New tag description' }
    const result = await createTag(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.tag).toBeDefined()
    expect(result.body.tag.name).toBe('New Tag')
  })

  it('should reject missing name on tag create', async () => {
    const input = { description: 'New tag description' } as any
    const result = await createTag(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/name/i)
  })
})
