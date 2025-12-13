# Bundle Optimization Guide

## Running Bundle Analysis

To analyze your application's bundle size:

\`\`\`bash
npm run analyze
\`\`\`

This will:
1. Build your application in production mode
2. Generate interactive HTML reports showing bundle composition
3. Open the reports in your browser automatically

The reports will be saved in `.next/analyze/`:
- `client.html` - Client-side bundle analysis
- `server.html` - Server-side bundle analysis (if applicable)

## Understanding the Reports

### Key Metrics to Monitor

1. **Total Bundle Size**: Should be < 200KB for initial load
2. **Largest Chunks**: Identify heavy dependencies
3. **Duplicate Code**: Look for packages included multiple times
4. **Tree-shaking Effectiveness**: Check if unused code is eliminated

### Common Issues

#### Large Dependencies

If you see large packages in your bundle:
- Check if you're importing the entire library instead of specific functions
- Consider lazy loading heavy components
- Look for lighter alternatives

Example:
\`\`\`typescript
// ❌ Bad - imports entire library
import _ from 'lodash'

// ✅ Good - imports only what's needed
import debounce from 'lodash/debounce'
\`\`\`

#### Duplicate Dependencies

If you see the same package multiple times:
- Check if different versions are being used
- Use `npm dedupe` to consolidate dependencies
- Consider using `peerDependencies` for shared packages

## When to Use "use client"

### ✅ Use "use client" when:

1. **Using React Hooks**
   \`\`\`typescript
   "use client"
   import { useState, useEffect } from 'react'
   \`\`\`

2. **Handling Browser Events**
   \`\`\`typescript
   "use client"
   <button onClick={() => handleClick()}>Click</button>
   \`\`\`

3. **Accessing Browser APIs**
   \`\`\`typescript
   "use client"
   localStorage.getItem('key')
   window.location.href
   \`\`\`

4. **Using Context Providers/Consumers**
   \`\`\`typescript
   "use client"
   const value = useContext(MyContext)
   \`\`\`

5. **Third-party Libraries Requiring Client**
   - Most UI libraries (Radix UI, etc.)
   - Animation libraries
   - Chart libraries

### ❌ Don't use "use client" when:

1. **Just Rendering Static Content**
   \`\`\`typescript
   // No "use client" needed
   export function StaticComponent({ data }) {
     return <div>{data.title}</div>
   }
   \`\`\`

2. **Server-side Data Fetching**
   \`\`\`typescript
   // No "use client" needed
   export default async function Page() {
     const data = await fetchData()
     return <div>{data}</div>
   }
   \`\`\`

3. **Pure Utility Functions**
   \`\`\`typescript
   // No "use client" needed
   export function formatDate(date: Date) {
     return date.toISOString()
   }
   \`\`\`

## Optimization Strategies

### 1. Code Splitting

Use dynamic imports for heavy components:

\`\`\`typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false // Disable SSR if not needed
})
\`\`\`

### 2. Server Components by Default

Keep components as Server Components unless they need client-side features:

\`\`\`typescript
// ✅ Server Component (default)
export function ProductList({ products }) {
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

// ✅ Client Component (only for interactive parts)
"use client"
export function AddToCartButton({ productId }) {
  const [loading, setLoading] = useState(false)
  // ... interactive logic
}
\`\`\`

### 3. Lazy Load Heavy Dependencies

\`\`\`typescript
"use client"
import { useState } from 'react'

export function ChartComponent() {
  const [showChart, setShowChart] = useState(false)
  
  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <LazyChart /> // Only loads when needed
      )}
    </div>
  )
}

const LazyChart = dynamic(() => import('./Chart'), {
  loading: () => <div>Loading chart...</div>
})
\`\`\`

### 4. Optimize Images

\`\`\`typescript
import Image from 'next/image'

// ✅ Use Next.js Image component
<Image
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  loading="lazy"
/>
\`\`\`

### 5. Remove Unused Dependencies

Regularly audit your dependencies:

\`\`\`bash
# Check for unused dependencies
npx depcheck

# Remove unused packages
npm uninstall <package-name>
\`\`\`

## Bundle Size Targets

### Initial Load
- **Excellent**: < 100KB
- **Good**: 100-200KB
- **Needs Improvement**: 200-300KB
- **Poor**: > 300KB

### Total JavaScript
- **Excellent**: < 300KB
- **Good**: 300-500KB
- **Needs Improvement**: 500-800KB
- **Poor**: > 800KB

## Monitoring

Set up bundle size monitoring in CI/CD:

\`\`\`json
{
  "scripts": {
    "build:check-size": "npm run build && node scripts/check-bundle-size.js"
  }
}
\`\`\`

## Resources

- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Next.js Optimizing Bundle Size](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [React Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
