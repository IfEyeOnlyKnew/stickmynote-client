// __tests__/api/request-access.test.ts
// Jest tests for v2 request-access handler (extracted for testability)

import { listAccessRequests, createAccessRequest } from '../../lib/handlers/request-access-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'ra-1', name: 'Test', email: 'test@example.com' }),
}));

describe('Request Access Handler', () => {
  it('should list access requests', async () => {
    const result = await listAccessRequests();
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body['request-access'])).toBe(true);
  });

  it('should create an access request', async () => {
    const input = { name: 'Test User', email: 'test@example.com', reason: 'Need access' };
    const result = await createAccessRequest(input);
    expect(result.status).toBe(201);
    expect(result.body['request-access']).toBeDefined();
  });

  it('should return 400 for missing name', async () => {
    const input = { name: '', email: 'test@example.com' };
    const result = await createAccessRequest(input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/name/i);
  });
});
