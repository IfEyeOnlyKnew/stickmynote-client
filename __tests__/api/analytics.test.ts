// __tests__/api/analytics.test.ts
// Jest tests for analytics handler

import { logAnalyticsEvent, AnalyticsSession } from '../../lib/handlers/analytics-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
}))

describe('Analytics Handler', () => {
  const mockSession: AnalyticsSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should log an analytics event', async () => {
    const input = { event: 'page_view', details: 'dashboard' }
    const result = await logAnalyticsEvent(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.success).toBe(true)
  })

  it('should reject missing event name', async () => {
    const input = { details: 'dashboard' } as any
    const result = await logAnalyticsEvent(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/event/i)
  })

  it('should allow logging without details', async () => {
    const input = { event: 'logout' }
    const result = await logAnalyticsEvent(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.success).toBe(true)
  })
})
