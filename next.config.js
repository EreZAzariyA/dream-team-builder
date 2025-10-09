/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server external packages (moved from experimental)
  serverExternalPackages: ['mongoose', 'mongodb', '@mongodb-js/zstd', 'mongodb-client-encryption'],
  
  // Fix for Vercel deployment issues
  experimental: {
    optimizePackageImports: ['@tanstack/react-query']
  },
  
  // Disable ESLint during build to avoid issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Build optimization
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  async rewrites() {
    return [
      {
        source: '/admin',
        destination: '/dashboard',
      },
      {
        source: '/admin/settings',
        destination: '/settings',
      },
      {
        source: '/admin/agents',
        destination: '/agents',
      },
      {
        source: '/admin/analytics',
        destination: '/analytics',
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer, webpack }) => {
    // Handle MongoDB and native modules
    if (!isServer) {
      // For client-side, completely ignore these server-only modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // MongoDB related
        'mongodb': false,
        'mongodb-client-encryption': false,
        'mongoose': false,
        '@mongodb-js/zstd': false,
        'kerberos': false,
        'snappy': false,
        'bson-ext': false,
        '@aws-sdk/credential-providers': false,
        'gcp-metadata': false,
        // Node.js built-ins
        'fs': false,
        'net': false,
        'tls': false,
        'crypto': false,
        'path': false,
        'os': false,
        'util': false,
        'buffer': false,
        'events': false,
        'child_process': false,
        'cluster': false,
        'dgram': false,
        'dns': false,
        'http': false,
        'https': false,
        'querystring': false,
        'readline': false,
        'repl': false,
        'string_decoder': false,
        'sys': false,
        'timers': false,
        'tty': false,
        'url': false,
        'v8': false,
        'vm': false,
        'zlib': false,
      };
      
      // webpack is now available as parameter from Next.js
      
      // Add plugin to ignore .node files completely
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /\.node$/,
        })
      );
      
      // Add plugin to ignore mongodb-client-encryption and related modules
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(mongodb-client-encryption|@mongodb-js\/zstd|kerberos|snappy|bson-ext)$/,
        })
      );
      
      // Ignore MongoDB native modules completely on client side
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^mongodb-client-encryption$/,
          'data:text/javascript,module.exports = {}'
        )
      );
    }
    
    return config;
  },
  
  // Environment variables
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
  },
  
  // Disable source maps in production for better performance
  productionBrowserSourceMaps: false,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  
  // Compression
  compress: true,
  reactStrictMode: false,
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;