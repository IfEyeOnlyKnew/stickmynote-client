// __tests__/api/intake.test.ts
// Jest tests for v2 intake handler (extracted for testability)

import { listIntakeForms, createIntakeForm } from '../../lib/handlers/intake-handler';

// Mock the database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([]),
  querySingle: jest.fn().mockResolvedValue({ id: 'test-id', name: 'Test', email: 'test@example.com' }),
}));

describe('Intake Handler', () => {
  it('should list intake forms', async () => {
    const result = await listIntakeForms();
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.intake)).toBe(true);
  });

  it('should create an intake form', async () => {
    const session = { user: { id: '00000000-0000-0000-0000-000000000000' } };
    const input = { name: 'Test Intake', email: 'test@example.com', message: 'Test message' };
    const result = await createIntakeForm(session, input);
    expect(result.status).toBe(201);
    expect(result.body.intake).toBeDefined();
  });

  it('should return 400 for missing name', async () => {
    const session = { user: { id: '00000000-0000-0000-0000-000000000000' } };
    const input = { name: '', email: 'test@example.com' };
    const result = await createIntakeForm(session, input);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/name/i);
  });
});
