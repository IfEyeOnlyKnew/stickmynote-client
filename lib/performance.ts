// Performance monitoring utilities
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (globalThis.window !== undefined) {
      this.initializeWebVitals();
    }
  }

  private initializeWebVitals() {
    // Core Web Vitals monitoring
    if ("PerformanceObserver" in globalThis) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries.at(-1) as any;
        this.recordMetric("LCP", lastEntry.startTime, {
          element: lastEntry.element?.tagName,
          url: lastEntry.url,
        });
      });

      try {
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn("LCP observer not supported");
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordMetric("FID", entry.processingStart - entry.startTime, {
            eventType: entry.name,
          });
        });
      });

      try {
        fidObserver.observe({ entryTypes: ["first-input"] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn("FID observer not supported");
      }

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        if (clsValue > 0) {
          this.recordMetric("CLS", clsValue);
        }
      });

      try {
        clsObserver.observe({ entryTypes: ["layout-shift"] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn("CLS observer not supported");
      }
    }
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`Performance: ${name} = ${value}ms`, metadata);
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter((metric) => metric.name === name);
  }

  getAverageMetric(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  clearMetrics() {
    this.metrics = [];
  }

  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.clearMetrics();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper functions for measuring custom performance
export function measureAsync<T>(
  name: string,
  asyncFn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  return asyncFn().then(
    (result) => {
      const duration = performance.now() - start;
      performanceMonitor.recordMetric(name, duration);
      return result;
    },
    (error) => {
      const duration = performance.now() - start;
      performanceMonitor.recordMetric(name, duration, { error: true });
      throw error;
    }
  );
}

export function measureSync<T>(name: string, syncFn: () => T): T {
  const start = performance.now();
  try {
    const result = syncFn();
    const duration = performance.now() - start;
    performanceMonitor.recordMetric(name, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    performanceMonitor.recordMetric(name, duration, { error: true });
    throw error;
  }
}

// Database query performance tracking
export function trackDatabaseQuery(
  query: string,
  duration: number,
  error?: boolean
) {
  performanceMonitor.recordMetric("database_query", duration, {
    query: query.substring(0, 100), // Truncate long queries
    error,
  });
}

// API request performance tracking
export function trackApiRequest(
  endpoint: string,
  method: string,
  duration: number,
  status: number
) {
  performanceMonitor.recordMetric("api_request", duration, {
    endpoint,
    method,
    status,
    error: status >= 400,
  });
}

// Component render performance tracking
export function trackComponentRender(componentName: string, duration: number) {
  performanceMonitor.recordMetric("component_render", duration, {
    component: componentName,
  });
}
