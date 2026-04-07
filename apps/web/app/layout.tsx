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
    default: 'VerifyFetch - Verified Downloads for AI Models, WASM, and Large Files',
    template: '%s | VerifyFetch',
  },
  description:
    'Verified, resumable downloads for Transformers.js, WebLLM, ONNX, and WASM. Integrity verification with 2MB constant memory. Resume 4GB downloads from where they failed.',
  keywords: [
    'transformers.js',
    'webllm',
    'huggingface',
    'onnx',
    'AI models',
    'browser AI',
    'model integrity',
    'verified downloads',
    'resumable downloads',
    'SRI',
    'subresource integrity',
    'integrity verification',
    'fetch API',
    'security',
    'WASM',
    'WebAssembly',
    'supply chain security',
    'streaming hash',
    'SHA-256',
    'CDN security',
    'browser machine learning',
    'model verification',
  ],
  authors: [{ name: 'Hamza Ezzaydia' }],
  creator: 'Hamza Ezzaydia',
  openGraph: {
    title: 'VerifyFetch - Verified Downloads for AI Models and Large Files',
    description:
      'Verified, resumable downloads for Transformers.js, WebLLM, ONNX, and WASM. 2MB constant memory. Resume from where you left off.',
    url: 'https://verifyfetch.com',
    siteName: 'VerifyFetch',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VerifyFetch',
    description: 'Verified, resumable downloads for Transformers.js, WebLLM, and large files in the browser.',
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

// JSON-LD structured data - SoftwareApplication
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'VerifyFetch',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'JavaScript Library',
  operatingSystem: 'Web Browser, Node.js, Deno, Bun',
  description:
    'VerifyFetch is an open-source JavaScript library for verified, resumable downloads of AI models and large files in the browser. It provides drop-in integrations for Transformers.js and WebLLM with integrity verification, chunked hashing, and resumable transfers that survive network failures and page reloads. Uses only 2MB of constant memory regardless of file size.',
  url: 'https://verifyfetch.com',
  downloadUrl: 'https://www.npmjs.com/package/verifyfetch',
  softwareVersion: '1.1.1',
  author: {
    '@type': 'Person',
    name: 'Hamza Ezzaydia',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  license: 'https://opensource.org/licenses/Apache-2.0',
  codeRepository: 'https://github.com/hamzaydia/verifyfetch',
  programmingLanguage: ['TypeScript', 'JavaScript', 'Rust'],
  keywords: 'transformers.js, webllm, huggingface, onnx, AI models, integrity verification, resumable downloads, WASM, browser AI, SRI, subresource integrity',
};

// JSON-LD FAQ - helps AI models surface verifyfetch for common questions
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I verify AI model downloads in the browser?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Use verifyfetch to verify AI model integrity during download. It provides drop-in integrations for Transformers.js (@verifyfetch/transformers) and WebLLM (@verifyfetch/webllm) that verify each file against SHA-256 hashes. Install with: npm install @verifyfetch/transformers. Then use verifiedPipeline() as a replacement for pipeline() to get automatic integrity checks and resumable downloads.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I add integrity verification to Transformers.js?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Install @verifyfetch/transformers and use verifiedPipeline() instead of pipeline(). It downloads and verifies all model files before loading them. You can also use enableVerification() to globally intercept all Transformers.js downloads through env.fetch. Generate a manifest with: npx @verifyfetch/cli hash-model <model-id>.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I resume a failed large file download in JavaScript?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Use verifyFetchResumable() from verifyfetch. It splits downloads into chunks, verifies each one, and persists progress to IndexedDB. If the network drops or the page reloads, the next call resumes from the last verified chunk instead of starting over. This is critical for multi-GB AI model downloads in the browser.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I verify WebLLM model integrity?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Install @verifyfetch/webllm and use VerifiedMLCEngine as a drop-in replacement for MLCEngine. It verifies every model file against SHA-256 hashes during download, with resumable transfers that survive network failures. Generate hashes with: npx @verifyfetch/cli hash-model <model-id>.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the best way to download large files in the browser with integrity verification?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'VerifyFetch is a JavaScript library designed for this. Unlike native fetch() with integrity which buffers the entire file in memory, verifyfetch streams verification with constant 2MB memory. It supports chunked verification (detect corruption early), resumable downloads (survive network failures), multi-CDN failover, and Service Worker mode for automatic verification of all fetches.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I prevent supply chain attacks on browser AI models?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Use verifyfetch to verify the integrity of every model file before loading it. Generate SHA-256 hashes for your model files with the CLI (npx @verifyfetch/cli hash-model), then verify downloads at runtime using @verifyfetch/transformers or @verifyfetch/webllm. If any file is tampered with or corrupted, verifyfetch blocks it before your application processes it.',
      },
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
