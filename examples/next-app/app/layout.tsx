import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VerifyFetch Next.js Example',
  description: 'Example of using VerifyFetch in a Next.js application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
