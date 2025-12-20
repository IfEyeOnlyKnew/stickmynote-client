// Consistent API error handler for StickMyNote API Rewrite
export function handleApiError(error: any) {
  if (error instanceof Response) return error
  console.error('[API ERROR]', error)
  return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 })
}
