// __tests__/api/calsticks.test.ts
// Jest tests for calsticks handler

import { listCalsticks, createCalstick, CalstickSession } from '../../lib/handlers/calsticks-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'event-1', title: 'Meeting', start_time: '2024-02-01T10:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'event-new',
    title: 'New Event',
    description: null,
    start_time: '2024-02-15T14:00:00Z',
    end_time: null,
  }),
}))

describe('Calsticks Handler', () => {
  const mockSession: CalstickSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list calsticks', async () => {
    const result = await listCalsticks(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.events)).toBe(true)
    expect(result.body.events!.length).toBeGreaterThan(0)
  })

  it('should create a calstick', async () => {
    const input = { title: 'New Event', start_time: '2024-02-15T14:00:00Z' }
    const result = await createCalstick(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.event).toBeDefined()
    expect(result.body.event.title).toBe('New Event')
  })

  it('should reject missing title on calstick create', async () => {
    const input = { start_time: '2024-02-15T14:00:00Z' } as any
    const result = await createCalstick(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/title/i)
  })
})
