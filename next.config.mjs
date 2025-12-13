import bundleAnalyzer from '@next/bundle-analyzer'
import { withSentryConfig } from '@sentry/nextjs'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true' && !process.env.VERCEL,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    instrumentationHook: true,
  },

  // Production optimizations
  compress: true,
  poweredByHeader: false,

  productionBrowserSourceMaps: false,

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: ["stickmynote.com", "www.stickmynote.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.vimeocdn.com",
      },
      {
        protocol: "https",
        hostname: "**.imgur.com",
      },
      {
        protocol: "https",
        hostname: "**.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.pexels.com",
      },
      {
        protocol: "https",
        hostname: "**.pixabay.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "vercel.com",
      },
      {
        protocol: "https",
        hostname: "**.vercel.com",
      },
      {
        protocol: "https",
        hostname: "**.vercel.app",
      },
      {
        protocol: "https",
        hostname: "stickmynote.com",
      },
      {
        protocol: "https",
        hostname: "www.stickmynote.com",
      },
      {
        protocol: "https",
        hostname: "ifeyeonlyknew.com",
      },
      {
        protocol: "https",
        hostname: "www.ifeyeonlyknew.com",
      },
    ],
  },

  // Compiler optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  // Environment variables
  env: {
    CUSTOM_DOMAIN: "stickmynote.com",
    APP_NAME: "Stick My Note",
  },

  // Security headers
  async headers() {
    return [
      // Cache static files
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache images
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/(.*)",
              has: [
                {
                  type: "header",
                  key: "x-forwarded-proto",
                  value: "http",
                },
              ],
              destination: "https://www.stickmynote.com/:path*",
              permanent: true,
            },
          ]
        : []),
    ];
  },

  // Rewrites for custom domain
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap",
      },
      {
        source: "/robots.txt",
        destination: "/api/robots",
      },
    ];
  },

  webpack: (config, { isServer, dev }) => {
    // Fix for the Supabase Realtime client in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
        crypto: false,
      };
    }

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        "isomorphic-dompurify"
      );
    }

    // Reduce warnings
    config.module.exprContextCritical = false;

    // Bundle optimization for production
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: "supabase",
            chunks: "all",
            priority: 10,
          },
          lucide: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: "lucide",
            chunks: "all",
            priority: 10,
          },
          sentry: {
            test: /[\\/]node_modules[\\/]@sentry[\\/]/,
            name: "sentry",
            chunks: "all",
            priority: 10,
          },
        },
      };
    }

    return config;
  },

  // Standalone output if requested
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,

  // Request logging in dev
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
};

const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  
  // Organization and project from environment variables
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Release tracking
  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    deploy: {
      env: process.env.NODE_ENV || 'development',
    },
  },
  
  // Source maps configuration
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  
  // Automatically tree-shake Sentry logger statements
  automaticVercelMonitors: true,
}

// Only enable Sentry in production builds with proper configuration
const shouldEnableSentry = 
  process.env.NODE_ENV === 'production' && 
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT

export default shouldEnableSentry
  ? withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions)
  : withBundleAnalyzer(nextConfig)
