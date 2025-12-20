// __tests__/api/invites.test.ts
// Jest tests for v2 invites handler (extracted for testability)

import { listInvites, acceptInvite } from '../../lib/handlers/invites-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'inv-1', org_id: 'org-1', role: 'member', status: 'pending' }),
}));

describe('Invites Handler', () => {
  it('should list invites', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const result = await listInvites(session);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.invites)).toBe(true);
  });

  it('should accept an invite', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { token: 'valid-token' };
    const result = await acceptInvite(session, input);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it('should return 400 for missing token', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { token: '' };
    const result = await acceptInvite(session, input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/token/i);
  });
});
