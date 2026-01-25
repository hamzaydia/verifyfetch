import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VerifyFetch',
    short_name: 'VerifyFetch',
    description: 'Streaming integrity verification for WASM, AI models, and large files',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#10b981',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
