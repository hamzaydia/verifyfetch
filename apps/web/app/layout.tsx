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
  title: 'VerifyFetch - Verify any file you fetch',
  description:
    'Streaming integrity verification for WASM, AI models, and large files. SRI for fetch() with constant 2MB memory usage.',
  keywords: [
    'SRI',
    'integrity',
    'fetch',
    'verification',
    'security',
    'WASM',
    'AI models',
    'supply chain',
  ],
  authors: [{ name: 'Hamza Ezzaydia' }],
  openGraph: {
    title: 'VerifyFetch - Verify any file you fetch',
    description:
      'Streaming integrity verification for WASM, AI models, and large files.',
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
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
