// __tests__/api/pads.test.ts
// Jest tests for pads handler

import { listPads, createPad, PadsSession } from '../../lib/handlers/pads-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'pad-1', name: 'Sample Pad', description: 'A test pad', updated_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'pad-new',
    name: 'New Pad',
    description: 'New pad description',
    is_public: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Pads Handler', () => {
  const mockSession: PadsSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list pads', async () => {
    const result = await listPads(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.pads)).toBe(true)
    expect(result.body.pads!.length).toBeGreaterThan(0)
  })

  it('should create a pad', async () => {
    const input = { name: 'New Pad', description: 'New pad description' }
    const result = await createPad(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.pad).toBeDefined()
    expect(result.body.pad.name).toBe('New Pad')
  })

  it('should reject missing name on pad create', async () => {
    const input = { description: 'New pad description' } as any
    const result = await createPad(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/name/i)
  })
})
