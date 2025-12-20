// __tests__/api/multipaks.test.ts
// Jest tests for v2 multipaks handler (extracted for testability)

import { listMultipaks, createMultipak } from '../../lib/handlers/multipaks-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'mp-1', name: 'Test Multipak', description: 'desc' }),
}));

describe('Multipaks Handler', () => {
  it('should list multipaks', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const result = await listMultipaks(session);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.multipaks)).toBe(true);
  });

  it('should create a multipak', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { name: 'Test Multipak', description: 'Test description' };
    const result = await createMultipak(session, input);
    expect(result.status).toBe(201);
    expect(result.body.multipak).toBeDefined();
  });

  it('should return 400 for missing name', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { name: '', description: 'desc' };
    const result = await createMultipak(session, input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/name/i);
  });
});
