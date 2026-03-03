import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
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
    // Prevent ldapjs from being bundled - will be loaded from node_modules at runtime only
    serverComponentsExternalPackages: ["ldapjs", "openid-client", "livekit-server-sdk"],
  },

  // Also add to top-level serverExternalPackages for Next.js 14.2+
  serverExternalPackages: ["ldapjs", "openid-client", "livekit-server-sdk"],

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
        hostname: "stickmynote.com",
      },
      {
        protocol: "https",
        hostname: "www.stickmynote.com",
      },
      {
        protocol: "https",
        hostname: "stickmynotes.com",
      },
      {
        protocol: "https",
        hostname: "www.stickmynotes.com",
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
      // User-uploaded content — moderate TTL with background revalidation
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      // User-generated exports — short TTL, private (user-specific)
      {
        source: "/exports/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, max-age=300, no-transform",
          },
        ],
      },
      // Favicon and icons — 30-day TTL
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
      {
        source: "/apple-icon.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
      {
        source: "/icon:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
      {
        source: "/placeholder:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
      // PWA manifest — short TTL (can change when app metadata changes)
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      // Service worker — never cache (browsers rely on fresh responses for update detection)
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
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
    // Browser compatibility fallbacks
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
        "isomorphic-dompurify",
        // Externalize ldapjs to prevent it from being bundled and attempting connections during build
        "ldapjs",
        // Externalize openid-client for SSO OIDC support
        "openid-client",
        // Externalize livekit-server-sdk (server-only, has native Node.js deps)
        "livekit-server-sdk"
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
          lucide: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: "lucide",
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

export default withBundleAnalyzer(nextConfig)
