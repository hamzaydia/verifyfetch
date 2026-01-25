'use client';

import { useState } from 'react';
import { useVerifiedFetch } from '../hooks/useVerifiedFetch';

// Example: Loading a verified JSON file from CDN
const EXAMPLE_URL = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/package.json';
const EXAMPLE_SRI = 'sha256-jkGwfHRKDeDSwcI+1BQY7LCEmrtWOV0ogC5gG0cw18I=';

export default function Home() {
  const [result, setResult] = useState<string>('');
  const { loading, error, progress, fetch } = useVerifiedFetch<{ name: string; version: string }>();

  const handleFetch = async () => {
    try {
      const data = await fetch(EXAMPLE_URL, EXAMPLE_SRI as any);
      setResult(`✓ Loaded: ${data.name}@${data.version}`);
    } catch (err) {
      setResult(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>VerifyFetch Next.js Example</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>Verified Fetch Demo</h2>
        <p>Click the button to fetch and verify a file from CDN:</p>

        <button
          onClick={handleFetch}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {loading ? `Loading... ${progress}%` : 'Fetch & Verify'}
        </button>

        {result && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
            }}
          >
            {result}
          </pre>
        )}

        {error && (
          <div style={{ color: 'red', marginTop: '1rem' }}>Error: {error.message}</div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>How it works</h2>
        <ol>
          <li>The button triggers a fetch to the CDN</li>
          <li>VerifyFetch streams the response while computing its hash</li>
          <li>The hash is compared against the expected SRI</li>
          <li>If they match, the data is safe to use</li>
          <li>If they don't match, an IntegrityError is thrown</li>
        </ol>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Code Example</h2>
        <pre
          style={{
            padding: '1rem',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            borderRadius: '4px',
            overflow: 'auto',
          }}
        >
          {`import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch(
  'https://cdn.example.com/model.bin',
  { sri: 'sha256-...' }
);

const data = await response.arrayBuffer();`}
        </pre>
      </section>
    </main>
  );
}
