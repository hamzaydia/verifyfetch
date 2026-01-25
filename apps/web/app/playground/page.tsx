'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Play,
  Copy,
  Check,
  Zap,
  Code2,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { codeExamples, memoryData } from '@/lib/examples';

// Dynamic import for Monaco to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type ExampleKey = keyof typeof codeExamples;

// Test file for live demo - a small, stable file we can verify
const TEST_FILE_URL = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/package.json';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (label) {
    return (
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400">{label}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
    >
      {copied ? (
        <Check className="w-4 h-4 text-primary" />
      ) : (
        <Copy className="w-4 h-4 text-zinc-400" />
      )}
    </button>
  );
}

interface DemoResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  hash?: string;
  computedHash?: string;
  size?: number;
  time?: number;
  error?: string;
}

export default function PlaygroundPage() {
  const [activeExample, setActiveExample] = useState<ExampleKey>('basic');
  const [code, setCode] = useState(codeExamples.basic.code);

  // Live demo state
  const [demoResult, setDemoResult] = useState<DemoResult>({ status: 'idle' });
  const [realHash, setRealHash] = useState<string | null>(null);
  const [simulateAttack, setSimulateAttack] = useState(false);

  // Compute hash of test file on mount
  useEffect(() => {
    computeTestFileHash();
  }, []);

  const computeTestFileHash = async () => {
    try {
      const response = await fetch(TEST_FILE_URL);
      const buffer = await response.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      setRealHash(`sha256-${hashBase64}`);
    } catch {
      // Silently fail - demo will show error if run
    }
  };

  // When simulating attack, use a slightly modified hash (like a real tampering would produce)
  const expectedHash = simulateAttack && realHash
    ? realHash.slice(0, -10) + 'XXXXXXXXXX'
    : realHash;

  // Real live demo
  const handleRunDemo = async () => {
    setDemoResult({ status: 'loading' });
    const startTime = performance.now();

    try {
      // Fetch the file
      const response = await fetch(TEST_FILE_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Get the content
      const buffer = await response.arrayBuffer();
      const size = buffer.byteLength;

      // Compute hash (simulating what VerifyFetch does)
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      const computedHash = `sha256-${hashBase64}`;

      const endTime = performance.now();

      // Check if it matches expected
      if (expectedHash && computedHash === expectedHash) {
        setDemoResult({
          status: 'success',
          hash: expectedHash,
          computedHash,
          size,
          time: Math.round(endTime - startTime),
        });
      } else {
        setDemoResult({
          status: 'error',
          hash: expectedHash || 'unknown',
          computedHash,
          error: 'Hash mismatch! File may have been modified.',
        });
      }
    } catch (error) {
      setDemoResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch',
      });
    }
  };

  // Handle example change
  const handleExampleChange = (key: ExampleKey) => {
    setActiveExample(key);
    setCode(codeExamples[key].code);
  };

  // Memory chart data with crash indication
  const chartData = useMemo(() => {
    return memoryData.map((d) => ({
      ...d,
      nativeDisplay: d.native > 1500 ? 1500 : d.native,
      crash: d.native > 1500,
    }));
  }, []);

  return (
    <main className="min-h-screen bg-[rgb(var(--background))]">
      <Navbar />

      <div className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <Code2 className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Playground</h1>
            <p className="text-zinc-400 max-w-xl mx-auto">
              See VerifyFetch in action. Try the live demo, explore code examples,
              and understand the memory benefits.
            </p>
          </motion.div>

          {/* Live Demo Section */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Live Demo
            </h2>
            <p className="text-zinc-400 text-sm mb-6">
              Watch real integrity verification happen in your browser. We'll fetch a file and verify its hash.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Demo Input */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Test File</label>
                <div className="p-3 bg-zinc-800/50 rounded-lg mb-4">
                  <code className="text-xs text-zinc-400 break-all">{TEST_FILE_URL}</code>
                </div>

                <label className="text-sm text-zinc-400 mb-2 block">Expected Hash</label>
                <div className={`p-3 rounded-lg mb-4 ${simulateAttack ? 'bg-red-500/10 border border-red-500/30' : 'bg-zinc-800/50'}`}>
                  <code className={`text-xs break-all ${simulateAttack ? 'text-red-400' : 'text-emerald-400'}`}>
                    {expectedHash || 'Computing...'}
                  </code>
                </div>

                {/* Simulate Attack Toggle */}
                <button
                  onClick={() => {
                    setSimulateAttack(!simulateAttack);
                    setDemoResult({ status: 'idle' });
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg mb-4 border transition-colors ${
                    simulateAttack
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-left">
                    <span className={`text-sm font-medium ${simulateAttack ? 'text-red-400' : 'text-zinc-300'}`}>
                      {simulateAttack ? 'Attack Simulation ON' : 'Simulate Attack'}
                    </span>
                    <p className="text-xs text-zinc-500">
                      {simulateAttack ? 'Hash modified to simulate tampering' : 'See what happens when integrity fails'}
                    </p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                      simulateAttack ? 'bg-red-500' : 'bg-zinc-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        simulateAttack ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>

                <button
                  onClick={handleRunDemo}
                  disabled={demoResult.status === 'loading' || !realHash}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {demoResult.status === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Fetch & Verify
                    </>
                  )}
                </button>
              </div>

              {/* Demo Output */}
              <div className="p-4 bg-black/30 rounded-lg min-h-[200px] flex flex-col">
                <span className="text-xs text-zinc-500 mb-3">Result</span>

                {demoResult.status === 'idle' && (
                  <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                    Click "Fetch & Verify" to run the demo
                  </div>
                )}

                {demoResult.status === 'loading' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-zinc-400 text-sm">Fetching and computing hash...</span>
                  </div>
                )}

                {demoResult.status === 'success' && (
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Verification Successful!</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">File Size</span>
                        <span className="text-zinc-300">{demoResult.size?.toLocaleString()} bytes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Time</span>
                        <span className="text-zinc-300">{demoResult.time}ms</span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800">
                        <span className="text-zinc-500 text-xs block mb-1">Computed Hash</span>
                        <code className="text-xs text-emerald-400 break-all">{demoResult.computedHash}</code>
                      </div>
                    </div>
                  </div>
                )}

                {demoResult.status === 'error' && (
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">Verification Failed</span>
                    </div>
                    <p className="text-sm text-red-300/70">{demoResult.error}</p>
                    {demoResult.computedHash && (
                      <div className="pt-2 border-t border-zinc-800">
                        <span className="text-zinc-500 text-xs block mb-1">Got</span>
                        <code className="text-xs text-red-400 break-all">{demoResult.computedHash}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* What just happened */}
            {demoResult.status === 'success' && (
              <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <h3 className="text-sm font-medium text-emerald-400 mb-2">File integrity verified!</h3>
                <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Fetched the file from the CDN</li>
                  <li>Computed SHA-256 hash of the content</li>
                  <li>Compared against the expected hash</li>
                  <li>Hashes matched - safe to use!</li>
                </ol>
                <p className="text-xs text-zinc-500 mt-3">
                  Try enabling "Simulate Attack" to see what happens when a file is tampered with.
                </p>
              </div>
            )}

            {demoResult.status === 'error' && simulateAttack && (
              <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <h3 className="text-sm font-medium text-red-400 mb-2">Attack blocked!</h3>
                <p className="text-xs text-zinc-400 mb-2">
                  This is exactly what happens when a CDN is compromised or a file is modified in transit.
                  VerifyFetch detects the mismatch and blocks the tampered content.
                </p>
                <p className="text-xs text-zinc-500">
                  Without integrity verification, your app would have loaded the malicious file.
                </p>
              </div>
            )}
          </motion.section>

          {/* Code Examples */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />
              Code Examples
            </h2>

            {/* Example Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(codeExamples) as ExampleKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleExampleChange(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeExample === key
                      ? 'bg-primary text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {codeExamples[key].title}
                </button>
              ))}
            </div>

            {/* Code Editor */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="text-sm text-zinc-400">{codeExamples[activeExample].title}</span>
                <CopyButton text={code} label="Copy" />
              </div>
              <div className="h-80">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-dark"
                  beforeMount={(monaco) => {
                    // Disable TypeScript validation - these are reference examples
                    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                      noSemanticValidation: true,
                      noSyntaxValidation: true,
                    });
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 16 },
                    readOnly: false,
                  }}
                />
              </div>
            </div>

            {/* Note about examples */}
            <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              These are code examples for reference. Install VerifyFetch to run them in your project.
            </p>
          </motion.section>

          {/* Memory Comparison */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Memory Usage Comparison
            </h2>
            <p className="text-zinc-400 text-sm mb-6">
              Native <code className="text-zinc-300">crypto.subtle.digest()</code> loads entire files into memory.
              VerifyFetch streams with constant 2MB usage.
            </p>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    axisLine={{ stroke: '#3f3f46' }}
                  />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    axisLine={{ stroke: '#3f3f46' }}
                    tickFormatter={(value) =>
                      value >= 1024 ? `${value / 1024} GB` : `${value} MB`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Native' && value >= 1500) {
                        return ['CRASH', name];
                      }
                      return [
                        value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${value} MB`,
                        name,
                      ];
                    }}
                  />
                  <Bar
                    dataKey="nativeDisplay"
                    name="Native"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.crash ? '#7f1d1d' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="verifyfetch"
                    name="VerifyFetch"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-sm text-zinc-400">Native (loads entire file)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-sm text-zinc-400">VerifyFetch (constant 2MB)</span>
              </div>
            </div>
          </motion.section>

          {/* CTA */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <div className="inline-flex flex-col items-center p-8 glass rounded-2xl">
              <h2 className="text-2xl font-bold mb-2">Ready to add integrity verification?</h2>
              <p className="text-zinc-400 mb-6">Get started with one command</p>

              <div className="flex items-center gap-4 mb-6">
                <code className="px-4 py-2 bg-zinc-800 rounded-lg text-primary font-mono">
                  npm install verifyfetch
                </code>
                <CopyButton text="npm install verifyfetch" />
              </div>

              <a
                href="https://github.com/hamzaydia/verifyfetch#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                View Documentation
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
