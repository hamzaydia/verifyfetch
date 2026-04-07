'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

const tabs = [
  {
    id: 'basic',
    label: 'Basic',
    filename: 'app.ts',
    code: `import { verifyFetch } from 'verifyfetch';

// Verify a file against its SRI hash
const response = await verifyFetch('/model.bin', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});

// That's it. Throws IntegrityError if hash doesn't match.
const model = await response.arrayBuffer();`,
  },
  {
    id: 'transformers',
    label: 'Transformers.js',
    filename: 'sentiment.ts',
    code: `import { verifiedPipeline } from '@verifyfetch/transformers';

// Drop-in replacement for pipeline() with verification
const classifier = await verifiedPipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  {
    manifestUrl: '/models.vf.manifest.json',
    onProgress: ({ file, percent }) =>
      console.log(\`\${file}: \${percent}%\`)
  }
);

const result = await classifier('I love this!');
// [{ label: 'POSITIVE', score: 0.99 }]`,
  },
  {
    id: 'webllm',
    label: 'WebLLM',
    filename: 'chat.ts',
    code: `import { VerifiedMLCEngine } from '@verifyfetch/webllm';

// Drop-in replacement for MLCEngine with verification
const engine = new VerifiedMLCEngine({
  verification: {
    manifestUrl: '/models/vf.manifest.json'
  }
});

await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');

const response = await engine.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }]
});`,
  },
  {
    id: 'streaming',
    label: 'Resumable',
    filename: 'resume.ts',
    code: `import { verifyFetchResumable } from 'verifyfetch';

// Download 4GB, fail at 3.8GB, resume from 3.8GB
const result = await verifyFetchResumable('/model.bin', {
  chunked: { root: 'sha256-...', chunkSize: 1048576, hashes: [...] },
  persist: true, // Saves progress to IndexedDB
  onProgress: ({ percent, resumed, speed, eta }) => {
    console.log(\`\${percent}% (\${resumed ? 'resumed' : 'fresh'})\`);
  }
});

const model = result.data; // Verified ArrayBuffer`,
  },
  {
    id: 'worker',
    label: 'Service Worker',
    filename: 'sw.js',
    code: `// sw.js - One-time setup
import { createVerifyWorker } from 'verifyfetch/worker';

createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx'],
  onFail: 'block'
});

// app.js - No changes needed!
const model = await fetch('/model.bin'); // Auto-verified!`,
  },
  {
    id: 'cli',
    label: 'CLI',
    filename: 'terminal',
    code: `# Generate hashes for any file
npx @verifyfetch/cli sign ./public/*.wasm ./models/*.bin

# Generate manifest for a HuggingFace model
npx @verifyfetch/cli hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english

# Verify files match their hashes (for CI/CD)
npx @verifyfetch/cli enforce --manifest ./vf.manifest.json`,
  },
];

// Simple syntax highlighter
function highlightCode(code: string, isTerminal: boolean = false): React.ReactNode[] {
  const lines = code.split('\n');

  return lines.map((line, lineIndex) => {
    if (isTerminal) {
      // Terminal highlighting
      if (line.startsWith('#')) {
        return (
          <span key={lineIndex}>
            <span className="text-zinc-500">{line}</span>
            {lineIndex < lines.length - 1 && '\n'}
          </span>
        );
      }
      // Highlight commands
      const parts = line.split(' ');
      return (
        <span key={lineIndex}>
          {parts.map((part, i) => {
            if (i === 0 && (part === 'npx' || part === 'npm')) {
              return <span key={i} className="text-emerald-400">{part}</span>;
            } else if (part === '@verifyfetch/cli' || part === 'verifyfetch' || part === 'sign' || part === 'enforce' || part === 'hash-model') {
              return <span key={i}><span className="text-blue-400">{part}</span></span>;
            } else if (part.startsWith('--')) {
              return <span key={i}><span className="text-yellow-300">{part}</span></span>;
            } else if (part.startsWith('./') || part.startsWith('*.')) {
              return <span key={i}><span className="text-cyan-300">{part}</span></span>;
            } else {
              return <span key={i} className="text-zinc-300">{part}</span>;
            }
          }).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ' ', curr], [] as React.ReactNode[])}
          {lineIndex < lines.length - 1 && '\n'}
        </span>
      );
    }

    // JavaScript/TypeScript highlighting
    const segments: React.ReactNode[] = [];
    let remaining = line;
    let keyCounter = 0;

    while (remaining.length > 0) {
      // Comments
      const commentMatch = remaining.match(/^(\/\/.*)/);
      if (commentMatch) {
        segments.push(<span key={keyCounter++} className="text-zinc-500">{commentMatch[1]}</span>);
        remaining = remaining.slice(commentMatch[1].length);
        continue;
      }

      // Strings (single and double quotes)
      const stringMatch = remaining.match(/^('[^']*'|"[^"]*")/);
      if (stringMatch) {
        segments.push(<span key={keyCounter++} className="text-emerald-400">{stringMatch[1]}</span>);
        remaining = remaining.slice(stringMatch[1].length);
        continue;
      }

      // Keywords
      const keywordMatch = remaining.match(/^(import|export|from|const|let|var|await|async|for|if|else|return|function|default)\b/);
      if (keywordMatch) {
        segments.push(<span key={keyCounter++} className="text-purple-400">{keywordMatch[1]}</span>);
        remaining = remaining.slice(keywordMatch[1].length);
        continue;
      }

      // Special functions (verifyFetch variants)
      const funcMatch = remaining.match(/^(verifyFetch|verifyFetchResumable|verifyFetchStream|verifyFetchFromSources|createVerifyWorker|verifiedPipeline|VerifiedMLCEngine|fetch|uploadToGPU|classifier|engine|console)\b/);
      if (funcMatch) {
        segments.push(<span key={keyCounter++} className="text-blue-400">{funcMatch[1]}</span>);
        remaining = remaining.slice(funcMatch[1].length);
        continue;
      }

      // Object keys (word followed by colon)
      const keyMatch = remaining.match(/^(\w+)(:)/);
      if (keyMatch) {
        segments.push(<span key={keyCounter++} className="text-cyan-300">{keyMatch[1]}</span>);
        segments.push(<span key={keyCounter++} className="text-zinc-400">{keyMatch[2]}</span>);
        remaining = remaining.slice(keyMatch[0].length);
        continue;
      }

      // Default: take one character
      segments.push(<span key={keyCounter++} className="text-zinc-300">{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }

    return (
      <span key={lineIndex}>
        {segments}
        {lineIndex < lines.length - 1 && '\n'}
      </span>
    );
  });
}

export function CodeExamples() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeTab, setActiveTab] = useState('basic');
  const [copied, setCopied] = useState(false);

  const activeExample = tabs.find((t) => t.id === activeTab);
  const activeCode = activeExample?.code || '';
  const isTerminal = activeTab === 'cli';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section ref={ref} className="py-12 sm:py-16 md:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4">
            Simple API, Real Protection
          </h2>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto">
            Multiple ways to protect your assets. Choose what fits your needs.
          </p>

          {/* Tab Buttons */}
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Code Block with Window Chrome */}
          <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
            {/* Window Chrome */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-zinc-500 font-mono">{activeExample?.filename}</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-400" />
                )}
              </button>
            </div>

            {/* Code Content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 sm:p-5 overflow-x-auto"
            >
              <pre className="text-xs sm:text-sm leading-relaxed font-mono">
                <code>{highlightCode(activeCode, isTerminal)}</code>
              </pre>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
