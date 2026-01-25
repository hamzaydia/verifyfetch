'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

const tabs = [
  {
    id: 'basic',
    label: 'Basic',
    code: `import { verifyFetch } from 'verifyfetch';

// Verify a file against its SRI hash
const response = await verifyFetch('/model.bin', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});

// That's it. Throws IntegrityError if hash doesn't match.
const model = await response.arrayBuffer();`,
  },
  {
    id: 'fallback',
    label: 'With Fallback',
    code: `import { verifyFetch } from 'verifyfetch';

// Auto-retry from backup server on failure
const response = await verifyFetch('/engine.wasm', {
  sri: 'sha256-abc123...',
  onFail: { fallbackUrl: 'https://backup.cdn.com/engine.wasm' }
});

// Or just warn instead of blocking
const wasm = await verifyFetch('/plugin.wasm', {
  sri: 'sha256-xyz789...',
  onFail: 'warn' // logs warning, continues anyway
});`,
  },
  {
    id: 'manifest',
    label: 'Manifest Mode',
    code: `import { createVerifyFetcher } from 'verifyfetch';

// Load manifest with all your SRI hashes
const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

// Hashes are looked up automatically
const model = await vf.arrayBuffer('/models/phi-3.bin');
const config = await vf.json('/config/settings.json');
const wasm = await vf.arrayBuffer('/engine.wasm');`,
  },
  {
    id: 'cli',
    label: 'CLI',
    code: `# Generate hashes for your files
npx @verifyfetch/cli sign ./public/*.wasm ./models/*.bin
# Output: vf.manifest.json with all SRI hashes

# Verify files match their hashes (for CI/CD)
npx @verifyfetch/cli enforce

# Generate hash for a single file
npx @verifyfetch/cli sign ./public/engine.wasm
# sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=`,
  },
];

export function CodeExamples() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeTab, setActiveTab] = useState('basic');
  const [copied, setCopied] = useState(false);

  const activeCode = tabs.find((t) => t.id === activeTab)?.code || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section ref={ref} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Simple API, Powerful Protection
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            One function. Any file size. Zero memory issues.
          </p>

          {/* Tab Buttons */}
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Code Block */}
          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="code-block"
            >
              <pre className="text-sm leading-relaxed">
                <code className="text-zinc-300">{activeCode}</code>
              </pre>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
