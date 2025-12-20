// __tests__/api/memberships.test.ts
// Jest tests for v2 memberships handler (extracted for testability)

import { listMemberships, addMembership } from '../../lib/handlers/memberships-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'mem-1', org_id: 'org-1', user_id: 'user-1', role: 'member' }),
}));

describe('Memberships Handler', () => {
  it('should list memberships', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const result = await listMemberships(session);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.memberships)).toBe(true);
  });

  it('should add a membership', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { userId: 'user-2', groupId: 'org-1' };
    const result = await addMembership(session, input);
    expect(result.status).toBe(201);
    expect(result.body.membership).toBeDefined();
  });

  it('should return 400 for missing userId', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { userId: '', groupId: 'org-1' };
    const result = await addMembership(session, input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/userId/i);
  });
});
