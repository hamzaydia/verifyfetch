import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Can't use static export with API routes
  // output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
