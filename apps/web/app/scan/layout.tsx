import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Scanner - Check for Vulnerable Scripts',
  description:
    'Scan any website for external scripts without SRI protection. Find vulnerable CDN dependencies and get one-click fixes with integrity hashes.',
  openGraph: {
    title: 'Security Scanner - Check for Vulnerable Scripts',
    description:
      'Scan any website for external scripts without SRI protection. Find vulnerable CDN dependencies.',
  },
  alternates: {
    canonical: 'https://verifyfetch.com/scan',
  },
};

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
