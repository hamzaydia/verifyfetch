'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Copy, Check, ArrowRight, Terminal, FileCode } from 'lucide-react';

const steps = [
  {
    number: '1',
    title: 'Install',
    type: 'terminal',
    code: 'npm install @verifyfetch/transformers @huggingface/transformers',
  },
  {
    number: '2',
    title: 'Generate a model manifest',
    type: 'terminal',
    code: 'npx @verifyfetch/cli hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  },
  {
    number: '3',
    title: 'Use it in your app',
    type: 'code',
    code: `import { verifiedPipeline } from '@verifyfetch/transformers';

const classifier = await verifiedPipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  { manifestUrl: '/models.vf.manifest.json' }
);`,
  },
  {
    number: '4',
    title: 'Enforce in CI',
    type: 'terminal',
    code: 'npx @verifyfetch/cli enforce --manifest ./models.vf.manifest.json',
  },
];

// Highlight terminal commands
function highlightTerminal(code: string): React.ReactNode[] {
  const parts = code.split(' ');
  return parts.map((part, i) => {
    let className = 'text-zinc-300';

    if (i === 0 && (part === 'npx' || part === 'npm')) {
      className = 'text-emerald-400';
    } else if (part === '@verifyfetch/cli' || part === '@verifyfetch/transformers' || part === '@huggingface/transformers' || part === 'verifyfetch' || part === 'install' || part === 'sign' || part === 'enforce' || part === 'hash-model') {
      className = 'text-blue-400';
    } else if (part.startsWith('--')) {
      className = 'text-yellow-300';
    } else if (part.startsWith('./') || part.startsWith('*.')) {
      className = 'text-cyan-300';
    }

    return (
      <span key={i}>
        {i > 0 && ' '}
        <span className={className}>{part}</span>
      </span>
    );
  });
}

// Highlight JS/TS code
function highlightCode(code: string): React.ReactNode[] {
  const lines = code.split('\n');

  return lines.map((line, lineIndex) => {
    const segments: React.ReactNode[] = [];
    let remaining = line;
    let keyCounter = 0;

    while (remaining.length > 0) {
      // Strings
      const stringMatch = remaining.match(/^('[^']*'|"[^"]*")/);
      if (stringMatch) {
        segments.push(<span key={keyCounter++} className="text-emerald-400">{stringMatch[1]}</span>);
        remaining = remaining.slice(stringMatch[1].length);
        continue;
      }

      // Keywords
      const keywordMatch = remaining.match(/^(import|export|from|const|let|var|await|async)\b/);
      if (keywordMatch) {
        segments.push(<span key={keyCounter++} className="text-purple-400">{keywordMatch[1]}</span>);
        remaining = remaining.slice(keywordMatch[1].length);
        continue;
      }

      // Functions
      const funcMatch = remaining.match(/^(verifyFetch|verifyFetchStream|verifiedPipeline|classifier)\b/);
      if (funcMatch) {
        segments.push(<span key={keyCounter++} className="text-blue-400">{funcMatch[1]}</span>);
        remaining = remaining.slice(funcMatch[1].length);
        continue;
      }

      // Object keys
      const keyMatch = remaining.match(/^(\w+)(:)/);
      if (keyMatch) {
        segments.push(<span key={keyCounter++} className="text-cyan-300">{keyMatch[1]}</span>);
        segments.push(<span key={keyCounter++} className="text-zinc-400">{keyMatch[2]}</span>);
        remaining = remaining.slice(keyMatch[0].length);
        continue;
      }

      // Default
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

export function QuickStart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <section id="get-started" ref={ref} className="py-12 sm:py-16 md:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4">
            Get Started in 30 Seconds
          </h2>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto">
            Four steps to protect your users from supply chain attacks.
          </p>

          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ x: -20, opacity: 0 }}
                animate={isInView ? { x: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="flex gap-3 sm:gap-4 md:gap-6"
              >
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm sm:text-base">
                    {step.number}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-full bg-zinc-800 mx-auto mt-2" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pb-6">
                  <h3 className="font-semibold text-white mb-3">{step.title}</h3>
                  <div className="relative group">
                    {/* Code block with left accent */}
                    <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                      {/* Header bar */}
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          {step.type === 'terminal' ? (
                            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                          ) : (
                            <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                          )}
                          <span className="text-xs text-zinc-500 font-mono">
                            {step.type === 'terminal' ? 'terminal' : 'app.ts'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(step.code, i)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors opacity-60 group-hover:opacity-100"
                        >
                          {copiedIndex === i ? (
                            <Check className="w-3 h-3 text-primary" />
                          ) : (
                            <Copy className="w-3 h-3 text-zinc-400" />
                          )}
                        </button>
                      </div>
                      {/* Code content */}
                      <div className="p-3 sm:p-4 overflow-x-auto">
                        <pre className="text-xs sm:text-sm leading-relaxed font-mono">
                          <code>
                            {step.type === 'terminal'
                              ? highlightTerminal(step.code)
                              : highlightCode(step.code)
                            }
                          </code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 sm:mt-10 md:mt-12"
          >
            <a
              href="https://github.com/hamzaydia/verifyfetch#readme"
              className="btn-primary"
            >
              Read the Full Documentation
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
