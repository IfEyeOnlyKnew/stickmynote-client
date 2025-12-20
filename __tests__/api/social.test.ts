// __tests__/api/social.test.ts
// Jest tests for v2 social handler (extracted for testability)

import { listSocialNotifications, createSocialNotification } from '../../lib/handlers/social-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'soc-1', type: 'Test', value: 'testvalue' }),
}));

describe('Social Handler', () => {
  it('should list social notifications', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const result = await listSocialNotifications(session);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.social)).toBe(true);
  });

  it('should create a social notification', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { type: 'Test', value: 'testvalue' };
    const result = await createSocialNotification(session, input);
    expect(result.status).toBe(201);
    expect(result.body.social).toBeDefined();
  });

  it('should return 400 for missing type', async () => {
    const session = { user: { id: 'user-1', org_id: 'org-1' } };
    const input = { type: '', value: 'testvalue' };
    const result = await createSocialNotification(session, input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/type/i);
  });
});
