'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Hash,
  FileJson,
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  Loader2,
  Link,
  Code,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

type Algorithm = 'sha256' | 'sha384' | 'sha512';
type InputMode = 'file' | 'url';

interface ManifestEntry {
  path: string;
  sri: string;
  fileName: string;
}

async function hashFile(file: File, algorithm: Algorithm): Promise<string> {
  const buffer = await file.arrayBuffer();
  const algorithmMap = {
    sha256: 'SHA-256',
    sha384: 'SHA-384',
    sha512: 'SHA-512',
  };
  const hashBuffer = await crypto.subtle.digest(algorithmMap[algorithm], buffer);
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return `${algorithm}-${hashBase64}`;
}

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

export default function GeneratePage() {
  // Hash Generator State
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [algorithm, setAlgorithm] = useState<Algorithm>('sha256');
  const [hash, setHash] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Manifest Builder State
  const [manifestEntries, setManifestEntries] = useState<ManifestEntry[]>([]);
  const [manifestAlgorithm, setManifestAlgorithm] = useState<Algorithm>('sha256');
  const [manifestDragActive, setManifestDragActive] = useState(false);
  const [manifestHashing, setManifestHashing] = useState(false);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setHash(null);
      setHashError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // Hash the file or URL
  const handleHash = async () => {
    setHashing(true);
    setHashError(null);
    setHash(null);

    try {
      if (inputMode === 'file') {
        if (!file) return;
        const result = await hashFile(file, algorithm);
        setHash(result);
      } else {
        if (!url.trim()) return;
        const response = await fetch('/api/generate-sri/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), algorithm }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch URL');
        }
        setHash(data.hash);
      }
    } catch (error) {
      setHashError(error instanceof Error ? error.message : 'Failed to generate hash');
    }
    setHashing(false);
  };

  // Manifest functions
  const normalizePath = (path: string): string => {
    let normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized;
  };

  const handleManifestFiles = async (files: FileList) => {
    setManifestHashing(true);
    const newEntries: ManifestEntry[] = [];

    for (const file of Array.from(files)) {
      try {
        const sri = await hashFile(file, manifestAlgorithm);
        const path = normalizePath(file.name);
        newEntries.push({ path, sri, fileName: file.name });
      } catch (error) {
        console.error(`Failed to hash ${file.name}:`, error);
      }
    }

    setManifestEntries([...manifestEntries, ...newEntries]);
    setManifestHashing(false);
  };

  const updateEntryPath = (index: number, newPath: string) => {
    const updated = [...manifestEntries];
    updated[index].path = normalizePath(newPath);
    setManifestEntries(updated);
  };

  const removeFromManifest = (index: number) => {
    setManifestEntries(manifestEntries.filter((_, i) => i !== index));
  };

  const getManifestJSON = () => {
    return JSON.stringify({
      version: 1,
      base: '/',
      artifacts: Object.fromEntries(
        manifestEntries.map((e) => [e.path, { sri: e.sri }])
      ),
    }, null, 2);
  };

  const downloadManifest = () => {
    const blob = new Blob([getManifestJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vf.manifest.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resourceName = inputMode === 'file'
    ? (file?.name || 'file.js')
    : (url ? new URL(url).pathname.split('/').pop() || 'resource' : 'resource');

  const verifyFetchCode = hash
    ? `import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('${inputMode === 'url' ? url : '/' + resourceName}', {
  sri: '${hash}'
});`
    : '';

  return (
    <main className="min-h-screen bg-[rgb(var(--background))]">
      <Navbar />

      <div className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <Hash className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold mb-4">SRI Generator</h1>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Generate SRI hashes for your files or URLs, then use them with VerifyFetch
              for runtime integrity verification.
            </p>
          </motion.div>

          {/* Hash Generator */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Generate SRI Hash
            </h2>

            {/* Input Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setInputMode('file');
                  setHash(null);
                  setHashError(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === 'file'
                    ? 'bg-primary text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                Local File
              </button>
              <button
                onClick={() => {
                  setInputMode('url');
                  setHash(null);
                  setHashError(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === 'url'
                    ? 'bg-primary text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Link className="w-4 h-4" />
                URL
              </button>
            </div>

            {/* File Input */}
            {inputMode === 'file' && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      setFile(selectedFile);
                      setHash(null);
                      setHashError(null);
                    }
                  }}
                />
                <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                {file ? (
                  <div>
                    <p className="text-zinc-200 font-medium">{file.name}</p>
                    <p className="text-sm text-zinc-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-zinc-300">Drop a file here or click to upload</p>
                    <p className="text-sm text-zinc-500 mt-1">Any file type supported</p>
                  </div>
                )}
              </div>
            )}

            {/* URL Input */}
            {inputMode === 'url' && (
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setHash(null);
                  setHashError(null);
                }}
                placeholder="https://cdn.example.com/library.js"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
              />
            )}

            {/* Algorithm Selection */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400">Algorithm:</span>
                <div className="flex gap-2">
                  {(['sha256', 'sha384', 'sha512'] as Algorithm[]).map((algo) => (
                    <button
                      key={algo}
                      onClick={() => {
                        setAlgorithm(algo);
                        setHash(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        algorithm === algo
                          ? 'bg-primary text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {algo.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleHash}
                disabled={(inputMode === 'file' && !file) || (inputMode === 'url' && !url.trim()) || hashing}
                className="btn-primary w-full sm:w-auto sm:ml-auto disabled:opacity-50"
              >
                {hashing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Hash className="w-4 h-4" />
                )}
                Generate Hash
              </button>
            </div>

            {/* Error */}
            {hashError && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {hashError}
              </div>
            )}

            {/* Hash Output */}
            {hash && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-6 space-y-4"
              >
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">SRI Hash</label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-zinc-800/50 rounded-lg text-sm font-mono text-emerald-400 break-all">
                      {hash}
                    </code>
                    <CopyButton text={hash} />
                  </div>
                </div>

                {/* VerifyFetch Usage */}
                <div className="pt-4 border-t border-zinc-800">
                  <label className="text-sm text-zinc-400 mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Use with VerifyFetch
                  </label>
                  <div className="relative">
                    <pre className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-300 overflow-x-auto">
                      {verifyFetchCode}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton text={verifyFetchCode} label="Copy" />
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Ready to add runtime verification?</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Streaming verification with constant 2MB memory</p>
                  </div>
                  <code className="text-sm text-primary font-mono">npm i verifyfetch</code>
                </div>
              </motion.div>
            )}
          </motion.section>

          {/* Manifest Builder */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileJson className="w-5 h-5 text-primary" />
              Manifest Builder
            </h2>

            <p className="text-zinc-400 text-sm mb-2">
              Build a <code className="text-primary">vf.manifest.json</code> to verify multiple files automatically.
            </p>
            <p className="text-zinc-500 text-xs mb-6">
              Place this file at your site root and VerifyFetch will auto-verify matching paths.
            </p>

            {/* Algorithm Selection for Manifest */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-zinc-400">Algorithm:</span>
              <div className="flex gap-2">
                {(['sha256', 'sha384', 'sha512'] as Algorithm[]).map((algo) => (
                  <button
                    key={algo}
                    onClick={() => setManifestAlgorithm(algo)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      manifestAlgorithm === algo
                        ? 'bg-primary text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {algo.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop Zone for Multiple Files */}
            <div
              onDrop={(e) => {
                e.preventDefault();
                setManifestDragActive(false);
                if (e.dataTransfer.files.length > 0) {
                  handleManifestFiles(e.dataTransfer.files);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setManifestDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setManifestDragActive(false);
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer mb-6 ${
                manifestDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => document.getElementById('manifest-file-input')?.click()}
            >
              <input
                id="manifest-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleManifestFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              {manifestHashing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-zinc-400">Hashing files...</span>
                </div>
              ) : (
                <>
                  <Plus className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-zinc-300">Drop files here or click to add</p>
                  <p className="text-sm text-zinc-500 mt-1">Select multiple files at once</p>
                </>
              )}
            </div>

            {/* Entries List */}
            {manifestEntries.length > 0 ? (
              <>
                <div className="space-y-2 mb-4">
                  {manifestEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg"
                    >
                      <input
                        type="text"
                        value={entry.path}
                        onChange={(e) => updateEntryPath(i, e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-300 font-mono focus:outline-none focus:border-primary/50"
                      />
                      <code className="text-xs text-zinc-500 truncate max-w-[200px]" title={entry.sri}>
                        {entry.sri.slice(0, 20)}...
                      </code>
                      <button
                        onClick={() => removeFromManifest(i)}
                        className="text-zinc-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Manifest Preview */}
                <div className="mb-4">
                  <label className="text-sm text-zinc-400 mb-2 block">Preview</label>
                  <div className="relative">
                    <pre className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-zinc-400 overflow-x-auto max-h-48">
                      {getManifestJSON()}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton text={getManifestJSON()} label="Copy" />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={downloadManifest} className="btn-primary w-full sm:w-auto">
                    <Download className="w-4 h-4" />
                    Download vf.manifest.json
                  </button>
                  <button
                    onClick={() => setManifestEntries([])}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </button>
                </div>

                {/* Usage hint */}
                <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-2">
                    <span className="text-zinc-400">Usage:</span>
                  </p>
                  <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">{`const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});
const data = await vf.arrayBuffer('/file.wasm');`}</pre>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-zinc-500">
                Drop files above to start building your manifest
              </div>
            )}
          </motion.section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
