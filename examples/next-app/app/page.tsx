'use client';

import { useState } from 'react';
import { useVerifiedFetch } from '../hooks/useVerifiedFetch';

// Example CDN assets
const EXAMPLE_URL = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/package.json';
const EXAMPLE_SRI = 'sha256-jkGwfHRKDeDSwcI+1BQY7LCEmrtWOV0ogC5gG0cw18I=';

const LARGE_FILE_URL = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js';
const LARGE_FILE_SRI = 'sha256-qXBd/EfAdjOA2FGrGAG+b3YBn2tn5A6bhz+LSgYD96k=';

export default function Home() {
  const [result, setResult] = useState<string>('');
  const [streamResult, setStreamResult] = useState<string>('');
  const { loading, error, progress, fetch, fetchStream } = useVerifiedFetch<{ name: string; version: string }>();

  // Basic buffered fetch
  const handleFetch = async () => {
    setResult('');
    try {
      const data = await fetch(EXAMPLE_URL, EXAMPLE_SRI as any);
      setResult(`✓ Loaded: ${data.name}@${data.version}`);
    } catch (err) {
      setResult(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Streaming fetch (constant memory)
  const handleStreamFetch = async () => {
    setStreamResult('');
    let totalBytes = 0;
    let chunkCount = 0;

    try {
      await fetchStream(LARGE_FILE_URL, LARGE_FILE_SRI as any, (chunk) => {
        totalBytes += chunk.length;
        chunkCount++;
      });
      setStreamResult(`✓ Streamed: ${totalBytes.toLocaleString()} bytes in ${chunkCount} chunks`);
    } catch (err) {
      setStreamResult(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>VerifyFetch Next.js Example</h1>
      <p style={{ color: '#666' }}>v1.0.0 features: Streaming, Multi-CDN, Service Worker, Resumable Downloads</p>

      {/* Basic Fetch Demo */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h2>1. Basic Verified Fetch</h2>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Uses <code>verifyFetch()</code> - buffers response (convenient, O(n) memory)
        </p>

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
            marginTop: '1rem',
          }}
        >
          {loading && !streamResult ? `Loading... ${progress}%` : 'Fetch & Verify JSON'}
        </button>

        {result && (
          <pre style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
            {result}
          </pre>
        )}
      </section>

      {/* Streaming Fetch Demo */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f0fff0', borderRadius: '8px' }}>
        <h2>2. Streaming Verification</h2>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Uses <code>verifyFetchStream()</code> - constant ~2MB memory, process chunks as they arrive
        </p>

        <button
          onClick={handleStreamFetch}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginTop: '1rem',
          }}
        >
          {loading && streamResult === '' ? `Streaming... ${progress}%` : 'Stream & Verify JS'}
        </button>

        {streamResult && (
          <pre style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
            {streamResult}
          </pre>
        )}
      </section>

      {error && (
        <div style={{ color: 'red', marginTop: '1rem', padding: '1rem', backgroundColor: '#fff0f0', borderRadius: '4px' }}>
          Error: {error.message}
        </div>
      )}

      {/* How it works */}
      <section style={{ marginTop: '2rem' }}>
        <h2>How it works</h2>
        <ol style={{ lineHeight: '1.8' }}>
          <li>The button triggers a fetch to the CDN</li>
          <li>VerifyFetch streams the response while computing its hash</li>
          <li>The hash is compared against the expected SRI</li>
          <li>If they match, the data is safe to use</li>
          <li>If they don't match, an IntegrityError is thrown</li>
        </ol>
      </section>

      {/* Key Features */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Key Features</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Feature</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>API</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>Streaming (constant memory)</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}><code>verifyFetchStream()</code></td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>Multi-CDN failover</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}><code>verifyFetchFromSources()</code></td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>Service Worker mode</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}><code>createVerifyWorker()</code></td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>Chunked verification (fail-fast)</td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}><code>npx verifyfetch sign --chunked</code></td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Code Examples */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Code Examples</h2>

        <h3>Basic Fetch</h3>
        <pre style={{ padding: '1rem', backgroundColor: '#1e1e1e', color: '#d4d4d4', borderRadius: '4px', overflow: 'auto' }}>
{`import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('/model.bin', {
  sri: 'sha256-...'
});
const data = await response.arrayBuffer();`}
        </pre>

        <h3>Streaming (Constant Memory)</h3>
        <pre style={{ padding: '1rem', backgroundColor: '#1e1e1e', color: '#d4d4d4', borderRadius: '4px', overflow: 'auto', marginTop: '1rem' }}>
{`import { verifyFetchStream } from 'verifyfetch';

const { stream, verified } = await verifyFetchStream('/model.bin', {
  sri: 'sha256-...'
});

for await (const chunk of stream) {
  await uploadToGPU(chunk); // Process immediately
}

await verified; // Throws if hash doesn't match`}
        </pre>
      </section>
    </main>
  );
}
