import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Playground - Test Integrity Verification',
  description:
    'Interactive demo of streaming integrity verification. See real-time file verification with attack simulation and memory comparison.',
  openGraph: {
    title: 'Playground - Test Integrity Verification',
    description:
      'Interactive demo of streaming integrity verification with attack simulation.',
  },
  alternates: {
    canonical: 'https://verifyfetch.com/playground',
  },
};

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
