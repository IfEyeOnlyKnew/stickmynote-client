# API Tests Documentation

This document describes the automated test suite for the v2 API endpoints.

## Overview

All API endpoints follow a **handler extraction pattern** for testability:
- Business logic is extracted to `lib/handlers/*.ts`
- Route files (`app/api/v2/*/route.ts`) call handlers and wrap responses
- Tests import handlers directly and mock database helpers

## Running Tests

```bash
# Run all API tests
pnpm jest __tests__/api/

# Run a specific test file
pnpm jest __tests__/api/notes.test.ts

# Run tests in watch mode
pnpm jest __tests__/api/ --watch

# Run with coverage
pnpm jest __tests__/api/ --coverage
```

## Test Structure

Each test file follows this pattern:

```typescript
import { listItems, createItem, ItemSession } from '../../lib/handlers/item-handler'

// Mock database helpers
jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([...]),
  querySingle: jest.fn().mockResolvedValue({...}),
}))

describe('Item Handler', () => {
  const mockSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list items', async () => { ... })
  it('should create an item', async () => { ... })
  it('should reject invalid input', async () => { ... })
})
```

## Test Files

| Test File | Handler | Endpoints Tested | Tests |
|-----------|---------|------------------|-------|
| `analytics.test.ts` | `analytics-handler.ts` | POST /api/v2/analytics | 3 |
| `calsticks.test.ts` | `calsticks-handler.ts` | GET, POST /api/v2/calsticks | 3 |
| `intake.test.ts` | `intake-handler.ts` | GET, POST /api/v2/intake | 3 |
| `invites.test.ts` | `invites-handler.ts` | GET, POST /api/v2/invites | 3 |
| `memberships.test.ts` | `memberships-handler.ts` | GET, POST /api/v2/memberships | 3 |
| `multipaks.test.ts` | `multipaks-handler.ts` | GET, POST /api/v2/multipaks | 3 |
| `notes.test.ts` | `notes-handler.ts` | GET, POST /api/v2/notes | 3 |
| `pads.test.ts` | `pads-handler.ts` | GET, POST /api/v2/pads | 3 |
| `quicksticks.test.ts` | `quicksticks-handler.ts` | GET, POST /api/v2/quicksticks | 3 |
| `request-access.test.ts` | `request-access-handler.ts` | GET, POST /api/v2/request-access | 3 |
| `social.test.ts` | `social-handler.ts` | GET, POST, PATCH /api/v2/social | 3 |
| `sticks.test.ts` | `sticks-handler.ts` | GET, POST /api/v2/sticks | 3 |
| `tags.test.ts` | `tags-handler.ts` | GET, POST /api/v2/tags | 3 |
| `templates.test.ts` | `templates-handler.ts` | GET, POST /api/v2/templates | 3 |
| `uploads.test.ts` | `uploads-handler.ts` | GET, POST /api/v2/uploads | 3 |
| `webhooks.test.ts` | `webhooks-handler.ts` | GET, POST /api/v2/webhooks | 3 |

**Total: 16 test suites, 48 tests**

## Handler Pattern

Each handler follows this structure:

```typescript
// lib/handlers/example-handler.ts

export interface ExampleSession {
  user: { id: string; org_id?: string }
}

export interface CreateExampleInput {
  name: string
  description?: string | null
}

export async function listExamples(session: ExampleSession) {
  try {
    const items = await query(
      'SELECT * FROM examples WHERE user_id = $1 AND org_id = $2',
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { items } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list examples' } }
  }
}

export async function createExample(session: ExampleSession, input: CreateExampleInput) {
  try {
    const name = requireString(input.name, 'name')
    const item = await querySingle(
      'INSERT INTO examples (user_id, org_id, name) VALUES ($1, $2, $3) RETURNING *',
      [session.user.id, session.user.org_id, name]
    )
    return { status: 201, body: { item } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create example' } }
  }
}
```

## Configuration

### Jest Configuration

Located at `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.env-setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts'],
}
```

### Environment Setup

Located at `jest.env-setup.js`:

```javascript
require('dotenv').config({ 
  path: require('path').resolve(__dirname, '.env.local') 
})
```

## Adding New Tests

1. **Create the handler** in `lib/handlers/new-feature-handler.ts`
2. **Update the route** in `app/api/v2/new-feature/route.ts` to use the handler
3. **Create the test** in `__tests__/api/new-feature.test.ts`

Example test template:

```typescript
// __tests__/api/new-feature.test.ts
import { listFeatures, createFeature, FeatureSession } from '../../lib/handlers/new-feature-handler'

jest.mock('../../lib/database/pg-helpers', () => ({
  query: jest.fn().mockResolvedValue([
    { id: 'feature-1', name: 'Test Feature' },
  ]),
  querySingle: jest.fn().mockResolvedValue({
    id: 'feature-new',
    name: 'New Feature',
  }),
}))

describe('Feature Handler', () => {
  const mockSession: FeatureSession = { user: { id: 'user-1', org_id: 'org-1' } }

  it('should list features', async () => {
    const result = await listFeatures(mockSession)
    expect(result.status).toBe(200)
    expect(Array.isArray(result.body.features)).toBe(true)
  })

  it('should create a feature', async () => {
    const input = { name: 'New Feature' }
    const result = await createFeature(mockSession, input)
    expect(result.status).toBe(201)
    expect(result.body.feature).toBeDefined()
  })

  it('should reject missing name', async () => {
    const input = {} as any
    const result = await createFeature(mockSession, input)
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/name/i)
  })
})
```

## Dependencies

- `jest` - Test runner
- `ts-jest` - TypeScript support for Jest
- `dotenv` - Environment variable loading

## Troubleshooting

### Path Alias Issues
If you see `Cannot find module '@/lib/...'`, ensure `moduleNameMapper` is configured in `jest.config.js`.

### Environment Variables
If database connections fail, ensure `.env.local` exists with valid credentials.

### Mock Issues
Each test file must mock `../../lib/database/pg-helpers` at the top level before imports are resolved.
