// __tests__/api/quicksticks.test.ts
// Jest tests for v2 quicksticks handler (extracted for testability)

import { listQuicksticks, createQuickstick } from '../../lib/handlers/quicksticks-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'qs-1', name: 'Test Quickstick', description: 'desc' }),
}));

describe('Quicksticks Handler', () => {
  it('should list quicksticks', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const result = await listQuicksticks(session);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.quicksticks)).toBe(true);
  });

  it('should create a quickstick', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { name: 'Test Quickstick', description: 'Test description' };
    const result = await createQuickstick(session, input);
    expect(result.status).toBe(201);
    expect(result.body.quickstick).toBeDefined();
  });

  it('should return 400 for missing name', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { name: '', description: 'desc' };
    const result = await createQuickstick(session, input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/name/i);
  });
});
