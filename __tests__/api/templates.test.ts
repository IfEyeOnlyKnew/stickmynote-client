// __tests__/api/templates.test.ts
// Jest tests for templates handler

import { listTemplates, createTemplate, TemplatesSession } from '../../lib/handlers/templates-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'template-1', name: 'Sample Template', content: 'Sample content', created_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'template-new',
    name: 'New Template',
    content: 'New content',
    description: null,
    created_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Templates Handler', () => {
  const mockSession: TemplatesSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list templates', async () => {
    const result = await listTemplates(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.templates)).toBe(true)
    expect(result.body.templates!.length).toBeGreaterThan(0)
  })

  it('should create a template', async () => {
    const input = { name: 'New Template', content: 'New content' }
    const result = await createTemplate(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.template).toBeDefined()
    expect(result.body.template.name).toBe('New Template')
  })

  it('should reject missing name on template create', async () => {
    const input = { content: 'New content' } as any
    const result = await createTemplate(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/name/i)
  })
})
