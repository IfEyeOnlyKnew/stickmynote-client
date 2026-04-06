// Shared response helpers for inference route handlers
// Converts handler { status, body } results to Response objects

export function toResponse(result: { status: number; body: any; headers?: Record<string, string> }): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...result.headers }
  if (result.status === 429) {
    headers['Retry-After'] = headers['Retry-After'] || '30'
  }
  return new Response(JSON.stringify(result.body), { status: result.status, headers })
}

export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
    { status: 429, headers: { 'Retry-After': '30' } }
  )
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}

export function noOrgResponse(): Response {
  return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
}

export function errorResponse(error: unknown, fallbackMessage = 'Internal server error'): Response {
  console.error('[API ERROR]', error)
  const message = error instanceof Error ? error.message : fallbackMessage
  return new Response(JSON.stringify({ error: message }), { status: 500 })
}
