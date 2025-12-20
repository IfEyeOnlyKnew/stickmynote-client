// __tests__/api/webhooks.test.ts
// Jest tests for webhooks handler

import { listWebhooks, createWebhook, WebhookSession } from '../../lib/handlers/webhooks-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'webhook-1', url: 'https://example.com/hook', event: 'note.created', created_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'webhook-new',
    url: 'https://example.com/webhook',
    event: 'note.updated',
    description: null,
    created_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Webhooks Handler', () => {
  const mockSession: WebhookSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list webhooks', async () => {
    const result = await listWebhooks(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.webhooks)).toBe(true)
    expect(result.body.webhooks!.length).toBeGreaterThan(0)
  })

  it('should create a webhook', async () => {
    const input = { url: 'https://example.com/webhook', event: 'note.updated' }
    const result = await createWebhook(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.webhook).toBeDefined()
    expect(result.body.webhook.url).toBe('https://example.com/webhook')
  })

  it('should reject missing url on webhook create', async () => {
    const input = { event: 'note.updated' } as any
    const result = await createWebhook(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/url/i)
  })
})
