# Server Components Migration Guide

## Overview

We've migrated data-heavy views from client-side data fetching to Server Components (RSC) for improved performance and better user experience.

## Benefits

1. **Faster Initial Load**: Data is fetched on the server, closer to the database
2. **Reduced Bundle Size**: Less JavaScript shipped to the client
3. **Better SEO**: Content is rendered on the server
4. **Improved Performance**: No client-side loading states for initial data
5. **Automatic Code Splitting**: Server Components are automatically split

## Architecture

### Data Layer (`lib/data/`)

Centralized data fetching functions that run on the server:

- `notes-data.ts` - Note fetching and statistics
- `pads-data.ts` - Pad fetching with role information
- `sticks-data.ts` - Stick fetching with role information

### Page Structure

Each data-heavy page now follows this pattern:

\`\`\`
app/[page]/
├── page.tsx          # Server Component (fetches data)
└── [page]-client.tsx # Client Component (interactive UI)
\`\`\`

### Example: Notes Page

**Server Component** (`app/notes/page.tsx`):
\`\`\`typescript
export default async function NotesPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")
  
  // Fetch data on the server
  const [notes, stats] = await Promise.all([
    fetchUserNotes(user.id),
    fetchNoteStats(user.id)
  ])
  
  // Pass data to client component
  return <NotesClient initialNotes={notes} userId={user.id} stats={stats} />
}
\`\`\`

**Client Component** (`app/notes/notes-client.tsx`):
\`\`\`typescript
"use client"

export function NotesClient({ initialNotes, userId, stats }: Props) {
  // Interactive features: search, filters, modals
  const [searchTerm, setSearchTerm] = useState("")
  
  return (
    // UI with interactive elements
  )
}
\`\`\`

## Migration Checklist

When converting a page to Server Components:

- [ ] Create data fetching function in `lib/data/`
- [ ] Create Server Component page that fetches data
- [ ] Create Client Component for interactive UI
- [ ] Pass serialized data from Server to Client Component
- [ ] Move interactive state (search, filters) to Client Component
- [ ] Keep data mutations in API routes or Server Actions
- [ ] Add loading states with Suspense boundaries
- [ ] Test authentication and authorization

## Best Practices

1. **Fetch data as close to where it's needed**: Use Server Components to fetch data at the page level
2. **Keep Client Components small**: Only mark components as "use client" when they need interactivity
3. **Pass serializable data**: Only pass JSON-serializable data from Server to Client Components
4. **Use Suspense for loading states**: Wrap async components in Suspense boundaries
5. **Parallel data fetching**: Use `Promise.all()` to fetch multiple data sources in parallel

## Performance Improvements

After migration, you should see:

- **Faster Time to First Byte (TTFB)**: Data fetched on server
- **Reduced JavaScript bundle**: Less client-side code
- **Better Core Web Vitals**: Improved LCP and FID scores
- **Improved caching**: Server-side data can be cached more effectively

## Future Enhancements

- Add streaming with Suspense boundaries
- Implement incremental static regeneration (ISR)
- Add server-side caching with Redis
- Implement optimistic UI updates
- Add real-time subscriptions for collaborative features
