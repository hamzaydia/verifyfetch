import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://verifyfetch.com'),
  title: {
    default: 'VerifyFetch - Streaming Integrity Verification',
    template: '%s | VerifyFetch',
  },
  description:
    'Streaming integrity verification for WASM, AI models, and large files. SRI for fetch() with constant 2MB memory usage.',
  keywords: [
    'SRI',
    'subresource integrity',
    'integrity verification',
    'fetch API',
    'security',
    'WASM',
    'WebAssembly',
    'AI models',
    'supply chain security',
    'streaming hash',
    'SHA-256',
    'CDN security',
  ],
  authors: [{ name: 'Hamza Ezzaydia' }],
  creator: 'Hamza Ezzaydia',
  openGraph: {
    title: 'VerifyFetch - Streaming Integrity Verification',
    description:
      'Verify any file you fetch. Streaming integrity verification for WASM, AI models, and large files with constant 2MB memory.',
    url: 'https://verifyfetch.com',
    siteName: 'VerifyFetch',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VerifyFetch',
    description: 'Verify any file you fetch—before you trust it.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://verifyfetch.com',
  },
};

// JSON-LD structured data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'VerifyFetch',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web Browser, Node.js',
  description:
    'Streaming integrity verification library for WASM, AI models, and large files. SRI for fetch() with constant 2MB memory usage.',
  url: 'https://verifyfetch.com',
  author: {
    '@type': 'Person',
    name: 'Hamza Ezzaydia',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  keywords: 'SRI, integrity, fetch, verification, security, WASM, AI models',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
