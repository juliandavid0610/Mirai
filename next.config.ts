import type { NextConfig } from 'next';

/**
 * `pixi-live2d-display` ships untranspiled ESM that references PIXI internals,
 * so it has to go through the app's own compilation pipeline rather than being
 * treated as a pre-built package.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['pixi-live2d-display', 'pixi.js'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            // The app legitimately needs the mic for voice input; everything else is denied.
            value: 'camera=(), geolocation=(), microphone=(self)',
          },
        ],
      },
      {
        // Live2D model assets are immutable once published — cache them hard.
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
