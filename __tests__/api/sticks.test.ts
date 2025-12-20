// __tests__/api/sticks.test.ts
// Jest tests for sticks handler

import { listSticks, createStick, SticksSession } from '../../lib/handlers/sticks-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'stick-1', topic: 'Sample Topic', content: 'Sample content', updated_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'stick-new',
    topic: 'New Topic',
    content: 'New content',
    color: null,
    is_shared: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Sticks Handler', () => {
  const mockSession: SticksSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list sticks', async () => {
    const result = await listSticks(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.sticks)).toBe(true)
    expect(result.body.sticks!.length).toBeGreaterThan(0)
  })

  it('should create a stick', async () => {
    const input = { topic: 'New Topic', content: 'New content' }
    const result = await createStick(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.stick).toBeDefined()
    expect(result.body.stick.topic).toBe('New Topic')
  })

  it('should reject missing topic on stick create', async () => {
    const input = { content: 'New content' } as any
    const result = await createStick(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/topic/i)
  })
})
