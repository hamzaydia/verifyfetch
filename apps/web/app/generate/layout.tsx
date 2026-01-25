import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SRI Hash Generator - Create Integrity Hashes',
  description:
    'Generate SHA-256, SHA-384, and SHA-512 integrity hashes for files and URLs. Create SRI hashes and VerifyFetch manifests instantly.',
  openGraph: {
    title: 'SRI Hash Generator - Create Integrity Hashes',
    description:
      'Generate SHA-256, SHA-384, and SHA-512 integrity hashes for files and URLs.',
  },
  alternates: {
    canonical: 'https://verifyfetch.com/generate',
  },
};

export default function GenerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
