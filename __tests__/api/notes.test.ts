// __tests__/api/notes.test.ts
// Jest tests for notes handler

import { listNotes, createNote, NotesSession } from '../../lib/handlers/notes-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'note-1', title: 'Sample Note', content: 'Sample content', updated_at: '2024-01-01T00:00:00Z' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'note-new',
    title: 'New Note',
    content: 'New content',
    color: null,
    topic: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }),
}))

describe('Notes Handler', () => {
  const mockSession: NotesSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list notes', async () => {
    const result = await listNotes(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.notes)).toBe(true)
    expect(result.body.notes!.length).toBeGreaterThan(0)
  })

  it('should create a note', async () => {
    const input = { title: 'New Note', content: 'New content' }
    const result = await createNote(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.note).toBeDefined()
    expect(result.body.note.title).toBe('New Note')
  })

  it('should reject missing title on note create', async () => {
    const input = { content: 'New content' } as any
    const result = await createNote(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/title/i)
  })
})
